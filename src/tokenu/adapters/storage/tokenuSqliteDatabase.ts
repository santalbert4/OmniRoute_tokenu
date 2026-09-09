import { getDbInstance } from "@/lib/db/core";

export interface TokenUSqliteStatement {
  get(...params: unknown[]): unknown;

  run(...params: unknown[]): {
    readonly changes?: number;
  };
}

export interface TokenUSqliteDatabase {
  prepare(sql: string): TokenUSqliteStatement;
}

export function getTokenUSqliteDatabase(): TokenUSqliteDatabase {
  return getDbInstance() as unknown as TokenUSqliteDatabase;
}
