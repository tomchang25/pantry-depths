/**
 * The demo surface: DOM, input, and the frame loop.
 *
 * Pointer lock drives the view, WASD drives the feet, and the two mouse buttons drive everything
 * else. Nothing here is shared with the shipped play surface — this file exists so the shipped one
 * never has to learn what a mouse-look is.
 */

import "@/demo/demo-surface.css";

import { grabAction, primaryAction, PROP_LABELS } from "@/demo/actions";
import { BLESS_CATALOG, hasBless, findBless, type BlessDefinition } from "@/demo/bless";
import { mountDemoDevOverlay } from "@/demo/demo-dev-overlay";
import { runEndOverlay } from "@/demo/extraction";
import { mountDemoHud, type DemoHudCard, type DemoHudHeld, type DemoHudModel } from "@/demo/demo-hud";
import type { DemoArchetypeId } from "@/demo/enemy-archetypes";
import { createDemoEffects, createDemoScene } from "@/demo/demo-scene";
import { loadDemoImages } from "@/demo/demo-sprites";
import { drawDemoViewmodel } from "@/demo/demo-viewmodel";
import { DEMO_GRID_SIZE } from "@/demo/maze";
import { stepDemoWorld, type DemoInput } from "@/demo/simulation";
import type { DemoPropKind } from "@/demo/throw-weight";
import { announce, createDemoWorld, flattenFloorForTesting, type DemoWorld } from "@/demo/world";
import { CanvasGameplayRenderer } from "@/presentation/canvas-gameplay-renderer";

export type MountedDemo = Readonly<{ dispose: () => void }>;

const MOUSE_SENSITIVITY = 0.0026;
/**
 * Vertical look limits, asymmetric on purpose.
 *
 * Pitch is a shear, not a rotation, and shear artefacts are one-sided: looking down magnifies the
 * floor at the screen edge into smeared blocks and leaves billboards drawn front-on over a floor
 * seen from above, while looking up only ever shows more sky — which has no geometry to distort.
 * So the downward limit stops just short of the feet, and the upward one only stops the number
 * growing without limit while the mouse keeps travelling.
 */
const MAX_PITCH_UP = 1.5;
const MAX_PITCH_DOWN = 0.48;
/** Mouse counts per second that read as a full-speed turn, for the comfort vignette. */
const FULL_TURN_RATE = 2600;

const MOVEMENT_KEYS: Readonly<Record<string, keyof DemoInput>> = {
  w: "forward",
  s: "backward",
  a: "strafeLeft",
  d: "strafeRight",
  arrowup: "forward",
  arrowdown: "backward",
  arrowleft: "strafeLeft",
  arrowright: "strafeRight",
};

function suppressContextMenu(event: MouseEvent): void {
  event.preventDefault();
}

const ENEMY_DOT_COLORS: Readonly<Record<DemoArchetypeId, string>> = {
  walker: "#7fc46a",
  ranged: "#5aa8e0",
  charger: "#e2585f",
  swordsman: "#d8c69a",
};

const MINIMAP_TILE_COLORS: Readonly<Record<string, string>> = {
  border: "#0b0710",
  stone: "#59506a",
  wood: "#7a5029",
  water: "#1c3f5e",
  barricade: "#6b4526",
  mortar: "#b8863c",
  open: "#241a2e",
};

function cardModel(token: string): DemoHudCard {
  const definition = token === "overflow" ? undefined : findBless(token as BlessDefinition["id"]);

  if (definition) {
    return {
      color: definition.color,
      detail: definition.detail,
      glyph: definition.glyph,
      name: definition.name,
    };
  }

  return {
    color: "#f0f0d0",
    detail: "Every blessing collected — max HP rises instead",
    glyph: "+",
    name: "Vitality",
  };
}

/**
 * A mark per kind for the left hand.
 *
 * Provisional and deliberately local: the moment authored decor presets can carry a HUD glyph, the
 * table belongs with them rather than beside the frame loop.
 */
const PROP_GLYPHS: Readonly<Record<DemoPropKind, string>> = {
  stick: "↑",
  rock: "●",
  bomb: "✸",
  axe: "⚒",
  skeletonSword: "†",
  skeletonSkull: "☠",
  skeletonFemur: "⌇",
  skeletonFemurCracked: "⌇",
  skeletonJavelin: "⇡",
  skeletonJavelinCracked: "⇡",
  crossbow: "⌖",
  crossbowSpent: "⌖",
  crossbowBolt: "⇡",
};

