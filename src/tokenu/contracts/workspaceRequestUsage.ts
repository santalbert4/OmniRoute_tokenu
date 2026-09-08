export interface WorkspaceRequestUsage {
  readonly workspaceId: string;

  readonly requestCount: number;

  readonly period: string;
}
