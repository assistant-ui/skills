# react-o11y

`@assistant-ui/react-o11y` is experimental. It provides headless primitives for displaying span data as a collapsible trace tree or shared timeline. It does not collect backend telemetry. Supply your own spans from Langfuse, LangSmith, Helicone, or another source.

## Install

```sh
npm install @assistant-ui/react-o11y
```

## Mount SpanResource

Mount the resource with `AuiConfig` and an isolated provider. `SpanPrimitive.Children` creates a scope for every visible row, so the row reads one span without receiving it as a prop.

```tsx
"use client";

import {
  SpanPrimitive,
  SpanResource,
  type SpanData,
} from "@assistant-ui/react-o11y";
import { AuiConfig, AuiProvider } from "@assistant-ui/store";

function SpanRow() {
  return (
    <SpanPrimitive.Root className="flex items-center gap-2 py-1">
      <SpanPrimitive.Indent />
      <SpanPrimitive.CollapseToggle className="size-4 cursor-pointer">
        ▸
      </SpanPrimitive.CollapseToggle>
      <SpanPrimitive.StatusIndicator className="size-2 rounded-full data-[span-status=running]:bg-yellow-500 data-[span-status=completed]:bg-green-500 data-[span-status=failed]:bg-red-500" />
      <SpanPrimitive.TypeBadge className="rounded bg-muted px-1.5 text-xs" />
      <SpanPrimitive.Name className="text-sm" />
    </SpanPrimitive.Root>
  );
}

export function TraceView({ spans }: { spans: SpanData[] }) {
  const config = AuiConfig({ span: SpanResource({ spans }) });

  return (
    <AuiProvider extends={null} config={config}>
      <SpanPrimitive.Children components={{ Span: SpanRow }} />
    </AuiProvider>
  );
}
```

`SpanResource` derives depth, child presence, a common time range, and visible rows. It repairs a missing parent reference to a root relationship and removes a detected parent cycle at the cycle point. Collapsing a row removes its descendants from the visible flat list.

## Span contracts

`SpanData` is the complete raw input shape.

```ts
type SpanData = {
  id: string;
  parentSpanId: string | null;
  name: string;
  type: string;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: number;
  endedAt: number | null;
  latencyMs: number | null;
};
```

`SpanItemState` is one computed visible span. `SpanState` is the same shape with the child list and shared range added.

```ts
type SpanItemState = {
  id: string;
  parentSpanId: string | null;
  name: string;
  type: string;
  status: "running" | "completed" | "failed" | "skipped";
  startedAt: number;
  endedAt: number | null;
  latencyMs: number | null;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
};

type SpanState = SpanItemState & {
  children: SpanItemState[];
  timeRange: { min: number; max: number };
};
```

## SpanPrimitive parts

The exported `SpanPrimitive` namespace has these parts.

- `Root` renders a `div` for the current span.
- `Name` renders a `span` whose default children are `span.name`.
- `TypeBadge` renders a `span` whose default children are `span.type`.
- `StatusIndicator` renders an empty `span` for a status glyph or color.
- `CollapseToggle` renders a button only when the span has children and toggles collapse without propagating the click.
- `Indent` renders a `div` with `paddingLeft = baseIndent + depth * indentPerLevel`. The defaults are `8` and `12` pixels.
- `Children` renders every visible child span with either a render function or a stable `components={{ Span: SpanRow }}` component.
- `Timeline` renders a `div` that provides a shared time range to descendant bars.
- `TimelineBar` renders a positioned `div` for the current span within the nearest timeline range.

The implementation contains an internal `ChildByIndex` component, but `primitives/span.ts` does not export it. For explicit index scope, use the exported `SpanByIndexProvider` directly.

```tsx
import { SpanByIndexProvider, SpanPrimitive } from "@assistant-ui/react-o11y";

<SpanByIndexProvider index={0}>
  <SpanPrimitive.Root>
    <SpanPrimitive.Name />
  </SpanPrimitive.Root>
</SpanByIndexProvider>;
```

## Data attributes and timeline variables

`Root` exposes `data-span-id`, `data-span-status`, `data-span-type`, `data-span-depth`, and `data-collapsed`. `Indent` exposes `data-span-depth`. `CollapseToggle` exposes `data-collapsed`; `StatusIndicator` exposes `data-span-status`; `TypeBadge` exposes `data-span-type`.

`Timeline` exposes `data-span-timeline` plus `--span-timeline-min-ms`, `--span-timeline-max-ms`, and `--span-timeline-range-ms`. `TimelineBar` exposes `data-span-status`, `data-span-type`, and `data-span-running` while `endedAt` is `null`. It writes `--span-timeline-left`, `--span-timeline-end`, `--span-timeline-width`, and `--span-timeline-duration-ms`, and honors a consumer supplied `--span-timeline-min-width`.

```tsx
<SpanPrimitive.Timeline className="relative">
  <SpanPrimitive.Children>
    {() => (
      <div className="relative h-8">
        <SpanPrimitive.TimelineBar className="top-1 h-6 rounded bg-blue-500" />
      </div>
    )}
  </SpanPrimitive.Children>
</SpanPrimitive.Timeline>
```

`Timeline` accepts an optional `timeRange` and `paddingEnd`. `TimelineBar` accepts an optional `now` and `timeRange`. Without `now`, a running bar uses the range maximum, which keeps server rendering and hydration deterministic.

## Styled option

[TraceWaterfall](https://www.assistant-ui.com/elements/trace-waterfall) is the copied styled element for a flat message and tool waterfall. It accepts its own `TraceSpan` fields of `id`, `name`, `depth`, `startMs`, `durationMs`, and `status`, plus `totalMs` and `visibleCount`. It does not consume `SpanData` or `SpanResource`, and it does not infer nesting. Use it when message stream timing and tool call timing are already available from the assistant runtime.
