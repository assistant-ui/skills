# Generative UI Tokens and Styling

The default vocabulary renders semantic HTML tagged with `data-aui` and `data-aui-<prop>` attributes and ships no styles of its own, so it inherits nothing and collides with nothing. `npx assistant-ui@latest add generative-ui` installs a stylesheet written entirely against your existing shadcn theme variables (`--radius`, `--primary`, and the rest), so changing those in your own CSS carries through to the rendered widgets, plus `components/assistant-ui/elements/generative-ui.tsx`, which exports `styledGenerativeUILibrary`.

## Contents

- [Token arrays](#token-arrays)
- [Restyling one component](#restyling-one-component)
- [Swapping in the styled library](#swapping-in-the-styled-library)
- [Overriding a single entry](#overriding-a-single-entry)

## Token arrays

`@assistant-ui/react-generative-ui` exports these as `readonly` arrays, each paired with a type alias of its union (`TextSize`, `Color`, and so on), so a component's zod schema can validate against the same enum the model sees in its tool description.

| Export | Values | Used by |
|---|---|---|
| `TEXT_SIZES` | `sm`, `md`, `lg`, `xl`, `2xl`, `3xl` | `Text.size` (default `md`), `Header.size` (default `lg`) |
| `WEIGHTS` | `normal`, `medium`, `semibold`, `bold` | `Text.weight` |
| `COLORS` | `emphasis`, `secondary`, `alpha-70`, `white`, `white-70`, `white-50` | `Text.color`; `Chart.color` reuses the same token names |
| `IMAGE_SIZE_TOKENS` | `sm`, `md`, `lg` | `Image.size` (also accepts a raw pixel number) |
| `ALIGNS` | `start`, `center`, `end` | `Col.align`, `Row.align` |
| `JUSTIFIES` | `start`, `center`, `end`, `between` | `Row.justify` |
| `BUTTON_STYLES` | `primary`, `secondary`, `outline`, `ghost`, `danger` | `Button.buttonStyle` |
| `ALERT_TONES` | `info`, `success`, `warning`, `danger` | `Alert.tone` (default `info`) |
| `ICON_NAMES` | 24 names: `sun`, `moon`, `cloud`, `rain`, `snow`, `wind`, `play`, `pause`, `check`, `x`, `star`, `heart`, `arrow-right`, `arrow-up-right`, `chevron-right`, `calendar`, `clock`, `map-pin`, `plane`, `truck`, `credit-card`, `user`, `search`, `bell` | `Icon.name` |

`ICON_NAMES` is a real, stable export of the package (confirmed against the built type declarations) even though the published API reference's token page does not list it alongside the other eight arrays; treat the export list as authoritative over that page.

```ts
import {
  TEXT_SIZES,
  IMAGE_SIZE_TOKENS,
  WEIGHTS,
  COLORS,
  ALIGNS,
  JUSTIFIES,
  BUTTON_STYLES,
  ALERT_TONES,
  ICON_NAMES,
} from "@assistant-ui/react-generative-ui";
```

## Restyling one component

Target the `data-aui` attribute the component renders, for example the value half of a `Fact`:

```css
[data-aui="fact-value"] {
  font-variant-numeric: tabular-nums;
  font-size: 1.125rem;
}
```

A component's variant and size props surface as `data-aui-<prop>` attributes on the same element (`data-aui-size`, `data-aui-tone`, `data-aui-variant`), so a selector like `[data-aui="alert"][data-aui-tone="danger"]` reaches one variant without touching the rest. `Card` in particular renders as a plain section by default, so several in a row read as one answer rather than a stack of boxes; it takes on a framed surface only when the model sets `background`, when `confirm`/`cancel` add a footer, or when it is a `Carousel` slot, each of which sets its own `data-aui-*` hook to target.

## Swapping in the styled library

`styledGenerativeUILibrary` differs from `defaultGenerativeUILibrary` in exactly one entry: its `Markdown` renders through `react-markdown` with GitHub-flavored markdown instead of dumping `value` as plain text. Both wrap the result in the same `<div data-aui="markdown">`, so styling already targeting that attribute keeps applying.

Outside a `"use generative"` file, pass it directly:

```tsx
import { JSONGenerativeUI } from "@assistant-ui/react-generative-ui";
import { styledGenerativeUILibrary } from "@/components/assistant-ui/elements/generative-ui";

const generative = new JSONGenerativeUI({ library: styledGenerativeUILibrary });
```

`styledGenerativeUILibrary` is itself a `"use client"` module. Inside a `"use generative"` toolkit file, that means it can be named **only** as the inline `render` value of a `defineGenerativeComponents` call, never passed directly as `library`, spread, or assigned to a top-level constant, or the compiler cannot split the client half from the server half. Override just the one entry that needs it:

```tsx title="app/toolkit.tsx"
"use generative";

import {
  JSONGenerativeUI,
  defaultGenerativeUILibrary,
  defineGenerativeComponents,
} from "@assistant-ui/react-generative-ui";
import { styledGenerativeUILibrary } from "@/components/assistant-ui/elements/generative-ui";

const markdown = defaultGenerativeUILibrary.Markdown!;

const generative = new JSONGenerativeUI({
  library: {
    ...defaultGenerativeUILibrary,
    ...defineGenerativeComponents({
      Markdown: {
        properties: markdown.properties,
        streamProperties: markdown.streamProperties,
        description: "A markdown string, rendered with GitHub-flavored markdown.",
        render: styledGenerativeUILibrary.Markdown!.render,
      },
    }),
  },
});
```

## Overriding a single entry

Overriding a component's markup, rather than only its CSS, is a library-level change: spread `defaultGenerativeUILibrary` (or `styledGenerativeUILibrary`) and replace one entry through `defineGenerativeComponents`, keeping its `properties` and `streamProperties` intact unless the new `render` needs different props. This is the same pattern [vocabulary.md](./vocabulary.md) uses to add a brand-new component; overriding an existing one just reuses its key.
