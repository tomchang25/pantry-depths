import { createDebugPage } from "@/app/debug/debug-shell";
import { BLOCK_WEAPONS, WEAPON_CLIPS, type BlockClip, type BlockWeapon } from "@/presentation/scene-3d/block-clips";
import { BlockRuntime } from "./block-runtime";
import "./entity-workbench.css";

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
  row.className = "entity-workbench__field";
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
  label.className = "entity-workbench__toggle";
  input.type = "checkbox";
  input.checked = checked;
  text.textContent = labelText;
  label.append(input, text);
  return { input, label };
}

/**
 * One body on a turntable, taken apart.
 *
 * This page asks what a body **is**: how a clip reads frame by frame, what is in its hand, what
 * happens when it comes apart. It deliberately does not ask how it looks in play — an orbit camera a
 * metre away flatters everything, and every misjudgment this project has made about a body was made
 * at exactly that distance. The Placement Workbench owns that question and stands the same body on
 * an authored floor at the range the game draws it from.
 */
export function renderEntityWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Entity Workbench",
    description:
      "One body on a turntable: every weapon, every clip, scrubbed frame by frame, and the two ways it comes apart. How it reads at playing distance is the Placement Workbench's question.",
    width: "wide",
  });

  page.classList.add("entity-workbench");
  mountRigViewer(content);
  mount.replaceChildren(page);
}

function mountRigViewer(content: HTMLElement): void {
  const abortController = new AbortController();

  const layout = document.createElement("div");
  const stage = document.createElement("section");
  const viewport = document.createElement("div");
  const sidebar = document.createElement("aside");
  const controls = document.createElement("section");
  const controlsTitle = document.createElement("h2");
  const transport = document.createElement("div");
  const playButton = document.createElement("button");
  const resetButton = document.createElement("button");
  const breakRow = document.createElement("div");
  const burstButton = document.createElement("button");
  const bisectButton = document.createElement("button");
  const scrubRow = document.createElement("label");
  const scrubLabel = document.createElement("span");
  const scrub = document.createElement("input");
  const statusPanel = document.createElement("section");
  const statusTitle = document.createElement("h2");
  const metrics = document.createElement("dl");

  layout.className = "entity-workbench__layout";
  stage.className = "entity-workbench__stage";
  viewport.className = "entity-workbench__viewport";
  viewport.setAttribute("aria-label", "Block skeleton viewport");
  sidebar.className = "entity-workbench__sidebar";
  controls.className = "entity-workbench__panel";
  controlsTitle.textContent = "Controls";
  transport.className = "entity-workbench__transport";
  playButton.type = "button";
  playButton.textContent = "Pause";
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  breakRow.className = "entity-workbench__transport";
  burstButton.type = "button";
  burstButton.textContent = "Burst";
  bisectButton.type = "button";
  bisectButton.textContent = "Bisect";
  scrubRow.className = "entity-workbench__field";
  scrubLabel.textContent = "Scrub";
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = "1000";
  scrub.value = "0";
  scrubRow.append(scrubLabel, scrub);
  statusPanel.className = "entity-workbench__panel";
  statusTitle.textContent = "Live diagnostics";
  metrics.className = "entity-workbench__metrics";

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
  breakRow.append(burstButton, bisectButton);
  controls.append(
    controlsTitle,
    weaponField.row,
    clipField.row,
    transport,
    scrubRow,
    speedField.row,
    arc.label,
    breakRow,
  );
  statusPanel.append(statusTitle, metrics);
  sidebar.append(controls, statusPanel);
  stage.append(viewport);
  layout.append(stage, sidebar);
  content.append(layout);

  let runtime: BlockRuntime;
  try {
    runtime = new BlockRuntime(viewport, {
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
    fallback.className = "entity-workbench__fallback";
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
  // Pressing either one twice does nothing — a body already in pieces cannot come apart again, and
  // Reset is what puts it back together, which is also what the button already meant.
  burstButton.addEventListener("click", () => runtime.breakApart("burst"), { signal: abortController.signal });
  bisectButton.addEventListener("click", () => runtime.breakApart("bisect"), { signal: abortController.signal });
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
