# Terminal adapters

Adapters change storage and runtime behavior while preserving the same terminal primitives. Start with `useLocalRuntime` for a single in memory thread, then add the smallest persistence layer that meets the product requirement.

## Local file storage

`createFileStorageAdapter` returns a `RemoteThreadListAdapter` that writes each thread and its messages as JSON files. Pass it to `useRemoteThreadListRuntime` and keep a local runtime per selected thread.

```tsx
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createFileStorageAdapter,
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react-ink";

const threadListAdapter = createFileStorageAdapter({
  dir: join(homedir(), ".my-terminal-app", "threads"),
});

export function useAppRuntime() {
  return useRemoteThreadListRuntime({
    runtimeHook: () => useLocalRuntime(chatAdapter),
    adapter: threadListAdapter,
  });
}
```

`dir` is created on first write. `prefix` separates applications that share the directory. `titleGenerator` may receive `createSimpleTitleAdapter()`, which derives a title from the first user message and truncates it to 50 characters. Writes use a temporary file plus rename, so one process crash does not leave partial JSON.

This adapter targets one user and one CLI process. Its thread list read modify write cycle is not lock safe across two processes. Use a backend owned `RemoteThreadListAdapter` when concurrent processes must preserve every metadata update.

## Attachments

`SimpleTextAttachmentAdapter` serializes text attachments to model content as named attachment tags. `SimpleImageAttachmentAdapter` serializes images as base64 data URLs. `CompositeAttachmentAdapter` tries a sequence of adapters, which is the normal setup when both forms are accepted.

```tsx
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useLocalRuntime,
} from "@assistant-ui/react-ink";

const runtime = useLocalRuntime(chatAdapter, {
  adapters: {
    attachments: new CompositeAttachmentAdapter([
      new SimpleTextAttachmentAdapter(),
      new SimpleImageAttachmentAdapter(),
    ]),
  },
});
```

Render attachment state with `ComposerPrimitive.Attachments`, `MessagePrimitive.Attachments`, and `AttachmentPrimitive`. The adapter decides what reaches the model. The primitive decides what the terminal displays.

## Titles and custom adapters

`TitleGenerationAdapter` has `generateTitle(messages)` and is used by file storage. `createSimpleTitleAdapter` is the built in implementation. A backend owned `RemoteThreadListAdapter` instead implements `generateTitle(remoteId, unstable_messages)` and returns an assistant stream.

The `useLocalRuntime` adapter options also accept `history`, `feedback`, `suggestion`, `speech`, `dictation`, and cloud adapters. These contracts are shared with other assistant-ui renderers. Add an adapter only when its runtime feature is actually enabled.

## Select the persistence boundary

- `useLocalRuntime(chatAdapter)`: inference through your endpoint, threads and messages disappear on exit.
- `createFileStorageAdapter`: inference through your endpoint, local threads and messages survive exit, one process only.
- `RemoteThreadListAdapter`: backend owns thread metadata and can coordinate sessions or users. Add a history adapter when backend message history is also required.

See [custom backend](./custom-backend.md) for the remote adapter method contract.
