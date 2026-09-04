# DevTools

`@assistant-ui/react-devtools` inspects assistant-ui state, context, and events in the browser without `console.log`.

## Install

```bash
npm install @assistant-ui/react-devtools
```

Peer-depends on `@assistant-ui/react` `^0.15.0` and `@assistant-ui/tap` `^0.9.0`; it reads from the same Assistant API context, so it only works inside a runtime provider.

## Mount

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { DevToolsModal } from "@assistant-ui/react-devtools";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export function AssistantApp() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DevToolsModal />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

A launcher appears in the lower-right corner in development builds; the panel renders inline in an isolated shadow root. `DevToolsModal` self-guards on `process.env.NODE_ENV === "production"` (returns `null`, eliminated by dead-code elimination), so it is safe to leave mounted without a manual environment check.

## Custom tabs

Pass extra inspector tabs via `plugins`; each renders from the inspected instance's projected `state`, `logs`, `modelContext`, and `scopes`:

```tsx
import { createDevToolsPlugin, DevToolsModal } from "@assistant-ui/react-devtools";

const stateTab = createDevToolsPlugin({
  id: "my-state",
  label: "My state",
  Component: ({ data }) => <pre>{JSON.stringify(data.state, null, 2)}</pre>,
});

// <DevToolsModal plugins={[stateTab]} />
```
