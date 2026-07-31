import { createDebugPage } from "@/app/debug/debug-shell";

import {
  BLOCK_CELL_SIZES,
  BLOCK_WEAPONS,
  type BlockCellSize,
  type BlockClip,
  type BlockWeapon,
  WEAPON_CLIPS,
} from "./block-contracts";
import { BlockRuntime } from "./block-runtime";
import "./three-block.css";

const WEAPON_LABELS: Readonly<Record<BlockWeapon, string>> = {
  sword: "Sword",
  hammer: "Hammer",
  javelin: "Javelin",
  crossbow: "Crossbow",
};

const CLIP_LABELS: Readonly<Record<BlockClip, string>> = {
  idle: "Idle",
  walk: "Walk",
  windup: "Wind-up",
  strike: "Strike",
  recovery: "Recovery",
  crossbowAim: "Aim",
  crossbowReload: "Reload",
};

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function createSelectRow(
  labelText: string,
  options: readonly Readonly<{ label: string; value: string }>[],
): Readonly<{ row: HTMLLabelElement; select: HTMLSelectElement }> {
  const row = document.createElement("label");
  const label = document.createElement("span");
  const select = document.createElement("select");
  row.className = "three-block__field";
  label.textContent = labelText;

  for (const option of options) {
    select.append(createOption(option.value, option.label));
  }

  row.append(label, select);
  return { row, select };
}

function createToggle(
  labelText: string,
  checked: boolean,
): Readonly<{ input: HTMLInputElement; label: HTMLLabelElement }> {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const text = document.createElement("span");
  label.className = "three-block__toggle";
  input.type = "checkbox";
  input.checked = checked;
  text.textContent = labelText;
  label.append(input, text);
  return { input, label };
}

