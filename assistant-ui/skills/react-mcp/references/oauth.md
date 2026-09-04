# MCP OAuth and authentication

Each connector or custom server declares one `MCPAuthConfig`. OAuth state is persisted through the manager storage and completed from a single browser callback route.

## Contents

- [Authentication shapes](#authentication-shapes)
- [OAuth flow and CIMD](#oauth-flow-and-cimd)
- [Callback route and hook](#callback-route-and-hook)
- [Connection lifecycle](#connection-lifecycle)

## Authentication shapes

The supported auth union has exactly three variants.

```ts
const noAuth = { type: "none" };

const bearerAuth = {
  type: "bearer",
  token: "token",
};

const oauthAuth = {
  type: "oauth",
  scopes: ["read"],
  authorizationEndpoint: "https://auth.example.com/authorize",
  tokenEndpoint: "https://auth.example.com/token",
  registrationEndpoint: "https://auth.example.com/register",
  clientId: "client-id",
  clientSecret: "client-secret",
};
```

`none` sends no auth header. `bearer` accepts an optional token and sends it as a bearer authorization header when present. OAuth accepts optional `scopes`, endpoint overrides, `clientId`, and `clientSecret`. Omit endpoint overrides to use authorization server metadata discovery. The add form can create `none`, bearer, and OAuth records, but its OAuth form only supplies scopes. Configure static client metadata on an application connector when required.

## OAuth flow and CIMD

For OAuth, the client performs discovery, PKCE, token exchange, and refresh through the MCP SDK. It persists pending state and tokens with the manager storage, exposes a server `authorizationUrl`, and embeds the server id in OAuth `state` so one callback route can resolve any connected server.

The 2026-07-28 MCP specification deprecates RFC 7591 dynamic client registration in favor of Client ID Metadata Documents (CIMD). Dynamic registration remains available for authorization servers that support it. If an authorization server is CIMD only and has no `registration_endpoint`, configure a static `clientId`; include `clientSecret` only when the registered client requires it. A static `clientId` bypasses dynamic registration.

Set the redirect URI on the manager whenever it differs from the default `${window.location.origin}/mcp/callback`.

```ts
import { McpManagerResource } from "@assistant-ui/react-mcp";

const mcp = McpManagerResource({
  connectors,
  oauthRedirectUri: `${window.location.origin}/auth/mcp`,
});
```

## Callback route and hook

Render `McpOAuthCallback` at the configured redirect URI under the same provider tree as `McpManagerResource`. It reads the full current URL by default, validates the state, resolves the server, calls `completeAuth`, and then calls `onComplete(serverId)` or `onError(error)`.

```tsx
"use client";

import { McpOAuthCallback } from "@assistant-ui/react-mcp";
import { useRouter } from "next/navigation";
import { Providers } from "../../providers";

export default function Callback() {
  const router = useRouter();

  return (
    <Providers>
      <McpOAuthCallback onComplete={() => router.replace("/mcp")} />
    </Providers>
  );
}
```

Use `useMcpOAuthCallback` to build a custom callback screen. Its result is `{ status, serverId, error }`, where `status` is `idle`, `running`, `done`, or `error`.

```tsx
import { useMcpOAuthCallback } from "@assistant-ui/react-mcp";

export function CallbackStatus() {
  const { status, serverId, error } = useMcpOAuthCallback({
    onComplete: (id) => console.log(id),
    onError: (reason) => console.error(reason),
  });

  return <p>{error ? error.message : `${status}: ${serverId ?? ""}`}</p>;
}
```

The hook accepts an optional full callback `url`; otherwise it uses `window.location.href`. The OAuth code is single use, so render one callback handler for a URL and let it finish before navigating away.

## Connection lifecycle

Use `McpServerPrimitive` for state matched actions or call the server methods in an event handler. `ConnectButton` begins a normal connection. If the server needs OAuth it reaches `authRequired`, produces an authorization URL, and `OAuthLink` opens it. A completed callback resumes connection and tool listing.

| State | Meaning |
|---|---|
| `disconnected` | No active connection. |
| `authRequired` | OAuth is needed before connection can continue. |
| `authPending` | Authorization is in progress. |
| `connecting` | The client is opening the transport or listing tools. |
| `connected` | Tools and resource methods are ready. |
| `error` | The latest connection attempt failed. Read `s.mcpServer.lastError`. |

`connectionTimeout` applies to transport connection and tool listing. A custom server or connector setting wins over the manager setting. Call `disconnect()` to close a live or pending connection. `remove()` and `aui.mcp.removeServer(id)` only remove custom servers and clear their auth state.
