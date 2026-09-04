# useAssistantInstructions

Register system instructions that steer assistant behavior, from any component inside the runtime.

## Basic usage

Pass a plain string. It registers into the model context on mount, updates when the string changes, and unregisters on unmount.

```tsx
import { useAssistantInstructions } from "@assistant-ui/react";

function SupportChat() {
  useAssistantInstructions("You are a customer support assistant. Be concise and cite docs.");
  return <Thread />;
}
```

## Config object

Pass an object instead of a string to gate registration with `disabled`. The hook itself still runs unconditionally, which React's rules require; only the instruction turns on and off.

```tsx
function ModeAwareChat({ adminMode }: { adminMode: boolean }) {
  useAssistantInstructions({
    instruction: "You may run destructive operations when the user confirms.",
    disabled: !adminMode,
  });
  return <Thread />;
}
```

## Multiline and interpolated instructions

A template literal covers structured guidance and values pulled from component state; changing the resulting string re-registers automatically.

```tsx
function SmartForm({ userName }: { userName: string }) {
  useAssistantInstructions(`You are a form assistant helping ${userName}. You:
- Validate user input
- Provide helpful suggestions
- Never submit without confirmation`);
  return <form></form>;
}
```

## Composition

Instructions are additive. When several components register instructions, the system strings concatenate, so guidance can live next to the feature it describes instead of one central prompt.

```tsx
function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <GlobalInstructions />   {/* "You are a helpful assistant." */}
      <CheckoutInstructions /> {/* "When checking out, confirm the address." */}
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## When the value needs to stay fresh without re-registering

`useAssistantInstructions` re-registers every time its string changes, which is wasteful for app state that changes often, such as a cart total or a selection. Reach for [`useAssistantContext`](./model-context.md#useassistantcontext) instead: its `getContext` callback is evaluated fresh each time the model context is read, so it returns the current value without ever re-registering.

```tsx
import { useAssistantContext } from "@assistant-ui/react";

function CartContext({ cart }: { cart: Cart }) {
  useAssistantContext({
    getContext: () => `Cart total: ${cart.total}. Items: ${cart.items.length}.`,
  });
  return null;
}
```

## Pairing with visible components and tools

Instructions describe how the assistant should act on what it can already see or do. Pair them with [`makeAssistantVisible`](./visible.md) for DOM the assistant can read or click, and with a toolkit (see the tools skill) for anything it should call.

```tsx
import { makeAssistantVisible, useAssistantInstructions } from "@assistant-ui/react";

const VisibleForm = makeAssistantVisible(CheckoutForm, { editable: true });

function Checkout() {
  useAssistantInstructions(
    "Help the user fill out the checkout form. Read the form HTML, then use the edit tool to set field values.",
  );
  return <VisibleForm />;
}
```

## Low-level registration

`useAssistantInstructions` is a thin wrapper over `aui.modelContext.register`. Register directly when instructions and tools need to ship from the same provider, or when the value must be computed at send-time rather than tracked as React state; see [model-context.md](./model-context.md#imperative-register) for the full pattern.
