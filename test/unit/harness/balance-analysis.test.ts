import { createBalanceAnalysis } from "@/harness/balance-analysis";
import { describe, expect, it } from "vitest";

describe("createBalanceAnalysis", () => {
  it("derives the same model from every fresh replay", () => {
    expect(createBalanceAnalysis()).toEqual(createBalanceAnalysis());
  });

  it("reports the provisional route reaching victory with its full command count", () => {
    const { route } = createBalanceAnalysis();

    expect(route.completed).toBe(true);
    expect(route.succeeded).toBe(true);
    expect(route.outcome).toBe("victory");
    expect(route.executedCommandCount).toBe(route.commandCount);
    expect(route.maxHealth).toBe(120);
    expect(route.finalHealth).toBe(80);
    expect(route.totalCost).toBe(40);
  });

  it("resolves stage identity and accumulated cost at each reached checkpoint", () => {
    const { route } = createBalanceAnalysis();

    expect(route.checkpoints.every((checkpoint) => checkpoint.reached)).toBe(true);

    const start = route.checkpoints.find((checkpoint) => checkpoint.id === "start");
    const attackDoor = route.checkpoints.find((checkpoint) => checkpoint.id === "b2-blue-door");
    const victory = route.checkpoints.at(-1);

    expect(start?.stage?.label).toBe("Stage 0");
    expect(start?.accumulatedCost).toBe(0);
    expect(attackDoor?.stage?.label).toBe("Stage 1");
    expect(attackDoor?.attack).toBe(5);
    expect(victory?.stage?.label).toBe("Stage 4");
    expect(victory?.accumulatedCost).toBe(route.totalCost);
  });

  it("derives opened doors from entity activity rather than checkpoint labels", () => {
    const { route } = createBalanceAnalysis();
    const redDoor = route.checkpoints.find((checkpoint) => checkpoint.id === "b1-red-door");
    const blueKey = route.checkpoints.find((checkpoint) => checkpoint.id === "b2-blue-key");

    expect(redDoor?.openedDoorIds).toContain("b1-red-door");
    expect(blueKey?.openedDoorIds).not.toContain("b2-blue-door");
    expect(route.checkpoints.at(-1)?.openedDoorIds).toContain("b4-yellow-door");
  });

  it("marks route membership from the fixture checkpoints and leaves the rest bypassable", () => {
    const analysis = createBalanceAnalysis();
    const princess = analysis.placements.find((placement) => placement.entityId === "b5-princess");

    expect(princess?.onForcedRoute).toBe(true);
    expect(analysis.bypassableEnemies.every((placement) => placement.kind === "enemy")).toBe(true);
    expect(analysis.bypassableEnemies.every((placement) => !placement.onForcedRoute)).toBe(true);
  });

  it("keeps impassable combat results instead of substituting a placeholder", () => {
    const analysis = createBalanceAnalysis();
    const princess = analysis.enemies.find((row) => row.enemy.id === "princess");

    expect(princess?.projections).toHaveLength(analysis.stages.length);
    expect(princess?.projections[0]).toMatchObject({ canDefeat: false, totalCost: null });
    expect(princess?.projections.at(-1)).toMatchObject({ canDefeat: true, totalCost: 40 });
  });

  it("separates structural topology status from route evidence", () => {
    const { topology } = createBalanceAnalysis();

    expect(topology.passed).toBe(true);
    expect(topology.solutionSteps).toBeGreaterThan(0);
    expect(topology.findings.every((finding) => finding.severity !== "error")).toBe(true);
  });
});
