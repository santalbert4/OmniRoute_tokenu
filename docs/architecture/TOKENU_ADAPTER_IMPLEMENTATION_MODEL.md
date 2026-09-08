# TokenU Adapter Implementation Model

## Phase 2.8 — SingleTargetAdapter Implementation Boundary

**Status:** Design specification.

This document defines how legacy OmniRoute provider execution code is adapted into TokenU SingleTargetAdapter implementations.

The objective is extraction of provider execution capabilities without inheriting legacy orchestration responsibilities.

---

# 1. Adapter invariant

A TokenU SingleTargetAdapter represents exactly one approved upstream execution path.

Runtime preparation happens before adapter execution.

Before attemptId creation, TokenU resolves and validates the approved adapter factory, endpoint profile, credential, technical model profile and ExecutionTarget binding.

One bound adapter execution then:

- receives one CoreExecutionRequest for the same ExecutionTarget used during binding
- performs exactly one upstream execution attempt and at most one provider network dispatch
- returns one CoreExecutionResult

Target/binding consistency must be validated before attemptId creation. The adapter does not own orchestration, dependency resolution, retry or fallback.

---

# 2. Adapter execution pipeline

Runtime dependencies are resolved before an upstream attempt exists.

The intended execution flow is:

ExecutionTarget

↓

TokenUAdapterFactoryRegistry resolution

↓

EndpointProfileRegistry resolution

↓

SecretResolver credential resolution

↓

TechnicalModelProfileRegistry resolution

↓

SingleTargetAdapterFactory.bind(target, endpoint, credential, technicalModelProfile)

↓

Pre-dispatch validation

↓

Bound ephemeral SingleTargetAdapter

↓

Plan Runner assigns attemptId

↓

CoreExecutionRequest

↓

Request protocol translation

↓

At most one provider HTTP dispatch

↓

Provider response parsing

↓

Response protocol translation

↓

CoreExecutionResult normalization

A missing factory, endpoint, credential, technical model profile or rejected binding is a pre-dispatch failure. It must not create an attemptId, CoreExecutionResult or upstream-attempt accounting record.

---

# 3. Allowed adapter responsibilities

Adapters may own:

- provider HTTP communication
- provider authentication headers after secret resolution
- provider-specific request formatting
- provider-specific response parsing
- provider error normalization
- streaming transport handling

---

# 4. Forbidden adapter responsibilities

Adapters must not own:

- provider selection
- model selection
- routing
- TokenScore evaluation
- commercial policy
- retry decisions
- fallback decisions
- alternate endpoint selection
- credential persistence
- billing calculation

---

# 5. Legacy extraction rule

Legacy Open-SSE code may be reused only when the extracted behavior is:

- deterministic
- provider-specific
- single-attempt scoped
- independent from global routing state

---

# 6. BaseExecutor migration rule

BaseExecutor is not inherited by TokenU adapters.

Reusable logic must be extracted into explicit provider-scoped components.

Examples:

Allowed extraction:

- OpenAI request serializer
- SSE response parser
- provider error mapper

Forbidden extraction:

- fallback loops
- retry orchestration
- credential rotation
- dynamic provider selection

---

# 7. First adapter target

The first production adapter should target a provider family with:

- stable HTTP contract
- existing translator coverage
- minimal authentication complexity

The implementation should validate the complete TokenU execution boundary before additional providers are migrated.
