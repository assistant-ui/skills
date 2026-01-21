---
name: cloud
description: Guide for assistant-cloud persistence and authorization. Use when setting up thread persistence, file uploads, or authentication.
version: 0.0.1
license: MIT
---

# assistant-ui Cloud

**Always consult [assistant-ui.com/docs](https://assistant-ui.com/docs) for latest API.**

Cloud persistence for threads, messages, and files.

## References

- [./references/persistence.md](./references/persistence.md) -- Thread and message persistence
- [./references/authorization.md](./references/authorization.md) -- Authentication patterns

## Installation

```bash
npm install assistant-cloud
```

## Quick Start

```tsx
import { AssistantCloud } from "assistant-cloud";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider, Thread, ThreadList } from "@assistant-ui/react";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function Chat() {
  const runtime = useChatRuntime({
    api: "/api/chat",
    cloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadList />
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

## Configuration Options

```tsx
const cloud = new AssistantCloud({
  // Required
  baseUrl: "https://api.assistant-ui.com",

  // Authentication (choose one)
  authToken: async () => token,         // JWT token
  apiKey: "key",                         // API key (server-side)
  anonymous: true,                       // Public/demo apps

  // Additional for API key auth
  userId: "user-123",
  workspaceId: "workspace-456",
});
```

## Authentication Methods

### JWT Token (Recommended)

```tsx
import { useSession } from "next-auth/react";

function Chat() {
  const { data: session } = useSession();

  const cloud = useMemo(() => new AssistantCloud({
    baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
    authToken: async () => session?.accessToken || null,
  }), [session]);

  const runtime = useChatRuntime({ api: "/api/chat", cloud });
  // ...
}
```

### API Key (Server-Side)

```ts
// In API route or server component
const cloud = new AssistantCloud({
  baseUrl: process.env.ASSISTANT_BASE_URL,
  apiKey: process.env.ASSISTANT_API_KEY,
  userId: user.id,
  workspaceId: user.workspaceId,
});
```

### Anonymous (Public Apps)

```tsx
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  anonymous: true,
});
```

## What Cloud Provides

| Feature | Description |
|---------|-------------|
| Thread persistence | Save/load chat history |
| Message storage | Store all messages with format |
| Thread management | Create, archive, delete threads |
| Auto-title | Generate titles from conversation |
| File uploads | Presigned URLs for attachments |
| Multi-device sync | Same threads across devices |

## Thread Operations

```tsx
// List threads
const threads = await cloud.threads.list();

// Create thread
const { thread_id } = await cloud.threads.create({
  title: "New Chat",
  metadata: { source: "web" },
});

// Update thread
await cloud.threads.update(threadId, {
  title: "Updated Title",
  is_archived: true,
});

// Delete thread
await cloud.threads.delete(threadId);
```

## Message Operations

```tsx
// List messages in thread
const messages = await cloud.threads.messages(threadId).list();

// Add message
await cloud.threads.messages(threadId).create({
  parent_id: null,
  format: "aui/v0",
  content: { role: "user", content: [...] },
});
```

## File Uploads

```tsx
// Get presigned upload URL
const { signedUrl, publicUrl } = await cloud.files.generatePresignedUploadUrl({
  filename: "document.pdf",
});

// Upload file
await fetch(signedUrl, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});

// Use publicUrl in message
```

## With useChatRuntime

```tsx
const runtime = useChatRuntime({
  api: "/api/chat",
  cloud,  // Automatically enables:
          // - Thread persistence
          // - ThreadList component
          // - Auto-title generation
});
```

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://api.assistant-ui.com

# Server-side only
ASSISTANT_API_KEY=your-api-key
```

## Common Gotchas

**Threads not persisting**
- Ensure `cloud` is passed to runtime
- Check authentication is working

**Auth errors**
- Verify `authToken` returns valid token
- Check `baseUrl` is correct

**File uploads failing**
- Use presigned URL within expiry time
- Include correct Content-Type header
