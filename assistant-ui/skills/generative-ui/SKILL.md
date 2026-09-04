---
name: generative-ui
description: "Lets the model compose interfaces at runtime from a component vocabulary instead of one hand-written component per tool, and covers every generative UI pattern in the framework. Use for the model-driven present tool: JSONGenerativeUI, defaultGenerativeUILibrary, and present({ display }) from @assistant-ui/react-generative-ui, registered through AuiConfig({ tools: Tools({ toolkit }) }). Also covers the backend-driven MessagePrimitive.GenerativeUI primitive and its component allowlist for a server that already emits generative-ui message parts, the Slack Block Kit and Microsoft Teams Adaptive Card renderers and their action decoders, A2UI surfaces over AG-UI, and the third-party OpenUI integration. Route here when the model should design its own layout rather than fill one you wrote, when an unknown $type or component name throws or silently renders nothing, when a generative UI tree needs to post to Slack or Teams or paint an A2UI surface, or when generative UI, present tool, or component vocabulary comes up. For a widget tied to one tool call you already know about, use tool-ui in ../tools/SKILL.md instead."
license: MIT
---

# assistant-ui Generative UI

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Generative UI inverts the usual tool-rendering relationship. Instead of one hand-written component per tool call, you ship a vocabulary of components and let something assemble a tree from it: either the model, through the `present` tool, or your backend, through a message part or a LangGraph event. `@assistant-ui/react-generative-ui` ships a default vocabulary of 27 components (cards, facts, tables, charts, forms, controls) plus converters that turn the same tree into Slack Block Kit, a Microsoft Teams Adaptive Card, or an A2UI surface, so a composition built once can render in the browser and outside it.

## References

- [./references/vocabulary.md](./references/vocabulary.md) -- the 27 default components and how to add your own with `defineGenerativeComponents`
- [./references/actions.md](./references/actions.md) -- `$action` dispatch, `createActionRegistry`, and the `$input` shapes interactive components send back
- [./references/renderers.md](./references/renderers.md) -- `MessagePrimitive.GenerativeUI` and its allowlist, the Slack and Teams converters, and why the two spec shapes do not interchange
- [./references/a2ui-openui.md](./references/a2ui-openui.md) -- A2UI surfaces over AG-UI and the third-party OpenUI integration
- [./references/tokens.md](./references/tokens.md) -- the shared token arrays and how to restyle or override the vocabulary

## Which generative UI pattern?

Two questions separate the patterns: does the **model** compose the layout or do you bind it ahead of time, and does the UI originate from a **tool call** or from a part your backend emits.

