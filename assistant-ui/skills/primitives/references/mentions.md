# Mentions, Slash Commands, and Trigger Matchers

`@` mentions insert a directive chip; `/` slash commands insert a chip and fire a callback. Both are one trigger each on the same unstable trigger popover system: `ComposerPrimitive.Unstable_TriggerPopoverRoot` wraps the composer, and each `ComposerPrimitive.Unstable_TriggerPopover` declares one `char`, an adapter, and exactly one behavior sub-primitive (`.Directive` for mentions, `.Action` for slash commands).

## Imports

```ts
import {
  ComposerPrimitive,
  unstable_useMentionAdapter,
  unstable_useSlashCommandAdapter,
  unstable_useLiveCompletionAdapter,
  unstable_defaultDirectiveFormatter,
  unstable_useTriggerPopoverScopeContext,
  unstable_useTriggerPopoverTriggers,
  type Unstable_DirectiveFormatter,
  type Unstable_Mention,
  type Unstable_SlashCommand,
  type Unstable_TriggerMatcher,
} from "@assistant-ui/react";
import type { Unstable_TriggerAdapter } from "@assistant-ui/core";
import { LexicalComposerInput } from "@assistant-ui/react-lexical";
```

## Quick start: mentions

`unstable_useMentionAdapter()` with no options sources items from tools registered in model context and returns `{ adapter, directive, iconMap?, fallbackIcon? }`, a spreadable bundle.

```tsx
function MyComposer() {
  const mention = unstable_useMentionAdapter();
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input placeholder="Type @ to mention..." />
        <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
          <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) => items.map((item) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item}>
                {item.label}
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
        <ComposerPrimitive.Send />
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
```

`unstable_useMentionAdapter` options: `items` (flat `Unstable_Mention[]`), `categories` (`{ id, label, items }[]`, drill down), `includeModelContextTools` (`boolean | object`, default `true` only when neither `items` nor `categories` is set), `formatter`, `onInserted`, `iconMap`, `fallbackIcon`. Dedup between custom items and model context tools is by `id`; explicit items win.

The fastest path to a full UI is the prebuilt element: `npx assistant-ui@latest add composer-trigger-popover directive-text`, then import `ComposerTriggerPopover` from `@/components/assistant-ui/elements/composer-trigger-popover.aui` and `DirectiveText` from `@/components/assistant-ui/elements/directive-text.aui`.

## Quick start: slash commands

`unstable_useSlashCommandAdapter({ commands })` bundles command data with inline `execute` callbacks and returns `{ adapter, action, iconMap?, fallbackIcon? }`.

```tsx
const SLASH_COMMANDS: readonly Unstable_SlashCommand[] = [
  { id: "summarize", description: "Summarize the conversation", execute: () => runSummarize() },
  { id: "translate", description: "Translate to another language", execute: () => runTranslate() },
];

function MyComposer() {
  const slash = unstable_useSlashCommandAdapter({ commands: SLASH_COMMANDS });
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input placeholder="Type / for commands..." />
        <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
          <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
          <ComposerPrimitive.Unstable_TriggerPopoverItems>
            {(items) => items.map((item, index) => (
              <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={index}>
                <strong>{item.label}</strong>
                {item.description && <span>{item.description}</span>}
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            ))}
          </ComposerPrimitive.Unstable_TriggerPopoverItems>
        </ComposerPrimitive.Unstable_TriggerPopover>
        <ComposerPrimitive.Send />
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
}
```

`Unstable_SlashCommand` fields: `id` (required), `label?` (defaults to `/${id}`), `description?`, `icon?`, `execute` (required). By default `Action` leaves a directive chip in the composer after executing, an audit trail of which commands ran; pass `removeOnExecute` on the hook options to strip the trigger text instead, useful for purely transient commands. Wrap the returned `action.onExecute` to add logging or analytics without losing default behavior.

## Unstable_TriggerAdapter

Both hooks produce this shape; implement it directly for full control. Every method is synchronous, back it with external state (React Query, SWR, local state) for async data.

