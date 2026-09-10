import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import Database from "better-sqlite3";

import type { TokenUSqliteDatabase } from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import { SqliteHumanSessionRepository } from "@/tokenu/adapters/storage/sqliteHumanSessionRepository";
import type { TokenUHumanSession } from "@/tokenu/contracts/humanSession";
import { hashHumanSessionSecret } from "@/tokenu/runtime/humanSessionMaterial";

const MIGRATION = fs.readFileSync("src/lib/db/migrations/184_tokenu_human_sessions.sql", "utf8");

function createDatabase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE tokenu_users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(MIGRATION);

  return db;
}

function session(overrides: Partial<TokenUHumanSession> = {}): TokenUHumanSession {
  return {
    id: "session-a",
    userId: "user-a",
    secretHash: hashHumanSessionSecret("S".repeat(43)),
    createdAt: "2026-09-10T12:00:00.000Z",
    expiresAt: "2026-09-11T12:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

test("SQLite human session repository creates and resolves exact session", async () => {
  const db = createDatabase();

  try {
    db.prepare("INSERT INTO tokenu_users (id, created_at) VALUES (?, ?)").run(
      "user-a",
      "2026-09-10T00:00:00.000Z"
    );

    const repository = new SqliteHumanSessionRepository(db as unknown as TokenUSqliteDatabase);

    const value = session();

    await repository.create(value);

    assert.deepEqual(await repository.get("session-a"), value);
    assert.equal(await repository.get("unknown"), null);
    assert.equal(await repository.get(""), null);
  } finally {
    db.close();
  }
});

test("SQLite human session repository stores no raw bearer secret", async () => {
  const db = createDatabase();

  try {
    db.prepare("INSERT INTO tokenu_users (id, created_at) VALUES (?, ?)").run(
      "user-a",
      "2026-09-10T00:00:00.000Z"
    );

    const repository = new SqliteHumanSessionRepository(db as unknown as TokenUSqliteDatabase);

    await repository.create(session());

    const raw = db
      .prepare("SELECT secret_hash FROM tokenu_human_sessions WHERE id = ?")
      .get("session-a") as { secret_hash: string };

    assert.equal(raw.secret_hash.includes("S".repeat(43)), false);
    assert.equal(raw.secret_hash.length, 64);
  } finally {
    db.close();
  }
});

test("SQLite human session revocation is monotonic and idempotent", async () => {
  const db = createDatabase();

  try {
    db.prepare("INSERT INTO tokenu_users (id, created_at) VALUES (?, ?)").run(
      "user-a",
      "2026-09-10T00:00:00.000Z"
    );

    const repository = new SqliteHumanSessionRepository(db as unknown as TokenUSqliteDatabase);

    await repository.create(session());

    assert.equal(await repository.revoke("session-a", "2026-09-10T13:00:00.000Z"), true);

    assert.equal(await repository.revoke("session-a", "2026-09-10T14:00:00.000Z"), true);

    assert.equal((await repository.get("session-a"))?.revokedAt, "2026-09-10T13:00:00.000Z");

    assert.equal(await repository.revoke("missing", "2026-09-10T13:00:00.000Z"), false);
  } finally {
    db.close();
  }
});
