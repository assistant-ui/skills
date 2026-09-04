---
name: thread-list
description: "Builds and customizes multiple conversation lists in assistant-ui with the runtime connected ThreadList and ThreadListSidebar elements, ThreadListPrimitive, ThreadListItemPrimitive, ThreadListItemMorePrimitive, useAui, useAuiState, and threads.selectionChanged. Use when adding a conversation sidebar, switching, archiving, renaming, deleting, searching, grouping, paginating, or persisting threads, or when thread state is stale after authentication. Covers AssistantCloud, RemoteThreadListRuntime, and ExternalStoreThreadListAdapter. Use runtime for the active conversation runtime, cloud for managed authentication and persistence, and elements for registry installation and styling."
license: MIT
---

# assistant-ui Thread List

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

A runtime starts with one in memory conversation. Add a thread list only when people need to create, select, and manage multiple conversations. Choose the managed cloud path, a backend adapter, or an external store before choosing the UI.

## References

- [./references/management.md](./references/management.md) -- CRUD, initialization, refresh, pagination, metadata, and identifiers
- [./references/custom-ui.md](./references/custom-ui.md) -- every thread list primitive, custom layouts, search, grouping, and the installed element composition
- [./references/remote-adapter.md](./references/remote-adapter.md) -- remote adapter contract, history adapters, store entries, authentication reload, and external stores

## Quick Start

Install the runtime connected list with `npx assistant-ui@latest add thread-list`. It creates `components/assistant-ui/elements/thread-list.aui.tsx`. Pass an `AssistantCloud` instance to `useChatRuntime` for managed threads, then render the list and active thread beneath the provider.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantCloud } from "assistant-cloud";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  anonymous: true,
});

export function Chat() {
  const runtime = useChatRuntime({ cloud });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh">
        <aside className="w-72 border-e p-2">
          <ThreadList />
        </aside>
        <main className="min-w-0 flex-1">
          <Thread />
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
```

Use the full sidebar shell when the project already uses the shadcn sidebar primitives. `ThreadListSidebar` renders the runtime connected thread list itself, so do not also mount `ThreadList` inside it.

```tsx
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ThreadListSidebar } from "@/components/assistant-ui/elements/threadlist-sidebar.aui";