/** Ammunition by what it is made of, explosives apart, so a stack reads before it is named. */
const PROP_COLORS: Readonly<Record<DemoPropKind, string>> = {
  stick: "#e6d3a6",
  rock: "#c9c2b4",
  bomb: "#e2585f",
  axe: "#cfd8e2",
  skeletonSword: "#cfd8e2",
  skeletonSkull: "#dcd0b4",
  skeletonFemur: "#dcd0b4",
  skeletonFemurCracked: "#dcd0b4",
  skeletonJavelin: "#efe6cf",
  skeletonJavelinCracked: "#c6bda6",
  crossbow: "#d9cdae",
  crossbowSpent: "#a89d88",
  crossbowBolt: "#e8e0c8",
};

function heldModel(world: DemoWorld): DemoHudHeld | undefined {
  const held = world.held;

  if (!held) {
    return undefined;
  }

  // A carried body is one body, so it has no count. Only a stack of ammunition does.
  if (held.kind === "enemy") {
    return {
      color: ENEMY_DOT_COLORS[held.enemy.archetype.id],
      glyph: "✦",
      name: held.enemy.archetype.name,
    };
  }

  return {
    color: PROP_COLORS[held.prop] ?? "#e6d3a6",
    count: held.count,
    glyph: PROP_GLYPHS[held.prop] ?? "●",
    name: PROP_LABELS[held.prop] ?? held.prop,
  };
}

function createHudModel(
  world: DemoWorld,
  cardToken: string | undefined,
  overlay: DemoHudModel["overlay"],
): DemoHudModel {
  const blessIcons = BLESS_CATALOG.map((definition) => ({
    color: definition.color,
    detail: definition.detail,
    glyph: definition.glyph,
    name: definition.name,
    owned: hasBless(world.bless, definition.id),
  }));

  if (world.bless.overflowMaxHp > 0) {
    blessIcons.push({ color: "#f0f0d0", detail: "Extra max HP", glyph: "+", name: "Vitality", owned: true });
  }

  // What a side room holds is never on here — not the altars, not the spring, not the way out. Four
  // rooms hang off a floor and which one holds what is the thing the floor charges time to learn; a dot
  // on the map hands all four back. The descent appears only once the main task has been met.
  const points = [
    ...(world.maze.progress.main.met
      ? [{ x: world.maze.exit.x + 0.5, y: world.maze.exit.y + 0.5, radius: 4, color: "#7fd8a2" }]
      : []),
    { x: world.maze.entrance.x + 0.5, y: world.maze.entrance.y + 0.5, radius: 3, color: "#a789d4" },
    ...world.props.map((prop) => ({ x: prop.x, y: prop.y, radius: 1.6, color: "#e6d3a6" })),
    ...world.enemies.map((enemy) => ({
      x: enemy.x,
      y: enemy.y,
      radius: 2.6,
      color: ENEMY_DOT_COLORS[enemy.archetype.id],
    })),
  ];

  const held = heldModel(world);
  return {
    blessIcons,
    ...(cardToken ? { card: cardModel(cardToken) } : {}),
    ...(held ? { held } : {}),
    hp: world.player.hp,
    maxHp: world.player.maxHp,
    ...(world.messageSeconds > 0 && world.message ? { message: world.message } : {}),
    minimap: {
      facingAngle: world.player.angle,
      height: DEMO_GRID_SIZE,
      player: { x: world.player.x, y: world.player.y, radius: 3, color: "#ffe6b0" },
      points,
      tileColors: MINIMAP_TILE_COLORS,
      tiles: world.maze.tiles.map((tile) => tile.kind),
      width: DEMO_GRID_SIZE,
    },
    ...(overlay ? { overlay } : {}),
  };
}

