import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createDebugPage, createDebugPanel, createDebugScroller } from "@/app/debug/debug-shell";
import { createPropWorkbench } from "@/app/debug/prop-workbench";
import { createRenderPanel } from "@/app/debug/render-panel";
import type { EnemyAppearanceId } from "@/content/combat/enemies";
import entityDisplayJson from "@/content/enemies/entity-display.json";
import {
  entityDisplaysByAppearance,
  parseEntityDisplays,
  type EntityDisplay,
} from "@/content/enemies/entity-display-schema";
import { skeletonActions } from "@/content/enemies/skeleton-appearance";
import { SKELETON_DEATH_ANIMATIONS } from "@/content/enemies/skeleton-death-definitions";
import {
  ATTACK_EASE_SECONDS,
  POOL_FILL,
  projectCarriedDemoEnemy,
  projectDemoBarricade,
  projectDemoDeath,
  projectDemoEnemy,
  skeletonDeathAnimation,
  warnMarkerSprite,
  type DemoEntityProjection,
  type DemoEntityProjectionContext,
} from "@/demo/demo-scene";
import {
  attackCooldown,
  attackReach,
  attackWindup,
  ENEMY_ARCHETYPES,
  isBoned,
  MELEE_CUT_HALF_ANGLE,
  STRIKE_SECONDS,
  type DemoArchetypeId,
} from "@/demo/enemy-archetypes";
import { DROWN_SECONDS } from "@/demo/impacts";
import { DEATH_SECONDS } from "@/demo/simulation";
import {
  bodyFootprint,
  ENEMY_RADIUS,
  projectileHeight,
  type DemoDeath,
  type DemoDeathCause,
  type DemoEnemy,
  type DemoProjectile,
} from "@/demo/world";
import type {
  CameraPose,
  RenderBeam,
  RenderBox,
  RenderEmitter,
  RenderFloorDecal,
  RenderFloorPatch,
  RenderScene,
  RenderSurface,
} from "@/presentation/render-scene";

/**
 * Where the body is. Owns the floor, the props, the camera, and its own parameters — nothing else.
 *
 * Separate from what the body is doing, because they are separate questions: the first version of
 * this tool collapsed archetype, situation and state into one `Scenario` enum, which meant a
 * situation could only be reached through a preset that also reset every other control on the page.
 */
type EntitySituation = "room" | "water" | "barricade" | "wall" | "skewered";

/**
 * What the body is doing. `dying` opens the cause; everything else is a living clip.
 *
 * The one attack became three, because the whole point of splitting them is that the player can tell
 * them apart — and a tool that previewed them as one state could never answer whether they do.
 */
type EntityBodyState = "idle" | "walk" | "hurt" | "stunned" | "windup" | "strike" | "recovery" | "dying";

type WallFace = "north" | "east" | "south" | "west";

/**
 * What the matrix found for one cell.
 *
 * `procedural` is the third state, and it exists because absence is now sometimes the design. A body
 * a bomb reached has no corpse clip on purpose — the death is entirely a burst of bones — and a
 * matrix that reads every empty projection as a gap would show that one as a permanent false alarm.
 *
 * There is no `shared` any more. Every situation owns its own clip, so nothing is borrowed and
 * nothing can report as borrowed.
 */
type CoverageState = "available" | "procedural" | "missing";

type EntityWorkbenchState = {
  archetypeId: DemoArchetypeId;
  situation: EntitySituation;
  bodyState: EntityBodyState;
  deathCause: DemoDeathCause;
  direction: number;
  playing: boolean;
  speed: number;
  poolBodies: number;
  barricadeWear: number;
  wallFace: WallFace;
  carriedCount: number;
  flightPitch: number;
  flightSpeed: number;
  /**
   * How far behind the body the inspection camera stands.
   *
   * The most important control on this panel, and the one that was a constant. Every argument about a
   * body's size or a marker's height has turned out to be an argument about distance — a mark that sits
   * clear of the head across a room leaves the frame at arm's reach, and the two readings cannot be
   * judged one at a time. Sliding this is how the trade becomes visible instead of being guessed.
   */
  cameraBack: number;
  /** The display numbers being tuned, previewed live and saved only when asked. */
  bodyScale: number;
  markerOffset: number;
  markerScale: number;
  markerSwell: number;
};

const SITUATIONS: readonly Readonly<{ id: EntitySituation; label: string; settings: string }>[] = [
  { id: "room", label: "Open room", settings: "Open room" },
  { id: "water", label: "Water", settings: "Water" },
  { id: "barricade", label: "Barricade", settings: "Barricade" },
  { id: "wall", label: "Against a wall", settings: "Wall" },
  { id: "skewered", label: "Skewered flight (broken)", settings: "Skewered flight" },
];

const BODY_STATES: readonly Readonly<{ id: EntityBodyState; label: string }>[] = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "hurt", label: "Hurt" },
  { id: "stunned", label: "Stunned" },
  { id: "windup", label: "Wind-up" },
  { id: "strike", label: "Strike" },
  { id: "recovery", label: "Recovery" },
  { id: "dying", label: "Dying" },
];

const LIVING_STATES = ["idle", "walk", "hurt", "stunned", "windup", "strike", "recovery"] as const;
const DEATH_CAUSES: readonly DemoDeathCause[] = ["slain", "cleaved", "drowned", "splattered", "blasted", "impaled"];
const WALL_FACES: readonly WallFace[] = ["north", "east", "south", "west"];
const POOL_BODY_LABELS = ["Clear water", "One body in it", "Two bodies in it"];

const DIRECTION_LABELS = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];
const DIRECTIONS = 8;

const ROOM_SIZE = 9;
const ROOM_CENTRE = 4.5;
const BODY_Y = 4.25;
const ROOM_CAMERA: CameraPose = { x: ROOM_CENTRE, y: 7.35, angle: -Math.PI / 2 };
/** Where a body flung into masonry comes to rest: the radius `unstick` settles a projectile with. */
const BODY_STANDOFF = 0.3;
/** How far behind the subject the camera stands. */
const INSPECTION_BACK = 2.6;
/** The pool, wide enough that the body is surrounded by water rather than standing in a puddle. */
const POOL_FROM = 3;
const POOL_TO = 5;

function roomSurfaces(): RenderSurface[] {
  const surfaces: RenderSurface[] = [];

  for (let index = 0; index < ROOM_SIZE; index += 1) {
    surfaces.push({ cell: { x: index, y: 0 }, material: "demoFoundation", height: 2.4 });
    surfaces.push({ cell: { x: index, y: ROOM_SIZE - 1 }, material: "demoFoundation", height: 2.4 });

    if (index > 0 && index < ROOM_SIZE - 1) {
      surfaces.push({ cell: { x: 0, y: index }, material: "demoFoundation", height: 2.4 });
      surfaces.push({ cell: { x: ROOM_SIZE - 1, y: index }, material: "demoFoundation", height: 2.4 });
    }
  }

  return surfaces;
}

/**
 * Every cell names its floor, the way `demo-scene` does it.
 *
 * Without this the room stands on the shipped game's default flagstone rather than the demo's own,
 * so every body was being judged against a floor it never appears on.
 */
function roomFloor(): RenderFloorPatch[] {
  const built: RenderFloorPatch[] = [];

  for (let y = 0; y < ROOM_SIZE; y += 1) {
    for (let x = 0; x < ROOM_SIZE; x += 1) {
      built.push({ cell: { x, y }, material: "demoFlagstone" });
    }
  }

  return built;
}

