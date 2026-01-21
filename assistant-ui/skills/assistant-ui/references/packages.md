# assistant-ui Packages

## Core Packages

### @assistant-ui/react

Main UI library with primitives and hooks.

```bash
npm install @assistant-ui/react
```

**Exports:**
- Primitives: `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, `ActionBarPrimitive`, `BranchPickerPrimitive`, `AttachmentPrimitive`, `ThreadListPrimitive`
- Pre-built: `Thread`, `ThreadList`, `AssistantModal`
- Hooks: `useAssistantApi`, `useAssistantState`, `useAssistantEvent`
- Runtime: `useLocalRuntime`, `useExternalStoreRuntime`
- Tools: `makeAssistantTool`, `makeAssistantToolUI`, `useAssistantTool`, `useAssistantToolUI`
- Provider: `AssistantRuntimeProvider`

### assistant-stream

Streaming protocol for AI responses.

```bash
npm install assistant-stream
```

**Exports:**
- `AssistantStream` - Core streaming abstraction
- `DataStreamEncoder/Decoder` - AI SDK format
- `AssistantTransportEncoder/Decoder` - Native format
- `PlainTextEncoder/Decoder` - Simple text streaming

### assistant-cloud

Cloud persistence and auth.

```bash
npm install assistant-cloud
```

**Exports:**
- `AssistantCloud` - Main client class
- Thread management, file uploads, auth

## Integration Packages

### @assistant-ui/react-ai-sdk

Vercel AI SDK v6 integration.

```bash
npm install @assistant-ui/react-ai-sdk @ai-sdk/react
```

**Exports:**
- `useChatRuntime` - Main hook (recommended)
- `useAISDKRuntime` - Lower-level hook

### @assistant-ui/react-langgraph

LangGraph agent integration.

```bash
npm install @assistant-ui/react-langgraph
```

**Exports:**
- `useLangGraphRuntime` - Main hook
- `useLangGraphMessages` - Message utilities

## UI Enhancement Packages

### @assistant-ui/react-markdown

Markdown rendering with syntax highlighting support.

```bash
npm install @assistant-ui/react-markdown
```

**Exports:**
- `MarkdownText` - Renders markdown content
- `makeMarkdownText` - Create custom markdown component

### @assistant-ui/react-syntax-highlighter

Code block syntax highlighting.

```bash
npm install @assistant-ui/react-syntax-highlighter
```

### @assistant-ui/styles

Pre-built CSS styles (no Tailwind required).

```bash
npm install @assistant-ui/styles
```

**Styles:**
- `@assistant-ui/styles/default.css` - Full thread styles
- `@assistant-ui/styles/modal.css` - Modal popup styles

## Package Selection Guide

| Scenario | Packages |
|----------|----------|
| Next.js + AI SDK | `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `@ai-sdk/react` |
| LangGraph | `@assistant-ui/react`, `@assistant-ui/react-langgraph` |
| Custom backend | `@assistant-ui/react`, `assistant-stream` |
| With markdown | Add `@assistant-ui/react-markdown` |
| No Tailwind | Add `@assistant-ui/styles` |
| Production | Add `assistant-cloud` |

## Version Compatibility

- `@assistant-ui/react` requires React 18+
- `@assistant-ui/react-ai-sdk` requires AI SDK v6 (`@ai-sdk/react`)
- Node.js 18+ recommended
