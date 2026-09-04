---
name: runtime
description: "Guide to the assistant-ui runtime system, the state and action layer behind every chat surface, in @assistant-ui/react. Use when creating a runtime (useLocalRuntime with a ChatModelAdapter, useExternalStoreRuntime for Redux or Zustand backed stores, useRemoteThreadListRuntime, useCloudThreadListRuntime, useAssistantTransportRuntime), wiring AssistantRuntimeProvider, or reading and mutating thread, message, composer, and attachment state. Covers useAui, useAuiState, and useAuiEvent, including the one primitive or stable reference selector rule from hooks/state.mdx, the property scope accessors (aui.thread, aui.threads, aui.message, aui.composer, aui.part, aui.threadListItem) with source availability, the AuiConfig plus AuiProvider grammar (config, extends, isolated roots, and the config prop on AssistantRuntimeProvider), the s.optional.<scope> view, the threads.selectionChanged event and the events it replaced, RuntimeCapabilities including refetchThread, and the attachment, speech, dictation, feedback, suggestion, and history adapters. Route here for a provider error ('Cannot read property of undefined'), a removed v0.12 hook import, an infinite re-render from an object literal selector, or state not updating. For multi-thread list UI and switching between conversations use thread-list instead; for toolkit definitions and tool call UI use tools instead."
license: MIT
---

# assistant-ui Runtime

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

A runtime is the state and action layer behind a chat UI: it owns messages, threads, branching, and run lifecycle, and every primitive and hook reads from it through a uniform `AssistantClient`. There are two ways to build one. `LocalRuntime` (`useLocalRuntime`) owns the message store for you; you implement one `ChatModelAdapter.run` function and branching, editing, and regeneration come for free. `ExternalStoreRuntime` (`useExternalStoreRuntime`) is the inverse: you own the messages, and UI features turn on based on which callbacks you supply. Framework adapters such as `useChatRuntime` (`@assistant-ui/ai-sdk`) and protocol runtimes such as `useAssistantTransportRuntime` are built on one of these two. Once mounted under `AssistantRuntimeProvider`, every runtime is read and driven the same way, through `useAui`, `useAuiState`, and `useAuiEvent`.

## References

- [./references/local-runtime.md](./references/local-runtime.md) -- useLocalRuntime deep dive: streaming, tool calls, human-in-the-loop, approval gates, resumeRun
- [./references/external-store.md](./references/external-store.md) -- useExternalStoreRuntime deep dive: handler matrix, branching, queueing, tool results
- [./references/state-hooks.md](./references/state-hooks.md) -- useAui, useAuiState, useAuiEvent, state shape, removed legacy hooks
- [./references/types.md](./references/types.md) -- ThreadMessage, MessageStatus, MessagePart, attachment, and capability types
- [./references/adapters.md](./references/adapters.md) -- attachment, speech, dictation, feedback, suggestion, and history adapters
- [./references/voice.md](./references/voice.md) -- realtime duplex voice with RealtimeVoiceAdapter
- [./references/runtime-concepts.md](./references/runtime-concepts.md) -- unstable_ policy, useAssistantTransportRuntime, MessageNotSentError, reloadMainThread, message timing

## Runtime hierarchy

```
AssistantRuntime
├── ThreadListRuntime (threads)
│   └── ThreadListItemRuntime[] (threadListItem)
└── ThreadRuntime (thread)
    ├── ComposerRuntime (composer)        new-message input
    ├── SuggestionRuntime[] (suggestion)  follow-up prompts, via thread.suggestions
    └── MessageRuntime[] (message)
        ├── ComposerRuntime (composer)    edit-message input
        ├── MessagePartRuntime[] (part)
        ├── ChainOfThoughtRuntime (chainOfThought)
        │   └── MessagePartRuntime[] (part)
        └── AttachmentRuntime[] (attachment)
```

`modelContext` and `tools` resolve independently of the thread scope; see [runtime-concepts.md](./references/runtime-concepts.md) and the [tools](../tools/SKILL.md) skill. Every node in the tree is reachable from `aui.<scope>` (imperative) or `s.<scope>` inside a `useAuiState` selector (reactive), scoped automatically to where the calling component is rendered.

## useAui, useAuiState, useAuiEvent

