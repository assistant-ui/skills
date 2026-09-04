---
name: tools
description: "Defines model-callable tools and renders their calls in assistant-ui. Covers the current authoring model: a \"use generative\" file whose default export is defineToolkit({...}), compiled by withAui from @assistant-ui/next, aui() from @assistant-ui/vite, or withAui from @assistant-ui/metro, mounted with const config = AuiConfig({ tools: Tools({ toolkit }) }) on <AssistantRuntimeProvider runtime={runtime} config={config}>, and exposed to the model with new AISDKToolkit({ toolkit }).tools({ frontend }) in an AI SDK route. Covers the tool kinds inferred from execute (plain backend, \"use client\" frontend, humanTool(), providerTool(), externalTool(), stubTool() plus useAuiToolOverrides, defineMcpToolkit() spreads), render / renderText / display, toModelOutput, providerOptions, ToolCallMessagePartProps (args, argsText, status, result, isError, timing, interrupt, approval, addResult, resume, respondToApproval), useToolArgsStatus, useToolCallElapsed, useInlineRender, server-side approval gates with toolApprovalAcceptsText, MCP servers, MCP Apps, WebMCP, and sub-agent messages. Reach for it when a tool is never called, a tool UI does not render, a frontend result never reaches the model, humanTool() throws at runtime, or an approval gate cannot be answered. For UI the model composes from a vocabulary you ship use generative-ui, for MCP servers the end user adds in the browser use react-mcp, and for the styled ToolFallback and ToolGroup files use elements."
license: MIT
---

# assistant-ui Tools

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

A tool is a named capability the model can call. In assistant-ui you declare tools in a toolkit, a map whose keys are the tool names the model sees and whose values carry the schema, the executor, and the renderer. The supported authoring path is a `"use generative"` file compiled by a build plugin, which splits one file into a server build (schema plus backend executors) and a client build (schema plus renderers plus browser executors).

## References

- [./references/toolkits.md](./references/toolkits.md) -- authoring a toolkit end to end: kinds, renderers, `toModelOutput`, `providerOptions`, stubs, splitting and merging files, `backendless`
- [./references/tool-ui.md](./references/tool-ui.md) -- rendering states, `useToolArgsStatus`, deferred rendering, streaming args, `ToolFallback` and `ToolGroup`
- [./references/human-in-loop.md](./references/human-in-loop.md) -- human tools, `human()` interrupts, and the full approval gate surface
- [./references/mcp-server.md](./references/mcp-server.md) -- server-side MCP servers and `defineMcpToolkit`
- [./references/mcp-apps.md](./references/mcp-apps.md) -- rendering MCP App `ui://` widgets with `McpAppRenderer`
- [./references/webmcp.md](./references/webmcp.md) -- publishing frontend tools to the browser agent with `unstable_useWebMcpProvider`
- [./references/multi-agent.md](./references/multi-agent.md) -- sub-agent conversations inside a tool call
- [./references/legacy-component-apis.md](./references/legacy-component-apis.md) -- the deprecated `makeAssistantTool` family and how to migrate off it

## The authoring model

### 1. Add the build plugin

The directive does nothing without a compiler.

```ts title="next.config.ts"
import { withAui } from "@assistant-ui/next";

export default withAui({
  /* your Next config */
});
```

Vite and TanStack Start add `aui()` from `@assistant-ui/vite` to `plugins` instead; Expo and bare React Native wrap the Metro config with `withAui` from `@assistant-ui/metro`. All three take an `aui` options object, documented in [toolkits.md](./references/toolkits.md).

