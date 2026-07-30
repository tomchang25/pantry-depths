/**
 * The demo surface: DOM, input, and the frame loop.
 *
 * Pointer lock drives the view, WASD drives the feet, and the two mouse buttons drive everything
 * else. Nothing here is shared with the shipped play surface — this file exists so the shipped one
 * never has to learn what a mouse-look is.
 */

import "@/demo/demo-surface.css";

import { PROP_KINDS } from "@/content/presentation/prop-display-schema";
import { grabAction, primaryAction, PROP_LABELS } from "@/demo/actions";
import { BLESS_CATALOG, hasBless, findBless, type BlessDefinition } from "@/demo/bless";
import { mountDemoDevOverlay } from "@/demo/demo-dev-overlay";
import { EXTRACTION_HOLD_SECONDS, extractionShare, runEndOverlay, SEALED_CARD_PREFIX } from "@/demo/extraction";
import {
  mountDemoHud,
  type DemoHudCard,
  type DemoHudChannel,
  type DemoHudHeld,
  type DemoHudModel,
  type DemoHudRun,
  type DemoHudTask,
} from "@/demo/demo-hud";
import type { DemoArchetypeId } from "@/demo/enemy-archetypes";
import { createDemoEffects, createDemoScene } from "@/demo/demo-scene";
import { loadDemoImages } from "@/demo/demo-sprites";
import { drawDemoViewmodel } from "@/demo/demo-viewmodel";
import { DEMO_GRID_SIZE, padRoomAt } from "@/demo/maze";
import { BLESSING_HOLD_SECONDS, HOT_SPRING_HEAL_PER_SECOND } from "@/demo/rooms";
import { LEVEL_CARD_PREFIX, runLevel } from "@/demo/run-level";
import { bankedRewards, equippedCore } from "@/demo/sealed";
import { stepDemoWorld, type DemoInput } from "@/demo/simulation";
import { TASK_LABELS } from "@/demo/tasks";
import type { DemoPropKind } from "@/demo/throw-weight";
import {
  announce,
  createDemoWorld,
  dropProp,
  flattenFloorForTesting,
  killEnemy,
  MAX_ENEMIES,
  runClockSeconds,
  spawnReinforcement,
  type DemoWorld,
} from "@/demo/world";
import { CanvasGameplayRenderer } from "@/presentation/canvas-gameplay-renderer";

export type MountedDemo = Readonly<{ dispose: () => void }>;

/**
 * Capture mode: `?capture` on a development build treats the pointer as locked from the first frame.
 *
 * The world then steps and no overlay covers the picture with nobody at the mouse, which is the one
 * thing a headless browser cannot arrange for itself — pointer lock needs a user gesture the
 * screenshot harness in `dev/tools/capture-scenes.mjs` does not have. Everything else the harness
 * does goes through the same keys and clicks a person uses. Production builds never read the flag.
 */
const captureMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has("capture");

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
  slimeGreen: "#7fc46a",
  slimeBlue: "#5f92d8",
  slimeRed: "#c9524f",
  swordsman: "#d8c69a",
  hammerman: "#e0a86a",
  javelineer: "#b7d0a0",
  crossbowman: "#a8c0e0",
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
  // The floor getting hungrier comes through the same channel a blessing does, and has to be told
  // apart from one before the catalogue is asked. It reads as the dungeon changing rather than as the
  // player gaining something, because that is what happened: the number rose off minutes spent and
  // floors taken, both of which are costs.
  if (token.startsWith(LEVEL_CARD_PREFIX)) {
    const level = token.slice(LEVEL_CARD_PREFIX.length);
    return {
      color: "#e2585f",
      detail: `Threat ${level}. Whatever is down here has been given time, and it has used it.`,
      glyph: "☠",
      name: "The depths stir",
    };
  }

  // Taking a sealed reward is the one thing a run is actually for, and it used to arrive on the same
  // line a reinforcement crawling out uses. A card, on the same channel a blessing gets, and worded so
  // that what a cursed one risks is on screen at the moment it is taken rather than at the moment it
  // is opened.
  if (token.startsWith(SEALED_CARD_PREFIX)) {
    const cursed = token.slice(SEALED_CARD_PREFIX.length) === "cursed";
    return {
      color: cursed ? "#e2585f" : "#9fe0d0",
      detail: cursed
        ? "It opens only if you walk out with it, and a cursed one can roll worse than nothing at all."
        : "It opens only if you walk out with it. Die down here and it is gone unopened.",
      glyph: "◈",
      name: cursed ? "Cursed seal taken" : "Clean seal taken",
    };
  }

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
  hammer: "⚒",
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
  hammer: "#cfd8e2",
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

