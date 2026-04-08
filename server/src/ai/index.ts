import { config } from "../config.js";
import type { AIProvider } from "./types.js";
import { MockProvider } from "./providers/mockProvider.js";

export function createAIProvider(): AIProvider {
  if (!config.aiEnabled) {
    return new MockProvider();
  }

  if (config.aiProvider === "mock") {
    return new MockProvider();
  }

  return new MockProvider();
}
