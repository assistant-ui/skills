---
name: markdown
description: "Renders assistant message text as markdown in assistant-ui. Use when wiring MarkdownTextPrimitive or the markdown-text element into MessagePrimitive.Parts, installing Shiki or Prism highlighting, adding KaTeX math or Mermaid diagrams, normalizing model-produced math delimiters, or choosing StreamdownTextPrimitive for block-aware streaming with optional code, math, Mermaid, and CJK plugins. Covers defer and smooth parsing behavior, code block overrides, and stream completion. For the surrounding unstyled message composition use primitives, and for installing or editing a styled renderer use elements."
license: MIT
---

# assistant-ui Markdown

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Assistant-ui has two renderers for an assistant text part. `MarkdownTextPrimitive` is the lightweight `react-markdown` path and the installed `MarkdownText` element is its styled implementation. `StreamdownTextPrimitive` is the alternative when block-aware streaming and optional Shiki, KaTeX, Mermaid, or CJK support are worth the larger renderer.

## References

- [./references/markdown-text.md](./references/markdown-text.md) -- install and compose `MarkdownText`, customize `MarkdownTextPrimitive`, and distinguish inline from fenced code
- [./references/syntax-highlighting.md](./references/syntax-highlighting.md) -- install the Shiki or Prism renderer and select one per fenced language
- [./references/latex-mermaid.md](./references/latex-mermaid.md) -- configure KaTeX, normalize model math, preserve code spans, and gate Mermaid on stream completion
- [./references/streamdown.md](./references/streamdown.md) -- use the Streamdown alternative, plugins, Tailwind sources, and deferred parsing

## Choose the renderer

Use `markdown-text` when the app needs a small renderer, a custom `react-markdown` component map, or per-language `SyntaxHighlighter` and `CodeHeader` overrides. Add highlighting, math, and Mermaid only when the message format requires them.

Use `StreamdownTextPrimitive` when a text part needs block-based streaming, incomplete markdown repair, or the optional code, math, Mermaid, and CJK plugins. It replaces the markdown renderer for that text part. Do not mount both renderers for the same part.

## Install and wire MarkdownText

Install the renderer, which lands at `components/assistant-ui/elements/markdown-text.tsx`.

```bash
npx assistant-ui@latest add markdown-text
```

`MarkdownText` reads the active message part itself. Render it only in the `text` branch, while other part kinds keep their own renderers.

```tsx
"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";

export function AssistantMessageText() {
  return (
    <MessagePrimitive.Parts>
      {({ part }) => (part.type === "text" ? <MarkdownText /> : null)}
    </MessagePrimitive.Parts>
  );
}
```

The `thread` element already includes this renderer. Compose it directly only when replacing the thread's message layout.

## Customize the primitive

`MarkdownTextPrimitive` reads the surrounding text part through context, so it receives no text child or value prop. Its `components` map controls normal markdown tags plus `SyntaxHighlighter` and `CodeHeader`; `componentsByLanguage` replaces either slot for one fenced language. See [markdown-text.md](./references/markdown-text.md) for a direct primitive implementation.

`preprocess` runs on the full accumulated text before smoothing and parsing. It is the seam for model-specific delimiter repair. `smooth` defaults to `true`; `defer` defaults to `false`. Set `defer` for large, rapidly growing messages when React should prioritize input and scrolling over intermediate parses. Keep its value constant while the renderer is mounted because toggling it remounts the parsed tree.

## Highlight fenced code

`MarkdownText` displays fenced code as plain code until a `SyntaxHighlighter` is registered. Prefer the runtime-aware Shiki element, which waits for its active part to settle before tokenizing.

```bash
npx assistant-ui@latest add shiki-highlighter
```

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/shiki-highlighter.aui";

const defaultComponents = memoizeMarkdownComponents({
  SyntaxHighlighter,
});
```

The Prism-based `syntax-highlighter` element remains useful for apps that already depend on `react-syntax-highlighter`.

```bash
npx assistant-ui@latest add syntax-highlighter
```

```tsx
import { SyntaxHighlighter } from "@/components/assistant-ui/elements/syntax-highlighter";
```

Edit the installed `markdown-text` component's default map, or pass a `components` override where the element is rendered. See [syntax-highlighting.md](./references/syntax-highlighting.md) for the exact renderer contracts.

## Render math and diagrams

KaTeX needs `remark-math`, `rehype-katex`, and the KaTeX stylesheet. The markdown package exports `normalizeMathDelimiters`, `rewriteCustomMathTags`, `rewriteLatexBracketDelimiters`, and `escapeCurrencyDollars` for preprocessing model output. The helpers rewrite outside inline code and fenced code, so examples in code stay literal.

Install `mermaid-diagram` and register its `.aui` renderer as the `mermaid` language override. It reads the message part status and shows a skeleton while the stream is running rather than parsing incomplete Mermaid source. See [latex-mermaid.md](./references/latex-mermaid.md).

## Use Streamdown instead

`StreamdownTextPrimitive` reads the same text-part context and can be wired into the same `MessagePrimitive.Parts` branch. It defaults to `mode="streaming"`, which holds completed blocks stable while the final block grows. Supply optional plugins explicitly, and add Tailwind `@source` entries for Streamdown and each installed plugin so its controls and caret receive styles.

Both `defer` and `smooth` are available here. `defer` defaults to `false` and may skip intermediate states under load while still rendering the final text. `smooth` also defaults to `false`; use Streamdown's native `animated` prop for entrance animation unless a typewriter reveal is specifically wanted. The full setup and migration seams are in [streamdown.md](./references/streamdown.md).

## Common Gotchas

**Markdown renders as plain text**

- Render `MarkdownText` or `StreamdownTextPrimitive` in the `text` branch. Rendering `part.text` directly bypasses markdown parsing.

**Fenced code has no syntax colors**

- `markdown-text` includes a label and copy control, but no highlighter. Install and register `shiki-highlighter` or `syntax-highlighter`.

**Math has unstyled output or prices become math**

- Import `katex/dist/katex.min.css` once for KaTeX. Compose `escapeCurrencyDollars(normalizeMathDelimiters(text))` when messages include both single-dollar math and currency.

**Mermaid redraws while a response streams**

- Use `@/components/assistant-ui/elements/mermaid-diagram.aui` in `componentsByLanguage`. Its runtime wrapper holds parsing until the message part completes.

**Deferred parsing causes a visual reset**

- Do not toggle `defer` after mount. Both primitives select a different deferred renderer path when that prop changes.

**Streamdown controls or caret look unstyled**

- Add the required Tailwind `@source` directives for `streamdown` and every installed `@streamdown/*` plugin.

## Related Skills

- [primitives](../primitives/SKILL.md) -- compose `MessagePrimitive.Parts` and the surrounding message UI
- [elements](../elements/SKILL.md) -- install and customize the copied `markdown-text`, highlighter, and Mermaid element sources
