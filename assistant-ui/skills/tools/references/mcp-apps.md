# MCP Apps

An MCP Apps server ships a UI resource alongside a tool: a self-contained HTML widget the chat host renders inline when the tool is called. assistant-ui mounts it in a sandboxed cross-origin iframe and runs a JSON-RPC bridge over `postMessage`, so the widget can call tools, send messages, request a display mode, and read host context.

The renderer only acts on resource URIs that start with `ui://`. A tool whose `resourceUri` uses another scheme falls through to your regular tool UI.

## Contents

- [Mount the renderer](#mount-the-renderer) | [Handlers](#handlers) | [Per-app options](#per-app-options) | [Route handler](#route-handler) | [Multiple servers](#multiple-servers) | [AI SDK integration](#ai-sdk-integration) | [OpenAI Apps SDK servers](#openai-apps-sdk-servers) | [Bridge protocol](#bridge-protocol) | [Sandboxing and security](#sandboxing-and-security)

## Mount the renderer

`McpAppRenderer` is passed to `Tools` next to the toolkit. `McpAppsRemoteHost` is the default host strategy: it POSTs `{ method, params }` to a route you own, so credentials and transport stay on the server.

```tsx
import {
  AuiConfig,
  AuiProvider,
  McpAppRenderer,
  McpAppsRemoteHost,
  Tools,
  useAui,
} from "@assistant-ui/react";
import type { ReactNode } from "react";
import toolkit from "./toolkit";

function McpApps({ children }: { children: ReactNode }) {
  const aui = useAui();
  const config = AuiConfig({
    tools: Tools({
      toolkit,
      mcpApp: McpAppRenderer({
        host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
        hostInfo: { name: "my-app", version: "1.0.0" },
        hostContext: { theme: "light" },
      }),
    }),
  });
  return (
    <AuiProvider extends={aui} config={config}>
      {children}
    </AuiProvider>
  );
}
```

Any tool-call part carrying `mcp.app` metadata renders the widget automatically; `getMcpAppFromToolPart(part)` reads that metadata and returns `undefined` when the part points at no assistant-ui MCP app resource. A different host strategy (a client-side MCP client, say) is any resource returning the `McpAppsHost` shape of `{ loadResource, callTool, readResource, listResources }`.

Changing `headers` or a custom `fetch` applies to later host requests without reloading the widget. When the account or workspace identity changes, key the host so its resource reloads.

```tsx
import { withKey } from "@assistant-ui/tap";

const mcpApp = McpAppRenderer({
  host: withKey(
    workspaceId,
    McpAppsRemoteHost({
      url: "/api/mcp-apps",
      headers: () => getWorkspaceHeaders(workspaceId),
    }),
  ),
});
```

## Handlers

`openLink` defaults to `window.open(url, "_blank", "noopener,noreferrer")` and `sendMessage` defaults to appending a user message to the current thread, accepting the MCP Apps `{ role, content }` params plus the legacy string, `{ prompt }`, `{ text }`, and `{ message }` forms. Capabilities are advertised at mount, so provide any extra handler before the widget initializes.

```tsx
McpAppRenderer({
  host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
  handlers: {
    requestDisplayMode: ({ mode }) => applyHostDisplayMode(mode),
    updateModelContext: applyHostModelContext,
    openLink: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
  },
});
```

`requestDisplayMode` should apply the change and return the mode actually honored; echoing `{ mode }` without applying it tells the widget a change happened while the host stays inline. Caller handlers override the defaults and can add lifecycle hooks such as `onInitialized`, `onSizeChange`, `onLog`, `onError`, and `onRequestTeardown`. `callTool`, `readResource`, and `listResources` stay bound to the configured `host`.

## Per-app options

One renderer serves every MCP app in the thread, so `hostContext`, `handlers`, and the display options are thread-wide defaults. `forPart` runs per MCP-app tool call and every option it returns replaces the thread-wide one for that app alone. `handlers` is the exception and merges per key, so returning only `requestDisplayMode` keeps the thread-wide `onError` and `onInitialized`.

```tsx
import type { McpAppDisplayMode } from "@assistant-ui/react";

const [modes, setModes] = useState<Record<string, McpAppDisplayMode>>({});

McpAppRenderer({
  host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
  hostContext: { theme },
  forPart: (part) => ({
    hostContext: {
      theme,
      displayMode: modes[part.toolCallId] ?? "inline",
      availableDisplayModes: ["inline", "fullscreen", "pip"],
    },
    handlers: {
      requestDisplayMode: ({ mode }) => {
        setModes((current) => ({ ...current, [part.toolCallId]: mode }));
        return { mode };
      },
    },
  }),
});
```

`forPart` resolves before a part's first render. `hostContext` is delivered again whenever it changes, and a structurally unchanged one never reaches the widget. Handlers are called through live references, but which handler keys exist is captured when the frame mounts, so return the same keys for a part on every render. `hostInfo` and the `sandbox` settings other than `className` and `style` are read once at mount.

## Route handler

The renderer POSTs four method names: `mcp-apps/read-resource`, `tools/call`, `resources/read`, and `resources/list`. Reject anything else server side and apply your own auth and rate limiting there, because the renderer trusts whatever the route returns.

```ts title="app/api/mcp-apps/route.ts"
import { createMCPClient } from "@ai-sdk/mcp";

export async function POST(req: Request) {
  const { method, params } = await req.json();
  const client = await getClient(params?.serverId);

  switch (method) {
    case "mcp-apps/read-resource": {
      const { contents } = await client.readResource({ uri: params.uri });
      const content = contents.find((x: { uri: string }) => x.uri === params.uri);
      return Response.json({
        uri: params.uri,
        mimeType: "text/html;profile=mcp-app",
        html: content?.text ?? "",
      });
    }
    case "tools/call": {
      const tools = await client.tools();
      const tool = tools[params.name];
      if (!tool?.execute) {
        return Response.json({ error: "Tool not callable" }, { status: 400 });
      }
      return Response.json(
        await tool.execute(params.arguments ?? {}, {
          toolCallId: `mcp-apps-bridge-${crypto.randomUUID()}`,
          messages: [],
        }),
      );
    }
    case "resources/read":
      return Response.json(await client.readResource({ uri: params.uri }));
    case "resources/list": {
      const { serverId: _, ...listParams } = params ?? {};
      return Response.json(await client.listResources(listParams));
    }
    default:
      return Response.json({ error: "Unsupported method" }, { status: 400 });
  }
}
```

## Multiple servers

When a tool part carries `mcp.app.serverId`, the renderer forwards it as `params.serverId` so the route can pick the client that owns the resource. Match the route's map keys to the identity your stack emits; `@ag-ui/mcp-apps-middleware` uses its configured `serverId` and falls back to `serverHash`. Omitting `serverId` keeps the single-server behavior.

## AI SDK integration

`@assistant-ui/ai-sdk` forwards `callProviderMetadata.mcp.app` from AI SDK tool UI parts into `ToolCallMessagePart.mcp.app`, so an MCP-Apps-capable server needs no extra wiring on the part shape. On the chat route, keep app-only tools out of the model's view with `splitMcpAppTools()` from `@ai-sdk/mcp`.

```ts
import { splitMcpAppTools } from "@ai-sdk/mcp";

const tools = await client.listTools();
const { modelVisible } = splitMcpAppTools(tools);

const result = streamText({
  model: openai("gpt-5.6-luna"),
  tools: modelVisible.tools,
  messages: await convertToModelMessages(messages),
});
```

The rich UI comes from the server's metadata rather than the model, so the path is the same whichever provider drives the conversation.

## OpenAI Apps SDK servers

An OpenAI Apps SDK server points at the same `ui://` template through `_meta["openai/outputTemplate"]` on the tool definition and serves it as `text/html+skybridge`. `@ai-sdk/mcp` does not recognize that key, so `callProviderMetadata.mcp.app` stays empty and the renderer stays idle. assistant-ui also reads `result._meta.ui.resourceUri` off tool results, so the smallest bridge is to copy the template onto the result by tool name inside each tool's `execute` before handing the tools to `streamText`. Serve the resource with the `text/html;profile=mcp-app` mime type that `McpAppResource` expects; do not forward the raw skybridge value.

## Bridge protocol

Widget to host requests: `ui/initialize` (always supported, returns `{ protocolVersion, host, hostContext, capabilities }`), `tools/call`, `resources/read`, `resources/list`, `openLink` (rejects non-http URLs with `-32602`), `sendMessage`, `requestDisplayMode` (`inline`, `fullscreen`, `pip`), and `updateModelContext`. A method with no handler returns `-32601`, which is also how missing capabilities are reported during `ui/initialize`; bad params return `-32602`.

Host to widget notifications: `notifications/tools/call/input` on every change to the streaming `part.args`, `notifications/tools/call/result` when the result lands, and `notifications/host_context/changed` when `hostContext` changes. Widget to host notifications are `initialized`, `size_changed`, `log`, `error`, and `request_teardown`. If a widget never sends `notifications/initialized`, the host flushes queued notifications after a five second safety timeout.

## Sandboxing and security

The iframe is built with `SafeContentFrame`, which serves each widget from a content-hashed cross-origin so the host page is not reachable through `same-origin` references. Default sandbox flags are `allow-same-origin allow-scripts`; tune them through the `sandbox` field.

```tsx
McpAppRenderer({
  host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
  sandbox: {
    sandbox: ["allow-forms", "allow-popups"],
    enableBrowserCaching: true,
    className: "my-mcp-app",
  },
});
```

Incoming messages are filtered by both source window and origin, and anything else is dropped silently. Your route is the auth boundary. Treat every URL reaching `openLink` as untrusted even though the bridge already rejects non-http schemes. Keep custom `host` and `handlers` references stable across renders, from module scope or `useMemo`; an unstable custom host keeps the widget in its loading fallback and refetches on every parent render.
