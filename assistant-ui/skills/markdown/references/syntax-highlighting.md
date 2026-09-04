# Syntax highlighting

`markdown-text` renders fenced code with a language label and a copy control, but its default `SyntaxHighlighter` renders plain code. Choose one installed renderer and register it in the markdown element's component map.

## Choose a renderer

Use `shiki-highlighter` for the runtime-aware default. Its `.aui` wrapper reads the active message part status, leaves code plain while the part is running, then tokenizes after the code settles. This avoids paying for Shiki tokenization repeatedly while a fence grows.

Use `syntax-highlighter` when the app already uses `react-syntax-highlighter`. It is Prism based, renders light and dark Coldark variants together, and switches themes with CSS instead of re-tokenizing. It does not defer tokenization based on message status.

## Install Shiki

```bash
npx assistant-ui@latest add shiki-highlighter
```

The runtime-aware file uses the `.aui` suffix. Add it to the installed `markdown-text` component's default map.

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter.aui";

const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter,
});
```

While the message part runs, Shiki renders trimmed plain code in the same frame. Once the part is complete, it tokenizes with its default light and dark themes. The element's `delay` defaults to `150` milliseconds, which lets a smooth text reveal drain before the highlighter starts. Pass `delay={0}` only when immediate post-stream highlighting matters more than avoiding the final extra pass.

The standalone form accepts `code`, `language`, and `streaming`; it is for code that comes from application state instead of a message part.

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter";

<SyntaxHighlighter language="tsx" code={code} streaming={isStreaming} />;
```

## Install Prism

```bash
npx assistant-ui@latest add syntax-highlighter
```

The Prism renderer has no `.aui` suffix.

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/syntax-highlighter";

const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter,
});
```

Inside `MarkdownText`, the code-block pipeline supplies `language`, `code`, and `components` automatically. In a standalone render, `components.Pre` and `components.Code` are required because they are the tags Prism mounts into.

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/syntax-highlighter";

<SyntaxHighlighter
  language="tsx"
  code="const count = 1;"
  components={{
    Pre: (props) => <pre {...props} />,
    Code: (props) => <code {...props} />,
  }}
/>;
```

The installed Prism element registers `js`, `jsx`, `ts`, `tsx`, and `python` by default. An unregistered language still renders as code, without token colors. Add only the grammars the application needs to its copied component source.

## Override one language

`componentsByLanguage` has priority over the fallback `SyntaxHighlighter` and `CodeHeader`. Keep the ordinary highlighter in the default map, then replace one known language with a specialized renderer.

```tsx
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { MermaidDiagram } from "@/components/assistant-ui/elements/mermaid-diagram.aui";
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter.aui";

<MarkdownTextPrimitive
  components={{ SyntaxHighlighter }}
  componentsByLanguage={{
    mermaid: { SyntaxHighlighter: MermaidDiagram },
  }}
/>;
```

Use a `CodeHeader` override when a fenced block needs an additional action. Its props are `language`, `code`, and `node`; it renders before the highlighter. Do not use a highlighter for inline code. Inline code follows the normal `code` renderer and can be detected with `useIsMarkdownCodeBlock()`.

## Common failures

**The installed renderer does not resolve**

- `shiki-highlighter` is runtime connected and imports from `shiki-highlighter.aui`. `syntax-highlighter` is a renderer and imports without `.aui`.

**The code fence ignores the specialized renderer**

- The map key is the exact fenced language, such as `mermaid` or `tsx`. A missing or different fence label uses the default `SyntaxHighlighter`.

**Shiki keeps showing plain code**

- The `.aui` renderer intentionally leaves a running message part unhighlighted. Wait for completion, or use its standalone form and pass `streaming={false}` after your own source settles.
