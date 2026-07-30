import { resolveDebugRoute } from "@/app/debug/debug-router";
import { DEBUG_TOOLS } from "@/app/debug/debug-tools";
import { describe, expect, it } from "vitest";

describe("resolveDebugRoute", () => {
  it("renders the hub for the bare debug namespace", () => {
    expect(resolveDebugRoute("/debug")).toEqual({ kind: "hub" });
  });

  it("resolves the Floor Set Workbench from the shared debug catalog", () => {
    const route = resolveDebugRoute("/debug/floor-workbench");

    expect(route.kind).toBe("tool");

    if (route.kind === "tool") {
      expect(route.tool).toMatchObject({
        id: "floor-workbench",
        path: "/debug/floor-workbench",
        title: "Floor Set Workbench",
      });
    }
  });

  it("resolves the HUD Workbench from the shared debug catalog", () => {
    const route = resolveDebugRoute("/debug/hud-attack-workbench");

    expect(route.kind).toBe("tool");

    if (route.kind === "tool") {
      expect(route.tool).toMatchObject({
        id: "hud-attack-workbench",
        path: "/debug/hud-attack-workbench",
        title: "HUD Workbench",
      });
    }
  });

  it("resolves the Entity Workbench from the shared debug catalog", () => {
    const route = resolveDebugRoute("/debug/entity-workbench");

    expect(route.kind).toBe("tool");

    if (route.kind === "tool") {
      expect(route.tool).toMatchObject({
        id: "entity-workbench",
        path: "/debug/entity-workbench",
        title: "Entity Workbench",
      });
    }
  });

  it.each(["/debug/unknown", "/debug/floor-workbench/"])(
    "falls back to the hub for an unknown exact path: %s",
    (pathname) => {
      expect(resolveDebugRoute(pathname)).toEqual({ kind: "hub" });
    },
  );

  it.each(DEBUG_TOOLS)("keeps the registered $id tool reachable from its exact catalog path", (tool) => {
    expect(resolveDebugRoute(tool.path)).toEqual({ kind: "tool", tool });
  });
});