export function renderThreeBlock(mount: HTMLElement): void {
  const abortController = new AbortController();
  const { page, content } = createDebugPage({
    title: "Block Skeleton",
    description:
      "A blocky enemy whose clips are numeric tables in the Blender build script. The strip below draws all eight headings at the size the game composites them, which is where this experiment is judged — the large view is for finding out why, not whether.",
    width: "wide",
  });
  page.classList.add("three-block");

  const layout = document.createElement("div");
  const stage = document.createElement("section");
  const viewport = document.createElement("div");
  const stripPanel = document.createElement("section");
  const stripTitle = document.createElement("h2");
  const stripNote = document.createElement("p");
  const stripCanvas = document.createElement("canvas");
  const headings = document.createElement("div");
  const sidebar = document.createElement("aside");
  const controls = document.createElement("section");
  const controlsTitle = document.createElement("h2");
  const transport = document.createElement("div");
  const playButton = document.createElement("button");
  const resetButton = document.createElement("button");
  const scrubRow = document.createElement("label");
  const scrubLabel = document.createElement("span");
  const scrub = document.createElement("input");
  const statusPanel = document.createElement("section");
  const statusTitle = document.createElement("h2");
  const metrics = document.createElement("dl");

  layout.className = "three-block__layout";
  stage.className = "three-block__stage";
  viewport.className = "three-block__viewport";
  viewport.setAttribute("aria-label", "Block skeleton viewport");
  stripPanel.className = "three-block__strip-panel";
  stripTitle.textContent = "Eight headings at game size";
  stripNote.textContent = "Drawn with the sprite bake's own camera and heading order.";
  stripCanvas.className = "three-block__strip";
  headings.className = "three-block__headings";

  for (let direction = 0; direction < 8; direction += 1) {
    const cell = document.createElement("span");
    cell.textContent = String(direction);
    headings.append(cell);
  }

  sidebar.className = "three-block__sidebar";
  controls.className = "three-block__panel";
  controlsTitle.textContent = "Controls";
  transport.className = "three-block__transport";
  playButton.type = "button";
  playButton.textContent = "Pause";
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  scrubRow.className = "three-block__field";
  scrubLabel.textContent = "Scrub";
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = "1000";
  scrub.value = "0";
  scrubRow.append(scrubLabel, scrub);
  statusPanel.className = "three-block__panel";
  statusTitle.textContent = "Live diagnostics";
  metrics.className = "three-block__metrics";

  const weaponField = createSelectRow(
    "Weapon",
    BLOCK_WEAPONS.map((weapon) => ({ label: WEAPON_LABELS[weapon], value: weapon })),
  );
  const clipField = createSelectRow("Clip", []);
  const speedField = createSelectRow("Speed", [
    { label: "0.25×", value: "0.25" },
    { label: "0.5×", value: "0.5" },
    { label: "1×", value: "1" },
  ]);
  speedField.select.value = "1";
  const cellField = createSelectRow(
    "Cell size",
    BLOCK_CELL_SIZES.map((size) => ({ label: `${size} px`, value: String(size) })),
  );
  cellField.select.value = "48";
  const pixelated = createToggle("Pixelated strip", true);
  const arc = createToggle("Swing arc", true);

  const metricOutputs = new Map<string, HTMLOutputElement>();
  for (const [label, key] of [
    ["Phase", "phase"],
    ["Time", "detail"],
    ["FPS", "fps"],
    ["Draw calls", "draw-calls"],
    ["Triangles", "triangles"],
  ] as const) {
    const term = document.createElement("dt");
    const value = document.createElement("dd");
    const output = document.createElement("output");
    term.textContent = label;
    output.textContent = "—";
    value.append(output);
    metrics.append(term, value);
    metricOutputs.set(key, output);
  }

  transport.append(playButton, resetButton);
  controls.append(
    controlsTitle,
    weaponField.row,
    clipField.row,
    transport,
    scrubRow,
    speedField.row,
    cellField.row,
    pixelated.label,
    arc.label,
  );
  statusPanel.append(statusTitle, metrics);
  stripPanel.append(stripTitle, stripNote, stripCanvas, headings);
  sidebar.append(controls, statusPanel);
  stage.append(viewport, stripPanel);
  layout.append(stage, sidebar);
  content.append(layout);
  mount.replaceChildren(page);

  let runtime: BlockRuntime;
  try {
    runtime = new BlockRuntime(viewport, stripCanvas, {
      onMetrics(next) {
        metricOutputs.get("fps")!.textContent = String(next.fps);
        metricOutputs.get("draw-calls")!.textContent = String(next.drawCalls);
        metricOutputs.get("triangles")!.textContent = next.triangles.toLocaleString();
      },
      onReady() {
        refreshClips();
      },
      onStatus(status) {
        metricOutputs.get("phase")!.textContent = status.phase;
        metricOutputs.get("detail")!.textContent = status.detail;
        scrub.value = String(Math.round(status.normalizedTime * 1000));
      },
    });
  } catch (error) {
    const fallback = document.createElement("div");
    const title = document.createElement("strong");
    const copy = document.createElement("p");
    fallback.className = "three-block__fallback";
    title.textContent = "WebGL preview unavailable";
    copy.textContent =
      error instanceof Error ? error.message : "The browser could not initialize a WebGL renderer on this device.";
    fallback.append(title, copy);
    viewport.replaceChildren(fallback);
    controls.querySelectorAll("button, input, select").forEach((element) => {
      if (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      ) {
        element.disabled = true;
      }
    });
    return;
  }

  /** The clip list is per weapon, because the crossbow does not share the melee set. */
  function refreshClips(): void {
    const available = WEAPON_CLIPS[weaponField.select.value as BlockWeapon];
    clipField.select.replaceChildren();

    for (const clip of available) {
      clipField.select.append(createOption(clip, CLIP_LABELS[clip]));
    }

    clipField.select.value = available[0]!;
    runtime.setClip(available[0]!);
  }

  weaponField.select.addEventListener(
    "change",
    () => {
      runtime.setWeapon(weaponField.select.value as BlockWeapon);
      refreshClips();
    },
    { signal: abortController.signal },
  );
  clipField.select.addEventListener("change", () => runtime.setClip(clipField.select.value as BlockClip), {
    signal: abortController.signal,
  });
  playButton.addEventListener(
    "click",
    () => {
      const playing = playButton.textContent === "Play";
      runtime.setPlaying(playing);
      playButton.textContent = playing ? "Pause" : "Play";
    },
    { signal: abortController.signal },
  );
  resetButton.addEventListener("click", () => runtime.reset(), { signal: abortController.signal });
  scrub.addEventListener(
    "input",
    () => {
      runtime.setPlaying(false);
      playButton.textContent = "Play";
      runtime.scrub(Number(scrub.value) / 1000);
    },
    { signal: abortController.signal },
  );
  speedField.select.addEventListener("change", () => runtime.setSpeed(Number(speedField.select.value)), {
    signal: abortController.signal,
  });
  cellField.select.addEventListener(
    "change",
    () => runtime.setCellSize(Number(cellField.select.value) as BlockCellSize),
    { signal: abortController.signal },
  );
  pixelated.input.addEventListener("change", () => runtime.setPixelated(pixelated.input.checked), {
    signal: abortController.signal,
  });
  arc.input.addEventListener("change", () => runtime.setArcEnabled(arc.input.checked), {
    signal: abortController.signal,
  });
  window.addEventListener(
    "pagehide",
    () => {
      abortController.abort();
      runtime.dispose();
    },
    { once: true },
  );
}
