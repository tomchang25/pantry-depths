# Core Ownership Refactor — Child 10: The Reward Bank, And The Census Closed

Parent Plan: `core_ownership_refactor.plan.md`

## Goal

Give the one piece of rules-layer state that lives outside the run record its own owner and its own explanation, then record where the access census finished against the baseline it started from.

## Summary

The bank of extracted rewards is the plan's single deliberate exception to state living on the run: a run is destroyed by death and rebuilt by restart, and the whole point of extracting is that what came out survives both. Its lifetime is the page rather than the run, which is exactly why it cannot be a field on the run — and that reason is now written where the state lives rather than inferred from its absence elsewhere.

It takes the last-extraction record with it, which had been a second module-level variable in the extraction path for the same reason.

The reward types move to the progression contract so the bank and the sealing module can both name them without depending on each other. Without that the two would have been a runtime cycle, which is the same shape the feedback owner hit in an earlier child.

The census closes at 173 whole-state parameters and 174 direct mutations, against a recorded baseline of 179 and 188. The decision modules — the attack resolver, its contract, and all three enemy behaviour families — do not appear in the census at all, because they cannot name the run state.

## Relational Context

- The bank is read by the interface for the run-end screen and by the sealing module for the equipped core, so it sits below both.
- The reward types cannot stay with the sealing module: the bank needs them and the sealing module needs the bank, and one of those edges carries values.

## Scope

### Included

- The bank owner, the reward types relocated, the census recorded at its end state, and the structure addendum updated to the landed shape.
- The plan's closing verification: the aggregate gate, the governance check, and a capture run.

### Excluded

- The play session that closes the plan, which is the user's.

## Files to Change

| File                                           | Change Size | Purpose                             |
| ---------------------------------------------- | ----------- | ----------------------------------- |
| `src/core/progression/rewards-bank.ts`         | Small       | The bank, and why it outlives a run |
| `src/core/progression/progression-contract.ts` | Small       | Gains the reward types              |
| `src/core/progression/sealed.ts`               | Small       | Loses the bank                      |
| `src/core/world/extraction.ts`                 | Small       | Loses the last-extraction record    |
| `dev/standards/project_structure.addendum.md`  | Small       | The core row, as it landed          |

## Acceptance Criteria

1. The bank is one module and states why its lifetime is the page.
2. The census ends below its baseline on both counts, with the decision modules absent from it.
3. The aggregate gate and the governance check pass.
4. The structure addendum describes the layer as it now is.
