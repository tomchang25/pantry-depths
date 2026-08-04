import { resolveAppRoute } from "@/app/app-route";
import { describe, expect, it } from "vitest";

describe("resolveAppRoute", () => {
  it.each(["/debug", "/debug/combat", "/debug/unknown"])(
    "selects the development surface for the exact debug namespace: %s",
    (pathname) => {
      expect(resolveAppRoute(pathname, true)).toBe("debug");
    },
  );

  it.each(["/soundstage", "/testbed", "/testbed/circle-water", "/soundstage/unknown"])(
    "selects the scene surface for the exact scene namespaces: %s",
    (pathname) => {
      expect(resolveAppRoute(pathname, true)).toBe("scene");
    },
  );

  it.each(["/", "/play", "/debugger", "/testbedding", "/soundstages"])(
    "keeps non-namespace paths on the ordinary surface: %s",
    (pathname) => {
      expect(resolveAppRoute(pathname, true)).toBe("ordinary");
    },
  );

  it("does not let an ordinary-route query parameter activate development tooling", () => {
    const url = new URL("https://pantry.invalid/play?scenario=combat#debug");

    expect(resolveAppRoute(url.pathname, true)).toBe("ordinary");
  });

  it.each(["/debug", "/debug/combat", "/debug/unknown", "/soundstage", "/testbed/circle-water"])(
    "preserves the ordinary production route policy for %s",
    (pathname) => {
      expect(resolveAppRoute(pathname, false)).toBe("ordinary");
    },
  );
});
