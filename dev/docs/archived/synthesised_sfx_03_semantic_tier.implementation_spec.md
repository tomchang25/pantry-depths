# The Semantic Tier

Parent Plan: `synthesised_sfx.plan.md`

## Goal

Give the moments that matter their own sounds. The funnel tier guarantees nothing is silent; this child is what makes the game legible by ear — a swing, a telegraph starting behind you, a charge launching, a bomb going off and a body coming down are each distinct rather than sharing whatever their particles happened to raise.

## Summary

A demo-half change: the note states the shape and the hazards; the rest is read just in time.

**What is being built.** Thirty-six new cues in the authored table, raised at the sites where the thing actually happens rather than at the funnel downstream of it. Player actions get a swing, a hit that differs for flesh and bone, a wall strike, an altar strike, three throw releases, a bolt, a pickup and a drop. Enemies get one telegraph per intent, a charge launch, a charge into a wall, and a shot leaving. The player gets a hurt and a death. The world gets water entry, rock landing, body barge, body landing, detonation, shell fire, shell landing, and a chain hop. Flow gets a blessing, a sealed reward, an extraction and a descent; the interface gets pause, resume, card and restart. That takes the table from sixteen cues to fifty-two.

**How the throw brackets work.** Three release cues chosen from the projectile's launch speed rather than from a fourth authored field — speed already separates a flicked bolt from a heaved body, so a throwable added later gets a sound without anyone remembering to give it one. The bracket boundaries are a first guess to be settled by ear.

**Shapes to avoid.** Do not raise a semantic cue from the funnel that already fires for it — they layer deliberately, and where they would stack the limiter key is the tool, not deleting one of them. Do not read the world in a cue call; pass the coordinates that are already in scope. Do not make any of these calls conditional on audio being ready.

**The result.** A run is followable with eyes closed: what is winding up, from which direction, whether it connected, and on what.

## Relational Context

- The telegraph map and the death map are total records over their unions, not branch chains, so a new intent or cause fails to compile rather than falling silently through to a default. This is the project's closed-enumeration rule applied where it can be applied cheapest.
- The wind-up entry point takes the archetype's own intent union; narrowing its parameter from the enemy's wider intent field to that union is what lets the map be total.
- Both tiers fire for the same instant by design — a death raises its own cue and the particle bursts raise theirs. Shared limiter keys collapse a pile-up; nothing is removed to prevent one.
- The player's own damage and death are flat, not positional: they happened to the listener, not across the room.
- Cue ids are added to the content layer's declared list, and the validator demands a row for each, so a hookup cannot reference a cue with no recipe.
- No automated test covers any file this child touches, and none may be added.

## Scope

### Included

- Thirty-six semantic cues authored into the table and raised at their sites.
- A speed-derived bracket for throw releases.
- Narrowing the wind-up entry point's intent parameter so its cue map is total.

### Excluded

- Tuning any recipe by ear — that is the listening pass.
- Player-facing volume and mute — the next child.
- Any per-target priority fold; shared limiter keys are the first answer and the only one this child spends.

## Files to Change

| File                                | Change Size | Purpose                                                        |
| ----------------------------------- | ----------- | -------------------------------------------------------------- |
| `src/content/sfx/sfx-cue-schema.ts` | Small       | Thirty-six new declared cue ids                                |
| `src/content/sfx/sfx-cues.json`     | Large       | Their recipes, spread so neighbours differ                     |
| `src/demo/actions.ts`               | Medium      | Swing, hits, throws, bolt, pickup, drop, and the speed bracket |
| `src/demo/enemy-ai.ts`              | Medium      | Telegraphs, charge launch, wall slam, shot, player hurt        |
| `src/demo/impacts.ts`               | Medium      | Water, chain, detonation, shell, rock, barge, landing          |
| `src/demo/world.ts`                 | Small       | Blessing gained, and the player's death on the one run exit    |
| `src/demo/simulation.ts`            | Small       | Descent                                                        |
| `src/demo/extraction.ts`            | Small       | Sealed reward taken, extraction completed                      |
| `src/demo/demo-surface.ts`          | Small       | Pause, resume, card, restart                                   |

## Execution Outline

1. Declare the new ids, then author their rows — the hookups will not compile against an id that does not exist.
2. Hook the player's own actions, then the enemies', then the world's, then flow and interface. Each group is independent of the others.
3. Run the gate.

## Implementation Notes

- **Recipe spread.** Neighbours within a group must differ audibly: the three telegraphs rise where everything else falls, so a wind-up never sounds like an impact; the three throw releases are the same gesture at three weights; the flow cues rise and are the only long clean tones in the table.
- **Wind-up cue placement.** Raised as the telegraph begins, not when it resolves, because the point is the warning.
- **Charge into a wall** is raised before the wall takes its damage, matching the existing ordering there.
- **The player's death** rides the single run-exit function rather than each way of dying, for the same reason the enemy death cue rides the kill routine.

## Acceptance Criteria

1. A swing, a connect on flesh, a connect on bone, and a strike on masonry are four different sounds.
2. Each of the three telegraphs is distinct and audible before the attack it announces.
3. A thrown bolt, stone and body are three different releases.
4. A detonation, a shell landing and a body landing do not sound alike.
5. Pause, card, blessing, sealed reward, descent and extraction each speak.
6. The verification gate passes and no test covers the demo half.