/**
 * The authored display table, as a working copy this tool edits.
 *
 * Parsed once and then mutated by the sliders, so what is on screen is always what would be written.
 * Saving sends the whole table back through the same validator the file is loaded with, which means a
 * number that cannot survive a reload cannot be saved either.
 */
const displays = entityDisplaysByAppearance(parseEntityDisplays(entityDisplayJson)) as Record<
  EnemyAppearanceId,
  EntityDisplay
>;

const ROOM_SURFACES = roomSurfaces();
const ROOM_FLOOR = roomFloor();
const ROOM_TILES = Array.from({ length: ROOM_SIZE }, (_rowValue, y) =>
  Array.from({ length: ROOM_SIZE }, (_columnValue, x) =>
    x === 0 || y === 0 || x === ROOM_SIZE - 1 || y === ROOM_SIZE - 1 ? "#" : ".",
  ).join(""),
);

/** The inspection camera at whatever distance the slider is holding. */
function previewCamera(state: EntityWorkbenchState): CameraPose {
  return { x: ROOM_CENTRE, y: BODY_Y + state.cameraBack, angle: -Math.PI / 2 };
}

/** The display record the sliders are currently describing, for the archetype on screen. */
function previewDisplay(state: EntityWorkbenchState): EntityDisplay {
  return {
    appearanceId: ENEMY_ARCHETYPES[state.archetypeId].appearance,
    bodyScale: state.bodyScale,
    markerOffset: state.markerOffset,
    markerScale: state.markerScale,
    markerSwell: state.markerSwell,
  };
}

/**
 * The two circles a body actually has, drawn together because they are deliberately different.
 *
 * The inner one is the footprint: how much floor it takes up, how far its shove reaches, and how
 * large a target a thrown weapon has to hit. The outer one is wall clearance, which is the same
 * number for every body on the floor — a large body with a large clearance wedges in corridor
 * corners, and one that cannot get through a doorway cannot block one either. Seeing by how much
 * they differ is the only way to judge whether a colour is sized right.
 */
function bodyCircles(enemy: DemoEnemy): RenderFloorDecal[] {
  return [
    {
      x: enemy.x,
      y: enemy.y,
      shape: { kind: "ring", radius: ENEMY_RADIUS, thickness: 0.035 },
      color: [120, 150, 210],
      strength: 0.4,
    },
    {
      x: enemy.x,
      y: enemy.y,
      shape: { kind: "ring", radius: bodyFootprint(enemy.archetype), thickness: 0.045 },
      color: [240, 210, 120],
      strength: 0.6,
    },
  ];
}

/**
 * The ground a committed cut would cross, drawn so body size and reach are judged together.
 *
 * Without it a body can be tuned to a size that looks right on its own and wrong next to its own
 * attack: reach is the simulation's number and does not shrink with the artwork, so a body taken far
 * enough down ends up shorter than the arc it swings.
 */
function attackCone(state: EntityWorkbenchState, enemy: DemoEnemy): RenderFloorDecal[] {
  if (state.bodyState !== "windup" || !isBoned(enemy.archetype)) {
    return [];
  }

  return [
    {
      x: enemy.x,
      y: enemy.y,
      shape: {
        kind: "sector",
        radius: attackReach(enemy.archetype),
        directionX: Math.cos(enemy.facingAngle),
        directionY: Math.sin(enemy.facingAngle),
        halfAngle: MELEE_CUT_HALF_ANGLE,
      },
      color: [188, 52, 54],
      strength: 0.55,
    },
  ];
}

function createEnemy(archetypeId: DemoArchetypeId, id = "workbench-enemy"): DemoEnemy {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return {
    id,
    archetype,
    appearance: archetype.appearance,
    x: ROOM_CENTRE,
    y: BODY_Y,
    hp: archetype.health,
    maxHp: archetype.health,
    stunSeconds: 0,
    hurtSeconds: 0,
    attackPoseSeconds: 0,
    attackCooldown: 0,
    pushX: 0,
    pushY: 0,
    repathSeconds: 0,
    waypoint: undefined,
    // Nothing here steps a mind — the workbench drives poses directly — so this is only the shape the
    // type asks for, at the value a body that has not thought about anything yet would hold.
    mind: "idle",
    idleSeconds: 0,
    wanderCell: undefined,
    windupSeconds: 0,
    windupTotal: Math.max(0.001, attackWindup(archetype)),
    intent: "none",
    // Aimed straight down the room, so a previewed wind-up paints its lane towards the camera rather
    // than at whatever the origin cell happens to be.
    aimX: ROOM_CENTRE,
    aimY: BODY_Y - 1,
    chargeSeconds: 0,
    chargeX: 0,
    chargeY: -1,
    drowningSeconds: 0,
    facingAngle: ROOM_CAMERA.angle + Math.PI,
    moving: false,
  };
}

function createDeath(archetypeId: DemoArchetypeId, cause: DemoDeathCause, progress: number): DemoDeath {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return {
    id: `workbench-${archetypeId}-${cause}`,
    appearance: archetype.appearance,
    x: ROOM_CENTRE,
    y: BODY_Y,
    progress,
    cause,
    directionX: 0,
    directionY: -1,
    archetypeId,
    facingAngle: ROOM_CAMERA.angle + Math.PI,
  };
}

function createContext(elapsedSeconds: number, camera: CameraPose = ROOM_CAMERA): DemoEntityProjectionContext {
  return { elapsedSeconds, camera: { x: camera.x, y: camera.y, angle: camera.angle } };
}

/** Puts a living body's simulation fields where the demo puts them to reach one visible state. */
function stateEnemy(archetypeId: DemoArchetypeId, bodyState: Exclude<EntityBodyState, "dying">): DemoEnemy {
  const enemy = createEnemy(archetypeId);

  if (bodyState === "walk") {
    enemy.moving = true;
  } else if (bodyState === "windup") {
    enemy.windupTotal = Math.max(0.001, attackWindup(enemy.archetype));
    enemy.windupSeconds = enemy.windupTotal * 0.6;
    // Whatever this creature actually winds up — a spitter rehearses a shot, a charger a charge. It
    // used to be melee for all of them, so every slime previewed its attack under a skeleton's sword.
    // The ordinary slime declares none, and so wears no mark at all, which is true of it in the game.
    enemy.intent = enemy.archetype.windupIntent ?? "none";
  } else if (bodyState === "strike") {
    enemy.attackPoseSeconds = STRIKE_SECONDS * 0.5;
  } else if (bodyState === "recovery") {
    enemy.attackCooldown = attackCooldown(enemy.archetype) * 0.5;
  } else if (bodyState === "hurt") {
    enemy.hurtSeconds = 0.14;
  } else if (bodyState === "stunned") {
    enemy.stunSeconds = 1;
  }

  return enemy;
}

function mergeProjection(
  target: { blobs: DemoEntityProjection["blobs"]; sprites: DemoEntityProjection["sprites"] },
  next: DemoEntityProjection,
): void {
  target.blobs = [...target.blobs, ...next.blobs];
  target.sprites = [...target.sprites, ...next.sprites];
}

/**
 * A body that should be here and is not.
 *
 * Loud on purpose, and never a fallback to `idle`. A silent empty preview is the one outcome this
 * tool must not produce: it is indistinguishable from a renderer that has stopped.
 */
function missingBodyBoxes(x: number, y: number): RenderBox[] {
  return [
    {
      id: "workbench-missing-body",
      x,
      y,
      halfX: 0.16,
      halfY: 0.16,
      bottom: 0,
      top: 1.05,
      color: [214, 74, 148],
      topColor: [255, 168, 214],
    },
  ];
}

