# Terminal primitives

Import all terminal primitives from `@assistant-ui/react-ink`. They accept the appropriate Ink `Box` or `Text` props in addition to their runtime behavior. A namespace part reads the closest scope created by its parent iterator or one of the explicit index providers.

## Core thread and composer

`ThreadPrimitive` owns the active thread. `Root` is a `Box`, `Messages` iterates messages, `MessageByIndex` supplies an explicit message scope, and `Unstable_MessageById` is the corresponding experimental provider. `Suggestions` and `SuggestionByIndex` create suggestion scope. `Suggestion` inserts or sends a prompt. `Empty` and `If` remain exported but are deprecated. Prefer `AuiIf condition={(s) => s.thread.isEmpty}` or another selector.

```tsx
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react-ink";
import { Text } from "ink";

<ThreadPrimitive.Root>
  <AuiIf condition={(s) => s.thread.isEmpty}>
    <Text dimColor>No messages yet.</Text>
  </AuiIf>
  <ThreadPrimitive.Messages>{() => <Message />}</ThreadPrimitive.Messages>
</ThreadPrimitive.Root>;
```

`ComposerPrimitive` provides `Root`, `Input`, `Send`, `Cancel`, `Attachments`, `AttachmentByIndex`, `AddAttachment`, `Queue`, `Quote`, `QuoteText`, and `QuoteDismiss`. `If` is deprecated in favor of `AuiIf`. Use `Attachments` or `Queue` as render function parents because they create attachment and queue item scopes.

```tsx
import { ComposerPrimitive, QueueItemPrimitive } from "@assistant-ui/react-ink";
import { Box, Text } from "ink";

<ComposerPrimitive.Root>
  <ComposerPrimitive.Input multiLine submitOnEnter placeholder="Ask a question" />
  <ComposerPrimitive.Queue>
    {() => (
      <Box>
        <QueueItemPrimitive.Text />
        <QueueItemPrimitive.Steer><Text>[Run]</Text></QueueItemPrimitive.Steer>
        <QueueItemPrimitive.Remove><Text>[Remove]</Text></QueueItemPrimitive.Remove>
      </Box>
    )}
  </ComposerPrimitive.Queue>
</ComposerPrimitive.Root>;
```

`QueueItemPrimitive` has `Text`, `Remove`, and `Steer`. `Remove` deletes the queued item and `Steer` promotes it to run next. Its parts work only below `ComposerPrimitive.Queue` or an equivalent queue item provider.

## Messages and message parts

`MessagePrimitive` has `Root`, `Parts`, `PartByIndex`, `Attachments`, `AttachmentByIndex`, and `Error`. `Content` and `If` are deprecated. `Parts` is the normal iterator. It resolves toolkit renderers and data UIs first, then the optional `components` map, and finally terminal safe defaults.

```tsx
import { MessagePartPrimitive, MessagePrimitive } from "@assistant-ui/react-ink";
import { Text } from "ink";

<MessagePrimitive.Parts
  components={{
    Text: () => <MessagePartPrimitive.Text />,
    Reasoning: () => <MessagePartPrimitive.Reasoning dimColor />,
    Image: () => <MessagePartPrimitive.Image />,
    File: () => <MessagePartPrimitive.File />,
  }}
/>;
```

`MessagePartPrimitive` has `Text`, `Image`, `File`, `Source`, `Reasoning`, `Data`, `InProgress`, and `Messages`. Text is rendered with Ink `Text`. Image and file parts emit a safe label rather than terminal image data. Source emits title or URL metadata. Data emits a name when no registered data renderer handles it. `InProgress` gates children on a running part and `Messages` iterates the parts held by the scope.

`AttachmentPrimitive` has `Root`, `Name`, `Thumb`, `Status`, and `Remove`. It reads the attachment supplied by composer or message attachment iterators. `Thumb` chooses extension, attachment type, then `file`. `Status` displays upload, pending action, error, paused, or optionally complete state. `Remove` is an Enter activated focusable control.

## Controls, navigation, and thread lists

Every control listed here is an Ink focusable pressable. It activates on Enter while focused and accepts `disabled` where applicable.

