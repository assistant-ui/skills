# Generative UI Vocabulary

`defaultGenerativeUILibrary` is a closed vocabulary of 27 intrinsic components, each a zod `properties` schema plus an unstyled structural `render` (semantic HTML with a `data-aui` attribute naming the component, and `data-aui-<prop>` hooks for styling). Pass it to `new JSONGenerativeUI({ library: defaultGenerativeUILibrary })`, or override and extend entries with your own `defineGenerativeComponents`.

Every node the model emits is a flat object: `$type` names the component, `children` nests, and every other key is a prop.

```json
{
  "$type": "Card",
  "title": "Q3 revenue",
  "children": [
    {
      "$type": "Row",
      "children": [
        { "$type": "Fact", "label": "Bookings", "value": "$1.2M" },
        { "$type": "Fact", "label": "Growth", "value": "+18%" }
      ]
    },
    {
      "$type": "Chart",
      "variant": "bar",
      "showAxis": true,
      "data": [
        { "label": "Jul", "value": 22 },
        { "label": "Aug", "value": 26 },
        { "label": "Sep", "value": 31 }
      ]
    }
  ]
}
```

Keys beginning with `$` are reserved by the framework (`$type`, `$key`, `$action`, and the injected `$status`), and `children` follows the JSX convention. Every other key is yours, so a component is free to declare props named `type`, `status`, or `variant` without colliding.

## Contents

