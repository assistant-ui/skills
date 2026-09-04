# A2UI and OpenUI

Two more ways a generative UI tree reaches the screen: [A2UI](https://a2ui.org/) surfaces arriving over AG-UI, converted into the same `present`-shaped tree this skill covers everywhere else; and [OpenUI](https://www.openui.com), a separate third-party protocol and renderer that plugs into assistant-ui through the Tool UI lifecycle instead.

## Contents

- [A2UI over AG-UI](#a2ui-over-ag-ui)
- [OpenUI](#openui)

## A2UI over AG-UI

A2UI is a declarative generative UI protocol: the agent streams surface operations (create a surface, upsert components, update a data model) and the host renders them from a pre-approved component catalog, with no code over the wire. The AG-UI ecosystem carries A2UI as `ACTIVITY_SNAPSHOT` events with `activityType: "a2ui-surface"` and the operations under `content.a2ui_operations`, the convention emitted by [`@ag-ui/a2ui-middleware`](https://github.com/ag-ui-protocol/ag-ui/tree/main/middlewares/a2ui-middleware).

`useAgUiRuntime` consumes these snapshots natively. Each surface becomes one tool-call part with `toolCallId` `a2ui:<surfaceId>` and `toolName` `"present"`, whose args are the converted generative UI spec, so surfaces render through the same path as the `present` frontend tool. Snapshots with any other `activityType` are ignored.

### Wire contract

```json
{
  "type": "ACTIVITY_SNAPSHOT",
  "messageId": "a2ui-surface-call_1",
  "activityType": "a2ui-surface",
  "replace": true,
  "content": {
    "a2ui_operations": [
      { "version": "v0.9", "createSurface": { "surfaceId": "s1" } },
      {
        "version": "v0.9",
        "updateComponents": {
          "surfaceId": "s1",
          "components": [
            { "id": "root", "component": "Card", "title": "Order", "children": ["total"] },
            { "id": "total", "component": "Text", "text": { "path": "/total" } }
          ]
        }
      },
      {
        "version": "v0.9",
        "updateDataModel": { "surfaceId": "s1", "path": "/", "contents": { "total": "$42" } }
      }
    ]
  }
}
```

- `replace: true` (the schema default, and what the middleware always emits) rebuilds that `messageId`'s surface state from the operations it carries; `replace: false` is ignored once that `messageId` has been seen.
- Surfaces are keyed by the `surfaceId` inside the operations, not by `messageId`. Multiple snapshots sharing a `messageId` update their surfaces in place, and the synthesized part keeps its `toolCallId`, so a surface updates without duplicating parts.
- Component trees use the A2UI adjacency-list model: nodes reference children by id, the root node has id `root`, and props of shape `{ "path": "/x/y" }` are JSON Pointer bindings resolved against the surface data model. Both v0.9 and v1.0 operation payloads are accepted, including v1.0's inline `components`/`dataModel` on `createSurface`.
- A lifecycle snapshot carrying a `status` (such as `"building"`) but no `a2ui_operations` is tolerated and produces no part until operations arrive. `deleteSurface` removes the surface's part.
- The `a2ui:` tool-call id prefix is reserved for synthesized surface parts, excluded from the history sent back to the agent, so a genuine agent tool call must not use an id starting with `a2ui:`.

### Quick start

Register the `present` frontend tool as in the main quick start; incoming surfaces then render with the default vocabulary, with no other configuration on `useAgUiRuntime`:

```tsx
import {
  JSONGenerativeUI,
  defaultGenerativeUILibrary,
} from "@assistant-ui/react-generative-ui";

const generative = new JSONGenerativeUI({ library: defaultGenerativeUILibrary });

const toolkit = {
  present: generative.present({ display: "standalone" }),
};
```

### Actions

`Button` nodes dispatch `$action` objects with type `"a2ui:action"`. Wire the registry to `useAgUiSendA2uiAction` inside a component; the hook returns a stable function, so the toolkit can be memoized on it:

```tsx
import { useMemo } from "react";
import { useAgUiSendA2uiAction } from "@assistant-ui/react-ag-ui";
import {
  JSONGenerativeUI,
  createActionRegistry,
  defaultGenerativeUILibrary,
} from "@assistant-ui/react-generative-ui";

function useA2uiToolkit() {
  const sendA2uiAction = useAgUiSendA2uiAction();
  return useMemo(() => {
    const generative = new JSONGenerativeUI({
      library: defaultGenerativeUILibrary,
      actions: createActionRegistry({
        "a2ui:action": ({ payload }) => sendA2uiAction(payload),
      }),
    });
    return { present: generative.present({ display: "standalone" }) };
  }, [sendA2uiAction]);
}
```

Sending an action triggers a run with no new user message; the agent receives it as `forwardedProps.a2uiAction.userAction`, the convention `@ag-ui/a2ui-middleware` consumes. The middleware turns it into a synthetic `log_a2ui_event` tool-call pair that is never declared in `input.tools`, so a backend that validates tool calls against the declared tool list will reject it.

### Component mapping

The converter maps the A2UI basic catalog onto the default generative UI vocabulary: `Text` becomes `Markdown` (heading variants `h1` to `h6` become `Header`, `caption` becomes `Caption`), `Column` becomes `Col`, `TextField` becomes `Input` (its name derived from the last segment of its binding path), `CheckBox` becomes `Checkbox`, and `Image`, `Row`, `Card`, `Divider`, `Button` map one to one. A node with template children expands into a `ListView` over the bound list. Unknown components and operations are skipped with a debug warning, and conversion is bounded (depth 32, 100 template items, 5000 nodes) so a malformed stream cannot hang the client.

### Limitations

The upstream middleware currently emits v0.9 operation payloads; the renderer accepts both v0.9 and v1.0 shapes.

## OpenUI

[`@openuidev/assistant-ui`](https://www.npmjs.com/package/@openuidev/assistant-ui) is a **third-party package**, owned and versioned by OpenUI, not assistant-ui. It connects [OpenUI](https://www.openui.com)'s renderer, model instructions, and streaming markup language ("OpenUI Lang") to an assistant-ui conversation. Use OpenUI's own [reference](https://www.openui.com/docs/api-reference/assistant-ui) for the package API; this section covers only the assistant-ui side of the wiring.

The integration rides on the Tool UI lifecycle (see [tools](../../tools/SKILL.md)), so assistant-ui stays in charge of the conversation, streaming, and tool calls. It differs from `present` in representation and ownership: `present` takes a JSON tree validated against a schema generated from a vocabulary you ship and restyle; OpenUI's `present_openui` takes an OpenUI Lang program rendered by OpenUI's own component kit, taught to the model through generated instructions. Pick `present` to build the interface from your own components on assistant-ui's surface, OpenUI when you are already invested in its ecosystem.

The toolkit registers two tools: `present_openui`, a **frontend tool** for display-only interfaces that completes as soon as the streamed `ui` argument is available; and `prompt_openui`, a **human tool** for forms and choices that completes only when the user submits an OpenUI `@ToAssistant(...)` action.

### Quick start

```bash
npm install @openuidev/assistant-ui @openuidev/react-ui @openuidev/react-lang @openuidev/react-headless zustand@^4.5.5
```

```css title="app/globals.css"
@import "@openuidev/react-ui/layered/styles/index.css";
```

```tsx title="app/page.tsx"
"use client";

import { AssistantRuntimeProvider, AuiConfig, Tools } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { OpenUIInstructions, openuiIntegration } from "@openuidev/assistant-ui";
import { shouldContinueAfterOpenUIPrompt } from "@openuidev/assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function Home() {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: shouldContinueAfterOpenUIPrompt,
  });

  const config = AuiConfig({
    tools: Tools({ toolkit: openuiIntegration.toolkit }),
  });

  return (
    <AssistantRuntimeProvider config={config} runtime={runtime}>
      <OpenUIInstructions />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

`sendAutomaticallyWhen` takes one predicate. `shouldContinueAfterOpenUIPrompt` is a strict refinement of `lastAssistantMessageIsCompleteWithToolCalls` that only continues after `prompt_openui` receives a submitted result, so a display-only `present_openui` call ends the turn instead of triggering an empty follow-up. If your app mixes in other tools whose flows must also resume, write one predicate that decides by tool name; a naive `||` with the generic predicate collapses to the generic predicate alone and re-enables the empty follow-up after display-only calls.

The default `AssistantChatTransport` forwards the registered instructions and both frontend tool schemas to the backend, so a route built with `frontendTools` from `@assistant-ui/ai-sdk` stays generic and needs no OpenUI-specific code, following the same shape as [tools](../../tools/SKILL.md)'s backend route.

### Interaction, replay, and customization

When the user submits a `prompt_openui` form or choice, the integration reports the action, message, parameters, and form state through the standard human-tool `addResult`, and `sendAutomaticallyWhen` resumes the run with that result. On replay of a persisted thread, the stored result hydrates the submitted form state back into the renderer, so a completed form renders as submitted rather than resetting.

`createOpenUIIntegration({ library, presentToolName?, promptToolName? })` keeps a custom component library, tool names, and renderer options aligned across the toolkit and the instructions, returning `{ toolkit, instructions, toolNames }`. See [OpenUI's integration reference](https://www.openui.com/docs/api-reference/assistant-ui) for the full option surface.
