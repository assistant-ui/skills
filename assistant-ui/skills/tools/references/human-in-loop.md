# Human in the loop

Three different pauses share the tool-call surface. Pick by who owns the action and what the user is being asked for.

| Mechanism | The user supplies | Marker | Renderer callback |
| --- | --- | --- | --- |
| Human tool | the tool result itself | `execute: humanTool()` | `addResult(result)` |
| Execution interrupt | an answer the executor asked for mid-run | `human(payload)` inside a frontend `execute` | `resume(payload)` |
| Approval gate | permission for an action your backend performs | runtime emits `approval` on the part | `respondToApproval(response)` |

## Contents

- [Human tools](#human-tools) | [Execution interrupts](#execution-interrupts) | [Approval gates](#approval-gates) | [Approval options](#approval-options) | [Approval questions](#approval-questions) | [Cancelled and expired gates](#cancelled-and-expired-gates) | [Wiring the AI SDK v7 gate](#wiring-the-ai-sdk-v7-gate) | [Other runtimes](#other-runtimes)

## Human tools

The agent pauses on the call and the renderer produces the result. Call `addResult` exactly once; the run resumes with that payload.

```tsx title="app/toolkit.tsx"
"use generative";

import { defineToolkit, humanTool } from "@assistant-ui/react";
import { z } from "zod";

export default defineToolkit({
  select_date: {
    description: "Ask the user to select a date.",
    parameters: z.object({ prompt: z.string() }),
    execute: humanTool(),
    render: ({ args, result, addResult }) => {
      if (result) return <p>Selected {new Date(result.date).toLocaleDateString()}</p>;
      return (
        <div>
          <p>{args.prompt}</p>
          <DatePicker onChange={(date) => addResult({ date: date.toISOString() })} />
        </div>
      );
    },
  },
});
```

A human tool declares a `render`; the compiler enforces it. `hitl` and `hitlTool` are deprecated aliases of `humanTool`.

## Execution interrupts

A frontend executor can ask for input in the middle of its own work. `human(payload)` on the execution context pauses it and surfaces the payload to the renderer as `interrupt.payload`; `resume(value)` sends the answer back and the executor continues.

```tsx
request_approval: {
  description: "Request user approval for an action.",
  parameters: z.object({ action: z.string() }),
  execute: async ({ action }, { human }) => {
    "use client";
    const response = await human({ action });
    return { approved: response.approved, reason: response.reason };
  },
  render: ({ result, interrupt, resume }) => {
    if (result) return <p>{result.approved ? "Approved" : `Rejected: ${result.reason}`}</p>;
    if (interrupt) {
      return (
        <div>
          <p>{interrupt.payload.action}</p>
          <button onClick={() => resume({ approved: true })}>Approve</button>
          <button onClick={() => resume({ approved: false, reason: "not now" })}>Reject</button>
        </div>
      );
    }
    return <p>Processing</p>;
  },
},
```

`human()` is not available during server-side execution, and a WebMCP caller cannot answer one either.

## Approval gates

Some runtimes pause on the server and emit an approval request that the client must answer before the tool runs. The gate arrives as `approval` on the tool part, and `respondToApproval` is the only correct way to answer it, because it reads the approval id from the part.

```tsx
import { useState } from "react";
import { defineToolkit, type ToolApprovalResponse } from "@assistant-ui/react";

const toolkit = defineToolkit({
  deploy: {
    type: "backend",
    render: ({ args, approval, respondToApproval, result }) => {
      const [error, setError] = useState<string | null>(null);

      // A refused response rejects and a bad precondition throws, so try plus
      // await covers both and the controls stay actionable.
      const answer = async (response: ToolApprovalResponse) => {
        setError(null);
        try {
          await respondToApproval(response);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      };

      if (approval?.approved === undefined && approval?.resolution === undefined) {
        if (approval?.isAutomatic) return <p>Auto approved by policy</p>;
        return (
          <div>
            <p>Approve deploy to {args.target}?</p>
            <button onClick={() => void answer({ approved: true })}>Approve</button>
            <button onClick={() => void answer({ approved: false, reason: "user denied" })}>
              Deny
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        );
      }

      if (approval?.approved === false) {
        return <p>Denied{approval.reason ? `: ${approval.reason}` : ""}</p>;
      }
      return result === undefined ? <p>Approved, running</p> : <p>Deployed</p>;
    },
  },
});
```

The three states of `approval.approved`:

- `undefined`: the gate is open and the renderer should ask. This is the only state in which `respondToApproval` is legal.
- `true`: recorded as allow. The server is producing the result, or has produced one on `result`.
- `false`: recorded as deny. The runtime records an error result, sets `isError`, and exposes `approval.reason`.

`approval.isAutomatic` is `true` when a server-side policy granted the decision instead of the user, so render a badge rather than buttons. `respondToApproval` resolves once the runtime accepted the response and rejects when it could not be recorded, for example an expired gate or an answer the provider refuses. Await it before disabling the controls, so a refused response leaves the request retryable rather than spending it.

## Approval options

A host can attach decision options to a gate, for example allow once, allow for this session, and always allow. Each option carries a machine readable `kind` of `"allow-once"`, `"allow-always"`, `"reject-once"`, or `"reject-always"`; scope semantics such as session versus global live in the option's `id` and `label`, which only the host interprets.

```ts
const approval = {
  id: "a1",
  options: [
    { id: "once", kind: "allow-once" },
    { id: "session", kind: "allow-always", label: "Allow for this session" },
    {
      id: "always",
      kind: "allow-always",
      label: "Always allow",
      grants: ["git *"],
      confirm: true,
    },
    { id: "deny", kind: "reject-once" },
  ],
};
```

Answer with the chosen option and the kind resolves the decision:

```tsx
await respondToApproval({ optionId: "session" });
```

The runtime receives `{ approvalId, approved, optionId, text?, reason? }`, so a host that persists an always-allow decision keys its own store off `optionId`. Persistence is entirely host owned: assistant-ui never stores a decision and never auto-answers a future approval. `grants` lists the patterns the option would persist, so show them before the user commits, and `confirm` opts the option into a confirmation step. An option with a custom `_`-prefixed kind must be answered with an explicit `approved` value, optionally alongside the `optionId` so the choice is still recorded.

## Approval questions

An approval request can ask for something other than permission. `approval.prompt` carries the question and `approval.display` says how to present it: `"decision"` (the default) for a yes or no gate, `"select"` when the answer is one of `approval.options`, and `"text"` when the user types it. `approval.allowFreeform` accepts a typed answer alongside the options, and `toolApprovalAcceptsText(approval)` reports whether a text affordance belongs on screen.

```tsx
import { toolApprovalAcceptsText } from "@assistant-ui/react";

if (approval && toolApprovalAcceptsText(approval)) {
  await respondToApproval({ text: "staging" });
}
```

The runtime records a free-form answer as `{ approvalId, approved: true, text }`, because answering a question is not refusing it. A `text` response to a request that declares neither `display: "text"` nor `allowFreeform` throws, so a host never receives an answer it has nowhere to record.

An answer on its own resolves only a question. On a decision the approval is the authorization, so a bare `text` throws there and the answer must accompany an explicit decision (`{ approved, text }`) or a chosen option; otherwise a typed note would authorize the call. That is why the default `ToolFallback` shows a text field beside Allow and Deny with no separate submit on a decision, and renders a text field with no Deny control for a question.

## Cancelled and expired gates

An approval that ends without a decision, from a cancelled run or an expired request, is recorded by the host as `approval.resolution` of `"cancelled"` or `"expired"`. That closes the gate without recording a deny, so treat a set `resolution` the same way as a set `approved` and stop rendering the controls.

## Wiring the AI SDK v7 gate

On the server, gate the call with the call-level `toolApproval` option, either a per-tool status or a function of the input.

```ts title="app/api/chat/route.ts"
const result = streamText({
  model: openai("gpt-5.6-luna"),
  messages: await convertToModelMessages(messages),
  tools: { deploy: deployTool },
  toolApproval: {
    deploy: (input) =>
      input.target === "production" ? "user-approval" : "not-applicable",
  },
});
```

On the client, let the runtime post the recorded decision back.

```tsx
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";

const runtime = useChatRuntime({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

MCP tools execute on the server, so gate them the same way, keyed by the model-visible name including any `prefix`.

## Other runtimes

Approval gates require a runtime that implements them. The AI SDK v7 runtime emits boolean gates for `toolApproval`-gated tools. `LocalRuntime` supports gates your `ChatModelAdapter` emits: emit `approval: { id }` in the pending state and end the run with `status: { type: "requires-action", reason: "tool-calls" }`; a deny synthesizes an error result while an allow leaves the result to your adapter. Its `unstable_humanToolNames` option covers the other case, where the user supplies the result through `addResult`. The Eve runtime projects its input requests onto the question fields, and the AG-UI runtime admits only gates it can answer with a decision.

For prebuilt UI, the `ToolFallback` element renders declared options and the confirmation step automatically, and the standalone `approval-card` and `permission-grant` elements cover a richer capability prompt. See the [elements skill](../../elements/SKILL.md).
