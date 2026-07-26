# Implement Operations

This file is the authoritative project-local permission delta for `/implement`. Read `dev/foundation/core/workflows/commands/implement.md`, `dev/foundation/core/workflows/work_lifecycle.md`, and `dev/foundation/core/workflows/implementation_spec_standard.md` first; their contracts continue to apply except for the narrow supersession below.

## Explicit Second-Confirmation Bypass

The foundation requires `/implement` to stop twice: once before spec mutation and again after the spec-backed preview before source mutation. For Pantry Depths, the second stop may be bypassed for tightly bounded work when the user explicitly requests the bypass after seeing the Phase 1 scratchboard.

This rule supersedes only the foundation statements that the Phase 2 implementation-confirmation stop is always mandatory and that an earlier confirmation can never authorize implementation. Apply the replacement contract as follows:

1. Phase 1 target confirmation remains mandatory. Never infer it from the original `/implement` invocation, and never bypass it.
2. In the reply that confirms the Phase 1 target, the user may also explicitly instruct the agent to skip the second confirmation and implement immediately after the spec is complete. The request must clearly name that intent; a generic `confirm`, `continue`, or `go ahead` authorizes Phase 2 only.
3. The bypass applies only to the current confirmed target and the current `/implement` flow. It is not a standing preference and does not carry to another target or a later invocation.
4. Phase 2 still performs the complete implementation-modeling pass, writes or updates the English implementation spec, updates lifecycle tracking, runs the required documentation checks, and prepares the user-language preview. The agent may present that preview as a progress update and continue into implementation without waiting for another reply.
5. Direct continuation is allowed only while the spec's Goal, Summary, scope, compatibility promises, and observable result faithfully remain within the Phase 1 confirmation. If modeling exposes an unresolved user-authority decision, contradicts locked behavior, expands the confirmed scope, or makes the target no longer tightly bounded, stop and ask for confirmation instead.
6. The bypass does not waive a renewed confirmation required by a material implementation-time deviation, nor any destructive-action approval, external authorization, human asset approval, or verification obligation.

When these conditions hold, the explicit bypass request is advance approval of the spec-backed Goal and Summary and the executor plan produced within the confirmed target. Phase 4 may therefore begin immediately after Phase 2 completes successfully.
