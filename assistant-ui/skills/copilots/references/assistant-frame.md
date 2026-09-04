# Assistant Frame

Share model context (tools and instructions) across an iframe boundary. An embedded app, plugin, or sandboxed widget can contribute capabilities to the assistant running in the parent window, while its tool executors keep running inside the iframe's own origin and permissions.

## Contents

- [In the iframe: AssistantFrameProvider](#in-the-iframe-assistantframeprovider)
- [In the parent: useAssistantFrameHost](#in-the-parent-useassistantframehost)
- [Origin validation](#origin-validation)
- [Multiple providers](#multiple-providers)
- [Low-level: AssistantFrameHost](#low-level-assistantframehost)
- [Sandboxing the iframe](#sandboxing-the-iframe)

Two pieces make up the bridge:

- **`AssistantFrameProvider`**: a static class that runs inside the iframe and publishes one or more `ModelContextRegistry` instances as model context.
- **`useAssistantFrameHost`** (or the underlying `AssistantFrameHost` class): runs in the parent window, connects to the iframe over `postMessage`, and merges the iframe's tools and instructions into the parent's own model context.

## In the iframe: AssistantFrameProvider

Build a `ModelContextRegistry`, add tools and instructions to it, then publish it with `addModelContextProvider`.

```tsx
// iframe.tsx
import { AssistantFrameProvider, ModelContextRegistry } from "@assistant-ui/react";
import { z } from "zod";

const registry = new ModelContextRegistry();

AssistantFrameProvider.addModelContextProvider(registry, "https://parent-app.com");

registry.addTool({
  toolName: "searchProducts",
  description: "Search for products in the catalog",
  parameters: z.object({
    query: z.string(),
    category: z.string().optional(),
  }),
  execute: async ({ query, category }) => {
    // Runs inside the iframe, with the iframe's own permissions.
    const results = await searchAPI(query, category);
    return { products: results };
  },
});

const instructionHandle = registry.addInstruction("You are a helpful assistant.");
instructionHandle.update("You have access to a product catalog search tool.");
```

`addModelContextProvider` returns an unsubscribe function. `registry.addTool` / `addInstruction` / `addProvider` each return a handle with `update(...)` and `remove()`; see [model-context.md](./model-context.md#modelcontextregistry) for the full registry API.

## In the parent: useAssistantFrameHost

Point the hook at a ref on the `<iframe>` element. It connects once the iframe is mounted and keeps the parent's model context in sync as the iframe's registries change.

```tsx
// parent.tsx
import { useAssistantFrameHost } from "@assistant-ui/react";
import { useRef } from "react";

function ParentComponent() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useAssistantFrameHost({
    iframeRef,
    targetOrigin: "https://trusted-iframe-domain.com",
  });

  return (
    <div>
      <Thread />
      <iframe
        ref={iframeRef}
        src="https://trusted-iframe-domain.com/embed"
        title="Embedded App"
      />
    </div>
  );
}
```

`useAssistantFrameHost` needs to run somewhere inside `AssistantRuntimeProvider`; the tools and instructions it receives merge into the runtime's model context the same way any other provider's do.

## Origin validation

Both sides validate the message origin before trusting anything the other sends.

- `AssistantFrameProvider.addModelContextProvider(provider, targetOrigin?)`: when `targetOrigin` is omitted, the provider only replies to `window.location.origin`. Every provider registered in one frame shares that frame's origin policy: registering an explicit origin tightens an existing wildcard policy, while registering two different explicit origins throws. Unsubscribing a registration drops its requirement.
- `useAssistantFrameHost({ iframeRef, targetOrigin? })` and the `AssistantFrameHost` constructor: `targetOrigin` defaults to `window.location.origin`.
- The wildcard `"*"` is available as an explicit opt-in on the provider side, but avoid it for any iframe that exposes tools or sensitive instructions; a cross-origin embed should name the exact origin on both sides.

Tool executors run in the iframe's context, not the parent's, so a tool that touches something sensitive (a database, an internal API) stays sandboxed there; the parent only ever receives the tool's declared schema and its results.

## Multiple providers

An iframe can publish more than one registry, useful for keeping unrelated capabilities (a catalog, an analytics panel) in separate registries with their own lifecycle.

```tsx
const catalogRegistry = new ModelContextRegistry();
const analyticsRegistry = new ModelContextRegistry();

const unsubscribeCatalog = AssistantFrameProvider.addModelContextProvider(
  catalogRegistry,
  "https://parent-app.com",
);
const unsubscribeAnalytics = AssistantFrameProvider.addModelContextProvider(
  analyticsRegistry,
  "https://parent-app.com",
);

// Later:
unsubscribeCatalog();
unsubscribeAnalytics();
```

`AssistantFrameProvider.dispose()` tears down every provider registered in the current frame at once.

## Low-level: AssistantFrameHost

`useAssistantFrameHost` wraps this class; reach for it directly outside React, or when you need `getModelContext()` on demand instead of through the runtime.

```tsx
import { AssistantFrameHost } from "@assistant-ui/react";

const host = new AssistantFrameHost(iframeWindow, "https://iframe-app.com");

const context = host.getModelContext();
// => { system: "...", tools: { ... } }

const unsubscribe = host.subscribe(() => {
  console.log("Context updated:", host.getModelContext());
});

host.dispose();
```

Messages between the two sides travel over a single `postMessage` channel, named by the exported constant `FRAME_MESSAGE_CHANNEL` (`"assistant-ui-frame"`). You will not normally construct these messages yourself; both `AssistantFrameProvider` and `AssistantFrameHost` handle the protocol.

## Sandboxing the iframe

Since tool executors run inside the iframe, treat the embed like any other third-party content: serve it from its own origin, and add the standard HTML `sandbox` attribute (for example `sandbox="allow-scripts allow-same-origin"`, scoped to what the embedded app actually needs) alongside the `targetOrigin` checks above. Origin validation stops a different page from impersonating the iframe or the parent; the `sandbox` attribute limits what the embedded page itself can do to the rest of the document.

## Related

- [model-context.md](./model-context.md) for `ModelContextRegistry`, providers, and handles used on both sides of the bridge.
