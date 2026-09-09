import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";
import type { CostLedgerPeriodTotal } from "@/tokenu/contracts/costLedgerPeriodTotal";

export interface CostLedgerRepository {
  append(entry: CostLedgerEntry): Promise<boolean>;

  list(workspaceId: string): Promise<readonly CostLedgerEntry[]>;

  totalCost(workspaceId: string): Promise<number>;

  periodTotals(workspaceId: string, period: string): Promise<readonly CostLedgerPeriodTotal[]>;
}
