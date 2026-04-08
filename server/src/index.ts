import { createApp } from "./app.js";
import { config } from "./config.js";
import { createAIProvider } from "./ai/index.js";

const app = createApp();
const ai = createAIProvider();

app.listen(config.port, async () => {
  const ping = await ai.summarizeWorld({ worldName: "Genesis", tick: 0 });
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`AI provider ready: ${ping}`);
});
