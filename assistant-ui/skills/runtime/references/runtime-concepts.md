# Runtime Concepts

Cross-cutting runtime concepts: the `unstable_` stability policy, how the runtimes layer, state-streaming custom agents, refetching the open thread, the send-rejection error type, and message timing.

## Contents

- [The unstable_ stability policy](#the-unstable_-stability-policy)
- [Runtime layering: LocalRuntime vs ExternalStoreRuntime](#runtime-layering-localruntime-vs-externalstoreruntime)
- [useAssistantTransportRuntime (state-streaming agents)](#useassistanttransportruntime-state-streaming-agents)
- [Reading agent state and sending commands](#reading-agent-state-and-sending-commands)
- [Typing agent state](#typing-agent-state)
- [Refetching the open thread](#refetching-the-open-thread)
- [MessageNotSentError](#messagenotsenterror)
- [Message timing (experimental)](#message-timing-experimental)
- [Supplying timing manually](#supplying-timing-manually)

## The unstable_ stability policy

APIs prefixed with `unstable_` are publicly exported and meant to be built against, but their signature, naming, semantics, and return shape may change in any release, including patch releases. They carry no semver guarantees, so a breaking change can land in a patch or minor, not only a major.

```ts
import { unstable_createMessageConverter as createMessageConverter } from "@assistant-ui/react";
```

When an API stabilizes, the prefix is dropped (`unstable_foo` becomes `foo`). The old name is kept as a deprecated alias for at least one minor cycle, and the changelog notes the transition.

Recommended practices when consuming an `unstable_` API:

- Pin your dependency range so an automatic update cannot rewrite the contract under you.
- Isolate the call site behind a thin wrapper, so an upstream rename touches one file.
- Expect renames or removals at stabilization time.

Currently unstable exports relevant to the runtime: `unstable_createMessageConverter` and `unstable_humanToolNames` (`@assistant-ui/react`), `unstable_capabilities` on `ExternalStoreRuntime`, `unstable_onBranchChange`, `unstable_Provider` and `unstable_useAdapters` on thread-list adapters, and the `unstable_state`, `unstable_annotations`, `unstable_data` message metadata fields plus the `unstable_assistantMessageId` / `unstable_threadId` / `unstable_parentId` / `unstable_getMessage` fields on `ChatModelRunOptions`.

## Runtime layering: LocalRuntime vs ExternalStoreRuntime

`ExternalStoreRuntime` is the lower-level runtime. You own the message array and `isRunning` flag, and implement `onNew`, `onEdit`, `onReload`, and friends against whatever store you already use. assistant-ui reads from your store and never holds its own copy. See [external-store.md](./external-store.md).

```tsx
const runtime = useExternalStoreRuntime({
  messages,
  isRunning,
  onNew: async (message) => { /* you mutate your store */ },
});
```

`LocalRuntime` sits above it: assistant-ui owns the message store, branching, and run lifecycle, and you implement only a `ChatModelAdapter.run` that returns or yields `ChatModelRunResult` chunks. The adapter is the first positional argument, not a nested `model` option. Edit, reload, branch switching, and cancellation come for free. See [local-runtime.md](./local-runtime.md).

```tsx
const runtime = useLocalRuntime({
  async *run({ messages, abortSignal }) {
    yield { content: [{ type: "text", text: "..." }] };
  },
});
```

Reach for `ExternalStoreRuntime` when an external system is the source of truth for messages; reach for `LocalRuntime` when you only need to provide a model adapter and want message management handled for you.

## useAssistantTransportRuntime (state-streaming agents)

`useAssistantTransportRuntime` (from `@assistant-ui/react`) connects to a custom backend agent that streams its full state, rather than a message-delta stream. It is `ExternalStoreRuntime` plus the `AssistantTransport` wire protocol (see [architecture](https://www.assistant-ui.com/docs/runtimes/concepts/architecture)). You hold the agent's state object, and a `converter` projects that state into thread messages on every update.

```tsx
import { useAssistantTransportRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";

const runtime = useAssistantTransportRuntime({
  initialState: { messages: [] },
  api: "http://localhost:8010/assistant",
  converter,
  headers: async () => ({ Authorization: "Bearer token" }),
  onError: (error, { updateState }) => {
    updateState((s) => ({ ...s, lastError: error.message }));
  },
});
```

Key options: `initialState`, `api`, `converter` (projects your state to `{ messages, isRunning, state? }`), `resumeApi` for reconnect, `protocol` (`"data-stream" | "assistant-transport"`), `headers`, `body`, `capabilities` (`{ edit?: boolean }`, editing is disabled by default), `adapters` (`attachments`, `history`), and `onResponse` / `onFinish` / `onError` / `onCancel` callbacks. The `converter` also receives `AssistantTransportConnectionMetadata` (`pendingCommands`, `isSending`, `toolStatuses`) describing in-flight work.

Build the message side of the converter with `unstable_createMessageConverter`, which maps your own message shape to thread messages and back:

```ts
import { unstable_createMessageConverter as createMessageConverter } from "@assistant-ui/react";

const messageConverter = createMessageConverter((message: YourMessage) => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
}));

const converter = (state: MyState) => ({
  messages: messageConverter.toThreadMessages(state.messages),
  isRunning: false,
});
```

`unstable_createMessageConverter` is explicitly unstable, and the wire format is documented as subject to change. Speech, dictation, feedback, and suggestions are not supported by this runtime; drop down to `ExternalStoreRuntime` if you need them. The full protocol (encoders, event shapes, resumable sessions) is documented in the [streaming](../../streaming/SKILL.md) skill.

## Reading agent state and sending commands

Inside components under the provider, read agent state with `useAssistantTransportState` (accepts an optional selector) and issue custom commands with `useAssistantTransportSendCommand`.

```tsx
import { useAssistantTransportState, useAssistantTransportSendCommand } from "@assistant-ui/react";

function CustomField() {
  const value = useAssistantTransportState((s) => s.customField);
  const sendCommand = useAssistantTransportSendCommand();
  return <button onClick={() => sendCommand({ type: "set-field", value: "x" })}>{value}</button>;
}
```

To resume a run, use `resumeRun` via the general runtime accessor `useAui`.

## Typing agent state

Augment the `Assistant.ExternalState` interface so `useAssistantTransportState` and the converter are typed against your state shape:

```ts
declare module "@assistant-ui/react" {
  namespace Assistant {
    interface ExternalState {
      myState: { messages: Message[]; customField: string };
    }
  }
}
```

## Refetching the open thread

`reload()` on the thread list only re-runs `list()`, refreshing thread metadata; it never touches the messages of the thread the user is looking at. When the open thread's server state changes out of band, such as a human-in-the-loop interrupt raised elsewhere, a stalled stream, or a status change picked up by polling, call `aui.threads.reloadMainThread()`:

```tsx
function RefetchOnInterrupt({ status }: { status: string }) {
  const aui = useAui();
  useEffect(() => {
    if (status !== "interrupted") return;
    aui.threads.reloadMainThread().catch(reportError);
  }, [status]);
  return null;
}
```

How the refetch happens depends on the runtime, in one of two ways. When it declares the `refetchThread` capability, the same thread runtime is reused: composer drafts survive, existing messages stay rendered while the fresh state loads, and the returned promise settles with the refetch itself, rejecting if it fails. Without the capability, a remote thread list remounts the runtime hook instead, re-running `load()` at the cost of discarding unsent composer input, and resolves once the new runtime attaches; the single and in-memory thread lists take the in-place path only when given `onRefetchThread` (see [external-store.md](./external-store.md)), and otherwise resolve without doing anything.

`useAuiState((s) => s.thread.capabilities.refetchThread)` reports which of those you would get. It is not a signal for whether to offer a refresh control at all: it reads `false` on the remount path even though the call still does the work, and `false` again where the call does nothing. Because what happens to an in-flight run also depends on the path (the remount path drops the runtime rendering the run; the in-place path leaves it to the runtime that declared the capability), drive a refetch from a state change such as the example above, never a short timer, and skip the call while `useAuiState((s) => s.thread.isRunning)` is true. A thread that has not been sent yet is left alone; it holds no remote state to refetch.

## MessageNotSentError

`MessageNotSentError` (from `@assistant-ui/react`) is the rejection reason for a send that never reached the backend, so nothing ran and nothing is recoverable from the thread. A runtime adapter throws it from `onNew` to hand the message back to the thread composer, which restores the draft it cleared at dispatch time, as long as nothing else has claimed the composer since. An edit composer closes at dispatch, so a rejected edit is not restored the same way.

```ts
import { MessageNotSentError, isMessageNotSentError } from "@assistant-ui/react";

const onNew = async (message: AppendMessage) => {
  if (!(await canSend())) {
    throw new MessageNotSentError("Sending is not available right now.");
  }
  // ...
};
```

`isMessageNotSentError(error)` narrows an unknown caught error in a catch block or `onError` handler.

## Message timing (experimental)

`useMessageTiming` (from `@assistant-ui/react`) returns streaming performance stats for the current message. Call it inside a `MessagePrimitive.Root` context; it returns `MessageTiming | undefined`, undefined for non-assistant messages or when no timing data exists. Both the API and its tracked fields may change.

```tsx
import { useMessageTiming } from "@assistant-ui/react";

function TimingStats() {
  const timing = useMessageTiming();
  if (!timing?.totalStreamTime) return null;
  return <span>{timing.tokensPerSecond?.toFixed(1)} tok/s ({timing.totalStreamTime}ms)</span>;
}
```

```ts
interface MessageTiming {
  streamStartTime: number;   // Unix timestamp when the stream started
  firstTokenTime?: number;   // time to first text token, in ms
  totalStreamTime?: number;  // total stream duration, in ms
  tokenCount?: number;       // output token count from message metadata usage
  tokensPerSecond?: number;  // throughput, requires token usage
  totalChunks: number;       // total stream chunks received
  toolCallCount: number;     // number of tool calls
}
```

Timing is tracked automatically for the Data Stream runtime, `useChatRuntime` (AI SDK), and the LangGraph, AG-UI, and OpenCode runtimes. For `useLocalRuntime` and `useExternalStoreRuntime`, supply it manually.

## Supplying timing manually

Both manual runtimes read the same fields from `metadata.timing`. For `LocalRuntime`, attach it to the final `ChatModelRunResult`:

```tsx
async run({ messages }) {
  const startTime = Date.now();
  const result = await callModel(messages);
  return {
    content: [{ type: "text", text: result.text }],
    metadata: {
      timing: {
        streamStartTime: startTime,
        totalStreamTime: Date.now() - startTime,
        tokenCount: result.usage?.completionTokens,
        totalChunks: 1,
        toolCallCount: 0,
      },
    },
  };
}
```

For `ExternalStoreRuntime`, put it on the `ThreadMessageLike.metadata.timing` when you construct the message.

## Related

- [local-runtime.md](./local-runtime.md) / [external-store.md](./external-store.md) -- the two core runtimes this page sits above
- [../../streaming/SKILL.md](../../streaming/SKILL.md) -- the DataStream and AssistantTransport wire protocols in depth
- [../../thread-list/SKILL.md](../../thread-list/SKILL.md) -- `reload()` on the thread list and the `RemoteThreadListAdapter` contract
