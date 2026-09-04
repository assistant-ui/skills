# Breaking changes quick reference

Use this table to route an error to the full guide. Apply all rows newer than the installed version.

| Version or symptom | Check | Destination |
| --- | --- | --- |
| Before 0.8.x | Historical UI package split is excluded from the current upgrade bundle | Install or move copied components through Elements |
| Before 0.9.x | Edge package split | Run v0-9/edge-package-split |
| Before 0.11.x | ContentPart names or MessagePrimitive.Content | [assistant-ui.md](./assistant-ui.md#011-contentpart-to-messagepart) |
| Before 0.12.x | useAssistantApi, context hooks, or kebab-case events | [assistant-ui.md](./assistant-ui.md#012-unified-state-api) |
| Before 0.14.x | Removed aliases, runtime members, or primitive components props | [assistant-ui.md](./assistant-ui.md#014-removals-and-primitive-children) |
| Before 0.15.x | aui.thread(), legacy hooks, tools map, mcp-app, or old provider props | [assistant-ui.md](./assistant-ui.md#015-scope-properties-and-removals) |
| AI SDK v4 or v5 | Data stream runtime, Message, parameters, or toDataStreamResponse | [ai-sdk.md](./ai-sdk.md#v4-and-v5-to-v6) |
| AI SDK v6 | @assistant-ui/react-ai-sdk, result.toUIMessageStreamResponse(), or needsApproval | [ai-sdk.md](./ai-sdk.md#v6-to-v7) |
| Legacy tool registration | makeAssistantTool, useAssistantTool, makeAssistantToolUI, or useAssistantToolUI | [assistant-ui.md](./assistant-ui.md#tools-to-toolkits) |
| LangGraph v0.7 | useCloudThreadListRuntime, onSwitchToThread, or manual thread initialization | [assistant-ui.md](./assistant-ui.md#react-langgraph-v07) |
| React 18 | A copied shadcn Button does not forward its ref | Wrap Button with React.forwardRef |
| 0.11 types | TextContentPart, ToolCallContentPart, ContentPartStatus, or related names | Replace ContentPart with MessagePart throughout |
| 0.11 hooks | useContentPart, useContentPartRuntime, or useTextContentPart | Use the corresponding useMessagePart API |
| 0.11 providers | ContentPartRuntimeProvider or ContentPartContext | Use the corresponding MessagePart provider or context |
| 0.11 primitives | ContentPartPrimitive | Use MessagePartPrimitive |
| 0.11 message rendering | MessagePrimitive.Content | Use MessagePrimitive.Parts |
| 0.12 state aliases | useAssistantApi or useAssistantState | Use useAui or useAuiState |
| 0.12 event alias | useAssistantEvent | Use useAuiEvent |
| 0.12 conditional alias | AssistantIf | Use AuiIf |
| 0.12 state scope | useThread, useMessage, useComposer, or useAttachment | Select the matching scope through useAuiState |
| 0.12 action scope | useThreadRuntime, useMessageRuntime, or useComposerRuntime | Start with useAui, then apply the 0.15 property form |
| 0.12 event name | thread.run-start, thread.run-end, or composer.attachment-add | Use the camelCase event names |
| 0.14 local runtime | useLocalThreadRuntime | Use useLocalRuntime |
| 0.14 remote thread list | unstable_useRemoteThreadListRuntime | Use useRemoteThreadListRuntime |
| 0.14 thread list adapter | unstable_RemoteThreadListAdapter or unstable_InMemoryThreadListAdapter | Use the stable adapter names |
| 0.14 assistant runtime | runtime.threadList or runtime.switchToThread | Use runtime.threads |
| 0.14 thread runtime | startRun(parentId), unstable_resumeRun, or getModelConfig | Use the object, stable, or model-context form |
| 0.14 feedback state | s.message.submittedFeedback | Read s.message.metadata.submittedFeedback |
| 0.14 external store | getExternalStoreMessage | Use getExternalStoreMessages |
| 0.14 transport helper | toAISDKTools | Use toToolsJSONSchema from assistant-stream |
| 0.14 thread messages | ThreadPrimitive.Messages components prop | Use a children render function |
| 0.14 message parts | MessagePrimitive.Parts components prop | Use a children render function |
| 0.14 suggestions | ThreadPrimitive.Suggestions components prop | Use a children render function |
| 0.14 thread list | ThreadListPrimitive.Items components prop | Use a children render function |
| 0.14 attachments | ComposerPrimitive.Attachments components prop | Use a children render function |
| 0.15 scope access | aui.thread(), aui.threads(), aui.message(), or aui.composer() | Read the scope property, then call its methods |
| 0.15 optional scope | A truthiness check for aui.thread | Check aui.thread.source != null |
| 0.15 legacy hooks | useAssistantRuntime or a context runtime hook | Use useAui or useAuiState with the final property mapping |
| 0.15 tool UI map | s.tools.tools | Use s.tools.toolUIs |
| 0.15 part grouping | mcp-app | Use standalone-tool-call |
| 0.15 provider construction | useAui({ ... }) | Use useAui(), AuiConfig({...}), and config |
| 0.15 provider prop | AuiProvider value | Use extends plus config |
| 0.15 runtime provider | AssistantRuntimeProvider aui | Use AssistantRuntimeProvider config |
| 0.15 thread event | threadListItem.switchedTo or threadListItem.switchedAway | Use threads.selectionChanged |
| 0.15 primitive conditionals | ThreadPrimitive.If, MessagePrimitive.If, or ThreadPrimitive.Empty | Use AuiIf |
| 0.15 part hooks | useMessagePartText, useMessagePartReasoning, or another specialized part hook | Select and narrow s.part with useAuiState |
| 0.15 registry path | @/components/assistant-ui/thread or another retired path | Use @/components/assistant-ui/elements/<name>.aui |
| 0.15 interactables | useAssistantInteractable, Interactables(), or useInteractableState | Use unstable interactables before the 2026-09-14 removal date |
| AI SDK v7 package | @assistant-ui/react-ai-sdk in current source | Import from @assistant-ui/ai-sdk |
| AI SDK v7 route | result.toUIMessageStreamResponse() | Use createUIMessageStreamResponse with toUIMessageStream |
| AI SDK v7 approval | needsApproval | Configure the call-level toolApproval option |
| AI SDK agent loop | maxSteps | Use stopWhen: stepCountIs(n) |

The current target is @assistant-ui/react 0.15.x, @assistant-ui/ai-sdk 0.0.x, ai 7.x, and @ai-sdk/react 4.x. Run npx assistant-ui@latest doctor and npx assistant-ui@latest info when a dependency mismatch remains.
