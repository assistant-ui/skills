# Toolkits

A toolkit is a named map of tool definitions: the key is the tool name the model sees, the value carries the schema, the executor, and the renderer. `defineToolkit` authors one, `Tools({ toolkit })` installs it into an assistant subtree, and the `"use generative"` compiler splits it across the client and server builds.

## Contents

- [The "use generative" file](#the-use-generative-file) | [Build plugins](#build-plugins) | [How the compiler splits a file](#how-the-compiler-splits-a-file) | [Backend tools](#backend-tools) | [Frontend tools](#frontend-tools) | [Human tools](#human-tools) | [Provider tools](#provider-tools) | [External tools](#external-tools) | [Tool stubs and useAuiToolOverrides](#tool-stubs-and-useauitooloverrides) | [Entry fields](#entry-fields) | [Multi-modal results with toModelOutput](#multi-modal-results-with-tomodeloutput) | [Per-tool provider options](#per-tool-provider-options) | [Cancellation and execution context](#cancellation-and-execution-context) | [Disabling a tool](#disabling-a-tool) | [Splitting and merging files](#splitting-and-merging-files) | [MCP fragments](#mcp-fragments) | [Plain toolkits without the compiler](#plain-toolkits-without-the-compiler) | [Registering a toolkit](#registering-a-toolkit) | [Running without your own backend](#running-without-your-own-backend)

## The "use generative" file

The file's first line is `"use generative"`, and its default export is `defineToolkit({ ... })`. Each entry is an inline object literal with `parameters`, an `execute`, and a `render` or `renderText`.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  get_weather: {
    description: "Get current weather for a location.",
    parameters: z.object({ location: z.string() }),
    execute: async ({ location }) => {
      "use client";
      return fetchWeatherAPI(location);
    },
    renderText: { running: "Checking the weather", complete: "Weather ready" },
  },
});
```

The schema, meaning `description` plus `parameters`, is kept on both builds so the model contract is identical and authoritative on the backend.

## Build plugins

```ts title="next.config.ts"
import { withAui } from "@assistant-ui/next";

export default withAui({
  /* your Next config */
});
```

```ts title="vite.config.ts"
import { aui } from "@assistant-ui/vite";

export default defineConfig({ plugins: [aui()] });
```

```js title="metro.config.js"
const { getDefaultConfig } = require("expo/metro-config");
const { withAui } = require("@assistant-ui/metro");

module.exports = withAui(getDefaultConfig(__dirname));
```

A bare React Native app imports `getDefaultConfig` from `@react-native/metro-config` instead of `expo/metro-config`.

## How the compiler splits a file

The kind is inferred from `execute` and written back as a `type` field.

| `execute` you write | Inferred kind | Server build keeps | Client build keeps |
| --- | --- | --- | --- |
| plain `async () => ...` | backend | schema plus `execute`, guarded by `server-only` | schema plus `render` |
| `async () => { "use client"; ... }` | frontend | schema only | schema plus `execute` plus `render` or `renderText` |
| `humanTool()` | human | schema only | schema plus `render` |
| `stubTool()` | frontend, executor supplied at runtime | schema only | schema plus `render` or `renderText` |
| `providerTool({ ... })` | provider | schema plus provider config | schema plus provider config |
| `externalTool()` | backend, defined elsewhere | omitted | `type: "backend"` plus `render` or `renderText` |

Build time rules: every tool declares an `execute`, a frontend tool declares a `render` or `renderText`, and a human tool declares a `render`. The client build marks frontend and human schemas as backend-known and skips re-uploading them.

## Backend tools

A plain `execute` runs on your server. The compiler moves it to the server build behind `import "server-only"` and keeps the schema and `render` on the client, so a backend tool can still show its call as a trace.

```tsx
geocode_location: {
  description: "Geocode a location name into latitude and longitude.",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => geocodeLocation(query),
  render: GeocodeToolUI,
},
```

## Frontend tools

A leading `"use client"` inside `execute` moves the executor to the browser.

```tsx
copy_to_clipboard: {
  description: "Copy text to the user's clipboard.",
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }) => {
    "use client";
    await navigator.clipboard.writeText(text);
    return { copied: true };
  },
  renderText: { running: "Copying text", complete: "Copied text to clipboard" },
},
```

## Human tools

`humanTool()` pauses the run until the renderer calls `addResult` exactly once. `hitl` and `hitlTool` are deprecated aliases. The full pattern is in [human-in-loop.md](./human-in-loop.md).

```tsx
select_date: {
  description: "Ask the user to select a date.",
  parameters: z.object({ prompt: z.string() }),
  execute: humanTool(),
  render: ({ args, result, addResult }) =>
    result ? <p>Selected {result.date}</p> : <DatePicker onChange={addResult} />,
},
```

## Provider tools

`providerTool({ ... })` marks a tool the model provider executes, for example OpenAI web search. The compiler lifts the config onto the entry.

```tsx
web_search: {
  execute: providerTool({
    providerId: "openai.web_search_preview",
    args: { searchContextSize: "low" },
  }),
},
```

## External tools

`externalTool()` attaches a renderer to a non-MCP tool that another system already defines and executes, such as a separate backend route or a LangGraph node. The compiler omits the entry from the server build, so the model keeps getting the definition from that system.

```tsx
web_search: {
  parameters: z.object({ query: z.string() }),
  execute: externalTool(),
  render: ({ args, result }) => (
    <SearchResults query={args.query} results={result?.results ?? []} />
  ),
},
```

## Tool stubs and useAuiToolOverrides

When an executor has to close over React state it cannot live in the build-split file. Declare the model-facing contract with `stubTool()` and supply the executor at runtime. `useAuiToolOverrides` is experimental and its API may change.

```tsx title="app/task-board-toolkit.tsx"
"use generative";

