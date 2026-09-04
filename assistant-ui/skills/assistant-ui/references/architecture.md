# assistant-ui Architecture

## Layers

Each layer depends only on the layers below it.

### UI: elements and primitives

Primitives from `@assistant-ui/react` are unstyled, Radix-style parts (`ThreadPrimitive.Root`, `ComposerPrimitive.Input`, `MessagePrimitive.Parts`, ...) that read and write through the aui client, never against the backend directly. Elements are styled compositions of those primitives that the CLI copies into `components/assistant-ui/elements/`; runtime-connected ones carry the `.aui.tsx` suffix and standalone ones take props.

### The aui client

`useAui()` returns an `AssistantClient`: one property accessor per registered scope plus `subscribe` and `on`. Application code uses it instead of the runtime object.

```tsx
import { useAui, useAuiState, useAuiEvent } from "@assistant-ui/react";

const aui = useAui();
aui.thread.append({ role: "user", content: [{ type: "text", text: "Hi" }] });
aui.thread.message({ index: 0 }).reload();
aui.thread.composer().send();
aui.threads.switchToNewThread();

const messages = useAuiState((s) => s.thread.messages);
useAuiEvent("threads.selectionChanged", ({ threadId, previousThreadId }) => {});
```

Scopes: `threads`, `threadListItem`, `thread`, `message`, `part`, `composer`, `attachment`, `modelContext`, `suggestions`, `suggestion`, `chainOfThought`, `queueItem`, `tools`, `dataRenderers`, `unstable_interactables`, plus package scopes such as `mcp` and `span`.

An unavailable scope never throws at selection: `aui.thread` is always truthy, its `source` is `null`, and any other read throws. Guard with `aui.thread.source != null` or select through `s.optional.thread`.

Scopes are declared with `AuiConfig` and mounted by a provider. `AssistantRuntimeProvider` installs an `AuiProvider` for the runtime's `threads` scope and merges anything you pass as `config`; nested subtrees add scopes with `<AuiProvider extends={aui} config={config}>`; `extends={null}` starts an isolated root. Configs are plain data and identity-insensitive.

```tsx
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";

const config = AuiConfig({ tools: Tools({ toolkit }) });
<AssistantRuntimeProvider runtime={runtime} config={config}>{children}</AssistantRuntimeProvider>;
```

### Runtime

The object a runtime hook returns and the provider mounts. `thread` and `threads` are properties.

```ts
type AssistantRuntime = {
  readonly thread: ThreadRuntime;
  readonly threads: ThreadListRuntime;
  registerModelContextProvider(provider: ModelContextProvider): Unsubscribe;
};

type ThreadRuntime = {
  readonly composer: ThreadComposerRuntime;
  getState(): ThreadState;
  append(message: CreateAppendMessage): void;
  startRun(config: CreateStartRunConfig): void;
  resumeRun(config: CreateResumeRunConfig): void;
  cancelRun(): void;
  getMessageByIndex(idx: number): MessageRuntime;
  getMessageById(messageId: string): MessageRuntime;
  subscribe(callback: () => void): Unsubscribe;
};
```

`LocalRuntime` keeps conversation state inside assistant-ui and drives a `ChatModelAdapter`; every framework adapter (AI SDK, LangGraph, ADK, A2A, ...) builds on it. `ExternalStoreRuntime` delegates state to your store and calls your callbacks (`onNew`, `onEdit`, `onReload`, `onCancel`, `onRespondToToolApproval`). The runtime is framework neutral (`@assistant-ui/core`), which is why React Native and Ink share it.

### Adapters, protocols, persistence

Runtime adapters translate a backend's wire shape (AI SDK UI message stream, LangGraph events, ADK sessions, AG-UI events, A2A tasks) into thread state. Two generic protocols avoid a bespoke adapter: the AI SDK data stream and Assistant Transport (`assistant-stream`). Persistence is a separate seam: Assistant Cloud or your own `ThreadHistoryAdapter` and `RemoteThreadListAdapter`.

## Data flow

```
User action (send)
  → primitive calls aui.thread.composer().send()
  → runtime appends the message and starts a run
  → adapter streams parts from the backend into thread state
  → subscribers notified, primitives and elements re-render
```

## Message model

```ts
type ThreadMessage = ThreadUserMessage | ThreadAssistantMessage | ThreadSystemMessage;

type ThreadUserMessage = {
  id: string;
  role: "user";
  content: readonly ThreadUserMessagePart[];
  attachments: readonly CompleteAttachment[];
  metadata: { custom: Record<string, unknown>; isOptimistic?: boolean };
  createdAt: Date;
};

type ThreadAssistantMessage = {
  id: string;
  role: "assistant";
  content: readonly ThreadAssistantMessagePart[];
  status: MessageStatus;
  metadata: {
    steps: readonly ThreadStep[];
    submittedFeedback?: { type: "positive" | "negative" };
    timing?: MessageTiming;
    custom: Record<string, unknown>;
  };
  createdAt: Date;
};

type MessageStatus =
  | { type: "running" }
  | { type: "requires-action"; reason: "interrupt" | "tool-calls" }
  | { type: "complete"; reason: "stop" | "unknown" }
  | { type: "incomplete"; reason: "cancelled" | "content-filter" | "error" | "length" | "other" | "tool-calls"; error?: ReadonlyJSONValue };
```

`status` is an object; branch on `status.type`. The two roles carry different part unions:

```ts
type ThreadUserMessagePart = TextMessagePart | ImageMessagePart | FileMessagePart | DataMessagePart | Unstable_AudioMessagePart;

type ThreadAssistantMessagePart =
  | TextMessagePart          // { type: "text"; text }
  | ReasoningMessagePart     // { type: "reasoning"; text }
  | ToolCallMessagePart      // { type: "tool-call"; toolCallId; toolName; args; argsText; result?; isError?; artifact?; approval?; messages? }
  | SourceMessagePart        // { type: "source"; sourceType: "url"; id; url; title? }
  | FileMessagePart          // { type: "file"; data; mimeType; filename? }
  | ImageMessagePart         // { type: "image"; image; filename? }
  | DataMessagePart          // { type: "data"; name; data }
  | GenerativeUIMessagePart; // { type: "generative-ui"; spec }
```

In UI code you read `MessageState`: the message plus `parentId`, `index`, `isLast`, `branchNumber`, `branchCount`, `parts` (part data with per-part status), `composer` (the edit composer), `isCopied`, and `isHovering`. Metadata a backend attaches outside the fixed shape lands under `metadata.custom`.

## Branching

Messages form a tree. Editing or reloading creates a sibling branch; `BranchPickerPrimitive` and `aui.message.switchToBranch({ position })` move between them.

```
User: "Hello"
  └─ Assistant: "Hi there!"
       ├─ User: "Tell me a joke"  → Assistant: "Why did..."   (current)
       └─ User: "Tell me a fact"  → Assistant: "The sun..."   (edit)
```
