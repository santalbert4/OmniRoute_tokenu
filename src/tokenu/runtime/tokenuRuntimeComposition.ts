import { SqliteCostLedgerRepository } from "@/tokenu/adapters/storage/sqliteCostLedgerRepository";
import { SqliteTokenUApiKeyRepository } from "@/tokenu/adapters/storage/sqliteTokenUApiKeyRepository";
import type { RetryPolicy } from "@/tokenu/contracts/retryPolicy";
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
import type { TokenUAdapterFactoryRegistry } from "@/tokenu/runtime/adapterRegistry";
import type { CostLedgerRepository } from "@/tokenu/runtime/costLedgerRepository";
import { CostLedgerService } from "@/tokenu/runtime/costLedgerService";
import { DefaultAdapterFactoryRegistry } from "@/tokenu/runtime/defaultAdapterFactoryRegistry";
import { DefaultExecutionDependencyResolver } from "@/tokenu/runtime/defaultExecutionDependencyResolver";
import { DefaultExecutionDispatcher } from "@/tokenu/runtime/defaultExecutionDispatcher";
import { DefaultExecutionPlanRunnerFactory } from "@/tokenu/runtime/defaultExecutionPlanRunnerFactory";
import { DefaultRetryPolicy } from "@/tokenu/runtime/defaultRetryPolicy";
import { ExecutionCostCalculator } from "@/tokenu/runtime/executionCostCalculator";
import type { ExecutionDependencyResolver } from "@/tokenu/runtime/executionDependencyResolver";
import type { TokenUExecutionDispatcher } from "@/tokenu/runtime/executionDispatcher";
import type { ExecutionPlanRunnerFactory } from "@/tokenu/runtime/executionPlanRunnerFactory";
import type { EndpointProfileRegistry } from "@/tokenu/runtime/endpointProfileRegistry";
import type { ProviderPricingRepository } from "@/tokenu/runtime/providerPricingRepository";
import { NullSecretResolver } from "@/tokenu/runtime/nullSecretResolver";
import { ProviderUsageAggregationService } from "@/tokenu/runtime/providerUsageAggregationService";
import { ProviderUsageMeteringService } from "@/tokenu/runtime/providerUsageMeteringService";
import { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import type { PublicExecutionRouteRegistry } from "@/tokenu/runtime/publicExecutionRouteRegistry";
import type { ProviderUsageRepository } from "@/tokenu/runtime/providerUsageRepository";
import { QuotaEnforcementService } from "@/tokenu/runtime/quotaEnforcementService";
import { RequestAdmissionService } from "@/tokenu/runtime/requestAdmissionService";
import { RequestQuotaEnforcementService } from "@/tokenu/runtime/requestQuotaEnforcementService";
import type { SecretResolver } from "@/tokenu/runtime/secretResolver";
import { StaticEndpointProfileRegistry } from "@/tokenu/runtime/staticEndpointProfileRegistry";
import { StaticPublicExecutionRouteRegistry } from "@/tokenu/runtime/staticPublicExecutionRouteRegistry";
import { StaticTechnicalModelProfileRegistry } from "@/tokenu/runtime/staticTechnicalModelProfileRegistry";
import { TenantExecutionEventSinkFactory } from "@/tokenu/runtime/tenantExecutionEventSinkFactory";
import { TenantExecutionOrchestrator } from "@/tokenu/runtime/tenantExecutionOrchestrator";
import { TenantExecutionPreflightService } from "@/tokenu/runtime/tenantExecutionPreflightService";
import type { TechnicalModelProfileRegistry } from "@/tokenu/runtime/technicalModelProfileRegistry";
import type { TokenUApiKeyRepository } from "@/tokenu/runtime/tokenUApiKeyRepository";
import { TokenUApiKeyService } from "@/tokenu/runtime/tokenUApiKeyService";
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

export interface TokenURuntimeCompositionOptions {
  /**
   * Trusted credential boundary.
   *
   * Defaults to NullSecretResolver so TokenU never falls back to legacy or
   * environment credentials implicitly.
   */
  readonly secretResolver?: SecretResolver;

  /**
   * Reviewed technical execution registries.
   *
   * Defaults are empty and therefore fail closed until explicitly configured.
   */
  readonly endpointProfileRegistry?: EndpointProfileRegistry;
  readonly technicalModelProfileRegistry?: TechnicalModelProfileRegistry;

  /**
   * Reviewed mapping from public TokenU model ids to exact internal execution
   * routes. Defaults to an empty fail-closed registry.
   */
  readonly publicExecutionRouteRegistry?: PublicExecutionRouteRegistry;

  /**
   * Explicit adapter registry and retry policy overrides, primarily useful for
   * controlled runtime construction and tests.
   */
  readonly adapterFactoryRegistry?: TokenUAdapterFactoryRegistry;
  readonly retryPolicy?: RetryPolicy;
}

export interface TokenURuntimeComposition {
  readonly database: TokenUSqliteDatabase;

  readonly workspaceRepository: WorkspaceRepository;

  readonly workspacePrincipalRepository: WorkspacePrincipalRepository;

  readonly tokenUApiKeyRepository: TokenUApiKeyRepository;

  readonly tokenUApiKeyService: TokenUApiKeyService;

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

  readonly secretResolver: SecretResolver;

  readonly endpointProfileRegistry: EndpointProfileRegistry;

  readonly technicalModelProfileRegistry: TechnicalModelProfileRegistry;

  readonly publicExecutionRouteRegistry: PublicExecutionRouteRegistry;

  readonly publicExecutionResolver: PublicExecutionResolver;

  readonly adapterFactoryRegistry: TokenUAdapterFactoryRegistry;

  readonly executionDependencyResolver: ExecutionDependencyResolver;

  readonly executionDispatcher: TokenUExecutionDispatcher;

  readonly retryPolicy: RetryPolicy;

  readonly executionPlanRunnerFactory: ExecutionPlanRunnerFactory;

  readonly tenantExecutionOrchestrator: TenantExecutionOrchestrator;

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
  database: TokenUSqliteDatabase = getTokenUSqliteDatabase(),
  options: TokenURuntimeCompositionOptions = {}
): TokenURuntimeComposition {
  const workspaceRepository = new SqliteWorkspaceRepository(database);

  const workspacePrincipalRepository = new SqliteWorkspacePrincipalRepository(database);

  const tokenUApiKeyRepository = new SqliteTokenUApiKeyRepository(database);

  const tokenUApiKeyService = new TokenUApiKeyService(tokenUApiKeyRepository);

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

  const secretResolver = options.secretResolver ?? new NullSecretResolver();

  const endpointProfileRegistry =
    options.endpointProfileRegistry ?? new StaticEndpointProfileRegistry([]);

  const technicalModelProfileRegistry =
    options.technicalModelProfileRegistry ?? new StaticTechnicalModelProfileRegistry([]);

  const publicExecutionRouteRegistry =
    options.publicExecutionRouteRegistry ?? new StaticPublicExecutionRouteRegistry([]);

  const publicExecutionResolver = new PublicExecutionResolver(publicExecutionRouteRegistry);

  const adapterFactoryRegistry =
    options.adapterFactoryRegistry ?? new DefaultAdapterFactoryRegistry();

  const executionDependencyResolver = new DefaultExecutionDependencyResolver({
    endpointProfileRegistry,
    secretResolver,
    technicalModelProfileRegistry,
  });

  const executionDispatcher = new DefaultExecutionDispatcher({
    adapterRegistry: adapterFactoryRegistry,
    dependencyResolver: executionDependencyResolver,
  });

  const retryPolicy = options.retryPolicy ?? new DefaultRetryPolicy();

  const executionPlanRunnerFactory = new DefaultExecutionPlanRunnerFactory({
    dispatcher: executionDispatcher,
    retryPolicy,
  });

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

  const tenantExecutionOrchestrator = new TenantExecutionOrchestrator(
    tenantExecutionPreflightService,
    requestAdmissionService,
    tenantExecutionEventSinkFactory,
    executionPlanRunnerFactory
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
    tokenUApiKeyRepository,
    tokenUApiKeyService,
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
    secretResolver,
    endpointProfileRegistry,
    technicalModelProfileRegistry,
    publicExecutionRouteRegistry,
    publicExecutionResolver,
    adapterFactoryRegistry,
    executionDependencyResolver,
    executionDispatcher,
    retryPolicy,
    executionPlanRunnerFactory,
    tenantExecutionOrchestrator,
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
