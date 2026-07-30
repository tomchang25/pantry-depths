/**
 * Pickups on the floor, at whatever size and height they are authored to lie at.
 *
 * Its own tab because a prop is not one picture. It has three display contexts — where it lies, how it
 * looks in flight, and how it looks in the hand — and each wants a different preview. This one owns the
 * first and says so, rather than showing a pickup and quietly implying the other two were checked.
 *
 * Both controls beside the numbers exist because of what the drawing actually does: the camera distance
 * because a pickup is judged from walking past it and from standing over it, and the stack size because
 * a count above one draws several copies fanned out and lifted, so a single object never shows what a
 * pile looks like.
 */

import { AUTHORING_API_ROOT } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel } from "@/app/debug/render-panel";
import propDisplayJson from "@/content/presentation/prop-display.json";
import {
  parsePropDisplays,
  PROP_KINDS,
  propDisplaysByKind,
  type PropDisplay,
  type PropKind,
} from "@/content/presentation/prop-display-schema";
import { PROP_LABELS } from "@/demo/actions";
import { PROP_ASSETS } from "@/demo/demo-scene";
import { DEMO_ASSET_IDS } from "@/demo/demo-sprites";
import type {
  CameraPose,
  RenderFloorPatch,
  RenderScene,
  RenderSprite,
  RenderSurface,
} from "@/presentation/render-scene";

const ROOM_SIZE = 9;
const ROOM_CENTRE = 4.5;
const PROP_Y = 4.25;
/** Matched to the entity workbench, so a pickup and a body are compared on the same floor. */
const DEFAULT_BACK = 2.6;

/**
 * The authored table, as a working copy this tab edits.
 *
 * Mutable on purpose and mutable only here: what is on screen is always what would be written, and the
 * save sends the whole table through the same validator the file is loaded with.
 */
const displays: Record<PropKind, PropDisplay> = { ...propDisplaysByKind(parsePropDisplays(propDisplayJson)) };

type PropWorkbenchState = {
  kind: PropKind;
  count: number;
  cameraBack: number;
  floorScale: number;
  floorAnchor: number;
};

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

function roomFloor(): RenderFloorPatch[] {
  const built: RenderFloorPatch[] = [];

  for (let y = 0; y < ROOM_SIZE; y += 1) {
    for (let x = 0; x < ROOM_SIZE; x += 1) {
      built.push({ cell: { x, y }, material: "demoFlagstone" });
    }
  }

  return built;
}

const ROOM_SURFACES = roomSurfaces();
const ROOM_FLOOR = roomFloor();
const ROOM_TILES = Array.from({ length: ROOM_SIZE }, (_rowValue, y) =>
  Array.from({ length: ROOM_SIZE }, (_columnValue, x) =>
    x === 0 || y === 0 || x === ROOM_SIZE - 1 || y === ROOM_SIZE - 1 ? "#" : ".",
  ).join(""),
);

/**
 * The pickup exactly as the demo lays one down.
 *
 * Deliberately a copy of the demo's own arithmetic rather than a call into it, and the reason is the
 * seam: the demo builds pickups inside one loop over the whole world's props, so there is nothing to
 * call with one prop and a size that is not saved yet. The two must be read side by side when either
 * moves — the shadow, the glow, the fan and the per-copy lift are all in `demo-scene`'s prop loop.
 */
function pickupSprites(state: PropWorkbenchState): RenderSprite[] {
  const built: RenderSprite[] = [];
  const copies = Math.min(state.count, 3);
  built.push({
    id: "pickup-shadow",
    x: ROOM_CENTRE,
    y: PROP_Y,
    placement: "ground",
    assetId: DEMO_ASSET_IDS.dropShadow,
    scale: 0.5 + state.count * 0.06,
    verticalAnchor: 0,
  });
  built.push({
    id: "pickup-glow",
    x: ROOM_CENTRE,
    y: PROP_Y,
    placement: "ground",
    assetId: DEMO_ASSET_IDS.groundGlow,
    scale: 0.75 + state.count * 0.1,
    verticalAnchor: 0,
  });

  for (let copy = 0; copy < copies; copy += 1) {
    const spread = (copy - (copies - 1) / 2) * 0.14;
    built.push({
      id: `pickup-${copy}`,
      x: ROOM_CENTRE + spread,
      y: PROP_Y + spread * 0.5,
      placement: "billboard",
      assetId: PROP_ASSETS[state.kind],
      scale: state.floorScale,
      verticalAnchor: -state.floorAnchor - copy * 0.05,
    });
  }

  return built;
}

