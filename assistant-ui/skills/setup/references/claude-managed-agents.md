# Claude Managed Agents

[Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) is Anthropic's hosted agent platform: Anthropic runs the agent loop in a sandboxed container per session, and your client drives the session over an event stream. There is no `@assistant-ui/*` adapter package; the session shape maps directly onto two core primitives instead:

- [`useExternalStoreRuntime`](./custom-backend.md) renders messages folded from the session's event log, so replaying a stored session and tailing a live one run through the same pure function and can never disagree.
- `useRemoteThreadListRuntime` (see [runtime](../../runtime/SKILL.md)) turns the session list into the thread sidebar; a thread is a session, with no separate conversations table.

Anthropic ships a full reference implementation: the [Managed Agents quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/managed-agents/assistant-ui) (Next.js, composer, thread, sidebar, tool cards, approval gate). This page teaches the pattern; the quickstart is the runnable proof. Requires `@anthropic-ai/sdk` `^0.113.0` and `@assistant-ui/react` `0.14.27` or later.

## Contents

- [Event to message mapping](#the-event-to-message-mapping) | [Sessions as threads](#sessions-are-the-thread-list) | [Approval gate](#the-approval-gate) | [Token streaming](#token-streaming) | [Security](#security-boundary)

## The event to message mapping

| Managed Agents event | assistant-ui |
| --- | --- |
| `user.message` | A user message |
| `agent.message` | Assistant text (buffered, authoritative) |
| `event_start` / `event_delta` | The same text, streamed early as a token preview |
| `agent.thinking` | A reasoning part (progress signal only; no reasoning text) |
| `agent.tool_use` / `agent.mcp_tool_use` / `agent.custom_tool_use` | A tool-call part; `toolCallId` is the event id |
| `agent.tool_result` (and mcp/custom variants) | That part's result |
| `session.status_idle` with `stop_reason: requires_action` | `requires-action` status, plus an approval on each blocked tool part |
| `user.tool_confirmation` | The approval, settled allowed or denied |
| `session.status_running` / `status_idle` | Whether the turn is live (`isRunning`) |
| `session.error` | An error status, or a retry banner |

```tsx
const runtime = useExternalStoreRuntime<ThreadMessageLike>({
  messages: snapshot.messages,
  convertMessage: (m) => m,
  isRunning: isBusy(snapshot),
  onNew: async (message) => {
    const id = await ensureSession();
    await sendMessage(id, textOf(message));
  },
  onCancel: async () => controller.interrupt(), // Stop becomes a real server-side interrupt
  onRespondToToolApproval: async ({ approvalId, approved, reason }) => {
    controller.respondToApproval(approvalId, approved, reason);
  },
});
```

Because the fold is pure, an old chat replays `sessions.events.list()` through it and a live chat feeds the SSE tail through the same function, so they cannot render differently; approvals, denials, and results all come back after a reload because they live in the log, not in browser state.

## Sessions are the thread list

A `RemoteThreadListAdapter` over the session API; thread id and session id are the same string.

| Adapter method | Managed Agents call |
| --- | --- |
| `list` | `sessions.list()`, filtered to this app's sessions by a `metadata` tag |
| `initialize` | `sessions.create()`, invoked on the first message of a new chat |
| `rename` / `archive` / `delete` / `fetch` | `sessions.update({ title })` / `sessions.archive()` / `sessions.delete()` / `sessions.retrieve()` |
| `unarchive` | Throws; Managed Agents sessions cannot be unarchived, and switching to an archived thread auto-unarchives, so archived sessions should not render as switchable |
| `generateTitle` | Reads the title back after the server retitles the session from the first message |

A brand-new chat has no session until the first send; `initialize()` creates it lazily.

## The approval gate

A tool configured as `always_ask` under Managed Agents' [permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies) parks the session at `session.status_idle` with `stop_reason: { type: "requires_action", event_ids: [...] }` instead of running. The fold stamps an approval onto that tool part and sets `requires-action`, which is everything assistant-ui needs to render Allow/Deny. The click flows back as a `user.tool_confirmation` event: `{ tool_use_id, result: "deny", deny_message }`. `tool_use_id` is the tool-use **event** id, not an Anthropic `toolu_` id; a denial reaches the agent as the tool's result so it adjusts course rather than retrying. A custom client-executed tool takes a `user.custom_tool_result` instead of a confirmation; sending a confirmation for one is a 400.

## Token streaming

By default, assistant text arrives whole as `agent.message` when a model request finishes. Opting into `event_deltas: ["agent.message", "agent.thinking"]` adds `event_start`/`event_delta` previews; concatenating deltas yields a prefix of the final text, but the server may shed remaining deltas under load, so a preview is never necessarily complete. Append fragments for display and discard the accumulated preview once the buffered event arrives; never treat a preview as final. Previews are best-effort and gated per organization, so build against the buffered events first.

## Security boundary

The Anthropic API key stays server-side; the browser only talks to your route handlers. Because a session id arrives from the browser and becomes an API path parameter, validate ownership on every route (the id must resolve, belong to your agent, and carry your app's metadata tag) before any read or write, since the API key can see the whole workspace.

## Run the reference

```bash
git clone https://github.com/anthropics/claude-quickstarts
cd claude-quickstarts/managed-agents/assistant-ui
npm install
cp .env.example .env   # ANTHROPIC_API_KEY, or `ant auth login` once
npm run setup           # one-time: creates the agent + environment
npm run dev
```