```ts
const adapter: Unstable_TriggerAdapter = {
  categories: () => [{ id: "tools", label: "Tools" }, { id: "users", label: "Users" }],
  categoryItems: (categoryId) =>
    categoryId === "tools"
      ? [{ id: "search", type: "tool", label: "Search" }]
      : [{ id: "alice", type: "user", label: "Alice" }],
  // optional: enables global search across categories
  search: (query) => allItems.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
};
```

`Unstable_TriggerItem` is `{ id, type, label, description?, metadata? }`. Return `[]` from `categories()` for a flat, search only adapter.

## Categories and drill down

Provide `categories` to a hook (or implement `categories()` / `categoryItems()` yourself), then render both `Unstable_TriggerPopoverCategories` and `Unstable_TriggerPopoverItems`, plus `Unstable_TriggerPopoverBack` to return from a drilled into category.

```tsx
<ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
  <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
  <ComposerPrimitive.Unstable_TriggerPopoverBack>← Back</ComposerPrimitive.Unstable_TriggerPopoverBack>
  <ComposerPrimitive.Unstable_TriggerPopoverCategories>
    {(categories) => categories.map((cat) => (
      <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem key={cat.id} categoryId={cat.id}>
        {cat.label}
      </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
    ))}
  </ComposerPrimitive.Unstable_TriggerPopoverCategories>
  <ComposerPrimitive.Unstable_TriggerPopoverItems>
    {(items) => items.map((item, i) => (
      <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={i}>
        {item.label}
      </ComposerPrimitive.Unstable_TriggerPopoverItem>
    ))}
  </ComposerPrimitive.Unstable_TriggerPopoverItems>
</ComposerPrimitive.Unstable_TriggerPopover>
```

Categories show only while the adapter reports at least one and the query is empty; drilling into a category, a category-less adapter, or a non empty query all show items instead, filtered locally against a category's items or from `adapter.search(query)` when present. Backspace on an empty query returns from a drilled into category to the list.

## Combining mentions and slash commands

Share one `Unstable_TriggerPopoverRoot`; give each trigger its own `Unstable_TriggerPopover` and behavior sub-primitive. Each reads its own state off its `char`, so `@` and `/` never collide, and keyboard events route to whichever popover is currently open.

```tsx
<ComposerPrimitive.Unstable_TriggerPopoverRoot>
  <ComposerPrimitive.Root>
    <ComposerPrimitive.Input placeholder="Type @ to mention, / for commands..." />
    <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
      {/* items render prop */}
    </ComposerPrimitive.Unstable_TriggerPopover>
    <ComposerPrimitive.Unstable_TriggerPopover char="/" adapter={slash.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Action {...slash.action} />
      {/* items render prop */}
    </ComposerPrimitive.Unstable_TriggerPopover>
    <ComposerPrimitive.Send />
  </ComposerPrimitive.Root>
</ComposerPrimitive.Unstable_TriggerPopoverRoot>
```

## Custom trigger matchers

Whitespace closes a trigger query by default. Pass a stable `matcher` (`Unstable_TriggerMatcher`) to `ComposerPrimitive.Unstable_TriggerPopover` for different syntax, for example multi word names; the same matcher governs both the textarea and the Lexical input.

```ts
const matchMultiWord: Unstable_TriggerMatcher = (text, triggerChar, cursorPosition) => {
  const upToCursor = text.slice(0, cursorPosition);
  const offset = upToCursor.lastIndexOf(triggerChar);
  if (offset === -1) return null;

  const preceding = upToCursor[offset - 1];
  if (preceding && !/\s/u.test(preceding)) return null;

  const query = upToCursor.slice(offset + triggerChar.length);
  if (/[\n\t]/u.test(query) || query.endsWith("  ")) return null;

  return { query, offset, endOffset: cursorPosition };
};
```

```tsx
<ComposerPrimitive.Unstable_TriggerPopover char="@" matcher={matchMultiWord} adapter={mention.adapter}>
  <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
</ComposerPrimitive.Unstable_TriggerPopover>
```

