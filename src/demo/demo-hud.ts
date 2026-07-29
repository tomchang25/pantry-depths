import "@/demo/demo.css";

export type DemoHudBlessIcon = Readonly<{
  color: string;
  detail: string;
  glyph: string;
  name: string;
  /**
   * Whether the run has this one yet.
   *
   * The whole roster is sent, not only what is owned. A blessing you do not have is worth a slot: the
   * empty ones are what tell you there is something left to go and get, and the row keeps its shape
   * as they fill in rather than growing a chip at a time.
   */
  owned: boolean;
}>;

/**
 * What is in the left hand, and how many are left of it.
 *
 * Structured rather than a formatted line, because the picture of the thing is already on screen —
 * `demo-viewmodel` paints the carried object down in the corner. What the bar adds is which one it is
 * and the count that decides whether to throw the next one.
 */
export type DemoHudHeld = Readonly<{
  color: string;
  count?: number;
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
  blessIcons: readonly DemoHudBlessIcon[];
  card?: DemoHudCard;
  held?: DemoHudHeld;
  hp: number;
  maxHp: number;
  message?: string;
  minimap: DemoHudMinimap;
  overlay?: Readonly<{ body: string; title: string }>;
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

/**
 * Mounts the complete DOM HUD; callers provide only immutable display data.
 *
 * The player's own state sits bottom-centre, in the gap between the two things `demo-viewmodel`
 * paints: the carried object goes into the bottom left at roughly a fifth across, and the sword arm
 * swings up the right. The middle of the floor is the one part of the lower frame nothing occupies,
 * which is why a full-width bar cannot go there and a narrow cluster can.
 */
export function mountDemoHud(): MountedDemoHud {
  const root = element("div", "demo-hud");
  const status = element("section", "demo__status");
  const heldSlot = element("div", "demo__slot demo__slot--held");
  const blessSlot = element("div", "demo__slot demo__slot--bless");
  const healthSlot = element("div", "demo__slot demo__slot--health");
  const blessBar = element("div", "demo__blessbar");
  const heldGlyph = element("span", "demo__held-glyph");
  const heldName = element("span", "demo__held-name");
  const heldCount = element("span", "demo__held-count");
  const hp = element("span", "demo__hp");
  const health = element("div", "demo__health");
  const healthFill = document.createElement("span");
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
  health.setAttribute("role", "progressbar");
  health.setAttribute("aria-label", "Health");
  message.setAttribute("role", "status");
  overlayButton.type = "button";
  overlayButton.append(overlayTitle, overlayBody);
  health.append(healthFill);
  heldSlot.append(element("h3", "demo__slottitle", "Held"), heldGlyph, heldName, heldCount);
  blessSlot.append(element("h3", "demo__slottitle", "Bless"), blessBar);
  healthSlot.append(hp, health);
  status.append(heldSlot, blessSlot, healthSlot);
  root.append(status, minimap, crosshair, message, card, overlayButton);

  const update = (model: DemoHudModel): void => {
    const healthShare = model.maxHp > 0 ? Math.max(0, Math.min(1, model.hp / model.maxHp)) : 0;
    healthFill.style.width = `${healthShare * 100}%`;
    health.setAttribute("aria-valuemin", "0");
    health.setAttribute("aria-valuemax", String(model.maxHp));
    health.setAttribute("aria-valuenow", String(Math.max(0, model.hp)));
    // The bar says how much is left at a glance; the number says how many more hits that is. Depth,
    // enemy count, kills, walls broken, the altar and the wall ahead were all here once and were all
    // a number to read rather than a thing to look at. The frame counter is the dev overlay's.
    hp.replaceChildren(String(Math.ceil(Math.max(0, model.hp))), element("small", "", `/${model.maxHp}`));
    blessBar.replaceChildren();

    for (const icon of model.blessIcons) {
      const item = element("span", "demo__blessicon", icon.glyph);
      item.style.setProperty("--bless", icon.color);
      item.dataset.owned = String(icon.owned);
      item.title = `${icon.name} — ${icon.detail}`;
      item.setAttribute("aria-label", `${icon.name}: ${icon.detail}${icon.owned ? "" : " (not taken)"}`);
      blessBar.append(item);
    }

    // Empty-handed is a state the slot shows rather than a reason to collapse it. The cluster has to
    // be the same shape whatever is in it, or picking something up looks like the layout breaking.
    heldSlot.dataset.empty = String(model.held === undefined);
    heldGlyph.style.setProperty("--held", model.held?.color ?? "#8a7a86");
    heldGlyph.textContent = model.held?.glyph ?? "·";
    heldName.textContent = model.held?.name ?? "Empty-handed";
    heldCount.textContent = model.held?.count === undefined ? "" : `×${model.held.count}`;

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
