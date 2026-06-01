# DevTools

Inspect assistant-ui runtime state, context, and events in the browser without `console.log`.

## Installation

```bash
npm install @assistant-ui/react-devtools
```

The package peer-depends on `@assistant-ui/react` (`^0.14.12`); it reads from the same Assistant API context, so it only works inside a runtime provider.

## Basic Setup

Render `<DevToolsModal />` as a child of `AssistantRuntimeProvider`, alongside your assistant UI. In development builds a floating button appears in the lower-right corner; clicking it opens the inspector.

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { Thread } from "@/components/assistant-ui/thread";

export function Assistant() {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DevToolsModal />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Dev-Only by Default

`DevToolsModal` is self-guarding: it returns `null` when `process.env.NODE_ENV === "production"`, so bundlers eliminate it via dead code elimination. You can leave it mounted without shipping the inspector to production and without writing your own environment check.

```tsx
// no manual guard needed; this renders nothing in production builds
<DevToolsModal />
```

Note: the guard keys off `process.env.NODE_ENV`. If your bundler does not define it (some non-standard setups), gate the render yourself.

```tsx
{process.env.NODE_ENV !== "production" && <DevToolsModal />}
```

## Inline Frame

`DevToolsFrame` embeds the same inspector inline instead of behind a modal button. Use it to dock DevTools into a panel of your own layout. It accepts standard iframe props such as `style`.

```tsx
import { DevToolsFrame } from "@assistant-ui/react-devtools";

<div className="h-96 w-full">
  <DevToolsFrame style={{ width: "100%", height: "100%", border: "none" }} />
</div>
```

`DevToolsModal` itself wraps a `DevToolsFrame`, so both surfaces show the same event log, context viewer, and runtime inspector.

## Dark Mode

The modal reads dark mode from the `dark` class on `<html>` or `<body>` and reacts to changes via a `MutationObserver`, matching the shadcn class-based dark mode used by registry components. No configuration is required.

## Chrome Extension

A standalone Chrome extension consumes the same package and connects to any page running assistant-ui, so you can inspect runtime state without adding `DevToolsModal` to your app. Source lives at [`apps/devtools-extension`](https://github.com/assistant-ui/assistant-ui/tree/main/apps/devtools-extension).

## Exports

| Export | Purpose |
|-------|-------|
| `DevToolsModal` | Floating button plus modal overlay; dev-only, no props |
| `DevToolsFrame` | Inline iframe host for the inspector; accepts iframe props |

Lower-level host and frame bridges (`FrameHost`, `DevToolsHost`, `ExtensionHost`, `FrameClient`) and serialization helpers (`sanitizeForMessage`, `serializeModelContext`, `normalizeToolList`) are also exported for building custom hosts such as the Chrome extension. Most apps only need `DevToolsModal`.