function scene(
  projection: DemoEntityProjection,
  options: Readonly<{
    beams?: readonly RenderBeam[];
    boxes?: readonly RenderBox[];
    camera?: CameraPose;
    emitters?: readonly RenderEmitter[];
    floorDecals?: readonly RenderFloorDecal[];
    floorPatches?: readonly RenderFloorPatch[];
    light?: Readonly<{ x: number; y: number }>;
    surfaces?: readonly RenderSurface[];
  }> = {},
): RenderScene {
  const light = options.light ?? { x: ROOM_CENTRE, y: BODY_Y + 1 };
  return {
    floorId: "entity-workbench",
    theme: "demo",
    width: ROOM_SIZE,
    height: ROOM_SIZE,
    tiles: ROOM_TILES,
    camera: options.camera ?? ROOM_CAMERA,
    ambient: [0.24, 0.2, 0.3],
    wallHeight: 1.4,
    eyeHeight: 0.5,
    surfaces: options.surfaces ?? ROOM_SURFACES,
    floorPatches: options.floorPatches ?? ROOM_FLOOR,
    blobs: projection.blobs,
    sprites: projection.sprites,
    ...(options.boxes ? { boxes: options.boxes } : {}),
    ...(options.floorDecals && options.floorDecals.length > 0 ? { floorDecals: options.floorDecals } : {}),
    ...(options.beams ? { beams: options.beams } : {}),
    lights: [{ id: "inspection-light", x: light.x, y: light.y, radius: 5, color: [255, 178, 112], intensity: 1 }],
    emitters: options.emitters ?? [],
  };
}

const CARRIED_RANGE = 3;

function createProjectile(
  elapsedSeconds: number,
  flight: Readonly<{ flightPitch: number; flightSpeed: number }>,
): DemoProjectile {
  const travelled = (elapsedSeconds * flight.flightSpeed) % CARRIED_RANGE;
  const pitchRadians = (flight.flightPitch / 180) * Math.PI;
  const directionX = 0.92;
  const directionY = -Math.sqrt(1 - directionX * directionX);
  return {
    id: "workbench-stick",
    kind: "stick",
    x: 3 + directionX * travelled,
    y: 4.85 + directionY * travelled,
    directionX,
    directionY,
    travelled,
    range: CARRIED_RANGE,
    speed: flight.flightSpeed,
    drag: 0,
    plunge: 1,
    thud: 1,
    arc: Math.tan(pitchRadians) * CARRIED_RANGE,
    fall: 0,
    payload: undefined,
    struck: new Set<string>(),
    trail: [],
    skewered: [],
    cleaved: 0,
    broke: 0,
  };
}

// ---------------------------------------------------------------------------------------------------
// Coverage, derived from the projection rather than described alongside it
// ---------------------------------------------------------------------------------------------------

/** A fixed instant, so two probes of the same body differ only by the state being probed. */
const PROBE_SECONDS = 0.37;
const PROBE_PROGRESS = 0.5;
const PROBE_CONTEXT = createContext(PROBE_SECONDS);

/**
 * What a projection looks like, ignoring the identity of what produced it.
 *
 * Two states that project to the same shape are the same state as far as anyone looking at the
 * screen is concerned, which is the whole question this table answers. Comparing shapes is also why
 * the coverage table cannot be a list of clip names: the names always exist, and the answer for a
 * blob is that setting `moving` changes nothing about it.
 */
function withoutIdentity(entry: object): string {
  return JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "id")));
}

function projectionShape(projection: DemoEntityProjection): string {
  return [...projection.blobs.map(withoutIdentity), ...projection.sprites.map(withoutIdentity)].join("|");
}

function isEmpty(projection: DemoEntityProjection): boolean {
  return projection.blobs.length === 0 && projection.sprites.length === 0;
}

/**
 * One living state, projected the way the demo reaches it — no forced clip.
 *
 * The preview does force one, because scrubbing a named clip frame by frame is what it is for. The
 * table must not: forcing `walk` on a slime would report a walk the game can never show.
 */
function livingProbe(archetypeId: DemoArchetypeId, bodyState: Exclude<EntityBodyState, "dying">): DemoEntityProjection {
  return projectDemoEnemy(PROBE_CONTEXT, stateEnemy(archetypeId, bodyState));
}

function livingCoverage(archetypeId: DemoArchetypeId, bodyState: Exclude<EntityBodyState, "dying">): CoverageState {
  const probe = livingProbe(archetypeId, bodyState);

  if (isEmpty(probe)) {
    return "missing";
  }

  if (bodyState === "idle") {
    return "available";
  }

  return projectionShape(probe) === projectionShape(livingProbe(archetypeId, "idle")) ? "missing" : "available";
}

/**
 * The deaths a boned body is meant to project nothing for.
 *
 * Written down rather than inferred from the empty projection, because those two cases look
 * identical from here and only one of them is finished. A list that has to be edited is the point:
 * adding a cause to it is a decision, and forgetting to add one shows up as a gap.
 */
const PROCEDURAL_BONED_DEATHS: readonly DemoDeathCause[] = ["blasted"];

/** Every death cause of one body, and whether it has a picture of its own. */
function deathCoverage(
  archetypeId: DemoArchetypeId,
): Map<DemoDeathCause, Readonly<{ state: CoverageState; note: string }>> {
  const boned = isBoned(ENEMY_ARCHETYPES[archetypeId]);
  const found = new Map<DemoDeathCause, Readonly<{ state: CoverageState; note: string }>>();

  for (const cause of DEATH_CAUSES) {
    const probe = projectDemoDeath(PROBE_CONTEXT, createDeath(archetypeId, cause, PROBE_PROGRESS));

    if (!isEmpty(probe)) {
      found.set(cause, { state: "available", note: "Available" });
      continue;
    }

    found.set(
      cause,
      boned && PROCEDURAL_BONED_DEATHS.includes(cause)
        ? { state: "procedural", note: "Procedural — bones only" }
        : { state: "missing", note: "Missing — placeholder" },
    );
  }

  return found;
}

function facesEightWays(archetypeId: DemoArchetypeId): boolean {
  const front = createEnemy(archetypeId);
  const side = createEnemy(archetypeId);
  side.facingAngle = front.facingAngle + Math.PI / 2;
  return (
    projectionShape(projectDemoEnemy(PROBE_CONTEXT, front)) !== projectionShape(projectDemoEnemy(PROBE_CONTEXT, side))
  );
}

/** Whether the body goes under the surface it is standing on rather than staying on top of it. */
function sinksInWater(archetypeId: DemoArchetypeId): boolean {
  const enemy = createEnemy(archetypeId);
  enemy.drowningSeconds = DROWN_SECONDS / 2;
  const projection = projectDemoEnemy(PROBE_CONTEXT, enemy);
  return (
    projection.blobs.some((blob) => blob.sink < 0) || projection.sprites.some((sprite) => (sprite.submerged ?? 0) > 0)
  );
}

/**
 * Whether a death has a depiction of its own rather than falling back on the ordinary one.
 *
 * The two situation probes below used to assert the shape a soft body takes: a mark left on the
 * masonry, and a body held off the floor by the iron. Both are wrong for a skeleton and deliberately
 * so — bones do not stain a wall, and a body run through is a frozen pose rather than a lifted one —
 * so a probe written that way reports a finished death as a gap. What both actually want to know is
 * whether the situation is depicted at all.
 */
function depictsDeath(archetypeId: DemoArchetypeId, cause: DemoDeathCause): boolean {
  const probe = projectDemoDeath(PROBE_CONTEXT, createDeath(archetypeId, cause, PROBE_PROGRESS));

  if (isEmpty(probe)) {
    return false;
  }

  return projectionShape(probe) !== projectionShape(deathProbe(archetypeId, "slain"));
}

