---
name: runtime
description: Guide for assistant-ui runtime system and state management. Use when working with runtimes, accessing state, or managing thread/message data.
version: 0.0.1
license: MIT
---

# assistant-ui Runtime

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

The runtime system manages thread state, messages, and AI interactions.

## References

- [./references/local-runtime.md](./references/local-runtime.md) -- useLocalRuntime deep dive
- [./references/external-store.md](./references/external-store.md) -- useExternalStoreRuntime deep dive
- [./references/thread-list.md](./references/thread-list.md) -- Thread list management
- [./references/state-hooks.md](./references/state-hooks.md) -- State access hooks

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

## Pick a Runtime

```
Using AI SDK v6?
├─ Yes → useChatRuntime (from @assistant-ui/react-ai-sdk)
└─ No
   ├─ Have external state store (Redux/Zustand)?
   │  └─ Yes → useExternalStoreRuntime
   └─ No
      ├─ Using LangGraph?
      │  └─ Yes → useLangGraphRuntime
      └─ No → useLocalRuntime
```

## State Access Patterns

### Modern API (Recommended)

```tsx
import { useAssistantApi, useAssistantState, useAssistantEvent } from "@assistant-ui/react";

function ChatControls() {
  // Get API for imperative actions
  const api = useAssistantApi();

  // Subscribe to reactive state
  const messages = useAssistantState(s => s.thread.messages);
  const isRunning = useAssistantState(s => s.thread.isRunning);

  // Listen to events
  useAssistantEvent("message-added", (e) => {
    console.log("New message:", e.message);
  });

  const handleSend = () => {
    api.thread().append({
      role: "user",
      content: [{ type: "text", text: "Hello!" }],
    });
  };

  const handleCancel = () => {
    api.thread().cancelRun();
  };

  return (
    <div>
      <p>{messages.length} messages</p>
      <button onClick={handleSend}>Send</button>
      {isRunning && <button onClick={handleCancel}>Cancel</button>}
    </div>
  );
}
```

### Legacy Hooks

```tsx
// Still work, but prefer modern API
import {
  useAssistantRuntime,
  useThreadRuntime,
  useThread,
  useThreadMessages,
  useComposer,
} from "@assistant-ui/react";

const runtime = useAssistantRuntime();
const threadRuntime = useThreadRuntime();
const { messages, isRunning } = useThread();
const messages = useThreadMessages();
const { text } = useComposer();
```

## Message Types

```typescript
type ThreadMessage =
  | ThreadUserMessage
  | ThreadAssistantMessage
  | ThreadSystemMessage;

interface ThreadUserMessage {
  id: string;
  role: "user";
  content: MessagePart[];
  attachments?: Attachment[];
  createdAt: Date;
}

interface ThreadAssistantMessage {
  id: string;
  role: "assistant";
  content: MessagePart[];
  status: MessageStatus;
  createdAt: Date;
}

type MessageStatus =
  | "running"          // Generation in progress
  | "complete"         // Finished successfully
  | "incomplete"       // Stopped early
  | "requires-action"; // Needs tool response
```

### Message Parts

```typescript
type MessagePart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown; result?: unknown }
  | { type: "reasoning"; reasoning: string }
  | { type: "source"; source: { url: string; title: string } }
  | { type: "file"; file: { name: string; url: string } };
```

## Thread Operations

```tsx
const api = useAssistantApi();
const thread = api.thread();

// Append message
thread.append({
  role: "user",
  content: [{ type: "text", text: "Hello" }],
});

// With attachments
thread.append({
  role: "user",
  content: [{ type: "text", text: "What's in this image?" }],
  attachments: [{ type: "image", url: "data:image/..." }],
});

// Cancel generation
thread.cancelRun();

// Get current state
const state = thread.getState();
// { messages, isRunning, capabilities, ... }

// Start new run
thread.startRun();
```

## Message Operations

```tsx
const api = useAssistantApi();
const message = api.thread().message(0); // By index

// Edit user message (creates branch)
message.edit({
  role: "user",
  content: [{ type: "text", text: "Updated content" }],
});

// Reload assistant message
message.reload();

// Get message state
const state = message.getState();
```

## Capabilities

```tsx
const caps = useAssistantState(s => s.thread.capabilities);

// {
//   cancel: boolean,      // Can cancel generation
//   edit: boolean,        // Can edit messages
//   reload: boolean,      // Can regenerate
//   copy: boolean,        // Can copy messages
//   speak: boolean,       // TTS support
//   attachments: boolean, // File uploads
// }
```

## Events

```tsx
import { useAssistantEvent } from "@assistant-ui/react";

// Thread events
useAssistantEvent("thread-started", () => {});
useAssistantEvent("thread-ended", () => {});

// Message events
useAssistantEvent("message-added", ({ message }) => {});
useAssistantEvent("message-updated", ({ message }) => {});

// Run events
useAssistantEvent("run-started", () => {});
useAssistantEvent("run-ended", () => {});
```

## Message Branching

Messages form a tree structure supporting edits:

```tsx
// Edit creates a new branch
const message = api.thread().message(0);
message.edit({ role: "user", content: [{ type: "text", text: "New" }] });

// Navigate branches
import { useBranchPicker } from "@assistant-ui/react";

const { goToNext, goToPrevious, count, number } = useBranchPicker();
```

## Quick Reference

### Append Message
```tsx
api.thread().append({ role: "user", content: [{ type: "text", text: "Hi" }] });
```

### Cancel Generation
```tsx
api.thread().cancelRun();
```

### Get Messages
```tsx
const messages = useAssistantState(s => s.thread.messages);
```

### Check Running State
```tsx
const isRunning = useAssistantState(s => s.thread.isRunning);
```

### Edit Message
```tsx
api.thread().message(index).edit({ ... });
```

### Reload Message
```tsx
api.thread().message(index).reload();
```

## Common Gotchas

**"Cannot read property of undefined"**
- Ensure hooks are called inside `AssistantRuntimeProvider`
- Runtime hooks need message/part context for nested access

**State not updating**
- `useAssistantState` returns new reference on change
- Use selectors to prevent unnecessary re-renders

**Messages array empty**
- Check that runtime is properly configured
- Verify API response format matches expected streaming format
