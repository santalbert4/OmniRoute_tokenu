import type { CostLedgerEntry } from "@/tokenu/contracts/costLedgerEntry";
import type { CostLedgerPeriodTotal } from "@/tokenu/contracts/costLedgerPeriodTotal";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";

function sameEntry(left: CostLedgerEntry, right: CostLedgerEntry): boolean {
  return (
    left.workspaceId === right.workspaceId &&
    left.requestId === right.requestId &&
    left.attemptId === right.attemptId &&
    left.providerId === right.providerId &&
    left.modelId === right.modelId &&
    left.currency === right.currency &&
    left.inputTokens === right.inputTokens &&
    left.outputTokens === right.outputTokens &&
    left.totalTokens === right.totalTokens &&
    left.cost === right.cost &&
    left.createdAt === right.createdAt
  );
}

export class InMemoryCostLedgerRepository implements CostLedgerRepository {
  private readonly entries: CostLedgerEntry[] = [];

  async append(entry: CostLedgerEntry): Promise<boolean> {
    const existing = this.entries.find(
      (candidate) =>
        candidate.workspaceId === entry.workspaceId && candidate.attemptId === entry.attemptId
    );

    if (!existing) {
      this.entries.push(entry);

      return true;
    }

    if (!sameEntry(existing, entry)) {
      throw new Error("TokenU cost ledger attempt already exists with different data");
    }

    return false;
  }

  async list(workspaceId: string): Promise<readonly CostLedgerEntry[]> {
    return this.entries.filter((entry) => entry.workspaceId === workspaceId);
  }

  async totalCost(workspaceId: string): Promise<number> {
    return (await this.list(workspaceId)).reduce((total, entry) => total + entry.cost, 0);
  }

  async periodTotals(
    workspaceId: string,
    period: string
  ): Promise<readonly CostLedgerPeriodTotal[]> {
    const totals = new Map<
      string,
      {
        executionCount: number;
        totalCost: number;
      }
    >();

    for (const entry of this.entries) {
      if (entry.workspaceId !== workspaceId || entry.createdAt.slice(0, 7) !== period) {
        continue;
      }

      const current = totals.get(entry.currency) ?? {
        executionCount: 0,
        totalCost: 0,
      };

      totals.set(entry.currency, {
        executionCount: current.executionCount + 1,
        totalCost: current.totalCost + entry.cost,
      });
    }

    return [...totals.entries()]
      .map(([currency, total]) => ({
        currency,
        executionCount: total.executionCount,
        totalCost: Number(total.totalCost.toFixed(6)),
      }))
      .sort((left, right) => left.currency.localeCompare(right.currency));
  }
}
