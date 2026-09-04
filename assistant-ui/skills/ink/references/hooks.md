# Terminal hooks

`@assistant-ui/react-ink` exports the shared assistant-ui hooks along with terminal specific runtime and notification helpers. Mount them below `AssistantRuntimeProvider`. A selector should return a primitive or a stable reference, never a fresh object or array.

## State and actions

`useAuiState` selects reactive state. `useAui` returns imperative runtime methods. `useAuiEvent` observes an event without rendering. State is scoped, so `s.message`, `s.part`, `s.attachment`, `s.queueItem`, and `s.threadListItem` only exist below their corresponding iterator or explicit provider.

```tsx
import { useAui, useAuiEvent, useAuiState } from "@assistant-ui/react-ink";
import { Text, useInput } from "ink";

export function RunStatus() {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const aui = useAui();

  useAuiEvent("thread.runStart", () => {
    process.stdout.write("starting\n");
  });

  useInput((input) => {
    if (input === "x") aui.thread.cancelRun();
  });

  return <Text>{isRunning ? "Running. Press x to stop." : "Idle."}</Text>;
}
```

Use Ink controls rather than a browser `button` in a terminal screen. `threads.selectionChanged` is the current thread selection event; do not use retired thread list item switch events.

## Runtime and adapter hooks

`useLocalRuntime(adapter, options)` creates an in process `AssistantRuntime` from a `ChatModelAdapter`. Options include initial messages, history, attachment, feedback, suggestion, speech, dictation, and cloud adapters. `useRemoteThreadListRuntime({ runtimeHook, adapter, allowNesting })` supplies persistent thread metadata while `runtimeHook` creates the per thread local runtime. `useRuntimeAdapters` reads the adapter set exposed by the nearest provider.

```tsx
import { useLocalRuntime, useRemoteThreadListRuntime } from "@assistant-ui/react-ink";

function useAppRuntime() {
  return useRemoteThreadListRuntime({
    runtimeHook: () => useLocalRuntime(chatAdapter),
    adapter: threadListAdapter,
  });
}
```

The `chatAdapter` and `threadListAdapter` are application values. See [custom backend](./custom-backend.md) for their transport and persistence contracts.

## Terminal notifications

`useNotification()` rings the terminal bell on task completion, task incompletion, and assistant interrupts that need input. The default completion handler also sends OSC 9. `ringBell()` and `sendOSCNotification(title, body, variant)` are imperative exports for an application owned notification path.

```tsx
import { useNotification } from "@assistant-ui/react-ink";

export function Notifications() {
  useNotification({
    onTaskComplete: { osc: "osc99" },
    onTaskIncomplete: false,
  });
  return null;
}
```

Notification events are deduplicated by thread, message, status, and reason. `onNeedsInput` fires for an assistant interrupt, not a tool call pause. OSC support depends on the user's terminal emulator.

## Tools and model context

Ink runs in one Node process. `defineToolkit` is therefore a runtime value with no client or server directive. Register the resulting toolkit with `AuiConfig({ tools: Tools({ toolkit }) })` on a nested `AuiProvider extends={aui}`. `useAssistantInstructions` adds system instructions, `useAssistantDataUI` registers a named data part renderer, `makeAssistantDataUI` creates its mounting component, and `useInlineRender` gives changing props a stable renderer reference.

```tsx
import { defineToolkit } from "@assistant-ui/react-ink";
import { Text } from "ink";
import { z } from "zod";

export const toolkit = defineToolkit({
  get_weather: {
    description: "Get the weather for a city.",
    parameters: z.object({ city: z.string() }),
    execute: async ({ city }) => ({ city, temperature: 72 }),
    render: ({ result }) => <Text>{result?.temperature} F</Text>,
  },
});
```

`useAssistantContext`, `useAuiToolOverrides`, and `useToolArgsStatus` support advanced model context and renderer composition. `useAssistantTool`, `useAssistantToolUI`, `makeAssistantTool`, and `makeAssistantToolUI` remain exported for migration only. Use `defineToolkit` for new tool definitions.

## Other reactive hooks

- `useToolCallChecklist` derives checklist data from a tool call for `ChecklistPrimitive` or `LiveChecklist`.
- `useVoiceState`, `useVoiceVolume`, and `useVoiceControls` access the configured voice session.
- `useAssistantInteractable` and `useInteractableState` support interactable runtime state. The corresponding `unstable_` exports are experimental and should not become a new application dependency without a current API check.
- `unstable_useThreadMessageIds` exposes the experimental message id list for special thread renderers.

## Scope configuration

`useAui()` takes no arguments. Build additional scopes with `AuiConfig`, then provide them through `AuiProvider` or `AssistantRuntimeProvider`.

```tsx
import { AuiConfig, AuiProvider, Tools, useAui } from "@assistant-ui/react-ink";

function ToolScope({ children }: { children: React.ReactNode }) {
  const aui = useAui();
  const config = AuiConfig({ tools: Tools({ toolkit }) });
  return <AuiProvider extends={aui} config={config}>{children}</AuiProvider>;
}
```

Use `<AuiProvider extends={null} config={config}>` for an isolated root. Do not pass configuration through `useAui({ ... })`, `AuiProvider value`, or `AssistantRuntimeProvider aui`.
