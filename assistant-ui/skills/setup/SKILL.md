---
name: setup
description: Setup and configure assistant-ui in a project. Use when installing packages, configuring runtimes, or troubleshooting setup issues.
version: 0.0.1
license: MIT
---

# assistant-ui Setup

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Complete guide for setting up assistant-ui in your project.

## References

- [./references/ai-sdk-v6.md](./references/ai-sdk-v6.md) -- AI SDK v6 setup with useChatRuntime
- [./references/langgraph.md](./references/langgraph.md) -- LangGraph agent setup
- [./references/styling.md](./references/styling.md) -- Styling options and customization

## Pick Your Setup

```
Using Next.js with Vercel AI SDK?
├─ Yes → AI SDK v6 Setup (recommended)
└─ No
   ├─ Using LangGraph agents?
   │  └─ Yes → LangGraph Setup
   └─ No
      ├─ Have custom state management?
      │  └─ Yes → External Store Setup
      └─ No → Local Runtime Setup
```

## AI SDK v6 Setup (Recommended)

### Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk @ai-sdk/react ai
npm install @ai-sdk/openai  # or your preferred provider
```

### Frontend

```tsx
// app/page.tsx
"use client";

import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

export default function Chat() {
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### API Route

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Quick Reference

### useChatRuntime Options

```tsx
const runtime = useChatRuntime({
  api: "/api/chat",           // API endpoint (required)
  headers: {},                // Custom headers
  body: {},                   // Extra body params
  initialMessages: [],        // Pre-populated messages
  onError: (err) => {},       // Error handler
  cloud: cloudInstance,       // Cloud persistence
});
```

### useLocalRuntime Options

```tsx
import { useLocalRuntime } from "@assistant-ui/react";

const runtime = useLocalRuntime({
  model: {
    async run({ messages, abortSignal }) {
      // Return final result
      return { content: [{ type: "text", text: "Response" }] };
    },
    // OR use generator for streaming
    async *run({ messages, abortSignal }) {
      yield { type: "text-delta", textDelta: "Hello " };
      yield { type: "text-delta", textDelta: "world!" };
    },
  },
});
```

### useExternalStoreRuntime Options

```tsx
import { useExternalStoreRuntime } from "@assistant-ui/react";

const runtime = useExternalStoreRuntime({
  messages,                              // Your message array
  isRunning,                             // Generation in progress
  onNew: (msg) => dispatch(add(msg)),    // Handle new message
  onEdit: (msg) => dispatch(edit(msg)),  // Handle edit
  onReload: (parentId) => regenerate(),  // Handle regenerate
});
```

## Styling Options

### Option 1: Pre-built CSS (No Tailwind)

```tsx
import "@assistant-ui/styles/default.css";
```

### Option 2: Tailwind CSS

```js
// tailwind.config.js
module.exports = {
  content: [
    "./node_modules/@assistant-ui/react/dist/**/*.js",
    // ... your paths
  ],
};
```

### Option 3: Custom Styles

```tsx
<Thread className="h-full bg-gray-100" />

// Or fully custom with primitives
<ThreadPrimitive.Root className="flex flex-col">
  <ThreadPrimitive.Viewport className="flex-1">
    {/* ... */}
  </ThreadPrimitive.Viewport>
</ThreadPrimitive.Root>
```

## TypeScript Setup

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  }
}
```

## Environment Variables

```env
# .env.local
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://api.assistant-ui.com  # For cloud
```

## Common Gotchas

### "Cannot find module @ai-sdk/react"

AI SDK v6 requires `@ai-sdk/react` as a peer dependency:

```bash
npm install @ai-sdk/react
```

### "useChat is not exported"

You're likely mixing AI SDK v5 and v6. Update to v6:

```bash
npm install @ai-sdk/react@latest ai@latest
```

### Styles not applied

1. Check CSS import is at root level
2. For Tailwind, ensure content paths include node_modules

### Streaming not working

1. Check API returns correct Content-Type: `text/event-stream`
2. Verify `toDataStreamResponse()` is used (not `toTextStreamResponse()`)
3. Check browser console for CORS errors

### "runtime is undefined"

Ensure `useChatRuntime` is called inside a component, not at module level:

```tsx
// Wrong
const runtime = useChatRuntime({ api: "/api/chat" });

// Correct
function Chat() {
  const runtime = useChatRuntime({ api: "/api/chat" });
  // ...
}
```

## Optional Packages

```bash
# Markdown rendering
npm install @assistant-ui/react-markdown

# Syntax highlighting
npm install @assistant-ui/react-syntax-highlighter

# Cloud persistence
npm install assistant-cloud

# LangGraph integration
npm install @assistant-ui/react-langgraph
```
