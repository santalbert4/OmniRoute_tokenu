# TokenU Core Extraction Architecture

**Status:** Design Freeze — Phase 2.0–2.2
**Source baseline:** OmniRoute v3.8.51 / `tokenu/core-v3.8.51`
**Purpose:** Define the commercial TokenU/Core boundary before implementation or extraction work.

---

## 1. Objective

TokenU must not become a commercialized copy of OmniRoute.

OmniRoute is treated as a controlled technical source/core from which selected low-level capabilities may be extracted, refactored, wrapped, or replaced.

The target architecture is:

    Client
      ↓
    TokenU Platform / Gateway
      ↓
    Policy Gate
      ↓
    TokenScore
      ↓
    ExecutionPlan
      ↓
    TokenU Plan Runner
      ↓
    SingleTargetAdapter
      ↓
    Approved Protocol Translator
      ↓
    Approved Provider Executor
      ↓
    Approved Provider

OmniRoute must remain replaceable behind TokenU-owned contracts.

---

## 2. Ownership Boundary

### TokenU owns

- organizations, users and customer identity
- public API keys and authorization
- plans, subscriptions and billing
- provider and model commercial registry
- provider credential mode policy
- commercial, privacy and region eligibility
- model capability eligibility
- TokenScore
- model/provider selection
- cross-provider fallback
- ExecutionPlan construction
- client request and upstream attempt accounting
- pricing snapshots and billable usage
- commercial audit logs
- continuity/state policy
- public response normalization

### Core execution layer owns

- approved protocol translation
- approved provider wire formats
- low-level provider execution
- streaming transport mechanics
- explicitly approved provider technical quirks
- low-level timing and transport telemetry

### Core must not own

- TokenScore
- customer identity
- plans or billing
- commercial/privacy/region policy
- public API authorization
- cross-provider routing authority
- cross-provider fallback authority
- retry authority, including same-target retries

---

## 3. Accounting Invariant

TokenU must distinguish the client request from provider execution attempts.

    client_requests = 1
    upstream_attempts = N

Retries and fallback attempts must never silently become additional client requests.

---

## 4. Credential Boundary

Public and internal TokenU contracts must never carry raw provider secrets.

Credential modes are modeled explicitly:

    TOKENU_MANAGED
    HOSTED_BYOK
    CUSTOMER_SIDE_BYOK
    OAUTH_DELEGATED
    NOT_ALLOWED

Hosted BYOK must never be assumed to be allowed for a provider.

The execution flow is:

    ExecutionPlan
      ↓
    connectionId
      ↓
    trusted SingleTargetAdapter
      ↓
    TokenU secret vault
      ↓
    just-in-time secret resolution
      ↓
    provider request

Public/internal execution contracts must not contain API keys, access tokens, refresh tokens, cookies, providerSpecificData, or raw Authorization headers.

Secrets must fail closed if encryption or secret resolution fails.

---

## 5. Approved Provider Execution

The current OmniRoute executor registry must not be reused as commercial authority.

TokenU requires a fail-closed approved executor lookup.

The lookup must verify:

1. provider exists
2. provider status is Production Approved
3. executor kind is explicitly configured
4. endpoint/configuration exists
5. selected executor is in the commercial allowlist

Unknown providers must fail.

The current OmniRoute behavior where an unknown provider can fall back to OpenAI technical configuration must not exist in TokenU.

---

## 6. Provider Endpoint Security

For official provider integrations:

- endpoints are controlled by the TokenU Provider Registry
- HTTPS is mandatory
- official hostname allowlists are preferred
- client-controlled baseUrl is not supported in the MVP
- arbitrary upstream headers are not accepted
- redirect behavior must be explicitly approved
- DNS/IP egress protections must prevent private-network and metadata access
- outbound access should eventually be constrained by infrastructure/firewall allowlists

Provider endpoints are configuration, not customer input.

---

## 7. Provider and Model Registry

TokenU must own an Approved Provider/Model Registry separate from OmniRoute's global registry.

The conceptual split is:

    CanonicalModel
    ModelOffering
    TechnicalAdapter

### CanonicalModel

Represents the logical model identity.

### ModelOffering

Represents one provider-specific way to execute a model.

Typical fields include:

- providerId
- upstreamModelId
- credentialMode
- commercialStatus
- regionAvailability
- privacyProfile
- pricing
- latency
- reliability
- availability
- capabilities
- technicalModelProfile

