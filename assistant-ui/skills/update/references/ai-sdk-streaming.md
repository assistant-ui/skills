# AI SDK v6 Streaming Architecture

Stream response and structured output changes in AI SDK v6.

---

## Stream Response Methods

```diff
// Before (v5) - result was a promise
- return (await result).toDataStreamResponse();

// After (v6) - result is not a promise
+ return result.toDataStreamResponse();

// For UI message streams (recommended for assistant-ui):
+ return result.toUIMessageStreamResponse();
```

---

## toUIMessageStreamResponse Options

```typescript
return result.toUIMessageStreamResponse({
  // Include reasoning tokens (for models that support it)
  sendReasoning: true,

  // Include source citations (for RAG models)
  sendSources: true,

  // Custom ID generator for messages
  generateMessageId: () => crypto.randomUUID(),

  // Attach metadata to message parts
  messageMetadata: { timestamp: Date.now() },

  // Customize error messages sent to client
  getErrorMessage: (error) => `Error: ${error.message}`,

  // Handle completion (good for persistence)
  onFinish: ({ messages, responseMessage }) => {
    // Save to database
  },
});
```

---

## Stream Protocol (Lifecycle Events)

```typescript
// Text streaming uses start/delta/end with unique IDs
{ type: "text-start", id: "text-1" }
{ type: "text-delta", id: "text-1", delta: "Hello" }
{ type: "text-delta", id: "text-1", delta: " world" }
{ type: "text-end", id: "text-1" }

// Tool inputs stream progressively
{ type: "tool-input-start", toolCallId: "call-1" }
{ type: "tool-input-delta", toolCallId: "call-1", delta: '{"loc' }
{ type: "tool-input-end", toolCallId: "call-1" }
```

---

## Custom Stream Headers

For custom backend implementations:

```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "x-vercel-ai-ui-message-stream": "v1",
  },
});
```

---

## Creating Custom UI Message Streams

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Write text manually
    writer.write({ type: "text-start", id: "text-1" });
    writer.write({ type: "text-delta", id: "text-1", delta: "Hello" });
    writer.write({ type: "text-end", id: "text-1" });

    // Write custom data (persistent - saved in message.parts)
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 72 },
    });

    // Merge another stream
    const result = streamText({ model, messages });
    writer.merge(result.toUIMessageStream());
  },
  onFinish: ({ messages, responseMessage }) => {
    // Handle completion
  },
});

return createUIMessageStreamResponse({ stream });
```

---

## Custom Data Parts

### Defining Type-Safe Data Parts

```typescript
export type MyUIMessage = UIMessage<
  never,
  {
    weather: { city: string; temp: number; status: "loading" | "ready" };
    notification: { message: string; level: "info" | "warning" | "error" };
  }
>;
```

### Server: Sending Data Parts

```typescript
const stream = createUIMessageStream<MyUIMessage>({
  execute: ({ writer }) => {
    // Persistent data part (appears in message.parts)
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 72, status: "ready" },
    });

    // Update same part by using same ID
    writer.write({
      type: "data-weather",
      id: "weather-1",
      data: { city: "NYC", temp: 75, status: "ready" },
    });
  },
});
```

### Client: Reading Data Parts

```typescript
// Persistent parts in message.parts
const weatherData = message.parts
  .filter((part) => part.type === "data-weather")
  .map((part) => part.data);

// Transient parts via onData callback (not saved in message history)
const { messages } = useChat<MyUIMessage>({
  onData: (dataPart) => {
    if (dataPart.type === "data-notification") {
      showToast(dataPart.data.message);
    }
  },
});
```

---

## Structured Output (generateObject → generateText + Output)

### generateObject Deprecated

```diff
// Before (v5)
- import { generateObject } from "ai";
- const { object } = await generateObject({
-   model: openai("gpt-4o"),
-   schema: z.object({ name: z.string() }),
-   prompt: "Generate a name",
- });

// After (v6)
+ import { generateText, Output } from "ai";
+ const { output } = await generateText({
+   model: openai("gpt-4o"),
+   output: Output.object({
+     schema: z.object({ name: z.string() }),
+   }),
+   prompt: "Generate a name",
+ });
```

### Output Types

```typescript
import { generateText, streamText, Output } from "ai";

// Single object
const { output } = await generateText({
  model,
  output: Output.object({
    schema: z.object({ name: z.string(), age: z.number() }),
    name: "person",        // Optional
    description: "...",    // Optional
  }),
  prompt: "Generate a person",
});

// Array of objects
const { output } = await generateText({
  model,
  output: Output.array({
    schema: z.object({ name: z.string() }),
  }),
  prompt: "Generate 5 names",
});

// Choice from options
const { output } = await generateText({
  model,
  output: Output.choice({
    options: ["positive", "negative", "neutral"],
  }),
  prompt: "Classify the sentiment",
});

// Plain JSON (no validation)
const { output } = await generateText({
  model,
  output: Output.json(),
  prompt: "Generate JSON data",
});
```

### Streaming Structured Output

```diff
// Before (v5)
- const { partialObjectStream } = streamObject({ ... });
- for await (const partial of partialObjectStream) { }

// After (v6)
+ const result = streamText({
+   model,
+   output: Output.object({ schema }),
+   prompt: "...",
+ });
+ for await (const partial of result.partialOutputStream) { }
```

For arrays, use `elementStream`:

```typescript
const result = streamText({
  model,
  output: Output.array({ schema }),
  prompt: "Generate items",
});

// Each element is complete and validated
for await (const element of result.elementStream) {
  console.log(element);
}
```

---

## Migration: Custom Streams

**Before (v5):**
```typescript
import { createDataStreamResponse, streamText } from "ai";

return createDataStreamResponse({
  execute: async (writer) => {
    writer.writeMessageAnnotation({
      type: "custom-metadata",
      timestamp: Date.now(),
    });

    const result = streamText({ model, messages });
    result.mergeIntoDataStream(writer);
  },
});
```

**After (v6):**
```typescript
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    writer.write({
      type: "data-metadata",
      id: "meta-1",
      data: { timestamp: Date.now() },
    });

    const result = streamText({ model, messages: await convertToModelMessages(messages) });
    writer.merge(result.toUIMessageStream());
  },
  onFinish: ({ messages, responseMessage }) => {
    // Persist to database
  },
});

return createUIMessageStreamResponse({ stream });
```
