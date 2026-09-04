# LaTeX and Mermaid

Add KaTeX and Mermaid to the installed `markdown-text` renderer only when messages actually contain those formats. Math is a parser configuration. Mermaid is a per-language fenced-code renderer that must wait for its source to finish streaming.

## Configure KaTeX

Install the parser plugins and KaTeX stylesheet.

```bash
npm install katex rehype-katex remark-math
```

```tsx
import "katex/dist/katex.min.css";
```

Edit the copied `markdown-text` component so `remark-math` identifies math and `rehype-katex` produces KaTeX markup.

```tsx
import {
  MarkdownTextPrimitive,
  escapeCurrencyDollars,
  normalizeMathDelimiters,
} from "@assistant-ui/react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const preprocess = (text: string) =>
  escapeCurrencyDollars(normalizeMathDelimiters(text));

export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      preprocess={preprocess}
    />
  );
}
```

`$...$` is inline math, `$$...$$` is display math, and a fenced `math` block is also supported by `remark-math`. Import the KaTeX CSS once at the application entry. The parser configuration alone produces unstyled KaTeX markup.

## Normalize model delimiters

`normalizeMathDelimiters` composes `rewriteCustomMathTags` and `rewriteLatexBracketDelimiters`. Use either individual helper when the app should accept only one model convention. The helpers convert `\\(...\\)` to `$...$`, `\\[...\\]` to `$$...$$`, `[/inline]...[/inline]` to `$...$`, and `[/math]...[/math]` to `$$...$$`.

For display bodies that span multiple lines, the helpers emit a fenced `$$` form with the opening and closing delimiters on their own lines. That is the form `remark-math` parses as a display block, including inside block quotes and list items.

```md
\\[
E = mc^2
\\]

[/math]
\int_0^1 x^2 dx
[/math]
```

`escapeCurrencyDollars` protects currency such as `$5`, `$19.99`, and `$1,299` when single-dollar math is enabled. Compose it after delimiter normalization, as in the setup above, so display math remains unmodified.

All four helpers rewrite only normal markdown text. Inline code spans, backtick fences, and tilde fences are copied verbatim, so a documentation example such as `` `\\(x\\)` `` stays code rather than turning into an equation. An unclosed streamed fence stays inert through the current end of the message.

`preprocess` receives the full accumulated message before the markdown parser sees it. With `MarkdownTextPrimitive`, preprocessing happens before smooth streaming, so a partially received delimiter continues through the smooth buffer rather than reaching `remark-math` as a malformed expression.

## Render Mermaid after completion

Install the runtime-connected Mermaid renderer.

```bash
npx assistant-ui@latest add mermaid-diagram
```

Register it only for the `mermaid` fenced language.

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

`MermaidDiagram` accepts the code-block wrapper props for compatibility, then derives `streaming` from `s.optional.part?.status.type === "running"`. While the part runs it shows a skeleton. After completion it parses the full source and either displays the SVG with zoom controls or shows the raw-source fallback when parsing fails. This prevents incomplete diagrams from flashing on each streamed update.

For application-owned code, import `MermaidDiagram` without `.aui` and pass `code` plus `streaming` directly.

```tsx
import { MermaidDiagram } from "@/components/assistant-ui/elements/mermaid-diagram";

<MermaidDiagram code={diagram} streaming={isStreaming} />;
```

Do not pass a manually calculated stream flag to the `.aui` variant. Its value comes from the active message part, which keeps it aligned with the code fence that supplied the diagram.
