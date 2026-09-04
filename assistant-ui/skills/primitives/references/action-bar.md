# ActionBarPrimitive

Message actions: copy, reload, edit, feedback, speech, export. Handles auto hide on hover, automatic disabling per action, and floating behavior. `Root` renders a `<div>`; every action renders a `<button>`. Must render inside `MessagePrimitive.Root`, which it reads message state from.

## Parts

| Part | Notes |
|------|-------|
| `.Root` | `hideWhenRunning`, `autohide` (`"never"` default, `"not-last"`, `"always"`), `autohideFloat` (`"never"` default, `"always"`, `"single-branch"`). |
| `.Copy` | Disabled with no copyable text, or while an assistant message is still running. `copiedDuration` (default `3000`ms) controls how long `data-copied` stays set. |
| `.Reload` | Disabled while the thread is running or disabled, or the message is not from the assistant. Creates a new branch. |
| `.Edit` | Disabled while already editing. Calls `aui.composer.beginEdit()`. |
| `.Speak` / `.StopSpeaking` | Disabled with no speakable text, or while running. Requires a `SpeechSynthesisAdapter`. |
| `.FeedbackPositive` / `.FeedbackNegative` | `data-submitted` once `s.message.metadata.submittedFeedback` matches. Requires a `feedback` adapter. |
| `.ExportMarkdown` | Downloads Markdown, or calls a custom `onExport` handler. |

## Auto hide and floating

```tsx
<ActionBarPrimitive.Root
  hideWhenRunning
  autohide="not-last"
  autohideFloat="always"
  className="data-[floating]:opacity-0 data-[floating]:group-hover:opacity-100 data-[floating]:transition-opacity"
>
  <ActionBarPrimitive.Copy>Copy</ActionBarPrimitive.Copy>
  <ActionBarPrimitive.Reload>Regenerate</ActionBarPrimitive.Reload>
</ActionBarPrimitive.Root>
```

`autohide="not-last"` hides the bar on every message except the last, revealed on hover (the hover state `MessagePrimitive.Root` tracks automatically); `"always"` hides on every message. When `autohideFloat` is set, a hidden bar keeps rendering with a `data-floating` attribute instead of leaving the DOM, so you can animate it in with CSS rather than mounting on hover. `"single-branch"` only floats when the message has exactly one branch.

## Copy and feedback state

```tsx
<ActionBarPrimitive.Copy copiedDuration={2000} className="group">
  <CopyIcon className="group-data-[copied]:hidden" />
  <CheckIcon className="hidden group-data-[copied]:block" />
</ActionBarPrimitive.Copy>

<ActionBarPrimitive.FeedbackPositive className="data-[submitted]:text-green-500">👍</ActionBarPrimitive.FeedbackPositive>
<ActionBarPrimitive.FeedbackNegative className="data-[submitted]:text-red-500">👎</ActionBarPrimitive.FeedbackNegative>
```

`FeedbackPositive` and `FeedbackNegative` are mutually exclusive (submitting one replaces the other in `s.message.metadata.submittedFeedback`), but there is no built in path back to "no feedback": `aui.message.submitFeedback({ type })` only ever writes a reaction.

## ActionBarMorePrimitive: the overflow menu

A Radix `DropdownMenu` scoped to the action bar's interaction lock, for grouping secondary actions behind a "more" button.

| Part | Renders | Notes |
|------|---------|-------|
| `.Root` | provider only | Radix `DropdownMenu.Root`. |
| `.Trigger` | `<button>` | Opens the menu. |
| `.Content` | `<div>` (portal) | Defaults `sideOffset={4}`. |
| `.Item` | `<div>` | Maps to `DropdownMenu.Item`; prefer `asChild` to compose an `ActionBarPrimitive` button into it. |
| `.Separator` | `<div>` | Visual divider. |

```tsx
import { ActionBarMorePrimitive, ActionBarPrimitive } from "@assistant-ui/react";
import { MoreHorizontalIcon } from "lucide-react";

<ActionBarPrimitive.Root>
  <ActionBarPrimitive.Copy>Copy</ActionBarPrimitive.Copy>
  <ActionBarPrimitive.Reload>Regenerate</ActionBarPrimitive.Reload>
  <ActionBarMorePrimitive.Root>
    <ActionBarMorePrimitive.Trigger className="flex size-8 items-center justify-center rounded-lg hover:bg-muted">
      <MoreHorizontalIcon className="size-4" />
    </ActionBarMorePrimitive.Trigger>
    <ActionBarMorePrimitive.Content side="bottom" align="end">
      <ActionBarMorePrimitive.Item asChild>
        <ActionBarPrimitive.ExportMarkdown>Export Markdown</ActionBarPrimitive.ExportMarkdown>
      </ActionBarMorePrimitive.Item>
      <ActionBarMorePrimitive.Separator />
      <ActionBarMorePrimitive.Item asChild>
        <ActionBarPrimitive.FeedbackPositive>Helpful</ActionBarPrimitive.FeedbackPositive>
      </ActionBarMorePrimitive.Item>
    </ActionBarMorePrimitive.Content>
  </ActionBarMorePrimitive.Root>
</ActionBarPrimitive.Root>
```

## Feedback adapter

```tsx
const runtime = useChatRuntime({
  adapters: {
    feedback: {
      submit: async ({ messageId, type }) => {
        await fetch("/api/feedback", { method: "POST", body: JSON.stringify({ messageId, type }) });
      },
    },
  },
});
```

## Patterns

```tsx
// Assistant action bar
<ActionBarPrimitive.Root hideWhenRunning autohide="not-last" autohideFloat="single-branch">
  <ActionBarPrimitive.Copy>Copy</ActionBarPrimitive.Copy>
  <ActionBarPrimitive.Reload>Regenerate</ActionBarPrimitive.Reload>
  <ActionBarPrimitive.ExportMarkdown>Export</ActionBarPrimitive.ExportMarkdown>
</ActionBarPrimitive.Root>

// User action bar
<ActionBarPrimitive.Root hideWhenRunning autohide="not-last">
  <ActionBarPrimitive.Edit>Edit</ActionBarPrimitive.Edit>
</ActionBarPrimitive.Root>

// Speech toggle
<AuiIf condition={(s) => s.message.speech == null}>
  <ActionBarPrimitive.Speak>Play</ActionBarPrimitive.Speak>
</AuiIf>
<AuiIf condition={(s) => s.message.speech != null}>
  <ActionBarPrimitive.StopSpeaking>Stop</ActionBarPrimitive.StopSpeaking>
</AuiIf>
```

## Common Gotchas

**"must be used within MessagePrimitive" error**
- `ActionBarPrimitive` reads message state from the nearest `MessagePrimitive.Root`. Render it inside your message component.

**Feedback buttons do nothing**
- They require a `feedback` adapter on the runtime (`adapters.feedback.submit`). With none configured, `submitFeedback` has nowhere to send.

**Copy button never shows the checkmark**
- Toggle icons off `data-copied` (via `className` or `AuiIf` on `s.message.isCopied`), not local component state; the attribute already tracks `copiedDuration` for you.
