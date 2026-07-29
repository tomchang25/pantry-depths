import { createDebugPage, createDebugPanel, createDebugScroller } from "@/app/debug/debug-shell";
import { createRenderPanel } from "@/app/debug/render-panel";
import {
  SKELETON_SWORDSMAN_ANIMATIONS,
  type SkeletonSwordsmanAnimationId,
} from "@/content/enemies/skeleton-swordsman-definitions";
import {
  projectCarriedDemoEnemy,
  projectDemoBarricade,
  projectDemoDeath,
  projectDemoEnemy,
  type DemoEntityProjection,
  type DemoEntityProjectionContext,
} from "@/demo/demo-scene";
import { ENEMY_ARCHETYPES, type DemoArchetypeId } from "@/demo/enemy-archetypes";
import {
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
  RenderFloorPatch,
  RenderScene,
  RenderSurface,
} from "@/presentation/render-scene";

type EntityScenario = "clip" | "death" | "carried" | "wall" | "barricade" | "drowning";
type WallFace = "north" | "east" | "south" | "west";

type EntityWorkbenchState = {
  archetypeId: DemoArchetypeId;
  clip: SkeletonSwordsmanAnimationId;
  deathCause: DemoDeathCause;
  direction: number;
  frame: number;
  playing: boolean;
  scenario: EntityScenario;
  speed: number;
  carriedCount: number;
  flightPitch: number;
  flightSpeed: number;
  wallFace: WallFace;
};

const SCENARIOS: readonly Readonly<{ id: EntityScenario; label: string }>[] = [
  { id: "clip", label: "Clip turntable" },
  { id: "death", label: "Death cause" },
  { id: "carried", label: "Skewered flight" },
  { id: "wall", label: "Wall splatter" },
  { id: "barricade", label: "Barricade impale" },
  { id: "drowning", label: "1.1 second drowning" },
];

const DEATH_CAUSES: readonly DemoDeathCause[] = ["slain", "cleaved", "drowned", "splattered", "blasted", "impaled"];

const CLIP_DEATH_CAUSES: Partial<Record<SkeletonSwordsmanAnimationId, DemoDeathCause>> = {
  death: "slain",
  deathSeverRight: "cleaved",
  deathBlasted: "blasted",
  deathImpaled: "impaled",
  deathDrowned: "drowned",
};

const DIRECTION_LABELS = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];
const ROOM_SIZE = 9;
const ENTITY_X = 4.5;
const ENTITY_Y = 4.25;
const DEFAULT_CAMERA: CameraPose = { x: 4.5, y: 7.35, angle: -Math.PI / 2 };

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

const ROOM_SURFACES = roomSurfaces();
const ROOM_TILES = Array.from({ length: ROOM_SIZE }, (_rowValue, y) =>
  Array.from({ length: ROOM_SIZE }, (_columnValue, x) =>
    x === 0 || y === 0 || x === ROOM_SIZE - 1 || y === ROOM_SIZE - 1 ? "#" : ".",
  ).join(""),
);

function createEnemy(archetypeId: DemoArchetypeId, id = "workbench-enemy"): DemoEnemy {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return {
    id,
    archetype,
    appearance: archetype.appearance,
    x: ENTITY_X,
    y: ENTITY_Y,
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
    windupSeconds: 0,
    windupTotal: Math.max(0.001, archetype.windup),
    intent: "none",
    chargeSeconds: 0,
    chargeX: 0,
    chargeY: -1,
    drowningSeconds: 0,
    facingAngle: DEFAULT_CAMERA.angle + Math.PI,
    moving: false,
  };
}

function createDeath(archetypeId: DemoArchetypeId, cause: DemoDeathCause, progress: number): DemoDeath {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return {
    id: `workbench-${archetypeId}-${cause}`,
    appearance: archetype.appearance,
    x: ENTITY_X,
    y: ENTITY_Y,
    progress,
    cause,
    directionX: 0,
    directionY: -1,
    archetypeId,
    facingAngle: DEFAULT_CAMERA.angle + Math.PI,
  };
}

function createContext(elapsedSeconds: number, camera: CameraPose = DEFAULT_CAMERA): DemoEntityProjectionContext {
  return {
    elapsedSeconds,
    camera: { x: camera.x, y: camera.y, angle: camera.angle },
  };
}

function mergeProjection(
  target: { blobs: DemoEntityProjection["blobs"]; sprites: DemoEntityProjection["sprites"] },
  next: DemoEntityProjection,
): void {
  target.blobs = [...target.blobs, ...next.blobs];
  target.sprites = [...target.sprites, ...next.sprites];
}