function deathProbe(archetypeId: DemoArchetypeId, cause: DemoDeathCause): DemoEntityProjection {
  return projectDemoDeath(PROBE_CONTEXT, createDeath(archetypeId, cause, PROBE_PROGRESS));
}

/** Whether ending against masonry is shown as something other than an ordinary death. */
function endsAgainstMasonry(archetypeId: DemoArchetypeId): boolean {
  return depictsDeath(archetypeId, "splattered");
}

/** Whether being run through is shown as something other than an ordinary death. */
function runThrough(archetypeId: DemoArchetypeId): boolean {
  return depictsDeath(archetypeId, "impaled");
}

/** Whether a carried body follows the shaft it is on when the throw is pitched. */
function ridesTheShaft(archetypeId: DemoArchetypeId): boolean {
  const enemy = createEnemy(archetypeId);
  const level = projectCarriedDemoEnemy(PROBE_CONTEXT, probeProjectile(0), enemy, 0);
  const lobbed = projectCarriedDemoEnemy(PROBE_CONTEXT, probeProjectile(1.4), enemy, 0);
  return projectionShape(level) !== projectionShape(lobbed);
}

function probeProjectile(arc: number): DemoProjectile {
  return {
    ...createProjectile(PROBE_SECONDS, { flightPitch: 0, flightSpeed: 3 }),
    arc,
    travelled: 1.5,
  };
}

const SITUATION_COVERAGE: readonly Readonly<{ label: string; holds: (archetypeId: DemoArchetypeId) => boolean }>[] = [
  { label: "Sinks in water", holds: sinksInWater },
  { label: "Ends against masonry", holds: endsAgainstMasonry },
  { label: "Run through", holds: runThrough },
  { label: "Rides the shaft", holds: ridesTheShaft },
];

function coverageCell(state: CoverageState, note: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.dataset.state = state;
  cell.textContent = note;
  return cell;
}

/**
 * The one thing this workbench knows that nothing else does: where the bodies are unfinished.
 *
 * Every cell is measured, not written down. The previous table was a pair of hand-written branches
 * that reported ten clips available for the skeleton and everything but `walk` available for a slime,
 * and it agreed with itself no matter what the projection did.
 */
function createCoverageMatrix(): HTMLDivElement {
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const body = document.createElement("tbody");
  caption.textContent =
    "Measured by projecting each body and comparing the result, so a state that silently falls back to another one reads as missing rather than as present.";

  const columns = [
    "Archetype",
    "8-way",
    ...LIVING_STATES,
    ...DEATH_CAUSES.map((cause) => `death · ${cause}`),
    ...SITUATION_COVERAGE.map((entry) => entry.label),
  ];

  for (const label of columns) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }

  head.append(headerRow);

  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    const deaths = deathCoverage(archetype.id);
    heading.scope = "row";
    heading.textContent = archetype.name;
    row.append(heading);
    row.append(
      facesEightWays(archetype.id)
        ? coverageCell("available", "Available")
        : coverageCell("missing", "Missing — placeholder"),
    );

    for (const bodyState of LIVING_STATES) {
      const state = livingCoverage(archetype.id, bodyState);
      row.append(coverageCell(state, state === "available" ? "Available" : "Missing — placeholder"));
    }

    for (const cause of DEATH_CAUSES) {
      const finding = deaths.get(cause) ?? { state: "missing" as CoverageState, note: "Missing — placeholder" };
      row.append(coverageCell(finding.state, finding.note));
    }

    for (const entry of SITUATION_COVERAGE) {
      row.append(
        entry.holds(archetype.id)
          ? coverageCell("available", "Available")
          : coverageCell("missing", "Missing — placeholder"),
      );
    }

    body.append(row);
  }

  table.append(caption, head, body);
  return createDebugScroller(table, "Entity animation coverage matrix");
}

// ---------------------------------------------------------------------------------------------------
// Scenes, one per situation
// ---------------------------------------------------------------------------------------------------

function facingFor(camera: CameraPose, direction: number): number {
  return camera.angle + Math.PI - (direction / DIRECTIONS) * Math.PI * 2;
}

/**
 * How long one pass of the selected timeline takes at 1×, in the seconds the game spends on it.
 *
 * Every clip has its own frame rate and the corpse animation has a duration of its own, so a flat
 * one-second loop — which is what this used to do — showed no clip at the speed it actually plays.
 */
function timelineSeconds(state: EntityWorkbenchState): number {
  if (state.situation === "water") {
    return DROWN_SECONDS + DEATH_SECONDS;
  }

  if (state.situation === "skewered") {
    return CARRIED_RANGE / Math.max(0.1, state.flightSpeed);
  }

  if (state.bodyState === "dying") {
    return DEATH_SECONDS;
  }

  const archetype = ENEMY_ARCHETYPES[state.archetypeId];

  if (!isBoned(archetype)) {
    // A blob has no frames to run out of; it deforms continuously. A second is a readable loop for
    // the wobble, and the scrubber is a percentage rather than a frame count for the same reason.
    return 1;
  }

  // The three attack states run at the length the simulation gives them, not at the clip's own rate.
  // That is the whole question those clips exist to answer: a wind-up has to read at three seconds as
  // well as at one, and a recovery has to say "free hits" at six seconds as well as at 1.8.
  if (state.bodyState === "windup") {
    return Math.max(0.1, attackWindup(archetype));
  }

  if (state.bodyState === "strike") {
    return STRIKE_SECONDS;
  }

  if (state.bodyState === "recovery") {
    return Math.max(0.1, attackCooldown(archetype));
  }

  const definition = skeletonActions(archetype.appearance)[state.bodyState];
  return definition.frames / definition.framesPerSecond;
}

/** Frames in the clip the scrubber is stepping through, or zero when there is no clip to step. */
function timelineFrames(state: EntityWorkbenchState): number {
  if (!isBoned(ENEMY_ARCHETYPES[state.archetypeId]) || state.situation === "water" || state.situation === "skewered") {
    return 0;
  }

  // A clip is scrubbed at its own width, which is why the cause has to be resolved here rather than
  // answered with one number for the whole set: a death held on a single pose and a death that runs
  // eight frames are both correct, and a scrubber that splits either into eight is not.
  if (state.bodyState !== "dying") {
    return skeletonActions(ENEMY_ARCHETYPES[state.archetypeId].appearance)[state.bodyState].frames;
  }

  // A death with no clip has nothing to step through, which is exactly what a blasted body is.
  const clip = skeletonDeathAnimation(state.deathCause);
  return clip === undefined ? 0 : SKELETON_DEATH_ANIMATIONS[clip].frames;
}

