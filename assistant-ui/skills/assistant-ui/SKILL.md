---
name: assistant-ui
description: "Overview and router for assistant-ui, the React library for building AI chat interfaces from composable primitives and a styled elements catalog. Use for high-level, cross-cutting, or architecture questions: choosing packages, picking a runtime, or understanding the layers (elements, primitives, the aui client with AuiConfig and AuiProvider, the runtime, adapters) and the message model. Covers `@assistant-ui/react` 0.15.x, the framework-neutral `@assistant-ui/ai-sdk` integration for AI SDK v7 (`useChatRuntime`, `AssistantChatTransport`; `@assistant-ui/react-ai-sdk` re-exports it), `@assistant-ui/core`, `@assistant-ui/store`, `assistant-stream`, `assistant-cloud`, the adapters for LangGraph, LangChain, Google ADK, A2A, AG-UI, Eve, OpenCode, and Pi, and the platform bindings `@assistant-ui/react-native` and `@assistant-ui/react-ink`; `AssistantRuntimeProvider`; the primitives `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`; the hooks `useAui`, `useAuiState`, `useAuiEvent`; and runtime selection across `useChatRuntime`, `useExternalStoreRuntime`, `useLangGraphRuntime`, `useLocalRuntime`. For a specific area route to a focused sibling instead: setup, elements, primitives, runtime, tools, generative-ui, streaming, cloud, thread-list, copilots, markdown, react-mcp, observability, react-native, ink, or update."
license: MIT
---

# assistant-ui

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

React library for AI chat interfaces: unstyled primitives, a styled elements catalog, a runtime that adapts any backend, and optional cloud persistence. Current line is `@assistant-ui/react` 0.15.x on AI SDK v7 through `@assistant-ui/ai-sdk`.

## References

- [./references/architecture.md](./references/architecture.md) -- layers, the aui client, data flow, message model
- [./references/packages.md](./references/packages.md) -- every published package and when to install it

## When to Use

