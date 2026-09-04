# Custom Persistence on Cloud Message Storage

`useChatRuntime({ cloud })` and `AISDKThreads({ cloud })` own both thread metadata and message storage for you. Reach for this page when you want to keep thread metadata in your own database (a different `RemoteThreadListAdapter`, extra columns, your own ownership rules) while still storing message content in Assistant Cloud instead of writing a messages table yourself. `assistant-cloud` exports the two primitives that make that split possible: `CloudMessagePersistence` and `createFormattedPersistence`.

## Contents

- [CloudMessagePersistence](#cloudmessagepersistence)
- [createFormattedPersistence](#createformattedpersistence)
- [Wiring into a ThreadHistoryAdapter](#wiring-into-a-threadhistoryadapter)
- [Thread metadata](#thread-metadata)

## CloudMessagePersistence

Handles local-to-remote id mapping and `parent_id` chaining against `cloud.threads.messages`. It is the same class the built-in cloud runtime and `useCloudChat` use internally; importing it gives a third caller the same guarantees.

```ts
import { CloudMessagePersistence } from "assistant-cloud";

const persistence = new CloudMessagePersistence(cloud); // or () => cloud, for a lazily created client
```

| Method | Behavior |
|--------|----------|
| `append(threadId, messageId, parentId, format, content)` | Creates the message remotely. Concurrent calls for the same local `messageId` share one in-flight request. When `parentId` is still pending, it awaits that parent's remote id first, so branches created out of order still chain correctly. |
| `update(threadId, messageId, format, content)` | Updates an already-persisted message. Logs a warning and returns without throwing if `messageId` has no remote id mapped yet. |
| `isPersisted(messageId)` | `true` once a message has been appended or loaded, even while the remote write is still in flight. |
| `getRemoteId(messageId)` | Resolves the remote id for a local id, or `undefined` if it was never persisted. |
| `load(threadId, format?)` | Fetches `cloud.threads.messages.list(threadId, ...)`, seeds the id mapping so `isPersisted` recognizes every loaded message, and returns the raw `CloudMessage[]`. |
| `reset()` | Clears the id mapping. Call it when switching to a different thread on a persistence instance you reuse across threads. |

## createFormattedPersistence

Wraps a `CloudMessagePersistence`-shaped object (anything with `append`/`load`/`isPersisted`, plus an optional `update`) with a `MessageFormatAdapter` so callers work with `{ parentId, message }` items and a message type, not raw `content` JSON.

```ts
import { createFormattedPersistence } from "assistant-cloud";

const formatted = createFormattedPersistence(persistence, fmt);
// formatted.append(threadId, { parentId, message })
// formatted.update(threadId, { parentId, message }, messageId) (present only when persistence.update exists)
// formatted.load(threadId) -> { messages: [{ parentId, message }, ...] }, oldest first
// formatted.isPersisted(messageId)
```

`fmt` is a `MessageFormatAdapter<TMessage, TStorageFormat>` (`format`, `encode`, `decode`, `getId`); `@assistant-ui/react`'s type of the same name is structurally identical, so either import satisfies the parameter. You do not construct `fmt` yourself: it is the argument a runtime passes into `ThreadHistoryAdapter.withFormat(fmt)` when it calls your adapter, already bound to that runtime's wire format (for example AI SDK's `"ai-sdk/v6"`).

## Wiring into a ThreadHistoryAdapter

`createFormattedPersistence`'s `append`/`update`/`load` all take `threadId` explicitly, one layer below the per-thread shape `withFormat` must return. Close over the active thread's remote id the same way the database-backed guide does, through `aui.threadListItem`:

```tsx
"use client";

import { RuntimeAdapterProvider, useAui, type ThreadHistoryAdapter } from "@assistant-ui/react";
import { CloudMessagePersistence, createFormattedPersistence, type AssistantCloud } from "assistant-cloud";
import { useMemo } from "react";

function useCloudHistoryAdapter(cloud: AssistantCloud) {
  const persistence = useMemo(() => new CloudMessagePersistence(cloud), [cloud]);
  const aui = useAui();

  return useMemo<ThreadHistoryAdapter>(
    () => ({
      async load() {
        return { messages: [] };
      },
      async append() {},
      withFormat: (fmt) => {
        const formatted = createFormattedPersistence(persistence, fmt);
        return {
          async load() {
            const { remoteId } = aui.threadListItem.getState();
            if (!remoteId) return { messages: [] };
            return formatted.load(remoteId);
          },
          async append(item) {
            const { remoteId } = await aui.threadListItem.initialize();
            return formatted.append(remoteId, item);
          },
          async update(item, messageId) {
            const { remoteId } = await aui.threadListItem.initialize();
            return formatted.update?.(remoteId, item, messageId);
          },
          isPersisted: formatted.isPersisted,
        };
      },
    }),
    [persistence, aui],
  );
}

export function ThreadListProvider({
  cloud,
  children,
}: {
  cloud: AssistantCloud;
  children: React.ReactNode;
}) {
  const history = useCloudHistoryAdapter(cloud);
  return <RuntimeAdapterProvider adapters={{ history }}>{children}</RuntimeAdapterProvider>;
}
```

The top-level `load`/`append` on the adapter are required by the `ThreadHistoryAdapter` type but unused on the AI SDK code path; `useChatRuntime` always calls `history.withFormat(fmt)` instead. `update` is opt-in on the runtime side too: implementing it lets a message paused for tool approval persist before the run finishes, matching the DB-backed adapter's `update` support.

## Thread metadata

This page only replaces message storage. Thread metadata (list, create, rename, archive, delete) is a separate `RemoteThreadListAdapter` you still own, with `unstable_Provider` (or `unstable_useAdapters`) mounting the history adapter above for the active thread. For the full `RemoteThreadListAdapter` contract, `withKey`, and background-thread mounting, see [../../thread-list/SKILL.md](../../thread-list/SKILL.md). For the general `ThreadHistoryAdapter`/`MessageFormatAdapter` contract this page builds on, see [../../runtime/SKILL.md](../../runtime/SKILL.md).
