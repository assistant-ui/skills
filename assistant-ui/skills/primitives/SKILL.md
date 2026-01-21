---
name: primitives
description: Guide for assistant-ui UI primitives - ThreadPrimitive, ComposerPrimitive, MessagePrimitive. Use when customizing chat UI components.
version: 0.0.1
license: MIT
---

# assistant-ui Primitives

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Composable, unstyled components following Radix UI patterns.

## References

- [./references/thread.md](./references/thread.md) -- ThreadPrimitive deep dive
- [./references/composer.md](./references/composer.md) -- ComposerPrimitive deep dive
- [./references/message.md](./references/message.md) -- MessagePrimitive deep dive
- [./references/action-bar.md](./references/action-bar.md) -- ActionBarPrimitive deep dive

## Import Pattern

```tsx
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  AttachmentPrimitive,
  ThreadListPrimitive,
  ThreadListItemPrimitive,
} from "@assistant-ui/react";
```

## Component Overview

| Primitive | Purpose | Key Parts |
|-----------|---------|-----------|
| `ThreadPrimitive` | Thread container | `.Root`, `.Viewport`, `.Messages` |
| `ComposerPrimitive` | Input form | `.Root`, `.Input`, `.Send` |
| `MessagePrimitive` | Message display | `.Root`, `.Content`, `.Avatar` |
| `ActionBarPrimitive` | Message actions | `.Copy`, `.Edit`, `.Reload` |
| `BranchPickerPrimitive` | Navigate edits | `.Previous`, `.Next`, `.Count` |
| `AttachmentPrimitive` | File attachments | `.Root`, `.Name`, `.Remove` |
| `ThreadListPrimitive` | Thread list | `.Root`, `.Items`, `.New` |

## Complete Custom Thread

```tsx
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
} from "@assistant-ui/react";

function CustomThread() {
  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      {/* Empty state */}
      <ThreadPrimitive.Empty>
        <div className="flex-1 flex items-center justify-center">
          <p>Start a conversation</p>
        </div>
      </ThreadPrimitive.Empty>

      {/* Messages */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4">
        <ThreadPrimitive.Messages
          components={{
            UserMessage: CustomUserMessage,
            AssistantMessage: CustomAssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      {/* Scroll to bottom */}
      <ThreadPrimitive.ScrollToBottom className="absolute bottom-20 right-4">
        ↓
      </ThreadPrimitive.ScrollToBottom>

      {/* Composer */}
      <ComposerPrimitive.Root className="border-t p-4 flex gap-2">
        <ComposerPrimitive.Input
          className="flex-1 rounded-lg border px-4 py-2"
          placeholder="Type a message..."
        />
        <ComposerPrimitive.Send className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Send
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

function CustomUserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end mb-4">
      <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%]">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
}

function CustomAssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex mb-4">
      <MessagePrimitive.Avatar
        src="/ai-avatar.png"
        fallback="AI"
        className="w-8 h-8 rounded-full mr-2"
      />
      <div className="bg-gray-100 rounded-lg px-4 py-2 max-w-[80%]">
        <MessagePrimitive.Content />
        <ActionBarPrimitive.Root className="flex gap-2 mt-2">
          <ActionBarPrimitive.Copy className="text-gray-500 hover:text-gray-700">
            Copy
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload className="text-gray-500 hover:text-gray-700">
            Regenerate
          </ActionBarPrimitive.Reload>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}
```

## Conditional Rendering

Use `.If` for conditional content:

```tsx
// Message conditions
<MessagePrimitive.If user>Only for user messages</MessagePrimitive.If>
<MessagePrimitive.If assistant>Only for assistant</MessagePrimitive.If>
<MessagePrimitive.If running>While generating</MessagePrimitive.If>
<MessagePrimitive.If hasBranches>Has edit history</MessagePrimitive.If>

// Composer conditions
<ComposerPrimitive.If submitting>
  <ComposerPrimitive.Cancel>Stop</ComposerPrimitive.Cancel>
</ComposerPrimitive.If>
<ComposerPrimitive.If notSubmitting>
  <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
</ComposerPrimitive.If>

// Thread conditions
<ThreadPrimitive.If empty>No messages yet</ThreadPrimitive.If>
<ThreadPrimitive.If running>Generating...</ThreadPrimitive.If>
```

