# Data Stream Format

AI SDK compatible streaming format.

## Overview

Data Stream is the format used by Vercel AI SDK's `toDataStreamResponse()`. It's the most common format when using AI SDK.

## Usage

### Server (AI SDK)

```ts
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

### Manual Encoding

```ts
import { DataStreamEncoder } from "assistant-stream";

export async function POST(req: Request) {
  const encoder = new DataStreamEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Text streaming
      encoder.writeTextDelta("Hello ");
      controller.enqueue(encoder.flush());

      encoder.writeTextDelta("world!");
      controller.enqueue(encoder.flush());

      // Finish
      encoder.writeFinish("stop");
      controller.enqueue(encoder.flush());

      encoder.close();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

### Decoding

```ts
import { DataStreamDecoder } from "assistant-stream";

const decoder = new DataStreamDecoder();

for await (const event of decoder.decode(responseStream)) {
  switch (event.type) {
    case "text-delta":
      console.log("Text:", event.textDelta);
      break;
    case "tool-call-begin":
      console.log("Tool call started:", event.toolName);
      break;
    case "tool-result":
      console.log("Tool result:", event.result);
      break;
    case "finish":
      console.log("Done:", event.finishReason);
      break;
  }
}
```

## DataStreamEncoder API

```ts
const encoder = new DataStreamEncoder();

// Text
encoder.writeTextCreated();
encoder.writeTextDelta(text: string);
encoder.writeTextDone(fullText: string);

// Tool calls
encoder.writeToolCallBegin(toolCallId: string, toolName: string);
encoder.writeToolCallDelta(toolCallId: string, argsTextDelta: string);
encoder.writeToolCallDone(toolCallId: string, args: object);
encoder.writeToolResult(toolCallId: string, result: unknown);

// Control
encoder.writeFinish(reason: "stop" | "length" | "tool-calls");
encoder.writeError(message: string);

// Get encoded data
const bytes = encoder.flush();

// Close stream
encoder.close();
```

## Event Types

### Text Events

```ts
// Created (optional, signals start)
{ type: "text-created" }

// Delta (streaming content)
{ type: "text-delta", textDelta: "Hello " }
{ type: "text-delta", textDelta: "world!" }

// Done (optional, final content)
{ type: "text-done", text: "Hello world!" }
```

### Tool Events

```ts
// Begin
{
  type: "tool-call-begin",
  toolCallId: "call_abc123",
  toolName: "search"
}

// Arguments streaming
{
  type: "tool-call-delta",
  toolCallId: "call_abc123",
  argsTextDelta: '{"query":'
}
{
  type: "tool-call-delta",
  toolCallId: "call_abc123",
  argsTextDelta: '"NYC"}'
}

// Complete
{
  type: "tool-call-done",
  toolCallId: "call_abc123",
  args: { query: "NYC" }
}

// Result
{
  type: "tool-result",
  toolCallId: "call_abc123",
  result: { results: [...] }
}
```

### Control Events

```ts
// Finish reasons
{ type: "finish", finishReason: "stop" }        // Normal completion
{ type: "finish", finishReason: "length" }      // Max tokens reached
{ type: "finish", finishReason: "tool-calls" }  // Tool use

// Error
{ type: "error", error: "Rate limit exceeded" }
```

## With Tools Example

```ts
import { DataStreamEncoder } from "assistant-stream";

async function streamWithTools(req: Request) {
  const encoder = new DataStreamEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Initial text
      encoder.writeTextDelta("Let me search for that...\n\n");
      controller.enqueue(encoder.flush());

      // Tool call
      const toolCallId = "call_" + Date.now();
      encoder.writeToolCallBegin(toolCallId, "search");
      controller.enqueue(encoder.flush());

      encoder.writeToolCallDelta(toolCallId, '{"query":"weather NYC"}');
      controller.enqueue(encoder.flush());

      encoder.writeToolCallDone(toolCallId, { query: "weather NYC" });
      controller.enqueue(encoder.flush());

      // Execute tool
      const result = await searchWeather("NYC");

      encoder.writeToolResult(toolCallId, result);
      controller.enqueue(encoder.flush());

      // Continue with response
      encoder.writeTextDelta(`The current weather in NYC is ${result.temp}°F`);
      controller.enqueue(encoder.flush());

      encoder.writeFinish("stop");
      controller.enqueue(encoder.flush());

      encoder.close();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}
```

## Wire Format

Data Stream uses Server-Sent Events (SSE) format:

```
0:"Hello "
0:"world!"
e:{"finishReason":"stop"}
```

Each line:
- `0:` - Text content
- `9:` - Tool call
- `a:` - Tool result
- `e:` - Finish event
- `3:` - Error

## Integration with useChatRuntime

```tsx
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

function Chat() {
  const runtime = useChatRuntime({
    api: "/api/chat",
    // Data Stream format is automatically handled
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```
