# MessagePrimitive

Renders a single message: its content parts, attachments, quote, hover state, and error display. `Root` renders a `<div>` that provides message context and tracks hover (consumed by `ActionBarPrimitive` for auto hide, no extra wiring needed).

## Parts

| Part | Renders | Notes |
|------|---------|-------|
| `.Root` | `<div>` | Message container; sets `data-message-id`, tracks hover. |
| `.Parts` | list | The canonical parts renderer. `.Content` is a deprecated alias. |
| `.PartByIndex` | one part | `index` plus `components={{ Text, Image, ... }}`. |
| `.GroupedParts` | list | Adjacent grouping (chain of thought, tool groups). See [part-grouping.md](./part-grouping.md). |
| `.Unstable_PartsGrouped` / `.Unstable_PartsGroupedByParentId` | list | Non adjacent grouping, unstable. See [part-grouping.md](./part-grouping.md). |
| `.Attachments` | list | User message attachments, read only. Children render function `{ attachment }`. |
| `.AttachmentByIndex` | one attachment | `index` plus `components={{ Attachment }}`. |
| `.Quote` | conditional | Renders quote metadata when the message carries one. Place above `.Parts`. |
| `.Error` | conditional | Renders children only when the message has an error. |
| `.GenerativeUI` | generative UI | Renders the message's generative UI parts. |
| `.If` | conditional | Deprecated. Use `AuiIf`. |

## Part types

Which bucket a part falls into decides how it grows over time.

| Kind | Parts | Grows by |
|------|-------|----------|
| Modality | `text`, `image`, `file` | Never. `file` carries every non image binary modality through its `mimeType`; the payload is inline base64 or a URL. |
| Provider channel | `reasoning`, `source`, `tool-call`, `generative-ui` | Never. Each mirrors a channel the model already emits. |
| Extensibility | `data` | Freely, routed by `name`. This is the growth path for anything app level. |

`Unstable_AudioMessagePart` and the `Unstable_Audio` slot are deprecated: send audio as a `file` part with an `audio/*` mime type and a filename instead. Adapter coverage for the `file` path is uneven, check your runtime's converter before relying on it.

## Tool and data resolution

Inside the `children` render function, tool call and data parts expose resolved UI helpers directly:

```tsx
<MessagePrimitive.Parts>
  {({ part }) => {
    if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
    if (part.type === "data") return part.dataRendererUI ?? null;
    return null;
  }}
</MessagePrimitive.Parts>
```

`part.toolUI` and `part.dataRendererUI` resolve in this order: an inline `tools.Override` (deprecated `components` prop) wins over everything; then a toolkit's globally registered `render` (see [tools](../../tools/SKILL.md)); then a per `.Parts` `tools.by_name[toolName]` inline override; then `tools.Fallback`. Returning `null` from your `children` function still lets a registered UI render; return `<></>` to suppress it outright.

## MessagePartPrimitive

Inside a custom part component, these sub primitives read the current part's content:

| Part | Renders | Notes |
|------|---------|-------|
| `.Text` | text | `smooth` prop for a token by token reveal; `[data-status]` is `"running"`, `"complete"`, or `"incomplete"`. |
| `.Image` | `<img>` | Renders the current image part. |
| `.InProgress` | conditional | Renders children only while the current part is still streaming. |
| `.Messages` | nested list | Renders a nested message list carried by the current part (parts that embed sub messages, for example multi agent output). |

```tsx
function MyText() {
  return (
    <p className="whitespace-pre-wrap">
      <MessagePartPrimitive.Text />
      <MessagePartPrimitive.InProgress>
        <span className="animate-pulse">▊</span>
      </MessagePartPrimitive.InProgress>
    </p>
  );
}
```

## Attachments

`MessagePrimitive.Attachments` renders sent, read only attachments (composer side pending attachments are a different iterator: `ComposerPrimitive.Attachments`, see [composer-input.md](./composer-input.md)). `AttachmentPrimitive.Remove` throws `"Message attachments cannot be removed"` here; only render it inside a composer.

