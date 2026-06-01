---
name: tools
description: "Registers LLM tools and renders custom tool-call UI in assistant-ui (@assistant-ui/react). Use when adding frontend-only tools with makeAssistantTool / useAssistantTool (browser actions like clipboard, navigation, localStorage, async-generator streaming, AbortSignal), rendering backend AI SDK tool() calls with makeAssistantToolUI / useAssistantToolUI (status.type running/complete/incomplete/requires-action, args, result, artifact via ToolCallMessagePartProps), building generative UI from tool results, or implementing human-in-the-loop and approval flows (addResult, resume with context.human(), respondToApproval for server-side needsApproval gates). Covers registering tool components inside AssistantRuntimeProvider and the case-sensitive toolName matching that connects a tool to its UI. Reach for this when tool UI is not rendering, a tool is not being called, or a result is not showing."
license: MIT
---

# assistant-ui Tools

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Tools let LLMs trigger actions with custom UI rendering.

## References

- [./references/make-tool.md](./references/make-tool.md) -- makeAssistantTool/useAssistantTool
- [./references/tool-ui.md](./references/tool-ui.md) -- makeAssistantToolUI rendering
- [./references/human-in-loop.md](./references/human-in-loop.md) -- Confirmation patterns
- [./references/toolkits.md](./references/toolkits.md) -- Toolkits and the Tools component
- [./references/mcp-server.md](./references/mcp-server.md) -- Server-side MCP tools
- [./references/generative-ui.md](./references/generative-ui.md) -- Declarative generative UI
- [./references/registry-components.md](./references/registry-components.md) -- ToolFallback, ToolGroup, Image renderers

## Tool Types

```
Where does the tool execute?
├─ Backend (LLM calls API) → AI SDK tool()
│  └─ Want custom UI? → makeAssistantToolUI
└─ Frontend (browser-only) → makeAssistantTool
   └─ Want custom UI? → makeAssistantToolUI
```

## Backend Tool with UI

```ts
// Backend (app/api/chat/route.ts)
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      get_weather: tool({
        description: "Get weather for a city",
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ temp: 22, city }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const WeatherToolUI = makeAssistantToolUI({
  toolName: "get_weather",
  render: ({ args, result, status }) => {
    // status is an object; check status.type (not status === "running")
    if (status.type === "running") return <div>Loading weather...</div>;
    return <div>{result?.city}: {result?.temp}°C</div>;
  },
});

<AssistantRuntimeProvider runtime={runtime}>
  <WeatherToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Frontend-Only Tool

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

<AssistantRuntimeProvider runtime={runtime}>
  <CopyTool />
  <Thread />
</AssistantRuntimeProvider>
```

## API Reference

```tsx
// makeAssistantToolUI render props (ToolCallMessagePartProps)
interface ToolCallMessagePartProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;          // raw streamed JSON
  result?: unknown;
  isError?: boolean;
  artifact?: unknown;        // UI-only artifact attached to the result

  // status is an OBJECT, not a string. Branch on status.type.
  status:
    | { type: "running" }
    | { type: "complete" }
    | { type: "incomplete"; reason: "cancelled" | "length" | "content-filter" | "other" | "error" }
    | { type: "requires-action"; reason: "interrupt" };

  // Supply a result from the renderer (instead of a tool execute function)
  addResult: (result: unknown) => void;
  // Resume a frontend tool paused via context.human(...)
  resume: (payload: unknown) => void;
  // Respond to a server-side approval gate
  respondToApproval: (response: { approved: boolean; reason?: string }) => void;
}
```

## Human-in-the-Loop

```tsx
const DeleteToolUI = makeAssistantToolUI({
  toolName: "delete_file",
  render: ({ args, status, addResult }) => {
    if (status.type === "requires-action") {
      return (
        <div>
          <p>Delete {args.path}?</p>
          <button onClick={() => addResult({ confirmed: true })}>Confirm</button>
          <button onClick={() => addResult({ confirmed: false })}>Cancel</button>
        </div>
      );
    }
    return <div>File deleted</div>;
  },
});
```

## Common Gotchas

**Tool UI not rendering**
- `toolName` must match exactly (case-sensitive)
- Register UI inside `AssistantRuntimeProvider`

**Tool not being called**
- Check tool description is clear
- Use `stopWhen: stepCountIs(n)` to allow multi-step

**Result not showing**
- Tool must return a value
- Check `status.type === "complete"` before accessing result
