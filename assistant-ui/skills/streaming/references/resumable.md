# Resumable Streams

Persist an in-flight LLM response on the server so the client can reload, drop its connection, or open a new tab and pick up the same stream. This is assistant-ui's own `assistant-stream/resumable` subpackage, unrelated to Vercel's `resumable-stream` package.

## Contents

[How it works](#how-it-works) | [Server: the context](#server-the-context) | [Server: routes](#server-routes) | [Context API](#context-api) | [Client: AssistantChatTransport](#client-assistantchattransport) | [Multiple threads](#multiple-threads) | [Helpers for AssistantStreamController callbacks](#helpers-for-assistantstreamcontroller-callbacks) | [Stores](#stores) | [Custom ResumableStreamStore](#custom-resumablestreamstore) | [Production notes](#production-notes) | [Exports](#exports)

## How it works

Persistence happens at the byte level after encoding, so it works with any encoder `assistant-stream` ships (AI SDK UI message stream, Data Stream, Assistant Transport SSE) or any custom one. The first request for a `streamId` becomes the producer and writes encoded bytes to a store while the LLM call is in flight; reconnects become consumers that replay the persisted bytes plus any new ones until the producer finalizes. If your responses are short and reload survival does not matter, plain `streamText().toUIMessageStreamResponse()` is enough and you can skip this package.

## Server: the context

Construct a `ResumableStreamContext` once per process and reuse it across requests; it is the seam between route handlers and the storage backend.

```ts title="/lib/resumable-context.ts"
import {
  createInMemoryResumableStreamStore,
  createResumableStreamContext,
} from "assistant-stream/resumable";

const store = createInMemoryResumableStreamStore();
export const resumableContext = createResumableStreamContext({ store });
```

`ResumableStreamContextOptions`: `store` (required), `ttlMs` (per-deployment override), `waitUntil` (pass `after` from `next/server`, or `ctx.waitUntil` on Cloudflare Workers, so the producer task survives past the response on serverless), and the observability hooks `onAcquire(streamId, role)`, `onAppend(streamId, byteLength)`, `onFinalize(streamId, status, error?)`, `onError(streamId, error)`. Hook exceptions and rejected promises are reported through `console.error` without affecting stream output; keep `onAcquire` cheap since it runs on the request path for producers and consumers alike, while the rest run on the producer's hot path.

## Server: routes

Wrap the response body in `ctx.run(streamId, makeStream)`; the first caller for `streamId` becomes the producer (the callback runs), later callers and reconnects become consumers.

```ts title="/app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const streamId = crypto.randomUUID();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });
  const sourceBody = result.toUIMessageStreamResponse().body!;

  const stream = await resumableContext.run(streamId, () => sourceBody);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      [RESUMABLE_STREAM_ID_HEADER]: streamId,
    },
  });
}
```

`RESUMABLE_STREAM_ID_HEADER` is the literal string `"x-resumable-stream-id"`. A separate GET endpoint replays persisted bytes for reconnecting clients:

```ts title="/app/api/chat/resume/[streamId]/route.ts"
import { RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

export async function GET(_req: Request, ctx: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await ctx.params;
  const stream = await resumableContext.resume(streamId);
  if (!stream) {
    return new Response(JSON.stringify({ error: "stream not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", [RESUMABLE_STREAM_ID_HEADER]: streamId },
  });
}
```

## Context API

| Method | Behavior |
| --- | --- |
| `ctx.run(streamId, makeStream)` | First caller is the producer (runs `makeStream`); later callers and reconnects become consumers |
| `ctx.resume(streamId)` | Returns a replay stream, or `null` if the stream is missing |
| `ctx.requireResume(streamId)` | Like `resume`, but throws `ResumableStreamError("missing")` instead of returning `null` |
| `ctx.status(streamId)` | `"streaming" \| "done" \| "error" \| "missing"` |
| `ctx.delete(streamId)` | Removes all persisted state and terminates active readers |

`ResumableStreamError` (from `assistant-stream/resumable`) carries a `code` of `"missing" | "exists" | "finalized" | "invalid-id"`; catch it in the resume route to distinguish "stream gone" from other failures.

## Client: AssistantChatTransport

`@assistant-ui/ai-sdk` ships a `resumable` option on `AssistantChatTransport`. It captures the stream id from the response header, redirects `chat.resumeStream()` reconnects to your resume route, and clears the stored id when the response finishes naturally. `useChatRuntime` fires `chat.resumeStream()` whenever its resumable storage reports a pending id, including one discovered after mount.

```tsx title="/app/page.tsx"
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  createResumableSessionStorage,
  useChatRuntime,
} from "@assistant-ui/ai-sdk";
import { useMemo } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

const storage = createResumableSessionStorage();

export default function Page() {
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        resumable: { storage, resumeApi: (streamId) => `/api/chat/resume/${streamId}` },
      }),
    [],
  );
  const runtime = useChatRuntime({
    transport,
    onResumeError: (error) => console.error("Could not resume the previous response", error),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

`AssistantChatResumableOptions`: `storage: ResumableClientStorage`, `resumeApi: string | ((streamId: string) => string)`, and `isFinishEvent?: (chunk: Uint8Array, accumulator: string) => boolean` (overrides the default detector, which scans the SSE body for the AI SDK `"type":"finish"` marker; cancellation never triggers it). `onResumeError` is a `useChatRuntime` option, called when a stored stream id exists but the reconnect attempt fails; assistant-ui clears the failed id afterward unless a newer one has already replaced it.

`createResumableSessionStorage(options?: { key?: string | (() => string | undefined) })` returns a `ResumableClientStorage` (`getStreamId`, `setStreamId`, `clear`, and an optional `subscribe` for post-mount updates) backed by `window.sessionStorage`. A static `key` namespaces per route; a getter is read lazily on every access so the key can track the active thread's identity, and while it returns `undefined` reads report no pending stream and writes are dropped. Reuse one storage instance per key: separate instances do not share their in-memory ownership cache.

## Multiple threads

One shared `sessionStorage` key is correct for a single chat surface. Under a thread list runtime (`useRemoteThreadListRuntime`, which `useChatRuntime` wraps) with more than one alive thread, a single shared key gets written and cleared by whichever thread acts last: switching threads mid-response can make the thread you switch to replay another conversation's stream. Scope the key to the thread instead, constructing the transport and storage inside a per-thread runtime hook and deriving the key from that thread's identity:

```tsx
function ResumableThreadRuntime() {
  const aui = useAui();
  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: "/api/chat",
        resumable: {
          storage: createResumableSessionStorage({
            key: () => {
              const item = aui.threadListItem.getState();
              return `aui-resumable-stream-id:${item.remoteId ?? item.id}`;
            },
          }),
          resumeApi: (streamId) => `/api/chat/resume/${streamId}`,
        },
      }),
    [aui],
  );
  return useChatRuntime({ transport });
}
```

Key by `remoteId ?? id`: a brand-new thread has no `remoteId` yet, but by the time the response header delivers the stream id the getter has resolved to it, and a reload finds the same conversation (and the same stored entry) under that `remoteId`. Keying by the local id alone breaks resume across reloads, since a thread's local id is replaced once the list reloads. Pass `ResumableThreadRuntime` as the `runtimeHook` of `useRemoteThreadListRuntime`; `useChatRuntime` nested that way is a no-op thread list, so only the outer runtime manages the list itself.

## Helpers for AssistantStreamController callbacks

If you produce streams with `createAssistantStream` rather than the AI SDK, two helpers bridge the controller-callback style and any encoder to the store, setting `x-resumable-stream-id` automatically:

```ts
import {
  createResumableAssistantStreamResponse,
  createResumeAssistantStreamResponse,
} from "assistant-stream/resumable";
import { resumableContext } from "@/lib/resumable-context";

