# AI SDK v6 Migration

Migrate a codebase from AI SDK v4 or v5 to v6. This is a methodical, careful process using agents.

**Covers:** v4.x → v6.x, v5.x → v6.x

**Official docs:** https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0

## Sub-References

- [./ai-sdk-tools.md](./ai-sdk-tools.md) -- Tool system changes
- [./ai-sdk-streaming.md](./ai-sdk-streaming.md) -- Streaming architecture & structured output
- [./ai-sdk-ui.md](./ai-sdk-ui.md) -- UI/React & useChat changes
- [./ai-sdk-providers.md](./ai-sdk-providers.md) -- Provider-specific changes

---

## Critical Rules

1. **NEVER make changes without reading files first**
2. **NEVER guess** - If unsure, search the codebase or ask the user
3. **ALWAYS verify after changes** - Run type check after each file
4. **USE AGENTS for research** - Spawn Explore agents for codebase analysis
5. **TRACK EVERYTHING** - Use TodoWrite to track every file and change
6. **ONE CHANGE AT A TIME** - Make atomic changes, verify, then proceed

---

## Phase 1: Deep Research (Use Agents)

**STOP. Do not skip this phase.**

### 1.1 Spawn Research Agent for AI SDK Patterns

Use Task tool with `subagent_type: "Explore"`:

```
Find ALL AI SDK usage in this codebase:

IMPORTS: "ai", "@ai-sdk/*", "@assistant-ui/react-ai-sdk"

PATTERNS:
- useChat, streamText, generateText, generateObject, streamObject
- convertToCoreMessages, CoreMessage, Message types
- maxSteps, tool definitions (parameters:, execute:)
- addToolResult, textEmbedding, toDataStreamResponse

Report: file path, line numbers, code snippet, what v6 change applies.
```

### 1.2 Package Analysis

```
Find all package.json files. Extract:
1. Current versions: ai, @ai-sdk/*, zod, @assistant-ui/*
2. Package manager (pnpm-lock.yaml, yarn.lock, package-lock.json)
3. Test/build scripts
```

### 1.3 Compile Results

- Total files requiring changes
- Categorized list of patterns found
- Package versions needing update

**CHECKPOINT: Present findings to user. Do not proceed until confirmed.**

---

## Phase 2: Create Migration Plan

### 2.1 Categorize Changes

**Category A: Codemod-handled**
- CoreMessage → ModelMessage
- convertToCoreMessages → convertToModelMessages
- textEmbedding/textEmbeddingModel → embedding/embeddingModel
- ToolCallOptions → ToolExecutionOptions

**Category B: Manual - Simple renames**
- Message → UIMessage
- maxSteps → stopWhen: stepCountIs(n)

**Category C: Manual - Structural**
- Add await to convertToModelMessages
- toDataStreamResponse → toUIMessageStreamResponse
- generateObject → generateText + Output.object
- Tool definition restructuring

### 2.2 Execution Order

1. Package updates
2. Run codemods
3. Type/utility files
4. API routes
5. React components
6. Test files

**CHECKPOINT: Present full plan to user for approval.**

---

## Phase 3: Execute Migration

### 3.1 Update Packages

```bash
# pnpm
pnpm add ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest zod@latest @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest

# npm
npm install ai@latest @ai-sdk/react@latest @ai-sdk/openai@latest zod@latest
```

### 3.2 Run Codemods

```bash
# From v5: Run v6 codemods only
npx @ai-sdk/codemod v6

# From v4: Run ALL codemods
npx @ai-sdk/codemod upgrade
```

**Review codemod output with `git diff`.**

### 3.3 Apply Manual Changes

For EACH file:
1. Add to todo list as "in_progress"
2. Read the ENTIRE file first
3. Make changes ONE AT A TIME
4. Run type check after each file
5. Mark as "completed" only after type check passes

---

## Core Breaking Changes

### Message Types

```diff
- import { CoreMessage, convertToCoreMessages } from "ai";
+ import { ModelMessage, convertToModelMessages } from "ai";

- import type { Message } from "ai";
+ import type { UIMessage } from "ai";
```