A matcher returns `null` when the trigger is not active at the cursor, or `{ query, offset, endOffset }` describing the text span it owns.

## Async adapters

`unstable_useLiveCompletionAdapter({ fetcher, cacheKey? })` wraps an async fetcher with debouncing, stale request cancellation, and a single entry cache; its `search` returns the last results synchronously and schedules a fetch on query change, and `isLoading` feeds the popover's own loading state.

```tsx
const mentions = unstable_useLiveCompletionAdapter({
  fetcher: async (query) => (await searchUsers(query)).map((u) => ({ id: u.id, type: "user", label: u.name })),
});

<ComposerTriggerPopover char="@" adapter={mentions.adapter} isLoading={mentions.isLoading} directive={{ onInserted }} />
```

For a hand rolled cache (React Query, SWR), load results into state and read the current snapshot inside the adapter's `search`; the adapter recreating on each render is what makes the popover see fresh results.

## Lexical input

`LexicalComposerInput` renders selected mentions as inline, atomic chips instead of raw directive text, and auto discovers every `Directive` trigger registered under `Unstable_TriggerPopoverRoot`.

```tsx
<ComposerPrimitive.Unstable_TriggerPopoverRoot>
  <ComposerPrimitive.Root>
    <LexicalComposerInput placeholder="Type @ to mention..." />
    <ComposerPrimitive.Unstable_TriggerPopover char="@" adapter={mention.adapter}>
      <ComposerPrimitive.Unstable_TriggerPopover.Directive {...mention.directive} />
    </ComposerPrimitive.Unstable_TriggerPopover>
    <ComposerPrimitive.Send />
  </ComposerPrimitive.Root>
</ComposerPrimitive.Unstable_TriggerPopoverRoot>
```

Requires `@assistant-ui/react-lexical`, `lexical`, and `@lexical/react` as direct dependencies.

## Directive format and rendering in messages

Default serialization is `:type[label]{name=id}`, for example `:tool[Get Weather]{name=get_weather}`; when `id === label` the attribute is omitted (`:tool[search]`). Render directives as chips in sent messages with the `directive-text` element:

```tsx
import { DirectiveText } from "@/components/assistant-ui/elements/directive-text.aui";

<MessagePrimitive.Parts components={{ Text: DirectiveText }} />
```

Implement `Unstable_DirectiveFormatter` (`serialize`, `parse`) for a different wire format, and pass it as the `formatter` prop on `.Directive` or `.Action`. On the backend, parse mentions out of the raw text:

```ts
const DIRECTIVE_RE = /:([\w-]+)\[([^\]]+)\](?:\{name=([^}]+)\})?/g;
function parseMentions(text: string) {
  const mentions = [];
  let m;
  while ((m = DIRECTIVE_RE.exec(text)) !== null) {
    mentions.push({ type: m[1], label: m[2], id: m[3] ?? m[2] });
  }
  return mentions;
}
```

## Scope context hook

`unstable_useTriggerPopoverScopeContext()`, called inside a `Unstable_TriggerPopover`, exposes the live state: `open`, `query`, `categories`, `items`, `highlightedIndex`, `isSearchMode`, `selectItem(item)`, `close()`. `unstable_useTriggerPopoverTriggers()` (inside `Unstable_TriggerPopoverRoot`) returns a live `ReadonlyMap<string, RegisteredTrigger>` of every registered trigger, for a custom input implementation that needs to iterate them all.

## Common Gotchas

**Two triggers, one popover**
- `Unstable_TriggerPopoverRoot` must be the outermost primitive, wrapping `ComposerPrimitive.Root`. Each `char` needs its own `Unstable_TriggerPopover`.

**Selecting an item does nothing**
- Exactly one behavior sub-primitive is required per `Unstable_TriggerPopover`: `.Directive` for insert only (mentions), `.Action` for insert plus callback (slash commands). Mixing both, or omitting one, leaves selection unwired.

**Async source never updates the list**
- Adapter methods are synchronous. Route async data through React state, a query cache, or `unstable_useLiveCompletionAdapter`; a plain `async` `search` method is ignored.