## Message Content Parts

```tsx
<MessagePrimitive.Content
  components={{
    Text: ({ part }) => <p>{part.text}</p>,
    Image: ({ part }) => <img src={part.image} alt="" />,
    ToolCall: ({ part }) => (
      <div>Tool: {part.toolName}</div>
    ),
    Reasoning: ({ part }) => (
      <details>
        <summary>Thinking...</summary>
        {part.reasoning}
      </details>
    ),
    Source: ({ part }) => (
      <a href={part.source.url}>{part.source.title}</a>
    ),
  }}
/>
```

## ThreadListPrimitive

```tsx
<ThreadListPrimitive.Root className="w-64 border-r">
  <ThreadListPrimitive.New className="p-2 w-full">
    + New Chat
  </ThreadListPrimitive.New>

  <ThreadListPrimitive.Items>
    <ThreadListItemPrimitive.Root className="p-2 hover:bg-gray-100">
      <ThreadListItemPrimitive.Trigger className="flex-1">
        <ThreadListItemPrimitive.Title />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Archive>Archive</ThreadListItemPrimitive.Archive>
      <ThreadListItemPrimitive.Delete>Delete</ThreadListItemPrimitive.Delete>
    </ThreadListItemPrimitive.Root>
  </ThreadListPrimitive.Items>
</ThreadListPrimitive.Root>
```

## Attachments

```tsx
<ComposerPrimitive.Root>
  {/* Drag-drop zone */}
  <ComposerPrimitive.AttachmentDropzone className="border-2 border-dashed p-4">
    Drop files here
  </ComposerPrimitive.AttachmentDropzone>

  {/* Show attached files */}
  <ComposerPrimitive.Attachments>
    <AttachmentPrimitive.Root className="flex items-center gap-2">
      <AttachmentPrimitive.Name />
      <AttachmentPrimitive.Remove>×</AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  </ComposerPrimitive.Attachments>

  <div className="flex gap-2">
    <ComposerPrimitive.AddAttachment className="p-2">
      📎
    </ComposerPrimitive.AddAttachment>
    <ComposerPrimitive.Input />
    <ComposerPrimitive.Send />
  </div>
</ComposerPrimitive.Root>
```

## Branch Picker (Edit History)

```tsx
<MessagePrimitive.If hasBranches>
  <BranchPickerPrimitive.Root className="flex items-center gap-1">
    <BranchPickerPrimitive.Previous>←</BranchPickerPrimitive.Previous>
    <span>
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next>→</BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
</MessagePrimitive.If>
```

## Speech Features

```tsx
<ComposerPrimitive.Root>
  <ComposerPrimitive.Input />

  {/* Voice input */}
  <ComposerPrimitive.If notDictating>
    <ComposerPrimitive.Dictate>🎤</ComposerPrimitive.Dictate>
  </ComposerPrimitive.If>
  <ComposerPrimitive.If dictating>
    <ComposerPrimitive.StopDictation>⏹️</ComposerPrimitive.StopDictation>
  </ComposerPrimitive.If>
</ComposerPrimitive.Root>

{/* Text-to-speech on messages */}
<ActionBarPrimitive.Root>
  <ActionBarPrimitive.If notSpeaking>
    <ActionBarPrimitive.Speak>🔊</ActionBarPrimitive.Speak>
  </ActionBarPrimitive.If>
  <ActionBarPrimitive.If speaking>
    <ActionBarPrimitive.StopSpeaking>⏹️</ActionBarPrimitive.StopSpeaking>
  </ActionBarPrimitive.If>
</ActionBarPrimitive.Root>
```

## Common Gotchas

**Primitives not rendering**
- Ensure wrapped in `AssistantRuntimeProvider`
- Check that parent primitive provides context (e.g., `.Content` needs to be inside `.Root`)

**Custom components not receiving props**
- Primitives use composition, not prop drilling
- Access data via hooks: `useMessage()`, `useComposer()`

**Styles not applying**
- Primitives are unstyled by default
- Add your own className or use `@assistant-ui/styles`
