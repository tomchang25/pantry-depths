import { createDebugPage } from "@/app/debug/debug-shell";

import {
  PREVIEW_SCENE_IDS,
  type PreviewLightMode,
  type PreviewRendererMode,
  type PreviewSceneId,
} from "./preview-contracts";
import { PreviewRuntime } from "./preview-runtime";
import "./three-preview.css";

const SCENE_LABELS: Readonly<Record<PreviewSceneId, string>> = {
  altar: "Ritual altar",
  "bone-explosion": "Bone explosion",
  mortar: "Mortar impact",
  "skeleton-bisect": "Skeleton bisection",
  "sword-attack": "Sword attack",
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
  row.className = "three-preview__field";
  label.textContent = labelText;
  for (const option of options) select.append(createOption(option.value, option.label));
  row.append(label, select);
  return { row, select };
}

function createToggle(labelText: string): Readonly<{ input: HTMLInputElement; label: HTMLLabelElement }> {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const text = document.createElement("span");
  label.className = "three-preview__toggle";
  input.type = "checkbox";
  text.textContent = labelText;
  label.append(input, text);
  return { input, label };
}

export function renderThreePreview(mount: HTMLElement): void {
  const abortController = new AbortController();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { page, content } = createDebugPage({
    title: "Standalone Three.js Preview",
    description:
      "A development-only proof of concept for skeletal posing, pose-preserving destruction, procedural props, and ballistic effects.",
    width: "wide",
  });
  page.classList.add("three-preview");

  const layout = document.createElement("div");
  const stage = document.createElement("section");
  const viewport = document.createElement("div");
  const stageHeader = document.createElement("header");
  const sceneTitle = document.createElement("h2");
  const sceneDescription = document.createElement("p");
  const sidebar = document.createElement("aside");
  const controls = document.createElement("section");
  const controlsTitle = document.createElement("h2");
  const transport = document.createElement("div");
  const playButton = document.createElement("button");
  const resetButton = document.createElement("button");
  const statusPanel = document.createElement("section");
  const statusTitle = document.createElement("h2");
  const phaseOutput = document.createElement("strong");
  const stateOutput = document.createElement("span");
  const detailOutput = document.createElement("span");
  const progress = document.createElement("progress");
  const metrics = document.createElement("dl");

  layout.className = "three-preview__layout";
  stage.className = "three-preview__stage";
  stageHeader.className = "three-preview__stage-header";
  sceneTitle.className = "three-preview__scene-title";
  sceneDescription.className = "three-preview__scene-description";
  viewport.className = "three-preview__viewport";
  viewport.setAttribute("aria-label", "3D preview viewport");
  sidebar.className = "three-preview__sidebar";
  controls.className = "three-preview__panel";
  controlsTitle.textContent = "Preview controls";
  transport.className = "three-preview__transport";
  playButton.type = "button";
  playButton.textContent = reducedMotion ? "Play" : "Pause";
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  statusPanel.className = "three-preview__panel three-preview__status";
  statusTitle.textContent = "Live diagnostics";
  phaseOutput.className = "three-preview__phase";
  stateOutput.className = "three-preview__state";
  detailOutput.className = "three-preview__detail";
  progress.max = 1;
  progress.value = 0;
  progress.setAttribute("aria-label", "Animation progress");
  metrics.className = "three-preview__metrics";

  const sceneField = createSelectRow(
    "Showcase",
    PREVIEW_SCENE_IDS.map((id) => ({ label: SCENE_LABELS[id], value: id })),
  );
  const speedField = createSelectRow("Playback speed", [
    { label: "0.25×", value: "0.25" },
    { label: "0.5×", value: "0.5" },
    { label: "1×", value: "1" },
  ]);
  speedField.select.value = "1";
  const rendererField = createSelectRow("Renderer", [
    { label: "Normal", value: "normal" },
    { label: "Pixelated", value: "pixelated" },
  ]);
  const lightField = createSelectRow("Lighting", [
    { label: "Dungeon", value: "dungeon" },
    { label: "Neutral inspection", value: "neutral" },
  ]);
  const autoReplay = createToggle("Auto replay");
  autoReplay.input.checked = !reducedMotion;
  const helpers = createToggle("Skeleton / trajectory helpers");
  const wireframe = createToggle("Wireframe");

  const metricEntries: ReadonlyArray<readonly [string, string]> = [
    ["FPS", "fps"],
    ["Draw calls", "draw-calls"],
    ["Triangles", "triangles"],
    ["Render buffer", "buffer"],
  ];
  const metricOutputs = new Map<string, HTMLOutputElement>();
  for (const [label, key] of metricEntries) {
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
    sceneField.row,
    transport,
    speedField.row,
    rendererField.row,
    lightField.row,
    autoReplay.label,
    helpers.label,
    wireframe.label,
  );
  statusPanel.append(statusTitle, phaseOutput, stateOutput, detailOutput, progress, metrics);
  sidebar.append(controls, statusPanel);
  stageHeader.append(sceneTitle, sceneDescription);
  stage.append(stageHeader, viewport);
  layout.append(stage, sidebar);
  content.append(layout);
  mount.replaceChildren(page);

  let runtime: PreviewRuntime;
  try {
    runtime = new PreviewRuntime(
      viewport,
      {
        onMetrics(nextMetrics) {
          metricOutputs.get("fps")!.textContent = String(nextMetrics.fps);
          metricOutputs.get("draw-calls")!.textContent = String(nextMetrics.drawCalls);
          metricOutputs.get("triangles")!.textContent = nextMetrics.triangles.toLocaleString();
          metricOutputs.get("buffer")!.textContent = `${nextMetrics.rendererWidth} × ${nextMetrics.rendererHeight}`;
        },
        onScene(showcase) {
          sceneTitle.textContent = showcase.title;
          sceneDescription.textContent = showcase.description;
        },
        onStatus(status) {
          phaseOutput.textContent = status.phase;
          stateOutput.textContent = status.state;
          detailOutput.textContent = status.detail ?? "";
          progress.value = status.normalizedTime;
        },
      },
      "sword-attack",
      reducedMotion,
    );
  } catch (error) {
    const fallback = document.createElement("div");
    const title = document.createElement("strong");
    const copy = document.createElement("p");
    fallback.className = "three-preview__fallback";
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

  playButton.addEventListener(
    "click",
    () => {
      const playing = !runtime.getPlayback().playing;
      runtime.setPlaying(playing);
      playButton.textContent = playing ? "Pause" : "Play";
    },
    { signal: abortController.signal },
  );
  resetButton.addEventListener("click", () => runtime.reset(), { signal: abortController.signal });
  sceneField.select.addEventListener("change", () => runtime.setScene(sceneField.select.value as PreviewSceneId), {
    signal: abortController.signal,
  });
  speedField.select.addEventListener("change", () => runtime.setSpeed(Number(speedField.select.value)), {
    signal: abortController.signal,
  });
  rendererField.select.addEventListener(
    "change",
    () => runtime.setRendererMode(rendererField.select.value as PreviewRendererMode),
    { signal: abortController.signal },
  );
  lightField.select.addEventListener(
    "change",
    () => runtime.setLightMode(lightField.select.value as PreviewLightMode),
    { signal: abortController.signal },
  );
  autoReplay.input.addEventListener("change", () => runtime.setAutoReplay(autoReplay.input.checked), {
    signal: abortController.signal,
  });
  const updateDebug = (): void =>
    runtime.setDebug({ helpers: helpers.input.checked, wireframe: wireframe.input.checked });
  helpers.input.addEventListener("change", updateDebug, { signal: abortController.signal });
  wireframe.input.addEventListener("change", updateDebug, { signal: abortController.signal });
  window.addEventListener(
    "pagehide",
    () => {
      abortController.abort();
      runtime.dispose();
    },
    { once: true },
  );
}
