---
name: integrations
description: Guide for integrating assistant-ui with backends - AI SDK, LangGraph, custom APIs. Use when setting up backend connections or switching providers.
version: 0.0.1
license: MIT
---

# assistant-ui Integrations

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Connect assistant-ui to various AI backends.

## References

- [./references/ai-sdk.md](./references/ai-sdk.md) -- Vercel AI SDK v6 integration
- [./references/langgraph.md](./references/langgraph.md) -- LangGraph agent integration
- [./references/cloud.md](./references/cloud.md) -- Cloud persistence setup
- [./references/custom-backend.md](./references/custom-backend.md) -- Custom backend patterns

## Integration Decision Tree

```
What's your backend?
├─ Vercel AI SDK
│  └─ useChatRuntime (recommended)
├─ LangGraph
│  └─ useLangGraphRuntime
├─ Custom API
│  ├─ External state management?
│  │  └─ Yes → useExternalStoreRuntime
│  └─ No → useLocalRuntime
└─ Multiple backends
   └─ Switch between runtimes dynamically
```

## AI SDK v6 (Recommended)

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk @ai-sdk/react ai
```

### Frontend

```tsx
import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

function Chat() {
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

### Backend

```ts
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## LangGraph

```bash
npm install @assistant-ui/react @assistant-ui/react-langgraph
```

```tsx
import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ apiUrl: "http://localhost:8123" });

function Chat() {
  const runtime = useLangGraphRuntime({
    threadId: "my-thread",
    stream: async function* (messages) {
      const stream = client.runs.stream(
        "my-thread",
        "my-assistant",
        { input: { messages } }
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

## Provider Quick Reference

### OpenAI

```ts
import { openai } from "@ai-sdk/openai";
const result = streamText({
  model: openai("gpt-4o"),
  messages,
});
```

### Anthropic (Claude)

```ts
import { anthropic } from "@ai-sdk/anthropic";
const result = streamText({
  model: anthropic("claude-sonnet-4-20250514"),
  messages,
});
```

### Google (Gemini)

```ts
import { google } from "@ai-sdk/google";
const result = streamText({
  model: google("gemini-2.0-flash"),
  messages,
});
```

### AWS Bedrock

```ts
import { bedrock } from "@ai-sdk/amazon-bedrock";
const result = streamText({
  model: bedrock("anthropic.claude-3-sonnet-20240229-v1:0"),
  messages,
});
```

## Custom Backend

### Using useLocalRuntime

```tsx
import { useLocalRuntime } from "@assistant-ui/react";

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        yield { type: "text-delta", textDelta: decoder.decode(value) };
      }
    },
  },
});
```

### Using useExternalStoreRuntime

```tsx
import { useExternalStoreRuntime } from "@assistant-ui/react";

const runtime = useExternalStoreRuntime({
  messages,       // Your message array
  isRunning,      // Generation state
  onNew: async (message) => {
    await sendToBackend(message);
  },
  onEdit: async (message) => {
    await updateInBackend(message);
  },
  onReload: async (parentId) => {
    await regenerateFrom(parentId);
  },
});
```

## With Cloud Persistence

```tsx
import { AssistantCloud } from "assistant-cloud";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function Chat() {
  const runtime = useChatRuntime({
    api: "/api/chat",
    cloud,  // Enables thread persistence
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />  {/* Shows saved threads */}
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Multiple Providers

```tsx
function Chat({ provider }: { provider: "openai" | "anthropic" | "local" }) {
  const runtime = useChatRuntime({
    api: `/api/chat/${provider}`,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Common Options

### useChatRuntime

```tsx
const runtime = useChatRuntime({
  api: "/api/chat",             // Required
  headers: { "X-API-Key": key },// Custom headers
  body: { model: "gpt-4o" },    // Extra body params
  initialMessages: [],          // Pre-populated
  onError: (err) => {},         // Error handler
  cloud: cloudInstance,         // Cloud persistence
});
```

### useLocalRuntime

```tsx
const runtime = useLocalRuntime({
  model: {
    run: async function* ({ messages, abortSignal }) {
      // Your implementation
    },
  },
  initialMessages: [],
  adapters: {
    attachments: myAttachmentAdapter,
    feedback: myFeedbackAdapter,
  },
});
```

## Environment Variables

```env
# .env.local
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

# For cloud
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://api.assistant-ui.com
```

## Common Gotchas

**"Module not found: @ai-sdk/react"**
```bash
npm install @ai-sdk/react
```

**Streaming not working**
- Verify `toDataStreamResponse()` is used
- Check Content-Type header
- Look for CORS errors

**Different message format**
- Use `convertMessage` option in `useExternalStoreRuntime`
- Or transform messages in your API route
