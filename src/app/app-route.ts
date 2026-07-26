export type AppRoute = "ordinary" | "debug";

/** Selects the ordinary or development-only application surface for one pathname. */
export function resolveAppRoute(pathname: string, isDevelopment: boolean): AppRoute {
  if (!isDevelopment) {
    return "ordinary";
  }

  return pathname === "/debug" || pathname.startsWith("/debug/") ? "debug" : "ordinary";
}
