# Suggestions

Suggestions supply concise starter prompts before a conversation and contextual follow ups after one. Static suggestions live in `AuiConfig`; runtime suggestions live in `thread.suggestions`.

## Contents

- [Static suggestions](#static-suggestions)
- [Suggestion primitives](#suggestion-primitives)
- [Follow up suggestions](#follow-up-suggestions)
- [Suggestion adapters](#suggestion-adapters)

## Static suggestions

```tsx
import {
  AssistantRuntimeProvider,
  AuiConfig,
  Suggestions,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const config = AuiConfig({
    suggestions: Suggestions([
      "Summarize this document",
      {
        title: "Plan a trip",
        label: "three days in Kyoto",
        prompt: "Plan a three day trip to Kyoto with food and transit recommendations.",
      },
    ]),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

Pass strings when the displayed text should be the sent prompt. Pass an object when a short title and optional description should stand in for a longer prompt. `title` falls back to `prompt`, and `label` becomes the `SuggestionPrimitive.Description` content. Static configuration is best for an empty thread and takes precedence over runtime values in the suggestions scope.

## Suggestion primitives

```tsx
import {
  AuiIf,
  SuggestionPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";

function WelcomeSuggestions() {
  return (
    <AuiIf condition={(s) => s.thread.isEmpty}>
      <div className="grid gap-2 sm:grid-cols-2">
        <ThreadPrimitive.Suggestions>
          {() => (
            <SuggestionPrimitive.Trigger send asChild>
              <button className="rounded-lg border p-3 text-left">
                <span className="block font-medium">
                  <SuggestionPrimitive.Title />
                </span>
                <span className="block text-sm text-muted-foreground">
                  <SuggestionPrimitive.Description />
                </span>
              </button>
            </SuggestionPrimitive.Trigger>
          )}
        </ThreadPrimitive.Suggestions>
      </div>
    </AuiIf>
  );
}
```

`ThreadPrimitive.Suggestions` establishes the suggestion scope for each item. `SuggestionPrimitive.Title`, `.Description`, and `.Trigger` read it. Pass `send` to send immediately, or omit it to place the prompt in the composer for editing. The empty thread condition dismisses the welcome grid after the first message without local state.

## Follow up suggestions

```tsx
import { ThreadPrimitive } from "@assistant-ui/react";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";

function ThreadFooter() {
  return (
    <ThreadPrimitive.ViewportFooter>
      <ThreadFollowupSuggestions />
      <Composer />
    </ThreadPrimitive.ViewportFooter>
  );
}
```

`ThreadFollowupSuggestions` reads `s.thread.suggestions`, renders one horizontally scrollable chip per follow up, and hides while the thread is empty or running. It has no props. Place it after messages and before the composer. Each chip displays `title` or `prompt`, displays the optional `label`, and sends the full `prompt` with `ThreadPrimitive.Suggestion send`.

When static `Suggestions(...)` configuration exists, `ThreadPrimitive.Suggestions` reads that static list instead. Use `ThreadFollowupSuggestions` or `useAuiState((s) => s.thread.suggestions)` for runtime follow ups that must coexist with static welcome prompts.

## Suggestion adapters

```tsx
import {
  AssistantRuntimeProvider,
  createSuggestionAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime({
    adapters: {
      suggestion: createSuggestionAdapter({
        async complete({ prompt, signal }) {
          const response = await fetch("/api/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
            signal,
          });
          return response.json();
        },
        count: 3,
      }),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

`createSuggestionAdapter` builds the transcript prompt and invokes `complete` after an assistant run settles. Forward `signal` so a new run can cancel generation. It accepts strings or `{ prompt, title?, label? }` records from the completion endpoint. With `adapters.suggestion`, the AI SDK runtime clears stale suggestions when a new run starts and replaces them with its next follow ups.

For a local runtime, pass the same adapter as `adapters.suggestion` to `useLocalRuntime`. For an external store, provide its `suggestions` field from application state. Those follow ups stay under application control until that state changes.
