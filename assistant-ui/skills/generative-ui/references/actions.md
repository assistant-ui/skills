# Generative UI Actions

Pass an action registry to `JSONGenerativeUI` to let rendered nodes call back into your app. The model puts an `$action` object on a node, and its `type` is matched against your handlers.

```tsx
import {
  JSONGenerativeUI,
  createActionRegistry,
  defaultGenerativeUILibrary,
} from "@assistant-ui/react-generative-ui";

const actions = createActionRegistry({
  purchase: async ({ payload }) => {
    await checkout(payload);
  },
});

const generative = new JSONGenerativeUI({
  library: defaultGenerativeUILibrary,
  actions,
});
```

```json
{
  "$type": "Button",
  "label": "Buy",
  "$action": { "type": "purchase", "sku": "pro-plan" }
}
```

Without a registry, the tree still renders and model-emitted actions degrade to a no-op: `JSONGenerativeUI` falls back to an internal empty registry when `actions` is omitted.

## Contents

- [createActionRegistry](#createactionregistry)
- [What lands in $input](#what-lands-in-input)
- [Card and Form dispatch](#card-and-form-dispatch)
- [Unregistered and malformed actions](#unregistered-and-malformed-actions)
- [Human-in-the-loop return values](#human-in-the-loop-return-values)

## createActionRegistry

`createActionRegistry(handlers)` builds an `ActionRegistry`, the single dispatch target for every interactive component: `{ dispatch(action): unknown, has(type): boolean }`. Each handler is an `ActionHandler`:

```ts
type ActionDispatchContext = {
  readonly payload: Action; // the $action, with $input merged in for an interactive control
};

type ActionHandler = (ctx: ActionDispatchContext) => unknown | Promise<unknown>;
```

`payload` is the `$action` object the model emitted, plus a `$input` key merged in when the firing component collected runtime input (see below). A model-supplied `value` field is never clobbered by this merge. Whatever the handler returns comes back to the caller of `dispatch` as `unknown`; fire-and-forget actions can ignore it, a `promptUser()` resume handler uses it to continue the run.

## What lands in $input

| Component | `$input` shape |
|---|---|
| `Select`, `Input`, `DatePicker`, `Checkbox`, `RadioGroup` (standalone) | The control's own value: a string, a boolean, or the selected option's value |
| `ListViewItem` | No `$input`; it dispatches its `$action` as-is when clicked or activated with Enter/Space |
| `Form` | An object keyed by each named child control's `name` |
| `Card` with `asForm` set | Same as `Form`, dispatched through `confirm.$action` |

## Card and Form dispatch

A `Card` has no card-level `$action`. Its footer buttons dispatch independently: `confirm.$action` fires (with the collected `$input` object when `asForm` is set), and `cancel.$action` always fires with no `$input`, even on an `asForm` card. A plain `Form` behaves the same way as an `asForm` card's confirm path: submitting it collects every named descendant control's current value into one object and dispatches the form's own `$action` with that object as `$input`.

A `Button` with `submit: true` renders as a submit button and defers entirely to its ancestor `Form` or `asForm` `Card`; it never dispatches its own `$action` on click. Put `$action` on the form or card, not on the submit button, when you want one dispatch per submission.

## Unregistered and malformed actions

Dispatch never throws. A malformed `$action` (a missing or non-string `type`) and an action whose `type` has no registered handler both resolve to `undefined`, logging a warning in development (with the list of registered types, for a missing handler) so the gap is visible without breaking the render. `emptyActionRegistry` is the no-op registry `JSONGenerativeUI` falls back to when you omit `actions`; every dispatch through it warns and resolves to `undefined` the same way.

## Human-in-the-loop return values

`generative.present(options?)` is a frontend tool: it resolves as soon as the tree renders, so its own execute path never observes an action's return value. `generative.promptUser()` is the human-in-the-loop counterpart built from the same library and dispatch: the model pauses until the rendered UI's interaction supplies a result, and an `ActionHandler`'s return value is what resumes that run. Register the vocabulary once and expose whichever of `present` or `promptUser` (or both, under different tool names) fits the flow.
