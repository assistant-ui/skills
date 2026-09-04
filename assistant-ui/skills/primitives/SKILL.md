---
name: primitives
description: "Builds and customizes assistant-ui chat UI from composable, unstyled @assistant-ui/react primitives that follow Radix-style part composition: ThreadPrimitive (.Root, .Viewport, .ViewportProvider, .ViewportFooter, .Messages, .MessageByIndex, .Unstable_MessageById, .ScrollToBottom, .Suggestions), ComposerPrimitive (.Input, .Send, .Cancel, .Attachments, .AddAttachment, .AttachmentDropzone, .Quote, .Dictate, .Queue, the Unstable_TriggerPopover family for mentions and slash commands), MessagePrimitive (.Parts, .GroupedParts, .Attachments, .Quote, .GenerativeUI, .Error) and MessagePartPrimitive, ActionBarPrimitive plus ActionBarMorePrimitive, BranchPickerPrimitive, AttachmentPrimitive, ErrorPrimitive, AssistantModalPrimitive, ChainOfThoughtPrimitive, SelectionToolbarPrimitive, SuggestionPrimitive, QueueItemPrimitive, and the ThreadList primitives. Use when assembling or styling a custom Thread, Composer, message list, action bar, branch picker, mention or slash command popover, or suggestion grid from building blocks; when wiring headless composer input, input history, dictation, quoting, or file attachments; or when handling message editing, branching, timing, virtualization, custom scrollbars, or grouped chain of thought UI. Covers MessagePrimitive.Parts children render functions for text, image, file, reasoning, source, tool call, data, and generative UI parts, part grouping with groupPartByType (the mcp-app key was removed in 0.15, use standalone-tool-call), conditional rendering with AuiIf in selector form (the per-primitive .If props are deprecated), and gotchas such as wrapping in AssistantRuntimeProvider and adding className since primitives ship unstyled. For prebuilt drop-in UI and CLI scaffolding use setup, for the styled component catalog built on these primitives use elements, for multi-thread sidebar behavior use thread-list."
license: MIT
---

# assistant-ui Primitives

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Primitives are composable, unstyled components that follow Radix style part composition: a `.Root` provides context, `.PartName` children read it, and every part accepts `asChild` to merge its behavior onto your own element instead of rendering a wrapper. They ship with no styles and no opinions about layout, only behavior: keyboard shortcuts, auto scroll, streaming state, focus management, and disabled logic. Wrap your tree in `AssistantRuntimeProvider` (or a nested `AuiProvider`) before using any of them.

## References

- [./references/thread.md](./references/thread.md) -- ThreadPrimitive: viewport, auto scroll, turn anchor, the messages iterator
- [./references/composer.md](./references/composer.md) -- ComposerPrimitive: root, input, send, cancel, submit behavior
- [./references/message.md](./references/message.md) -- MessagePrimitive: the parts pipeline, tool resolution, attachments, quote, error
- [./references/action-bar.md](./references/action-bar.md) -- ActionBarPrimitive and the ActionBarMorePrimitive overflow menu
- [./references/part-grouping.md](./references/part-grouping.md) -- GroupedParts, groupPartByType, chain of thought UI
- [./references/mentions.md](./references/mentions.md) -- `@` mentions, `/` slash commands, custom trigger matchers
- [./references/composer-input.md](./references/composer-input.md) -- headless input, input history, dictation, quoting, attachments
- [./references/messages.md](./references/messages.md) -- editing, branching, message timing, virtualization, scrollbar, image parts
- [./references/suggestions.md](./references/suggestions.md) -- `Suggestions([...])`, the suggestion adapter, `ThreadPrimitive.Suggestions`

## Import

```tsx
import {
  AuiIf,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ActionBarPrimitive,
  ActionBarMorePrimitive,
  BranchPickerPrimitive,
  AttachmentPrimitive,
  ErrorPrimitive,
  AssistantModalPrimitive,
  ChainOfThoughtPrimitive,
  SelectionToolbarPrimitive,
  SuggestionPrimitive,
  QueueItemPrimitive,
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemMorePrimitive,
} from "@assistant-ui/react";
```

## Primitive parts

