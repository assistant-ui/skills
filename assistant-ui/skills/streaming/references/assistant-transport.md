# Assistant Transport

"Assistant Transport" names two related things: a **wire encoding** (`AssistantTransportEncoder`/`AssistantTransportDecoder` in `assistant-stream`, an SSE-JSON alternative to Data Stream for the same `AssistantStreamChunk` values) and a **state-streaming runtime** (`useAssistantTransportRuntime` in `@assistant-ui/react`, layered on `ExternalStoreRuntime`, where the backend streams snapshots of its own agent state rather than message parts). The runtime commonly rides on the wire encoding, but you can use either independently: the encoder as a drop-in swap for `DataStreamEncoder`, or the runtime's `update-state` operations carried inside a Data Stream response instead.

## Contents

[Wire encoding](#wire-encoding) | [When to use the runtime](#when-to-use-the-runtime) | [Building a frontend](#building-a-frontend) | [Backend payload](#backend-payload) | [State converter](#state-converter) | [Editing and custom commands](#editing-and-custom-commands) | [Resuming from a sync server](#resuming-from-a-sync-server) | [Streaming state operations](#streaming-state-operations) | [Adapter support](#adapter-support)

## Wire encoding

`AssistantTransportEncoder` serializes each `AssistantStreamChunk` as a JSON `data:` line and closes with `data: [DONE]`; `AssistantTransportDecoder` reverses it. Both carry `Content-Type: text/event-stream`. Build the stream the same way as Data Stream, just swap the encoder:

```ts
import {
  AssistantStream,
  AssistantTransportEncoder,
  createAssistantStreamController,
} from "assistant-stream";

export async function POST(req: Request) {
  const [stream, controller] = createAssistantStreamController();

  controller.appendText("Hello ");
  controller.appendText("world!");
  controller.close();

  return AssistantStream.toResponse(stream, new AssistantTransportEncoder());
}
```

```ts
import { AssistantStream, AssistantTransportDecoder } from "assistant-stream";

const stream = AssistantStream.fromResponse(response, new AssistantTransportDecoder());
for await (const chunk of stream) {
  console.log(chunk);
}
```

`AssistantTransportDecoder({ strict })` (default `strict: true`) throws if the body ends without `[DONE]`; pass `{ strict: false }` to warn and continue instead. Both classes accept every `AssistantStreamChunk` type from [SKILL.md](../SKILL.md), including `update-state`, which is how the runtime below rides on this same wire encoding.

## When to use the runtime

Pick `useAssistantTransportRuntime` over Data Stream when your backend does not have a streaming protocol yet and you want one, when your agent already carries rich internal state worth surfacing directly (an open-source LangGraph agent, a custom framework), or when you need bidirectional custom commands beyond a simple message turn. If you only need to stream message parts, Data Stream is simpler. React state access (`useAssistantTransportState`, the `Assistant.ExternalState` module augmentation) and the general `ExternalStoreRuntime` shape live in [runtime](../../runtime/SKILL.md); this file covers the wire-facing half: the request and response contract, and how the backend produces it.

The frontend receives state snapshots and renders them; it never mutates state directly. User actions (sending a message, submitting a tool result) become **commands** queued on the client: while idle a new command sends immediately, otherwise it waits for the in-flight request to finish, then the queue drains.

## Building a frontend

```tsx
"use client";

import {
  AssistantRuntimeProvider,
  AssistantTransportConnectionMetadata,
  useAssistantTransportRuntime,
} from "@assistant-ui/react";

type State = { messages: Message[] };

const converter = (state: State, connectionMetadata: AssistantTransportConnectionMetadata) => {
  const optimistic = connectionMetadata.pendingCommands
    .filter((c) => c.type === "add-message")
    .map((c) => c.message);

  return {
    messages: [...state.messages, ...optimistic],
    isRunning: connectionMetadata.isSending || false,
  };
};

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useAssistantTransportRuntime({
    initialState: { messages: [] },
    api: "http://localhost:8010/assistant",
    converter,
    headers: async () => ({ Authorization: "Bearer token" }),
    onError: (error, { updateState }) => {
      updateState((s) => ({ ...s, lastError: error.message }));
    },
    onCancel: ({ updateState }) => {
      updateState((s) => ({ ...s, status: "cancelled" }));
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

`useAssistantTransportRuntime` also accepts `resumeApi`, `resumeStateApi`, `protocol` (`"data-stream" | "assistant-transport"`), `body`, `prepareSendCommandsRequest`, `capabilities`, `adapters`, `onResponse`, and `onFinish`; the full option list is in the [transport API reference](https://www.assistant-ui.com/docs/api-reference/transport/assistant-transport). `onError` receives the commands that were in transit; `onCancel` receives in-transit and queued commands on a direct cancel, or only queued commands after an error (in-transit ones already reached `onError`). Both get an `updateState` callback for a client-only state patch, no request involved.

## Backend payload

Every POST carries:

```ts
{
  state: T,                                     // the state the frontend last saw
  commands: AssistantTransportCommand[],
  system?: string,
  tools?: Record<string, ToolJSONSchema>,
  threadId: string | null,                      // null for a new thread
  parentId?: string | null,                      // set when editing or branching
  callSettings?: { maxTokens, temperature, topP, presencePenalty, frequencyPenalty, seed },
  config?: { apiKey, baseUrl, modelName },
}
```

Read `callSettings` and `config` from these nested objects; a previous wire shape also spread them at the top level (`body.modelName`, and so on), and both are still sent for compatibility, but the top-level fields are deprecated.

`AssistantTransportCommand` always includes the built-ins `add-message` and `add-tool-result`; declare more by augmenting `Assistant.Commands` (see [Editing and custom commands](#editing-and-custom-commands)).

## State converter

The converter is the only place agent state becomes assistant-ui messages:

```ts
(
  state: T,
  connectionMetadata: {
    pendingCommands: AssistantTransportCommand[];
    isSending: boolean;
    toolStatuses: Record<string, ToolExecutionStatus>;
  },
) => {
  messages: ThreadMessage[];
  isRunning: boolean;
  state?: ReadonlyJSONValue;
}
```

For an agent that already exposes a message list in a foreign shape, `unstable_createMessageConverter` builds the `ThreadMessage` mapping (and its inverse, `toOriginalMessage`/`toOriginalMessages`, for reading custom fields back out in a component):

```ts
import { unstable_createMessageConverter as createMessageConverter } from "@assistant-ui/react";

type YourMessage = { id: string; role: "user" | "assistant"; content: string };

const messageConverter = createMessageConverter((message: YourMessage) => ({
  role: message.role,
  content: [{ type: "text", text: message.content }],
}));

const converter = (state: YourAgentState) => ({
  messages: messageConverter.toThreadMessages(state.messages),
  isRunning: false,
});
```

`@assistant-ui/react-langgraph` ships `convertLangChainMessages` as a ready-made converter function for LangChain-shaped messages.

## Editing and custom commands

Editing is off by default; turn it on with `capabilities: { edit: true }`. An `add-message` command carrying `parentId` (insert after) and `sourceId` (the message being replaced, `null` for a genuinely new message) then reaches the backend, which truncates messages after `parentId`, appends the new message, and streams the updated state back.

Declare a custom command by augmenting `Assistant.Commands`, then dispatch it with `useAssistantTransportSendCommand`:

```ts title="assistant.config.ts"
import "@assistant-ui/react";

declare module "@assistant-ui/react" {
  namespace Assistant {
    interface Commands {
      myCustomCommand: { type: "my-custom-command"; data: string };
    }
  }
}
```

```ts
import { useAssistantTransportSendCommand } from "@assistant-ui/react";

function MyButton() {
  const sendCommand = useAssistantTransportSendCommand();
  return (
    <button onClick={() => sendCommand({ type: "my-custom-command", data: "hello" })}>
      Send
    </button>
  );
}
```

Custom commands follow the same lifecycle as the built-ins and show up in `connectionMetadata.pendingCommands` for optimistic rendering, and in `onError`/`onCancel` alongside `add-message` and `add-tool-result`.

## Resuming from a sync server

Resuming an active run after a reload requires a sync server (an enterprise feature) that retains in-flight state. Set `resumeApi` to reconnect to the stream; the runtime calls `aui.thread.resumeRun({ parentId })` when you detect an active run on mount. Setting `resumeStateApi` additionally hydrates the resumed run's starting state: the runtime posts `{ threadId }`, expects back `{ runId, state }`, and includes `runId` in the resume request (dropping any `state` supplied through `body` or `prepareSendCommandsRequest`, and taking precedence over both). A missing active run returns `204 No Content` and the resume is skipped without error; a failing `resumeStateApi` preflight fails the resume closed, so only point it at a server that actually implements the initial-state route.

This is unrelated to `assistant-stream/resumable` (see [resumable.md](./resumable.md)), which resumes the byte stream of a single in-flight response rather than an agent's run state.

## Streaming state operations

The state-streaming side of the protocol is two operations, diffed against the previous state at an arbitrary JSON path:

```json
{ "type": "set", "path": ["status"], "value": "completed" }
{ "type": "append-text", "path": ["message"], "value": " World" }
```

On the wire these arrive as an `AssistantStreamChunk` with `type: "update-state"` and an `operations` array of exactly this shape (`AssistantTransportStateOperation`, exported from `assistant-stream`). A TypeScript backend emits one directly:

```ts
controller.enqueue({
  type: "update-state",
  path: [],
  operations: [{ type: "set", path: ["status"], value: "running" }],
});
```

The documented reference backend is the Python `assistant-stream` package ([PyPI](https://pypi.org/project/assistant-stream/)), which diffs an entire `RunController.state` object for you and emits `set`/`append-text` automatically wherever you mutate it:

```python
from assistant_stream import RunController, create_run
from assistant_stream.serialization import DataStreamResponse

@app.post("/assistant")
async def chat_endpoint(request: ChatRequest):
    async def run_callback(controller: RunController):
        if controller.state is None:
            controller.state = {"messages": []}
        for command in request.commands:
            if command.type == "add-message":
                controller.state["messages"].append(command.message)
        async for message in your_agent.stream():
            controller.state["messages"].append(message)

    stream = create_run(run_callback, state=request.state)
    return DataStreamResponse(stream)
```

A `messages` key on `controller.state` is understood natively and streams as ordinary message parts; any other key streams as generic `set`/`append-text` operations. `create_run` exposes `controller.is_cancelled` and `controller.cancelled_event` for cooperative shutdown (about a 50ms window before forced cancellation) when the response stream closes early; put cleanup in a `finally` block. A LangGraph-specific helper, `assistant_stream.modules.langgraph.append_langgraph_event`, adapts `graph.astream(..., stream_mode=["messages", "updates"])` output onto `controller.state` directly.

## Adapter support

| Adapter | Supported via |
| --- | --- |
| Attachments | `adapters.attachments` |
| History | `adapters.history` |
| Thread list | the outer thread list runtime (see [runtime](../../runtime/SKILL.md)) |

Speech, dictation, feedback, and suggestions are not exposed by `AssistantTransport`; drop to `ExternalStoreRuntime` directly if you need them.
