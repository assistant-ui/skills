# Markdown text

Use the `markdown-text` element when an assistant text part needs headings, tables, links, lists, fenced code, a language label, and a copy control. It is a runtime renderer, not a controlled markdown component: it reads the active message part through `MarkdownTextPrimitive`.

## Install and place it

```bash
npx assistant-ui@latest add markdown-text
```

The installer writes `components/assistant-ui/elements/markdown-text.tsx`. Wire its `MarkdownText` export into only the text part branch.

```tsx
"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <MessagePrimitive.Parts>
        {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
      </MessagePrimitive.Parts>
    </MessagePrimitive.Root>
  );
}
```

The `Thread` element already owns this composition. Add a separate renderer only for a custom message layout.

## Build directly on MarkdownTextPrimitive

Use the primitive when the installed component needs a different component map or parser configuration. It reads the active text part, applies `preprocess`, optionally smooths the stream, and parses the resulting text. It has no `children` prop for markdown text.

```tsx
"use client";

import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";

const components = unstable_memoizeMarkdownComponents({
  code: function Code({ children, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code data-code-block={isCodeBlock || undefined} {...props}>
        {children}
      </code>
    );
  },
});

export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={components}
    />
  );
}
```

`unstable_memoizeMarkdownComponents` memoizes each entry against its parsed node. Use it for a stable custom map rather than recreating raw tag components during a stream. `useIsMarkdownCodeBlock()` is `true` only under a fenced code block, so inline code can receive a different presentation without guessing from a class name.

## Configure code slots

The `components` map accepts normal `react-markdown` tag renderers as well as `SyntaxHighlighter` and `CodeHeader`. A fenced code block sends its parsed `language`, raw `code`, `node`, and the current `Pre` and `Code` components to `SyntaxHighlighter`. `CodeHeader` receives `language`, `code`, and `node`.

`componentsByLanguage` overrides either slot for one fence language. Use this for Mermaid without changing the highlighter for TypeScript, Python, or ordinary plain text.

```tsx
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { MermaidDiagram } from "@/components/assistant-ui/elements/mermaid-diagram.aui";

export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      componentsByLanguage={{
        mermaid: { SyntaxHighlighter: MermaidDiagram },
      }}
    />
  );
}
```

See [syntax-highlighting.md](./syntax-highlighting.md) for the regular highlighter slots and [latex-mermaid.md](./latex-mermaid.md) for the Mermaid renderer.

## Streaming and deferred parsing

`smooth` defaults to `true` and accepts either a boolean or a smooth-options object. It reveals text at a controlled rate and automatically respects reduced-motion preferences. Set `smooth={false}` when the renderer should show each received update immediately.

`defer` defaults to `false`. With `defer`, React uses a deferred value for parsing and rendering, so input and scrolling can stay responsive while a long message grows. Intermediate markdown states may be skipped, but the final message renders. Choose this at mount time and keep it fixed, because changing it selects a different renderer component and remounts the parsed tree.

```tsx
<MarkdownTextPrimitive defer smooth={false} />
```

`containerProps` forwards props to the root container, and `containerComponent` replaces its default `div`. The primitive places the text part's smooth status in `data-status` on that container.

## Boundaries

`MarkdownTextPrimitive` parses a message part. For a string outside an assistant message part, render `react-markdown` directly. For a renderer that owns block-based streaming, incomplete-markdown repair, and optional plugin features, use `StreamdownTextPrimitive` from [streamdown.md](./streamdown.md) instead.
