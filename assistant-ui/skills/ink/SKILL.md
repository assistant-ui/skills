---
name: ink
description: "Builds terminal chat UIs with @assistant-ui/react-ink and ANSI markdown with @assistant-ui/react-ink-markdown. Use when scaffolding `create --ink`, mounting `AssistantRuntimeProvider` around `useChatRuntime`, composing `ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`, `LoadingPrimitive`, `TextInput`, thread history, attachments, notifications, and terminal keyboard navigation, or when a chat needs grapheme safe editing, multiline display columns, an absolute backend URL, local file storage, or a custom `RemoteThreadListAdapter`. Route terminal markdown, tool output, message rendering, and Ink focus problems here. For browser application setup, web elements, and the standard web runtime, use [setup](../setup/SKILL.md)."
license: MIT
---

# assistant-ui Ink

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

`@assistant-ui/react-ink` connects the assistant-ui runtime to Ink's terminal renderer. It shares runtime, tools, state, and AI SDK transport with web apps, but it has no DOM, CSS, or copied elements. Compose your screen from Ink's `Box` and `Text` plus the runtime aware primitives. `@assistant-ui/react-ink-markdown` renders assistant text as ANSI styled terminal markdown.

## References

- [./references/primitives.md](./references/primitives.md) -- every terminal primitive namespace, its parts, scoped contexts, and the controlled `TextInput`
- [./references/hooks.md](./references/hooks.md) -- runtime, state, tool, notification, voice, and checklist hooks
- [./references/adapters.md](./references/adapters.md) -- file storage, attachment, and title adapters
- [./references/custom-backend.md](./references/custom-backend.md) -- local inference, local disk persistence, and backend thread ownership
- [./references/migration.md](./references/migration.md) -- what transfers from a web app and what must be rebuilt for Ink

## Start a terminal app

Scaffold the terminal example when starting fresh:

```sh
npx assistant-ui@latest create --ink my-app
cd my-app
```

`--ink` resolves to the `with-react-ink` CLI example. The example inventory also contains `with-react-ink-web`, but it is not the `--ink` scaffold target.

For an existing Node project, install the runtime, terminal renderer, and AI SDK transport together:

```sh
npm install @assistant-ui/react-ink @assistant-ui/react-ink-markdown ink react @assistant-ui/ai-sdk
```

The API route must run in a separate backend project. Unlike a browser app, a terminal process cannot use a relative `/api/chat` URL. Give `AssistantChatTransport` a complete URL that the process can reach.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react-ink";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { Box } from "ink";
import { TerminalThread } from "./components/terminal-thread.js";

const CHAT_API_URL = "http://localhost:3000/api/chat";

