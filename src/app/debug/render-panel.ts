/**
 * One self-contained preview of a world, for a workbench that wants to look at something.
 *
 * It hosts the scene renderer the game itself draws through, so a body judged here is the body that
 * ships. What a caller hands over each frame is a world — not a description of a picture. That is
 * the whole of the change from the panel this replaces, which took a scene the caller had projected
 * by hand and let it inject anything it liked into the picture.
 *
 * Authoring aids go on the overlay instead. A target marker, a swing's path, a distance ruler: none
 * of those are things in the room, and letting a workbench push them through the renderer meant the
 * renderer carried a channel that existed only for tools. The overlay is a 2D canvas over the
 * picture with the renderer's own projection handed to it, so an aid can still be pinned to a world
 * point while looking like the measurement it is.
 */

import { GAME_CATALOG } from "@/content/catalog";
import { MAPS } from "@/content/maps/map-library";
import { blocksVision, mainRoom } from "@/core/floor/maze";
import { createWorld, type World } from "@/core/world/world";
import { SceneRenderer, type ScenePoint } from "@/presentation/scene-3d/scene-renderer";

export type RenderPanelTiming = Readonly<{
  elapsedSeconds: number;
  frameSeconds: number;
}>;

/** Turns a world point into a screen point, or nothing when it is behind the eye. */
export type RenderPanelProjection = (point: Readonly<{ x: number; y: number; z: number }>) => ScenePoint | undefined;

export type RenderPanelFrame = Readonly<{
  world: World;
  /**
   * Seconds to advance animation that runs on its own clock. Defaults to the frame's own length; a
   * workbench scrubbing a clip by hand passes zero and drives the pose from simulation state.
   */
  deltaSeconds?: number;
  /** Measurement marks drawn over the picture, in the overlay's own pixels. */
  overlay?: (context: CanvasRenderingContext2D, project: RenderPanelProjection) => void;
}>;

export type RenderPanelOptions = Readonly<{
  ariaLabel: string;
  /**
   * The renderer is handed over so a workbench can preview a number it has not saved yet.
   *
   * That is the one thing an overlay cannot do: an unsaved attack or an unsaved body height is not a
   * mark over the picture, it is the picture. Setting it here rather than on change keeps the panel
   * from owning a lifecycle — both overrides are idempotent, and what is on screen is always what
   * the controls currently say.
   */
  frame: (timing: RenderPanelTiming, renderer: SceneRenderer) => RenderPanelFrame;
}>;

export type RenderPanel = Readonly<{
  element: HTMLDivElement;
  close: () => void;
}>;

/**
 * The floor a workbench looks at things on.
 *
 * An authored open room rather than the map a run plays, and that is the whole point: a generated
 * dungeon puts the eye at a random arrival facing a random way, so the same slider value showed a
 * different picture on every reload and half of them were a wall at arm's length. An empty box of a
 * known size is reproducible, and reproducible is the entire job of a surface for tuning a position.
 */
const TESTBED_MAP_NAME = "sandbox";

/**
 * A world for a workbench to pose, and where in it the eye stands.
 *
 * A real world, built by the game's own rules on that authored room, because the alternative is a
 * hand-assembled stage that agrees with the game right up until the day it quietly stops.
 *
 * Two fixtures are pushed out of shot on the way, the way the filming stage already pushes them: a
 * floor is built with a way down and a plinth whether or not anything wants them, and neither is a
 * thing this room is for. `TODO.md` carries the decision about a floor that could say it is not a
 * dungeon; until that lands, moving them onto a boundary cell is what a surface like this does.
 */
export type WorkbenchStage = Readonly<{
  world: World;
  /** Where the eye stands and which way it faces. Fixed, so a distance means the same thing twice. */
  eye: Readonly<{ x: number; y: number; angle: number }>;
}>;

export function createWorkbenchStage(): WorkbenchStage {
  const map = MAPS.find((entry) => entry.name === TESTBED_MAP_NAME);

  if (!map) {
    throw new Error(`render panel: no map named "${TESTBED_MAP_NAME}" to build a workbench floor from`);
  }

  const world = createWorld(map, GAME_CATALOG);
  const offstage = { x: 0, y: 0 };
  world.maze = { ...world.maze, exit: offstage };
  world.altar = { ...world.altar, x: offstage.x + 0.5, y: offstage.y + 0.5 };
  world.enemies.length = 0;
  world.deaths.length = 0;
  world.props.length = 0;
  // Standing on the near edge of the interior looking straight up it, so anything a caller places
  // along that line is in front of the eye with the far wall behind it. Taken from the assembled
  // room rather than from the map's extent, because the room is centred in the grid and a cell
  // counted off the extent lands in masonry. A quarter turn back from zero points along negative Y,
  // which is up the room from its south side.
  const room = mainRoom(world.maze);
  const eye = { x: Math.floor((room.minX + room.maxX) / 2) + 0.5, y: room.maxY + 0.5, angle: -Math.PI / 2 };
  world.player.x = eye.x;
  world.player.y = eye.y;
  world.player.angle = eye.angle;
  world.player.pitch = 0;
  // Nothing thinks. A body being judged should hold the pose it was put in rather than walk off.
  world.mindsFrozen = true;
  return { world, eye };
}