function scene(
  projection: DemoEntityProjection,
  options: Readonly<{
    beams?: readonly RenderBeam[];
    boxes?: readonly RenderBox[];
    camera?: CameraPose;
    floorPatches?: readonly RenderFloorPatch[];
    surfaces?: readonly RenderSurface[];
  }> = {},
): RenderScene {
  return {
    floorId: "entity-workbench",
    theme: "demo",
    width: ROOM_SIZE,
    height: ROOM_SIZE,
    tiles: ROOM_TILES,
    camera: options.camera ?? DEFAULT_CAMERA,
    ambient: [0.24, 0.2, 0.3],
    wallHeight: 1.4,
    eyeHeight: 0.5,
    surfaces: options.surfaces ?? ROOM_SURFACES,
    blobs: projection.blobs,
    sprites: projection.sprites,
    ...(options.floorPatches ? { floorPatches: options.floorPatches } : {}),
    ...(options.boxes ? { boxes: options.boxes } : {}),
    ...(options.beams ? { beams: options.beams } : {}),
    lights: [{ id: "inspection-light", x: ENTITY_X, y: ENTITY_Y + 1, radius: 5, color: [255, 178, 112], intensity: 1 }],
    emitters: [],
  };
}

function isClipAvailable(archetypeId: DemoArchetypeId, clip: SkeletonSwordsmanAnimationId): boolean {
  return archetypeId === "swordsman" || clip !== "walk";
}

function livingProjection(
  context: DemoEntityProjectionContext,
  state: EntityWorkbenchState,
  progress: number,
): DemoEntityProjection {
  if (!isClipAvailable(state.archetypeId, state.clip)) {
    return { blobs: [], sprites: [] };
  }

  const enemy = createEnemy(state.archetypeId);
  enemy.facingAngle = context.camera.angle + Math.PI - (state.direction / 8) * Math.PI * 2;

  if (state.clip === "walk") {
    enemy.moving = true;
  } else if (state.clip === "attack") {
    enemy.windupTotal = 1;
    enemy.windupSeconds = Math.max(0.0001, 1 - progress);
    enemy.intent = "melee";
  } else if (state.clip === "hurt") {
    enemy.hurtSeconds = Math.max(0.0001, 0.28 * (1 - progress));
  } else if (state.clip === "block") {
    enemy.stunSeconds = 1;
  }

  return projectDemoEnemy(context, enemy, {
    skeletonAnimation: { animation: state.clip, progress },
  });
}

function clipProjection(
  context: DemoEntityProjectionContext,
  state: EntityWorkbenchState,
  progress: number,
): DemoEntityProjection {
  const deathCause = CLIP_DEATH_CAUSES[state.clip];

  if (deathCause) {
    const death = createDeath(state.archetypeId, deathCause, progress);
    death.facingAngle = context.camera.angle + Math.PI - (state.direction / 8) * Math.PI * 2;
    return projectDemoDeath(context, death);
  }

  return livingProjection(context, state, progress);
}

function createProjectile(elapsedSeconds: number, state: EntityWorkbenchState): DemoProjectile {
  const range = 3;
  const travelled = (elapsedSeconds * state.flightSpeed) % range;
  const pitchRadians = (state.flightPitch / 180) * Math.PI;
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
    range,
    speed: state.flightSpeed,
    drag: 0,
    plunge: 1,
    thud: 1,
    arc: Math.tan(pitchRadians) * range,
    fall: 0,
    payload: undefined,
    struck: new Set<string>(),
    trail: [],
    skewered: [],
    cleaved: 0,
  };
}

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

function wallSetup(face: WallFace): Readonly<{
  camera: CameraPose;
  death: Pick<DemoDeath, "directionX" | "directionY" | "x" | "y">;
  surface: RenderSurface;
}> {
  if (face === "north") {
    return {
      camera: { x: 4.5, y: 2.7, angle: Math.PI / 2 },
      death: { x: 4.5, y: 4.2, directionX: 0, directionY: 1 },
      surface: { cell: { x: 4, y: 5 }, material: "demoAshlar" },
    };
  }

  if (face === "east") {
    return {
      camera: { x: 7.3, y: 4.5, angle: Math.PI },
      death: { x: 5.8, y: 4.5, directionX: -1, directionY: 0 },
      surface: { cell: { x: 4, y: 4 }, material: "demoAshlar" },
    };
  }

  if (face === "south") {
    return {
      camera: { x: 4.5, y: 7.3, angle: -Math.PI / 2 },
      death: { x: 4.5, y: 5.8, directionX: 0, directionY: -1 },
      surface: { cell: { x: 4, y: 4 }, material: "demoAshlar" },
    };
  }

  return {
    camera: { x: 2.7, y: 4.5, angle: 0 },
    death: { x: 4.2, y: 4.5, directionX: 1, directionY: 0 },
    surface: { cell: { x: 5, y: 4 }, material: "demoAshlar" },
  };
}

