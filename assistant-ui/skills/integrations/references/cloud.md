# Cloud Persistence

Thread and message persistence with assistant-cloud.

## Installation

```bash
npm install assistant-cloud
```

## Quick Start

```tsx
import { AssistantCloud } from "assistant-cloud";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider, Thread, ThreadList } from "@assistant-ui/react";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => getAuthToken(),
});

function Chat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
    cloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-screen">
        <ThreadList className="w-64" />
        <Thread className="flex-1" />
      </div>
    </AssistantRuntimeProvider>
  );
}
```

## AssistantCloud Configuration

```tsx
const cloud = new AssistantCloud({
  // Required
  baseUrl: "https://api.assistant-ui.com",

  // Authentication (pick one)
  authToken: async () => {
    // Return JWT token
    return getAuthToken();
  },
  // OR
  apiKey: "your-api-key",
  userId: "user-123",
  workspaceId: "workspace-456",
  // OR
  anonymous: true,  // For public/demo apps
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

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
    cloud,
  });

  // ...
}
```

### API Key (Server-Side)

```tsx
const cloud = new AssistantCloud({
  baseUrl: process.env.ASSISTANT_BASE_URL,
  apiKey: process.env.ASSISTANT_API_KEY,
  userId: currentUser.id,
  workspaceId: currentUser.workspaceId,
});
```

### Anonymous (Public Apps)

```tsx
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  anonymous: true,
});
```

## Thread Management

With cloud enabled, thread management is automatic:

```tsx
<AssistantRuntimeProvider runtime={runtime}>
  {/* ThreadList shows all saved threads */}
  <ThreadList />

  {/* Thread auto-saves to cloud */}
  <Thread />
</AssistantRuntimeProvider>
```

### Custom Thread List UI

```tsx
import { useAssistantApi, useAssistantState } from "@assistant-ui/react";

function CustomThreadList() {
  const api = useAssistantApi();
  const { threads, mainThreadId } = useAssistantState((s) => ({
    threads: s.threadList.threads,
    mainThreadId: s.threadList.mainThreadId,
  }));

  return (
    <div>
      <button onClick={() => api.threads().switchToNewThread()}>
        New Chat
      </button>

      {threads.map((threadId) => (
        <button
          key={threadId}
          onClick={() => api.threads().switchToThread(threadId)}
          className={threadId === mainThreadId ? "active" : ""}
        >
          {threadId.slice(0, 8)}...
        </button>
      ))}
    </div>
  );
}
```

## Cloud API

### Thread Operations

```tsx
// Access cloud directly
const { threads } = cloud;

// List threads
const list = await threads.list({ status: "active" });

// Get thread
const thread = await threads.get(threadId);

// Create thread
const { thread_id } = await threads.create({
  title: "New Chat",
  metadata: { source: "web" },
});

// Update thread
await threads.update(threadId, {
  title: "Updated Title",
  is_archived: true,
});

// Delete thread
await threads.delete(threadId);
```

### Message Operations

```tsx
const messages = cloud.threads.messages(threadId);

// List messages
const list = await messages.list({ format: "aui/v0" });

// Create message
await messages.create({
  parent_id: null,
  format: "aui/v0",
  content: { role: "user", content: [...] },
});
```

### File Uploads

```tsx
const { files } = cloud;

// Get presigned upload URL
const { signedUrl, publicUrl } = await files.generatePresignedUploadUrl({
  filename: "image.png",
});

// Upload file
await fetch(signedUrl, {
  method: "PUT",
  body: file,
});

// Use publicUrl in message
```

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://api.assistant-ui.com

# For server-side
ASSISTANT_API_KEY=your-api-key
```

## With Custom Attachment Adapter

```tsx
import { CloudFileAttachmentAdapter } from "assistant-cloud";

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "/api/chat",
  }),
  cloud,
  adapters: {
    attachments: new CloudFileAttachmentAdapter(cloud),
  },
});
```

## Error Handling

```tsx
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL,
  authToken: async () => {
    try {
      return await getAuthToken();
    } catch (error) {
      console.error("Auth error:", error);
      return null;  // Falls back to anonymous
    }
  },
});
```

## Auto-Title Generation

Cloud automatically generates titles for threads:

```tsx
// Title is generated after first assistant response
const item = api.threads().item({ id: threadId });
await item.generateTitle();  // Manual trigger
```
