# useLocalRuntime

The lowest-friction custom runtime. Implement one `ChatModelAdapter` (a single `run` function) and the runtime handles messages, threads, branching, editing, regeneration, and cancellation for you. State lives inside the runtime; add multi-thread persistence and shared adapters through the standard [adapters](./adapters.md) and thread interfaces.

Pick `useLocalRuntime` when your backend is a function-call shaped API (REST, an SDK, your own model client) and you want branching, editing, and regeneration to work without extra code. If you already keep messages in redux, zustand, or tanstack-query, use [`useExternalStoreRuntime`](./external-store.md) instead; it is lower friction for a store you already own.

## Contents

- [Quickstart](#quickstart)
- [Streaming responses](#streaming-responses)
- [Tool calling](#tool-calling)
- [Human-in-the-loop tools](#human-in-the-loop-tools)
- [Approval gates](#approval-gates)
- [Resuming a run](#resuming-a-run)
- [Queueing messages during a run](#queueing-messages-during-a-run)
- [Adapters and multi-thread](#adapters-and-multi-thread)
- [Best practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [API reference](#api-reference)

## Quickstart

The adapter is the first positional argument, not a nested `model` option.

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import type { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const MyModelAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const result = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });
    const data = await result.json();
    return { content: [{ type: "text", text: data.text }] };
  },
};

export function MyRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = useLocalRuntime(MyModelAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
  );
}
```

Render `Thread` from `@/components/assistant-ui/elements/thread.aui` anywhere beneath the provider.

## Streaming responses

Declare `run` as an `async *` generator and yield the full cumulative content on each iteration. Each yield replaces the previous content; yielding a delta instead of the running total makes the UI flicker.

```tsx
const MyModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: convertToOpenAIMessages(messages),
      stream: true,
      signal: abortSignal,
    });

    let text = "";
    for await (const part of stream) {
      text += part.choices[0]?.delta?.content || "";
      yield { content: [{ type: "text", text }] };
    }
  },
};
```

### Only the last part streams

A text or reasoning part reports `status.type === "running"` only while it is the last part of the message; every earlier part reads as complete. That makes an empty trailing part destructive: yielding `[reasoning, text("")]` to reserve the text slot marks the reasoning part complete the instant the empty text part appears, even though reasoning is still streaming. Add a part only once it has content:

```tsx
let reasoning = "";
let text = "";

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  text += delta?.content ?? "";
  reasoning += (delta as { reasoning?: string })?.reasoning ?? "";

  yield {
    content: [
      ...(reasoning ? [{ type: "reasoning" as const, text: reasoning }] : []),
      ...(text ? [{ type: "text" as const, text }] : []),
    ],
  };
}
```

Guard every text or reasoning part this way, not only the final one; whichever part ends up last is the only one that can report `running`.

### Streaming with tool calls

Accumulate tool calls in a `Map` declared outside the streaming loop so they persist across chunks. Rebuilding `content` from only the current chunk drops earlier tool calls the moment a later chunk carries text only.

```tsx
async *run({ messages, abortSignal, context }) {
  const stream = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    messages: convertToOpenAIMessages(messages),
    tools: context.tools,
    stream: true,
    signal: abortSignal,
  });

  let text = "";
  const toolCallsMap = new Map();

  for await (const chunk of stream) {
    text += chunk.choices[0]?.delta?.content ?? "";
    for (const toolCall of chunk.choices[0]?.delta?.tool_calls ?? []) {
      toolCallsMap.set(toolCall.id, {
        type: "tool-call",
        toolName: toolCall.function?.name,
        toolCallId: toolCall.id,
        args: JSON.parse(toolCall.function?.arguments ?? "{}"),
      });
    }
    yield {
      content: [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...Array.from(toolCallsMap.values()),
      ],
    };
  }
}
```

## Tool calling

`LocalRuntime` supports OpenAI-compatible function calling. Register a `"use generative"` toolkit through the provider's `config` so the runtime exposes it to your adapter via `context.tools`; see the [tools](../../tools/SKILL.md) skill for toolkit authoring, kinds, and rendering.

```tsx
import { AuiConfig, Tools } from "@assistant-ui/react";
import toolkit from "./toolkit";

