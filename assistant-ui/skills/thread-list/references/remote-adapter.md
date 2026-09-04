# Remote and External Thread Adapters

Use a `RemoteThreadListAdapter` when a LocalRuntime based runtime should store thread metadata in the application's backend. Use `ExternalStoreThreadListAdapter` only when an ExternalStoreRuntime already owns thread and message state.

## Contents

- [Remote adapter contract](#remote-adapter-contract)
- [Store entry and background threads](#store-entry-and-background-threads)
- [History adapter faces](#history-adapter-faces)
- [Initialize before writing](#initialize-before-writing)
- [Reload after authentication](#reload-after-authentication)
- [External store adapter](#external-store-adapter)

## Remote Adapter Contract

Keep the adapter reference stable at module scope or with `useMemo`. Replacing it reloads the list and discards cached threads not present in the replacement page.

| Member | Required | Contract |
| --- | --- | --- |
| `list` | Yes | `(params?: { after?: string }) => Promise<{ threads: RemoteThreadMetadata[]; nextCursor?: string }>`. Each row needs `status` and `remoteId`. `title`, `externalId`, and `custom` are optional. |
| `initialize` | Yes | `(localId: string) => Promise<{ remoteId: string; externalId?: string }>`. Creates the remote record and returns its canonical identities. |
| `rename` | Yes | `(remoteId: string, title: string) => Promise<void>`. Persists an item title. |
| `updateCustom` | No | `(remoteId: string, custom: Record<string, unknown> \| undefined) => Promise<void>`. Persists replacement custom metadata. |
| `archive` | Yes | `(remoteId: string) => Promise<void>`. Archives a thread. |
| `unarchive` | Yes | `(remoteId: string) => Promise<void>`. Restores an archived thread. |
| `delete` | Yes | `(remoteId: string) => Promise<void>`. Permanently removes a thread. |
| `fetch` | Yes | `(threadId: string) => Promise<RemoteThreadMetadata>`. Fetches item metadata when switching. |
| `generateTitle` | Yes | `(remoteId: string, messages: readonly ThreadMessage[]) => Promise<AssistantStream>`. Streams a generated title. |
| `unstable_Provider` | No | `RemoteThreadListProviderComponent`. React component face for thread scoped runtime adapters. |
| `unstable_useAdapters` | No | `() => RuntimeAdapters \| null \| undefined`. Hook face for thread scoped runtime adapters. |

`list()` receives no `after` for its first page. Return `nextCursor` to enable `aui.threads.loadMore()`. `fetch()` and `list()` should return updated `custom` fields when another backend path changes metadata.

## Store Entry and Background Threads

Use `RemoteThreadList` as the `threads` entry in `AuiConfig` hosts. Wrap the thread factory with `withKey` from `@assistant-ui/tap`. History adapters load once per mount, so an unkeyed factory retains the previous thread's messages after a switch.

```tsx
import { AuiConfig, RemoteThreadList } from "@assistant-ui/react";
import { withKey } from "@assistant-ui/tap";

const config = AuiConfig({
  threads: RemoteThreadList({
    adapter,
    thread: (id) => withKey(id, MyThread({ threadId: id })),
    backgroundThreads: true,
  }),
});
```

With `backgroundThreads: true`, every visited thread remains mounted. Its run can continue across a selection change, each item retains live `isRunning` state, and a newly initialized thread can title itself. This trades memory for continuity. Without it, only the visible thread is mounted.

## History Adapter Faces

`RemoteThreadListAdapter` owns metadata, not messages or attachments. Add per thread adapters through one of two mutually related faces.

| Face | Who calls it | When to use it |
| --- | --- | --- |
| `unstable_useAdapters` | `RemoteThreadList` store entry, and `useRemoteThreadListRuntime` when `unstable_Provider` is omitted | A hook can provide history, attachments, or other runtime adapters in a client tree |
| `unstable_Provider` | `useRemoteThreadListRuntime` only | A React wrapper needs to provide adapters around the active thread |

The store entry ignores `unstable_Provider`. A provider must render `children` synchronously on its first commit. Do not place children behind loading state, Suspense, or an effect.

```tsx
import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
} from "@assistant-ui/react";
import { useMemo } from "react";

function useThreadAdapters() {
  const aui = useAui();
  const history = useMemo(
    () => ({
      async load() {
        const { remoteId } = aui.threadListItem.getState();
        if (!remoteId) return { messages: [] };
        return loadMessages(remoteId);
      },
      async append({ message, parentId }: { message: unknown; parentId?: string }) {
        const { remoteId } = await aui.threadListItem.initialize();
        await saveMessage(remoteId, parentId, message);
      },
    }),
    [aui],
  );

  return useMemo(() => ({ history }), [history]);
}

const adapter = {
  ...metadataAdapter,
  unstable_useAdapters: useThreadAdapters,
  unstable_Provider({ children }) {
    const adapters = useThreadAdapters();
    return <RuntimeAdapterProvider adapters={adapters}>{children}</RuntimeAdapterProvider>;
  },
} satisfies RemoteThreadListAdapter;
```

Share the hook between both faces only when the React runtime path also needs the provider. When `unstable_Provider` is absent, `useRemoteThreadListRuntime` uses `unstable_useAdapters` itself.

## Initialize Before Writing

The first message can be dispatched before the backend record exists. Await `aui.threadListItem.initialize()` in a history adapter, external dispatcher, or backend writer that requires a remote identity. The runtime intentionally does not delay the visible message until initialization completes.

```ts
async function append(message: unknown, parentId: string | undefined) {
  const { remoteId } = await aui.threadListItem.initialize();
  await saveMessage(remoteId, parentId, message);
}

async function onNew(message: unknown) {
  const { remoteId } = await aui.threadListItem.initialize();
  await sendToBackend(remoteId, message);
}
```

Repeated `initialize()` calls for the active thread resolve to the same `remoteId`.

## Reload After Authentication

An adapter whose `list()` uses an OIDC, NextAuth, Clerk, or better-auth identity may run before that identity resolves. Reload when authentication becomes ready. Recreated adapters on a `RemoteThreadList` store entry do nothing until this call.

```tsx
import { useAui } from "@assistant-ui/react";
import { useEffect } from "react";

export function ReloadThreadsAfterAuth({
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

`reload()` against the same adapter refreshes metadata and keeps the open thread. A different adapter resets selection and cached records before loading its page. It ignores in flight results from superseded calls.

## External Store Adapter

`ExternalStoreThreadListAdapter` is synchronous and inline. It is not a remote adapter replacement. The application keeps metadata, selected ID, and messages in one external store, then gives the runtime functions that update that store.

```tsx
import {
  type ExternalStoreThreadListAdapter,
  useExternalStoreRuntime,
} from "@assistant-ui/react";

const threadListAdapter: ExternalStoreThreadListAdapter = {
  threadId: store.selectedThreadId,
  threads: store.threads.filter((thread) => thread.status === "regular"),
  archivedThreads: store.threads.filter((thread) => thread.status === "archived"),
  onSwitchToNewThread: store.createAndSelectThread,
  onSwitchToThread: store.selectThread,
  onRename: store.renameThread,
  onArchive: store.archiveThread,
  onUnarchive: store.unarchiveThread,
  onDelete: store.deleteThread,
};

const runtime = useExternalStoreRuntime({
  messages: store.messagesByThread.get(store.selectedThreadId) ?? [],
  setMessages: (messages) => store.setMessages(store.selectedThreadId, messages),
  onNew: store.sendMessage,
  adapters: { threadList: threadListAdapter },
});
```

Keep `threadId` and the external store's selected ID synchronized. If they diverge, messages can appear under the wrong conversation or disappear from the active view. Centralize selection in the store or a shared context, not component local state.
