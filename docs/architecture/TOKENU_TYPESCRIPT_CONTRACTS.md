# TokenU TypeScript Contracts

## Phase 2.3 — TypeScript Contract Freeze

**Status:** Freeze candidate — pending final repository validation and commit.

This document records the concrete TypeScript contracts implementing the TokenU/Core responsibility boundary defined in TOKENU_CORE_EXTRACTION_ARCHITECTURE.md.

The purpose of Phase 2.3 is to freeze the interfaces that future TokenU orchestration, translation and single-target execution code must obey. It does not implement provider execution.

---

## 1. Contract namespace

All TokenU-owned contracts live under `src/tokenu/contracts/`.

They are intentionally isolated from OmniRoute application and routing types.

The contract layer must not depend on:

- `open-sse`
- OmniRoute routing/domain state
- mutable provider globals
- `providerSpecificData`
- raw provider credentials
- arbitrary client authorization headers
- arbitrary upstream base URLs

The TokenU contract layer is validated independently with TypeScript `strict: true`.

---

## 2. Execution authority

The execution boundary is:

`TokenU Policy Gate -> TokenScore / ranking -> ExecutionPlan -> TokenU Plan Runner -> SingleTargetAdapter -> approved technical executor -> upstream provider`

The TokenU Plan Runner owns candidate ordering, all retry decisions, cross-provider fallback, creation of every `attemptId` and cross-attempt accounting.

Each `SingleTargetAdapter` invocation performs exactly one upstream attempt.

The adapter must not retry, select another provider/model, execute TokenScore, re-evaluate commercial policy, discover another target or accept arbitrary upstream endpoints.

This preserves the accounting invariant: `client_requests = 1` and `upstream_attempts = N`.

---

## 3. CoreExecutionRequest

`CoreExecutionRequest` represents exactly one already-resolved upstream attempt.

It carries `requestId`, unique `attemptId`, resolved `ExecutionTarget`, optional tenant-scoped `continuityScope`, normalized payload, explicit `requestProtocol`, explicit `clientResponseProtocol`, stream mode, timeout policy and already-resolved translation/continuity policies.

The request protocol must never be inferred from provider or model identity.

It must not contain provider credentials, raw authorization headers, `providerSpecificData`, arbitrary base URLs, TokenScore state, fallback orchestration or retry policy.

---

## 4. ExecutionTarget

`ExecutionTarget` is the immutable resolved execution snapshot for one attempt.

It identifies the exact provider, model offering, upstream model, provider connection, approved credential mode, technical profile, adapter, endpoint profile and service region.

Some fields intentionally duplicate mutable catalog information so an in-flight attempt does not need to re-read the catalog after planning. The Plan Runner must validate snapshot consistency when constructing the target.

---

## 5. Provider and model separation

TokenU separates `CanonicalModel`, `ModelOffering`, `TechnicalModelProfile` and `ExecutionTarget`.

A `ModelOffering` is one provider-specific way to execute a model. Commercial approval is an eligibility veto, never a TokenScore weight.

Credential modes are `TOKENU_MANAGED`, `HOSTED_BYOK`, `CUSTOMER_SIDE_BYOK`, `OAUTH_DELEGATED` and `NOT_ALLOWED`. `NOT_ALLOWED` may exist in policy matrices but cannot appear in an approved `ExecutionTarget`.

Required technical capabilities fail closed when support is `unknown`.

---

## 6. Reasoning invariants

`TechnicalReasoningProfile` is the single technical source of truth for reasoning support.

When support is `unsupported` or `unknown`, transport must be `none` and `supportedEfforts` must be empty.

When support is `supported`, transport must be `native`, `textual-tags` or `opaque-state`.

Resolved reasoning policy is discriminated: disabled reasoning requires `transport = none`, null effort/budget, no preservation and no textual-tag parsing. Textual-tag parsing is only valid with the `textual-tags` transport.

Raw model reasoning is not automatically client-visible.

---

## 7. OpenAI Responses state and continuity

`ResolvedResponsesStatePolicy` prevents invalid continuation state.

When `upstreamStore = false`, `preservePreviousResponseId` must be false.

TokenU only preserves upstream continuation identity when upstream state persistence has been explicitly approved.

The conservative default is false/false.

Continuity constraints may be `portable`, `provider-affine` or `connection-affine`.

Cross-provider fallback may only be allowed when every resolved continuity constraint is portable. A stricter policy may still prohibit fallback.

Provider-affine and connection-affine state must never be silently discarded to force fallback.

---

## 8. Tenant-scoped continuity identity

Approved protocol continuity uses an explicit tenant-scoped identity:

`organizationId` + `scopeId`.

This identity travels from `CoreExecutionRequest` into `TranslationExecutionScope`.

State stores must preserve the organization boundary when persisting previous-response continuity, thought signatures, opaque reasoning state, tool identity or reasoning replay state.

Adapters must not recover tenant identity from mutable global state.

---

## 9. Translation contracts

Request translation returns translated payload plus explicit `RequestToolMetadata`.

Tool metadata must not be hidden inside payload markers such as `_toolNameMap`.

Response translation creates a fresh protocol-specific state object for every translation stage and every upstream attempt.

The response lifecycle is explicit through `createState`, `translateResponseChunk` and `flushResponse`.

`null` must not be used as an implicit flush or error signal.

---

## 10. Translator registry

The translator registry resolves only explicitly approved protocol directions.

Missing directions return `null`.

The registry must not infer translators, silently substitute protocols or create hidden hub fallbacks.

Direct-versus-hub translation path selection belongs to the translation pipeline.

---

## 11. Translation outcomes

Response translation produces explicit outcomes only:

- output
- no-output
- upstream-error

An upstream error carries both normalized execution error information and retryability classification.

There is no hidden parser state error channel.

---

## 12. Terminal execution result

`CoreExecutionResult` represents exactly one terminal result for one `attemptId`.

A successful result requires:

`status = succeeded`, `error = null`, `retryability = not-retryable`, `interruption = none`.

A non-success result requires a normalized error.

Impossible combinations are rejected by the discriminated TypeScript union.

Cross-attempt aggregation and billing remain outside this contract.

---

## 13. AttemptAccumulator

`AttemptAccumulator` belongs to exactly one upstream attempt.

It may accumulate translated content, reasoning content, normalized usage, timing and lifecycle state.

Protocol parser state must not live inside the accumulator.

Lifecycle transitions must avoid impossible combinations between status, completion timing, error and retryability.

---

## 14. Usage and billing separation

`NormalizedUsage` contains technical accounting dimensions only:

- input tokens
- output tokens
- reasoning tokens
- cache-read tokens
- cache-write tokens
- total tokens

Unknown values remain `null` and must not silently become zero.

TokenU separates:

`raw_provider_usage` -> `normalized_usage` -> `billable_usage` -> `billing_amount`.

Pricing and monetary calculation belong to the TokenU Billing Engine.

---

## 15. Phase 2.3 freeze checklist

Before marking the contracts frozen, the following checks must pass:

- TokenU contracts TypeScript strict compile
- Prettier check
- git diff --check
- contract dependency audit
- final architecture diff review
- repository status review

After approval, the contracts and architecture amendment should be committed together as the Phase 2.3 contract baseline.
