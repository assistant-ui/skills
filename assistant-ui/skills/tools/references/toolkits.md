# Toolkits

Declare a group of tools as a plain object and mount them with the `<Tools />` component.

## Contents

- [Toolkit type](#toolkit-type)
- [ToolDefinition fields](#tooldefinition-fields)
- [Mounting with Tools](#mounting-with-tools)
- [Carrying render per tool](#carrying-render-per-tool)
- [The tool helper](#the-tool-helper)
- [mcpApp prop](#mcpapp-prop)
- [Toolkit vs component tools](#toolkit-vs-component-tools)

## Toolkit type

A `Toolkit` is a record mapping tool name to definition. Write the object literal with `satisfies Toolkit` so each entry stays strongly typed while the keys remain known tool names.

```tsx
import type { Toolkit } from "@assistant-ui/react";

type Toolkit = Record<string, ToolDefinition<any, any>>;
```

```tsx
import type { Toolkit } from "@assistant-ui/react";

const toolkit = {
  get_weather: {
    type: "frontend",
    description: "Get the weather for a city.",
    parameters: weatherSchema,
    execute: async ({ city }: { city: string }) => fetchWeather(city),
    render: WeatherToolUI,
  },
} satisfies Toolkit;
```

The object keys (`get_weather`) become the tool names the model receives and uses in tool calls.

## ToolDefinition fields

`ToolDefinition<TArgs, TResult>` carries the model-facing schema, the executor, and an optional renderer.

```tsx
interface ToolDefinition<TArgs, TResult> {
  type: "frontend";                          // browser-executed tool
  description?: string;                       // model-visible description
  parameters: StandardSchemaV1<TArgs> | JSONSchema7;
  disabled?: boolean;                         // hides the tool from the model when true
  execute?: ToolExecuteFunction<TArgs, TResult>;
  toModelOutput?: ToolModelOutputFunction<TArgs, TResult>;
  experimental_onSchemaValidationError?: OnSchemaValidationErrorFunction<TResult>;
  providerOptions?: ProviderOptions;
  display?: ToolDisplay;                       // "inline" (default) or "standalone"
  render?: ToolCallMessagePartComponent<TArgs, TResult>;
}
```

Note: `render` is required for frontend and human tools that need a UI; tools that only run logic can omit it.

## Mounting with Tools

Mount `<Tools />` near an assistant subtree. Tool definitions register with model context; renderers register with the tools scope for message rendering.

```tsx
import { Tools } from "@assistant-ui/react";

function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Tools toolkit={toolkit} />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

| Prop | Type | Notes |
|------|------|-------|
| `toolkit` | `Toolkit` | Tools and optional renderers to install |
| `mcpApp` | `ResourceElement<McpAppResourceOutput>` | MCP app whose tools merge into context |

## Carrying render per tool

Each definition can attach its own renderer through `render`. The component receives `args`, `result`, `status`, and `addResult`.

```tsx
import { tool } from "@assistant-ui/react";

const weatherSchema = {
  type: "object",
  properties: { city: { type: "string" } },
  required: ["city"],
} as const;

const toolkit = {
  get_weather: tool<{ city: string }, WeatherResult>({
    type: "frontend",
    description: "Get the weather for a city.",
    parameters: weatherSchema,
    execute: async ({ city }) => fetchWeather(city),
    render: ({ args, result, status }) => {
      if (status.type !== "complete") return <div>Loading {args.city}...</div>;
      return <div>{result.temperature}° in {args.city}</div>;
    },
  }),

  confirm_action: tool<{ message: string }, { confirmed: boolean }>({
    type: "frontend",
    description: "Ask the user to confirm an action.",
    parameters: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
    render: ({ args, status, addResult }) => {
      if (status.type !== "requires-action") return <div>Done.</div>;
      return (
        <div>
          <p>{args.message}</p>
          <button onClick={() => addResult({ confirmed: true })}>Yes</button>
          <button onClick={() => addResult({ confirmed: false })}>No</button>
        </div>
      );
    },
  }),
} satisfies Toolkit;
```

## The tool helper

`tool` defines a single typed model tool. It accepts the same fields as a `ToolDefinition` and returns one, so it slots directly into a toolkit literal while giving you inferred `args` and `result` types inside `execute` and `render`.

```tsx
import { tool } from "@assistant-ui/react";

const getWeather = tool<{ city: string }, string>({
  type: "frontend",
  description: "Get the weather for a city.",
  parameters: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  execute: async ({ city }) => `Sunny in ${city}`,
});

const toolkit = { get_weather: getWeather } satisfies Toolkit;
```

## mcpApp prop

`<Tools mcpApp={...} />` merges the tools of an MCP app into the same context. Build the resource element with `McpAppRenderer` and a host such as `McpAppsRemoteHost`.

```tsx
import {
  Tools,
  McpAppRenderer,
  McpAppsRemoteHost,
} from "@assistant-ui/react";

function App() {
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Tools
        toolkit={toolkit}
        mcpApp={McpAppRenderer({
          host: McpAppsRemoteHost({ url: "/api/mcp-apps" }),
          hostInfo: { name: "my-app", version: "1.0.0" },
          hostContext: { theme: "light" },
        })}
      />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

The renderer activates for any tool-call part whose metadata carries a `ui://`-scheme resource URI. Per-tool renderers (the `render` field on a definition) take precedence over this fallback.

## Toolkit vs component tools

Use a toolkit and `<Tools />` when tool availability should follow the runtime or provider tree rather than a specific component's mount state. Reach for component tools (`makeAssistantTool`, `useAssistantTool`) when a tool should register and unregister with one component's lifecycle.
