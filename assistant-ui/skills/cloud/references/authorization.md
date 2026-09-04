# Cloud Authorization

Assistant Cloud is called directly from the frontend for most operations, so the only backend concern is authorizing your users. This page covers the three constructor modes and both ways to issue a token.

## Contents

- [Workspaces](#workspaces)
- [Auth modes](#auth-modes)
- [JWT and direct provider integrations](#jwt-and-direct-provider-integrations)
- [API key and backend server mode](#api-key-and-backend-server-mode)
- [Anonymous mode](#anonymous-mode)
- [Environment variables](#environment-variables)

## Workspaces

Authorization is granted to a workspace, the scope that contains threads and messages. Common choices: `userId` for personal chats, `orgId_userId` for organization-scoped conversations, `projectId_userId` for project-based apps. Users in different workspaces never see each other's threads.

## Auth modes

| Mode | Where it runs | Setup |
|------|----------------|-------|
| JWT (`authToken`) | Client-side | Direct provider integration in the dashboard, or your own token endpoint |
| API key (`apiKey` + `userId` + `workspaceId`) | Server-side only | An API key from the dashboard; never ship it to the client |
| Anonymous (`anonymous: true`) | Client-side | None; a new user per browser session |

## JWT and direct provider integrations

In the Assistant Cloud dashboard, go to **Auth Integrations** and add a provider; this sets up automatic workspace assignment from the user's provider id. Then pass an `authToken` function that returns the provider's ID token:

```ts
import { AssistantCloud } from "@assistant-ui/react";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  authToken: () => getTokenFromYourProvider(),
});
```

### Clerk

Create a blank JWT template named `assistant-ui` with `{ "aud": "assistant-ui" }` (Clerk dashboard, under Configure, JWT Templates), note its Issuer and JWKS Endpoint, then add an Auth Rule in the Assistant Cloud dashboard (Provider: Clerk, Issuer, JWKS Endpoint, Audience: `assistant-ui`).

```tsx
import { useAuth } from "@clerk/nextjs";
import { AssistantCloud } from "@assistant-ui/react";

function Chat() {
  const { getToken } = useAuth();
  const cloud = useMemo(
    () =>
      new AssistantCloud({
        baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
        authToken: () => getToken({ template: "assistant-ui" }),
      }),
    [getToken],
  );
  // ...
}
```

### Auth0

```tsx
import { useAuth0 } from "@auth0/auth0-react";
import { AssistantCloud } from "@assistant-ui/react";

function Chat() {
  const { getAccessTokenSilently } = useAuth0();
  const cloud = useMemo(
    () =>
      new AssistantCloud({
        baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
        authToken: () => getAccessTokenSilently(),
      }),
    [getAccessTokenSilently],
  );
  // ...
}
```

Configure the Auth0 integration in the dashboard with your Auth0 domain and audience.

### Supabase Auth

```tsx
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { AssistantCloud } from "@assistant-ui/react";

function Chat() {
  const supabase = useSupabaseClient();
  const cloud = useMemo(
    () =>
      new AssistantCloud({
        baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
        authToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? "",
      }),
    [supabase],
  );
  // ...
}
```

### Firebase Auth

```tsx
import { getAuth, getIdToken } from "firebase/auth";
import { AssistantCloud } from "@assistant-ui/react";

function Chat() {
  const cloud = useMemo(() => {
    const auth = getAuth();
    return new AssistantCloud({
      baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
      authToken: () => getIdToken(auth.currentUser!, true),
    });
  }, []);
  // ...
}
```

## API key and backend server mode

Use this when you need custom workspace logic or an unsupported provider. Create an API key in the dashboard (**API Keys**), keep it server-side only, then mint tokens on request:

```ts title="app/api/assistant-ui-token/route.ts"
import { AssistantCloud } from "assistant-cloud";
import { auth } from "@clerk/nextjs/server"; // or your own auth check

export const POST = async (req: Request) => {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const workspaceId = orgId ? `${orgId}_${userId}` : userId;
  const assistantCloud = new AssistantCloud({
    apiKey: process.env.ASSISTANT_API_KEY!,
    userId,
    workspaceId,
  });

  const { token } = await assistantCloud.auth.tokens.create();
  return new Response(token);
};
```

```tsx title="app/chat/page.tsx"
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  authToken: () => fetch("/api/assistant-ui-token", { method: "POST" }).then((r) => r.text()),
});

const runtime = useChatRuntime({ cloud });
```

The API-key client also serves any server-only operation directly, without a token round trip: `apiKey` plus a fixed `userId`/`workspaceId` (for example `"system"`) is enough to call `cloud.threads.list()` or any other method from a route handler.

## Anonymous mode

```tsx
const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  anonymous: true,
});
```

Creates a browser-session-based user with no sign-in step. Threads do not survive a cleared session or a different device; use it only for demos and prototypes, then switch to JWT or API key auth for anything durable.

## Environment variables

```env
# client-side (bundled into the browser build)
NEXT_PUBLIC_ASSISTANT_BASE_URL=https://proj-[YOUR-ID].assistant-api.com

# server-side only
ASSISTANT_BASE_URL=https://proj-[YOUR-ID].assistant-api.com
ASSISTANT_API_KEY=your-secret-key
```

Never expose an API key to client code; only the `NEXT_PUBLIC_` (or `EXPO_PUBLIC_`) variable is safe in the browser bundle.
