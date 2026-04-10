import { createAIProvider } from "./ai/index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";

const ai = createAIProvider();
const app = createApp(ai);

const server = app.listen(config.port, async () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`AI provider: ${ai.providerName}`);

  try {
    const ping = await ai.summarizeWorld({ worldName: "Genesis", tick: 0 });
    console.log(`AI check: ${ping}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI startup error";
    console.warn(`AI check failed: ${message}`);
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Stop the previous Genesis server or change SERVER_PORT.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
