# Demo Migration 04 — The Sound Seam

Parent Plan: `demo_migration.plan.md`

## Goal

Invert the one import that lets the rules half reach the audio stack: the rules stop calling the player and instead report cues as part of what a tick did, and the surface that runs the tick plays them. This is the seam the structure standard prescribes for core, built while the code still sits in the demo tree so it ships and playtests on its own.

## Summary

- **The world gains a cue queue.** A tick's sound output becomes data on the world: a list of cue events, each an id and an optional world position — exactly the two arguments the player takes today. The rules modules push onto it through one helper owned by the world module; the surface drains the queue once per frame after the tick and hands each event to the player unchanged.
- **Nineteen call sites across six modules flip** — the wall breaks, swings, hits, throws, impacts, water entry, detonations, the player's hurt and death, and both award chimes. The three interface clicks in the surface keep calling the player directly: the surface is the runtime layer, which may.
- **Audibly identical by construction.** Order is preserved (the queue is first-in first-out), volume and distance falloff are computed at play time exactly as today, and rate limiting stays inside the player. The only timing shift is that an input-raised cue now waits for the same frame's drain instead of sounding mid-handler — a sub-frame difference below perception.
- **The cue-id union stays in content for now, deliberately.** The plan left its final home open (core-side union vs strings validated at the seam). Deciding it now would be deciding it twice: the rules child has to answer the larger question of how core reads any content table — the archetype table included — and the union's home falls out of that answer. This child's job is the call direction, and that inverts completely without moving the type.

Verification: the gate, then a playtest with ears — combat hits, wall breaks, throws and landings, water, extraction, and the interface clicks.

## Relational Context

- The player (`playSfx`) is fire-and-forget, never throws, and drops cues beyond earshot at play time using the per-frame listener position — draining after the tick uses the same frame's listener, so falloff is unchanged.
- The queue helper lives in the world module beside the world type; the six rules modules already import the world module or receive the world as a parameter at every call site (verified: all nineteen sites have `world` in scope).
- The drain lives in the surface's frame loop only. No workbench imports any cue-raising world function (verified), so no workbench needs a drain; a world stepped without a drain accumulates silent events, which is the same silence those tools have today before audio is unlocked.
- The world module currently imports the player directly; after this child it imports only the cue-id type. The surface keeps its player import for the interface clicks, the unlock gesture, and now the drain.
- The audio workbench calls the player directly by design and is untouched.

## Scope

### Included

- The cue event type, the queue on the world, the raise helper, the drain in the surface, and the nineteen call-site flips.

### Excluded

- Any change to the player, the mixer, the rate limiter, or the cue table; any new cue; the cue-id union's final layer home (rules child); any new test.

## Files to Change

| File                       | Change Size | Purpose                                                   |
| -------------------------- | ----------- | --------------------------------------------------------- |
| `src/demo/world.ts`        | Medium      | Cue type, queue field, raise helper; its three sites flip |
| `src/demo/actions.ts`      | Medium      | Ten sites flip; player import dropped                     |
| `src/demo/impacts.ts`      | Small       | Six sites flip; player import dropped                     |
| `src/demo/simulation.ts`   | Small       | Three sites flip; player import dropped                   |
| `src/demo/enemy-ai.ts`     | Small       | One site flips; player import dropped                     |
| `src/demo/extraction.ts`   | Small       | One site flips; player import dropped                     |
| `src/demo/demo-surface.ts` | Small       | Drains the queue once per frame after the tick            |

## Execution Outline

1. World module: type, field (initialised empty), helper; flip its own sites; swap the player import for the cue-id type import.
2. Flip the five other modules, dropping their player imports; typecheck to zero.
3. Surface drain after the tick call.
4. `npm run verify`; hand to the user for the ears playtest before closeout.

## Implementation Notes

- The compiler runs `exactOptionalPropertyTypes`: build the event conditionally (`at` present or absent), never as an explicit `undefined` field.
- Drain by iterating then truncating in place — the world is mutable by convention and the queue is no exception.

## Acceptance Criteria

1. No rules module imports the audio stack; the world module's only audio knowledge is the cue-id type.
2. Every sound that played before plays at the same moment, volume, and position to the ear; the interface clicks are unchanged.
3. The aggregate gate passes; the boundary check stays at zero violations.
