# Eve Runtime

`@assistant-ui/eve` integrates assistant-ui with [Eve](https://eve.dev/), Vercel's filesystem-first framework for durable agents. It wraps Eve's `useEveAgent` hook as an assistant-ui `ExternalStoreRuntime`: Eve owns the session stream, assistant-ui renders messages, reasoning, dynamic tool calls, and approval requests.

## Contents

- [Install](#install) | [Quickstart](#quickstart) | [Client context](#client-context) | [Connector authorization](#connector-authorization) | [Production auth](#production-auth)

## Install

```bash
npm install @assistant-ui/react @assistant-ui/eve eve
```

Requires Node.js 24+, an Eve app mounted with `eve/next`, and a model credential for `agent/agent.ts` (Eve's gateway model ids route through the Vercel AI Gateway by default; `AI_GATEWAY_API_KEY` or Vercel OIDC, or configure a direct provider `LanguageModel`; for local dev without any key, see [providers.md](./providers.md)).

## Quickstart

Template:

```sh
npx create-assistant-ui@latest -t eve my-app
```

```sh title=".env.local"
AI_GATEWAY_API_KEY=your-api-key
```

Manual setup:

```ts title="next.config.ts"
import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";
import { withEve } from "eve/next";

export default withEve(withAui({} satisfies NextConfig));
```

```ts title="agent/agent.ts"
import { defineAgent } from "eve";

export default defineAgent({ model: "anthropic/claude-sonnet-4.6" });
```

```tsx title="app/page.tsx"
"use client";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { useEveAgentRuntime } from "@assistant-ui/eve";
import { AssistantRuntimeProvider } from "@assistant-ui/react";

export default function Home() {
  const runtime = useEveAgentRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}
```

For an existing Eve app, register the registry once and install the chat page from it instead of writing the above by hand:

```sh
eve registry add @assistant-ui=https://r.assistant-ui.com/{name}.json
eve add @assistant-ui/eve-chat --overwrite
```

`eve add` installs `@assistant-ui/react` and `@assistant-ui/eve`, writes `app/page.tsx`, and writes the thread component plus everything it imports into `components/assistant-ui` and `components/ui`. `--overwrite` is global, so it also replaces any existing files of the same name; install on a clean tree and read the diff. It expects the Next.js Web Chat scaffold from `eve init --channel-web-nextjs` (the installed files import through the `@/*` alias that scaffold sets up). Add the reasoning/tool animation styles to `app/globals.css` yourself; the CLI writes registry files but does not edit CSS (see [devtools.md](./devtools.md) for the general elements CSS requirements).

## Client context

A per-turn `runConfig.custom` bag is forwarded to Eve as `clientContext` (`runConfig: { custom: { page: "/pricing" } }` arrives as `clientContext: { page: "/pricing" }`); every value must be JSON-serializable, and an empty or absent bag is omitted. Eve turns the object into a model context message the model reads as text, so keep secrets and personal data out of it; it cannot select a model or change how the turn executes.

## Connector authorization

When Eve pauses for connector authorization, the runtime emits an assistant data part named `authorization` (`state`, `name`, and display fields like `displayName`, `url`, `userCode`, `instructions`, `expiresAt`; completed parts add `outcome`/`reason`). Register a renderer with `makeAssistantDataUI`, typed with the exported `EveAuthorizationData`:

```tsx title="authorization-ui.tsx"
import type { EveAuthorizationData } from "@assistant-ui/eve";
import { makeAssistantDataUI } from "@assistant-ui/react";

export const AuthorizationUI = makeAssistantDataUI<EveAuthorizationData>({
  name: "authorization",
  render: ({ data }) =>
    data.state === "required" ? (
      <div>
        <p>{data.instructions ?? `Sign in to ${data.displayName ?? data.name}`}</p>
        {data.url && <a href={data.url}>Continue to sign in</a>}
      </div>
    ) : (
      <p>{data.outcome ?? "Authorization completed"}</p>
    ),
});
```

Mount `<AuthorizationUI />` inside the `AssistantRuntimeProvider` tree; the standard thread leaves unmatched data parts unrendered. See [generative-ui](../../generative-ui/SKILL.md) for the general data-part renderer contract.

## Production auth

The built-in `eve` channel accepts localhost during development and trusted Vercel OIDC callers only; it does not admit browser users in production. Define `agent/channels/eve.ts` before deploying:

```ts title="agent/channels/eve.ts"
import { localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

export default eveChannel({ auth: [localDev(), vercelOidc()] });
```

Swap in Clerk, Auth.js, OIDC, or JWT verification for the real deployment.