### TechnicalAdapter

Represents protocol and executor implementation details.

Production authority must not use unrestricted passthrough model discovery.

Unknown or unreviewed models fail closed.

Capabilities must be explicit:

    supported
    unsupported
    unknown

A required capability with unknown status makes the offering ineligible.

---

## 8. TokenScore Boundary

TokenScore only ranks already eligible ModelOfferings.

The required order is:

    commercial policy
    privacy policy
    region policy
    provider policy
    model policy
    credential policy
    capability policy
          ↓
    ELIGIBLE ModelOfferings
          ↓
    TokenScore
          ↓
    ranked ExecutionPlan

Commercial, privacy, region and credential restrictions are vetoes.

They are not TokenScore weights.

---

## 9. Cross-Provider Fallback

TokenU Plan Runner owns cross-provider fallback.

OmniRoute combo strategies are not TokenU routing authority.

The target behavior is:

    ExecutionPlan
      ├─ candidate A
      ├─ candidate B
      └─ candidate C

    attempt A
      ↓ retryable failure
    attempt B
      ↓ retryable failure
    attempt C

Each upstream attempt receives:

- its exact ModelOffering
- its exact provider connection
- a fresh translation context
- fresh protocol response state
- independent timing
- independent usage and accounting

No parser state may be shared across upstream attempts.

---

## 10. Client Protocol vs Upstream Protocol

Client protocol support and upstream protocol support are separate concepts.

### MVP public client protocol

    OpenAI-compatible

### Approved upstream protocol candidates

    openai
    claude
    gemini
    openai-responses

OpenAI is used as an internal canonical interchange protocol.

This does not make TokenU dependent on OpenAI as a provider.

---

## 11. TokenU Protocol Vocabulary

The approved protocol vocabulary for the current design is:

    openai
    openai-responses
    claude
    gemini

Legacy/internal aliases such as openai-response must normalize to openai-responses.

The following protocols and integrations are excluded from the TokenU MVP runtime:

    antigravity
    clova
    kiro
    cursor
    ChatGPT Web
    Claude Web
    consumer-session routing
    Codex-specific compatibility layers

---

## 12. Approved Translation Matrix

### Required MVP request translations

    OpenAI → Claude
    Claude → OpenAI

    OpenAI → Gemini
    Gemini → OpenAI

    OpenAI → OpenAI Responses
    OpenAI Responses → OpenAI

### Required MVP response translations

    Claude → OpenAI
    Gemini → OpenAI

    OpenAI → OpenAI Responses
    OpenAI Responses → OpenAI

### Optional direct optimization

    Claude → Gemini request
    Gemini → Claude response

These direct paths are optional.

The OpenAI canonical hub remains the safe fallback when an approved direct path is not available.

### Not approved for extraction

The current OmniRoute OpenAI → Gemini response path reuses openaiToAntigravityResponse.

That implementation is an Antigravity/Cloud Code projection and is not considered a native Gemini-client protocol implementation.

If TokenU later exposes a Gemini-compatible client API, this direction must be implemented and tested separately against the intended Gemini protocol.

---

## 13. Translator Registry

Keep the registry concept, but rewrite its contracts.

The commercial runtime must explicitly register only approved translators.

Do not bootstrap every adapter by side effect.

Missing translation paths must fail closed with an explicit unsupported-protocol error.

Translator source code existing in the repository does not imply runtime approval.

The registry must be directional.

Approval of:

    Gemini → OpenAI response

does not automatically imply approval of:

    OpenAI → Gemini response

---

## 14. Approved Translator Bootstrap

The current OmniRoute bootstrap imports all translators through side effects.

TokenU must instead have an explicit approved bootstrap.

Conceptually:

    bootstrapApprovedTranslators()

Only reviewed translators are registered.

Excluded translators should ideally not be imported into the production runtime at all.

Source presence is not commercial approval.

---

## 15. Request Pipeline

OmniRoute's current translateRequest() must not be extracted as one function.

It currently mixes:

- protocol conversion
- capability resolution
- provider/model heuristics
- reasoning policy
- reasoning replay
- cache policy
- tool repair
- provider compatibility
- logging
- credentials
- transient metadata

TokenU separates the request path:

    Client Request
      ↓
    RequestNormalizer
      ↓
    Continuity / Reasoning Policy
      ↓
    Capability / Execution Policy
      ↓
    RequestTranslationPipeline
      ↓
    SingleTargetAdapter