const runtime = useLocalRuntime(MyModelAdapter);
const config = AuiConfig({ tools: Tools({ toolkit }) });
// <AssistantRuntimeProvider runtime={runtime} config={config}>
```

## Human-in-the-loop tools

Tool names listed in `unstable_humanToolNames` are not executed by code; the run pauses on the tool call and the user supplies the result through the tool UI.

```ts
const runtime = useLocalRuntime(MyModelAdapter, {
  unstable_humanToolNames: ["send_email"],
});
```

The pause is driven entirely by the message status your adapter returns, `LocalRuntime` never sets it for you. End the run with `status: { type: "requires-action", reason: "tool-calls" }` while a listed tool call is missing its result; without that status the message is marked complete and nothing waits.

The full loop:

1. **The run pauses.** While a listed tool call has no result, the runtime stops invoking your adapter; the unresolved part reports `status.type === "requires-action"`.
2. **The user responds.** The tool UI completes the call with `addResult(...)`. The stock [`ToolFallback`](https://www.assistant-ui.com/elements/tool-fallback) element does this out of the box with Allow and Deny buttons in the requires-action state.
3. **The run resumes.** Once every listed tool call has a result, the runtime invokes your adapter again with the same `messages` array as before (it ends at the user message). Read the recorded results from `unstable_getMessage().content` and return the follow-up response; content returned is appended to the same assistant message.

```tsx
async run({ messages, abortSignal, unstable_getMessage }) {
  const toolResults = unstable_getMessage().content.flatMap((part) =>
    part.type === "tool-call" && part.result !== undefined
      ? [{ toolCallId: part.toolCallId, result: part.result }]
      : [],
  );
  const result = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages, toolResults }),
    signal: abortSignal,
  }).then((r) => r.json());

  if (result.toolCall) {
    return {
      content: [{ type: "tool-call", toolCallId: result.toolCall.id, toolName: result.toolCall.name, args: result.toolCall.args, argsText: JSON.stringify(result.toolCall.args) }],
      status: { type: "requires-action", reason: "tool-calls" },
    };
  }
  return { content: [{ type: "text", text: result.text }] };
}
```

`unstable_humanToolNames` is unstable; see [runtime-concepts.md](./runtime-concepts.md).

## Approval gates

The server-side approval gate (documented in the [tools](../../tools/SKILL.md) skill) is also supported on `LocalRuntime`, for actions your backend executes after the user authorizes them. Where a human tool asks the user to supply the result, an approval gate asks the user to allow or block an action the adapter performs. Emit `approval: { id }` on the tool-call part and end the run with the same `requires-action` status:

```tsx
return {
  content: [{
    type: "tool-call",
    toolCallId: data.toolCall.id,
    toolName: data.toolCall.name,
    args: data.toolCall.args,
    argsText: JSON.stringify(data.toolCall.args),
    approval: { id: data.toolCall.id },
  }],
  status: { type: "requires-action", reason: "tool-calls" },
};
```

Always emit gates pending (`approval: { id }` with no `approved` field); a part that arrives already decided is treated as resolved and the adapter is invoked again immediately. `respondToApproval({ approved, reason? })` records the decision: Deny sets `approval.approved: false` and synthesizes an `{ error: reason, isError: true }` result so the model sees the denial; Allow sets `approval.approved: true` and leaves the result empty, performing the action is your adapter's job. A tool call carrying an approval does not additionally require a result, even when its name is also listed in `unstable_humanToolNames`.

## Resuming a run

`resumeRun` reconnects to an in-progress assistant run, useful after a page refresh, network reconnect, or thread switch while the backend is still generating. Unlike `startRun`, it takes a `stream` you provide directly rather than going through the `ChatModelAdapter`.

```tsx
import { useAui } from "@assistant-ui/react";
import type { ChatModelRunResult } from "@assistant-ui/core";

async function* createCustomStream(): AsyncGenerator<ChatModelRunResult> {
  yield { content: [{ type: "text", text: "Initial response" }] };
  await new Promise((r) => setTimeout(r, 500));
  yield { content: [{ type: "text", text: "Initial response. And more..." }] };
}