| Primitive | Parts |
|-----------|-------|
| `ThreadPrimitive` | `.Root`, `.Viewport`, `.ViewportProvider`, `.ViewportFooter`, `.Messages`, `.MessageByIndex`, `.Unstable_MessageById`, `.ScrollToBottom`, `.Suggestions`, `.SuggestionByIndex`, `.Suggestion`, `.Empty` (deprecated), `.If` (deprecated) |
| `ComposerPrimitive` | `.Root`, `.Input`, `.Send`, `.Cancel`, `.AddAttachment`, `.Attachments`, `.AttachmentByIndex`, `.AttachmentDropzone`, `.Dictate`, `.StopDictation`, `.DictationTranscript`, `.Quote`, `.QuoteText`, `.QuoteDismiss`, `.Queue`, `.Unstable_TriggerPopoverRoot`, `.Unstable_TriggerPopover` (with `.Directive` / `.Action`), `.Unstable_TriggerPopoverCategories`, `.Unstable_TriggerPopoverCategoryItem`, `.Unstable_TriggerPopoverItems`, `.Unstable_TriggerPopoverItem`, `.Unstable_TriggerPopoverBack`, `.If` (deprecated) |
| `MessagePrimitive` | `.Root`, `.Parts` (`.Content` is a deprecated alias), `.PartByIndex`, `.GroupedParts`, `.Unstable_PartsGrouped`, `.Unstable_PartsGroupedByParentId`, `.Attachments`, `.AttachmentByIndex`, `.Quote`, `.Error`, `.GenerativeUI`, `.If` (deprecated) |
| `MessagePartPrimitive` | `.Text`, `.Image`, `.InProgress`, `.Messages` |
| `ActionBarPrimitive` | `.Root`, `.Copy`, `.Reload`, `.Edit`, `.Speak`, `.StopSpeaking`, `.FeedbackPositive`, `.FeedbackNegative`, `.ExportMarkdown` |
| `ActionBarMorePrimitive` | `.Root`, `.Trigger`, `.Content`, `.Item`, `.Separator` |
| `BranchPickerPrimitive` | `.Root`, `.Previous`, `.Next`, `.Number`, `.Count` |
| `AttachmentPrimitive` | `.Root`, `.Name`, `.Remove`, `.unstable_Thumb` |
| `ErrorPrimitive` | `.Root`, `.Message` |
| `AssistantModalPrimitive` | `.Root`, `.Trigger`, `.Content`, `.Anchor` |
| `ChainOfThoughtPrimitive` | `.Root`, `.AccordionTrigger`, `.Parts` (legacy, prefer `MessagePrimitive.GroupedParts`) |
| `SelectionToolbarPrimitive` | `.Root`, `.Quote` |
| `SuggestionPrimitive` | `.Title`, `.Description`, `.Trigger` |
| `QueueItemPrimitive` | `.Text`, `.Steer`, `.Remove` |
| `ThreadListPrimitive` | `.Root`, `.New`, `.Items`, `.ItemByIndex`, `.LoadMore` |
| `ThreadListItemPrimitive` | `.Root`, `.Trigger`, `.Title`, `.Archive`, `.Unarchive`, `.Delete` |
| `ThreadListItemMorePrimitive` | `.Root`, `.Trigger`, `.Content`, `.Item`, `.Separator` |

`ThreadListPrimitive`, `ThreadListItemPrimitive`, and `ThreadListItemMorePrimitive` drive multi-thread sidebars. This skill covers them only in the table above; see [thread-list](../thread-list/SKILL.md) for the full custom UI, CRUD operations, and remote adapter walkthrough.

## Conditional rendering with AuiIf

Reach for `AuiIf` for every new condition. It takes a selector over the full assistant state (`thread`, `message`, `composer`, `part`, `attachment`) instead of a fixed set of boolean props, and it replaces the deprecated `.If` that still ships on `ThreadPrimitive`, `MessagePrimitive`, and `ComposerPrimitive`.

```tsx
<AuiIf condition={(s) => s.thread.isEmpty}>
  <WelcomeScreen />
</AuiIf>

<AuiIf condition={(s) => s.thread.isRunning}>
  <ComposerPrimitive.Cancel>Stop</ComposerPrimitive.Cancel>
</AuiIf>

<AuiIf
  condition={(s) => s.message.role === "assistant" && s.message.status?.type === "complete"}
>
  <FollowUpCard />
</AuiIf>

<AuiIf condition={(s) => s.composer.dictation != null}>
  <ComposerPrimitive.StopDictation>Stop</ComposerPrimitive.StopDictation>
</AuiIf>
```

