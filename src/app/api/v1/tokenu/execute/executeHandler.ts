import { NextResponse } from "next/server";

import type { JsonValue } from "@/tokenu/contracts/json";
import type { TenantExecutionOrchestrationResult } from "@/tokenu/contracts/tenantExecutionOrchestrationResult";
import { OpenAIChatExecutionRequestFactory } from "@/tokenu/runtime/openAIChatExecutionRequestFactory";
import type { PublicExecutionResolver } from "@/tokenu/runtime/publicExecutionResolver";
import type {
  TenantExecutionOrchestrator,
  TenantExecutionOrchestratorInput,
} from "@/tokenu/runtime/tenantExecutionOrchestrator";

interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface TokenUExecuteHandlerDependencies {
  readonly publicExecutionResolver: Pick<PublicExecutionResolver, "resolve">;

  readonly tenantExecutionOrchestrator: Pick<TenantExecutionOrchestrator, "execute">;

  readonly generateRequestId: () => string;

  /**
   * Authoritative server-side UTC TokenU usage period.
   */
  readonly currentPeriod: () => string;
}

const FORBIDDEN_PUBLIC_FIELDS = new Set([
  "workspaceId",
  "workspace_id",
  "providerId",
  "upstreamModelId",
  "connectionId",
  "credentialMode",
  "technicalProfileId",
  "adapterId",
  "endpointProfileId",
  "serviceRegion",
  "endpoint",
  "endpointUrl",
  "url",
  "apiKey",
  "credential",
  "credentials",
  "authorization",
  "Authorization",
  "headers",
  "monthlyRequestLimit",
  "requestId",
  "attemptId",
  "attempts",
  "executionPlan",
]);

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId?: string
): NextResponse {
  const headers = new Headers({
    "Cache-Control": "no-store",
  });

  if (requestId) {
    headers.set("X-Request-Id", requestId);
  }

  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers,
    }
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function successResponse(output: JsonValue, requestId: string): NextResponse {
  return NextResponse.json(output, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

function mapExecutedFailure(
  result: Extract<TenantExecutionOrchestrationResult, { readonly status: "executed" }>,
  requestId: string
): Response {
  const execution = result.execution;

  if (execution.status === "dispatch-failed") {
    return errorResponse(
      503,
      execution.error.code,
      "TokenU execution route is temporarily unavailable",
      requestId
    );
  }

  const attempt = execution.result;

  if (attempt.status === "succeeded") {
    if (attempt.output === null) {
      return errorResponse(
        502,
        "empty_upstream_response",
        "TokenU received an empty upstream response",
        requestId
      );
    }

    return successResponse(attempt.output, requestId);
  }

  const error = attempt.error;

  if (error.category === "invalid-request" || error.category === "unsupported") {
    return errorResponse(400, error.code ?? "invalid_execution_request", error.message, requestId);
  }

  if (error.category === "timeout") {
    return errorResponse(504, error.code ?? "upstream_timeout", error.message, requestId);
  }

  return errorResponse(502, error.code ?? "upstream_execution_failed", error.message, requestId);
}

function mapOrchestrationResult(
  result: TenantExecutionOrchestrationResult,
  requestId: string
): Response {
  switch (result.status) {
    case "plan-unavailable":
      return errorResponse(
        403,
        "workspace_plan_unavailable",
        "TokenU execution is not available for this workspace",
        requestId
      );

    case "quota-denied":
      return errorResponse(
        429,
        "workspace_quota_exceeded",
        result.quota.reason ?? "Workspace quota exceeded",
        requestId
      );

    case "admission-denied":
      return errorResponse(
        429,
        "monthly_request_quota_exceeded",
        result.admission.reason,
        requestId
      );

    case "executed":
      return mapExecutedFailure(result, requestId);
  }
}

/**
 * Public TokenU OpenAI Chat execution boundary.
 *
 * Security properties:
 * - workspace identity is supplied only by authenticated server code
 * - request identity is created only by the server
 * - provider/connection/adapter/endpoint identities are not public inputs
 * - public model selection is resolved through PublicExecutionResolver
 * - unknown models fail before commercial request admission
 * - streaming is intentionally unsupported in P6G
 */
export async function handleTokenUExecute(
  request: Request,
  workspaceId: string,
  dependencies: TokenUExecuteHandlerDependencies
): Promise<Response> {
  if (!workspaceId.trim()) {
    throw new Error("TokenU execute handler requires workspace identity");
  }

  const url = new URL(request.url);

  const unsupportedQueryParameter = [...url.searchParams.keys()][0];

  if (unsupportedQueryParameter) {
    return errorResponse(
      400,
      "unsupported_query_parameter",
      `Unsupported query parameter: ${unsupportedQueryParameter}`
    );
  }

  const mediaType = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    return errorResponse(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must contain valid JSON");
  }

  if (!isJsonObject(body)) {
    return errorResponse(400, "invalid_request_body", "Request body must be a JSON object");
  }

  const forbiddenField = Object.keys(body).find((field) => FORBIDDEN_PUBLIC_FIELDS.has(field));

  if (forbiddenField) {
    return errorResponse(
      400,
      "internal_field_not_allowed",
      `Field "${forbiddenField}" is not allowed in the public TokenU execution API`
    );
  }

  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return errorResponse(400, "invalid_model", "model must be a non-empty string");
  }

  if (!Array.isArray(body.messages)) {
    return errorResponse(400, "invalid_messages", "messages must be an array");
  }

  if (body.stream === true) {
    return errorResponse(
      400,
      "streaming_not_supported",
      "TokenU P6G execution supports non-streaming requests only"
    );
  }

  if (Object.prototype.hasOwnProperty.call(body, "stream") && body.stream !== false) {
    return errorResponse(400, "invalid_stream", "stream must be false when provided");
  }

  const requestId = dependencies.generateRequestId();

  if (!requestId.trim()) {
    throw new Error("TokenU execute handler requires generated request identity");
  }

  const executionPlan = dependencies.publicExecutionResolver.resolve({
    requestId,
    publicModelId: body.model,
  });

  if (!executionPlan) {
    return errorResponse(
      404,
      "model_not_available",
      "The requested TokenU model is not available",
      requestId
    );
  }

  const period = dependencies.currentPeriod();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error("TokenU execute handler requires YYYY-MM execution period");
  }

  const requestFactory = new OpenAIChatExecutionRequestFactory({
    payload: body,
  });

  const orchestrationInput: TenantExecutionOrchestratorInput = {
    workspaceId,
    period,
    executionPlan,
    requestFactory,
  };

  const result = await dependencies.tenantExecutionOrchestrator.execute(orchestrationInput);

  return mapOrchestrationResult(result, requestId);
}
