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
}

export function getTokenUSqliteDatabase(): TokenUSqliteDatabase {
  return getDbInstance() as unknown as TokenUSqliteDatabase;
}
