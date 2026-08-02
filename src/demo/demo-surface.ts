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
import {
  BLESS_CATALOG,
  BLESS_STACKING_CATALOG,
  blessBonus,
  blessStackCount,
  hasBless,
  findBless,
  type BlessDefinition,
} from "@/demo/bless";
import { mountDemoDevOverlay } from "@/demo/demo-dev-overlay";
import { EXTRACTION_HOLD_SECONDS, extractionShare, runEndOverlay, SEALED_CARD_PREFIX } from "@/demo/extraction";
import {
  mountDemoHud,
  type DemoHudBlessIcon,
  type DemoHudCard,
  type DemoHudChannel,
  type DemoHudHeld,
  type DemoHudModel,
  type DemoHudOverlayRosterEntry,
  type DemoHudRun,
  type DemoHudTask,
} from "@/demo/demo-hud";
import type { DemoArchetypeId } from "@/demo/enemy-archetypes";
import { createDemoEffects, createDemoScene } from "@/demo/demo-scene";
import { loadDemoImages } from "@/demo/demo-sprites";
import { drawDemoViewmodel } from "@/demo/demo-viewmodel";
import { mapNamed } from "@/demo/maps";
import { findModifier, type ModifierAxis } from "@/demo/modifiers";
import { POOL_FILL_BODIES, padRoomAt, type DemoTaskKind } from "@/demo/maze";
import { BLESSING_HOLD_SECONDS, HOT_SPRING_HEAL_PER_SECOND } from "@/demo/rooms";
import { LEVEL_CARD_PREFIX, runLevel } from "@/demo/run-level";
import { bankedRewards, equippedCore } from "@/demo/sealed";
import { dressStage, isStage, restageCast, stageChoiceName, stepStageChoice } from "@/demo/stage";
import { stepDemoWorld, type DemoInput } from "@/demo/simulation";
import type { DemoPropKind } from "@/demo/throw-weight";
import {
  announce,
  awardBless,
  createDemoWorld,
  crowdHere,
  dropProp,
  flattenFloorForTesting,
  killEnemy,
  runClockSeconds,
  spawnReinforcement,
  type DemoWorld,
} from "@/demo/world";
import { CanvasGameplayRenderer } from "@/presentation/canvas-gameplay-renderer";
import {
  playSfx,
  resumeSfx,
  setSfxListener,
  stepSfxVolume,
  suspendSfx,
  toggleSfxMute,
  unlockSfx,
} from "@/presentation/audio/sfx";

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
const FLOOR_OBJECTIVE_SECONDS = 6;

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

/** A tab in the background makes no sound; coming back to it does. */
function handleVisibility(): void {
  if (document.hidden) {
    suspendSfx();
    return;
  }

  resumeSfx();
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

const TASK_PRESENTATION = {
  kills: {
    detail: "Bring down any enemy on this floor",
    glyph: "☠",
    label: "Defeat enemies",
  },
  wallsBroken: {
    detail: "Strike stone or timber until it gives way",
    glyph: "▦",
    label: "Break walls",
  },
  roomsVisited: {
    detail: "Cross into rooms branching off the main floor",
    glyph: "◇",
    label: "Explore side rooms",
  },
  poolsFilled: {
    detail: `Throw ${POOL_FILL_BODIES} bodies into one water cell`,
    glyph: "≈",
    label: "Fill a pool",
  },
} satisfies Readonly<Record<DemoTaskKind, Readonly<{ detail: string; glyph: string; label: string }>>>;

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
      icon: "threat",
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
      icon: "seal",
      name: cursed ? "Cursed seal taken" : "Clean seal taken",
    };
  }

  const definition = token === "overflow" ? undefined : findBless(token as BlessDefinition["id"]);

  if (definition) {
    return {
      color: definition.color,
      detail: definition.detail,
      icon: definition.id,
      name: definition.name,
    };
  }

  return {
    color: "#f0f0d0",
    detail: "Every blessing collected — max HP rises instead",
    icon: "vitality",
    name: "Vitality",
  };
}

