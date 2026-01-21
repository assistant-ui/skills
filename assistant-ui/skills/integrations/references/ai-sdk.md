# AI SDK Integration

Vercel AI SDK v6 integration with assistant-ui.

## Installation

```bash
npm install @assistant-ui/react @assistant-ui/react-ai-sdk @ai-sdk/react ai
npm install @ai-sdk/openai  # or your preferred provider
```

## Basic Setup

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
    system: "You are a helpful assistant.",
    messages,
  });

  return result.toDataStreamResponse();
}
```

## useChatRuntime Options

```tsx
const runtime = useChatRuntime({
  // Required
  api: "/api/chat",

  // Request customization
  headers: {
    "Authorization": `Bearer ${token}`,
    "X-Custom-Header": "value",
  },
  body: {
    model: "gpt-4o",
    temperature: 0.7,
  },

  // Initial state
  initialMessages: [
    { role: "assistant", content: "Hello! How can I help?" },
  ],

  // Callbacks
  onError: (error) => {
    console.error("Chat error:", error);
    toast.error("Failed to send message");
  },

  // Cloud persistence
  cloud: assistantCloud,

  // Custom adapters
  adapters: {
    attachments: myAttachmentAdapter,
    feedback: myFeedbackAdapter,
  },
});
```

## With Tools

### Backend

```ts
import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";

const tools = {
  search: tool({
    description: "Search the web for information",
    parameters: z.object({
      query: z.string().describe("Search query"),
      limit: z.number().optional().default(5),
    }),
    execute: async ({ query, limit }) => {
      const results = await searchAPI(query, limit);
      return { results };
    },
  }),
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages,
    tools,
    maxSteps: 5,  // Allow multi-step tool use
  });

  return result.toDataStreamResponse();
}
```

### Frontend Tool UI

```tsx
import { makeAssistantToolUI } from "@assistant-ui/react";

const SearchToolUI = makeAssistantToolUI({
  toolName: "search",
  render: ({ args, result, status }) => (
    <div className="border rounded p-4">
      <div>Searching: {args.query}</div>
      {status === "running" && <Spinner />}
      {status === "complete" && (
        <ul>
          {result?.results?.map((r: any) => (
            <li key={r.url}>{r.title}</li>
          ))}
        </ul>
      )}
    </div>
  ),
});

// Register
<AssistantRuntimeProvider runtime={runtime}>
  <SearchToolUI />
  <Thread />
</AssistantRuntimeProvider>
```

## Supported Providers

### OpenAI

```ts
import { openai } from "@ai-sdk/openai";

streamText({
  model: openai("gpt-4o"),
  // or openai("gpt-4o-mini"), openai("o1-preview")
  messages,
});
```

### Anthropic

```ts
import { anthropic } from "@ai-sdk/anthropic";

streamText({
  model: anthropic("claude-sonnet-4-20250514"),
  // or anthropic("claude-3-5-haiku-20241022")
  messages,
});
```

### Google

```ts
import { google } from "@ai-sdk/google";

streamText({
  model: google("gemini-2.0-flash"),
  messages,
});
```

### AWS Bedrock

```ts
import { bedrock } from "@ai-sdk/amazon-bedrock";

streamText({
  model: bedrock("anthropic.claude-3-sonnet-20240229-v1:0"),
  messages,
});
```

### Azure OpenAI

```ts
import { azure } from "@ai-sdk/azure";

streamText({
  model: azure("gpt-4o"),  // Your deployment name
  messages,
});
```

## Advanced Configuration

### System Prompt

```ts
streamText({
  model: openai("gpt-4o"),
  system: "You are a helpful assistant specialized in coding.",
  messages,
});
```

### Temperature and Max Tokens

```ts
streamText({
  model: openai("gpt-4o"),
  messages,
  temperature: 0.7,
  maxTokens: 1000,
});
```

### Stop Sequences

```ts
streamText({
  model: openai("gpt-4o"),
  messages,
  stopSequences: ["END", "STOP"],
});
```

## Structured Output

```ts
import { z } from "zod";
import { generateObject } from "ai";

const result = await generateObject({
  model: openai("gpt-4o"),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    hobbies: z.array(z.string()),
  }),
  prompt: "Generate a user profile",
});
```

## Error Handling

```tsx
const runtime = useChatRuntime({
  api: "/api/chat",
  onError: (error) => {
    if (error.message.includes("rate limit")) {
      toast.error("Too many requests. Please wait.");
    } else if (error.message.includes("context length")) {
      toast.error("Conversation too long. Try starting a new chat.");
    } else {
      toast.error("Something went wrong. Please try again.");
    }
  },
});
```

## With Authentication

```tsx
import { useSession } from "next-auth/react";

function Chat() {
  const { data: session } = useSession();

  const runtime = useChatRuntime({
    api: "/api/chat",
    headers: {
      Authorization: `Bearer ${session?.accessToken}`,
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Dynamic API Selection

```tsx
function Chat({ model }: { model: string }) {
  const runtime = useChatRuntime({
    api: "/api/chat",
    body: { model },  // Pass model to API
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

// Backend handles model selection
export async function POST(req: Request) {
  const { messages, model } = await req.json();

  const provider = model.startsWith("claude")
    ? anthropic(model)
    : openai(model);

  const result = streamText({ model: provider, messages });
  return result.toDataStreamResponse();
}
```
