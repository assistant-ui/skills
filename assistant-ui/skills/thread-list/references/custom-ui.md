# Custom Thread List UI

Use primitives when the installed element's built in search, day groups, layout, or action menu does not match the product. They need an `AssistantRuntimeProvider` ancestor and establish item scope as the list iterates.

## Contents

- [Primitive inventory](#primitive-inventory)
- [Build a list](#build-a-list)
- [Load more](#load-more)
- [Search and grouping](#search-and-grouping)
- [Installed element composition](#installed-element-composition)

## Primitive Inventory

The API reference pages cover three namespaces. All button and menu parts accept `asChild` where their reference says so, which is how an action primitive can supply behavior to a menu item.

### ThreadListPrimitive

| Part | Renders | Use |
| --- | --- | --- |
| `Root` | `div` | Container and list keyboard focus group |
| `New` | `button` | Selects a fresh placeholder thread and has `data-active` while it is current |
| `Items` | No fixed wrapper | Iterates regular rows, supplying the item scope to its children render function |
| `ItemByIndex` | No fixed element | Renders one row at an index for a custom arrangement |
| `LoadMore` | `button` | Appends the next page and disables when loading or no `nextCursor` exists |

### ThreadListItemPrimitive

| Part | Renders | Use |
| --- | --- | --- |
| `Root` | `div` | Provides one item scope, `data-active`, and `aria-current` for the selected thread |
| `Trigger` | `button` | Selects this thread |
| `Title` | React fragment | Renders the title or its `fallback` without a wrapper element |
| `Archive` | `button` | Archives this thread and disables when unavailable |
| `Unarchive` | `button` | Restores this archived thread and disables when unavailable |
| `Delete` | `button` | Deletes this thread and disables when unavailable |

### ThreadListItemMorePrimitive

| Part | Renders | Use |
| --- | --- | --- |
| `Root` | No fixed element | Overflow menu root; `sharedFocusGroup` makes it part of list arrow key navigation and non modal |
| `Trigger` | `button` | Opens the overflow menu |
| `Content` | Portaled `div` | Positioned dropdown panel |
| `Item` | `div` | Menu item slot, usually wrapped in an action primitive with `asChild` |
| `Separator` | `div` | Visual separator between menu item groups |

`ThreadListPrimitive.Items` should use its children render function. The old `components` API is deprecated. `ItemByIndex` remains available for the installed element's specialized grouping but does not replace the render function for a normal custom list.

## Build a List

Use `Items` for regular conversations and the `archived` prop for the archived section. Each rendered child is already inside the matching `threadListItem` scope, so nested primitives and `useAuiState((s) => s.threadListItem...)` read the correct row.

```tsx
import {
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from "@assistant-ui/react";

function ThreadRow() {
  return (
    <ThreadListItemPrimitive.Root className="group flex items-center">
      <ThreadListItemPrimitive.Trigger className="min-w-0 flex-1 text-left">
        <ThreadListItemPrimitive.Title fallback="New conversation" />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemMorePrimitive.Root sharedFocusGroup>
        <ThreadListItemMorePrimitive.Trigger>
          More
        </ThreadListItemMorePrimitive.Trigger>
        <ThreadListItemMorePrimitive.Content>
          <ThreadListItemPrimitive.Archive asChild>
            <ThreadListItemMorePrimitive.Item>
              Archive
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Archive>
          <ThreadListItemMorePrimitive.Separator />
          <ThreadListItemPrimitive.Delete asChild>
            <ThreadListItemMorePrimitive.Item>
              Delete
            </ThreadListItemMorePrimitive.Item>
          </ThreadListItemPrimitive.Delete>
        </ThreadListItemMorePrimitive.Content>
      </ThreadListItemMorePrimitive.Root>
    </ThreadListItemPrimitive.Root>
  );
}

function ArchivedThreadRow() {
  return (
    <ThreadListItemPrimitive.Root>
      <ThreadListItemPrimitive.Trigger>
        <ThreadListItemPrimitive.Title fallback="New conversation" />
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Unarchive>
        Restore
      </ThreadListItemPrimitive.Unarchive>
    </ThreadListItemPrimitive.Root>
  );
}

export function CustomThreadList() {
  return (
    <ThreadListPrimitive.Root>
      <ThreadListPrimitive.New>New conversation</ThreadListPrimitive.New>
      <h2>Recent</h2>
      <ThreadListPrimitive.Items>
        {() => <ThreadRow />}
      </ThreadListPrimitive.Items>
      <h2>Archived</h2>
      <ThreadListPrimitive.Items archived>
        {() => <ArchivedThreadRow />}
      </ThreadListPrimitive.Items>
    </ThreadListPrimitive.Root>
  );
}
```

`sharedFocusGroup` lets Up and Down move between rows and Right reach the menu trigger. It makes the dropdown non modal. Omit it when a conventional modal menu is more appropriate.

## Load More

Return `nextCursor` from a `RemoteThreadListAdapter.list()` page, then add the primitive at the end of the list. It performs the command and disabled state handling.

```tsx
import { ThreadListPrimitive } from "@assistant-ui/react";

export function PaginatedThreadList() {
  return (
    <ThreadListPrimitive.Root>
      <ThreadListPrimitive.Items>
        {() => <ThreadRow />}
      </ThreadListPrimitive.Items>
      <ThreadListPrimitive.LoadMore>Load more</ThreadListPrimitive.LoadMore>
    </ThreadListPrimitive.Root>
  );
}
```

For viewport driven pagination, observe an application owned sentinel and call `aui.threads.loadMore()` only while `s.threads.hasMore` is true and the list is not loading. The primitive intentionally leaves intersection behavior to the application.

## Search and Grouping

The installed runtime `ThreadList` has built in case insensitive title search once the list contains a conversation. It filters untitled rows as `New Chat`, shows `No threads found` for an empty match, and groups visible rows by `lastMessageAt` under Today, Yesterday, and Earlier only when timestamps exist.

For another search or grouping rule, select the stable `threadItems` reference and transform it outside the selector. That preserves `useAuiState` subscription semantics.

```tsx
import { useAuiState } from "@assistant-ui/react";

export function ProjectThreadTitles({ query }: { query: string }) {
  const threadItems = useAuiState((s) => s.threads.threadItems);
  const normalizedQuery = query.toLowerCase();
  const visibleItems = threadItems.filter((item) =>
    (item.title ?? "New Chat").toLowerCase().includes(normalizedQuery),
  );

  return (
    <ul>
      {visibleItems.map((item) => (
        <li key={item.id}>{item.title ?? "New Chat"}</li>
      ))}
    </ul>
  );
}
```

Use `custom` metadata for application grouping or pinning. Read and write that bag with `s.threadListItem.custom` and `aui.threadListItem.updateCustom(custom)` inside a row. `updateCustom` replaces the bag, so preserve unrelated fields.

Do not import or invent a `ThreadSearch` primitive. The supplied snapshot documents the list's built in search and a separate `ConversationSearch` element for searching messages within one conversation, not an exported thread search primitive.

## Installed Element Composition

`thread-list.aui.tsx` is a runtime connected registry component, not a general data list. It composes the list root and new control with its own search field, date grouping, and skeleton state. It renders grouped items through `ThreadListPrimitive.ItemByIndex`, then composes `ThreadListItemPrimitive.Root`, `Trigger`, `Title`, and action controls with a `ThreadListItemMorePrimitive` menu.

The component sets `sharedFocusGroup` on its more menu so the trigger participates in list keyboard navigation. It renders an active row with `data-active` and `aria-current`, shows an inline rename input, and shows each row's running state. Copy and edit the installed file when that behavior is close to the product. Compose primitives directly when its grouping or search model is not.
