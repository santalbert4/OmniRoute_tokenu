import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { JsonValue } from "@/tokenu/contracts/json";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";

export type GroqRequestPreparationResult =
  | {
      readonly ok: true;
      readonly payload: Record<string, JsonValue>;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Produces the exact provider-facing Groq/OpenAI Chat Completions body.
 *
 * This boundary is deliberately immutable:
 * - client model selection cannot override ExecutionTarget
 * - streaming cannot be enabled inside the payload
 * - TokenU/legacy metadata is not forwarded
 * - semantic capability downgrades fail closed
 */
export function prepareGroqRequest(input: {
  readonly payload: JsonValue;
  readonly target: ExecutionTarget;
  readonly technicalModelProfile: TechnicalModelProfile;
}): GroqRequestPreparationResult {
  if (!isJsonObject(input.payload)) {
    return {
      ok: false,
      code: "invalid-openai-payload",
      message: "Groq requires an OpenAI Chat Completions object payload.",
    };
  }

  const next: Record<string, JsonValue> = { ...input.payload };

  const forbiddenInternalFields = [
    "x-provider",
    "_claudeCodeRequiresLowercaseToolNames",
    "_nativeCodexPassthrough",
    "_nativeXaiResponsesPassthrough",
    "_nativeOpenAICompatibleResponsesPassthrough",
    "_omnirouteResponsesStore",
  ] as const;

  for (const field of forbiddenInternalFields) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      return {
        ok: false,
        code: "internal-field-not-allowed",
        message: `Internal field "${field}" must not cross the TokenU provider boundary.`,
      };
    }
  }

  if (!Array.isArray(next.messages)) {
    return {
      ok: false,
      code: "missing-messages",
      message: "Groq Chat Completions requires a messages array.",
    };
  }

  if (Object.prototype.hasOwnProperty.call(next, "n") && next.n !== 1) {
    return {
      ok: false,
      code: "unsupported-n",
      message: "Groq supports n=1 only.",
    };
  }

  for (const parameter of input.technicalModelProfile.unsupportedParameters) {
    if (Object.prototype.hasOwnProperty.call(next, parameter)) {
      return {
        ok: false,
        code: "unsupported-parameter",
        message: `The selected Groq model does not support parameter "${parameter}".`,
      };
    }
  }

  const sanitizedMessages: JsonValue[] = [];

  for (const message of next.messages) {
    if (!isJsonObject(message)) {
      return {
        ok: false,
        code: "invalid-message",
        message: "Every Groq chat message must be a JSON object.",
      };
    }

    if (Object.prototype.hasOwnProperty.call(message, "name")) {
      return {
        ok: false,
        code: "unsupported-message-name",
        message: "Groq does not support messages[].name.",
      };
    }

    for (const field of ["model", "messageId", "sender"] as const) {
      if (Object.prototype.hasOwnProperty.call(message, field)) {
        return {
          ok: false,
          code: "internal-message-field-not-allowed",
          message: `Message field "${field}" must not cross the TokenU provider boundary.`,
        };
      }
    }

    sanitizedMessages.push({ ...message });
  }

  next.messages = sanitizedMessages;

  const tools = next.tools;

  if (tools !== undefined && tools !== null) {
    if (!Array.isArray(tools)) {
      return {
        ok: false,
        code: "invalid-tools",
        message: "Groq tools must be an array of function tools.",
      };
    }

    for (const tool of tools) {
      if (!isJsonObject(tool) || tool.type !== "function") {
        return {
          ok: false,
          code: "unsupported-tool-type",
          message: "TokenU Groq production routes allow function tools only.",
        };
      }
    }

    const responseFormat = isJsonObject(next.response_format) ? next.response_format : null;

    if (tools.length > 0 && responseFormat?.type === "json_schema") {
      return {
        ok: false,
        code: "structured-output-with-tools-not-supported",
        message: "Groq Structured Outputs cannot be combined with tool use on this route.",
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, "stream_options")) {
    return {
      ok: false,
      code: "stream-options-require-streaming",
      message: "stream_options cannot be used by the non-streaming Groq adapter.",
    };
  }

  // ExecutionTarget and CoreExecutionRequest are authoritative.
  next.model = input.target.upstreamModelId;
  next.stream = false;

  return {
    ok: true,
    payload: next,
  };
}
