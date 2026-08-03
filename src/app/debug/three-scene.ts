import { createDebugPage } from "@/app/debug/debug-shell";
import { GAME_CATALOG } from "@/content/catalog";
import { MAPS } from "@/content/maps/map-library";
import { grabAction, primaryAction } from "@/core/actions";
import type { ResolvedMap } from "@/core/map-contract";
import { stepWorld } from "@/core/simulation";
import { createWorld, crowdHere, flattenFloorForTesting, killEnemy, spawnReinforcement } from "@/core/world";
import { SceneRenderer } from "@/presentation/scene-3d/scene-renderer";
import type { ViewmodelKind } from "@/presentation/scene-3d/viewmodel";

import "@/app/debug/three-scene.css";

/** How the hands drive the eye. The runtime has no opinion about either any more. */
const MOUSE_SENSITIVITY = 0.0026;
const MAX_PITCH = 1.45;

const MOVEMENT_KEYS: Readonly<Record<string, "forward" | "backward" | "strafeLeft" | "strafeRight">> = {
  w: "forward",
  s: "backward",
  a: "strafeLeft",
  d: "strafeRight",
};

/**
 * Mouse counts per second that read as a full-speed turn, for the comfort vignette.
 *
 * Smoothed rising fast and falling slowly, so the frame does not breathe every time the mouse pauses
 * mid-sweep. All three are the play surface's; the effect is slight by design and tuning it here
 * would be tuning it against a different pair of hands.
 */
const FULL_TURN_RATE = 2600;
const TURN_RISE = 0.4;
const TURN_FALL = 0.06;

/**
 * What a run opens on when nothing else is named.
 *
 * Still a literal, though the reason has changed: the runtime module that owns this question lives
 * in `src/runtime/`, which the debug layer has no business reaching into for one default.
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

/**
 * The page this tool draws itself.
 *
 * It went through the sandbox adapter while the runtime lived in `src/sandbox/`, because an
 * experiment there may not reach the debug shell and had to describe the page it wanted instead.
 * The runtime is a presentation module now and this file is an ordinary debug tool, so it asks for
 * the shell directly like every workbench beside it.
 */
