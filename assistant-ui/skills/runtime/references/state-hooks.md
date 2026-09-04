# State Hooks

Accessing assistant-ui runtime state and actions.

## useAui

Get the runtime API for imperative actions. It does not subscribe to state, so its identity only changes on a structural change (for example, switching threads); reach for it in event handlers and imperative code, not to render a value.

```tsx
import { useAui } from "@assistant-ui/react";

function Controls() {
  const aui = useAui();

  const thread = aui.thread;                    // scope accessors are properties as of 0.15
  thread.append({ role: "user", content: [{ type: "text", text: "Hi" }] });
  thread.cancelRun();
  thread.startRun({ parentId: null });

  const message = thread.message({ index: 0 }); // selector object, not a bare index
  message.reload();
  message.composer().beginEdit();

  const threads = aui.threads;
  threads.switchToThread(threadId);
  threads.switchToNewThread();

  const state = thread.getState();               // state snapshots come from a scope
}
```

There is no `aui.getState()`. The client exposes the scope accessors plus `subscribe(listener)` and `on(selector, callback)`; read state through `aui.<scope>.getState()` or, in React, `useAuiState`.

## useAuiState

Subscribe to a slice of `AssistantState` with a selector. The selector runs on every store update, and its return value is compared with `Object.is`; the component re-renders only when the selected value changes.

```tsx
import { useAuiState } from "@assistant-ui/react";

function MessageCount() {
  const messages = useAuiState((s) => s.thread.messages);   // stable array reference
  return <div>{messages.length} messages</div>;
}

function RunningIndicator() {
  const isRunning = useAuiState((s) => s.thread.isRunning); // primitive
  return isRunning ? <Spinner /> : null;
}
```

Two return shapes are unsupported and either throw or silently misbehave:

- **The whole state object.** `useAuiState((s) => s)` throws at runtime; select a specific field, or compose multiple `useAuiState` calls.
- **A new object or array literal**, including spreading a scope into one (`{ ...s.thread }`). Every call constructs a new reference, so `Object.is` never matches and the component re-renders on every store update regardless of whether the values it cares about changed.

```tsx
// Wrong: a fresh object every call, re-renders on every store update
const { messages, isRunning } = useAuiState((s) => ({
  messages: s.thread.messages,
  isRunning: s.thread.isRunning,
}));

// Correct: one primitive or stable reference per call
const messages = useAuiState((s) => s.thread.messages);
const isRunning = useAuiState((s) => s.thread.isRunning);
```

When you need several values together in one component, call `useAuiState` once per value rather than bundling them into one selector's return.

## useAuiEvent

Listen to runtime events for the component's lifetime. The subscription re-establishes when the scope or event name changes; the callback runs through an effect-event shim, so the latest closure fires without a memoized reference.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

function Analytics() {
  useAuiEvent("composer.send", (event) => {
    analytics.track("message_sent", { threadId: event.threadId, messageId: event.messageId });
  });
  return null;
}
```

Nearly every event is deprecated as state-derivable: prefer observing the equivalent state with `useAuiState`, which is correct on first render and on replay in a way an event handler is not.

| Event | Payload | Status |
|-------|---------|--------|
| `threads.selectionChanged` | `{ threadId, previousThreadId }` | Current: fires once per main-thread switch. Does not fire for the initially selected thread on mount |
| `thread.modelContextUpdate` | `{ threadId }` | Current: model context lives in a provider, so there is no state equivalent |
| `composer.attachmentAddError` | `{ reason, message, error? }` | Current: `reason` is `"no-adapter"` \| `"not-accepted"` \| `"adapter-error"` |
| `composer.send` | `{ threadId, messageId? }` | Deprecated: observe composer `text` clearing |
| `composer.attachmentAdd` | `{ threadId, messageId? }` | Deprecated: observe composer `attachments` |
| `thread.runStart` | `{ threadId }` | Deprecated: observe `s.thread.isRunning` flipping to `true` |
| `thread.runEnd` | `{ threadId }` | Deprecated: observe `s.thread.isRunning` flipping to `false` |
| `thread.initialize` | `{ threadId }` | Deprecated: observe `s.thread.messages` becoming non-empty |
| `threadListItem.switchedTo` | `{ threadId }` | Deprecated: use `threads.selectionChanged`, its `threadId` is the newly selected thread |
| `threadListItem.switchedAway` | `{ threadId }` | Deprecated: use `threads.selectionChanged`, its `previousThreadId` is the thread switched away from |

The deprecated pair is scope-filtered (it only fires inside the matching per-item `threadListItem` scope); `threads.selectionChanged` resolves against the shared `threads` scope, so every listener fires on every switch. Filter by id to reproduce the old per-item behavior.

## State shape

`AssistantState` is the union of every registered scope's state, plus an `optional` view of the same scopes:

```typescript
type AssistantState = ScopeStates & {
  readonly optional: { readonly [K in keyof ScopeStates]: ScopeStates[K] | undefined };
};
```

Registered scopes: `threads`, `threadListItem`, `thread`, `message`, `part`, `chainOfThought`, `composer`, `attachment`, `modelContext`, `suggestions`, `suggestion`, `queueItem`, plus `tools` from the React layer. `on`, `optional`, and `subscribe` are reserved names and cannot be scopes.

```typescript
// s.thread
{
  isEmpty: boolean;
  isDisabled: boolean;
  isLoading: boolean;
  isRunning: boolean;
  capabilities: RuntimeCapabilities;
  messages: readonly MessageState[];
  suggestions: readonly ThreadSuggestion[];
  extras: unknown;
  speech: SpeechState | undefined;
  voice: VoiceSessionState | undefined;
  modelContext: ModelContext;
  composer: ComposerState;
}

