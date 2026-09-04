---
name: update
description: "Upgrades an existing assistant-ui application and applies the migrations needed to reach the current AI SDK v7 and assistant-ui 0.15.x lines. Use when updating, bumping, or migrating @assistant-ui/react, @assistant-ui/ai-sdk, the older @assistant-ui/react-ai-sdk alias, ai, or @ai-sdk/react, or when an upgrade exposes removed hooks, scope accessor calls, provider configuration, registry paths, event names, legacy interactables, or tool registrations. Start here for an existing project, post-update type failures, package compatibility, CLI codemods, and version-specific migration order. For a first install or a new project use setup; for authoring a runtime without an upgrade use runtime."
license: MIT
---

# assistant-ui Update

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Upgrade in two passes. First make the AI SDK and its assistant-ui adapter compatible, then update assistant-ui and apply its API migration. Read the relevant references before editing because a direct jump can cross several deprecation windows.

## References

- [./references/ai-sdk.md](./references/ai-sdk.md) -- AI SDK v4 and v5 to v6 migration, v6 to v7 changes, and adapter pins
- [./references/assistant-ui.md](./references/assistant-ui.md) -- assistant-ui 0.8 through 0.15, toolkits, LangGraph, and deprecation policy
- [./references/breaking-changes.md](./references/breaking-changes.md) -- quick version and symptom lookup

## Detect the installed lines

Run these commands from the application root. npm ls reports the installed dependency graph and npm view reports the published latest version.

```bash
npm ls @assistant-ui/react @assistant-ui/ai-sdk @assistant-ui/react-ai-sdk @assistant-ui/core @assistant-ui/store assistant-stream ai @ai-sdk/react

npm view @assistant-ui/react version
npm view @assistant-ui/ai-sdk version
npm view @assistant-ui/react-ai-sdk version
npm view @assistant-ui/core version
npm view @assistant-ui/store version
npm view assistant-stream version
npm view ai version
npm view @ai-sdk/react version
```

Current published lines as of September 2026:

| Package | Current line |
| --- | --- |
| assistant-ui | 0.0.x |
| @assistant-ui/react | 0.15.x |
| @assistant-ui/ai-sdk | 0.0.x |
| @assistant-ui/react-ai-sdk | 1.4.x |
| @assistant-ui/core | 0.3.x |
| @assistant-ui/store | 0.3.x |
| assistant-stream | 0.3.x |
| assistant-cloud | 0.1.x |
| ai | 7.x |

@assistant-ui/react-ai-sdk re-exports the same API for older installs. New code imports from @assistant-ui/ai-sdk.

## Choose the migration set

Compare the installed @assistant-ui/react version against every threshold below. Apply every applicable guide in ascending version order.

| Installed before | Check for |
| --- | --- |
| 0.8.x | The historical UI package split. The current upgrade bundle intentionally excludes v0-8/ui-package-split because its destination is incompatible with current runtimes. Move to the Elements registry manually. |
| 0.9.x | The v0-9/edge-package-split codemod. |
| 0.10.x | The bundled migration has no dedicated 0.10 codemod. Run the later codemods and resolve remaining package or build errors from the project’s current toolchain. |
| 0.11.x | ContentPart names and MessagePrimitive.Content become MessagePart and MessagePrimitive.Parts. |
| 0.12.x | Unified state API, hook aliases, and camelCase event names. |
| 0.13.x | Review the 0.14 guide before proceeding because it removes the v0.11 and v0.12 deprecations. |
| 0.14.x | Removed aliases and runtime APIs, plus primitive children render functions. |
| 0.15.x | Scope properties, removed legacy hooks, toolUIs, standalone-tool-call, AuiConfig, and threads.selectionChanged. |

## Migration order

1. Migrate the AI SDK first. Read [ai-sdk.md](./references/ai-sdk.md) when the project is on v4, v5, or v6. Target ai@^7 and @ai-sdk/react@^4 with @assistant-ui/ai-sdk.
2. Update assistant-ui next. Use the threshold table and [assistant-ui.md](./references/assistant-ui.md), starting with the oldest applicable version.
3. Verify only after the package and source migrations are both complete. Typecheck, build, and exercise chat, tool, approval, and thread-selection paths that the application uses.

## Run the CLI

```bash
# Update every installed @assistant-ui/* package.
npx assistant-ui@latest update

# Preview package changes without installing them.
npx assistant-ui@latest update --dry

# Preview the complete bundled migration and print each transformed file.
npx assistant-ui@latest upgrade -d -p

# Apply one codemod to a source directory.
npx assistant-ui@latest codemod v0-11/content-part-to-message-part ./src

# Report environment and dependency details.
npx assistant-ui@latest doctor
npx assistant-ui@latest info
```

The bundled upgrade command runs these codemods in this exact order:

