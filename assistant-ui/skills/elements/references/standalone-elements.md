# Standalone elements

Every element below takes plain props and never reads runtime state, so it works in a tool `render`, a dashboard, or Storybook. Install with `npx assistant-ui@latest add <item>` and import from `@/components/assistant-ui/elements/<file>` (no `.aui` suffix). Sections match [./catalog.md](./catalog.md)'s grouping; a few entries also work from a runtime, wired as a toolkit `render` (see [../../tools/SKILL.md](../../tools/SKILL.md)) rather than passed props directly, noted where relevant. All `div` props not listed are forwarded to the root unless a page says otherwise.

## Contents

- [Reasoning](#reasoning): loading-state, thinking-indicator, streaming-text, typing-indicator, reasoning-effort, guardrail-notice, reasoning-panel
- [Messages](#messages): message-pair, message-branches, message-actions, error-state, message-queue, edit-message, feedback-dialog, stopped-run, day-separator, speaker-identity, regenerate-menu, confidence-marker, message-attachment, quote-reply, message-timing
- [Tool use](#tool-use): tool-call, tool-timeline, terminal-block, code-diff, reviewable-diff, file-tree, elicitation-form, mcp-server-panel, tool-error, permission-grant, computer-use, code-runner, tool-group
- [Knowledge](#knowledge): web-search, inline-citation, image-generation, retrieval-chunks, document-reference, memory-chips, research-report, map-answer, sources
- [Structured output](#structured-output): data-table, number-ticker, chart, web-preview, diagram, flow-graph, activity-graph, math-block, spec-sheet, comparison-card, timeline, job-progress, score-breakdown
- [Agents](#agents): agent-plan, subagent-list, agent-status, approval-card, recommendation-card, artifact-card, todo-list, agent-card, agent-handoff, background-inbox, checkpoint-history, schedule-card
- [Observability](#observability): trace-waterfall, cost-meter, quota-banner
- [Composer](#composer): composer (and its variants), draft-restore, context-breakdown, prompt-library, command-palette, model-picker
- [Voice](#voice): voice-conversation, read-aloud
- [Thread](#thread): chat-panel, empty-state, scroll-anchor, canvas-split, connection-state, shared-conversation, conversation-search, thread-search, launcher-bubble, settings-panel, onboarding, mobile-composer, suggestions

Eight entries below (`reasoning-panel`, `message-attachment`, `quote-reply`, `message-timing`, `tool-group`, `sources`, `model-picker`, `suggestions`) are alternate, props-driven designs documented on the same catalog page as a runtime-connected element in [./aui-elements.md](./aui-elements.md); `catalog.md` does not list them as separate rows, but each installs under its own `elements-*` registry item.

## Reasoning

### loading-state

```bash
npx assistant-ui@latest add elements-loading-state
```

A pixel matrix that keeps time while nothing has streamed in yet; `tick` is a counter you advance yourself.

```tsx
import { GenerationLoader } from "@/components/assistant-ui/elements/loading-state";

<GenerationLoader label="Thinking" tick={tick} variant="dots" />;
```

### thinking-indicator

```bash
npx assistant-ui@latest add elements-thinking-indicator
```

A live status line naming what the agent is doing right now, with an optional elapsed badge.

```tsx
import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";

<ThinkingIndicator label="Searching the codebase" elapsed="4s" />;
```

### streaming-text

```bash
npx assistant-ui@latest add elements-streaming-text
```

A word stream where the newest words land tinted and settle into ink as `count` advances.

```tsx
import { StreamingText, type Segment } from "@/components/assistant-ui/elements/streaming-text";

const segments: Segment[] = [{ text: "Reading the schema, then writing the migration." }];

<StreamingText segments={segments} count={4} streaming />;
```

### typing-indicator

```bash
npx assistant-ui@latest add elements-typing-indicator
```

The classic three dots, tuned to read as presence; `variant="bare"` drops the bubble.

```tsx
import { TypingIndicator } from "@/components/assistant-ui/elements/typing-indicator";

<TypingIndicator variant="bubble" />;
```

### reasoning-effort

```bash
npx assistant-ui@latest add elements-reasoning-effort
```

How hard to think, and how much of that budget the run actually spent.

```tsx
import { ReasoningEffort, type EffortLevel } from "@/components/assistant-ui/elements/reasoning-effort";

const levels: EffortLevel[] = [
  { key: "low", label: "Low", budget: 2000 },
  { key: "high", label: "High", budget: 20000 },
];

<ReasoningEffort levels={levels} selectedKey="high" spent={9500} onSelect={setKey} />;
```

### guardrail-notice

```bash
npx assistant-ui@latest add elements-guardrail-notice
```

A refusal shown as its own shape, with the nearest thing it can do instead.

```tsx
import { GuardrailNotice } from "@/components/assistant-ui/elements/guardrail-notice";

<GuardrailNotice
  title="Can't help with that"
  explanation="This request falls outside what I can assist with."
  policy="content-policy"
  alternatives={["Ask about something else", "Rephrase the request"]}
  onPick={(alt) => send(alt)}
/>;
```

### reasoning-panel

```bash
npx assistant-ui@latest add elements-reasoning-panel
```

An alternate design for the reasoning trace: an ordered list of titled steps with a shimmering trigger that settles into a resting summary, instead of one continuous markdown block.

```tsx
import { ReasoningPanel, type ReasoningStep } from "@/components/assistant-ui/elements/reasoning-panel";

const steps: ReasoningStep[] = [{ title: "Reading the request", body: "Working out what changed." }];

<ReasoningPanel
  steps={steps}
  visibleSteps={steps.length}
  streaming={false}
  open={open}
  onOpenChange={setOpen}
  restingLabel="Thought for 4s"
/>;
```

## Messages

### message-pair

```bash
npx assistant-ui@latest add elements-message-pair
```

A user bubble and a streaming assistant reply, with actions that appear on hover.

```tsx
import { MessagePair } from "@/components/assistant-ui/elements/message-pair";

<MessagePair
  userMessage="Summarize this PR"
  words={["It", "renames", "the", "config", "key."]}
  visibleWords={3}
  streaming
  variant="bubble"
/>;
```

### message-branches

```bash
npx assistant-ui@latest add elements-message-branches
```

Navigate between regenerated versions of the same answer without losing your place.

```tsx
import { MessageBranches } from "@/components/assistant-ui/elements/message-branches";

<MessageBranches variants={["First answer", "Second answer"]} index={0} onIndexChange={setIndex} />;
```

### message-actions

```bash
npx assistant-ui@latest add elements-message-actions
```

Copy, rate, and regenerate; each action confirms itself with a small state change.

```tsx
import { MessageActions } from "@/components/assistant-ui/elements/message-actions";

<MessageActions
  copied={copied}
  reaction={reaction}
  regenerating={false}
  onCopy={handleCopy}
  onReactionChange={setReaction}
  onRegenerate={handleRegenerate}
  onMore={openMenu}
/>;
```

### error-state

```bash
npx assistant-ui@latest add elements-error-state
```

A quiet failure banner with a retry path, not a modal in your face.

```tsx
import { ErrorState } from "@/components/assistant-ui/elements/error-state";

<ErrorState
  title="Something went wrong"
  detail="The request timed out after 30 seconds."
  retrying={false}
  onRetry={retry}
/>;
```

### message-queue

```bash
npx assistant-ui@latest add elements-message-queue
```

Turns typed while a run was in flight, stacked and cancelable until it finishes.

```tsx
import { MessageQueue, type QueuedMessage } from "@/components/assistant-ui/elements/message-queue";

const queued: QueuedMessage[] = [{ id: "1", text: "Also check the tests" }];

<MessageQueue running="Reading the schema..." queued={queued} onCancel={removeFromQueue} />;
```

### edit-message

```bash
npx assistant-ui@latest add elements-edit-message
```

Rewrite a sent turn in place, told up front how many replies the edit throws away.

```tsx
import { EditMessage } from "@/components/assistant-ui/elements/edit-message";

<EditMessage
  value={draft}
  discardedReplies={2}
  editing={editing}
  onValueChange={setDraft}
  onSave={saveEdit}
  onCancel={cancelEdit}
  onStartEdit={() => setEditing(true)}
/>;
```

### feedback-dialog

```bash
npx assistant-ui@latest add elements-feedback-dialog
```

A thumbs down that asks why, so the signal arrives with a reason attached.

```tsx
import { FeedbackDialog } from "@/components/assistant-ui/elements/feedback-dialog";

<FeedbackDialog
  reasons={["Inaccurate", "Unhelpful", "Unsafe"]}
  selected={selected}
  note={note}
  sent={false}
  onToggleReason={toggleReason}
  onNoteChange={setNote}
  onSubmit={submitFeedback}
/>;
```

### stopped-run

```bash
npx assistant-ui@latest add elements-stopped-run
```

The half written answer stays after a stop, and continuing is one tap away.

```tsx
import { StoppedRun } from "@/components/assistant-ui/elements/stopped-run";

<StoppedRun words={["The", "migration", "adds"]} reason="Stopped by user" onContinue={resume} onDiscard={discard} />;
```

### day-separator

```bash
npx assistant-ui@latest add elements-day-separator
```

Chronology in a long thread: days marked in a header, exact time on hover of each row.

```tsx
import { DaySeparator, type DatedMessage } from "@/components/assistant-ui/elements/day-separator";

const messages: DatedMessage[] = [
  { id: "1", day: "Today", time: "9:41 AM", role: "user", text: "Can you review this?" },
];

<DaySeparator messages={messages} />;
```

### speaker-identity

```bash
npx assistant-ui@latest add elements-speaker-identity
```

Who is talking, once a thread holds more than a user and one model.

```tsx
import { SpeakerIdentity, type SpeakerTurn } from "@/components/assistant-ui/elements/speaker-identity";

const turns: SpeakerTurn[] = [{ id: "1", kind: "subagent", name: "Search agent", detail: "gpt-5.6-luna", text: "Found 3 matches." }];

<SpeakerIdentity turns={turns} />;
```

### regenerate-menu

```bash
npx assistant-ui@latest add elements-regenerate-menu
```

Fork the same turn to a different model instead of rolling the same dice.

```tsx
import { RegenerateMenu, type RegenerateOption } from "@/components/assistant-ui/elements/regenerate-menu";

const options: RegenerateOption[] = [{ id: "sonnet", label: "Claude Sonnet", detail: "balanced" }];

<RegenerateMenu options={options} open={open} currentId="sonnet" onOpenChange={setOpen} onPick={regenerateWith} />;
```

### confidence-marker

```bash
npx assistant-ui@latest add elements-confidence-marker
```

Which claims came from a source, which were inferred, and which are guesses.

```tsx
import { ConfidenceMarker, type ConfidenceClaim } from "@/components/assistant-ui/elements/confidence-marker";

const claims: ConfidenceClaim[] = [
  { id: "1", text: "The API returns JSON", confidence: "grounded", basis: "docs.example.com" },
];

<ConfidenceMarker claims={claims} hoveredId={hoveredId} onHover={setHoveredId} />;
```

### message-attachment

```bash
npx assistant-ui@latest add elements-message-attachment
```

A second design for a message's files: an image thumbnail button, or an icon row for a document or file.

```tsx
import { MessageAttachments, type MessageAttachmentItem } from "@/components/assistant-ui/elements/message-attachment";

const attachments: MessageAttachmentItem[] = [
  { id: "1", name: "spec.pdf", size: "340 KB", kind: "document", pages: 12 },
];

<MessageAttachments attachments={attachments} onOpen={openViewer} />;
```

### quote-reply

```bash
npx assistant-ui@latest add elements-quote-reply
```

A second design for quoting: a paragraph pre split into the quoted phrase with a three action toolbar.

```tsx
import { QuoteReply, type QuoteAction } from "@/components/assistant-ui/elements/quote-reply";

const actions: QuoteAction[] = [{ key: "quote", label: "Quote", icon: "quote" }];

<QuoteReply
  before="The treaty was signed in "
  selection="1648"
  after=", ending the war."
  actions={actions}
  toolbarVisible
  quoted={quoted}
  onAction={handleAction}
/>;
```

### message-timing

```bash
npx assistant-ui@latest add elements-message-timing
```

A second design for streaming stats: an always visible row of labeled values instead of a hover badge.

```tsx
import { MessageTiming, type TimingStat } from "@/components/assistant-ui/elements/message-timing";

const stats: TimingStat[] = [
  { label: "ttft", value: "0.4s" },
  { label: "total", value: "2.6s" },
];

<MessageTiming stats={stats} streaming={false} />;
```

## Tool use

### tool-call

```bash
npx assistant-ui@latest add elements-tool-call
```

One tool invocation with its request and result tucked behind a disclosure.

```tsx
import { ToolCall } from "@/components/assistant-ui/elements/tool-call";

<ToolCall
  label="Ran search"
  activeLabel="Searching..."
  query="assistant-ui elements"
  request='{"query":"assistant-ui elements"}'
  result="12 matches"
  running={false}
  open={open}
  onOpenChange={setOpen}
/>;
```

### tool-timeline

```bash
npx assistant-ui@latest add elements-tool-timeline
```

A whole working session summarized as verbs, targets, and file stats.

```tsx
import { ToolTimeline, type TimelineStep, type TimelineStat } from "@/components/assistant-ui/elements/tool-timeline";

const steps: TimelineStep[] = [{ verb: "Read", chip: "src/index.ts", icon: FileIcon }];
const stats: TimelineStat[] = [{ file: "src/index.ts", added: 4, removed: 1 }];

<ToolTimeline
  steps={steps}
  visibleSteps={steps.length}
  streaming={false}
  open={open}
  onOpenChange={setOpen}
  restingLabel="Ran 1 step"
  activeLabel="Working..."
  stats={stats}
/>;
```

### terminal-block

```bash
npx assistant-ui@latest add elements-terminal-block
```

Command output that streams line by line and ends with an exit status.

```tsx
import { TerminalBlock } from "@/components/assistant-ui/elements/terminal-block";

<TerminalBlock
  command="pnpm test"
  lines={["PASS src/index.test.ts", "5 passed, 0 failed"]}
  visibleCount={2}
  done
  variant="ink"
/>;
```

### code-diff

```bash
npx assistant-ui@latest add elements-code-diff
```

A unified diff with tinted additions and removals, sized for chat.

```tsx
import { CodeDiff, type DiffLine } from "@/components/assistant-ui/elements/code-diff";

const lines: DiffLine[] = [
  { kind: "removed", text: "-const x = 1;" },
  { kind: "added", text: "+const x = 2;" },
];

<CodeDiff filename="src/index.ts" additions={1} deletions={1} lines={lines} cycle={0} />;
```

### reviewable-diff

```bash
npx assistant-ui@latest add elements-reviewable-diff
```

The same diff, but each hunk is a decision: keep it, discard it, apply what survived.

```tsx
import { ReviewableDiff, type DiffHunk } from "@/components/assistant-ui/elements/reviewable-diff";

const hunks: DiffHunk[] = [{ id: "1", range: "L10-L14", decision: "pending", lines: [] }];

<ReviewableDiff filename="src/index.ts" hunks={hunks} onKeep={keep} onDiscard={discard} onApply={apply} />;
```

### file-tree

```bash
npx assistant-ui@latest add elements-file-tree
```

Everything a run touched, as a tree, with the churn spelled out per file.

```tsx
import { FileTree, type FileTreeNode } from "@/components/assistant-ui/elements/file-tree";

const nodes: FileTreeNode[] = [
  { path: "src", name: "src", depth: 0, kind: "folder" },
  { path: "src/index.ts", name: "index.ts", depth: 1, kind: "file", additions: 4, deletions: 1 },
];

<FileTree nodes={nodes} visibleCount={nodes.length} totalAdditions={4} totalDeletions={1} />;
```

### elicitation-form

```bash
npx assistant-ui@latest add elements-elicitation-form
```

A server pausing mid tool call to ask you for the fields it still needs.

```tsx
import { ElicitationForm, type ElicitationField } from "@/components/assistant-ui/elements/elicitation-form";

const fields: ElicitationField[] = [{ name: "env", label: "Environment", value: "", kind: "text", required: true }];

<ElicitationForm
  server="deploy-server"
  message="Which environment should this deploy to?"
  fields={fields}
  state="request"
  onAccept={accept}
  onDecline={decline}
/>;
```

### mcp-server-panel

```bash
npx assistant-ui@latest add elements-mcp-server-panel
```

Which servers are connected, what each one brought, and which is still waiting on you.

```tsx
import { McpServerPanel, type McpServer } from "@/components/assistant-ui/elements/mcp-server-panel";

const servers: McpServer[] = [
  { id: "linear", name: "Linear", transport: "http", status: "connected", tools: ["create_issue"] },
];

<McpServerPanel servers={servers} expandedId={expandedId} onToggle={setExpandedId} onAuthorize={authorize} />;
```

### tool-error

```bash
npx assistant-ui@latest add elements-tool-error
```

One call failed; the error, the attempt count, and a retry that does not restart the turn.

```tsx
import { ToolError } from "@/components/assistant-ui/elements/tool-error";

<ToolError
  name="run_migration"
  target="002_add_index.sql"
  message="Connection refused"
  attempt={1}
  maxAttempts={3}
  retrying={false}
  onRetry={retry}
  onSkip={skip}
/>;
```

### permission-grant

```bash
npx assistant-ui@latest add elements-permission-grant
```

Granting a capability rather than approving one action, with the reach spelled out.

```tsx
import { PermissionGrant } from "@/components/assistant-ui/elements/permission-grant";

<PermissionGrant
  capability="Write files"
  requester="deploy_tool"
  reach={["src/**", "package.json"]}
  scope="pending"
  onGrant={grantScope}
/>;
```

### computer-use

```bash
npx assistant-ui@latest add elements-computer-use
```

The screen the agent is driving, with a cursor trail and what it is doing right now.

```tsx
import { ComputerUse, type ComputerStep } from "@/components/assistant-ui/elements/computer-use";

const steps: ComputerStep[] = [{ id: "1", action: "click", target: "Submit button", x: 50, y: 80 }];

<ComputerUse url="https://example.com" steps={steps} activeIndex={0}>
  <img src="/screenshot.png" alt="" />
</ComputerUse>;
```

### code-runner

```bash
npx assistant-ui@latest add elements-code-runner
```

A snippet with a run button, and the output it produced attached below it.

```tsx
import { CodeRunner } from "@/components/assistant-ui/elements/code-runner";

<CodeRunner
  language="ts"
  code="console.log(1 + 1)"
  state="ok"
  output={["2"]}
  durationMs={12}
  onRun={run}
/>;
```

### tool-group

```bash
npx assistant-ui@latest add elements-tool-group
```

A second design for parallel tool calls: an explicit `tools` array with its own running or done or failed summary, instead of reading a message's grouped parts.

```tsx
import { ToolGroup, type GroupedTool } from "@/components/assistant-ui/elements/tool-group";

const tools: GroupedTool[] = [{ id: "1", name: "read_file", target: "src/index.ts", state: "done", durationMs: 120 }];

<ToolGroup label="1 tool call" tools={tools} open={open} onOpenChange={setOpen} />;
```

## Knowledge

### web-search

```bash
npx assistant-ui@latest add elements-web-search
```

A search query and its results landing one by one as the agent reads.

```tsx
import { WebSearch, type WebSearchResult } from "@/components/assistant-ui/elements/web-search";

const results: WebSearchResult[] = [{ title: "assistant-ui docs", domain: "assistant-ui.com" }];

<WebSearch query="assistant-ui elements" results={results} visibleResults={1} searching={false} cycle={0} />;
```

### inline-citation

```bash
npx assistant-ui@latest add elements-inline-citation
```

Numbered references inside a sentence, each with a hover preview of its source.

```tsx
import { InlineCitation, type Source } from "@/components/assistant-ui/elements/inline-citation";

const sources: Source[] = [{ domain: "assistant-ui.com", title: "Elements", snippet: "The catalog of..." }];

<InlineCitation sources={sources} openIndex={openIndex} onOpenIndexChange={setOpenIndex} />;
```

### image-generation

```bash
npx assistant-ui@latest add elements-image-generation
```

A dot grid holds the frame while the image resolves out of a blur.

```tsx
import { ImageGeneration } from "@/components/assistant-ui/elements/image-generation";

<ImageGeneration prompt="a watercolor fox in a forest" generating={generating} />;
```

### retrieval-chunks

```bash
npx assistant-ui@latest add elements-retrieval-chunks
```

The passages a retrieval answer stands on, scored, before the answer itself arrives.

```tsx
import { RetrievalChunks, type RetrievalChunk } from "@/components/assistant-ui/elements/retrieval-chunks";

const chunks: RetrievalChunk[] = [{ id: "1", source: "handbook.md", locator: "p. 4", score: 0.92, text: "..." }];

<RetrievalChunks query="refund policy" chunks={chunks} visibleCount={1} searching={false} />;
```

### document-reference

```bash
npx assistant-ui@latest add elements-document-reference
```

A document the answer leans on, with the quoted passage and the page to jump to.

```tsx
import { DocumentReference, type DocumentAnchor } from "@/components/assistant-ui/elements/document-reference";

const anchors: DocumentAnchor[] = [{ page: 4, quote: "Refunds are processed within 5 business days." }];

<DocumentReference title="Refund policy" pages={12} anchors={anchors} activePage={4} onJump={jumpToPage} />;
```

### memory-chips

```bash
npx assistant-ui@latest add elements-memory-chips
```

What it now remembers about you, written during the turn and removable.

```tsx
import { MemoryChips, type MemoryChip } from "@/components/assistant-ui/elements/memory-chips";

const chips: MemoryChip[] = [{ id: "1", text: "Prefers TypeScript", change: "added" }];

<MemoryChips chips={chips} onForget={forget} />;
```

### research-report

```bash
npx assistant-ui@latest add elements-research-report
```

An outline that fills in section by section, each carrying the sources behind it.

```tsx
import { ResearchReport, type ReportSection } from "@/components/assistant-ui/elements/research-report";

const sections: ReportSection[] = [{ id: "1", heading: "Market size", state: "done", sources: 4, preview: "..." }];

<ResearchReport title="Q3 market research" sections={sections} sourcesRead={9} />;
```

### map-answer

```bash
npx assistant-ui@latest add elements-map-answer
```

A location answer: pins, a route between them, and the list they came from.

```tsx
import { MapAnswer, type MapPin } from "@/components/assistant-ui/elements/map-answer";

const pins: MapPin[] = [{ id: "1", label: "Cafe", detail: "0.3 mi", x: 40, y: 60 }];

<MapAnswer pins={pins} activeId="1" route onSelect={selectPin} />;
```

### sources

```bash
npx assistant-ui@latest add elements-sources
```

A second design for citations: every source collapsed into one pill that expands into a grid of domain cards.

```tsx
import { Sources, type Source } from "@/components/assistant-ui/elements/sources";

const sources: Source[] = [{ domain: "assistant-ui.com", title: "Runtime drafts API" }];

<Sources sources={sources} open={open} onOpenChange={setOpen} />;
```

## Structured output

### data-table

```bash
npx assistant-ui@latest add elements-data-table
```

A small comparison table the model can answer with directly.

```tsx
import { DataTable, type ModelUsage } from "@/components/assistant-ui/elements/data-table";

const rows: ModelUsage[] = [{ name: "Claude Sonnet", context: "200k", cost: "$3 / 1M" }];

<DataTable rows={rows} cycle={0} />;
```

### number-ticker

```bash
npx assistant-ui@latest add elements-number-ticker
```

Digits that roll into place as a count updates in real time.

```tsx
import { NumberTicker } from "@/components/assistant-ui/elements/number-ticker";

<NumberTicker value={1284} label="tokens used" />;
```

### chart

```bash
npx assistant-ui@latest add elements-chart
```

Area, line, and bars, with points landing one at a time as the series streams in.

```tsx
import { Chart } from "@/components/assistant-ui/elements/chart";

<Chart
  label="Requests"
  value="1,204"
  delta="+12%"
  points={[10, 14, 9, 18, 22]}
  visibleCount={5}
  variant="area"
/>;
```

### web-preview

```bash
npx assistant-ui@latest add elements-web-preview
```

Chrome for a sandboxed preview: a URL bar, reload, and open in new around a frame you isolate.

```tsx
import { WebPreview } from "@/components/assistant-ui/elements/web-preview";

<WebPreview origin="preview.example.com" loading={false} onReload={reload} onOpenExternal={openExternal}>
  <iframe src={previewUrl} className="h-full w-full" />
</WebPreview>;
```

### diagram

```bash
npx assistant-ui@latest add elements-diagram
```

A drawn answer with zoom, reset, and a full bleed view; you hand it the rendered graphic.

```tsx
import { Diagram } from "@/components/assistant-ui/elements/diagram";

<Diagram title="Request flow" zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} onExpand={expand}>
  <svg>{/* rendered graphic */}</svg>
</Diagram>;
```

### flow-graph

```bash
npx assistant-ui@latest add elements-flow-graph
```

Work as a graph rather than a list: branches that fan out and rejoin.

```tsx
import { FlowGraph, type FlowNode, type FlowEdge } from "@/components/assistant-ui/elements/flow-graph";

const nodes: FlowNode[] = [{ id: "a", label: "Start", column: 0, row: 0, state: "done" }];
const edges: FlowEdge[] = [{ from: "a", to: "b" }];

<FlowGraph nodes={nodes} edges={edges} visibleCount={nodes.length} />;
```

### activity-graph

```bash
npx assistant-ui@latest add elements-activity-graph
```

A half year of runs as a calendar of cells, dense where the work was.

```tsx
import { ActivityGraph } from "@/components/assistant-ui/elements/activity-graph";
import type { DataPoint } from "@/components/assistant-ui/elements/heat-graph";

const data: DataPoint[] = [{ date: "2026-08-01", count: 6 }];

<ActivityGraph data={data} start="2026-02-01" end="2026-09-01" title="Runs" total="212 runs" />;
```

### math-block

```bash
npx assistant-ui@latest add elements-math-block
```

Rendered expressions with the working shown, one step at a time.

```tsx
import { MathBlock, type MathStep } from "@/components/assistant-ui/elements/math-block";

const steps: MathStep[] = [{ expression: "d/dx[x^2] = 2x", note: "power rule" }];

<MathBlock label="Derivative" steps={steps} visibleSteps={steps.length} />;
```

### spec-sheet

```bash
npx assistant-ui@latest add elements-spec-sheet
```

The most common structured answer after a table: one object, labeled.

```tsx
import { SpecSheet, type SpecRow } from "@/components/assistant-ui/elements/spec-sheet";

const rows: SpecRow[] = [{ label: "context", value: "200k tokens", emphasis: true }];

<SpecSheet title="Claude Sonnet" subtitle="Anthropic" rows={rows} visibleCount={rows.length} />;
```

### comparison-card

```bash
npx assistant-ui@latest add elements-comparison-card
```

Two options weighed side by side, with the pick named and argued.

```tsx
import { ComparisonCard, type ComparisonOption } from "@/components/assistant-ui/elements/comparison-card";

const options: ComparisonOption[] = [
  { id: "a", name: "Plan A", headline: "Cheaper", traits: ["Fast", false] },
  { id: "b", name: "Plan B", headline: "Faster", traits: ["Fast", "Reliable"] },
];

<ComparisonCard traitLabels={["Speed", "Reliability"]} options={options} recommendedId="b" reason="Plan B wins on reliability." />;
```

### timeline

```bash
npx assistant-ui@latest add elements-timeline
```

Events on a time axis, with what already happened and what is still coming.

```tsx
import { Timeline, type TimelineEvent } from "@/components/assistant-ui/elements/timeline";

const events: TimelineEvent[] = [{ id: "1", when: "past", time: "09:14", title: "Deploy started" }];

<Timeline events={events} visibleCount={events.length} />;
```

### job-progress

```bash
npx assistant-ui@latest add elements-job-progress
```

Work measured in minutes: weighted stages, an ETA, and a way out.

```tsx
import { JobProgress, type JobStage } from "@/components/assistant-ui/elements/job-progress";

const stages: JobStage[] = [{ name: "build", weight: 2 }, { name: "test", weight: 1 }];

<JobProgress title="CI run" stages={stages} stageIndex={0} stageProgress={0.4} eta="2m left" onCancel={cancelJob} />;
```

### score-breakdown

```bash
npx assistant-ui@latest add elements-score-breakdown
```

A verdict with its arithmetic shown: criteria, weights, and what pulled it down.

```tsx
import { ScoreBreakdown, type ScoreCriterion } from "@/components/assistant-ui/elements/score-breakdown";

const criteria: ScoreCriterion[] = [{ label: "Correctness", score: 8.5, weight: 2, note: "one edge case missed" }];

<ScoreBreakdown verdict="Pass" total={8.5} outOf={10} criteria={criteria} visibleCount={criteria.length} />;
```

## Agents

### agent-plan

```bash
npx assistant-ui@latest add elements-agent-plan
```

A checklist the agent works through, with progress you can glance.

```tsx
import { AgentPlan } from "@/components/assistant-ui/elements/agent-plan";

<AgentPlan steps={["Read the schema", "Write the migration", "Run the tests"]} activeIndex={1} />;
```

### subagent-list

```bash
npx assistant-ui@latest add elements-subagent-list
```

Parallel workers with their own progress, models, and completions.

```tsx
import { SubagentList, type SubagentItem } from "@/components/assistant-ui/elements/subagent-list";

const agents: SubagentItem[] = [{ name: "Search agent", model: "gpt-5.6-luna" }];

<SubagentList
  agents={agents}
  completedCount={0}
  progress={[40]}
  showSummary={false}
  summaryAgent={{ name: "Summarizer", model: "claude-sonnet-4-6" }}
/>;
```

### agent-status

```bash
npx assistant-ui@latest add elements-agent-status
```

One pill that always answers: what is it doing, and for how long.

```tsx
import { AgentStatus } from "@/components/assistant-ui/elements/agent-status";

<AgentStatus state="working" label="Reading the schema" elapsed="12s" />;
```

### approval-card

```bash
npx assistant-ui@latest add elements-approval-card
```

Human in the loop: the agent asks before it runs anything with side effects.

```tsx
import { ApprovalCard } from "@/components/assistant-ui/elements/approval-card";

<ApprovalCard
  state="request"
  command="rm -rf dist/"
  title="Run this command?"
  subtitle="Requested by the build agent"
  onAllowOnce={allowOnce}
  onAlwaysAllow={alwaysAllow}
  onDeny={deny}
/>;
```

### recommendation-card

```bash
npx assistant-ui@latest add elements-recommendation-card
```

The agent proposes a change with its confidence, and waits for a yes.

```tsx
import { RecommendationCard } from "@/components/assistant-ui/elements/recommendation-card";

<RecommendationCard
  state="idle"
  question="Rename `data` to `payload`?"
  confidenceLabel="High confidence"
  acceptedLabel="Renamed"
  onAccept={accept}
  onAlternatives={showAlternatives}
>
  Every call site already treats it as a request payload.
</RecommendationCard>;
```

### artifact-card

```bash
npx assistant-ui@latest add elements-artifact-card
```

A generated document as a tangible object, written live and versioned.

```tsx
import { ArtifactCard } from "@/components/assistant-ui/elements/artifact-card";

<ArtifactCard title="Migration plan" meta="Draft" generating={generating} words={214} onClick={openArtifact} />;
```

### todo-list

```bash
npx assistant-ui@latest add elements-todo-list
```

The agent's own working list, rewritten mid run as it discovers what else is needed.

```tsx
import { TodoList, type TodoItem } from "@/components/assistant-ui/elements/todo-list";

const items: TodoItem[] = [{ id: "1", text: "Read the schema", status: "done" }];

<TodoList items={items} revision={3} />;
```

### agent-card

```bash
npx assistant-ui@latest add elements-agent-card
```

Who you are about to talk to: its skills, its model, and the endpoint behind it.

```tsx
import { AgentCard, type AgentSkill } from "@/components/assistant-ui/elements/agent-card";

const skills: AgentSkill[] = [{ name: "Refactor", description: "Restructures code without changing behavior" }];

<AgentCard
  name="Code agent"
  description="Handles refactors and bug fixes."
  provider="Acme"
  version="1.4.0"
  model="claude-sonnet-4-6"
  endpoint="https://agents.example.com/code"
  skills={skills}
  connected={false}
  onConnect={connect}
/>;
```

### agent-handoff

```bash
npx assistant-ui@latest add elements-agent-handoff
```

Control passing between agents, with the reason and what came along.

```tsx
import { AgentHandoff } from "@/components/assistant-ui/elements/agent-handoff";

<AgentHandoff from="Triage agent" to="Billing agent" reason="Refund request" carried={["order id", "email"]} settled />;
```

### background-inbox

```bash
npx assistant-ui@latest add elements-background-inbox
```

Work still going somewhere else, and the results waiting to be collected.

```tsx
import { BackgroundInbox, type BackgroundRun } from "@/components/assistant-ui/elements/background-inbox";

const runs: BackgroundRun[] = [{ id: "1", title: "Nightly report", state: "ready", elapsed: "6m", summary: "12 rows" }];

<BackgroundInbox runs={runs} onCollect={collectRun} />;
```

### checkpoint-history

```bash
npx assistant-ui@latest add elements-checkpoint-history
```

Points you can fall back to, with what each one would give back.

```tsx
import { CheckpointHistory, type Checkpoint } from "@/components/assistant-ui/elements/checkpoint-history";

const checkpoints: Checkpoint[] = [{ id: "1", label: "Before refactor", at: "10:02 AM", files: 6 }];

<CheckpointHistory checkpoints={checkpoints} currentId="1" onRestore={restoreCheckpoint} />;
```

### schedule-card

```bash
npx assistant-ui@latest add elements-schedule-card
```

A run that repeats on its own, with its cadence and how it has been doing.

```tsx
import { ScheduleCard, type ScheduleRun } from "@/components/assistant-ui/elements/schedule-card";

const history: ScheduleRun[] = [{ id: "1", at: "Yesterday, 9am", ok: true }];

<ScheduleCard name="Daily digest" cadence="Every day at 9am" nextRun="Tomorrow, 9am" enabled history={history} onToggle={toggleSchedule} />;
```

## Observability

### trace-waterfall

```bash
npx assistant-ui@latest add elements-trace-waterfall
```

Every span in a run on one time axis, nested, so you can see where it actually went.

```tsx
import { TraceWaterfall, type TraceSpan } from "@/components/assistant-ui/elements/trace-waterfall";

const spans: TraceSpan[] = [{ id: "1", name: "search", depth: 0, startMs: 0, durationMs: 320, status: "completed" }];

<TraceWaterfall spans={spans} totalMs={1200} visibleCount={spans.length} />;
```

### cost-meter

```bash
npx assistant-ui@latest add elements-cost-meter
```

What the run spent, split by model, against the session total.

```tsx
import { CostMeter, type CostLine } from "@/components/assistant-ui/elements/cost-meter";

const lines: CostLine[] = [{ model: "Claude Sonnet", inputTokens: 12, outputTokens: 3, cost: "$0.09", share: 0.7 }];

<CostMeter runCost="$0.09" sessionCost="$1.42" lines={lines} />;
```

### quota-banner

```bash
npx assistant-ui@latest add elements-quota-banner
```

How much is left, when it comes back, and the way to get more.

```tsx
import { QuotaBanner } from "@/components/assistant-ui/elements/quota-banner";

<QuotaBanner used={92} limit={100} unit="messages" resetsIn="4h" upgradeLabel="Upgrade" onUpgrade={upgrade} />;
```

## Composer

### composer (and its variants)

```bash
npx assistant-ui@latest add elements-composer
```

The unified input: `Composer`, `ComposerBar`, `ComposerInput`, `ComposerToolbar`, `ComposerActions`, `ComposerAttachButton`, and `ComposerSend` compose the base shell; the sections below cover the same file's slash command, mention, attachment, model, dictation, and context sub-components.

```tsx
import {
  Composer,
  ComposerBar,
  ComposerInput,
  ComposerSend,
} from "@/components/assistant-ui/elements/composer";

<Composer>
  <ComposerBar dragActive={dragActive}>
    <ComposerInput onSubmit={sendMessage} />
    <ComposerSend streaming={streaming} idle={!streaming} />
  </ComposerBar>
</Composer>;
```

#### Slash commands

Type a slash and the command menu floats above the input, filtering as you continue.

```tsx
import { ComposerCommandItem, type ComposerCommand } from "@/components/assistant-ui/elements/composer";

const command: ComposerCommand = { name: "clear", description: "Clear the conversation" };

<ComposerCommandItem command={command} active={active} />;
```

#### Mentions

Type `@` to pull people and agents into the conversation, filtered as you go.

```tsx
import { ComposerPersonItem, type ComposerPerson } from "@/components/assistant-ui/elements/composer";

const person: ComposerPerson = { name: "Search agent", role: "agent" };

<ComposerPersonItem person={person} active={active} />;
```

#### Attachments

Files stage inside the composer with per file progress before the message sends.

```tsx
import { ComposerAttachmentChip, type ComposerAttachment } from "@/components/assistant-ui/elements/composer";

const attachment: ComposerAttachment = { name: "spec.pdf", meta: "340 KB", state: "done", kind: "text" };

<ComposerAttachmentChip attachment={attachment} onRemove={removeAttachment} />;
```

#### Models

The model lives in the composer rail, one tap away with context at a glance.

```tsx
import { ComposerModelTrigger, ComposerModelItem, type ComposerModel } from "@/components/assistant-ui/elements/composer";

const model: ComposerModel = { name: "Claude Sonnet", meta: "$3 / 1M" };

<ComposerModelTrigger model={model.name} open={open} />;
<ComposerModelItem entry={model} selected />;
```

#### Dictation

The mic morphs the input into a live waveform, then lands the transcript as text.

```tsx
import { ComposerVoice, ComposerVoiceButton } from "@/components/assistant-ui/elements/composer";

<ComposerVoice recording={recording} seconds={12} />;
<ComposerVoiceButton active={recording} />;
```

#### Context

A token ring in the rail fills as the conversation grows, warning near the limit.

```tsx
import { ComposerContext, type ComposerUsage } from "@/components/assistant-ui/elements/composer";

const usage: ComposerUsage = { system: 1.2, tools: 0.8, messages: 4.1, total: 200 };

<ComposerContext usage={usage} />;
```

### draft-restore

```bash
npx assistant-ui@latest add elements-draft-restore
```

Come back to a thread and the sentence you never sent is still waiting.

```tsx
import { DraftRestore } from "@/components/assistant-ui/elements/draft-restore";

<DraftRestore draft="Can you also check the..." savedAt="2 hours ago" onRestore={restoreDraft} onDiscard={discardDraft} />;
```

### context-breakdown

```bash
npx assistant-ui@latest add elements-context-breakdown
```

Where the window actually went: prompt, tools, files, conversation, and what is left.

```tsx
import { ContextBreakdown, type ContextSegment } from "@/components/assistant-ui/elements/context-breakdown";

const segments: ContextSegment[] = [{ label: "Conversation", tokens: 42000, tint: "bg-blue-500" }];

<ContextBreakdown segments={segments} limit={200000} />;
```

### prompt-library

```bash
npx assistant-ui@latest add elements-prompt-library
```

Prompts you saved, searchable, with their variables shown before you insert one.

```tsx
import { PromptLibrary, type SavedPrompt } from "@/components/assistant-ui/elements/prompt-library";

const prompts: SavedPrompt[] = [{ id: "1", name: "Write tests", body: "Write tests for {{file}}", variables: ["file"] }];

<PromptLibrary prompts={prompts} query={query} selectedId="1" onQueryChange={setQuery} onSelect={selectPrompt} onInsert={insertPrompt} />;
```

### command-palette

```bash
npx assistant-ui@latest add elements-command-palette
```

Everything the app can do, one keystroke away and grouped by where it acts.

```tsx
import { CommandPalette, type PaletteCommand } from "@/components/assistant-ui/elements/command-palette";

const commands: PaletteCommand[] = [{ id: "new", label: "New thread", group: "Thread", keys: ["Cmd", "N"] }];

<CommandPalette
  commands={commands}
  query={query}
  activeId={activeId}
  onQueryChange={setQuery}
  onActiveChange={setActiveId}
  onRun={runCommand}
/>;
```

### model-picker

```bash
npx assistant-ui@latest add elements-model-picker
```

A full page list of models grouped by family, each row carrying context window, price, and capability chips.

```tsx
import { ModelPicker, type PickableModel } from "@/components/assistant-ui/elements/model-picker";

const models: PickableModel[] = [
  { id: "sonnet", name: "Claude Sonnet", family: "Anthropic", context: "200k", price: "$3 / 1M", capabilities: ["vision", "tools"] },
];

<ModelPicker models={models} selectedId="sonnet" onSelect={selectModel} />;
```

## Voice

### voice-conversation

```bash
npx assistant-ui@latest add elements-voice-conversation
```

A live call: the orb tracks your voice, the caption names the turn, the transcript follows.

```tsx
import { VoiceConversation, type VoiceTurn } from "@/components/assistant-ui/elements/voice-conversation";

const transcript: VoiceTurn[] = [{ id: "1", role: "user", text: "What's on my calendar?" }];

<VoiceConversation
  mode="listening"
  amplitude={0.4}
  transcript={transcript}
  muted={false}
  onToggleMute={toggleMute}
  onInterrupt={interrupt}
  onEnd={endCall}
/>;
```

### read-aloud

```bash
npx assistant-ui@latest add elements-read-aloud
```

An answer played back, the spoken word lit as it goes, speed under your thumb.

```tsx
import { ReadAloud } from "@/components/assistant-ui/elements/read-aloud";

<ReadAloud
  words={["The", "answer", "is", "42."]}
  spokenIndex={1}
  playing
  rate={1}
  elapsed="0:02"
  duration="0:06"
  onToggle={togglePlayback}
  onRateChange={cycleRate}
/>;
```

## Thread

### chat-panel

```bash
npx assistant-ui@latest add elements-chat-panel
```

The whole family working together: a message, a pause, a streamed reply, in one fixed size card.

```tsx
import {
  ChatPanel,
  ChatPanelMessages,
  ChatPanelUserMessage,
  ChatPanelAssistantMessage,
  ChatPanelComposer,
} from "@/components/assistant-ui/elements/chat-panel";

<ChatPanel>
  <ChatPanelMessages>
    <ChatPanelUserMessage>Can you review this?</ChatPanelUserMessage>
    <ChatPanelAssistantMessage>Looks good overall.</ChatPanelAssistantMessage>
  </ChatPanelMessages>
  <ChatPanelComposer placeholder="Ask a question..." onSend={sendMessage} />
</ChatPanel>;
```

### empty-state

```bash
npx assistant-ui@latest add elements-empty-state
```

The first screen: a greeting, starter prompts, and the composer front and center.

```tsx
import {
  EmptyState,
  EmptyStateGreeting,
  EmptyStateSuggestions,
  EmptyStateSuggestion,
  EmptyStateComposer,
} from "@/components/assistant-ui/elements/empty-state";

<EmptyState>
  <EmptyStateGreeting>Ask me anything</EmptyStateGreeting>
  <EmptyStateSuggestions>
    <EmptyStateSuggestion index={0}>Summarize this repo</EmptyStateSuggestion>
  </EmptyStateSuggestions>
  <EmptyStateComposer placeholder="Send a message..." onSend={sendMessage} />
</EmptyState>;
```

### scroll-anchor

```bash
npx assistant-ui@latest add elements-scroll-anchor
```

Streaming never steals your scroll position; messages append on a timer and settle at the bottom.

```tsx
import { ScrollAnchor, type ScrollAnchorMessage } from "@/components/assistant-ui/elements/scroll-anchor";

const messages: ScrollAnchorMessage[] = [{ role: "assistant", text: "Here is the summary." }];

<ScrollAnchor messages={messages} paused={false} onSettled={handleSettled} />;
```

### canvas-split

```bash
npx assistant-ui@latest add elements-canvas-split
```

The thread steps aside and a document takes the room, still being written as you read.

```tsx
import {
  CanvasSplit,
  CanvasSplitThread,
  CanvasSplitMessage,
  CanvasSplitDocument,
  CanvasSplitHeader,
  CanvasSplitBody,
  CanvasSplitLine,
} from "@/components/assistant-ui/elements/canvas-split";

<CanvasSplit>
  <CanvasSplitThread>
    <CanvasSplitMessage speaker="user">Draft the README</CanvasSplitMessage>
  </CanvasSplitThread>
  <CanvasSplitDocument>
    <CanvasSplitHeader title="README.md" version={2} saved={false} onCopy={copyDoc} onClose={closeDoc} />
    <CanvasSplitBody writing>
      <CanvasSplitLine heading>Overview</CanvasSplitLine>
    </CanvasSplitBody>
  </CanvasSplitDocument>
</CanvasSplit>;
```

### connection-state

```bash
npx assistant-ui@latest add elements-connection-state
```

The socket drops, the run keeps going on the server, and the stream is picked back up.

```tsx
import { ConnectionState } from "@/components/assistant-ui/elements/connection-state";

<ConnectionState phase="reconnecting" attempt={2} onRetry={retryConnection} />;
```

### shared-conversation

```bash
npx assistant-ui@latest add elements-shared-conversation
```

A read only transcript someone sent you, with a way to pick it up yourself.

```tsx
import { SharedConversation, type SharedTurn } from "@/components/assistant-ui/elements/shared-conversation";

const turns: SharedTurn[] = [{ id: "1", role: "user", text: "How do I deploy this?" }];

<SharedConversation title="Deploy walkthrough" sharedBy="Jamie" sharedAt="Yesterday" turns={turns} onContinue={continueThread} />;
```

### conversation-search

```bash
npx assistant-ui@latest add elements-conversation-search
```

Find inside a long thread, with every hit marked down the scrollbar.

```tsx
import { ConversationSearch, type SearchHit } from "@/components/assistant-ui/elements/conversation-search";

const hits: SearchHit[] = [{ id: "1", before: "the ", match: "migration", after: " runs nightly", position: 40 }];

<ConversationSearch query={query} hits={hits} activeIndex={0} onQueryChange={setQuery} onStep={stepHit} />;
```

### thread-search

```bash
npx assistant-ui@latest add elements-thread-search
```

History you can actually get back into: pinned first, then grouped by when.

```tsx
import { ThreadSearch, type SearchableThread } from "@/components/assistant-ui/elements/thread-search";

const threads: SearchableThread[] = [{ id: "1", title: "Refund flow", group: "Today", preview: "...", pinned: true }];

<ThreadSearch threads={threads} query={query} activeId="1" onQueryChange={setQuery} onSelect={selectThread} />;
```

### launcher-bubble

```bash
npx assistant-ui@latest add elements-launcher-bubble
```

The floating entry point, and the panel it opens into.

```tsx
import { LauncherBubble } from "@/components/assistant-ui/elements/launcher-bubble";

<LauncherBubble
  open={open}
  unread={2}
  greeting="Need help?"
  prompts={["Track my order", "Talk to support"]}
  onToggle={toggleOpen}
  onPick={sendPrompt}
  onStart={startConversation}
/>;
```

### settings-panel

```bash
npx assistant-ui@latest add elements-settings-panel
```

Model, system prompt, temperature, and what the assistant is allowed to do.

```tsx
import { SettingsPanel, type SettingToggle } from "@/components/assistant-ui/elements/settings-panel";

const toggles: SettingToggle[] = [{ key: "web", label: "Web search", detail: "Allow live lookups", on: true }];

<SettingsPanel
  model="claude-sonnet-4-6"
  models={["claude-sonnet-4-6", "gpt-5.6-luna"]}
  systemPrompt={systemPrompt}
  temperature={0.7}
  toggles={toggles}
  onModelChange={setModel}
  onSystemPromptChange={setSystemPrompt}
  onTemperatureChange={setTemperature}
  onToggle={toggleSetting}
/>;
```

### onboarding

```bash
npx assistant-ui@latest add elements-onboarding
```

First run: a short tour of moves that teach what this assistant is actually for.

```tsx
import { Onboarding, type OnboardingStep } from "@/components/assistant-ui/elements/onboarding";

const steps: OnboardingStep[] = [{ title: "Ask anything", body: "Type a question to get started.", example: "Summarize this doc" }];

<Onboarding steps={steps} index={0} onNext={nextStep} onSkip={skipOnboarding} />;
```

### mobile-composer

```bash
npx assistant-ui@latest add elements-mobile-composer
```

The bottom sheet: keyboard aware, quick actions above, thumb sized targets.

```tsx
import { MobileComposer } from "@/components/assistant-ui/elements/mobile-composer";

<MobileComposer
  value={draft}
  keyboardOpen={keyboardOpen}
  running={running}
  actions={["Summarize", "Translate"]}
  onAction={runQuickAction}
  onAttach={openAttachmentPicker}
  onValueChange={setDraft}
  onSend={sendMessage}
  onStop={stopRun}
  onFocus={handleFocus}
/>;
```

### suggestions

```bash
npx assistant-ui@latest add elements-suggestions
```

A second design for follow up prompts: a staggered row of rounded pills, or a left aligned list, held as plain strings.

```tsx
import { Suggestions } from "@/components/assistant-ui/elements/suggestions";

<Suggestions
  suggestions={["Explain that differently", "Show an example"]}
  selectedSuggestion={selected}
  cycle={cycle}
  onSuggestion={handleSuggestion}
  variant="pills"
/>;
```