function livingProjection(
  context: DemoEntityProjectionContext,
  state: EntityWorkbenchState,
  progress: number,
): DemoEntityProjection {
  const bodyState = state.bodyState === "dying" ? "idle" : state.bodyState;
  const enemy = stateEnemy(state.archetypeId, bodyState);
  enemy.facingAngle = facingFor(context.camera, state.direction);

  // Every state whose clip the simulation drives from a timer is scrubbed by running that timer
  // backwards, so what the preview shows is what the game computes — including the ease-then-hold on
  // a wind-up, which a forced linear step through the clip would quietly hide.
  if (bodyState === "windup") {
    enemy.windupSeconds = Math.max(0.0001, enemy.windupTotal * (1 - progress));
  } else if (bodyState === "strike") {
    enemy.attackPoseSeconds = Math.max(0.0001, STRIKE_SECONDS * (1 - progress));
  } else if (bodyState === "recovery") {
    enemy.attackCooldown = Math.max(0.0001, attackCooldown(enemy.archetype) * (1 - progress));
  } else if (bodyState === "hurt") {
    enemy.hurtSeconds = Math.max(0.0001, 0.28 * (1 - progress));
  }

  // The looping clips have no timer to run: they cycle off the clock, so the scrubber forces them.
  const looping = bodyState === "idle" || bodyState === "walk" || bodyState === "stunned";
  const display = previewDisplay(state);
  const projected = projectDemoEnemy(context, enemy, {
    ...(looping ? { skeletonAnimation: { animation: skeletonActions(enemy.appearance)[bodyState], progress } } : {}),
    display,
  });
  // The mark is built by the game's own placement function rather than recomputed here, so what the
  // offset slider moves is the number the game reads and not this tool's arithmetic.
  const marker = warnMarkerSprite(enemy, display);
  return marker ? { blobs: projected.blobs, sprites: [...projected.sprites, marker] } : projected;
}

function bodyProjection(
  context: DemoEntityProjectionContext,
  state: EntityWorkbenchState,
  progress: number,
  placement?: Pick<DemoDeath, "directionX" | "directionY" | "x" | "y">,
): DemoEntityProjection {
  if (state.bodyState === "dying") {
    const death = { ...createDeath(state.archetypeId, state.deathCause, progress), ...placement };
    death.facingAngle = facingFor(context.camera, state.direction);
    // The corpse takes the tuned scale too, or sliding it would change a living body and leave the
    // dying one at whatever is on disk — which reads as the slider being broken.
    return projectDemoDeath(context, death, { display: previewDisplay(state) });
  }

  return livingProjection(context, state, progress);
}

/**
 * Bodies on a flying shaft.
 *
 * Left as it was found, and labelled `(broken)` in the situation list to say so: the flight line is
 * an arbitrary diagonal that teleports back to its start, the shaft is a hand-rolled beam rather than
 * the demo's own javelin, and every body faces the camera instead of the way it is travelling.
 */
function carriedScene(elapsedSeconds: number, state: EntityWorkbenchState): RenderScene {
  const context = createContext(elapsedSeconds);
  const projectile = createProjectile(elapsedSeconds, state);
  const projection: { blobs: DemoEntityProjection["blobs"]; sprites: DemoEntityProjection["sprites"] } = {
    blobs: [],
    sprites: [],
  };

  for (let index = 0; index < state.carriedCount; index += 1) {
    const enemy = createEnemy(state.archetypeId, `carried-${index}`);
    mergeProjection(projection, projectCarriedDemoEnemy(context, projectile, enemy, index));
  }

  const height = projectileHeight(projectile);
  const beams: RenderBeam[] = [
    {
      id: "workbench-stick-beam",
      from: {
        x: projectile.x - projectile.directionX * 0.55,
        y: projectile.y - projectile.directionY * 0.55,
        z: height,
      },
      to: {
        x: projectile.x + projectile.directionX * 0.65,
        y: projectile.y + projectile.directionY * 0.65,
        z: height,
      },
      width: 0.045,
      color: [116, 75, 38],
      tipColor: [190, 194, 202],
    },
  ];
  return scene(projection, { beams });
}

type WallSetup = Readonly<{
  camera: CameraPose;
  death: Pick<DemoDeath, "directionX" | "directionY" | "x" | "y">;
  surfaces: readonly RenderSurface[];
}>;

/**
 * One face, and everything else derived from it.
 *
 * The wall cell, the plane the mark snaps to, where the body rests, which way it was travelling and
 * where the camera stands are five statements of a single fact. Written out per face — which is how
 * this started — they are five chances to disagree, and the body ended up further off the masonry
 * than a body can come to rest. `snapToFace` in the demo puts the mark on the grid line the body was
 * heading for, so that line is the only thing worth naming.
 */
function wallSetup(face: WallFace): WallSetup {
  const acrossX = face === "east" || face === "west";
  const towards = face === "north" || face === "west" ? 1 : -1;
  const plane = towards > 0 ? 6 : 3;
  const along = plane - towards * BODY_STANDOFF;
  const back = along - towards * INSPECTION_BACK;
  // A run of masonry rather than one block. A lone cell standing in the middle of the floor gives a
  // decal nothing to be judged against, which is half of why the marks looked wrong.
  const line = towards > 0 ? plane : plane - 1;
  const surfaces: RenderSurface[] = [...ROOM_SURFACES];

  for (let index = 1; index < ROOM_SIZE - 1; index += 1) {
    surfaces.push({ cell: acrossX ? { x: line, y: index } : { x: index, y: line }, material: "demoAshlar" });
  }

  return {
    camera: acrossX
      ? { x: back, y: ROOM_CENTRE, angle: towards > 0 ? 0 : Math.PI }
      : { x: ROOM_CENTRE, y: back, angle: towards > 0 ? Math.PI / 2 : -Math.PI / 2 },
    death: acrossX
      ? { x: along, y: ROOM_CENTRE, directionX: towards, directionY: 0 }
      : { x: ROOM_CENTRE, y: along, directionX: 0, directionY: towards },
    surfaces,
  };
}

function poolFloor(bodies: number): RenderFloorPatch[] {
  const material = POOL_FILL[Math.min(bodies, POOL_FILL.length - 1)] ?? "water";
  return ROOM_FLOOR.map((patch) =>
    patch.cell.x >= POOL_FROM && patch.cell.x <= POOL_TO && patch.cell.y >= POOL_FROM && patch.cell.y <= POOL_TO
      ? { cell: patch.cell, material }
      : patch,
  );
}

/**
 * The whole drowning on one timeline: one point one seconds of a living body, then its corpse.
 *
 * Both halves have to be on the same scrubber. Split across a private loop of its own — which is
 * what this was — the frame control could only ever reach the first half, so the corpse was
 * unreachable and the 1.1 seconds the acceptance list asks for could not be stepped through.
 */
function waterScene(state: EntityWorkbenchState, elapsedSeconds: number, scrub: number): RenderScene {
  const at = scrub * (DROWN_SECONDS + DEATH_SECONDS);
  const context = createContext(elapsedSeconds);
  const floorPatches = poolFloor(state.poolBodies);

  if (at < DROWN_SECONDS) {
    const enemy = createEnemy(state.archetypeId);
    enemy.facingAngle = facingFor(context.camera, state.direction);
    enemy.drowningSeconds = Math.max(0.0001, DROWN_SECONDS - at);
    return scene(projectDemoEnemy(context, enemy), {
      floorPatches,
      // The bubbles the demo puts over anything going under. Without them the water gives back no
      // sign that something is in it, which is most of why this read as nothing happening.
      emitters: [{ id: "workbench-drown", x: enemy.x, y: enemy.y, kind: "steam", density: 9 }],
    });
  }

  const death = createDeath(state.archetypeId, "drowned", (at - DROWN_SECONDS) / DEATH_SECONDS);
  death.facingAngle = facingFor(context.camera, state.direction);
  return scene(projectDemoDeath(context, death), { floorPatches });
}

