# Server-side MCP

An MCP server publishes tools that any MCP-aware client can call. The client lives on your server, inside the AI SDK route handler: it connects, lists tools, and hands the map to `streamText`. The tool calls then flow through the ordinary assistant-ui tool-call rendering.

For servers the end user adds and authenticates in the browser, use the [react-mcp skill](../../react-mcp/SKILL.md) instead.

## Contents

- [Install](#install) | [Declare servers in the toolkit](#declare-servers-in-the-toolkit) | [Disabling a server or a tool](#disabling-a-server-or-a-tool) | [Prefixing tool names](#prefixing-tool-names) | [The route with AISDKToolkit](#the-route-with-aisdktoolkit) | [Manual MCP client](#manual-mcp-client) | [Rendering MCP tool calls](#rendering-mcp-tool-calls) | [Approval before an MCP tool runs](#approval-before-an-mcp-tool-runs) | [Notes](#notes)

## Install

```bash
npm install @ai-sdk/mcp
```

For stdio transports, which are for local development only, also install `@modelcontextprotocol/sdk`.

## Declare servers in the toolkit

`defineMcpToolkit` is a spreadable fragment. Each entry key names the server connection, not a tool: the server publishes the actual tool names. Use a readable key, because it appears in connection, listing, and close errors.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineMcpToolkit, defineToolkit } from "@assistant-ui/react";

export default defineToolkit({
  ...defineMcpToolkit({
    github: {
      type: "http",
      url: "https://mcp.example.com/mcp",
      connectionTimeout: 10_000,
    },
  }),
  // your own tools
});
```

`connectionTimeout` is optional and measured in milliseconds. It bounds the whole readiness path, `createMCPClient()` plus `tools()`, so a bad URL or a hanging local process cannot stall the route.

## Disabling a server or a tool

Pass `{ server, disabled }` when a server should stay configured but expose nothing for this request, for example missing credentials or plan gating. Pass `tools` to hide individual MCP tools while the server stays enabled.

```tsx
defineMcpToolkit({
  docs: {
    server: { type: "http", url: process.env.DOCS_MCP_URL! },
    disabled: !process.env.DOCS_MCP_URL,
    tools: { deleteDocument: { disabled: !userCanDelete } },
  },
});
```

## Prefixing tool names

When two servers publish the same tool name, give each entry a `prefix` so the model sees distinct names.

```tsx
export default defineToolkit({
  ...defineMcpToolkit({
    docs: {
      server: { type: "http", url: "https://docs.example.com/mcp" },
      prefix: "docs_",
    },
    github: {
      server: { type: "http", url: "https://github.example.com/mcp" },
      prefix: "github_",
    },
  }),
});
```

The model then receives `docs_search` and `github_search`. Renderer keys and approval keys must use the prefixed name.

## The route with AISDKToolkit

`AISDKToolkit.tools()` opens the MCP clients declared in the toolkit, merges their tools with your own and with the frontend tools uploaded in the request body, and reports a collision when an MCP tool name clashes with another source. Keep the instance at module scope so connections pool across requests, and close it when the response finishes.

```ts title="app/api/chat/route.ts"
import { AISDKToolkit } from "@assistant-ui/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import toolkit from "../../toolkit";

const aiToolkit = new AISDKToolkit({ toolkit });

export async function POST(req: Request) {
  const { messages, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
    tools: await aiToolkit.tools({ frontend: tools }),
    onFinish: async () => {
      await aiToolkit.close();
    },
  });

  return result.toUIMessageStreamResponse();
}
```

`close()` settles every client, so a connect or close failure surfaces as one error, or as an `AggregateError` when several fail.

## Manual MCP client

Without a generative toolkit, drive the AI SDK client yourself. `mcpClient.tools()` returns an object shaped exactly like the `tools` argument of `streamText`.

```ts title="app/api/chat/route.ts"
import { createMCPClient } from "@ai-sdk/mcp";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const mcpClient = await createMCPClient({
    transport: {
      type: "http",
      url: process.env.MCP_SERVER_URL!,
      headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` },
    },
  });

  const tools = await mcpClient.tools();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
    tools,
    onFinish: async () => {
      await mcpClient.close();
    },
  });

  return result.toUIMessageStreamResponse();
}
```

HTTP is the production transport, SSE is the legacy streaming one, and stdio spawns a local process with `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`. `onFinish` is the right place to close: it fires after the stream completes, so the connection stays open while the model is still calling tools.

Combine servers by spreading their tool maps, and close each one. If two servers publish the same name the later spread wins, so rename or prefix.

```ts
const tools = {
  ...(await githubClient.tools()),
  ...(await filesClient.tools()),
};
```

## Rendering MCP tool calls

With no setup, `ToolFallback` renders the call name, arguments, and result. To customize one tool, add an entry whose key matches the published tool name and whose executor is `externalTool()`, so the compiler keeps only the renderer.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineMcpToolkit, defineToolkit, externalTool } from "@assistant-ui/react";

type Args = { repo: string; number: number };
type Result = { title: string; state: string; url: string };

export default defineToolkit({
  ...defineMcpToolkit({
    github: { type: "http", url: "https://mcp.example.com/mcp" },
  }),
  github_get_issue: {
    execute: externalTool(),
    render: ({ args, result }: { args: Args; result?: Result }) => (
      <div>
        <span>
          {args.repo}#{args.number}
        </span>
        {result && <a href={result.url}>{result.title} ({result.state})</a>}
      </div>
    ),
  },
});
```

Register the toolkit once with `const config = AuiConfig({ tools: Tools({ toolkit }) })` and `config={config}` on the provider.

## Approval before an MCP tool runs

MCP tools execute on the server, so approval is a server-side gate, not a human tool. Gate the call with the AI SDK v7 `toolApproval` option keyed by the model-visible name, and let the client post the decision back.

```ts title="app/api/chat/route.ts"
const result = streamText({
  model: openai("gpt-5.6-luna"),
  messages: await convertToModelMessages(messages),
  tools: await aiToolkit.tools({ frontend: tools }),
  toolApproval: { github_delete_repository: "user-approval" },
});
```

```tsx
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";

const runtime = useChatRuntime({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

The renderer, custom or the default `ToolFallback`, then receives `approval` and `respondToApproval` like any other backend tool; see [human-in-loop.md](./human-in-loop.md).

## Notes

- Server side only. The MCP client uses Node APIs, so never instantiate it in client code.
- A fresh client per request keeps connection state simple. If you pool clients yourself, the connection must still be alive when `streamText` runs.
- MCP servers can also ship UI resources; see [mcp-apps.md](./mcp-apps.md).
