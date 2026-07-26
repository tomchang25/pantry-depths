import { resolveDebugRoute } from "@/app/debug/debug-router";
import { describe, expect, it } from "vitest";

describe("resolveDebugRoute", () => {
  it("renders the hub for the bare debug namespace", () => {
    expect(resolveDebugRoute("/debug")).toEqual({ kind: "hub" });
  });

  it("resolves a registered tool by its exact catalog pathname", () => {
    const route = resolveDebugRoute("/debug/combat");

    expect(route.kind).toBe("tool");

    if (route.kind === "tool") {
      expect(route.tool).toMatchObject({
        id: "combat",
        path: "/debug/combat",
        title: "Combat Explorer",
      });
    }
  });

  it("resolves the Floor Set Viewer from the shared debug catalog", () => {
    const route = resolveDebugRoute("/debug/floors");

    expect(route.kind).toBe("tool");

    if (route.kind === "tool") {
      expect(route.tool).toMatchObject({
        id: "floors",
        path: "/debug/floors",
        title: "Floor Set Viewer",
      });
    }
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

  it.each(["/debug/unknown", "/debug/combat/"])("falls back to the hub for an unknown exact path: %s", (pathname) => {
    expect(resolveDebugRoute(pathname)).toEqual({ kind: "hub" });
  });
});