export function renderThreeScene(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "Three.js Floor",
    description:
      "The real floor and the real simulation, drawn with Three.js under the shipped renderer's own light formulas: masonry, ground, the open night sky, the torch, block skeletons, the fittings, the dust, and the arm the game already had. Click the view to take the mouse, then play it — this is where the atmosphere is judged, frame against frame with a recording of the real thing.",
    width: "wide",
  });

  page.classList.add("three-scene");
  mountThreeScene(content);
  mount.replaceChildren(page);
}

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

  let renderer: SceneRenderer;
  try {
    renderer = new SceneRenderer(viewport);
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

  // Everything below is the driver: the world, the loop, and the hands. It lives here rather than in
  // the runtime because the runtime is on its way to being called by the play surface, which owns all
  // three already — a renderer that also ran a game would have to be talked out of it first.
  let map = defaultMap();
  let world = createWorld(map, GAME_CATALOG);
  let paused = true;
  let lastFrameTime = performance.now();
  let metricsElapsed = 0;
  let smoothedFps = 60;
  let turnInput = 0;
  let turnRate = 0;
  let animationFrame = 0;
  const input = { forward: false, backward: false, strafeLeft: false, strafeRight: false };

  const locked = (): boolean => document.pointerLockElement === renderer.canvas;

  const releaseKeys = (): void => {
    input.forward = false;
    input.backward = false;
    input.strafeLeft = false;
    input.strafeRight = false;
  };

  const killEverything = (): void => {
    for (const enemy of world.enemies.slice()) {
      killEnemy(world, enemy);
    }
  };

  const fillCrowd = (): void => {
    while (world.enemies.length < crowdHere(world).cap) {
      if (!spawnReinforcement(world)) {
        break;
      }
    }
  };

  /**
   * Turns the arrival to face whichever way sees furthest.
   *
   * The position is the game's own — the rules put the player on the entrance. The heading is not,
   * because the game has no opening heading and an arbitrary one lands against masonry about as often
   * as not: a tool whose first frame is a wall face at arm's length reads as a broken renderer for
   * the second it takes to turn around, and this one is opened to be looked at.
   */
  const faceOpenGround = (): void => {
    const maze = world.maze;
    const player = world.player;
    let bestAngle = player.angle;
    let bestRun = -1;

    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2;
      const stepX = Math.cos(angle);
      const stepY = Math.sin(angle);
      let run = 0;

      while (run < 24) {
        const cellX = Math.floor(player.x + stepX * (run + 0.5));
        const cellY = Math.floor(player.y + stepY * (run + 0.5));
        const tile = maze.tiles[cellY * maze.width + cellX];

        if (!tile || (tile.kind !== "open" && tile.kind !== "filled")) {
          break;
        }

        run += 0.5;
      }

      if (run > bestRun) {
        bestRun = run;
        bestAngle = angle;
      }
    }

    player.angle = bestAngle;
    player.pitch = 0;
  };

  /**
   * The development handle, the same arrangement the block preview and the play surface both use: a
   * picture taken from wherever the mouse happened to be left is not comparable with the last one,
   * and judging a floor means standing in the same spot twice.
   *
   * It moved here with the world it inspects, and is republished on every restart so a session
   * holding it never poses a floor that has since been replaced.
   */
  const publish = (): void => {
    (window as unknown as Record<string, unknown>).__sceneRuntime = {
      canvas: renderer.canvas,
      fillCrowd,
      flatten: () => flattenFloorForTesting(world),
      inspected: world,
      killEverything,
      setPaused(next: boolean) {
        paused = next;
        releaseKeys();
      },
      stand(x: number, y: number, angle: number, pitch = 0) {
        world.player.x = x;
        world.player.y = y;
        world.player.angle = angle;
        world.player.pitch = pitch;
      },
    };
  };

  const restart = (next: ResolvedMap = map): void => {
    map = next;
    world = createWorld(map, GAME_CATALOG);
    faceOpenGround();
    publish();
  };

  const tick = (time: number): void => {
    const delta = Math.min((time - lastFrameTime) / 1000, 0.05);
    lastFrameTime = time;

    if (!paused) {
      stepWorld(world, input, delta);
    }

    // Cues are drained rather than played: this tool carries no audio, and leaving them to accumulate
    // would grow an array nobody empties for as long as the tab is open.
    world.sfxCues.length = 0;

    if (delta > 0.0005) {
      smoothedFps += (1 / delta - smoothedFps) * 0.08;
      // Rises quickly and falls slowly, so the frame does not breathe every time the mouse pauses.
      const instant = Math.min(1, turnInput / delta / FULL_TURN_RATE);
      turnRate += (instant - turnRate) * (instant > turnRate ? TURN_RISE : TURN_FALL);
    }

    turnInput = 0;
    renderer.render(world, { deltaSeconds: paused ? 0 : delta, turnRate });
    metricsElapsed += delta;

    if (metricsElapsed >= 0.4) {
      const player = world.player;
      const metrics = renderer.metrics;
      metricOutputs.get("cell")!.textContent = `${Math.floor(player.x)}, ${Math.floor(player.y)}`;
      metricOutputs.get("hp")!.textContent = `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
      metricOutputs.get("bodies")!.textContent = String(world.enemies.length);
      metricOutputs.get("fps")!.textContent = String(Math.round(smoothedFps));
      metricOutputs.get("draw-calls")!.textContent = String(metrics.drawCalls);
      metricOutputs.get("triangles")!.textContent = metrics.triangles.toLocaleString();
      metricsElapsed = 0;
    }

    animationFrame = requestAnimationFrame(tick);
  };

  mapField.select.addEventListener(
    "change",
    () => {
      const chosen = MAPS.find((entry) => entry.name === mapField.select.value);

      if (chosen) {
        restart(chosen);
      }
    },
    { signal: abortController.signal },
  );
  handsField.select.addEventListener("change", () => renderer.setViewmodel(handsField.select.value as ViewmodelKind), {
    signal: abortController.signal,
  });
  torch.input.addEventListener("change", () => renderer.setTorchEnabled(torch.input.checked), {
    signal: abortController.signal,
  });
  grain.input.addEventListener("change", () => renderer.setGrain(grain.input.checked), {
    signal: abortController.signal,
  });
  restartButton.addEventListener("click", () => restart(), { signal: abortController.signal });
  killButton.addEventListener("click", killEverything, { signal: abortController.signal });
  fillButton.addEventListener("click", fillCrowd, { signal: abortController.signal });
  arenaButton.addEventListener("click", () => flattenFloorForTesting(world), { signal: abortController.signal });

  renderer.canvas.addEventListener(
    "mousedown",
    (event) => {
      if (!locked()) {
        void renderer.canvas.requestPointerLock();
        return;
      }

      event.preventDefault();

      if (event.button === 0) {
        primaryAction(world);
        return;
      }

      if (event.button === 2) {
        grabAction(world);
      }
    },
    { signal: abortController.signal },
  );
  renderer.canvas.addEventListener("contextmenu", (event) => event.preventDefault(), {
    signal: abortController.signal,
  });

  // The world holds still whenever nobody has the mouse, which is what makes the picture safe to
  // walk away from: bodies stop deciding, timers stop running, and the floor is where it was left.
  document.addEventListener(
    "pointerlockchange",
    () => {
      paused = !locked();
      releaseKeys();
    },
    { signal: abortController.signal },
  );

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!locked()) {
        return;
      }

      const player = world.player;
      const turned = player.angle + event.movementX * MOUSE_SENSITIVITY;
      player.angle = turned - Math.PI * 2 * Math.floor(turned / (Math.PI * 2));
      // Raw device counts, drained by the frame. Vertical counts half: looking up and down is a
      // smaller part of what makes a fast turn uncomfortable than sweeping the view across a room.
      turnInput += Math.abs(event.movementX) + Math.abs(event.movementY) * 0.5;
      // Clamped symmetrically, because a perspective camera has none of the one-sided smearing the
      // raycaster's pitch shear has. The play surface clamps its own look asymmetrically for exactly
      // that reason; which of the two survives is that surface's question, asked when it starts
      // driving this renderer.
      player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.pitch - event.movementY * MOUSE_SENSITIVITY));
    },
    { signal: abortController.signal },
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (!locked()) {
        return;
      }

      const binding = MOVEMENT_KEYS[event.key.toLowerCase()];

      // Only the keys the walk reads are swallowed; everything else still reaches the page, so the
      // debug shell's own navigation keeps working while the pointer is held.
      if (binding) {
        event.preventDefault();
        input[binding] = true;
      }
    },
    { signal: abortController.signal },
  );

  window.addEventListener(
    "keyup",
    (event) => {
      const binding = MOVEMENT_KEYS[event.key.toLowerCase()];

      if (binding) {
        input[binding] = false;
      }
    },
    { signal: abortController.signal },
  );
  window.addEventListener("blur", releaseKeys, { signal: abortController.signal });

  faceOpenGround();
  publish();
  animationFrame = requestAnimationFrame(tick);

  window.addEventListener(
    "pagehide",
    () => {
      abortController.abort();
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
    },
    { once: true },
  );
}
