# Ground That Cannot Be Filled, Authored Only

Parent Plan: `room_contents.plan.md`

## Goal

Add the trench: ground a body cannot cross, cannot break through, and — unlike water — cannot spend anything to close. It is placed only by an author's hand in a room's cells, and it exists to make an authored room able to say "this gap is permanent".

## Summary

The direction is settled and the taste questions this child was split off to hold have now been answered in conversation, so this sketch records the behaviour table rather than debating it. What remains provisional is the plumbing — every code claim below is a candidate for the spec to verify — and the one genuinely visual decision, the floor texture, which is decided by looking at rendered candidates rather than by prose.

The trench relates to water by three deliberate differences: water washes blood away and the trench simply never holds any; water swallows three bodies and becomes ground while the trench swallows every body and remains; water is the repair's to open when it strands ground while the trench must never be opened by anything. Everything else — walked around, seen over, thrown over, immune to a swing — it shares with water.

The expected outcome if this holds up: an authored room can carry a permanent gap, a body flung into it dies on the spot with the collapse death, and every guarantee the plan already made about reachable ground keeps holding with the trench counted on the impassable side.

## Sketch

### The behaviour table, decided

| Question                       | Water today                     | Trench, decided                                        |
| ------------------------------ | ------------------------------- | ------------------------------------------------------ |
| Walked on                      | No                              | No                                                     |
| Seen over                      | Yes                             | Yes                                                    |
| Thrown over, at any height     | Yes                             | Yes — nothing of it stands above the floor             |
| Flung body carried over        | Yes                             | Yes                                                    |
| Struck with a weapon           | Swing does nothing              | Swing does nothing                                     |
| Drawn as a wall face           | Never                           | Never                                                  |
| Blood settles                  | No — washed away                | No — a pit holds no carnage worth reading              |
| Body landing in it             | Drowns over seconds, fills pool | Dies at once, the existing collapse death; no filling  |
| Ever becomes ground again      | Yes, at three bodies            | Never                                                  |
| Counts toward the pool task    | Yes                             | No                                                     |
| Cuts ground off                | Yes                             | Yes                                                    |
| Opened by the stranding repair | Yes                             | **Never** — there is nothing that can open it          |
| Placed by a generator          | Yes, as a scattered share       | Never — authored cells only, and nothing forbids later |

### Why none of this can lean on the compiler

The maze module's header claims a tile kind added to the content list without a branch in the demo fails to compile. Verified today: it does not. The tile factory ends in a fallthrough that builds any unknown kind as a zero-hit-point wall, and every other consumer is an if-chain that silently keeps its default. Left alone, the trench would compile cleanly and be wrong six ways — most loudly, a swing would break it, because the wall-damage handler's early return names water and not it. So the spec must walk every site by hand, and the tracker now carries a One Tile, One Record draft recording that this enumeration is the disease and a data-driven record is the deferred cure, gated behind the demo's content settling like the enemy record beside it.

### Candidate seams, provisional

- The landing seam is likely `checkHazards` in `src/demo/impacts.ts`: barricade lands as impalement, water as drowning, and the trench slots in as a third arm that kills immediately with the collapse death — `"collapse"` already exists in the skeleton death set, so no asset is authored. The kill should go through the ordinary kill path so counters, blessings and drops behave as any death does.
- Content side: the kind joins the tile list in `src/content/maps/room-schema.ts`; the authored-cell enclosure check and `strandedGround` in `map-schema.ts` both treat it as impassable. The stranding repair in `src/demo/maze.ts` searches across water to find routes — it must treat the trench like the boundary there, or the walk-back would try to open it. A region sealed purely by trench is refused when the room file is saved, so the repair never faces a seal it cannot open some water in.
- Demo branches to visit, each currently naming water and not it: the wall-damage early return in `actions.ts`, the wall-face skip and the floor-material lookup in `demo-scene.ts`, `holdsStains`, and nothing in `sinkBody` — the trench is deliberately not that function's business.
- Presentation: one new member of `RenderFloorMaterial`, its slot in the renderer's floor-material order, and one texture function beside the others in `procedural-textures.ts`. It must not join the watery-patch set — nothing about it slides, wobbles or foams.
- Proof content: the sandbox gains an authored variant or a sibling room with a trench run through it, since no generated room can produce one.

### The texture is chosen by looking

Three candidates are rendered as swatches from the same value-noise vocabulary the existing floors use, in the palette's dark purple register, and the pick — or the adjustment — happens on the pictures. The prose commits only to intent: it should read as an absence of floor, darker than any walkable material, with a legible rim so its edge is judged at a glance in motion.

## Non-Goals

1. No generation of the trench, and no rule forbidding it later — the door stays open and simply is not walked through.
2. No change to water: its drowning, its fill count, its wash of blood, and its repairability stay exactly as shipped.
3. No data-driven tile record. That is the tracker's One Tile, One Record draft, deferred with its stated gate.
4. No new death animation, no new sound, no new particle kind.
5. No change to the pool task, the tasks generally, or anything the HUD says.
6. No new tests.

## Acceptance Criteria

1. An authored room can place the trench, and it appears on the floor exactly where the cells put it; no generated floor ever contains one.
2. A body cannot walk into it, can see across it, and can throw across it at any height; a swing at it changes nothing.
3. A body flung or knocked into it dies immediately with the existing collapse death, and the trench is unchanged afterwards — it never fills, and it never advances the pool task.
4. No blood mark ever appears on it.
5. A room whose authored cells seal ground behind trench is refused when the file is saved, and no built floor holds ground cut off behind it.
6. The verification gate passes, and no test file is added.
