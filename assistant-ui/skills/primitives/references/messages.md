# Message flows and long threads

Messages can be edited and branched without replacing the rest of the primitive tree. This reference covers editing, branch navigation, timing metadata, large thread rendering, scroll behavior, and image parts.

## Contents

- [Editing](#editing)
- [Branching](#branching)
- [Message timing](#message-timing)
- [Virtualization](#virtualization)
- [Scrollbars and scroll behavior](#scrollbars-and-scroll-behavior)
- [Image generation](#image-generation)

## Editing

```tsx
import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
} from "@assistant-ui/react";

function ThreadMessages() {
  return (
    <ThreadPrimitive.Messages>
      {({ message }) => {
        if (message.role === "user" && message.composer.isEditing) {
          return <UserEditComposer />;
        }
        return message.role === "user" ? <UserMessage /> : <AssistantMessage />;
      }}
    </ThreadPrimitive.Messages>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts />
      <ActionBarPrimitive.Root>
        <ActionBarPrimitive.Edit>Edit</ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function UserEditComposer() {
  return (
    <MessagePrimitive.Root>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input />
        <ComposerPrimitive.Cancel>Cancel</ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send>Save</ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function EditButton() {
  const aui = useAui();
  return <button onClick={() => aui.composer.beginEdit()}>Edit</button>;
}
```

`ActionBarPrimitive.Edit` calls `aui.composer.beginEdit()` for the current user message. The edit composer must render within that message's `MessagePrimitive.Root`, where the same composer primitives save the replacement or `Cancel` restores the original text. Editing during an active assistant stream cancels that run and starts a new branch. Use `AuiIf condition={(s) => !s.thread.isRunning}` if the product should block that action.

## Branching

```tsx
import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  MessagePrimitive,
  useAui,
} from "@assistant-ui/react";

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts />
      <BranchPickerPrimitive.Root hideWhenSingleBranch>
        <BranchPickerPrimitive.Previous>Previous</BranchPickerPrimitive.Previous>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
        <BranchPickerPrimitive.Next>Next</BranchPickerPrimitive.Next>
      </BranchPickerPrimitive.Root>
      <ActionBarPrimitive.Root>
        <ActionBarPrimitive.Reload>Regenerate</ActionBarPrimitive.Reload>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function BranchButton({ branchId }: { branchId: string }) {
  const aui = useAui();
  return (
    <button onClick={() => aui.message.switchToBranch({ branchId })}>
      Open branch
    </button>
  );
}
```

Editing a user message and reloading an assistant message create branches. `BranchPickerPrimitive` automatically disables movement at a boundary and while the thread is running unless the runtime supports switching during a run. `aui.message.switchToBranch({ branchId })` needs a `MessagePrimitive.Root` context and a branch id from the current message's branch data.

## Message timing

```tsx
import { useMessageTiming } from "@assistant-ui/react";

function MessageTiming() {
  const timing = useMessageTiming();
  if (!timing?.totalStreamTime) return null;

  return (
    <span>
      {Math.round(timing.totalStreamTime)}ms
      {timing.tokensPerSecond != null && `, ${timing.tokensPerSecond.toFixed(1)} tok/s`}
    </span>
  );
}
```

Use `useMessageTiming` inside an assistant `MessagePrimitive.Root`. It returns `undefined` for a non assistant message or when the runtime has no data. `streamStartTime`, `firstTokenTime`, `totalStreamTime`, `tokenCount`, `tokensPerSecond`, `totalChunks`, and `toolCallCount` support a custom status label. AI SDK runtimes collect elapsed timing automatically, while token throughput requires usage metadata from the route.

## Virtualization

```tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";

const MESSAGE_COMPONENTS = { UserMessage, AssistantMessage };

function VirtualizedMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = useAuiState((s) => s.thread.messages.length);
  const virtualizer = useVirtualizer({
    count: messageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });
  const items = virtualizer.getVirtualItems();
  const paddingTop = items[0]?.start ?? 0;
  const paddingBottom = Math.max(
    0,
    virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0),
  );

  return (
    <ThreadPrimitive.ViewportProvider>
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div style={{ paddingTop, paddingBottom }}>
          {items.map((item) => (
            <div key={item.key} ref={virtualizer.measureElement} data-index={item.index}>
              <ThreadPrimitive.MessageByIndex
                index={item.index}
                components={MESSAGE_COMPONENTS}
              />
            </div>
          ))}
        </div>
      </div>
    </ThreadPrimitive.ViewportProvider>
  );
}
```

Use `@tanstack/react-virtual` only when mounting or updating the full thread is the bottleneck. The virtual rows stay in normal document flow between padding spacers so measured message heights remain correct. A virtualized scroller owns its scroll element, so use `ViewportProvider` instead of `Viewport` and implement the product's auto follow, measurement guard, and run start jump there. The id based `unstable_useThreadMessageIds` and `Unstable_MessageById` pairing is more resilient to insertions, but `MessageByIndex` is appropriate when a virtual row already has a stable index.

## Scrollbars and scroll behavior

```tsx
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import { ScrollBar } from "@/components/ui/scroll-area";
import { ThreadPrimitive } from "@assistant-ui/react";

function ScrollableThread() {
  return (
    <ScrollAreaPrimitive.Root asChild>
      <ThreadPrimitive.Root className="flex h-full flex-col">
        <ScrollAreaPrimitive.Viewport asChild className="thread-viewport">
          <ThreadPrimitive.Viewport
            turnAnchor="top"
            autoScroll={false}
            scrollToBottomOnRunStart
            scrollToBottomOnThreadSwitch
            scrollToBottomOnInitialize={false}
          >
            <ThreadPrimitive.Messages>{() => <Message />}</ThreadPrimitive.Messages>
            <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
              <ThreadPrimitive.ScrollToBottom>Jump to latest</ThreadPrimitive.ScrollToBottom>
              <Composer />
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
      </ThreadPrimitive.Root>
    </ScrollAreaPrimitive.Root>
  );
}
```

`Viewport` follows streamed content unless the reader has scrolled up. `autoScroll` defaults to `true` for `turnAnchor="bottom"` and `false` for `turnAnchor="top"`; `scrollToBottomOnRunStart`, `scrollToBottomOnInitialize`, and `scrollToBottomOnThreadSwitch` control those explicit events. `ScrollToBottom` is hidden when the viewport is already pinned. A Radix scroll area needs its viewport wrapped with `asChild`, and its intermediate content node needs the layout styles described in the [custom scrollbar guide](https://www.assistant-ui.com/docs/guides/scrollbar).

## Image generation

```tsx
import { Image } from "@/components/assistant-ui/elements/image";
import { MessagePrimitive } from "@assistant-ui/react";

function AssistantImageMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts components={{ Image }} />
    </MessagePrimitive.Root>
  );
}
```

Store a generated URL or data URI as an `image` message part. The local `Image` renderer handles running, content filter, preview, and zoom states; `Image.Actions` adds copy, download, and optional regeneration controls. Import it from `@/components/assistant-ui/elements/image`, never from `@assistant-ui/ui`. The image-generation guide's package import is stale relative to the current element contract.
