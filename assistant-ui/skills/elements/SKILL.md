---
name: elements
description: "Installs and customizes assistant-ui elements, the styled shadcn-style component catalog at assistant-ui.com/elements served from the r.assistant-ui.com registry through `npx assistant-ui@latest add <item>`. Use when adding a prebuilt chat surface or widget (Thread, ThreadList, AssistantModal, AssistantSidebar, ToolFallback, ToolGroup, MarkdownText, Reasoning, Sources, Attachment, ModelSelector, Voice orb, McpConfig) or one of the 120 standalone elements (approval card, agent plan, code diff, data table, chart, trace waterfall, message queue, composer variants, and so on), choosing between runtime-connected `<name>.aui.tsx` files and props-driven standalone files, overriding Thread slots through the `components` prop, editing the copied source under `components/assistant-ui/elements/`, using the shared `surfaces.tsx` tokens, or picking the Radix versus Base UI flavor through the style-aware registry URL in `components.json`. Route here when an import from `@/components/assistant-ui/...` fails, an element renders unstyled, or the CLI installs the wrong flavor. For unstyled building blocks use primitives; for the CLI scaffold itself use setup."
license: MIT
---

# assistant-ui Elements

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

Elements are the styled, copy-into-your-project components that sit on top of the unstyled primitives. Every element is a TSX file the CLI copies into `components/assistant-ui/elements/`, so you own the source and customize it in place. The catalog at [assistant-ui.com/elements](https://www.assistant-ui.com/elements) documents each one with a live demo, a runtime recipe, and a standalone recipe.

## References

- [./references/catalog.md](./references/catalog.md) -- every element by section with its registry item and installed file
- [./references/aui-elements.md](./references/aui-elements.md) -- the runtime-connected elements (Thread, ThreadList, AssistantModal, AssistantSidebar, ToolFallback, ToolGroup, Reasoning, Sources, Attachment, ModelSelector, Voice, McpConfig, and the renderers)
- [./references/standalone-elements.md](./references/standalone-elements.md) -- props-driven elements grouped by section, with the prop shapes that matter

## Two kinds of element

| Kind | File | Needs a runtime | Registry item |
|------|------|-----------------|---------------|
| Runtime-connected | `elements/<name>.aui.tsx` | Yes, reads the nearest `AssistantRuntimeProvider` | short name: `thread`, `thread-list`, `tool-fallback`, `reasoning`, ... |
| Standalone | `elements/<name>.tsx` | No, everything comes in through props | `elements-<slug>`: `elements-agent-plan`, `elements-code-diff`, ... |
| Renderer | `elements/<name>.tsx` | Used from a `.aui` element or a toolkit `render` | `markdown-text`, `syntax-highlighter`, `shiki-highlighter`, `mermaid-diagram`, `generative-ui` |

A few elements exist in both forms. `thread-list` installs the runtime-connected sidebar list and `elements-thread-list` installs the props-driven one; the same split applies to `reasoning`, `sources`, `tool-group`, `model-selector`, `message-timing`, `context-display`, `voice` (the orb), `attachment` (`elements-message-attachment`), `quote` (`elements-quote-reply`), and `follow-up-suggestions` (`elements-suggestions`). Pick `.aui` when the data is already in the thread; pick standalone when you render from your own state, a tool result, or a design mock.

## Install

```bash
npx assistant-ui@latest init                 # once per project: components.json, style, base elements
npx assistant-ui@latest add thread thread-list
npx assistant-ui@latest add elements-agent-plan elements-code-diff
```

`add` wraps `npx shadcn@latest add` with the registry URL, pulls registry dependencies (for example `thread` brings `markdown-text`, `tool-fallback`, `tool-group`, `reasoning`, `sources`, `attachment`, `image`, `file`, `follow-up-suggestions`, `tooltip-icon-button`) and npm dependencies (`@assistant-ui/react`, `lucide-react`, `tw-shimmer`). Standalone elements pull `elements-surfaces` for the shared tokens.

Without a `components.json` the CLI warns and installs the Base UI flavor. To let the shadcn CLI resolve elements directly, register the style-aware URL:

```json
{
  "registries": {
    "@assistant-ui": "https://r.assistant-ui.com/styles/{style}/{name}.json"
  }
}
```

Then `npx shadcn@latest add @assistant-ui/thread` works too. Styles named `base-*` receive the Base UI flavor; every other style receives Radix. Most elements compose only `@assistant-ui/react` primitives and ship one source for both; the ones that touch library-specific surfaces (`tooltip-icon-button`, `attachment`, `context-display`, `message-timing`, `mcp-config`, `threadlist-sidebar`, `assistant-modal`, `model-selector`, and the shared `select`, `tabs`, `accordion`, `badge`, `direction`) have a dedicated Base UI variant. The plain `https://r.assistant-ui.com/{name}.json` URL stays a Radix fallback.

## Use a runtime-connected element

```tsx
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ThreadList } from "@/components/assistant-ui/elements/thread-list.aui";

export default function Chat() {
  const runtime = useChatRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-dvh">
        <ThreadList />
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

`Thread` takes no runtime prop; it reads the nearest provider. It renders the welcome screen, a history skeleton while a switched thread loads, the message list, the scroll-to-bottom pill, follow-up suggestions, and the composer.

### Override a slot instead of forking the file

```tsx
import { Thread, type ThreadComponents } from "@/components/assistant-ui/elements/thread.aui";

const THREAD_COMPONENTS: ThreadComponents = {
  Welcome: () => <h1 className="text-2xl">Ask me anything</h1>,
  ToolFallback: MyToolFallback,
};

export function Chat() {
  return <Thread components={THREAD_COMPONENTS} autoFocus={false} />;
}
```

Slots: `AssistantMessage`, `Welcome`, `ToolFallback`, `ToolGroup`, `ReasoningGroup`. Define the object at module scope or memoize it, otherwise every parent render remounts the message subtrees. For per-tool UI, register `render` on the toolkit entry (see [tools](../tools/SKILL.md)) rather than overriding `ToolFallback`; a tool UI registered by name wins over the slot.

### Restyle

`Thread` sets `--thread-max-width`, `--composer-bg`, `--composer-radius`, and `--composer-padding` inline on `ThreadPrimitive.Root`, so change them by editing your copy of `thread.aui.tsx`, not from an outer class. Everything else is Tailwind on the copied file.

## Use a standalone element

```tsx
import { AgentPlan } from "@/components/assistant-ui/elements/agent-plan";

<AgentPlan
  steps={["Read the schema", "Write the migration", "Run the tests"]}
  activeIndex={1}
/>;
```

Standalone elements take plain props (here `steps: readonly string[]` and `activeIndex: number`, plus any `div` props) and never read runtime state, so they work in a tool `render`, in a dashboard, or in Storybook. Each catalog page's "Standalone" tab shows the exact prop shape; the [standalone reference](./references/standalone-elements.md) summarizes the ones you will reach for most.

## Shared surface tokens

`elements-surfaces` installs `components/assistant-ui/elements/surfaces.tsx`, a set of class-string constants and two helpers that give every element the same look: `paper` and `floating` (card and popover fills), `field` and `fieldInteractive` (inputs), `pressable`, `ghostButton`, `inkButton`, `mono`, `live` (the streaming accent), `iconSwap` and `labelSwap` transitions, `collapsePanel`, `codeScroll` and `codeSurface`, plus `ShimmerLabel` and `SwapLabel`. Reuse them in your own components with `cn(...)` from `@/lib/utils` (the CLI scaffolds `lib/utils.ts` if it is missing) so custom UI matches the catalog.

## Common Gotchas

**`Cannot find module '@/components/assistant-ui/thread'`**
- Elements moved under `elements/` and runtime-connected files carry the `.aui` suffix: `@/components/assistant-ui/elements/thread.aui`. Renderers and standalone elements have no suffix.

**Element renders but looks unstyled**
- The registry assumes Tailwind v4 and the shadcn theme variables in `globals.css` (`@import "tailwindcss"` plus the `--background`, `--foreground`, `--border` family). `npx assistant-ui@latest init` writes them; in a hand-rolled project copy them from a `create` scaffold.

**CLI installed the wrong flavor**
- `add` reads the `style` field of `components.json`; `base-*` styles get Base UI, anything else gets Radix. Fix the style, then re-add with `--overwrite`.

**Thread re-renders every message on each parent render**
- The `components` prop object was created inline. Hoist it to module scope or `useMemo`.

**A `.aui` element throws about a missing provider**
- It must be a descendant of `AssistantRuntimeProvider` (or an `AuiProvider` whose config supplies the scope it reads). Standalone elements have no such requirement.

**Registry item not found**
- Runtime-connected and renderer items use the short name (`thread`, `markdown-text`); standalone items are prefixed (`elements-agent-plan`). The [catalog](./references/catalog.md) lists the exact item per element.

## Related Skills

- [primitives](../primitives/SKILL.md) -- the unstyled building blocks the `.aui` elements compose
- [setup](../setup/SKILL.md) -- `create`, `init`, and the rest of the CLI
- [tools](../tools/SKILL.md) -- toolkit `render` entries that replace `ToolFallback` per tool
- [generative-ui](../generative-ui/SKILL.md) -- the `generative-ui` renderer and the component vocabulary
- [markdown](../markdown/SKILL.md) -- `markdown-text`, `shiki-highlighter`, `syntax-highlighter`, `mermaid-diagram`
- [thread-list](../thread-list/SKILL.md) -- `thread-list`, `threadlist-sidebar`, `thread-search`, `conversation-map`