const aui = useAui();
aui.thread.resumeRun({ parentId: "message-id", stream: createCustomStream });
```

A common pattern checks whether the backend is still running on mount, then reconnects to the last message:

```tsx
useEffect(() => {
  (async () => {
    const status = await fetch(`/api/status/${threadId}`).then((r) => r.json());
    if (status.isRunning) {
      const parentId = aui.thread.getState().messages.at(-1)?.id ?? null;
      aui.thread.resumeRun({ parentId });
    }
  })();
}, [aui, threadId]);
```

## Queueing messages during a run

Set `unstable_enableMessageQueue: true` to keep the composer usable while a run is in progress. A message sent during a run steers by default, landing in the steer lane ahead of previously queued items; `send({ steer: false })` queues a follow-up behind them instead. Pending items live in `composer.queue` and drain once the run settles; render them with `ComposerPrimitive.Queue` and `QueueItemPrimitive`.

```tsx
const runtime = useLocalRuntime(MyModelAdapter, {
  unstable_enableMessageQueue: true,
});
```

## Adapters and multi-thread

Attachments, speech, dictation, feedback, and history are wired through the standard adapter contracts; see [adapters.md](./adapters.md).

```tsx
const runtime = useLocalRuntime(MyModelAdapter, {
  adapters: { attachments, speech, feedback, history, suggestion },
});
```

Multi-thread comes from `AssistantCloud` or a custom `RemoteThreadListAdapter`, passed the same way regardless of which you choose:

```tsx
const runtime = useLocalRuntime(MyModelAdapter, { cloud });
```

See the [thread-list](../../thread-list/SKILL.md) skill for the `RemoteThreadListAdapter` contract.

## Best practices

1. Always pass `abortSignal` to `fetch` and SDK calls so cancel works.
2. Swallow `AbortError` (the user cancelling); rethrow other errors to surface them in the UI.
3. Yield cumulative state on every iteration, never a delta.
4. Accumulate tool calls in a `Map` declared outside the streaming loop.

## Troubleshooting

**Messages not appearing.** The adapter must return `{ content: [{ type: "text", text: "..." }] }`; check the shape at the return site.

**Streaming not working.** Use `async *run` with the asterisk; a plain `async run` cannot yield.

**Tool UI flickers and disappears.** State is being reset between chunks; accumulate tool calls in a `Map` declared outside the `for await` loop, not rebuilt from each chunk.

## API reference

### `ChatModelAdapter`

```ts
interface ChatModelAdapter {
  run(options: ChatModelRunOptions): Promise<ChatModelRunResult> | AsyncGenerator<ChatModelRunResult>;
}
```

### `ChatModelRunOptions`

| Field | Type | Notes |
|-------|------|-------|
| `messages` | `readonly ThreadMessage[]` | Required. Conversation history to send. |
| `runConfig` | `RunConfig` | Required. `{ readonly custom?: Record<string, unknown> }`. |
| `abortSignal` | `AbortSignal` | Required. Cancel the request when the user interrupts. |
| `context` | `ModelContext` | Required. Tools and configuration from the registered toolkit. |
| `unstable_assistantMessageId` | `string \| undefined` | Id of the assistant message being generated. |
| `unstable_threadId` | `string \| undefined` | Current thread id, useful for your backend. |
| `unstable_parentId` | `string \| null \| undefined` | Parent message id; `null` for the first message. |
| `unstable_getMessage` | `() => ThreadMessage` | The current assistant message being generated. |

### `LocalRuntimeOptions`

| Field | Type | Notes |
|-------|------|-------|
| `initialMessages` | `readonly ThreadMessageLike[]` | Pre-populate the thread. |
| `maxSteps` | `number` | Default 2. Maximum sequential tool calls before requiring user input. |
| `cloud` | `AssistantCloud` | Enables managed multi-thread persistence. |
| `adapters` | `LocalRuntimeAdapters` | See [adapters.md](./adapters.md). |
| `unstable_humanToolNames` | `string[]` | Tool names that pause the run for `addResult`; unstable. |
| `unstable_enableMessageQueue` | `boolean` | Keeps the composer usable mid-run; see above. |

## Related

- [external-store.md](./external-store.md) -- the runtime to reach for when you already own the message store
- [adapters.md](./adapters.md) -- attachments, speech, dictation, feedback, suggestions, history
- [../../thread-list/SKILL.md](../../thread-list/SKILL.md) -- cloud, custom database, and ExternalStore multi-thread
