import type { GameState } from "@genesis/shared";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

let db: DatabaseSync | null = null;

function ensureDatabase(): DatabaseSync {
  if (db) return db;

  const directory = path.dirname(config.dbPath);
  fs.mkdirSync(directory, { recursive: true });
  db = new DatabaseSync(config.dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      presetId TEXT NOT NULL,
      stateJson TEXT NOT NULL,
      tokenBalance REAL NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallets (
      userId TEXT PRIMARY KEY,
      balance REAL NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);

  return db;
}

export function initializeDatabase(): void {
  ensureDatabase();
}

export function loadPersistedGames(): GameState[] {
  const database = ensureDatabase();
  const rows = database
    .prepare("SELECT stateJson FROM games ORDER BY updatedAt DESC")
    .all() as Array<{ stateJson: string }>;

  const loaded: GameState[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.stateJson) as GameState;
      loaded.push(parsed);
    } catch {
      continue;
    }
  }

  return loaded;
}

export function upsertGameState(game: GameState): void {
  const database = ensureDatabase();
  const now = Date.now();
  database
    .prepare(`
      INSERT INTO games (id, presetId, stateJson, tokenBalance, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        presetId=excluded.presetId,
        stateJson=excluded.stateJson,
        tokenBalance=excluded.tokenBalance,
        updatedAt=excluded.updatedAt
    `)
    .run(game.id, game.presetId, JSON.stringify(game), game.tokenBalance, now, now);
}

export function deletePersistedGame(gameId: string): boolean {
  const database = ensureDatabase();
  const result = database.prepare("DELETE FROM games WHERE id = ?").run(gameId);
  return Number(result.changes ?? 0) > 0;
}

export function getWalletBalance(userId: string): number | null {
  const database = ensureDatabase();
  const row = database.prepare("SELECT balance FROM wallets WHERE userId = ?").get(userId) as { balance: number } | undefined;
  return row?.balance ?? null;
}

export function setWalletBalance(userId: string, balance: number): number {
  const database = ensureDatabase();
  const safeBalance = Number(Math.max(0, balance).toFixed(3));
  const now = Date.now();
  database
    .prepare(`
      INSERT INTO wallets (userId, balance, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        balance=excluded.balance,
        updatedAt=excluded.updatedAt
    `)
    .run(userId, safeBalance, now);
  return safeBalance;
}

export function addWalletBalance(userId: string, delta: number): number {
  const current = getWalletBalance(userId) ?? 0;
  return setWalletBalance(userId, current + delta);
}