| Pattern | API | Best for |
|---|---|---|
| The `present` tool | `JSONGenerativeUI` + `present` | The model composes dashboards, cards, and layouts from a vocabulary you ship |
| Tool UI | toolkit `render` (see [tools](../tools/SKILL.md)) | A widget tied to one tool call you already know about |
| Generative UI primitive | `MessagePrimitive.GenerativeUI` + allowlist | A backend that already emits `generative-ui` message parts |
| LangGraph data UI | `makeAssistantDataUI` + `ui_message` | LangGraph agents emitting UI on the LangGraph stream, see [assistant-ui.com/docs/runtimes/langgraph/generative-ui](https://www.assistant-ui.com/docs/runtimes/langgraph/generative-ui) |
| OpenUI | `@openuidev/assistant-ui`, third party | Already invested in the OpenUI ecosystem and its component kit |

The first two are tool-driven, so the model decides when UI appears; the LangGraph row is backend-driven, so your agent does. `present` and the generative UI primitive both take a JSON component tree, but in non-interchangeable shapes, see [Spec shape differences](./references/renderers.md#spec-shape-differences). A tree built for `present` is also the shape the Slack, Teams, and A2UI converters accept.

## Quick start

Install the package, add the styled element, and enable the `"use generative"` compiler for your framework:

```bash
npm install @assistant-ui/react-generative-ui
npx assistant-ui@latest add generative-ui
```

```ts title="next.config.ts"
import { withAui } from "@assistant-ui/next";

export default withAui({
  /* your Next config */
});
```

Vite and TanStack Start use `aui()` from `@assistant-ui/vite` (`plugins: [aui({ ... })]`); Expo and bare React Native use `const { withAui } = require("@assistant-ui/metro");` in `metro.config.js`. The directive lets one file declare tools that both the browser and your server route import: the compiler strips the browser-only halves from the server build and the schemas from the client build.

`JSONGenerativeUI` turns a component library into the model-facing schema for `present`. Register the result on a toolkit like any other tool:

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit } from "@assistant-ui/react";
import {
  JSONGenerativeUI,
  defaultGenerativeUILibrary,
} from "@assistant-ui/react-generative-ui";

const generative = new JSONGenerativeUI({
  library: defaultGenerativeUILibrary,
});

export default defineToolkit({
  present: generative.present({ display: "standalone" }),
});
```

`display: "standalone"` renders the result on its own surface, outside the chain-of-thought trace; omit it to render inline. The default vocabulary is already a working setup with no components of your own, see [vocabulary.md](./references/vocabulary.md) for the full list and how to extend it.

Register the toolkit on the client through `AuiConfig`, and set `sendAutomaticallyWhen` so the run continues once the frontend tool resolves:

```tsx title="app/MyRuntimeProvider.tsx"
"use client";

import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import toolkit from "./toolkit";

export function MyRuntimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  const config = AuiConfig({ tools: Tools({ toolkit }) });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

`present` is a frontend tool: it resolves in the browser, and without `sendAutomaticallyWhen` the UI renders and the conversation stops before the model says anything else.

The route imports the same toolkit module. The compiler resolves that import to the server build, so only the schemas cross over and no browser code enters your server bundle:

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { AISDKToolkit } from "@assistant-ui/ai-sdk";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import toolkit from "@/app/toolkit";

const aiToolkit = new AISDKToolkit({ toolkit });

export async function POST(req: Request) {
  const { messages, tools } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: await aiToolkit.tools({ frontend: tools }),
  });

  return result.toUIMessageStreamResponse();
}
```

When no backend of yours imports the toolkit module, for example a cloud-hosted run, compile with `backendless: true` so the client keeps every schema uploadable, including `present`'s:

```ts title="next.config.ts"
export default withAui({ ...yourConfig, aui: { backendless: true } });
```

## Style it

`npx assistant-ui@latest add generative-ui`, run above, installs the shipped stylesheet plus `components/assistant-ui/elements/generative-ui.tsx`, which exports `styledGenerativeUILibrary`: the same 27 components with a real markdown renderer swapped in for the default plain-text one. It is a `"use client"` module, so wiring it into a `"use generative"` toolkit file follows the client-module rule in the gotchas below; see [tokens.md](./references/tokens.md) for the exact override pattern, the `data-aui` styling hooks, and the token arrays.

## Beyond present

- Extend the vocabulary with your own components, or read back a model-produced tree for display: [vocabulary.md](./references/vocabulary.md).
- Let rendered nodes call back into your app through `$action`: [actions.md](./references/actions.md).
- Render a `generative-ui` message part your backend already emits, with `MessagePrimitive.GenerativeUI` and a consumer-provided allowlist: [renderers.md](./references/renderers.md).
- Post a tree to Slack or Microsoft Teams, or render an A2UI surface over AG-UI, or wire the third-party OpenUI integration: [renderers.md](./references/renderers.md) and [a2ui-openui.md](./references/a2ui-openui.md).

## Common Gotchas

**`present` renders the UI, then the conversation just stops**
- `present` is a frontend tool; without `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` on `useChatRuntime`, the run never continues after it resolves.

**The model never learns about `present` on a cloud-hosted backend**
- The client build skips uploading frontend and human schemas because it assumes your backend imported the same toolkit module. Compile with `aui: { backendless: true }` when no server of yours does.

**`styledGenerativeUILibrary` breaks the `"use generative"` build**
- It is a `"use client"` module. A `"use generative"` file may reference it only as the inline `render` value inside a `defineGenerativeComponents` call, never as a spread, a top-level constant, or the `library` option directly. Passing it straight to `library` works only in a plain file with no `"use generative"` directive; see [tokens.md](./references/tokens.md).

**A `generative-ui` message part renders nothing**
- The default shadcn `Thread` does not wire `MessagePrimitive.GenerativeUI`. Opt in explicitly in your message renderer; see [renderers.md](./references/renderers.md).

**Unknown component name: silent drop versus thrown error**
- The `present` tool path drops an unrecognized `$type` and warns in development. The generative UI primitive throws a typed `GenerativeUIRenderError` unless you pass `Fallback`. Neither boundary constrains the props those components receive; validate `href`/`src` values yourself and never forward agent-supplied props into `dangerouslySetInnerHTML`.

**Slack or Teams output does not match the browser**
- Conversion is total but lossy: read the returned `warnings` array. Only a `$type` tree built for `present` converts; the primitive's `{ component, props }` shape has no Slack, Teams, or A2UI converter.

**`useChatRuntime` never emits a native `generative-ui` part**
- The AI SDK maps tool results to `tool-call` parts, not `generative-ui` parts. Bridge with a `render_gui` tool whose result you parse into a spec yourself (the docs call that helper `parseRenderGuiResult`; it is not a package export); see [renderers.md](./references/renderers.md).

## Related Skills

- [tools](../tools/SKILL.md) -- toolkit authoring, the `"use generative"` compiler, and tool UI for a widget tied to one specific tool call
- [elements](../elements/SKILL.md) -- installing the `generative-ui` styled element and the rest of the catalog
- [primitives](../primitives/SKILL.md) -- `MessagePrimitive` and the other unstyled building blocks
- [runtime](../runtime/SKILL.md) -- `AuiConfig`, `Tools`, and the rest of the config plumbing
