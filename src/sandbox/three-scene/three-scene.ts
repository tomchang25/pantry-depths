import { MAPS } from "@/content/maps/map-library";
import type { ResolvedMap } from "@/core/map-contract";

import { SceneRuntime } from "./scene-runtime";
import "./three-scene.css";

/**
 * What a run opens on when nothing else is named. Held as a literal because the runtime module that
 * owns this question belongs to a layer a sandbox experiment may not import.
 */
const DEFAULT_MAP_NAME = "pantry-depths";

function defaultMap(): ResolvedMap {
  return MAPS.find((map) => map.name === DEFAULT_MAP_NAME) ?? MAPS[0]!;
}

function createSelectRow(
  labelText: string,
  options: readonly Readonly<{ label: string; value: string }>[],
): Readonly<{ row: HTMLLabelElement; select: HTMLSelectElement }> {
  const row = document.createElement("label");
  const label = document.createElement("span");
  const select = document.createElement("select");
  row.className = "three-scene__field";
  label.textContent = labelText;

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
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
  label.className = "three-scene__toggle";
  input.type = "checkbox";
  input.checked = checked;
  text.textContent = labelText;
  label.append(input, text);
  return { input, label };
}

export const THREE_SCENE_EXPERIMENT = {
  title: "Three.js Floor",
  description:
    "A real authored floor, assembled by the game's own rules and drawn with Three.js: masonry, ground, the open night sky, distance fog, and the torch. Click the view to take the mouse, then walk it — this is where the atmosphere is judged, and nothing stands on the floor yet on purpose.",
  pageClass: "three-scene",
  width: "wide",
  mount: mountThreeScene,
} as const;

function mountThreeScene(content: HTMLElement): void {
  const abortController = new AbortController();

  const layout = document.createElement("div");
  const stage = document.createElement("section");
  const viewport = document.createElement("div");
  const hint = document.createElement("p");
  const sidebar = document.createElement("aside");
  const controls = document.createElement("section");
  const controlsTitle = document.createElement("h2");
  const statusPanel = document.createElement("section");
  const statusTitle = document.createElement("h2");
  const metrics = document.createElement("dl");

  layout.className = "three-scene__layout";
  stage.className = "three-scene__stage";
  viewport.className = "three-scene__viewport";
  hint.className = "three-scene__hint";
  hint.textContent = "Click to take the mouse · WASD to walk · Shift to run · Esc to give it back";
  sidebar.className = "three-scene__sidebar";
  controls.className = "three-scene__panel";
  controlsTitle.textContent = "Floor";
  statusPanel.className = "three-scene__panel";
  statusTitle.textContent = "Live diagnostics";
  metrics.className = "three-scene__metrics";

  const mapField = createSelectRow(
    "Map",
    MAPS.map((map) => ({ label: map.name, value: map.name })),
  );
  mapField.select.value = defaultMap().name;
  const torch = createToggle("Torch", true);
  const fog = createToggle("Distance fog", true);

  const metricOutputs = new Map<string, HTMLOutputElement>();
  for (const [label, key] of [
    ["Cell", "cell"],
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

  controls.append(controlsTitle, mapField.row, torch.label, fog.label);
  statusPanel.append(statusTitle, metrics);
  stage.append(viewport, hint);
  sidebar.append(controls, statusPanel);
  layout.append(stage, sidebar);
  content.append(layout);

  let runtime: SceneRuntime;
  try {
    runtime = new SceneRuntime(viewport, defaultMap(), {
      onStatus(status) {
        metricOutputs.get("cell")!.textContent = status.cell;
        metricOutputs.get("fps")!.textContent = String(status.fps);
        metricOutputs.get("draw-calls")!.textContent = String(status.drawCalls);
        metricOutputs.get("triangles")!.textContent = status.triangles.toLocaleString();
      },
    });
  } catch (error) {
    const fallback = document.createElement("div");
    const title = document.createElement("strong");
    const copy = document.createElement("p");
    fallback.className = "three-scene__fallback";
    title.textContent = "WebGL preview unavailable";
    copy.textContent =
      error instanceof Error ? error.message : "The browser could not initialize a WebGL renderer on this device.";
    fallback.append(title, copy);
    viewport.replaceChildren(fallback);
    return;
  }

  const locked = (): boolean => document.pointerLockElement === runtime.canvas;

  mapField.select.addEventListener(
    "change",
    () => {
      const chosen = MAPS.find((map) => map.name === mapField.select.value);

      if (chosen) {
        runtime.openMap(chosen);
      }
    },
    { signal: abortController.signal },
  );
  torch.input.addEventListener("change", () => runtime.setTorchEnabled(torch.input.checked), {
    signal: abortController.signal,
  });
  fog.input.addEventListener("change", () => runtime.setFogEnabled(fog.input.checked), {
    signal: abortController.signal,
  });

  runtime.canvas.addEventListener(
    "click",
    () => {
      if (!locked()) {
        void runtime.canvas.requestPointerLock();
      }
    },
    { signal: abortController.signal },
  );

  document.addEventListener(
    "pointerlockchange",
    () => {
      if (!locked()) {
        runtime.releaseKeys();
      }
    },
    { signal: abortController.signal },
  );

  document.addEventListener(
    "mousemove",
    (event) => {
      if (locked()) {
        runtime.look(event.movementX, event.movementY);
      }
    },
    { signal: abortController.signal },
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (!locked()) {
        return;
      }

      const key = event.key.toLowerCase();

      // Only the keys the walk reads are swallowed; everything else still reaches the page, so the
      // debug shell's own navigation keeps working while the pointer is held.
      if (["w", "a", "s", "d", "shift"].includes(key)) {
        event.preventDefault();
        runtime.holdKey(key, true);
      }
    },
    { signal: abortController.signal },
  );

  window.addEventListener("keyup", (event) => runtime.holdKey(event.key.toLowerCase(), false), {
    signal: abortController.signal,
  });
  window.addEventListener("blur", () => runtime.releaseKeys(), { signal: abortController.signal });

  window.addEventListener(
    "pagehide",
    () => {
      abortController.abort();
      runtime.dispose();
    },
    { once: true },
  );
}
