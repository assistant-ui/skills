# React Native adapters

Adapters customize the behavior of `useLocalRuntime` and `useRemoteThreadListRuntime`. Choose the narrowest adapter that gives the needed persistence or platform capability. A local runtime keeps threads and messages in memory unless an adapter or cloud integration persists them.

## Local runtime adapters

`useLocalRuntime` accepts adapters for history, attachments, feedback, suggestions, speech, and dictation.

```tsx
import { useLocalRuntime } from "@assistant-ui/react-native";

const runtime = useLocalRuntime(chatModel, {
  adapters: {
    history: historyAdapter,
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
    suggestion: suggestionAdapter,
  },
});
```

`AttachmentAdapter` handles uploads and conversion of user-selected files. `SimpleImageAttachmentAdapter`, `SimpleTextAttachmentAdapter`, and `CompositeAttachmentAdapter` are packaged helpers. Use a custom attachment adapter when the backend requires signed uploads, a private file store, or a distinct multimodal message shape.

`ThreadHistoryAdapter` persists a thread message tree. `FeedbackAdapter` records positive and negative feedback. `SuggestionAdapter` generates or supplies prompts. A speech or dictation adapter handles device voice features. These all belong under `adapters` on the local runtime.

```tsx
import type {
  ThreadHistoryAdapter,
} from "@assistant-ui/react-native";

const history: ThreadHistoryAdapter = {
  async load() {
    return await loadThreadHistory();
  },
  async append(item) {
    await saveThreadHistoryItem(item);
  },
};
```

Verify the exact adapter contract required by the selected runtime. The AI SDK runtime history adapter uses `withFormat` so UI messages can round-trip. A custom `useLocalRuntime` history adapter follows its own core adapter contract.

## Thread persistence choices

Use `useLocalRuntime` alone for local threads and in-memory messages. Add a history adapter when the app needs to restore messages. Use a cloud integration when it owns persistence and generated titles. Use `useRemoteThreadListRuntime` with a `RemoteThreadListAdapter` when your backend owns thread creation, titles, archive state, and cross-device visibility.

```tsx
import {
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react-native";

const runtime = useRemoteThreadListRuntime({
  runtimeHook: () => useLocalRuntime(chatModel, { adapters: { history } }),
  adapter: remoteThreads,
});
```

`InMemoryThreadListAdapter` is exported for an in-memory list. It is useful for local development and test flows, not for cross-device state.

## Remote thread list adapter

`RemoteThreadListAdapter` is the adapter type for a backend thread list. Its methods map user actions to your server API.

| Method | Responsibility |
|---|---|
| `list()` | return available thread metadata |
| `initialize(localId)` | create a remote thread and return its `remoteId` |
| `fetch(remoteId)` | load one thread metadata record |
| `rename(remoteId, title)` | persist a title |
| `archive(remoteId)` | archive a thread |
| `unarchive(remoteId)` | restore an archived thread |
| `delete(remoteId)` | permanently remove a thread |
| `generateTitle(remoteId, unstable_messages)` | return an `AssistantStream` that produces a title |

Use `status: "regular"` or `status: "archived"` in returned thread metadata. Keep message persistence separate. A remote thread list alone does not persist per-thread messages; compose a suitable history adapter when the backend owns those too.

See [custom backend](./custom-backend.md) for a complete remote-list shape and the corresponding runtime composition.
