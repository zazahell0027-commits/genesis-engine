import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.SERVER_PORT ?? 4000),
  aiEnabled: process.env.AI_ENABLED === "true",
  aiProvider: process.env.AI_PROVIDER ?? "mock"
};