function mainScene(elapsedSeconds: number, progress: number, state: EntityWorkbenchState): RenderScene {
  if (state.scenario === "carried") {
    return carriedScene(elapsedSeconds, state);
  }

  if (state.scenario === "wall") {
    const setup = wallSetup(state.wallFace);
    const death = { ...createDeath(state.archetypeId, "splattered", progress), ...setup.death };
    return scene(projectDemoDeath(createContext(elapsedSeconds, setup.camera), death), {
      camera: setup.camera,
      surfaces: [...ROOM_SURFACES, setup.surface],
    });
  }

  if (state.scenario === "barricade") {
    const death = createDeath(state.archetypeId, "impaled", progress);
    death.x = 4.5;
    death.y = 4.5;
    return scene(projectDemoDeath(createContext(elapsedSeconds), death), {
      boxes: projectDemoBarricade({ x: 4, y: 4 }),
    });
  }

  if (state.scenario === "drowning") {
    const cycle = (elapsedSeconds * state.speed) % 2.1;
    const context = createContext(elapsedSeconds);
    let projection: DemoEntityProjection;

    if (cycle < 1.1) {
      const enemy = createEnemy(state.archetypeId);
      enemy.drowningSeconds = Math.max(0.0001, 1.1 - cycle);
      projection = projectDemoEnemy(context, enemy);
    } else {
      projection = projectDemoDeath(context, createDeath(state.archetypeId, "drowned", cycle - 1.1));
    }

    return scene(projection, { floorPatches: [{ cell: { x: 4, y: 4 }, material: "water" }] });
  }

  const context = createContext(elapsedSeconds);

  if (state.scenario === "death") {
    return scene(projectDemoDeath(context, createDeath(state.archetypeId, state.deathCause, progress)));
  }

  return scene(clipProjection(context, state, progress));
}

function createSelect<T extends string>(
  id: string,
  labelText: string,
  options: readonly Readonly<{ id: T; label: string }>[],
  value: T,
  onChange: (value: T) => void,
): HTMLLabelElement {
  const label = document.createElement("label");
  const text = document.createElement("span");
  const select = document.createElement("select");
  label.className = "debug-field";
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
  label.append(text, select);
  return label;
}

function createRange(
  id: string,
  labelText: string,
  value: number,
  min: number,
  max: number,
  step: number,
  format: (value: number) => string,
  onInput: (value: number) => void,
): Readonly<{ field: HTMLLabelElement; input: HTMLInputElement; output: HTMLOutputElement }> {
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
  return { field, input, output };
}

function createGapMatrix(): HTMLDivElement {
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const body = document.createElement("tbody");
  const columns = ["8-way", ...Object.keys(SKELETON_SWORDSMAN_ANIMATIONS), "squash", "droop"];
  caption.textContent =
    "A visible placeholder means that archetype has no authored equivalent; the workbench never substitutes idle.";

  for (const label of ["Archetype", ...columns]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }

  head.append(headerRow);

  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = archetype.name;
    row.append(heading);

    for (const column of columns) {
      const cell = document.createElement("td");
      const authored =
        archetype.id === "swordsman"
          ? column !== "squash" && column !== "droop"
          : column !== "8-way" && column !== "walk";
      cell.dataset.state = authored ? "available" : "missing";
      cell.textContent = authored ? "Available" : "Missing — placeholder";
      row.append(cell);
    }

    body.append(row);
  }

  table.append(caption, head, body);
  return createDebugScroller(table, "Entity animation coverage matrix");
}

function comparisonScene(cause: "splattered" | "impaled", elapsedSeconds: number): RenderScene {
  const progress = elapsedSeconds % 1;
  return scene(projectDemoDeath(createContext(elapsedSeconds), createDeath("swordsman", cause, progress)));
}

