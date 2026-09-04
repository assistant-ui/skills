# React Native primitives

`@assistant-ui/react-native` primitives accept the corresponding React Native props and read state from the closest `AssistantRuntimeProvider` and primitive scope. The namespace export is the public API. Use `AuiIf` instead of the deprecated `ThreadPrimitive.Empty`, `ThreadPrimitive.If`, `MessagePrimitive.If`, and `ComposerPrimitive.If`.

## Contents

- [Thread](#thread) | [Composer](#composer) | [Message](#message) | [Attachments and queue](#attachments-and-queue) | [Message controls](#message-controls) | [Thread lists and suggestions](#thread-lists-and-suggestions) | [Chain of thought and errors](#chain-of-thought-and-errors)

```tsx
import {
  ActionBarPrimitive,
  AttachmentPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  QueueItemPrimitive,
  SuggestionPrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react-native";
```

## Thread

- `ThreadPrimitive.Root` is the thread `View` container.
- `ThreadPrimitive.MessagesFlatList` is the current `FlatList` viewport. Its child receives `{ message }`; `autoScroll`, `scrollToBottomOnRunStart`, `scrollToBottomOnInitialize`, and `scrollToBottomOnThreadSwitch` default to `true`.
- `ThreadPrimitive.Messages` is the deprecated compatibility viewport. It delegates to `MessagesFlatList`, but all of its auto-scroll options default to `false`.
- `ThreadPrimitive.MessageByIndex` renders a message and scopes descendants to it. Pass `index` and either `components` or role-specific components.
- `ThreadPrimitive.Suggestion` is a `Pressable` for a supplied prompt; set `send` to send immediately and `clearComposer` to replace existing draft text.
- `ThreadPrimitive.Suggestions` renders all suggestions through a `Suggestion` component.
- `ThreadPrimitive.SuggestionByIndex` scopes and renders one suggestion with `index` and `components`.
- `ThreadPrimitive.Empty` and `ThreadPrimitive.If` are deprecated conditional wrappers. Replace both with `AuiIf`.

```tsx
<ThreadPrimitive.Root style={{ flex: 1 }}>
  <AuiIf condition={(s) => s.thread.isEmpty}>
    <Text>Ask a question to start.</Text>
  </AuiIf>
  <ThreadPrimitive.MessagesFlatList autoScroll>
    {() => <MessageRow />}
  </ThreadPrimitive.MessagesFlatList>
  <ThreadPrimitive.Suggestion prompt="Summarize this" send>
    <Text>Summarize this</Text>
  </ThreadPrimitive.Suggestion>
</ThreadPrimitive.Root>
```

## Composer

- `ComposerPrimitive.Root` is the composer `View`.
- `ComposerPrimitive.Input` owns `TextInput` `value` and `onChangeText`. Do not supply either prop yourself.
- `ComposerPrimitive.Send` sends and disables itself when the composer is empty.
- `ComposerPrimitive.Cancel` cancels the active run and disables itself when none exists.
- `ComposerPrimitive.AddAttachment` is the press target only. Open the platform picker yourself, then add the selected attachment through the runtime.
- `ComposerPrimitive.Attachments` renders all draft attachments with `Image`, `Document`, `File`, or fallback `Attachment` components.
- `ComposerPrimitive.AttachmentByIndex` scopes one draft attachment by `index`.
- `ComposerPrimitive.Queue` renders queued drafts and scopes each child to a `QueueItemPrimitive`.
- `ComposerPrimitive.Quote` gates its children on an active quote. `ComposerPrimitive.QuoteText` renders its text and `ComposerPrimitive.QuoteDismiss` clears it.
- `ComposerPrimitive.EditInput`, `ComposerPrimitive.EditSend`, and `ComposerPrimitive.EditCancel` are the controls inside a message edit composer.
- `ComposerPrimitive.If` is deprecated. Use `AuiIf` with composer state.

```tsx
<ComposerPrimitive.Root style={{ flexDirection: "row" }}>
  <ComposerPrimitive.Input multiline placeholder="Message..." style={{ flex: 1 }} />
  <ComposerPrimitive.Send>
    <Text>Send</Text>
  </ComposerPrimitive.Send>
  <ComposerPrimitive.Cancel>
    <Text>Stop</Text>
  </ComposerPrimitive.Cancel>
</ComposerPrimitive.Root>
```

## Message

- `MessagePrimitive.Root` is a message `View`.
- `MessagePrimitive.Content` dispatches text, tool-call, image, reasoning, source, file, and data parts through render props. It uses native `Text` for text when `renderText` is omitted.
- `MessagePrimitive.Parts` dispatches the same content through a `components` map. Toolkit tool and data renderers take precedence over fallback entries in this map.
- `MessagePrimitive.PartByIndex` scopes and renders one part by `index`.
- `MessagePrimitive.Attachments` renders user attachments and `MessagePrimitive.AttachmentByIndex` scopes one attachment by `index`.
- `MessagePrimitive.If` is deprecated. Use `AuiIf` with message state instead.

The `MessagePrimitive.Parts` map supports `Text`, `Image`, `Reasoning`, `Source`, `File`, `Unstable_Audio`, `Empty`, `Quote`, `ChainOfThought`, `tools`, and `data`. Use `tools.by_name` for named tool renderers, `tools.Fallback` for unknown calls, `tools.Override` for all calls, and the equivalent `data.by_name` or `data.Fallback` entries for data parts.

```tsx
<MessagePrimitive.Root>
  <MessagePrimitive.Content
    renderText={({ part }) => <Text>{part.text}</Text>}
    renderToolCall={({ part }) => <Text>Running {part.toolName}</Text>}
  />
</MessagePrimitive.Root>
```

## Attachments and queue

- `AttachmentPrimitive.Root` is the attachment `View`.
- `AttachmentPrimitive.Name` displays the filename.
- `AttachmentPrimitive.Thumb` displays the extension or attachment type. Children override the displayed text.
- `AttachmentPrimitive.Remove` removes the attachment from the composer context.
- `QueueItemPrimitive.Text` displays the queued text.
- `QueueItemPrimitive.Remove` removes the queued item.
- `QueueItemPrimitive.Steer` promotes the queued item to run next.

Render `AttachmentPrimitive` inside `ComposerPrimitive.Attachments` or `MessagePrimitive.Attachments`. Render `QueueItemPrimitive` only inside the child function of `ComposerPrimitive.Queue`.

## Message controls

- `ActionBarPrimitive.Copy` copies the current message. Supply a platform `copyToClipboard` function and optionally use its `{ isCopied }` child state.
- `ActionBarPrimitive.Edit` starts editing the message.
- `ActionBarPrimitive.Reload` regenerates an assistant message.
- `ActionBarPrimitive.FeedbackPositive` and `ActionBarPrimitive.FeedbackNegative` submit message feedback and expose `{ isSubmitted }` to function children.
- `BranchPickerPrimitive.Previous` and `BranchPickerPrimitive.Next` move through branches.
- `BranchPickerPrimitive.Number` and `BranchPickerPrimitive.Count` show the current branch and total count.

```tsx
<ActionBarPrimitive.Copy copyToClipboard={copyToClipboard}>
  {({ isCopied }) => <Text>{isCopied ? "Copied" : "Copy"}</Text>}
</ActionBarPrimitive.Copy>
```

## Thread lists and suggestions

- `ThreadListPrimitive.Root` is the list `View`.
- `ThreadListPrimitive.Items` is the runtime-managed `FlatList`; its `renderItem` receives `{ threadId, index }`.
- `ThreadListPrimitive.New` creates a thread.
- `ThreadListItemPrimitive.Root` is an item `View`.
- `ThreadListItemPrimitive.Title` displays its title with optional fallback content.
- `ThreadListItemPrimitive.Trigger` switches to the item thread.
- `ThreadListItemPrimitive.Delete`, `ThreadListItemPrimitive.Archive`, and `ThreadListItemPrimitive.Unarchive` perform their named actions.
- `SuggestionPrimitive.Title` and `SuggestionPrimitive.Description` render scoped suggestion values.
- `SuggestionPrimitive.Trigger` activates a scoped suggestion. Its `send` and `clearComposer` behavior matches `ThreadPrimitive.Suggestion`.

`ThreadListItemPrimitive` needs a thread-list-item scope, normally provided by the child of `ThreadListPrimitive.Items`. `SuggestionPrimitive` needs a suggestion scope, normally provided by `ThreadPrimitive.Suggestions` or `SuggestionByIndexProvider`.

## Chain of thought and errors

- `ChainOfThoughtPrimitive.Root` is the grouped reasoning and tool-call container.
- `ChainOfThoughtPrimitive.AccordionTrigger` toggles its collapsed state.
- `ChainOfThoughtPrimitive.Parts` renders scoped reasoning and tool-call parts through a child function.
- `ErrorPrimitive.Root` and `ErrorPrimitive.Message` are source-exported native error primitives. The React Native documentation snapshot does not yet describe them.

Use `ChainOfThoughtPrimitive.Parts` only where a chain-of-thought scope has been established, such as a `MessagePrimitive.Parts` `ChainOfThought` renderer.
