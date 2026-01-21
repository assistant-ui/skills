---
name: assistant-ui
description: Guide for assistant-ui library - AI chat UI components. Use when asking about architecture, debugging, or understanding the codebase.
version: 0.0.1
license: MIT
---

# assistant-ui

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/llms.txt) for latest API.**

React library for building AI chat interfaces with composable primitives.

## References

- [./references/architecture.md](./references/architecture.md) -- Core architecture and layered system
- [./references/packages.md](./references/packages.md) -- Package overview and selection guide

## When to Use assistant-ui

| Use Case | Best For |
|----------|----------|
| Chat UI from scratch | Full control over UX |
| Existing AI backend | Connects to any streaming backend |
| Custom message types | Tools, images, files, custom parts |
| Multi-thread apps | Built-in thread list management |
| Production apps | Cloud persistence, auth, analytics |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  UI Components (Primitives)             │
│    ThreadPrimitive, MessagePrimitive, ComposerPrimitive │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Context Hooks                         │
│   useAssistantApi, useAssistantState, useAssistantEvent │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                    Runtime Layer                        │
│  AssistantRuntime → ThreadRuntime → MessageRuntime      │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Adapters/Backend                      │
│   AI SDK · LangGraph · Custom · Cloud Persistence       │
└─────────────────────────────────────────────────────────┘
```

## Pick a Runtime

```
Need AI SDK?
├─ Yes → useChatRuntime (recommended)
└─ No
   ├─ Custom state store (Redux/Zustand)?
   │  └─ Yes → useExternalStoreRuntime
   └─ No
      ├─ LangGraph agent?
      │  └─ Yes → useLangGraphRuntime
      └─ No → useLocalRuntime
```

## Core Packages

| Package | Purpose | When to Use |
|---------|---------|-------------|
| `@assistant-ui/react` | UI primitives & hooks | Always |
| `@assistant-ui/react-ai-sdk` | Vercel AI SDK v6 adapter | Next.js apps with AI SDK |
| `@assistant-ui/react-langgraph` | LangGraph adapter | Python/LangGraph agents |
| `@assistant-ui/react-markdown` | Markdown rendering | Chat with markdown content |
| `@assistant-ui/styles` | Pre-built CSS | Non-Tailwind projects |
| `assistant-stream` | Streaming protocol | Custom backends |
| `assistant-cloud` | Cloud persistence | Production apps |

## Quick Start

```tsx
import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

function App() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat" }),
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## State Access Pattern

```tsx
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";

// Actions (imperative)
const api = useAssistantApi();
api.thread().append({ role: "user", content: [{ type: "text", text: "Hi" }] });
api.thread().cancelRun();

// State (reactive)
const messages = useAssistantState(s => s.thread.messages);
const isRunning = useAssistantState(s => s.thread.isRunning);
```

## Common Gotchas

**Missing peer dependencies**
```bash
# AI SDK v6 requires @ai-sdk/react
npm install @ai-sdk/react
```

**Styles not showing**
```tsx
// Either import pre-built CSS
import "@assistant-ui/styles/default.css";
// Or configure Tailwind with assistant-ui plugin
```

**Thread not updating**
- Ensure runtime is wrapped in `AssistantRuntimeProvider`
- Check that API returns proper streaming response

**Tool calls not rendering**
- Register tool UI with `makeAssistantToolUI`
- Ensure backend returns tool call events

## Related Skills

- `/setup` - Installation and configuration
- `/primitives` - UI component customization
- `/runtime` - State management deep dive
- `/tools` - Tool registration and UI
- `/streaming` - Streaming protocols
- `/integrations` - Backend connections
- `/cloud` - Persistence and auth
- `/thread-list` - Multi-thread management