```tsx
<MessagePrimitive.Attachments>
  {({ attachment }) => {
    if (attachment.type === "image") {
      const imageSrc = attachment.content?.find((p) => p.type === "image")?.image;
      return imageSrc ? <img src={imageSrc} alt={attachment.name} className="max-w-xs rounded-lg" /> : null;
    }
    return <div className="rounded-lg border p-2 text-sm">{attachment.name}</div>;
  }}
</MessagePrimitive.Attachments>
```

## Patterns

### Custom text rendering

```tsx
function MarkdownText() {
  return (
    <div className="prose prose-sm">
      <MessagePartPrimitive.Text />
    </div>
  );
}

<MessagePrimitive.Parts>
  {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
</MessagePrimitive.Parts>
```

### Tool UI with by_name (deprecated components prop)

```tsx
<MessagePrimitive.Parts
  components={{
    tools: {
      by_name: {
        get_weather: ({ result }) => (
          <div className="rounded-lg border p-3">
            <p className="font-medium">Weather</p>
            <p>{result?.temperature}°F, {result?.condition}</p>
          </div>
        ),
      },
      Fallback: ({ toolName, status }) => (
        <div className="text-muted-foreground text-sm">
          {status.type === "running" ? `Running ${toolName}...` : `${toolName} completed`}
        </div>
      ),
    },
  }}
/>
```

New code should register a toolkit's `render` instead of an inline `by_name` map. See [tools](../../tools/SKILL.md).

### Error display

```tsx
import { ErrorPrimitive, MessagePrimitive } from "@assistant-ui/react";

<MessagePrimitive.Root>
  <MessagePrimitive.Parts />
  <ErrorPrimitive.Root className="mt-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive" role="alert">
    <ErrorPrimitive.Message />
  </ErrorPrimitive.Root>
</MessagePrimitive.Root>
```

`ErrorPrimitive.Root` always renders its `<div role="alert">`; `.Message` auto reads the error text from message state and returns `null` when there is none, or renders your `children` instead if you pass them. `MessagePrimitive.Error` is the simpler alternative: it renders `children` only when the message has an error, with no `role="alert"` and no automatic text.

### Render after the stream completes

Gate a follow up card, feedback prompt, or generated component on the assistant message having actually finished, so it never flickers through partial states:

```tsx
<AuiIf
  condition={(s) => s.message.role === "assistant" && s.message.status?.type === "complete"}
>
  <FollowUpCard />
</AuiIf>
```

`s.message.status` is a discriminated union (`running | requires-action | complete | incomplete`) defined only on assistant messages; the `role === "assistant"` guard keeps the predicate type safe.

### Role based styling

`MessagePrimitive.Root` sets `data-message-id` but not a role attribute. Set your own from the branch you already took in `ThreadPrimitive.Messages`:

```tsx
function UserMessage() {
  return (
    <MessagePrimitive.Root data-role="user" className="flex justify-end">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}
```

## Common Gotchas

**A part type renders nothing**
- `MessagePrimitive.Parts` with no `children` falls back to sensible defaults (`text` as a `<p>`, `image` via `MessagePartPrimitive.Image`); reasoning, source, file, audio, and unregistered tool or data parts render nothing. Add a case for every part type your backend can produce.

**`GenerativeUI` and `.Parts` seem to double render**
- `MessagePrimitive.GenerativeUI` is a dedicated primitive for generative UI parts, a sibling to `.Parts` and `.Attachments` rather than a slot inside the deprecated `components` map. Render it alongside `.Parts` (or return it from the `generative-ui` case in your `children` function), not both a custom case and the standalone primitive for the same parts.

**`ActionBarPrimitive` or `BranchPickerPrimitive` throws "must be used within..."**
- Both read state from the nearest `MessagePrimitive.Root`. Render them inside your message component, not beside it.

**Audio never renders**
- `Unstable_AudioMessagePart` is deprecated and user only. Send and render audio as a `file` part with an `audio/*` `mimeType` instead.
