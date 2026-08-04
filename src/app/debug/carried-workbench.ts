/**
 * Whatever the other hand is carrying, at the size and turn it is authored to be carried at.
 *
 * The third of a prop's three display contexts, and the last one to get a preview. Until now every
 * carried object was drawn into exactly the same square with exactly the same tilt, so a stake and a
 * bomb were the same size in the hand however different they are anywhere else — not a decision anyone
 * made, just the only thing one shared number could do.
 *
 * It lives on the HUD workbench rather than beside the floor pickups on purpose. What decides whether a
 * carried object reads is the frame around it: the arm on the right, the status cluster underneath, and
 * how much of the view the whole viewmodel is allowed to take. Those are all here, and none of them are
 * over there.
 */

import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel, createWorkbenchStage } from "@/app/debug/render-panel";
import propDisplayJson from "@/content/presentation/prop-display.json";
import { parsePropDisplays, propDisplaysByKind, type PropDisplay } from "@/content/presentation/prop-display-schema";
import { PROP_KINDS, type PropKind } from "@/core/prop-kinds";
import { PROP_LABELS } from "@/core/actions";

const displays: Record<PropKind, PropDisplay> = { ...propDisplaysByKind(parsePropDisplays(propDisplayJson)) };

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

export function createCarriedWorkbench(): HTMLElement {
  const root = document.createElement("div");
  const controls = createDebugPanel(
    "Carried object",
    "How a prop sits in the left hand. Its size on the floor is the prop workbench's tab; this is the same authored row seen from the other end.",
  );
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const status = document.createElement("p");
  const saveButton = document.createElement("button");
  const reloadButton = document.createElement("button");
  const kindSelect = document.createElement("select");
  const kindField = document.createElement("label");
  const kindLabel = document.createElement("span");
  grid.className = "debug-form-grid";
  actions.className = "debug-button-row workbench-actions";
  status.className = "entity-workbench-status";
  status.setAttribute("role", "status");
  saveButton.type = "button";
  saveButton.textContent = "Save carried JSON";
  reloadButton.type = "button";
  reloadButton.textContent = "Reload from disk";
  kindField.className = "debug-field";
  kindLabel.textContent = "Prop";
  kindSelect.id = "carried-kind";

  for (const kind of PROP_KINDS) {
    const option = document.createElement("option");
    option.value = kind;
    option.textContent = PROP_LABELS[kind];
    kindSelect.append(option);
  }

  kindField.append(kindLabel, kindSelect);

  const first = PROP_KINDS[0];
  let kind: PropKind = first;
  let count = 3;
  let elapsedSeconds = 0;

  const handScale = createRange(
    "carried-hand-scale",
    "Hand scale",
    displays[first].handScale,
    0.2,
    2.4,
    0.005,
    (value) => value.toFixed(3),
    (value) => {
      displays[kind] = { ...displays[kind], handScale: value };
      status.textContent = "Unsaved carried changes.";
    },
  );

  const handRotation = createRange(
    "carried-hand-rotation",
    "Hand rotation",
    displays[first].handRotation,
    -Math.PI,
    Math.PI,
    0.01,
    (value) => `${((value * 180) / Math.PI).toFixed(0)}°`,
    (value) => {
      displays[kind] = { ...displays[kind], handRotation: value };
      status.textContent = "Unsaved carried changes.";
    },
  );

  const stack = createRange(
    "carried-count",
    "Count shown",
    count,
    1,
    9,
    1,
    (value) => `×${value}`,
    (value) => {
      count = value;
    },
  );

  function refreshFields(): void {
    handScale.set(displays[kind].handScale);
    handRotation.set(displays[kind].handRotation);
  }

  kindSelect.addEventListener("change", () => {
    kind = kindSelect.value as PropKind;
    refreshFields();
  });

  // Asked for rather than done to you: the dev server does not watch these files, so that saving one
  // cannot reload the page out from under whoever is tuning it. This is how a hand edit is picked up, or
  // how numbers slid but never saved are thrown away.
  reloadButton.addEventListener("click", () => {
    reloadButton.disabled = true;
    status.textContent = "Reading carried JSON from disk…";
    void loadCanonical("propDisplay")
      .then((source) => {
        Object.assign(displays, propDisplaysByKind(parsePropDisplays(source)));
        refreshFields();
        status.textContent = "Reloaded carried JSON from disk.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadButton.disabled = false;
      });
  });

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    status.textContent = "Validating and saving carried JSON…";
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

  // A real floor, stood on and looked at from a fixed spot. The arm and whatever is in the other
  // hand are drawn by the renderer's own first-person layer, so posing the world is the whole of what
  // this panel does — there is no second copy of the viewmodel here any more.
  const { world } = createWorkbenchStage();

  const preview = createRenderPanel({
    ariaLabel: "Carried object preview",
    frame: (timing) => {
      elapsedSeconds += timing.frameSeconds;
      world.elapsedSeconds = elapsedSeconds;
      world.held = { kind: "prop", prop: kind, count };
      // Idle and dry on purpose: a throw no longer animates the carried object out of the corner of
      // the screen, and nothing here is standing in the spring, so neither the swing nor the soak
      // edge has anything to show.
      world.swing = 0;
      world.soakSeconds = 0;
      world.damageMarks.length = 0;
      world.walkBob = 0;
      return { world };
    },
  });

  grid.append(kindField, stack.field, handScale.field, handRotation.field);
  actions.append(saveButton, reloadButton);
  controls.body.append(grid, actions, status);
  root.append(controls.panel, preview.element);
  return root;
}
