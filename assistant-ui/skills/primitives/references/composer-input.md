# Composer input extensions

`ComposerPrimitive.Input` is the normal textarea for a composer. This reference covers the cases where it needs a supporting hook, adapter, or primitive: a custom input surface, recalled drafts, dictation, quotes, and pending attachments.

## Contents

- [Headless composer input](#headless-composer-input)
- [Input history](#input-history)
- [Dictation](#dictation)
- [Quoting](#quoting)
- [Attachments](#attachments)

## Headless composer input

```tsx
import {
  ComposerPrimitive,
  unstable_useComposerInput,
} from "@assistant-ui/react";

function HeadlessComposer() {
  const composer = unstable_useComposerInput();

  return (
    <ComposerPrimitive.Root>
      <textarea
        aria-label="Message"
        value={composer.value}
        disabled={composer.isDisabled}
        onChange={(event) => composer.setText(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && !event.shiftKey && composer.canSend) {
            event.preventDefault();
            composer.send();
          }
        }}
      />
      <ComposerPrimitive.Send />
    </ComposerPrimitive.Root>
  );
}
```

Use `unstable_useComposerInput` only when an editor owns its DOM and state, such as a `contentEditable` implementation. It supplies `value`, `setText`, `canSend`, `isDisabled`, and `send`, but it does not recreate autosizing, paste attachments, focus handling, IME handling, trigger popovers, or keyboard shortcuts. Keep the explicit `canSend` guard in custom handlers because `send()` is otherwise a no op.

## Input history

```tsx
import {
  ComposerPrimitive,
  unstable_useComposerInputHistory,
} from "@assistant-ui/react";

function ComposerWithHistory() {
  const history = unstable_useComposerInputHistory();

  return (
    <ComposerPrimitive.Root>
      <ComposerPrimitive.Input {...history} />
      <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}
```

`unstable_useComposerInputHistory` recalls trimmed user messages with ArrowUp and ArrowDown when the new message composer is empty. It restores the original draft after the newest entry, yields to a mention or slash command popover, and does not affect an edit composer. It is unstable, so keep it near the input that consumes its event handlers.

## Dictation

```tsx
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime({
    adapters: {
      dictation: new WebSpeechDictationAdapter({
        language: "en-US",
        continuous: true,
        interimResults: true,
      }),
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

function DictationControls() {
  return (
    <>
      <AuiIf condition={(s) => s.composer.dictation == null}>
        <ComposerPrimitive.Dictate>Dictate</ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf condition={(s) => s.composer.dictation != null}>
        <ComposerPrimitive.StopDictation>Stop</ComposerPrimitive.StopDictation>
      </AuiIf>
      <AuiIf condition={(s) => s.composer.dictation != null}>
        <ComposerPrimitive.DictationTranscript />
      </AuiIf>
    </>
  );
}
```

`WebSpeechDictationAdapter` uses the browser Web Speech API. Check `WebSpeechDictationAdapter.isSupported()` before advertising voice input when browser support is uncertain. A custom `DictationAdapter` can supply a server transcription or realtime provider. `ComposerPrimitive.Dictate` disables itself when no adapter is configured, and a send stops an active session.

## Quoting

```tsx
import {
  ComposerPrimitive,
  MessagePrimitive,
  SelectionToolbarPrimitive,
  ThreadPrimitive,
  useAui,
} from "@assistant-ui/react";

function QuotedThread() {
  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Viewport>
        <MessagePrimitive.Root>
          <p data-aui-quote-selectable>Quoteable assistant response.</p>
        </MessagePrimitive.Root>
      </ThreadPrimitive.Viewport>
      <SelectionToolbarPrimitive.Root>
        <SelectionToolbarPrimitive.Quote>Quote</SelectionToolbarPrimitive.Quote>
      </SelectionToolbarPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

function ComposerQuote() {
  return (
    <ComposerPrimitive.Quote>
      <ComposerPrimitive.QuoteText />
      <ComposerPrimitive.QuoteDismiss>Remove quote</ComposerPrimitive.QuoteDismiss>
    </ComposerPrimitive.Quote>
  );
}

function QuoteButton() {
  const aui = useAui();
  return (
    <button
      onClick={() =>
        aui.composer.setQuote({ text: "Quoted text", messageId: "message-id" })
      }
    >
      Quote text
    </button>
  );
}
```

Place `SelectionToolbarPrimitive.Root` inside `ThreadPrimitive.Root`. It creates a quote from a selection in one message part. Mark a text region with `data-aui-quote-selectable` to limit quoteable content, or set it to `"false"` to exclude an element. `setQuote` replaces the one pending quote, and `aui.thread.composer().setQuote(...)` reaches the thread composer from outside its local composer scope.

Quote metadata is attached to the sent user message, not its text content. Forward it to the model in the AI SDK route:

```ts
import { convertToModelMessages, streamText } from "ai";
import { injectQuoteContext } from "@assistant-ui/ai-sdk";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({
    model: myModel,
    messages: await convertToModelMessages(injectQuoteContext(messages)),
  });

  return result.toUIMessageStreamResponse();
}
```

`injectQuoteContext` prepends the selected text as quote context before model message conversion. Without it, the quote is visible in the interface but absent from the model input.

## Attachments

```tsx
import {
  AssistantRuntimeProvider,
  AttachmentPrimitive,
  ComposerPrimitive,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useAuiEvent,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/ai-sdk";

const attachmentAdapter = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime({
    adapters: { attachments: attachmentAdapter },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

function AttachmentErrorNotice() {
  useAuiEvent("composer.attachmentAddError", ({ reason, message }) => {
    console.error(reason, message);
  });
  return null;
}

function ComposerAttachments() {
  return (
    <ComposerPrimitive.AttachmentDropzone className="data-[dragging]:bg-muted">
      <ComposerPrimitive.Attachments>
        {() => (
          <AttachmentPrimitive.Root>
            <AttachmentPrimitive.unstable_Thumb />
            <AttachmentPrimitive.Name />
            <AttachmentPrimitive.Remove>Remove</AttachmentPrimitive.Remove>
          </AttachmentPrimitive.Root>
        )}
      </ComposerPrimitive.Attachments>
      <ComposerPrimitive.AddAttachment>Add file</ComposerPrimitive.AddAttachment>
      <ComposerPrimitive.Input />
    </ComposerPrimitive.AttachmentDropzone>
  );
}
```

`useChatRuntime` accepts files by default. Use `SimpleImageAttachmentAdapter`, `SimpleTextAttachmentAdapter`, or `CompositeAttachmentAdapter` when the accepted types must be explicit. For remote files, `CloudFileAttachmentAdapter` owns the upload lifecycle; implement `AttachmentAdapter` for another source or validation policy.

`ComposerPrimitive.Attachments` iterates staged files and `AttachmentPrimitive` renders one attachment, including removal in a composer. `ComposerPrimitive.AttachmentDropzone` sets `data-dragging` while files hover over it. Subscribe to `composer.attachmentAddError` to surface `no-adapter`, `not-accepted`, and `adapter-error` failures. Sent message attachments are read only: render them with `MessagePrimitive.Attachments` as described in [message.md](./message.md#attachments).
