---
name: setup
description: "Installs and configures assistant-ui with the `assistant-ui` CLI (`create`, `init`, `add`, `update`, `upgrade`, `codemod`, `doctor`, `info`, `mcp`, `agent`) and picks the runtime adapter for a backend. Use for first-time install (`npx assistant-ui@latest create my-app` with templates `default`, `minimal`, `cloud`, `cloud-clerk`, `langchain`, `mcp`, `eve`, or `--example` scaffolds such as `with-ai-sdk-v7`, `with-langgraph`, `with-ag-ui`, `with-google-adk`, `with-eve`, `with-openui`, `with-expo`, `with-react-ink`), adding to an existing Next.js app (`init`), or keeping an install current (`update`, `upgrade`, `codemod`). Covers picking a runtime hook for a backend: `useChatRuntime` (AI SDK v7 via `@assistant-ui/ai-sdk`), `useLangGraphRuntime`, `useStreamRuntime` (LangChain), `useAdkRuntime` (Google ADK), `useA2ARuntime`, `useAgUiRuntime`, `useEveAgentRuntime`, `useOpenCodeRuntime`, `useLocalRuntime`, `useExternalStoreRuntime`, `useDataStreamRuntime`, and `useAssistantTransportRuntime`, plus wiring guides for Mastra, Cloudflare Agents, Claude Managed Agents, LLM gateways, a ChatGPT subscription, and Electron. Also covers the Expo (`--native`) and React Ink (`--ink`) platform scaffolds and the hosted MCP docs server. Route here for the CLI itself, choosing a runtime, or a platform target; once a runtime exists, use elements to install the styled Thread/composer, primitives for unstyled building blocks, runtime for the chosen runtime's hooks and adapters in depth, react-native or ink for platform specifics, and update for a deep migration."
license: MIT
---

# assistant-ui Setup

