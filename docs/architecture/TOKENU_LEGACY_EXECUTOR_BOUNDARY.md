# TokenU Legacy Executor Boundary

## Phase 2.7 — Legacy OmniRoute Executor Boundary

**Status:** Frozen boundary before adapter integration.

This document defines which responsibilities from the current OmniRoute executor runtime may be reused by TokenU and which must remain outside the SingleTargetAdapter boundary.

The existing BaseExecutor is an implementation source, not the TokenU execution contract.

---

# 1. Governing invariant

One SingleTargetAdapter.execute() invocation corresponds to exactly one attemptId and exactly one upstream execution attempt. An execution attempt may terminate before network dispatch, but it must perform at most one provider network dispatch.

The adapter must never perform a second upstream request as a retry, fallback, downgrade replay or alternate-endpoint attempt.

Retry and fallback authority belongs exclusively to the TokenU Plan Runner.

---

# 2. Current BaseExecutor coupling

The audited open-sse/executors/base.ts currently combines:

- provider request construction
- endpoint resolution
- credential handling and refresh
- key rotation
- protocol/provider transforms
- upstream network dispatch
- alternate URL fallback
- same-URL retries
- reactive payload downgrade and replay
- provider capability learning
- rate/quota related runtime state
- error handling

Therefore BaseExecutor.execute() must not be used directly as the primitive behind the final TokenU SingleTargetAdapter.

---

# 3. Responsibility mapping

| Legacy responsibility                 | TokenU owner                                 | Decision                      |
| ------------------------------------- | -------------------------------------------- | ----------------------------- |
| build provider request URL/path       | Endpoint Profile + adapter                   | adapt                         |
| build provider-specific headers       | adapter                                      | adapt                         |
| transform provider request payload    | translator/adapter                           | adapt                         |
| one HTTP upstream dispatch            | adapter transport                            | reuse concept                 |
| parse provider technical errors       | adapter/error normalization                  | adapt                         |
| getFallbackCount / baseUrls iteration | Plan Runner                                  | remove from adapter           |
| shouldRetry / intra-URL retries       | Plan Runner                                  | remove from adapter           |
| 400 downgrade-and-replay              | Plan Runner + capability intelligence        | remove replay from adapter    |
| thinking-budget retry                 | Plan Runner + technical profile intelligence | remove replay from adapter    |
| reasoning-effort retry                | Plan Runner + technical profile intelligence | remove replay from adapter    |
| credential refresh                    | Secret/Credential runtime                    | remove from adapter authority |
| extra API-key rotation                | Credential runtime                           | remove from adapter authority |
| providerSpecificData.baseUrl          | Endpoint Profile Registry                    | eliminate                     |
| alternate protocol inference          | explicit TokenU protocol pipeline            | eliminate inference           |
| dynamic capability learning           | Provider Intelligence                        | separate                      |

---

# 4. Endpoint boundary

ExecutionTarget.endpointProfileId is the only endpoint reference crossing the TokenU execution contract.

The runtime resolves it through an approved fail-closed EndpointProfileRegistry.

Clients must not provide or override upstream base URLs, paths or alternate endpoints.

The legacy providerSpecificData.baseUrl mechanism must not cross into TokenU contracts.

---

# 5. Credential boundary

ExecutionTarget.connectionId is a reference, not credential material.

Credentials are resolved just in time through the trusted SecretResolver.

CoreExecutionRequest must never contain API keys, access tokens, refresh tokens or providerSpecificData.

Credential refresh and persistence are runtime responsibilities outside the TokenU contract layer.

---

# 6. Retry and fallback boundary

The following legacy behaviors are explicitly forbidden inside a TokenU SingleTargetAdapter:

- looping over baseUrls
- selecting another endpoint after failure
- retrying HTTP 429 internally
- retrying WAF failures internally
- retrying after stripping unsupported fields
- retrying after changing thinking_budget
- retrying after changing reasoning_effort
- silently replaying a modified payload

An adapter may classify the failure and return technical information, but any subsequent upstream attempt requires a new attemptId owned by the Plan Runner.

---

# 7. Translation boundary

Request and response protocol translation uses the TokenU ProtocolTranslatorRegistry.

Protocols are explicit. They must not be inferred from provider identity, model names, credentials, User-Agent values or mutable global state.

Request-derived tool metadata travels separately from provider payloads.

---

# 8. Phase 2.7 implementation rule

The first TokenU provider integration must introduce a genuine single-attempt seam rather than wrapping BaseExecutor.execute() unchanged.

Legacy helper methods may be reused only when they do not introduce routing, retry, fallback, credential-selection or arbitrary-endpoint authority.

The integration must remain behind SingleTargetAdapter and preserve the frozen TokenU contracts.