function mainScene(state: EntityWorkbenchState, elapsedSeconds: number, scrub: number): RenderScene {
  if (state.situation === "skewered") {
    return carriedScene(elapsedSeconds, state);
  }

  if (state.situation === "water") {
    return waterScene(state, elapsedSeconds, scrub);
  }

  if (state.bodyState !== "dying" && livingCoverage(state.archetypeId, state.bodyState) === "missing") {
    return scene({ blobs: [], sprites: [] }, { boxes: missingBodyBoxes(ROOM_CENTRE, BODY_Y) });
  }

  if (state.situation === "wall") {
    const setup = wallSetup(state.wallFace);
    const context = createContext(elapsedSeconds, setup.camera);
    return scene(bodyProjection(context, state, scrub, setup.death), {
      camera: setup.camera,
      surfaces: setup.surfaces,
      light: { x: setup.death.x, y: setup.death.y },
    });
  }

  if (state.situation === "barricade") {
    const context = createContext(elapsedSeconds);
    const placement = { x: 4.5, y: 4.5, directionX: 0, directionY: -1 };
    return scene(bodyProjection(context, state, scrub, placement), {
      boxes: projectDemoBarricade({ x: 4, y: 4 }, state.barricadeWear),
    });
  }

  const camera = previewCamera(state);
  const context = createContext(elapsedSeconds, camera);
  const enemy = createEnemy(state.archetypeId);
  enemy.facingAngle = facingFor(camera, state.direction);
  return scene(bodyProjection(context, state, scrub), {
    camera,
    floorDecals: [...bodyCircles(enemy), ...attackCone(state, enemy)],
  });
}

// ---------------------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------------------

type SelectField = Readonly<{ field: HTMLLabelElement; select: HTMLSelectElement }> & {
  setInert: (inert: boolean) => void;
};

function createSelect<T extends string>(
  id: string,
  labelText: string,
  options: readonly Readonly<{ id: T; label: string }>[],
  value: T,
  onChange: (value: T) => void,
): SelectField {
  const field = document.createElement("label");
  const text = document.createElement("span");
  const select = document.createElement("select");
  field.className = "debug-field";
  text.textContent = labelText;
  select.id = id;

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    select.append(element);
  }

  select.value = value;
  select.addEventListener("change", () => onChange(select.value as T));
  field.append(text, select);
  return {
    field,
    select,
    // Inert rather than hidden. A control that disappears takes its row with it, and everything below
    // moves — which is how the play button ended up somewhere new every time the situation changed.
    setInert: (inert: boolean) => {
      select.disabled = inert;
      field.dataset.inert = String(inert);
    },
  };
}

type RangeField = Readonly<{ field: HTMLLabelElement; input: HTMLInputElement; output: HTMLOutputElement }> & {
  set: (value: number) => void;
  setBounds: (bounds: Readonly<{ max: number; step: number }>) => void;
  setInert: (inert: boolean) => void;
};

function createRange(
  id: string,
  labelText: string,
  value: number,
  min: number,
  max: number,
  step: number,
  format: (value: number) => string,
  onInput: (value: number) => void,
): RangeField {
  const field = document.createElement("label");
  const heading = document.createElement("span");
  const row = document.createElement("span");
  const input = document.createElement("input");
  const output = document.createElement("output");
  field.className = "debug-field";
  row.className = "entity-range";
  heading.textContent = labelText;
  input.id = id;
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  output.htmlFor = id;
  output.textContent = format(value);
  input.addEventListener("input", () => {
    const next = Number(input.value);
    output.textContent = format(next);
    onInput(next);
  });
  row.append(input, output);
  field.append(heading, row);
  return {
    field,
    input,
    output,
    set: (next: number) => {
      input.value = String(next);
      output.textContent = format(next);
    },
    setBounds: (bounds) => {
      input.max = String(bounds.max);
      input.step = String(bounds.step);
    },
    setInert: (inert: boolean) => {
      input.disabled = inert;
      field.dataset.inert = String(inert);
    },
  };
}

function comparisonScene(
  cause: "splattered" | "impaled",
  archetypeId: DemoArchetypeId,
  elapsedSeconds: number,
): RenderScene {
  const progress = (elapsedSeconds / DEATH_SECONDS) % 1;
  return scene(projectDemoDeath(createContext(elapsedSeconds), createDeath(archetypeId, cause, progress)));
}

