# Google ADK Runtime

`@assistant-ui/react-google-adk` integrates with [Google ADK JS](https://github.com/google/adk-js) (`LlmAgent`, sequential/parallel/loop agents) and ADK Python backends: streaming text, tool calls, multi-agent orchestration, code execution, session state, tool confirmations, auth flows, and input requests. The package normalizes snake_case event fields from ADK Python automatically (`function_call` to `functionCall`, and so on); no configuration is needed to point at either backend.

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Direct server connection](#direct-adk-server-connection) | [Server helpers](#server-helpers) | [Thread management](#thread-management) | [Message editing](#message-editing-and-regeneration) | [Hooks reference](#hooks-reference)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/react-google-adk @google/adk
```

`@google/adk` is server-side only; the client runtime has no dependency on it.

## Quickstart

`createAdkApiRoute` builds a proxy API route in one line:

```ts title="app/api/chat/route.ts"
import { createAdkApiRoute } from "@assistant-ui/react-google-adk/server";
import { InMemoryRunner, LlmAgent } from "@google/adk";

const agent = new LlmAgent({
  name: "my_agent",
  model: "gemini-2.5-flash",
  instruction: "You are a helpful assistant.",
});
const runner = new InMemoryRunner({ agent, appName: "my-app" });

export const POST = createAdkApiRoute({
  runner,
  userId: "user_1",
  sessionId: (req) => new URL(req.url).searchParams.get("sessionId") ?? "default",
});
```

`userId` and `sessionId` each accept a static string or `(req: Request) => string`.

```tsx title="components/MyAssistant.tsx"
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAdkRuntime, createAdkStream } from "@assistant-ui/react-google-adk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export function MyAssistant() {
  const runtime = useAdkRuntime({ stream: createAdkStream({ api: "/api/chat" }) });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

Add adapters (attachments, history, speech, feedback) the same way as any runtime:

```tsx
const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),
  adapters: { attachments, history, speech, feedback },
});
```

## Direct ADK server connection

`createAdkStream` also supports **direct mode**, connecting straight to an ADK server without a proxy route:

```ts
const stream = createAdkStream({ api: "http://localhost:8000", appName: "my-app", userId: "user-1" });
```

Pair it with `createAdkSessionAdapter` to back the thread list with ADK sessions:

```tsx
import { useAdkRuntime, createAdkStream, createAdkSessionAdapter } from "@assistant-ui/react-google-adk";

const ADK_URL = "http://localhost:8000";
const { adapter, load, artifacts } = createAdkSessionAdapter({ apiUrl: ADK_URL, appName: "my-app", userId: "user-1" });

const runtime = useAdkRuntime({
  stream: createAdkStream({ api: ADK_URL, appName: "my-app", userId: "user-1" }),
  sessionAdapter: adapter,
  load,
});
```

`adapter` is a `RemoteThreadListAdapter` over ADK's session REST API; `load` reconstructs messages from session events via `AdkEventAccumulator`; `artifacts` fetches, lists, and deletes session artifacts (see [Artifacts](#hooks-reference)).

## Server helpers

Under the `/server` subpath:

```ts
import { createAdkApiRoute, adkEventStream, parseAdkRequest, toAdkContent } from "@assistant-ui/react-google-adk/server";
```

- **`createAdkApiRoute`**: the one-liner route handler shown above.
- **`adkEventStream(events)`**: converts an `AsyncGenerator<Event>` from `Runner.runAsync()` into an SSE `Response`, sending an initial `:ok` comment to keep proxies alive.
- **`parseAdkRequest`/`toAdkContent`**: lower-level helpers for a custom route; `parseAdkRequest` yields `{ type: "message" | "tool-result", config, stateDelta }`, and `toAdkContent` converts the parsed request to ADK's `Content` format.

```ts
const parsed = await parseAdkRequest(req);
const newMessage = toAdkContent(parsed);
const events = runner.runAsync({ userId, sessionId, newMessage, stateDelta: parsed.stateDelta });
return adkEventStream(events);
```

