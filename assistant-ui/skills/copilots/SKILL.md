---
name: copilots
description: "Grounding an assistant in your app with assistant-ui copilots (@assistant-ui/react). Use when steering assistant behavior with useAssistantInstructions, feeding lazy send-time app state through useAssistantContext({ getContext }), exposing rendered components to the assistant with makeAssistantVisible(Component, { clickable, editable }), giving the model two-way component state through interactables (unstable_useInteractable for app-scoped panels, unstable_interactableTool inside defineToolkit for thread-scoped artifacts, both mounted via AuiConfig({ unstable_interactables: unstable_Interactables() })), registering instructions and tools together imperatively with aui.modelContext.register({ getModelContext }), or bridging model context across an iframe boundary with AssistantFrameProvider and useAssistantFrameHost. The legacy Interactables() scope, useAssistantInteractable, and useInteractableState are deprecated since 2026-06-14 and scheduled for removal on or after 2026-09-14; new code uses the unstable_ API. Reach for this when the assistant should read the current page, click or edit UI, read and update component state through auto-generated update_{name} tools, or receive tools and instructions from a sandboxed iframe. For LLM tools and tool-call UI use the tools skill; for runtime and thread state use the runtime skill."
license: MIT
---

# assistant-ui Copilots

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Copilots ground an assistant in your running app: steer it with instructions, feed it lazy app state, let it read and drive rendered components, give it two way state through interactables, and share model context across an iframe boundary.

## References

- [./references/instructions.md](./references/instructions.md) -- useAssistantInstructions
- [./references/model-context.md](./references/model-context.md) -- useAssistantContext, imperative modelContext().register, ModelContextRegistry
- [./references/visible.md](./references/visible.md) -- makeAssistantVisible
- [./references/interactables.md](./references/interactables.md) -- app-scoped and thread-scoped interactables, versions, persistence, partial updates
- [./references/assistant-frame.md](./references/assistant-frame.md) -- AssistantFrameProvider and useAssistantFrameHost

## Orientation

All APIs ship from `@assistant-ui/react` and run inside `AssistantRuntimeProvider`. Pick the smallest tool for the job:

```
What do you need the assistant to know or do?
├─ Steer behavior with a system prompt → useAssistantInstructions("...")
├─ Feed read-only app state (page, selection, cart) → useAssistantContext({ getContext })
├─ Let it read / click / edit a rendered component → makeAssistantVisible(Component, { clickable, editable })
├─ Read AND write persistent component state via tools
│    ├─ Mounted by you, anywhere in the app → unstable_useInteractable(name, config)
│    └─ Created by the model, inline in the thread → unstable_interactableTool(config) inside defineToolkit
├─ Register instructions + tools together imperatively → aui.modelContext.register({ getModelContext })
└─ Share tools/instructions with a parent window from an embedded iframe → AssistantFrameProvider + useAssistantFrameHost
```

Instructions and context are the lightweight starting point. Reach for `makeAssistantVisible` when the assistant needs to perceive or drive existing DOM, and for interactables when it needs structured two-way state it can mutate through auto-generated `update_{name}` tools.

Interactables have two generations. The current one is the `unstable_` family (`unstable_Interactables()`, `unstable_useInteractable`, `unstable_interactableTool`); the prefix flags it as subject to change, not as unsupported. The legacy family (`Interactables()`, `useAssistantInteractable`, `useInteractableState`) is deprecated as of 2026-06-14 and scheduled for removal on or after 2026-09-14. The two scopes are mutually exclusive: mount only one interactables API in one `AuiConfig`.

```tsx
import { useAssistantInstructions, useAssistantContext } from "@assistant-ui/react";

function CheckoutCopilot() {
  useAssistantInstructions("You help users complete checkout. Be concise.");
  useAssistantContext({ getContext: () => `Current page: ${window.location.href}` });
  return null;
}
```

`getContext` is evaluated fresh each time the model context is read, so it always reflects current state. Register imperatively when instructions and tools need to ship from the same provider:

```tsx
import { useAui } from "@assistant-ui/react";
import { useEffect } from "react";

function SearchCopilot() {
  const aui = useAui();
  useEffect(() => {
    return aui.modelContext.register({
      getModelContext: () => ({
        system: "You are a helpful search assistant.",
        tools: { search: mySearchTool },
      }),
    });
  }, [aui]);
  return null;
}
```

`register` returns an unsubscribe function; returning it from `useEffect` cleans up the provider on unmount. Multiple providers compose: `system` strings concatenate and `tools` maps merge.

## Interactables scope

Mount the scope once through `config`. App-scoped and thread-scoped interactables both need it; thread-scoped ones also need their toolkit registered.

```tsx
import { AuiConfig, AssistantRuntimeProvider, unstable_Interactables } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function Providers({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const config = AuiConfig({ unstable_interactables: unstable_Interactables() });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

`unstable_useInteractable(name, config)` then registers an instance and returns `[state, { id, setState, isPending, error, flush }]`; the framework generates an `update_{name}` tool from a partial version of your `stateSchema`. See [interactables.md](./references/interactables.md) for the thread-scoped form, versions, persistence, and how partial updates merge.

## Common Gotchas

**Assistant ignores instructions or context**
- The hook or `register` call must run inside `AssistantRuntimeProvider`.
- For `aui.modelContext.register`, call it in `useEffect` and return the result so it unsubscribes; registering in render leaks providers.

**Context is stale**
- Use the `getContext` callback form, not a captured value. It is re-read at send time, so closures over fresh state work; a precomputed string will not update.

**makeAssistantVisible does nothing**
- Without options the component is read-only (exposes its `outerHTML`). Pass `{ clickable: true }` to allow clicks and `{ editable: true }` for `<input>` / `<textarea>` editing. Nested visible components expose only the outermost.

**Interactable resets its state on every render**
- Define `stateSchema` and `initialState` outside the component (or memoize them). A new schema identity on every render re-registers the interactable and wipes its state.

**Two interactables scopes registered at once**
- `unstable_Interactables()` and the legacy `Interactables()` are mutually exclusive. Keep exactly one in `AuiConfig`; new code uses `unstable_Interactables()`.

**Partial updates don't land the way you expect**
- Plain fields merge shallowly: the model sends only what changed, and a nested object it sends replaces that field rather than deep-merging into it.
- Array fields whose items carry an `id` take operations (`add` / `update` / `remove` / `clear`) instead of a replacement array.

**Frame host never receives tools or instructions**
- Both sides validate message origin. The iframe's `AssistantFrameProvider.addModelContextProvider(registry, targetOrigin)` and the parent's `useAssistantFrameHost({ targetOrigin })` must name the same explicit origin for a cross-origin embed; omitting `targetOrigin` on either side defaults to that window's own origin.

## Related Skills

- [tools](../tools/SKILL.md) -- toolkits (`defineToolkit`), backend and frontend tool definitions, and custom tool-call UI.
- [runtime](../runtime/SKILL.md) -- runtime creation, `AssistantRuntimeProvider`, and reading or mutating thread state (`useAui`, `useAuiState`, `useAuiEvent`).
