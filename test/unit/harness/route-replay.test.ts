import { replayProvisionalRoute, PROVISIONAL_ROUTE } from "@/harness/provisional-route";
import { getRouteCheckpoint, replayRoute, routeCompleted } from "@/harness/route-replay";
import { createFloorScenario } from "@/harness/floor-scenario";
import { describe, expect, it } from "vitest";

describe("provisional route replay", () => {
  it("reaches victory deterministically through canonical commands and checkpoints", () => {
    const first = replayProvisionalRoute();
    const second = replayProvisionalRoute();
    const blueDoor = getRouteCheckpoint(
      first,
      PROVISIONAL_ROUTE.checkpoints.find((checkpoint) => checkpoint.id === "b2-blue-door")!,
    );
    const finalCheckpoint = getRouteCheckpoint(first, PROVISIONAL_ROUTE.checkpoints.at(-1)!);

    expect(first).toEqual(second);
    expect(routeCompleted(first)).toBe(true);
    expect(first.steps).toHaveLength(PROVISIONAL_ROUTE.commands.length);
    expect(first.steps.every((step) => step.accepted)).toBe(true);
    expect(blueDoor.snapshot.player).toMatchObject({ attack: 5, defense: 0, keys: { red: 0, blue: 0, yellow: 0 } });
    expect(finalCheckpoint).toMatchObject({ reached: true, snapshot: { outcome: "victory" } });
    expect(finalCheckpoint.snapshot.player).toMatchObject({ health: 80, attack: 10, defense: 6 });
  });

  it("stops at a rejected command instead of creating a replacement route", () => {
    const scenario = createFloorScenario();
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