import { defineToolkit, stubTool } from "@assistant-ui/react";
import { manageTasksParameters } from "./state";

export default defineToolkit({
  manage_tasks: {
    description: "Add, toggle, or clear tasks on the board.",
    parameters: manageTasksParameters,
    execute: stubTool(),
    renderText: { running: "Updating tasks", complete: "Tasks updated" },
  },
});
```

```tsx title="app/TaskBoard.tsx"
import {
  AuiConfig,
  AuiProvider,
  Tools,
  useAui,
  useAuiToolOverrides,
} from "@assistant-ui/react";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { Task } from "./state";
import toolkit from "./task-board-toolkit";

function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const aui = useAui();
  const config = AuiConfig({ tools: Tools({ toolkit }) });
  return (
    <AuiProvider extends={aui} config={config}>
      <ToolOverrides setTasks={setTasks} />
      <TaskList tasks={tasks} />
    </AuiProvider>
  );
}

function ToolOverrides({ setTasks }: { setTasks: Dispatch<SetStateAction<Task[]>> }) {
  useAuiToolOverrides({
    manage_tasks: {
      execute: async ({ action, title }) => {
        if (action !== "add") return { success: false, error: "Unknown action" };
        setTasks((prev) => [...prev, { id: crypto.randomUUID(), title, done: false }]);
        return { success: true };
      },
    },
  });
  return null;
}
```

The override supplies only the `execute`; description, parameters, and renderer stay in the toolkit file. An override registers above the toolkit default, so it wins for that name. Keep the override keys stable after mount and let only one mounted provider define a given tool name at a time.

## Entry fields

- `description` and `parameters`: the model contract. `parameters` accepts a Standard Schema such as Zod v4, which infers the arg types for `execute` and the callbacks, or a plain JSON Schema object, which carries no TypeScript input type.
- `execute`: the kind marker, per the table above.
- `render`: a `ToolCallMessagePartComponent`, or `renderText` for a one-line status. `renderText` takes `running` and `complete`, each a string or a function of `({ args, result })`.
- `display`: `"inline"` by default, or `"standalone"` to keep the UI outside the collapsed tool group.
- `toModelOutput`, `providerOptions`, `disabled`: see the sections below.

## Multi-modal results with toModelOutput

By default the result is sent to the model as a JSON blob. `toModelOutput` projects it into multi-modal content while `render` still receives the rich typed result.

```tsx
read_pdf: {
  description: "Fetch a PDF from a URL and return it.",
  parameters: z.object({ url: z.string().url() }),
  execute: async ({ url }) => fetchPdfAsBase64(url),
  toModelOutput: ({ output }) => [
    { type: "text", text: "PDF contents:" },
    { type: "file", data: output.base64, mediaType: output.mediaType },
  ],
},
```

`ToolModelContentPart` is a union of `{ type: "text"; text }` and `{ type: "file"; data; mediaType; filename? }`. On the AI SDK route, pass the tool registry to `convertToModelMessages` as well so `toModelOutput` fires on round-tripped results. When `toModelOutput` is set the runtime persists the output as `{ __aui_modelContent, value }`, so upgrade every reader of a persisted thread before any writer starts producing it, and never return an object whose top-level key is literally `__aui_modelContent`.

## Per-tool provider options

`providerOptions` is serialized verbatim under the tool entry, forwarded by the route, and read by the provider SDK. The outer key is the provider name.

```tsx
search_docs: {
  description: "Search the documentation index.",
  parameters: z.object({ query: z.string() }),
  providerOptions: { anthropic: { deferLoading: true } },
  execute: async ({ query }) => {
    "use client";
    return searchIndex(query);
  },
  renderText: { running: "Searching", complete: "Done" },
},
```

## Cancellation and execution context

`execute` receives a context object as its second argument carrying `abortSignal`, `toolCallId`, and `human()`. `abortSignal` fires when the user stops the run.

```tsx
execute: async ({ query }, { abortSignal }) => {
  "use client";
  const res = await fetch(`/api/search?q=${query}`, { signal: abortSignal });
  return res.json();
},
```

`human(payload)` pauses execution and surfaces the payload to the renderer as `interrupt.payload`; see [human-in-loop.md](./human-in-loop.md).

## Disabling a tool

`disabled: true` keeps a tool known to the client but hidden from the model in the current scope. To toggle it at runtime, register the same flag through an override and mount that component only while the tool should be hidden; unmounting it restores the toolkit default.

```tsx
function GuestModeTools() {
  useAuiToolOverrides({ delete_account: { disabled: true } });
  return null;
}
```

## Splitting and merging files

Each file is its own `"use generative"` module with a default export. Merge them by spreading the default imports.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import weatherTools from "./tools/weather";
import databaseTools from "./tools/database";

export default defineToolkit({
  ...weatherTools,
  ...databaseTools,
});
```

