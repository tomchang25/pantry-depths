import { MAPS } from "@/content/maps/map-library";
import type { ResolvedMap } from "@/core/map-contract";

import { SceneRuntime } from "./scene-runtime";
import type { ViewmodelKind } from "./viewmodel";
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

function createButton(labelText: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = labelText;
  return button;
}

export const THREE_SCENE_EXPERIMENT = {
  title: "Three.js Floor",
  description:
    "The real floor and the real simulation, drawn with Three.js under the shipped renderer's own light formulas: masonry, ground, the open night sky, the torch, block skeletons, the fittings, the dust, and the arm the game already had. Click the view to take the mouse, then play it — this is where the atmosphere is judged, frame against frame with a recording of the real thing.",
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
  const buttons = document.createElement("div");
  const statusPanel = document.createElement("section");
  const statusTitle = document.createElement("h2");
  const metrics = document.createElement("dl");

  layout.className = "three-scene__layout";
  stage.className = "three-scene__stage";
  viewport.className = "three-scene__viewport";
  hint.className = "three-scene__hint";
  hint.textContent =
    "Click to take the mouse · WASD to walk · left button strikes · right button grabs and drops · Esc to give it back";
  sidebar.className = "three-scene__sidebar";
  controls.className = "three-scene__panel";
  controlsTitle.textContent = "Floor";
  buttons.className = "three-scene__buttons";
  statusPanel.className = "three-scene__panel";
  statusTitle.textContent = "Live diagnostics";
  metrics.className = "three-scene__metrics";

  const mapField = createSelectRow(
    "Map",
    MAPS.map((map) => ({ label: map.name, value: map.name })),
  );
  mapField.select.value = defaultMap().name;
  const handsField = createSelectRow("Hands", [
    { label: "Authored arm", value: "authored" },
    { label: "None", value: "none" },
  ]);
  const torch = createToggle("Torch", true);
  const grain = createToggle("Pixel grain", true);
  const restartButton = createButton("Restart");
  const killButton = createButton("Kill all");
  const fillButton = createButton("Fill crowd");
  const arenaButton = createButton("Flatten");

  const metricOutputs = new Map<string, HTMLOutputElement>();
  for (const [label, key] of [
    ["Cell", "cell"],
    ["Health", "hp"],
    ["Bodies", "bodies"],
    ["FPS", "fps"],
    ["Draw calls", "draw-calls"],
    ["Floor triangles", "triangles"],
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

  buttons.append(restartButton, killButton, fillButton, arenaButton);
  controls.append(controlsTitle, mapField.row, handsField.row, torch.label, grain.label, buttons);
  statusPanel.append(statusTitle, metrics);
  const hud = document.createElement("div");
  const hudLeft = document.createElement("span");
  const hudRight = document.createElement("span");
  hud.className = "three-scene__hud";
  hudLeft.textContent = "HUD stands here";
  hudRight.textContent = "plain DOM over WebGL";
  hud.append(hudLeft, hudRight);
  viewport.append(hud);

  stage.append(viewport, hint);
  sidebar.append(controls, statusPanel);
  layout.append(stage, sidebar);
  content.append(layout);

  let runtime: SceneRuntime;
  try {
    runtime = new SceneRuntime(viewport, defaultMap(), {
      onStatus(status) {
        metricOutputs.get("cell")!.textContent = status.cell;
        metricOutputs.get("hp")!.textContent = status.hp;
        metricOutputs.get("bodies")!.textContent = String(status.bodies);
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
        runtime.restart(chosen);
      }
    },
    { signal: abortController.signal },
  );
  handsField.select.addEventListener("change", () => runtime.setViewmodel(handsField.select.value as ViewmodelKind), {
    signal: abortController.signal,
  });
  torch.input.addEventListener("change", () => runtime.setTorchEnabled(torch.input.checked), {
    signal: abortController.signal,
  });
  grain.input.addEventListener("change", () => runtime.setGrain(grain.input.checked), {
    signal: abortController.signal,
  });
  restartButton.addEventListener("click", () => runtime.restart(), { signal: abortController.signal });
  killButton.addEventListener("click", () => runtime.killEverything(), { signal: abortController.signal });
  fillButton.addEventListener("click", () => runtime.fillCrowd(), { signal: abortController.signal });
  arenaButton.addEventListener("click", () => runtime.flatten(), { signal: abortController.signal });

  runtime.canvas.addEventListener(
    "mousedown",
    (event) => {
      if (!locked()) {
        void runtime.canvas.requestPointerLock();
        return;
      }

      event.preventDefault();

      if (event.button === 0) {
        runtime.strike();
        return;
      }

      if (event.button === 2) {
        runtime.grab();
      }
    },
    { signal: abortController.signal },
  );
  runtime.canvas.addEventListener("contextmenu", (event) => event.preventDefault(), {
    signal: abortController.signal,
  });

  // The world holds still whenever nobody has the mouse, which is what makes the picture safe to
  // walk away from: bodies stop deciding, timers stop running, and the floor is where it was left.
  document.addEventListener("pointerlockchange", () => runtime.setPaused(!locked()), {
    signal: abortController.signal,
  });
  runtime.setPaused(true);

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
      if (["w", "a", "s", "d"].includes(key)) {
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
