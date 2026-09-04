# React Native custom backend

Use a custom backend when the AI SDK UI-message stream is not the app protocol or when your server owns thread metadata. Keep the choice narrow: a `ChatModelAdapter` is enough for custom inference with local threads; add `RemoteThreadListAdapter` only when the backend must own the thread list.

## Local threads with a streaming model adapter

`ChatModelAdapter.run` receives messages and an abort signal, then yields progressively complete assistant message content. The runtime retains thread management, message editing, reload, and branch switching on-device.

```tsx
import type { ChatModelAdapter } from "@assistant-ui/react-native";

export const chatModel: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const response = await fetch("https://api.example.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("The chat response has no body");

    const decoder = new TextDecoder();
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      yield { content: [{ type: "text", text }] };
    }
  },
};
```

Mount it with the local runtime:

```tsx
import { useLocalRuntime } from "@assistant-ui/react-native";
import { chatModel } from "./chat-model";

export function useAppRuntime() {
  return useLocalRuntime(chatModel);
}
```

Use the standard `useChatRuntime` and `AssistantChatTransport` instead when the server already speaks the AI SDK UI-message stream. That path has system-message and frontend-tool forwarding built in.

## Backend-owned thread list

Implement `RemoteThreadListAdapter` to make the backend authoritative for thread metadata. `list()`, `initialize(localId)`, `fetch(remoteId)`, `rename(remoteId, title)`, `archive(remoteId)`, `unarchive(remoteId)`, and `delete(remoteId)` map to regular API requests. `generateTitle(remoteId, unstable_messages)` returns an `AssistantStream` so a generated title can stream back into the runtime.

```tsx
import type { RemoteThreadListAdapter } from "@assistant-ui/react-native";
import { createAssistantStream } from "assistant-stream";

const apiBase = "https://api.example.com";

export const remoteThreads: RemoteThreadListAdapter = {
  async list() {
    const response = await fetch(apiBase + "/threads");
    const threads = await response.json();
    return {
      threads: threads.map((thread: { id: string; title: string; archived: boolean }) => ({
        remoteId: thread.id,
        status: thread.archived ? "archived" : "regular",
        title: thread.title,
      })),
    };
  },
  async initialize(localId) {
    const response = await fetch(apiBase + "/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId }),
    });
    const { id } = await response.json();
    return { remoteId: id, externalId: undefined };
  },
  async fetch(remoteId) {
    const response = await fetch(apiBase + "/threads/" + remoteId);
    const thread = await response.json();
    return {
      remoteId: thread.id,
      status: thread.archived ? "archived" : "regular",
      title: thread.title,
    };
  },
  async rename(remoteId, title) {
    await fetch(apiBase + "/threads/" + remoteId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  },
  async archive(remoteId) {
    await fetch(apiBase + "/threads/" + remoteId + "/archive", { method: "POST" });
  },
  async unarchive(remoteId) {
    await fetch(apiBase + "/threads/" + remoteId + "/unarchive", { method: "POST" });
  },
  async delete(remoteId) {
    await fetch(apiBase + "/threads/" + remoteId, { method: "DELETE" });
  },
  async generateTitle(remoteId, unstable_messages) {
    return createAssistantStream(async (controller) => {
      const response = await fetch(apiBase + "/threads/" + remoteId + "/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: unstable_messages }),
      });
      const { title } = await response.json();
      controller.appendText(title);
    });
  },
};
```

Compose the list around a per-thread runtime. The nested hook is deliberate: it creates the current thread runtime while `useRemoteThreadListRuntime` manages the list and selection.

```tsx
import {
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react-native";
import { chatModel } from "./chat-model";
import { remoteThreads } from "./remote-threads";

export function useAppRuntime() {
  return useRemoteThreadListRuntime({
    runtimeHook: () => useLocalRuntime(chatModel),
    adapter: remoteThreads,
  });
}
```

Message history is independent of remote thread metadata. Add a history adapter when message state must survive restarts or be restored from the backend.
