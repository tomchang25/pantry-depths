/**
 * The demo surface: DOM, input, and the frame loop.
 *
 * Pointer lock drives the view, WASD drives the feet, and the two mouse buttons drive everything
 * else. Nothing here is shared with the shipped play surface — this file exists so the shipped one
 * never has to learn what a mouse-look is.
 */

import "@/demo/demo.css";

import { grabAction, meleeReach, primaryAction, PROP_LABELS, wallAhead } from "@/demo/actions";
import { findBless, type BlessDefinition } from "@/demo/bless";
import type { DemoArchetypeId } from "@/demo/enemy-archetypes";
import { createDemoEffects, createDemoScene } from "@/demo/demo-scene";
import { loadDemoImages } from "@/demo/demo-sprites";
import { drawDemoViewmodel } from "@/demo/demo-viewmodel";
import { DEMO_GRID_SIZE, tileAt, tileIndex } from "@/demo/maze";
import { stepDemoWorld, type DemoInput } from "@/demo/simulation";
import { createDemoWorld, flattenFloorForTesting, type DemoWorld } from "@/demo/world";
import { CanvasGameplayRenderer } from "@/presentation/canvas-gameplay-renderer";

export type MountedDemo = Readonly<{ dispose: () => void }>;

const MOUSE_SENSITIVITY = 0.0026;
/**
 * Vertical look is effectively unbounded: at ±1 the sheared horizon has already left the screen, so
 * this only stops the number growing without limit while the mouse keeps travelling.
 */
const MAX_PITCH = 1.5;
/** Mouse counts per second that read as a full-speed turn, for the comfort vignette. */
const FULL_TURN_RATE = 2600;
const MINIMAP_CELL = 8;

const MOVEMENT_KEYS: Readonly<Record<string, keyof DemoInput>> = {
  w: "forward",
  s: "backward",
  a: "strafeLeft",
  d: "strafeRight",
  arrowup: "forward",
  arrowdown: "backward",
  arrowleft: "strafeLeft",
  arrowright: "strafeRight",
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  created.className = className;

  if (text !== undefined) {
    created.textContent = text;
  }

  return created;
}

function suppressContextMenu(event: MouseEvent): void {
  event.preventDefault();
}

const ENEMY_DOT_COLORS: Readonly<Record<DemoArchetypeId, string>> = {
  walker: "#7fc46a",
  ranged: "#5aa8e0",
  charger: "#e2585f",
};

const MINIMAP_TILE_COLORS: Readonly<Record<string, string>> = {
  border: "#0b0710",
  stone: "#59506a",
  wood: "#7a5029",
  water: "#1c3f5e",
  barricade: "#6b4526",
  open: "#241a2e",
};

function drawMinimap(context: CanvasRenderingContext2D, world: DemoWorld): void {
  const size = DEMO_GRID_SIZE * MINIMAP_CELL;
  context.clearRect(0, 0, size, size);

  for (let y = 0; y < DEMO_GRID_SIZE; y += 1) {
    for (let x = 0; x < DEMO_GRID_SIZE; x += 1) {
      const tile = world.maze.tiles[tileIndex(x, y)];
      context.fillStyle = MINIMAP_TILE_COLORS[tile?.kind ?? "open"] ?? "#241a2e";
      context.fillRect(x * MINIMAP_CELL, y * MINIMAP_CELL, MINIMAP_CELL, MINIMAP_CELL);
    }
  }

  const dot = (x: number, y: number, radius: number, colour: string): void => {
    context.fillStyle = colour;
    context.beginPath();
    context.arc(x * MINIMAP_CELL, y * MINIMAP_CELL, radius, 0, Math.PI * 2);
    context.fill();
  };

  dot(world.maze.exit.x + 0.5, world.maze.exit.y + 0.5, 4, "#7fd8a2");
  dot(world.maze.entrance.x + 0.5, world.maze.entrance.y + 0.5, 3, "#a789d4");

  if (world.altar.hp > 0) {
    dot(world.altar.x, world.altar.y, 3.4, "#f4ca7a");
  }

  for (const prop of world.props) {
    dot(prop.x, prop.y, 1.6, "#e6d3a6");
  }

  for (const enemy of world.enemies) {
    dot(enemy.x, enemy.y, 2.6, ENEMY_DOT_COLORS[enemy.archetype.id]);
  }

  dot(world.player.x, world.player.y, 3, "#ffe6b0");
  context.strokeStyle = "#ffe6b0";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(world.player.x * MINIMAP_CELL, world.player.y * MINIMAP_CELL);
  context.lineTo(
    (world.player.x + Math.cos(world.player.angle) * 1.6) * MINIMAP_CELL,
    (world.player.y + Math.sin(world.player.angle) * 1.6) * MINIMAP_CELL,
  );
  context.stroke();
}

