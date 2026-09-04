# LangChain Runtime (`useStream`)

`@assistant-ui/react-langchain` wraps [`useStream`](https://reference.langchain.com/javascript/langchain-react/use-stream) from `@langchain/react` as an assistant-ui runtime. It targets the same LangGraph Cloud backend as [langgraph.md](./langgraph.md) at a higher level, delegating stream plumbing to the upstream hook; it is the adapter the `-t langchain` template scaffolds.

Pick this over `react-langgraph` when your app already uses `useStream` elsewhere, you want to read custom state keys reactively (`useLangChainState<T>(key)`), or you want the thinner wrapper pinned to upstream behavior. Pick `react-langgraph` for a fully custom backend stream or an existing `react-langgraph` app. Both are first-class and at feature parity; see the [comparison](#comparison-with-react-langgraph) below.

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Options](#usestreamruntime-options) | [Custom state keys](#reading-custom-state-keys) | [Interrupts](#interrupts) | [Tool calls](#tool-calls) | [Subagents](#subagent-and-subgraph-discovery) | [Generative UI](#generative-ui) | [Comparison](#comparison-with-react-langgraph)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/react-langchain @langchain/react @langchain/langgraph-sdk
```

Requires a `messages` key with LangChain-alike messages in the graph state (or pass `messagesKey`).

## Quickstart

```sh
npx create-assistant-ui@latest -t langchain my-app
```

Manual setup:

```tsx title="components/MyAssistant.tsx"
"use client";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useStreamRuntime } from "@assistant-ui/react-langchain";

export function MyAssistant() {
  const runtime = useStreamRuntime({
    assistantId: process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    apiUrl: process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"],
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

```sh title=".env.local"
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_graph_id
```

`thread.isLoading` reflects `useStream`'s `isThreadLoading` (initial history hydration), distinct from `isRunning` (a run in flight).

## `useStreamRuntime` options

Accepts every upstream `useStream` option plus:

| Option | Type | Description |
| --- | --- | --- |
| `cloud` | `AssistantCloud` | Persists threads via assistant-cloud |
| `adapters` | `{ attachments?, speech?, feedback? }` | Standard adapter slots |
| `messagesKey` | `string` | State key holding messages (default `"messages"`) |
| `uiStateKey` | `string` | State key holding generative `UIMessage`s (default `"ui"`) |

A message's `runConfig.custom` is forwarded on `useStream().submit` as `config.configurable`. Automatic tool-result resumes and the interrupt helpers reuse the same recorded `configurable` unless the caller passes `config` explicitly; raw `useLangChainSubmit`/`useLangChainSend` calls starting a new run do not inherit it, and the recording does not survive a reload. Read it in the graph from `config["configurable"]` (LangGraph v1 aliases the same values onto the Runtime `context`).

## Reading custom state keys

`useLangChainState<T>(key, defaultValue?)` mirrors `useStream().values[key]` and updates as the stream emits new state, useful with middleware (like `deepagents`) that writes structured state (`todos`, plans, scratch files) alongside messages:

```tsx
import { useLangChainState } from "@assistant-ui/react-langchain";

type Todo = { id: string; title: string; done: boolean };
const todos = useLangChainState<Todo[]>("todos", []);
```

## Interrupts

`useLangChainInterruptState()` reads the current interrupt; `useLangChainRespond()` resumes it with a payload via `useStream().respond` (no manual `Command` construction needed):

```tsx
import { useLangChainInterruptState, useLangChainRespond } from "@assistant-ui/react-langchain";

const interrupt = useLangChainInterruptState();
const respond = useLangChainRespond();
if (interrupt) respond({ approved: true });
```

Several pending interrupts at once (parallel approvals) must resume together with `useLangChainRespondAll()`; sequential `useLangChainRespond` calls can't, since the first resume starts a run and strands the rest:

```tsx
import { useLangChainInterrupts, useLangChainRespondAll } from "@assistant-ui/react-langchain";

const interrupts = useLangChainInterrupts();
const respondAll = useLangChainRespondAll();
await respondAll(Object.fromEntries(interrupts.flatMap((i) => (i.id ? [[i.id, { approved: true }]] : []))));
```

For a raw `Command`, use `useLangChainSubmit(null, { command })`.

## Tool calls

`useLangChainToolCalls()` returns the root tool calls `useStream` assembles from the `tools` channel (`{ name, args, id }[]`, defaults to `[]`).

## Subagent and subgraph discovery

`useLangChainSubagents()` / `useLangChainSubgraphs()` return namespace-keyed discovery maps (`SubagentDiscoverySnapshot` / `SubgraphDiscoverySnapshot`), replacing `react-langgraph`'s subgraph `eventHandlers`. Pair the `useLangChainStream()` handle (`undefined` outside the provider) with upstream's scoped `useMessages(stream, target)` / `useToolCalls(stream, target)` to render a subagent's own transcript:

```tsx
import { useLangChainStream, useLangChainSubagents } from "@assistant-ui/react-langchain";
import { useMessages, useToolCalls } from "@langchain/react";

const stream = useLangChainStream();
const subagents = useLangChainSubagents();
// [...subagents.values()].map((s) => useMessages(stream, s)) per card
```

`useMessageMetadata(stream, messageId)` (from `@langchain/react`) reads per-message metadata; guard the stream first, since it throws on `undefined`. The v1 media hooks (`useImages`, `useAudio`, `useVideo`, `useFiles`) take the same `useLangChainStream()` handle.

## Generative UI

Graphs accumulate UI components in state (`stream.values[uiStateKey]`, default `"ui"`) and attach each to the assistant message whose id matches the `UIMessage`'s parent id. Register renderers with `makeAssistantDataUI` (see [generative-ui](../../generative-ui/SKILL.md)) and mount them once inside the provider. This covers both a state-snapshot path (whatever the graph committed) and a live path (`push_ui_message` streamed over the `custom` channel, which requires `streamMode` to include `"custom"`); the state snapshot is authoritative once a UI lands there.

## Comparison with `react-langgraph`

| Aspect | `react-langgraph` | `react-langchain` |
| --- | --- | --- |
| Wraps | `@langchain/langgraph-sdk` (raw SDK) | `@langchain/react` (`useStream`) |
| `create-assistant-ui` template | No template | `-t langchain` |
| Regenerate | `getCheckpointId` (user-supplied) | Auto-resolved via checkpoint/history match |
| Custom state key | No | `useLangChainState<T>(key)` |
| Subgraph events | `eventHandlers` (namespace callbacks) | `useLangChainSubagents`/`useLangChainSubgraphs` (discovery maps) + view hooks |
| Cancellation | `unstable_createLangGraphStream` primitive | `useStream().stop()` (Cancel button by default) |
| Message accumulator | `LangGraphMessageAccumulator` | `useStream` owns accumulation |

Editing forks from the message's checkpoint and resubmits the edited content; editing the first message forks from the thread's initial checkpoint. Regenerate resolves the checkpoint to fork from (the one each message recorded while streaming, falling back to a thread history id match for older turns) and degrades to a no-op when none resolves.

## Related Skills

- [langgraph.md](./langgraph.md) -- the raw-SDK adapter this one wraps at a higher level
- [../../runtime/SKILL.md](../../runtime/SKILL.md) -- `ExternalStoreRuntime`, the core both adapters build on
