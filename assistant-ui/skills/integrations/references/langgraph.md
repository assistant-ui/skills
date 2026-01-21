# LangGraph Integration

Connect assistant-ui to LangGraph Python agents.

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-langgraph
```

## Basic Setup

```tsx
import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

function Chat() {
  const runtime = useLangGraphRuntime({
    threadId: "my-thread",
    stream: async function* (messages, config) {
      const response = await fetch("/api/langgraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, config }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse and yield LangGraph events
        const text = decoder.decode(value);
        for (const event of parseLangGraphEvents(text)) {
          yield event;
        }
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## With LangGraph SDK

```tsx
import { Client } from "@langchain/langgraph-sdk";
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";

const client = new Client({
  apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:8123",
});

function Chat() {
  const [threadId, setThreadId] = useState<string | null>(null);

  const runtime = useLangGraphRuntime({
    threadId,
    stream: async function* (messages) {
      // Create thread if needed
      let currentThreadId = threadId;
      if (!currentThreadId) {
        const thread = await client.threads.create();
        currentThreadId = thread.thread_id;
        setThreadId(currentThreadId);
      }

      // Stream from LangGraph
      const stream = client.runs.stream(
        currentThreadId,
        "my-assistant",
        {
          input: { messages },
          streamMode: "events",
        }
      );

      for await (const event of stream) {
        yield event;
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## useLangGraphRuntime Options

```tsx
const runtime = useLangGraphRuntime({
  // Thread identifier
  threadId: string | undefined,

  // Streaming function (required)
  stream: async function* (
    messages: ThreadMessage[],
    config?: LangGraphConfig
  ): AsyncGenerator<LangGraphEvent>,

  // Message conversion
  convertMessage?: (message: ThreadMessage) => LangGraphMessage,

  // Adapters
  adapters?: {
    attachments?: AttachmentAdapter,
    feedback?: FeedbackAdapter,
  },
});
```

## Python Backend

### Simple Agent

```python
# agent.py
from langgraph.graph import StateGraph, MessagesState
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")

def chat_node(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}

graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.set_entry_point("chat")
graph.set_finish_point("chat")

app = graph.compile()
```

### With Tools

```python
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """Search the web for information."""
    # Your search implementation
    return "Search results..."

tools = [search]
model = ChatOpenAI(model="gpt-4o").bind_tools(tools)

def agent_node(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}

def tool_node(state: MessagesState):
    # Execute tools
    return {"messages": tool_results}
```

### Running the Server

```bash
langgraph serve --port 8123
```

## Event Handling

LangGraph streams events in a specific format:

```tsx
async function* parseStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = JSON.parse(line.slice(6));

      switch (data.event) {
        case "on_chat_model_stream":
          yield {
            type: "text-delta",
            textDelta: data.data.chunk.content,
          };
          break;

        case "on_tool_start":
          yield {
            type: "tool-call-begin",
            toolCallId: data.run_id,
            toolName: data.name,
          };
          break;

        case "on_tool_end":
          yield {
            type: "tool-result",
            toolCallId: data.run_id,
            result: data.data.output,
          };
          break;
      }
    }
  }
}
```

## Tool UI

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const SearchToolUI = makeAssistantToolUI({
  toolName: "search",
  render: ({ args, result, status }) => {
    if (status === "running") {
      return <div>Searching: {args.query}...</div>;
    }
    return (
      <div>
        <h4>Search Results</h4>
        <p>{result}</p>
      </div>
    );
  },
});
```

## Thread Management

LangGraph handles threads server-side:

```tsx
function ThreadSelector() {
  const [threads, setThreads] = useState([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);

  useEffect(() => {
    client.threads.list().then(setThreads);
  }, []);

  const createThread = async () => {
    const thread = await client.threads.create();
    setCurrentThread(thread.thread_id);
    setThreads((prev) => [thread, ...prev]);
  };

  return (
    <div>
      <button onClick={createThread}>New Thread</button>
      {threads.map((t) => (
        <button
          key={t.thread_id}
          onClick={() => setCurrentThread(t.thread_id)}
          className={t.thread_id === currentThread ? "active" : ""}
        >
          {t.thread_id}
        </button>
      ))}
    </div>
  );
}
```

## Error Handling

```tsx
const runtime = useLangGraphRuntime({
  threadId,
  stream: async function* (messages) {
    try {
      const stream = client.runs.stream(...);
      for await (const event of stream) {
        yield event;
      }
    } catch (error) {
      if (error.status === 429) {
        throw new Error("Rate limited. Please try again.");
      }
      throw error;
    }
  },
});
```
