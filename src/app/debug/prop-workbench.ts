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

import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel, createWorkbenchStage } from "@/app/debug/render-panel";
import { dropProp } from "@/core/world";
import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind, type PropDisplay } from "@/content/presentation/prop-display-schema";
import { PROP_KINDS, type PropKind } from "@/core/prop-kinds";
import { PROP_LABELS } from "@/core/actions";

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
  const previewPanel = createDebugPanel(
    "Preview",
    "The pickup as the rules lay it down, drawn by the renderer the game draws through.",
  );
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const saveButton = document.createElement("button");
  const reloadButton = document.createElement("button");
  const kindSelect = document.createElement("select");
  const kindField = document.createElement("label");
  const kindLabel = document.createElement("span");
  grid.className = "debug-form-grid entity-workbench-controls";
  actions.className = "debug-button-row workbench-actions";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  saveButton.type = "button";
  saveButton.textContent = "Save pickup JSON";
  reloadButton.type = "button";
  reloadButton.textContent = "Reload from disk";
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
    refreshFields();
  });

  /** Pulls the sliders back to whatever the working table holds for the prop now on screen. */
  function refreshFields(): void {
    const current = displays[state.kind];
    state.floorScale = current.floorScale;
    state.floorAnchor = current.floorAnchor;
    floorScale.set(state.floorScale);
    floorAnchor.set(state.floorAnchor);
  }

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    status.textContent = "Validating and saving pickup JSON…";
    void saveCanonical("propDisplay", Object.values(displays))
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

  // Reading the file back is asked for rather than done to you. The dev server no longer watches these
  // files, precisely so that saving one cannot reload the page out from under whoever is tuning it — so
  // this is the way to see an edit made by hand, or to throw away numbers slid but never saved.
  reloadButton.addEventListener("click", () => {
    reloadButton.disabled = true;
    status.textContent = "Reading pickup JSON from disk…";
    void loadCanonical("propDisplay")
      .then((source) => {
        Object.assign(displays, propDisplaysByKind(parsePropDisplays(source)));
        refreshFields();
        status.textContent = "Reloaded pickup JSON from disk.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadButton.disabled = false;
      });
  });

  // One pickup lying on the authored empty room, looked at from the distance the controls choose.
  // Dropped through the rules rather than placed as a picture, so what is judged is the thing the
  // game makes. The pickup moves along the eye's own line rather than the eye moving, which is what
  // keeps the distance slider from backing the camera into masonry.
  const { world, eye } = createWorkbenchStage();

  const preview = createRenderPanel({
    ariaLabel: "Prop workbench live preview",
    frame: (_timing, renderer) => {
      // No arm: a pickup lying on the ground is a small thing at the bottom of the frame, which is
      // exactly where the first-person layer is.
      renderer.setViewmodel("none");
      world.props.length = 0;
      dropProp(
        world,
        state.kind,
        eye.x + Math.cos(eye.angle) * state.cameraBack,
        eye.y + Math.sin(eye.angle) * state.cameraBack,
        state.count,
      );
      world.player.x = eye.x;
      world.player.y = eye.y;
      world.player.angle = eye.angle;
      return { world };
    },
  });

  grid.append(kindField, cameraBack.field, stack.field, floorScale.field, floorAnchor.field);
  actions.append(saveButton, reloadButton);
  controls.body.append(grid, actions, status);
  previewPanel.body.append(preview.element);
  root.append(controls.panel, previewPanel.panel);
  return root;
}
