# Legacy component tool APIs

Four component and hook based APIs are deprecated. They still work, so existing code is not broken, but every new tool is a toolkit entry.

| Deprecated | Replacement |
| --- | --- |
| `makeAssistantTool` | a toolkit entry, registered with `Tools({ toolkit })` |
| `useAssistantTool` | the same toolkit entry, scoped with a nested `AuiProvider` when it must follow a subtree |
| `makeAssistantToolUI` | `render` or `renderText` on the matching toolkit entry |
| `useAssistantToolUI` | the same, or a scoped toolkit for a single surface |
| `hitl`, `hitlTool` | `humanTool` |

Toolkits keep the model contract, the browser execution, and the rendering in one named map, which removes duplicate registrations and makes the client and server split explicit.

## Before and after

```tsx
// Before
import { AssistantRuntimeProvider, makeAssistantTool } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { z } from "zod";

const WeatherTool = makeAssistantTool({
  toolName: "get_weather",
  description: "Get the current weather for a city.",
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => fetchWeather(city),
  render: ({ args, result }) => <WeatherCard city={args.city} weather={result} />,
});

export function App() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WeatherTool />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  get_weather: {
    description: "Get the current weather for a city.",
    parameters: z.object({ city: z.string() }),
    execute: async ({ city }) => {
      "use client";
      return fetchWeather(city);
    },
    render: ({ args, result }) => <WeatherCard city={args.city} weather={result} />,
  },
});
```

```tsx title="app/App.tsx"
"use client";

import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import toolkit from "./toolkit";

export function App() {
  const runtime = useChatRuntime();
  const config = AuiConfig({ tools: Tools({ toolkit }) });
  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Mechanical steps

1. Create a toolkit object.
2. Move each `toolName` into the toolkit key.
3. Move `description`, `parameters`, `execute`, `providerOptions`, `render`, `renderText`, and `display` onto the entry.
4. Register the toolkit once: `const config = AuiConfig({ tools: Tools({ toolkit }) })`, passed as `config` on the runtime provider.
5. Delete the `<Tool />` and `<ToolUI />` elements and the `useAssistantTool(...)` and `useAssistantToolUI(...)` calls.
6. Add the build plugin and the `"use generative"` directive if the executor should be split across the client and server boundary.

## UI-only renderers

`makeAssistantToolUI` and `useAssistantToolUI` only ever registered a renderer for a tool that executes elsewhere, in your backend, an MCP server, or a LangGraph node. Both took `toolName`, `render`, and an optional `display` of `"standalone"` or `"inline"`.

```tsx
// Before
import { makeAssistantToolUI } from "@assistant-ui/react";

const WebSearchToolUI = makeAssistantToolUI({
  toolName: "web_search",
  display: "standalone",
  render: ({ args, result }) => (
    <SearchResults query={args.query} results={result?.results ?? []} />
  ),
});
```

The generative replacement declares the same renderer with no executor of its own, so the compiler omits the server entry and keeps `type: "backend"` on the client.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit, externalTool } from "@assistant-ui/react";

export default defineToolkit({
  web_search: {
    execute: externalTool(),
    display: "standalone",
    render: ({ args, result }) => (
      <SearchResults query={args.query} results={result?.results ?? []} />
    ),
  },
});
```

Outside the generative compiler, a `"use client"` toolkit with `{ type: "backend", render }` is the equivalent. For MCP servers, spread `defineMcpToolkit({ ... })` in the same toolkit; see [mcp-server.md](./mcp-server.md).

## Tools that closed over component state

`useAssistantTool` was the way to register a tool whose executor read component state. Keep the model-facing contract in a `"use generative"` file with `stubTool()` and supply the executor from the component that owns the state with `useAuiToolOverrides`, which is experimental. The full pattern is in [toolkits.md](./toolkits.md).

```tsx
// Before
import { useAssistantTool } from "@assistant-ui/react";

function TaskBoardTool({ setTasks }) {
  useAssistantTool({
    toolName: "add_task",
    description: "Add a task to the board.",
    parameters: z.object({ title: z.string() }),
    execute: async ({ title }) => {
      setTasks((prev) => [...prev, { id: crypto.randomUUID(), title }]);
      return { ok: true };
    },
  });
  return null;
}
```

## Renderers for a single surface

A renderer that should affect one message surface rather than the whole app does not need a global registration. Scope a toolkit to that subtree with `<AuiProvider extends={aui} config={config}>`, which is the supported path. `MessagePrimitive.Parts` also accepts inline `tools.by_name` and `tools.Fallback` overrides, but that `components` prop is itself deprecated; in a children render function, read the resolved UI from `part.toolUI` instead.

```tsx
<MessagePrimitive.Parts>
  {({ part }) => {
    if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
    return null;
  }}
</MessagePrimitive.Parts>
```

Returning `null` still lets registered tool UIs render; return an empty fragment to suppress them.
