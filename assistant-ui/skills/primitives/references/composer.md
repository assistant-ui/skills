# ComposerPrimitive

The interface for composing a new message or editing an existing one: submit behavior, keyboard shortcuts, focus management, attachment and quote state, and streaming status. `Root` renders a `<form>`, `Input` a `<textarea>`, `Send` and `Cancel` `<button>`s.

## Parts

| Part | Renders | Notes |
|------|---------|-------|
| `.Root` | `<form>` | Submits on Enter (Shift+Enter for a newline by default). Accepts `compact`; see below. |
| `.Input` | `<textarea>` | `submitMode` (`"enter"` default, `"ctrlEnter"`, `"none"`), `cancelOnEscape`, `unstable_insertNewlineOnTouchEnter`, `unstable_focusOnRunStart`, `unstable_focusOnScrollToBottom`. |
| `.Send` | `<button>` | Disabled when the composer cannot send (empty, or gated; see below). |
| `.Cancel` | `<button>` | Cancels the in flight run, or exits edit mode without resending. |
| `.AddAttachment` | `<button>` | Opens the file picker. |
| `.Attachments` | list | Children render function `{ attachment }`. See [composer-input.md](./composer-input.md). |
| `.AttachmentByIndex` | one attachment | `index` plus `components={{ Attachment }}`. |
| `.AttachmentDropzone` | `<div>` | Sets `data-dragging` while a file hovers over it; inert without the attachments capability. |
| `.Dictate` / `.StopDictation` | `<button>` | Start and stop a dictation session. See [composer-input.md](./composer-input.md#dictation). |
| `.DictationTranscript` | `<span>` | Interim transcript while dictation is active. |
| `.Quote` / `.QuoteText` / `.QuoteDismiss` | `<div>` / `<span>` / `<button>` | Quoted text preview. Only `.Quote` renders when a quote is set. See [composer-input.md](./composer-input.md#quoting). |
| `.Queue` | queue UI | Queued messages sent while a run is in flight; render `QueueItemPrimitive` inside. |
| `.Unstable_TriggerPopoverRoot` / `.Unstable_TriggerPopover` and friends | popover | `@` mention and `/` slash command popovers. See [mentions.md](./mentions.md). |
| `.If` | conditional | Deprecated (`editing`, `dictation` only). Use `AuiIf`. |

## New message vs edit mode

The same primitives handle both: a `Composer` inside a `ThreadPrimitive.Root` composes a new message, and a `Composer` inside a `MessagePrimitive.Root` edits that message. Behavior switches automatically based on where it renders.

```tsx
// New message composer, inside ThreadPrimitive
<ComposerPrimitive.Root>
  <ComposerPrimitive.Input />
  <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
</ComposerPrimitive.Root>

// Edit composer, inside a MessagePrimitive.Root
<ComposerPrimitive.Root>
  <ComposerPrimitive.Input />
  <ComposerPrimitive.Send>Save</ComposerPrimitive.Send>
  <ComposerPrimitive.Cancel>Cancel</ComposerPrimitive.Cancel>
</ComposerPrimitive.Root>
```

`useAuiState((s) => s.composer.isEditing)` reads the same flag from either context, but scoping the edit UI through the message's own render branch (as in the [SKILL.md custom thread example](../SKILL.md#custom-thread-example)) is more idiomatic than a manual check. See [messages.md](./messages.md#editing) for the full editing flow, including `aui.composer.beginEdit()`.

## The asChild pattern

Every part accepts `asChild` to merge its behavior onto your own element, so keyboard handling, disabled state, and form submission wire onto your design system's component instead of a bare native one:

```tsx
<ComposerPrimitive.Input asChild>
  <textarea className="my-textarea" placeholder="Type here..." />
</ComposerPrimitive.Input>

<ComposerPrimitive.Send asChild>
  <MyButton variant="primary">Send</MyButton>
</ComposerPrimitive.Send>
```

Own the input DOM entirely, a `contentEditable` surface or an editor library `asChild` cannot express? See [composer-input.md](./composer-input.md#headless-composer-input) for `unstable_useComposerInput`.

## Compact mode

Pass `compact` on `Root` to opt into a `data-compact` attribute: it is set while the input holds at most one line of text and the composer has no attachments, quote, queued messages, or active dictation. The prop only exposes the attribute; style the collapse yourself.

```tsx
<ComposerPrimitive.Root
  compact
  className="flex flex-col data-[compact]:flex-row data-[compact]:items-center"
>
  <ComposerPrimitive.Input placeholder="Ask anything..." />
  <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
</ComposerPrimitive.Root>
```

Once the text wraps to a second line the composer expands and stays expanded until the input clears, so the layout does not oscillate right at the wrap boundary.

## Patterns

### Custom submit behavior

```tsx
<ComposerPrimitive.Root
  onSubmit={(e) => {
    // runs before the message sends; call e.preventDefault() to cancel
  }}
>
  <ComposerPrimitive.Input />
  <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
</ComposerPrimitive.Root>
```

### Gate sending on external state

Disabling the whole thread via `isDisabled` also disables the text input, which feels broken while the user is still allowed to type. Set `isSendDisabled` on the runtime adapter instead, so typing stays available while sending is blocked (loading tools, pending auth, and so on):

```tsx
const runtime = useExternalStoreRuntime({
  isSendDisabled: !toolsLoaded,
  onNew,
  messages,
});
```

While `isSendDisabled` is `true`, `composer.canSend` is `false`, `ComposerPrimitive.Send` is disabled, Enter and the steer hotkey become no ops, and `aui.composer.send()` short circuits at the runtime so no direct call can escape the gate. It only gates the thread composer; saving an in progress edit is unaffected. Read the same flag for an inline hint:

```tsx
<AuiIf condition={(s) => !s.composer.canSend}>
  <p className="text-sm text-muted-foreground">Loading tools, hang on...</p>
</AuiIf>
```

### Ctrl+Enter to submit

```tsx
<ComposerPrimitive.Input submitMode="ctrlEnter" />
```

Plain Enter inserts a newline; Ctrl (Cmd) plus Enter submits.

### Mobile and touch devices

```tsx
<ComposerPrimitive.Input unstable_insertNewlineOnTouchEnter />
```

On touch primary devices (`(pointer: coarse) and (not (any-pointer: fine))`), Enter inserts a newline instead of sending, so the on screen Return key never fires a half finished message; submission moves to the explicit Send button, matching WhatsApp, Slack, Discord, iMessage, ChatGPT, and Claude.ai. Desktop behavior, and a tablet with a hardware keyboard under an explicit `submitMode`, are unchanged.

### Floating composer

```tsx
function FloatingComposer() {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2">
      <ComposerPrimitive.Root>
        <div className="rounded-xl border bg-background/80 shadow-lg backdrop-blur-sm">
          <ComposerPrimitive.Input
            asChild
            unstable_focusOnRunStart={false}
            unstable_focusOnScrollToBottom={false}
          >
            <textarea
              placeholder="Ask a question..."
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm focus:outline-none"
              rows={1}
            />
          </ComposerPrimitive.Input>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
}
```

`ComposerPrimitive` is not bound to any layout. The two `unstable_focusOn*` flags stop a composer living outside the main thread scroll flow from stealing focus on run start or scroll to bottom.

## Common Gotchas

**Send button stays disabled**
- `canSend` requires editing mode plus non empty content plus `isSendDisabled` not set. An in flight run without queue support also disables `Send` directly; check `s.thread.isRunning` and whether your runtime supports queued sends.

**`ComposerPrimitive.If` ignores most conditions**
- It only understands `editing` and `dictation`. Use `AuiIf` (`s.composer.isEditing`, `s.composer.dictation != null`) for anything else.

**Attachments, quoting, dictation, or input history need more setup than the bare primitive**
- Those parts render the right DOM, but the surrounding adapters and hooks live in [composer-input.md](./composer-input.md).
