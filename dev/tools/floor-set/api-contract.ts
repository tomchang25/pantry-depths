/**
 * The development-only floor authoring endpoint namespace.
 *
 * This is the single owning declaration. The Vite development middleware and the request handler both
 * import it. The workbench client keeps its own literal because client code must not import `dev/`;
 * a unit test holds that one remaining copy equal to this value.
 */
export const FLOOR_AUTHORING_API_ROOT = "/__debug/floor-set";

/** The one path the authoring API is allowed to read from and write to. */
export const CANONICAL_FLOOR_SET_PATH = "src/content/floors/provisional-floor-set.json";
