# Encoders and Decoders

Every encoder turns an `AssistantStream` (a `ReadableStream<AssistantStreamChunk>`) into response bytes; every decoder turns bytes back into one. Pair the encoder a route used with the matching decoder on the read side.

| Class | Direction | Wire format | Content-Type | Home |
| --- | --- | --- | --- | --- |
| `DataStreamEncoder` / `DataStreamDecoder` | both | numbered-prefix lines (`0:`, `9:`, `aui-state:`, ...) | `text/plain; charset=utf-8` + `x-vercel-ai-data-stream: v1` | [data-stream.md](./data-stream.md) |
| `AssistantTransportEncoder` / `AssistantTransportDecoder` | both | SSE, one JSON chunk per `data:` line, `[DONE]` terminated | `text/event-stream` | [assistant-transport.md](./assistant-transport.md) |
| `PlainTextEncoder` / `PlainTextDecoder` | both | raw UTF-8 text, no structure | `text/plain; charset=utf-8` | this file |
| `UIMessageStreamDecoder` | decode only | AI SDK UI message stream SSE | `text/event-stream` (set by the AI SDK response, not this class) | this file |

There is no `UIMessageStreamEncoder`: producing that format is the AI SDK's job (`toUIMessageStream` / `createUIMessageStreamResponse` / `result.toUIMessageStreamResponse()`, see [data-stream.md](./data-stream.md)); `assistant-stream` only decodes it back out.

## PlainTextEncoder and PlainTextDecoder

The simplest possible wire format: only text deltas survive, everything else (tool calls, sources, files, reasoning, state) is dropped. Use it for a demo or a health check, not a real chat backend.

```ts
import { PlainTextEncoder, PlainTextDecoder } from "assistant-stream";

const response = AssistantStream.toResponse(stream, new PlainTextEncoder());
```

```ts
const decoder = new PlainTextDecoder();
const assistantStream = decoder.readable; // pipe a byte ReadableStream through it
```

`PlainTextDecoder` (like the other decoders) is a `TransformStream`; pipe a byte stream through it or hand it to `AssistantStream.fromResponse`.

## UIMessageStreamDecoder

Decodes the AI SDK's UI message stream protocol into `AssistantStreamChunk`s. This is the format `result.toUIMessageStreamResponse()` and `toUIMessageStream`/`createUIMessageStreamResponse` produce, and the format `AssistantChatTransport` (`useChatRuntime`, see [setup](../../setup/SKILL.md)) speaks natively through the AI SDK's own `useChat`; reach for this decoder when you want to read that same response through `assistant-stream` yourself instead, for example inside a `LocalRuntime.ChatModelAdapter` or a `useDataStreamRuntime`-style custom client.

```ts
import { AssistantStream, UIMessageStreamDecoder } from "assistant-stream";

const stream = AssistantStream.fromResponse(
  response,
  new UIMessageStreamDecoder({
    onData: ({ name, data, transient }) => {
      // custom `data-*` parts the AI SDK route wrote with a UIMessageStreamWriter
    },
  }),
);

for await (const chunk of stream) {
  console.log(chunk);
}
```

`onData` is optional; without it, non-transient data parts still surface as ordinary `data` chunks on the decoded stream (`transient` ones are still passed to `onData` when provided, but never enqueued as a chunk). The decoder requires the terminal `[DONE]` marker, same as `AssistantTransportDecoder`.

## Writing a custom encoder or decoder

Both are `ReadableWritablePair`s over `AssistantStreamChunk` on one side and `Uint8Array` on the other; an encoder additionally carries a `headers` property (copied onto the `Response` by `AssistantStream.toResponse`). Neither shape is exported by name, so a custom encoder just needs to match the structure; a plain `TransformStream` already does:

```ts
import type { AssistantStreamChunk } from "assistant-stream";

class NdjsonEncoder extends TransformStream<AssistantStreamChunk, Uint8Array> {
  headers = new Headers({ "Content-Type": "application/x-ndjson" });

  constructor() {
    const textEncoder = new TextEncoder();
    super({
      transform(chunk, controller) {
        controller.enqueue(textEncoder.encode(JSON.stringify(chunk) + "\n"));
      },
    });
  }
}
```

A decoder is the same shape without `headers`: `ReadableWritablePair<AssistantStreamChunk, Uint8Array>`, transforming in the opposite direction.

## Accumulating a stream into a message

Most of the time a component reads a stream chunk by chunk, but for logging, testing, or a non-streaming consumer, accumulate the whole thing into a final `AssistantMessage`:

```ts
import { AssistantMessageStream } from "assistant-stream";

const messageStream = AssistantMessageStream.fromAssistantStream(assistantStream);
const finalMessage = await messageStream.unstable_result();
```

`AssistantMessageAccumulator` is the underlying `TransformStream<AssistantStreamChunk, AssistantMessage>` if you want the intermediate snapshots (one `AssistantMessage` per accumulated chunk) rather than only the final one. Every accumulated part is one of six `AssistantMessagePart` variants, keyed by `type`: `TextPart`, `ReasoningPart` (`unstable_summary?`), `ToolCallPart` (`toolCallId, toolName, argsText, args, state: "partial-call" | "call" | "result"`, plus `result`/`artifact`/`isError`/`modelContent` once settled), `SourcePart`, `FilePart`, and `DataPart`, all carrying an optional `parentId`.

## Debugging a stream

Log the raw bytes before assuming a decoder bug:

```ts
const response = await fetch("/api/chat");
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log("Raw:", decoder.decode(value));
}
```

Check `Content-Type` against the table above rather than assuming `text/event-stream`; `DataStreamEncoder` and `PlainTextEncoder` both send `text/plain`. A stream that looks correct in the raw log but never updates the UI is usually a client-side protocol mismatch (wrong decoder, or a `protocol` override left in place on `useDataStreamRuntime` after the backend changed).