Potentially reusable RequestNormalizer concepts include:

- ensureToolCallIds
- fixMissingToolResponses
- stripOrphanedToolResults
- coerceToolSchemas
- sanitizeToolDescriptions
- structural role normalization

Normalization should establish explicit invariants.

Where practical, repeated silent repair should be replaced by validation and typed errors.

---

## 16. Request Translation Context

Protocol translators must receive typed immutable context instead of credentials.

Conceptually, request translation context contains:

- sourceProtocol
- targetProtocol
- providerId
- modelOfferingId
- upstreamModelId
- technicalModelProfile
- resolved Responses state policy where applicable
- resolved reasoning policy
- resolved cache policy
- execution scope where required

The exact TypeScript interfaces will be finalized during implementation.

Translator context must not contain provider secrets.

The following OmniRoute transient credential flags must not become TokenU contracts:

    _provider
    _targetFormat
    _signatureNamespace
    _preserveCacheControl
    _preserveReasoningContent
    _preCompressionBody
    _ensureUserTurn
    _copilotClient

Request-derived metadata must travel through typed context, not hidden payload properties.

---

## 17. Request Translation Stages

Direct translators may be used where explicitly approved.

Otherwise TokenU may use OpenAI as the canonical interchange protocol.

Example:

    Claude
      ↓ stage A
    OpenAI canonical
      ↓ stage B
    Gemini

Each translation stage receives its own immutable stage context.

Credentials are resolved only by the trusted execution layer.

Internal metadata such as Responses namespace tool identity or store policy must not be transported by mutating provider payloads.

Examples of OmniRoute hidden markers to replace include:

    _omnirouteResponsesStore
    _namespaceToolIdentityMap

Provider payloads should contain only fields belonging to the actual provider protocol.

---

## 18. Response Translation Architecture

Streaming response translation is stateful.

TokenU separates four concepts:

    ResponseTranslationContext
    ProtocolSpecificResponseState
    TranslationOutcome
    AttemptAccumulator

The current OmniRoute pattern where one TranslateState contains all four responsibilities must not be retained.

ResponseTranslationContext is immutable.

ProtocolSpecificResponseState is mutable and owned by one translation stage.

Each upstream attempt creates fresh response state.

No response parser state may be shared between providers, attempts, or different translation stages.

---

## 19. Response Translation Context

ResponseTranslationContext contains immutable information required to interpret one upstream response.

Conceptually it may contain:

- providerId
- modelOfferingId
- upstreamModelId
- sourceProtocol
- targetProtocol
- technicalModelProfile
- execution or signature scope where required
- tool schemas derived from the original request
- custom tool names
- request tool identity metadata
- resolved reasoning transport policy

It must not contain provider secrets.

Request-derived metadata belongs here rather than inside mutable parser state.

---

## 20. Protocol-Specific Response State

Each response translation stage owns a protocol-specific state object.

Examples include:

    ClaudeResponseState
    GeminiResponseState
    OpenAIResponsesResponseState

TokenU must not use one universal giant ResponseState.

State is created fresh:

    per translation stage
    per upstream attempt

Parser invariants should be initialized by the protocol-specific state factory rather than lazily appearing during parsing where practical.

---

## 21. Hub-and-Spoke Response Translation

OmniRoute currently reuses the same mutable state across multiple translation stages.

TokenU must not retain that behavior.

Example of the required separation:

    Gemini upstream
      ↓
    Gemini → OpenAI
    GeminiResponseState
      ↓
    OpenAI canonical
      ↓
    OpenAI → Responses
    OpenAIResponsesResponseState
      ↓
    client response

Each stage owns independent mutable state.

A direct approved translation path may bypass the OpenAI hub, but it still owns its own dedicated state.

---

## 22. Explicit Flush

OmniRoute currently uses a null response chunk as an implicit flush signal.

TokenU must make flush semantics explicit.

Conceptually the response translator exposes separate operations for:

    translateResponseChunk
    flushResponse

Flush may emit real protocol output.

For example, OpenAI Responses may emit terminal response.completed events and final usage during flush.

A null payload must not have hidden control-flow meaning in the TokenU translator contract.

---

## 23. Translation Outcome

Errors must not be communicated through mutable parser state such as state.upstreamError.

TokenU uses explicit translation outcomes.

Conceptually, a translation outcome can represent:

    output
    no-output
    upstream-error