/** Renders every entity clip, death, hazard landing, and known authored-animation gap in one tool. */
export function renderEntityWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Entity Workbench",
    description:
      "Inspect authored skeleton clips and procedural slime bodies through the same projection functions used by the live demo.",
    width: "wide",
  });
  const controls = createDebugPanel(
    "Entity and playback",
    "Choose a reproducible scene, then scrub or loop its presentation state.",
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
    clip: "idle",
    deathCause: "slain",
    direction: 0,
    frame: 0,
    playing: true,
    scenario: "clip",
    speed: 1,
    carriedCount: 3,
    flightPitch: 12,
    flightSpeed: 3.5,
    wallFace: "north",
  };
  const form = document.createElement("div");
  const playbackRow = document.createElement("div");
  const status = document.createElement("p");
  const playButton = document.createElement("button");
  form.className = "debug-form-grid entity-workbench-controls";
  playbackRow.className = "debug-button-row";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  playButton.type = "button";
  playButton.textContent = "Pause playback";

  const refreshStatus = (): void => {
    const archetype = ENEMY_ARCHETYPES[state.archetypeId];

    if (state.scenario === "clip" && !isClipAvailable(state.archetypeId, state.clip)) {
      status.textContent = `${archetype.name} has no ${state.clip} state. The preview is intentionally empty instead of falling back to idle.`;
      return;
    }

    status.textContent = `${archetype.name} · ${SCENARIOS.find((scenario) => scenario.id === state.scenario)?.label ?? state.scenario}`;
  };

  const scenario = createSelect("entity-scenario", "Scenario", SCENARIOS, state.scenario, (value) => {
    state.scenario = value;
    refreshStatus();
  });
  const archetype = createSelect(
    "entity-archetype",
    "Archetype",
    Object.values(ENEMY_ARCHETYPES).map((entry) => ({ id: entry.id, label: entry.name })),
    state.archetypeId,
    (value) => {
      state.archetypeId = value;
      refreshStatus();
    },
  );
  const clip = createSelect(
    "entity-clip",
    "Clip / body state",
    Object.keys(SKELETON_SWORDSMAN_ANIMATIONS).map((id) => ({ id: id as SkeletonSwordsmanAnimationId, label: id })),
    state.clip,
    (value) => {
      state.clip = value;
      refreshStatus();
    },
  );
  const deathCause = createSelect(
    "entity-death-cause",
    "Death cause",
    DEATH_CAUSES.map((cause) => ({ id: cause, label: cause })),
    state.deathCause,
    (value) => {
      state.deathCause = value;
    },
  );
  const wallFace = createSelect(
    "entity-wall-face",
    "Wall face",
    (["north", "east", "south", "west"] as const).map((face) => ({ id: face, label: face })),
    state.wallFace,
    (value) => {
      state.wallFace = value;
    },
  );
  const direction = createRange(
    "entity-direction",
    "Direction turntable",
    state.direction,
    0,
    7,
    1,
    (value) => `${value} · ${DIRECTION_LABELS[value] ?? "unknown"}`,
    (value) => {
      state.direction = value;
    },
  );
  const frame = createRange(
    "entity-frame",
    "Frame scrubber",
    state.frame,
    0,
    7,
    1,
    (value) => `${value + 1} / 8`,
    (value) => {
      state.frame = value;
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

  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playButton.textContent = state.playing ? "Pause playback" : "Play animation";
  });
  playbackRow.append(playButton);
  form.append(
    scenario,
    archetype,
    clip,
    deathCause,
    wallFace,
    direction.field,
    frame.field,
    speed.field,
    carriedCount.field,
    flightPitch.field,
    flightSpeed.field,
  );
  controls.body.append(form, playbackRow, status);

  let visibleFrame = -1;
  const preview = createRenderPanel({
    ariaLabel: "Entity workbench live preview",
    frame: (timing) => {
      const progress = state.playing ? (timing.elapsedSeconds * state.speed) % 1 : state.frame / 8;
      const nextFrame = Math.min(7, Math.floor(progress * 8));

      if (state.playing && nextFrame !== visibleFrame) {
        visibleFrame = nextFrame;
        state.frame = nextFrame;
        frame.input.value = String(nextFrame);
        frame.output.textContent = `${nextFrame + 1} / 8`;
      }

      return {
        scene: mainScene(timing.elapsedSeconds, progress, state),
        preferences: { viewmodel: false, grade: true },
      };
    },
  });
  previewPanel.body.append(preview.element);

  const comparisonGrid = document.createElement("div");
  comparisonGrid.className = "entity-comparison-grid";

  for (const cause of ["splattered", "impaled"] as const) {
    const item = document.createElement("section");
    const heading = document.createElement("h3");
    const panel = createRenderPanel({
      ariaLabel: `Skeleton ${cause} death preview`,
      frame: (timing) => ({
        scene: comparisonScene(cause, timing.elapsedSeconds),
        preferences: { viewmodel: false, grade: true },
      }),
    });
    heading.textContent = cause;
    item.append(heading, panel.element);
    comparisonGrid.append(item);
  }

  comparePanel.body.append(comparisonGrid);
  matrixPanel.body.append(createGapMatrix());
  refreshStatus();
  content.append(controls.panel, previewPanel.panel, comparePanel.panel, matrixPanel.panel);
  mount.replaceChildren(page);
}