// POST handler
return createResumableAssistantStreamResponse({
  context: resumableContext,
  streamId,
  callback: (controller) => {
    /* same shape as createAssistantStreamResponse */
  },
});

// GET resume handler
return createResumeAssistantStreamResponse({ context: resumableContext, streamId });
```

Both default to `DataStreamEncoder`; pass `encoder: () => new AssistantTransportEncoder()` (a factory, not an instance) to use a different one. `createResumeAssistantStreamResponse` also takes `missingResponse` (defaults to a 404 JSON body) for when the stream is gone.

## Stores

`createInMemoryResumableStreamStore(options?)` is for development and tests; state lives in a process-local `Map` and does not survive a restart. It returns `ResumableStreamStore & { dispose: () => void }`, call `dispose()` to stop its periodic eviction timer. Options: `defaultTtlMs` (default 24 hours), `maxChunkBytes`, `maxEntriesPerStream`, `maxStreams`, `gcIntervalMs`, and `now` (a clock override for tests).

For production, two Redis-family adapters batch the per-append write and TTL refresh into one pipelined round trip, store chunks as binary, share `keyPrefix`, `defaultTtlMs`, `pollIntervalMs`, and `maxChunkBytes` options, and route Redis Cluster correctly because every stream's keys share a `{streamId}` hash tag. Finalization runs as a server-side Lua script, so the connection must allow `EVAL`.

```ts
import { createClient } from "redis";
import { createRedisResumableStreamStore } from "assistant-stream/resumable/redis";

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();
export const store = createRedisResumableStreamStore(client, { keyPrefix: "aui:prod" });
```

`createRedisResumableStreamStore` (from `assistant-stream/resumable/redis`) targets [`redis`](https://www.npmjs.com/package/redis) v5 (node-redis); `createIoredisResumableStreamStore` (from `assistant-stream/resumable/ioredis`) targets [`ioredis`](https://www.npmjs.com/package/ioredis) v5 or v6 and accepts either a `Redis` or a `Cluster` instance. Both take the client as the first argument and `RedisResumableStreamStoreOptions` as the second; the Redis adapters validate `streamId` against `/^[A-Za-z0-9_.:-]{1,256}$/` (UUIDv4 is compatible).

## Custom ResumableStreamStore

For Postgres, Cloudflare Durable Objects, Upstash REST, or any other backend, implement the interface directly (six async methods over an opaque `streamId` and a monotonic byte log):

```ts
export interface ResumableStreamStore {
  acquire(streamId: string, options?: ResumableStreamAcquireOptions): Promise<ResumableStreamRole>;
  append(streamId: string, chunk: Uint8Array): Promise<void>;
  finalize(streamId: string, status: "done" | "error", error?: string): Promise<void>;
  read(streamId: string, cursor: string, signal: AbortSignal): AsyncIterable<ResumableStreamEntry>;
  status(streamId: string): Promise<ResumableStreamStatus>;
  delete(streamId: string): Promise<void>;
}
```

`acquire` is the only method that needs cross-process atomicity: the first caller for a `streamId` resolves `"producer"`, every later caller (including after `finalize`) resolves `"consumer"`, and the check-and-insert must be one round trip (Redis `SET key value NX EX ttl`; Postgres `INSERT ... ON CONFLICT (stream_id) DO NOTHING RETURNING ...`; Durable Objects one object per `streamId` plus a boolean; Upstash REST `set` with `nx=true`). `append` adds a chunk under a fresh, strictly increasing cursor, observable to `read` before the promise resolves, and should refresh the TTL. `finalize` is an idempotent terminal flip. `read` yields every entry whose cursor sorts after the given cursor (`""` means from the start), then waits for new appends, then completes on finalize; aborting `signal` resolves cleanly without throwing, so implementations must not busy-loop. `status` answers without opening a `read` iterator. `delete` removes all state and terminates active readers, and is a no-op when the stream is already gone. A full worked `Map`-backed example is in the [Custom Resumable Stream Stores](https://www.assistant-ui.com/docs/guides/resumable-stream-stores) guide.

## Production notes

- **Auth.** The resume route as shown serves any caller who knows the `streamId`. Treat it as opaque, not a credential (it leaks via headers, `sessionStorage`, browser history, access logs); bind it to the requesting user at acquire time and verify the binding on every resume, returning 404 rather than 403 so you do not confirm the stream's existence to a caller who does not own it.
- **`waitUntil` on serverless.** Vercel and Cloudflare tear the handler down once the response returns, which would kill the producer task; pass `after` from `next/server`, or forward `ExecutionContext.waitUntil` on Workers.
- **TTL.** Streams expire 24 hours after the last write by default. Shorten it (5 to 30 minutes) when chunks carry sensitive payloads; extend it for agent tasks that legitimately run past a day. Configure `defaultTtlMs` on the store for the global default, `ttlMs` on the context for a per-deployment override, and keep the store TTL, any owner-binding key, and any signed cookie referencing `streamId` in sync.
- **Multi-tenant isolation.** Set a per-environment `keyPrefix` on the Redis stores so tenants cannot collide, and so an incident response `SCAN` can target one tenant without touching the rest.
- **Resource limits.** The in-memory store enforces `maxChunkBytes`, `maxEntriesPerStream`, and `maxStreams`, caps the Redis adapters leave to the database (`maxmemory` plus an eviction policy, and application-level rate limiting).
- **Incident response.** Log the acquiring user, request id, and IP on every `onAcquire`, and the finalize status on every `onFinalize`. To contain a suspected leak, rotate `keyPrefix`, invalidate any session cookie referencing a `streamId`, drop the owner-binding keys for affected users, and shorten `defaultTtlMs` temporarily so orphaned streams roll off quickly.

See [Resumable Stream Deployment](https://www.assistant-ui.com/docs/guides/resumable-stream-deployment) for the full treatment with runnable snippets.

## Exports

`assistant-stream/resumable`: `createResumableStreamContext`, `createInMemoryResumableStreamStore`, `createResumableAssistantStreamResponse`, `createResumeAssistantStreamResponse`, `RESUMABLE_STREAM_ID_HEADER`, `ResumableStreamError`, plus the types `ResumableStreamContext`, `ResumableStreamContextOptions`, `InMemoryResumableStreamStoreOptions`, `CreateResumableAssistantStreamResponseOptions`, `CreateResumeAssistantStreamResponseOptions`, `ResumableStreamErrorCode`, `ResumableStreamStore`, `ResumableStreamRole`, `ResumableStreamStatus`, `ResumableStreamEntry`, `ResumableStreamAcquireOptions`.

`assistant-stream/resumable/redis`: `createRedisResumableStreamStore`, plus the types `RedisLikeClient`, `RedisResumableStreamStoreOptions`, `RedisFinalizeOptions`. `assistant-stream/resumable/ioredis`: `createIoredisResumableStreamStore` (same option type).

`@assistant-ui/ai-sdk`: `AssistantChatTransport` (with the `resumable` option), `createResumableSessionStorage`, `useChatRuntime`, `RESUMABLE_STREAM_ID_HEADER` (re-exported), plus the types `AssistantChatResumableOptions`, `ResumableClientStorage`.
