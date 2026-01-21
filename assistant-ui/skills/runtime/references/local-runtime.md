# useLocalRuntime

In-browser chat with custom model adapter.

## Basic Usage

```tsx
import { useLocalRuntime, AssistantRuntimeProvider, Thread } from "@assistant-ui/react";

function App() {
  const runtime = useLocalRuntime({
    model: {
      async run({ messages, abortSignal }) {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        const data = await response.json();
        return {
          content: [{ type: "text", text: data.text }],
        };
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Streaming Response

Use a generator for streaming:

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        yield { type: "text-delta", textDelta: text };
      }
    },
  },
});
```

## Options

```tsx
interface LocalRuntimeOptions {
  model: ChatModelAdapter;
  initialMessages?: ThreadMessage[];
  adapters?: {
    attachments?: AttachmentAdapter;
    feedback?: FeedbackAdapter;
    speech?: SpeechSynthesisAdapter;
  };
}
```

## ChatModelAdapter

```tsx
interface ChatModelAdapter {
  run(options: ChatModelRunOptions): Promise<ChatModelRunResult> | AsyncGenerator<ChatModelRunResult>;
}

interface ChatModelRunOptions {
  messages: ThreadMessage[];
  abortSignal: AbortSignal;
  config?: Record<string, unknown>;
}

type ChatModelRunResult =
  | ChatModelRunResultFinal
  | ChatModelRunResultStream;

interface ChatModelRunResultFinal {
  content: MessagePart[];
}

// Stream events
type ChatModelRunResultStream =
  | { type: "text-delta"; textDelta: string }
  | { type: "tool-call-begin"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; argsTextDelta: string }
  | { type: "tool-call-done"; toolCallId: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; result: unknown };
```

## With OpenAI Direct

```tsx
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Only for demos
});

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join(""),
        })),
        stream: true,
      });

      for await (const chunk of stream) {
        if (abortSignal.aborted) break;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { type: "text-delta", textDelta: delta };
        }
      }
    },
  },
});
```

## With Tools

```tsx
import { z } from "zod";

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      // ... fetch from your API

      // Stream tool call
      yield { type: "tool-call-begin", toolCallId: "1", toolName: "get_weather" };
      yield { type: "tool-call-delta", toolCallId: "1", argsTextDelta: '{"city":"NYC"}' };
      yield { type: "tool-call-done", toolCallId: "1", args: { city: "NYC" } };

      // Execute tool and yield result
      const result = await getWeather({ city: "NYC" });
      yield { type: "tool-result", toolCallId: "1", result };

      // Continue with text response
      yield { type: "text-delta", textDelta: "The weather in NYC is..." };
    },
  },
});
```

## With Attachments

```tsx
const runtime = useLocalRuntime({
  model: {
    async run({ messages }) {
      // Access attachments from last message
      const lastMessage = messages[messages.length - 1];
      const attachments = lastMessage.attachments || [];

      // Process attachments
      for (const attachment of attachments) {
        if (attachment.type === "image") {
          // Handle image
        }
      }

      return { content: [{ type: "text", text: "Processed" }] };
    },
  },
  adapters: {
    attachments: {
      accept: "image/*,application/pdf",
      async add({ file }) {
        const url = URL.createObjectURL(file);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type.startsWith("image/") ? "image" : "file",
          url,
        };
      },
      async send(attachment) {
        return attachment;
      },
      async remove() {},
    },
  },
});
```

## With Initial Messages

```tsx
const runtime = useLocalRuntime({
  model: { ... },
  initialMessages: [
    {
      id: "1",
      role: "assistant",
      content: [{ type: "text", text: "Hello! How can I help you?" }],
      status: "complete",
      createdAt: new Date(),
    },
  ],
});
```

## Error Handling

```tsx
const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({ messages }),
          signal: abortSignal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // ... process response
      } catch (error) {
        if (error.name === "AbortError") {
          // User cancelled - normal, don't throw
          return;
        }
        throw error; // Re-throw to show error in UI
      }
    },
  },
});
```
