# MCP configuration UI

Use the copied `McpConfigDialog` for the standard configuration flow. Use `McpManagerPrimitive`, `McpServerPrimitive`, and `McpAddFormPrimitive` when the product needs a different layout. All primitives read the mounted `mcp` scope and are unstyled.

## Contents

- [Drop in dialog](#drop-in-dialog)
- [Manager and server primitives](#manager-and-server-primitives)
- [Add custom server form](#add-custom-server-form)
- [State and hooks](#state-and-hooks)

## Drop in dialog

Install the runtime connected element and keep the copied source under `components/assistant-ui/elements/`.

```bash
npx assistant-ui@latest add mcp-config
```

```tsx
import { McpConfigDialog } from "@/components/assistant-ui/elements/mcp-config.aui";

export function ServerSettings() {
  return (
    <McpConfigDialog>
      <button type="button">MCP servers</button>
    </McpConfigDialog>
  );
}
```

Without `children`, `McpConfigDialog` supplies its own trigger. It lists connectors and custom servers, renders connection and auth actions, reports errors, and contains a custom server form. It needs a live manager in an ancestor and does not have a standalone props mode.

## Manager and server primitives

`McpManagerPrimitive.Root` provides manager UI context and sets `data-mcp-hydrated` after persisted custom servers load. Its `Connectors` and `CustomServers` children must be render functions. Each call receives `{ server }` and supplies the matching `mcpServer` scope to nested server primitives.

```tsx
import {
  McpManagerPrimitive,
  McpServerPrimitive,
} from "@assistant-ui/react-mcp";

function ServerCard() {
  return (
    <McpServerPrimitive.Root>
      <McpServerPrimitive.Icon />
      <McpServerPrimitive.Name />
      <McpServerPrimitive.Status />
      <McpServerPrimitive.ConnectButton>Connect</McpServerPrimitive.ConnectButton>
      <McpServerPrimitive.OAuthLink>Authorize</McpServerPrimitive.OAuthLink>
      <McpServerPrimitive.DisconnectButton>Disconnect</McpServerPrimitive.DisconnectButton>
      <McpServerPrimitive.RemoveButton>Remove</McpServerPrimitive.RemoveButton>
      <McpServerPrimitive.Error />
      <McpServerPrimitive.Tools>
        {() => <McpServerPrimitive.ToolName />}
      </McpServerPrimitive.Tools>
    </McpServerPrimitive.Root>
  );
}

export function ServerList() {
  return (
    <McpManagerPrimitive.Root>
      <McpManagerPrimitive.Connectors>
        {({ server }) => <ServerCard key={server.id} />}
      </McpManagerPrimitive.Connectors>
      <McpManagerPrimitive.CustomServers>
        {({ server }) => <ServerCard key={server.id} />}
      </McpManagerPrimitive.CustomServers>
      <McpManagerPrimitive.AddCustomTrigger>Add server</McpManagerPrimitive.AddCustomTrigger>
    </McpManagerPrimitive.Root>
  );
}
```

`AddCustomTrigger` is only a button primitive. Pair it with local state to show an add form or use the copied dialog, which owns that composition. The server parts are:

| Part | Behavior |
|---|---|
| `Root` | Sets `data-server-id`, `data-kind`, `data-connection-state`, and `data-has-error`. |
| `Name` | Renders the current server name unless it has children. |
| `Icon` | Renders an image from `icon`, or an overridden `src`, and nothing when neither exists. |
| `Status` | Renders the connection state and sets `data-state`. |
| `Error` | Renders the latest error message and nothing when there is no error. |
| `ConnectButton` | Calls `connect()` and renders only for `disconnected`, `error`, or `authRequired`. |
| `OAuthLink` | Opens `authorizationUrl`, or its `href` override, in a new tab and renders nothing without one. |
| `DisconnectButton` | Calls `disconnect()` and renders only for `connected`, `connecting`, or `authPending`. |
| `RemoveButton` | Calls `remove()` and renders only for a custom server. |
| `Tools` | Calls its render function once per tool and renders nothing for an empty list. |
| `ToolName` | Renders the current `Tools` item name and requires the `Tools` scope. |

`McpServerPrimitive.useMcpServerTool()` returns the current `MCPToolInfo` inside `Tools`. For a fixed server outside an iteration primitive, wrap it in `McpServerByIdProvider id="..."` before rendering a `McpServerPrimitive.Root`.

## Add custom server form

`McpAddFormPrimitive.Root` owns a form draft. It validates a nonempty name, an HTTP or HTTPS URL, and a bearer token when bearer auth is selected. On success it calls `aui.mcp.addCustomServer(...)`, resets its state, and calls `onSubmitted(id)`.

```tsx
import { McpAddFormPrimitive } from "@assistant-ui/react-mcp";

export function AddServerForm({ onClose }: { onClose: () => void }) {
  return (
    <McpAddFormPrimitive.Root onSubmitted={onClose} onCancel={onClose}>
      <McpAddFormPrimitive.NameField />
      <McpAddFormPrimitive.UrlField />
      <McpAddFormPrimitive.AuthSelect />
      <McpAddFormPrimitive.AuthFields />
      <McpAddFormPrimitive.Error />
      <McpAddFormPrimitive.Cancel>Cancel</McpAddFormPrimitive.Cancel>
      <McpAddFormPrimitive.Submit>Add server</McpAddFormPrimitive.Submit>
    </McpAddFormPrimitive.Root>
  );
}
```

| Part | Behavior |
|---|---|
| `Root` | Renders the form and accepts `onSubmitted(id)` and `onCancel`. |
| `NameField` | Controlled text input for the display name. |
| `UrlField` | Controlled URL input. |
| `AuthSelect` | Controlled select for `oauth`, `bearer`, or `none`, defaulting to `oauth`. |
| `AuthFields` | Default bearer token or OAuth scopes input. Its render function receives `{ authType }`. |
| `Error` | Renders form validation or submit failure text. |
| `Submit` | Submits the form and is disabled while it is submitting. |
| `Cancel` | Resets the draft and calls `onCancel`. |

The default OAuth scopes input splits spaces and commas into the `scopes` array. To replace the default inputs, pass an `AuthFields` render function that receives the current `authType`.

## State and hooks

Use `useAuiState` for reactive state. `s.mcpServer` is only available inside a server provider or manager iteration. `McpElicitationPrimitive.Items`, `McpElicitationPrimitive.useMcpElicitation()`, and `McpElicitationPrimitive.useMcpElicitationField()` also require this same server scope.

```tsx
import { useAuiState } from "@assistant-ui/store";
import { McpServerPrimitive } from "@assistant-ui/react-mcp";

export function ServerSummary() {
  const hydrated = useAuiState((state) => state.mcp.isHydrated);
  const connectionState = useAuiState((state) => state.mcpServer.connectionState);
  const error = useAuiState((state) => state.mcpServer.lastError?.message ?? null);
  return <p>{error ?? `${hydrated}: ${connectionState}`}</p>;
}

export function ToolRow() {
  const tool = McpServerPrimitive.useMcpServerTool();
  return <span>{tool.name}</span>;
}
```

Connection states are `disconnected`, `authRequired`, `authPending`, `connecting`, `connected`, and `error`. `McpServerPrimitive.Root` exposes the same value as `data-connection-state` for styling.
