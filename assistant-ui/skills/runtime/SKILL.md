---
name: runtime
description: "Guide to the assistant-ui runtime system, single-thread state, and the imperative runtime API in @assistant-ui/react. Use when creating a runtime (useLocalRuntime with a ChatModelAdapter, useExternalStoreRuntime for Redux/Zustand, useRemoteThreadListRuntime), wiring AssistantRuntimeProvider, or reading/mutating thread, message, and composer state and events. Covers the unified hooks useAui, useAuiState, useAuiEvent (composer.send, thread.runStart, thread.runEnd), legacy hooks (useAssistantRuntime, useThreadRuntime, useMessageRuntime, useComposerRuntime, useThread, useThreadMessages), the AssistantRuntime/ThreadRuntime/MessageRuntime/ComposerRuntime hierarchy, thread operations (append, cancelRun, message().edit/reload), capabilities, and types (ThreadMessage, MessagePart, MessageStatus, ChatModelRunResult). Use for provider \"Cannot read property of undefined\" errors or state not updating. For multi-thread list UI and switching between conversations use thread-list instead."
license: MIT
---

# assistant-ui Runtime

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

## References

- [./references/local-runtime.md](./references/local-runtime.md) -- useLocalRuntime deep dive
- [./references/external-store.md](./references/external-store.md) -- useExternalStoreRuntime deep dive
- [./references/thread-list.md](./references/thread-list.md) -- Thread list management
- [./references/state-hooks.md](./references/state-hooks.md) -- State access hooks
- [./references/types.md](./references/types.md) -- Type definitions
- [./references/adapters.md](./references/adapters.md) -- Attachment, speech, dictation, suggestion, and history adapters
- [./references/voice.md](./references/voice.md) -- Realtime voice chat
- [./references/runtime-concepts.md](./references/runtime-concepts.md) -- Stability policy, transport runtime, message timing

## Runtime Hierarchy

```
AssistantRuntime
├── ThreadListRuntime (thread management)
│   ├── ThreadListItemRuntime (per-thread item)
│   └── ...
└── ThreadRuntime (current thread)
    ├── ComposerRuntime (input state)
    └── MessageRuntime[] (per-message)
        └── MessagePartRuntime[] (per-content-part)
```

## State Access (Modern API)

```tsx
import { useAui, useAuiState, useAuiEvent } from "@assistant-ui/react";

function ChatControls() {
  const api = useAui();
  const messages = useAuiState(s => s.thread.messages);
  const isRunning = useAuiState(s => s.thread.isRunning);

  useAuiEvent("composer.send", (e) => {
    console.log("Sent in thread:", e.threadId);
  });

  return (
    <div>
      <button onClick={() => api.thread().append({
        role: "user",
        content: [{ type: "text", text: "Hello!" }],
      })}>
        Send
      </button>
      {isRunning && (
        <button onClick={() => api.thread().cancelRun()}>Cancel</button>
      )}
    </div>
  );
}
```

## Thread Operations

```tsx
const api = useAui();
const thread = api.thread();

thread.append({ role: "user", content: [{ type: "text", text: "Hello" }] });

thread.cancelRun();

const state = thread.getState();  // { messages, isRunning, ... }
```

## Message Operations

```tsx
const message = api.thread().message(0);

message.edit({ role: "user", content: [{ type: "text", text: "Updated" }] });
message.reload();
```

## Events

```tsx
useAuiEvent("thread.runStart", () => {});
useAuiEvent("thread.runEnd", () => {});
useAuiEvent("composer.send", ({ threadId }) => {
  console.log("Sent in thread:", threadId);
});
useAuiEvent("thread.modelContextUpdate", () => {});
```

## Capabilities

```tsx
const caps = useAuiState(s => s.thread.capabilities);
// { cancel, edit, reload, copy, speak, attachments }
```

## Common Gotchas

**"Cannot read property of undefined"**
- Ensure hooks are called inside `AssistantRuntimeProvider`

**State not updating**
- Use selectors with `useAuiState` to prevent unnecessary re-renders

**Messages array empty**
- Check runtime is configured
- Verify API response format
