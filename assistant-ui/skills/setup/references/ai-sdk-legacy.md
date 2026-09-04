# AI SDK Legacy Versions (v6, v5, v4)

Reference for projects that have not migrated to [AI SDK v7](./ai-sdk.md) yet. All three legacy lines are documented for existing apps only; none receive new features.

## Contents

- [Version table](#version-table) | [v6](#v6-last-supported-line) | [v5](#v5) | [v4](#v4-react-data-stream) | [Migrating up](#migrating-up)

## Version table

| AI SDK | Runtime package | Runtime hook |
| --- | --- | --- |
| `ai@^7` + `@ai-sdk/react@^4` | `@assistant-ui/ai-sdk` (current) | `useChatRuntime` |
| `ai@^6` + `@ai-sdk/react@^3` | `@assistant-ui/react-ai-sdk@1.3.40` | `useChatRuntime` |
| `ai@^5` + `@ai-sdk/react@^2` | `@assistant-ui/react-ai-sdk@1.1.21` | `useChatRuntime` |
| `ai@^4` | `@assistant-ui/react-data-stream` | `useDataStreamRuntime` |

`@assistant-ui/react-ai-sdk` re-exports the same API `@assistant-ui/ai-sdk` ships; pin the version shown above rather than installing `latest` on a legacy AI SDK major, since later `react-ai-sdk` releases target v7.

## v6 (last supported line)

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk@1.3.40 ai@^6 @ai-sdk/react@^3 @ai-sdk/openai zod
```

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, tool, zodSchema } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages), // async in v6
    tools: {
      get_current_weather: tool({
        description: "Get the current weather",
        inputSchema: zodSchema(z.object({ city: z.string() })),
        execute: async ({ city }) => `The weather in ${city} is sunny`,
      }),
    },
  });
  return result.toUIMessageStreamResponse();
}
```

<!-- before -->
```tsx title="app/page.tsx"
// Pinned to @assistant-ui/react-ai-sdk@1.3.40 for AI SDK v6; v7 imports the same API from @assistant-ui/ai-sdk.
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime();
// <AssistantRuntimeProvider runtime={runtime}><Thread /></AssistantRuntimeProvider>
```

Everything under [ai-sdk.md](./ai-sdk.md) (frontend tools, multi-step via `stopWhen`, approval gates via `needsApproval`, quote context, token usage, history via `withFormat`, runtime options, `useAISDKRuntime`) applies the same way on v6; only the response call differs (`result.toUIMessageStreamResponse()` directly, not wrapped in `createUIMessageStreamResponse`/`toUIMessageStream`), and every import comes from `@assistant-ui/react-ai-sdk` instead of `@assistant-ui/ai-sdk`. The v6 approval gate uses `needsApproval` (boolean or function) on the tool definition rather than v7's call-level `toolApproval` option:

```ts
deploy: tool({
  description: "Deploy the current build to an environment.",
  inputSchema: z.object({ target: z.string() }),
  needsApproval: ({ input }) => input.target === "production",
  execute: async ({ target }) => ({ deployed: target }),
}),
```

## v5

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk@1.1.21 ai@^5 @ai-sdk/openai@^1 zod
```

<!-- before -->
```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import type { Message } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
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

<!-- before -->
```tsx title="app/page.tsx"
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime();
```

<!-- before -->
```ts
// On @assistant-ui/react-ai-sdk older than 0.11.3, use useVercelUseChatRuntime with useChat from "ai/react" instead
import { useChat } from "ai/react";
import { useVercelUseChatRuntime } from "@assistant-ui/react-ai-sdk";

const chat = useChat({ api: "/api/chat" });
const runtime = useVercelUseChatRuntime(chat);
```

v5 differs from v6 in the message type (`Message` vs `UIMessage`), a synchronous `convertToModelMessages`, `parameters: z.object({...})` instead of `inputSchema: zodSchema(z.object({...}))`, and `toDataStreamResponse()` instead of `toUIMessageStreamResponse()`. AI SDK's own [v6 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) has codemods for the package-side rewrite.

## v4 (`react-data-stream`)

AI SDK v4 predates `@assistant-ui/ai-sdk`'s current-major-only support; v4 projects plug into the wire protocol directly through [`@assistant-ui/react-data-stream`](../../streaming/SKILL.md), the same data stream protocol v4's `toDataStreamResponse()` emits.

```bash
npm install @assistant-ui/react @assistant-ui/react-data-stream ai@^4
```

<!-- before -->
```ts title="app/api/chat/route.ts"
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: openai("gpt-5.6-luna"), messages });
  return result.toDataStreamResponse();
}
```

```tsx title="app/page.tsx"
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

const runtime = useDataStreamRuntime({ api: "/api/chat" });
```

`useDataStreamRuntime` auto-detects the `x-vercel-ai-data-stream: v1` response header; pass `protocol: "data-stream"` explicitly if a proxy strips it. It also accepts `initialMessages`, `onFinish`, `onError`, `headers`, `body`, and the standard `LocalRuntimeOptions`.

An older `@assistant-ui/react-ai-sdk` line supported v4 directly through `0.10.16`; it has no upgrade path and is not maintained. Start new v4 integrations on `react-data-stream` instead.

## Migrating up

1. v4 to v7: swap `@assistant-ui/react-data-stream` for `@assistant-ui/ai-sdk`, move the backend to `streamText` + `convertToModelMessages` + `createUIMessageStreamResponse`, and switch `useDataStreamRuntime` to `useChatRuntime`.
2. v5 to v6: add `await` to `convertToModelMessages(...)`, convert `parameters: z.object({...})` to `inputSchema: zodSchema(z.object({...}))`, replace `toDataStreamResponse()` with `toUIMessageStreamResponse()`, and switch the `Message` type to `UIMessage`.
3. v6 to v7: swap `@assistant-ui/react-ai-sdk` imports for `@assistant-ui/ai-sdk`, and wrap the response in `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`.

AI SDK's own [migration guides](https://ai-sdk.dev/docs/migration-guides) provide codemods for each package-side rewrite; see [update](../../update/SKILL.md) for the assistant-ui side (registry paths, `AuiConfig`, event renames) that tends to land alongside an AI SDK bump.