`useAui()` returns the current `AssistantClient`. It does not subscribe to state, so its identity only changes on a structural change (for example switching threads); use it in event handlers and imperative code.

```tsx
import { useAui } from "@assistant-ui/react";

const aui = useAui();
aui.thread.append({ role: "user", content: [{ type: "text", text: "Hello!" }] });
aui.thread.cancelRun();
```

`useAuiState(selector)` subscribes to a slice of `AssistantState` and re-renders only when the selected value changes (compared with `Object.is`). The selector runs on every store update, so it must return a primitive or a stable reference, never a fresh object or array literal, and never the whole state (that throws).

```tsx
import { useAuiState } from "@assistant-ui/react";

const isRunning = useAuiState((s) => s.thread.isRunning);   // primitive: correct
const messages = useAuiState((s) => s.thread.messages);      // stable array reference: correct

// Wrong: a new object literal every call re-renders on every store update
const bad = useAuiState((s) => ({ isRunning: s.thread.isRunning, text: s.composer.text }));
```

Call `useAuiState` once per value (or compose several calls); do not spread a scope into a new object to bundle values together.

`useAuiEvent(nameOrSelector, callback)` subscribes for the component's lifetime. The callback runs inside an effect-event shim, so the latest closure fires without a memoized reference.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

useAuiEvent("thread.modelContextUpdate", ({ threadId }) => {
  console.log("Model context updated", threadId);
});
```

## Scope accessors are properties

As of 0.15, `aui.<scope>` is a property, not a call; calling it (`aui.thread()`) still works but is deprecated. Methods on a scope keep their parentheses.

```tsx
aui.thread.getState();             // property accessor
aui.threads.switchToNewThread();
aui.thread.composer().send();      // composer() is a method of the thread scope
aui.thread.message({ index: 0 });  // selector object, not a bare index
```

Selecting an unavailable scope no longer throws; `aui.message` is always truthy. Check availability before use with `source`, which is `null` when the scope is not mounted:

```tsx
if (aui.message.source != null) {
  aui.message.reload();
}
```

`source`, `query`, and `name` are reserved accessor properties and never resolve to scope methods.

## AuiConfig and AuiProvider

`AuiProvider` mounts an `AssistantClient` for a subtree. Its `config` prop must be built with `AuiConfig({...})`, imported from `@assistant-ui/react` (raw object literals are a type error). At the top level `config` alone creates the subtree's client. Nested under a parent provider, `extends` is mandatory: `extends={aui}` extends the parent client, `extends={null}` isolates a fresh root (dev enforced). `AssistantRuntimeProvider` installs an `AuiProvider` internally and additionally accepts `config` to attach extra scopes (such as a toolkit) alongside the runtime's own scopes; use it instead of wiring `AuiProvider` by hand around a runtime.

```tsx
import { AssistantRuntimeProvider, AuiConfig, AuiProvider, Tools, useAui } from "@assistant-ui/react";

// Runtime root: config attaches extra scopes next to the runtime's own
const config = AuiConfig({ tools: Tools({ toolkit }) });
<AssistantRuntimeProvider runtime={runtime} config={config}>{children}</AssistantRuntimeProvider>;

// Nested scope: extend the parent client
function MessageScope({ children }: { children: React.ReactNode }) {
  const aui = useAui();
  const nested = AuiConfig({ tools: Tools({ toolkit: extraToolkit }) });
  return <AuiProvider extends={aui} config={nested}>{children}</AuiProvider>;
}

// Isolated root: detach from any parent client
const isolated = AuiConfig({});
<AuiProvider extends={null} config={isolated}>{children}</AuiProvider>;
```

A config is plain data: hoist it to module scope, build it inline per render, or memoize it, the provider never relies on config identity. `ref` on `AuiProvider` receives the resulting client after mount.

## Thread and message operations

```tsx
const aui = useAui();
const thread = aui.thread;

thread.append({ role: "user", content: [{ type: "text", text: "Hello" }] });
thread.startRun({ parentId: null });
thread.cancelRun();

const state = thread.getState();   // { messages, isRunning, capabilities, composer, ... }

const message = thread.message({ index: 0 });   // or { id: messageId }
message.reload();
message.switchToBranch({ position: "next" });
message.submitFeedback({ type: "positive" });

