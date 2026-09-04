# Cloud Persistence

The full `assistant-cloud` client API for threads, messages, files, and runs, verified against `src/cloud/**`. For the constructor and auth modes, see [authorization.md](./authorization.md). For a custom `ThreadHistoryAdapter` that uses Cloud only for message storage, see [custom-persistence.md](./custom-persistence.md).

## Contents

- [Thread API](#thread-api)
- [Message API](#message-api)
- [Message format](#message-format)
- [Auto-save behavior](#auto-save-behavior)
- [File uploads](#file-uploads)
- [Project-wide listing](#project-wide-listing)
- [Auth tokens](#auth-tokens)
- [Run telemetry](#run-telemetry)
- [Error handling](#error-handling)

## Thread API

Paging is cursor based: `after` is the `id` of the last thread from the previous page, not an offset.

```ts
const { threads } = await cloud.threads.list({
  is_archived: false, // omit for both archived and regular
  limit: 50,
  after: cursor,
});

const thread = await cloud.threads.get(threadId);

const { thread_id } = await cloud.threads.create({
  last_message_at: new Date(), // required
  title: "New chat", // optional
  external_id: "custom-id-123", // optional, for mapping to your own system
  metadata: { source: "web" }, // optional, arbitrary JSON
});

await cloud.threads.update(threadId, {
  title: "Updated title",
  is_archived: true,
  metadata: { priority: "high" },
});

await cloud.threads.delete(threadId);
```

`CloudThread` fields: `id`, `title` (empty string when unset, never `null`), `last_message_at`, `created_at`, `updated_at`, `is_archived`, `external_id` (`string | null`), `metadata` (`unknown`, whatever you stored), `project_id`, `workspace_id`. `title`, `last_message_at`, `metadata`, and `is_archived` are all optional on `update`; nothing is required.

## Message API

`messages` is a property on `cloud.threads`; every method takes `threadId` as its first argument.

```ts
const { messages } = await cloud.threads.messages.list(threadId, {
  format: "ai-sdk/v6", // optional filter; omit to get every format
});

const { message_id } = await cloud.threads.messages.create(threadId, {
  parent_id: null, // or the parent message's id, for branching; required (pass null explicitly)
  format: "ai-sdk/v6", // required
  content: { role: "user", parts: [{ type: "text", text: "Hello" }] }, // required
});

await cloud.threads.messages.update(threadId, messageId, {
  content: { role: "user", parts: [{ type: "text", text: "Edited" }] }, // the only field update accepts
});

const { feedback_id, type } = await cloud.threads.messages.feedback(threadId, messageId, {
  type: "positive", // or "negative"
});
```

`list` accepts only `{ format? }`; there is no `limit`/`after` paging on the per-thread message endpoint (see [Project-wide listing](#project-wide-listing) for the paginated variant). `CloudMessage` fields: `id`, `parent_id` (`string | null`), `height`, `format`, `content`, `created_at`, `updated_at`.

## Message format

`format` and `content` are opaque to the client; the server stores whatever JSON you send and returns it unchanged. The type signature is `format: "aui/v0" | string`, but in current code the well-known value is `"ai-sdk/v6"`: `useChatRuntime`, `AISDKThreads`, and the standalone `useCloudChat` all write `format: "ai-sdk/v6"` with `content` shaped as an AI SDK `UIMessage` (`{ role, parts }`). That format string names the stored message shape, not the installed AI SDK package major version; it does not change on an AI SDK upgrade. Only a runtime that recognizes a given `format` can decode its `content` back into a message, so pick your own format string (and keep decoding it consistently) if you call `messages.create` directly instead of going through a runtime.

## Auto-save behavior

With `cloud` passed to a runtime:

1. The first user message creates the cloud thread (there is no thread row until then).
2. Every new message is persisted as it completes; `update` is used to finalize a message that streamed in parts or was held for tool-approval.
3. A title is generated from the conversation after the assistant's first response and written back with `cloud.threads.update`.
4. Message branching (edits and regenerations) is preserved through the `parent_id` chain.

## File uploads

```ts
const { signedUrl, publicUrl, expiresAt } = await cloud.files.generatePresignedUploadUrl({
  filename: "document.pdf",
});
await fetch(signedUrl, { method: "PUT", body: file });
// publicUrl is what you store on the message content; expiresAt bounds signedUrl's validity

const { urls, message } = await cloud.files.pdfToImages({
  file_url: publicUrl, // or file_blob: base64 string
});
```

`@assistant-ui/react` exports `CloudFileAttachmentAdapter`, a built-in `AttachmentAdapter` that wraps this presign-and-PUT flow so large files do not need to be inlined as data URLs; pass it through `adapters.attachments` on `useChatRuntime`. For attachment adapters backed by your own object storage instead of Cloud, see the [custom attachment uploads guide](https://www.assistant-ui.com/docs/integrations/attachments/custom-adapter), which the same presign-then-PUT shape follows against S3, R2, or GCS.

## Project-wide listing

`cloud.projects.threads` lists across the whole project rather than one workspace; typically used server-side with API key auth for admin views. Unlike `cloud.threads.messages.list`, its message list supports cursor paging.

```ts
const { threads } = await cloud.projects.threads.list({ is_archived: false, limit: 50, after: cursor });
const { messages } = await cloud.projects.threads.messages.list(threadId, { format: "ai-sdk/v6", limit: 50, after: cursor });
```

## Auth tokens

`cloud.auth.tokens.create()` mints a short-lived JWT from an API-key-mode client; call it server-side and return the token from an endpoint your frontend's `authToken` callback fetches. See [authorization.md](./authorization.md#api-key-and-backend-server-mode) for the full pairing pattern.

```ts
const { token } = await cloud.auth.tokens.create();
```

## Run telemetry

The runtime reports run metadata to `cloud.runs.report` automatically after each assistant message (status, step count, tool calls, token usage; never message content). Disable it with `telemetry: false` on the constructor, or enrich and filter reports with `beforeReport`:

```ts
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  anonymous: true,
  telemetry: {
    beforeReport: (report) => ({ ...report, metadata: { environment: "production" } }),
  },
});
```

Return `null` from `beforeReport` to skip a specific run. Model id and token usage require a `messageMetadata` callback on the AI SDK route (`usage: part.totalUsage` on `"finish"`, `modelId: part.response.modelId` on `"finish-step"`); without it those fields are omitted. For a multi-agent setup where a tool call delegates to another model, `assistant-cloud` also exports `wrapSamplingHandler` and `createSamplingCollector` to capture nested MCP sampling calls for that tool's `sampling_calls`. Separately, it exports the lower-level report-building helpers `createRunTelemetryToolCall` (assembles one `tool_calls` entry, summarizing an MCP result's inline base64 payloads), `normalizeRunTelemetryUsage` (resolves token counts across AI SDK v6 and v7 usage shapes), and `truncateRunTelemetryText` (the 50,000-character clamp applied to any report text field). `AssistantCloudRunReport`'s fields: `thread_id`, `status` (`"completed" | "incomplete" | "error"`), `total_steps`, `tool_calls`, `steps` (per-step timing and usage), `input_tokens`, `output_tokens`, `reasoning_tokens`, `cached_input_tokens`, `model_id`, `provider_type`, `duration_ms`, `output_text`, `metadata`. Full guide with the route-side `messageMetadata` wiring and sub-agent tracking: [assistant-ui.com/docs/cloud/ai-sdk](https://www.assistant-ui.com/docs/cloud/ai-sdk#telemetry).

## Error handling

```ts
import { CloudAPIError } from "assistant-cloud";

try {
  const { threads } = await cloud.threads.list();
} catch (error) {
  if (error instanceof CloudAPIError && error.status === 401) {
    // auth expired or authToken returned an invalid token; refresh and retry
  } else if (error instanceof CloudAPIError && error.status === 429) {
    // rate limited
  }
}
```

`CloudAPIError` (with a `.status` number) covers non-2xx responses; `CloudResponseError` covers a 2xx response whose body does not match the expected shape (both from `assistant-cloud`). A third case is a plain `Error("Authorization failed")`, thrown before any request goes out when `authToken` resolves to a falsy value; it is not a `CloudAPIError`, so a bare `error.status` check on it is `undefined`.
