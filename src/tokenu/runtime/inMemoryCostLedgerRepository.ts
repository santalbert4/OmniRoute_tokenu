import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";

export class InMemoryCostLedgerRepository implements CostLedgerRepository {
  private readonly entries: CostLedgerEntry[] = [];

  async append(entry: CostLedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  async list(workspaceId: string): Promise<readonly CostLedgerEntry[]> {
    return this.entries.filter((entry) => entry.workspaceId === workspaceId);
  }

  async totalCost(workspaceId: string): Promise<number> {
    return (await this.list(workspaceId)).reduce((total, entry) => total + entry.cost, 0);
  }
}