function previewScene(state: PropWorkbenchState): RenderScene {
  const camera: CameraPose = { x: ROOM_CENTRE, y: PROP_Y + state.cameraBack, angle: -Math.PI / 2 };
  return {
    floorId: "prop-workbench",
    theme: "demo",
    width: ROOM_SIZE,
    height: ROOM_SIZE,
    tiles: ROOM_TILES,
    camera,
    ambient: [0.24, 0.2, 0.3],
    wallHeight: 1.4,
    eyeHeight: 0.5,
    surfaces: ROOM_SURFACES,
    floorPatches: ROOM_FLOOR,
    blobs: [],
    sprites: pickupSprites(state),
    lights: [
      { id: "inspection-light", x: ROOM_CENTRE, y: PROP_Y + 1, radius: 5, color: [255, 178, 112], intensity: 1 },
    ],
    emitters: [],
  };
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
): Readonly<{ field: HTMLLabelElement; set: (next: number) => void }> {
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
  };
}

export function createPropWorkbench(): HTMLElement {
  const root = document.createElement("div");
  const controls = createDebugPanel(
    "Floor pickups",
    "How a loose object is drawn where it lies. Flight and in-hand are separate contexts with their own numbers; this tab does not speak for them.",
  );
  const previewPanel = createDebugPanel("Preview", "The same shadow, glow, fan and per-copy lift the demo lays down.");
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const saveButton = document.createElement("button");
  const kindSelect = document.createElement("select");
  const kindField = document.createElement("label");
  const kindLabel = document.createElement("span");
  grid.className = "debug-form-grid entity-workbench-controls";
  actions.className = "debug-button-row";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  saveButton.type = "button";
  saveButton.textContent = "Save pickup JSON";
  kindField.className = "debug-field";
  kindLabel.textContent = "Prop";
  kindSelect.id = "prop-kind";

  for (const kind of PROP_KINDS) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = PROP_LABELS[kind];
    kindSelect.append(option);
  }

  kindField.append(kindLabel, kindSelect);

  const first = PROP_KINDS[0];
  const state: PropWorkbenchState = {
    kind: first,
    count: 1,
    cameraBack: DEFAULT_BACK,
    floorScale: displays[first].floorScale,
    floorAnchor: displays[first].floorAnchor,
  };

  const floorScale = createRange(
    "prop-floor-scale",
    "Floor scale",
    state.floorScale,
    0.1,
    1.6,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      state.floorScale = value;
      displays[state.kind] = { ...displays[state.kind], floorScale: value };
      status.textContent = "Unsaved pickup changes.";
    },
  );

  const floorAnchor = createRange(
    "prop-floor-anchor",
    "Floor anchor",
    state.floorAnchor,
    -0.4,
    0.8,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      state.floorAnchor = value;
      displays[state.kind] = { ...displays[state.kind], floorAnchor: value };
      status.textContent = "Unsaved pickup changes.";
    },
  );

  const stack = createRange(
    "prop-stack",
    "Stack size",
    state.count,
    1,
    3,
    1,
    (value) => (value === 1 ? "one" : `${value} copies`),
    (value) => {
      state.count = value;
    },
  );

  const cameraBack = createRange(
    "prop-camera-back",
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

  kindSelect.addEventListener("change", () => {
    state.kind = kindSelect.value as PropKind;
    const current = displays[state.kind];
    state.floorScale = current.floorScale;
    state.floorAnchor = current.floorAnchor;
    floorScale.set(state.floorScale);
    floorAnchor.set(state.floorAnchor);
  });

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    status.textContent = "Validating and saving pickup JSON…";
    void fetch(`${AUTHORING_API_ROOT}/propDisplay/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: Object.values(displays) }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? `Save failed with ${response.status}.`);
        }

        status.textContent = body.message ?? "Saved pickup JSON.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveButton.disabled = false;
      });
  });

  const preview = createRenderPanel({
    ariaLabel: "Prop workbench live preview",
    frame: () => ({ scene: previewScene(state), preferences: { grade: true } }),
  });

  grid.append(kindField, cameraBack.field, stack.field, floorScale.field, floorAnchor.field);
  actions.append(saveButton);
  controls.body.append(grid, actions, status);
  previewPanel.body.append(preview.element);
  root.append(controls.panel, previewPanel.panel);
  return root;
}
