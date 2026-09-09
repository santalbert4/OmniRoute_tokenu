import { getDbInstance } from "@/lib/db/core";

export interface TokenUSqliteStatement {
  get(...params: unknown[]): unknown;

  all?(...params: unknown[]): readonly unknown[];

  run(...params: unknown[]): {
    readonly changes?: number;
  };
}

export interface TokenUSqliteDatabase {
  prepare(sql: string): TokenUSqliteStatement;

  /**
   * Executes one synchronous SQLite transaction.
   *
   * This mirrors the canonical OmniRoute SqliteAdapter contract while keeping
   * TokenU isolated from the concrete SQLite driver.
   */
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
}

export function getTokenUSqliteDatabase(): TokenUSqliteDatabase {
  return getDbInstance() as unknown as TokenUSqliteDatabase;
}