const editComposer = message.composer();
editComposer.beginEdit();
editComposer.setText("Updated");
editComposer.send();
```

## Events

Most events are deprecated in favor of deriving the same transition from `useAuiState`, which is correct on first render and replay in a way an event handler is not.

| Event | Status |
|-------|--------|
| `threads.selectionChanged` | Current: fires once per main-thread switch with `{ threadId, previousThreadId }`. Does not fire for the initially selected thread on mount |
| `thread.modelContextUpdate` | Current: the model context lives in a provider, not in state, so there is no state-derivable equivalent |
| `composer.attachmentAddError` | Current: `reason` is `"no-adapter"` \| `"not-accepted"` \| `"adapter-error"` |
| `composer.send`, `composer.attachmentAdd` | Deprecated: observe composer `text` / `attachments` |
| `thread.runStart`, `thread.runEnd` | Deprecated: observe `s.thread.isRunning` flipping |
| `thread.initialize` | Deprecated: observe `s.thread.messages` becoming non-empty |
| `threadListItem.switchedTo`, `threadListItem.switchedAway` | Deprecated: use `threads.selectionChanged`, filtering by id inside a per-item scope if needed |

The deprecated pair still fires and keeps working until the next major. `threads.selectionChanged` also fires in situations the old pair did not, such as `switchToNewThread()` and a deep-linked initial thread resolving after mount.

## Optional scopes

`s.optional.<scope>` resolves to `undefined` instead of throwing when a scope is not mounted, the safe way to read a scope from a component that renders both inside and outside it.

```tsx
const partType = useAuiState((s) => s.optional.part?.type);
```

The imperative equivalent is `aui.<scope>.source != null`.

## Capabilities

```tsx
const capabilities = useAuiState((s) => s.thread.capabilities);
```

`RuntimeCapabilities` (from `@assistant-ui/core`): `switchToBranch`, `switchBranchDuringRun`, `edit`, `reload`, `delete`, `cancel`, `refetchThread`, `unstable_copy`, `speech`, `dictation`, `voice`, `attachments`, `feedback`, `queue`. Runtimes derive nearly all of these from what you supply (a callback, an adapter) rather than an explicit option; `unstable_copy` is the one flag `ExternalStoreRuntime` lets you force off via `unstable_capabilities`. `refetchThread` reports whether `aui.threads.reloadMainThread()` will refresh the open thread in place or fall back to remounting the runtime; see [runtime-concepts.md](./references/runtime-concepts.md).

## Common Gotchas

**"Cannot read property of undefined"**
- Ensure hooks are called inside `AssistantRuntimeProvider` (or an `AuiProvider` whose config supplies the scope).
- For a scope that may not be mounted, read `s.optional.<scope>` or guard on `aui.<scope>.source != null`.

**Infinite re-renders from `useAuiState`**
- The selector returned a new object or array literal, including spreading a scope into one. Select primitives with separate calls, or return a memoized reference.

**A legacy hook import fails to resolve**
- `useAssistantRuntime`, `useThreadRuntime`, `useThread`, `useMessage`, `useComposer`, `useMessagePart`, `useAttachment`, `useThreadListItem` and friends were removed in 0.15. See [state-hooks.md](./references/state-hooks.md) for the full mapping, or the [update](../update/SKILL.md) skill.

**State not updating**
- Use a selector with `useAuiState` rather than reading `getState()` in render; `getState()` is a one-time snapshot, not a subscription.

**Multiple threads or a conversation sidebar**
- This skill covers a single thread's state and the runtime hooks. For creating, switching, archiving, and rendering a list of threads, use the [thread-list](../thread-list/SKILL.md) skill instead.

## Related Skills

- [thread-list](../thread-list/SKILL.md) -- multi-thread UI, thread CRUD, `threads.selectionChanged` consumers
- [tools](../tools/SKILL.md) -- toolkit authoring, tool call UI, approval gates and human tools in depth
- [elements](../elements/SKILL.md) -- the styled `Thread` and composer components that read this state for you
- [cloud](../cloud/SKILL.md) -- `AssistantCloud`, managed persistence, and `useChatRuntime({ cloud })`
- [streaming](../streaming/SKILL.md) -- the DataStream and AssistantTransport wire protocols underneath the protocol runtimes
