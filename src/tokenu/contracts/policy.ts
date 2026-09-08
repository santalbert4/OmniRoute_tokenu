/**
 * Fully resolved OpenAI Responses continuation policy for one execution.
 *
 * Conservative defaults are expected to be false/false unless TokenU has
 * explicitly approved upstream state persistence for the selected offering.
 */
export type ResolvedResponsesStatePolicy =
  | {
      readonly upstreamStore: false;
      readonly preservePreviousResponseId: false;
    }
  | {
      readonly upstreamStore: true;
      readonly preservePreviousResponseId: boolean;
    };

/**
 * Fully resolved reasoning behavior for one execution.
 *
 * Translators consume this policy; they must not infer reasoning behavior
 * from provider names, model names, credentials or mutable global state.
 */
export type ResolvedReasoningPolicy =
  | {
      readonly enabled: false;
      readonly transport: "none";
      readonly effort: null;
      readonly budgetTokens: null;
      readonly preserveReasoningContent: false;
      readonly parseTextualReasoningTags: false;
    }
  | {
      readonly enabled: true;
      readonly transport: "textual-tags";
      readonly effort: string | null;
      readonly budgetTokens: number | null;
      readonly preserveReasoningContent: boolean;
      readonly parseTextualReasoningTags: true;
    }
  | {
      readonly enabled: true;
      readonly transport: "native" | "opaque-state";
      readonly effort: string | null;
      readonly budgetTokens: number | null;
      readonly preserveReasoningContent: boolean;
      readonly parseTextualReasoningTags: false;
    };

export type ContinuityAffinity = "portable" | "provider-affine" | "connection-affine";

export type ContinuityConstraintKind =
  | "previous-response"
  | "thought-signature"
  | "opaque-reasoning-state"
  | "tool-identity"
  | "reasoning-replay";

/**
 * Resolved continuity requirements that constrain fallback for one request.
 *
 * This contract describes portability requirements only. Raw provider state
 * and opaque reasoning data belong in scoped state stores, not in this object.
 */
export interface ResolvedContinuityConstraint {
  readonly kind: ContinuityConstraintKind;
  readonly affinity: ContinuityAffinity;
}

export interface PortableResolvedContinuityConstraint extends ResolvedContinuityConstraint {
  readonly affinity: "portable";
}

/**
 * Final continuity decision consumed by the TokenU Plan Runner.
 *
 * Cross-provider fallback may only be allowed when every resolved continuity
 * constraint is portable. A false decision may still be stricter than the
 * constraints themselves because other resolved policy may conservatively
 * prohibit fallback.
 */
export type ResolvedContinuityPolicy =
  | {
      readonly constraints: readonly PortableResolvedContinuityConstraint[];
      readonly crossProviderFallbackAllowed: true;
    }
  | {
      readonly constraints: readonly ResolvedContinuityConstraint[];
      readonly crossProviderFallbackAllowed: false;
    };

export type PromptCachingMechanism = "none" | "automatic-prefix" | "explicit-markers";

export type CacheMarkerAction = "preserve" | "synthesize" | "strip";

/**
 * Fully resolved prompt-cache behavior for one translation/execution.
 *
 * This policy is resolved before translation. Translators must not inspect
 * User-Agent, database settings, provider names, routing strategy,
 * providerSpecificData or connection overrides to decide cache behavior.
 *
 * The discriminated union prevents invalid combinations such as synthesizing
 * explicit markers for an automatic-prefix caching mechanism.
 */
export type ResolvedCachePolicy =
  | {
      readonly mechanism: "none";
      readonly markerAction: "strip";
      readonly synthesizedMarkerTtl: null;
    }
  | {
      readonly mechanism: "automatic-prefix";
      readonly markerAction: "strip";
      readonly synthesizedMarkerTtl: null;
    }
  | {
      readonly mechanism: "explicit-markers";
      readonly markerAction: "preserve";
      readonly synthesizedMarkerTtl: null;
    }
  | {
      readonly mechanism: "explicit-markers";
      readonly markerAction: "synthesize";
      readonly synthesizedMarkerTtl: "5m" | "1h";
    };
