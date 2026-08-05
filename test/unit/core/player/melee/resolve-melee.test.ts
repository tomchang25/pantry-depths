import { resolveMelee } from "@/core/player/melee/resolve-melee";
import type { MeleeCandidate, MeleeSnapshot } from "@/core/player/melee/contract";
import { describe, expect, it } from "vitest";

/** The player at the origin, facing along positive x, with an ordinary swing's numbers. */
function snapshotOf(overrides: Partial<MeleeSnapshot> = {}): MeleeSnapshot {
  return {
    actor: { x: 0, y: 0, angle: 0 },
    stats: { reach: 2, damage: 25, knockback: 3, structureDamage: 1 },
    candidates: [],
    altar: undefined,
    floor: { blocksProjectile: () => false },
    ...overrides,
  };
}

function enemyAt(id: string, x: number, y: number, extra: Partial<MeleeCandidate> = {}): MeleeCandidate {
  return { id, x, y, drowning: false, boned: false, ...extra };
}

describe("resolveMelee", () => {
  it("does not strike a candidate inside reach but outside the arc", () => {
    // Directly behind, well within reach.
    const effects = resolveMelee(snapshotOf({ candidates: [enemyAt("behind", -1, 0)] }));

    expect(effects.filter((effect) => effect.kind === "enemyHit")).toHaveLength(0);
    expect(effects).toContainEqual(expect.objectContaining({ kind: "landing", connected: false }));
  });

  it("strikes every candidate inside the arc and draws the arc through the nearest", () => {
    const effects = resolveMelee(
      snapshotOf({ candidates: [enemyAt("far", 1.8, 0), enemyAt("near", 0.5, 0), enemyAt("mid", 1, 0)] }),
    );
    const hits = effects.filter((effect) => effect.kind === "enemyHit");

    expect(hits.map((hit) => hit.targetId)).toEqual(["near", "far", "mid"]);
    expect(effects).toContainEqual(expect.objectContaining({ kind: "landing", x: 0.5, y: 0, connected: true }));
    expect(effects).toContainEqual({ kind: "cleave", count: 3 });
  });

  it("strikes the altar only when no candidate is in the arc", () => {
    const altar = { x: 1, y: 0, hp: 3 };

    expect(resolveMelee(snapshotOf({ altar }))).toContainEqual({ kind: "altarHit" });
    expect(resolveMelee(snapshotOf({ altar, candidates: [enemyAt("ahead", 1, 0)] }))).not.toContainEqual({
      kind: "altarHit",
    });
  });

  it("strikes a wall only when neither a candidate nor the altar is in the arc", () => {
    const floor = { blocksProjectile: (x: number) => x >= 1 };
    const wallHit = { kind: "structureHit", cell: { x: 1, y: 0 } };

    expect(resolveMelee(snapshotOf({ floor }))).toContainEqual(wallHit);
    expect(resolveMelee(snapshotOf({ floor, altar: { x: 1, y: 0, hp: 3 } }))).not.toContainEqual(wallHit);
    expect(resolveMelee(snapshotOf({ floor, candidates: [enemyAt("ahead", 1, 0)] }))).not.toContainEqual(wallHit);
  });
});
