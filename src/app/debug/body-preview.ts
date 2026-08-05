/**
 * One body, standing on a real floor, at the distance the game draws it.
 *
 * The Entity Workbench answers what a body looks like; this answers whether it looks right where it
 * will actually be seen — in the game's own light, against the game's own masonry, with the game's
 * own renderer drawing it. The two are different questions and a tool that only asked the first is
 * how a body gets tuned against a close camera and lands wrong at playing distance.
 *
 * It is also where the four authored display numbers are judged, because all four are statements
 * about that distance: how tall the body stands, and where the mark over a committed one sits, how
 * big it is, and how much it swells as the wind-up runs. Nothing here recomputes them — the sliders
 * push an override into the renderer and the renderer draws what it would draw, so what is being
 * judged is the number and not this tool's arithmetic.
 */

import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel, createWorkbenchStage } from "@/app/debug/render-panel";
import entityDisplayJson from "@/content/enemies/entity-display.json";
import {
  entityDisplaysByAppearance,
  parseEntityDisplays,
  type EntityDisplay,
} from "@/content/enemies/entity-display-schema";
import { ENEMY_ARCHETYPES } from "@/content/enemies/enemy-archetypes";
import type { EnemyAppearanceId } from "@/core/combat/enemy-contract";
import { attackCooldown, attackWindup, isBoned, STRIKE_SECONDS } from "@/core/combat/enemy-contract";
import { DROWN_SECONDS } from "@/core/damage/area";
import type { MapCastKind } from "@/core/floor/room-contract";
import { createEnemy, type Enemy } from "@/core/world";

/**
 * What the body is doing, named the way a person asks for it.
 *
 * These are not clips. The renderer chooses a clip from simulation state, so this tab sets the state
 * and lets it choose — which is the only way a preview can be trusted to agree with play. Three of
 * the eight have no clip at all and are told by the body's transform and colour instead; they are
 * offered anyway, because "what does being clubbed look like" is a real question about a body.
 */
const BODY_STATES = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "windup", label: "Wind-up" },
  { id: "strike", label: "Strike" },
  { id: "recovery", label: "Recovery" },
  { id: "stunned", label: "Stunned" },
  { id: "hurt", label: "Hurt" },
  { id: "drowning", label: "Going under" },
] as const;

type BodyState = (typeof BODY_STATES)[number]["id"];

const ARCHETYPE_IDS = Object.keys(ENEMY_ARCHETYPES) as MapCastKind[];

/** How many headings the wheel steps through, matching the strip beside it. */
const HEADINGS = 8;

/** Matched to the pickup tab, so a body and a pickup are compared from the same distance. */
const DEFAULT_BACK = 2.6;

/**
 * The authored table, as a working copy this tab edits.
 *
 * Mutable on purpose and mutable only here: what is on screen is always what would be written, and
 * the save sends the whole table through the same validator the file is loaded with.
 */
const displays = entityDisplaysByAppearance(parseEntityDisplays(entityDisplayJson)) as Record<
  EnemyAppearanceId,
  EntityDisplay
>;

type PreviewState = {
  archetypeId: MapCastKind;
  bodyState: BodyState;
  cameraBack: number;
  heading: number;
  playing: boolean;
  progress: number;
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
): Readonly<{ field: HTMLLabelElement; set: (next: number) => void; setInert: (inert: boolean) => void }> {
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
    set: (next: number) => {
      input.value = String(next);
      output.textContent = format(next);
    },
    setInert: (inert: boolean) => {
      input.disabled = inert;
      field.dataset.inert = inert ? "true" : "false";
    },
  };
}

function createSelect(
  id: string,
  labelText: string,
  options: readonly Readonly<{ label: string; value: string }>[],
): Readonly<{ field: HTMLLabelElement; select: HTMLSelectElement }> {
  const field = document.createElement("label");
  const heading = document.createElement("span");
  const select = document.createElement("select");
  field.className = "debug-field";
  heading.textContent = labelText;
  select.id = id;

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }

  field.append(heading, select);
  return { field, select };
}

/**
 * Drive one body into the state the controls describe.
 *
 * Every field written here is one the rules also write, and the timers run backwards from the
 * scrubber so what the preview shows is what the game computes — including the ease-then-hold on a
 * wind-up, which forcing a clip position linearly would quietly hide.
 */
