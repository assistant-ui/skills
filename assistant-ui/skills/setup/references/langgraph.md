# LangGraph Runtime

`@assistant-ui/react-langgraph` integrates directly with [`@langchain/langgraph-sdk`](https://docs.langchain.com/oss/javascript/langgraph-sdk): streaming, subgraph events, UI messages, message metadata, interrupts, and end-to-end cancellation against a LangGraph Cloud server (local via LangGraph Studio, or hosted via LangSmith).

Prefer [langchain.md](./langchain.md) (`useStreamRuntime`, the `create-assistant-ui -t langchain` template) when your app already uses `@langchain/react`'s `useStream` elsewhere, or when you want to read arbitrary custom state keys reactively; the two are at feature parity, and this page's raw-SDK adapter is the choice for a fully custom stream or an existing `react-langgraph` app.

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Streaming](#streaming) | [Agent state](#agent-state) | [Interrupts and message editing](#interrupts-and-message-editing) | [Threads](#threads)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/react-langgraph @langchain/langgraph-sdk
```

Requires a `messages` key with LangChain-alike messages in the graph state.

## Quickstart

```sh
npx create-assistant-ui@latest -t langchain my-app   # ships react-langchain; see langchain.md
```

For the raw-SDK adapter, build the client helper and runtime manually:

```ts title="lib/chatApi.ts"
import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl =
    process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"] ||
    (typeof window !== "undefined" ? new URL("/api", window.location.href).href : "/api");
  return new Client({ apiUrl });
};
```

```tsx title="components/MyAssistant.tsx"
"use client";

import { useMemo } from "react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  unstable_createLangGraphStream,
  useLangGraphRuntime,
  type LangChainMessage,
} from "@assistant-ui/react-langgraph";
import { createClient } from "@/lib/chatApi";

const ASSISTANT_ID = process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!;

