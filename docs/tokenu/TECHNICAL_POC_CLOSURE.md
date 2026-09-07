# TokenU Technical PoC Closure

**Scope:** OmniRoute core PoC used as the validated routing-engine baseline for TokenU
**Closure date:** 2026-09-07
**Branch:** `tokenu/core-v3.8.51`
**Validated baseline tag:** `tokenu-poc-baseline-2026-09-06`

## 1. Closure purpose

This document closes the TokenU technical PoC phase for the OmniRoute-derived routing core.

The purpose of the PoC was not to produce the final commercial TokenU platform. It was to determine whether the selected core can provide a technically useful routing abstraction, run reliably enough in the current Hostinger environment, and expose the operational and security constraints that must be addressed before commercialization.

## 2. Validated functional capabilities

The PoC validated the following capabilities:

- public OpenAI-compatible API access through `tokenu.pro/v1`;
- client API-key protection through OmniRoute API Manager;
- official Groq provider connectivity;
- official Gemini provider connectivity;
- direct provider/model calls;
- automatic routing;
- custom model combos;
- deterministic priority routing;
- cross-provider fallback after an upstream failure;
- request, provider, model, latency and token observability;
- provider credential persistence in SQLite;
- field-level encryption of provider credentials when `STORAGE_ENCRYPTION_KEY` is available;
- recovery-oriented runtime and database inspection.

Validated PoC examples included:

- Groq `openai/gpt-oss-20b`;
- Gemini `gemini-3.7-flash`;
- a priority combo routing Groq first and Gemini second;
- a fallback combo where a failing Groq model was followed successfully by Gemini.

## 3. Repository baseline

At closure:

- branch: `tokenu/core-v3.8.51`;
- local HEAD and `origin/tokenu/core-v3.8.51` are synchronized;
- the immutable PoC baseline tag remains at commit `16f2a4b5ee323202b69795921552d785f1a08d0e`;
- the current branch includes the PoC baseline, runtime recovery baseline and runtime configuration baseline documentation.

The baseline tag must not be moved.

## 4. Runtime and recovery baseline

The production PoC runtime has been inspected without committing or printing secret values.

Validated items include:

- active Hostinger/LiteSpeed Node runtime;
- SQLite database location and WAL journal mode;
- successful SQLite integrity check;
- consistent SQLite backup created with `.backup`;
- off-server backup integrity verified by SHA-256;
- encrypted backup of active runtime secrets created and verified;
- active provider credentials stored in `enc:v1` encrypted form;
- runtime-vs-database secret drift documented;
- effective runtime variable presence/absence documented;
- recovery-critical dependency on the matching `STORAGE_ENCRYPTION_KEY` documented.

A complete end-to-end disaster-recovery restore has not yet been executed.

## 5. Security findings carried forward

The PoC is suitable as a controlled technical baseline, not as the final TokenU commercial security model.

The following items must be addressed before commercial production:

1. `STORAGE_ENCRYPTION_KEY` must be mandatory in production.
2. Encryption failure must fail closed instead of falling back to plaintext.
3. Production startup must fail if encrypted data exists but the matching storage key is unavailable.
4. Client-facing TokenU API keys must use high-entropy random credentials and hash-only server-side storage.
5. The current OmniRoute customer-facing key format must not become the TokenU commercial key format.
6. `REQUIRE_API_KEY` must be explicitly enabled and tested for every public TokenU API surface.
7. Secrets must be managed by an explicit deployment or secret-management layer.
8. `DATA_DIR` should be explicit in production.
9. Secret rotation and full restore procedures must be documented and tested.

## 6. Product and accounting findings carried forward

The following are not blockers for the technical PoC, but they are required for the commercial TokenU platform:

- separate one client request from multiple upstream retry/fallback attempts in accounting;
- suppress raw model reasoning fields from ordinary client responses;
- maintain a controlled provider/model registry instead of routing blindly across every available connector;
- classify providers as Production Approved, Experimental or Blocked;
- keep OmniRoute behind a replaceable internal routing abstraction;
- normalize responses, errors, usage and provider telemetry at the TokenU gateway layer.

## 7. Provider and model findings

The PoC demonstrated that technical connectivity is not equivalent to commercial approval.

Observed examples:

- official Groq and Gemini APIs worked;
- a built-in Gemini model identifier was stale and returned 404;
- some no-auth or browser-style connectors were unreliable or unsuitable for a commercial routing service;
- automatic routing can select unavailable, unconfigured or commercially inappropriate targets unless TokenU applies its own policy layer.

Provider inclusion in TokenU must therefore be policy-controlled and reviewed separately for API legitimacy, commercial terms, privacy, pricing, quota and current model availability.

## 8. Architecture boundary

The PoC confirms the intended architectural split:

`Client -> TokenU Gateway/Platform -> private routing abstraction -> OmniRoute Core -> approved providers`

The future TokenU Gateway/Platform owns:

- tenants and authentication;
- plans and billing;
- customer API keys;
- budgets and quotas;
- provider policy;
- TokenScore;
- privacy controls;
- accounting;
- response normalization;
- commercial observability.

OmniRoute remains an internal, replaceable routing engine rather than the TokenU product itself.

## 9. Technical PoC closure decision

**Decision: TECHNICAL PoC CLOSED — VALIDATED WITH COMMERCIAL HARDENING REQUIRED.**

The PoC has demonstrated enough functionality, routing resilience, observability and recovery characteristics to justify continuing the TokenU project.

No further deep technical investigation of this PoC baseline is required before beginning the next review phase.

This closure is not a legal, licensing, provider-ToS or commercial-production approval.

## 10. Next phase

The next phase is the legal and dependency review:

1. OmniRoute license verification;
2. dependency and SBOM inventory;
3. incompatible or restrictive license review;
4. vendored code and embedded service review;
5. provider API and commercial-terms matrix;
6. final classification: GO, GO WITH EXCLUSIONS, or NO-GO.

Only after that review should the project move into the clean commercial TokenU architecture and repository.
