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

/**
 * One of a floor's four demands, as a line to read rather than a sentence to remember.
 *
 * The floor used to announce its list once, on the step the player arrived on, and then never again —
 * so a task was something you had heard about, not something you could check. Every counter behind
 * these was already being kept; the only thing missing was somewhere to put it.
 */
export type DemoHudTask = Readonly<{
  done: number;
  label: string;
  /** The one that opens the way down. Drawn apart from the three that pay a blessing. */
  main: boolean;
  met: boolean;
  target: number;
}>;

/**
 * The run's own numbers: what it costs to still be down here.
 *
 * Moved out of the canvas pass and into the panel, because the level, the clock and the floor are one
 * readout with the task list underneath and were competing with it for the same corner.
 */
export type DemoHudRun = Readonly<{
  clock: string;
  core?: Readonly<{ color: string; text: string }>;
  depth: number;
  level: number;
  /** True for a few seconds after the level moves, which is what makes the rise noticeable. */
  rising: boolean;
}>;

/** What walking out right now would be worth. */
export type DemoHudHaul = Readonly<{
  banked: number;
  blessings: number;
  kills: number;
  sealed: number;
}>;

/**
 * What the pad under the player's feet is doing, while it is doing it.
 *
 * One element for all three pads. A five-second hold told through the message line spent those five
 * seconds overwriting every other thing the floor had to say, and said it as prose — so the countdown
 * was a number you read rather than a bar you watched.
 */
export type DemoHudChannel = Readonly<{
  detail: string;
  label: string;
  /** Seconds left, already formatted. Omitted by a pad that pays continuously rather than on a timer. */
  remaining?: string;
  /** How much of the hold is done, from nothing to all of it. */
  share: number;
  tone: "bless" | "extract" | "spring";
}>;

export type DemoHudOverlayReward = Readonly<{
  color: string;
  detail: string;
  glyph: string;
  name: string;
}>;

/**
 * The full-surface screen: the two pauses, and the two ways a run ends.
 *
 * `body` is for the pauses, which are prose. An ending is a result, so it arrives as its parts — the
 * run's numbers and one row per thing the seals opened — and the screen lays them out.
 */