- [The 27 default components](#the-27-default-components)
- [Streaming props](#streaming-props)
- [Extending the vocabulary](#extending-the-vocabulary)
- [Reading a tree back](#reading-a-tree-back)
- [Beyond the browser](#beyond-the-browser)
- [Security](#security)

## The 27 default components

| Component | Props | Notes |
|---|---|---|
| `Header` | `text`, `size?` | Section heading; `size` defaults to `lg` |
| `Text` | `value`, `size?`, `weight?`, `color?` | A run of text; streams |
| `Caption` | `value` | Secondary, de-emphasized text; streams |
| `Image` | `src`, `alt`, `size?`, `round?` | `round` crops to a circle |
| `Divider` | `flush?` | Horizontal rule between sections |
| `Fact` | `label`, `value` | A label/value pair, rendered as `<dt>`/`<dd>` |
| `Button` | `label`, `buttonStyle?`, `block?`, `submit?` | Carries `$action`; `submit` defers to an ancestor `Form`/`Card` instead |
| `Select` | `options`, `placeholder?`, `label?`, `name?` | Dropdown; carries `$action` |
| `Input` | `placeholder?`, `multiline?`, `label?`, `name?` | Text input; Ctrl/Cmd+Enter submits a `multiline` field with no form ancestor |
| `DatePicker` | `value?`, `min?`, `max?`, `label?`, `name?` | Dates as `YYYY-MM-DD` |
| `Checkbox` | `label`, `name?`, `defaultChecked?` | |
| `RadioGroup` | `options`, `name?`, `label?`, `defaultValue?` | Mutually exclusive options |
| `Form` | `gap?` | Wraps named controls; submit fires `$action` with every control's value keyed by `name` |
| `Card` | `title?`, `padding?`, `background?`, `asForm?`, `confirm?`, `cancel?` | The default way to break a response into parts; renders as plain content unless `background` is set, a footer button is present, or it is a `Carousel` slot. `confirm`/`cancel` are `{ label, $action? }` |
| `Col` | `gap?`, `align?` | Vertical stack |
| `Row` | `gap?`, `align?`, `justify?` | Horizontal row |
| `Spacer` | none | Empty space that pushes neighbors apart |
| `Badge` | `value`, `variant?` | Small labeled tag |
| `Box` | `width?`, `height?`, `radius?`, `background?` | Generic container; size and background are inline styles, not `data-aui` hooks |
| `ListView` | none | Vertical list container for `ListViewItem` rows |
| `ListViewItem` | none | Carries `$action` to make the whole row clickable and keyboard-activatable |
| `Table` | `columns?`, `rows?` | `columns` is `{ label }[]`; each row is an array of cells matching the columns |
| `Markdown` | `value` | Renders as plain text by default; streams. Override to get a real renderer, see [tokens.md](./tokens.md) |
| `Chart` | `variant`, `data?`, `series?`, `stacked?`, `showAxis?`, `showLegend?`, `color?` | `variant` is `"bar" \| "line" \| "sparkline" \| "area"`; `series` (multiple named series) takes precedence over `data` (a single series) when both are present |
| `Alert` | `title?`, `description?`, `tone?` | `tone` defaults to `info` |
| `Carousel` | `label?` | A horizontally scrollable group of `Card` children, capped at 10 |
| `Icon` | `name`, `size?` | `name` is one of 24 built-in glyphs (weather, media, and common UI icons); `size` defaults to `md` (16px) |

`Button`, `Select`, `Input`, `DatePicker`, `Checkbox`, `RadioGroup`, and `ListViewItem` are the interactive components; see [actions.md](./actions.md) for what each one puts under `$input` when its `$action` fires. Numeric `gap`/`padding` props are in 4px units and clamp to 0 through 8.

## Streaming props

A component opts into partial rendering with `streamProperties: true` on its definition. Only `Text`, `Caption`, and `Markdown` opt in by default. A streaming component's `render` sees `Partial<P>` and an injected `$status` of `"streaming"` while the model is still writing its props, then the full `P` and `$status: "done"` once they arrive complete. A component that does not opt in renders only once its props are complete.

## Extending the vocabulary

`defineGenerativeComponents` adds your own components. Each one declares a zod schema for its props, a description the model reads, and a render function.

```tsx title="app/toolkit.tsx"
"use generative";

import { z } from "zod";
import {
  JSONGenerativeUI,
  defaultGenerativeUILibrary,
  defineGenerativeComponents,
} from "@assistant-ui/react-generative-ui";
import { WeatherCard } from "@/components/weather-card";

const generative = new JSONGenerativeUI({
  library: {
    ...defaultGenerativeUILibrary,
    ...defineGenerativeComponents({
      Weather: {
        description: "Show a weather card for a `get_weather` result.",
        properties: z.object({
          id: z.string().describe("The `id` returned by `get_weather`."),
        }),
        render: (props) => <WeatherCard {...props} />,
      },
    }),
  },
});
```

`defineGenerativeComponents` has no runtime implementation of its own: a `"use generative"` compiler unwraps the call per build, dropping each `render` (and the client-only imports only it uses) from the server build and keeping `properties` and `description` on both, since those drive the tool's parameters. Reaching it at runtime (the directive missing, or the helper used outside a `"use generative"` file) throws rather than shipping client code to the server.

Inside a `"use generative"` module, a `"use client"` module such as `WeatherCard` above may be referenced **only** as the `render` value of an inline `defineGenerativeComponents` literal, exactly as shown. Referencing it from `properties`, `description`, a spread, or a top-level constant leaks a client reference into the server graph and breaks schema generation. `defaultGenerativeUILibrary` is safe everywhere.

Both `present` and `promptUser` draw from the same `JSONGenerativeUI` instance and share one `render`, so extending the library once covers both. `promptUser()` takes no arguments and returns a human-in-the-loop tool: the model pauses and the rendered UI's `$action` dispatch supplies the resume value, instead of `present`'s immediate resolve.

## Reading a tree back

`generativeUIToJSX(node, options?)` serializes a node to a JSX-like string for display, the "view source" of a model-produced tree: `{ $type: "Weather", id: "x" }` becomes `<Weather id="x" />`, and nested `children` render between tags. It is a faithful textual rendering, not a parser, so string children are emitted verbatim by default. Pass `{ escape: true }` to make the output safe to paste back into JSX (a string child containing `<`, `>`, `&`, `{`, or `}` becomes a JSON-stringified expression instead), and `{ pretty: true }` to pretty-print nested trees with two-space indentation.

## Beyond the browser

The tree is plain JSON, so a server action, queue worker, or webhook handler can consume it without pulling React:

- `@assistant-ui/react-generative-ui/ir` holds the tree types, normalization, and the token enums covered in [tokens.md](./tokens.md).
- `@assistant-ui/react-generative-ui/slack` and `/teams` convert the tree into Slack Block Kit and a Microsoft Teams Adaptive Card and decode the interaction payloads back, see [renderers.md](./renderers.md).
- `@assistant-ui/react-generative-ui/a2ui` consumes A2UI surfaces over AG-UI, see [a2ui-openui.md](./a2ui-openui.md).

## Security

The library is the boundary on **which** components can render: the model can only name components you put in it, resolved by lookup with no `eval` and no dynamic import. An unrecognized `$type` is dropped and warns in development; it does not throw.

Props are a separate question. Each component's zod schema validates what the model sends, so a component that declares only primitive, display-oriented props cannot receive anything else. When you add a component that takes a URL, a raw HTML string, or anything that becomes executable, validate it inside that component; the schema constrains shape, not intent.