Only a default import crosses the generative module boundary, so a named import or any opaque import is rejected. Relative paths and `tsconfig` path aliases both resolve. You can also spread a local `defineToolkit(...)` or `defineMcpToolkit(...)` binding declared in the same file. The compiler checks static names across inline entries and visible spreads and warns when two fragments define the same name, because object spread keeps the later one. An error saying a tool cannot be `makeTool()` means the entry came from an opaque factory call: write it inline or spread a compiler-visible fragment instead.

Keeping the Zod schemas in a plain `.ts` module keeps them out of the compiled boundary and lets the route handler and components share the inferred types.

## MCP fragments

`defineMcpToolkit` exposes an MCP server's tools as a spreadable fragment.

```tsx
"use generative";

import { defineToolkit, defineMcpToolkit } from "@assistant-ui/react";

export default defineToolkit({
  ...defineMcpToolkit({
    docs: { type: "http", url: "https://mcp.example.com/mcp" },
  }),
});
```

Full server options, prefixes, disabling, and the route lifecycle are in [mcp-server.md](./mcp-server.md).

## Plain toolkits without the compiler

Outside generative compilation `defineToolkit` returns the toolkit unchanged, so a `"use client"` file can declare render-only entries with an explicit `type`. The key must match the tool name your backend or MCP server publishes; such entries upload no schema and run no browser code.

```tsx title="app/tool-ui.tsx"
"use client";

import { defineToolkit } from "@assistant-ui/react";

export const toolkit = defineToolkit({
  web_search: {
    type: "backend",
    render: ({ args, result }) => (
      <SearchResults query={args.query} results={result?.results ?? []} />
    ),
  },
});
```

Inside a `"use generative"` file use `execute: externalTool()` instead; you never author `type` there.

## Registering a toolkit

```tsx
const config = AuiConfig({ tools: Tools({ toolkit }) });
<AssistantRuntimeProvider runtime={runtime} config={config}>{children}</AssistantRuntimeProvider>;
```

Pass a referentially stable toolkit, from module scope or `useMemo`. To scope tools to part of the tree, build the config in that subtree and mount `<AuiProvider extends={aui} config={config}>` with `const aui = useAui()`. `Tools` also takes `mcpApp` for MCP App widgets ([mcp-apps.md](./mcp-apps.md)).

## Running without your own backend

The client build skips uploading frontend and human schemas because it assumes your backend imported the same file's server build. When no server of yours does, for example a cloud-hosted run, compile with `backendless` so the client keeps every schema uploadable, including the `present` and `prompt_user` schemas of a generative UI component library.

```ts title="next.config.ts"
export default withAui({ ...yourConfig, aui: { backendless: true } });
```

The same option goes to `aui({ backendless: true })` in Vite and to the `aui` key of the Metro config object.