/**
 * A mark per kind for the left hand.
 *
 * Provisional and deliberately local: the moment a prop's authored display record can carry a HUD
 * glyph, the table belongs with it rather than beside the frame loop.
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
  return [progress.main, ...progress.secondary].map((task, index) => {
    const presentation = TASK_PRESENTATION[task.kind];
    const main = index === 0;
    return {
      detail: presentation.detail,
      done: task.done,
      glyph: presentation.glyph,
      label: presentation.label,
      main,
      met: task.met,
      reward: main ? "Opens stairs · +1 sealed reward" : "+1 blessing",
      target: task.target,
    };
  });
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

/**
 * The word an axis's number is read in.
 *
 * Display-side and deliberately shorter than the modifier catalogue's own names, which are written to
 * head a column rather than to sit beside a number in a row. The catalogue keeps owning the
 * magnitudes and the decimal places; this owns nothing but how a total is said out loud.
 */
const BLESS_AXIS_UNITS: Readonly<Record<ModifierAxis, string>> = {
  maxHp: "max HP",
  meleeDamage: "damage",
  moveSpeed: "speed",
  meleeReach: "reach",
};

/**
 * The whole blessing roster, as the pause screen reads it.
 *
 * Built beside the play-time bar's icons rather than from them: the bar shows only the tier that
 * never repeats plus a synthetic entry for surplus health, and it is a different readout with a
 * different job. Unowned rows are listed rather than filtered, because the gaps are the half of the
 * list that says there is something left to go and get.
 *
 * The order is the two catalogues back to back, which is the only thing telling the two tiers apart:
 * a heading between them would be a row where the eye is expecting a blessing.
 */
function blessRoster(world: DemoWorld): readonly DemoHudOverlayRosterEntry[] {
  const distinct = BLESS_CATALOG.filter((definition) => hasBless(world.bless, definition.id)).map((definition) => ({
    color: definition.color,
    detail: definition.detail,
    icon: definition.id,
    name: definition.name,
  }));
  // Above zero rather than present in a list: this tier has no membership, and the total is the only
  // record that an award ever landed on it.
  const stacking = BLESS_STACKING_CATALOG.filter((definition) => blessBonus(world.bless, definition.axis) > 0).map(
    (definition) => {
      const total = blessBonus(world.bless, definition.axis);
      const count = blessStackCount(world.bless, definition.axis);
      const precision = findModifier(definition.axis)?.precision ?? 0;
      return {
        color: definition.color,
        detail: definition.detail,
        icon: definition.id,
        name: definition.name,
        total: `+${total.toFixed(precision)} ${BLESS_AXIS_UNITS[definition.axis]}`,
        ...(count > 0 ? { count: `×${count}` } : {}),
      };
    },
  );
  return [...distinct, ...stacking];
}

function createHudModel(
  world: DemoWorld,
  cardToken: string | undefined,
  overlay: DemoHudModel["overlay"],
  showObjective: boolean,
): DemoHudModel {
  // Only what is held. The unheld ones used to sit here as empty slots; they are now listed in full
  // on the pause screen, and a row of placeholders in the corner of a fight was saying "there is more"
  // to somebody who cannot go and get it until the room is clear.
  const blessIcons: DemoHudBlessIcon[] = BLESS_CATALOG.filter((definition) => hasBless(world.bless, definition.id)).map(
    (definition) => ({
      color: definition.color,
      detail: definition.detail,
      icon: definition.id,
      name: definition.name,
    }),
  );

  if (world.bless.overflowMaxHp > 0) {
    blessIcons.push({ color: "#f0f0d0", detail: "Extra max HP", icon: "vitality", name: "Vitality" });
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
  const tasks = taskModels(world);
  const mainTask = tasks.find((task) => task.main);
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
    ...(world.messageSeconds > 0 && world.message && !showObjective ? { message: world.message } : {}),
    minimap: {
      facingAngle: world.player.angle,
      height: world.maze.height,
      player: { x: world.player.x, y: world.player.y, radius: 3, color: "#ffe6b0" },
      points,
      tileColors: MINIMAP_TILE_COLORS,
      tiles: world.maze.tiles.map((tile) => tile.kind),
      width: world.maze.width,
    },
    ...(showObjective && mainTask
      ? {
          objective: {
            detail: mainTask.detail,
            done: mainTask.done,
            glyph: mainTask.glyph,
            label: mainTask.label,
            reward: mainTask.reward,
            target: mainTask.target,
          },
        }
      : {}),
    ...(overlay ? { overlay } : {}),
    // The panel flares for exactly as long as the card is up, which needs no timer of its own: the
    // card channel already carries one, and the two saying the same thing at the same time is the
    // point of tying them together.
    run: runModel(world, cardToken?.startsWith(LEVEL_CARD_PREFIX) ?? false),
    tasks,
  };
}

