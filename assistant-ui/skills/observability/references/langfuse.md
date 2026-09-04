# Langfuse

Langfuse consumes OpenTelemetry spans that AI SDK emits. It adds no proxy and does not wrap `streamText`. Use it when an agent turn needs one hierarchical trace containing model and tool activity.

## Environment

```sh
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

`LANGFUSE_BASE_URL` is `https://cloud.langfuse.com` for EU, `https://us.cloud.langfuse.com` for US, or the URL of a self hosted instance.

## Install

```sh
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

`@langfuse/tracing` provides `propagateAttributes`. `@langfuse/otel` provides `LangfuseSpanProcessor`, and `@opentelemetry/sdk-node` starts the OpenTelemetry SDK.

## Initialize OpenTelemetry once

Create `instrumentation.ts` at the application root. Export the processor so a serverless route can flush it later.

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

export const langfuseSpanProcessor = new LangfuseSpanProcessor();

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });
  sdk.start();
}
```

The Node runtime guard excludes the edge runtime, where OpenTelemetry does not run. On Next.js 14 and earlier, opt in to the instrumentation hook:

```js
const nextConfig = {
  experimental: { instrumentationHook: true },
};

export default nextConfig;
```

## Trace an AI SDK route

Enable `experimental_telemetry` on the call and wrap it in `propagateAttributes`. `traceName` labels the trace. `userId` and `sessionId` are the canonical filter dimensions, so resolve them from the authenticated user and selected thread.

```ts
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { propagateAttributes } from "@langfuse/tracing";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const userId = "<resolve from your session>";
  const sessionId = "<resolve from your thread state>";

  const result = await propagateAttributes(
    { traceName: "chat-completion", userId, sessionId },
    async () =>
      streamText({
        model: openai("gpt-5.6-luna"),
        messages: await convertToModelMessages(messages),
        experimental_telemetry: { isEnabled: true },
      }),
  );

  return result.toUIMessageStreamResponse();
}
```

## Flush before a serverless exit

On a serverless platform, a function can exit before the OpenTelemetry buffer is sent. Import the processor from `instrumentation.ts` and flush it before the runtime exits, or hand the flush to that platform's `waitUntil` API.

```ts
import { langfuseSpanProcessor } from "@/instrumentation";

await langfuseSpanProcessor.forceFlush();
```

## Verify

Send a message and inspect the Langfuse project after a few seconds. The trace should use `traceName`, contain a child span for each model and tool call, include prompt, completion, and token usage, and expose user and session metadata as filters. If it is absent, confirm the Langfuse keys are present in the runtime handling the request and inspect server logs for OpenTelemetry errors.
