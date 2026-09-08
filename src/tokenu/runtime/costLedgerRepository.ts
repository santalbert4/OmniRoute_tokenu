import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";

export interface CostLedgerRepository {
  append(entry: CostLedgerEntry): Promise<void>;

  list(workspaceId: string): Promise<readonly CostLedgerEntry[]>;

  totalCost(workspaceId: string): Promise<number>;
}