export function MyAssistant() {
  const client = useMemo(() => createClient(), []);
  const stream = useMemo(
    () => unstable_createLangGraphStream({ client, assistantId: ASSISTANT_ID }),
    [client],
  );

  const runtime = useLangGraphRuntime({
    unstable_allowCancellation: true,
    stream,
    create: async () => {
      const { thread_id } = await client.threads.create();
      return { externalId: thread_id };
    },
    load: async (externalId) => {
      const state = await client.threads.getState<{ messages: LangChainMessage[] }>(externalId);
      return { messages: state.values.messages, interrupts: state.tasks[0]?.interrupts };
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

```sh title=".env.local"
NEXT_PUBLIC_LANGGRAPH_API_URL=your_api_url
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_graph_id
```

For production, proxy through your own backend rather than exposing `LANGCHAIN_API_KEY` to the client; forward the path and strip hop-by-hop headers, and drop `NEXT_PUBLIC_LANGGRAPH_API_URL` once the proxy route exists so the client helper falls back to same-origin `/api`.

## Streaming

`LangGraphMessageAccumulator` replicates the server's messages state client-side:

```ts
import { LangGraphMessageAccumulator, appendLangChainChunk } from "@assistant-ui/react-langgraph";

const accumulator = new LangGraphMessageAccumulator({ appendMessage: appendLangChainChunk });
if (event.event === "messages/partial") accumulator.addMessages(event.data);
```

`convertLangChainMessages` transforms a LangChain message into assistant-ui's format for a custom adapter or a render outside the runtime.

Pass `eventHandlers` to `useLangGraphRuntime` for the full event surface: `onMessageChunk`, `onValues`, `onUpdates`, `onSubgraphValues(namespace, values)`, `onSubgraphUpdates(namespace, updates)`, `onMetadata`, `onInfo`, `onError`, `onSubgraphError(namespace, error)`, `onCustomEvent(type, data)`. A pipe-namespaced chunk from a subgraph (`messages|tools:call_abc`) carries the suffix on `metadata.namespace`.

With `streamMode: "messages-tuple"`, read accumulated per-message metadata with `useLangGraphMessageMetadata()` (a `Map<string, LangGraphTupleMetadata>` keyed by message id).

Generative UI (`push_ui_message` / `typedUi().push()`) becomes `DataMessagePart`s on the assistant message, rendered with `makeAssistantDataUI`; see [generative-ui](../../generative-ui/SKILL.md).

Set `unstable_enableMessageQueue: true` to keep the composer usable during a run; a message sent while streaming steers by default (lands ahead of queued items), or queues behind them with `send({ steer: false })`. Render pending items with `ComposerPrimitive.Queue` and `QueueItemPrimitive` (see [primitives](../../primitives/SKILL.md)).

A message's `runConfig` is forwarded to `stream` and, through `unstable_createLangGraphStream`, posted as the run's `config`. Automatic tool-result resumes and `useLangGraphSendCommand` reuse the `runConfig` that produced the pending call; an explicit `runConfig` on `useLangGraphSend` wins.

## Agent state

`useLangGraphState<T>()` mirrors the graph's `values` object live; `useLangGraphSetState<T>()` stages an optimistic local update merged into the **next** run's `input` (not a live channel into an in-flight run). Both require `streamMode` to include `"values"`, which is not in the default stream modes:

```ts
const stream = unstable_createLangGraphStream({
  client,
  assistantId: ASSISTANT_ID,
  streamMode: ["messages", "updates", "custom", "values"],
});
```

```tsx
import { useLangGraphState, useLangGraphSetState } from "@assistant-ui/react-langgraph";

type GraphState = { filters: { region: string; maxResults: number } };

const state = useLangGraphState<GraphState>();
const setState = useLangGraphSetState<GraphState>();
setState((prev) => ({ ...prev, filters: { region: "eu", maxResults: prev?.filters.maxResults ?? 10 } }));
```

A custom `stream` callback must forward the staged update itself, from `config.state`:

```ts
stream: async (messages, { initialize, ...config }) => {
  const { externalId } = await initialize();
  return client.runs.stream(externalId, ASSISTANT_ID, {
    input: { ...(config.state ?? {}), messages },
    streamMode: ["messages", "updates", "custom", "values"],
  });
};
```

Keep this distinct from `useAuiState` (assistant-ui's own client state: messages, composer, thread status) and your own app state; use `useLangGraphState`/`useLangGraphSetState` only for fields the graph's state schema owns.

## Interrupts and message editing

Return `interrupts` alongside `messages` from `load`; the runtime restores them automatically when switching threads:

```ts
load: async (externalId) => {
  const state = await getThreadState(externalId);
  return { messages: state.values.messages, interrupts: state.tasks[0]?.interrupts };
};
```

Message editing and regenerate buttons appear only once you provide `getCheckpointId`, since LangGraph forks server-side checkpoints and truncating client-side messages without one would produce incorrect state:

```ts
const runtime = useLangGraphRuntime({
  stream,
  create,
  load,
  getCheckpointId: async (threadId, parentMessages) => {
    const history = await createClient().threads.getHistory(threadId);
    for (const state of history) {
      const stateMessages = state.values.messages;
      if (stateMessages?.length !== parentMessages.length) continue;
      const hasStableIds =
        parentMessages.every((m) => typeof m.id === "string") &&
        stateMessages.every((m) => typeof m.id === "string");
      if (!hasStableIds) continue;
      if (parentMessages.every((m, i) => m.id === stateMessages[i]?.id)) {
        return state.checkpoint.checkpoint_id ?? null;
      }
    }
    return null;
  },
});
```

The resolved id reaches `stream` as `config.checkpointId`; map it to the LangGraph SDK's `checkpoint_id` parameter.

## Threads

`useLangGraphRuntime` follows the same three-path thread model as every runtime (see [runtime](../../runtime/SKILL.md)): basic `create`/`load` as shown above, an `AssistantCloud` instance passed as `cloud` for managed persistence and titles, or `unstable_threadListAdapter` (a `RemoteThreadListAdapter`) to surface pre-existing `thread_id`s without assistant-cloud. When `unstable_threadListAdapter` is set, `cloud`, `create`, and `delete` are ignored; the adapter owns the thread-list lifecycle. Set `remoteId === externalId` so the ids assistant-ui stores line up with the LangGraph thread ids your `load`/`stream` callbacks receive.
