# Runtime Adapters

Optional capability adapters registered on the runtime's `adapters` map: attachments, feedback, text to speech, dictation, suggestions, and thread history persistence. Realtime duplex voice uses the same map under `adapters.voice`; see [voice.md](./voice.md).

## Contents

- [The adapters map](#the-adapters-map)
- [Attachment adapters](#attachment-adapters)
- [Built-in attachment adapters](#built-in-attachment-adapters)
- [Custom attachment adapter](#custom-attachment-adapter)
- [CloudFileAttachmentAdapter](#cloudfileattachmentadapter)
- [Attachment error handling](#attachment-error-handling)
- [Feedback adapter](#feedback-adapter)
- [Text to speech](#text-to-speech)
- [Custom TTS adapter](#custom-tts-adapter)
- [Dictation](#dictation)
- [Custom dictation adapter](#custom-dictation-adapter)
- [Suggestion adapter](#suggestion-adapter)
- [Thread history adapter](#thread-history-adapter)

## The adapters map

Every adapter is registered under a named key on the runtime's `adapters` option. The same map works across `useChatRuntime`, `useLocalRuntime`, and `useExternalStoreRuntime`; each runtime turns on the matching UI surface only for the adapters it was given (see the [support matrix](https://www.assistant-ui.com/docs/runtimes/concepts/adapters#support-matrix) for which adapters each runtime layer exposes).

```ts
import { useChatRuntime } from "@assistant-ui/ai-sdk";

const runtime = useChatRuntime({
  adapters: {
    attachments: /* AttachmentAdapter */,
    speech: /* SpeechSynthesisAdapter */,
    dictation: /* DictationAdapter */,
    feedback: /* FeedbackAdapter */,
    suggestion: /* SuggestionAdapter */,
    history: /* ThreadHistoryAdapter, LocalRuntime-based runtimes only */,
  },
});
```

## Attachment adapters

An `AttachmentAdapter` controls which files the composer accepts and how they become message content.

```ts
import type { AttachmentAdapter, PendingAttachment, CompleteAttachment, Attachment } from "@assistant-ui/react";

type AttachmentAdapter = {
  accept: string;
  add: (state: { file: File }) => Promise<PendingAttachment> | AsyncGenerator<PendingAttachment, void>;
  send: (attachment: PendingAttachment) => Promise<CompleteAttachment>;
  remove?: (attachment: Attachment) => Promise<void>;
};
```

`accept` is a MIME filter (`"image/*"`, `"image/jpeg,image/png"`, or `"*"`). `add` runs when the user picks a file and returns a `PendingAttachment` with `status: { type: "requires-action", reason: "composer-send" }`, holding the file before send. `send` runs at composer send time, finalizes the upload, and resolves to a `CompleteAttachment` with `status: { type: "complete" }` and the `content` array that becomes part of the message. `remove` is optional cleanup when the user removes the attachment before sending. When `add` is an async generator it can yield intermediate `{ type: "running", reason: "uploading", progress }` states before the final `requires-action`, which is how upload progress bars work without holding the whole file as base64 in memory.

## Built-in attachment adapters

`SimpleImageAttachmentAdapter` accepts `image/*` and converts files to data URLs; `SimpleTextAttachmentAdapter` accepts text files and wraps their content; `CompositeAttachmentAdapter` combines several and routes each file to the first whose `accept` matches.

```ts
import { CompositeAttachmentAdapter, SimpleImageAttachmentAdapter, SimpleTextAttachmentAdapter } from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    attachments: new CompositeAttachmentAdapter([
      new SimpleImageAttachmentAdapter(),
      new SimpleTextAttachmentAdapter(),
    ]),
  },
});
```

## Custom attachment adapter

Implement `AttachmentAdapter` to control validation and the content shape. A vision adapter that rejects oversized images and emits an inline image content part:

```ts
class VisionImageAdapter implements AttachmentAdapter {
  accept = "image/jpeg,image/png,image/webp,image/gif";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    if (file.size > 20 * 1024 * 1024) throw new Error("Image size exceeds 20MB limit");
    return { id: crypto.randomUUID(), type: "image", name: file.name, file, status: { type: "requires-action", reason: "composer-send" } };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const image = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(attachment.file!);
    });
    return { ...attachment, status: { type: "complete" }, content: [{ type: "image", image }] };
  }

  async remove(): Promise<void> {}
}
```

## CloudFileAttachmentAdapter

`CloudFileAttachmentAdapter` stores attachments in assistant-ui Cloud. Pass an `AssistantCloud` instance; it supplies its own `accept`, `add`, `send`, and `remove`.

```ts
import { CloudFileAttachmentAdapter } from "@assistant-ui/react";
import { AssistantCloud } from "assistant-cloud";

const cloud = new AssistantCloud({ baseUrl: process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL });

const runtime = useChatRuntime({
  adapters: { attachments: new CloudFileAttachmentAdapter(cloud) },
});
```

## Attachment error handling

Failures surface as the `composer.attachmentAddError` event rather than throwing into the render tree.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

function AttachmentErrorToast() {
  useAuiEvent("composer.attachmentAddError", ({ reason, message, error }) => {
    if (reason === "not-accepted") toast.error("This file type is not supported.");
    else if (reason === "no-adapter") toast.error("Attachments are not configured for this composer.");
    else {
      if (error) console.error(error);
      toast.error(message || "Attachment failed to upload.");
    }
  });
  return null;
}
```

`no-adapter` means no `AttachmentAdapter` was configured, `not-accepted` means the file type did not match `adapter.accept`, and `adapter-error` means `add()` threw or returned an error status.

## Feedback adapter

A `FeedbackAdapter` records thumbs up and thumbs down on assistant messages. When present, message bubbles render feedback buttons.

```ts
import type { FeedbackAdapter } from "@assistant-ui/react";

type FeedbackAdapter = {
  submit: (feedback: { type: "positive" | "negative"; message: ThreadMessage }) => Promise<void>;
};

const feedbackAdapter: FeedbackAdapter = {
  async submit({ type, message }) {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: message.id, rating: type }),
    });
  },
};

const runtime = useChatRuntime({ adapters: { feedback: feedbackAdapter } });
```

Trigger it from the UI with `aui.message.submitFeedback({ type: "positive" | "negative" })`, or the `ActionBarPrimitive.FeedbackPositive` / `FeedbackNegative` primitives. `adapters.feedback` being present is what turns `capabilities.feedback` on; there is no separate option.

## Text to speech

Register a `SpeechSynthesisAdapter` under `adapters.speech`. The built-in `WebSpeechSynthesisAdapter` uses the browser's native Web Speech API.

```ts
import { WebSpeechSynthesisAdapter } from "@assistant-ui/react";

const runtime = useChatRuntime({ adapters: { speech: new WebSpeechSynthesisAdapter() } });
```

`ActionBarPrimitive.Speak` is disabled automatically when no speech adapter is configured. Toggle speak and stop buttons off the message's `speech` state, which is `undefined` unless this message is the one being spoken.

```tsx
import { ActionBarPrimitive, AuiIf } from "@assistant-ui/react";
import { AudioLinesIcon, StopCircleIcon } from "lucide-react";

const AssistantActionBar = () => (
  <ActionBarPrimitive.Root>
    <AuiIf condition={(s) => s.message.speech == null}>
      <ActionBarPrimitive.Speak><AudioLinesIcon /></ActionBarPrimitive.Speak>
    </AuiIf>
    <AuiIf condition={(s) => s.message.speech != null}>
      <ActionBarPrimitive.StopSpeaking><StopCircleIcon /></ActionBarPrimitive.StopSpeaking>
    </AuiIf>
    <ActionBarPrimitive.Copy />
  </ActionBarPrimitive.Root>
);
```

## Custom TTS adapter

The interface is one `speak` method returning an `Utterance` with a live `status`, `cancel`, and `subscribe`.

```ts
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

export class CustomTTSAdapter implements SpeechSynthesisAdapter {
  constructor(private apiUrl: string) {}

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    const subscribers = new Set<() => void>();
    let status: SpeechSynthesisAdapter.Status = { type: "starting" };
    let audio: HTMLAudioElement | null = null;
    const notify = () => subscribers.forEach((cb) => cb());
    const finish = (reason: "finished" | "cancelled" | "error", error?: unknown) => {
      if (status.type === "ended") return;
      status = { type: "ended", reason, error };
      notify();
    };

    fetch(this.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then((res) => res.blob())
      .then((blob) => {
        audio = new Audio(URL.createObjectURL(blob));
        status = { type: "running" };
        notify();
        audio.onended = () => finish("finished");
        audio.onerror = (e) => finish("error", e);
        audio.play().catch((err) => finish("error", err));
      })
      .catch((err) => finish("error", err));

    return {
      get status() { return status; },
      cancel: () => { audio?.pause(); finish("cancelled"); },
      subscribe: (cb) => { subscribers.add(cb); return () => subscribers.delete(cb); },
    };
  }
}
```

Register it under `adapters.speech` exactly like the built-in adapter. Use the same shape for any provider TTS; keep the server route responsible for API keys, the adapter only needs a URL that returns audio bytes.

## Dictation

Register a `DictationAdapter` under `adapters.dictation` for speech to text. The built-in `WebSpeechDictationAdapter` wraps the browser's Web Speech recognition API and works in Chrome, Edge, and Safari.

```ts
import { WebSpeechDictationAdapter } from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    dictation: new WebSpeechDictationAdapter({ language: "en-US", continuous: true, interimResults: true }),
  },
});

if (WebSpeechDictationAdapter.isSupported()) {
  // dictation available
}
```

`ComposerPrimitive.Dictate` starts a session and is disabled when no dictation adapter is configured; pair it with `ComposerPrimitive.StopDictation`. Both read `composer.dictation`, which is `undefined` when not dictating.

```tsx
import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { MicIcon, SquareIcon } from "lucide-react";

function DictationButton() {
  return (
    <>
      <AuiIf condition={(s) => s.composer.dictation == null}>
        <ComposerPrimitive.Dictate><MicIcon /></ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf condition={(s) => s.composer.dictation != null}>
        <ComposerPrimitive.StopDictation><SquareIcon className="animate-pulse" /></ComposerPrimitive.StopDictation>
      </AuiIf>
    </>
  );
}
```

## Custom dictation adapter

`listen()` starts a session; the session reports `status`, accepts `stop` / `cancel`, and emits speech events through three `on*` methods.

```ts
import type { DictationAdapter } from "@assistant-ui/react";

type DictationAdapter = {
  listen: () => DictationAdapter.Session;
  disableInputDuringDictation?: boolean;
};

// Session.onSpeech receives { transcript, isFinal? }: isFinal true commits text to
// the input, isFinal false shows it as a preview later results replace.
```

Set `disableInputDuringDictation = true` when the provider returns cumulative transcripts that would conflict with simultaneous typing; the ElevenLabs Scribe adapter (`npx assistant-ui create my-app -e with-elevenlabs-scribe`) does this and registers the same way as `WebSpeechDictationAdapter`. For server-side transcription, record audio in the adapter with `MediaRecorder`, POST the blob to a route that calls the AI SDK's `transcribe`, and emit one final `isFinal: true` result; keep the same `Session` surface for a streaming provider that emits partials instead.

## Suggestion adapter

A `SuggestionAdapter` generates follow-up prompts, either as a Promise or an async generator for incremental delivery.

```ts
import type { SuggestionAdapter } from "@assistant-ui/react";

type SuggestionAdapter = {
  generate: (options: { messages: readonly ThreadMessage[] }) => AsyncGenerator<{ prompt: string }[]>;
};

const runtime = useChatRuntime({
  adapters: {
    suggestion: {
      async *generate({ messages }) {
        const last = messages.at(-1);
        if (!last) return;
        const response = await fetch("/api/suggestions", { method: "POST", body: JSON.stringify(last) });
        yield (await response.json()).suggestions;
      },
    },
  },
});
```

Read the generated entries in the UI through `thread.suggestions`.

## Thread history adapter

A `ThreadHistoryAdapter` persists and restores per-thread messages, used by `LocalRuntime` and the framework adapters built on it.

```ts
type ThreadHistoryAdapter = {
  load: () => Promise<{ messages: { parentId: string | null; message: ThreadMessage }[] }>;
  append: (item: { parentId: string | null; message: ThreadMessage }) => Promise<void>;
  resume?: (input: { messages: ThreadMessage[] }) => Promise<ReadableStream | undefined>;
  withFormat?: <Fmt>(fmt: Fmt) => ThreadHistoryAdapter;
};
```

`load` runs when a thread opens, `append` runs after each message completes, and `resume` follows the same shape as a model run to restore an in-progress generation. `useChatRuntime` (`@assistant-ui/ai-sdk`) requires `withFormat` so messages round-trip as AI SDK `UIMessage` objects; an adapter without it throws at runtime in that path. `ExternalStoreRuntime` does not use a history adapter at all, since you already own the message array; persist through your own store instead.

```ts
const runtime = useLocalRuntime(chatModelAdapter, { adapters: { history: myHistoryAdapter } });
```

## Related

- [local-runtime.md](./local-runtime.md) -- the runtime these adapters mount on
- [external-store.md](./external-store.md) -- the same adapters on `ExternalStoreRuntime`, minus `history`
- [voice.md](./voice.md) -- realtime duplex voice via `adapters.voice`
