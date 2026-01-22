# AI SDK v6 UI & React Changes

UI message structure and useChat hook changes in AI SDK v6.

---

## UIMessage Structure

```typescript
// Old structure (v5)
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// New structure (v6)
interface UIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  metadata?: Record<string, unknown>;
}
```

---

## Message Part Types

```typescript
type MessagePart =
  | { type: "text"; text: string }
  | { type: "file"; file: FileInfo }
  | { type: "reasoning"; text: string }
  | { type: "tool-invocation"; toolInvocation: ToolInvocation }
  | { type: "source-url"; sourceId: string; url: string; title?: string }
  | { type: "source-document"; sourceId: string; ... }
  | { type: `data-${string}`; data: unknown };  // Custom data parts
```

---

## Reading Text from Messages

```typescript
const extractText = (messages: UIMessage[]): string => {
  return messages
    .map((m) =>
      m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
    )
    .join("\n");
};
```

---

## useChat Hook Changes

### Input State Management

Input is **no longer managed internally**:

```diff
// Before (v5)
- const { input, setInput, handleSubmit } = useChat();
- <input value={input} onChange={(e) => setInput(e.target.value)} />

// After (v6) - manage input state yourself
+ const [input, setInput] = useState("");
+ const { sendMessage } = useChat();
+
+ const handleSubmit = () => {
+   sendMessage(input);
+   setInput("");
+ };
```

### Message Sending

```diff
// Before (v5)
- append({ role: "user", content: "Hello" });

// After (v6) - multiple formats:

// Option 1: Simple string
+ sendMessage("Hello");

// Option 2: Object with text
+ sendMessage({ text: "Hello" });

// Option 3: Object with parts array
+ sendMessage({
+   parts: [{ type: "text", text: "Hello" }]
+ });

// With options
+ sendMessage("Hello", { metadata: { key: "value" } });
```

---

## Status States

```typescript
type ChatStatus = "submitted" | "streaming" | "ready" | "error";

const { status } = useChat();

// submitted: Message sent, awaiting response stream start
// streaming: Response actively receiving data chunks
// ready: Response complete, ready for new messages
// error: Request failed
```

---

## Transport Configuration

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

// Before (v5)
const { messages } = useChat({
  api: "/api/chat",
});

// After (v6)
const { messages } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    headers: { /* ... */ },
    body: { /* ... */ },
    credentials: "include",
  }),
});
```

---

## Message Validation for Persistence

```typescript
import { validateUIMessages } from "ai";

// Before using stored messages
const validatedMessages = await validateUIMessages({
  messages: storedMessages,
  tools: yourTools,
});
```

---

## Message Type Renames

```diff
- import { CoreMessage, convertToCoreMessages } from "ai";
+ import { ModelMessage, convertToModelMessages } from "ai";

- import type { Message } from "ai";
+ import type { UIMessage } from "ai";
```

---

## convertToModelMessages is Now Async

```diff
// Before (v5)
- const modelMessages = convertToCoreMessages(messages);

// After (v6) - MUST use await
+ const modelMessages = await convertToModelMessages(messages);
```

---

## v4-Specific Changes (v4 → v6)

### useChat Hook Overhaul

```diff
// v4
- const { input, handleInputChange, handleSubmit } = useChat();

// v6
+ const [input, setInput] = useState("");
+ const { sendMessage } = useChat({
+   transport: new DefaultChatTransport({ api: "/api/chat" }),
+ });
+
+ const handleSubmit = (e) => {
+   e.preventDefault();
+   sendMessage({ text: input });
+   setInput("");
+ };
```

### Tool Input/Output Properties

```diff
// v4
- part.args    // Tool input
- part.result  // Tool output

// v6
+ part.input   // Tool input
+ part.output  // Tool output
```

### File Part Changes

```diff
// v4
- part.mimeType
- part.data

// v6
+ part.mediaType
+ part.url
```

### useAssistant Hook Removed

The `useAssistant` hook has been removed. Use `useChat` with appropriate configuration.

### Package Imports Changed

```diff
// v4
- import { useChat } from "ai/react";

// v6
+ import { useChat } from "@ai-sdk/react";
// Or for assistant-ui:
+ import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
```

---

## assistant-ui Simplified Setup

```typescript
"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

export function Chat() {
  // Defaults to AssistantChatTransport with /api/chat endpoint
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Your chat UI */}
    </AssistantRuntimeProvider>
  );
}
```

### Custom Endpoint

```typescript
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";

// AssistantChatTransport (recommended) - auto-forwards system/tools
const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/my-custom-api/chat",
  }),
});
```

### Transport Types

| Transport | Package | Auto-Forwards | Use Case |
|-----------|---------|---------------|----------|
| `AssistantChatTransport` | `@assistant-ui/react-ai-sdk` | Yes | Default, recommended |
| `DefaultChatTransport` | `ai` | No | Standard AI SDK |
| `DirectChatTransport` | `ai` | No | SSR/testing |
| `TextStreamChatTransport` | `ai` | No | Plain text backends |

### Exports from @assistant-ui/react-ai-sdk

```typescript
import {
  useChatRuntime,
  useAISDKRuntime,
  AssistantChatTransport,
  frontendTools,
  type UseChatRuntimeOptions,
} from "@assistant-ui/react-ai-sdk";
```
