# MCP manager setup

Mount `McpManagerResource` in an `AuiConfig` to give an assistant-ui subtree an `mcp` scope. The manager owns application declared connectors, persisted user added servers, auth state, connections, and the frontend tool registration surface.

## Contents

- [Connectors](#connectors)
- [Manager configuration](#manager-configuration)
- [Storage and scope identity](#storage-and-scope-identity)
- [State, methods, and resources](#state-methods-and-resources)

## Connectors

`defineConnector` validates an application preset. `id`, `name`, `url`, and `auth` are required. IDs must be unique because they drive server lookup, OAuth routing, persisted auth state, and namespaced tool names.

```ts
import { defineConnector } from "@assistant-ui/react-mcp";

const connectors = [
  defineConnector({
    id: "linear",
    name: "Linear",
    url: "https://mcp.linear.app",
    auth: { type: "oauth", scopes: ["read"] },
    icon: "/icons/linear.svg",
    connectionTimeout: 10_000,
    cache: { defaultTtlMs: 30_000 },
  }),
  defineConnector({
    id: "weather",
    name: "Weather",
    url: "https://mcp.example.com/weather",
    auth: { type: "none" },
    elicitation: false,
  }),
];
```

`icon` is optional. `connectionTimeout` overrides the manager timeout for this server. `cache.defaultTtlMs` configures response caching. `elicitation: false` stops the client from advertising form elicitation to this server. The same `connectionTimeout`, `cache`, and `elicitation` options are accepted by `aui.mcp.addCustomServer`.

## Manager configuration

The manager defaults to `McpLocalStorage()`, `${window.location.origin}/mcp/callback`, and `autoConnect: true`. Auto connect reconnects a server at mount when usable auth state is persisted. `connectionTimeout` is opt in and bounds the full connection readiness path, including `listTools()`.

```tsx
"use client";

import type { ReactNode } from "react";
import { AuiConfig, AuiProvider, useAui } from "@assistant-ui/react";
import { McpManagerResource } from "@assistant-ui/react-mcp";

export function McpProviders({ children }: { children: ReactNode }) {
  const aui = useAui();
  const config = AuiConfig({
    mcp: McpManagerResource({
      connectors,
      oauthRedirectUri: `${window.location.origin}/auth/mcp`,
      autoConnect: true,
      connectionTimeout: 15_000,
    }),
  });

  return (
    <AuiProvider extends={aui} config={config}>
      {children}
    </AuiProvider>
  );
}
```

When a chat runtime already supplies `modelContext`, connected MCP tools register into it. Otherwise the manager provides a minimal `modelContext`, so direct calls remain available.

## Storage and scope identity

All persisted data uses one `MCPStorage`: custom server records, OAuth tokens, callback state, PKCE verifiers, and DCR client data. The built in choices are `McpLocalStorage()`, `McpMemoryStorage()`, and `McpCustomStorage(...)`.

| Storage | Use | Scope identity |
|---|---|---|
| `McpLocalStorage()` | Browser default using the `aui-mcp:` key prefix | Derives a scope for the shared `window.localStorage` backing store |
| `McpMemoryStorage()` | SSR or tests without `localStorage` | Every instance has a distinct scope |
| `McpCustomStorage(...)` | Application owned persistence | Set `scopeId` to the stable identity of the backing data |

`McpLocalStorage({ keyPrefix, storage, scopeId })` customizes the key namespace, backing Web Storage object, and identity. Supply `scopeId` whenever you replace the backing `storage`. A custom storage implements the complete async contract:

```tsx
import { AuiConfig } from "@assistant-ui/react";
import { McpCustomStorage, McpManagerResource } from "@assistant-ui/react-mcp";

const config = AuiConfig({
  mcp: McpManagerResource({
    connectors,
    storage: McpCustomStorage({
      scopeId: "api:/api/mcp",
      loadCustomServers: async () => fetch("/api/mcp/servers").then((response) => response.json()),
      saveCustomServers: async (records) => {
        await fetch("/api/mcp/servers", {
          method: "PUT",
          body: JSON.stringify(records),
        });
      },
      loadAuthState: async (id) => {
        const response = await fetch(`/api/mcp/auth/${id}`);
        return response.ok ? response.json() : null;
      },
      saveAuthState: async (id, state) => {
        await fetch(`/api/mcp/auth/${id}`, {
          method: "PUT",
          body: JSON.stringify(state),
        });
      },
      clearAuthState: async (id) => {
        await fetch(`/api/mcp/auth/${id}`, { method: "DELETE" });
      },
    }),
  }),
});
```

Two storages with the same `scopeId` must read and write the same data. Bearer and OAuth connections key on that identity, so moving to a different scope reconnects and rebinds the OAuth provider. Without `scopeId`, a storage replacement never reconnects, and a rebuilt object can clear auth state without waiting for prior queued writes.

Treat storage as fixed for the manager lifetime. Custom servers load once at mount and are not reloaded after a storage change, so swapping storage retains records from the old store and writes them into the new one. When the backing identity changes, such as a user change, remount the manager. `McpLocalStorage` stores tokens as plain text, so production apps should use a server endpoint backed by HTTP only cookies through `McpCustomStorage`.

## State, methods, and resources

Read reactive manager state from `s.mcp`. `s.mcpServer` requires an `McpServerByIdProvider` or one of the manager iteration primitives. Keep selectors primitive or referentially stable.

```tsx
import { useAui } from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/store";

export function ServerActions() {
  const isHydrated = useAuiState((state) => state.mcp.isHydrated);
  const connectionState = useAuiState((state) => state.mcpServer.connectionState);
  const tools = useAuiState((state) => state.mcpServer.tools);
  const aui = useAui();

  async function addAndConnect() {
    const id = await aui.mcp.addCustomServer({
      name: "My server",
      url: "https://mcp.example.com",
      auth: { type: "bearer", token: "token" },
      connectionTimeout: 10_000,
    });
    await aui.mcp.server({ id }).connect();
  }

  return <button onClick={() => void addAndConnect()}>{isHydrated && connectionState === "connected" ? tools.length : "Connect"}</button>;
}
```

`aui.mcp.getState()` returns the manager state. Resolve a server with `server({ id })`, `server({ kind, index })`, `connector({ index })`, or `customServer({ index })`. A server exposes `connect`, `disconnect`, `remove`, `callTool`, `listResources`, `readResource`, `completeAuth`, and `answerElicitation`. Call these from an event handler, never while rendering.

`listResources` returns the raw MCP response and is paginated. Preserve the returned cursor until it is absent before selecting a resource to read.

```tsx
import { useAui } from "@assistant-ui/react";

type ResourcePage = {
  resources: Array<{ uri: string; name?: string }>;
  nextCursor?: string;
};

export function ResourcePreview({ id }: { id: string }) {
  const aui = useAui();

  async function loadResources() {
    const server = aui.mcp.server({ id });
    const resources: ResourcePage["resources"] = [];
    let nextCursor: string | undefined;

    do {
      const page = (await (nextCursor === undefined
        ? server.listResources()
        : server.listResources({ cursor: nextCursor }))) as ResourcePage;
      resources.push(...page.resources);
      nextCursor = page.nextCursor;
    } while (nextCursor !== undefined);

    const first = resources[0];
    return first ? server.readResource(first.uri) : null;
  }

  return <button onClick={() => void loadResources()}>Load resources</button>;
}
```
