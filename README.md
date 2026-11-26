# assistant-ui Skills

Agent skills for building AI chat interfaces with [assistant-ui](https://assistant-ui.com).

## Installation

```bash
npx skills add assistant-ui/skills
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `/assistant-ui` | Overview and router: architecture, packages, picking a runtime |
| `/setup` | CLI scaffolding, templates and examples, runtime adapters for every backend |
| `/elements` | The styled component catalog: install, override slots, standalone versus runtime-connected |
| `/primitives` | Unstyled UI primitives (Thread, Composer, Message, ActionBar, BranchPicker) and composer features |
| `/runtime` | Runtimes, the aui client (`useAui`, `useAuiState`, `AuiConfig`), adapters, events |
| `/tools` | Toolkits with `"use generative"`, tool UI, approvals, MCP, MCP Apps, WebMCP, multi-agent |
| `/generative-ui` | The `present` tool, component vocabularies, Slack and Teams renderers, A2UI, OpenUI |
| `/streaming` | assistant-stream, data stream and Assistant Transport protocols, resumable streams |
| `/cloud` | Assistant Cloud persistence and authorization |
| `/thread-list` | Multi-thread management and thread list UI |
| `/copilots` | Ground the assistant in your app: instructions, context, visible components, interactables |
| `/markdown` | Markdown rendering, syntax highlighting, LaTeX, Mermaid, Streamdown |
| `/react-mcp` | User-managed MCP server UIs (connect, OAuth, elicitation) |
| `/observability` | Backend tracing (Langfuse, LangSmith, Helicone) and span visualization |
| `/react-native` | Expo and React Native chat with `@assistant-ui/react-native` |
| `/ink` | Terminal chat with `@assistant-ui/react-ink` |
| `/update` | Upgrade assistant-ui and the AI SDK, run codemods, apply migrations |

## Usage

After installation, type `/` followed by the skill name in Claude Code, for example `/setup` to scaffold a project or `/elements` to add a styled component.

## Maintaining

The skills are checked against a built assistant-ui checkout: every `import { ... } from "<package>"` in a code block must be a real export, relative links must resolve, and retired conventions are rejected.

```bash
node scripts/check-skills.mjs --assistant-ui ../assistant-ui
```

Run `pnpm build` in the checkout first so `packages/*/dist/index.d.ts` exist.

## ChatGPT and Codex

The same `assistant-ui/` plugin directory carries a Codex manifest (`assistant-ui/.codex-plugin/plugin.json`), so ChatGPT and Codex read the skills that Claude Code reads. The plugin is skills only: it declares no MCP server, because ChatGPT limits any plugin that does to the desktop app.

A workspace admin can import it from GitHub under **Admin > Plugins > Add > Import marketplace** with this repository as the Source and an empty Path. The marketplace file is `.agents/plugins/marketplace.json`.

To submit it to the ChatGPT plugin directory, zip the plugin directory's contents and upload the file at [platform.openai.com/plugins](https://platform.openai.com/plugins):

```bash
cd assistant-ui && zip -r ../assistant-ui-plugin.zip . -x '*.DS_Store'
```

Publishing needs an organization owner, or a member with Apps Management Write, on a verified developer identity. A change to the manifest or a skill needs a new ZIP and a new review.

## Links

- [Documentation](https://assistant-ui.com/docs)
- [GitHub](https://github.com/assistant-ui/assistant-ui)
- [Discord](https://discord.gg/assistant-ui)

## License

MIT
