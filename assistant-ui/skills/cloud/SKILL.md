---
name: cloud
description: "Adds AssistantCloud backed persistence, authorization, and telemetry to assistant-ui apps. Use when wiring cross-session thread and message history, multi-device chat, message feedback, file uploads, or auth: passing `cloud` to `useChatRuntime` from `@assistant-ui/ai-sdk`, `AISDKThreads({ cloud })` for `AuiConfig` hosts, the standalone `useCloudChat`/`useThreads` hooks from `@assistant-ui/cloud-ai-sdk`, or `cloud` on `useLangGraphRuntime`. Covers constructing `AssistantCloud` with `authToken` (JWT), `apiKey` plus `userId`/`workspaceId` (server-side), or `anonymous`; direct provider integrations (Clerk, Auth0, Supabase, Firebase) and a backend token endpoint; and the client surface verified against source: `cloud.threads.{list,get,create,update,delete}`, `cloud.threads.messages.{list,create,update,feedback}`, `cloud.files.{generatePresignedUploadUrl,pdfToImages}`, `cloud.runs.{stream,report}`, `cloud.projects.threads`, `cloud.auth.tokens.create`, and `cloud.telemetry`. Also covers a custom `ThreadHistoryAdapter` built on `CloudMessagePersistence`/`createFormattedPersistence`, run telemetry (`beforeReport`, sub-agent tracking with `wrapSamplingHandler`), and the `NEXT_PUBLIC_ASSISTANT_BASE_URL`/`ASSISTANT_API_KEY` env vars. Route here for threads that do not persist, 401s against the cloud API, or feedback buttons that do not save. For the `<ThreadList />` sidebar UI itself use thread-list; for the general `RemoteThreadListAdapter`/`ThreadHistoryAdapter` contract use runtime."
license: MIT
---

# assistant-ui Cloud

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Assistant Cloud is a hosted service that adds thread persistence, message history, auto-generated titles, message feedback, and file uploads to any React chat UI, with or without assistant-ui's own components. One `AssistantCloud` client backs three integration paths: the full assistant-ui runtime, a standalone AI SDK hook, and LangGraph Cloud.

## Contents