/**
 * Mounts the game on a map.
 *
 * The name comes from the address the game is already played at, resolved here rather than by the
 * route function: which surface a pathname wants and which map a run plays are two questions, and the
 * route function keeps answering only the first.
 */
export async function mountDemo(mount: HTMLElement, mapName?: string): Promise<MountedDemo> {
  const map = mapNamed(mapName);
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
    grantBless: () => grantBless(),
    restageCast: () => restageStage(),
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

  let world = createDemoWorld(map);
  dressStage(world);
  let objectiveMaze = world.maze;
  let objectiveSeconds = FLOOR_OBJECTIVE_SECONDS;
  let disposed = false;
  let frame = 0;
  /**
   * Whether the readouts and the instrument panel are off screen, so a take carries no furniture.
   *
   * A stage opens with them already off, which is the right way round for the one floor whose purpose
   * is to be photographed: the alternative was making a dungeon's contract mean something in a room
   * that is not a dungeon, and it does not — every objective a floor carries is unmeetable in there,
   * from twelve walls it has none of to four side rooms it will never have.
   */
  let instrumentsHidden = isStage(world);
  surface.dataset.bare = String(instrumentsHidden);
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
        action: "Click or press Esc to descend",
        controls: [
          { key: "WASD", label: "Move" },
          { key: "MOUSE", label: "Look" },
          { key: "LMB", label: "Attack / throw" },
          { key: "RMB", label: "Grab / drop" },
          { key: "TAB", label: "Pause" },
        ],
        eyebrow: "Descend · Claim · Escape",
        kind: "title",
        objective:
          "Complete the main floor objective to open the stairs. Explore the four side rooms for healing, blessings, and a way out with your sealed haul.",
        title: "Pantry Depths",
      };
    }

    if (paused) {
      return {
        action: "Press Tab to resume",
        controls: [
          { key: "ESC", label: "Release mouse" },
          { key: "R", label: "Restart run" },
        ],
        eyebrow: "The depths are waiting",
        kind: "paused",
        roster: blessRoster(world),
        title: "Paused",
      };
    }

    return undefined;
  };

  const refreshHud = (): void =>
    hud.update(createHudModel(world, activeCardToken, overlayModel(), objectiveSeconds > 0));
  const refreshDev = (): void =>
    dev.update({
      mindsFrozen: world.mindsFrozen,
      worldFrozen: world.worldFrozen,
      fps: smoothedFps,
      godMode: world.godMode,
      // Omitted rather than sent empty off the stage: the row is drawn only where restaging means
      // something, and an absent choice is a different statement from a choice of nothing.
      ...(isStage(world) ? { nextCast: stageChoiceName() } : {}),
    });

  /**
   * Shows the award card for a few seconds.
   *
   * The world only ever raises a flag; the card, its timer, and its removal all live here so the
   * simulation never has to know how long a piece of user interface stays on screen.
   */
  const showCard = (token: string): void => {
    activeCardToken = token;
    objectiveSeconds = 0;

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
    playSfx("uiSelect");
    // A cheat is a property of the session, not of the run. Losing god mode on every R would make it
    // useless for exactly the thing it is for: dying repeatedly on purpose.
    const carriedGodMode = world.godMode;
    world = createDemoWorld(map);
    // On a stage this is what makes R mean "shoot that again": the cast returns to its cells, the
    // arrival is the arrival, and the bodies are held still whether or not they had been released.
    // Deliberately not carried the way god mode is — being frozen belongs to the staged scene.
    dressStage(world);
    objectiveMaze = world.maze;
    objectiveSeconds = FLOOR_OBJECTIVE_SECONDS;
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
    while (world.enemies.length < crowdHere(world).cap) {
      if (!spawnReinforcement(world)) {
        break;
      }
    }

    announce(world, `Crowd topped up (${world.enemies.length}/${crowdHere(world).cap})`, 2.5);
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

  /**
   * Stands the stage's cast again, and refuses to do anything anywhere else.
   *
   * The guard is not tidiness. Off a stage this empties the floor of every body without killing one —
   * no corpse, no drop, no stain — and then stands a cast no ordinary room declares. That is not a
   * cheat, it is a floor deleted in silence, so the key says no rather than doing it.
   */
  const restageStage = (): void => {
    if (!isStage(world)) {
      announce(world, "Restaging is the filming stage's; this floor has no cast to stand", 2.5);
      return;
    }

    const stood = restageCast(world);
    announce(world, stood > 0 ? `Cast restaged (${stood})` : "This room stands nobody", 2);
  };

  /**
   * One blessing, drawn exactly as an altar draws it.
   *
   * Through `awardBless` rather than through the catalogue directly, so the cheat cannot award
   * something the game cannot: the distinct tier first and never twice, then the stacking tier, with
   * the health an award owes applied and the card queued the same way.
   */
  const grantBless = (): void => awardBless(world);

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
    // Pushed rather than read: the particle funnel raises most of the positional cues and has
    // coordinates but no world to ask where the ears are.
    setSfxListener(world.player.x, world.player.y);

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

    if (world.maze !== objectiveMaze) {
      objectiveMaze = world.maze;
      objectiveSeconds = FLOOR_OBJECTIVE_SECONDS;
    } else if (active) {
      objectiveSeconds = Math.max(0, objectiveSeconds - deltaSeconds);
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
      playSfx("uiSelect");
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
        playSfx("uiSelect");
        refreshHud();
      }

      return;
    }

    if (key === "r") {
      event.preventDefault();
      restart();
      return;
    }

    // Keys rather than a slider, and for the reason every other toggle here is a key: the pointer stays
    // locked through the pause, so there is no cursor to drag anything with. The level is announced
    // because a volume you cannot see and cannot hear is a key that appears to do nothing.
    if (key === "m") {
      event.preventDefault();
      announce(world, toggleSfxMute() ? "Sound muted (M)" : "Sound on (M)", 1.6);
      return;
    }

    if (key === "[" || key === "]") {
      event.preventDefault();
      const level = stepSfxVolume(key === "]" ? 1 : -1);
      announce(world, `Sound ${Math.round(level * 100)}%`, 1.2);
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

    // The blessing screens are unreachable in any interesting state without this: five altars is most
    // of a run away, and the stacking tier is behind all five.
    if (key === "l") {
      event.preventDefault();
      grantBless();
      return;
    }

    // Holds the bodies without holding the clock: they stop deciding, and everything the player does
    // to one still reads — it flinches, it is shoved, its hit flash fades, it dies properly.
    if (key === "p") {
      event.preventDefault();
      world.mindsFrozen = !world.mindsFrozen;
      announce(world, world.mindsFrozen ? "Minds frozen (P to resume)" : "Enemies thinking again", 2.5);
      refreshDev();
      return;
    }

    // The three the stage adds. Choosing does not touch what is already standing — it decides what the
    // next reset stands up — so a person can step through the list looking for the right body without
    // destroying the shot they are in.
    if ((key === "q" || key === "e") && isStage(world)) {
      event.preventDefault();
      announce(world, `Next cast: ${stepStageChoice(key === "e" ? 1 : -1)}`, 2);
      refreshDev();
      return;
    }

    if (key === "c") {
      event.preventDefault();
      restageStage();
      return;
    }

    // Everything the game says about itself, off screen at once. A take carries no development
    // furniture, and the state survives because the panels are hidden rather than unmounted.
    if (key === "h") {
      event.preventDefault();
      instrumentsHidden = !instrumentsHidden;
      surface.dataset.bare = String(instrumentsHidden);
      return;
    }

    // Stops the clock as well, which is the one to press for a still frame to compare against
    // another: a body struck just before it went on stays lit, because its flash is a timer.
    if (key === "o") {
      event.preventDefault();
      world.worldFrozen = !world.worldFrozen;
      announce(world, world.worldFrozen ? "World frozen (O to resume)" : "World moving again", 2.5);
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
    // The gesture that starts play is also the only moment a browser will hand over an audio context,
    // so arming the sound rides on it rather than needing a prompt of its own.
    unlockSfx();
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
  document.addEventListener("visibilitychange", handleVisibility);
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
      document.removeEventListener("visibilitychange", handleVisibility);
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
