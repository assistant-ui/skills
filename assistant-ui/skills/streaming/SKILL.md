---
name: streaming
description: "Streaming wire protocols and backend helpers for assistant-ui, built on the assistant-stream package. Use when building a custom streaming endpoint (one that does not go through the Vercel AI SDK) with createAssistantStreamResponse, createAssistantStream, or createAssistantStreamController; writing to the returned AssistantStreamController through appendText, appendReasoning, appendSource, appendFile, appendData, addTextPart, addReasoningPart, or addToolCallPart (whose result exposes argsText and setResponse); choosing between the Data Stream protocol (useDataStreamRuntime from @assistant-ui/react-data-stream, DataStreamEncoder and DataStreamDecoder) and the Assistant Transport protocol (AssistantTransportEncoder and AssistantTransportDecoder, the useAssistantTransportRuntime state snapshot runtime); decoding a response with AssistantStream.fromResponse, UIMessageStreamDecoder, or PlainTextDecoder; or wiring resumable streams through assistant-stream/resumable (createResumableStreamContext, createResumableSessionStorage, RESUMABLE_STREAM_ID_HEADER, onResumeError, and the in-memory, Redis, and ioredis stores). Route here for wire level symptoms: an unexpected part-start or text-delta shape, a tool call that never settles, a source or file part that silently drops because it is missing its type field, a stream Content-Type mismatch, or a reload that cannot resume a response. For configuring useLocalRuntime, useExternalStoreRuntime, or the useAssistantTransportRuntime hook's React state itself, use runtime; for AI SDK route handler and useChatRuntime scaffolding without a custom protocol, use setup; for cloud backed persistence, use cloud."
license: MIT
---

# assistant-ui Streaming

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

`assistant-stream` is the wire layer underneath assistant-ui's chat runtimes. It normalizes every backend into one stream of `AssistantStreamChunk` values, ships encoders and decoders for three wire formats, and adds a resumable-stream layer on top of any of them. If your backend already speaks the Vercel AI SDK, you rarely touch this package directly (`streamText` plus `toUIMessageStream` is enough); reach for it when you write a custom endpoint, need to decode a stream yourself, or want resumable streams.

## References

- [./references/data-stream.md](./references/data-stream.md) -- the Data Stream protocol, `useDataStreamRuntime`, and its wire format
- [./references/assistant-transport.md](./references/assistant-transport.md) -- the Assistant Transport SSE format and the `useAssistantTransportRuntime` state-snapshot runtime
- [./references/encoders.md](./references/encoders.md) -- the encoder and decoder catalog, `PlainTextEncoder`, `UIMessageStreamDecoder`, accumulators, and debugging
- [./references/resumable.md](./references/resumable.md) -- `assistant-stream/resumable`: context, stores, and client wiring

## When to use it

```
Streaming the model call through the Vercel AI SDK?
├─ Yes → streamText + toUIMessageStream/createUIMessageStreamResponse (or result.toUIMessageStreamResponse())
│        assistant-stream is optional: only needed to decode the response yourself or add resumable streams
└─ No → build the response with assistant-stream
    ├─ Emitting message parts (text, reasoning, tool calls) → Data Stream
    └─ Streaming a full agent state snapshot with custom commands → Assistant Transport
```

## Installation

```bash
npm install assistant-stream
```

`@assistant-ui/ai-sdk` is the current AI SDK integration package (framework neutral); `@assistant-ui/react-ai-sdk` still re-exports the same API for older installs but new code should import from `@assistant-ui/ai-sdk`.

## Build a custom streaming response

`createAssistantStreamResponse` runs a callback with an `AssistantStreamController` and returns a `Response` encoded as Data Stream (see [data-stream.md](./references/data-stream.md) for the alternative encoders).

```ts
import { createAssistantStreamResponse } from "assistant-stream";

export async function POST(req: Request) {
  return createAssistantStreamResponse(async (controller) => {
    controller.appendText("Hello ");
    controller.appendText("world!");

    controller.appendReasoning("Checking the forecast first.", {
      unstable_summary: "Looking up the weather",
    });

    controller.appendSource({
      type: "source",
      sourceType: "url",
      id: "s1",
      url: "https://example.com/forecast",
      title: "Forecast",
    });

    const tool = controller.addToolCallPart({ toolName: "get_weather" });
    tool.argsText.append('{"city":"NYC"}');
    tool.argsText.close();
    tool.setResponse({ result: { temperature: 22 } });

    controller.close();
  });
}
```

`close()` closes any part still open and ends the stream; an uncaught throw inside the callback is turned into an `error` chunk automatically.

## AssistantStreamController

Every server-side stream, whichever encoder ends up wrapping it, is written through this controller (`createAssistantStream`, `createAssistantStreamController`, and `createAssistantStreamResponse` all hand you one).