export async function mountDemo(mount: HTMLElement): Promise<MountedDemo> {
  const surface = document.createElement("main");
  const canvas = document.createElement("canvas");
  const hud = mountDemoHud();
  // After the HUD, never before it: the pause overlay is a full-surface button, and anything
  // painted under it has its clicks taken by the thing that re-locks the pointer.
  const dev = mountDemoDevOverlay();
  surface.className = "demo";
  canvas.className = "demo__canvas";
  surface.append(canvas, hud.element, dev.element);
  mount.replaceChildren(surface);

  const images = await loadDemoImages();
  const renderer = new CanvasGameplayRenderer(canvas, images);
  // The demo runs a real-time camera, so half the plane resolution — both axes, keeping the coarse
  // pixels square — buys frames the turn-based game has no need to buy.
  renderer.halvePlaneRows = true;
  renderer.halvePlaneColumns = true;
  const sceneContext = canvas.getContext("2d");

  if (!sceneContext) {
    throw new Error("demo: scene canvas is unavailable");
  }

  let world = createDemoWorld();
  let disposed = false;
  let frame = 0;
  let lastTime: number | undefined;
  let cardTimer: number | undefined;
  let activeCardToken: string | undefined;
  /** Retry loop for taking the pointer back; see `beginRelock`. */
  let relockTimer: number | undefined;
  /**
   * The Escape that releases the pointer sometimes reaches the page after the lock has already
   * dropped, where it reads as a fresh press and relocks immediately — pausing then looks like it
   * never happened. Escapes are ignored until this stamp, set when the lock is released.
   */
  let suppressEscapeUntil = 0;
  /**
   * Paused while the pointer stays locked, toggled by Tab.
   *
   * Deliberately not the Escape path: releasing the pointer is a browser affair with a forced
   * relock cooldown, so the pause that has to feel instant both ways keeps the lock and never
   * meets that cooldown at all.
   */
  let paused = false;
  /** Exponentially smoothed, because a raw per-frame reciprocal is unreadable noise. */
  let smoothedFps = 60;
  /** Mouse counts since the last frame, and the smoothed rate the comfort vignette reads. */
  let turnInput = 0;
  let turnRate = 0;
  const input: { forward: boolean; backward: boolean; strafeLeft: boolean; strafeRight: boolean } = {
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
  };

  /** Development-only handle so a run can be poked at from the console or a browser test. */
  const publish = (): void => {
    if (import.meta.env.DEV) {
      (window as unknown as { demoWorld?: DemoWorld }).demoWorld = world;
      (window as unknown as { demoRenderer?: CanvasGameplayRenderer }).demoRenderer = renderer;
    }
  };

  const clearInput = (): void => {
    input.forward = false;
    input.backward = false;
    input.strafeLeft = false;
    input.strafeRight = false;
  };

  const locked = (): boolean => document.pointerLockElement === canvas;

  const overlayModel = (): DemoHudModel["overlay"] => {
    if (world.status !== "playing") {
      return runEndOverlay(world);
    }

    if (!locked()) {
      return {
        title: "Pantry Depths — Demo",
        body: "Click the screen or press Esc to start. WASD move · mouse to look · Left attack / throw · Right grab / drop · Tab pause · R restart · Esc release the mouse. Four rooms hang off the floor and nothing says which is which — walk in and look. The red altar wants breaking, the white one wants holding, the spring heals, and the green smoke is the way out with everything you are carrying.",
      };
    }

    if (paused) {
      return { title: "Paused", body: "Tab to resume · Esc to release the mouse · R to restart" };
    }

    return undefined;
  };

  const refreshHud = (): void => hud.update(createHudModel(world, activeCardToken, overlayModel()));
  const refreshDev = (): void =>
    dev.update({ enemiesPaused: world.enemiesPaused, fps: smoothedFps, godMode: world.godMode });

  /**
   * Shows the award card for a few seconds.
   *
   * The world only ever raises a flag; the card, its timer, and its removal all live here so the
   * simulation never has to know how long a piece of user interface stays on screen.
   */
  const showCard = (token: string): void => {
    activeCardToken = token;

    if (cardTimer !== undefined) {
      window.clearTimeout(cardTimer);
    }

    cardTimer = window.setTimeout(() => {
      activeCardToken = undefined;
      refreshHud();
    }, 5000);
    refreshHud();
  };

  const restart = (): void => {
    // A cheat is a property of the session, not of the run. Losing god mode on every R would make it
    // useless for exactly the thing it is for: dying repeatedly on purpose.
    const carriedGodMode = world.godMode;
    world = createDemoWorld();
    world.godMode = carriedGodMode;
    paused = false;
    clearInput();
    publish();
    activeCardToken = undefined;
    refreshHud();
  };

  const toggleGodMode = (): void => {
    world.godMode = !world.godMode;
    announce(world, world.godMode ? "God mode on (G to turn it off)" : "God mode off", 2.5);
    refreshDev();
  };

  const tick = (now: number): void => {
    if (disposed) {
      return;
    }

    frame = window.requestAnimationFrame(tick);
    const deltaSeconds = lastTime === undefined ? 0 : Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (deltaSeconds > 0.0005) {
      smoothedFps += (1 / deltaSeconds - smoothedFps) * 0.08;
      // Rises quickly and falls slowly, so the frame does not breathe every time the mouse pauses.
      const instant = Math.min(1, turnInput / deltaSeconds / FULL_TURN_RATE);
      turnRate += (instant - turnRate) * (instant > turnRate ? 0.4 : 0.06);
    }

    turnInput = 0;

    const active = locked() && world.status === "playing" && !paused;

    // Releasing the mouse or pausing stops the world outright, not just the player's hands:
    // enemies, timers, projectiles and particles all hold still behind the overlay until play
    // resumes. A dead world still steps, so the death's debris settles behind its own overlay.
    if (active || world.status !== "playing") {
      stepDemoWorld(
        world,
        active ? input : { forward: false, backward: false, strafeLeft: false, strafeRight: false },
        deltaSeconds,
      );
    }
    renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    const scene = createDemoScene(world);
    renderer.render(scene, world.elapsedSeconds, createDemoEffects(world), {
      reducedMotion: false,
      grade: true,
      turnRate,
    });
    // Where the swing landed, in screen space, so the arm and the arc can be aimed at it.
    const target = world.swingTarget;
    const aim = target ? renderer.project(scene, target) : undefined;
    drawDemoViewmodel(sceneContext, images, world, aim ? { x: aim.screenX, y: aim.screenY } : undefined);
    if (world.pendingCard !== undefined) {
      showCard(world.pendingCard);
      world.pendingCard = undefined;
    }
    refreshHud();
    refreshDev();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    // An Escape with the overlay up is a request to go back in — the same thing as clicking it.
    // Guarded by the suppression stamp so the tail of the Escape that opened the overlay is not
    // mistaken for that request.
    if (key === "escape") {
      if (!locked() && performance.now() >= suppressEscapeUntil) {
        event.preventDefault();

        if (world.status !== "playing") {
          restart();
        }

        beginRelock();
      }

      return;
    }

    // Pause without giving the pointer up, so resuming never meets the browser's relock cooldown.
    if (key === "tab") {
      event.preventDefault();

      if (locked() && world.status === "playing") {
        paused = !paused;
        refreshHud();
      }

      return;
    }

    if (key === "r") {
      event.preventDefault();
      restart();
      return;
    }

    // The frame-rate worst case on demand: an arena with no occlusion and a full crowd.
    if (key === "t") {
      event.preventDefault();
      flattenFloorForTesting(world);
      return;
    }

    // Freezes the enemies to split a frame-rate dip into its enemy and non-enemy halves.
    if (key === "p") {
      event.preventDefault();
      world.enemiesPaused = !world.enemiesPaused;
      announce(world, world.enemiesPaused ? "Enemies frozen (P to resume)" : "Enemies moving again", 2.5);
      refreshDev();
      return;
    }

    // Takes every hit and keeps every point. The key is the one that matters — the overlay's button
    // cannot be reached while the pointer is locked, which is most of the time.
    if (key === "g") {
      event.preventDefault();
      toggleGodMode();
      return;
    }

    const binding = MOVEMENT_KEYS[key];

    if (binding) {
      event.preventDefault();
      input[binding] = true;
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    const binding = MOVEMENT_KEYS[event.key.toLowerCase()];

    if (binding) {
      input[binding] = false;
    }
  };

  const handleMouseMove = (event: MouseEvent): void => {
    // A paused world holds the view still too; the head is part of what pausing freezes.
    if (!locked() || paused) {
      return;
    }

    const turned = world.player.angle + event.movementX * MOUSE_SENSITIVITY;
    // Wrapped rather than accumulated: a long session spinning one way otherwise walks the angle out
    // to where float precision starts coarsening the turn.
    world.player.angle = turned - Math.PI * 2 * Math.floor(turned / (Math.PI * 2));
    turnInput += Math.abs(event.movementX) + Math.abs(event.movementY) * 0.5;
    world.player.pitch = Math.max(
      -MAX_PITCH_DOWN,
      Math.min(MAX_PITCH_UP, world.player.pitch - event.movementY * MOUSE_SENSITIVITY * 0.42),
    );
  };

  const handleMouseDown = (event: MouseEvent): void => {
    if (!locked() || paused) {
      return;
    }

    event.preventDefault();

    if (event.button === 0) {
      primaryAction(world);
      return;
    }

    if (event.button === 2) {
      grabAction(world);
    }
  };

  /**
   * Locks with raw device movement.
   *
   * The default lock derives `movementX`/`movementY` from the operating system cursor, which is
   * still a real cursor sitting somewhere on the desktop. Once it drifts into a screen edge the
   * deltas going that way clamp to zero, and the view stops turning right or up while the other
   * directions keep working — releasing the lock recentres the cursor, which is why Escape and
   * re-click appeared to fix it. Unadjusted movement reads the device instead and has no edge.
   */
  const requestLook = (): void => {
    const request = canvas.requestPointerLock({ unadjustedMovement: true }) as unknown;

    if (request instanceof Promise) {
      request.catch(() => {
        // Not every platform exposes raw input; an ordinary lock is still better than none. This
        // can also fail — the browser refuses relocks briefly after an Escape exit — and that is
        // fine: the overlay stays up and the next press gets through.
        const fallback = canvas.requestPointerLock() as unknown;

        if (fallback instanceof Promise) {
          fallback.catch(() => undefined);
        }
      });
    }
  };

  /**
   * Asks for the pointer until the browser hands it back.
   *
   * Chrome refuses relock requests for about a second and a quarter after the Escape that released
   * the pointer — even requests carrying a fresh gesture — so a single call silently loses the
   * press and the overlay "cannot be closed". A short retry loop turns that into the press simply
   * taking a beat, and stops the moment the lock lands, the deadline passes, or the run ends.
   */
  const beginRelock = (): void => {
    if (relockTimer !== undefined) {
      window.clearInterval(relockTimer);
      relockTimer = undefined;
    }

    requestLook();
    const deadline = performance.now() + 2400;
    relockTimer = window.setInterval(() => {
      if (locked() || performance.now() > deadline || world.status !== "playing" || disposed) {
        window.clearInterval(relockTimer);
        relockTimer = undefined;
        return;
      }

      requestLook();
    }, 300);
  };

  const handleOverlayClick = (): void => {
    if (world.status !== "playing") {
      restart();
    }

    // Through the same retry as the Escape path: a click right after an Escape exit sits inside
    // the same browser cooldown and would otherwise be lost too.
    beginRelock();
  };

  /**
   * The toggle, for when the pointer is free.
   *
   * The click is kept off the surface underneath so it cannot double as a request to go back in,
   * which is what a click anywhere else means while the overlay is up.
   */
  const handleGodModeClick = (event: MouseEvent): void => {
    event.stopPropagation();
    toggleGodMode();
  };

  const handleLockChange = (): void => {
    if (!locked()) {
      clearInput();
      suppressEscapeUntil = performance.now() + 400;
      // The unlocked overlay takes over from the paused one; coming back in resumes play.
      paused = false;
    }

    refreshHud();
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearInput);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("contextmenu", suppressContextMenu);
  document.addEventListener("pointerlockchange", handleLockChange);
  hud.overlayButton.addEventListener("click", handleOverlayClick);
  dev.godModeButton.addEventListener("click", handleGodModeClick);

  publish();
  refreshHud();
  refreshDev();
  frame = window.requestAnimationFrame(tick);

  return {
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frame);

      if (cardTimer !== undefined) {
        window.clearTimeout(cardTimer);
      }

      if (relockTimer !== undefined) {
        window.clearInterval(relockTimer);
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("contextmenu", suppressContextMenu);
      document.removeEventListener("pointerlockchange", handleLockChange);
      dev.godModeButton.removeEventListener("click", handleGodModeClick);
      hud.overlayButton.removeEventListener("click", handleOverlayClick);
      surface.remove();
    },
  };
}
