# Data Stream Protocol

`@assistant-ui/react-data-stream`'s `useDataStreamRuntime` is a `LocalRuntime` (see [runtime](../../runtime/SKILL.md)) that speaks two related SSE-ish wire formats under one name: the current AI SDK **UI message stream** protocol, and assistant-stream's own **data stream** protocol (the numbered-prefix format also used by the now-removed AI SDK v4 `toDataStreamResponse()`). Both are consumed the same way from the client, which is the point of this runtime: your backend does not have to be AI SDK based.

This is a different client than `useChatRuntime`/`AssistantChatTransport` (see [setup](../../setup/SKILL.md)), which drives AI SDK's own `useChat` and only ever speaks UI message stream. Reach for `useDataStreamRuntime` for a backend that is not built on `streamText`, for React Native or React Ink (no `useChat` there), or when you want assistant-stream's own decode and accumulation pipeline directly.

## Contents

[Protocol detection](#protocol-detection) | [Producing it](#producing-it) | [Client setup](#client-setup) | [Headers, body, and callbacks](#headers-body-and-callbacks) | [Tool integration](#tool-integration) | [Manual decoding](#manual-decoding) | [Wire format](#wire-format) | [Message conversion](#message-conversion)

## Protocol detection

`useDataStreamRuntime` inspects response headers when `protocol` is omitted:

| Protocol | Detection header | Producer |
| --- | --- | --- |
| `"ui-message-stream"` | `x-vercel-ai-ui-message-stream: v1`, or the fallback when no marker matches | AI SDK v5 to v7's `result.toUIMessageStreamResponse()`, or `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` |
| `"data-stream"` | `x-vercel-ai-data-stream: v1` | `createAssistantStreamResponse` from `assistant-stream` |

Pass `protocol` explicitly only for an endpoint that strips or never sets these headers.

## Producing it

A custom, non AI SDK backend emits the `data-stream` marker through `createAssistantStreamResponse`, writing with an `AssistantStreamController` (full method table in [SKILL.md](../SKILL.md)):

```ts title="app/api/chat/route.ts"
import { createAssistantStreamResponse } from "assistant-stream";

export async function POST(request: Request) {
  const { messages, tools, system } = await request.json();

  return createAssistantStreamResponse(async (controller) => {
    const stream = await processWithAI({ messages, tools, system });
    for await (const chunk of stream) {
      controller.appendText(chunk.text);
    }
  });
}
```

`createAssistantStreamResponse` returns a standard `Response`; it drops into any Fetch-style route (Next.js App Router, Hono, Bun, Deno, Cloudflare Workers). On a framework with its own response object (Express, Fastify), copy `status` and `headers`, then pipe `response.body` into the framework's writable stream rather than handing the `Response` itself to an object whose lifecycle the framework already owns.

An AI SDK backed backend emits the `ui-message-stream` marker instead, and does not need `assistant-stream` at all on the write side:

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

`result.toUIMessageStreamResponse()` is the shorter equivalent; both compile against `ai@^7`.

## Client setup

```tsx title="app/page.tsx"
"use client";

import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function ChatPage() {
  const runtime = useDataStreamRuntime({ api: "/api/chat" });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

React Native and React Ink use the same hook from their own `AssistantRuntimeProvider` (`@assistant-ui/react-native` or `@assistant-ui/react-ink`); point `api` at an absolute URL since there is no same-origin route to call.

`useDataStreamRuntime` accepts every `LocalRuntimeOptions` field in addition to its own (`initialMessages`, `maxSteps`, `cloud`, `adapters`); the `chatModel` adapter slot is handled internally and cannot be overridden.

## Headers, body, and callbacks

```tsx
const runtime = useDataStreamRuntime({
  api: "/api/chat",
  headers: async () => ({ Authorization: `Bearer ${await getAuthToken()}` }),
  body: async () => ({ requestId: crypto.randomUUID() }),
  credentials: "include",
  onResponse: (response) => console.log("status:", response.status),
  onFinish: (message) => console.log("done:", message),
  onError: (error) => console.error(error),
  onCancel: () => console.log("cancelled"),
});
```

`headers` and `body` also accept plain objects when they do not need to be computed per request.

## Tool integration

Human-in-the-loop tools (`unstable_humanToolNames`, `human()` interrupts) are not supported here; use [`LocalRuntime`](../../runtime/SKILL.md) directly if you need them.

Serialize client-side tools into the request body with `toToolsJSONSchema`:

```tsx
import { tool } from "@assistant-ui/react";
import { toToolsJSONSchema } from "assistant-stream";

const myTools = {
  get_weather: tool({
    description: "Get current weather",
    parameters: z.object({ location: z.string() }),
    execute: async ({ location }) => fetchWeather(location),
  }),
};

const runtime = useDataStreamRuntime({
  api: "/api/chat",
  body: { tools: toToolsJSONSchema(myTools) },
});
```

Tool results stream back through the `result` chunk automatically; the backend just needs to read `tools` off the request body and pass them to its model call.

## Manual decoding

`useDataStreamRuntime` already does this internally; reach for it yourself when consuming an assistant-stream response outside that hook, for example inside a hand-written `LocalRuntime.ChatModelAdapter`:

```tsx
import { useLocalRuntime } from "@assistant-ui/react";
import { AssistantStream, DataStreamDecoder } from "assistant-stream";

const runtime = useLocalRuntime({
  async *run({ messages, abortSignal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });

    const stream = AssistantStream.fromResponse(response, new DataStreamDecoder());
    let text = "";
    for await (const chunk of stream) {
      if (chunk.type === "text-delta") {
        text += chunk.textDelta;
        yield { content: [{ type: "text", text }] };
      }
    }
  },
});
```

`DataStreamDecoder` only understands the numbered-prefix `data-stream` marker format. To decode a `ui-message-stream` response the same way, swap in `UIMessageStreamDecoder` (see [encoders.md](./encoders.md)); `AssistantStream.fromResponse` takes either.

## Wire format

`data-stream` is line oriented: `<prefix>:<json>\n`. `DataStreamEncoder` emits the rows marked "yes"; the rest are decode-only, accepted for compatibility with AI SDK v4 output and currently otherwise unused.

| Prefix | Chunk | Emitted | Carries |
| --- | --- | --- | --- |
| `0` | TextDelta | yes | a plain text delta |
| `2` | Data | yes | app data (`AssistantStreamChunk` `data`) |
| `3` | Error | yes | an error message string |
| `8` | Annotation | yes | provider/app annotations |
| `9` | ToolCall | no | a complete, non-streamed tool call (AI SDK v4 compat) |
| `a` | ToolCallResult | yes | `{ toolCallId, result, artifact?, isError? }` |
| `b` | StartToolCall | yes | `{ toolCallId, toolName, parentId? }` |
| `c` | ToolCallArgsTextDelta | yes | `{ toolCallId, argsTextDelta, isFinal? }` |
| `d` | FinishMessage | yes | `{ finishReason, usage }` |
| `e` | FinishStep | yes | `{ finishReason, usage, isContinued }` |
| `f` | StartStep | yes | `{ messageId }` |
| `g` | ReasoningDelta | yes | a plain reasoning delta |
| `h` | Source | yes | `{ sourceType: "url", id, url, title? }` |
| `i` | RedactedReasoning | no | ignored on decode |
| `j` | ReasoningSignature | no | ignored on decode |
| `k` | File | yes | `{ data, mimeType, parentId? }` |
| `aui-state` | AuiUpdateStateOperations | yes | `AssistantTransportStateOperation[]` (see [assistant-transport.md](./assistant-transport.md)) |
| `aui-text-delta` | AuiTextDelta | yes | a text delta with `parentId` (nested text) |
| `aui-reasoning-delta` | AuiReasoningDelta | yes | a reasoning delta with `parentId` |
| `aui-reasoning-part-start` | AuiReasoningPartStart | yes, only when a summary is set | `{ unstable_summary, parentId? }` |
| `aui-data` | AuiDataPart | yes | `{ name, data, parentId? }` |

The `x-vercel-ai-data-stream: v1` response header is what tells a client to parse this format rather than `ui-message-stream`.

## Message conversion

```tsx
import { toGenericMessages, toToolsJSONSchema } from "assistant-stream";

const genericMessages = toGenericMessages(messages);
const toolSchemas = toToolsJSONSchema(tools);
```

`GenericMessage` is a union of `system`, `user` (text and file parts), `assistant` (text and tool-call parts), and `tool` (tool-result parts); it converts easily to any LLM provider's message format. `toLanguageModelMessages` from `@assistant-ui/react-data-stream` is the older, AI-SDK-specific equivalent (it wraps `toGenericMessages`); it is deprecated in favor of calling `toGenericMessages` directly for new integrations.
