---
name: react-mcp
description: "Adds user managed browser MCP servers to assistant-ui with `@assistant-ui/react-mcp`. Use when mounting `McpManagerResource`, declaring `defineConnector` presets, persisting custom servers and OAuth state, composing `McpManagerPrimitive`, `McpServerPrimitive`, `McpAddFormPrimitive`, or `McpElicitationPrimitive`, handling an OAuth callback, browsing MCP resources, or diagnosing missing server tools, connection failures, and OAuth redirects. This covers end user chosen servers, not application owned backend MCP tools. For those use tools; for the chat runtime use runtime; for the copied dialog use elements."
license: MIT
---

# assistant-ui React MCP

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

`@assistant-ui/react-mcp` lets users connect preset or custom Streamable HTTP MCP servers in the browser. The manager persists server and auth state, exposes connection state to primitives, and registers each connected tool into `modelContext` as a frontend tool named `serverId__toolName`.

## References

- [./references/setup.md](./references/setup.md) -- manager configuration, storage, state, imperative methods, and resource reads
- [./references/ui.md](./references/ui.md) -- the copied configuration dialog and every manager, server, and add form primitive
- [./references/oauth.md](./references/oauth.md) -- auth shapes, OAuth callback handling, CIMD, and connection states

## Mount the manager

Declare fixed connectors with `defineConnector`, then extend the nearest `aui` scope with a config. `connectionTimeout` is a manager default in milliseconds. A connector or custom server can override it for its own connect and `listTools()` readiness flow.

```tsx
"use client";

import type { ReactNode } from "react";
import { AuiConfig, AuiProvider, useAui } from "@assistant-ui/react";
import { McpManagerResource, defineConnector } from "@assistant-ui/react-mcp";

const connectors = [
  defineConnector({
    id: "linear",
    name: "Linear",
    url: "https://mcp.linear.app",
    auth: { type: "oauth", scopes: ["read"] },
    icon: "/icons/linear.svg",
  }),
  defineConnector({
    id: "weather",
    name: "Weather",
    url: "https://mcp.example.com/weather",
    auth: { type: "none" },
    connectionTimeout: 10_000,
  }),
];

export function Providers({ children }: { children: ReactNode }) {
  const aui = useAui();
  const config = AuiConfig({
    mcp: McpManagerResource({
      connectors,
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

Connectors are application presets and cannot be removed. A custom server is user supplied through `McpAddFormPrimitive` or `aui.mcp.addCustomServer(...)`. Both kinds share state, storage, elicitation, and the tool registration path. See [setup](./references/setup.md) for manager options and storage lifetime rules.

## Continue after frontend tool calls

The manager registers connected tools automatically. A chat runtime still needs to send completed frontend tool results to the route so the model can continue.

```tsx
"use client";

import type { ReactNode } from "react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

export function Chat({ children }: { children: ReactNode }) {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

If no chat runtime provides `modelContext`, the manager mounts a minimal one. Use `aui.mcp.server({ id }).callTool(...)` for a direct call in an event handler.

## Use the configuration UI

Install the styled dialog with `npx assistant-ui@latest add mcp-config`. It is a copied runtime connected element, so import it from `@/components/assistant-ui/elements/mcp-config.aui` and render it under the manager provider.

```tsx
import { McpConfigDialog } from "@/components/assistant-ui/elements/mcp-config.aui";

export function ServerSettings() {
  return <McpConfigDialog />;
}
```

Pass an element as `children` to replace its default trigger. For a settings page, sidebar, or custom add flow, compose the headless primitives in [ui](./references/ui.md).

## Render elicitation requests

An MCP server can request structured input while a tool call is in flight. Render `Items` in the same `mcpServer` scope as the connected server. Set `elicitation: false` on a connector or custom server to opt it out of the protocol capability.

```tsx
import { McpElicitationPrimitive } from "@assistant-ui/react-mcp";

type FieldSchema = {
  type?: string;
  enum?: readonly string[];
};

export function ElicitationRequests() {
  return (
    <McpElicitationPrimitive.Items>
      {() => (
        <McpElicitationPrimitive.Root>
          <McpElicitationPrimitive.Message />
          <McpElicitationPrimitive.Error />
          <McpElicitationPrimitive.Fields>
            {({ name, schema, value, setValue }) => {
              const field = schema as FieldSchema;
              if (field.type === "boolean") {
                return (
                  <label>
                    {name}
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(event) => setValue(event.target.checked)}
                    />
                  </label>
                );
              }
              if (field.enum) {
                return (
                  <label>
                    {name}
                    <select
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) => setValue(event.target.value)}
                    >
                      {!field.enum.includes("") && <option value="">Select {name}</option>}
                      {field.enum.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              return (
                <label>
                  {name}
                  <input
                    value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
              );
            }}
          </McpElicitationPrimitive.Fields>
          <McpElicitationPrimitive.Accept>Submit</McpElicitationPrimitive.Accept>
          <McpElicitationPrimitive.Decline>Decline</McpElicitationPrimitive.Decline>
          <McpElicitationPrimitive.Cancel>Cancel</McpElicitationPrimitive.Cancel>
        </McpElicitationPrimitive.Root>
      )}
    </McpElicitationPrimitive.Items>
  );
}
```

The render function receives a separate active request each time. Numeric strings are coerced when valid, while boolean fields must set a boolean. An empty string is unanswered unless the property allows it through an enum member or default, so render enum properties as a select. `Accept` remains disabled for missing required fields and invalid values.

## v1 scope

This package ships tool listing and invocation, resource listing and reads, form elicitation, OAuth with PKCE and DCR, bearer and no auth, Streamable HTTP transport, and manual connect or disconnect. Prompts, sampling, automatic reconnect with backoff, persisted per tool enablement, per tool consent, and built in token encryption are deferred.

## Common Gotchas

**Tools never reach the model**

- The server must be `connected`. Its tools are named `serverId__toolName`, not just the MCP tool name.
- Configure `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` on `useChatRuntime` so completed frontend tool calls resume the model.

**OAuth callback fails or never completes**

- The callback route must exactly match `oauthRedirectUri` and render `McpOAuthCallback` beneath the manager provider.
- A CIMD only authorization server without a registration endpoint needs a static OAuth `clientId`.

**Server state leaks across users or a storage swap loses records**

- `McpLocalStorage()` is browser only and stores tokens in plain text. Use an HTTP only cookie backed `McpCustomStorage` for production auth state.
- Do not swap `storage` for another user. Remount the manager because custom server records hydrate only once. See [storage identity](./references/setup.md#storage-and-scope-identity).

**An elicitation form stays blank**

- `Items` renders nothing without pending requests and requires the matching server scope. Confirm that the server is connected and has not set `elicitation: false`.

**A resource browser stops after the first page**

- Pass each returned `nextCursor` to `listResources({ cursor })` until it is absent, then call `readResource(uri)` for a selected item.

## Related Skills

- [tools](../tools/SKILL.md) -- developer owned frontend and backend tools that complement user managed MCP servers
- [setup](../setup/SKILL.md) -- CLI setup and the `mcp` project template
- [runtime](../runtime/SKILL.md) -- `useChatRuntime` and runtime provider configuration
- [elements](../elements/SKILL.md) -- installing and modifying the copied `mcp-config` element
