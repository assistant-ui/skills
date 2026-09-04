# ThreadPrimitive

The scrollable message container: viewport management, auto scroll, the messages iterator, and the welcome suggestions grid. `Root` renders a `<div>`, `Viewport` a scrollable `<div>`, and `Messages` iterates the thread's messages, resolved by role and edit state.

## Parts

| Part | Renders | Notes |
|------|---------|-------|
| `.Root` | `<div>` | Top level container; provides thread context. |
| `.Viewport` | `<div>` | Scrollable area with auto scroll. See props below. |
| `.ViewportProvider` | nothing | Viewport context without a scrollable element, for a custom scroll container. |
| `.ViewportFooter` | `<div>` | Sticks to the bottom and registers its height with the auto scroll system. Put the composer here. |
| `.Messages` | list | Renders one component per message via a children render function `{ message }`. |
| `.MessageByIndex` | one message | `index` plus `components={{ Message }}`; memoized on index and `components` identity. |
| `.Unstable_MessageById` | one message | `messageId` plus the same `components` surface; unknown ids render `null`. Experimental. |
| `.ScrollToBottom` | `<button>` | Auto disabled when already at the bottom. |
| `.Suggestions` | list | Renders the current suggestion set. See [suggestions.md](./suggestions.md). |
| `.SuggestionByIndex` | one suggestion | `index` plus `components={{ Suggestion }}`. |
| `.Suggestion` | `<button>` | Self contained suggestion with `prompt` and `send` props (legacy; prefer `Suggestions`). |
| `.Empty` | conditional | Deprecated. Use `AuiIf` with `s.thread.isEmpty`. |
| `.If` | conditional | Deprecated. Use `AuiIf`. |

## Viewport and auto scroll

`Viewport` auto scrolls to the bottom as content streams in, unless the reader has scrolled up manually. Set `autoScroll={false}` to disable it outright.

```tsx
<ThreadPrimitive.Viewport autoScroll={true}>
  {/* messages */}
</ThreadPrimitive.Viewport>
```

