# useExternalStoreRuntime

`ExternalStoreRuntime` bridges an existing state store (redux, zustand, tanstack-query, or anywhere else you already keep messages) with assistant-ui. You provide messages and callbacks; the runtime renders whatever you give it, and UI features turn on based on which callbacks are present. If you do not already have a store, [`useLocalRuntime`](./local-runtime.md) is lower friction.

## Contents

- [Quickstart](#quickstart)
- [Handler matrix](#handler-matrix)
- [Message conversion and join strategy](#message-conversion-and-join-strategy)
- [Streaming and editing](#streaming-and-editing)
- [Branching](#branching)
- [Tool calling and approvals](#tool-calling-and-approvals)
- [Attachments, speech, and feedback](#attachments-speech-and-feedback)
- [Refetching the open thread](#refetching-the-open-thread)
- [Queueing messages during a run](#queueing-messages-during-a-run)
- [Multi-thread](#multi-thread)
- [Working with external messages](#working-with-external-messages)
- [API reference](#api-reference)

## Quickstart

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import { useState, type ReactNode } from "react";
import {
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
  AssistantRuntimeProvider,
} from "@assistant-ui/react";

type MyMessage = { role: "user" | "assistant"; content: string };

const convertMessage = (message: MyMessage): ThreadMessageLike => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
});

export function MyRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<MyMessage[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== "text") throw new Error("Only text messages are supported");
    setMessages((prev) => [...prev, { role: "user", content: message.content[0].text }]);
    setIsRunning(true);
    const assistant = await backendApi(message.content[0].text);
    setMessages((prev) => [...prev, assistant]);
    setIsRunning(false);
  };

  const runtime = useExternalStoreRuntime({ isRunning, messages, convertMessage, onNew });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

Render `Thread` from `@/components/assistant-ui/elements/thread.aui` beneath the provider.

## Handler matrix

Each handler enables one UI feature; nothing else derives a capability from an explicit option.

| Handler | Enables |
|---------|---------|
| `onNew` | Sending new user messages (required) |
| `setMessages` | Branch switching |
| `onEdit` | Message edit button |
| `onReload` | Regenerate button |
| `onCancel` | Cancel button while generating |
| `onRefetchThread` | `aui.threads.reloadMainThread()` refetching the open thread in place |
| `onAddToolResult` | Client-side tool result handoff |
| `onRespondToToolApproval` | The Allow / Deny click on a server-side approval gate |
| `onResume` | Resuming an interrupted run (for example after a page reload mid-generation) |
| `onResumeToolCall` | Resuming a suspended human-in-the-loop tool call |
| `queue` | Queueing messages sent while a run is in progress |

## Message conversion and join strategy

Two ways to convert your message shape into `ThreadMessageLike`. Inline, on the runtime options directly:

```tsx
const runtime = useExternalStoreRuntime({
  messages: myMessages,
  convertMessage: (message: MyMessage): ThreadMessageLike => ({
    role: message.role,
    content: [{ type: "text", text: message.text }],
    id: message.id,
    createdAt: new Date(message.timestamp),
  }),
  onNew,
});
```

Or through `useExternalMessageConverter`, which additionally accepts a `joinStrategy` for merging adjacent assistant messages:

```tsx
import { useExternalMessageConverter } from "@assistant-ui/react";

const convertedMessages = useExternalMessageConverter({
  callback: (message: MyMessage): ThreadMessageLike => ({
    role: message.role,
    content: [{ type: "text", text: message.text }],
    id: message.id,
  }),
  messages,
  isRunning: false,
  joinStrategy: "concat-content", // default; "none" keeps adjacent assistant messages separate
});

const runtime = useExternalStoreRuntime({ messages: convertedMessages, onNew });
```

## Streaming and editing

Stream by mutating the assistant message in place, keyed by an id you generated at dispatch:

```tsx
const onNew = async (message: AppendMessage) => {
  setMessages((prev) => [...prev, { role: "user", content: message.content, id: generateId() }]);
  setIsRunning(true);

  const assistantId = generateId();
  setMessages((prev) => [...prev, { role: "assistant", content: [{ type: "text", text: "" }], id: assistantId }]);

  const stream = await api.streamChat(message);
  for await (const chunk of stream) {
    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content: [{ type: "text", text: (m.content[0] as any).text + chunk }] } : m)),
    );
  }
  setIsRunning(false);
};
```

`onEdit` receives the edited `AppendMessage`; splice the store at the parent and push the new content:

```tsx
const onEdit = async (message: AppendMessage) => {
  const index = messages.findIndex((m) => m.id === message.parentId) + 1;
  const newMessages = [...messages.slice(0, index), { role: "user", content: message.content, id: message.id ?? generateId() }];
  setMessages(newMessages);
  setIsRunning(true);
  const response = await api.chat(message);
  setMessages([...newMessages, { role: "assistant", content: response.content, id: generateId() }]);
  setIsRunning(false);
};
```

## Branching

The plain `messages` array assumes each message's parent is the previous one. For branching (multiple regenerations of the same turn), build an `ExportedMessageRepository` and import it:

```tsx
import { ExportedMessageRepository, useExternalStoreRuntime } from "@assistant-ui/react";

const repo = ExportedMessageRepository.fromBranchableArray(
  backendMessages.map((m) => ({ message: { id: m.id, role: m.role, content: m.content }, parentId: m.parentId })),
  { headId: "asst-1" },
);

runtime.thread.import(repo);
```

Each message needs an explicit `id` and `parentId`; messages sharing a `parentId` create branches, and parents must appear before children. `thread.export()` captures the current thread, including its full branch tree, as the same serializable shape for round-tripping through persistence.

If you store the branch tree outside assistant-ui, persist the selected head via `messageRepository.headId` and pass it back on load. `setMessages` still performs the branch switch; the unstable `unstable_onBranchChange({ headId, visibleMessageIds })` is an additional signal that fires only after an explicit `switchToBranch` action (such as a `BranchPicker` click), not on adapter resync, append, edit, reload, or while running.

## Tool calling and approvals

Match a tool result to its call by `toolCallId`:

```tsx
const onAddToolResult = (options: AddToolResultOptions) => {
  setMessages((prev) =>
    prev.map((message) =>
      message.id === options.messageId
        ? { ...message, content: message.content.map((part) => (part.type === "tool-call" && part.toolCallId === options.toolCallId ? { ...part, result: options.result } : part)) }
        : message,
    ),
  );
};

const runtime = useExternalStoreRuntime({ messages, onNew, onAddToolResult });
```

Server-side approval gates (see the [tools](../../tools/SKILL.md) skill) use a separate handler, `onRespondToToolApproval`, distinct from a plain tool result. The click flows back with the id you attached to the `approval` field on the tool part:

```tsx
const runtime = useExternalStoreRuntime({
  messages,
  onNew,
  onRespondToToolApproval: async ({ approvalId, approved, reason }) => {
    await server.respondToApproval(approvalId, approved, reason);
  },
});
```

## Attachments, speech, and feedback

Every adapter uses the shared contract from [adapters.md](./adapters.md); register as many as your product needs under the same `adapters` map:

```tsx
const runtime = useExternalStoreRuntime({
  messages,
  onNew,
  adapters: {
    attachments: myAttachmentAdapter,
    speech: mySpeechAdapter,
    feedback: myFeedbackAdapter,
  },
});
```

`speech` and `feedback` behave identically to their `LocalRuntime` counterparts: providing `adapters.speech` turns on `capabilities.speech` and the message action bar's speak button, and `adapters.feedback` turns on the thumbs up and down buttons. Neither has an `ExternalStoreRuntime`-specific option; `history` is the one adapter this runtime does not use; since you already own the message array, persist it through your own store instead.

## Refetching the open thread

`onRefetchThread` backs `aui.threads.reloadMainThread()`, which is distinct from `reload()` on the thread list (that one only refreshes list metadata) and from `onReload` (that one regenerates an assistant message). Use it when the open thread's server state changed out of band, for example a human-in-the-loop interrupt raised elsewhere or a stalled stream picked up by polling:

```tsx
useExternalStoreRuntime({
  messages,
  onNew,
  onRefetchThread: async () => {
    setMessages(await fetchMessages(threadId));
  },
});
```

`useAuiState((s) => s.thread.capabilities.refetchThread)` reports `true` when `onRefetchThread` is present, since the single and in-memory thread lists take this in-place path whenever it is supplied. A remote thread list without the equivalent server-side capability instead remounts the runtime hook, which discards unsent composer input; drive a refetch from a state change (such as an interrupt status), never a timer, and skip the call while `s.thread.isRunning` is true.

## Queueing messages during a run

By default, sending while the thread is running is disabled. Provide a `queue` adapter, most simply via `createMessageQueue`, to buffer a message sent mid-run and process it once the run settles. `createMessageQueue` owns the two-lane ordering: `steerItems` drain before `items`, and each lane drains in order.

```tsx
import { createMessageQueue, useExternalStoreRuntime } from "@assistant-ui/react";

const [queue] = useState(() => createMessageQueue({ run: onNew }));
const runtime = useExternalStoreRuntime({ messages, isRunning, onNew, queue: queue.adapter });

const wasRunning = useRef(isRunning);
useEffect(() => {
  if (!wasRunning.current && isRunning) queue.notifyBusy();
  if (wasRunning.current && !isRunning) queue.notifyIdle();
  wasRunning.current = isRunning;
}, [isRunning, queue]);
```

The pending items are exposed on `composer.queue` and render through `ComposerPrimitive.Queue`. With `createMessageQueue`, cancelling pauses the queue for you; call `queue.clear()` inside your own `onCancel` if a cancel should drop the pending items instead of resuming them, and inside `onEdit` / `onReload` so stale items do not drain onto the new branch (those two are always host-owned).

## Multi-thread

`ExternalStoreRuntime` uses `ExternalStoreThreadListAdapter`, synchronous and inline rather than remote. See the [thread-list](../../thread-list/SKILL.md) skill for the contract and for keeping `currentThreadId` in sync with your store.

## Working with external messages

`getExternalStoreMessages` retrieves your original message object back out of any assistant-ui state:

```tsx
import { getExternalStoreMessages, useAuiState } from "@assistant-ui/react";

const originalMessages = useAuiState((s) => getExternalStoreMessages(s.message));
```

It can return more than one original message for a single UI message, since assistant-ui merges adjacent assistant and tool messages for display. `bindExternalStoreMessage(threadMessage, originalMessage)` is the inverse, attaching your original message to a `ThreadMessage` you constructed by hand outside the built-in converter; both are experimental.

## API reference

### `ExternalStoreAdapter`

| Field | Type | Notes |
|-------|------|-------|
| `messages` | `readonly T[]` | Required. |
| `onNew` | `(message: AppendMessage) => Promise<void>` | Required. |
| `isRunning` | `boolean` | Default `false`. Shows an optimistic assistant message and flows to `thread.isRunning`. |
| `isDisabled` | `boolean` | Disables the whole composer, including typing. |
| `isSendDisabled` | `boolean` | Blocks sending only; the input stays usable, edit composers are unaffected. |
| `isLoading` | `boolean` | Shows a loading indicator instead of the composer. |
| `suggestions` | `readonly ThreadSuggestion[]` | Suggested prompts. |
| `extras` | `unknown` | Additional data readable via `runtime.extras`. |
| `setMessages` | `(messages: readonly T[]) => void` | Required for branch switching. |
| `unstable_onBranchChange` | `(event: ExternalStoreBranchChange) => void` | See Branching above; unstable. |
| `onEdit` | `(message: AppendMessage) => Promise<void>` | Required for the edit feature. |
| `onReload` | `(parentId: string \| null, config: StartRunConfig) => Promise<void>` | Required for regenerate. |
| `onCancel` | `() => Promise<void>` | Cancel the current generation. |
| `onRefetchThread` | `() => Promise<void>` | Drives `threads.reloadMainThread()`; see above. |
| `onAddToolResult` | `(options: AddToolResultOptions) => Promise<void> \| void` | Adds a tool call result. |
| `onRespondToToolApproval` | `(options: { approvalId: string; approved: boolean; reason?: string }) => Promise<void>` | Approval gate Allow / Deny. |
| `onResume` | `(config: ResumeRunConfig) => Promise<void>` | Resume an interrupted run. |
| `onResumeToolCall` | `(options: { toolCallId: string; payload: unknown }) => void` | Resume a suspended human-in-the-loop call. |
| `messageRepository` | `ExportedMessageRepository` | Pre-built repository with branching history. |
| `convertMessage` | `(message: T, index: number) => ThreadMessageLike` | Skip if `T` is already `ThreadMessage`. |
| `adapters` | `object` | `attachments`, `speech`, `dictation`, `feedback`, `threadList`. |
| `unstable_capabilities` | `object` | Currently just `{ copy?: boolean }`; unstable. |

### `ThreadMessageLike`

| Field | Type | Notes |
|-------|------|-------|
| `role` | `"user" \| "assistant" \| "system"` | Required. |
| `content` | `string \| readonly MessagePart[]` | Required. `data-*` prefixed part types convert to `DataMessagePart` automatically. |
| `id` | `string` | |
| `createdAt` | `Date` | |
| `status` | `MessageStatus` | Assistant messages only. |
| `attachments` | `readonly CompleteAttachment[]` | User messages only. |
| `metadata` | `object` | Arbitrary custom fields, plus `steps`. |

## Related

- [local-runtime.md](./local-runtime.md) -- the simpler core runtime when you do not already have a store
- [adapters.md](./adapters.md) -- attachments, speech, dictation, feedback, suggestions
- [../../thread-list/SKILL.md](../../thread-list/SKILL.md) -- `ExternalStoreThreadListAdapter` for multi-thread
