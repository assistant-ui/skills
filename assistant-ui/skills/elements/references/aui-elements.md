# Runtime-connected elements

Every element below reads the nearest `AssistantRuntimeProvider` (or an `AuiProvider` whose config supplies the scope it needs) instead of taking that state as props. Install with `npx assistant-ui@latest add <item>`; each lands in `components/assistant-ui/elements/` and, unless noted otherwise, imports from the `.aui` file. See [../SKILL.md](../SKILL.md) for the install flow and slot-override pattern, and [./catalog.md](./catalog.md) for the full element list.

## Contents

- [Thread](#thread)
- [ThreadList](#threadlist)
- [ThreadListSidebar](#threadlistsidebar)
- [AssistantModal](#assistantmodal)
- [AssistantSidebar](#assistantsidebar)
- [ToolFallback](#toolfallback)
- [ToolGroup](#toolgroup)
- [Reasoning](#reasoning)
- [Sources](#sources)
- [Attachment](#attachment)
- [Image](#image)
- [File](#file)
- [Quote](#quote)
- [ModelSelector](#modelselector)
- [Voice (orb)](#voice-orb)
- [MessageTiming](#messagetiming)
- [ContextDisplay](#contextdisplay)
- [FollowUpSuggestions](#followupsuggestions)
- [DirectiveText](#directivetext)
- [ComposerTriggerPopover](#composertriggerpopover)
- [McpConfig](#mcpconfig)
- [ConversationMap](#conversationmap)
- [MarkdownText](#markdowntext)
- [ShikiHighlighter](#shikihighlighter)
- [SyntaxHighlighter](#syntaxhighlighter)
- [MermaidDiagram](#mermaiddiagram)
- [GenerativeUI](#generativeui)

## Thread

```bash
npx assistant-ui@latest add thread
```

Import from `@/components/assistant-ui/elements/thread.aui`. `Thread` is the complete chat surface: welcome screen, history skeleton, message list, scroll to bottom pill, follow up suggestions, and composer, all wired to the nearest runtime. It takes `components` (a `ThreadComponents` slot map: `AssistantMessage`, `Welcome`, `ToolFallback`, `ToolGroup`, `ReasoningGroup`) and `autoFocus` (default `true`, focuses the composer on mount, run start, thread switch, and scroll to bottom). It composes `ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`, `ActionBarPrimitive`, `ActionBarMorePrimitive`, `BranchPickerPrimitive`, and `AuiIf`, and reads `s.thread.isRunning`, `s.thread.capabilities.dictation`, `s.composer.isEmpty`, `s.composer.dictation`, `s.message.role`, `s.message.composer.isEditing`, and `s.message.isCopied`. It needs nothing beyond a runtime provider higher up the tree; there is no standalone form, since the welcome, loading, and streaming states are all derived from live thread state.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function Chat() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## ThreadList

```bash
npx assistant-ui@latest add thread-list
```

Import from `@/components/assistant-ui/elements/thread-list.aui`. `ThreadList` takes no props of its own; it composes `ThreadListPrimitive` (`Root`, `New`, `ItemByIndex`, grouping items into Today, Yesterday, and Earlier by `lastMessageAt`), `ThreadListItemPrimitive` (`Root`, `Trigger`, `Title`, `Archive`, `Delete`), and `ThreadListItemMorePrimitive` (`Root`, `Trigger`, `Content`, `Item`, folded into the list's own keyboard focus group). It reads `s.threads.threadIds`, `s.threads.threadItems`, `s.threads.isLoading`, `s.threadListItem.id`, `s.threadListItem.title`, and `s.threadListItem.isRunning`, and calls `aui.threads.item({ id }).rename(title)`. It renders correctly against a bare `useChatRuntime()`, which starts with one thread; a runtime whose thread list is populated from persisted history (for example an `assistant-cloud` backed runtime) is what makes the search box, grouping, and multiple rows meaningful.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function Chat() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh">
        <ThreadList />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

## ThreadListSidebar

```bash
npx assistant-ui@latest add threadlist-sidebar
```

Import from `@/components/assistant-ui/elements/threadlist-sidebar.aui` (note the file has no dash between `thread` and `list`, unlike the registry item's URL slug). `ThreadListSidebarProps` extends `React.ComponentProps<typeof Sidebar>`, forwarding every prop; the notable ones are `side` (`"left" | "right"`, default `"left"`), `variant` (`"sidebar" | "floating" | "inset"`, default `"sidebar"`), and `collapsible` (`"offcanvas" | "icon" | "none"`, default `"offcanvas"`, which also removes the collapse rail). It composes `Sidebar`, `SidebarHeader`, `SidebarContent` (holding `ThreadList`), `SidebarRail`, and `SidebarFooter` from `@/components/ui/resizable`-adjacent shadcn sidebar primitives; the header and footer links are placeholders meant to be replaced. It needs the same populated thread list as `ThreadList` above, and the standard shadcn `SidebarProvider` ancestor that the underlying `Sidebar` primitive expects.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { ThreadListSidebar } from "@/components/assistant-ui/elements/threadlist-sidebar.aui";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function Chat() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh">
        <ThreadListSidebar />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

## AssistantModal

```bash
npx assistant-ui@latest add assistant-modal
```

Import from `@/components/assistant-ui/elements/assistant-modal.aui`. `AssistantModal` takes no props; it wraps `Thread` in a popover anchored bottom end, triggered by a floating button. It composes `Thread` and a popover primitive, and it listens for the `thread.runStart` event through `aui.on("thread.runStart", ...)` to auto expand once the first message sends. Class hooks `aui-modal-anchor`, `aui-modal-content`, and `aui-modal-button` are available for restyling. It needs nothing beyond a runtime provider.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantModal } from "@/components/assistant-ui/elements/assistant-modal.aui";

export default function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
      <AssistantModal />
    </AssistantRuntimeProvider>
  );
}
```

## AssistantSidebar

```bash
npx assistant-ui@latest add assistant-sidebar
```

Import from `@/components/assistant-ui/elements/assistant-sidebar.aui`. `AssistantSidebarProps` takes one required prop, `children` (rendered in the left pane). It composes `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle` (a thin wrapper over `react-resizable-panels`, every one of its props including `defaultSize`, `minSize`, `maxSize`, and `order` forwards through) around your `children` on the left and `Thread` on the right; neither panel sets a default size, so the split starts even. It needs nothing beyond a runtime provider.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantSidebar } from "@/components/assistant-ui/elements/assistant-sidebar.aui";

export default function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantSidebar>{children}</AssistantSidebar>
    </AssistantRuntimeProvider>
  );
}
```

## ToolFallback

```bash
npx assistant-ui@latest add tool-fallback
```

Import from `@/components/assistant-ui/elements/tool-fallback.aui`. `ToolFallback` is the default export, a complete `ToolCallMessagePartComponent` built from `ToolFallbackRoot` (a `Collapsible` that opens automatically on `"requires-action"`), `ToolFallbackTrigger`, `ToolFallbackContent`, `ToolFallbackArgs`, `ToolFallbackResult`, `ToolFallbackError`, and `ToolFallbackApproval`, all exported individually for a custom layout. It receives the tool call's `toolCallId`, `toolName`, `argsText`, `result`, `isError`, `status`, `timing`, `interrupt`, and `approval`, plus the `addResult`, `resume`, and `respondToApproval` callbacks; `useToolCallElapsed()` reads the running elapsed time from inside it. It needs no adapter, only a tool call in the stream with no dedicated renderer of its own; `Thread`'s `components.ToolFallback` slot is what swaps it out.

```tsx
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { MyToolCard } from "./my-tool-card";

export function Chat() {
  return <Thread components={{ ToolFallback: MyToolCard }} />;
}
```

## ToolGroup

```bash
npx assistant-ui@latest add tool-group
```

Import from `@/components/assistant-ui/elements/tool-group.aui`. `ToolGroupRoot` (a `Collapsible` accepting `variant`, `open`, `onOpenChange`, `defaultOpen`), `ToolGroupTrigger` (`count`, `active`), and `ToolGroupContent` compose the collapsible wrapper `Thread` places around consecutive tool calls in one assistant turn; `group.status` and `group.indices` (whose length is the tool count) drive the trigger's label and spinner. It needs no adapter, only two or more consecutive tool calls; override the composition everywhere with `Thread`'s `components.ToolGroup` slot, which receives the same `group` and pre-rendered `children`.

```tsx
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export function Chat() {
  return (
    <Thread
      components={{
        ToolGroup: ({ group, children }) => (
          <MyToolGroup running={group.status.type === "running"} count={group.indices.length}>
            {children}
          </MyToolGroup>
        ),
      }}
    />
  );
}
```

## Reasoning

```bash
npx assistant-ui@latest add reasoning
```

Import from `@/components/assistant-ui/elements/reasoning.aui`. `Reasoning` is a `ReasoningMessagePartComponent` that renders one ungrouped reasoning part's `text` as markdown with no disclosure chrome; `ReasoningRoot`, `ReasoningTrigger`, `ReasoningContent`, `ReasoningText`, and `ReasoningFade` (re-exported from the standalone module, with `ReasoningRoot` additionally locking the thread viewport's scroll during the disclosure animation) build the collapsible trace around consecutive parts. It reads the reasoning part's own `text`, `status`, and `unstable_summary` fields rather than global state selectors. Group consecutive reasoning parts with `MessagePrimitive.GroupedParts` and `groupPartByType`, the same composition `Thread` itself uses; the kit's own `ReasoningGroup` export targets an older `components.ReasoningGroup` prop and should be avoided in new code. It needs a model or runtime that streams `reasoning` parts; `Thread` already ships this composition, so most apps never call these pieces directly.

```tsx
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import {
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";

<MessagePrimitive.GroupedParts groupBy={groupPartByType({ reasoning: ["group-reasoning"] })}>
  {({ part, children }) => {
    if (part.type !== "group-reasoning") return null;
    const running = part.status.type === "running";
    return (
      <ReasoningRoot streaming={running}>
        <ReasoningTrigger active={running} />
        <ReasoningContent aria-busy={running}>
          <ReasoningText>{children}</ReasoningText>
        </ReasoningContent>
      </ReasoningRoot>
    );
  }}
</MessagePrimitive.GroupedParts>;
```

## Sources

```bash
npx assistant-ui@latest add sources
```

Import from `@/components/assistant-ui/elements/sources.aui`. `Sources` is the `Source` message part renderer, passed to `MessagePrimitive.Parts` as `components.Source`; `Sources.Root` (the link for a `url` source, accepting `variant`, `size`, `href`), `Sources.Icon` (favicon, with an optional `faviconUrl` resolver, falling back to a single letter), and `Sources.Title` (truncated title or domain) are exported for a custom renderer. It reads the source part's own `sourceType`, `id`, `url`, `title`, `mediaType`, and `filename` fields. It needs the model or backend to actually emit `source` parts, for example a web search tool or a retrieval backend that reports citations; a `document` source never links out, and a `url` source with an empty `url` renders nothing.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { Sources } from "@/components/assistant-ui/elements/sources.aui";

<MessagePrimitive.Parts components={{ Source: Sources }} />;
```

## Attachment

```bash
npx assistant-ui@latest add attachment
```

Import from `@/components/assistant-ui/elements/attachment.aui`. `ComposerAttachments` (wraps `ComposerPrimitive.Attachments`), `ComposerAddAttachment` (wraps `ComposerPrimitive.AddAttachment`, renders `null` while the composer is not editable), and `UserMessageAttachments` (wraps `MessagePrimitive.Attachments`) compose `AttachmentPrimitive.Root`, `.Name`, and `.Remove`, plus `ComposerPrimitive.AttachmentDropzone`. It reads `s.attachment.type`, `s.attachment.name`, `s.attachment.status.type`, and `aui.attachment.source`. It needs an `AttachmentAdapter` (or a `CompositeAttachmentAdapter` combining `SimpleImageAttachmentAdapter`, `SimpleTextAttachmentAdapter`, or `CloudFileAttachmentAdapter`) registered under `adapters.attachments` on the runtime hook; `s.thread.capabilities.attachments` reflects whether one is configured, and without one the dropzone and add button no-op.

```tsx
import { ComposerPrimitive, MessagePrimitive } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";

const runtime = useChatRuntime({
  adapters: { attachments: myAttachmentAdapter },
});

function Composer() {
  return (
    <ComposerPrimitive.Root>
      <ComposerPrimitive.AttachmentDropzone>
        <ComposerAttachments />
        <ComposerPrimitive.Input placeholder="Send a message..." />
        <ComposerAddAttachment />
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <UserMessageAttachments />
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}
```

## Image

```bash
npx assistant-ui@latest add image
```

Import from `@/components/assistant-ui/elements/image` (no `.aui` suffix; it is a message part renderer, not a scope reader). `Image` is the `Image` message part renderer, passed to `MessagePrimitive.Parts` as `components.Image`; `Image.Root` (`variant`, `size`), `Image.Preview`, `Image.Zoom`, `Image.Filename`, `Image.Generating`, `Image.ContentFilterError`, and `Image.Actions` (download, copy, and an optional regenerate button, not rendered by default) are exported individually. It reads the image part's `image`, `filename`, and `status` fields. It needs the model or backend to emit `image` parts, for example an image generation tool; `status.type === "running"` shows the generating placeholder and a `content-filter` incomplete reason shows the blocked message.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { Image } from "@/components/assistant-ui/elements/image";

<MessagePrimitive.Parts components={{ Image }} />;
```

## File

```bash
npx assistant-ui@latest add file
```

Import from `@/components/assistant-ui/elements/file` (no `.aui` suffix). `File` is the `File` message part renderer, passed to `MessagePrimitive.Parts` as `components.File`; `File.Root` (`variant`, `size`), `File.Icon` (chosen from `mimeType`), `File.Name`, `File.Size`, and `File.Download` (renders nothing when `data` cannot produce a safe `href`) are exported individually. It reads the file part's `filename`, `data`, `mimeType`, and `sourceType` fields. It needs the backend to emit `file` parts; the download link only renders for base64 or `data:` URI payloads, or a URL that starts with `http(s)://` or `blob:`.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { File } from "@/components/assistant-ui/elements/file";

<MessagePrimitive.Parts components={{ File }} />;
```

## Quote

```bash
npx assistant-ui@latest add quote
```

Import from `@/components/assistant-ui/elements/quote.aui`. `QuoteBlock` (typed as a `QuoteMessagePartComponent`, usable as `components.Quote`) renders the quote attached to a message; `SelectionToolbar.Root` and `.Quote` mount a floating toolbar while a text selection resolves to exactly one message; `ComposerQuotePreview.Root`, `.Icon`, `.Text`, and `.Dismiss` show the pending quote inside the composer. It reads `s.composer.quote` and calls `useMessageQuote()` and `aui.composer.setQuote(quote)`. It needs no special adapter; on the server, `injectQuoteContext(messages)` from `@assistant-ui/ai-sdk` prepends each quoted user message's text as a blockquote before `convertToModelMessages`.

```tsx
import { MessagePrimitive, ThreadPrimitive, ComposerPrimitive } from "@assistant-ui/react";
import {
  ComposerQuotePreview,
  QuoteBlock,
  SelectionToolbar,
} from "@/components/assistant-ui/elements/quote.aui";

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <QuoteBlock />
      <MessagePrimitive.Parts />
      <SelectionToolbar.Root>
        <SelectionToolbar.Quote />
      </SelectionToolbar.Root>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root>
      <ComposerQuotePreview.Root>
        <ComposerQuotePreview.Text />
        <ComposerQuotePreview.Dismiss />
      </ComposerQuotePreview.Root>
      <ComposerPrimitive.Input />
    </ComposerPrimitive.Root>
  );
}
```

## ModelSelector

```bash
npx assistant-ui@latest add model-selector
```

Import from `@/components/assistant-ui/elements/model-selector.aui`. `ModelSelector` takes `models` (required `ModelOption[]`, each `{ id, name, description?, icon?, disabled?, keywords?, efforts? }`), `value` / `defaultValue`, `onValueChange`, `effort` / `defaultEffort`, `onEffortChange`, `searchable` (default `false`), `variant`, `size`, `align`, and `className` / `contentClassName`. It composes `ModelSelectorRoot` and the re-exported `ModelSelectorTrigger`, `ModelSelectorValue`, `ModelSelectorContent`, `ModelSelectorSearch`, `ModelSelectorList`, `ModelSelectorGroup`, `ModelSelectorItem`, and `ModelSelectorEffort`. On selection it calls `aui.modelContext.register()` with `config.modelName` (and `config.reasoningEffort` when supported); it needs `AssistantChatTransport` from `@assistant-ui/ai-sdk` to forward `config` in the request body, and a server route that reads `config.modelName` and `config.reasoningEffort` back out.

```tsx
import { ModelSelector, type ModelOption } from "@/components/assistant-ui/elements/model-selector.aui";

const MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet", efforts: true },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
];

export function ModelPicker() {
  return <ModelSelector models={MODELS} searchable />;
}
```

## Voice (orb)

```bash
npx assistant-ui@latest add voice
```

Import from `@/components/assistant-ui/elements/voice.aui`. `VoiceOrb` (an animated canvas that derives `state` and `volume` from the session unless overridden) and `VoiceControl` (status dot plus connect, "Connecting...", mute, and disconnect, switched by session status) compose `VoiceStatusDot`, `VoiceConnectButton`, `VoiceMuteButton`, and `VoiceDisconnectButton`, all exported independently; `deriveVoiceOrbState(voiceState)` exposes the state resolution logic. It reads `s.thread.capabilities.voice`, `s.thread.voice`, `s.thread.voice?.status.type`, `s.thread.voice?.isMuted`, `s.thread.voice?.mode`, and calls `useVoiceVolume()` and `useVoiceControls()`. It needs a `RealtimeVoiceAdapter` registered under `adapters.voice` on the runtime hook; nothing renders correctly without one.

```tsx
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { AuiIf } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { VoiceControl, VoiceOrb } from "@/components/assistant-ui/elements/voice.aui";

const runtime = useChatRuntime({
  adapters: { voice: myVoiceAdapter },
});

export default function Chat() {
  return (
    <div className="flex h-full flex-col">
      <AuiIf condition={(s) => s.thread.capabilities.voice}>
        <VoiceOrb />
        <VoiceControl />
      </AuiIf>
      <Thread />
    </div>
  );
}
```

## MessageTiming

```bash
npx assistant-ui@latest add message-timing
```

Import from `@/components/assistant-ui/elements/message-timing.aui`. `MessageTiming` takes `className` and `side` (`"top" | "right" | "bottom" | "left"`, default `"right"`); it renders `null` until `totalStreamTime` is set, so a still streaming message shows nothing rather than a placeholder. It reads `s.message.metadata.timing` (equivalently `useMessageTiming()`), which carries `streamStartTime`, `firstTokenTime?`, `totalStreamTime?`, `tokenCount?`, `tokensPerSecond?`, `totalChunks`, and `toolCallCount`. It needs no adapter beyond a runtime that records timing metadata, which `@assistant-ui/ai-sdk`'s chat runtime does automatically.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { MessageTiming } from "@/components/assistant-ui/elements/message-timing.aui";

function AssistantMessage() {
  return (
    <div>
      <MessagePrimitive.Parts />
      <MessageTiming side="top" />
    </div>
  );
}
```

## ContextDisplay

```bash
npx assistant-ui@latest add context-display
```

Import from `@/components/assistant-ui/elements/context-display.aui`. `ContextDisplay.Ring`, `ContextDisplay.Bar`, and `ContextDisplay.Text` are the three presets, each taking `modelContextWindow` (required), `className`, `side` (default `"top"`), and an optional `usage` override; `ContextDisplay.Root`, `.Trigger`, and `.Content` compose a custom layout from the same pieces. It reads `useThreadTokenUsage()` (extracted from the latest assistant message's `metadata.usage` or summed `metadata.steps`) and `s.threadListItem.id` as the running total's reset key. It needs no adapter beyond `@assistant-ui/ai-sdk`'s usage reporting; `Root` renders nothing until usage exists.

```tsx
import { ContextDisplay } from "@/components/assistant-ui/elements/context-display.aui";

<ContextDisplay.Bar modelContextWindow={128000} />;
```

## FollowUpSuggestions

```bash
npx assistant-ui@latest add follow-up-suggestions
```

Import from `@/components/assistant-ui/elements/follow-up-suggestions.aui`. `ThreadFollowupSuggestions` takes no props; it composes `ThreadPrimitive.Suggestion` (one chip per suggestion, taking `prompt` and `send`) in a horizontally scrolling row. It reads `s.thread.suggestions` (`{ prompt, title?, label? }[]`), `s.thread.isEmpty`, and `s.thread.isRunning`; the row renders only once the thread is non-empty, idle, and has at least one suggestion. It needs the runtime's `suggestions` option configured through `AuiConfig({ suggestions: Suggestions([...]) })`.

```tsx
import { AssistantRuntimeProvider, AuiConfig, Suggestions } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const config = AuiConfig({
    suggestions: Suggestions(["What's the weather?", "Tell me a joke"]),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## DirectiveText

```bash
npx assistant-ui@latest add directive-text
```

Import from `@/components/assistant-ui/elements/directive-text.aui`. `DirectiveText` is a ready to use `TextMessagePartComponent` that parses assistant-ui's default `:type[label]{name=id}` mention syntax into inline chips, passed to `MessagePrimitive.Parts` as `components.Text`; `createDirectiveText(formatter, options?)` builds a custom one around any `DirectiveTextFormatter` (an object with a `parse(text)` method), with `options.iconMap` and `options.fallbackIcon` controlling per type icons. It reads the text as segments of `kind: "text" | "mention"`, each mention carrying `type`, `label`, and `id`. It needs message text that actually contains directive syntax; text with no matches renders as the bare string with no wrapper.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { DirectiveText } from "@/components/assistant-ui/elements/directive-text.aui";

<MessagePrimitive.Parts components={{ Text: DirectiveText }} />;
```

## ComposerTriggerPopover

```bash
npx assistant-ui@latest add composer-trigger-popover
```

Import from `@/components/assistant-ui/elements/composer-trigger-popover.aui`. `ComposerTriggerPopover` takes `char` (required trigger character), `matcher`, `adapter` (required), `directive` or `action` (mutually exclusive: insert a directive chip, or fire a handler), `iconMap`, `fallbackIcon`, `backLabel`, `emptyCategoriesLabel`, `emptyItemsLabel`, `isLoading`, and `loadingLabel`. It needs an `Unstable_TriggerAdapter` (`categories()`, `categoryItems(id)`, optional `search(query)`), typically built with `unstable_useMentionAdapter`, `unstable_useSlashCommandAdapter`, or `unstable_useLiveCompletionAdapter`; while a popover is open it also drives `aria-controls` and `aria-activedescendant` on the nearest `ComposerPrimitive.Input`.

```tsx
import { ComposerTriggerPopover, unstable_useSlashCommandAdapter } from "@/components/assistant-ui/elements/composer-trigger-popover.aui";

function ComposerCommands() {
  const { adapter, action } = unstable_useSlashCommandAdapter({
    commands: [{ id: "clear", label: "Clear chat", execute: () => clearThread() }],
  });

  return <ComposerTriggerPopover char="/" adapter={adapter} action={action} />;
}
```

## McpConfig

```bash
npx assistant-ui@latest add mcp-config
```

Import from `@/components/assistant-ui/elements/mcp-config.aui`. `McpConfigDialog` takes one optional prop, `children` (a custom trigger element; with none it renders its own outlined plug icon button). It composes `McpManagerPrimitive` (`Root`, `Connectors`, `CustomServers`, `AddCustomTrigger`), `McpServerPrimitive` (`Root`, `Name`, `ConnectButton`, `OAuthLink`, `DisconnectButton`, `RemoveButton`, plus `Status`, `Error`, `Icon`, `Tools`, `ToolName` for a more detailed view), and `McpAddFormPrimitive` (`Root`, `NameField`, `UrlField`, `AuthSelect`, `AuthFields`, `Submit`, `Cancel`, `Error`). It reads `s.mcp.isHydrated`, `s.mcp.connectors`, `s.mcp.customServers`, `s.mcpServer.connectionState`, `s.mcpServer.lastError`, and `s.mcpServer.authorizationUrl`, and calls `aui.mcp.addCustomServer(input)`, `aui.mcp.removeServer(id)`, and `aui.mcpServer.connect()` / `.disconnect()` / `.remove()`. It needs the `mcp` scope mounted with `McpManagerResource` from `@assistant-ui/react-mcp`, registered through `AuiConfig` alongside the runtime the same way `tools` is, not through `useAui({ ... })` (which takes no arguments in current versions).

```tsx
import { AssistantRuntimeProvider, AuiConfig } from "@assistant-ui/react";
import { McpManagerResource } from "@assistant-ui/react-mcp";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { McpConfigDialog } from "@/components/assistant-ui/elements/mcp-config.aui";

const config = AuiConfig({
  mcp: McpManagerResource({
    connectors: [
      { id: "linear", name: "Linear", url: "https://mcp.linear.app/mcp", auth: { type: "oauth" } },
    ],
  }),
});

export function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <McpConfigDialog />
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## ConversationMap

```bash
npx assistant-ui@latest add conversation-map
```

The catalog lists `conversation-map` as a runtime-connected element (registry item `conversation-map`, installed to `components/assistant-ui/elements/conversation-map.aui.tsx`, import path `@/components/assistant-ui/elements/conversation-map.aui`), but its docs page is not part of this snapshot: `catalog.md`'s own row for it carries no description, and no `elements/conversation-map.mdx` exists among the source pages. This reference does not guess its props, slots, primitives, or state selectors; confirm them against the live page at [assistant-ui.com/elements/conversation-map](https://www.assistant-ui.com/elements/conversation-map) before using it. See [thread-list](../../thread-list/SKILL.md) for the related `thread-search` and `threadlist-sidebar` elements that do have full references.

## MarkdownText

```bash
npx assistant-ui@latest add markdown-text
```

Import from `@/components/assistant-ui/elements/markdown-text` (no `.aui` suffix). `MarkdownText` takes one prop, `components` (merged onto the default element renderers for `h1` through `h6`, `p`, `a`, `blockquote`, `ul`, `ol`, `hr`, `table`, `th`, `td`, `tr`, `li`, `strong`, `sup`, `pre`, `code`, and `CodeHeader`; missing keys fall back to the defaults, and `SyntaxHighlighter` defaults to plain, unhighlighted code). There is no `className` prop, and `smooth` and `defer` are fixed on. It composes `MarkdownTextPrimitive`, which reads the current message part through `useMessagePartText()` and must render inside a text or reasoning part scope. It needs no adapter; register it as the text renderer, and set `components.SyntaxHighlighter` to `ShikiHighlighter` or `SyntaxHighlighter` for highlighted code fences.

```tsx
import { MessagePrimitive } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { ShikiHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter.aui";

<MessagePrimitive.Parts
  components={{
    Text: () => <MarkdownText components={{ SyntaxHighlighter: ShikiHighlighter }} />,
  }}
/>;
```

## ShikiHighlighter

```bash
npx assistant-ui@latest add shiki-highlighter
```

Import from `@/components/assistant-ui/elements/shiki-highlighter.aui` (it carries the `.aui` suffix even though it is used as a renderer, since it reads the current message part's streaming status). It takes `code` (required), `language` (required, passed to `useShikiHighlighter`), `theme` (default `{ dark: "github-dark-default", light: "github-light-default" }`), `streaming` (skips tokenization while true), `delay` (default `150`ms), `className`, and every other `react-shiki` option except `addDefaultStyles` and `showLanguage`. It reads `s.optional.part?.status.type === "running"` internally and forwards it as `streaming`, so you never pass that prop yourself when it is wired into `MarkdownText`. It needs no separate adapter; drop it into `MarkdownText`'s `components.SyntaxHighlighter` slot.

```tsx
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { ShikiHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter.aui";

<MarkdownText components={{ SyntaxHighlighter: ShikiHighlighter }} />;
```

## SyntaxHighlighter

```bash
npx assistant-ui@latest add syntax-highlighter
```

Import from `@/components/assistant-ui/elements/syntax-highlighter` (no `.aui` suffix; it takes every value as props rather than reading a scope). It takes `language` (required, selects the Prism grammar), `code` (required), and `components` (required, `{ Pre, Code }` tag components it renders into). `MarkdownText`'s code block pipeline supplies all three automatically once wired in; you do not call it directly. It composes a light and a dark `Coldark` themed `Pre`, both mounted, with Tailwind `dark:` classes toggling visibility. It needs no adapter; use it as an alternative to `ShikiHighlighter` in `MarkdownText`'s `components.SyntaxHighlighter` slot.

```tsx
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/syntax-highlighter";

<MarkdownText components={{ SyntaxHighlighter }} />;
```

## MermaidDiagram

```bash
npx assistant-ui@latest add mermaid-diagram
```

Import from `@/components/assistant-ui/elements/mermaid-diagram.aui` (it carries the `.aui` suffix for the same streaming-status reason as `ShikiHighlighter`). `MermaidDiagram` takes `code` (required Mermaid source; flowcharts, sequence, class, state, entity relationship diagrams, and XY charts render, other types fall back to a raw source view), `streaming` (default `false`, shows a skeleton instead of parsing), and `className`; `MermaidZoom` takes `svg` and `children` for the full screen zoom overlay. It reads `s.optional.part?.status.type === "running"` and forwards it as `streaming`, matching `ShikiHighlighter`. It needs no separate adapter; wire it into `MarkdownText`'s per language code block slot so a ` ```mermaid ` fence renders through it instead of as plain code.

```tsx
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { MermaidDiagram } from "@/components/assistant-ui/elements/mermaid-diagram.aui";

<MarkdownText components={{ componentsByLanguage: { mermaid: { SyntaxHighlighter: MermaidDiagram } } }} />;
```

## GenerativeUI

```bash
npx assistant-ui@latest add generative-ui
```

Import from `@/components/assistant-ui/elements/generative-ui` (no `.aui` suffix). The runtime side is `JSONGenerativeUI` from `@assistant-ui/react-generative-ui`: `new JSONGenerativeUI({ library, actions? })` builds a tool's parameter schema from the library's Zod `properties`; `.present(options?)` (`{ display?: "standalone" }`) returns a frontend tool whose `render` draws the model's `{ $type, ...props }` tree through the library, and `.promptUser()` returns the same rendering as a human in the loop tool. It needs `defineToolkit` and `Tools({ toolkit })` registration like any other tool; `styledGenerativeUILibrary`, the catalog styled `GenerativeUILibrary`, is exported from the local file for both the runtime and standalone paths.

```tsx
import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { JSONGenerativeUI } from "@assistant-ui/react-generative-ui";
import { defineToolkit } from "@assistant-ui/react";
import { styledGenerativeUILibrary } from "@/components/assistant-ui/elements/generative-ui";

const generative = new JSONGenerativeUI({ library: styledGenerativeUILibrary });
const toolkit = defineToolkit({ present: generative.present() });
const config = AuiConfig({ tools: Tools({ toolkit }) });

export function App({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```
