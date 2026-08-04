/**
 * What a development scene may add to a run, and the whole of what the play surface knows about one.
 *
 * A scene is the real game opened at its own address with a session's worth of rules laid over it —
 * a room to film in, a floor to test a mind on. The surface holds none of those rules: it calls these
 * hooks where its own behaviour has a seam and is otherwise the same surface the shipped game mounts.
 *
 * The contract lives here and is implemented in `src/app/scene/`, which is the direction the import
 * boundaries allow — application composition reaches the runtime, never the reverse. That split is
 * also what keeps a scene out of the production bundle: the runtime carries a type, and the modules
 * that satisfy it are behind a development guard the shipped build never crosses.
 *
 * Every hook is optional, and a run with no scene at all passes none of them. That is the ordinary
 * game, and it is why adding a scene cannot change how the game plays.
 */

import type { World } from "@/core/world/world";

/**
 * A button on the instrument panel, run once.
 *
 * The world arrives as an argument rather than being captured, because the surface rebinds the world
 * it is playing on every restart — a command holding the world it was mounted with would act on the
 * run before the last one.
 */
export type SceneCommand = Readonly<{
  label: string;
  run(world: World): void;
}>;

export type SceneHooks = Readonly<{
  /**
   * Puts a freshly built floor into the state the scene opens on.
   *
   * Called at mount and again on every restart, so what a scene arranges survives R rather than being
   * a one-time arrangement the first death undoes.
   */
  dress?: (world: World) => void;
  /**
   * The scene's own keys, offered the press before the surface's bindings.
   *
   * Answers whether the key was taken. A taken key is not passed on and refreshes the panel, so a
   * scene never has to ask for a redraw.
   */
  onKey?: (world: World, key: string) => boolean;
  /** State rows for the instrument panel, read every frame. The count is fixed for a scene's life. */
  chips?: (world: World) => readonly string[];
  /** Commands for the instrument panel, fixed at mount. */
  commands?: readonly SceneCommand[];
  /** Whether the readouts and the panel start off screen, for a scene meant to be photographed. */
  instrumentsHidden?: boolean;
}>;
