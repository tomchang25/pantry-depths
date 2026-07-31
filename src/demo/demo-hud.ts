import { createHudIcon, type HudIconId } from "@/demo/hud-icons";

import "@/demo/demo.css";

/**
 * One mark in the play-time bar: only what the run is actually carrying.
 *
 * The bar used to be sent the whole catalogue and draw the unheld ones as empty slots. Two screens
 * now say what is missing — the pause roster in full sentences — and a strip of grey placeholders
 * mid-fight was answering a question nobody asks while something is swinging at them.
 */
export type DemoHudBlessIcon = Readonly<{
  color: string;
  detail: string;
  icon: HudIconId;
  name: string;
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
  icon: HudIconId;
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
  detail: string;
  done: number;
  glyph: string;
  label: string;
  /** The one that opens the way down. Drawn apart from the three that pay a blessing. */
  main: boolean;
  met: boolean;
  reward: string;
  target: number;
}>;

export type DemoHudObjective = Readonly<{
  detail: string;
  done: number;
  glyph: string;
  label: string;
  reward: string;
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
  icon: HudIconId;
  name: string;
}>;

/**
 * One line of the pause screen's roster: a blessing the run is carrying, and what it does.
 *
 * Its own type rather than the bless bar's `DemoHudBlessIcon`, which is a mark in a strip and carries
 * its description only as a hover title — a thing the run's locked pointer means nobody has ever read.
 * Sharing one row between the two would make the bar carry fields it has no room to draw.
 */
export type DemoHudOverlayRosterEntry = Readonly<{
  color: string;
  /** How many awards the total above is, for a tier that repeats. Omitted by one that does not. */
  count?: string;
  detail: string;
  icon: HudIconId;
  name: string;
  /**
   * What this one has actually added, in its own unit, already formatted.
   *
   * A string rather than a number and a unit: what an axis is measured in belongs to the catalogue
   * that owns the axis, and the HUD is a renderer of display data that does no arithmetic.
   */
  total?: string;
}>;

/**
 * The full-surface screen: the two pauses, and the two ways a run ends.
 *
 * `body` is for the pauses, which are prose. An ending is a result, so it arrives as its parts — the
 * run's numbers and one row per thing the seals opened — and the screen lays them out. A pause now
 * arrives as parts too: `roster` is the blessing list, which is the one readout with nowhere else to be.
 */