| Method | Signature | Notes |
| --- | --- | --- |
| `appendText` | `(textDelta: string) => void` | Opens a text part on first call, appends to it on the next |
| `appendReasoning` | `(reasoningDelta: string, options?: { unstable_summary?: string }) => void` | Passing `options` always opens a new part, so a summary lands on a part of its own |
| `appendSource` | `(part: SourcePart) => void` | `SourcePart` is `{ type: "source", sourceType: "url", id, url, title?, parentId? }` |
| `appendFile` | `(part: FilePart) => void` | `FilePart` is `{ type: "file", data, mimeType, parentId? }` |
| `appendData` | `(part: DataPart) => void` | `DataPart` is `{ type: "data", name, data, parentId? }`, a named app-defined part |
| `addTextPart` | `() => TextStreamController` | Explicit `{ append(text), close() }` writer, for interleaving with other parts |
| `addReasoningPart` | `(options?) => TextStreamController` | Same writer shape as `addTextPart` |
| `addToolCallPart` | `(toolName: string) => ToolCallStreamController` | Generates a `toolCallId`; see the object overload below for a stable id |
| `addToolCallPart` | `(init: ToolCallPartInit) => ToolCallStreamController` | `{ toolCallId?, toolName, argsText?, args?, response? }` |
| `enqueue` | `(chunk: AssistantStreamChunk) => void` | Raw escape hatch; prefer the helpers above |
| `merge` | `(stream: AssistantStream) => void` | Splices another `AssistantStream`'s parts into this one |
| `withParentId` | `(parentId: string) => AssistantStreamController` | Returns a controller whose writes attach `parentId` (nested or related parts) |
| `close` | `() => void` | Closes the open part, then the stream |

`addToolCallPart` returns a `ToolCallStreamController`: `{ argsText: TextStreamController, setResponse(response), close() }`. `setResponse` takes `{ result, artifact?, isError?, modelContent?, messages? }` (the shape returned by a `ToolResponse`), closes the part automatically, and ignores a second call.

## Stream events and part types

Every decoder, regardless of wire format, yields the same normalized `AssistantStreamChunk` union (`{ path: number[] } & { type, ... }`):

| `type` | Extra fields |
| --- | --- |
| `part-start` | `part: PartInit` (see below) |
| `part-finish` | none |
| `tool-call-args-text-finish` | none |
| `text-delta` | `textDelta: string` |
| `annotations` | `annotations: ReadonlyJSONValue[]` |
| `data` | `data: ReadonlyJSONValue[]` |
| `step-start` | `messageId: string` |
| `step-finish` | `finishReason, usage: { inputTokens, outputTokens }, isContinued: boolean` |
| `message-finish` | `finishReason, usage` |
| `result` | `result, isError: boolean, artifact?, modelContent?, messages?` |
| `error` | `error: string, code?, severity?: "critical" \| "warning" \| "info"` |
| `update-state` | `operations: AssistantTransportStateOperation[]` (see [assistant-transport.md](./references/assistant-transport.md)) |

`PartInit` (the `part` field of `part-start`) is one of six part types, every variant carrying an optional `parentId`:

| `type` | Extra fields |
| --- | --- |
| `text` | none |
| `reasoning` | `unstable_summary?: string` |
| `tool-call` | `toolCallId: string, toolName: string` |
| `source` | `sourceType: "url", id, url, title?` |
| `file` | `data: string, mimeType: string` |
| `data` | `name: string, data: ReadonlyJSONValue` |

## Common Gotchas

**`appendSource`, `appendFile`, or `appendData` silently drops the part**
- Pass the full part object including its `type` field (`"source"`, `"file"`, or `"data"`); the method name does not imply it for you.

**A tool call never settles in the UI**
- `addToolCallPart` needs a `toolName`; the id is generated for you unless you pass one. Close `argsText` (or call `setResponse`, which closes it for you) or the part never finishes. Register the rendering with a `"use generative"` toolkit, not the deprecated `makeAssistantToolUI`; see [tools](../tools/SKILL.md).

**Two separate reasoning parts merge into one on the client**
- On the Data Stream wire, a reasoning part-start frame is only sent when `unstable_summary` is set; a plain `appendReasoning(text)` call travels only as text deltas, and the decoder has nothing else to tell it a new part started. Opening two summary-less reasoning parts back to back (for example around a tool call) reconstructs as one continuous reasoning part on the client. Give each part a `unstable_summary` (even an empty-feeling one) or route the tool call through a separate message step to keep them distinct.

**Stream not updating the UI**
- Check the Content-Type against the encoder you actually used: `DataStreamEncoder` (the `createAssistantStreamResponse` default) sends `text/plain; charset=utf-8` with `x-vercel-ai-data-stream: v1`, not `text/event-stream`. `AssistantTransportEncoder` and the AI SDK's UI message stream do send `text/event-stream`.

**Decoder throws "Stream ended abruptly without receiving [DONE] marker"**
- `AssistantTransportDecoder` and `UIMessageStreamDecoder` require the terminal `[DONE]` sentinel; a proxy, CDN, or middleware that buffers or truncates the body breaks this. `DataStreamDecoder` has no such marker.

**`createAssistantStreamResponse` always encodes as Data Stream**
- It hard-codes `DataStreamEncoder`. For a different wire format, encode manually: `AssistantStream.toResponse(createAssistantStream(callback), new AssistantTransportEncoder())`, or use `createAssistantStreamController` and encode the returned stream yourself.

## Related Skills

- [runtime](../runtime/SKILL.md) -- `useLocalRuntime`, `useExternalStoreRuntime`, and the `useAssistantTransportRuntime` React hook and state hooks
- [setup](../setup/SKILL.md) -- scaffolding an AI SDK route handler and `useChatRuntime`
- [tools](../tools/SKILL.md) -- `"use generative"` toolkits and tool-call rendering
- [cloud](../cloud/SKILL.md) -- persisting streamed threads and messages with assistant-cloud