`AuiIf.Condition` is exported for typing a condition function outside JSX. `s.message` and `s.part` are only populated inside a message or part context; `s.thread` and `s.composer` are always available.

## Custom thread example

A complete thread built from primitives: welcome suggestions, per role messages with an inline edit composer, an action bar, a branch picker, and a composer footer that swaps `Send` for `Cancel` mid run.

```tsx
function CustomThread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <p>Ask me anything.</p>
            <ThreadPrimitive.Suggestions>
              {() => (
                <SuggestionPrimitive.Trigger send className="rounded-lg border px-3 py-2">
                  <SuggestionPrimitive.Title />
                </SuggestionPrimitive.Trigger>
              )}
            </ThreadPrimitive.Suggestions>
          </div>
        </AuiIf>

        <ThreadPrimitive.Messages>
          {({ message }) => {
            if (message.role === "user") {
              return message.composer.isEditing ? <EditComposer /> : <UserMessage />;
            }
            return <AssistantMessage />;
          }}
        </ThreadPrimitive.Messages>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 pt-2">
          <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border bg-background p-2">
            <ComposerPrimitive.Input
              placeholder="Send a message..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 focus:outline-none"
            />
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <ComposerPrimitive.Send className="rounded-full bg-primary px-3 py-1.5 text-primary-foreground" />
            </AuiIf>
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel className="rounded-full border px-3 py-1.5" />
            </AuiIf>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col items-end gap-1">
      <MessagePrimitive.Quote>
        {({ text }) => <blockquote className="border-l pl-2 text-sm italic">{text}</blockquote>}
      </MessagePrimitive.Quote>
      <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") return <MessagePartPrimitive.Text />;
            if (part.type === "image") return <MessagePartPrimitive.Image className="max-w-full rounded-lg" />;
            return null;
          }}
        </MessagePrimitive.Parts>
      </div>
      <ActionBarPrimitive.Root hideWhenRunning autohide="not-last">
        <ActionBarPrimitive.Edit>Edit</ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function EditComposer() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <ComposerPrimitive.Root className="w-[80%] rounded-2xl border p-2">
        <ComposerPrimitive.Input className="w-full resize-none bg-transparent focus:outline-none" />
        <div className="flex justify-end gap-2 pt-1">
          <ComposerPrimitive.Cancel className="rounded-md px-2 py-1 text-sm">Cancel</ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send className="rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground">
            Save
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex flex-col items-start gap-1">
      <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2">
        <MessagePrimitive.Parts>
          {({ part }) => {
            switch (part.type) {
              case "text":
                return <p className="whitespace-pre-wrap"><MessagePartPrimitive.Text /></p>;
              case "image":
                return <MessagePartPrimitive.Image className="max-w-full rounded-lg" />;
              case "file":
                return (
                  <a href={part.data ?? part.url} download={part.filename} className="text-sm underline">
                    {part.filename ?? part.mimeType}
                  </a>
                );
              case "reasoning":
                return (
                  <details className="text-sm text-muted-foreground">
                    <summary>Thinking</summary>
                    {part.text}
                  </details>
                );
              case "source":
                return part.sourceType === "url" ? (
                  <a href={part.url} className="text-sm underline">{part.title ?? part.url}</a>
                ) : (
                  <span className="text-sm">{part.title}</span>
                );
              case "tool-call":
                return part.toolUI ?? <div className="rounded-md border p-2 text-sm">{part.toolName}</div>;
              case "data":
                return part.dataRendererUI ?? null;
              case "generative-ui":
                return <MessagePrimitive.GenerativeUI />;
              default:
                return null; // registered tool and data UIs still render when you return null
            }
          }}
        </MessagePrimitive.Parts>
      </div>
      <MessagePrimitive.Error>
        <ErrorPrimitive.Root className="text-sm text-destructive">
          <ErrorPrimitive.Message />
        </ErrorPrimitive.Root>
      </MessagePrimitive.Error>
      <div className="flex items-center gap-2">
        <BranchPickerPrimitive.Root hideWhenSingleBranch className="flex items-center gap-1 text-xs">
          <BranchPickerPrimitive.Previous>←</BranchPickerPrimitive.Previous>
          <span><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
          <BranchPickerPrimitive.Next>→</BranchPickerPrimitive.Next>
        </BranchPickerPrimitive.Root>
        <ActionBarPrimitive.Root hideWhenRunning autohide="not-last">
          <ActionBarPrimitive.Copy>Copy</ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload>Regenerate</ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}
```

