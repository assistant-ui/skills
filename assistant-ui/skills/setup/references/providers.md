# Providers: gateways, a subscription for local dev, and Electron

Wiring guides that layer on top of an existing runtime (usually the [AI SDK runtime](./ai-sdk.md)) rather than replacing it.

## Contents

- [LLM gateways](#llm-gateways) | [ChatGPT/Codex subscription](#chatgptcodex-subscription-for-local-dev) | [Electron](#electron)

## LLM gateways

OpenAI-compatible proxies that add catalog routing, fallback, or BYOK in front of the model call. All three below speak OpenAI's API, so the integration is a `baseURL` swap on `createOpenAI`:

```ts title="app/api/chat/route.ts"
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";

const openai = createOpenAI({ baseURL: "<gateway base url>", headers: {} });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: openai("<model id>"), messages: await convertToModelMessages(messages) });
  return result.toUIMessageStreamResponse();
}
```

| Gateway | Base URL | Auth header | Pick it for |
| --- | --- | --- | --- |
| [OpenRouter](https://openrouter.ai/) | `https://openrouter.ai/api/v1` | `Authorization: Bearer <key>` | A single bill across 100+ `vendor/model` ids |
| [Portkey](https://portkey.ai/) | `https://api.portkey.ai/v1` | `x-portkey-api-key` | Config-driven cross-provider fallback and caching |
| [LiteLLM Proxy](https://docs.litellm.ai/docs/simple_proxy) | Self-hosted | `Authorization: Bearer <virtual key>` | Self-host requirement, or per-tenant BYOK metering |

For pure request logging rather than routing, see Helicone under [observability](../../observability/SKILL.md) instead; a gateway and an observability proxy are not mutually exclusive (Helicone in front of OpenRouter is a common stack). Every gateway key is a write capability against your billing account; keep it server-side.

## ChatGPT/Codex subscription (local dev)

With a ChatGPT Plus or Pro subscription, run local development against it instead of paying per token with an API key. The Codex CLI authenticates via OAuth and caches tokens at `~/.codex/auth.json`; requests made with those tokens bill to your plan.

```sh
npx @openai/codex login
```

The community provider [`openai-oauth-provider`](https://github.com/EvanZhouDev/openai-oauth) reads that file automatically and drops into a normal chat route in place of `@ai-sdk/openai`:

```ts title="app/api/chat/route.ts"
import { createOpenAIOAuth } from "openai-oauth-provider";
import { frontendTools } from "@assistant-ui/ai-sdk";
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";

const openai = createOpenAIOAuth();

export async function POST(req: Request) {
  const { messages, tools }: { messages: UIMessage[]; tools?: any } = await req.json();
  const result = streamText({
    model: openai("gpt-5.3-codex"),
    messages: await convertToModelMessages(messages),
    tools: frontendTools(tools ?? {}),
  });
  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
```

An Eve agent takes the same provider-authored `LanguageModel` directly: `defineAgent({ model: createOpenAIOAuth()("gpt-5.3-codex") })` (see [eve.md](./eve.md)). For a stack that wants a base URL instead of an AI SDK model, the sibling `openai-oauth` package runs a local OpenAI-compatible proxy (`npx openai-oauth`) bound to `127.0.0.1`.

This is personal, local-machine use only: the tokens live in `~/.codex/auth.json`, a deployed instance would bill every visitor to your subscription, and `openai-oauth-provider` is an unofficial community package.

## Electron

`@assistant-ui/react` runs unmodified in an Electron renderer (a plain React DOM environment); the only decision is where model requests run.

| Pattern | Use it when | Runtime |
| --- | --- | --- |
| Hosted backend | You already have an AI SDK endpoint, need server auth or persistence, or ship to other people | `useChatRuntime` with an absolute HTTPS URL |
| Local main process | The app owns the provider or agent process and must work without a web backend | `useLocalRuntime` with a narrow preload/IPC bridge |

Hosted backend is the smallest integration; keep the existing AI SDK route and point the transport at its public URL (must be absolute in a packaged app, since a relative `/api/chat` targets the renderer's own origin):

```tsx title="renderer/assistant-runtime.tsx"
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";

const transport = new AssistantChatTransport({ api: "https://api.example.com/chat" });

export function ElectronRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime({ transport });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
```

Local main process keeps `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and streams over a dedicated `MessagePort` rather than sending an SDK client, callback, `AbortSignal`, or `File` through IPC (Electron IPC uses structured-clone semantics). Define a small data-only protocol (`ChatRequest`/`ChatEvent`), expose one preload capability via `contextBridge.exposeInMainWorld` instead of raw `ipcRenderer`, validate every sender and payload in the main process before calling the model, and adapt the IPC deltas into a `ChatModelAdapter.run` generator on the renderer side with `useLocalRuntime`. Never put a provider API key in renderer code or a preload script; keep it in the main process only.

Packaged-app checklist: use an absolute HTTPS endpoint or the preload bridge, not a relative `/api/*` route; serve local content through a custom protocol rather than `file://` with a restrictive CSP; validate every IPC sender and payload as untrusted; intercept new windows with `webContents.setWindowOpenHandler`; test the packaged build, not only the dev server. See Electron's own guides to [IPC and MessagePorts](https://www.electronjs.org/docs/latest/tutorial/message-ports), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), and the [security checklist](https://www.electronjs.org/docs/latest/tutorial/security) for the full platform detail.
