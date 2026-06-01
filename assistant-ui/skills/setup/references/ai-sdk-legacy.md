# AI SDK Legacy (v5 and v4)

Keep an app on a legacy AI SDK release instead of migrating to v6. v5 stays on `@assistant-ui/react-ai-sdk@0.x` + `ai@^5` with `useVercelUseChatRuntime`; v4 uses `useDataStreamRuntime` from `@assistant-ui/react-data-stream` + `ai@^4`. For new projects on `ai@^6`, see `ai-sdk.md` instead.

## Contents

- [AI SDK v5 (legacy)](#ai-sdk-v5-legacy)
  - [Install](#install)
  - [Backend route](#backend-route)
  - [Frontend with useVercelUseChatRuntime](#frontend-with-usevercelusechatruntime)
  - [Note on 0.11.3+](#note-on-0113)
- [AI SDK v4 (legacy)](#ai-sdk-v4-legacy)
  - [Install](#install-1)
  - [Backend route](#backend-route-1)
  - [Frontend with useDataStreamRuntime](#frontend-with-usedatastreamruntime)
  - [useDataStreamRuntime options](#usedatastreamruntime-options)
- [Why these are legacy](#why-these-are-legacy)

## AI SDK v5 (legacy)

Stays on `@assistant-ui/react-ai-sdk@0.x` paired with `ai@^5`. Tools use `parameters:` (not `inputSchema:`), and the route returns `toDataStreamResponse()`.

### Install

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk@0.x ai@^5 @ai-sdk/openai@^1 zod
```

### Backend route

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import type { Message } from "ai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-nano"),
    messages,
    tools: {
      get_current_weather: tool({
        description: "Get the current weather",
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }) => `The weather in ${city} is sunny`,
      }),
    },
  });

  return result.toDataStreamResponse();
}
```

Note: in v5 `streamText` takes `messages` directly (no `convertToModelMessages`), tools use `parameters:`, and the response is `toDataStreamResponse()`.

### Frontend with useVercelUseChatRuntime

Drive the AI SDK `useChat` hook yourself, then hand the chat helpers to `useVercelUseChatRuntime`. The `useChat` import comes from `ai/react` in v5.

```tsx
"use client";

import { useChat } from "ai/react";
import { useVercelUseChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  const chat = useChat({ api: "/api/chat" });
  const runtime = useVercelUseChatRuntime(chat);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

### Note on 0.11.3+

`useVercelUseChatRuntime` is the wiring for `@assistant-ui/react-ai-sdk` older than 0.11.3. On 0.11.3 and later (still within the `0.x` line) you can call `useChatRuntime` directly instead of managing `useChat` yourself.

## AI SDK v4 (legacy)

`@assistant-ui/react-ai-sdk` targets `ai@^6` and up, so v4 apps integrate through `@assistant-ui/react-data-stream`, which speaks the same data stream protocol that v4's `toDataStreamResponse()` emits.

### Install

```bash
npm install @assistant-ui/react @assistant-ui/react-data-stream ai@^4 @ai-sdk/openai
```

### Backend route

```ts
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: openai("gpt-5.4-nano"), messages });
  return result.toDataStreamResponse();
}
```

### Frontend with useDataStreamRuntime

`useDataStreamRuntime` comes from `@assistant-ui/react-data-stream`. Set `protocol: "data-stream"` so it parses v4's `toDataStreamResponse()` output; the default protocol expects the SSE format used by newer AI SDK releases.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { Thread } from "@/components/assistant-ui/thread";

export default function Home() {
  const runtime = useDataStreamRuntime({
    api: "/api/chat",
    protocol: "data-stream",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

### useDataStreamRuntime options

- `api`: endpoint URL for the data stream protocol.
- `protocol`: `"data-stream"` to pair with v4's `toDataStreamResponse()`.
- `headers`: `Record<string, string>`, `Headers`, or an async function returning headers.
- `body`: object or async function returning extra request body params.
- Lifecycle callbacks: `onResponse`, `onFinish`, `onError`, `onCancel`.

Note: human in the loop tools (`human()` interrupts) are not supported by the data stream runtime; use `LocalRuntime` directly if you need approval flows.

## Why these are legacy

AI SDK v6 introduced breaking API changes, and `@assistant-ui/react-ai-sdk` follows v6 going forward. Differences that show up when these legacy stacks are upgraded:

| Area | v4 | v5 | v6 (current) |
|---|---|---|---|
| `ai` package | `ai@^4` | `ai@^5` | `ai@^6` |
| `@ai-sdk/openai` | any | `^1` | `^3` |
| Runtime package | `@assistant-ui/react-data-stream` | `@assistant-ui/react-ai-sdk@0.x` | `@assistant-ui/react-ai-sdk` |
| Runtime hook | `useDataStreamRuntime` | `useVercelUseChatRuntime` | `useChatRuntime` |
| `convertToModelMessages` | not used | sync | async (`await`) |
| Tool schema key | n/a | `parameters:` | `inputSchema:` |
| Response method | `toDataStreamResponse()` | `toDataStreamResponse()` | `toUIMessageStreamResponse()` |

To move off legacy, switch the runtime hook to `useChatRuntime`, update the backend to v6 `streamText`, and apply the AI SDK codemods at `ai-sdk.dev/docs/migration-guides`.