| Use Case | Reach for |
|----------|-----------|
| Chat UI in an afternoon | `npx assistant-ui@latest create`, then the `thread` element |
| Full control over markup | Primitives (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`) |
| Existing AI backend | A runtime adapter (AI SDK, LangGraph, LangChain, ADK, A2A, AG-UI, Eve, OpenCode) or `useLocalRuntime` |
| Tools with UI | `"use generative"` toolkits, tool UI, generative UI |
| Multi-thread apps | Thread list elements plus Assistant Cloud or your own adapter |
| Copilots in an app | Instructions, context, visible components, interactables |
| Mobile or terminal | `@assistant-ui/react-native`, `@assistant-ui/react-ink` |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Elements (styled, copied into components/assistant-ui/)     │
│  Primitives (unstyled, @assistant-ui/react)                  │
└───────────────────────────┬──────────────────────────────────┘
                            │ read state, call actions
┌───────────────────────────▼──────────────────────────────────┐
│  aui client: useAui, useAuiState, useAuiEvent, AuiIf         │
│  scopes provided by AuiConfig through AssistantRuntimeProvider│
│  or AuiProvider (@assistant-ui/store on @assistant-ui/tap)   │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Runtime: AssistantRuntime → ThreadRuntime → MessageRuntime  │
│  (@assistant-ui/core, framework neutral)                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  Adapters and backends: AI SDK · LangGraph · LangChain · ADK │
│  A2A · AG-UI · Eve · OpenCode · custom · Assistant Cloud     │
└──────────────────────────────────────────────────────────────┘
```

## Pick a Runtime

```
Vercel AI SDK?
├─ Yes → useChatRuntime from @assistant-ui/ai-sdk (recommended)
└─ No
   ├─ LangGraph server → useLangGraphRuntime (@assistant-ui/react-langgraph)
   ├─ LangChain / LangGraph useStream → useStreamRuntime (@assistant-ui/react-langchain)
   ├─ Google ADK → useAdkRuntime (@assistant-ui/react-google-adk)
   ├─ A2A protocol → useA2ARuntime (@assistant-ui/react-a2a)
   ├─ AG-UI protocol → useAgUiRuntime (@assistant-ui/react-ag-ui)
   ├─ Eve agents → useEveAgentRuntime (@assistant-ui/eve)
   ├─ OpenCode → useOpenCodeRuntime (@assistant-ui/react-opencode)
   ├─ Claude Managed Agents → useExternalStoreRuntime + useRemoteThreadListRuntime
   ├─ State already in Redux/Zustand/your store → useExternalStoreRuntime
   ├─ Custom endpoint speaking Assistant Transport → useAssistantTransportRuntime
   └─ Any other custom API → useLocalRuntime with a ChatModelAdapter
```

## Core Packages

| Package | Purpose |
|---------|---------|
| `@assistant-ui/react` | Primitives, hooks, runtimes, provider |
| `@assistant-ui/ai-sdk` | AI SDK v7 integration (`useChatRuntime`, `AssistantChatTransport`, `AISDKToolkit`, `frontendTools`) |
| `@assistant-ui/core` | Framework-neutral runtime shared by React, React Native, Ink |
| `@assistant-ui/store` | `AuiConfig`, `AuiProvider`, `useAui` state layer |
| `@assistant-ui/react-markdown` | Markdown rendering (`MarkdownTextPrimitive`) |
| `assistant-stream` | Streaming protocol, encoders, resumable streams |
| `assistant-cloud` | Assistant Cloud client |
| `assistant-ui` | The CLI (`create`, `init`, `add`, `update`, `upgrade`, `doctor`, `mcp`, `agent`) |

`@assistant-ui/react-ai-sdk` re-exports `@assistant-ui/ai-sdk` for older installs; new code imports from `@assistant-ui/ai-sdk`. Styled components are not a package: `npx assistant-ui@latest add thread` copies them into `components/assistant-ui/elements/`. See [./references/packages.md](./references/packages.md) for the full inventory.

## Quick Start

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function Chat() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

`useChatRuntime()` posts to `/api/chat` through `AssistantChatTransport`, which also forwards frontend tools and system instructions. Pass `new AssistantChatTransport({ api })` to change the endpoint.

## State Access

Scope accessors on `aui` are properties; methods on a scope keep their parentheses. Selectors return one primitive or stable reference each.

```tsx
import { useAui, useAuiState, useAuiEvent } from "@assistant-ui/react";

const aui = useAui();
aui.thread.append({ role: "user", content: [{ type: "text", text: "Hi" }] });
aui.thread.cancelRun();
aui.thread.composer().send();
aui.threads.switchToNewThread();

const messages = useAuiState((s) => s.thread.messages);
const isRunning = useAuiState((s) => s.thread.isRunning);

useAuiEvent("threads.selectionChanged", ({ threadId, previousThreadId }) => {});
```

## Providing Scopes

Tools, suggestions, interactables, MCP managers, and other scopes are declared with `AuiConfig` and handed to the provider; `useAui()` takes no arguments.

```tsx
import { AssistantRuntimeProvider, AuiConfig, Suggestions, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import toolkit from "./toolkit";

const runtime = useChatRuntime();
const config = AuiConfig({
  tools: Tools({ toolkit }),
  suggestions: Suggestions(["What can you do?", "Summarize this page"]),
});

<AssistantRuntimeProvider runtime={runtime} config={config}>{children}</AssistantRuntimeProvider>;
```

Nested scopes use `<AuiProvider extends={useAui()} config={config}>`; an isolated root uses `extends={null}`.

## Related Skills

- [setup](../setup/SKILL.md) -- CLI, templates, runtime adapters, platforms
- [elements](../elements/SKILL.md) -- the styled component catalog and how to install and override it
- [primitives](../primitives/SKILL.md) -- unstyled building blocks and composer features
- [runtime](../runtime/SKILL.md) -- runtimes, the aui client, adapters, events
- [tools](../tools/SKILL.md) -- toolkits, tool UI, approvals, MCP, WebMCP
- [generative-ui](../generative-ui/SKILL.md) -- the `present` tool and component vocabularies
- [streaming](../streaming/SKILL.md) -- assistant-stream, transports, resumable streams
- [cloud](../cloud/SKILL.md) -- Assistant Cloud persistence and auth
- [thread-list](../thread-list/SKILL.md) -- multi-thread management
- [copilots](../copilots/SKILL.md) -- grounding the assistant in your app
- [markdown](../markdown/SKILL.md) -- markdown, code, math, diagrams
- [react-mcp](../react-mcp/SKILL.md) -- user-managed MCP servers
- [observability](../observability/SKILL.md) -- tracing and span visualization
- [react-native](../react-native/SKILL.md) -- Expo and React Native
- [ink](../ink/SKILL.md) -- terminal chat with Ink
- [update](../update/SKILL.md) -- upgrades and migrations