/** Renders the entity and pickup authoring tabs behind one shared asset-workbench route. */
export function renderEntityWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Entity Workbench",
    description: "Inspect entity animation coverage through the same renderer seams used by the live demo.",
    width: "wide",
  });
  const tabs = document.createElement("div");
  const entityTab = document.createElement("button");
  const propTab = document.createElement("button");
  const entitySection = document.createElement("div");
  const propSection = document.createElement("div");
  tabs.className = "workbench-tabs";
  tabs.setAttribute("role", "tablist");
  entityTab.type = "button";
  entityTab.textContent = "Entities";
  entityTab.setAttribute("role", "tab");
  entityTab.setAttribute("aria-controls", "entity-workbench-tab");
  propTab.type = "button";
  propTab.textContent = "Pickups";
  propTab.setAttribute("role", "tab");
  propTab.setAttribute("aria-controls", "prop-workbench-tab");
  entitySection.id = "entity-workbench-tab";
  entitySection.setAttribute("role", "tabpanel");
  propSection.id = "prop-workbench-tab";
  propSection.setAttribute("role", "tabpanel");
  tabs.append(entityTab, propTab);

  const selectTab = (tab: "entity" | "prop"): void => {
    entityTab.setAttribute("aria-selected", String(tab === "entity"));
    propTab.setAttribute("aria-selected", String(tab === "prop"));
    entitySection.hidden = tab !== "entity";
    propSection.hidden = tab !== "prop";
  };
  entityTab.addEventListener("click", () => selectTab("entity"));
  propTab.addEventListener("click", () => selectTab("prop"));

  const bodyPanel = createDebugPanel(
    "Body",
    "Three axes that do not reset each other: which body, where it is, and what it is doing.",
  );
  const playbackPanel = createDebugPanel(
    "Playback",
    "How the body is being looked at and where in its own timeline it is. 1× is the rate the game runs the selected clip at, not a flat one-second loop.",
  );
  const displayPanel = createDebugPanel(
    "Display",
    "How the body and its markers are drawn, as authored content. Camera distance is not saved — it is the lens the other two are judged through, because a mark that clears the head across a room leaves the frame at arm's reach.",
  );
  const previewPanel = createDebugPanel(
    "Live entity projection",
    "The room, body, wall decal, and hazard props are all drawn by the shipped renderer.",
  );
  const comparePanel = createDebugPanel(
    "Shared deathImpaled check",
    "Skeleton splattered and impaled intentionally select the same authored atlas; keep them side by side when deciding whether that merge still reads clearly.",
  );
  const matrixPanel = createDebugPanel(
    "Entities Animation Check",
    "Every unsupported archetype × state pairing stays explicit.",
  );

  const state: EntityWorkbenchState = {
    archetypeId: "swordsman",
    situation: "room",
    bodyState: "idle",
    deathCause: "slain",
    direction: 0,
    playing: true,
    speed: 1,
    poolBodies: 0,
    barricadeWear: 0,
    wallFace: "north",
    carriedCount: 3,
    flightPitch: 12,
    flightSpeed: 3.5,
    cameraBack: INSPECTION_BACK,
    bodyScale: displays.skeletonSwordsman.bodyScale,
    markerOffset: displays.skeletonSwordsman.markerOffset,
    markerScale: displays.skeletonSwordsman.markerScale,
    markerSwell: displays.skeletonSwordsman.markerSwell,
  };

  const axes = document.createElement("div");
  const settings = document.createElement("section");
  const settingsHeading = document.createElement("h3");
  const settingsGrid = document.createElement("div");
  const playbackGrid = document.createElement("div");
  const playbackRow = document.createElement("div");
  const status = document.createElement("p");
  const playButton = document.createElement("button");
  axes.className = "debug-form-grid entity-workbench-controls";
  settings.className = "entity-situation-panel";
  settingsGrid.className = "debug-form-grid entity-workbench-controls";
  settings.append(settingsHeading, settingsGrid);
  playbackGrid.className = "debug-form-grid entity-workbench-controls";
  playbackRow.className = "debug-button-row entity-playback-row";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  playButton.type = "button";
  playButton.className = "entity-play-button";
  playButton.textContent = "Pause playback";

  let playbackSeconds = 0;
  let shownFrame = -1;

  const scrubOf = (): number => {
    const timeline = timelineSeconds(state);
    return (playbackSeconds % timeline) / timeline;
  };

  const archetype = createSelect(
    "entity-archetype",
    "Archetype",
    Object.values(ENEMY_ARCHETYPES).map((entry) => ({ id: entry.id, label: entry.name })),
    state.archetypeId,
    (value) => {
      state.archetypeId = value;
      refreshControls();
    },
  );
  const situation = createSelect("entity-situation", "Situation", SITUATIONS, state.situation, (value) => {
    state.situation = value;
    // Only this situation's own parameters go back to their defaults. The body, the state, the
    // turntable and the playback speed are three other axes and are not this one's to clear.
    resetSituationSettings();
    refreshControls();
  });
  const bodyState = createSelect("entity-state", "State", BODY_STATES, state.bodyState, (value) => {
    state.bodyState = value;
    refreshControls();
  });
  const deathCause = createSelect(
    "entity-death-cause",
    "Death cause",
    DEATH_CAUSES.map((cause) => ({ id: cause, label: cause })),
    state.deathCause,
    (value) => {
      state.deathCause = value;
      refreshControls();
    },
  );

  const poolBodies = createRange(
    "entity-pool-bodies",
    "Bodies in the pool",
    state.poolBodies,
    0,
    POOL_FILL.length - 1,
    1,
    (value) => POOL_BODY_LABELS[value] ?? String(value),
    (value) => {
      state.poolBodies = value;
    },
  );
  const barricadeWear = createRange(
    "entity-barricade-wear",
    "Barricade wear",
    state.barricadeWear,
    0,
    1,
    0.05,
    (value) => `${Math.round(value * 100)}%`,
    (value) => {
      state.barricadeWear = value;
    },
  );
  const wallFace = createSelect(
    "entity-wall-face",
    "Wall face",
    WALL_FACES.map((face) => ({ id: face, label: face })),
    state.wallFace,
    (value) => {
      state.wallFace = value;
    },
  );
  const carriedCount = createRange(
    "entity-carried-count",
    "Bodies on stick",
    state.carriedCount,
    1,
    6,
    1,
    String,
    (value) => {
      state.carriedCount = value;
    },
  );
  const flightPitch = createRange(
    "entity-flight-pitch",
    "Flight pitch",
    state.flightPitch,
    -20,
    40,
    1,
    (value) => `${value}°`,
    (value) => {
      state.flightPitch = value;
    },
  );
  const flightSpeed = createRange(
    "entity-flight-speed",
    "Flight speed",
    state.flightSpeed,
    1,
    10,
    0.5,
    (value) => `${value} cells/s`,
    (value) => {
      state.flightSpeed = value;
    },
  );

  const direction = createRange(
    "entity-direction",
    "Direction turntable",
    state.direction,
    0,
    DIRECTIONS - 1,
    1,
    (value) => `${value} · ${DIRECTION_LABELS[value] ?? "unknown"}`,
    (value) => {
      state.direction = value;
    },
  );
  direction.field.classList.add("entity-range-field--direction");
  const scrubber = createRange(
    "entity-frame",
    "Frame scrubber",
    0,
    0,
    7,
    1,
    (value) => scrubberLabel(value),
    (value) => {
      const frames = timelineFrames(state);
      const fraction = frames > 0 ? value / frames : value / 100;
      playbackSeconds = fraction * timelineSeconds(state);
      state.playing = false;
      playButton.textContent = "Play animation";
    },
  );
  const speed = createRange(
    "entity-speed",
    "Playback speed",
    state.speed,
    0.25,
    2,
    0.25,
    (value) => `${value}×`,
    (value) => {
      state.speed = value;
    },
  );

  function scrubberLabel(value: number): string {
    const frames = timelineFrames(state);
    return frames > 0 ? `${Math.min(frames, value + 1)} / ${frames}` : `${value}%`;
  }

  function resetSituationSettings(): void {
    state.poolBodies = 0;
    state.barricadeWear = 0;
    state.wallFace = "north";
    state.carriedCount = 3;
    state.flightPitch = 12;
    state.flightSpeed = 3.5;
    poolBodies.set(state.poolBodies);
    barricadeWear.set(state.barricadeWear);
    wallFace.select.value = state.wallFace;
    carriedCount.set(state.carriedCount);
    flightPitch.set(state.flightPitch);
    flightSpeed.set(state.flightSpeed);
  }

  /** Which fields belong to the situation now selected. The rest stay in place, inert. */
  function refreshSettings(): void {
    const preset = SITUATIONS.find((entry) => entry.id === state.situation);
    settingsHeading.textContent = `${preset?.settings ?? state.situation} settings`;
    const owned: Readonly<Record<EntitySituation, readonly { setInert: (inert: boolean) => void }[]>> = {
      room: [],
      water: [poolBodies],
      barricade: [barricadeWear],
      wall: [wallFace],
      skewered: [carriedCount, flightPitch, flightSpeed],
    };

    for (const control of [poolBodies, barricadeWear, wallFace, carriedCount, flightPitch, flightSpeed]) {
      control.setInert(!owned[state.situation].includes(control));
    }
  }

  function refreshStatus(): void {
    const archetypeName = ENEMY_ARCHETYPES[state.archetypeId].name;
    const situationLabel = SITUATIONS.find((entry) => entry.id === state.situation)?.label ?? state.situation;
    const notes: string[] = [];

    if (state.situation === "water") {
      notes.push(
        `the water owns the state: ${DROWN_SECONDS}s going under, then ${DEATH_SECONDS}s of corpse, on one scrubber`,
      );
    } else if (state.situation === "skewered") {
      notes.push("state and turntable do not apply to a body frozen on a shaft, and this scene is known broken");
    } else if (state.bodyState === "dying") {
      const finding = deathCoverage(state.archetypeId).get(state.deathCause);

      if (finding && finding.state !== "available") {
        notes.push(finding.note.toLowerCase());
      }

      if (state.situation === "wall" && isBoned(ENEMY_ARCHETYPES[state.archetypeId])) {
        notes.push("bones do not stain, so a body driven into masonry is a heap at the foot of a clean wall");
      }
    } else if (livingCoverage(state.archetypeId, state.bodyState) === "missing") {
      notes.push(`no ${state.bodyState} of its own — the preview shows a placeholder instead of falling back to idle`);
    } else if (state.bodyState === "windup" || state.bodyState === "recovery") {
      notes.push(
        `held at its final pose for the rest of the ${timelineSeconds(state).toFixed(1)}s — the clip reaches it in ${ATTACK_EASE_SECONDS}s whatever the length`,
      );
    }

    const stateLabel = state.bodyState === "dying" ? `dying · ${state.deathCause}` : state.bodyState;
    status.textContent = `${archetypeName} · ${situationLabel} · ${stateLabel}${notes.length > 0 ? ` — ${notes.join("; ")}` : ""}`;
  }

  function refreshControls(): void {
    const scripted = state.situation === "water" || state.situation === "skewered";
    bodyState.setInert(scripted);
    deathCause.setInert(scripted || state.bodyState !== "dying");
    direction.setInert(state.situation === "skewered");
    // Water, walls and flight each frame the body deliberately. Only the open room is the slider's.
    cameraBack.setInert(state.situation !== "room");
    const frames = timelineFrames(state);
    scrubber.setBounds(frames > 0 ? { max: frames - 1, step: 1 } : { max: 100, step: 1 });
    shownFrame = -1;
    refreshSettings();
    // Reads from the working table rather than resetting it, so switching archetype and back does not
    // discard a number that has been slid but not saved.
    refreshDisplayFields();
    refreshStatus();
  }

  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playButton.textContent = state.playing ? "Pause playback" : "Play animation";
  });

  axes.append(archetype.field, situation.field, bodyState.field, deathCause.field);
  settingsGrid.append(
    poolBodies.field,
    barricadeWear.field,
    wallFace.field,
    carriedCount.field,
    flightPitch.field,
    flightSpeed.field,
  );
  bodyPanel.body.append(axes, settings);
  // The three sliders, then the button under them. Nothing above the button changes size: all three
  // sliders are always present in this panel, and the situation's own controls live in another one.
  playbackGrid.append(direction.field, scrubber.field, speed.field);
  playbackRow.append(playButton);
  playbackPanel.body.append(playbackGrid, playbackRow);

  const displayGrid = document.createElement("div");
  const displayRow = document.createElement("div");
  const displayStatus = document.createElement("p");
  const saveDisplay = document.createElement("button");
  const reloadDisplay = document.createElement("button");
  displayGrid.className = "debug-form-grid entity-workbench-controls";
  displayRow.className = "debug-button-row entity-playback-row";
  displayStatus.className = "entity-workbench-status";
  displayStatus.setAttribute("role", "status");
  saveDisplay.type = "button";
  saveDisplay.textContent = "Save display JSON";
  reloadDisplay.type = "button";
  reloadDisplay.textContent = "Reload from disk";

  const cameraBack = createRange(
    "entity-camera-back",
    "Camera distance",
    state.cameraBack,
    0.8,
    9,
    0.05,
    (value) => `${value.toFixed(2)} cells`,
    (value) => {
      state.cameraBack = value;
    },
  );

  const bodyScale = createRange(
    "entity-body-scale",
    "Body scale",
    state.bodyScale,
    0.2,
    2,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      state.bodyScale = value;
      displays[ENEMY_ARCHETYPES[state.archetypeId].appearance] = previewDisplay(state);
      displayStatus.textContent = "Unsaved display changes.";
    },
  );

  const markerOffset = createRange(
    "entity-marker-offset",
    "Marker offset",
    state.markerOffset,
    -0.6,
    0.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      state.markerOffset = value;
      displays[ENEMY_ARCHETYPES[state.archetypeId].appearance] = previewDisplay(state);
      displayStatus.textContent = "Unsaved display changes.";
    },
  );

  const markerScale = createRange(
    "entity-marker-scale",
    "Marker scale",
    state.markerScale,
    0.1,
    1.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      state.markerScale = value;
      displays[ENEMY_ARCHETYPES[state.archetypeId].appearance] = previewDisplay(state);
      displayStatus.textContent = "Unsaved display changes.";
    },
  );

  const markerSwell = createRange(
    "entity-marker-swell",
    "Marker swell",
    state.markerSwell,
    0,
    1,
    0.005,
    (value) => `+${value.toFixed(3)}`,
    (value) => {
      state.markerSwell = value;
      displays[ENEMY_ARCHETYPES[state.archetypeId].appearance] = previewDisplay(state);
      displayStatus.textContent = "Unsaved display changes.";
    },
  );

  /** Pulls the sliders back to whatever the working table holds for the archetype now on screen. */
  function refreshDisplayFields(): void {
    const archetypeNow = ENEMY_ARCHETYPES[state.archetypeId];
    const current = displays[archetypeNow.appearance];
    state.bodyScale = current.bodyScale;
    state.markerOffset = current.markerOffset;
    state.markerScale = current.markerScale;
    state.markerSwell = current.markerSwell;
    bodyScale.set(state.bodyScale);
    markerOffset.set(state.markerOffset);
    markerScale.set(state.markerScale);
    markerSwell.set(state.markerSwell);
    // A soft body's size comes from its own profile, so the scale slider has nothing to move on one.
    bodyScale.setInert(!isBoned(archetypeNow));
    // An archetype that never winds up wears no mark, so its three mark controls have nothing to show.
    const marked = archetypeNow.windupIntent !== undefined && state.bodyState === "windup";

    for (const control of [markerOffset, markerScale, markerSwell]) {
      control.setInert(!marked);
    }
  }

  saveDisplay.addEventListener("click", () => {
    saveDisplay.disabled = true;
    displayStatus.textContent = "Validating and saving display JSON…";
    void saveCanonical("entityDisplay", Object.values(displays))
      .then((message) => {
        displayStatus.textContent = message;
      })
      .catch((error: unknown) => {
        displayStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveDisplay.disabled = false;
      });
  });

  // Asked for rather than done to you: the dev server does not watch these files, so that saving one
  // cannot reload the page out from under whoever is tuning it. This is how a hand edit is picked up, or
  // how numbers slid but never saved are thrown away.
  reloadDisplay.addEventListener("click", () => {
    reloadDisplay.disabled = true;
    displayStatus.textContent = "Reading display JSON from disk…";
    void loadCanonical("entityDisplay")
      .then((source) => {
        Object.assign(displays, entityDisplaysByAppearance(parseEntityDisplays(source)));
        refreshDisplayFields();
        displayStatus.textContent = "Reloaded display JSON from disk.";
      })
      .catch((error: unknown) => {
        displayStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadDisplay.disabled = false;
      });
  });

  displayGrid.append(cameraBack.field, bodyScale.field, markerOffset.field, markerScale.field, markerSwell.field);
  displayRow.append(saveDisplay, reloadDisplay);
  displayPanel.body.append(displayGrid, displayRow, displayStatus);
  refreshDisplayFields();

  const preview = createRenderPanel({
    ariaLabel: "Entity workbench live preview",
    frame: (timing) => {
      if (state.playing) {
        playbackSeconds += timing.frameSeconds * state.speed;
      }

      const scrub = scrubOf();
      const frames = timelineFrames(state);
      const position = frames > 0 ? Math.min(frames - 1, Math.floor(scrub * frames)) : Math.round(scrub * 100);

      if (state.playing && position !== shownFrame) {
        shownFrame = position;
        scrubber.set(position);
      }

      return {
        scene: mainScene(state, playbackSeconds, scrub),
        preferences: { grade: true },
      };
    },
  });
  previewPanel.body.append(preview.element, status);

  const comparisonGrid = document.createElement("div");
  comparisonGrid.className = "entity-comparison-grid";

  for (const cause of ["splattered", "impaled"] as const) {
    const item = document.createElement("section");
    const heading = document.createElement("h3");
    const panel = createRenderPanel({
      ariaLabel: `Skeleton ${cause} death preview`,
      frame: (timing) => ({
        scene: comparisonScene(cause, "swordsman", timing.elapsedSeconds),
        preferences: { grade: true },
      }),
    });
    heading.textContent = cause;
    item.append(heading, panel.element);
    comparisonGrid.append(item);
  }

  comparePanel.body.append(comparisonGrid);
  matrixPanel.body.append(createCoverageMatrix());
  refreshControls();
  entitySection.append(
    bodyPanel.panel,
    playbackPanel.panel,
    displayPanel.panel,
    previewPanel.panel,
    comparePanel.panel,
    matrixPanel.panel,
  );
  propSection.append(createPropWorkbench());
  content.append(tabs, entitySection, propSection);
  mount.replaceChildren(page);
  selectTab("entity");
}
