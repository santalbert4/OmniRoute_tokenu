import type { TokenUExecutionPlan } from "@/tokenu/contracts/executionPlan";
import type { TenantExecutionOrchestrationResult } from "@/tokenu/contracts/tenantExecutionOrchestrationResult";
import type { ExecutionPlanRequestFactory } from "@/tokenu/runtime/executionPlanRunner";
import type { ExecutionPlanRunnerFactory } from "@/tokenu/runtime/executionPlanRunnerFactory";
import type { RequestAdmissionService } from "@/tokenu/runtime/requestAdmissionService";
import type { TenantExecutionEventSinkFactory } from "@/tokenu/runtime/tenantExecutionEventSinkFactory";
import type { TenantExecutionPreflightService } from "@/tokenu/runtime/tenantExecutionPreflightService";

export interface TenantExecutionOrchestratorInput {
  /**
   * Trusted TokenU SaaS workspace identity.
   *
   * This is not an upstream provider workspace/account identifier.
   */
  readonly workspaceId: string;

  /**
   * Authoritative TokenU usage period, currently YYYY-MM.
   */
  readonly period: string;

  /**
   * Already resolved immutable technical execution plan.
   */
  readonly executionPlan: TokenUExecutionPlan;

  /**
   * Builds each exact CoreExecutionRequest from runner-owned attempt context.
   */
  readonly requestFactory: ExecutionPlanRequestFactory;
}

type PreflightPort = Pick<TenantExecutionPreflightService, "evaluate">;

type AdmissionPort = Pick<RequestAdmissionService, "admit">;

type EventSinkFactoryPort = Pick<TenantExecutionEventSinkFactory, "create">;

/**
 * Trusted SaaS execution orchestration boundary.
 *
 * Ordering is intentional:
 *
 * 1. read-only tenant preflight
 * 2. authoritative atomic request admission
 * 3. tenant-aware event pipeline
 * 4. technical execution runner
 *
 * The commercial request limit comes exclusively from the workspace plan
 * resolved during preflight. Public callers cannot provide or override it.
 *
 * Critical execution/event/billing failures are not converted into successful
 * orchestration results; they propagate to the caller.
 */
export class TenantExecutionOrchestrator {
  constructor(
    private readonly preflightService: PreflightPort,
    private readonly requestAdmissionService: AdmissionPort,
    private readonly eventSinkFactory: EventSinkFactoryPort,
    private readonly runnerFactory: ExecutionPlanRunnerFactory
  ) {}

  async execute(
    input: TenantExecutionOrchestratorInput
  ): Promise<TenantExecutionOrchestrationResult> {
    const preflight = await this.preflightService.evaluate(input.workspaceId, input.period);

    if (preflight.status === "plan-unavailable") {
      return preflight;
    }

    if (preflight.status === "quota-denied") {
      return preflight;
    }

    const admission = await this.requestAdmissionService.admit(
      input.workspaceId,
      input.period,
      preflight.plan.monthlyRequestLimit
    );

    if (!admission.admitted) {
      return {
        status: "admission-denied",
        plan: preflight.plan,
        admission,
      };
    }

    const eventSink = this.eventSinkFactory.create(input.workspaceId);

    const runner = this.runnerFactory.create({
      eventSink,
    });

    const execution = await runner.execute(input.executionPlan, input.requestFactory);

    return {
      status: "executed",
      plan: preflight.plan,
      admission,
      execution,
    };
  }
}
