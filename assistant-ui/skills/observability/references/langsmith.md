# LangSmith

LangSmith traces AI SDK calls through `wrapAISDK(ai)`. Use this backend path when the route talks to AI SDK directly and LangSmith traces, datasets, prompt versioning, and evaluations belong with LangChain or LangGraph tooling. A LangGraph Cloud backend already has its own tracing path.

## Environment

```sh
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=assistant-ui
```

`LANGSMITH_PROJECT` selects the receiving project. LangSmith uses its default project when the variable is omitted.

## Install

```sh
npm install langsmith
```

## Wrap the AI SDK namespace

`wrapAISDK(ai)` returns traced `generateText`, `streamText`, `generateObject`, and `streamObject`. Destructure the function the route calls. `convertToModelMessages` remains on the unwrapped `ai` namespace.

```ts
import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";

const { streamText } = wrapAISDK(ai);

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await ai.convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

## Add trace metadata

`createLangSmithProviderOptions` creates the `langsmith` provider option. `name` becomes the run name and `metadata` provides filter fields. Resolve `userId` and `threadId` from application state instead of sending placeholders.

```ts
import { createLangSmithProviderOptions } from "langsmith/experimental/vercel";

const result = streamText({
  model: openai("gpt-5.6-luna"),
  messages: await ai.convertToModelMessages(messages),
  providerOptions: {
    langsmith: createLangSmithProviderOptions({
      name: "chat-completion",
      metadata: { userId, threadId },
    }),
  },
});
```

## Flush before a serverless exit

Serverless functions can exit before LangSmith sends pending trace batches. Flush the client before the runtime exits.

```ts
import { Client } from "langsmith";

const client = new Client();
await client.awaitPendingTraceBatches();
```

## Verify

Send a message and inspect the selected LangSmith project after a few seconds. Confirm a run named `chat-completion` or the default `streamText` name, populated inputs and outputs, token usage and latency, and metadata fields that can be used as filters.

Do not add AI SDK `experimental_telemetry` just for LangSmith. That flag emits OpenTelemetry spans for the Langfuse path. `wrapAISDK` is LangSmith's tracing path, and the route must call the wrapped function.
