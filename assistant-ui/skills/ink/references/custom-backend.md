# Custom backend

An Ink process can call any reachable HTTP service. Choose whether the service owns only inference, local disk owns persistence, or the service owns thread metadata too. These are distinct boundaries.

## Inference through a chat adapter

`useLocalRuntime` needs a `ChatModelAdapter`. Its `run` generator receives messages and an abort signal, then yields progressively fuller assistant content. This suits a terminal specific protocol or an existing service that does not speak the AI SDK UI message stream.

```ts
import type { ChatModelAdapter } from "@assistant-ui/react-ink";

export const chatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const response = await fetch("https://api.example.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected a streaming response.");
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      yield { content: [{ type: "text", text }] };
    }
  },
};
```

This leaves thread metadata and messages in process memory. It is the simplest choice for one run of a CLI. Respect `abortSignal` so `ComposerPrimitive.Cancel` can stop the request.

## AI SDK transport

When the service already exposes an AI SDK v7 UI message stream, prefer `useChatRuntime` and `AssistantChatTransport`. The client needs an absolute endpoint URL because Ink has no browser origin.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react-ink";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";

const api = "https://api.example.com/api/chat";

export function Runtime({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api }),
  });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

The transport forwards system messages and frontend tools to the backend. Consume those with `frontendTools` in the AI SDK route when terminal tools must be callable by the model.

## Backend owned thread metadata

Implement `RemoteThreadListAdapter` with `list`, `initialize`, `rename`, `archive`, `unarchive`, `delete`, `fetch`, and `generateTitle`. It maps remote ids and statuses to assistant-ui's thread list. Use it with `useRemoteThreadListRuntime`, whose local runtime hook remains responsible for the current thread's message runtime.

```tsx
import {
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react-ink";

export function useAppRuntime() {
  return useRemoteThreadListRuntime({
    runtimeHook: () => useLocalRuntime(chatAdapter),
    adapter: remoteThreadListAdapter,
  });
}
```

`list` returns regular and archived thread records. `initialize(localId)` creates a server record and returns its `remoteId`. `rename`, archive actions, and `delete` persist user actions. `fetch` retrieves one record. `generateTitle(remoteId, unstable_messages)` returns an assistant stream with the resulting title.

Remote metadata persistence does not automatically replace local message storage. Add a thread history adapter or hydrate the per thread runtime from your service when the service must own the full transcript.

## Storage decision

- Use `ChatModelAdapter` when only inference crosses the network.
- Use `createFileStorageAdapter` when one terminal process needs durable local transcripts.
- Use `RemoteThreadListAdapter` when users, sessions, or concurrent processes need shared thread metadata.

The file adapter is not a multi process database. Do not point several active CLIs at the same directory and expect conflict free metadata updates.
