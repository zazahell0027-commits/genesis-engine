import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

function readEnv(key: string): string | undefined {
  return process.env[key] ?? process.env[`﻿${key}`];
}

export const config = {
  port: Number(readEnv("SERVER_PORT") ?? 4000),
  dbPath: readEnv("SERVER_DB_PATH") ?? path.resolve(process.cwd(), ".data", "genesis.sqlite"),
  localUserId: readEnv("LOCAL_USER_ID") ?? "local-player",
  aiEnabled: readEnv("AI_ENABLED") !== "false",
  aiProvider: readEnv("AI_PROVIDER") ?? "ollama",
  ollamaBaseUrl: readEnv("OLLAMA_BASE_URL") ?? "http://localhost:11434",
  ollamaChatModel: readEnv("OLLAMA_CHAT_MODEL") ?? "mistral:latest",
  ollamaTimeoutMs: Number(readEnv("OLLAMA_TIMEOUT_MS") ?? 45000)
};
