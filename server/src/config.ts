import dotenv from "dotenv";

dotenv.config();

function readEnv(key: string): string | undefined {
  return process.env[key] ?? process.env[`﻿${key}`];
}

export const config = {
  port: Number(readEnv("SERVER_PORT") ?? 4000),
  aiEnabled: readEnv("AI_ENABLED") === "true",
  aiProvider: readEnv("AI_PROVIDER") ?? "mock",
  ollamaBaseUrl: readEnv("OLLAMA_BASE_URL") ?? "http://localhost:11434",
  ollamaChatModel: readEnv("OLLAMA_CHAT_MODEL") ?? "qwen3:8b",
  ollamaTimeoutMs: Number(readEnv("OLLAMA_TIMEOUT_MS") ?? 12000)
};
