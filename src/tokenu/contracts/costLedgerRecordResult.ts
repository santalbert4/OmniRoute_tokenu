export interface CostLedgerRecordResult {
  readonly recorded: boolean;

  readonly cost: number;

  readonly entryId: string;
}
