# Migrate assistant-ui from web to React Native

The runtime model transfers across web and native. Replace only the UI layer: `@assistant-ui/react-native` provides the same runtime provider and state model, but its primitives render `View`, `Text`, `Pressable`, `TextInput`, and `FlatList` instead of DOM elements.

## Keep the runtime and backend

Share `useChatRuntime`, `AssistantChatTransport`, generative toolkit definitions, and the backend route in a monorepo when both clients speak the same contract. For Native, make the transport URL absolute because there is no browser origin for `/api/chat`.

```tsx
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/ai-sdk";

const endpoint = process.env.EXPO_PUBLIC_CHAT_ENDPOINT_URL;

export function useAppRuntime() {
  if (!endpoint) throw new Error("EXPO_PUBLIC_CHAT_ENDPOINT_URL is required");
  return useChatRuntime({
    transport: new AssistantChatTransport({ api: endpoint }),
  });
}
```

## Replace the provider import

The component name remains `AssistantRuntimeProvider`; change only the package import.

```tsx
import { AssistantRuntimeProvider } from "@assistant-ui/react-native";

export function App() {
  const runtime = useAppRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatScreen />
    </AssistantRuntimeProvider>
  );
}
```

## Rebuild the UI layer

Do not move Web Elements or DOM primitive JSX into the native app. Rebuild the surface with native primitives and React Native styles. Prefer `ThreadPrimitive.MessagesFlatList` over the compatibility `ThreadPrimitive.Messages` when creating a new native list.

```tsx
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react-native";
import { Text, View } from "react-native";

function MessageRow() {
  return (
    <View style={{ padding: 12 }}>
      <MessagePrimitive.Content />
    </View>
  );
}

export function ChatScreen() {
  return (
    <ThreadPrimitive.Root style={{ flex: 1 }}>
      <ThreadPrimitive.MessagesFlatList autoScroll>
        {() => <MessageRow />}
      </ThreadPrimitive.MessagesFlatList>
      <ComposerPrimitive.Root>
        <ComposerPrimitive.Input multiline placeholder="Message..." />
        <ComposerPrimitive.Send>
          <Text>Send</Text>
        </ComposerPrimitive.Send>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
```

## Share code selectively

Share runtime hooks, backend clients, schemas, and toolkit definitions. Keep screen components, Markdown renderers, styling, platform clipboard integration, keyboard avoidance, and attachment pickers platform-specific.

```text
packages/
  shared/
    runtime/
    tools/
  web/
    components/
  native/
    components/
```

If shared toolkits start with `"use generative"`, configure the appropriate compiler in each app: `withAui` from `@assistant-ui/metro` in Expo or bare React Native, and the web framework assistant-ui compiler integration in the web app.