/** How many headings the sweep below tries, and how far down each. Fine enough to find a corridor. */
const VIEW_HEADINGS = 64;
const VIEW_REACH = 24;

/**
 * The heading from the eye with the most floor in front of it.
 *
 * A run starts facing a random way, which is right for a run and useless for a preview: a carved
 * region is a maze, so from a cell picked at random almost every heading is a wall one step away, and
 * four times in five the preview opens on brickwork. Looking down the longest clear line instead puts
 * the floor on screen, and gives a workbench somewhere to stand a body where it can be seen.
 *
 * It asks the game's own question about what stops a look, so a heading this calls clear is one the
 * renderer will also draw as clear.
 */
export function openHeading(world: World): number {
  let best = world.player.angle;
  let bestReach = -1;

  for (let step = 0; step < VIEW_HEADINGS; step += 1) {
    const angle = (step / VIEW_HEADINGS) * Math.PI * 2;
    let reach = 0;

    while (reach < VIEW_REACH) {
      const x = world.player.x + Math.cos(angle) * (reach + 1);
      const y = world.player.y + Math.sin(angle) * (reach + 1);

      if (blocksVision(world.maze, Math.floor(x), Math.floor(y))) {
        break;
      }

      reach += 1;
    }

    if (reach > bestReach) {
      bestReach = reach;
      best = angle;
    }
  }

  return best;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createRenderPanel(options: RenderPanelOptions): RenderPanel {
  const element = document.createElement("div");
  const viewport = document.createElement("div");
  const marks = document.createElement("canvas");
  const status = document.createElement("p");
  let animationFrame = 0;
  let closed = false;
  let previousFrame: number | undefined;
  let startedAt: number | undefined;
  let renderer: SceneRenderer | undefined;

  element.className = "render-panel";
  element.dataset.state = "loading";
  viewport.className = "render-panel__viewport";
  viewport.setAttribute("aria-label", options.ariaLabel);
  marks.className = "render-panel__marks";
  status.className = "render-panel__status";
  status.setAttribute("role", "status");
  status.textContent = "Loading renderer…";
  element.append(viewport, marks, status);

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("pagehide", close);
    element.dataset.state = "closed";
    renderer?.dispose();
  };

  try {
    renderer = new SceneRenderer(viewport);
  } catch (error: unknown) {
    element.dataset.state = "error";
    status.setAttribute("role", "alert");
    status.textContent = `Unable to start renderer: ${errorMessage(error)}`;
    return { element, close };
  }

  const live = renderer;
  window.addEventListener("pagehide", close, { once: true });

  const drawMarks = (frame: RenderPanelFrame): void => {
    const width = Math.max(1, viewport.clientWidth);
    const height = Math.max(1, viewport.clientHeight);

    if (marks.width !== width || marks.height !== height) {
      marks.width = width;
      marks.height = height;
    }

    const context = marks.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);

    if (!frame.overlay) {
      return;
    }

    // No scaling: the renderer answers in viewport pixels, which is the size this canvas already is.
    frame.overlay(context, (point) => live.project(point));
  };

  // Waited on for the same reason the game waits: bodies are cloned from an armature that arrives
  // over the network, and a workbench for judging bodies that opens without them is worse than one
  // that opens a beat late.
  void live.ready
    .then(() => {
      if (closed) {
        return;
      }

      element.dataset.state = "ready";
      status.textContent = "Renderer ready.";

      const render = (now: number): void => {
        if (closed) {
          return;
        }

        startedAt ??= now;
        const timing = {
          elapsedSeconds: (now - startedAt) / 1000,
          frameSeconds: previousFrame === undefined ? 0 : Math.min(0.1, (now - previousFrame) / 1000),
        };
        previousFrame = now;

        try {
          const frame = options.frame(timing, live);
          live.render(frame.world, { deltaSeconds: frame.deltaSeconds ?? timing.frameSeconds, turnRate: 0 });
          drawMarks(frame);
        } catch (error: unknown) {
          element.dataset.state = "error";
          status.setAttribute("role", "alert");
          status.textContent = `Renderer stopped: ${errorMessage(error)}`;
          return;
        }

        animationFrame = window.requestAnimationFrame(render);
      };

      animationFrame = window.requestAnimationFrame(render);
    })
    .catch((error: unknown) => {
      if (closed) {
        return;
      }

      element.dataset.state = "error";
      status.setAttribute("role", "alert");
      status.textContent = `Unable to load renderer: ${errorMessage(error)}`;
    });

  return { element, close };
}
