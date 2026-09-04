# AG-UI Runtime

`@assistant-ui/react-ag-ui` wires the [AG-UI (Agent-User Interaction) protocol](https://github.com/ag-ui-protocol/ag-ui) into assistant-ui: streaming text, thinking/reasoning, tool calls, state snapshots and deltas, subagent nesting, and custom events, against any AG-UI-compliant server (CopilotKit-based backends included).

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Runtime options](#runtime-options) | [Loading history](#loading-conversation-history) | [Agent state](#agent-state) | [Interrupts](#interrupts-experimental) | [Subagents](#subagents) | [Supported events and custom data](#supported-events-and-custom-events)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/react-ag-ui @ag-ui/client
```

A full reference implementation: [`examples/with-ag-ui`](https://github.com/assistant-ui/assistant-ui/tree/main/examples/with-ag-ui), or `npx assistant-ui@latest create my-app -e with-ag-ui`.

## Quickstart

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import { useMemo } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { HttpAgent } from "@ag-ui/client";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const agent = useMemo(() => new HttpAgent({ url: "http://localhost:8000/agent" }), []);
  const runtime = useAgUiRuntime({ agent });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

The runtime parses `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_SNAPSHOT`, and the rest of the AG-UI event stream into assistant-ui messages. `showThinking` (default `true`) toggles whether `THINKING_*`/`REASONING_*` events render as visible reasoning. Adapters (attachments, speech, dictation, feedback, history) use the standard slots; multi-thread uses `adapters.threadList` (experimental).

## Runtime options

| Option | Type | Description |
| --- | --- | --- |
| `agent` | `HttpAgent` | Required; an AG-UI client agent from `@ag-ui/client` |
| `logger` | `Partial<Logger>` | Overrides for event-parser warnings and run lifecycle logs |
| `showThinking` | `boolean` | Render `THINKING_*`/`REASONING_*` as visible reasoning (default `true`) |
| `autoCancelPendingToolCalls` | `boolean` | Auto-cancel unresolved client-side tool calls on send/edit/reload (default `true`) |
| `onError` / `onCancel` | callbacks | `RUN_ERROR`/protocol errors, and run cancellation |
| `adapters` | `UseAgUiRuntimeAdapters` | `attachments`, `speech`, `dictation`, `feedback`, `history`, `threadList` |

## Loading conversation history

Convert persisted AG-UI messages with `fromAgUiMessages` inside a history adapter's `load`:

```tsx
import { fromAgUiMessages } from "@assistant-ui/react-ag-ui";
import { ExportedMessageRepository } from "@assistant-ui/react";

const runtime = useAgUiRuntime({
  agent,
  adapters: {
    history: {
      async load() {
        const { messages } = await fetch("/agents/state").then((r) => r.json());
        return ExportedMessageRepository.fromArray(fromAgUiMessages(messages));
      },
      async append() {
        /* persist the newly sent message on your backend */
      },
    },
  },
});
```

Messages sent during a live session always reach the agent through the run input regardless of `append`; a no-op `append` only works when your backend already persists the conversation itself. `fromAgUiMessages` reconstructs text, reasoning (including an `encryptedValue` carried at `providerMetadata.agui.encryptedValue`), tool calls, and multimodal attachments (`image`, `audio`, `video`, `document`; legacy `binary` parts that only reference a file id are not restored). An assistant message whose tool call has no matching result reconstructs as `requires-action`, matching a live pending call. Interrupts restore only if your backend persists the runtime's own `metadata.custom.agui.interrupts` array alongside the message.

## Agent state

`useAgUiState<T>()` mirrors the agent's `STATE_SNAPSHOT`/`STATE_DELTA` snapshot live; `useAgUiSetState<T>()` stages an optimistic update sent as the `state` field of the **next** run (not a live channel into an in-flight run):

```tsx
import { useAgUiState, useAgUiSetState } from "@assistant-ui/react-ag-ui";

const state = useAgUiState<{ topic: string; sources: string[] }>();
const setState = useAgUiSetState<{ topic: string; sources: string[] }>();
setState((prev) => ({ topic: prev?.topic ?? "market analysis", sources: [...(prev?.sources ?? []), "sec-filings"] }));
```

Works with any AG-UI agent (Mastra, Pydantic AI, CrewAI, LangGraph via an AG-UI adapter). Keep it distinct from `useAuiState` (assistant-ui's own client state) and your own app state.

## Interrupts (experimental)

When `RUN_FINISHED` carries `outcome = { type: "interrupt", interrupts: [...] }`, the active message becomes `requires-action` with `reason: "interrupt"` and the payload lands on `metadata.custom.agui.interrupts`.

```tsx
const runtime = useAgUiRuntime({ agent });
const pending = runtime.unstable_getPendingInterrupts();
await runtime.unstable_submitInterruptResponses(
  pending.map((i) => ({ interruptId: i.id, status: "resolved", payload: { approved: true } })),
);
```

`responses` must cover every open interrupt (missing, unknown, or expired ids reject before any network call). When the user ignores the prompt and sends a new message instead, `useAgUiSteerAway` cancels every open interrupt (`status: "cancelled"` by default) or unresolved client-side tool call, appends the message, and resumes in one run:

```tsx
const steerAway = useAgUiSteerAway();
await steerAway("actually, let's do something else");
```

## Subagents

A backend running the agents-as-tools pattern emits `SUBAGENT_STARTED`/`SUBAGENT_FINISHED`/`SUBAGENT_ERROR` plus a `subagentRunId` on every event that subagent produces. The runtime groups that activity into one nested assistant message per subagent run and attaches it to the spawning tool call as `ToolCallMessagePart.messages`, joined on `SUBAGENT_STARTED.parentToolCallId`. Render it with [`MessagePartPrimitive.Messages`](../../tools/SKILL.md) inside a tool renderer; no extra wiring needed. The run's `name`, `description`, `parentSubagentRunId`, `result`, `interruptIds`, and `errorCode` ride on the nested message's `metadata.custom.agui`.

Two limits: nested structure does not survive a reload (thread restore reads the flattened wire shape, so a restored subagent call comes back at the root, though results and decisions are preserved), and nested human-in-the-loop has no resume path yet (a `suspended` `SUBAGENT_FINISHED` marks the nested message `requires-action` but nothing answers it). A subagent whose `parentToolCallId` names no reachable call, or whose parent chain is cyclic, falls back to flat rendering rather than being dropped.

`@assistant-ui/react-langchain` exposes subagents as a discovery map instead (see [langchain.md](./langchain.md#subagent-and-subgraph-discovery)); AG-UI's explicit `parentToolCallId` gives a precise join that lets this runtime nest messages directly, which LangChain's namespace scheme cannot.

## Supported events and custom events

| Event | Effect |
| --- | --- |
| `RUN_STARTED` / `RUN_FINISHED` | Toggles `isRunning`; `RUN_FINISHED.outcome` (success / interrupt) is honored |
| `RUN_CANCELLED` / `RUN_ERROR` | Marks the in-flight message cancelled / errored, fires `onError` |
| `TEXT_MESSAGE_*`, `THINKING_*`, `REASONING_*` | Streams text and reasoning content |
| `TOOL_CALL_*` | Streams tool calls and attaches results |
| `SUBAGENT_STARTED` / `_FINISHED` / `_ERROR` | Opens, completes, or errors a nested subagent message (see [Subagents](#subagents)) |
| `STATE_SNAPSHOT` / `STATE_DELTA` | Replaces or JSON-Patches the agent's external state |
| `MESSAGES_SNAPSHOT` | Replaces the full message list (thread restore) |
| `CUSTOM` | Appended to the in-flight assistant message as a `data` part |
| `RAW` | Unrecognized wire events, parsed and ignored |

`CUSTOM` is AG-UI's application-data extension point: `CUSTOM { name: "sources", value: {...} }` becomes `{ type: "data", name: "sources", data: {...} }` on the assistant message, in arrival order, one part per name (repeats append separate parts). Data parts stay client-side (not sent back to the agent, and persisted as message JSON by a history adapter) and reset each run. Register a renderer per name:

```tsx
import { useAssistantDataUI } from "@assistant-ui/react";

useAssistantDataUI({ name: "sources", render: ({ data }) => <SourceList sources={data.sources} /> });
```

Unmatched names render nothing unless a `Data` fallback component is registered, in which case it also receives framework plumbing event names (`on_interrupt`, `PredictState`, `Exit`, `hook_error`, `state_update_error`, `system:*`, `MultiAgentHandoff`) that some framework integrations emit over the same channel.
