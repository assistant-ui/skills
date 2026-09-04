# React Native hooks and scoped providers

Import native state, runtime, tool, and provider APIs from `@assistant-ui/react-native`. The hooks read the nearest runtime and primitive scope, so place them below `AssistantRuntimeProvider` and the primitive that establishes the relevant message, part, attachment, suggestion, or thread-list-item context.

## State and actions

`useAuiState` selects reactive state. Return a primitive or stable reference only. Returning an object or array literal subscribes a component to every update, and selecting the complete state throws.

```tsx
import { useAui, useAuiState } from "@assistant-ui/react-native";
import { Button } from "react-native";

function ComposerStatus() {
  const text = useAuiState((s) => s.composer.text);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const aui = useAui();

  return (
    <Button
      title={isRunning ? "Stop" : "Send " + text}
      onPress={() => (isRunning ? aui.thread.cancelRun() : aui.composer.send())}
    />
  );
}
```

Use `useAui()` with no arguments for imperative methods. State accessors are properties: `aui.thread`, `aui.threads`, `aui.message`, `aui.composer`, `aui.part`, and `aui.threadListItem`. Methods stay calls, such as `aui.composer.setText(text)` and `aui.thread.composer().send()`.

`useAuiEvent` subscribes without triggering render. Prefer state selectors for ordinary UI updates; the supported selection event is `threads.selectionChanged`.

```tsx
import { useAuiEvent } from "@assistant-ui/react-native";

useAuiEvent("threads.selectionChanged", () => {
  saveSelectedThread();
});
```

## Runtime hooks

`useLocalRuntime` creates an `AssistantRuntime` from a `ChatModelAdapter`. Use it for a custom streaming protocol, local thread state, or native-only prototypes.

```tsx
import { useLocalRuntime } from "@assistant-ui/react-native";

const runtime = useLocalRuntime(chatModel, {
  initialMessages: [],
  adapters: {
    history: historyAdapter,
    attachments: attachmentAdapter,
    feedback: feedbackAdapter,
    suggestion: suggestionAdapter,
  },
});
```

`useRemoteThreadListRuntime` layers a backend-owned thread list around a per-thread runtime hook. Give it a `runtimeHook`, a `RemoteThreadListAdapter`, and `allowNesting: true` only when nesting should deliberately become a no-op.

```tsx
import {
  useLocalRuntime,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react-native";

const runtime = useRemoteThreadListRuntime({
  runtimeHook: () => useLocalRuntime(chatModel),
  adapter: threadListAdapter,
});
```

For the standard AI SDK v7 route, prefer `useChatRuntime` from `@assistant-ui/ai-sdk` with `AssistantChatTransport`; it is not a React Native package export. See the main skill for that boundary.

## Model-context hooks

Use `defineToolkit` for toolkit definitions and add `Metro` `withAui` before using a `"use generative"` module. Mount tools through a `config` on `AssistantRuntimeProvider`, or extend an existing scope with `AuiProvider`.

```tsx
import {
  AuiConfig,
  AuiProvider,
  Tools,
  useAui,
} from "@assistant-ui/react-native";

function ToolScope({ children }: { children: React.ReactNode }) {
  const aui = useAui();
  const config = AuiConfig({ tools: Tools({ toolkit }) });

  return (
    <AuiProvider extends={aui} config={config}>
      {children}
    </AuiProvider>
  );
}
```

`useAssistantDataUI` registers a renderer for a named data part. `useAssistantInstructions` adds system instructions. `useInlineRender` preserves a renderer identity while values closed over by its parent change. `useAuiToolOverrides` supplies a runtime executor or disables a toolkit entry.

```tsx
import {
  useAssistantDataUI,
  useAssistantInstructions,
} from "@assistant-ui/react-native";
import { Text } from "react-native";

useAssistantInstructions("Answer concisely.");
useAssistantDataUI({
  name: "weather_card",
  render: ({ data }) => <Text>{data.summary}</Text>,
});
```

The legacy `makeAssistantTool`, `useAssistantTool`, `makeAssistantToolUI`, and `useAssistantToolUI` exports are deprecated. Use `defineToolkit` and `Tools({ toolkit })` for new work.

## Scoped providers

These providers establish the scopes that `useAuiState` and primitives read. Most application UIs receive the scope from the corresponding list or parts component automatically. Use a provider directly when rendering a single indexed resource or building an unusual layout.

| Provider | Scope it establishes |
|---|---|
| `MessageByIndexProvider` | `s.message` |
| `PartByIndexProvider` | `s.part` |
| `TextMessagePartProvider` | text part state |
| `MessageAttachmentByIndexProvider` | message attachment state |
| `ComposerAttachmentByIndexProvider` | composer attachment state |
| `SuggestionByIndexProvider` | suggestion state |
| `ThreadListItemByIndexProvider` | `s.threadListItem` |
| `ThreadListItemRuntimeProvider` | thread-list-item runtime |
| `ChainOfThoughtByIndicesProvider` | chain of thought state |
| `ChainOfThoughtPartByIndexProvider` | chain-of-thought part state |

`RuntimeAdapterProvider` supplies runtime adapter overrides to descendants. Use `useRuntimeAdapters()` to read those adapter bindings rather than threading them through unrelated component props.
