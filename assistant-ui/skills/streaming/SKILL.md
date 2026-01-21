---
name: streaming
description: Guide for assistant-stream package and streaming protocols. Use when implementing streaming backends, custom protocols, or debugging stream issues.
version: 0.0.1
license: MIT
---

# assistant-ui Streaming

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

The `assistant-stream` package handles streaming from AI backends.

## References

- [./references/data-stream.md](./references/data-stream.md) -- AI SDK data stream format
- [./references/assistant-transport.md](./references/assistant-transport.md) -- Native assistant-ui format
- [./references/encoders.md](./references/encoders.md) -- Encoders and decoders

## Streaming Format Decision

```
Using Vercel AI SDK?
├─ Yes → Data Stream format (toDataStreamResponse)
└─ No
   ├─ Want richest features?
   │  └─ Yes → Assistant Transport format
   └─ Just text?
      └─ Plain Text format
```

## Installation

```bash
npm install assistant-stream
```

## Formats Overview

| Format | Use Case | Features |
|--------|----------|----------|
| Data Stream | AI SDK apps | Tool calls, multi-step |
| Assistant Transport | Custom backends | All features, optimized |
| Plain Text | Simple text | Basic streaming |

## AI SDK Data Stream (Most Common)

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

### Frontend

```tsx
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  api: "/api/chat",
  // Automatically handles Data Stream format
});
```

## Custom Streaming Response

### Using DataStreamEncoder

```ts
import { DataStreamEncoder } from "assistant-stream";

export async function POST(req: Request) {
  const encoder = new DataStreamEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Stream text
      encoder.writeTextDelta("Hello ");
      controller.enqueue(encoder.flush());

      await delay(100);

      encoder.writeTextDelta("world!");
      controller.enqueue(encoder.flush());

      // Complete
      encoder.close();
      controller.enqueue(encoder.flush());
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

## Stream Events

### Text Events

```ts
// Streaming text
{ type: "text-delta", textDelta: "partial text" }

// Completion markers
{ type: "text-created" }
{ type: "text-done", text: "full text" }
```

### Tool Call Events

```ts
// Tool call lifecycle
{ type: "tool-call-begin", toolCallId: "1", toolName: "search" }
{ type: "tool-call-delta", toolCallId: "1", argsTextDelta: '{"query":' }
{ type: "tool-call-delta", toolCallId: "1", argsTextDelta: '"NYC"}' }
{ type: "tool-call-done", toolCallId: "1", args: { query: "NYC" } }

// Tool result
{ type: "tool-result", toolCallId: "1", result: { ... } }
```

### Control Events

```ts
{ type: "error", error: "Error message" }
{ type: "finish", finishReason: "stop" }  // or "length", "tool-calls"
```

## AssistantStream Class

Core streaming abstraction:

```ts
import { AssistantStream } from "assistant-stream";

// From async generator
const stream = AssistantStream.fromAsyncIterable(async function* () {
  yield { type: "text-delta", textDelta: "Hello " };
  yield { type: "text-delta", textDelta: "world!" };
});

// From ReadableStream
const stream = AssistantStream.fromReadableStream(responseStream);

// From Response
const stream = AssistantStream.fromResponse(response);

// Consume
for await (const event of stream) {
  console.log(event);
}
```

## Using with useLocalRuntime

```tsx
import { useLocalRuntime } from "@assistant-ui/react";
import { AssistantStream } from "assistant-stream";

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const stream = AssistantStream.fromResponse(response);

      for await (const event of stream) {
        yield event;
      }
    },
  },
});
```

## Tool Handling

```ts
import { Tool } from "assistant-stream";
import { z } from "zod";

const weatherTool = new Tool({
  name: "get_weather",
  description: "Get weather for a city",
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    return { temperature: 22, unit: "celsius" };
  },
});

// Use in streaming context
const stream = AssistantStream.fromAsyncIterable(async function* () {
  // Tool call
  yield { type: "tool-call-begin", toolCallId: "1", toolName: "get_weather" };
  yield { type: "tool-call-delta", toolCallId: "1", argsTextDelta: '{"city":"NYC"}' };
  yield { type: "tool-call-done", toolCallId: "1", args: { city: "NYC" } };

  // Execute and yield result
  const result = await weatherTool.execute({ city: "NYC" });
  yield { type: "tool-result", toolCallId: "1", result };

  // Continue with response
  yield { type: "text-delta", textDelta: "The weather in NYC is 22°C" };
});
```

## Debugging Streams

### Log All Events

```ts
const stream = AssistantStream.fromResponse(response);

for await (const event of stream) {
  console.log("Event:", JSON.stringify(event, null, 2));
}
```

### Check Stream Format

```ts
const response = await fetch("/api/chat", { ... });
const text = await response.text();
console.log("Raw response:", text);
```

### Common Response Headers

```ts
// Correct headers for streaming
headers: {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
}
```

## Common Gotchas

**Stream not updating UI**
- Check Content-Type is `text/event-stream`
- Verify encoder/decoder format match
- Check for CORS errors in browser console

**Tool calls not rendering**
- Ensure `tool-call-begin` includes `toolCallId` and `toolName`
- Register tool UI with `makeAssistantToolUI`
- Check tool name matches exactly

**Partial text not showing**
- Use `text-delta` events for streaming
- `text-done` is only for final text

**Stream stops unexpectedly**
- Check server isn't timing out
- Verify `abortSignal` is being handled
- Look for unhandled errors in server logs
