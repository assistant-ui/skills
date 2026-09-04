# Migrate a web chat to Ink

The assistant-ui runtime core is shared. Keep the runtime hook, AI SDK backend route, toolkit definitions, `useAuiState` selectors, and model context. Rebuild the visual layer because browser components, DOM events, CSS, Tailwind, and shadcn elements do not render in a terminal.

## Replace the UI package

<!-- before -->
```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react";
```

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react-ink";
import { Box, Text } from "ink";
```

The provider has the same name but comes from the terminal package. Wrap its children in Ink's `Box` and `Text`, then compose the terminal primitives.

```tsx
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react-ink";
import { Box } from "ink";

function TerminalScreen() {
  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Messages>
        {() => (
          <Box marginBottom={1}>
            <MessagePrimitive.Parts />
          </Box>
        )}
      </ThreadPrimitive.Messages>
      <ComposerPrimitive.Input submitOnEnter placeholder="Message..." autoFocus />
    </ThreadPrimitive.Root>
  );
}
```

Use `AuiIf` in place of former primitive `If` and `Empty` gates. The provider and hooks retain their state semantics, but a scoped child still has to be rendered by `ThreadPrimitive.Messages`, `MessagePrimitive.Parts`, or an explicit provider.

## Replace markdown and styling

Web markdown renderers produce DOM nodes. Use terminal ANSI markdown instead:

```tsx
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

export function Reply({ text }: { text: string }) {
  return <MarkdownText text={text} />;
}
```

Replace CSS and Tailwind layout with Ink flexbox props. Replace mouse controls with focusable terminal primitive controls. `ComposerPrimitive.Input` provides grapheme safe editing and terminal key bindings, so do not carry over a browser textarea implementation.

## Keep shared modules separate

In a monorepo, share runtime hooks, adapter definitions, tool definitions, and API route code. Keep web components and Ink components in separate packages or directories. The provider import, renderer import, and visual primitives are platform specific.

```text
packages/shared/runtime
apps/web/components
apps/terminal/components
```

When a terminal app uses `useChatRuntime`, its backend endpoint must be absolute. A web app can use a relative route because the browser supplies an origin. See [custom backend](./custom-backend.md) for both transport choices.