**Always consult [assistant-ui.com/llms.txt](https://www.assistant-ui.com/llms.txt) for the latest API.**

The `assistant-ui` CLI scaffolds projects, adds components, and keeps an install current. This skill covers the CLI end to end and the decision of which runtime adapter to wire up next; installing the styled UI itself is [elements](../elements/SKILL.md).

## References

- [./references/ai-sdk.md](./references/ai-sdk.md) -- `@assistant-ui/ai-sdk` (v7): transport, frontend tools, multi-step, approval, quote context, token usage, history, `useAISDKRuntime`
- [./references/ai-sdk-legacy.md](./references/ai-sdk-legacy.md) -- pinned `@assistant-ui/react-ai-sdk` (v6, v5) and `@assistant-ui/react-data-stream` (v4) setups
- [./references/langgraph.md](./references/langgraph.md) -- `@assistant-ui/react-langgraph`: streaming, interrupts, message editing, threads, agent state
- [./references/langchain.md](./references/langchain.md) -- `@assistant-ui/react-langchain`: the `useStream`-based LangGraph adapter, and its comparison to react-langgraph
- [./references/google-adk.md](./references/google-adk.md) -- `@assistant-ui/react-google-adk`: streaming, tool confirmations, auth flows, input requests, artifacts
- [./references/a2a.md](./references/a2a.md) -- `@assistant-ui/react-a2a`: `A2AClient`, task states, artifacts, multi-tenancy
- [./references/ag-ui.md](./references/ag-ui.md) -- `@assistant-ui/react-ag-ui`: agent state, interrupts, subagent nesting, custom events
- [./references/eve.md](./references/eve.md) -- `@assistant-ui/eve`: sessions, connector authorization, `withEve` + `withAui`
- [./references/opencode.md](./references/opencode.md) -- `@assistant-ui/react-opencode`: permissions, questions, sub-agent tasks, session extras
- [./references/claude-managed-agents.md](./references/claude-managed-agents.md) -- wiring Anthropic Managed Agents sessions through `useExternalStoreRuntime`
- [./references/custom-backend.md](./references/custom-backend.md) -- `useLocalRuntime` and `useExternalStoreRuntime` for a backend with no dedicated adapter
- [./references/tanstack.md](./references/tanstack.md) -- Vite + TanStack Router/Start setup
- [./references/mastra.md](./references/mastra.md) -- Mastra full-stack and separate-server patterns over the AI SDK runtime
- [./references/cloudflare-agents.md](./references/cloudflare-agents.md) -- Durable Object agents via `@cloudflare/ai-chat` and `useAISDKRuntime`
- [./references/providers.md](./references/providers.md) -- LLM gateways, a ChatGPT/Codex subscription for local dev, and Electron
- [./references/devtools.md](./references/devtools.md) -- `@assistant-ui/react-devtools`, `DevToolsModal`, custom plugins

## CLI decision flow

- New app / empty directory: `npx assistant-ui@latest create <name>`
- Existing project with a `package.json`: `npx assistant-ui@latest init`
- Add one or more styled components to a project that already has a runtime: `npx assistant-ui@latest add <items...>` (see [elements](../elements/SKILL.md))
- Bump `@assistant-ui/*` versions: `npx assistant-ui@latest update`
- Migrate across a breaking release: `npx assistant-ui@latest upgrade` (see [update](../update/SKILL.md) for the full migration map)
- Connect an editor to the docs: `npx assistant-ui@latest mcp`
- Collect environment info for a bug report: `npx assistant-ui@latest info`
- Diagnose version drift or a broken install: `npx assistant-ui@latest doctor`
- Open Claude Code with these skills preloaded: `npx assistant-ui@latest agent "add a chat sidebar"`

## create

```bash
npx assistant-ui@latest create my-app
npx assistant-ui@latest create my-app -t cloud-clerk
npx assistant-ui@latest create my-app -e with-langgraph
npx assistant-ui@latest create my-app --native   # Expo, equivalent to -e with-expo
npx assistant-ui@latest create my-app --ink      # React Ink, equivalent to -e with-react-ink
```

Templates (`-t, --template`):

| Template | Contents |
| --- | --- |
| `default` | Vercel AI SDK, `useChatRuntime` |
| `minimal` | Bare-bones starting point with local components |
| `cloud` | AssistantCloud-backed persistence |
| `cloud-clerk` | AssistantCloud persistence with Clerk auth |
| `langchain` | LangGraph starter on the `@assistant-ui/react-langchain` adapter |
| `mcp` | MCP tools plus the MCP Apps renderer |
| `eve` | Eve agent on `eve/next` |

There is no `langgraph` template; the LangGraph-backed starter is `langchain` (`react-langchain`), and `-e with-langgraph` scaffolds the raw `@assistant-ui/react-langgraph` adapter instead.

Examples (`-e, --example`), each a full feature demo:

| Example | Demonstrates |
| --- | --- |
| `with-ai-sdk-v7` | Vercel AI SDK v7 |
| `with-eve` | Eve agent integration |
| `with-artifacts` | HTML artifact rendering with live preview |
| `with-langgraph` | LangGraph agent with custom tools |
| `with-google-adk` | Google ADK agent |
| `with-ag-ui` | AG-UI protocol |
| `with-cloud` | AssistantCloud persistence |
| `with-assistant-transport` | Custom backend via Assistant Transport |
| `with-resumable-stream` | Resumable stream that survives a reload mid-response |
| `with-chain-of-thought` | Reasoning, tool calls, source citations |
| `with-external-store` | External message store |
| `with-interactables` | AI-driven interactive UI components |
| `with-openui` | OpenUI generative UI |
| `with-custom-thread-list` | Custom thread list UI |
| `with-react-hook-form` | React Hook Form integration |
| `with-ffmpeg` | FFmpeg video processing tool |
| `with-elevenlabs-conversational` | Realtime voice, ElevenLabs |
| `with-livekit` | Realtime voice, LiveKit |
| `with-elevenlabs-scribe` | Voice transcription, ElevenLabs |
| `with-expo` | Expo / React Native (also `--native`) |
| `with-react-ink` | Terminal UI chat (also `--ink`) |
| `with-react-router` | React Router v7 |
| `with-tanstack` | TanStack Start |

Other flags: `-p, --preset <name-or-url>` applies a playground preset (e.g. `chatgpt`) via `shadcn add` after scaffolding, and may combine with `--template` but not with `--example`, `--native`, or `--ink`; `--use-npm` / `--use-pnpm` / `--use-yarn` / `--use-bun` pin the package manager; `--skip-install` skips installing packages; `--skills` / `--no-skills` add or skip this repository's agent skills (prompted when omitted in a TTY). In a non-interactive shell, an omitted `-t`/`-e` defaults to the `default` template, and an omitted project directory defaults to `my-aui-app`.

## init

```bash
npx assistant-ui@latest init
```

For an **existing** project with a `package.json`: detects the project, runs `shadcn add` for the quick-start component, adds the default components, and configures TypeScript paths. Flags: `-y, --yes` skips the confirmation prompt (use it in CI or an agent shell), `-o, --overwrite` replaces existing files, `-c, --cwd <dir>` picks the project, `--use-npm` / `--use-pnpm` / `--use-yarn` / `--use-bun` pin the package manager, and `--skip-install` skips installing packages. Run without a `package.json` and it forwards to `create` instead.

## add

```bash
npx assistant-ui@latest add thread thread-list
```

Once a runtime is wired up, `add` fetches styled components from the assistant-ui registry (`r.assistant-ui.com`), installing their npm dependencies and TypeScript types and resolving registry dependencies (`thread` also pulls `markdown-text`, `tool-fallback`, `reasoning`, and more). `-y, --yes` skips the confirmation prompt (default `true`), `-o, --overwrite` replaces existing files, and `-p, --path` retargets the install directory. See [elements](../elements/SKILL.md) for the full catalog, the runtime-connected (`.aui`) versus standalone split, and the Radix/Base UI style-aware registry URL.

## Keeping an install current

| Command | Purpose |
| --- | --- |
| `assistant-ui update [--dry]` | Bump every installed `@assistant-ui/*` package to latest; `--dry` prints the command instead of running it |
| `assistant-ui upgrade [-d] [-p] [--verbose]` | Run every bundled codemod for the current major in order; `-d` dry-runs, `-p` prints transformed files |
| `assistant-ui codemod <name> <source> [-d] [-p]` | Run one named codemod instead of the full upgrade sequence |
| `assistant-ui mcp [--cursor\|--windsurf\|--vscode\|--zed\|--claude-code\|--claude-desktop]` | Register the hosted MCP docs endpoint (`https://www.assistant-ui.com/mcp`) for the named IDE, or the local `@assistant-ui/mcp-docs-server` stdio server for Zed and Claude Desktop, which only launch local servers |
| `assistant-ui info` | Print CLI, OS, package manager, framework, installed `@assistant-ui/*`/ecosystem versions, as a paste-ready block for a bug report |
| `assistant-ui doctor [--no-network]` | Diagnose an existing install (version drift across `@assistant-ui/*` packages, misconfiguration); `--no-network` skips the npm registry check for latest versions |
| `assistant-ui agent "<prompt>" [--dry]` | Launch Claude Code preloaded with the assistant-ui skills and the given prompt; `--dry` prints the command instead of running it |

Never run `codemod v0-8/ui-package-split` against a current (0.15.x) install; its `@assistant-ui/react-ui` destination predates the current runtime and `upgrade` already excludes it. For the full version table, migration order, and 0.15.x follow-up moves (registry paths, `AuiConfig`, `threads.selectionChanged`), see [update](../update/SKILL.md).

## Pick a runtime

By framework, when one already fits:

| Backend | Hook | Package | Reference |
| --- | --- | --- | --- |
| Vercel AI SDK v7 | `useChatRuntime` | `@assistant-ui/ai-sdk` | [ai-sdk.md](./references/ai-sdk.md) |
| LangGraph Cloud (raw SDK) | `useLangGraphRuntime` | `@assistant-ui/react-langgraph` | [langgraph.md](./references/langgraph.md) |
| LangGraph Cloud (`useStream`) | `useStreamRuntime` | `@assistant-ui/react-langchain` | [langchain.md](./references/langchain.md) |
| Google ADK (JS or Python) | `useAdkRuntime` | `@assistant-ui/react-google-adk` | [google-adk.md](./references/google-adk.md) |
| A2A v1.0 agent server | `useA2ARuntime` | `@assistant-ui/react-a2a` | [a2a.md](./references/a2a.md) |
| AG-UI agent server | `useAgUiRuntime` | `@assistant-ui/react-ag-ui` | [ag-ui.md](./references/ag-ui.md) |
| Eve (`eve/next`) | `useEveAgentRuntime` | `@assistant-ui/eve` | [eve.md](./references/eve.md) |
| OpenCode server (experimental) | `useOpenCodeRuntime` | `@assistant-ui/react-opencode` | [opencode.md](./references/opencode.md) |
| Claude Managed Agents session | `useExternalStoreRuntime` + `useRemoteThreadListRuntime` | `@assistant-ui/react` (no dedicated adapter) | [claude-managed-agents.md](./references/claude-managed-agents.md) |

By need, when no framework adapter fits (full decision tree in [custom-backend.md](./references/custom-backend.md)):

| You need | Hook | Reference |
| --- | --- | --- |
| A `fetch` call to your API; the runtime owns state | `useLocalRuntime` | [custom-backend.md](./references/custom-backend.md) |
| Messages already live in redux, zustand, tanstack-query | `useExternalStoreRuntime` | [custom-backend.md](./references/custom-backend.md) |
| Backend already emits the data stream protocol | `useDataStreamRuntime` | [../streaming/SKILL.md](../streaming/SKILL.md) |
| Backend streams full agent-state snapshots, or needs bidirectional commands | `useAssistantTransportRuntime` | [../streaming/SKILL.md](../streaming/SKILL.md) |

Framework and provider wiring guides, all layered on the AI SDK runtime above rather than a dedicated adapter: [mastra.md](./references/mastra.md) (full-stack or separate server), [cloudflare-agents.md](./references/cloudflare-agents.md) (Durable Object agents), and [providers.md](./references/providers.md) (LLM gateways for routing and BYOK, a ChatGPT/Codex subscription for local dev without an API key, and Electron's hosted-backend versus local-main-process split).

## Platform targets

| Target | Package | Scaffold | Skill |
| --- | --- | --- | --- |
| Web (React) | `@assistant-ui/react` | `create` | this skill, [elements](../elements/SKILL.md) |
| Expo / React Native | `@assistant-ui/react-native` + `@assistant-ui/metro` | `create <name> --native` (or `-e with-expo`) | [react-native](../react-native/SKILL.md) |
| Terminal | `@assistant-ui/react-ink` + `@assistant-ui/react-ink-markdown` | `create <name> --ink` (or `-e with-react-ink`) | [ink](../ink/SKILL.md) |

Vite-based web apps (TanStack Start, plain Vite, Nuxt) are not a `create` template; see [tanstack.md](./references/tanstack.md) for manual setup and the `aui()` compiler plugin from `@assistant-ui/vite`.

## Common Gotchas

**`npx assistant-ui create` picks the default template with no prompt**
- Stdin is not a TTY (CI, an agent shell). Pass `-t`/`-e` explicitly instead of relying on the interactive picker.

**"Only one scaffold selector can be provided"**
- `--template`, `--example`, `--native`, and `--ink` are mutually exclusive. `--preset` may pair with `--template` but not with the other three.

**`init` hangs in CI or an agent shell**
- Pass `-y, --yes` so it skips its confirmation prompt; add `-o, --overwrite` when it should replace files a previous run left behind.

**A dependency on `@assistant-ui/styles` or `@assistant-ui/react-ui` fails to resolve or install**
- Both packages are retired (`@assistant-ui/styles` is marked deprecated on npm). Styling now comes from the elements the CLI copies into your project; remove the dependency and run `npx assistant-ui@latest add thread`.

**`Cannot find module '@/components/assistant-ui/thread'`**
- Components moved under `elements/` with a `.aui` suffix on runtime-connected files: `@/components/assistant-ui/elements/thread.aui`. See [elements](../elements/SKILL.md).

**`add` reinstalls a component you already customized**
- Pass `-o, --overwrite` deliberately, or move your edits aside first; a plain `add` skips a file that already exists.

**Registry install fails mid-`create`**
- `create` still finishes the project; rerun the printed retry command from the project directory once the registry or network issue clears.

## Related Skills

- [elements](../elements/SKILL.md) -- install and customize the styled Thread, ThreadList, and 120+ catalog components via `add`
- [primitives](../primitives/SKILL.md) -- unstyled building blocks when composing your own UI instead of `elements`
- [runtime](../runtime/SKILL.md) -- the chosen runtime's hooks, adapters, events, and capabilities in depth
- [update](../update/SKILL.md) -- version detection, the full migration map, and the codemod list behind `upgrade`
- [react-native](../react-native/SKILL.md) -- Expo / React Native specifics once scaffolded with `--native`
- [ink](../ink/SKILL.md) -- React Ink terminal specifics once scaffolded with `--ink`
- [cloud](../cloud/SKILL.md) -- AssistantCloud persistence behind the `cloud` and `cloud-clerk` templates
- [tools](../tools/SKILL.md) -- defining tools once a runtime is wired up
