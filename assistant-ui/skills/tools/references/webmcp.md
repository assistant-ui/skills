# WebMCP provider

WebMCP is a browser-native way for a page to publish tools to the agent the user is running, through `document.modelContext` with `navigator.modelContext` as a fallback. `unstable_useWebMcpProvider` connects it to the tools already in your assistant-ui model context: every frontend tool is published to the browser's WebMCP host, and results come back through the same contract your chat runtime uses, so one definition serves both callers.

The hook is `unstable_`, WebMCP itself is an emerging browser API, and this surface is exempt from the usual append-only guarantee.

## Mount it

Mount it once anywhere inside your provider tree.

```tsx title="app/page.tsx"
import { unstable_useWebMcpProvider } from "@assistant-ui/react";

const WebMcpTools = () => {
  const { status, registeredToolNames } = unstable_useWebMcpProvider();

  if (status === "unsupported") return null;
  return <span>Exposed to your browser: {registeredToolNames.join(", ")}</span>;
};
```

`status` is `"unsupported"` when the page has no `modelContext`, which is every browser without WebMCP today, and `"active"` once the provider is running. The check runs when the hook mounts and is not repeated, because WebMCP defines no availability event and the provider does not poll, so an extension that injects `modelContext` into an already rendered page is picked up only on the next mount.

`registeredToolNames` is the sorted list of names the provider is publishing. A name the host refuses, because the page already registered it or its tools permission is off, drops out once the refusal arrives. A name appears for the commit in which its registration is set up, so read the list as what the provider intends to have live rather than a synchronous read of the host.

## Choosing which tools to publish

With no `filter`, the provider publishes every enabled frontend tool that has an `execute`. Backend tools, disabled tools, and tools with no client-side implementation are skipped, and a tool authored without a `type` counts as frontend when it has an `execute`.

A `filter` you pass replaces that default predicate rather than narrowing it, so a name-only filter would publish a backend or disabled tool whose name is in the set. Compose against the exported predicate to narrow instead.

```tsx
import {
  unstable_defaultWebMcpFilter,
  unstable_useWebMcpProvider,
} from "@assistant-ui/react";

const PUBLIC_TOOLS = new Set(["search_docs", "get_order_status"]);

unstable_useWebMcpProvider({
  filter: (name, tool) =>
    unstable_defaultWebMcpFilter(name, tool) && PUBLIC_TOOLS.has(name),
});
```

Replacement is deliberate: it is also the only way to widen the set and publish a tool the default would skip. The filter runs for every tool on every model-context change, and changing the function re-syncs the registrations. An inline arrow is fine, because each tool's converted schema is cached against the tool object, so a re-sync that changes nothing costs no schema conversion. Tools added through `ModelContextRegistry.addTool` are rebuilt on every read and miss that cache, so they are re-converted on each sync.

A tool the browser agent can call is a tool anyone driving that browser can call, without your assistant's system prompt in the loop. Publish only what you would expose as an unauthenticated API for the current session, and keep destructive tools out.

## Lifecycle

- A tool that leaves the model context is unregistered, and unmounting unregisters everything.
- Changing a tool's `description`, or replacing the tool object with a different `parameters` schema, re-registers it under the new signature. Changing only the `execute` implementation does not, because the live registration calls through to the latest version. Editing `parameters` inside one retained tool object is not observed.
- A registration the host rejects is dropped with a `console.warn` and is not retried while the tool stays in the model context, so a permanent collision warns once. A transient collision is not retried either; remove the tool from the model context and add it back, or remount, to retry.

Calls execute through the same path as any frontend tool call: Standard Schema parameters are validated first, `toModelOutput` shapes the result when you define one, and the host's `AbortSignal` is merged with the registration's own lifetime so an unregistered tool cancels in-flight work. `human()` is not available, because a WebMCP caller has no composer to answer with.

## API

```ts
type Unstable_WebMcpProviderOptions = {
  filter?: (name: string, tool: Tool<any, any>) => boolean;
};

type Unstable_WebMcpProviderResult = {
  status: "unsupported" | "active";
  registeredToolNames: readonly string[];
};
```

Both types are exported from `@assistant-ui/react`, along with `Tool` for the filter signature.