function poseBody(enemy: Enemy, state: PreviewState): void {
  const archetype = enemy.archetype;
  enemy.stunSeconds = 0;
  enemy.hurtSeconds = 0;
  enemy.drowningSeconds = 0;
  enemy.windupSeconds = 0;
  enemy.windupTotal = Math.max(0.001, attackWindup(archetype));
  enemy.attackPoseSeconds = 0;
  enemy.attackCooldown = 0;
  enemy.intent = "none";
  enemy.moving = false;
  enemy.facingAngle = (state.heading / HEADINGS) * Math.PI * 2;

  const remaining = 1 - state.progress;

  if (state.bodyState === "walk") {
    enemy.moving = true;
    return;
  }

  if (state.bodyState === "windup") {
    enemy.windupSeconds = enemy.windupTotal * remaining;
    // A body with no wind-up intent wears no mark; one that has an intent wears the mark its own
    // attack asks for, which is the whole reason the three marker numbers below are per appearance.
    enemy.intent = archetype.windupIntent ?? "none";
    return;
  }

  if (state.bodyState === "strike") {
    enemy.attackPoseSeconds = STRIKE_SECONDS * remaining;
    return;
  }

  if (state.bodyState === "recovery") {
    enemy.attackCooldown = attackCooldown(archetype) * remaining;
    return;
  }

  if (state.bodyState === "stunned") {
    enemy.stunSeconds = 1;
    return;
  }

  if (state.bodyState === "hurt") {
    enemy.hurtSeconds = 0.28 * remaining;
    return;
  }

  if (state.bodyState === "drowning") {
    enemy.drowningSeconds = DROWN_SECONDS * remaining;
  }
}