With `turnAnchor="top"`, the latest user message anchors to the top of the viewport instead of the reply scrolling the page down, the layout the [Thread](https://www.assistant-ui.com/elements/thread) element uses by default. `MessagePrimitive.Root` registers the top anchor target automatically; no extra component is needed.

```tsx
<ThreadPrimitive.Viewport
  turnAnchor="top"
  topAnchorMessageClamp={{ tallerThan: "10em", visibleHeight: "6em" }}
>
  {/* messages */}
</ThreadPrimitive.Viewport>
```

`topAnchorMessageClamp` controls how much of a long user message stays visible above the growing response: messages shorter than `tallerThan` stay fully visible, taller ones clip to `visibleHeight` of their bottom edge.

Three event specific flags layer on top of `autoScroll` (all default `true`): `scrollToBottomOnRunStart` (fires on `thread.runStart`), `scrollToBottomOnInitialize` (on `thread.initialize`), and `scrollToBottomOnThreadSwitch` (on `threads.selectionChanged`). When `autoScroll` is left unset it defaults to `true` for `turnAnchor="bottom"` and `false` for `turnAnchor="top"`.

```tsx
<ThreadPrimitive.Viewport
  turnAnchor="top"
  autoScroll={false}
  scrollToBottomOnRunStart={true}
  scrollToBottomOnThreadSwitch={true}
  scrollToBottomOnInitialize={false}
>
  <ThreadPrimitive.Messages>
    {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
  </ThreadPrimitive.Messages>
</ThreadPrimitive.Viewport>
```

## ViewportFooter and a custom scroll container

`ViewportFooter` sticks to the bottom and reserves its own height so auto scroll accounts for it, which is where the composer belongs:

```tsx
<ThreadPrimitive.Viewport>
  <ThreadPrimitive.Messages>{() => <MyMessage />}</ThreadPrimitive.Messages>
  <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
    <MyComposer />
  </ThreadPrimitive.ViewportFooter>
</ThreadPrimitive.Viewport>
```

When you own the scroll container yourself (a Radix `ScrollArea`, a virtualized list, see [messages.md](./messages.md)), swap `Viewport` for `ViewportProvider`: it supplies the same context with no scrollable element of its own.

```tsx
<ThreadPrimitive.ViewportProvider>
  <div className="flex-1 overflow-y-auto">
    <ThreadPrimitive.Messages>{() => <MyMessage />}</ThreadPrimitive.Messages>
    <ThreadPrimitive.ViewportFooter>
      <MyComposer />
    </ThreadPrimitive.ViewportFooter>
  </div>
</ThreadPrimitive.ViewportProvider>
```

## Messages iterator

`Messages` takes a children render function over `{ message }` so you can branch on role and edit state inline, including swapping in an edit composer:

```tsx
<ThreadPrimitive.Messages>
  {({ message }) => {
    if (message.composer.isEditing) return <MyEditComposer />;
    if (message.role === "user") return <MyUserMessage />;
    return <MyAssistantMessage />;
  }}
</ThreadPrimitive.Messages>
```

The deprecated `components` prop still works but only accepts a fixed `{ UserMessage, AssistantMessage, EditComposer, ... }` map; prefer `children` for new code, since it lets you inspect the message before choosing a component. For a thread with hundreds or thousands of messages, render by id instead of relying on the built in iterator: see [Virtualization](./messages.md#virtualization).

## ScrollToBottom and Suggestions

```tsx
<ThreadPrimitive.ScrollToBottom className="rounded-full bg-background p-2 shadow-md">
  <ArrowDownIcon />
</ThreadPrimitive.ScrollToBottom>
```

`ScrollToBottom` renders `null` while the viewport is already pinned to the bottom, so it needs no manual visibility check.

```tsx
<ThreadPrimitive.Suggestions>
  {({ suggestion }) => <MySuggestionButton prompt={suggestion.prompt} />}
</ThreadPrimitive.Suggestions>
```

`Suggestions` and `SuggestionByIndex` render whatever the `suggestions` scope currently holds, static welcome prompts or runtime driven follow ups. The full configuration surface, the `SuggestionPrimitive` parts, and the suggestion adapter live in [suggestions.md](./suggestions.md).

## Patterns

### Welcome screen with suggestions

```tsx
<AuiIf condition={(s) => s.thread.isEmpty}>
  <div className="flex flex-col items-center gap-4 text-center">
    <h2>What can I help with?</h2>
    <div className="grid grid-cols-2 gap-2">
      <ThreadPrimitive.Suggestions>{() => <MySuggestionButton />}</ThreadPrimitive.Suggestions>
    </div>
  </div>
</AuiIf>
```

### Turn anchor top layout

```tsx
<ThreadPrimitive.Root className="flex h-full flex-col">
  <ThreadPrimitive.Viewport turnAnchor="top" className="flex-1 overflow-y-auto">
    <ThreadPrimitive.Messages>
      {({ message }) => (message.role === "user" ? <UserMessage /> : <AssistantMessage />)}
    </ThreadPrimitive.Messages>
    <ThreadPrimitive.ViewportFooter className="sticky bottom-0">
      <MyComposer />
    </ThreadPrimitive.ViewportFooter>
  </ThreadPrimitive.Viewport>
</ThreadPrimitive.Root>
```

### Custom message components

```tsx
<ThreadPrimitive.Messages>
  {({ message }) => {
    if (message.role === "user") {
      return (
        <MessagePrimitive.Root>
          <div className="ml-auto rounded-xl bg-blue-500 p-3 text-white">
            <MessagePrimitive.Parts />
          </div>
        </MessagePrimitive.Root>
      );
    }
    return (
      <MessagePrimitive.Root>
        <div className="rounded-xl bg-gray-100 p-3">
          <MessagePrimitive.Parts />
        </div>
      </MessagePrimitive.Root>
    );
  }}
</ThreadPrimitive.Messages>
```

## Common Gotchas

**`ViewportSlack` import fails**
- `ThreadPrimitive.ViewportSlack` was removed from the public API. Top anchor registration is automatic inside `MessagePrimitive.Root` when `turnAnchor="top"`; move any `fillClampThreshold` / `fillClampOffset` customization to `topAnchorMessageClamp` on `Viewport`.

**Welcome screen and skeleton both trying to show at once**
- Treat "no messages" and "still loading" as different states: the [Thread](https://www.assistant-ui.com/elements/thread) element shows the welcome screen only when there are no messages and either nothing is loading or the whole thread list is still loading, and reserves a history skeleton for a thread switch whose own history is still in flight.

**`ThreadPrimitive.Empty` / `.If` render stale content**
- Both are deprecated wrappers around a fixed set of conditions. Replace them with `AuiIf` (`s.thread.isEmpty`, `s.thread.isRunning`, `s.thread.isDisabled`), which accepts any selector over the full assistant state.