## Thread management

Three options, same shape as every runtime (see [runtime](../../runtime/SKILL.md)): the ADK session adapter above, custom `create`/`load`/`delete` callbacks against your own session store, or an `AssistantCloud` instance passed as `cloud`.

## Message editing and regeneration

Provide `getCheckpointId` to enable edit and regenerate buttons; without it, neither appears (truncating client-side messages without a matching server checkpoint would corrupt state):

```ts
const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),
  getCheckpointId: async (threadId, parentMessages) => checkpointId,
});
```

The resolved id reaches `stream` as `config.checkpointId`.

## Event handlers and run config

```ts
const runtime = useAdkRuntime({
  stream: createAdkStream({ api: "/api/chat" }),
  eventHandlers: {
    onError: (error) => console.error("Stream error:", error),
    onAgentTransfer: (toAgent) => console.log("Agent transferred to:", toAgent),
    onCustomEvent: (key, value) => console.log("Custom metadata:", key, value),
  },
});
```

`useAdkSend()` sends raw messages with a per-run `AdkRunConfig` and a `stateDelta` merged into ADK's session state:

```ts
import { useAdkSend } from "@assistant-ui/react-google-adk";

const send = useAdkSend();
send(messages, {
  runConfig: { streamingMode: "sse", maxLlmCalls: 10, pauseOnToolCalls: true },
  stateDelta: { taskId: "abc", mode: "verbose" },
});
```

## Hooks reference

All hooks import from `@assistant-ui/react-google-adk` and require the runtime provider.

| Hook | Returns |
| --- | --- |
| `useAdkAgentInfo()` | Current agent name and branch path (multi-agent) |
| `useAdkSessionState()` | Full accumulated session state delta |
| `useAdkAppState()` / `useAdkUserState()` / `useAdkTempState()` | State filtered to the `app:*` / `user:*` / `temp:*` prefix (stripped; temp is not persisted) |
| `useAdkSend()` | Send raw ADK messages |
| `useAdkToolConfirmations()` / `useAdkConfirmTool()` | Pending tool confirmations (from `SecurityPlugin` or tool callbacks) and a `(toolCallId, approved) => void` responder |
| `useAdkAuthRequests()` / `useAdkSubmitAuth()` | Pending OAuth/auth requests and a `(toolCallId, credential: AdkAuthCredential) => void` submitter (`apiKey`, `http`, `oauth2`, `openIdConnect`, `serviceAccount`) |
| `useAdkSubmitInput()` | Answers an ADK Python 2.0+ Workflow `RequestInput` node's `adk_request_input` long-running call from a tool renderer; wraps the answer as `{ result }` to match ADK's `unwrap_response` contract |
| `useAdkLongRunningToolIds()` | IDs of long-running tools awaiting input |
| `useAdkArtifacts()` | Artifact delta (filename to version) |
| `useAdkEscalation()` | Whether escalation was requested |
| `useAdkMessageMetadata()` | Per-message grounding, citation, and usage metadata |

```tsx
import { useAdkToolConfirmations, useAdkConfirmTool } from "@assistant-ui/react-google-adk";

function ToolConfirmationUI() {
  const confirmations = useAdkToolConfirmations();
  const confirmTool = useAdkConfirmTool();
  return confirmations.map((conf) => (
    <div key={conf.toolCallId}>
      <p>Tool "{conf.toolName}" wants to run. {conf.hint}</p>
      <button onClick={() => confirmTool(conf.toolCallId, true)}>Approve</button>
      <button onClick={() => confirmTool(conf.toolCallId, false)}>Deny</button>
    </div>
  ));
}
```

Register a `RequestInputToolUI` the same way as any tool renderer (through a toolkit's `render`, see [tools](../../tools/SKILL.md)), calling `useAdkSubmitInput()` from inside it.