The assistant message's `.Parts` callback above handles all eight part types the pipeline can hand you: the three modality parts (`text`, `image`, `file`), the four provider channel parts (`reasoning`, `source`, `tool-call`, `generative-ui`), and the open ended `data` part. Returning `null` from the `default` case still lets a tool UI registered by name, or a data renderer registered by `name`, take over automatically; return `<></>` instead when you want to suppress that part entirely.

## Branch picker

`BranchPickerPrimitive` reads branch state from the nearest `MessagePrimitive.Root`, so it must render inside one. `Previous` and `Next` auto disable at the boundaries (and while a run is in flight, unless the runtime supports `switchBranchDuringRun`); `hideWhenSingleBranch` removes the whole picker until a message actually has alternatives, which keeps the action row from jumping around on the common case of one branch.

```tsx
<BranchPickerPrimitive.Root hideWhenSingleBranch className="inline-flex items-center gap-1">
  <BranchPickerPrimitive.Previous>←</BranchPickerPrimitive.Previous>
  <span><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
  <BranchPickerPrimitive.Next>→</BranchPickerPrimitive.Next>
</BranchPickerPrimitive.Root>
```

A new branch appears when a user message is edited and resent, or when `ActionBarPrimitive.Reload` (or `aui.message.reload()`) regenerates an assistant message. See [messages.md](./references/messages.md) for programmatic branch navigation with `aui.message.switchToBranch`.

## Common Gotchas

**Primitive renders nothing, or a hook throws outside a provider**
- Every primitive reads from the nearest runtime context. Wrap the tree in `AssistantRuntimeProvider runtime={...}` (from a runtime hook like `useChatRuntime` or `useLocalRuntime`), or nest an `AuiProvider extends={aui} config={AuiConfig({...})}` for an isolated scope.
- `ActionBarPrimitive`, `BranchPickerPrimitive`, and `ErrorPrimitive` additionally need a `MessagePrimitive.Root` ancestor; `SelectionToolbarPrimitive` needs a `ThreadPrimitive.Root` ancestor but must sit outside `ThreadPrimitive.Viewport`.

**Nothing is styled**
- Primitives render bare native elements (`<div>`, `<button>`, `<textarea>`, ...) with no classes. Add `className` yourself, or pass `asChild` to merge behavior onto a styled component you already have.

**`ThreadPrimitive.ViewportSlack` no longer exists**
- It was removed from the public API. Top anchor target registration now happens automatically inside `MessagePrimitive.Root` when `Viewport` has `turnAnchor="top"`; replace any `fillClampThreshold` / `fillClampOffset` customization with `topAnchorMessageClamp` on `Viewport` instead.

**`MessagePrimitive.Content`, `.Empty`, and every `.If` still work but are legacy**
- `.Content` is a deprecated alias for `.Parts`. `ThreadPrimitive.Empty` and every primitive's `.If` are superseded by `AuiIf`; keep them only in code you have not migrated yet.

**`groupPartByType({ "mcp-app": [...] })` silently stops matching**
- The `"mcp-app"` key was removed in 0.15. Use `"standalone-tool-call"`, a superset that also matches any tool call whose registered UI opts into `display: "standalone"`. See [part-grouping.md](./references/part-grouping.md).

**`Unstable_` prefixed props, hooks, and primitives**
- The composer trigger popover family, `unstable_useComposerInput`, `unstable_useComposerInputHistory`, and `unstable_useThreadMessageIds` are explicitly unstable and can change without a major version bump. They are safe to build on, but pin the exact behavior you rely on before upgrading.

## Related Skills

- [elements](../elements/SKILL.md) -- the styled, copy-into-your-project components built from these primitives
- [setup](../setup/SKILL.md) -- `create`, `init`, `add`, and the rest of the CLI scaffold
- [runtime](../runtime/SKILL.md) -- `useAui`, `useAuiState`, `AuiConfig`, and the state every primitive reads
- [tools](../tools/SKILL.md) -- toolkit `render` entries that resolve into `part.toolUI` inside `MessagePrimitive.Parts`
- [thread-list](../thread-list/SKILL.md) -- `ThreadListPrimitive` and `ThreadListItemPrimitive` in depth
