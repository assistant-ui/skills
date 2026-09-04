# AI SDK migration

Use this reference before an assistant-ui upgrade when the application uses AI SDK v4, v5, or v6. The target integration is @assistant-ui/ai-sdk with ai@^7 and @ai-sdk/react@^4.

## Contents

- [Compatibility and pins](#compatibility-and-pins)
- [v4 and v5 to v6](#v4-and-v5-to-v6)
- [v6 to v7](#v6-to-v7)
- [Current v7 route](#current-v7-route)
- [Approval gates](#approval-gates)

## Compatibility and pins

| AI SDK | assistant-ui integration | Required packages |
| --- | --- | --- |
| v4 | @assistant-ui/react-data-stream | ai@^4 |
| v4, obsolete alternative | @assistant-ui/react-ai-sdk@0.10.16 | AI SDK v4 support ended on that line |
| v5 | @assistant-ui/react-ai-sdk@1.1.21 | ai@^5, @ai-sdk/react@^2, @ai-sdk/openai@^1 |
| v6 | @assistant-ui/react-ai-sdk@1.3.40 | ai@^6, @ai-sdk/react@^3 |
| v7 | @assistant-ui/ai-sdk | ai@^7, @ai-sdk/react@^4 |

The v4, v5, and v6 integrations are legacy and receive no new features. New work targets v7. A v4 application uses useDataStreamRuntime and the data-stream response protocol, not the current AI SDK adapter.

## v4 and v5 to v6

Move v4 through the v5 package APIs before adopting the v6 runtime shape. v4’s data-stream adapter is not a drop-in v6 runtime.

| Area | v4 or v5 | v6 |
| --- | --- | --- |
| AI package | ai@^4 or ai@^5 | ai@^6 |
| React package | v4 has no @ai-sdk/react pin, v5 uses @ai-sdk/react@^2 | @ai-sdk/react@^3 |
| Runtime package | @assistant-ui/react-data-stream or @assistant-ui/react-ai-sdk@1.1.21 | @assistant-ui/react-ai-sdk@1.3.40 |
| Runtime hook | useDataStreamRuntime or useChatRuntime | useChatRuntime |
| Message type | untyped v4 messages or Message | UIMessage |
| Message conversion | synchronous convertToModelMessages in v5 | await convertToModelMessages |
| Tool schema | parameters: z.object({...}) | inputSchema: zodSchema(z.object({...})) |
| Stream response | toDataStreamResponse() | toUIMessageStreamResponse() |

```ts
// Before
const result = streamText({
  model,
  messages: convertToModelMessages(messages),
  tools: {
    weather: tool({ parameters: z.object({ city: z.string() }) }),
  },
});
return result.toDataStreamResponse();
```

```ts
// After
const result = streamText({
  model,
  messages: await convertToModelMessages(messages),
  tools: {
    weather: tool({ inputSchema: zodSchema(z.object({ city: z.string() })) }),
  },
});
return result.toUIMessageStreamResponse();
```

AI SDK v6 supports multi-step calls with stopWhen: stepCountIs(n). Without stopWhen, it runs one inference step. The v6 server-side approval model uses a tool-level needsApproval field; replace that approval mechanism when moving to v7.

## v6 to v7

Keep await convertToModelMessages and inputSchema while changing the package majors, package name, response construction, and approval configuration.

| Area | v6 | v7 |
| --- | --- | --- |
| AI packages | ai@^6 and @ai-sdk/react@^3 | ai@^7 and @ai-sdk/react@^4 |
| assistant-ui package | @assistant-ui/react-ai-sdk@1.3.40 | @assistant-ui/ai-sdk |
| Message conversion | await convertToModelMessages(messages) | await convertToModelMessages(messages) |
| Tool schema | inputSchema: zodSchema(z.object({...})) or inputSchema: z.object({...}) | inputSchema: zodSchema(z.object({...})) or inputSchema: z.object({...}) |
| Agent loop | stopWhen: stepCountIs(n) | stopWhen: stepCountIs(n) |
| Response | result.toUIMessageStreamResponse() | createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) }) |
| Approval | tool-level needsApproval | call-level toolApproval |

The old adapter package still re-exports the new API for older installs, but v7 source imports from @assistant-ui/ai-sdk.

## Current v7 route

```ts
// After
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  zodSchema,
} from "ai";
import { z } from "zod";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
    tools: {
      weather: tool({
        inputSchema: zodSchema(z.object({ city: z.string() })),
        execute: async ({ city }) => ({ city }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

The v7 frontend imports useChatRuntime from @assistant-ui/ai-sdk. AssistantChatTransport remains the default and forwards system messages and frontend tools to the backend. A custom non-AssistantChatTransport opts out of that forwarding.

## Approval gates

In v7, toolApproval is configured on streamText instead of declaring needsApproval on each tool. The client useChat call needs sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses so it posts the decision back to the route. In a toolkit renderer, approval.approved is undefined while awaiting a choice, true after approval, and false after rejection. Call respondToApproval(response) to answer.

```ts
// After
const result = streamText({
  model,
  messages: await convertToModelMessages(messages),
  tools: {
    deploy: tool({
      inputSchema: z.object({ target: z.string() }),
      execute: async ({ target }) => ({ deployed: target }),
    }),
  },
  toolApproval: {
    deploy: (input) =>
      input.target === "production" ? "user-approval" : "not-applicable",
  },
});
```

For the complete current runtime shape, read [the AI SDK v7 guide](https://www.assistant-ui.com/docs/runtimes/ai-sdk/v7). For legacy pins and behavior, read [the overview](https://www.assistant-ui.com/docs/runtimes/ai-sdk/overview).
