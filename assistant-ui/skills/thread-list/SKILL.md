---
name: thread-list
description: Guide for multi-thread management in assistant-ui. Use when implementing thread lists, switching threads, or managing conversation history.
version: 0.0.1
license: MIT
---

# assistant-ui Thread List

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Manage multiple chat threads with built-in or custom UI.

## References

- [./references/management.md](./references/management.md) -- Thread CRUD operations
- [./references/custom-ui.md](./references/custom-ui.md) -- Custom thread list UI

## Quick Start

Thread list is automatically available with `useChatRuntime` + cloud:

```tsx
import { AssistantCloud } from "assistant-cloud";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider, Thread, ThreadList } from "@assistant-ui/react";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function Chat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
    cloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen">
        <ThreadList className="w-64 border-r" />
        <Thread className="flex-1" />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

## Thread List State

```tsx
import { useAssistantState } from "@assistant-ui/react";

function ThreadInfo() {
  const { threads, archivedThreads, mainThreadId, isLoading } = useAssistantState(
    (s) => s.threadList
  );

  return (
    <div>
      <p>Active: {threads.length}</p>
      <p>Archived: {archivedThreads.length}</p>
      <p>Current: {mainThreadId}</p>
    </div>
  );
}
```

## Thread Operations

```tsx
import { useAssistantApi } from "@assistant-ui/react";

function ThreadControls() {
  const api = useAssistantApi();

  // Switch to thread
  const switchThread = (threadId: string) => {
    api.threads().switchToThread(threadId);
  };

  // Create new thread
  const newThread = () => {
    api.threads().switchToNewThread();
  };

  // Thread item operations
  const item = api.threads().item({ id: threadId });
  await item.rename("New Title");
  await item.archive();
  await item.unarchive();
  await item.delete();
}
```

## Pre-built Components

### ThreadList

```tsx
import { ThreadList } from "@assistant-ui/react";

<ThreadList className="w-64 h-full" />
```

### ThreadListPrimitive

```tsx
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";

function CustomThreadList() {
  return (
    <ThreadListPrimitive.Root className="w-64">
      <ThreadListPrimitive.New className="w-full p-2 bg-blue-500 text-white">
        + New Chat
      </ThreadListPrimitive.New>

      <ThreadListPrimitive.Items>
        <ThreadListItemPrimitive.Root className="flex p-2 hover:bg-gray-100">
          <ThreadListItemPrimitive.Trigger className="flex-1">
            <ThreadListItemPrimitive.Title />
          </ThreadListItemPrimitive.Trigger>
          <ThreadListItemPrimitive.Archive>📁</ThreadListItemPrimitive.Archive>
          <ThreadListItemPrimitive.Delete>🗑️</ThreadListItemPrimitive.Delete>
        </ThreadListItemPrimitive.Root>
      </ThreadListPrimitive.Items>
    </ThreadListPrimitive.Root>
  );
}
```

## ThreadListRuntime API

```typescript
type ThreadListRuntime = {
  getState(): ThreadListState;
  subscribe(callback: () => void): Unsubscribe;

  main: ThreadRuntime;              // Current thread
  getById(threadId: string): ThreadRuntime;

  mainItem: ThreadListItemRuntime;  // Current item
  getItemById(threadId: string): ThreadListItemRuntime;
  getItemByIndex(idx: number): ThreadListItemRuntime;

  switchToThread(threadId: string): Promise<void>;
  switchToNewThread(): Promise<void>;
};
```

## ThreadListItemRuntime API

```typescript
type ThreadListItemRuntime = {
  getState(): ThreadListItemState;

  switchTo(): Promise<void>;
  rename(newTitle: string): Promise<void>;
  archive(): Promise<void>;
  unarchive(): Promise<void>;
  delete(): Promise<void>;

  initialize(): Promise<{ remoteId: string }>;
  generateTitle(): Promise<void>;

  subscribe(callback: () => void): Unsubscribe;
};
```

## Primitive Parts

### ThreadListPrimitive

| Part | Description |
|------|-------------|
| `.Root` | Container element |
| `.New` | Create new thread button |
| `.Items` | Renders thread items |
| `.ItemByIndex` | Single item by index |

### ThreadListItemPrimitive

| Part | Description |
|------|-------------|
| `.Root` | Item container |
| `.Trigger` | Click to switch |
| `.Title` | Thread title |
| `.Archive` | Archive button |
| `.Unarchive` | Unarchive button |
| `.Delete` | Delete button |

## Common Patterns

### Sidebar Layout

```tsx
function ChatApp() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen">
        <aside className="w-64 border-r">
          <ThreadList />
        </aside>
        <main className="flex-1">
          <Thread />
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
```

### Collapsible Sidebar

```tsx
function ChatApp() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen">
        <aside className={collapsed ? "w-0" : "w-64"}>
          <ThreadList />
        </aside>
        <main className="flex-1">
          <button onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "→" : "←"}
          </button>
          <Thread />
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
```

### Search/Filter

```tsx
function FilterableThreadList() {
  const [filter, setFilter] = useState("");
  const { threads } = useAssistantState((s) => s.threadList);
  const api = useAssistantApi();

  const filtered = threads.filter((id) => {
    const item = api.threads().item({ id }).getState();
    return item.title?.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search threads..."
      />
      {filtered.map((threadId) => (
        <ThreadItem key={threadId} id={threadId} />
      ))}
    </div>
  );
}
```

## Without Cloud (Local)

```tsx
import { useRemoteThreadListRuntime, InMemoryThreadListAdapter } from "@assistant-ui/react";

function Chat() {
  const runtime = useRemoteThreadListRuntime({
    adapter: new InMemoryThreadListAdapter(),  // Local only
    runtimeHook: () => useLocalRuntime({ model: myModel }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Common Gotchas

**ThreadList not showing**
- Ensure `cloud` is passed to runtime
- Check authentication is working

**Threads not persisting**
- Verify cloud connection
- Check network requests

**New thread not working**
- `switchToNewThread()` creates on first message
- Thread is ephemeral until user sends message
