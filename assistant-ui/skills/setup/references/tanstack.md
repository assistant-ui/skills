# Vite / TanStack Start Setup

There is no `create` template for Vite or TanStack Start; wire assistant-ui into an existing Vite project by hand. No dedicated docs page covers this combination as of this writing, so this reference tracks the general Vite integration path rather than a single source page: verify against [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) if the setup drifts.

## Contents

- [Install](#install) | [Vite plugin](#vite-plugin) | [Route and runtime](#route-and-runtime)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/ai-sdk @assistant-ui/vite
npm install @tanstack/react-router @tanstack/react-start
npm install -D vite @vitejs/plugin-react vite-tsconfig-paths
```

## Vite plugin

`@assistant-ui/vite`'s `aui()` plugin is required for `"use generative"` toolkit files to compile (see [tools](../../tools/SKILL.md)); add it alongside TanStack Start's own plugin:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { aui } from "@assistant-ui/vite";

export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] }), tanstackStart(), viteReact(), aui()],
});
```

## Route and runtime

Install the styled Thread through the registry once `components.json` exists (`npx assistant-ui@latest init`, or add it manually per [elements](../../elements/SKILL.md)), then mount it from a route:

```tsx title="src/routes/index.tsx"
import { createFileRoute } from "@tanstack/react-router";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

export const Route = createFileRoute("/")({ component: App });

function App() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="h-dvh">
        <Thread />
      </main>
    </AssistantRuntimeProvider>
  );
}
```

A TanStack Start server route can host the AI SDK backend directly (see [ai-sdk.md](./ai-sdk.md)) since Start ships its own server functions; a plain Vite SPA instead needs a separate API server, or a [custom backend](./custom-backend.md) runtime pointed at it. `npx assistant-ui@latest create my-app -e with-tanstack` scaffolds a complete reference project.