### 2. Write the toolkit

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  get_weather: {
    description: "Get current weather for a location.",
    parameters: z.object({
      location: z.string().describe("City name or zip code"),
      unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
    }),
    execute: async ({ location, unit }) => {
      "use client";
      return fetchWeatherAPI(location, unit);
    },
    render: ({ args, result }) =>
      result ? (
        <div>
          {result.temperature} {args.unit}
        </div>
      ) : (
        <div>Fetching weather for {args.location}</div>
      ),
  },
});
```

### 3. Mount it on the client

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import toolkit from "./toolkit";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const config = AuiConfig({ tools: Tools({ toolkit }) });
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

To scope a toolkit to part of the tree instead, wrap that subtree in `<AuiProvider extends={aui} config={config}>` with `const aui = useAui()`. `useChatRuntime()` targets `/api/chat` by default.

### 4. Expose it to the model

The same import resolves to the server build inside a route handler.

```ts title="app/api/chat/route.ts"
import { AISDKToolkit } from "@assistant-ui/ai-sdk";
import { streamText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import toolkit from "../../toolkit";

const aiToolkit = new AISDKToolkit({ toolkit });

export async function POST(req: Request) {
  const { messages, system, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    system,
    messages: await convertToModelMessages(messages),
    tools: await aiToolkit.tools({ frontend: tools }),
  });

  return result.toUIMessageStreamResponse();
}
```

`AISDKToolkit.tools()` registers every toolkit tool with the model, wires the backend `execute` where the server build carries one, merges the frontend tools the client uploaded in the request body, and opens any MCP servers the toolkit spreads in. A server `execute` wins over an uploaded entry of the same name.

## Tool kinds

The kind is inferred from `execute` and written back as `type`. You never author `type` in a `"use generative"` file.

| `execute` you write | Inferred kind | Server build keeps | Client build keeps |
| --- | --- | --- | --- |
| plain `async () => ...` | backend | schema plus `execute`, guarded by `server-only` | schema plus `render` |
| `async () => { "use client"; ... }` | frontend | schema only | schema plus `execute` plus `render` or `renderText` |
| `humanTool()` | human | schema only | schema plus `render` |
| `stubTool()` | frontend, executor supplied at runtime | schema only | schema plus `render` or `renderText` |
| `providerTool({ ... })` | provider | schema plus provider config | schema plus provider config |
| `externalTool()` | backend, defined elsewhere | omitted | `type: "backend"` plus `render` or `renderText` |

The compiler enforces at build time that every tool declares an `execute`, that a frontend tool declares a `render` or `renderText`, and that a human tool declares a `render`. `humanTool()` and `stubTool()` have no runtime implementation and throw when reached, which means that file was never compiled; `externalTool()` is a compile-time marker in the same way.

## Rendering a tool call

`render` receives the live call as `ToolCallMessagePartProps`.

| Field | Type | Notes |
| --- | --- | --- |
| `args` | `TArgs` | Parsed arguments, partial while streaming |
| `argsText` | `string` | Raw, possibly partial JSON |
| `result` | `TResult \| undefined` | Present once the call has a result |
| `isError` | `boolean \| undefined` | Whether the result represents a failure |
| `status` | `ToolCallMessagePartStatus` | `running`, `complete`, `incomplete` with a `reason`, or `requires-action` with `reason: "tool-calls" \| "interrupt"` |
| `toolName`, `toolCallId` | `string` | Model-visible name and the stable id of this invocation |
| `timing` | `ToolCallTiming \| undefined` | Wall clock start and completion, when tracked |
| `interrupt` | `{ type: "human"; payload: unknown } \| undefined` | A paused `human()` request from a frontend executor |
| `approval` | object `\| undefined` | Server-side gate: `id`, `approved?`, `options?`, `optionId?`, `resolution?` |
| `addResult` | `(result) => void` | Completes a human tool from the UI |
| `resume` | `(payload: unknown) => void` | Answers an `interrupt` |
| `respondToApproval` | `(response: ToolApprovalResponse) => Promise<void>` | Answers an approval gate |

For a one-line status instead of a component, set `renderText` with `running` and `complete` values, each a string or a function of `({ args, result })`. Set `display: "standalone"` on the entry to keep the UI outside the collapsed tool group. Tools with no renderer fall back to the `ToolFallback` element.

## Approval gates

Some runtimes pause on the server and emit an approval request the client must answer before the tool runs. The AI SDK v7 runtime emits one for every tool listed in the call-level `toolApproval` option.

```tsx
import { useState } from "react";
import { defineToolkit, type ToolApprovalResponse } from "@assistant-ui/react";

