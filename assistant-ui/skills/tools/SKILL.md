---
name: tools
description: Guide for tool registration and tool UI in assistant-ui. Use when implementing LLM tools, tool call rendering, or human-in-the-loop patterns.
version: 0.0.1
license: MIT
---

# assistant-ui Tools

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Tools let LLMs trigger frontend actions with custom UI.

## References

- [./references/make-tool.md](./references/make-tool.md) -- makeAssistantTool/useAssistantTool
- [./references/tool-ui.md](./references/tool-ui.md) -- makeAssistantToolUI rendering
- [./references/human-in-loop.md](./references/human-in-loop.md) -- Confirmation and interactive tools

## Tool Types Decision Tree

```
Where does the tool execute?
├─ Backend (LLM calls API)
│  └─ Define in API route (AI SDK tool())
│     └─ Want custom UI? → makeAssistantToolUI
└─ Frontend (browser-only)
   └─ makeAssistantTool or useAssistantTool
      └─ Want custom UI? → makeAssistantToolUI
```

## Quick Start

### Backend Tool with UI

```tsx
// 1. Backend defines tool (app/api/chat/route.ts)
import { tool } from "ai";
import { z } from "zod";

const tools = {
  get_weather: tool({
    description: "Get weather for a city",
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({ temp: 22, city }),
  }),
};

// 2. Frontend renders custom UI
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    if (status === "running") return <div>Loading weather...</div>;
    return <div>{result?.city}: {result?.temp}°C</div>;
  },
});

// 3. Register in app
<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

### Frontend-Only Tool

```tsx
import { makeAssistantTool } from "@assistant-ui/react";
import { z } from "zod";

const CopyTool = makeAssistantTool({
  toolName: "copy_to_clipboard",
  parameters: z.object({ text: z.string() }),
  execute: async ({ text }) => {
    await navigator.clipboard.writeText(text);
    return { success: true };
  },
});

// Register
<AssistantRuntimeProvider runtime={runtime}>
  <CopyTool />
  <Thread />
</AssistantRuntimeProvider>
```

## API Reference

### makeAssistantTool

```tsx
const MyTool = makeAssistantTool({
  toolName: string;                    // Must match backend tool name
  parameters: ZodSchema;               // Zod schema for args
  execute: (args, context) => Promise<result>;
});
```

### makeAssistantToolUI

```tsx
const MyToolUI = makeAssistantToolUI({
  toolName: string;
  render: (props: ToolUIProps) => ReactNode;
});

interface ToolUIProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;           // Raw JSON
  result?: unknown;
  status: ToolCallStatus;
  submitResult: (result: unknown) => void;  // For interactive tools
}

type ToolCallStatus =
  | "running"         // Tool executing
  | "complete"        // Finished
  | "incomplete"      // Stopped early
  | "requires-action" // Needs user input
```

### Hook Variants

```tsx
// Inside component lifecycle
useAssistantTool({ toolName, parameters, execute });
useAssistantToolUI({ toolName, render });
```

## Backend Tool (AI SDK)

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";

const tools = {
  search: tool({
    description: "Search the web",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().optional().default(5),
    }),
    execute: async ({ query, limit }) => {
      const results = await searchAPI(query, limit);
      return { results };
    },
  }),
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    tools,
    stopWhen: stepCountIs(5),  // Allow multi-step tool use
  });

  return result.toUIMessageStreamResponse();
}
```

## Tool UI Patterns

### Loading State

```tsx
const SearchToolUI = makeAssistantToolUI({
  toolName: "search",
  render: ({ args, result, status }) => {
    if (status === "running") {
      return (
        <div className="animate-pulse">
          Searching for "{args.query}"...
        </div>
      );
    }

    return (
      <div>
        {result?.results?.map((r: any) => (
          <a key={r.url} href={r.url}>{r.title}</a>
        ))}
      </div>
    );
  },
});
```

### Error State

```tsx
const ToolUI = makeAssistantToolUI({
  toolName: "my_tool",
  render: ({ result, status }) => {
    if (status === "incomplete") {
      return <div className="text-red-500">Tool execution failed</div>;
    }

    if (result?.error) {
      return <div className="text-red-500">{result.error}</div>;
    }

    return <div>{JSON.stringify(result)}</div>;
  },
});
```

### Generative UI

```tsx
const components = {
  chart: ChartComponent,
  table: TableComponent,
  form: FormComponent,
};

const GenerativeUI = makeAssistantToolUI({
  toolName: "render_component",
  render: ({ args, result }) => {
    const Component = components[args.componentType];
    if (!Component) return null;
    return <Component {...result} />;
  },
});
```

## Human-in-the-Loop

### Confirmation Pattern

```tsx
const DeleteToolUI = makeAssistantToolUI({
  toolName: "delete_file",
  render: ({ args, status, submitResult }) => {
    if (status === "requires-action") {
      return (
        <div className="p-4 bg-yellow-50 rounded">
          <p>Delete {args.path}?</p>
          <button onClick={() => submitResult({ confirmed: true })}>
            Confirm
          </button>
          <button onClick={() => submitResult({ confirmed: false })}>
            Cancel
          </button>
        </div>
      );
    }

    return <div>File deleted</div>;
  },
});
```

### Interactive Selection

```tsx
const SelectToolUI = makeAssistantToolUI({
  toolName: "select_option",
  render: ({ args, submitResult }) => (
    <div className="flex gap-2">
      {args.options.map((opt: any) => (
        <button
          key={opt.id}
          onClick={() => submitResult({ selected: opt.id })}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
});
```

## Combining Tool + UI

```tsx
// Tool executes and renders in one registration
const SearchTool = makeAssistantTool({
  toolName: "search",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const results = await searchAPI(query);
    return { results };
  },
});

const SearchToolUI = makeAssistantToolUI({
  toolName: "search",
  render: ({ args, result, status }) => (
    <div>
      <p>Query: {args.query}</p>
      {status === "running" && <Spinner />}
      {result?.results?.map((r: any) => (
        <SearchResult key={r.id} {...r} />
      ))}
    </div>
  ),
});

// Register both
<AssistantRuntimeProvider runtime={runtime}>
  <SearchTool />
  <SearchToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Tool Context Hook

```tsx
import { useToolCallContext } from "@assistant-ui/react";

function MyToolComponent() {
  const { toolCallId, toolName, args, result, status } = useToolCallContext();

  return (
    <div data-tool-id={toolCallId}>
      {toolName}: {status}
    </div>
  );
}
```

## Common Gotchas

**Tool UI not rendering**
- Ensure `toolName` matches exactly (case-sensitive)
- Register UI component in `AssistantRuntimeProvider`

**Tool not being called**
- Check backend tool description is clear
- Verify `stopWhen` allows tool use (e.g., `stepCountIs(5)`)

**Result not showing**
- Tool must return a value (not just mutate state)
- Check `status === "complete"` before accessing result

**Human-in-the-loop not working**
- Use `status === "requires-action"` to show UI
- Call `submitResult` to provide user input
