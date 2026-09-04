# assistant-ui Packages

Check the current version with `npm view <package> version`. Every published package exposes only the `latest` dist-tag, so install from `latest`. Monorepo-only packages (`@assistant-ui/ui`, `@assistant-ui/x-*`, `@assistant-ui/vue`, `@assistant-ui/svelte`) are not on npm; `@assistant-ui/ui` is the source of the elements catalog that the CLI copies into your project.

## Core

| Package | Notes |
|---------|-------|
| `@assistant-ui/react` | Primitives, hooks, runtimes, `AssistantRuntimeProvider`, toolkit authoring; 0.15.x |
| `@assistant-ui/core` | Framework-neutral runtime, adapters, and store entries shared by every binding |
| `@assistant-ui/store` | `AuiConfig`, `AuiProvider`, `useAui`, `useAuiState`, `useAuiEvent`, `Derived` |
| `@assistant-ui/tap` | Reactive resources behind the store (`withKey`, `createTapRoot`) |
| `assistant-stream` | Streaming protocol, encoders and decoders, `assistant-stream/resumable` |
| `assistant-cloud` | Assistant Cloud client (`AssistantCloud`, persistence helpers, run telemetry) |
| `assistant-ui` | The CLI: `create`, `init`, `add`, `update`, `upgrade`, `codemod`, `doctor`, `info`, `mcp`, `agent` |
| `create-assistant-ui` | `npm create assistant-ui` entry point |

## Backend adapters

| Package | Hook | Notes |
|---------|------|-------|
| `@assistant-ui/ai-sdk` | `useChatRuntime`, `useAISDKRuntime` | AI SDK v7 (`ai@^7`, `@ai-sdk/react@^4`); also `AISDKChat`, `AISDKThreads`, `AISDKToolkit`, `frontendTools`, `injectQuoteContext`, `useThreadTokenUsage`, resumable stream helpers |
| `@assistant-ui/react-ai-sdk` | same | Re-exports `@assistant-ui/ai-sdk`; keep it only in existing installs |
| `@assistant-ui/react-langgraph` | `useLangGraphRuntime` | LangGraph server streaming, interrupts, agent state, `ui_message` generative UI |
| `@assistant-ui/react-langchain` | `useStreamRuntime` | LangChain `useStream` adapter, subgraphs and subagents; the `langchain` CLI template |
| `@assistant-ui/react-google-adk` | `useAdkRuntime` | Google ADK sessions, tool confirmations, auth requests |
| `@assistant-ui/react-a2a` | `useA2ARuntime` | Agent-to-Agent protocol, tasks and artifacts |
| `@assistant-ui/react-ag-ui` | `useAgUiRuntime` | AG-UI protocol, shared state, interrupts, subagent lifecycle, A2UI actions |
| `@assistant-ui/eve` | `useEveAgentRuntime` | Eve agents; the `eve` CLI template |
| `@assistant-ui/react-opencode` | `useOpenCodeRuntime` | OpenCode sessions, permissions, questions |
| `@assistant-ui/react-pi` | `usePiRuntime` | Pi coding agent sessions |
| `@assistant-ui/react-data-stream` | `useDataStreamRuntime` | AI SDK v4 data stream protocol (legacy) |
| `@assistant-ui/cloud-ai-sdk` | `useCloudChat`, `useThreads` | AI SDK hooks backed by Assistant Cloud without assistant-ui components |

Claude Managed Agents, Mastra, Cloudflare Agents, and AI gateways need no adapter package; see the setup skill.

## Platform bindings and build plugins

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-native` | Expo and React Native primitives, hooks, and runtimes |
| `@assistant-ui/react-ink` | Terminal (Ink) primitives, hooks, and runtimes |
| `@assistant-ui/react-ink-markdown` | Markdown rendering for the terminal |
| `@assistant-ui/next` | `withAui()` Next.js config wrapper for `"use generative"` |
| `@assistant-ui/vite` | `aui()` Vite plugin for `"use generative"` |
| `@assistant-ui/metro` | `withAui()` Metro config wrapper for `"use generative"` |

## Rendering

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-markdown` | `MarkdownTextPrimitive`, math delimiter helpers, `unstable_memoizeMarkdownComponents` |
| `@assistant-ui/react-streamdown` | `StreamdownTextPrimitive` with built-in Shiki, KaTeX, Mermaid, block streaming |
| `@assistant-ui/react-syntax-highlighter` | Prism-based highlighter adapters |
| `@assistant-ui/react-generative-ui` | `JSONGenerativeUI`, the default component vocabulary, Slack and Teams renderers, A2UI |
| `@assistant-ui/react-lexical` | Lexical composer input with directive chips (mentions, slash commands) |
| `@assistant-ui/react-hook-form` | `useAssistantForm` for React Hook Form |
| `safe-content-frame` | Sandboxed iframe for untrusted HTML (used by MCP Apps and artifacts) |
| `heat-graph` | Headless activity heatmap |
| `tw-shimmer` | Tailwind v4 shimmer plugin used by the elements |
| `tw-glass` | Tailwind v4 glass refraction plugin |

## Tooling and integrations

| Package | Notes |
|---------|-------|
| `@assistant-ui/react-mcp` | User-managed MCP servers: connectors, OAuth, elicitation, `McpManagerResource` |
| `@assistant-ui/react-devtools` | DevTools panel and modal |
| `@assistant-ui/react-o11y` | Headless span and trace primitives |
| `@assistant-ui/mcp-docs-server` | Local stdio proxy to the hosted docs MCP server at `https://www.assistant-ui.com/mcp` |
| `@assistant-ui/agent-launcher` | Launches Claude Code with the assistant-ui skills (`assistant-ui agent`) |

## Package selection

| Scenario | Packages |
|----------|----------|
| Next.js + AI SDK | `@assistant-ui/react`, `@assistant-ui/ai-sdk`, `ai@^7`, `@ai-sdk/react@^4`, a provider such as `@ai-sdk/openai` |
| LangGraph | `@assistant-ui/react`, `@assistant-ui/react-langgraph` (or `@assistant-ui/react-langchain` for `useStream`) |
| Custom backend | `@assistant-ui/react`, `assistant-stream` |
| Markdown | `@assistant-ui/react-markdown` (or `@assistant-ui/react-streamdown`) plus the `markdown-text` element |
| Toolkits with `"use generative"` | `@assistant-ui/next`, `@assistant-ui/vite`, or `@assistant-ui/metro` |
| Expo / React Native | `@assistant-ui/react-native`, `@assistant-ui/ai-sdk`, `@assistant-ui/metro` |
| Terminal | `@assistant-ui/react-ink`, `@assistant-ui/react-ink-markdown`, `@assistant-ui/ai-sdk` |
| Persistence | `assistant-cloud` |

## Version compatibility

- `@assistant-ui/react` requires React 18 or 19.
- `@assistant-ui/ai-sdk` targets AI SDK v7 (`ai@^7`, `@ai-sdk/react@^4`). Older AI SDK majors use pinned `@assistant-ui/react-ai-sdk` releases (`1.3.x` for `ai@^6`, `1.1.x` for `ai@^5`) or `@assistant-ui/react-data-stream` for `ai@^4`; see the update skill.
- AI SDK accepts Zod 3.25+ and Zod 4.
- Node.js 24 is required only to build the monorepo; apps follow their framework's requirement.
