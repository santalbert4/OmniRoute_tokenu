# TokenU PoC Baseline

## Purpose

This document records the validated TokenU proof-of-concept baseline before
commercial product development begins.

It distinguishes the reproducible source-code baseline from runtime
configuration, provider credentials, database state, and deployment-specific
settings.

## Baseline

- Date validated: 2026-09-06
- OmniRoute version: 3.8.51
- OmniRoute upstream commit:
  `910f58c5cc664cccef25d79dc73d2230c474990d`
- TokenU Core branch:
  `tokenu/core-v3.8.51`
- TokenU Core baseline commit:
  `16f2a4b5ee323202b69795921552d785f1a08d0e`
- Baseline tag:
  `tokenu-poc-baseline-2026-09-06`

## Source-code delta from OmniRoute

The TokenU baseline contains one intentional source-code change:

- Production build uses webpack through `OMNIROUTE_USE_TURBOPACK=0`.
- The build command explicitly allows an 8192 MB Node heap.

This was introduced for the Hostinger deployment environment.

The upstream OmniRoute build wrapper itself also supports webpack fallback and
build-memory configuration. This TokenU-specific change should therefore be
reviewed later and potentially moved out of the generic package script into
deployment-specific configuration.

## Validated capabilities

The following capabilities were manually validated end-to-end:

- Public OpenAI-compatible `/v1` API endpoint
- TokenU client API-key authentication
- Official Groq API connection
- Official Google AI Studio / Gemini API connection
- Groq `openai/gpt-oss-20b` successful completion
- Gemini `gemini-3.7-flash` successful completion
- OmniRoute automatic routing
- Custom priority combo routing
- Controlled cross-provider fallback
- Groq primary -> Gemini fallback
- Provider/model request logs
- Token accounting
- Usage and cost telemetry
- Combo identification in request logs

## Controlled routing tests

### Priority combo

Combo:

`tokenu-test`

Order:

1. Groq / GPT-OSS 20B
2. Gemini / Gemini 3.7 Flash

Result:

- Groq selected as primary
- HTTP 200
- No fallback required

### Cross-provider fallback combo

Combo:

`tokenu-fallback-test`

Order:

1. Groq / Llama 3.3 70B
2. Gemini / Gemini 3.7 Flash

Observed result:

1. Groq target returned an upstream 404.
2. OmniRoute automatically continued to the next target.
3. Gemini 3.7 Flash returned HTTP 200.
4. The client received one successful response without changing endpoint,
   credentials, or application code.

This validates the core TokenU product hypothesis that routing and provider
failover can be abstracted behind a single client API.

## Known issues and product gaps

The following issues were observed during the PoC and must not be exposed
unchanged as TokenU commercial behaviour:

- OmniRoute's built-in model catalogue may contain stale or unsupported models.
- Unrestricted automatic routing can attempt providers or models that TokenU
  has not explicitly approved.
- Some keyless/web-based providers are unsuitable for dependable commercial use.
- The internal Combo "Test now" UI did not reproduce the behaviour of the real
  public API and produced misleading errors.
- Provider responses may expose `reasoning_content`.
- Client requests and internal upstream attempts must be counted separately.
- Provider pricing, quotas, model availability, privacy terms, and commercial
  usage conditions require independent validation.
- Free-tier capacity must not be marketed as guaranteed capacity.

## Build validation

Checks completed successfully:

- `check:native-deps`
- `check:build-scope`
- repository pre-commit quality checks
- documentation-version synchronization
- tracked-artifact checks
- explicit-any budget checks
- `git diff --check`

A full Next.js production build could not be completed in the current
GitHub Codespace.

The Codespace provides approximately:

- 7.8 GiB RAM
- 2 vCPUs
- no swap

OmniRoute's own build documentation reports that the webpack build can require
approximately 11 GiB peak memory with `webpackBuildWorker` enabled.

Therefore the Codespace build termination is recorded as an environment
resource limitation, not as evidence of a TokenU source-code failure.

The deployed PoC itself was independently validated through real API requests.

## Runtime state not contained in this Git baseline

The Git tag does NOT include:

- provider API secrets
- TokenU client API-key secrets
- Hostinger environment variables
- OmniRoute database contents
- provider credential-store contents
- runtime usage history
- runtime request logs
- manually-created combo configuration
- server-specific deployment state

These must be documented and made reproducible separately.

No secrets should ever be committed to this repository.

## Architectural direction

TokenU should not become a cosmetic rebrand of OmniRoute.

Target architecture:

Client
-> TokenU Gateway
-> TokenU policy / accounting / approved-provider layer
-> private OmniRoute Core
-> approved AI providers

OmniRoute should remain a replaceable internal routing engine.

The commercial TokenU layer should own:

- customer authentication
- organizations and projects
- TokenU API keys
- plans and billing
- client-request accounting
- provider approval policy
- TokenScore
- budgets
- privacy and commercial-use policy
- customer-facing analytics
- response normalization
- product UX

## Next phase

Before commercial feature development:

1. Audit OmniRoute licensing and notices.
2. Generate third-party dependency and license inventory.
3. Review bundled/native/embedded components.
4. Define TokenU provider approval policy.
5. Separate TokenU commercial platform from OmniRoute Core.
6. Define the upstream synchronization strategy.
