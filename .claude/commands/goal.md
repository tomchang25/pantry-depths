---
description: Run a goal-executable plan's children end to end without stopping between them
argument-hint: <path to a plan declaring Goal-Executable: yes>
---

Execute every unshipped child of the plan at `$ARGUMENTS`, in its landing order, without stopping between children.

This command owns no rules of its own. Follow, in this order:

1. The startup chain in `CLAUDE.md`.
2. `dev/agent_rules/implement_operations.md`, section **Executing A Goal-Executable Plan End To End** — the preconditions, the per-child loop, and the list of conditions that stop it.
3. `dev/standards/work_lifecycle.addendum.md`, section **A Plan May Declare Itself Goal-Executable** — the three conditions the plan itself must satisfy.
4. `dev/agent_rules/test_operations.md` for what verification means here.

Do not begin if the plan does not declare `Goal-Executable: yes`, or if the user has not authorized continuous execution of this plan's children in as many words. Report which precondition failed and stop.

A stop condition ends the run rather than pausing it. Say which one fired, what state the plan is in, and which children remain.
