/**
 * Which development scene an address means, and what a run opened there is handed.
 *
 * A scene is the real game at an address of its own, with a session's worth of rules over it. This
 * module is where the five things a scene owns meet: its address and the floor it opens are the
 * catalog entry below, and how it is dressed, which keys it adds and what the screen shows by default
 * are the hooks the entry defers to. Before this existed they were five facts in five files, joined by
 * a map name the play surface compared against — which is exactly the comparison a second scene would
 * have had to double.
 *
 * Two shapes of address, because the two kinds of scene want different things. A named scene is an
 * exact path with a floor and rules of its own. A testbed is a namespace: the rest of the path is a
 * map name and there are no rules at all, which is the whole point of it — it is the control group a
 * dressed scene is read against, and it stays plain so that a difference between them is the dressing.
 *
 * Nothing here is production-reachable. `src/app/main.ts` crosses into this subtree behind a
 * development guard and through a deferred import, exactly as it crosses into the debug tools.
 */

import type { MountGameOptions } from "@/runtime/surface";
import type { SceneHooks } from "@/runtime/scene-hooks";

export type SceneEntry = Readonly<{
  id: string;
  /** Matched exactly. A scene is one address, not a namespace; testbeds are the namespace case below. */
  path: string;
  /** The floor it opens. Named here rather than inside the scene, so an address and its floor are read together. */
  mapName: string;
  /** What a listing calls it. Here rather than in the listing, so a scene is named in one place. */
  title: string;
  /** What the session is for. Not a restatement of the address — a reader can already see that. */
  description: string;
  load: () => Promise<SceneHooks>;
}>;

/**
 * Every named scene. Adding one is this list plus a hooks module, and nothing in the play surface.
 *
 * Exported because the development console's scene index renders from it. That listing reads the
 * plain fields only and never calls `load` — a directory that loaded every scene's rules to print
 * their names would make the deferral here decorative.
 */
export const SCENES: readonly SceneEntry[] = [
  {
    id: "soundstage",
    path: "/soundstage",
    mapName: "stage",
    title: "Soundstage",
    description:
      "The filming stage: arrival fixed, descent and plinth offstage, minds frozen, instruments hidden, and a cast stepped and restaged from the keys.",
    load: () => import("@/app/scene/soundstage").then(({ SOUNDSTAGE }) => SOUNDSTAGE),
  },
];

const TESTBED_PREFIX = "/testbed";

/**
 * The address that opens one map as a plain testbed.
 *
 * The inverse of `testbedMapName` below, and it lives beside it so the prefix and the escaping are
 * decided once. A caller building this string itself is a second owner of the address form.
 */
export function testbedPath(mapName: string): string {
  return `${TESTBED_PREFIX}/${encodeURIComponent(mapName)}`;
}

/**
 * The map named by a testbed address, if it names one.
 *
 * Decoding can fail on a malformed escape, and a typed address is exactly where malformed escapes come
 * from. The raw segment is used when it does: an unknown map already has a forgiving answer, and
 * crashing the mount over a stray percent sign would be a worse one.
 */
function testbedMapName(pathname: string): string | undefined {
  const segment = pathname.slice(TESTBED_PREFIX.length + 1);

  if (segment.length === 0) {
    return undefined;
  }

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * What to open for one scene pathname.
 *
 * An address inside the scene namespaces that matches no entry falls back to ordinary play rather than
 * failing. A mistyped scene should start the game and be visibly not the scene, because the
 * alternative is a blank page that looks like the build is broken — the same reason an unknown map
 * name plays the default floor.
 */
export async function resolveScene(pathname: string): Promise<MountGameOptions> {
  const entry = SCENES.find((scene) => scene.path === pathname);

  if (entry) {
    return { mapName: entry.mapName, scene: await entry.load() };
  }

  if (pathname === TESTBED_PREFIX || pathname.startsWith(`${TESTBED_PREFIX}/`)) {
    return { mapName: testbedMapName(pathname) };
  }

  return {};
}