export type DemoHudOverlay = Readonly<{
  body?: string;
  footer?: string;
  rewards?: readonly DemoHudOverlayReward[];
  rewardsTitle?: string;
  stats?: readonly Readonly<{ label: string; value: string }>[];
  title: string;
  tone?: "lost" | "out";
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
  channel?: DemoHudChannel;
  haul: DemoHudHaul;
  held?: DemoHudHeld;
  hp: number;
  maxHp: number;
  message?: string;
  minimap: DemoHudMinimap;
  overlay?: DemoHudOverlay;
  run: DemoHudRun;
  tasks: readonly DemoHudTask[];
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

/** One task line: what it is, how far along, and whether it is done with. */
function taskRow(task: DemoHudTask): HTMLLIElement {
  const row = element("li", "demo__task");
  const mark = element("span", "demo__taskmark", task.met ? "✓" : task.main ? "▸" : "·");
  const label = element("span", "demo__tasklabel", task.label);
  const count = element("span", "demo__taskcount", `${Math.min(task.done, task.target)}/${task.target}`);
  const track = element("span", "demo__tasktrack");
  const fill = document.createElement("i");
  fill.style.width = `${Math.min(1, task.target > 0 ? task.done / task.target : 1) * 100}%`;
  track.append(fill);
  row.dataset.met = String(task.met);
  row.dataset.main = String(task.main);
  row.append(mark, label, count, track);
  return row;
}

/**
 * Mounts the complete DOM HUD; callers provide only immutable display data.
 *
 * Three corners are spoken for. Top left is the run: its level, its clock, what the floor is asking
 * for, and what walking out now would be worth. Top right is the map. The player's own state sits
 * bottom-centre, in the gap between the two things `demo-viewmodel` paints: the carried object goes
 * into the bottom left at roughly a fifth across, and the sword arm swings up the right. The middle
 * of the floor is the one part of the lower frame nothing occupies, which is why a full-width bar
 * cannot go there and a narrow cluster can.
 */
export function mountDemoHud(): MountedDemoHud {
  const root = element("div", "demo-hud");
  const run = element("section", "demo__run");
  const runLevel = element("strong", "demo__runlevel");
  const runClock = element("span", "demo__runclock");
  const runCore = element("span", "demo__runcore");
  const taskList = element("ul", "demo__tasks");
  const haul = element("div", "demo__haul");
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
  const channel = element("div", "demo__channel");
  const channelLabel = element("strong", "demo__channel-label");
  const channelRemaining = element("span", "demo__channel-remaining");
  const channelDetail = element("span", "demo__channel-detail");
  const channelTrack = element("span", "demo__channel-track");
  const channelFill = document.createElement("i");
  const message = element("p", "demo__message");
  const card = element("aside", "demo__card");
  const overlayButton = element("button", "demo__overlay");
  const overlayPanel = element("span", "demo__overlay-panel");
  const overlayTitle = element("strong", "demo__overlay-title");
  const overlayBody = element("span", "demo__overlay-body");
  const overlayStats = element("span", "demo__overlay-stats");
  const overlayRewardsTitle = element("span", "demo__overlay-rewardstitle");
  const overlayRewards = element("span", "demo__overlay-rewards");
  const overlayFooter = element("span", "demo__overlay-footer");
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
  channelTrack.append(channelFill);
  channel.append(channelLabel, channelRemaining, channelTrack, channelDetail);
  overlayPanel.append(overlayTitle, overlayBody, overlayStats, overlayRewardsTitle, overlayRewards, overlayFooter);
  overlayButton.append(overlayPanel);
  health.append(healthFill);
  run.append(element("h3", "demo__slottitle", "Run"), runLevel, runClock, runCore, taskList, haul);
  heldSlot.append(element("h3", "demo__slottitle", "Held"), heldGlyph, heldName, heldCount);
  blessSlot.append(element("h3", "demo__slottitle", "Bless"), blessBar);
  healthSlot.append(hp, health);
  status.append(heldSlot, blessSlot, healthSlot);
  root.append(run, status, minimap, crosshair, channel, message, card, overlayButton);

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

    run.dataset.rising = String(model.run.rising);
    runLevel.replaceChildren(`LV ${model.run.level}`);
    runClock.textContent = `${model.run.clock} · B${model.run.depth}`;
    runCore.textContent = model.run.core?.text ?? "";
    runCore.hidden = model.run.core === undefined;
    runCore.style.setProperty("--core", model.run.core?.color ?? "#cdb69c");
    taskList.replaceChildren(...model.tasks.map((task) => taskRow(task)));
    haul.replaceChildren(
      element("span", "demo__haulitem", `◈ ${model.haul.sealed} sealed`),
      element("span", "demo__haulitem", `✦ ${model.haul.blessings} bless`),
      element("span", "demo__haulitem", `☠ ${model.haul.kills}`),
      element("span", "demo__haulitem demo__haulitem--banked", `▤ ${model.haul.banked} banked`),
    );

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

    channel.hidden = model.channel === undefined;

    if (model.channel) {
      channel.dataset.tone = model.channel.tone;
      channelLabel.textContent = model.channel.label;
      channelDetail.textContent = model.channel.detail;
      channelRemaining.textContent = model.channel.remaining ?? "";
      channelRemaining.hidden = model.channel.remaining === undefined;
      channelFill.style.width = `${Math.max(0, Math.min(1, model.channel.share)) * 100}%`;
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
      const overlay = model.overlay;
      overlayButton.dataset.tone = overlay.tone ?? "none";
      overlayTitle.textContent = overlay.title;
      overlayBody.textContent = overlay.body ?? "";
      overlayBody.hidden = overlay.body === undefined;
      overlayStats.replaceChildren(
        ...(overlay.stats ?? []).map((stat) => {
          const cell = element("span", "demo__overlay-stat");
          cell.append(element("small", "", stat.label), element("strong", "", stat.value));
          return cell;
        }),
      );
      overlayStats.hidden = (overlay.stats ?? []).length === 0;
      overlayRewardsTitle.textContent = overlay.rewardsTitle ?? "";
      overlayRewardsTitle.hidden = overlay.rewardsTitle === undefined;
      overlayRewards.replaceChildren(
        ...(overlay.rewards ?? []).map((reward) => {
          const row = element("span", "demo__overlay-reward");
          const glyph = element("span", "demo__overlay-rewardglyph", reward.glyph);
          glyph.style.setProperty("--bless", reward.color);
          row.append(glyph, element("strong", "", reward.name), element("small", "", reward.detail));
          return row;
        }),
      );
      overlayRewards.hidden = (overlay.rewards ?? []).length === 0;
      overlayFooter.textContent = overlay.footer ?? "";
      overlayFooter.hidden = overlay.footer === undefined;
    }

    drawMinimap(minimapContext, model.minimap);
  };

  return { element: root, overlayButton, update };
}
