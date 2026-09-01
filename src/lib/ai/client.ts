// Backwards-compatible shim. The real implementation now lives in provider.ts,
// which supports Gemini (free), Anthropic, and OpenAI-compatible endpoints.
export {
  aiConfigured,
  activeProvider,
  generateText,
  generateVisionText,
  extractJson,
  AiNotConfiguredError,
  AiNotConfiguredError as MissingApiKeyError,
} from "./provider";
