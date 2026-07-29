import "@/demo/demo.css";

export type DemoHudBlessIcon = Readonly<{
  color: string;
  detail: string;
  glyph: string;
  name: string;
}>;

export type DemoHudCard = Readonly<{
  color: string;
  detail: string;
  glyph: string;
  name: string;
}>;

export type DemoHudMinimapPoint = Readonly<{
  color: string;
  radius: number;
  x: number;
  y: number;
}>;

export type DemoHudMinimap = Readonly<{
  facingAngle: number;
  height: number;
  player: DemoHudMinimapPoint;
  points: readonly DemoHudMinimapPoint[];
  tileColors: Readonly<Record<string, string>>;
  tiles: readonly string[];
  width: number;
}>;

export type DemoHudModel = Readonly<{
  ahead: string;
  altar: string;
  blessIcons: readonly DemoHudBlessIcon[];
  card?: DemoHudCard;
  depth: number;
  enemies: number;
  fps: number;
  held: string;
  hp: number;
  kills: number;
  maxHp: number;
  message?: string;
  minimap: DemoHudMinimap;
  overlay?: Readonly<{ body: string; title: string }>;
  wallsBroken: number;
}>;

export type MountedDemoHud = Readonly<{
  element: HTMLDivElement;
  overlayButton: HTMLButtonElement;
  update(model: DemoHudModel): void;
}>;

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

function drawMinimap(context: CanvasRenderingContext2D, model: DemoHudMinimap): void {
  const cell = Math.min(context.canvas.width / model.width, context.canvas.height / model.height);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);

  for (let y = 0; y < model.height; y += 1) {
    for (let x = 0; x < model.width; x += 1) {
      const tile = model.tiles[y * model.width + x] ?? "open";
      context.fillStyle = model.tileColors[tile] ?? model.tileColors.open ?? "#241a2e";
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  for (const point of model.points) {
    context.fillStyle = point.color;
    context.beginPath();
    context.arc(point.x * cell, point.y * cell, point.radius, 0, Math.PI * 2);
    context.fill();
  }

  const player = model.player;
  context.fillStyle = player.color;
  context.beginPath();
  context.arc(player.x * cell, player.y * cell, player.radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = player.color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(player.x * cell, player.y * cell);
  context.lineTo(
    (player.x + Math.cos(model.facingAngle) * 1.6) * cell,
    (player.y + Math.sin(model.facingAngle) * 1.6) * cell,
  );
  context.stroke();
}

function readoutLine(label: string, value: string): HTMLSpanElement {
  const line = document.createElement("span");
  const heading = document.createElement("b");
  heading.textContent = label;
  line.append(heading, ` ${value}`);
  return line;
}

/** Mounts the complete DOM HUD; callers provide only immutable display data. */
export function mountDemoHud(): MountedDemoHud {
  const root = element("div", "demo-hud");
  const panel = element("section", "demo__panel");
  const bar = element("div", "demo__bar");
  const barFill = document.createElement("span");
  const readout = element("div", "demo__readout");
  const blessBar = element("div", "demo__blessbar");
  const minimap = element("canvas", "demo__minimap");
  const crosshair = element("div", "demo__crosshair");
  const message = element("p", "demo__message");
  const card = element("aside", "demo__card");
  const overlayButton = element("button", "demo__overlay");
  const overlayTitle = element("strong", "demo__overlay-title");
  const overlayBody = element("span", "demo__overlay-body");
  const minimapContext = minimap.getContext("2d");

  if (!minimapContext) {
    throw new Error("demo HUD: minimap canvas is unavailable");
  }

  minimap.width = 168;
  minimap.height = 168;
  minimap.setAttribute("aria-label", "Dungeon minimap");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Health");
  message.setAttribute("role", "status");
  overlayButton.type = "button";
  overlayButton.append(overlayTitle, overlayBody);
  bar.append(barFill);
  panel.append(bar, readout, blessBar);
  root.append(panel, minimap, crosshair, message, card, overlayButton);

  const update = (model: DemoHudModel): void => {
    const healthShare = model.maxHp > 0 ? Math.max(0, Math.min(1, model.hp / model.maxHp)) : 0;
    barFill.style.width = `${healthShare * 100}%`;
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(model.maxHp));
    bar.setAttribute("aria-valuenow", String(Math.max(0, model.hp)));
    readout.replaceChildren(
      readoutLine(`B${model.depth} · HP`, `${Math.ceil(model.hp)} / ${model.maxHp} · ${Math.round(model.fps)} FPS`),
      readoutLine("Holding:", model.held),
      readoutLine("Ahead:", model.ahead),
      readoutLine("Altar", `${model.altar} · Enemies ${model.enemies}`),
      readoutLine("Kills", `${model.kills} · Walls broken ${model.wallsBroken}`),
    );
    blessBar.replaceChildren();

    for (const icon of model.blessIcons) {
      const item = element("span", "demo__blessicon", icon.glyph);
      item.style.setProperty("--bless", icon.color);
      item.title = `${icon.name} — ${icon.detail}`;
      item.setAttribute("aria-label", `${icon.name}: ${icon.detail}`);
      blessBar.append(item);
    }

    message.textContent = model.message ?? "";
    message.classList.toggle("demo__message--visible", Boolean(model.message));
    card.replaceChildren();
    card.classList.toggle("demo__card--visible", Boolean(model.card));

    if (model.card) {
      const glyph = element("span", "demo__cardglyph", model.card.glyph);
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      glyph.style.setProperty("--bless", model.card.color);
      title.textContent = model.card.name;
      detail.textContent = model.card.detail;
      card.append(glyph, title, detail);
    }

    overlayButton.hidden = model.overlay === undefined;

    if (model.overlay) {
      overlayTitle.textContent = model.overlay.title;
      overlayBody.textContent = model.overlay.body;
    }

    drawMinimap(minimapContext, model.minimap);
  };

  return { element: root, overlayButton, update };
}
