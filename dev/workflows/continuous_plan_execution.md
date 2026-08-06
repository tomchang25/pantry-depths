# Continuous Plan Execution

Use this workflow when a platform-native goal or an equivalent explicit request names a plan and asks the agent to advance its children continuously. The native goal owns persistence across turns; this repository workflow owns child order, handoffs, verification, and stop boundaries. `dev/foundation/core/workflows/commands/implement.md` owns each child execution. This workflow defines no custom `/goal` command.

A standalone implementation spec is one `/implement` target. It does not need a plan marker or enter the child loop.

## Authorization

A native goal or explicit continuous-execution request that names a plan authorizes the non-destructive repository mutations required to advance that plan's children in landing order. The foundation `/implement` authorization and conditional stop conditions apply to each child.

The request does not authorize Git mutations, branch merge, destructive actions, external-system writes, publish or deploy operations, or decisions reserved for human judgment. A conditional stop waits for the required input without discarding the remaining goal; clearing or replacing the goal ends the authorization.

## Child Loop

For each unshipped child in the plan's landing order:

1. Read the plan's conceptual requirements, child overview entry, and current `Execution` subsection.
2. Run `/implement` for that child. If its shape is unresolved or live evidence triggers a conditional stop, ask before proceeding.
3. Run only the narrow verification named by the implementation spec and permitted by `dev/agent_rules/test_operations.md`. `npm run verify` remains reserved for an authorized branch merge.
4. Close out the child, update the plan's forward-only overview and `Execution` section, report one compact progress update, and continue without a scheduled confirmation.

After the final child, evaluate the plan acceptance criteria. Do not close the plan through a required play judgment, branch-merge gate, external action, or verification gap; report that remaining boundary and wait.
