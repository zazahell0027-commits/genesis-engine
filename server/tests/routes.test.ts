import request from "supertest";
import { createApp } from "../src/app.js";
import { MockProvider } from "../src/ai/providers/mockProvider.js";
import { hydrateWorldStore } from "../src/world.js";

describe("API routes", () => {
  const app = createApp(new MockProvider());

  beforeAll(() => {
    hydrateWorldStore();
  });

  test("GET /health returns service metadata", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.service).toBe("genesis-engine-server");
  });

  test("advisor returns actionable suggestions", async () => {
    const created = await request(app)
      .post("/api/games")
      .send({
        presetId: "world-war-ii",
        countryId: "germany",
        difficulty: "Standard",
        aiQuality: "Balanced"
      })
      .expect(201);

    const advisor = await request(app)
      .post("/game/advisor")
      .send({ gameId: created.body.id })
      .expect(200);

    expect(typeof advisor.body.narrative).toBe("string");
    expect(Array.isArray(advisor.body.insights)).toBe(true);
    expect(Array.isArray(advisor.body.suggestions)).toBe(true);
    expect(advisor.body.suggestions.length).toBeGreaterThan(0);
    expect(typeof advisor.body.suggestions[0].orderText).toBe("string");
  });

  test("token endpoints earn and spend balance", async () => {
    const wallet = await request(app).get("/api/tokens").expect(200);
    const startBalance = Number(wallet.body.balance);

    const earned = await request(app)
      .post("/api/tokens/earn")
      .send({ amount: 0.5 })
      .expect(200);
    expect(Number(earned.body.balance)).toBeCloseTo(startBalance + 0.5, 3);

    const spent = await request(app)
      .post("/api/tokens/spend")
      .send({ amount: 0.2 })
      .expect(200);
    expect(Number(spent.body.balance)).toBeCloseTo(startBalance + 0.3, 3);
  });
});