- `ActionBarPrimitive`: `Copy`, `Edit`, `Reload`, `FeedbackPositive`, `FeedbackNegative`. `Copy` needs a platform `copyToClipboard` function and exposes copied state to function children.
- `BranchPickerPrimitive`: `Previous`, `Next`, `Number`, `Count` for message branch navigation and labels.
- `ThreadListPrimitive`: `Root`, `Items`, `New`. `Items` receives a `renderItem` function with thread id and index.
- `ThreadListItemPrimitive`: `Root`, `Title`, `Trigger`, `Delete`, `Archive`, `Unarchive`. Render it inside the context created by `ThreadListPrimitive.Items` or `ThreadListItemByIndexProvider`.
- `SuggestionPrimitive`: `Title`, `Description`, `Trigger`. Description reads the suggestion `label`, and Trigger inserts or sends the prompt.

## Reasoning, tools, errors, and loading

- `ChainOfThoughtPrimitive`: `Root`, `AccordionTrigger`, `Parts`. The parts iterator covers a selected range of reasoning parts.
- `ToolCallPrimitive.Fallback`: terminal tool call view with expandable arguments and result text. It expands while running, waiting for action, or errored unless controlled by `expanded`.
- `ErrorPrimitive`: `Root`, `Message` for a terminal error region.
- `LoadingPrimitive`: `Root`, `Spinner`, `Text`, `ElapsedTime`. Root renders only while the thread runs. Spinner variants are `spinner`, `dots`, `pulse`, `bar`, and `bounce`.

```tsx
import { LoadingPrimitive, ToolCallPrimitive } from "@assistant-ui/react-ink";

<LoadingPrimitive.Root gap={1}>
  <LoadingPrimitive.Spinner variant="dots" />
  <LoadingPrimitive.Text>Working</LoadingPrimitive.Text>
  <LoadingPrimitive.ElapsedTime />
</LoadingPrimitive.Root>;

<ToolCallPrimitive.Fallback part={toolPart} maxArgLines={20} maxResultLines={20} />;
```

## Diff, status, and checklists

`DiffView` is the ready made diff component. For a custom terminal layout, `DiffPrimitive` provides `Root`, `Header`, `Content`, `Line`, and `Stats`. Root accepts a unified patch or old and new file content. Content supports line numbers, context folding, truncation, and custom line or fold renderers.

```tsx
import { DiffView, StatusBarPrimitive } from "@assistant-ui/react-ink";

<DiffView patch={patch} showLineNumbers contextLines={3} maxLines={80} />;

<StatusBarPrimitive.Root gap={1}>
  <StatusBarPrimitive.Status />
  <StatusBarPrimitive.ModelName name="gpt-5.6-luna" />
  <StatusBarPrimitive.MessageCount />
  <StatusBarPrimitive.TokenCount />
  <StatusBarPrimitive.Latency />
</StatusBarPrimitive.Root>;
```

`StatusBarPrimitive` has `Root`, `ModelName`, `MessageCount`, `TokenCount`, `Latency`, and `Status`. Status resolves `idle`, `running`, `error`, or `cancelled` from thread and last assistant message state.

`ChecklistPrimitive` has `Root`, `Item`, and `Progress`. `LiveChecklist` is the data driven component, while `useToolCallChecklist` maps a tool call into live checklist state. Both are useful for long running terminal tools.

## Controlled text input

`TextInput` is a store free controlled editor with `value`, `onChange`, optional `onSubmit`, `submitOnEnter`, `placeholder`, `autoFocus`, and `multiLine`. `ComposerPrimitive.Input` adapts this component to `s.composer.text`.

```tsx
import { TextInput } from "@assistant-ui/react-ink";

<TextInput value={command} onChange={setCommand} submitOnEnter onSubmit={runCommand} />;
```

The editor treats one `Intl.Segmenter` grapheme as one cursor unit. Arrow navigation, backspace, delete, and kill operations cannot split emoji, accents, ZWJ sequences, or CJK characters. In multiline mode Up and Down preserve a display column calculated from grapheme width, including wide terminal glyphs. External controlled updates keep the cursor at the current edit when they correct an emitted value, and move it to the end for an idle replacement.

## Explicit scope providers

Use the normal iterators first. These exports exist for a custom composition outside that hierarchy: `MessageByIndexProvider`, `PartByIndexProvider`, `TextMessagePartProvider`, `MessageAttachmentByIndexProvider`, `ComposerAttachmentByIndexProvider`, `SuggestionByIndexProvider`, `ThreadListItemByIndexProvider`, `ThreadListItemRuntimeProvider`, `ChainOfThoughtByIndicesProvider`, and `ChainOfThoughtPartByIndexProvider`.