An upstream error outcome should contain a normalized error object with fields such as:

- status
- type
- code
- message
- retryability where known

This allows the Plan Runner to decide retry and fallback behavior without knowing translator internals.

A successful HTTP transport status does not imply a successful model response.

For example, an SSE stream may carry an upstream error inside an HTTP 200 response.

---

## 24. Attempt Accumulator

Protocol parsing and execution-result accumulation are separate responsibilities.

AttemptAccumulator may contain:

- accumulatedContent
- accumulatedReasoning
- normalizedUsage
- timing
- providerId
- modelOfferingId
- upstreamModelId
- connectionId
- terminal status
- normalized error metadata

Accumulated content used for logs or execution results must not live inside protocol parser state unless the parser itself requires it for correctness.

Canonical OpenAI intermediate payloads used for debugging belong to telemetry.

They must not be attached as hidden properties to translated client payloads.

---

## 25. Usage Normalization and Billing

Protocol translation must not define TokenU billing semantics.

TokenU separates:

    raw_provider_usage
    normalized_usage
    billable_usage
    billing_amount

The UsageNormalizer preserves provider-reported dimensions.

Examples include:

- input tokens
- output tokens
- reasoning tokens
- cache read input tokens
- cache creation input tokens

The Billing Engine combines usage dimensions with the pricing snapshot of the exact ModelOffering.

Reasoning tokens that are already included in provider output tokens must not be counted twice.

Cache read and cache creation usage must remain separate when the provider prices them differently.

A compatibility projection such as OpenAI prompt_tokens must not become the accounting source of truth.

---

## 26. OpenAI Responses State Policy

OpenAI Responses introduces upstream state semantics beyond protocol translation.

TokenU requires an explicit resolved state policy.

Conceptually it contains:

    upstreamStore
    preservePreviousResponseId

The conservative TokenU default is:

    upstreamStore = false
    preservePreviousResponseId = false

Stateful behavior must be explicitly allowed by policy and supported by the selected ModelOffering.

The translator must not inspect providerSpecificData to decide whether upstream storage is enabled.

The previous_response_id field may only be preserved when the selected execution target can safely continue the corresponding upstream state.

State policy must be resolved before protocol translation.

---

## 27. Continuity Constraints

Some requests contain state that may be tied to one provider, model, connection, or conversation.

Examples include:

- previous_response_id
- Gemini thought signatures
- encrypted reasoning state
- reasoning replay state
- tool identity and replay state

The Plan Runner must understand continuity constraints before cross-provider fallback.

Conceptually:

    stateless request
      → broader fallback may be possible

    provider-bound state
      → fallback is constrained

State-affine data must never be blindly forwarded to another provider or ModelOffering.

Fallback eligibility must consider continuity compatibility in addition to commercial and capability eligibility.

---

## 28. Gemini Thought Signatures

Keep the concept, replace the current global implementation.

The TokenU design requires:

- scoped storage
- mandatory execution or conversation scope
- injectable storage
- explicit retention policy
- no unscoped toolCallId key
- no global mutable mode
- no fail-open behavior when required signature state cannot be resolved

Gemini request and response translation context receives an execution/signature scope, not credentials.

Each upstream attempt receives fresh parser state.

Thought signature state must not leak between organizations, conversations, connections, or fallback attempts.

---

## 29. Reasoning Policy

Reasoning capability and policy must not be inferred inside translators from provider or model-name heuristics.

Authority moves to:

    TechnicalModelProfile
    ResolvedReasoningPolicy

A model profile should explicitly describe supported reasoning behavior.

Examples include:

    unsupported
    manual
    adaptive
    manual-and-adaptive

Reasoning budget limits, supported effort levels, and output-token constraints must come from approved model metadata.

The translator converts a resolved reasoning decision into the target wire representation.

The translator must not decide whether a model supports reasoning.

Reasoning replay and continuity requirements belong to the continuity/policy layer.

---

## 30. Claude Thinking

Reusable concepts include:

- OpenAI reasoning_effort to Claude thinking mapping
- manual thinking
- adaptive thinking
- thinking budget and max-token fitting
- reasoning_content mapping

The following must not remain as translator authority:

- model-name capability heuristics
- hard-coded model compatibility policy
- Kimi Coding behavior
- Claude Code OAuth behavior
- Copilot-specific behavior
- synthetic </think> markers

Structured-output emulation through prompt injection must not be represented as native structured-output capability.

