# Assistant Transport Format

assistant-ui's native streaming protocol.

## Overview

Assistant Transport is assistant-ui's optimized format with support for all features including reasoning, sources, and complex message structures.

## When to Use

- Custom backends not using AI SDK
- Need all assistant-ui features
- Building your own streaming server

## Usage

### Server

```ts
import { AssistantTransportEncoder } from "assistant-stream";

export async function POST(req: Request) {
  const encoder = new AssistantTransportEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Start message
      encoder.writeMessageStart({
        id: "msg_1",
        role: "assistant",
      });
      controller.enqueue(encoder.flush());

      // Stream text
      encoder.writeTextDelta("Hello ");
      controller.enqueue(encoder.flush());

      encoder.writeTextDelta("world!");
      controller.enqueue(encoder.flush());

      // Complete message
      encoder.writeMessageDone({
        id: "msg_1",
        role: "assistant",
        content: [{ type: "text", text: "Hello world!" }],
        status: "complete",
      });
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

### Client

```ts
import { AssistantTransportDecoder } from "assistant-stream";

const decoder = new AssistantTransportDecoder();

for await (const event of decoder.decode(responseStream)) {
  switch (event.type) {
    case "message-start":
      console.log("Message started:", event.message.id);
      break;
    case "text-delta":
      console.log("Text:", event.textDelta);
      break;
    case "message-done":
      console.log("Message complete:", event.message);
      break;
  }
}
```

## AssistantTransportEncoder API

```ts
const encoder = new AssistantTransportEncoder();

// Message lifecycle
encoder.writeMessageStart(message: Partial<ThreadMessage>);
encoder.writeMessageDone(message: ThreadMessage);

// Text
encoder.writeTextDelta(text: string);

// Tool calls
encoder.writeToolCallBegin(toolCallId: string, toolName: string);
encoder.writeToolCallDelta(toolCallId: string, argsTextDelta: string);
encoder.writeToolCallDone(toolCallId: string, args: object);
encoder.writeToolResult(toolCallId: string, result: unknown);

// Rich content
encoder.writeReasoning(reasoning: string);
encoder.writeSource(source: { url: string; title: string });
encoder.writeImage(url: string);

// Control
encoder.writeError(message: string);

// Get encoded data
const bytes = encoder.flush();
encoder.close();
```

## Event Types

### Message Events

```ts
// Start
{
  type: "message-start",
  message: {
    id: "msg_1",
    role: "assistant",
  }
}

// Done
{
  type: "message-done",
  message: {
    id: "msg_1",
    role: "assistant",
    content: [{ type: "text", text: "Full response" }],
    status: "complete",
    createdAt: "2024-01-01T00:00:00Z"
  }
}
```

### Content Events

```ts
// Text
{ type: "text-delta", textDelta: "Hello " }

// Reasoning (chain-of-thought)
{ type: "reasoning", reasoning: "Let me think about this..." }

// Source citation
{
  type: "source",
  source: {
    url: "https://example.com",
    title: "Example Source"
  }
}

// Image
{ type: "image", image: "https://..." }
```

### Tool Events

```ts
{ type: "tool-call-begin", toolCallId: "1", toolName: "search" }
{ type: "tool-call-delta", toolCallId: "1", argsTextDelta: '...' }
{ type: "tool-call-done", toolCallId: "1", args: {...} }
{ type: "tool-result", toolCallId: "1", result: {...} }
```

## Complete Example

```ts
import { AssistantTransportEncoder } from "assistant-stream";

async function streamResponse(query: string) {
  const encoder = new AssistantTransportEncoder();
  const messageId = `msg_${Date.now()}`;

  const stream = new ReadableStream({
    async start(controller) {
      // Start message
      encoder.writeMessageStart({ id: messageId, role: "assistant" });
      controller.enqueue(encoder.flush());

      // Reasoning (if model supports it)
      encoder.writeReasoning("I need to search for information about " + query);
      controller.enqueue(encoder.flush());

      // Tool call
      const toolCallId = `tool_${Date.now()}`;
      encoder.writeToolCallBegin(toolCallId, "search");
      controller.enqueue(encoder.flush());

      encoder.writeToolCallDelta(toolCallId, JSON.stringify({ query }));
      controller.enqueue(encoder.flush());

      encoder.writeToolCallDone(toolCallId, { query });
      controller.enqueue(encoder.flush());

      // Execute tool and get result
      const searchResult = await performSearch(query);
      encoder.writeToolResult(toolCallId, searchResult);
      controller.enqueue(encoder.flush());

      // Stream response with sources
      encoder.writeTextDelta("Based on my search, ");
      controller.enqueue(encoder.flush());

      encoder.writeTextDelta("here's what I found:\n\n");
      controller.enqueue(encoder.flush());

      encoder.writeTextDelta(searchResult.summary);
      controller.enqueue(encoder.flush());

      // Add source citations
      for (const source of searchResult.sources) {
        encoder.writeSource({
          url: source.url,
          title: source.title,
        });
        controller.enqueue(encoder.flush());
      }

      // Complete message
      encoder.writeMessageDone({
        id: messageId,
        role: "assistant",
        content: [
          { type: "reasoning", reasoning: "..." },
          { type: "tool-call", toolCallId, toolName: "search", args: { query }, result: searchResult },
          { type: "text", text: "Based on my search, here's what I found:\n\n" + searchResult.summary },
          ...searchResult.sources.map(s => ({ type: "source", source: s })),
        ],
        status: "complete",
        createdAt: new Date(),
      });
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

## Using with useLocalRuntime

```tsx
import { useLocalRuntime } from "@assistant-ui/react";
import { AssistantTransportDecoder } from "assistant-stream";

const runtime = useLocalRuntime({
  model: {
    async *run({ messages, abortSignal }) {
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages }),
        signal: abortSignal,
      });

      const decoder = new AssistantTransportDecoder();

      for await (const event of decoder.decode(response.body)) {
        yield event;
      }
    },
  },
});
```
