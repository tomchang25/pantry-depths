export type AppRoute = "ordinary" | "debug" | "scene";

/**
 * The address namespaces that open a development scene.
 *
 * Matched the way the debug namespace is: the exact segment, or that segment followed by a slash, so
 * a path such as `/testbedding` stays an ordinary route. Which scene an address inside one of these
 * means is not this function's question — that belongs to the scene catalog, exactly as which tool a
 * debug path means belongs to the debug catalog.
 */
const SCENE_NAMESPACES = ["/soundstage", "/testbed"] as const;

/** Selects the ordinary, scene, or development-only application surface for one pathname. */
export function resolveAppRoute(pathname: string, isDevelopment: boolean): AppRoute {
  if (!isDevelopment) {
    return "ordinary";
  }

  if (pathname === "/debug" || pathname.startsWith("/debug/")) {
    return "debug";
  }

  if (SCENE_NAMESPACES.some((namespace) => pathname === namespace || pathname.startsWith(`${namespace}/`))) {
    return "scene";
  }

  return "ordinary";
}
