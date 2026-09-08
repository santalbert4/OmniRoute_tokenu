import type { ExecutionTarget } from "@/tokenu/contracts/executionTarget";
import type { TechnicalModelProfile } from "@/tokenu/contracts/model";
import type { SingleTargetAdapter } from "@/tokenu/contracts/singleTargetAdapter";
import type { EndpointProfile } from "@/tokenu/runtime/endpointProfileRegistry";
import type { ResolvedCredential } from "@/tokenu/runtime/secretResolver";

export interface SingleTargetAdapterBinding {
  readonly target: ExecutionTarget;
  readonly endpoint: EndpointProfile;
  readonly credential: ResolvedCredential;
  readonly technicalModelProfile: TechnicalModelProfile;
}

/** Expected fail-closed rejection reasons during adapter binding. */
export type SingleTargetAdapterBindingErrorCode =
  | "target-not-supported"
  | "endpoint-not-supported"
  | "credential-not-supported"
  | "technical-profile-not-supported"
  | "invalid-binding";

export interface SingleTargetAdapterBindingError {
  readonly code: SingleTargetAdapterBindingErrorCode;
  readonly message: string;
}

export type SingleTargetAdapterBindingResult =
  | {
      readonly ok: true;
      readonly adapter: SingleTargetAdapter;
    }
  | {
      readonly ok: false;
      readonly error: SingleTargetAdapterBindingError;
    };

/**
 * Creates an ephemeral adapter already bound to trusted runtime dependencies.
 *
 * Binding happens before attemptId creation. Missing adapters, endpoints,
 * credentials or technical profiles are pre-dispatch failures and must not create CoreExecutionResult.
 */
export interface SingleTargetAdapterFactory {
  readonly id: string;
  bind(binding: SingleTargetAdapterBinding): SingleTargetAdapterBindingResult;
}

/** Fail-closed registry for approved TokenU adapter factories. */
export interface TokenUAdapterFactoryRegistry {
  resolve(adapterId: string): SingleTargetAdapterFactory | null;
}
