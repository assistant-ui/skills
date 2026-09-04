# Interactables

Persistent components whose state both the user and the model can read and update, through an auto-generated `update_{name}` tool. Unlike a plain tool call, an interactable's state outlives the call: the user can edit it, the model can edit it again later, and (depending on scope) it survives a reload.

This reference covers the current `unstable_` API. The `unstable_` prefix flags it as subject to change across releases, not as unsupported; write new code against it. See [SKILL.md](../SKILL.md) for the legacy API's deprecation timeline.

## Contents

- [Register the scope](#register-the-scope)
- [App-scoped: unstable_useInteractable](#app-scoped-unstable_useinteractable)
- [Thread-scoped: unstable_interactableTool](#thread-scoped-unstable_interactabletool)
- [Surface state to the model](#surface-state-to-the-model)
- [Versions and restore()](#versions-and-restore)
- [Persistence](#persistence)
- [Partial updates](#partial-updates)
- [Multiple instances](#multiple-instances)
- [Migrating from the legacy API](#migrating-from-the-legacy-api)

## Register the scope

Both kinds below need `unstable_Interactables()` mounted through `config`. Thread-scoped interactables additionally need their toolkit registered with `Tools`.

```tsx
import {
  AuiConfig,
  AssistantRuntimeProvider,
  Tools,
  unstable_Interactables,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const config = AuiConfig({
    unstable_interactables: unstable_Interactables(),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

The deprecated `interactables: Interactables()` scope and `unstable_interactables: unstable_Interactables()` are mutually exclusive. Mount only one per `AuiConfig`.

## App-scoped: unstable_useInteractable

A component you mount yourself, anywhere in your app (a sidebar, a panel, a dashboard). The model gets an `update_{name}` tool automatically once the component is mounted.

```tsx
import { unstable_useInteractable } from "@assistant-ui/react";
import { z } from "zod";

const taskBoardSchema = z.object({
  tasks: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })),
});

function TaskBoard() {
  const [state, { setState }] = unstable_useInteractable("taskBoard", {
    description:
      "A task board panel that lists tasks. Use update_taskBoard with tasks.add/update/remove/clear to manage tasks.",
    stateSchema: taskBoardSchema,
    initialState: { tasks: [] },
  });

  return (
    <ul>
      {state.tasks.map((task) => (
        <li key={task.id}>
          <input
            type="checkbox"
            checked={task.done}
            onChange={() =>
              setState((prev) => ({
                tasks: prev.tasks.map((t) =>
                  t.id === task.id ? { ...t, done: !t.done } : t,
                ),
              }))
            }
          />
          {task.title}
        </li>
      ))}
    </ul>
  );
}
```

`unstable_useInteractable(name, config)` returns `[state, { id, setState, version, isPending, error, flush }]`.

- `name` feeds the `update_{name}` tool name.
- `config.description`, `config.stateSchema` (a Zod schema or JSON Schema), and `config.initialState` are required. `config.id` is an optional explicit instance id, see [Multiple instances](#multiple-instances). `config.updateRender` overrides how the model's `update_{name}` calls render, installed once per name.
- `state` is the live value as of this render.
- `id` is this instance's id; pass it to `unstable_useInteractableState(id)` from another component to reach the same instance.
- `version` is `undefined` outside a tool-call message part, which an app-scoped instance normally is not part of; see [Versions](#versions-and-restore).
- `isPending`, `error`, and `flush()` report the [persistence](#persistence) adapter's save state.

App-scoped state is shared across every thread in the app and stays in memory unless you add a persistence adapter. Read or write the same instance from another component with `unstable_useInteractableState`, which takes the `id` and skips registration:

```tsx
import { unstable_useInteractableState } from "@assistant-ui/react";

function TaskCount({ id }: { id: string }) {
  const [state] = unstable_useInteractableState(id);
  return <span>{state?.tasks.length ?? 0} tasks</span>;
}
```

## Thread-scoped: unstable_interactableTool

An interactable tool UI the model creates in-thread, such as a notepad or an artifact. Define it with `unstable_interactableTool` inside `defineToolkit`; its state rides the thread's history, so it survives a reload with nothing extra to persist.

```tsx
"use generative";

import { defineToolkit, unstable_interactableTool } from "@assistant-ui/react";
import { z } from "zod";

const notepadSchema = z.object({ title: z.string(), content: z.string() });

const toolkit = defineToolkit({
  notepad: unstable_interactableTool({
    description: "A notepad with drafted text the user can read and edit.",
    stateSchema: notepadSchema,
    render: ({ state, setState, version, streaming }) => (
      <Notepad
        value={state}
        onChange={setState}
        busy={streaming}
        readOnly={version ? !version.isLatest : false}
      />
    ),
  }),
});
```

Register the toolkit alongside the scope:

```tsx
AuiConfig({
  unstable_interactables: unstable_Interactables(),
  tools: Tools({ toolkit }),
});
```

`unstable_interactableTool(config)` returns a complete toolkit entry; the entry's key (`notepad` above) is the interactable name, and the tool's call arguments become its initial state. The same `render` runs at the creating call and at every later `update_{name}` call, receiving `state`, `setState`, this message's `version`, the instance `id` (the creating call's `toolCallId`), and `streaming` (true while the call's arguments are still generating). A fresh instance is created every time the model calls the tool, no extra code required: each `toolCallId` is its own instance, addressed by the same `render` and the same `update_{name}` tool.

## Surface state to the model

Each user message carries the interactable's changed state as a snapshot in `metadata.custom.interactables`, stamped only when the model does not already know that value. The AI SDK's `convertToModelMessages` drops message metadata, so inject the snapshot explicitly with `unstable_injectInteractableContext` before conversion:

```ts title="app/api/chat/route.ts"
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import { unstable_injectInteractableContext } from "@assistant-ui/ai-sdk";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(unstable_injectInteractableContext(messages)),
  });

  return result.toUIMessageStreamResponse();
}
```

Default formatting keeps the instance id visible, since the model needs it to address the `update_{name}` tool's `id` parameter:

```ts
// Full snapshot:
`[Current state of "note" (id: "n1"): {"title":"Q3 launch","body":"Ship the beta by Friday."}]`;
// Partial snapshot, only the changed fields:
`[State of "note" (id: "n1") changed. Updated fields: {"title":"Q4 launch"}. Fields not listed are unchanged.]`;
```

Pass a second argument to customize the wording. It receives one entry (`name`, `id`, `state`, and `partial: true` when `state` is a shallow diff rather than the full value) and returns the line the model sees:

```ts
import { type Unstable_InteractableSnapshotEntry } from "@assistant-ui/react";

const formatSnapshot = (entry: Unstable_InteractableSnapshotEntry) =>
  entry.partial
    ? `State of "${entry.name}" (id: "${entry.id}") changed: ${JSON.stringify(entry.state)}`
    : `Current state of "${entry.name}" (id: "${entry.id}"): ${JSON.stringify(entry.state)}`;

// messages: await convertToModelMessages(unstable_injectInteractableContext(messages, formatSnapshot)),
```

For a non AI SDK backend (LangGraph, Mastra, a custom runtime), build the equivalent injection from `unstable_getInteractableSnapshots(message)` and `unstable_formatInteractableSnapshot(entry)`, both exported from `@assistant-ui/react`.

## Versions and restore()

A thread is an append-only log, so a thread-scoped instance accumulates versions: the creating call, each user edit, and each `update_*` call. Inside a thread-scoped `render`, `state` and `setState` are the live instance, shared by every message that shows it, while `version` is this message's snapshot: `{ state, isLatest, restore() }`.

Two independent choices decide how a message renders its history:

| You want | Render |
|---|---|
| Frozen history | `version.state`, read-only, on old messages |
| Live-editable everywhere | `state` / `setState` regardless of `version` |
| Read-only with rollback | `version.state` read-only, plus a control that calls `version.restore()` |

```tsx
render: ({ state, setState, version }) =>
  version && !version.isLatest ? (
    <Notepad value={version.state} readOnly onRestore={version.restore} />
  ) : (
    <Notepad value={state} onChange={setState} />
  );
```

`unstable_useInteractableVersions(id, name)` returns every version oldest first, each with the full `state` and a `restore()`, for both scopes. Use it for a history dropdown:

```tsx
function VersionDropdown({ id, name }: { id: string; name: string }) {
  const versions = unstable_useInteractableVersions(id, name);
  if (versions.length < 2) return null;

  return (
    <select onChange={(e) => versions[+e.target.value]!.restore()}>
      {versions.map((v, i) => (
        <option key={i} value={i}>
          v{i + 1}: {v.origin === "user-edit" ? "you" : "assistant"}
        </option>
      ))}
    </select>
  );
}
```

An app-scoped instance's version history covers the current conversation only, not its full cross-thread lifetime.

## Persistence

App-scoped state is in memory by default. Pass an adapter to `unstable_Interactables` to persist it; thread-scoped interactables are never touched by this adapter, since they persist through thread history instead.

```tsx
// Module-level (or memoized) so the adapter identity is stable across renders.
const persistenceAdapter = {
  load: () => {
    const saved = localStorage.getItem("interactables");
    return saved ? JSON.parse(saved) : undefined;
  },
  save: (state: unknown) => {
    localStorage.setItem("interactables", JSON.stringify(state));
  },
};

const config = AuiConfig({
  unstable_interactables: unstable_Interactables({ persistence: persistenceAdapter }),
});
```

`load` may be async. Loaded state seeds each interactable as it registers, and a local edit made while `load` is still in flight wins over the loaded value. For a setup that depends on something resolved later, such as auth, call `aui.unstable_interactables.setPersistenceAdapter(adapter)` imperatively instead; replacing or removing an adapter flushes queued changes through the outgoing one first.

Sync status rides on the same tuple `unstable_useInteractable` and `unstable_useInteractableState` return:

```tsx
const [state, { setState, isPending, error, flush }] = unstable_useInteractableState(id);
// isPending: a save is in flight. error: the last failed save. flush(): force an immediate save.
```

State changes are debounced 500ms before `save` runs, and an unmounting component flushes its pending save immediately. For a custom persistence strategy, `aui.unstable_interactables` also exposes `exportState()` and `importState(snapshot)` to read or replace the full state directly, keyed by instance id.

Changing a `stateSchema` after state has been persisted can silently mismatch old data: the merge on load is shallow, so extra fields survive and missing ones keep their initial value, but type mismatches are not caught at runtime. Version the storage key (`taskBoard_v2`) or migrate inside `load` or `importState` when you make a breaking change.

## Partial updates

The generated `update_{name}` tool uses a partial version of `stateSchema`, so the model sends only the fields it wants to change.

```ts
// state: { title: "My Note", content: "Hello", color: "yellow" }
update_note({ color: "blue" });
// result: { title: "My Note", content: "Hello", color: "blue" }
```

The merge is shallow: a plain field the model sends replaces the old value, and a nested object it sends replaces that whole field rather than deep-merging into it. Array fields whose items carry an `id` are the exception: the model sends operations (`add`, `update`, `remove`, `clear`), the framework applies them to the current list, and it mints the `id` for each added item.

## Multiple instances

A `name` can have many live instances. They all share one `update_{name}` tool, and the model addresses a specific one with the tool's `id` parameter, read from the state snapshots in the conversation. The runtime still resolves an id-less call while exactly one instance exists; a call naming an unknown `id` gets an error listing the valid ones.

Thread-scoped interactables get a fresh instance for free on every call, keyed by that call's `toolCallId`. App-scoped interactables get one instance per mount of `unstable_useInteractable`; give each mount a distinct `id` to address it from elsewhere or to keep its persisted state attached across reloads:

```tsx
function NoteCard({ noteId }: { noteId: string }) {
  const [state] = unstable_useInteractable("note", {
    id: noteId,
    description: "A sticky note",
    stateSchema: noteSchema,
    initialState: noteInitialState,
  });
  return <div>{state.title}</div>;
}

// <NoteCard noteId="note-1" /> and <NoteCard noteId="note-2" /> share one
// update_note tool; the model calls update_note({ id: "note-2", color: "blue" }).
```

A top-level `id` field inside your `stateSchema` is reserved for instance addressing, so the model cannot write a state field named `id`. Name it something else, such as `noteId`, or nest it.

## Migrating from the legacy API

- `useAssistantInteractable` and `useInteractableState` merge into one `unstable_useInteractable` hook that both registers and returns state; `unstable_useInteractableState` remains for secondary readers.
- Per-instance tool names (`update_note_note-1`) are gone. Each name has one stable `update_{name}` tool with a required `id` parameter.
- The legacy `selected` config field and `setSelected` method are gone; represent selection as an ordinary field in your own state schema instead.
