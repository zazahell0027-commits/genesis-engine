export type AIProvider = {
  summarizeWorld(input: { worldName: string; tick: number }): Promise<string>;
};