### convertToModelMessages is Now Async

```diff
- const modelMessages = convertToCoreMessages(messages);
+ const modelMessages = await convertToModelMessages(messages);
```

### maxSteps → stopWhen

```diff
+ import { stepCountIs } from "ai";

const result = streamText({
  model: openai("gpt-4o"),
- maxSteps: 10,
+ stopWhen: stepCountIs(10),
});
```

### Stream Response

```diff
- return (await result).toDataStreamResponse();
+ return result.toUIMessageStreamResponse();
```

### Tool Definitions

```diff
- tools: {
-   myTool: {
-     description: "...",
-     parameters: z.object({ ... }),
-     execute: async (args) => { ... }
-   }
- }

+ import { tool, zodSchema } from "ai";
+ tools: {
+   myTool: tool({
+     description: "...",
+     inputSchema: zodSchema(z.object({ ... })),
+     execute: async (args, options) => { ... }
+   })
+ }
```

### Agent Class

```diff
- import { Experimental_Agent } from "ai";
+ import { ToolLoopAgent } from "ai";

- system: "You are a helpful assistant",
+ instructions: "You are a helpful assistant",

- import { createAgentStreamResponse } from "ai";
+ import { createAgentUIStreamResponse } from "ai";
```

See sub-references for detailed changes:
- Tools: [./ai-sdk-tools.md](./ai-sdk-tools.md)
- Streaming: [./ai-sdk-streaming.md](./ai-sdk-streaming.md)
- UI/React: [./ai-sdk-ui.md](./ai-sdk-ui.md)
- Providers: [./ai-sdk-providers.md](./ai-sdk-providers.md)

---

## Phase 4: Verification

### 4.1 Type Check

```bash
npx tsc --noEmit
```

**Common type errors:**
- `Property 'content' does not exist on type 'UIMessage'` → Use `message.parts`
- `Type 'CoreMessage' not found` → Change to `ModelMessage`
- `maxSteps does not exist` → Use `stopWhen: stepCountIs(n)`
- `toDataStreamResponse not found` → Use `toUIMessageStreamResponse()`

### 4.2 Build & Test

```bash
pnpm build
pnpm test
```

### 4.3 Manual Testing

- [ ] Dev server starts
- [ ] Chat messages send/receive
- [ ] Streaming works
- [ ] Tool calls execute
- [ ] No console errors

---

## Complete Example: API Route

**Before (v5):**
```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    maxSteps: 10,
  });

  return (await result).toDataStreamResponse();
}
```

**After (v6):**
```typescript
import { streamText, convertToModelMessages, stepCountIs, tool, zodSchema } from "ai";
import type { UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      get_weather: tool({
        description: "Get the current weather",
        inputSchema: zodSchema(z.object({ city: z.string() })),
        execute: async ({ city }) => `The weather in ${city} is sunny`,
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
```

---

## Rollback Plan

```bash
git checkout .
git clean -fd
```

Re-analyze what went wrong before retrying.

---

## Migration Checklist

### Packages
- [ ] `ai` → `^6.0.0`
- [ ] `@ai-sdk/react` → `^3.0.0`
- [ ] `@ai-sdk/*` providers → `^3.0.0`
- [ ] `@assistant-ui/react-ai-sdk` → `^1.2.0`

### Automated
- [ ] Run `npx @ai-sdk/codemod v6` (from v5) or `upgrade` (from v4)
- [ ] Review automated changes

### Core Changes
- [ ] `CoreMessage` → `ModelMessage`
- [ ] `convertToCoreMessages` → `await convertToModelMessages`
- [ ] `maxSteps` → `stopWhen: stepCountIs(n)`
- [ ] `toDataStreamResponse` → `toUIMessageStreamResponse`
- [ ] Tool `parameters` → `inputSchema` with `tool()` helper
- [ ] `generateObject` → `generateText` + `Output.object()`

### UI Changes
- [ ] `Message` → `UIMessage`
- [ ] `append()` → `sendMessage()`
- [ ] Manage input state manually
- [ ] Use transport-based configuration

### Testing
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Manual verification complete
