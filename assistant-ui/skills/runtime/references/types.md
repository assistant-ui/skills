# Runtime Types

Core type definitions for the assistant-ui runtime system, exported from `@assistant-ui/react` (most are re-exported from `@assistant-ui/core`, where the runtime-agnostic definitions live).

## Message types

```typescript
type ThreadMessage = ThreadUserMessage | ThreadAssistantMessage | ThreadSystemMessage;

interface ThreadUserMessage {
  id: string;
  role: "user";
  content: readonly MessagePart[];
  attachments?: readonly Attachment[];
  createdAt: Date;
}

interface ThreadAssistantMessage {
  id: string;
  role: "assistant";
  content: readonly MessagePart[];
  status: MessageStatus;
  createdAt: Date;
}

interface ThreadSystemMessage {
  id: string;
  role: "system";
  content: readonly MessagePart[];
  createdAt: Date;
}
```

A history adapter, `ThreadMessageLike`, or an `ExternalStoreRuntime` deals in a looser shape (`content` can be a plain string, `id` and `createdAt` are optional); see [local-runtime.md](./local-runtime.md) and [external-store.md](./external-store.md).

## Message status

`status` is an object with a `type` discriminator, never a bare string.

```typescript
type MessageStatus =
  | { type: "running" }
  | { type: "requires-action"; reason: "tool-calls" | "interrupt" }
  | { type: "complete"; reason: "stop" | "unknown" }
  | {
      type: "incomplete";
      reason: "cancelled" | "tool-calls" | "length" | "content-filter" | "other" | "error";
      error?: unknown;
    };
```

A text or reasoning part reports `status.type === "running"` only while it is the last part of the message; every earlier part is already complete. Tool-call parts are exempt, their status comes from whether they have a result.

## Message parts

```typescript
type MessagePart = TextPart | ImagePart | ToolCallPart | ReasoningPart | SourcePart | FilePart | DataMessagePart;

interface TextPart {
  type: "text";
  text: string;
}

interface ImagePart {
  type: "image";
  image: string;
}

interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: unknown;
  argsText: string;
  result?: unknown;
  isError?: boolean;
  artifact?: unknown;
  approval?: { id: string; approved?: boolean; reason?: string }; // server-side approval gate
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
}

interface SourcePart {
  type: "source";
  sourceType: "url";
  id: string;
  url: string;
  title?: string;
}

interface FilePart {
  type: "file";
  filename?: string;
  data: string;
  mimeType: string;
}

// A ThreadMessageLike content entry with a "data-" prefixed type converts to this automatically
interface DataMessagePart {
  type: `data-${string}`;
  data: unknown;
}
```

An `approval` with no `approved` field is pending (the run is paused, waiting for the user); `approved: true` means allow, `approved: false` means deny. See the tool-calling sections of [local-runtime.md](./local-runtime.md) and [external-store.md](./external-store.md).

## Attachment types

```typescript
interface Attachment {
  id: string;
  type: "image" | "document" | "file" | (string & {}); // custom strings beyond the three are accepted
  name: string;
  contentType?: string;
  file?: File;
  content?: readonly AttachmentContent[];
  status: { type: "running" | "requires-action" | "complete"; reason?: string; progress?: number };
}

type PendingAttachment = Attachment & { status: { type: "running" | "requires-action"; reason?: string; progress?: number } };
type CompleteAttachment = Attachment & { status: { type: "complete" }; content: readonly AttachmentContent[] };

type AttachmentContent = { type: "text"; text: string } | { type: "image"; image: string } | { type: "file"; data: string; mimeType: string; filename?: string };
```

`add()` in an `AttachmentAdapter` returns a `PendingAttachment` (`status.type` is `"requires-action"`, or `"running"` with an optional `progress` while an async generator streams upload progress); `send()` returns a `CompleteAttachment` carrying the final `content`. See [adapters.md](./adapters.md).

## RuntimeCapabilities

```typescript
// from "@assistant-ui/core"
interface RuntimeCapabilities {
  switchToBranch: boolean;
  switchBranchDuringRun: boolean;
  edit: boolean;
  reload: boolean;
  delete: boolean;
  cancel: boolean;
  refetchThread: boolean;
  unstable_copy: boolean;
  speech: boolean;
  dictation: boolean;
  voice: boolean;
  attachments: boolean;
  feedback: boolean;
  queue: boolean;
}
```

Read the resolved set with `useAuiState((s) => s.thread.capabilities)`. Field names are `unstable_copy` and `speech`, not `copy` and `speak`. Runtimes derive nearly every field from what you supply (a callback on `ExternalStoreRuntime`, an adapter); `unstable_copy` is the one flag `ExternalStoreRuntime` lets you force off via `unstable_capabilities: { copy: false }`, and `switchBranchDuringRun` is always `false`. `refetchThread` reports whether `aui.threads.reloadMainThread()` refreshes the open thread in place; see [runtime-concepts.md](./runtime-concepts.md).

## Thread list item state

```typescript
interface ThreadListItemState {
  id: string;
  title?: string;
  status: "archived" | "regular" | "new" | "deleted";
  remoteId?: string;
  externalId?: string;
  custom?: Record<string, unknown>; // arbitrary per-thread metadata set by remote runtimes
}
```

## ChatModelRunResult and ChatModelRunOptions

Used by a `LocalRuntime` `ChatModelAdapter.run`, returned once or yielded repeatedly while streaming. All fields are optional; yield the full cumulative content each time, not a delta.

```typescript
interface ChatModelRunResult {
  content?: readonly MessagePart[];
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
}

async function* run({ messages }: ChatModelRunOptions) {
  yield { content: [{ type: "text", text: "Hello " }] };
  yield { content: [{ type: "text", text: "Hello world!" }] };
}
```

See [local-runtime.md](./local-runtime.md) for the full `ChatModelAdapter` and `ChatModelRunOptions` reference.

## Related

- [state-hooks.md](./state-hooks.md) -- the live reactive `s.thread`, `s.message`, and `s.composer` shapes these types compose into
- [adapters.md](./adapters.md) -- `AttachmentAdapter`, `SpeechSynthesisAdapter`, `DictationAdapter`, `FeedbackAdapter` contracts
- [../../tools/SKILL.md](../../tools/SKILL.md) -- `ToolCallMessagePartProps` and the tool rendering type surface
