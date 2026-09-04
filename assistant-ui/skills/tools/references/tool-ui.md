# Tool UI

A tool call renders through the `render` (or `renderText`) field of its toolkit entry. The renderer receives the live call, so it covers the streaming arguments, the running state, the result, and any question the runtime raises before the tool may proceed.

## Contents

- [Renderer props](#renderer-props) | [Status states](#status-states) | [renderText and display](#rendertext-and-display) | [Streaming arguments](#streaming-arguments) | [Partial results](#partial-results) | [Deferred rendering](#deferred-rendering) | [Renderers that need component state](#renderers-that-need-component-state) | [Elapsed time](#elapsed-time) | [ToolFallback and ToolGroup](#toolfallback-and-toolgroup) | [Data parts](#data-parts)

## Renderer props

`ToolCallMessagePartProps<TArgs, TResult>` is the full tool-call part plus three callbacks.

| Field | Type | Description |
| --- | --- | --- |
| `args` | `TArgs` | Parsed arguments, partial while the model is still streaming them |
| `argsText` | `string` | Raw, possibly partial JSON |
| `result` | `TResult \| undefined` | The result, once the call has one |
| `isError` | `boolean \| undefined` | Whether the result represents a failure |
| `status` | `ToolCallMessagePartStatus` | See below |
| `toolName` | `string` | The name the model called |
| `toolCallId` | `string` | Stable id for this invocation |
| `timing` | `ToolCallTiming \| undefined` | Wall clock start and completion, when tracked |
| `interrupt` | `{ type: "human"; payload: unknown } \| undefined` | A paused `human()` request |
| `approval` | object `\| undefined` | Approval gate state: `id`, `approved?`, `options?`, `optionId?`, `resolution?` |
| `addResult` | `(result) => void` | Sets this part's result from the renderer instead of an executor |
| `resume` | `(payload: unknown) => void` | Resumes a paused frontend execution |
| `respondToApproval` | `(response: ToolApprovalResponse) => Promise<void>` | Answers an approval gate |

Type a standalone renderer with `ToolCallMessagePartComponent`.

```tsx
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";

type Args = { query: string };
type Result = { results: { title: string; url: string }[] };

export const WebSearchToolUI: ToolCallMessagePartComponent<Args, Result> = ({
  args,
  status,
  result,
}) => (
  <div>
    <span>Search results for: {args.query}</span>
    {status.type === "running" && <LoadingSpinner />}
    {result?.results.map((item) => (
      <a key={item.url} href={item.url}>
        {item.title}
      </a>
    ))}
  </div>
);
```

## Status states

```tsx
render: ({ status }) => {
  switch (status.type) {
    case "running":
      return <LoadingState />;
    case "requires-action":
      return <UserInputRequired reason={status.reason} />;
    case "incomplete":
      if (status.reason === "cancelled") return <div>Operation cancelled</div>;
      if (status.reason === "error") return <ErrorDisplay error={status.error} />;
      return <div>Failed: {status.reason}</div>;
    case "complete":
      return <SuccessDisplay />;
  }
};
```

`requires-action` carries `reason: "tool-calls" | "interrupt"`. Handle every branch: a renderer that assumes `result` is defined crashes on the running and cancelled paths.

## renderText and display

`renderText` replaces a component with a one-line status. Each of `running` and `complete` is a string or a function of `({ args, result })`.

```tsx
renderText: {
  running: ({ args }) => `Searching for ${args.query}`,
  complete: "Search complete",
},
```

`display` on the entry is `"inline"` by default, which lets the tool card sit inside the collapsed tool group. Set `display: "standalone"` for UI that should stand on its own, such as a human-in-the-loop form or a generative surface for a backend tool.

## Streaming arguments

`useToolArgsStatus` reports per-field streaming state inside a tool-call renderer. Each top-level key of the args object moves from `"streaming"` to `"complete"` as the partial JSON arrives.

```tsx
import { useToolArgsStatus } from "@assistant-ui/react";

const toolkit = defineToolkit({
  submit_form: {
    type: "backend",
    render: ({ args }) => {
      const { propStatus } = useToolArgsStatus<{ email: string; phone: string }>();
      return (
        <form>
          <input
            value={args.email ?? ""}
            className={propStatus.email === "streaming" ? "loading" : ""}
            disabled
          />
          <input
            value={args.phone ?? ""}
            className={propStatus.phone === "streaming" ? "loading" : ""}
            disabled
          />
        </form>
      );
    },
  },
});
```

## Partial results

A streaming executor can publish intermediate results, so read `result` defensively while `status.type === "running"`.

```tsx
render: ({ result, status }) => (
  <div>
    {status.type === "running" && <Progress value={result?.progress ?? 0} />}
    {(result?.insights ?? []).map((insight: string, i: number) => (
      <p key={i}>{insight}</p>
    ))}
  </div>
),
```

## Deferred rendering

When partial arguments would render a misleading intermediate state, or the component is expensive to mount, return `null` until the call completes. The arguments still stream into `args`; you just ignore them until then.

```tsx
render: ({ args, status }) => {
  if (status.type !== "complete") return null;
  return <Chart title={args.title} data={args.series} />;
},
```

To place the component outside the message parts, gate at the message level with `AuiIf` and read the captured part from `s.message.parts`.

```tsx
import { AuiIf, MessagePrimitive, useAuiState } from "@assistant-ui/react";

function PostMessageCard() {
  const parts = useAuiState((s) => s.message.parts);
  const chartCall = parts.find(
    (p) => p.type === "tool-call" && p.toolName === "render_chart",
  );
  if (!chartCall) return null;
  return <Chart {...chartCall.args} />;
}

<MessagePrimitive.Root>
  <MessagePrimitive.Parts />
  <AuiIf
    condition={(s) =>
      s.message.role === "assistant" && s.message.status?.type === "complete"
    }
  >
    <PostMessageCard />
  </AuiIf>
</MessagePrimitive.Root>;
```

## Renderers that need component state

A `render` field is static. When the UI needs props or state from the component tree, build the toolkit in a hook with `useInlineRender` and mount it on a scoped provider.

```tsx title="inventory-toolkit.tsx"
"use client";

import { defineToolkit, useInlineRender } from "@assistant-ui/react";
import { useMemo } from "react";

export function useInventoryToolkit(productId: string) {
  const renderInventory = useInlineRender(({ result }) => (
    <p>
      Stock for {productId}: {result.quantity} in {result.warehouse}
    </p>
  ));

  return useMemo(
    () =>
      defineToolkit({
        check_inventory: { type: "backend", render: renderInventory },
      }),
    [renderInventory],
  );
}
```

```tsx title="ProductPage.tsx"
import { AuiConfig, AuiProvider, Tools, useAui } from "@assistant-ui/react";
import { useInventoryToolkit } from "./inventory-toolkit";

function ProductPage({ productId }: { productId: string }) {
  const toolkit = useInventoryToolkit(productId);
  const aui = useAui();
  const config = AuiConfig({ tools: Tools({ toolkit }) });
  return (
    <AuiProvider extends={aui} config={config}>
      <div>Product details</div>
    </AuiProvider>
  );
}
```

`useInlineRender` keeps the renderer identity stable, so the tool subtree is not remounted on every parent render.

## Elapsed time

`useToolCallElapsed()` returns the elapsed milliseconds of the current tool call, ticking once per second while it runs. It reads `part.timing` and returns `undefined` outside a tool-call scope, when no timing was recorded, or when the call ended without a recorded completion.

```tsx
import { useToolCallElapsed } from "@assistant-ui/react";

function ToolDuration() {
  const elapsedMs = useToolCallElapsed();
  if (elapsedMs === undefined) return null;
  return <span>{(elapsedMs / 1000).toFixed(1)}s</span>;
}
```

## ToolFallback and ToolGroup

A tool call with no registered renderer falls back to the `ToolFallback` element: a collapsed one-line summary that opens into the arguments, the result, and the approval controls when the call is waiting on a decision. `ToolGroup` collapses consecutive tool calls in one turn behind a single row. Both are copied into your project by the CLI.

```bash
npx assistant-ui@latest add tool-fallback tool-group
```

Replace the fallback for every unregistered tool with `<Thread components={{ ToolFallback: MyToolCard }} />`; a tool with its own renderer still wins. `ToolFallback` renders declared approval options automatically, including the confirmation step. Both elements are documented in the [elements skill](../../elements/SKILL.md).

## Data parts

Tool UI is for calls the model makes. When the backend or orchestrator decides what to render and pushes a named data event onto the assistant message, register the renderer with `makeAssistantDataUI` instead: data parts arrive as terminal events, so the renderer fires once with the final data and needs no deferred pattern.

```tsx
import { makeAssistantDataUI } from "@assistant-ui/react";

export const ChartUI = makeAssistantDataUI<{ series: number[]; title: string }>({
  name: "chart",
  render: ({ data }) => <Chart title={data.title} series={data.series} />,
});
```

Mount `<ChartUI />` once inside the provider tree; it renders nothing itself and only registers the renderer. `useAssistantDataUI` is the hook form. For UI the model composes from a vocabulary you ship, see the [generative-ui skill](../../generative-ui/SKILL.md).
