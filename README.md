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

## Links

- [Documentation](https://assistant-ui.com/docs)
- [GitHub](https://github.com/assistant-ui/assistant-ui)
- [Discord](https://discord.gg/assistant-ui)

## License

MIT
