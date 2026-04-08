import type { AIProvider } from "../types.js";

export class MockProvider implements AIProvider {
  async summarizeWorld(input: { worldName: string; tick: number }): Promise<string> {
    return `Mock summary: ${input.worldName} at tick ${input.tick}.`;
  }
}
