---
name: observability
description: "Instruments assistant-ui AI SDK backend routes with Langfuse, LangSmith, or Helicone, and renders independent trace data with the experimental @assistant-ui/react-o11y SpanResource and SpanPrimitive APIs. Use it when traces are missing, serverless spans are dropped, an AI SDK call needs provider metadata, Helicone is not proxying a provider, or a trace tree or timeline needs rendering. For streaming transport use streaming, for initial application wiring use setup, for Assistant Cloud persistence use cloud, and for copied styled trace UI use elements."
license: MIT
---

# assistant-ui Observability

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Observability has two separate layers. Langfuse, LangSmith, and Helicone instrument backend model calls. `@assistant-ui/react-o11y` renders span data already collected by your application. It does not send traces to a provider or derive spans from the assistant runtime.

## References

- [./references/langfuse.md](./references/langfuse.md) -- OpenTelemetry setup, trace attributes, and serverless flushing for Langfuse.
- [./references/langsmith.md](./references/langsmith.md) -- `wrapAISDK`, metadata, and serverless flushing for LangSmith.
- [./references/helicone.md](./references/helicone.md) -- Helicone proxy setup for AI SDK and OpenAI SDK routes.
- [./references/react-o11y.md](./references/react-o11y.md) -- `SpanResource`, every exported span primitive part, span contracts, timeline attributes, and the styled TraceWaterfall option.

## Choose the backend integration

Use one provider based on the data model you need.

- **Langfuse** receives the OpenTelemetry spans AI SDK emits when `experimental_telemetry` is enabled. Use it for a hierarchical trace across an agent turn, tool calls, and model calls.
- **LangSmith** wraps AI SDK functions through `wrapAISDK(ai)`. Use it when traces, evaluations, and prompt management belong with LangChain or LangGraph tooling.
- **Helicone** proxies the provider request. Use it for request logs, costs, latency, and prompt diffs without changing the AI SDK call shape.

Langfuse and Helicone can run together because one consumes OpenTelemetry spans while the other proxies provider traffic. LangSmith is its own wrapper path, so use its wrapped AI SDK functions instead of the originals.

## Implementation order

1. Select the provider integration that owns the telemetry destination.
2. Add its server environment variables and startup instrumentation or provider configuration.
3. Instrument one route and verify a real request reaches the provider dashboard.
4. Add serverless flushing before treating traces as reliable in production.
5. Render a separate `SpanData[]` feed with react-o11y only when the product needs an in app trace view.

## Route handler boundary

Keep provider credentials and instrumentation on the server. Every example uses `openai("gpt-5.6-luna")`, awaits `convertToModelMessages(messages)`, and returns the AI SDK UI message response. The integration pages do not use an assistant-ui route helper. If a route needs one, import it from `@assistant-ui/ai-sdk`; `@assistant-ui/react-ai-sdk` re-exports the same API for older installs.

Resolve trace attributes from real auth and thread state. Do not put a provider key, Langfuse user ID, LangSmith metadata, or Helicone header in a client component.

## Render collected spans

`SpanResource({ spans })` accepts the complete raw `SpanData[]` list, normalizes parent relationships, sorts visible spans by start time, and owns collapse state. Mount it at an isolated provider root:

```tsx
const config = AuiConfig({ span: SpanResource({ spans }) });

<AuiProvider extends={null} config={config}>
  <SpanPrimitive.Children components={{ Span: SpanRow }} />
</AuiProvider>;
```

The `SpanRow` component is automatically scoped to one visible span. Use `SpanPrimitive.Timeline` and `SpanPrimitive.TimelineBar` when rows must share a time axis. Use the copied `TraceWaterfall` element when a styled flat message and tool waterfall better fits the data you have.

## Common Gotchas

**Traces disappear on Vercel, Lambda, or another serverless runtime**

- Langfuse needs `await langfuseSpanProcessor.forceFlush()` before the function exits, or a deployment specific `waitUntil` path.
- LangSmith needs `await client.awaitPendingTraceBatches()` before the function exits.

**Langfuse has no spans**

- Set `experimental_telemetry: { isEnabled: true }` on each traced `streamText` or `generateText` call.
- Register `LangfuseSpanProcessor` only in the Node runtime. OpenTelemetry does not run in the edge runtime.

**LangSmith does not trace the route**

- Call the destructured functions from `wrapAISDK(ai)`, not the originals from `ai`.
- Set `LANGSMITH_TRACING=true` in the runtime environment.

**Helicone traffic still goes directly to OpenAI**

- The provider `baseURL` must be `https://oai.helicone.ai/v1` and the request must carry `Helicone-Auth` as well as the provider authorization header.

**A react-o11y view renders no rows**

- Mount `SpanResource` with `AuiConfig({ span: SpanResource({ spans }) })` and render beneath `<AuiProvider extends={null} config={config}>`.
- Pass a complete `SpanData[]` list. `SpanPrimitive.Children` reads the current span scope and does not fetch traces.

**A documented span component is missing**

- `SpanPrimitive.ChildByIndex` is not re-exported by the current source. Use the exported `SpanByIndexProvider` with a row component when explicit index scoping is necessary.

## Related Skills

- [streaming](../streaming/SKILL.md) -- AI SDK stream transport and route response handling.
- [setup](../setup/SKILL.md) -- Project creation, CLI setup, and runtime installation.
- [cloud](../cloud/SKILL.md) -- Assistant Cloud persistence and run reporting configuration.
- [elements](../elements/SKILL.md) -- Copied styled elements, including TraceWaterfall.