export type DemoHudOverlay = Readonly<{
  action?: string;
  /**
   * Which of the three screens this is.
   *
   * They want different widths — an ending is a sheet of numbers, a pause is a small fixed card with
   * the roster hung beside it — and the alternative is styling off whichever field happens to be
   * absent, which breaks the moment a screen gains a part it did not have.
   */
  kind: "ended" | "paused" | "title";
  body?: string;
  controls?: readonly Readonly<{ key: string; label: string }>[];
  eyebrow?: string;
  footer?: string;
  objective?: string;
  rewards?: readonly DemoHudOverlayReward[];
  rewardsTitle?: string;
  roster?: readonly DemoHudOverlayRosterEntry[];
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
  objective?: DemoHudObjective;
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
  const glyph = element("span", "demo__taskglyph", task.met ? "✓" : task.glyph);
  const mark = element("span", "demo__taskmark", task.met ? "✓ Complete" : task.main ? "Required" : "Optional");
  const kind = element("span", "demo__taskkind", task.main ? "Main objective" : "Bonus");
  const label = element("span", "demo__tasklabel", task.label);
  const count = element("span", "demo__taskcount", `${Math.min(task.done, task.target)}/${task.target}`);
  const detail = element("span", "demo__taskdetail", task.detail);
  const reward = element("span", "demo__taskreward", task.reward);
  const track = element("span", "demo__tasktrack");
  const fill = document.createElement("i");
  fill.style.width = `${Math.min(1, task.target > 0 ? task.done / task.target : 1) * 100}%`;
  track.append(fill);
  row.dataset.met = String(task.met);
  row.dataset.main = String(task.main);
  row.setAttribute(
    "aria-label",
    `${task.main ? "Main objective" : "Bonus objective"}: ${task.label}. ${task.detail}. ${Math.min(task.done, task.target)} of ${task.target}. ${task.met ? "Complete" : task.reward}`,
  );
  row.append(glyph, kind, mark, label, count, detail, reward, track);
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
  const runHeading = element("div", "demo__runheading");
  const runTitle = element("h3", "demo__slottitle", "Floor contract");
  const runDepth = element("strong", "demo__rundepth");
  const runMeta = element("div", "demo__runmeta");
  const runLevel = element("strong", "demo__runlevel");
  const runClock = element("span", "demo__runclock");
  const runCore = element("span", "demo__runcore");
  const mainTaskList = element("ul", "demo__tasks demo__tasks--main");
  const bonusHeading = element("div", "demo__bonusheading");
  const bonusTaskList = element("ul", "demo__tasks demo__tasks--bonus");
  const haul = element("div", "demo__haul");
  const status = element("section", "demo__status");
  const heldSlot = element("div", "demo__slot demo__slot--held");
  const blessSlot = element("div", "demo__slot demo__slot--bless");
  const healthSlot = element("div", "demo__slot demo__slot--health");
  const blessBar = element("div", "demo__blessbar");
  const heldGlyph = element("span", "demo__held-glyph");
  const heldName = element("span", "demo__held-name");
  const heldCount = element("span", "demo__held-count");
  const hpLabel = element("span", "demo__hplabel", "HP");
  const hp = element("span", "demo__hp");
  const healthState = element("span", "demo__health-state");
  const health = element("div", "demo__health");
  const healthFill = document.createElement("span");
  const minimapFrame = element("section", "demo__minimap-frame");
  const minimapTitle = element("h3", "demo__slottitle", "Floor map");
  const minimap = element("canvas", "demo__minimap");
  const minimapLegend = element("div", "demo__minimap-legend");
  const crosshair = element("div", "demo__crosshair");
  const channel = element("div", "demo__channel");
  const channelLabel = element("strong", "demo__channel-label");
  const channelRemaining = element("span", "demo__channel-remaining");
  const channelDetail = element("span", "demo__channel-detail");
  const channelTrack = element("span", "demo__channel-track");
  const channelFill = document.createElement("i");
  const message = element("p", "demo__message");
  const objective = element("aside", "demo__objective");
  const objectiveGlyph = element("span", "demo__objective-glyph");
  const objectiveEyebrow = element("span", "demo__objective-eyebrow", "New floor objective");
  const objectiveTitle = element("strong", "demo__objective-title");
  const objectiveCount = element("span", "demo__objective-count");
  const objectiveDetail = element("span", "demo__objective-detail");
  const objectiveTrack = element("span", "demo__objective-track");
  const objectiveFill = document.createElement("i");
  const objectiveReward = element("span", "demo__objective-reward");
  const card = element("aside", "demo__card");
  const overlayButton = element("button", "demo__overlay");
  const overlayPanel = element("span", "demo__overlay-panel");
  const overlayEyebrow = element("span", "demo__overlay-eyebrow");
  const overlayTitle = element("span", "demo__overlay-title");
  const overlayBody = element("span", "demo__overlay-body");
  const overlayObjective = element("span", "demo__overlay-objective");
  const overlayControls = element("span", "demo__overlay-controls");
  const overlayStats = element("span", "demo__overlay-stats");
  const overlayRewardsTitle = element("span", "demo__overlay-rewardstitle");
  const overlayRewards = element("span", "demo__overlay-rewards");
  const overlayFooter = element("span", "demo__overlay-footer");
  const overlayAction = element("span", "demo__overlay-action");
  // Beside the card rather than inside it. What the run is carrying is a readout of its own, like the
  // floor contract and the map are, and folding it into the card made the card a different size and
  // shape for every run — so the one thing a pause should be, a fixed place to stop, it was not.
  const overlayRosterPanel = element("span", "demo__overlay-rosterpanel");
  const overlayRosterTitle = element("span", "demo__overlay-rostertitle", "Blessings");
  const overlayRoster = element("span", "demo__overlay-roster");
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
  message.setAttribute("aria-atomic", "true");
  objective.setAttribute("role", "status");
  objective.setAttribute("aria-atomic", "true");
  runTitle.id = "demo-current-floor";
  run.setAttribute("aria-labelledby", runTitle.id);
  status.setAttribute("aria-label", "Player status");
  minimapTitle.id = "demo-floor-map";
  minimapFrame.setAttribute("aria-labelledby", minimapTitle.id);
  overlayButton.type = "button";
  channelTrack.append(channelFill);
  channel.append(channelLabel, channelRemaining, channelTrack, channelDetail);
  overlayPanel.append(
    overlayEyebrow,
    overlayTitle,
    overlayBody,
    overlayObjective,
    overlayControls,
    overlayStats,
    overlayRewardsTitle,
    overlayRewards,
    overlayFooter,
    overlayAction,
  );
  overlayRosterPanel.append(overlayRosterTitle, overlayRoster);
  overlayButton.append(overlayPanel, overlayRosterPanel);
  health.append(healthFill);
  runHeading.append(runTitle, runDepth);
  runMeta.append(runLevel, runClock);
  bonusHeading.append(
    element("span", "demo__bonusheading-title", "Bonus bounties"),
    element("span", "demo__bonusheading-reward", "+1 blessing each"),
  );
  run.append(runHeading, runMeta, runCore, mainTaskList, bonusHeading, bonusTaskList, haul);
  heldSlot.append(element("h3", "demo__slottitle", "Held"), heldGlyph, heldName, heldCount);
  blessSlot.append(element("h3", "demo__slottitle", "Bless"), blessBar);
  healthSlot.append(hpLabel, hp, healthState, health);
  status.append(heldSlot, blessSlot, healthSlot);
  minimapLegend.append(
    element("span", "demo__mapkey demo__mapkey--you", "You"),
    element("span", "demo__mapkey demo__mapkey--threat", "Threat"),
    element("span", "demo__mapkey demo__mapkey--loot", "Loot"),
    element("span", "demo__mapkey demo__mapkey--exit", "Stairs"),
  );
  minimapFrame.append(minimapTitle, minimap, minimapLegend);
  objectiveTrack.append(objectiveFill);
  objective.append(
    objectiveGlyph,
    objectiveEyebrow,
    objectiveTitle,
    objectiveCount,
    objectiveDetail,
    objectiveTrack,
    objectiveReward,
  );
  root.append(run, status, minimapFrame, crosshair, channel, message, objective, card, overlayButton);

  const update = (model: DemoHudModel): void => {
    const healthShare = model.maxHp > 0 ? Math.max(0, Math.min(1, model.hp / model.maxHp)) : 0;
    const healthTone = healthShare <= 0.25 ? "critical" : healthShare <= 0.5 ? "wounded" : "steady";
    healthFill.style.width = `${healthShare * 100}%`;
    status.dataset.health = healthTone;
    health.setAttribute("aria-valuemin", "0");
    health.setAttribute("aria-valuemax", String(model.maxHp));
    health.setAttribute("aria-valuenow", String(Math.max(0, model.hp)));
    // The bar says how much is left at a glance; the number says how many more hits that is. Depth,
    // enemy count, kills, walls broken, the altar and the wall ahead were all here once and were all
    // a number to read rather than a thing to look at. The frame counter is the dev overlay's.
    hp.replaceChildren(String(Math.ceil(Math.max(0, model.hp))), element("small", "", `/${model.maxHp}`));
    healthState.textContent = healthTone === "steady" ? "" : healthTone;
    healthState.hidden = healthTone === "steady";

    run.dataset.rising = String(model.run.rising);
    runDepth.textContent = `B${model.run.depth}`;
    runLevel.replaceChildren(`Threat ${model.run.level}`);
    runClock.textContent = `${model.run.clock} elapsed`;
    runCore.textContent = model.run.core?.text ?? "";
    runCore.hidden = model.run.core === undefined;
    runCore.style.setProperty("--core", model.run.core?.color ?? "#cdb69c");
    mainTaskList.replaceChildren(...model.tasks.filter((task) => task.main).map((task) => taskRow(task)));
    bonusTaskList.replaceChildren(...model.tasks.filter((task) => !task.main).map((task) => taskRow(task)));
    haul.replaceChildren(
      element("span", "demo__haullabel", "Run haul"),
      element("span", "demo__haulitem", `◈ ${model.haul.sealed} sealed`),
      element("span", "demo__haulitem demo__haulitem--banked", `▤ ${model.haul.banked} banked`),
    );

    blessBar.replaceChildren();

    for (const icon of model.blessIcons) {
      const item = element("span", "demo__blessicon");
      item.style.setProperty("--bless", icon.color);
      item.title = `${icon.name} — ${icon.detail}`;
      item.setAttribute("aria-label", `${icon.name}: ${icon.detail}`);
      item.append(createHudIcon(icon.icon));
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
    objective.hidden = model.objective === undefined;

    if (model.objective) {
      const objectiveModel = model.objective;
      const objectiveShare = Math.min(1, objectiveModel.target > 0 ? objectiveModel.done / objectiveModel.target : 1);
      objectiveGlyph.textContent = objectiveModel.glyph;
      objectiveTitle.textContent = objectiveModel.label;
      objectiveCount.textContent = `${Math.min(objectiveModel.done, objectiveModel.target)} / ${objectiveModel.target}`;
      objectiveDetail.textContent = objectiveModel.detail;
      objectiveFill.style.width = `${objectiveShare * 100}%`;
      objectiveReward.textContent = objectiveModel.reward;
    }

    card.replaceChildren();
    card.classList.toggle("demo__card--visible", Boolean(model.card));

    if (model.card) {
      const glyph = element("span", "demo__cardglyph");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      glyph.style.setProperty("--bless", model.card.color);
      glyph.append(createHudIcon(model.card.icon));
      title.textContent = model.card.name;
      detail.textContent = model.card.detail;
      card.append(glyph, title, detail);
    }

    overlayButton.hidden = model.overlay === undefined;

    if (model.overlay) {
      const overlay = model.overlay;
      overlayButton.dataset.kind = overlay.kind;
      overlayButton.dataset.tone = overlay.tone ?? "none";
      overlayButton.setAttribute("aria-label", `${overlay.title}. ${overlay.action ?? "Continue"}`);
      overlayEyebrow.textContent = overlay.eyebrow ?? "";
      overlayEyebrow.hidden = overlay.eyebrow === undefined;
      overlayTitle.textContent = overlay.title;
      overlayBody.textContent = overlay.body ?? "";
      overlayBody.hidden = overlay.body === undefined;
      overlayObjective.textContent = overlay.objective ?? "";
      overlayObjective.hidden = overlay.objective === undefined;
      // The name and what it has given share the top line; the sentence gets the panel's full width
      // underneath. In a column this narrow a third column of text would leave the descriptions four
      // words wide, and the description is what the screen exists to show.
      overlayRoster.replaceChildren(
        ...(overlay.roster ?? []).map((entry) => {
          const row = element("span", "demo__overlay-rosterrow");
          const glyph = element("span", "demo__overlay-rosterglyph");
          const amount = element("span", "demo__overlay-rosteramount");
          glyph.append(createHudIcon(entry.icon));
          row.style.setProperty("--bless", entry.color);
          amount.hidden = entry.total === undefined;

          if (entry.total !== undefined) {
            amount.append(element("strong", "demo__overlay-rostertotal", entry.total));

            if (entry.count !== undefined) {
              amount.append(element("small", "demo__overlay-rostercount", entry.count));
            }
          }

          row.append(
            glyph,
            element("strong", "demo__overlay-rostername", entry.name),
            amount,
            element("small", "demo__overlay-rosterdetail", entry.detail),
          );
          return row;
        }),
      );
      overlayRosterPanel.hidden = (overlay.roster ?? []).length === 0;
      overlayControls.replaceChildren(
        ...(overlay.controls ?? []).map((control) => {
          const item = element("span", "demo__overlay-control");
          item.append(element("kbd", "", control.key), element("span", "", control.label));
          return item;
        }),
      );
      overlayControls.hidden = (overlay.controls ?? []).length === 0;
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
          const glyph = element("span", "demo__overlay-rewardglyph");
          glyph.style.setProperty("--bless", reward.color);
          glyph.append(createHudIcon(reward.icon));
          row.append(glyph, element("strong", "", reward.name), element("small", "", reward.detail));
          return row;
        }),
      );
      overlayRewards.hidden = (overlay.rewards ?? []).length === 0;
      overlayFooter.textContent = overlay.footer ?? "";
      overlayFooter.hidden = overlay.footer === undefined;
      overlayAction.textContent = overlay.action ?? "";
      overlayAction.hidden = overlay.action === undefined;
    }

    drawMinimap(minimapContext, model.minimap);
  };

  return { element: root, overlayButton, update };
}
