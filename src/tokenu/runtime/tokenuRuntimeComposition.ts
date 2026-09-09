import { SqliteCostLedgerRepository } from "@/tokenu/adapters/storage/sqliteCostLedgerRepository";
import { SqliteProviderPricingRepository } from "@/tokenu/adapters/storage/sqliteProviderPricingRepository";
import { SqliteProviderUsageRepository } from "@/tokenu/adapters/storage/sqliteProviderUsageRepository";
import { SqliteUsageProjectionRepository } from "@/tokenu/adapters/storage/sqliteUsageProjectionRepository";
import { SqliteWorkspacePlanAssignmentRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePlanAssignmentRepository";
import { SqliteWorkspacePlanRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePlanRepository";
import { SqliteWorkspacePrincipalRepository } from "@/tokenu/adapters/storage/sqliteWorkspacePrincipalRepository";
import { SqliteWorkspaceRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceRepository";
import { SqliteWorkspaceRequestUsageRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceRequestUsageRepository";
import { SqliteWorkspaceUsageMeteringRepository } from "@/tokenu/adapters/storage/sqliteWorkspaceUsageMeteringRepository";
import {
  getTokenUSqliteDatabase,
  type TokenUSqliteDatabase,
} from "@/tokenu/adapters/storage/tokenuSqliteDatabase";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";
import { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import { ProviderUsageMeteringService } from "@/tokenu/runtime/providerUsageMeteringService";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";
import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { RequestAdmissionService } from "@/tokenu/runtime/requestAdmissionService";
import { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";
import { TenantExecutionPreflightService } from "@/tokenu/runtime/tenantExecutionPreflightService";
import { TenantExecutionEventSinkFactory } from "@/tokenu/runtime/tenantExecutionEventSinkFactory";
import type { UsageProjectionRepository } from "@/tokenu/runtime/usageProjectionRepository";
import { UsageProjectionService } from "@/tokenu/runtime/usageProjectionService";
import type { WorkspacePlanAssignmentRepository } from "@/tokenu/runtime/workspacePlanAssignmentRepository";
import type { WorkspacePlanRepository } from "@/tokenu/runtime/workspacePlanRepository";
import { WorkspacePlanResolverService } from "@/tokenu/runtime/workspacePlanResolverService";
import type { WorkspacePrincipalRepository } from "@/tokenu/runtime/workspacePrincipalRepository";
import { WorkspaceQuotaGateService } from "@/tokenu/runtime/workspaceQuotaGateService";
import type { WorkspaceRepository } from "@/tokenu/runtime/workspaceRepository";
import type { WorkspaceRequestUsageRepository } from "@/tokenu/runtime/workspaceRequestUsageRepository";
import { WorkspaceSpendAggregatorService } from "@/tokenu/runtime/workspaceSpendAggregatorService";
import { WorkspaceUsageMeteringService } from "@/tokenu/runtime/workspaceUsageMeteringService";
import type { WorkspaceUsageMeteringRepository } from "@/tokenu/runtime/workspaceUsageMeteringRepository";
import { WorkspaceUsageQueryService } from "@/tokenu/runtime/workspaceUsageQueryService";

export interface TokenURuntimeComposition {
  readonly database: TokenUSqliteDatabase;

  readonly workspaceRepository: WorkspaceRepository;

  readonly workspacePrincipalRepository: WorkspacePrincipalRepository;

  readonly workspacePlanRepository: WorkspacePlanRepository;

  readonly workspacePlanAssignmentRepository: WorkspacePlanAssignmentRepository;

  readonly workspaceRequestUsageRepository: WorkspaceRequestUsageRepository;

  readonly workspaceUsageMeteringRepository: WorkspaceUsageMeteringRepository;

  readonly providerUsageRepository: ProviderUsageRepository;

  readonly costLedgerRepository: CostLedgerRepository;

  readonly providerPricingRepository: ProviderPricingRepository;

  readonly executionCostCalculator: ExecutionCostCalculator;

  readonly costLedgerService: CostLedgerService;

  readonly usageProjectionRepository: UsageProjectionRepository;

  readonly usageProjectionService: UsageProjectionService;

  readonly tenantExecutionEventSinkFactory: TenantExecutionEventSinkFactory;

  readonly workspacePlanResolverService: WorkspacePlanResolverService;

  readonly workspaceSpendAggregatorService: WorkspaceSpendAggregatorService;

  readonly costQuotaEnforcementService: QuotaEnforcementService;

  readonly requestQuotaEnforcementService: RequestQuotaEnforcementService;

  readonly requestAdmissionService: RequestAdmissionService;

  readonly workspaceQuotaGateService: WorkspaceQuotaGateService;

  readonly tenantExecutionPreflightService: TenantExecutionPreflightService;

  readonly workspaceUsageMeteringService: WorkspaceUsageMeteringService;

  readonly providerUsageMeteringService: ProviderUsageMeteringService;

  readonly providerUsageAggregationService: ProviderUsageAggregationService;

  readonly workspaceUsageQueryService: WorkspaceUsageQueryService;
}

export function createTokenURuntimeComposition(
  database: TokenUSqliteDatabase = getTokenUSqliteDatabase()
): TokenURuntimeComposition {
  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const workspacePrincipalRepository = new SqliteWorkspacePrincipalRepository(database);

  const workspacePlanRepository = new SqliteWorkspacePlanRepository(database);

  const workspacePlanAssignmentRepository = new SqliteWorkspacePlanAssignmentRepository(database);

  const workspaceRequestUsageRepository = new SqliteWorkspaceRequestUsageRepository(database);

  const workspaceUsageMeteringRepository = new SqliteWorkspaceUsageMeteringRepository(database);

  const providerUsageRepository = new SqliteProviderUsageRepository(database);

  const costLedgerRepository = new SqliteCostLedgerRepository(database);

  const providerPricingRepository = new SqliteProviderPricingRepository(database);

  const executionCostCalculator = new ExecutionCostCalculator(providerPricingRepository);

  const costLedgerService = new CostLedgerService(executionCostCalculator, costLedgerRepository);

  const usageProjectionRepository = new SqliteUsageProjectionRepository(database);

  const usageProjectionService = new UsageProjectionService(
    executionCostCalculator,
    usageProjectionRepository
  );

  const tenantExecutionEventSinkFactory = new TenantExecutionEventSinkFactory(
    costLedgerService,
    usageProjectionService
  );

  const workspacePlanResolverService = new WorkspacePlanResolverService(
    workspacePlanAssignmentRepository,
    workspacePlanRepository
  );

  const workspaceSpendAggregatorService = new WorkspaceSpendAggregatorService(costLedgerRepository);

  const costQuotaEnforcementService = new QuotaEnforcementService(workspaceSpendAggregatorService);

  const requestQuotaEnforcementService = new RequestQuotaEnforcementService(
    workspaceRequestUsageRepository
  );

  const requestAdmissionService = new RequestAdmissionService(workspaceRequestUsageRepository);

  const workspaceQuotaGateService = new WorkspaceQuotaGateService(
    costQuotaEnforcementService,
    requestQuotaEnforcementService
  );

  const tenantExecutionPreflightService = new TenantExecutionPreflightService(
    workspacePlanResolverService,
    workspaceQuotaGateService
  );

  const workspaceUsageMeteringService = new WorkspaceUsageMeteringService(
    workspaceUsageMeteringRepository
  );

  const providerUsageMeteringService = new ProviderUsageMeteringService(providerUsageRepository);

  const providerUsageAggregationService = new ProviderUsageAggregationService(
    providerUsageRepository
  );

  const workspaceUsageQueryService = new WorkspaceUsageQueryService(
    workspacePlanResolverService,
    workspaceRequestUsageRepository,
    workspaceUsageMeteringRepository,
    workspaceSpendAggregatorService,
    providerUsageAggregationService
  );

  return {
    database,
    workspaceRepository,
    workspacePrincipalRepository,
    workspacePlanRepository,
    workspacePlanAssignmentRepository,
    workspaceRequestUsageRepository,
    workspaceUsageMeteringRepository,
    providerUsageRepository,
    costLedgerRepository,
    providerPricingRepository,
    executionCostCalculator,
    costLedgerService,
    usageProjectionRepository,
    usageProjectionService,
    tenantExecutionEventSinkFactory,
    workspacePlanResolverService,
    workspaceSpendAggregatorService,
    costQuotaEnforcementService,
    requestQuotaEnforcementService,
    requestAdmissionService,
    workspaceQuotaGateService,
    tenantExecutionPreflightService,
    workspaceUsageMeteringService,
    providerUsageMeteringService,
    providerUsageAggregationService,
    workspaceUsageQueryService,
  };
}

let runtimeComposition: TokenURuntimeComposition | null = null;

export function getTokenURuntimeComposition(): TokenURuntimeComposition {
  if (!runtimeComposition) {
    runtimeComposition = createTokenURuntimeComposition();
  }

  return runtimeComposition;
}