export function ChatLayout() {
  return (
    <SidebarProvider>
      <ThreadListSidebar />
      <SidebarInset>
        <Thread />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

`ThreadListSidebar` still needs the `AssistantRuntimeProvider` ancestor from the first example. Its `SidebarProvider` is separate layout context.

## Thread Operations

Use `useAui()` for commands. Scope accessors are properties, so use `aui.threads` and `aui.threadListItem`, never `aui.threads()`. Read each state value independently with `useAuiState`. A selector may return one primitive value or a stable runtime reference, but never an object or array literal.

```tsx
import { useAui, useAuiState } from "@assistant-ui/react";

export function ThreadControls({ threadId }: { threadId: string }) {
  const aui = useAui();
  const activeThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const isLoading = useAuiState((s) => s.threads.isLoading);

  const item = aui.threads.item({ id: threadId });

  return (
    <div>
      <p>{threadIds.length} conversations</p>
      <p>{activeThreadId === threadId ? "Current" : "Available"}</p>
      <button disabled={isLoading} onClick={() => aui.threads.switchToNewThread()}>
        New conversation
      </button>
      <button onClick={() => item.switchTo()}>Open</button>
      <button onClick={() => item.rename("Project planning")}>Rename</button>
      <button onClick={() => item.archive()}>Archive</button>
      <button onClick={() => item.delete()}>Delete</button>
    </div>
  );
}
```

Inside a thread item primitive, `s.threadListItem` is the item in scope. Select fields individually, not the whole state object, when a row only needs one value.

```tsx
import { useAuiState } from "@assistant-ui/react";

export function ThreadRunningBadge() {
  const isRunning = useAuiState((s) => s.threadListItem.isRunning);
  return isRunning ? <span>Working</span> : null;
}
```

## Compose a Custom List

Start from the three primitive namespaces when the installed element's date grouping, search, or visual treatment does not match the product. `Items` supplies the current item scope and its children render function replaces the deprecated `components` prop.

```tsx
import {
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react";

export function CustomThreadList() {
  return (
    <ThreadListPrimitive.Root className="flex flex-col gap-1">
      <ThreadListPrimitive.New>New conversation</ThreadListPrimitive.New>
      <ThreadListPrimitive.Items>
        {({ threadListItem }) => (
          <ThreadListItemPrimitive.Root data-thread-id={threadListItem.id}>
            <ThreadListItemPrimitive.Trigger className="flex-1 text-left">
              <ThreadListItemPrimitive.Title fallback="New conversation" />
            </ThreadListItemPrimitive.Trigger>
            <ThreadListItemMorePrimitive.Root sharedFocusGroup>
              <ThreadListItemMorePrimitive.Trigger>
                More
              </ThreadListItemMorePrimitive.Trigger>
              <ThreadListItemMorePrimitive.Content>
                <ThreadListItemPrimitive.Archive asChild>
                  <ThreadListItemMorePrimitive.Item>
                    Archive
                  </ThreadListItemMorePrimitive.Item>
                </ThreadListItemPrimitive.Archive>
                <ThreadListItemMorePrimitive.Separator />
                <ThreadListItemPrimitive.Delete asChild>
                  <ThreadListItemMorePrimitive.Item>
                    Delete
                  </ThreadListItemMorePrimitive.Item>
                </ThreadListItemPrimitive.Delete>
              </ThreadListItemMorePrimitive.Content>
            </ThreadListItemMorePrimitive.Root>
          </ThreadListItemPrimitive.Root>
        )}
      </ThreadListPrimitive.Items>
    </ThreadListPrimitive.Root>
  );
}
```

See [custom UI](./references/custom-ui.md) for archived rows, load more, custom search, grouping, keyboard behavior, and the complete part reference.

## Choose a Multi Conversation Path

| Path | Use it when | Thread metadata lives in |
| --- | --- | --- |
| `AssistantCloud` | You want managed authentication, persistence, synchronization, and titles | assistant-cloud |
| `useRemoteThreadListRuntime` with `RemoteThreadListAdapter` | A LocalRuntime based runtime uses the application's database | Your backend |
| `ExternalStoreThreadListAdapter` | An ExternalStoreRuntime already owns messages and selection | Your state store |

The cloud quick start above is the managed path. The remote and external store paths have different ownership and lifecycle requirements. Follow [remote adapter](./references/remote-adapter.md) instead of mixing their APIs.

## Observe Selection

`threads.selectionChanged` replaces the old per item switch events. It runs for every selection change and supplies both IDs. It does not run for the initial selection on mount.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

export function SelectionTelemetry() {
  useAuiEvent(
    "threads.selectionChanged",
    ({ threadId, previousThreadId }) => {
      recordThreadSelection({ threadId, previousThreadId });
    },
  );
  return null;
}
```

When this listener is inside an item row, compare `threadId` to `s.threadListItem.id` if it should react only when that row becomes current.

## Common Gotchas

**The list renders but no conversations persist**

- A default runtime is one in memory thread. Pass `cloud`, use a `RemoteThreadListAdapter`, or provide an `ExternalStoreThreadListAdapter`.
- A remote adapter manages metadata only. Add a history adapter or another message persistence layer for each conversation's messages.

**A thread switch uses stale messages**

- On a `RemoteThreadList` store entry, wrap the thread factory in `withKey(id, ...)` so a history adapter mounts for the selected ID.
- Use `backgroundThreads` only when runs should continue after selection changes and retaining visited threads in memory is acceptable.

**The sidebar has no runtime**

- `ThreadList` and `ThreadListSidebar` need an `AssistantRuntimeProvider` ancestor.
- `ThreadListSidebar` also needs the shadcn `SidebarProvider` because it is a sidebar shell, not a runtime provider.

**Rows re render on every unrelated store change**

- Replace selectors that return object or array literals with separate `useAuiState` calls. Returning `s.threads.threadIds` directly is safe because it is a runtime supplied stable reference.

**The switch handler stopped firing after an upgrade**

- Subscribe to `threads.selectionChanged` and use `previousThreadId`. The retired `threadListItem.switchedTo` and `threadListItem.switchedAway` events are not the current integration point.

## Related Skills

- [runtime](../runtime/SKILL.md) -- choose and configure the runtime that owns the active conversation
- [cloud](../cloud/SKILL.md) -- configure AssistantCloud authentication, persistence, and managed threads
- [elements](../elements/SKILL.md) -- install, style, and customize the runtime connected registry components
