# Cloudflare Agents

[Cloudflare Agents](https://developers.cloudflare.com/agents/) runs stateful AI agents on Durable Objects at the edge, each with its own SQLite-backed history and a WebSocket channel. There is no `@assistant-ui/react-cloudflare-agents` package: `@cloudflare/ai-chat`'s `useAgentChat` returns a structural extension of AI SDK's `useChat`, so the existing [`useAISDKRuntime`](./ai-sdk.md) consumes it directly.

## Contents

- [Architecture](#architecture) | [Worker setup](#worker-setup) | [Frontend setup](#frontend-setup) | [Notes](#notes)

## Architecture

A Durable Object subclasses `AIChatAgent` (server half: message history, streaming, WebSocket). `useAgentChat` (client half) wraps that WebSocket and exposes the same `messages`/`sendMessage`/`regenerate`/`status`/`stop`/`setMessages`/`addToolOutput` surface as `useChat`, plus `clearHistory`, `isServerStreaming`, `isToolContinuation`. `useAISDKRuntime` reads exactly those AI SDK methods off whatever it's given, so feeding it `useAgentChat`'s return value yields a full runtime. `AssistantCloud` (via `useChatRuntime`, which builds its own `useChat`) is not compatible with this wiring; multi-thread needs a custom thread list around `useAISDKRuntime` instead (see [runtime](../../runtime/SKILL.md)).

## Worker setup

```bash
npm create cloudflare@latest my-agent -- --type=hello-world --ts
npm install agents@0.12.4 @cloudflare/ai-chat@0.7.0 ai@latest @ai-sdk/openai@latest
```

Pin both Cloudflare packages to exact versions; they are pre-1.0 and ship breaking changes between minors.

```ts title="src/chat.ts"
import { AIChatAgent } from "@cloudflare/ai-chat";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export type Env = { OPENAI_API_KEY: string; Chat: DurableObjectNamespace<Chat> };

export class Chat extends AIChatAgent<Env> {
  async onChatMessage(onFinish: Parameters<typeof streamText>[0]["onFinish"]) {
    return streamText({ model: openai("gpt-5.6-luna"), messages: await convertToModelMessages(this.messages), onFinish });
  }
}
```

`this.messages` is this Durable Object instance's persisted history; each unique agent `name` from the client gets its own instance and log.

```ts title="src/index.ts"
import { routeAgentRequest } from "agents";
import { Chat, type Env } from "./chat";

export { Chat };

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

```jsonc title="wrangler.jsonc"
{
  "name": "my-agent",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": { "bindings": [{ "name": "Chat", "class_name": "Chat" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Chat"] }],
}
```

`new_sqlite_classes` is required for the Durable Object to use SQLite storage. `routeAgentRequest` handles the WebSocket upgrade, agent lookup by URL path, and the `/get-messages` HTTP endpoint used for history rehydration.

```sh title=".dev.vars"
OPENAI_API_KEY=sk-...
```

```sh
wrangler dev       # local, boots on http://localhost:8787
wrangler secret put OPENAI_API_KEY   # before wrangler deploy
```

## Frontend setup

```bash
npx assistant-ui@latest create   # or init in an existing project
npm install agents@0.12.4 @cloudflare/ai-chat@0.7.0
```

```tsx title="app/assistant.tsx"
"use client";

import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export const Assistant = () => {
  const agent = useAgent({ agent: "Chat", name: "default", host: process.env.NEXT_PUBLIC_AGENT_HOST! });
  const chat = useAgentChat({ agent });
  const runtime = useAISDKRuntime(chat);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};
```

```sh title=".env.local"
NEXT_PUBLIC_AGENT_HOST=http://localhost:8787
```

`name: "default"` is the Durable Object instance key; pass a per-user value (user id, session id) to give each user their own history. Delete the local `app/api/chat/route.ts` the scaffold created, since the agent runs on the Worker instead.

## Notes

- **Type gap on `addToolOutput`**: `useAgentChat`'s return type omits `useChat`'s `addToolOutput` and replaces it with a slightly different shape. If TypeScript flags the `useAISDKRuntime(chat)` call, cast at the call site: `useAISDKRuntime(chat as Parameters<typeof useAISDKRuntime>[0])`.
- **`setMessages` round-trips through the Durable Object**: `useAgentChat` broadcasts the new list over the WebSocket, so `onImport`/`onEdit`/`onReload` persist server-side automatically, at the cost of one extra WebSocket round-trip per mutation (eventual, not transactional, consistency).
- **Authenticate before production**: `routeAgentRequest` accepts any client that knows the agent class and `name`; gate the fetch handler with a header/cookie check, forward the same credential from `useAgent`'s `headers`/`query` options, and tighten CORS to an explicit allowlist.
