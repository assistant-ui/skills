# AI SDK v6 Provider Changes

Provider-specific changes in AI SDK v6.

---

## Required Package Versions

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/react": "^3.0.0",
  "@ai-sdk/provider": "^3.0.0",
  "@ai-sdk/provider-utils": "^4.0.0"
}
```

All provider packages should be updated to `^3.0.0`:

```json
{
  "@ai-sdk/openai": "^3.0.0",
  "@ai-sdk/anthropic": "^3.0.0",
  "@ai-sdk/google": "^3.0.0",
  "@ai-sdk/mistral": "^3.0.0"
}
```

---

## OpenAI

- `strictJsonSchema` now defaults to `true` (was `false`)

Disable if needed:

```typescript
const result = await generateText({
  model: openai("gpt-4o"),
  providerOptions: {
    openai: { strictJsonSchema: false },
  },
});
```

---

## Azure OpenAI

- Default behavior switches to Responses API
- Use `azure.chat()` for previous Chat Completions API behavior
- Metadata key changed: `openai` → `azure`

```diff
// For Responses API (new default)
const model = azure("gpt-4o");

// For Chat Completions API (previous behavior)
const model = azure.chat("gpt-4o");

// Metadata access
- result.experimental_providerMetadata?.openai
+ result.experimental_providerMetadata?.azure

// Provider options
- providerOptions: { openai: { ... } }
+ providerOptions: { azure: { ... } }
```

---

## Anthropic

New `structuredOutputMode` option for Claude Sonnet 4.5+:

```typescript
const result = await generateText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  output: Output.object({ schema }),
  providerOptions: {
    anthropic: {
      // Options: 'outputFormat', 'jsonTool', or 'auto' (default)
      structuredOutputMode: "outputFormat",
    },
  },
});
```

---

## Google Vertex

Metadata and options key changed:

```diff
- providerOptions: { google: { safetySettings: [...] } }
+ providerOptions: { vertex: { safetySettings: [...] } }

- result.experimental_providerMetadata?.google
+ result.experimental_providerMetadata?.vertex
```

---

## Embedding Methods Renamed

Provider embedding methods were renamed:

```diff
- const model = openai.textEmbedding("text-embedding-3-small");
+ const model = openai.embedding("text-embedding-3-small");

// Alternative (also renamed):
- const model = openai.textEmbeddingModel("text-embedding-3-small");
+ const model = openai.embeddingModel("text-embedding-3-small");
```

**Note:** Core `embed()` and `embedMany()` functions from "ai" package remain unchanged.

---

## MCP Package Moved

MCP imports moved from `ai` to `@ai-sdk/mcp`:

```diff
- import { experimental_createMCPClient } from "ai";
- import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
+ import { experimental_createMCPClient } from "@ai-sdk/mcp";
+ import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
```

Install: `pnpm add @ai-sdk/mcp`

---

## Zod Support

AI SDK v6 supports both Zod 3.25+ and Zod 4.x:

```json
{
  "zod": "^3.25.76 || ^4.1.8"
}
```

---

## Test Utilities

V2 mock classes removed, migrate to V3:

```diff
- import { MockLanguageModelV2 } from "ai/test";
+ import { MockLanguageModelV3 } from "ai/test";

- import { MockEmbeddingModelV2 } from "ai/test";
+ import { MockEmbeddingModelV3 } from "ai/test";

- import { MockProviderV2 } from "ai/test";
+ import { MockProviderV3 } from "ai/test";
```

---

## Warning Type Unification

```diff
- import type { GenerateTextWarning, StreamTextWarning, CallWarning } from "ai";
+ import type { Warning } from "ai";
```

---

## Finish Reason Change

```diff
- if (result.finishReason === "unknown") { }
+ if (result.finishReason === "other") { }
```

---

## Token Usage Property Changes

```diff
// Cached input tokens
- result.usage.cachedInputTokens
+ result.usage.inputTokenDetails.cacheReadTokens

// Reasoning tokens
- result.usage.reasoningTokens
+ result.usage.outputTokenDetails.reasoningTokens
```

---

## Rerank Score Property Renamed

```diff
- result.relevanceScore
+ result.score
```

---

## Disable Warning Logging

```bash
export AI_SDK_LOG_WARNINGS=false
```
