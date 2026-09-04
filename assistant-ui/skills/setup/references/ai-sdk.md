# AI SDK Runtime (v7, current)

`@assistant-ui/ai-sdk` integrates assistant-ui with the [Vercel AI SDK](https://ai-sdk.dev/): `useChat` flows, custom transports, frontend tools, attachments, quote context, multi-step agents, token usage, and history. It requires `ai@^7` and `@ai-sdk/react@^4`. For v6/v5/v4, see [ai-sdk-legacy.md](./ai-sdk-legacy.md).

`@assistant-ui/react-ai-sdk` re-exports the same API for older installs; import from `@assistant-ui/ai-sdk` in new code.

## Contents

- [Quickstart](#quickstart) | [useChatRuntime vs useAISDKRuntime](#usechatruntime-vs-useaisdkruntime) | [Frontend tools](#frontend-tools-and-system-messages) | [Multi-step](#multi-step-tool-calls) | [Server-side approval](#server-side-tool-approval) | [Quote context](#quote-context) | [Token usage](#token-usage) | [Attachments](#attachments) | [History](#persisting-chat-history) | [Custom transport](#custom-transport) | [Runtime options](#runtime-options) | [Adapter support](#adapter-support)

## Quickstart

```bash
npm install @assistant-ui/react @assistant-ui/ai-sdk ai@^7 @ai-sdk/react@^4 @ai-sdk/openai zod
```

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import type { UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages), // async in v7
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

```tsx title="app/page.tsx"
"use client";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

export default function Home() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

For React Native and React Ink, host the route in a separate backend and point the transport at its absolute URL (see [react-native](../../react-native/SKILL.md) and [ink](../../ink/SKILL.md)).

## useChatRuntime vs useAISDKRuntime

Both ship from `@assistant-ui/ai-sdk`.

- **`useChatRuntime`** (recommended) wraps AI SDK's `useChat` and adds cloud thread support, the standard adapter slots, and `AssistantChatTransport`, which forwards system messages and frontend tools by default.
- **`useAISDKRuntime`** takes a `useChat` instance you already control, for sharing it with non-assistant-ui code or a transport that does not extend `AssistantChatTransport`. It does not provide `cloud` or the higher-level adapter slots.

```tsx
import { useChat } from "@ai-sdk/react";
import { useAISDKRuntime } from "@assistant-ui/ai-sdk";

const chat = useChat();
const runtime = useAISDKRuntime(chat);
```

`useAISDKRuntime` accepts `joinStrategy`, `onResume`, `messageRepository`, `unstable_onBranchChange` (see [runtime options](#runtime-options)), plus `cancelPendingToolCallsOnSend` (default `true`): when a new message is sent, pending interactive tool calls are marked failed as user-cancelled unless this is `false`.

## Frontend tools and system messages

`AssistantChatTransport` forwards system messages and frontend tools on every request by default. Consume them with `frontendTools`:

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import type { UIMessage } from "ai";
import { frontendTools } from "@assistant-ui/ai-sdk";

export async function POST(req: Request) {
  const { messages, system, tools }: { messages: UIMessage[]; system?: string; tools?: any } =
    await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    system,
    messages: await convertToModelMessages(messages),
    tools: { ...frontendTools(tools) /* ...your backend tools */ },
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
```

Frontend tools are registered through the provider's `config` (see [tools](../../tools/SKILL.md)) and serialized for the backend via `frontendTools`.

## Multi-step tool calls

Cap tool-call rounds in a single request with `stopWhen: stepCountIs(n)`; without it, `streamText` runs one inference step.

```ts
import { streamText, stepCountIs } from "ai";

const result = streamText({
  model,
  messages,
  tools: {
    /* ... */
  },
  stopWhen: stepCountIs(10),
});
```

## Server-side tool approval

AI SDK v7 gates execution with the call-level `toolApproval` option. The server pauses, emits an `approval-requested` part, and resumes once the client posts a response. assistant-ui surfaces the gate as `approval` on the tool part and a `respondToApproval` prop on the renderer.

```ts title="app/api/chat/route.ts"
const result = streamText({
  model,
  messages: await convertToModelMessages(messages),
  tools: {
    deploy: tool({
      description: "Deploy the current build to an environment.",
      inputSchema: z.object({ target: z.string() }),
      execute: async ({ target }) => ({ deployed: target }),
    }),
  },
  toolApproval: {
    deploy: (input) => (input.target === "production" ? "user-approval" : "not-applicable"),
  },
});
```

The client resends automatically once the user decides:

```tsx
import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";

const chat = useChat({
  api: "/api/chat",
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
const runtime = useAISDKRuntime(chat);
```

Render the gate from a toolkit entry. `approval.approved` is `undefined` (pending), `true`, or `false`; `respondToApproval` is the only correct way to answer (it reads the approval id off the part):

```tsx
import { AuiConfig, defineToolkit, Tools, type ToolApprovalResponse } from "@assistant-ui/react";

const toolkit = defineToolkit({
  deploy: {
    type: "backend",
    render: ({ args, approval, respondToApproval, result }) => {
      const answer = async (response: ToolApprovalResponse) => {
        try {
          await respondToApproval(response);
        } catch (failure) {
          console.error(failure);
        }
      };
      if (approval?.approved === undefined) {
        return (
          <div>
            <p>Approve deploy to {args.target}?</p>
            <button onClick={() => void answer({ approved: true })}>Approve</button>
            <button onClick={() => void answer({ approved: false, reason: "user denied" })}>Deny</button>
          </div>
        );
      }
      if (approval?.approved === false) return <p>Denied</p>;
      if (result === undefined) return <p>Approved, deploying...</p>;
      return <p>Deployed {result.deployed}</p>;
    },
  },
});

const config = AuiConfig({ tools: Tools({ toolkit }) });
// <AssistantRuntimeProvider runtime={runtime} config={config}>
```

See [tools](../../tools/SKILL.md) for `isAutomatic` and the full approval-gate contract.

## Quote context

`injectQuoteContext` flattens a user message's quote metadata (set when the user selects text and clicks Quote) into a markdown blockquote prefix so the model sees the quoted text. It is idempotent.

```ts
import { injectQuoteContext } from "@assistant-ui/ai-sdk";

const result = streamText({
  model,
  messages: await convertToModelMessages(injectQuoteContext(messages)),
});
```

## Token usage

Attach `usage` and `modelId` via `messageMetadata`, then read it with `useThreadTokenUsage`:

```ts title="app/api/chat/route.ts"
return createUIMessageStreamResponse({
  stream: toUIMessageStream({
    stream: result.stream,
    messageMetadata: ({ part }) => {
      if (part.type === "finish") return { usage: part.totalUsage };
      if (part.type === "finish-step") return { modelId: part.response.modelId };
      return undefined;
    },
  }),
});
```

```tsx
import { useThreadTokenUsage } from "@assistant-ui/ai-sdk";

function TokenCounter() {
  const usage = useThreadTokenUsage();
  return usage ? <div>{usage.totalTokens} total tokens</div> : null;
}
```

`getThreadMessageTokenUsage(message)` reads per-message usage. Anything `messageMetadata` returns beyond `usage` lands under `metadata.custom` on the thread message, since the converter moves everything outside the fixed metadata shape there: `useAuiState((s) => s.message.metadata.custom?.["modelId"])`.

## Attachments

Wire the standard [attachment adapter](../../runtime/SKILL.md); your `send` should return AI-SDK-shaped `content` parts:

```tsx
const runtime = useChatRuntime({ adapters: { attachments: myAttachmentAdapter } });
```

```ts
return {
  ...attachment,
  status: { type: "complete" },
  content: [
    { type: "file", mimeType: attachment.contentType ?? "", filename: attachment.name, data: await getFileDataURL(attachment.file) },
  ],
};
```

Use `{ type: "image", image: <data url or remote url> }` for images.

## Persisting chat history

Messages live in memory by default. Provide a `ThreadHistoryAdapter` via `adapters.history`; it **must** implement `withFormat`, since `useChatRuntime` persists through `withFormat(fmt)` so messages round-trip as AI SDK `UIMessage`s. An adapter without it throws at runtime, and the top-level `load`/`append` are unused on this path. For zero-adapter-code persistence, use [AssistantCloud](../../cloud/SKILL.md) instead.

```tsx
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import type { ThreadHistoryAdapter } from "@assistant-ui/react";

const historyAdapter: ThreadHistoryAdapter = {
  async load() {
    return { headId: null, messages: [] };
  },
  async append() {},
  withFormat: (fmt) => ({
    async load() {
      const rows = await fetch("/api/history").then((r) => r.json());
      return { messages: rows.map(fmt.decode) };
    },
    async append(item) {
      await fetch("/api/history", {
        method: "POST",
        body: JSON.stringify({ id: fmt.getId(item.message), parent_id: item.parentId, format: fmt.format, content: fmt.encode(item) }),
      });
    },
  }),
};

const runtime = useChatRuntime({ adapters: { history: historyAdapter } });
```

Each persisted row is `{ id, parent_id, format, content }`; `fmt.encode`/`fmt.decode` hide the `UIMessage` internals from your backend.

## Custom transport

`AssistantChatTransport` is the default. Point it at a different endpoint:

```tsx
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/ai-sdk";

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({ api: "/my-custom-api/chat" }),
});
```

A transport that does not extend `AssistantChatTransport` forfeits automatic system-message and frontend-tool forwarding; you then control everything explicitly as a plain AI SDK `ChatTransport`.

## Runtime options

`useChatRuntime` (and, except `cloud` and the adapter slots, `useAISDKRuntime`) accept:

- **`onThreadIdChange(threadId)`**: fires when the runtime's settled thread id changes (for example to sync a URL query param). A fresh, uninitialized thread reports `undefined` first; a controlled `threadId` option is not echoed back.
- **`joinStrategy`**: `"concat-content"` (default) merges consecutive assistant messages into one thread message; `"none"` keeps each as its own message, useful when a backend persists proactive or consecutive assistant turns separately.
- **`onResume(config)`**: called by `runtime.thread.resumeRun(config)`; bridge it into a custom replay channel (an SSE reconnect endpoint keyed by turn id). Omitted, `resumeRun` throws. For reload-safe streaming with no custom channel, see [../../streaming/SKILL.md](../../streaming/SKILL.md), which wraps the same byte stream and reconnects on mount, reporting failures via `onResumeError`.
- **`messageRepository`**: seeds a branch-aware AI SDK message tree once, only when `useChat` starts empty; live updates come only from `useChat` afterward. Threads persisted via `adapters.history` do not need this.
- **`unstable_onBranchChange({ headId })`**: fires after an explicit branch switch (for example a BranchPicker click); unstable and may change without notice.

```tsx
const runtime = useChatRuntime({
  onThreadIdChange: (threadId) => {
    const url = new URL(window.location.href);
    if (threadId) url.searchParams.set("thread", threadId);
    else url.searchParams.delete("thread");
    window.history.replaceState(null, "", url);
  },
  joinStrategy: "none",
});
```

## Adapter support

| Adapter | Supported via |
| --- | --- |
| Attachments | `adapters.attachments` |
| Speech | `adapters.speech` |
| Dictation | `adapters.dictation` |
| Feedback | `adapters.feedback` |
| History | `adapters.history` (must implement `withFormat`) |
| Thread list | `cloud` (managed) or a `RemoteThreadListRuntime` (custom DB); see [runtime](../../runtime/SKILL.md) |

## Example

[`examples/with-ai-sdk-v7`](https://github.com/assistant-ui/assistant-ui/tree/main/examples/with-ai-sdk-v7) is a complete reference (`npx assistant-ui@latest create my-app -e with-ai-sdk-v7`).