The capability model should distinguish:

    native
    emulated
    unsupported

If a client requires native structured output, an emulated-only ModelOffering is not eligible unless the client explicitly accepts best-effort behavior.

---

## 31. Gemini Translation

Gemini structural translation is reusable with refactor.

Required changes include:

- typed translation context
- no secrets inside translators
- capability information from TechnicalModelProfile
- explicit safety and tool policy
- scoped thought-signature storage
- no Antigravity-specific branches
- no global registry heuristics
- no arbitrary client-controlled base URL

Antigravity is not part of the TokenU Gemini protocol implementation.

The existing OpenAI → Gemini response path that reuses an Antigravity projection must not be extracted as native Gemini support.

If Gemini-compatible client responses are required later, TokenU must implement and test that direction explicitly.

---

## 32. OpenAI Responses Translation

Reusable concepts include:

- structural Responses to Chat conversion
- structural Chat to Responses conversion
- incremental Responses event parsing
- reasoning-item conversion
- tool-call reconstruction
- Responses usage projection
- explicit response flush behavior

The following responsibilities must move out of the translator:

- providerSpecificData state policy
- provider/model reasoning heuristics
- Copilot compatibility
- hidden store markers
- mutable state.upstreamError

OpenAI Responses must use its own explicit response-state factory.

Stateful continuation behavior is governed by ResolvedResponsesStatePolicy and continuity constraints.

---

## 33. Client Compatibility Layers

Canonical TokenU protocol behavior must not be shaped by legacy coding-client compatibility hacks.

Excluded from canonical MVP behavior:

- Copilot-specific reasoning behavior
- Claude Code synthetic </think> markers
- Cursor-specific compatibility behavior
- Codex-specific model echo behavior
- Kimi Coding protocol glue

If compatibility profiles are introduced later, they must be explicit and independently approved.

Compatibility behavior must not silently alter the canonical protocol translator.

---

## 34. Commercial Runtime Exclusions

The current TokenU MVP exclusions include:

- Mux
- Droid
- runner-cli
- Claude Code preinstallation
- Devin CLI
- OpenClaw latest
- plugin marketplace
- ChatGPT Web and session connectors
- Claude Web and session connectors
- consumer-session routing
- free-tier pooling
- dynamic latest installs
- Antigravity
- Clova
- Kiro
- Cursor

Source code presence does not imply commercial approval.

Excluded components should not be imported or registered in the production runtime unless a later review explicitly approves them.

---

## 35. Dynamic Dependencies

Commercial TokenU must not install mutable latest packages or dynamically pull unreviewed runtime components.

Approved runtime components require:

- exact version
- integrity or hash verification where applicable
- license review
- commercial approval
- SBOM visibility

Dynamic installation must not bypass the Approved Provider/Adapter Registry.

A component becoming technically available does not make it commercially eligible.

---

## 36. Core Execution Request

The final TypeScript shape is not frozen yet, but its responsibility boundary is.

Conceptually, CoreExecutionRequest contains:

- requestId
- attemptId
- ExecutionTarget
- normalized request payload
- client response protocol
- stream flag
- timeout policy
- resolved translation policies
- resolved continuity constraints

CoreExecutionRequest must not contain:

- raw provider secrets
- providerSpecificData
- arbitrary client Authorization headers
- arbitrary upstream base URLs
- cross-provider fallback logic
- retry orchestration or retry policy
- TokenScore logic

Retry and cross-provider execution remain the responsibility of the TokenU Plan Runner.

Each SingleTargetAdapter invocation performs exactly one upstream attempt.

The Plan Runner assigns a unique attemptId before each invocation so repeated attempts against the same ExecutionTarget remain independently accountable.

---

## 37. Execution Target

ExecutionTarget identifies one exact approved upstream attempt.

Conceptually it contains:

- providerId
- modelOfferingId
- upstreamModelId
- connectionId
- approved technical adapter reference
- approved endpoint/profile reference

The target must be fully resolved before entering the SingleTargetAdapter.

The SingleTargetAdapter resolves the exact credential just in time from the trusted secret layer.

It must not discover alternative providers or models.

One ExecutionTarget represents one upstream target, not a routing strategy.

---

## 38. Core Execution Result

CoreExecutionResult should normalize the technical result of one upstream attempt.

Conceptually it contains:

