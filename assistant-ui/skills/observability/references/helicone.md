# Helicone

Helicone is a provider proxy. Point the provider client at its gateway and add its authentication header to record cost, latency, prompts, completions, and request diffs. It is independent of the assistant-ui runtime and can pair with AI SDK, LangGraph, Mastra, or another server backend.

## Environment

```sh
HELICONE_API_KEY=sk-helicone-...
OPENAI_API_KEY=sk-...
```

Both keys stay on the server. The Helicone proxy receives the provider key, so neither value belongs in a client component.

## AI SDK route

Create an OpenAI provider with Helicone's base URL and the `Helicone-Auth` header. `createOpenAI` still reads `OPENAI_API_KEY` and sends the provider authorization header.

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

const openai = createOpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

## OpenAI SDK route

For a route that calls the OpenAI SDK directly, set the same base URL and header on that client. The response must still be adapted into the stream your UI runtime expects.

```ts
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://oai.helicone.ai/v1",
  defaultHeaders: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    messages,
    stream: true,
  });

  return new Response(stream.toReadableStream());
}
```

## Per request metadata

Add `Helicone-User-Id`, `Helicone-Property-*`, or session headers to the same header object to filter and aggregate requests in Helicone. The request still streams and tool calls and attachments retain their normal provider behavior because the proxy preserves the upstream request shape.

## Verify

Send a message and inspect the Helicone dashboard after a few seconds. The request host must be `oai.helicone.ai`, not `api.openai.com`. Confirm that the outgoing request carries `Helicone-Auth` and the provider `Authorization` header, then confirm token counts, latency, prompt, and completion are present in the dashboard.

For Anthropic, Gemini, or another provider, use that provider's Helicone gateway URL. The `Helicone-Auth` header remains the integration point.
