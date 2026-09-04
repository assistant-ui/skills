# Streamdown

`StreamdownTextPrimitive` is the alternative to `MarkdownTextPrimitive` for a text part that benefits from block-aware streaming, incomplete-markdown repair, optional Shiki highlighting, KaTeX math, Mermaid diagrams, or CJK handling. It reads the active message part from context, so it replaces the renderer in the same `MessagePrimitive.Parts` text branch.

## Install the renderer and plugins

Install the base renderer first. Add only the plugins the messages need.

```bash
npm install @assistant-ui/react-streamdown streamdown
npm install @streamdown/code @streamdown/math @streamdown/mermaid
```

The package does not auto-detect plugins. Import and pass each one explicitly so the application controls its feature set and bundle size.

```tsx
"use client";

import { MessagePrimitive } from "@assistant-ui/react";
import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import "katex/dist/katex.min.css";

const StreamdownText = () => (
  <StreamdownTextPrimitive
    plugins={{ code, math, mermaid }}
    shikiTheme={["github-light", "github-dark"]}
  />
);

export function AssistantMessageText() {
  return (
    <MessagePrimitive.Parts>
      {({ part }) => (part.type === "text" ? <StreamdownText /> : null)}
    </MessagePrimitive.Parts>
  );
}
```

`code` enables Shiki, `math` enables KaTeX, and `mermaid` enables Mermaid. Add `cjk` from `@streamdown/cjk` only for messages where CJK text optimization is needed. The math plugin still requires the KaTeX stylesheet.

## Include Streamdown Tailwind sources

Streamdown controls, Mermaid fullscreen UI, and the caret use Tailwind classes from package files. Tailwind v4 does not scan those files by default. Add a source directive for the renderer and every installed plugin to the global stylesheet that imports Tailwind.

```css
@import "tailwindcss";

@source "../node_modules/streamdown/dist/*.js";
@source "../node_modules/@streamdown/code/dist/*.js";
@source "../node_modules/@streamdown/math/dist/*.js";
@source "../node_modules/@streamdown/mermaid/dist/*.js";
```

Adjust the relative path for a monorepo or hoisted dependency layout. Omit the plugin lines for packages that are not installed. Import `streamdown/styles.css` only when using the native `animated` prop or `createAnimatePlugin`; a `caret` alone does not need it.

## Streaming behavior

`mode="streaming"` is the default. Streamdown splits markdown into blocks so completed blocks remain stable while the current block grows. In streaming mode it repairs incomplete syntax only in the trailing block unless `parseIncompleteMarkdown={false}` or a custom `parseMarkdownIntoBlocksFn` is supplied.

`defer` defaults to `false`. Set it when parsing a growing message should yield priority to typing and scrolling. It uses React deferred values, so intermediate states can be skipped under load but the final message still renders. Keep the value constant for the component lifetime because changing it remounts the renderer path.

`smooth` also defaults to `false`. It adds assistant-ui's typewriter reveal and can accept smooth options. Prefer Streamdown's native `animated` prop for word-level entrance animation. A caret remains active until smooth output catches up with the received text.

```tsx
<StreamdownTextPrimitive defer smooth={false} caret="block" />
```

## Customize and migrate

The primitive accepts a `components` map with regular markdown components plus assistant-ui compatible `SyntaxHighlighter` and `CodeHeader` entries. `componentsByLanguage` has priority for one fenced language, so a custom Mermaid renderer can coexist with an ordinary highlighter.

```tsx
import { StreamdownTextPrimitive } from "@assistant-ui/react-streamdown";

<StreamdownTextPrimitive
  components={{
    SyntaxHighlighter: MySyntaxHighlighter,
    CodeHeader: MyCodeHeader,
  }}
  componentsByLanguage={{
    mermaid: { SyntaxHighlighter: MermaidRenderer },
  }}
/>;
```

This is the migration seam for an existing `MarkdownTextPrimitive` code header or highlighter. For custom code tags, use `useIsStreamdownCodeBlock()` to distinguish a fence from inline code, or `useStreamdownPreProps()` to read the containing pre props.

`preprocess` is available for the same math helpers exported by this package: `normalizeMathDelimiters`, `rewriteCustomMathTags`, `rewriteLatexBracketDelimiters`, and `escapeCurrencyDollars`. The helpers run on the accumulated text before Streamdown parses it. See [latex-mermaid.md](./latex-mermaid.md) for delimiter behavior and code-span protection.

## Safety and controls

`security` restricts allowed link and image prefixes, protocols, data images, and relative URL origin. It overrides Streamdown's permissive defaults. `linkSafety` can require confirmation before navigating an external link. Use one or both when rendering untrusted assistant output in a context where links or images need application policy.

`controls` enables code, table, and Mermaid controls. Set `controls={false}` to remove them, or use an object to configure individual areas. `containerProps` and `containerClassName` apply to the primitive's outer div, whose `data-status` mirrors the smooth stream status.

## Common failures

**The renderer displays no text**

- It must be mounted in a `MessagePrimitive.Parts` text branch. It reads the current message part and has no markdown string prop.

**Plugin features are absent**

- Installing a plugin package is not enough. Import its plugin value and include it in `plugins`.

**The caret or controls look broken**

- Add `@source` directives for `streamdown` and every installed plugin to the Tailwind entry stylesheet.

**A partial response changes completed content**

- Keep `mode="streaming"` and avoid a custom block parser unless the application has a concrete parsing requirement.
