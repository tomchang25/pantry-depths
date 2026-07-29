import { AUTHORING_API_ROOT } from "@/app/debug/authoring-client";
import { createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel } from "@/app/debug/render-panel";
import decorPresetsJson from "@/content/presentation/decor-presets.json";
import {
  DECOR_ASSET_IDS,
  parseDecorPresets,
  type DecorAssetId,
  type DecorPlacement,
  type DecorPreset,
} from "@/content/presentation/decor-preset-schema";
import type { Facing } from "@/core/grid";
import type { CameraPose, RenderScene, RenderSprite, RenderSurface } from "@/presentation/render-scene";

const ROOM_SIZE = 9;
const WALL_CELL = { x: 4, y: 4 } as const;
const FACES: readonly Facing[] = ["north", "east", "south", "west"];
const ASSET_LABELS: Readonly<Record<DecorAssetId, string>> = {
  "presentation.wallTorch": "Wall torch",
  "presentation.wallSpikes": "Wall spikes",
  "presentation.bones": "Bones",
  "presentation.hotSpring": "Hot spring",
};

function roomSurfaces(): RenderSurface[] {
  const surfaces: RenderSurface[] = [{ cell: WALL_CELL, material: "demoAshlar", height: 2.4 }];

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
const ROOM_TILES = Array.from({ length: ROOM_SIZE }, (_row, y) =>
  Array.from({ length: ROOM_SIZE }, (_column, x) =>
    x === 0 || y === 0 || x === ROOM_SIZE - 1 || y === ROOM_SIZE - 1 || (x === WALL_CELL.x && y === WALL_CELL.y)
      ? "#"
      : ".",
  ).join(""),
);

function faceVector(face: Facing): Readonly<{ x: number; y: number }> {
  if (face === "north") return { x: 0, y: -1 };
  if (face === "south") return { x: 0, y: 1 };
  if (face === "east") return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function cameraFor(preset: DecorPreset, face: Facing): CameraPose {
  if (preset.placement === "ground") {
    return { x: 4.5, y: 7.1, angle: -Math.PI / 2, pitch: -0.08 };
  }

  const normal = faceVector(face);
  return {
    x: WALL_CELL.x + 0.5 + normal.x * 2.8,
    y: WALL_CELL.y + 0.5 + normal.y * 2.8,
    angle: Math.atan2(-normal.y, -normal.x),
  };
}

function spriteFor(preset: DecorPreset, face: Facing): RenderSprite {
  if (preset.placement === "ground") {
    return {
      id: "decor-preview",
      x: 4.5 + preset.offsetX,
      y: 5.5 + preset.offsetY,
      placement: "ground",
      assetId: preset.assetId,
      scale: preset.scale,
      verticalAnchor: preset.verticalAnchor,
    };
  }

  const normal = faceVector(face);
  const tangent = { x: -normal.y, y: normal.x };
  return {
    id: "decor-preview",
    x: WALL_CELL.x + 0.5 + normal.x * (0.51 + preset.offsetY) + tangent.x * preset.offsetX,
    y: WALL_CELL.y + 0.5 + normal.y * (0.51 + preset.offsetY) + tangent.y * preset.offsetX,
    placement: "wall",
    assetId: preset.assetId,
    scale: preset.scale,
    verticalAnchor: preset.verticalAnchor,
    wallFace: face,
  };
}

function sceneFor(preset: DecorPreset, face: Facing): RenderScene {
  return {
    floorId: "decor-workbench",
    theme: "demo",
    width: ROOM_SIZE,
    height: ROOM_SIZE,
    tiles: ROOM_TILES,
    camera: cameraFor(preset, face),
    surfaces: ROOM_SURFACES,
    sprites: [spriteFor(preset, face)],
    lights: [{ id: "decor-light", x: 4.5, y: 5.5, radius: 5, color: [255, 174, 99], intensity: 0.82 }],
    emitters: [],
    ambient: [0.18, 0.15, 0.24],
    wallHeight: 2.4,
    eyeHeight: 0.5,
  };
}

function field(label: string, input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "debug-field";
  wrapper.append(label, input);
  return wrapper;
}

function numberInput(value: number, step: number): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.step = String(step);
  return input;
}

/** Builds the Decor tab while leaving the Entity Workbench route and page shell as its owner. */
export function createDecorWorkbench(): HTMLElement {
  const root = document.createElement("div");
  const controls = createDebugPanel(
    "Decor presets",
    "Preset values describe one named sprite variant. Tile origin and wall face remain placement context for the future Map contract.",
  );
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const presetSelect = document.createElement("select");
  const idInput = document.createElement("input");
  const labelInput = document.createElement("input");
  const assetSelect = document.createElement("select");
  const placementSelect = document.createElement("select");
  const faceSelect = document.createElement("select");
  const scaleInput = numberInput(1, 0.01);
  const offsetXInput = numberInput(0, 0.01);
  const offsetYInput = numberInput(0, 0.01);
  const verticalAnchorInput = numberInput(0, 0.01);
  const duplicateButton = document.createElement("button");
  const saveButton = document.createElement("button");
  const status = document.createElement("p");
  let presets = [...parseDecorPresets(decorPresetsJson)];
  let selectedIndex = 0;
  let wallFace: Facing = "south";
  let duplicateCounter = 1;

  root.className = "decor-workbench";
  grid.className = "debug-form-grid decor-workbench-controls";
  actions.className = "debug-button-row";
  idInput.type = "text";
  labelInput.type = "text";
  duplicateButton.type = "button";
  duplicateButton.textContent = "Duplicate as named variant";
  saveButton.type = "button";
  saveButton.textContent = "Save decor presets JSON";
  status.className = "decor-workbench-status";
  status.setAttribute("role", "status");

  for (const assetId of DECOR_ASSET_IDS) {
    const option = document.createElement("option");
    option.value = assetId;
    option.textContent = ASSET_LABELS[assetId];
    assetSelect.append(option);
  }

  for (const placement of ["ground", "wall"] as const) {
    const option = document.createElement("option");
    option.value = placement;
    option.textContent = placement === "ground" ? "Tile / ground" : "Wall face";
    placementSelect.append(option);
  }

  for (const face of FACES) {
    const option = document.createElement("option");
    option.value = face;
    option.textContent = face;
    faceSelect.append(option);
  }
  faceSelect.value = wallFace;

  const currentPreset = (): DecorPreset => {
    const preset = presets[selectedIndex];

    if (!preset) {
      throw new Error("Decor Workbench requires at least one preset.");
    }

    return preset;
  };

  const refreshPresetOptions = (): void => {
    presetSelect.replaceChildren();

    for (const [index, preset] of presets.entries()) {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${preset.label} · ${preset.id}`;
      presetSelect.append(option);
    }

    presetSelect.value = String(selectedIndex);
  };

  const refreshInputs = (): void => {
    const preset = currentPreset();
    idInput.value = preset.id;
    labelInput.value = preset.label;
    assetSelect.value = preset.assetId;
    placementSelect.value = preset.placement;
    scaleInput.value = String(preset.scale);
    offsetXInput.value = String(preset.offsetX);
    offsetYInput.value = String(preset.offsetY);
    verticalAnchorInput.value = String(preset.verticalAnchor);
    faceSelect.disabled = preset.placement !== "wall";
  };

  const replaceCurrent = (patch: Partial<DecorPreset>): void => {
    presets = presets.map((preset, index) => (index === selectedIndex ? { ...preset, ...patch } : preset));
    status.textContent = `Draft changed: ${currentPreset().label}. Save explicitly to update canonical JSON.`;
  };

  presetSelect.addEventListener("change", () => {
    selectedIndex = Number(presetSelect.value);
    refreshInputs();
    status.textContent = `Previewing ${currentPreset().label}.`;
  });
  idInput.addEventListener("input", () => {
    replaceCurrent({ id: idInput.value });
    refreshPresetOptions();
  });
  labelInput.addEventListener("input", () => {
    replaceCurrent({ label: labelInput.value });
    refreshPresetOptions();
  });
  assetSelect.addEventListener("change", () => replaceCurrent({ assetId: assetSelect.value as DecorAssetId }));
  placementSelect.addEventListener("change", () => {
    replaceCurrent({ placement: placementSelect.value as DecorPlacement });
    faceSelect.disabled = currentPreset().placement !== "wall";
  });
  faceSelect.addEventListener("change", () => {
    wallFace = faceSelect.value as Facing;
    status.textContent = `Placement context changed to the ${wallFace} face; the preset itself is unchanged.`;
  });

  for (const [input, key] of [
    [scaleInput, "scale"],
    [offsetXInput, "offsetX"],
    [offsetYInput, "offsetY"],
    [verticalAnchorInput, "verticalAnchor"],
  ] as const) {
    input.addEventListener("input", () => replaceCurrent({ [key]: Number(input.value) }));
  }

  duplicateButton.addEventListener("click", () => {
    const source = currentPreset();
    const variant = {
      ...source,
      id: `${source.id}-variant-${duplicateCounter}`,
      label: `${source.label} variant ${duplicateCounter}`,
    };
    duplicateCounter += 1;
    presets = [...presets, variant];
    selectedIndex = presets.length - 1;
    refreshPresetOptions();
    refreshInputs();
    status.textContent = `Created independent named variant ${variant.id}.`;
  });

  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    status.textContent = "Validating and saving decor presets…";

    void fetch(`${AUTHORING_API_ROOT}/decor/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: parseDecorPresets(presets) }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? `Save failed with ${response.status}.`);
        }

        status.textContent = body.message ?? "Saved decor presets JSON.";
      })
      .catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveButton.disabled = false;
      });
  });

  grid.append(
    field("Preset", presetSelect),
    field("Variant ID", idInput),
    field("Label", labelInput),
    field("Asset", assetSelect),
    field("Placement", placementSelect),
    field("Preview wall face", faceSelect),
    field("Scale", scaleInput),
    field("Local offset X", offsetXInput),
    field("Local offset Y", offsetYInput),
    field("Vertical anchor", verticalAnchorInput),
  );
  actions.append(duplicateButton, saveButton);
  controls.body.append(grid, actions, status);

  const preview = createRenderPanel({
    ariaLabel: "Decor preset renderer preview",
    frame: () => ({
      scene: sceneFor(currentPreset(), wallFace),
      preferences: { viewmodel: false, grade: true },
    }),
  });
  root.append(controls.panel, preview.element);
  refreshPresetOptions();
  refreshInputs();
  status.textContent = `Previewing ${currentPreset().label}.`;
  return root;
}