export async function mountDemo(mount: HTMLElement): Promise<MountedDemo> {
  const surface = element("main", "demo");
  const canvas = element("canvas", "demo__canvas");
  const panel = element("section", "demo__panel");
  const bar = element("div", "demo__bar");
  const barFill = document.createElement("span");
  bar.append(barFill);
  const readout = document.createElement("div");
  const minimap = element("canvas", "demo__minimap");
  minimap.width = DEMO_GRID_SIZE * MINIMAP_CELL;
  minimap.height = DEMO_GRID_SIZE * MINIMAP_CELL;
  const crosshair = element("div", "demo__crosshair");
  const message = element("p", "demo__message");
  const blessBar = element("div", "demo__blessbar");
  const card = element("aside", "demo__card");
  const overlay = element("section", "demo__overlay");
  const overlayTitle = element("h1", "", "Pantry Depths — Demo");
  const overlayBody = document.createElement("p");
  overlay.append(overlayTitle, overlayBody);
  panel.append(bar, readout, blessBar);
  surface.append(canvas, panel, minimap, crosshair, message, card, overlay);
  mount.replaceChildren(surface);

  const minimapContext = minimap.getContext("2d");

  if (!minimapContext) {
    throw new Error("demo: minimap canvas is unavailable");
  }

  const images = await loadDemoImages();
  const renderer = new CanvasGameplayRenderer(canvas, images);
  // The demo runs a real-time camera, so half the plane resolution — both axes, keeping the coarse
  // pixels square — buys frames the turn-based game has no need to buy.
  renderer.halvePlaneRows = true;
  renderer.halvePlaneColumns = true;
  const sceneContext = canvas.getContext("2d");

  if (!sceneContext) {
    throw new Error("demo: scene canvas is unavailable");
  }

  let world = createDemoWorld();
  let disposed = false;
  let frame = 0;
  let lastTime: number | undefined;
  let cardTimer: number | undefined;
  /** Exponentially smoothed, because a raw per-frame reciprocal is unreadable noise. */
  let smoothedFps = 60;
  /** Mouse counts since the last frame, and the smoothed rate the comfort vignette reads. */
  let turnInput = 0;
  let turnRate = 0;
  const input: { forward: boolean; backward: boolean; strafeLeft: boolean; strafeRight: boolean } = {
    forward: false,
    backward: false,
    strafeLeft: false,
    strafeRight: false,
  };

  /** Development-only handle so a run can be poked at from the console or a browser test. */
  const publish = (): void => {
    if (import.meta.env.DEV) {
      (window as unknown as { demoWorld?: DemoWorld }).demoWorld = world;
      (window as unknown as { demoRenderer?: CanvasGameplayRenderer }).demoRenderer = renderer;
    }
  };

  const clearInput = (): void => {
    input.forward = false;
    input.backward = false;
    input.strafeLeft = false;
    input.strafeRight = false;
  };

  const locked = (): boolean => document.pointerLockElement === canvas;

  const refreshOverlay = (): void => {
    if (world.status === "dead") {
      overlayTitle.textContent = "被吃掉了";
      overlayBody.innerHTML = `深入到第 ${world.depth} 層，殺掉 ${world.kills} 隻，持有 ${world.bless.owned.length} 個祝福。按 <kbd>R</kbd> 重來。`;
      overlay.hidden = false;
      return;
    }

    if (!locked()) {
      overlayTitle.textContent = "Pantry Depths — Demo";
      overlayBody.innerHTML =
        "點一下畫面開始。<br><kbd>WASD</kbd> 移動 · 滑鼠轉向 · <kbd>左鍵</kbd> 攻擊／投擲 · <kbd>右鍵</kbd> 抓取／放下 · <kbd>R</kbd> 重新開始 · <kbd>Esc</kbd> 放開滑鼠<br>綠光是往下的樓梯，金光是祭壇（劈三下拿祝福）。兩者隔著牆也看得到。";
      overlay.hidden = false;
      return;
    }

    overlay.hidden = true;
  };

  const refreshBlessBar = (): void => {
    const icons = world.bless.owned
      .map((id) => findBless(id))
      .filter((definition): definition is BlessDefinition => Boolean(definition))
      .map(
        (definition) =>
          `<i class="demo__blessicon" style="--bless: ${definition.color}" title="${definition.name}：${definition.detail}">${definition.glyph}</i>`,
      );

    if (world.bless.overflowMaxHp > 0) {
      icons.push(`<i class="demo__blessicon" style="--bless: #f0f0d0" title="額外最大生命">＋</i>`);
    }

    blessBar.innerHTML = icons.join("");
  };

  /**
   * Shows the award card for a few seconds.
   *
   * The world only ever raises a flag; the card, its timer, and its removal all live here so the
   * simulation never has to know how long a piece of user interface stays on screen.
   */
  const showCard = (token: string): void => {
    const definition = token === "overflow" ? undefined : findBless(token as BlessDefinition["id"]);
    card.innerHTML = definition
      ? `<i class="demo__cardglyph" style="--bless: ${definition.color}">${definition.glyph}</i><strong>${definition.name}</strong><span>${definition.detail}</span>`
      : `<i class="demo__cardglyph" style="--bless: #f0f0d0">＋</i><strong>血脈</strong><span>祝福已收集完畢，改為提升最大生命</span>`;
    card.classList.add("demo__card--visible");

    if (cardTimer !== undefined) {
      window.clearTimeout(cardTimer);
    }

    cardTimer = window.setTimeout(() => card.classList.remove("demo__card--visible"), 5000);
    refreshBlessBar();
  };

  const refreshPanel = (): void => {
    barFill.style.width = `${Math.max(0, (world.player.hp / world.player.maxHp) * 100)}%`;
    const held = world.held
      ? world.held.kind === "enemy"
        ? "敵人"
        : `${PROP_LABELS[world.held.prop]} ×${world.held.count}`
      : "空手";
    const ahead = wallAhead(world, meleeReach(world));
    const aheadTile = ahead ? tileAt(world.maze, ahead.x, ahead.y) : undefined;
    const aheadText =
      aheadTile === undefined
        ? "—"
        : aheadTile.kind === "border"
          ? "外圈磚牆（不可破壞）"
          : `${aheadTile.kind === "wood" ? "木牆" : "石牆"} HP ${aheadTile.hp}/${aheadTile.maxHp}`;
    readout.innerHTML = [
      `<b>B${world.depth}</b> · HP ${Math.ceil(world.player.hp)} / ${world.player.maxHp} · <span class="demo__fps">${Math.round(smoothedFps)} FPS</span>`,
      `手上：<span class="demo__held">${held}</span>`,
      `面前：${aheadText}`,
      `祭壇 ${world.altar.hp > 0 ? `${world.altar.hp}/${world.altar.maxHp} 下` : "已用"} · 敵人 ${world.enemies.length}`,
      `擊殺 ${world.kills} · 破牆 ${world.wallsBroken}`,
    ].join("<br>");
    message.textContent = world.message;
    message.classList.toggle("demo__message--visible", world.messageSeconds > 0);

    if (world.pendingCard !== undefined) {
      showCard(world.pendingCard);
      world.pendingCard = undefined;
    }
  };

  const restart = (): void => {
    world = createDemoWorld();
    clearInput();
    publish();
    card.classList.remove("demo__card--visible");
    refreshBlessBar();
    refreshOverlay();
  };

  const tick = (now: number): void => {
    if (disposed) {
      return;
    }

    frame = window.requestAnimationFrame(tick);
    const deltaSeconds = lastTime === undefined ? 0 : Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (deltaSeconds > 0.0005) {
      smoothedFps += (1 / deltaSeconds - smoothedFps) * 0.08;
      // Rises quickly and falls slowly, so the frame does not breathe every time the mouse pauses.
      const instant = Math.min(1, turnInput / deltaSeconds / FULL_TURN_RATE);
      turnRate += (instant - turnRate) * (instant > turnRate ? 0.4 : 0.06);
    }

    turnInput = 0;

    const active = locked() && world.status === "playing";
    stepDemoWorld(
      world,
      active ? input : { forward: false, backward: false, strafeLeft: false, strafeRight: false },
      deltaSeconds,
    );
    renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    const scene = createDemoScene(world);
    renderer.render(scene, world.elapsedSeconds, createDemoEffects(world), {
      reducedMotion: false,
      viewmodel: false,
      grade: true,
      turnRate,
    });
    // Where the swing landed, in screen space, so the arm and the arc can be aimed at it.
    const target = world.swingTarget;
    const aim = target ? renderer.project(scene, target) : undefined;
    drawDemoViewmodel(sceneContext, images, world, aim ? { x: aim.screenX, y: aim.screenY } : undefined);
    drawMinimap(minimapContext, world);
    refreshPanel();
    refreshOverlay();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    if (key === "r") {
      event.preventDefault();
      restart();
      return;
    }

    // The frame-rate worst case on demand: an arena with no occlusion and a full crowd.
    if (key === "t") {
      event.preventDefault();
      flattenFloorForTesting(world);
      return;
    }

    const binding = MOVEMENT_KEYS[key];

    if (binding) {
      event.preventDefault();
      input[binding] = true;
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    const binding = MOVEMENT_KEYS[event.key.toLowerCase()];

    if (binding) {
      input[binding] = false;
    }
  };

  const handleMouseMove = (event: MouseEvent): void => {
    if (!locked()) {
      return;
    }

    const turned = world.player.angle + event.movementX * MOUSE_SENSITIVITY;
    // Wrapped rather than accumulated: a long session spinning one way otherwise walks the angle out
    // to where float precision starts coarsening the turn.
    world.player.angle = turned - Math.PI * 2 * Math.floor(turned / (Math.PI * 2));
    turnInput += Math.abs(event.movementX) + Math.abs(event.movementY) * 0.5;
    world.player.pitch = Math.max(
      -MAX_PITCH,
      Math.min(MAX_PITCH, world.player.pitch - event.movementY * MOUSE_SENSITIVITY * 0.42),
    );
  };

  const handleMouseDown = (event: MouseEvent): void => {
    if (!locked()) {
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
  };

  /**
   * Locks with raw device movement.
   *
   * The default lock derives `movementX`/`movementY` from the operating system cursor, which is
   * still a real cursor sitting somewhere on the desktop. Once it drifts into a screen edge the
   * deltas going that way clamp to zero, and the view stops turning right or up while the other
   * directions keep working — releasing the lock recentres the cursor, which is why Escape and
   * re-click appeared to fix it. Unadjusted movement reads the device instead and has no edge.
   */
  const requestLook = (): void => {
    const request = canvas.requestPointerLock({ unadjustedMovement: true }) as unknown;

    if (request instanceof Promise) {
      request.catch(() => {
        // Not every platform exposes raw input; an ordinary lock is still better than none.
        void canvas.requestPointerLock();
      });
    }
  };

  const handleOverlayClick = (): void => {
    if (world.status !== "playing") {
      restart();
    }

    requestLook();
  };

  const handleLockChange = (): void => {
    if (!locked()) {
      clearInput();
    }

    refreshOverlay();
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearInput);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("contextmenu", suppressContextMenu);
  document.addEventListener("pointerlockchange", handleLockChange);
  overlay.addEventListener("click", handleOverlayClick);

  publish();
  refreshBlessBar();
  refreshOverlay();
  frame = window.requestAnimationFrame(tick);

  return {
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frame);

      if (cardTimer !== undefined) {
        window.clearTimeout(cardTimer);
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("contextmenu", suppressContextMenu);
      document.removeEventListener("pointerlockchange", handleLockChange);
      overlay.removeEventListener("click", handleOverlayClick);
      surface.remove();
    },
  };
}
