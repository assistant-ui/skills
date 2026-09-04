# OpenCode Runtime

`@assistant-ui/react-opencode` wires [OpenCode](https://opencode.ai/), an open-source AI coding agent, into an assistant-ui thread via `ExternalStoreRuntime` plus a `RemoteThreadList` for session-backed threads. OpenCode sessions map to threads; the runtime subscribes to the server's SSE event stream.

This adapter is at v0.0.3 and experimental; the runtime API and exported hooks may change without notice.

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Sub-agent conversations](#sub-agent-conversations) | [Hooks](#hooks) | [Lower-level building blocks](#lower-level-building-blocks)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/react-opencode @opencode-ai/sdk
```

Requires a running [OpenCode](https://opencode.ai/) server (defaults to `http://localhost:4096`).

## Quickstart

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useOpenCodeRuntime } from "@assistant-ui/react-opencode";

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useOpenCodeRuntime({ baseUrl: "http://localhost:4096" });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

Pin a default model or agent for new sessions:

```tsx
const runtime = useOpenCodeRuntime({
  baseUrl: "http://localhost:4096",
  defaultModel: { providerID: "anthropic", modelID: "claude-sonnet-4-6" },
  defaultAgent: "coder",
});
```

Bring a pre-configured client (for auth headers), or resume an existing session:

```tsx
import { createOpencodeClient } from "@assistant-ui/react-opencode";

const client = createOpencodeClient({ baseUrl: "http://localhost:4096" });
const runtime = useOpenCodeRuntime({ client });
// or: useOpenCodeRuntime({ baseUrl: "http://localhost:4096", initialSessionId: "ses_abc123" })
```

## Sub-agent conversations

OpenCode `task` tool calls expose their child session through tool metadata. The runtime loads those child sessions eagerly (every `task` part in a subscribed thread's transcript fetches its child, whether or not any tool card is expanded), keeps each one synced from the same event stream, and projects the transcript into `ToolCallMessagePart.messages`. Parallel and recursively nested tasks are supported. A `task` part carries `messages` only once its child session has loaded; while loading, it projects as an ordinary tool call, so an empty `messages` array always means the sub-agent produced nothing. Render it with [`MessagePartPrimitive.Messages`](../../tools/SKILL.md); nested conversations are read-only and inherit the parent's tool renderers.

## Hooks

OpenCode pauses tool execution to ask permission (shell commands, file writes). Permissions linked to a tool call project into assistant-ui's standard tool approval contract, so the default `ToolFallback` renders working Allow / Always allow / Deny without a custom component. `useOpenCodePermissions()` remains available for custom renderers and permission requests not linked to a tool call:

```tsx
import { useOpenCodePermissions } from "@assistant-ui/react-opencode";

const { pending, reply } = useOpenCodePermissions();
// reply(id, "once" | "always" | "reject")
```

OpenCode can also ask interactive questions mid-run:

```tsx
import { useOpenCodeQuestions, useOpenCodeRuntimeExtras } from "@assistant-ui/react-opencode";

const questions = useOpenCodeQuestions();
const { replyToQuestion, rejectQuestion } = useOpenCodeRuntimeExtras();
// replyToQuestion(id, answers: QuestionAnswer[]) or rejectQuestion(id)
```

| Hook | Returns |
| --- | --- |
| `useOpenCodeSession()` | The current OpenCode `Session` (server-side metadata) |
| `useOpenCodeThreadState(selector?)` | Full projected thread state: messages, run state, `childSessionsById`, `interactions.{permissions,questions}`, sync metadata |
| `useOpenCodeRuntimeExtras()` | `fork(messageId)`, `revert(messageId)`, `unrevert()`, `cancel()`, `refresh()`, `replyToPermission`, `replyToQuestion`, `rejectQuestion` |

```tsx
const isStreaming = useOpenCodeThreadState((s) => s.runState.type === "streaming");
```

`useOpenCodePermissions`/`useOpenCodeQuestions` are sugar over `useOpenCodeRuntimeExtras`'s responders plus the corresponding `pending` state slice.

## Lower-level building blocks

For custom integrations that bypass `useOpenCodeRuntime`: `OpenCodeEventSource` (typed subscription over the server's event stream), `OpenCodeThreadController` (per-session state controller), `createOpenCodeThreadState`/`reduceOpenCodeThreadState` (pure reducers), `projectOpenCodeThreadMessages` (raw OpenCode messages to assistant-ui thread messages). Most apps should use `useOpenCodeRuntime` directly instead.
