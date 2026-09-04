# Message Part Grouping

Organize adjacent message parts into custom groups, and build chain of thought UI (reasoning and tool calls collapsed into a "thinking" accordion).

## MessagePrimitive.GroupedParts

`groupBy` maps each part to a group key path (or `null` / `[]` to leave it ungrouped). Adjacent parts that resolve to the same path coalesce into one group node. The `children` render function receives `{ part, children }` for both group nodes and leaf parts; only group cases should render `children`, leaf cases render their own UI.

```tsx
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";

<MessagePrimitive.GroupedParts
  groupBy={groupPartByType({ "tool-call": ["group-tool"] })}
>
  {({ part, children }) => {
    switch (part.type) {
      case "group-tool":
        return <div className="group">{children}</div>;
      case "tool-call":
        return part.toolUI ?? <ToolFallback {...part} />;
      case "text":
        return <MarkdownText />;
      default:
        return null;
    }
  }}
</MessagePrimitive.GroupedParts>
```

`groupPartByType` builds `groupBy` from a `part.type` to path map; part types missing from the map are left ungrouped. Group keys must start with `group-` so the render function can tell synthetic groups from real part types. A group node has the shape:

```ts
type GroupPart<TKey extends `group-${string}` = `group-${string}`> = {
  readonly type: TKey;
  readonly status: MessagePartStatus | ToolCallMessagePartStatus;
  readonly indices: readonly number[];
};
```

## Chain of thought

Group consecutive `reasoning` and `tool-call` parts under one outer key so they collapse into a single accordion:

```tsx
import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import {
  Reasoning, ReasoningContent, ReasoningRoot, ReasoningText, ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import {
  ToolGroupContent, ToolGroupRoot, ToolGroupTrigger,
} from "@/components/assistant-ui/elements/tool-group.aui";

const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <MessagePrimitive.GroupedParts
      groupBy={groupPartByType({
        reasoning: ["group-chainOfThought", "group-reasoning"],
        "tool-call": ["group-chainOfThought", "group-tool"],
      })}
    >
      {({ part, children }) => {
        switch (part.type) {
          case "group-chainOfThought":
            return <div className="my-2">{children}</div>;
          case "group-reasoning": {
            const running = part.status.type === "running";
            return (
              <ReasoningRoot streaming={running}>
                <ReasoningTrigger active={running} />
                <ReasoningContent aria-busy={running}>
                  <ReasoningText>{children}</ReasoningText>
                </ReasoningContent>
              </ReasoningRoot>
            );
          }
          case "group-tool":
            return (
              <ToolGroupRoot>
                <ToolGroupTrigger count={part.indices.length} active={part.status.type === "running"} />
                <ToolGroupContent>{children}</ToolGroupContent>
              </ToolGroupRoot>
            );
          case "text":
            return <MarkdownText />;
          case "reasoning":
            return <Reasoning {...part} />;
          case "tool-call":
            return part.toolUI ?? <ToolFallback {...part} />;
          default:
            return null;
        }
      }}
    </MessagePrimitive.GroupedParts>
  </MessagePrimitive.Root>
);
```

`ReasoningRoot`, `ReasoningTrigger`, `ReasoningContent`, `ReasoningText`, `ToolGroupRoot`, `ToolGroupTrigger`, `ToolGroupContent` come from the `reasoning` and `tool-group` elements (`npx assistant-ui@latest add reasoning tool-group`). LangGraph does not emit reasoning tokens in the AI SDK reasoning stream shape; to show LangGraph reasoning, emit it as a custom data part and render it with `makeAssistantDataUI`.

The older `components.ChainOfThought` prop on `MessagePrimitive.Parts`, and `ChainOfThoughtPrimitive` (`.Root`, `.AccordionTrigger`, `.Parts`) with its own `AuiIf`-driven collapsed state via `s.chainOfThought.collapsed`, still work but are legacy. Use `GroupedParts` in new code.

## Grouping by parentId or tool name

`groupBy` is arbitrary; return any key starting with `group-` and branch on `part.type.startsWith(...)`:

```tsx
<MessagePrimitive.GroupedParts
  groupBy={(part) => (part.parentId ? [`group-parent-${part.parentId}`] : [])}
>
  {({ part, children }) => {
    if (part.type.startsWith("group-parent-")) {
      return <ParentGroup count={part.indices.length}>{children}</ParentGroup>;
    }
    if (part.type === "text") return <MarkdownText />;
    if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
    return null;
  }}
</MessagePrimitive.GroupedParts>
```

Group by tool name the same way: `groupBy={(part) => part.type === "tool-call" ? [\`group-tool-${part.toolName}\`] : []}`.

## Standalone tool display

Tool UIs fall into three buckets: prompting the user (human in the loop), informing the user (generative UI), and traces of what the model did (routine calls). Mark a tool `display: "standalone"` to keep its UI out of the grouped trace; `human` tools and MCP apps are standalone automatically, everything else defaults to `"inline"`.

```ts
const toolkit = defineToolkit({
  ask_user: { type: "human", render: AskUI },          // standalone, forced
  search_web: { type: "frontend", render: SearchUI },  // inline trace, default
  checkout: { type: "frontend", render: CheckoutUI, display: "standalone" },
});
```

The synthetic `"standalone-tool-call"` key matches all of these; `GroupedParts` passes the live tool UI registry to `groupBy` as a second `context` argument, so the helper resolves it without you threading anything through:

```tsx
groupPartByType({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  "standalone-tool-call": [], // rendered on its own, outside the group
})
```

The `"mcp-app"` key was **removed in 0.15**; `"standalone-tool-call"` is a superset covering MCP app calls plus any tool call whose registered UI opts into standalone display.

```diff
  groupPartByType({
    "tool-call": ["group-tool"],
-   "mcp-app": [],
+   "standalone-tool-call": [],
  })
```

## Legacy: Unstable_PartsGrouped

Predates `GroupedParts`; accepts a `groupingFunction` returning non adjacency limited `MessagePartGroup[]` and a `components` map (`Empty`, `Text`, `Reasoning`, `Source`, `Image`, `File`, `Unstable_Audio`, `tools`, `Group`). Reach for it only when you need to collect non adjacent parts (for example every part sharing a parent id even with other parts between them) into one group; use `GroupedParts` for ordinary consecutive reasoning or tool grouping.

```ts
type MessagePartGroup = { groupKey: string | undefined; indices: number[] };
```

## Notes

- `GroupedParts` groups adjacent runs only; the same key appearing again after a gap starts a new group.
- Always handle every part type your message can render, or those parts render nothing.
- Group keys must start with `group-`.
- Drive `defaultOpen` / streaming indicators off `part.status.type === "running"`.

## Common Gotchas

**A leaf case renders `children` and throws**
- Leaf parts receive a sentinel `children` value. Only group cases (the ones you invented, prefixed `group-`) should render it.

**Grouping "resets" partway through a message**
- `GroupedParts` only coalesces adjacent parts. If an unrelated part interrupts a run of `reasoning` parts, the next `reasoning` part starts a new group.

**Old `"mcp-app"` groups stop matching after upgrading**
- That key was removed in 0.15. Replace it with `"standalone-tool-call"`.