- terminal status
- providerId
- modelOfferingId
- upstreamModelId
- connectionId
- translated output
- normalized usage
- timing
- normalized error
- retryability
- interruption status where applicable

It must not expose:

- raw provider secrets
- internal Authorization headers
- providerSpecificData
- hidden translator state
- arbitrary transformed-body internals

CoreExecutionResult describes one upstream attempt.

The Plan Runner combines one or more CoreExecutionResults into the final client-request outcome.

---

## 39. Extraction Classification

### Keep or extract with refactor

- translator registry concept
- OpenAI canonical hub concept
- Claude/OpenAI structural translators
- Gemini/OpenAI structural translators
- OpenAI Responses structural translators
- provider executors for explicitly approved providers
- BaseExecutor technical concepts
- protocol-specific streaming parsers
- selected resilience utilities
- provider usage parsing
- tool-call reconstruction

### Replace

- generic initState()
- shared translator state between stages
- credentials used as translation context
- providerSpecificData used as policy transport
- global translator bootstrap
- global Gemini thought-signature store
- unknown-provider to OpenAI fallback
- billing semantics inside translators
- provider/model capability heuristics inside translators
- hidden payload markers
- state.upstreamError
- null-as-flush contract

### Exclude

- OmniRoute combo routing as TokenU commercial authority
- OmniRoute auto-routing authority
- Kimi Coding compatibility glue
- Copilot-specific glue
- Antigravity
- Clova
- Kiro
- Cursor
- consumer web/session connectors
- unapproved CLI and proxy executors
- free-tier pooling
- dynamic latest-package execution

---

## 40. Frozen Phase 2.0–2.2 Decisions

The following decisions are frozen unless a later audit produces contradictory evidence:

1. TokenU owns routing authority.
2. TokenU owns cross-provider fallback.
3. TokenScore runs only after eligibility.
4. OmniRoute/Core becomes a single-target execution layer.
5. Public and internal contracts do not expose provider secrets.
6. OpenAI is the canonical interchange protocol for the MVP.
7. The MVP public client protocol is OpenAI-compatible.
8. Claude, Gemini, OpenAI and OpenAI Responses upstream protocols are enabled only through explicitly approved translation paths.
9. OpenAI Responses requires explicit state and continuity policy.
10. Translation context is immutable.
11. Response parser state is protocol-specific and fresh per stage and upstream attempt.
12. Errors are explicit outcomes, not mutable-state side channels.
13. Usage normalization is separate from billing.
14. Translator bootstrap and executor lookup are fail-closed.
15. Only reviewed adapters enter the production runtime.
16. Cross-provider fallback must respect continuity constraints.
17. Provider/model capability authority belongs to TokenU's approved registry and TechnicalModelProfile.
18. Hidden payload markers and credential side-channels are not TokenU contracts.
19. Client protocol support and upstream protocol support are independent.
20. OmniRoute must remain replaceable behind TokenU-owned interfaces.

---

## 41. Phase 2.2 Protocol Extraction Verdict

The protocol extraction audit is closed for the MVP architecture.

Current verdict:

    OpenAI ↔ Claude
      READY FOR EXTRACTION WITH REFACTOR

    OpenAI → Gemini request
    Gemini → OpenAI response
      READY FOR EXTRACTION WITH REFACTOR

    OpenAI ↔ OpenAI Responses
      READY FOR EXTRACTION WITH REQUIRED STATE/POLICY REFACTOR

    Claude → Gemini request
    Gemini → Claude response
      OPTIONAL DIRECT OPTIMIZATION

    OpenAI → Gemini client response
      NOT APPROVED FOR EXTRACTION
      current implementation depends on Antigravity projection

The required commercial path for using Gemini as an upstream provider with an OpenAI-compatible TokenU client is therefore covered.

---

## 42. Next Engineering Step

Do not begin broad source extraction yet.

The next Phase 2 design step is to freeze concrete TypeScript contracts for:

- TechnicalModelProfile
- ModelOffering
- ExecutionTarget
- CoreExecutionRequest
- CoreExecutionResult
- RequestTranslationContext
- ResponseTranslationContext
- ResolvedResponsesStatePolicy
- ResolvedReasoningPolicy
- TranslationOutcome
- approved ProtocolTranslator registry
- SingleTargetAdapter

These contracts must remain independent from OmniRoute implementation types.

After the contracts are reviewed, implementation can proceed behind focused tests without copying OmniRoute's current orchestration architecture.
