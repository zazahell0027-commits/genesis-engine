import fs from "node:fs";
import path from "node:path";

const testDataDir = path.resolve(process.cwd(), ".tmp-test");
const testDbPath = path.join(testDataDir, "genesis.test.sqlite");

process.env.SERVER_DB_PATH = testDbPath;
process.env.AI_PROVIDER = "mock";
process.env.AI_ENABLED = "true";
process.env.LOCAL_USER_ID = "test-player";

fs.rmSync(testDataDir, { recursive: true, force: true });
fs.mkdirSync(testDataDir, { recursive: true });
