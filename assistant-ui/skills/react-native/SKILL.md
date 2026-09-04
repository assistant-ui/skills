---
name: react-native
description: "Build assistant-ui chat experiences for Expo and bare React Native with `@assistant-ui/react-native` and `@assistant-ui/ai-sdk`. Use when setting up an absolute mobile chat endpoint, `AssistantRuntimeProvider`, `useChatRuntime`, `AssistantChatTransport`, native `ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`, thread lists, attachments, React Native styles, `Metro` `withAui` for a `\"use generative\"` toolkit, local or remote thread adapters, or migrating a web chat surface to iOS and Android. Route here when a relative API URL fails on device, a native primitive lacks runtime state, `Metro` does not compile a toolkit, or web Elements are being used in a native app. Route web setup and DOM primitive work to `../setup/SKILL.md` and `../primitives/SKILL.md`."
license: MIT
---

# assistant-ui React Native

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

`@assistant-ui/react-native` supplies runtime-connected, unstyled React Native primitives. Use them with `View`, `Text`, `Pressable`, `TextInput`, `FlatList`, and native styles to build the chat surface. `@assistant-ui/ai-sdk` supplies the AI SDK v7 runtime and transport. The model route runs in a separate backend project, never inside the Expo bundle.

## Contents

- [References](#references) | [Quick start](#quick-start) | [Manual setup](#manual-setup) | [Native chat composition](#native-chat-composition) | [Generative toolkits](#generative-toolkits) | [Common Gotchas](#common-gotchas) | [Related Skills](#related-skills)

## References

- [./references/primitives.md](./references/primitives.md) -- native primitive namespaces and their parts
- [./references/hooks.md](./references/hooks.md) -- state, runtime, tool, and scoped-provider hooks
- [./references/adapters.md](./references/adapters.md) -- local persistence, attachments, and remote thread lists
- [./references/custom-backend.md](./references/custom-backend.md) -- a streaming model adapter and a backend-owned thread list
- [./references/migration.md](./references/migration.md) -- moving a web runtime to a native UI layer

## Quick start

Start from the maintained Expo example:

```sh
npx assistant-ui@latest create --example with-expo my-app
cd my-app
```

Set an endpoint that the app can reach. It must be an absolute URL. A physical device cannot resolve its own localhost to your development server.

```dotenv
EXPO_PUBLIC_CHAT_ENDPOINT_URL="https://api.example.com/api/chat"
```

Start Expo:

```sh
npx expo start
```

## Manual setup

Install the native runtime and its AI SDK v7 peer packages in an existing Expo app:

```sh
npx expo install @assistant-ui/react-native @assistant-ui/ai-sdk ai@^7 @ai-sdk/react@^4
```

Host the model route separately. The native app posts UI messages to that route through `AssistantChatTransport`; the route converts them asynchronously for AI SDK v7 and returns a UI message stream.

```ts
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

Create the runtime in a hook. Keep the endpoint in the public Expo environment so the compiled app can reach it.

```tsx
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/ai-sdk";

const chatEndpoint = process.env.EXPO_PUBLIC_CHAT_ENDPOINT_URL;

export function useAppRuntime() {
  if (!chatEndpoint) {
    throw new Error("EXPO_PUBLIC_CHAT_ENDPOINT_URL is required");
  }

  return useChatRuntime({
    transport: new AssistantChatTransport({ api: chatEndpoint }),
  });
}
```

`AssistantChatTransport` forwards frontend tool schemas and system messages. When the backend enables frontend tools, consume the request tools with `frontendTools` from `@assistant-ui/ai-sdk`; see [tools](../tools/SKILL.md) for the shared backend contract.

## Native chat composition

Put the runtime under the native `AssistantRuntimeProvider`, then compose the thread and composer from primitives. `ThreadPrimitive.MessagesFlatList` is the current list primitive and scopes each row to the corresponding message.

```tsx
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react-native";
import { Text, View } from "react-native";
import { useAppRuntime } from "./use-app-runtime";

function MessageRow() {
  const role = useAuiState((s) => s.message.role);

  return (
    <View
      style={{
        alignSelf: role === "user" ? "flex-end" : "flex-start",
        backgroundColor: role === "user" ? "#007aff" : "#f0f0f0",
        borderRadius: 16,
        margin: 8,
        padding: 12,
      }}
    >
      <MessagePrimitive.Content />
    </View>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root style={{ flexDirection: "row", gap: 8, padding: 12 }}>
      <ComposerPrimitive.Input
        multiline
        placeholder="Message..."
        style={{ borderWidth: 1, borderRadius: 20, flex: 1, padding: 10 }}
      />
      <ComposerPrimitive.Send>
        <Text>Send</Text>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}

function ChatScreen() {
  return (
    <ThreadPrimitive.Root style={{ flex: 1 }}>
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <Text style={{ padding: 16 }}>Send a message to begin.</Text>
      </AuiIf>
      <ThreadPrimitive.MessagesFlatList autoScroll>
        {() => <MessageRow />}
      </ThreadPrimitive.MessagesFlatList>
      <Composer />
    </ThreadPrimitive.Root>
  );
}

export default function App() {
  const runtime = useAppRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatScreen />
    </AssistantRuntimeProvider>
  );
}
```

`MessagePrimitive.Content` defaults text parts to native `Text`, not Markdown. Pass `renderText` or use `MessagePrimitive.Parts` with a React Native Markdown renderer when the model returns Markdown. For native keyboard handling, place the thread in a `KeyboardAvoidingView` and tune it for the platform.

Use `useAuiState` inside primitive scopes for reactive values. Use `useAui()` with no arguments for imperative actions such as `aui.composer.send()` and `aui.thread.cancelRun()`. Keep selectors to primitives or stable references instead of constructing an object or array in the selector.

## Generative toolkits

`Metro` must compile files that start with `"use generative"`. Install `@assistant-ui/metro` and wrap the default config. Expo gets `getDefaultConfig` from `expo/metro-config`; a bare React Native app gets it from `@react-native/metro-config`.

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withAui } = require("@assistant-ui/metro");

module.exports = withAui(getDefaultConfig(__dirname));
```

For a backendless toolkit, pass the `aui` option through the wrapper so frontend and human tool schemas remain uploadable:

```js
module.exports = withAui({
  ...getDefaultConfig(__dirname),
  aui: { backendless: true },
});
```

Write the toolkit against `@assistant-ui/react-native`, including native `View` and `Text` renderers. The `"use generative"` directive makes the compiler infer tool kind from `execute`. The [tools](../tools/SKILL.md) skill covers backend, frontend, human, provider, external, and stub tool semantics.

## Common Gotchas

**The mobile app posts to /api/chat and never reaches the server**

- Native apps have no browser origin for relative requests. Set `EXPO_PUBLIC_CHAT_ENDPOINT_URL` to the complete route URL.
- Use a host reachable from the simulator or physical device. Device localhost is the device itself.

**The provider is mounted but primitives throw or show no state**

- Create the runtime with `useChatRuntime` or another supported runtime hook, then pass it as `runtime={runtime}` to `AssistantRuntimeProvider`.
- Render primitives below that provider. Message, part, attachment, queue, suggestion, and thread-list-item primitives also need their corresponding parent render scope.

**A web Thread or an Elements import does not render in the Expo app**

- The shadcn Elements catalog is DOM and Tailwind based. Build the native UI with `@assistant-ui/react-native` primitives and React Native styles.

**The message list does not stay at the bottom**

- Use `ThreadPrimitive.MessagesFlatList` with `autoScroll` for new screens. `ThreadPrimitive.Messages` is retained for compatibility and defaults its auto-scroll options to false.

**Toolkits compile as ordinary modules or tool schemas never reach the model**

- Add `withAui` to `Metro` before using `"use generative"`.
- Import the identical generative module in the server build. If there is no server build, set `aui: { backendless: true }`.

**Markdown appears as literal asterisks and fences**

- `MessagePrimitive.Content` uses native `Text` by default. Supply a native Markdown renderer through `renderText`.

## Related Skills

- [setup](../setup/SKILL.md) -- `create`, `initialize`, and configure assistant-ui web projects
- [primitives](../primitives/SKILL.md) -- DOM primitives for web applications, not React Native UI
- [runtime](../runtime/SKILL.md) -- runtime behavior and backend transport concepts shared with native
- [tools](../tools/SKILL.md) -- generative toolkits, their backend route, and custom tool UI
