import { createAIProvider } from "./ai/index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";

const ai = createAIProvider();
const app = createApp(ai);

app.listen(config.port, async () => {
  const ping = await ai.summarizeWorld({ worldName: "Genesis", tick: 0 });
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`AI provider: ${ai.providerName}`);
  console.log(`AI check: ${ping}`);
});
