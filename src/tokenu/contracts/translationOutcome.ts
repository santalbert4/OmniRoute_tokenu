import type { NormalizedExecutionError, Retryability } from "@/tokenu/contracts/executionError";
import type { JsonValue } from "@/tokenu/contracts/json";

/**
 * Explicit result of translating one response chunk or flushing one
 * response-translation stage.
 *
 * A null chunk or mutable parser field must never be used as a hidden
 * error or flush signal.
 */
export type TranslationOutcome =
  | {
      readonly kind: "output";

      /**
       * One translation operation may emit multiple protocol items/events.
       */
      readonly items: readonly JsonValue[];
    }
  | {
      readonly kind: "no-output";
    }
  | {
      readonly kind: "upstream-error";
      readonly error: NormalizedExecutionError;
      readonly retryability: Retryability;
    };
