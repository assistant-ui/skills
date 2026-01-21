# Encoders and Decoders

Encode and decode streaming formats.

## Available Encoders

| Encoder | Format | Use Case |
|---------|--------|----------|
| `DataStreamEncoder` | AI SDK format | Most common, AI SDK compatible |
| `AssistantTransportEncoder` | Native format | All features, custom backends |
| `PlainTextEncoder` | Simple text | Basic text streaming |

## DataStreamEncoder

AI SDK compatible format.

```ts
import { DataStreamEncoder, DataStreamDecoder } from "assistant-stream";

// Encoding
const encoder = new DataStreamEncoder();
encoder.writeTextDelta("Hello ");
encoder.writeTextDelta("world!");
encoder.writeFinish("stop");
const bytes = encoder.flush();
encoder.close();

// Decoding
const decoder = new DataStreamDecoder();
for await (const event of decoder.decode(stream)) {
  console.log(event);
}
```

### Methods

```ts
// Text
encoder.writeTextCreated()
encoder.writeTextDelta(text: string)
encoder.writeTextDone(fullText: string)

// Tools
encoder.writeToolCallBegin(toolCallId: string, toolName: string)
encoder.writeToolCallDelta(toolCallId: string, argsTextDelta: string)
encoder.writeToolCallDone(toolCallId: string, args: object)
encoder.writeToolResult(toolCallId: string, result: unknown)

// Control
encoder.writeFinish(reason: "stop" | "length" | "tool-calls")
encoder.writeError(message: string)

// Output
encoder.flush(): Uint8Array
encoder.close()
```

## AssistantTransportEncoder

Native assistant-ui format with all features.

```ts
import {
  AssistantTransportEncoder,
  AssistantTransportDecoder,
} from "assistant-stream";

// Encoding
const encoder = new AssistantTransportEncoder();
encoder.writeMessageStart({ id: "1", role: "assistant" });
encoder.writeTextDelta("Response text");
encoder.writeReasoning("Thinking process...");
encoder.writeSource({ url: "...", title: "..." });
encoder.writeMessageDone({ ... });
const bytes = encoder.flush();
encoder.close();

// Decoding
const decoder = new AssistantTransportDecoder();
for await (const event of decoder.decode(stream)) {
  console.log(event);
}
```

### Methods

```ts
// Message lifecycle
encoder.writeMessageStart(message: Partial<ThreadMessage>)
encoder.writeMessageDone(message: ThreadMessage)

// Content
encoder.writeTextDelta(text: string)
encoder.writeReasoning(reasoning: string)
encoder.writeSource(source: { url: string; title: string })
encoder.writeImage(url: string)

// Tools
encoder.writeToolCallBegin(toolCallId: string, toolName: string)
encoder.writeToolCallDelta(toolCallId: string, argsTextDelta: string)
encoder.writeToolCallDone(toolCallId: string, args: object)
encoder.writeToolResult(toolCallId: string, result: unknown)

// Control
encoder.writeError(message: string)

// Output
encoder.flush(): Uint8Array
encoder.close()
```

## PlainTextEncoder

Simple text-only streaming.

```ts
import { PlainTextEncoder, PlainTextDecoder } from "assistant-stream";

// Encoding
const encoder = new PlainTextEncoder();
const stream = encoder.encode("Hello world!");

// Decoding
const decoder = new PlainTextDecoder();
for await (const text of decoder.decode(stream)) {
  console.log(text);
}
```

## UIMessageStreamDecoder

Optimized for UI rendering - accumulates into message state.

```ts
import { UIMessageStreamDecoder } from "assistant-stream";

const decoder = new UIMessageStreamDecoder();

for await (const update of decoder.decode(stream)) {
  // update contains full message state ready for UI
  setMessages(update.messages);
}
```

## Creating Custom Streams

### From Async Generator

```ts
import { AssistantStream } from "assistant-stream";

const stream = AssistantStream.fromAsyncIterable(async function* () {
  yield { type: "text-delta", textDelta: "Hello " };
  await delay(100);
  yield { type: "text-delta", textDelta: "world!" };
});
```

### From ReadableStream

```ts
const stream = AssistantStream.fromReadableStream(readableStream);
```

### From Response

```ts
const response = await fetch("/api/chat", { ... });
const stream = AssistantStream.fromResponse(response);
```

## Server Response Helpers

### Create Streaming Response

```ts
function createStreamingResponse(
  generator: AsyncGenerator,
  encoder: DataStreamEncoder | AssistantTransportEncoder
) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generator) {
          // Write event based on type
          if (event.type === "text-delta") {
            encoder.writeTextDelta(event.textDelta);
          }
          // ... handle other event types
          controller.enqueue(encoder.flush());
        }
      } finally {
        encoder.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### Error Handling

```ts
const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const chunk of source) {
        encoder.writeTextDelta(chunk);
        controller.enqueue(encoder.flush());
      }
      encoder.writeFinish("stop");
    } catch (error) {
      encoder.writeError(error.message);
    } finally {
      controller.enqueue(encoder.flush());
      encoder.close();
      controller.close();
    }
  },
});
```

## Debugging

### Log Raw Stream

```ts
const response = await fetch("/api/chat", { ... });
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log("Raw:", decoder.decode(value));
}
```

### Validate Format

```ts
// Check if response is valid SSE
const contentType = response.headers.get("Content-Type");
console.log("Content-Type:", contentType);  // Should be text/event-stream
```
