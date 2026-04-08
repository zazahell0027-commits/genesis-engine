import cors from "cors";
import express from "express";
import type { AIProvider } from "./ai/types.js";
import { registerRoutes } from "./routes.js";

export function createApp(ai: AIProvider): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  registerRoutes(app, ai);

  return app;
}
