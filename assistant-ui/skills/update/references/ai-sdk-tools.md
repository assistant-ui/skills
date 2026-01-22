# AI SDK v6 Tool System Changes

Tool definition and execution changes in AI SDK v6.

**Note:** AI SDK `tool()` (backend) uses `inputSchema`, assistant-ui `useAssistantTool` (frontend) uses `parameters`.

---

## Tool Definition with `tool()` Helper

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get weather for a location",

  // inputSchema accepts Zod schemas directly
  inputSchema: z.object({
    location: z.string().describe("The location to get weather for"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),

  execute: async ({ location, unit }, options) => {
    // options includes: toolCallId, messages, abortSignal
    return { temperature: 72, unit: unit ?? "fahrenheit" };
  },

  // Optional: Enable strict mode
  strict: true,
});
```

---

## Schema Options

```typescript
import { tool, zodSchema, jsonSchema } from "ai";
import { z } from "zod";

// Option 1: Direct Zod (auto-converted)
const tool1 = tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ },
});

// Option 2: zodSchema() wrapper (recommended)
const tool2 = tool({
  inputSchema: zodSchema(z.object({ query: z.string() })),
  execute: async ({ query }) => { /* ... */ },
});

// Option 3: zodSchema() with options (recursive schemas)
const tool3 = tool({
  inputSchema: zodSchema(
    z.object({ category: categorySchema }),
    { useReferences: true }
  ),
  execute: async ({ category }) => { /* ... */ },
});

// Option 4: jsonSchema() for JSON Schema objects
const tool4 = tool({
  inputSchema: jsonSchema<{ query: string }>({
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  }),
  execute: async ({ query }) => { /* ... */ },
});
```

**Note:** `.describe()` and `.meta()` must be called **last** in Zod schema chains.

---

## Per-Tool Strict Mode

```diff
const result = streamText({
  model: openai("gpt-4o"),
- providerOptions: {
-   openai: { strictJsonSchema: true },
- },
  tools: {
    myTool: tool({
      inputSchema: schema,
+     strict: true, // Per-tool strict mode
      execute: async (input) => { /* ... */ },
    }),
  },
});
```

---

## Tool States

```typescript
type ToolInvocationState =
  | "input-streaming"   // Arguments being streamed
  | "input-available"   // Arguments complete, not yet executed
  | "output-available"  // Execution complete with result
  | "output-error";     // Execution failed

// Access in message parts:
message.parts.forEach(part => {
  if (isToolUIPart(part)) {
    console.log(part.state);       // One of the above states
    console.log(part.toolCallId);  // Unique ID
    console.log(part.input);       // Tool arguments
    console.log(part.output);      // Result (if output-available)
    console.log(part.errorText);   // Error (if output-error)
  }
});
```

---

## Tool Input Lifecycle Hooks

```typescript
const myTool = tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ },

  // Called when model starts generating arguments
  onInputStart: ({ toolCallId }) => {
    console.log("Tool input started:", toolCallId);
  },

  // Called for each input chunk (streamText only)
  onInputDelta: ({ toolCallId, delta }) => {
    console.log("Input delta:", delta);
  },

  // Called when complete, validated input is available
  onInputAvailable: ({ toolCallId, input }) => {
    console.log("Input ready:", input);
  },
});
```

---

## Tool Execution Approval

```typescript
// Server: Mark tool as needing approval
const dangerousTool = tool({
  description: "Deletes a file",
  inputSchema: z.object({ path: z.string() }),
  needsApproval: true,  // Requires client approval
  execute: async ({ path }) => { /* ... */ },
});

// Client: Handle approval
const { addToolApprovalResponse } = useChat();

// User approves
addToolApprovalResponse({ toolCallId, approved: true });

// User denies
addToolApprovalResponse({ toolCallId, approved: false });
```

---

## Frontend Tools Helper (assistant-ui)

```typescript
import { frontendTools } from "@assistant-ui/react-ai-sdk";

// In API route
export async function POST(req: Request) {
  const { messages, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    tools: {
      // Wrap frontend tools
      ...frontendTools(tools),
      // Add backend-only tools
      myBackendTool: tool({ /* ... */ }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

---

## Tool Result Handling (Client)

```typescript
// addToolResult - Simple form
addToolResult({
  tool: "toolName",
  toolCallId,
  output: result,
});

// addToolOutput - With explicit state
addToolOutput({
  state: "output-available",
  tool: "toolName",
  toolCallId,
  output: result,
});

// For errors
addToolOutput({
  state: "output-error",
  tool: "toolName",
  toolCallId,
  errorText: "Error message",
});
```

---

## Migration: parameters → inputSchema

```diff
// Before (v5)
tools: {
  myTool: {
    description: "...",
-   parameters: z.object({ ... }),
    execute: async (args) => { ... }
  }
}

// After (v6)
+ import { tool, zodSchema } from "ai";
tools: {
  myTool: tool({
    description: "...",
+   inputSchema: zodSchema(z.object({ ... })),
    execute: async (args, options) => { ... }
  })
}
```

---

## Migration: ToolCallOptions → ToolExecutionOptions

```diff
- import type { ToolCallOptions } from "ai";
+ import type { ToolExecutionOptions } from "ai";
```

---

## Migration: Tool.toModelOutput

```diff
const myTool = tool({
  // Before
- toModelOutput: (output) => processOutput(output),

  // After - requires object destructuring
+ toModelOutput: ({ output }) => processOutput(output),
});
```

---

## Tool UI Helper Renames

```diff
// For static tools only:
- import { isToolUIPart, getToolName } from "ai";
+ import { isStaticToolUIPart, getStaticToolName } from "ai";

// For both static and dynamic tools (new default):
- import { isToolOrDynamicToolUIPart, getToolOrDynamicToolName } from "ai";
+ import { isToolUIPart, getToolName } from "ai";
```