// s.threads
{
  mainThreadId: string;
  newThreadId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  threadIds: readonly string[];
  archivedThreadIds: readonly string[];
  threadItems: readonly ThreadListItemState[];
}

// s.composer (thread composer or edit composer, depending on scope)
{
  text: string;
  role: MessageRole;
  attachments: readonly Attachment[];
  runConfig: RunConfig;
  isEditing: boolean;
  canCancel: boolean;
  canSend: boolean;
  attachmentAccept: string;
  isEmpty: boolean;
  type: "thread" | "edit";
  dictation: DictationState | undefined;
  quote: QuoteInfo | undefined;
  queue: readonly QueueItemState[];
}

// s.message = ThreadMessage & { ... }
{
  parentId: string | null;
  isLast: boolean;
  index: number;
  branchNumber: number;
  branchCount: number;
  composer: ComposerState;   // the edit composer
  parts: readonly PartState[];
  isCopied: boolean;
  isHovering: boolean;
  speech: SpeechState | undefined;
}
```

## Optional scope reads

`s.optional.<scope>` yields `undefined` rather than throwing when the scope is not mounted. Use it in a component that renders both inside and outside a scope:

```tsx
const partType = useAuiState((s) => s.optional.part?.type);
const inThread = useAuiState((s) => s.optional.thread != null);
```

Imperatively, the equivalent guard is `aui.<scope>.source != null`.

## Removed legacy hooks

The v0.12-era context hooks were removed in 0.15. They no longer exist as exports; importing one is a build error, not a deprecation warning.

| Removed | Replacement |
|---------|-------------|
| `useAssistantRuntime()` | `useAui()` |
| `useThreadList(selector)` | `useAuiState((s) => s.threads)` |
| `useThreadRuntime()` | `useAui().thread` |
| `useThread(selector)` | `useAuiState((s) => s.thread)` |
| `useThreadComposer(selector)` | `useAuiState((s) => s.thread.composer)` |
| `useThreadModelContext(selector)` | `useAuiState((s) => s.thread.modelContext)` |
| `useMessageRuntime()` | `useAui().message` |
| `useMessage(selector)` | `useAuiState((s) => s.message)` |
| `useEditComposer(selector)` | `useAuiState((s) => s.message.composer)` |
| `useComposerRuntime()` | `useAui().composer` |
| `useComposer(selector)` | `useAuiState((s) => s.composer)` |
| `useMessagePartRuntime()` | `useAui().part` |
| `useMessagePart(selector)` | `useAuiState((s) => s.part)` |
| `useAttachmentRuntime()` | `useAui().attachment` |
| `useAttachment(selector)` | `useAuiState((s) => s.attachment)` |
| `useThreadListItemRuntime()` | `useAui().threadListItem` |
| `useThreadListItem(selector)` | `useAuiState((s) => s.threadListItem)` |

The attachment variants (`useThreadComposerAttachment(Runtime)`, `useEditComposerAttachment(Runtime)`, `useMessageAttachment(Runtime)`) were removed with them; use `useAui().attachment` / `useAuiState((s) => s.attachment)`.

`useThreadMessages` was removed earlier and has no current export; use `useAuiState((s) => s.thread.messages)`, or `unstable_useThreadMessageIds()` when you only need ids and want to avoid re-rendering on content changes.

Still present but deprecated: `useMessagePartText`, `useMessagePartReasoning`, `useMessagePartSource`, `useMessagePartImage`, `useMessagePartFile`, `useMessagePartData`. Replace them by selecting and narrowing `s.part`. The primitive `If` components (`ThreadPrimitive.If`, `MessagePrimitive.If`, `ThreadPrimitive.Empty`) are likewise deprecated in favor of `AuiIf`.

## Context requirements

```tsx
// Work anywhere inside AssistantRuntimeProvider
useAui();
useAuiState(selector);
useAuiEvent(event, callback);

// Scopes that require a surrounding provider before they resolve:
//   s.message / aui.message        inside ThreadPrimitive.Messages
//   s.part / aui.part              inside MessagePrimitive.Parts
//   s.attachment / aui.attachment  inside a ComposerPrimitive.Attachments or
//                                  MessagePrimitive.Attachments render function
//   s.threadListItem               inside ThreadListPrimitive.Items
```

Reading one of those outside its provider throws. Use `s.optional.<scope>` or `aui.<scope>.source != null` when the component can render in both places.

## Performance tips

Select the narrowest value, memoize derived data, and split components so each subscribes only to what it renders:

```tsx
// Re-renders on every state change
const state = useAuiState((s) => s);

// Only re-renders when the message count changes
const count = useAuiState((s) => s.thread.messages.length);
```

```tsx
function MessageList() {
  const messages = useAuiState((s) => s.thread.messages);
  const userMessages = useMemo(() => messages.filter((m) => m.role === "user"), [messages]);
  return <div>{userMessages.length} user messages</div>;
}
```

```tsx
// Each subscribes independently; a change to one does not re-render the other
function Chat() {
  return (
    <div>
      <MessageList />
      <RunningIndicator />
    </div>
  );
}
function RunningIndicator() {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  return isRunning ? <Spinner /> : null;
}
```

## Direct subscription

`subscribe` and `on` live on the client itself, not on the scope accessors. Read the scope's state inside the callback:

```tsx
const aui = useAui();

useEffect(() => {
  const unsubscribe = aui.subscribe(() => {
    console.log("State changed:", aui.thread.getState());
  });
  return unsubscribe;
}, [aui]);
```

`aui.on(selector, callback)` is the imperative form of `useAuiEvent`; both take the same event selectors and return an unsubscribe function.
