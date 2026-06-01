---
name: update
description: "Upgrades an existing assistant-ui project to current releases and executes the resulting migrations. Use when the user wants to update, upgrade, bump, or migrate @assistant-ui/react, @assistant-ui/react-ai-sdk, ai, or @ai-sdk/react, hits peer-dependency conflicts or post-upgrade type errors, or must apply renamed APIs after a version jump. Detects installed versus latest versions via npm ls / npm view, then routes through breaking-change references for each jump (AI SDK v4/v5 to v6; assistant-ui 0.8.x to 0.14.x): useAssistantApi to useAui, runtime.threadList to runtime.threads, ThreadPrimitive.ViewportSlack removal, the primitives components prop to children render functions, toDataStreamResponse to toUIMessageStreamResponse, maxSteps to stopWhen: stepCountIs(n). Runs npx assistant-ui@latest upgrade, pnpm/npm add @latest, and npx tsc --noEmit to verify. For a first-time install or fresh scaffold (not an upgrade) use setup instead."
license: MIT
---

# assistant-ui Update

**Always verifies against npm ground truth and GitHub commits.**

## References

- [./references/ai-sdk-v6.md](./references/ai-sdk-v6.md) -- AI SDK v4/v5 → v6 migration (complete guide)
- [./references/assistant-ui.md](./references/assistant-ui.md) -- assistant-ui version migrations
- [./references/breaking-changes.md](./references/breaking-changes.md) -- Quick reference table

## Phase 1: Detect Versions

### Get Ground Truth

```bash
npm ls @assistant-ui/react @assistant-ui/react-ai-sdk ai @ai-sdk/react 2>/dev/null

npm view @assistant-ui/react version
npm view @assistant-ui/react-ai-sdk version
npm view ai version
```

### Version Analysis

Current latest: `@assistant-ui/react` 0.14.x, `@assistant-ui/react-ai-sdk` 1.3.x, `assistant-stream` 0.3.x.

| Package | Check For |
|---------|-----------|
| `ai` | < 6.0.0 → needs AI SDK v6 migration |
| `@assistant-ui/react` | < 0.14.0 → primitives `components` prop replaced by children render functions; deprecated hooks/aliases removed |
| `@assistant-ui/react` | < 0.13.0 → `ThreadPrimitive.ViewportSlack` removed (top-anchor changes) |
| `@assistant-ui/react` | < 0.12.0 → unified state API (`useAui`/`useAuiState`/`useAuiEvent`/`AuiIf`) |
| `@assistant-ui/react` | < 0.11.0 → runtime rearchitecture |
| `@assistant-ui/react` | < 0.10.0 → ESM only |
| `@assistant-ui/react` | < 0.8.0 → UI split (shadcn registry) |
| `@assistant-ui/react-ai-sdk` | < 1.0.0 → needs AI SDK v6 first |

## Phase 2: Route to Migration

```
AI SDK < 6.0.0?
├─ Yes → See ./references/ai-sdk-v6.md
└─ No
   └─ assistant-ui outdated?
      ├─ Yes → See ./references/assistant-ui.md
      └─ No → Already up to date
```

### Migration Order

1. **AI SDK first** (if < 6.0.0) - Required for @assistant-ui/react-ai-sdk >= 1.0
2. **assistant-ui second** - Apply breaking changes for version jump
3. **Verify** - Type check, build, test

## Phase 3: Execute

### Update Packages

```bash
pnpm add @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest ai@latest @ai-sdk/react@latest

npm install @assistant-ui/react@latest @assistant-ui/react-ai-sdk@latest ai@latest @ai-sdk/react@latest
```

### Apply Migrations

Based on version jump, apply relevant migrations from references.

### Verify

```bash
npx tsc --noEmit
pnpm build
```

## Troubleshooting

**"Peer dependency conflict"**
- Update all packages together
- Check version compatibility in [./references/breaking-changes.md](./references/breaking-changes.md)

**Type errors after upgrade**
- Consult breaking changes reference
- Check specific migration guide

**Runtime errors**
- Verify API patterns match new version
- Check for renamed/moved APIs