- [References](#references) | [Install](#install) | [Quick start: useChatRuntime](#quick-start-usechatruntime) | [AuiConfig hosts: AISDKThreads](#auiconfig-hosts-aisdkthreads) | [Standalone AI SDK: useCloudChat](#standalone-ai-sdk-usecloudchat) | [LangGraph](#langgraph-uselanggraphruntime) | [Message feedback](#message-feedback) | [Authentication](#authentication) | [Client API](#client-api) | [Environment variables](#environment-variables) | [Common Gotchas](#common-gotchas) | [Related Skills](#related-skills)

## References

- [./references/persistence.md](./references/persistence.md) -- the thread, message, file, and run client API in full, verified against source
- [./references/authorization.md](./references/authorization.md) -- the three auth modes and direct provider integrations (Clerk, Auth0, Supabase, Firebase)
- [./references/custom-persistence.md](./references/custom-persistence.md) -- `CloudMessagePersistence` and `createFormattedPersistence`, for a custom `ThreadHistoryAdapter` backed by cloud message storage
- [./references/auth-integrations.md](./references/auth-integrations.md) -- non-cloud auth gating with Auth.js (next-auth), Clerk, and better-auth, plus pairing AssistantCloud with a backend token endpoint

## Install

```bash
npm install @assistant-ui/react @assistant-ui/ai-sdk
```

`assistant-cloud` ships as a dependency of `@assistant-ui/react`, which re-exports `AssistantCloud` for browser code. Server-side code (API routes, token endpoints) that has no reason to depend on `@assistant-ui/react` imports `AssistantCloud` from `assistant-cloud` directly.

## Quick start: useChatRuntime

`useChatRuntime({ cloud })` from `@assistant-ui/ai-sdk` wraps AI SDK's `useChat` and adds persistence. It creates a cloud thread on the first message, persists messages as they stream, generates a title after the first response, loads history on thread switch through `<ThreadList />`, and submits message feedback against the stored message.

```tsx
"use client";

import { useMemo } from "react";
import { AssistantCloud, AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";

export default function ChatPage() {
  const cloud = useMemo(
    () =>
      new AssistantCloud({
        baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
        anonymous: true,
      }),
    [],
  );

  const runtime = useChatRuntime({ cloud });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="grid h-dvh grid-cols-[250px_1fr] gap-x-2">
        <ThreadList />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

`anonymous: true` is for demos; see [Authentication](#authentication) for production auth. `useChatRuntime` also accepts `adapters.history` (a `ThreadHistoryAdapter`, must implement `withFormat` to combine with AI SDK), `adapters.feedback` (defaults to the cloud feedback adapter when `cloud` is set), `adapters.attachments`, `toCreateMessage`, `transport` (defaults to `AssistantChatTransport` calling `/api/chat`), and `onResumeError`.

## AuiConfig hosts: AISDKThreads

`AISDKThreads({ cloud })` from `@assistant-ui/ai-sdk` is the `AuiConfig` equivalent for a host that is not `AssistantRuntimeProvider` (Vue, or a hand-rolled `AssistantClient`). With `cloud` set, the thread list is a `RemoteThreadList` with background threads: every visited thread keeps running and its own history after a switch, and a freshly created thread titles itself.

```tsx
import { AuiConfig, AuiProvider } from "@assistant-ui/react";
import { AISDKThreads } from "@assistant-ui/ai-sdk";

const config = AuiConfig({
  threads: AISDKThreads({ cloud }),
});
```

## Standalone AI SDK: useCloudChat

`useCloudChat()` from `@assistant-ui/cloud-ai-sdk` adds full persistence to a hand-rolled AI SDK UI, no assistant-ui components required. Zero-config: with no arguments it creates an anonymous cloud client from `NEXT_PUBLIC_ASSISTANT_BASE_URL` and manages threads internally.

```tsx
"use client";

import { useCloudChat } from "@assistant-ui/cloud-ai-sdk";

export default function Chat() {
  const { messages, sendMessage, threads } = useCloudChat();
  // threads.threads, threads.threadId, threads.selectThread(id | null),
  // threads.create/delete/rename/archive/unarchive/generateTitle, threads.refresh
}
```

Pass `{ cloud }` for an authenticated client, or `{ threads: useThreads({ cloud, includeArchived }) }` to manage the list from a separate component (a sidebar) while the chat reads the shared state. `useThreads` pages 20 threads per request and follows Cloud's cursor until the list is complete. The hook also accepts most `useChat` options (those on `ChatInit`); `experimental_throttle` and `resume` are not supported. Full parameter and return tables: [cloud-ai-sdk API reference](https://www.assistant-ui.com/docs/api-reference/integrations/cloud-ai-sdk).

## LangGraph: useLangGraphRuntime

`useLangGraphRuntime` from `@assistant-ui/react-langgraph` takes `cloud` alongside `stream`, `create`, `load`, and `delete` for cloud-backed thread management over a LangGraph Cloud backend.

```tsx
"use client";

import { AssistantCloud, AssistantRuntimeProvider } from "@assistant-ui/react";
import { useLangGraphRuntime, type LangChainMessage } from "@assistant-ui/react-langgraph";
import { useMemo } from "react";
import { createThread, deleteThread, getThreadState, sendMessage } from "@/lib/chatApi";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const cloud = useMemo(
    () => new AssistantCloud({ baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!, anonymous: true }),
    [],
  );

  const runtime = useLangGraphRuntime({
    cloud,
    stream: async function* (messages, { initialize }) {
      const { externalId } = await initialize();
      if (!externalId) throw new Error("Thread not found");
      return sendMessage({ threadId: externalId, messages });
    },
    create: async () => ({ externalId: (await createThread()).thread_id }),
    load: async (externalId) => {
      const state = await getThreadState(externalId);
      return { messages: (state.values as { messages?: LangChainMessage[] }).messages ?? [] };
    },
    delete: async (externalId) => deleteThread(externalId),
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

`create` returns `{ externalId }`, your backend's LangGraph thread id; `load` returns that thread's messages (and optionally interrupts); `delete` receives the `externalId` and, when provided, enables delete from the thread list UI.

## Message feedback

When `cloud` is set on `useChatRuntime` (or `AISDKThreads`), the runtime wires a default `FeedbackAdapter` that calls `cloud.threads.messages.feedback` automatically, so the built-in thumbs up and down buttons persist against the stored message with no extra code. Calling it directly:

```ts
const { feedback_id, type } = await cloud.threads.messages.feedback(threadId, messageId, {
  type: "positive", // or "negative"
});
```

## Authentication

Three constructor shapes, chosen by which fields you pass:

```ts
// JWT (recommended for production; client-side)
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  authToken: async () => getAuthToken(), // returns a JWT, or null
});

// API key (server-side only; baseUrl defaults to https://backend.assistant-api.com)
const cloud = new AssistantCloud({
  apiKey: process.env.ASSISTANT_API_KEY!,
  userId: user.id,
  workspaceId: user.workspaceId,
});

// Anonymous (demos and prototypes; a new user per browser session)
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  anonymous: true,
});
```

Authorization is scoped to a workspace (commonly `userId`, `orgId_userId`, or `projectId_userId`). Wire a direct provider integration (Clerk, Auth0, Supabase, Firebase) from the Assistant Cloud dashboard, or mint a token server-side with the API key client and return it from an endpoint your frontend's `authToken` callback fetches. See [authorization.md](./references/authorization.md) for both paths in full, and [auth-integrations.md](./references/auth-integrations.md) for pairing Cloud with Auth.js, Clerk, or better-auth session data.

## Client API

Every method is verified against `src/cloud/**`. `threadId`/`messageId` are always the first arguments; list endpoints page with `after` (a cursor, not an offset).

```ts
// Threads
const { threads } = await cloud.threads.list({ is_archived: false, limit: 50, after: cursor });
const thread = await cloud.threads.get(threadId);
const { thread_id } = await cloud.threads.create({ last_message_at: new Date(), title, external_id, metadata });
await cloud.threads.update(threadId, { title, last_message_at, metadata, is_archived });
await cloud.threads.delete(threadId);

// Messages (parent_id and format are required on create; update touches content only)
const { messages } = await cloud.threads.messages.list(threadId, { format: "ai-sdk/v6" });
const { message_id } = await cloud.threads.messages.create(threadId, { parent_id, format, content });
await cloud.threads.messages.update(threadId, messageId, { content });
await cloud.threads.messages.feedback(threadId, messageId, { type: "positive" });

// Files
const { signedUrl, publicUrl, expiresAt } = await cloud.files.generatePresignedUploadUrl({ filename });
await fetch(signedUrl, { method: "PUT", body: file });
const { urls } = await cloud.files.pdfToImages({ file_url }); // or file_blob

// Runs, projects, auth
await cloud.runs.report(runReport); // telemetry sink; the runtime calls this for you
const { threads: projectThreads } = await cloud.projects.threads.list({ limit: 50, after: cursor }); // whole project, not one workspace
const { messages: projectMessages } = await cloud.projects.threads.messages.list(threadId, { limit: 50, after: cursor });
const { token } = await cloud.auth.tokens.create(); // server-side, API key mode
cloud.telemetry; // { enabled: boolean, beforeReport? }
```

`cloud.threads.create`'s `last_message_at` is required; everything else on create and update is optional. `CloudThread` fields: `id`, `title`, `last_message_at`, `created_at`, `updated_at`, `is_archived`, `external_id`, `metadata`, `project_id`, `workspace_id`. `CloudMessage` fields: `id`, `parent_id`, `height`, `format`, `content`, `created_at`, `updated_at`. `content`/`format` are opaque to the client; `useChatRuntime`, `AISDKThreads`, and `useCloudChat` all write `format: "ai-sdk/v6"` with an AI SDK `UIMessage`-shaped `content`. `cloud.projects.threads.messages.list` accepts `limit`/`after` paging that `cloud.threads.messages.list` does not. Failed requests throw `CloudAPIError` (with `.status`) from `assistant-cloud`; a malformed response throws `CloudResponseError`. Full detail, auto-save behavior, telemetry fields, and error handling: [persistence.md](./references/persistence.md).

## Environment variables

```env
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://proj-[YOUR-ID].assistant-api.com  # client-side
ASSISTANT_API_KEY=your-api-key-here                                     # server-side only, never expose to the client
```

React Native reads `EXPO_PUBLIC_ASSISTANT_BASE_URL`; React Ink reads `ASSISTANT_BASE_URL` (no `NEXT_PUBLIC_` prefix, since there is no bundler exposing it to a browser).

## Common Gotchas

**Threads not persisting**
- `cloud` must be passed to `useChatRuntime`, `AISDKThreads`, or `useCloudChat`; a thread with no messages yet is never created.
- Check that `authToken` isn't silently resolving to `null`: any real request then throws a plain `Error("Authorization failed")` before it reaches the network, distinct from a `CloudAPIError` 401.

**401 or "Authorization failed" against the cloud API**
- Verify `baseUrl` matches the project's Frontend API URL exactly (no trailing content after the host).
- For JWT mode, confirm `authToken` resolves before the first request; for a Clerk template, the aud claim in the JWT must be `"assistant-ui"`.

**Feedback buttons render but nothing persists**
- The default feedback adapter only wires up when `cloud` is passed to the runtime; a custom `adapters.feedback` overrides it entirely.

**Message history reappears out of order after a page reload**
- Do not hand-write `content` for a message row; it must be exactly what the active format's `encode` produced, or `decode` fails on reload. Seed test data through the runtime, not by inserting rows directly.

**Importing from `@assistant-ui/react-ai-sdk`**
- That package only re-exports `@assistant-ui/ai-sdk` for installs pinned to an older version. Import `useChatRuntime` and `AssistantChatTransport` from `@assistant-ui/ai-sdk` in new code.

**Anonymous mode loses history**
- Anonymous creates a new user per browser session (no cross-device sync); switch to JWT or API key auth once you need durability.

## Related Skills

- [thread-list](../thread-list/SKILL.md) -- the `<ThreadList />` sidebar UI, thread CRUD selectors, and the `RemoteThreadListAdapter` contract for a fully self-hosted (non-cloud) thread list
- [setup](../setup/SKILL.md) -- installing assistant-ui and picking a runtime hook, including the `cloud` and `cloud-clerk` CLI templates
- [runtime](../runtime/SKILL.md) -- the general adapter contracts (`ThreadHistoryAdapter`, `FeedbackAdapter`, `AttachmentAdapter`) that cloud fulfills