/** Far enough out that the ring lands around the player rather than under their feet. */
const KIT_RADIUS = 1.3;

/**
 * How many uses each pile in the debug kit holds. Anything absent is a single one.
 *
 * Matched to what the game itself hands out, so a crossbow picked up from here fires the same three
 * times one taken off a body does. A kit that was more generous than the floor would be answering a
 * different question than the one being debugged.
 */
const KIT_COUNTS: Readonly<Partial<Record<DemoPropKind, number>>> = {
  bomb: 3,
  crossbow: 3,
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

function clockText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The run's own line: level, clock, floor, and the core it is swinging.
 *
 * Seconds as well as minutes, because a level is bought a minute at a time and a readout that only
 * counted whole minutes could not say how close the next one was — which is the whole decision the
 * clock exists to inform. The core is here because a curse that can roll worse than clean is only a
 * curse if the player can see which way this one went.
 */
function runModel(world: DemoWorld, rising: boolean): DemoHudRun {
  const equipped = equippedCore();
  // The run's clock, not the world's. They part company the moment the run ends: the world keeps
  // ticking so the picture behind the end screen still breathes, and the readout must not.
  const seconds = runClockSeconds(world);
  const core = equipped
    ? {
        color: equipped.source === "cursed" ? "#e2585f" : "#9fe0d0",
        text: `${equipped.core.name} · ${Object.entries(equipped.rolls)
          .map(([axis, amount]) => `${axis === "maxHp" ? "HP" : "DMG"} ${(amount ?? 0) >= 0 ? "+" : ""}${amount}`)
          .join(" ")}`,
      }
    : undefined;

  return {
    clock: clockText(seconds),
    ...(core ? { core } : {}),
    depth: world.depth,
    level: runLevel({ depth: world.depth, elapsedSeconds: seconds }),
    rising,
  };
}

/** The floor's four demands, main first. Every counter behind them is one the floor already keeps. */
function taskModels(world: DemoWorld): DemoHudTask[] {
  const progress = world.maze.progress;
  return [progress.main, ...progress.secondary].map((task, index) => ({
    done: task.done,
    label: TASK_LABELS[task.kind],
    main: index === 0,
    met: task.met,
    target: task.target,
  }));
}

/**
 * What the pad under the player is doing, or nothing when they are not on one.
 *
 * Built here rather than by the systems that run the pads, because which of the three is talking is a
 * question about the player's feet and the three answers share one element. The constants come from
 * the modules that enforce them, so the bar cannot count down to a moment the simulation disagrees with.
 */
function channelModel(world: DemoWorld): DemoHudChannel | undefined {
  const room = padRoomAt(world.maze, Math.floor(world.player.x), Math.floor(world.player.y));
  const progress = world.maze.progress;

  // Every label names what the pad pays, and every detail names the rule that decides whether you get
  // it. "Holding the dais" told a first-time player what their feet were doing and nothing about why,
  // which is the one thing a five-second wait in a room full of bodies has to justify.
  if (room?.role === "extraction") {
    const sealed = world.carried.length;
    return {
      detail:
        sealed > 0
          ? `Hold 5s to end the run · ${sealed} sealed ${sealed === 1 ? "reward opens" : "rewards open"} the moment you are out`
          : "Hold 5s to end the run · you are carrying nothing sealed",
      label: "Walking out with the lot",
      remaining: `${Math.max(0, EXTRACTION_HOLD_SECONDS - progress.extractionSeconds).toFixed(1)}s`,
      share: extractionShare(world),
      tone: "extract",
    };
  }

  if (room?.role === "blessingAltar" && !progress.blessingTaken) {
    return {
      detail: `Stay on the dais ${BLESSING_HOLD_SECONDS}s · being hit does not break it, stepping off does`,
      label: "Claiming a blessing",
      remaining: `${Math.max(0, BLESSING_HOLD_SECONDS - progress.heldSeconds).toFixed(1)}s`,
      share: Math.min(1, progress.heldSeconds / BLESSING_HOLD_SECONDS),
      tone: "bless",
    };
  }

  if (room?.role === "hotSpring") {
    const full = world.player.hp >= world.player.maxHp;
    return {
      detail: full
        ? "Nothing left open to close · come back hurt"
        : `+${HOT_SPRING_HEAL_PER_SECOND} health a second while you stand in it`,
      label: full ? "Fully healed" : "Healing",
      share: world.player.maxHp > 0 ? Math.min(1, world.player.hp / world.player.maxHp) : 1,
      tone: "spring",
    };
  }

  return undefined;
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
  const channel = channelModel(world);
  return {
    blessIcons,
    ...(cardToken ? { card: cardModel(cardToken) } : {}),
    ...(channel ? { channel } : {}),
    haul: {
      banked: bankedRewards().length,
      blessings: world.bless.owned.length,
      kills: world.kills,
      sealed: world.carried.length,
    },
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
    // The panel flares for exactly as long as the card is up, which needs no timer of its own: the
    // card channel already carries one, and the two saying the same thing at the same time is the
    // point of tying them together.
    run: runModel(world, cardToken?.startsWith(LEVEL_CARD_PREFIX) ?? false),
    tasks: taskModels(world),
  };
}

export async function mountDemo(mount: HTMLElement): Promise<MountedDemo> {
  const surface = document.createElement("main");
  const canvas = document.createElement("canvas");
  const hud = mountDemoHud();
  // After the HUD, never before it: the pause overlay is a full-surface button, and anything
  // painted under it has its clicks taken by the thing that re-locks the pointer.
  const dev = mountDemoDevOverlay({
    toggleGodMode: () => toggleGodMode(),
    testArena: () => testArena(),
    killAll: () => killAll(),
    fillCrowd: () => fillCrowd(),
    dropKit: () => dropKit(),
  });
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

  const locked = (): boolean => captureMode || document.pointerLockElement === canvas;

  const overlayModel = (): DemoHudModel["overlay"] => {
    if (world.status !== "playing") {
      return runEndOverlay(world);
    }

    if (!locked()) {
      return {
        title: "Pantry Depths — Demo",
        body: "Click the screen or press Esc to start. WASD move · mouse to look · Left attack / throw · Right grab / drop · Tab pause · R restart · Esc release the mouse. Four rooms hang off the floor and nothing says which is which — walk in and look. The red altar wants breaking; the white dais and the green pad each want five seconds stood on them, which nothing but stepping off can break. The green one is the way out with everything you are carrying. The stairs are sealed until the floor's main task is done.",
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

  /**
   * Empties the floor through the ordinary exit rather than by clearing the list.
   *
   * Every corpse, every burst of bones and every drop roll therefore happens exactly as it does in
   * play, which is most of what makes this worth pressing: the fastest way to see all six deaths at
   * once is to cause all of them at once. The particle field will overrun its cap and shed its
   * oldest, which is the cap doing its job.
   */
  const killAll = (): void => {
    const felled = world.enemies.length;

    for (const enemy of world.enemies.slice()) {
      killEnemy(world, enemy);
    }

    announce(world, felled > 0 ? `Killed everything on the floor (${felled})` : "Nothing left to kill", 2.5);
  };

  /** Refills the floor to the cap it fills itself to, without waiting out the reinforcement timer. */
  const fillCrowd = (): void => {
    while (world.enemies.length < MAX_ENEMIES) {
      if (!spawnReinforcement(world)) {
        break;
      }
    }

    announce(world, `Crowd topped up (${world.enemies.length}/${MAX_ENEMIES})`, 2.5);
  };

  /**
   * One of everything, in a ring at arm's length.
   *
   * The point is the tail of the list rather than the head. A stake and a rock turn up on any floor;
   * a spent crossbow, a cracked femur and a bent javelin are the last state of a weapon that wears
   * out, so meeting one in play means finding the weapon first and then using it up. Putting the
   * whole table on the floor at once is the only way to look at those three on purpose.
   */
  const dropKit = (): void => {
    PROP_KINDS.forEach((kind, index) => {
      const angle = (index / PROP_KINDS.length) * Math.PI * 2;
      dropProp(
        world,
        kind,
        world.player.x + Math.cos(angle) * KIT_RADIUS,
        world.player.y + Math.sin(angle) * KIT_RADIUS,
        KIT_COUNTS[kind] ?? 1,
      );
    });
    announce(world, `Dropped one of every pickup (${PROP_KINDS.length})`, 2.5);
  };

  const testArena = (): void => flattenFloorForTesting(world);

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
      testArena();
      return;
    }

    // The three that put the floor into a state worth looking at. Keys rather than buttons, because
    // the panel's buttons cannot be reached while the pointer is locked and that is most of play.
    if (key === "k") {
      event.preventDefault();
      killAll();
      return;
    }

    if (key === "n") {
      event.preventDefault();
      fillCrowd();
      return;
    }

    if (key === "b") {
      event.preventDefault();
      dropKit();
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
      dev.dispose();
      hud.overlayButton.removeEventListener("click", handleOverlayClick);
      surface.remove();
    },
  };
}