1. v0-9/edge-package-split
2. v0-11/content-part-to-message-part
3. v0-12/assistant-api-to-aui
4. v0-12/event-names-to-camelcase
5. v0-12/primitive-if-to-aui-if
6. v0-15/aui-accessor-calls-to-properties

Use the dry and print form first. After reviewing the diff, run upgrade without -d and -p. Do not add the historical v0-8/ui-package-split codemod to a current upgrade.

## 0.15.x follow-ups

These changes shipped after 0.15.0 without another major. Sweep for them even if the project already declares 0.15.x.

### Move the AI SDK import

```tsx
// Before
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
```

```tsx
// After
import { useChatRuntime } from "@assistant-ui/ai-sdk";
```

### Replace client construction with configuration

useAui takes no configuration. Build a configuration with AuiConfig and give it to the provider. A nested AuiProvider must declare whether it extends the parent client or is isolated.

```tsx
// Before
const aui = useAui({ tools: Tools({ toolkit }) });
return <AuiProvider value={aui}>{children}</AuiProvider>;
```

```tsx
// After
const aui = useAui();
const config = AuiConfig({ tools: Tools({ toolkit }) });
return <AuiProvider extends={aui} config={config}>{children}</AuiProvider>;
```

At a runtime boundary, replace AssistantRuntimeProvider aui with config. For an isolated root, use AuiProvider extends={null} config={config}.

```tsx
// Before
return <AssistantRuntimeProvider runtime={runtime} aui={aui}>{children}</AssistantRuntimeProvider>;
```

```tsx
// After
const config = AuiConfig({ tools: Tools({ toolkit }) });
return <AssistantRuntimeProvider runtime={runtime} config={config}>{children}</AssistantRuntimeProvider>;
```

### Move copied registry components

Runtime-connected registry components live at components/assistant-ui/elements/<name>.aui.tsx and import as @/components/assistant-ui/elements/<name>.aui. Renderers and standalone Elements use components/assistant-ui/elements/<name>.tsx and omit .aui from their import. Replace retired @/components/assistant-ui/<name> imports during the same sweep.

### Consolidate thread selection events

```tsx
// Before
useAuiEvent("threadListItem.switchedTo", ({ threadId }) => select(threadId));
useAuiEvent("threadListItem.switchedAway", ({ threadId }) => clear(threadId));
```

```tsx
// After
useAuiEvent("threads.selectionChanged", ({ threadId, previousThreadId }) => {
  select(threadId);
  if (previousThreadId) clear(previousThreadId);
});
```

The new event is shared by the threads scope. A listener that previously lived inside a thread-list item can filter by its item id.

### Replace legacy interactables and tool registrations

useAssistantInteractable, Interactables(), and useInteractableState are deprecated since 2026-06-14 and scheduled for removal on or after 2026-09-14. Migrate to unstable_useInteractable, unstable_Interactables(), and unstable_interactableTool.

makeAssistantTool, useAssistantTool, makeAssistantToolUI, and useAssistantToolUI are deprecated. Put the model contract, executor, and renderer in a defineToolkit entry and register it with AuiConfig({ tools: Tools({ toolkit }) }). Read the toolkits section in [assistant-ui.md](./references/assistant-ui.md) before converting stateful or UI-only tools.

## Verify

```bash
npx tsc --noEmit
npm run build
npm test
```

Also open a real chat route and verify an ordinary message, a tool call, an approval gate if present, a thread switch, and the project’s persisted-history path. Run npx assistant-ui@latest doctor and npx assistant-ui@latest info when a dependency or environment mismatch remains.

## Common Gotchas

**The upgrade command changed imports but the app still uses the old adapter**

- The package update only covers @assistant-ui packages. Update ai and @ai-sdk/react separately, then follow the AI SDK reference.
- @assistant-ui/react-ai-sdk is an alias for older installs. Current source imports from @assistant-ui/ai-sdk.

**AuiProvider or AssistantRuntimeProvider no longer accepts the old props**

- useAui() is context access only. Build AuiConfig({...}) and pass it as config.
- A nested AuiProvider needs extends={aui}; an isolated one needs extends={null}.

**A scope lookup no longer behaves like a null check**

- aui.thread is always truthy. Check aui.thread.source != null before accessing an optional scope.
- Scope accessors are properties. Call scope methods, not the scope itself.

**The typecheck still finds removed hooks or tool maps**

- Apply the full removed-hook mapping in [assistant-ui.md](./references/assistant-ui.md).
- Replace s.tools.tools with s.tools.toolUIs and the mcp-app group key with standalone-tool-call.

## Related Skills

- [setup](../setup/SKILL.md) -- install assistant-ui into a project that has not used it before
- [runtime](../runtime/SKILL.md) -- build or customize an active runtime after the migration
- [tools](../tools/SKILL.md) -- author toolkits, frontend tools, approvals, and tool UI
- [elements](../elements/SKILL.md) -- install and customize the copied Elements registry components
