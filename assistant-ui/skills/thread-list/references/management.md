# Thread List Management

Use `aui.threads` to manage the list and `aui.threadListItem` when a primitive has already established an item scope. Read reactive fields through `useAuiState`, one primitive value or stable reference per selector.

## Contents

- [Identifiers and state](#identifiers-and-state)
- [CRUD](#crud)
- [Initialize and title](#initialize-and-title)
- [Reload the list or open thread](#reload-the-list-or-open-thread)
- [Pagination](#pagination)
- [Custom metadata](#custom-metadata)

## Identifiers and State

The list distinguishes regular, archived, and placeholder new conversations. `threadIds` and `archivedThreadIds` are separate display lists. `mainThreadId` is the selected local ID. A list item can additionally carry a `remoteId` for the backend and an optional `externalId` for another application identity.

```tsx
import { useAuiState } from "@assistant-ui/react";

export function ThreadCounts() {
  const regularIds = useAuiState((s) => s.threads.threadIds);
  const archivedIds = useAuiState((s) => s.threads.archivedThreadIds);
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const isLoading = useAuiState((s) => s.threads.isLoading);

  return (
    <p>
      {isLoading ? "Loading" : regularIds.length + archivedIds.length} conversations,
      current: {mainThreadId}
    </p>
  );
}
```

Do not infer archival from a string prefix or treat `remoteId` as the UI ID. Render regular rows with `ThreadListPrimitive.Items` and archived rows with `ThreadListPrimitive.Items archived`. The runtime maintains the sets and selection behavior.

## CRUD

Resolve an item by its local `id` and command it through the item runtime. The primitives wire the same commands into their buttons, but this form is useful for a toolbar, keyboard shortcut, or application menu.

```tsx
import { useAui } from "@assistant-ui/react";

export function ThreadActions({ threadId }: { threadId: string }) {
  const aui = useAui();
  const item = aui.threads.item({ id: threadId });

  return (
    <div>
      <button onClick={() => aui.threads.switchToNewThread()}>
        New conversation
      </button>
      <button onClick={() => item.switchTo()}>Select</button>
      <button onClick={() => item.rename("Project planning")}>Rename</button>
      <button onClick={() => item.archive()}>Archive</button>
      <button onClick={() => item.unarchive()}>Restore</button>
      <button onClick={() => item.delete()}>Delete</button>
    </div>
  );
}
```

`Archive`, `Unarchive`, and `Delete` primitives disable themselves when the active runtime cannot perform that action. Reuse those primitives when they fit the UI instead of duplicating their capability logic.

## Initialize and Title

A fresh local thread does not necessarily have a remote record yet. `initialize()` creates or resolves that record and returns its canonical IDs. It is idempotent for the active conversation, so call it before a backend operation that needs `remoteId`.

```tsx
import { useAui } from "@assistant-ui/react";

export function PersistFirstMessage() {
  const aui = useAui();

  async function save(message: unknown) {
    const { remoteId, externalId } = await aui.threadListItem.initialize();
    await saveMessage({ remoteId, externalId, message });
  }

  return <button onClick={() => void save({ text: "Hello" })}>Save</button>;
}
```

Generate a title after a conversation contains useful context. A remote adapter's `generateTitle(remoteId, messages)` streams the title back to the runtime. The item runtime command starts that flow.

```tsx
import { useAui } from "@assistant-ui/react";

export function GenerateTitle({ threadId }: { threadId: string }) {
  const aui = useAui();
  const item = aui.threads.item({ id: threadId });
  return <button onClick={() => void item.generateTitle()}>Generate title</button>;
}
```

## Reload the List or Open Thread

`aui.threads.reload()` runs the adapter's `list()` again. Call it after asynchronous authentication resolves, after a filter that changes adapter visibility, or after an out of band metadata update. It discards stale responses from earlier reloads.

```tsx
import { useAui } from "@assistant-ui/react";
import { useEffect } from "react";

export function ReloadAfterAuth({
  isLoading,
  userId,
}: {
  isLoading: boolean;
  userId: string | undefined;
}) {
  const aui = useAui();

  useEffect(() => {
    if (!isLoading && userId) aui.threads.reload();
  }, [aui, isLoading, userId]);

  return null;
}
```

`aui.threads.reloadMainThread()` refreshes the selected thread when its server state changes without a stream update. Check `s.thread.capabilities.refetchThread` to learn whether the current thread supports an in place refetch. A false value does not mean `reloadMainThread()` cannot work: a remote list can remount the runtime instead.

```tsx
import { useAui, useAuiState } from "@assistant-ui/react";

export function RefreshCurrentThread() {
  const aui = useAui();
  const supportsInPlaceRefetch = useAuiState(
    (s) => s.thread.capabilities.refetchThread,
  );

  return (
    <button onClick={() => void aui.threads.reloadMainThread()}>
      {supportsInPlaceRefetch ? "Refresh" : "Reload"}
    </button>
  );
}
```

Avoid refreshing on a timer while a response is running. Drive it from the out of band event or skip it while `s.thread.isRunning` is true.

## Pagination

A `RemoteThreadListAdapter.list` call receives an optional `after` cursor. Return `nextCursor` with each page. The initial call has no `after`; each `aui.threads.loadMore()` call passes the previous `nextCursor` back as `after`.

```ts
async function listThreads({ after }: { after?: string } = {}) {
  const url = new URL("/api/threads", location.origin);
  if (after) url.searchParams.set("after", after);

  const response = await fetch(url);
  const { threads, nextCursor } = await response.json();

  return {
    threads: threads.map((thread: { id: string; archived: boolean; title?: string }) => ({
      remoteId: thread.id,
      status: thread.archived ? "archived" : "regular",
      title: thread.title,
    })),
    nextCursor,
  };
}
```

Use `hasMore` for a custom control or mount `ThreadListPrimitive.LoadMore`. The primitive disables itself while loading and when there is no next cursor.

```tsx
import { ThreadListPrimitive, useAui, useAuiState } from "@assistant-ui/react";

export function MoreThreads() {
  const aui = useAui();
  const hasMore = useAuiState((s) => s.threads.hasMore);

  return hasMore ? (
    <button onClick={() => void aui.threads.loadMore()}>Load more</button>
  ) : (
    <ThreadListPrimitive.LoadMore>Load more</ThreadListPrimitive.LoadMore>
  );
}
```

An empty string cursor is treated as no next page. Concurrent `loadMore()` calls for the same page are deduplicated. A failed page preserves its cursor and the next call retries it, so surface an application error if people need feedback.

## Custom Metadata

Return `custom` from a remote adapter's `list()` and `fetch()` results for application fields such as owner, project, labels, or a pinned flag. `custom` is preserved by rename, archive, unarchive, and title generation. Select it as the one stable object reference needed by the UI.

```tsx
import { useAui, useAuiState } from "@assistant-ui/react";

export function PinThread() {
  const aui = useAui();
  const id = useAuiState((s) => s.threadListItem.id);
  const custom = useAuiState((s) => s.threadListItem.custom);

  function togglePinned() {
    aui.threadListItem.updateCustom({
      ...custom,
      pinned: !custom?.["pinned"],
    });
  }

  return (
    <button onClick={togglePinned}>
      {custom?.["pinned"] ? "Unpin" : "Pin"} {id}
    </button>
  );
}
```

`updateCustom` replaces the entire metadata bag. Spread the existing value when changing one field, and implement `RemoteThreadListAdapter.updateCustom` to persist it. After a separate backend mutation, return the new values from `fetch()` or call `aui.threads.reload()`.
