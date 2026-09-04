# Multi-agent tool calls

In an orchestrator architecture a main agent invokes sub-agents through tool calls, and each sub-agent produces its own conversation. When a tool call carries a `messages` field, `ToolCallMessagePart.messages`, that field is the sub-agent's history; `MessagePartPrimitive.Messages` reads it from the current tool-call part and renders it as a nested thread.

Three properties follow: scope inheritance, so a toolkit registered at the top level also serves renderers inside sub-agent messages; recursion, so a nested tool call with its own `messages` uses the same primitive again; and read-only rendering, with no editing, branching, or composing inside the nested thread.

To visualize a sub-agent's execution trace instead of its messages, meaning timing, span hierarchy, and waterfalls, use the [observability skill](../../observability/SKILL.md).

## Render the sub-agent conversation

```tsx
import {
  defineToolkit,
  MessagePartPrimitive,
} from "@assistant-ui/react";

const toolkit = defineToolkit({
  invoke_researcher: {
    type: "backend",
    render: ({ status }) => (
      <div>
        <div>Researcher agent {status.type === "running" && "(working)"}</div>
        <MessagePartPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? <MyUserMessage /> : <MyAssistantMessage />
          }
        </MessagePartPrimitive.Messages>
      </div>
    ),
  },
});
```

Register the toolkit as usual with `const config = AuiConfig({ tools: Tools({ toolkit }) })` on the provider.

## Populate messages from the backend

**AI SDK.** Return the sub-agent history from the tool's `execute`, alongside whatever summary the model should read.

```ts title="app/api/chat/route.ts"
invoke_researcher: tool({
  description: "Invoke the researcher sub-agent",
  inputSchema: zodSchema(z.object({ query: z.string() })),
  execute: async ({ query }) => {
    const subAgentMessages = await runResearcherAgent(query);
    return {
      answer: subAgentMessages.at(-1)?.content,
      messages: subAgentMessages,
    };
  },
}),
```

**LangGraph.** A subgraph's messages land on `ToolCallMessagePart.messages` once you handle the subgraph events. Stream `updates` for them and `custom` for generative UI, and read the `namespace` argument to attribute events to a sub-agent: `onSubgraphValues`, `onSubgraphUpdates`, `onSubgraphError`, and the `metadata.namespace` on `onMessageChunk`.

**AG-UI.** There is no `messages` field to populate. The backend emits `SUBAGENT_STARTED` naming the spawning call as `parentToolCallId`, tags every event that sub-agent produces with its `subagentRunId`, and closes with `SUBAGENT_FINISHED` or `SUBAGENT_ERROR`; the runtime groups each run into one nested assistant message and attaches it to that call. The sub-agent's `name`, `description`, `result`, `interruptIds`, and `errorCode` ride on the nested message's `metadata.custom.agui`. A run whose `parentToolCallId` names no reachable call renders in the parent thread instead.

## Recursive sub-agents

A nested tool call renders its own `MessagePartPrimitive.Messages` inside a `MessagePrimitive.Parts` render function.

```tsx
render: () => (
  <MessagePartPrimitive.Messages>
    {({ message }) => {
      if (message.role === "user") return <MyUserMessage />;
      return (
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") return <MyText />;
            if (part.type === "tool-call" && part.toolName === "invoke_researcher") {
              return (
                <MessagePartPrimitive.Messages>
                  {({ message: nested }) =>
                    nested.role === "user" ? <MyUserMessage /> : <MyAssistantMessage />
                  }
                </MessagePartPrimitive.Messages>
              );
            }
            if (part.type === "tool-call") return part.toolUI ?? null;
            return null;
          }}
        </MessagePrimitive.Parts>
      );
    }}
  </MessagePartPrimitive.Messages>
),
```

## Rendering a message array outside a tool call

`ReadonlyThreadProvider` renders a `ThreadMessage[]` as a thread anywhere, inheriting the parent's tool UI registrations and model context through scope inheritance.

```tsx
import {
  ReadonlyThreadProvider,
  ThreadPrimitive,
  type ThreadMessage,
} from "@assistant-ui/react";

function SubConversation({ messages }: { messages: readonly ThreadMessage[] }) {
  return (
    <ReadonlyThreadProvider messages={messages}>
      <ThreadPrimitive.Messages>
        {({ message }) =>
          message.role === "user" ? <MyUserMessage /> : <MyAssistantMessage />
        }
      </ThreadPrimitive.Messages>
    </ReadonlyThreadProvider>
  );
}
```
