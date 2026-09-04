# Mastra Integration

[Mastra](https://mastra.ai/) is an open-source TypeScript agent framework (memory, tool calling, workflows, RAG, evals). There is no `@assistant-ui/react-mastra` package; you wire it through the standard [AI SDK runtime](./ai-sdk.md) by routing your API endpoint through Mastra's agent stream. The client side is always `useChatRuntime` from `@assistant-ui/ai-sdk`; the only choice is where the Mastra agent lives.

## Contents

- [Full-stack](#full-stack-in-process) | [Separate server](#separate-server)

## Full-stack (in-process)

One Next.js app: agent, API route, and frontend in the same project. Lowest friction, one deploy target.

```bash
npm install @mastra/core@latest @mastra/ai-sdk@latest zod@latest
```

```js title="next.config.mjs"
/** @type {import('next').NextConfig} */
export default { serverExternalPackages: ["@mastra/*"] };
```

Mastra depends on Node-only modules; skipping `serverExternalPackages` produces opaque bundling errors at request time.

```ts title="mastra/agents/chefAgent.ts"
import { Agent } from "@mastra/core/agent";

export const chefAgent = new Agent({
  name: "chef-agent",
  instructions: "You are Michel, a practical home chef.",
  model: "openai/gpt-5.6-luna",
});
```

```ts title="mastra/index.ts"
import { Mastra } from "@mastra/core";
import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({ agents: { chefAgent } });
```

```ts title="app/api/chat/route.ts"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkStream } from "@mastra/ai-sdk";
import { mastra } from "@/mastra";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const agent = mastra.getAgent("chefAgent");
  const stream = await agent.stream(messages);

  const uiMessageStream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      for await (const part of toAISdkStream(stream, { from: "agent" })) await writer.write(part);
    },
  });
  return createUIMessageStreamResponse({ stream: uiMessageStream });
}
```

`agent.stream()` returns Mastra's native stream; `toAISdkStream` adapts each part to the AI SDK shape. `@mastra/ai-sdk` tracks the AI SDK v6/v7 contract; re-verify `toAISdkStream`'s shape against Mastra's release notes before bumping `ai` to a future major.

## Separate server

Mastra runs as its own service; the frontend hits it over HTTP. Independent scaling and deploys, at the cost of one extra hop and CORS.

```bash
npx create-mastra@latest
cd your-mastra-server
npm install @mastra/ai-sdk@latest
```

```ts title="src/mastra/index.ts"
import { Mastra } from "@mastra/core";
import { chatRoute } from "@mastra/ai-sdk";
import { chefAgent } from "./agents/chefAgent";

export const mastra = new Mastra({
  agents: { chefAgent },
  server: {
    cors: { origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000", credentials: true },
    apiRoutes: [chatRoute({ path: "/chat/:agentId" })],
  },
});
```

`:agentId` matches the object key (`chefAgent`), not the agent's `name` field, so the route is `/chat/chefAgent`. The Mastra server defaults to `http://localhost:4111`.

```tsx title="app/assistant.tsx"
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export function Assistant() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: process.env.NEXT_PUBLIC_MASTRA_URL! }),
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

```sh title=".env.local"
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111/chat/chefAgent
```

Without CORS configured on the Mastra side, the browser blocks the request and the chat silently fails. In production, gate the route with a header or cookie check and forward credentials via `AssistantChatTransport`'s `headers`/`credentials` options.
