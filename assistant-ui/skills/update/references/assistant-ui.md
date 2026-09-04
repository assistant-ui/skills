# assistant-ui migrations

Apply only the sections at or above the application’s installed version, in ascending order. The CLI covers mechanical renames, but it cannot choose application behavior for a custom runtime, renderer, or persistence adapter.

## Contents

- [Version route](#version-route)
- [0.11 ContentPart to MessagePart](#011-contentpart-to-messagepart)
- [0.12 unified state API](#012-unified-state-api)
- [0.14 removals and primitive children](#014-removals-and-primitive-children)
- [0.15 scope properties and removals](#015-scope-properties-and-removals)
- [Tools to toolkits](#tools-to-toolkits)
- [react-langgraph v0.7](#react-langgraph-v07)
- [Deprecation policy](#deprecation-policy)

## Version route

| Release line | Migration action |
| --- | --- |
| 0.8.x | The current CLI excludes the historical v0-8/ui-package-split because its @assistant-ui/react-ui destination is incompatible with current runtimes. Install or move copied UI through the Elements registry instead. |
| 0.9.x | Run the bundled v0-9/edge-package-split codemod. |
| 0.10.x | The supplied migration pages and current bundle have no dedicated 0.10 mapping. Continue to the documented 0.11 migration and resolve remaining package or build fallout. |
| 0.11.x | Rename ContentPart APIs and MessagePrimitive.Content. |
| 0.12.x | Replace assistant API aliases, context hooks, and kebab-case events. |
| 0.13.x | Clear deprecations before 0.14. A 0.13 app without warnings primarily needs the primitive children migration. |
| 0.14.x | Replace removed aliases, runtime APIs, and primitive components props. |
| 0.15.x | Replace scope accessor calls, legacy hooks, tools map, mcp-app, and provider configuration. |

## 0.11 ContentPart to MessagePart

The v0.11 codemod is v0-11/content-part-to-message-part. Replace every type, hook, provider, and primitive from the following mapping.

| Old | New |
| --- | --- |
| TextContentPart | TextMessagePart |
| ReasoningContentPart | ReasoningMessagePart |
| SourceContentPart | SourceMessagePart |
| ImageContentPart | ImageMessagePart |
| FileContentPart | FileMessagePart |
| Unstable_AudioContentPart | Unstable_AudioMessagePart |
| ToolCallContentPart | ToolCallMessagePart |
| ContentPartStatus | MessagePartStatus |
| ToolCallContentPartStatus | ToolCallMessagePartStatus |
| ThreadUserContentPart | ThreadUserMessagePart |
| ThreadAssistantContentPart | ThreadAssistantMessagePart |
| ContentPartRuntime | MessagePartRuntime |
| ContentPartState | MessagePartState |
| useContentPart | useMessagePart |
| useContentPartRuntime | useMessagePartRuntime |
| useContentPartText | useMessagePartText |
| useContentPartReasoning | useMessagePartReasoning |
| useContentPartSource | useMessagePartSource |
| useContentPartFile | useMessagePartFile |
| useContentPartImage | useMessagePartImage |
| useTextContentPart | useMessagePartText |
| EmptyContentPartComponent | EmptyMessagePartComponent |
| TextContentPartComponent | TextMessagePartComponent |
| ReasoningContentPartComponent | ReasoningMessagePartComponent |
| SourceContentPartComponent | SourceMessagePartComponent |
| ImageContentPartComponent | ImageMessagePartComponent |
| FileContentPartComponent | FileMessagePartComponent |
| Unstable_AudioContentPartComponent | Unstable_AudioMessagePartComponent |
| ToolCallContentPartComponent | ToolCallMessagePartComponent |
| EmptyContentPartProps | EmptyMessagePartProps |
| TextContentPartProps | TextMessagePartProps |
| ReasoningContentPartProps | ReasoningMessagePartProps |
| SourceContentPartProps | SourceMessagePartProps |
| ImageContentPartProps | ImageMessagePartProps |
| FileContentPartProps | FileMessagePartProps |
| Unstable_AudioContentPartProps | Unstable_AudioMessagePartProps |
| ToolCallContentPartProps | ToolCallMessagePartProps |
| TextContentPartProvider | TextMessagePartProvider |
| TextContentPartProviderProps | TextMessagePartProviderProps |
| ContentPartRuntimeProvider | MessagePartRuntimeProvider |
| ContentPartContext | MessagePartContext |
| ContentPartContextValue | MessagePartContextValue |
| ContentPartPrimitive | MessagePartPrimitive |
| ContentPartPrimitiveText | MessagePartPrimitiveText |
| ContentPartPrimitiveImage | MessagePartPrimitiveImage |
| ContentPartPrimitiveInProgress | MessagePartPrimitiveInProgress |
| MessagePrimitive.Content | MessagePrimitive.Parts |

MessagePrimitive.Parts now uses its children render function for part-specific rendering. Complete this migration before applying the 0.14 primitive API changes.

## 0.12 unified state API

The v0.12 codemods are v0-12/assistant-api-to-aui, v0-12/event-names-to-camelcase, and v0-12/primitive-if-to-aui-if.

### Core hook aliases

| Old | New |
| --- | --- |
| useAssistantApi | useAui |
| useAssistantState | useAuiState |
| useAssistantEvent | useAuiEvent |
| AssistantIf | AuiIf |

### Removed and deprecated context APIs

This table shows the v0.12 landing form. Apply the 0.15 section afterward to turn the remaining scope calls into properties.

| Old | v0.12 replacement |
| --- | --- |
| useMessageUtils | useAuiState((s) => s.message.isHovering) or useAuiState((s) => s.message.isCopied) |
| useMessageUtilsStore | useAui() with aui.message().setIsHovering() or aui.message().setIsCopied() |
| useToolUIs | Removed with no direct equivalent |
| useToolUIsStore | Removed with no direct equivalent |
| useAssistantRuntime | useAui() |
| useThread | useAuiState((s) => s.thread) |
| useThreadRuntime | useAui().thread() |
| useMessage | useAuiState((s) => s.message) |
| useMessageRuntime | useAui().message() |
| useComposer | useAuiState((s) => s.composer) |
| useComposerRuntime | useAui().composer() |
| useEditComposer | useAuiState((s) => s.message.composer) |
| useThreadListItem | useAuiState((s) => s.threadListItem) |
| useThreadListItemRuntime | useAui().threadListItem() |
| useMessagePart | useAuiState((s) => s.part) |
| useMessagePartRuntime | useAui().part() |
| useAttachment | useAuiState((s) => s.attachment) |
| useAttachmentRuntime | useAui().attachment() |
| useThreadModelContext | useAuiState((s) => s.thread.modelContext) |
| useThreadModelConfig | useAui().thread().getModelContext() |
| useThreadComposer | useAuiState((s) => s.thread.composer) |
| useThreadList | useAuiState((s) => s.threads) |

### Event names

| Old | New |
| --- | --- |
| thread.run-start | thread.runStart |
| thread.run-end | thread.runEnd |
| thread.model-context-update | thread.modelContextUpdate |
| composer.attachment-add | composer.attachmentAdd |
| thread-list-item.switched-to | threadListItem.switchedTo |
| thread-list-item.switched-away | threadListItem.switchedAway |

thread.initialize and composer.send do not change.

## 0.14 removals and primitive children

### Hook aliases

| Removed | Replacement |
| --- | --- |
| useAssistantApi | useAui |
| useAssistantState | useAuiState |
| useAssistantEvent | useAuiEvent |
| AssistantIf | AuiIf |
| useLocalThreadRuntime | useLocalRuntime |
| unstable_useRemoteThreadListRuntime | useRemoteThreadListRuntime |
| unstable_useCloudThreadListAdapter | useCloudThreadListAdapter |
| unstable_RemoteThreadListAdapter | RemoteThreadListAdapter |
| unstable_InMemoryThreadListAdapter | InMemoryThreadListAdapter |

### Runtime APIs

| Removed | Replacement |
| --- | --- |
| runtime.threadList | runtime.threads |
| runtime.switchToNewThread() | runtime.threads.switchToNewThread() |
| runtime.switchToThread(id) | runtime.threads.switchToThread(id) |
| runtime.registerModelConfigProvider(p) | runtime.registerModelContextProvider(p) |
| runtime.reset({ initialMessages }) | runtime.thread.reset(initialMessages) |
| thread.startRun(parentId) | thread.startRun({ parentId }) |
| thread.unstable_resumeRun(config) | thread.resumeRun(config) |
| thread.unstable_loadExternalState(state) | thread.importExternalState(state) |
| thread.getModelConfig() | thread.getModelContext() |
| s.message.submittedFeedback | s.message.metadata.submittedFeedback |
| getExternalStoreMessage(message) | getExternalStoreMessages(message) |
| toAISDKTools(tools) | toToolsJSONSchema(tools) from assistant-stream |
| useLangGraphRuntime({ onSwitchToThread }) | useLangGraphRuntime({ load }) |

toToolsJSONSchema filters disabled and backend tools by default. Pass { filter: () => true } only when the old behavior intentionally included every tool.

### Primitive children render functions

| Deprecated components prop | Children form |
| --- | --- |
| ThreadPrimitive.Messages components | ThreadPrimitive.Messages with ({ message }) => ... |
| MessagePrimitive.Parts components | MessagePrimitive.Parts with ({ part }) => ... |
| ThreadPrimitive.Suggestions components | ThreadPrimitive.Suggestions with () => ... |
| ThreadListPrimitive.Items components | ThreadListPrimitive.Items with () => ... |
| ComposerPrimitive.Attachments components | ComposerPrimitive.Attachments with () => ... |

Return null from MessagePrimitive.Parts to let registered tool and data renderer UIs render. Return an empty fragment to suppress them. Tool-call parts expose toolUI, addResult, and resume directly.

## 0.15 scope properties and removals

The v0-15/aui-accessor-calls-to-properties codemod converts nullary scope calls to properties. aui.thread is always truthy, even when unavailable. Check aui.thread.source != null before accessing an optional scope. source, query, and name are selection metadata on the proxy and never resolve to scope methods.

### Legacy context hooks

| Removed | Replacement |
| --- | --- |
| useAssistantRuntime() | useAui() |
| useThreadList(selector) | useAuiState((s) => s.threads) |
| useThreadRuntime() | useAui().thread |
| useThread(selector) | useAuiState((s) => s.thread) |
| useThreadComposer(selector) | useAuiState((s) => s.thread.composer) |
| useThreadModelContext(selector) | useAuiState((s) => s.thread.modelContext) |
| useMessageRuntime() | useAui().message |
| useMessage(selector) | useAuiState((s) => s.message) |
| useEditComposer(selector) | useAuiState((s) => s.message.composer) |
| useComposerRuntime() | useAui().composer |
| useComposer(selector) | useAuiState((s) => s.composer) |
| useMessagePartRuntime() | useAui().part |
| useMessagePart(selector) | useAuiState((s) => s.part) |
| useAttachmentRuntime() | useAui().attachment |
| useAttachment(selector) | useAuiState((s) => s.attachment) |
| useThreadListItemRuntime() | useAui().threadListItem |
| useThreadListItem(selector) | useAuiState((s) => s.threadListItem) |

useThreadComposerAttachment(Runtime), useEditComposerAttachment(Runtime), and useMessageAttachment(Runtime) are removed with the same attachment mapping.

### Other removed forms

| Old | New |
| --- | --- |
| s.tools.tools[toolName]?.[0] | s.tools.toolUIs[toolName]?.[0]?.render |
| groupPartByType({ "mcp-app": [] }) | groupPartByType({ "standalone-tool-call": [] }) |
| useAui(scopes, { parent }) | useAui() beneath AuiProvider, then AuiConfig(scopes) |
| AuiProvider value={client} | AuiProvider extends={client} config={config} |
| AuiProvider value={null} | AuiProvider extends={null} config={config} |
| useAui({ ... }) | useAui(), then AuiConfig({...}) with provider config |
| AssistantRuntimeProvider aui={aui} | AssistantRuntimeProvider config={config} |
| threadListItem.switchedTo and threadListItem.switchedAway | threads.selectionChanged |

```tsx
// After
const config = AuiConfig({ tools: Tools({ toolkit }) });

<AssistantRuntimeProvider runtime={runtime} config={config}>
  {children}
</AssistantRuntimeProvider>;
```

A nested AuiProvider requires extends={aui} to inherit, or extends={null} to isolate. The provider exposes a derived client, not the exact client passed to extends.

threads.selectionChanged carries threadId and previousThreadId. It fires for every listener on the shared threads scope. When reproducing an item-scoped listener, compare threadId with useAuiState((s) => s.threadListItem.id).

Primitive If components, useMessagePartText, useMessagePartReasoning, useMessagePartSource, useMessagePartImage, useMessagePartFile, useMessagePartData, and primitive components props remain deprecated. Use AuiIf, useAuiState with a narrowed part, and children render functions.

## Tools to toolkits

makeAssistantTool, useAssistantTool, makeAssistantToolUI, and useAssistantToolUI are deprecated. A toolkit holds a named tool’s description, parameters, execute, providerOptions, render, renderText, and display in one model contract.

1. Create a "use generative" module exporting defineToolkit({...}).
2. Replace each toolName property with the toolkit object key.
3. Register it once through const config = AuiConfig({ tools: Tools({ toolkit }) }) and runtime provider config={config}.
4. Remove component and hook registration calls.
5. Use externalTool() for a UI-only backend, MCP, or LangGraph renderer. Use stubTool() with useAuiToolOverrides for a stateful executor.

```tsx
// After
"use generative";

import { defineToolkit } from "@assistant-ui/react";

export default defineToolkit({
  weather: {
    execute: async () => {
      "use client";
      return { forecast: "sunny" };
    },
  },
});
```

## react-langgraph v0.7

react-langgraph v0.7 folds thread lifecycle into useLangGraphRuntime.

| Previous pattern | v0.7 pattern |
| --- | --- |
| useCloudThreadListRuntime wrapper | useLangGraphRuntime directly |
| useThreadListItemRuntime().initialize() | initialize passed to stream |
| onSwitchToThread | load |
| onSwitchToNewThread | create |
| Separate runtime hook and wrapper | stream, create, load, delete, and cloud on one hook |
| Manual cloud wrapper | cloud passed to useLangGraphRuntime |

stream receives messages and an object containing abortSignal, initialize, command, runConfig, and checkpointId. initialize resolves remoteId and externalId. create returns { externalId }, and load returns the remote thread state. The threadId and onSwitchToNewThread options are not supported.

## Deprecation policy

Anything marked unstable_, experimental_, or internal, plus RuntimeCore, is experimental and may be removed without notice. Beta APIs have a notice period shorter than one month. They include TailwindCSS plugins, Context API, Runtime API, message types, styled UI components, primitive hooks, attachment APIs, and shadcn/ui styles. Stable primitives, except AttachmentPrimitive, have a notice period longer than three months.

For current decisions, read [the deprecation policy](https://www.assistant-ui.com/docs/migrations/deprecation-policy), then follow any date-specific source deprecation annotation.
