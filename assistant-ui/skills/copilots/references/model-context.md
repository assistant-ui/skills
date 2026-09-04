# Model Context

Provide instructions, tools, and lazy app state to the assistant. Multiple providers compose: system strings concatenate, tool sets merge.

## Contents

- [useAssistantContext](#useassistantcontext) (lazy send-time string state)
- [useAssistantInstructions](#useassistantinstructions) (static instructions)
- [Imperative register](#imperative-register) (aui.modelContext.register)
- [Provider shape](#provider-shape) (getModelContext return)
- [ModelContextRegistry](#modelcontextregistry) (standalone addTool / addInstruction / addProvider)
- [Handles](#handles) (update() and remove())
- [Composition](#composition) (how providers merge)

## useAssistantContext

`getContext` is a callback evaluated fresh each time the model context is read, at send-time, so frequently changing app state never triggers a re-registration.

```tsx
import { useAssistantContext } from "@assistant-ui/react";

function PageContext() {
  useAssistantContext({
    getContext: () => `Current page: ${window.location.href}`,
  });
  return null;
}
```

Config shape (`AssistantContextConfig`):

```ts
interface AssistantContextConfig {
  getContext: () => string;
  disabled?: boolean; // gate registration dynamically
}
```

## useAssistantInstructions

Takes a static string, or the same `{ instruction, disabled }` shape. Re-registers when the value changes; see [instructions.md](./instructions.md) for the full reference.

```tsx
import { useAssistantInstructions } from "@assistant-ui/react";

function Setup() {
  useAssistantInstructions("You are a helpful assistant...");
  return null;
}
```

## Imperative register

`useAui().modelContext.register(provider)` returns an unsubscribe function. Register inside `useEffect` and return the result so the provider is cleaned up on unmount.

```tsx
import { useAui, tool } from "@assistant-ui/react";
import { useEffect } from "react";
import { z } from "zod";

// Defined outside the component; this tool has no dependency on component state.
const myTool = tool({
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const result = await searchDatabase(query);
    return { result };
  },
});

function MyComponent() {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: "You are a helpful search assistant...",
        tools: { myTool },
      }),
    });
  }, [aui]);

  return <div></div>;
}
```

Because `getModelContext` runs at send-time, its closure can read changing props or state directly. Change the effect's dependency array only when the registered provider's *identity* needs to be swapped, not on every value change:

```tsx
function SmartHistory({ userProfile }) {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: `User spending patterns:
- Average transaction: ${userProfile.avgTransaction}
- Common merchants: ${userProfile.frequentMerchants.join(", ")}`,
      }),
    });
  }, [aui, userProfile]);
  return null;
}
```

## Provider shape

A provider is `{ getModelContext, subscribe? }`. `getModelContext` returns a `ModelContext` (`system`, `tools`, `config`, ...). `subscribe` lets the runtime react to external changes without re-registering.

```ts
interface ModelContextProvider {
  getModelContext: () => ModelContext;
  subscribe?: (callback: () => void) => Unsubscribe;
}
```

Minimal provider that injects model config:

```tsx
useEffect(() => {
  const modelConfig = { config: { modelName } };
  return aui.modelContext.register({
    getModelContext: () => modelConfig,
  });
}, [aui, modelName]);
```

## ModelContextRegistry

A standalone registry, not tied to React, that manages tools, instructions, and nested providers. Useful outside a component tree, such as building context inside an iframe to expose to a parent window's assistant with [`AssistantFrameProvider`](./assistant-frame.md).

```ts
import { ModelContextRegistry } from "@assistant-ui/react";

const registry = new ModelContextRegistry();
```

### addTool

```ts
import { z } from "zod";

const handle = registry.addTool({
  toolName: "searchProducts",
  description: "Search for products in the catalog",
  parameters: z.object({
    query: z.string(),
    category: z.string().optional(),
  }),
  execute: async ({ query, category }) => {
    const results = await searchAPI(query, category);
    return { products: results };
  },
});
```

### addInstruction

```ts
const instruction = registry.addInstruction("You are a helpful assistant.");
```

### addProvider

Compose another provider, or another registry, into this one.

```ts
const providerHandle = registry.addProvider({
  getModelContext: () => ({ system: "Be concise." }),
});
```

## Handles

`addTool`, `addInstruction`, and `addProvider` each return a handle with `update(...)` and `remove()`.

```ts
const toolHandle = registry.addTool({
  toolName: "convertCurrency",
  description: "Convert between currencies",
  parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
  execute: async ({ amount, from, to }) => {
    const rate = await fetchExchangeRate(from, to);
    return { result: amount * rate, currency: to };
  },
});

toolHandle.update({
  toolName: "convertCurrency",
  description: "Convert between currencies with live rates",
  parameters: z.object({ amount: z.number(), from: z.string(), to: z.string() }),
  execute: async ({ amount, from, to }) => {
    const rate = await fetchExchangeRate(from, to);
    return { result: amount * rate, currency: to };
  },
});

toolHandle.remove();
```

Instruction handles work the same way:

```ts
const instruction = registry.addInstruction("You are a helpful assistant.");
instruction.update("You have access to a product catalog search tool.");
instruction.remove();
```

The React hooks (`useAssistantContext`, `useAssistantInstructions`) and `register()` clean up automatically. Call `handle.remove()` only when managing a `ModelContextRegistry` directly.

## Composition

Registered providers compose rather than override:

- System instructions concatenate.
- Tool sets merge.
- Nested visible components (`makeAssistantVisible`) contribute their HTML only at the outermost level.

Keep each provider focused on one component's purpose, and register inside `useEffect` so removal happens on unmount.
