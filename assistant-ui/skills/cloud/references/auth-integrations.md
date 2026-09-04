# Auth Integrations

Two paths exist for auth. With AssistantCloud, the cloud handles the JWT exchange and gives you workspace-scoped threads with no database code; see [authorization.md](./authorization.md) for the direct provider integrations and the backend token endpoint. Without AssistantCloud, you gate your own routes and scope every query against the signed-in user's id, pairing with a database-backed `RemoteThreadListAdapter` (see [../../thread-list/SKILL.md](../../thread-list/SKILL.md)). The sections below cover that non-cloud path for Auth.js (next-auth), Clerk, and better-auth, then show how to pair AssistantCloud with a backend token endpoint when you need custom workspace logic.

## Contents

- [Auth.js (next-auth)](#authjs-next-auth)
- [Clerk](#clerk)
- [better-auth](#better-auth)
- [Pairing AssistantCloud with a backend token endpoint](#pairing-assistantcloud-with-a-backend-token-endpoint)
- [Verify](#verify)

## Auth.js (next-auth)

[Auth.js](https://authjs.dev/) (formerly NextAuth) is the dominant OSS auth library in the Next.js ecosystem. This section is the non-cloud path: session-cookie auth, a server-side `auth()` check on the API route, and per-user scoping on a custom thread list.

Auth.js v5 does not put a stable `id` on `session.user` by default; only `email`, `name`, and `image` are exposed. Add `jwt`/`session` callbacks so the scoping queries below don't all run with `userId: undefined`:

```ts title="auth.ts"
import NextAuth from "next-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [/* your providers */],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
```

With the database session strategy, use a single `session` callback that copies from the `user` argument (`session.user.id = user.id`) instead of the `jwt`/`session` pair above.

Gate the chat route, returning 401 before the model call so unauthenticated traffic never burns provider credits:

```ts title="app/api/chat/route.ts"
import { auth } from "@/auth";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

Scope every thread endpoint by `session.user.id` (apply the same check to `POST`, `PATCH`, and `DELETE`):

```ts title="app/api/threads/route.ts"
import { auth } from "@/auth";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 401 });

  const rows = await db.select().from(threads)
    .where(eq(threads.userId, session.user.id))
    .orderBy(desc(threads.updatedAt));
  return Response.json(rows);
}
```

The first render of the runtime provider may run before `auth()` resolves on the client, leaving the thread list empty until a refresh. Wrap the root layout in `<SessionProvider>` once, then reload on the transition:

```tsx title="app/components/ReloadOnAuth.tsx"
"use client";

import { useAui } from "@assistant-ui/react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function ReloadOnAuth() {
  const aui = useAui();
  const { status, data } = useSession();
  useEffect(() => {
    if (status === "authenticated") aui.threads.reload();
  }, [status, data?.user?.id]);
  return null;
}
```

`reload()` discards in-flight responses from superseded calls, so it is safe on every auth transition. Same-origin cookies travel automatically; split the API onto another host and you need `credentials: "include"` plus CORS.

## Clerk

[Clerk](https://clerk.com/) integrates with Next.js through `@clerk/nextjs`. This section assumes `<ClerkProvider>` and `clerkMiddleware()` are already in place; it covers the non-cloud path only.

```ts title="app/api/chat/route.ts"
import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

`auth()` returns `userId` directly, so thread endpoints scope without callback configuration:

```ts title="app/api/threads/route.ts"
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response(null, { status: 401 });

  const rows = await db.select().from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(desc(threads.updatedAt));
  return Response.json(rows);
}
```

For Clerk Orgs, pull `orgId` alongside `userId` and combine them as a stable workspace key:

```ts
import { and, eq } from "drizzle-orm";

const { userId, orgId } = await auth();
if (!userId) return new Response(null, { status: 401 });

const rows = await db.select().from(threads).where(
  orgId ? and(eq(threads.orgId, orgId), eq(threads.userId, userId)) : eq(threads.userId, userId),
);
```

Reload the thread list once Clerk resolves the user on the client:

```tsx title="app/components/ReloadOnAuth.tsx"
"use client";

import { useAui } from "@assistant-ui/react";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export function ReloadOnAuth() {
  const aui = useAui();
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (isLoaded && isSignedIn) aui.threads.reload();
  }, [isLoaded, isSignedIn, user?.id]);
  return null;
}
```

Mount it inside `<AssistantRuntimeProvider>`; it is safe on every transition (sign in, sign out, org switch) since `reload()` discards superseded responses. If you use AssistantCloud instead, prefer its [Clerk JWT template integration](./authorization.md#clerk) over building the thread persistence yourself.

## better-auth

[better-auth](https://www.better-auth.com/) owns the session, user table, and cookie end to end, so `session.user.id` is populated with no callback configuration. This section covers pairing it with a custom, non-cloud thread list.

Mount its catch-all handler:

```ts title="app/api/auth/[...all]/route.ts"
import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

Gate the chat route with `auth.api.getSession`, which reads the session cookie off the request headers:

```ts title="app/api/chat/route.ts"
import { auth } from "@/auth";
import { headers } from "next/headers";
import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: openai("gpt-5.6-luna"),
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

`headers()` from `next/headers` must be awaited. Scope thread endpoints the same way:

```ts title="app/api/threads/route.ts"
import { auth } from "@/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { threads } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response(null, { status: 401 });

  const rows = await db.select().from(threads)
    .where(eq(threads.userId, session.user.id))
    .orderBy(desc(threads.updatedAt));
  return Response.json(rows);
}
```

Create the React client once, in a shared module:

```ts title="lib/auth-client.ts"
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

Then reload the thread list on sign-in:

```tsx title="app/components/ReloadOnAuth.tsx"
"use client";

import { useAui } from "@assistant-ui/react";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export function ReloadOnAuth() {
  const aui = useAui();
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending && session) aui.threads.reload();
  }, [isPending, session?.user?.id]);
  return null;
}
```

To pair AssistantCloud with better-auth instead of a custom thread list, use the [backend token endpoint](#pairing-assistantcloud-with-a-backend-token-endpoint) below: resolve `session.user.id` server-side and mint the Cloud token with that id as `userId`.

## Pairing AssistantCloud with a backend token endpoint

Use this when you want Cloud-managed threads but need custom workspace logic, for example deriving the workspace from better-auth's `session.user.id` or Clerk's `orgId`. Resolve the user server-side, compute a `workspaceId`, mint a token with the API-key client, and return it.

```ts title="app/api/assistant-ui-token/route.ts"
import { AssistantCloud } from "assistant-cloud";
import { auth } from "@clerk/nextjs/server"; // or auth.api.getSession for better-auth

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
import { AssistantCloud } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

const cloud = new AssistantCloud({
  baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL!,
  authToken: () => fetch("/api/assistant-ui-token", { method: "POST" }).then((r) => r.text()),
});

const runtime = useChatRuntime({ cloud });
```

For better-auth, swap the `auth()` call for `await auth.api.getSession({ headers: await headers() })` and read `session.user.id`. Personal chats use `userId` alone as the workspace; org or project apps combine ids (`orgId_userId`, `projectId_userId`).

## Verify

- `/api/chat` returns `200` when authenticated and `401` when not.
- `/api/threads` (or the equivalent cloud call) returns only the current user's threads.
- A second user (incognito tab, different account) sees a different thread list.
- Signing out and back in does not show the previous user's threads even briefly; if it does, `ReloadOnAuth` is not mounted or is watching the wrong session field.
- For Clerk Orgs, switching the active organization in `<OrganizationSwitcher>` triggers a reload when `orgId` is wired into the scoping.
- The session cookie travels with same-origin fetches; split the API onto another host and you need `credentials: "include"` plus CORS.
