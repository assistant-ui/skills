# Custom Backend: LocalRuntime and ExternalStoreRuntime

Four building blocks cover any backend with no dedicated adapter; all four are built on one of two core runtimes (see [runtime](../../runtime/SKILL.md) for the full architecture).

## Contents

- [Decision tree](#decision-tree) | [LocalRuntime](#localruntime) | [ExternalStoreRuntime](#externalstoreruntime)

## Decision tree

| Path | Layered on | Wire shape | Choose when |
| --- | --- | --- | --- |
| `useLocalRuntime` | Core | You write a `ChatModelAdapter.run` function | Simplest case: a `fetch` call, runtime owns state |
| `useExternalStoreRuntime` | Core | You provide messages + callbacks | State already lives in redux, zustand, tanstack-query, or your own store |
| `useDataStreamRuntime` | `LocalRuntime` + protocol | Backend emits the data stream protocol | A thin message-stream contract, or migrating from AI SDK v4 (see [ai-sdk-legacy.md](./ai-sdk-legacy.md)) |
| `useAssistantTransportRuntime` | `ExternalStoreRuntime` + protocol | Backend streams full agent-state snapshots | Rich internal agent state, or bidirectional commands |

```text
have an AI SDK / LangGraph / Google ADK / A2A / AG-UI / Eve / OpenCode backend?
  yes -> use that adapter instead (see SKILL.md's pick-a-runtime table)
  no  -> already have message state in redux / zustand / tanstack-query?
           yes -> ExternalStoreRuntime
           no  -> control the backend wire format?
                    yes, want simple fetch calls   -> LocalRuntime
                    yes, want to stream agent state -> AssistantTransport (see ../../streaming/SKILL.md)
                    no, backend speaks data stream  -> DataStream (see ../../streaming/SKILL.md)
```

The data stream and assistant transport protocols are documented in depth in [../../streaming/SKILL.md](../../streaming/SKILL.md); this page covers only the two core runtimes.

## LocalRuntime

Implement one method (`run`, or `async *run` for streaming). Branching, editing, regeneration, multi-thread, and every adapter slot work without extra code.

```tsx
import { useLocalRuntime, AssistantRuntimeProvider, type ChatModelAdapter } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

const modelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortSignal,
    });

    const reader = response.body!.getReader();
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

function Chat() {
  const runtime = useLocalRuntime(modelAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

Each yielded `ChatModelRunResult` is a full snapshot (append-only `content`), not a delta. For an AI SDK UI-message-stream backend, use [ai-sdk.md](./ai-sdk.md)'s `useChatRuntime` instead of hand-rolling this loop.

## ExternalStoreRuntime

You own the message array and provide callbacks per interaction; which UI features turn on follows from which callbacks you provide.

```tsx
import { useState } from "react";
import {
  useExternalStoreRuntime,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  type AppendMessage,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

type MyMessage = { id: string; role: "user" | "assistant"; content: string };

const convertMessage = (message: MyMessage): ThreadMessageLike => ({
  id: message.id,
  role: message.role,
  content: [{ type: "text", text: message.content }],
});

function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<MyMessage[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== "text") throw new Error("Only text messages are supported");
    const userMessage: MyMessage = { id: crypto.randomUUID(), role: "user", content: message.content[0].text };
    setMessages((prev) => [...prev, userMessage]);
    setIsRunning(true);
    try {
      const reply = await fetchReply([...messages, userMessage]);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: reply }]);
    } finally {
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime({ isRunning, messages, convertMessage, onNew });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

`onEdit`, `onReload`, `onCancel`, `onAddToolResult`, and `onRespondToToolApproval` enable editing, regeneration, cancellation, and tool/approval flows the same way; omit a callback to leave that feature unsupported. For a state-tree store instead of a flat array, or streaming updates into `onNew`, see [runtime](../../runtime/SKILL.md).