export function App() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: CHAT_API_URL }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column">
        <TerminalThread />
      </Box>
    </AssistantRuntimeProvider>
  );
}
```

`useChatRuntime` and `AssistantChatTransport` come from `@assistant-ui/ai-sdk`. Its backend uses the AI SDK v7 UI message stream. See the runtime's [AI SDK v7 guide](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v7) for the route shape.

## Compose a terminal thread

`ThreadPrimitive.Messages` creates the current message scope before each child runs. Read `s.message` inside the message component, then use Ink primitives rather than web elements. Use `AuiIf` for runtime state gates and `LoadingPrimitive` for the active run.

```tsx
import { Box, Text } from "ink";
import {
  AuiIf,
  ComposerPrimitive,
  LoadingPrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

function Message() {
  const message = useAuiState((s) => s.message);
  const text = message.content
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");

  if (message.role === "user") {
    return <Text color="green">You: {text}</Text>;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="blue">Assistant:</Text>
      <MarkdownText text={text} />
    </Box>
  );
}

export function TerminalThread() {
  return (
    <ThreadPrimitive.Root flexDirection="column">
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <Text dimColor>Send a message to begin.</Text>
      </AuiIf>
      <ThreadPrimitive.Messages>{() => <Message />}</ThreadPrimitive.Messages>
      <LoadingPrimitive.Root gap={1}>
        <LoadingPrimitive.Spinner variant="bar" />
        <LoadingPrimitive.Text />
        <LoadingPrimitive.ElapsedTime />
      </LoadingPrimitive.Root>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">{"> "}</Text>
        <ComposerPrimitive.Input submitOnEnter placeholder="Message..." autoFocus />
      </Box>
    </ThreadPrimitive.Root>
  );
}
```

The simple message example deliberately renders only text parts. Use `MessagePrimitive.Parts` when you need tool calls, attachments, data, sources, or reasoning. Its default terminal safe renderers handle those part types, and [primitives](./references/primitives.md) shows the component map.

## Terminal input behavior

`ComposerPrimitive.Input` is a composer bound `TextInput`. It is a controlled line editor, not Ink's nonexistent native input. `submitOnEnter` sends the current composer text. With `multiLine`, Enter inserts a newline unless `submitOnEnter` is enabled, in which case Shift Enter inserts a newline when the terminal distinguishes it. `Ctrl J` inserts a newline only in multiline mode and never submits a single line input.

- Left, Right, Backspace, Delete, and `Ctrl D` operate on one grapheme, so an emoji, ZWJ sequence, combining character, or CJK ideograph is never split.
- Home and End select the whole buffer in single line mode or the current line in multiline mode. `Ctrl A` and `Ctrl E` always select the current line boundary.
- Up and Down navigate multiline rows while preserving the terminal display column, calculated from grapheme widths rather than UTF 16 offsets.
- `Ctrl W`, `Alt B`, `Alt F`, and `Alt D` navigate or delete by `Intl.Segmenter` word boundaries. `Ctrl U` and `Ctrl K` kill to the current boundary. At multiline end of line, `Ctrl K` joins the next line.

Meta bindings need a terminal that emits Escape prefixed sequences. In macOS Terminal, enable “Use Option as Meta key” for the Alt bindings. Shift Enter requires CSI u support, including iTerm2 3.4 or newer, kitty, and foot. Other terminals treat it as Enter and use `submitOnEnter` behavior. See [primitives](./references/primitives.md) for `TextInput` outside a composer.

## Markdown in the terminal

Pass accumulated text to `MarkdownText` from `@assistant-ui/react-ink-markdown`. It produces terminal styled output rather than HTML or a React DOM tree. The package also exports `MarkdownTextPrimitive`, `useShikiHighlighter`, and theme types for a custom renderer, but start with `MarkdownText` unless you need to change its rendering pipeline.

```tsx
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

export function AssistantReply({ text }: { text: string }) {
  return <MarkdownText text={text} />;
}
```

## Common Gotchas

**The terminal app sends requests to its own process instead of the backend**

- `AssistantChatTransport` needs an absolute `api` URL such as `http://localhost:3000/api/chat`. Host the AI SDK route separately from the Ink process.

**A web Thread or shadcn element renders nothing in the CLI**

- Browser elements require the DOM and CSS. Rebuild the surface with Ink `Box`, `Text`, and `@assistant-ui/react-ink` primitives.

**A primitive or state hook throws about missing runtime context**

- Mount it under `AssistantRuntimeProvider runtime={runtime}`. `ThreadPrimitive.Messages` and `MessagePrimitive.Parts` also create the item scopes their children read.

**Enter does not send or inserts a newline unexpectedly**

- `submitOnEnter` is false by default. Combine it with `multiLine` only when Enter should send and Shift Enter should insert a newline on capable terminals.

**Emoji deletion corrupts the visible input or vertical navigation lands in the wrong place**

- Use `ComposerPrimitive.Input` or exported `TextInput`. Their buffer uses grapheme segmentation and terminal display widths. Do not substitute character index arithmetic.

**Thread data disappears after restarting the CLI**

- `useLocalRuntime` is process memory. Use `createFileStorageAdapter` for one local process or a `RemoteThreadListAdapter` for backend owned metadata.

**Markdown was imported from the web package**

- Import `MarkdownText` from `@assistant-ui/react-ink-markdown`, which emits terminal formatting. Web markdown renderers target the DOM.

## Related Skills

- [setup](../setup/SKILL.md) -- CLI scaffolding, browser setup, and package installation
- [runtime](../runtime/SKILL.md) -- shared assistant-ui runtime, state, threads, and transport design
- [primitives](../primitives/SKILL.md) -- browser unstyled primitives when the target is not a terminal
- [tools](../tools/SKILL.md) -- toolkit definitions and tool call renderers that also work in Ink
- [markdown](../markdown/SKILL.md) -- browser markdown renderers and source display