const toolkit = defineToolkit({
  deploy: {
    type: "backend",
    render: ({ args, approval, respondToApproval, result }) => {
      const [error, setError] = useState<string | null>(null);

      const answer = async (response: ToolApprovalResponse) => {
        setError(null);
        try {
          await respondToApproval(response);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      };

      if (approval?.approved === undefined) {
        if (approval?.isAutomatic) return <p>Auto approved by policy</p>;
        return (
          <div>
            <p>Approve deploy to {args.target}?</p>
            <button onClick={() => void answer({ approved: true })}>Approve</button>
            <button onClick={() => void answer({ approved: false, reason: "user denied" })}>
              Deny
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        );
      }

      if (approval?.approved === false) {
        return <p>Denied{approval.reason ? `: ${approval.reason}` : ""}</p>;
      }
      return result === undefined ? <p>Approved, running</p> : <p>Deployed</p>;
    },
  },
});
```

`approval.approved` has three states. `undefined` means the gate is open and is the only state in which `respondToApproval` is legal. `true` means the decision was recorded as allow and the server is producing the result. `false` means it was recorded as deny; the runtime records an error result and exposes `approval.reason`. `approval.isAutomatic` is `true` when a server-side policy granted the decision rather than the user, so render a badge instead of buttons.

`respondToApproval` returns a promise that resolves once the runtime accepted the response and rejects when it could not be recorded, for example an expired gate or a refused answer. Await it before disabling the controls so a refused response leaves the request retryable. `toolApprovalAcceptsText(approval)` reports whether the request takes a free-form answer, on its own or alongside its options, so a renderer knows whether to offer a text field. The full option, question, and resolution surface is in [human-in-loop.md](./references/human-in-loop.md).

## Human tools

A human tool has no executor: the run pauses until the renderer supplies the result.

```tsx
select_date: {
  description: "Ask the user to select a date.",
  parameters: z.object({ prompt: z.string() }),
  execute: humanTool(),
  render: ({ args, result, addResult }) => {
    if (result) return <p>Selected {result.date}</p>;
    return <DatePicker prompt={args.prompt} onChange={(date) => addResult({ date })} />;
  },
},
```

Call `addResult` exactly once. Use a human tool when the user supplies the tool result itself, and an approval gate when the backend owns the action and only needs permission.

## Common Gotchas

**`humanTool()` or `stubTool()` throws at runtime**
- The file was not processed by the compiler. Add the build plugin and keep `"use generative"` as the file's first line.

**A tool UI never renders**
- The toolkit key must match the model-visible tool name exactly, including any MCP `prefix`.
- The toolkit must be mounted: `const config = AuiConfig({ tools: Tools({ toolkit }) })` passed as `config` on the provider. Pass a stable toolkit from module scope or `useMemo`.

**The model never learns about a frontend or human tool**
- The client build skips uploading those schemas because it assumes your backend imported the same file's server build. With no backend of yours, compile with `aui: { backendless: true }`.

**A frontend tool result never reaches the model**
- Configure the runtime with `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` from `ai`, and `lastAssistantMessageIsCompleteWithApprovalResponses` for approval gates.

**`toModelOutput` is ignored on round-tripped results**
- Pass the tool registry to `convertToModelMessages(messages, { tools })` as well as to `streamText`.

**A build warning about tool names**
- A duplicate name means two spread fragments define the same key and object spread keeps the later one; rename one entry. A tool that cannot be `makeTool()` came from an opaque factory call: write it as an inline object, or spread a compiler-visible `defineToolkit(...)` or `defineMcpToolkit(...)` fragment.

**`respondToApproval` rejects**
- It is legal only while `approval.approved` is `undefined`. A `text` answer to a request that declares neither `display: "text"` nor `allowFreeform` throws, as does an unknown `optionId`.

**MCP connections pile up**
- Keep the `AISDKToolkit` at module scope so clients pool across requests, and call `aiToolkit.close()` from `onFinish`.

## Related Skills

- [elements](../elements/SKILL.md) -- the styled `ToolFallback` and `ToolGroup` files and the rest of the catalog
- [generative-ui](../generative-ui/SKILL.md) -- UI the model composes from a vocabulary you ship
- [react-mcp](../react-mcp/SKILL.md) -- MCP servers the end user adds and authenticates in the browser
- [runtime](../runtime/SKILL.md) -- `useChatRuntime` and the AI SDK route the toolkit plugs into
- [copilots](../copilots/SKILL.md) -- interactables, the model-editable app state alternative to a stub tool
- [update](../update/SKILL.md) -- migrating older tool code to toolkits
