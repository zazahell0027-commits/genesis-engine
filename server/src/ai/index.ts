import { config } from "../config.js";
import type { AIProvider } from "./types.js";
import { MockProvider } from "./providers/mockProvider.js";
import { OllamaProvider } from "./providers/ollamaProvider.js";

export function createAIProvider(): AIProvider {
  const fallback = new MockProvider();

  if (!config.aiEnabled) {
    return fallback;
  }

  if (config.aiProvider === "ollama") {
    return new OllamaProvider(
      config.ollamaBaseUrl,
      config.ollamaChatModel,
      config.ollamaTimeoutMs,
      fallback
    );
  }

  return fallback;
}
