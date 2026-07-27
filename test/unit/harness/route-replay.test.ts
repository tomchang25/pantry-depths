import { BALANCE_TEST_SCENARIO } from "../../fixtures/balance-scenario";
import { getRouteCheckpoint, replayRoute, routeCompleted } from "@/harness/route-replay";
import { createFloorScenario } from "@/harness/floor-scenario";
import { replayScenarioRoute } from "@/harness/route-scenario";
import { describe, expect, it } from "vitest";

describe("route scenario replay", () => {
  it("reaches victory deterministically through canonical commands and checkpoints", () => {
    const first = replayScenarioRoute(BALANCE_TEST_SCENARIO);
    const second = replayScenarioRoute(BALANCE_TEST_SCENARIO);
    const blueDoor = getRouteCheckpoint(
      first,
      BALANCE_TEST_SCENARIO.route.checkpoints.find((checkpoint) => checkpoint.id === "t1-blue-door-1")!,
    );
    const finalCheckpoint = getRouteCheckpoint(first, BALANCE_TEST_SCENARIO.route.checkpoints.at(-1)!);

    expect(first).toEqual(second);
    expect(routeCompleted(first)).toBe(true);
    expect(first.steps).toHaveLength(BALANCE_TEST_SCENARIO.route.commands.length);
    expect(first.steps.every((step) => step.accepted)).toBe(true);
    expect(blueDoor.snapshot.player).toMatchObject({ attack: 5, defense: 0, keys: { red: 0, blue: 0, yellow: 0 } });
    expect(finalCheckpoint).toMatchObject({ reached: true, snapshot: { outcome: "victory" } });
    expect(finalCheckpoint.snapshot.player).toMatchObject({ health: 80, attack: 10, defense: 6 });
  });

  it("stops at a rejected command instead of creating a replacement route", () => {
    const scenario = createFloorScenario(BALANCE_TEST_SCENARIO.world);
    const replay = replayRoute(scenario.session, {
      id: "invalid-route",
      label: "Invalid route",
      commands: ["backward", "forward"],
      checkpoints: [{ id: "after-rejection", label: "After rejection", commandIndex: 2 }],
    });

    expect(routeCompleted(replay)).toBe(false);
    expect(replay.steps).toHaveLength(1);
    expect(replay.steps[0]).toMatchObject({ accepted: false, rejectionReason: "backwardNotAllowed" });
    expect(getRouteCheckpoint(replay, replay.plan.checkpoints[0]!)).toMatchObject({ reached: false });
  });
});
