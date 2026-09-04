# Generative UI Renderers

`MessagePrimitive.GenerativeUI` renders UI a backend describes directly, as a `generative-ui` message part, against a consumer-provided component allowlist. Everything else here converts a `present`-shaped tree to a target outside the browser: `@assistant-ui/react-generative-ui/slack` to Block Kit, `/teams` to an Adaptive Card. Both subpaths are React-free, so a server action, queue worker, or webhook handler imports them without pulling React into the bundle.

## Contents

- [MessagePrimitive.GenerativeUI](#messageprimitivegenerativeui)
- [Spec shape differences](#spec-shape-differences)
- [Slack](#slack)
- [Microsoft Teams](#microsoft-teams)

## MessagePrimitive.GenerativeUI

Use this when a **backend** already emits `generative-ui` message parts, rather than a model calling the `present` tool. The agent emits a part containing a tree of components by name; assistant-ui resolves each name against your allowlist and renders it. All exports live in `@assistant-ui/react`.

```tsx
import {
  MessagePrimitive,
  GenerativeUIRenderError,
  type GenerativeUISpec,
  type GenerativeUINode,
  type GenerativeUIMessagePart,
  type GenerativeUIComponentRegistry,
} from "@assistant-ui/react";
```

### Spec format

```ts
type GenerativeUINode =
  | string
  | {
      readonly component: string; // resolved against the allowlist
      readonly props?: Record<string, unknown>;
      readonly children?: readonly GenerativeUINode[];
      readonly key?: string; // optional stable React key
    };

type GenerativeUISpec = {
  readonly root: GenerativeUINode | readonly GenerativeUINode[];
};

type GenerativeUIMessagePart = {
  readonly type: "generative-ui";
  readonly spec: GenerativeUISpec;
  readonly id?: string;
  readonly parentId?: string;
};
```

A native part from ExternalStore or a manual message:

```json
{
  "type": "generative-ui",
  "spec": {
    "root": {
      "component": "Card",
      "props": { "title": "Welcome" },
      "children": [{ "component": "Button", "props": { "label": "Get started" } }]
    }
  }
}
```

`GenerativeUIComponentRegistry` (the allowlist) is `Record<string, ComponentType<any>>`; define each component to accept only the primitive, display-oriented props the agent is allowed to pass.

### Opt-in wiring

The stock `Thread` switch returns `null` for a `generative-ui` part, so add one of these in your own assistant message renderer.

Pass the allowlist to `MessagePrimitive.Parts` and let it read the part from context:

```tsx
<MessagePrimitive.Parts
  components={{
    generativeUI: { components: componentsAllowlist, Fallback: UnknownComponentFallback },
  }}
/>
```

Handling a `MessagePrimitive.GroupedParts` case directly reads the same way:

```tsx
case "generative-ui":
  return (
    <MessagePrimitive.GenerativeUI
      components={componentsAllowlist}
      Fallback={UnknownComponentFallback}
    />
  );
```

`useChatRuntime` maps tool results to `tool-call` parts, not native `generative-ui` parts, so bridge with a dedicated tool result instead:

```tsx
case "tool-call":
  if (part.toolName === "render_gui") {
    const spec = parseRenderGuiResult(part.result); // your zod safeParse of { spec }
    if (spec) {
      return (
        <MessagePrimitive.GenerativeUI
          spec={spec}
          components={componentsAllowlist}
          Fallback={UnknownComponentFallback}
        />
      );
    }
  }
  return part.toolUI ?? <ToolFallback {...part} />;
```

Exclude `render_gui` from tool-group chrome in `groupBy` on this path (return `[]` for that tool name), and define the server tool with the AI SDK `tool` helper, returning `{ spec: input.spec }` from `execute`. The spec arrives only at tool completion, not incrementally, so this bridge does not stream.

### Streaming

A native `generative-ui` part whose `spec` updates incrementally (for example over ExternalStore) renders progressively as nodes and props arrive. The AI SDK `render_gui` bridge above does not: it returns the full spec at tool completion.

### Error handling and security

An unrecognized `component` name throws `GenerativeUIRenderError` (a typed `componentName` field), unless you pass `Fallback`:

```tsx
const UnknownComponentFallback = ({ component }: { component: string }) => (
  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
    unknown component: {component}
  </span>
);
```

The allowlist bounds **which** components render, with no `eval` and no dynamic import; it does not constrain the `props` they receive. Treat every allowlisted component as receiving untrusted input: never forward agent-supplied props into `dangerouslySetInnerHTML`, and validate or reject `href`/`src` values such as `javascript:` URLs.

## Spec shape differences

`present` and `MessagePrimitive.GenerativeUI` both render a JSON component tree, and both packages happen to export a type named `GenerativeUINode`, but the two shapes are not interchangeable and the two `GenerativeUINode` types are not the same type:

| | `present` (`@assistant-ui/react-generative-ui`) | Primitive (`@assistant-ui/react`) |
|---|---|---|
| Discriminator | `$type` (flat, sits alongside props) | `component` (nested inside the node) |
| Props | Every other key on the node itself | A separate `props` object |
| Producer | The model, calling the `present` tool | Your backend, emitting a `generative-ui` part |
| Converters | Slack, Teams, A2UI all accept this shape | None |

Import `GenerativeUINode` from the package that matches the pattern you are using. A tree built for `present` is what the Slack and Teams converters below, and the A2UI converter in [a2ui-openui.md](./a2ui-openui.md), accept; a primitive-shaped tree has no converter.

## Slack

`toSlackBlocks(node, options?)` converts a `present`-shaped (`$type`) tree into [Block Kit](https://docs.slack.dev/reference/block-kit/blocks) JSON.

```ts
import { WebClient } from "@slack/web-api";
import { toSlackBlocks } from "@assistant-ui/react-generative-ui/slack";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const { blocks, warnings } = toSlackBlocks({
  $type: "Card",
  title: "Order #48213",
  children: [{ $type: "Text", value: "Shipped, arriving Thursday." }],
});

await slack.chat.postMessage({ channel: "#orders", blocks });
```

It returns `{ blocks, warnings }` and never throws: an input it cannot convert at all comes back as empty `blocks` plus one warning. Pass `{ surface: "modal" }` to target a modal instead of a message, which changes the block budget and unlocks the native `alert` block.

### Warnings

Every downgrade is reported instead of thrown, so one unsupported node never costs the whole message:

```ts
type SlackConversionWarning = {
  code: "clamped" | "dropped" | "fallback";
  component: string; // the IR component name, or "Root" for whole-payload issues
  detail: string;
};
```

`clamped` truncated content to fit a limit, `dropped` discarded a node or a prop (sometimes leaving a placeholder note, for example a `Chart` becomes an omission note), `fallback` rendered through a different construct than requested.

### Component mapping

| Component | Slack output | Fidelity |
|---|---|---|
| `Header` | `header` block | Only `text` survives |
| `Text` | `section` block, `mrkdwn` | Only `value` survives; size/weight/color dropped |
| `Markdown` | `markdown` block | Downgrades to `section` past the markdown budget |
| `Caption`, `Badge` | `context` block | Both become the same output and cannot be told apart on read-back |
| `Image` | `image` block | Only `src`/`alt` survive |
| `Divider` | `divider` block | |
| `Fact` | Merged into one `section`'s `fields` | Every 10 fields start a new section |
| `Table` | `data_table` block | Rows padded to a uniform width |
| `Card` | Native `card` block, or a header plus inline blocks | See [Cards](#cards-on-slack) |
| `Carousel` | `carousel` block of `card` elements | An over-full card reshapes to title/body text |
| `Alert` | Native `alert` block on a modal only; `context` + `section` on a message | |
| `ListView` | One `section` per item, `divider` between | |
| `ListViewItem` | `section` plus an "Open" button when it carries an action | |
| `Button` | `button` in an `actions` block | Only `primary`/`danger` styles survive |
| `Select` | `static_select` | |
| `RadioGroup` | `radio_buttons` | |
| `Checkbox` | `checkboxes` with one option | |
| `DatePicker` | `datepicker` | Non-`YYYY-MM-DD` values dropped |
| `Input` | Own `input` block | Not grouped into `actions` |
| `Form` | Children inline, then a "Submit" button | Slack has no form container |
| `Row` | One `context` block when every child is `Badge`/`Caption`, else flattened | |
| `Col`, `Box` | Flattened into the sibling block stream | |
| `Chart` | Note block | Always warns |
| `Spacer`, `Icon` | Dropped | No Slack equivalent |

`Card`'s `asForm` and `Button`'s `submit` both convert to the same plain `button` element carrying the node's `$action`, since Slack has no client-side form model.

### Cards on Slack

A `Card` takes the native `card` block only when its children fit that block's fixed fields (`hero_image`, `title`, `body`, `subtext`, up to three action buttons), filled from the first `Image`, the first `Text`/`Markdown`, and the first `Caption`. Anything else, including a second image or a loose `Button`, falls back to a header plus inline children plus an actions block. A card with none of an image, title, body, or actions is dropped. Inside a `Carousel` the fallback is unavailable, so an over-full card reshapes to title and body text instead.

### Limits

| Budget | Value | Behavior when exceeded |
|---|---|---|
| Blocks per message | 50 (100 in a modal) | Extra dropped, noted |
| Section text | 3000 characters | Truncated |
| Button label | 75 characters | Truncated |
| Button action payload | 2000 characters | Dropped entirely, not truncated |
| Carousel cards | 10 | Truncated |
| Table | 200 rows, 20 columns | Truncated |

Traversal is bounded too: 200 children per level, 5000 nodes per call, 32 levels of nesting, since the tree arrives from a model.

### Actions

Outbound, `$action.type` becomes the element's `action_id` and the remaining keys are JSON-serialized into its `value`. Only buttons carry `value`; `Select`, `Input`, `DatePicker`, `Checkbox`, and `RadioGroup` emit `action_id` alone, so keep those controls' actions to a bare `type`.

Inbound, Slack posts a [`block_actions` payload](https://docs.slack.dev/reference/interaction-payloads/block_actions-payload) to your request URL. `decodeBlockAction` rebuilds the action, with the user's selection under `$input`:

```ts
import { decodeBlockAction } from "@assistant-ui/react-generative-ui/slack";

const action = decodeBlockAction(payload.actions[0]);
// { type: "approve_order", orderId: "48213", $input: "…" }
```

It returns `undefined` for anything without a usable `action_id` and never throws. `fromSlackBlocks(blocks)` is the inverse of `toSlackBlocks`, returning `{ nodes, warnings }`; the round trip is faithful on plain building blocks and documented-lossy elsewhere (a context block always decodes as `Caption`, for example).

### Before interactions work

Posting a tree needs only a bot token with `chat:write`. Buttons additionally need, on the Slack app side: interactivity enabled with a request URL, an HTTP 200 acknowledgement within 3 seconds (use `response_url` for up to five follow-up posts within 30 minutes), and request signature verification with your signing secret. Routing the decoded action to your handler stays your application's job.

## Microsoft Teams

`toAdaptiveCard(node)` converts a `present`-shaped tree into an [Adaptive Card](https://adaptivecards.io/explorer/); `toTeamsAttachments(node)` wraps the same conversion in the bot-framework attachment envelope, which is the form a carousel needs.

```ts
import { toAdaptiveCard } from "@assistant-ui/react-generative-ui/teams";

const { card, warnings } = toAdaptiveCard({
  $type: "Card",
  title: "Order #48213",
  children: [{ $type: "Text", value: "Shipped, arriving Thursday." }],
});

await context.sendActivity({
  attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }],
});
```

Both return their result plus `warnings` and never throw. Cards are stamped at Adaptive Cards schema 1.5, which Teams desktop supports; Teams mobile caps at 1.2, so a card using a 1.5-only element such as `Table` may not render there.

### Warnings

```ts
type TeamsConversionWarning = {
  code: "clamped" | "dropped" | "fallback" | "advisory";
  component: string;
  detail: string;
};
```

`advisory` is unique to Teams: nothing was changed, but the result may still render poorly or be refused, for example a `Row` past three columns or a card over the byte budget.

### Component mapping

| Component | Adaptive Card output | Fidelity |
|---|---|---|
| `Header` | `TextBlock`, heading style | Always emits `large` |
| `Text` | `TextBlock` | Six sizes collapse to five; `emphasis` color is dropped |
| `Markdown` | `TextBlock`, passed through verbatim | Teams renders a markdown subset |
| `Caption`, `Badge` | Small subtle `TextBlock` | Both become the same output |
| `Image` | `Image` | `round` dropped silently |
| `Fact` | `FactSet` | Consecutive facts merge |
| `Table` | Native `Table` (schema 1.5) | Will not render on Teams mobile |
| `Card` | `Container`, title as leading heading | Footer buttons become an `ActionSet` beside it, not inside |
| `Alert` | `Container` with a semantic style | Title and description become two text blocks |
| `Carousel` | Multiple attachments via `toTeamsAttachments` | Only meaningful at the root; see [Carousels](#carousels-on-teams) |
| `ListView` / `ListViewItem` | One `Container` per item | Never reserves an input id |
| `Button` | `Action.Submit` in an `ActionSet` | Consecutive buttons merge; `buttonStyle` dropped, Teams ignores it |
| `Select` | `Input.ChoiceSet`, compact | |
| `RadioGroup` | `Input.ChoiceSet`, expanded | |
| `Checkbox` | `Input.Toggle` | Value is the string `"true"`/`"false"` |
| `Input` | `Input.Text` | |
| `DatePicker` | `Input.Date` | Non-`YYYY-MM-DD` dropped silently |
| `Form` | Children inline, then a "Submit" `ActionSet` | Every input on the card submits together |
| `Row` | `ColumnSet`, one column per child | Past three columns you get an `advisory` warning, but nothing is dropped |
| `Col`, `Box` | `Container` | Indistinguishable |
| `Divider`, `Spacer` | Nothing; set `separator`/`spacing` on the next element | See [Layout differences](#layout-differences-on-teams) |
| `Chart` | Subtle note | Always warns |
| `Icon` | Dropped | |

`Card`'s `asForm` and `Button`'s `submit` both convert to the same `Action.Submit`, since every input on an Adaptive Card submits together regardless.

### Layout differences on Teams

A `Divider` emits nothing and sets `separator: true` on the next element that does emit; a `Spacer` emits nothing and sets `spacing: "large"` on the next one. A component that emits nothing (an `Icon`) does not consume a pending mark. Either one with nothing after it disappears entirely, so a trailing separator you would see on Slack is simply absent on Teams.

### Inputs on Teams

Each control's submit `id` comes from its `name` prop, falling back to a per-type default; `Checkbox` falls back to its `label` first. Two controls sharing a name collide, so the converter renames the later one and warns. There is no change event: a standalone control carrying `$action` gets its own companion "Submit" `ActionSet`, with a `fallback` warning. Put `$action` on a `Form` or a `Card` footer and leave controls actionless for one submit per card.

### Carousels on Teams

A carousel only works through `toTeamsAttachments`; anywhere other than the root, a `Carousel` falls back to its cards rendered in sequence, with a `fallback` warning.

```ts
const { attachments, attachmentLayout } = toTeamsAttachments(tree);
await context.sendActivity({ attachments, attachmentLayout });
```

A root-level `Carousel` yields one attachment per `Card` child, `attachmentLayout: "carousel"`, capped at 10.

### Limits

| Budget | Value | Behavior when exceeded |
|---|---|---|
| Carousel attachments | 10 | Truncated |
| Table | 100 rows, 20 columns | Truncated |
| Choice options | 100 | Truncated |
| Primary actions | 6 | Later actions move to secondary mode |
| Payload size | 80,000 serialized bytes | Warned, never truncated |

### Actions

Outbound, `$action` rides inside the submit payload's reserved `aui` key, so it never collides with input values and is not string-serialized the way Slack's button `value` is. Inbound, a bot receives the merged object as `activity.value`:

```ts
import { decodeSubmitData } from "@assistant-ui/react-generative-ui/teams";

const action = decodeSubmitData(context.activity.value);
// { type: "approve_order", orderId: "48213", $input: { quantity: "2" } }
```

`$input` here is an object keyed by input id, unlike Slack's bare-value `$input`. `decodeSubmitData` returns `undefined` for a payload without a well-formed `aui` envelope and never throws.
