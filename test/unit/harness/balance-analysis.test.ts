import { BALANCE_TEST_SCENARIO } from "../../fixtures/balance-scenario";
import { createBalanceAnalysis } from "@/harness/balance-analysis";
import { describe, expect, it } from "vitest";

describe("createBalanceAnalysis", () => {
  it("derives the same model from every fresh replay", () => {
    expect(createBalanceAnalysis(BALANCE_TEST_SCENARIO)).toEqual(createBalanceAnalysis(BALANCE_TEST_SCENARIO));
  });

  it("reports the provisional route reaching victory with its full command count", () => {
    const { route } = createBalanceAnalysis(BALANCE_TEST_SCENARIO);

    expect(route.completed).toBe(true);
    expect(route.succeeded).toBe(true);
    expect(route.outcome).toBe("victory");
    expect(route.executedCommandCount).toBe(route.commandCount);
    expect(route.maxHealth).toBe(120);
    expect(route.finalHealth).toBe(80);
    expect(route.totalCost).toBe(40);
  });

  it("resolves stage identity and accumulated cost at each reached checkpoint", () => {
    const { route } = createBalanceAnalysis(BALANCE_TEST_SCENARIO);

    expect(route.checkpoints.every((checkpoint) => checkpoint.reached)).toBe(true);

    const start = route.checkpoints.find((checkpoint) => checkpoint.id === "start");
    const attackDoor = route.checkpoints.find((checkpoint) => checkpoint.id === "t1-blue-door-1");
    const victory = route.checkpoints.at(-1);

    expect(start?.stage?.label).toBe("Stage 0");
    expect(start?.accumulatedCost).toBe(0);
    expect(attackDoor?.stage?.label).toBe("Stage 1");
    expect(attackDoor?.attack).toBe(5);
    expect(victory?.stage?.label).toBe("Stage 4");
    expect(victory?.accumulatedCost).toBe(route.totalCost);
  });

  it("derives opened doors from entity activity rather than checkpoint labels", () => {
    const { route } = createBalanceAnalysis(BALANCE_TEST_SCENARIO);
    const redDoor = route.checkpoints.find((checkpoint) => checkpoint.id === "t1-red-door");
    const beforeLargeBlue = route.checkpoints.find((checkpoint) => checkpoint.id === "t1-red-key");

    expect(redDoor?.openedDoorIds).toContain("t1-red-door");
    expect(beforeLargeBlue?.openedDoorIds).not.toContain("t1-blue-door-2");
    expect(route.checkpoints.at(-1)?.openedDoorIds).toContain("t1-yellow-door-2");
  });

  it("marks route membership from the fixture checkpoints and leaves the rest bypassable", () => {
    const analysis = createBalanceAnalysis(BALANCE_TEST_SCENARIO);
    const princess = analysis.placements.find((placement) => placement.entityId === "t2-goal");

    expect(princess?.onForcedRoute).toBe(true);
    expect(analysis.bypassableEnemies.every((placement) => placement.kind === "enemy")).toBe(true);
    expect(analysis.bypassableEnemies.every((placement) => !placement.onForcedRoute)).toBe(true);
  });

  it("keeps impassable combat results instead of substituting a placeholder", () => {
    const analysis = createBalanceAnalysis(BALANCE_TEST_SCENARIO);
    const princess = analysis.enemies.find((row) => row.enemy.id === "princess");

    expect(princess?.projections).toHaveLength(analysis.stages.length);
    expect(princess?.projections[0]).toMatchObject({ canDefeat: false, totalCost: null });
    expect(princess?.projections.at(-1)).toMatchObject({ canDefeat: true, totalCost: 40 });
  });

  it("separates structural topology status from route evidence", () => {
    const { topology } = createBalanceAnalysis(BALANCE_TEST_SCENARIO);

    expect(topology.passed).toBe(true);
    expect(topology.solutionSteps).toBeGreaterThan(0);
    expect(topology.findings.every((finding) => finding.severity !== "error")).toBe(true);
  });
});