export function createBodyPreview(): HTMLElement {
  const root = document.createElement("div");
  const controls = createDebugPanel(
    "In the room",
    "One body in the authored testbed room, drawn by the renderer the game draws through. The four numbers below are previewed live and written only when asked.",
  );
  const previewPanel = createDebugPanel("Preview", "The game's own light, masonry and camera height.");
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const saveButton = document.createElement("button");
  const reloadButton = document.createElement("button");
  grid.className = "debug-form-grid entity-workbench-controls";
  actions.className = "debug-button-row workbench-actions";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  saveButton.type = "button";
  saveButton.textContent = "Save display JSON";
  reloadButton.type = "button";
  reloadButton.textContent = "Reload from disk";

  const first = ARCHETYPE_IDS[0]!;
  const state: PreviewState = {
    archetypeId: first,
    bodyState: "idle",
    cameraBack: DEFAULT_BACK,
    heading: 0,
    playing: true,
    progress: 0,
  };

  const appearance = (): EnemyAppearanceId => ENEMY_ARCHETYPES[state.archetypeId].appearance;

  const archetypeField = createSelect(
    "entity-archetype",
    "Body",
    ARCHETYPE_IDS.map((id) => ({ label: ENEMY_ARCHETYPES[id].name, value: id })),
  );
  const stateField = createSelect(
    "entity-state",
    "Doing",
    BODY_STATES.map((entry) => ({ label: entry.label, value: entry.id })),
  );

  const scrub = createRange(
    "entity-scrub",
    "Scrub",
    0,
    0,
    1,
    0.005,
    (value) => `${Math.round(value * 100)}%`,
    (value) => {
      state.playing = false;
      playButton.textContent = "Play";
      state.progress = value;
    },
  );

  const heading = createRange(
    "entity-heading",
    "Heading",
    0,
    0,
    HEADINGS - 1,
    1,
    (value) => `${value} of ${HEADINGS}`,
    (value) => {
      state.heading = value;
    },
  );

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

  const markUnsaved = (): void => {
    status.textContent = "Unsaved display changes.";
  };

  const bodyScale = createRange(
    "entity-body-scale",
    "Body scale",
    displays[appearance()].bodyScale,
    0.1,
    1.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      displays[appearance()] = { ...displays[appearance()], bodyScale: value };
      markUnsaved();
    },
  );

  const markerOffset = createRange(
    "entity-marker-offset",
    "Marker offset",
    displays[appearance()].markerOffset,
    -0.6,
    0.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      displays[appearance()] = { ...displays[appearance()], markerOffset: value };
      markUnsaved();
    },
  );

  const markerScale = createRange(
    "entity-marker-scale",
    "Marker scale",
    displays[appearance()].markerScale,
    0.1,
    1.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      displays[appearance()] = { ...displays[appearance()], markerScale: value };
      markUnsaved();
    },
  );

  const markerSwell = createRange(
    "entity-marker-swell",
    "Marker swell",
    displays[appearance()].markerSwell,
    0,
    1,
    0.005,
    (value) => `+${value.toFixed(3)}`,
    (value) => {
      displays[appearance()] = { ...displays[appearance()], markerSwell: value };
      markUnsaved();
    },
  );

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "Pause";
  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playButton.textContent = state.playing ? "Pause" : "Play";
  });

  /** Pulls the sliders back to whatever the working table holds for the body now on screen. */
  function refreshFields(): void {
    const archetype = ENEMY_ARCHETYPES[state.archetypeId];
    const current = displays[archetype.appearance];
    bodyScale.set(current.bodyScale);
    markerOffset.set(current.markerOffset);
    markerScale.set(current.markerScale);
    markerSwell.set(current.markerSwell);
    // A soft body's size comes from its own profile, so the scale slider has nothing to move on one.
    bodyScale.setInert(!isBoned(archetype));
    // An archetype that never winds up wears no mark, so its three mark controls have nothing to show.
    const marked = archetype.windupIntent !== undefined && state.bodyState === "windup";

    for (const control of [markerOffset, markerScale, markerSwell]) {
      control.setInert(!marked);
    }
  }

  archetypeField.select.addEventListener("change", () => {
    state.archetypeId = archetypeField.select.value as MapCastKind;
    rebuild();
    refreshFields();
  });

  stateField.select.addEventListener("change", () => {
    state.bodyState = stateField.select.value as BodyState;
    state.progress = 0;
    scrub.set(0);
    refreshFields();
  });

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    status.textContent = "Validating and saving display JSON…";
    void saveCanonical("entityDisplay", Object.values(displays))
      .then((message) => {
        status.textContent = message;
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveButton.disabled = false;
      });
  });

  // Asked for rather than done to you: the dev server does not watch these files, so that saving one
  // cannot reload the page out from under whoever is tuning it. This is how a hand edit is picked up,
  // or how numbers slid but never saved are thrown away.
  reloadButton.addEventListener("click", () => {
    reloadButton.disabled = true;
    status.textContent = "Reading display JSON from disk…";
    void loadCanonical("entityDisplay")
      .then((source) => {
        Object.assign(displays, entityDisplaysByAppearance(parseEntityDisplays(source)));
        refreshFields();
        status.textContent = "Reloaded display JSON from disk.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadButton.disabled = false;
      });
  });

  // The authored empty room, with the eye on its near edge looking up it. The body is stood along
  // that line, so the distance slider walks the body towards the eye rather than backing the eye
  // into masonry — which is what moving the camera instead did.
  const { world, eye } = createWorkbenchStage();

  function bodyPlace(): Readonly<{ x: number; y: number }> {
    return {
      x: eye.x + Math.cos(eye.angle) * state.cameraBack,
      y: eye.y + Math.sin(eye.angle) * state.cameraBack,
    };
  }

  function rebuild(): void {
    const at = bodyPlace();
    world.enemies.length = 0;
    world.enemies.push(createEnemy(world, at.x, at.y, ENEMY_ARCHETYPES[state.archetypeId]));
  }

  rebuild();

  /** How long the scrubbed state runs for, so a clip plays at the length the simulation gives it. */
  function stateSeconds(): number {
    const archetype = ENEMY_ARCHETYPES[state.archetypeId];

    if (state.bodyState === "windup") {
      return Math.max(0.001, attackWindup(archetype));
    }

    if (state.bodyState === "strike") {
      return STRIKE_SECONDS;
    }

    if (state.bodyState === "recovery") {
      return attackCooldown(archetype);
    }

    if (state.bodyState === "drowning") {
      return DROWN_SECONDS;
    }

    // The looping and the untimed states have no length of their own; a second is a scrub rate.
    return 1;
  }

  const preview = createRenderPanel({
    ariaLabel: "Entity workbench live preview",
    frame: (timing, renderer) => {
      renderer.setDisplayOverride(appearance(), displays[appearance()]);
      // No arm. What this panel is for is behind it, and the first-person layer covers a third of the
      // frame — the tab that judges the arm is the HUD workbench, and it keeps it.
      renderer.setViewmodel("none");

      if (state.playing) {
        state.progress = (state.progress + timing.frameSeconds / stateSeconds()) % 1;
        scrub.set(state.progress);
      }

      const body = world.enemies[0];

      if (body) {
        const at = bodyPlace();
        body.x = at.x;
        body.y = at.y;
        poseBody(body, state);
      }

      world.elapsedSeconds = timing.elapsedSeconds;
      world.player.x = eye.x;
      world.player.y = eye.y;
      world.player.angle = eye.angle;
      return { world };
    },
  });

  const transport = document.createElement("div");
  transport.className = "debug-button-row";
  transport.append(playButton);

  grid.append(
    archetypeField.field,
    stateField.field,
    scrub.field,
    heading.field,
    cameraBack.field,
    bodyScale.field,
    markerOffset.field,
    markerScale.field,
    markerSwell.field,
  );
  actions.append(saveButton, reloadButton);
  controls.body.append(grid, transport, actions, status);
  previewPanel.body.append(preview.element);
  root.append(controls.panel, previewPanel.panel);
  refreshFields();
  return root;
}
