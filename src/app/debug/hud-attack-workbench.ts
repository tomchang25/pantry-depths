import { loadCanonical, saveCanonical } from "@/app/debug/authoring-client";
import { createCarriedWorkbench } from "@/app/debug/carried-workbench";
import { createDebugPage, createDebugPanel } from "@/app/debug/debug-shell";
import { createRenderPanel } from "@/app/debug/render-panel";
import { parseMeleeAttacks } from "@/content/viewmodel/melee-attack-schema";
import {
  MELEE_ATTACKS,
  type MeleeAttackDefinition,
  type MeleeViewmodelPose,
} from "@/content/viewmodel/melee-viewmodel";
import { MELEE_CUT_START, MELEE_SWING_SECONDS, type MeleeAttackId } from "@/core/melee-contract";
import { MELEE_HALF_ANGLE } from "@/core/actions";
import { mountDemoDevOverlay, type DemoDevOverlayModel } from "@/demo/demo-dev-overlay";
import { mountDemoHud, type DemoHudModel, type DemoHudOverlayRosterEntry } from "@/demo/demo-hud";
import { demoMeleeImpactPitch } from "@/demo/demo-scene";
import { drawDemoViewmodel, type DemoViewmodelModel } from "@/demo/demo-viewmodel";
import type { CameraPose, RenderBeam, RenderBox, RenderScene, RenderSurface } from "@/presentation/render-scene";

type WorkbenchTab = "hud" | "attack" | "carried";
type PoseName = "windup" | "follow";

const ROOM_SIZE = 9;
const CAMERA: CameraPose = { x: 4.5, y: 7.1, angle: -Math.PI / 2 };
const TARGET_OFFSETS = [-1.08, -0.7, 0, 0.7, 1.08] as const;

function roomSurfaces(): RenderSurface[] {
  const surfaces: RenderSurface[] = [];

  for (let index = 0; index < ROOM_SIZE; index += 1) {
    surfaces.push({ cell: { x: index, y: 0 }, material: "demoFoundation", height: 2.4 });
    surfaces.push({ cell: { x: index, y: ROOM_SIZE - 1 }, material: "demoFoundation", height: 2.4 });

    if (index > 0 && index < ROOM_SIZE - 1) {
      surfaces.push({ cell: { x: 0, y: index }, material: "demoFoundation", height: 2.4 });
      surfaces.push({ cell: { x: ROOM_SIZE - 1, y: index }, material: "demoFoundation", height: 2.4 });
    }
  }

  return surfaces;
}

const ROOM_SURFACES = roomSurfaces();
const ROOM_TILES = Array.from({ length: ROOM_SIZE }, (_row, y) =>
  Array.from({ length: ROOM_SIZE }, (_column, x) =>
    x === 0 || y === 0 || x === ROOM_SIZE - 1 || y === ROOM_SIZE - 1 ? "#" : ".",
  ).join(""),
);

function targetPoint(offset: number): Readonly<{ x: number; y: number }> {
  const angle = CAMERA.angle + offset;
  return { x: CAMERA.x + Math.cos(angle) * 1.7, y: CAMERA.y + Math.sin(angle) * 1.7 };
}

function targetBoxes(selectedTarget: number): RenderBox[] {
  return TARGET_OFFSETS.map((offset, index) => {
    const point = targetPoint(offset);
    const connected = Math.abs(offset) <= MELEE_HALF_ANGLE;
    return {
      id: `attack-target-${index}`,
      x: point.x,
      y: point.y,
      halfX: index === selectedTarget ? 0.17 : 0.13,
      halfY: index === selectedTarget ? 0.17 : 0.13,
      bottom: 0,
      top: 0.9,
      color: connected ? ([74, 189, 116] as const) : ([181, 66, 82] as const),
      ...(index === selectedTarget ? { topColor: [255, 216, 104] as const } : {}),
    };
  });
}

function attackArc(): RenderBeam[] {
  const beams: RenderBeam[] = [];
  const segments = 14;

  for (let index = 0; index < segments; index += 1) {
    const fromAngle = CAMERA.angle - MELEE_HALF_ANGLE + (MELEE_HALF_ANGLE * 2 * index) / segments;
    const toAngle = CAMERA.angle - MELEE_HALF_ANGLE + (MELEE_HALF_ANGLE * 2 * (index + 1)) / segments;
    beams.push({
      id: `attack-arc-${index}`,
      from: { x: CAMERA.x + Math.cos(fromAngle) * 1.45, y: CAMERA.y + Math.sin(fromAngle) * 1.45, z: 0.035 },
      to: { x: CAMERA.x + Math.cos(toAngle) * 1.45, y: CAMERA.y + Math.sin(toAngle) * 1.45, z: 0.035 },
      width: 0.025,
      color: [245, 196, 81],
    });
  }

  return beams;
}

function roomScene(
  camera: CameraPose,
  boxes: readonly RenderBox[] = [],
  beams: readonly RenderBeam[] = [],
): RenderScene {
  return {
    floorId: "hud-attack-workbench",
    theme: "demo",
    width: ROOM_SIZE,
    height: ROOM_SIZE,
    tiles: ROOM_TILES,
    camera,
    surfaces: ROOM_SURFACES,
    boxes,
    beams,
    sprites: [],
    lights: [{ id: "workbench-light", x: 4.5, y: 5.1, radius: 5, color: [255, 169, 93], intensity: 0.88 }],
    emitters: [],
    ambient: [0.18, 0.15, 0.24],
    wallHeight: 2.4,
    eyeHeight: 0.5,
  };
}

function defaultHudModel(): DemoHudModel {
  const tiles = Array.from({ length: 12 * 12 }, (_value, index) => {
    const x = index % 12;
    const y = Math.floor(index / 12);
    return x === 0 || y === 0 || x === 11 || y === 11 ? "border" : index % 17 === 0 ? "water" : "open";
  });

  return {
    blessIcons: [
      { color: "#e8a24c", detail: "A sample held blessing", icon: "heavyStrike", name: "Heavy Strike" },
      { color: "#8fd4f0", detail: "A second mark for contrast", icon: "stormStone", name: "Storm Stone" },
      { color: "#f0f0d0", detail: "Extra max HP", icon: "vitality", name: "Vitality" },
    ],
    held: { color: "#c9c2b4", count: 3, glyph: "●", name: "Rocks" },
    card: { color: "#e8a24c", detail: "Live card layout preview", icon: "heavyStrike", name: "Heavy Strike" },
    channel: {
      detail: "Stay on the dais 5s · being hit does not break it, stepping off does",
      label: "Claiming a blessing",
      remaining: "2.4s",
      share: 0.52,
      tone: "bless",
    },
    haul: { banked: 2, blessings: 2, kills: 31, sealed: 1 },
    hp: 72,
    maxHp: 100,
    message: "The pantry answers from below.",
    run: {
      clock: "4:12",
      core: { color: "#9fe0d0", text: "Cleaver · DMG +3 HP +10" },
      depth: 2,
      level: 14,
      rising: false,
    },
    tasks: [
      {
        detail: "Bring down any enemy on this floor",
        done: 13,
        glyph: "☠",
        label: "Defeat enemies",
        main: true,
        met: false,
        reward: "Opens stairs · +1 sealed reward",
        target: 20,
      },
      {
        detail: "Strike stone or timber until it gives way",
        done: 12,
        glyph: "▦",
        label: "Break walls",
        main: false,
        met: true,
        reward: "+1 blessing",
        target: 12,
      },
      {
        detail: "Cross into rooms branching off the main floor",
        done: 2,
        glyph: "◇",
        label: "Explore side rooms",
        main: false,
        met: false,
        reward: "+1 blessing",
        target: 4,
      },
      {
        detail: "Throw 3 bodies into one water cell",
        done: 0,
        glyph: "≈",
        label: "Fill a pool",
        main: false,
        met: false,
        reward: "+1 blessing",
        target: 1,
      },
    ],
    minimap: {
      facingAngle: -Math.PI / 2,
      height: 12,
      player: { x: 6, y: 8, radius: 3, color: "#ffe6b0" },
      points: [
        { x: 6, y: 3, radius: 3, color: "#7fd8a2" },
        { x: 4, y: 5, radius: 2.5, color: "#e2585f" },
        { x: 8, y: 6, radius: 2.5, color: "#5aa8e0" },
      ],
      tileColors: { border: "#0b0710", water: "#1c3f5e", open: "#241a2e" },
      tiles,
      width: 12,
    },
  };
}

/**
 * A hand-written stand-in for the run's blessing roster, at the length the real one can reach.
 *
 * Hand-written rather than read from the catalogue, like every other field in `defaultHudModel`: this
 * tab exists to judge the picture, and a preview wired to live content changes shape whenever the
 * content does. Nine rows because nine is what a run holding everything carries, and the density of
 * nine is the whole thing being looked at.
 */
const PREVIEW_ROSTER: readonly DemoHudOverlayRosterEntry[] = [
  {
    color: "#e8a24c",
    detail: "Far more melee reach and damage, and every hit knocks back",
    icon: "heavyStrike",
    name: "Heavy Strike",
  },
  {
    color: "#e2585f",
    detail: "A thrown enemy detonates on impact: double damage, wider reach, and knockback",
    icon: "explosiveBody",
    name: "Explosive Body",
  },
  {
    color: "#8fd4f0",
    detail: "A landed rock arcs lightning, which may keep chaining outward",
    icon: "stormStone",
    name: "Storm Stone",
  },
  { color: "#7fd8a2", detail: "Every kill heals you", icon: "lifesteal", name: "Bloodthirst" },
  {
    color: "#c79ae8",
    detail:
      "While you hold an enemy it takes the damage coming at your front; when it dies you are left holding ammunition",
    icon: "hostageGuard",
    name: "Hostage Guard",
  },
  {
    color: "#f0e0a0",
    count: "×2",
    detail: "More maximum health, and the difference healed on the spot",
    icon: "vigour",
    name: "Vigour",
    total: "+50 max HP",
  },
  {
    color: "#e8875c",
    count: "×3",
    detail: "Every swing lands harder, and so does everything you throw",
    icon: "brutality",
    name: "Brutality",
    total: "+18 damage",
  },
  {
    color: "#9fe0d0",
    count: "×1",
    detail: "You cross a floor faster",
    icon: "swiftness",
    name: "Swiftness",
    total: "+0.30 speed",
  },
  {
    color: "#c0c8e8",
    count: "×4",
    detail: "You strike from further out",
    icon: "longReach",
    name: "Long Reach",
    total: "+0.60 reach",
  },
] as const;

type RosterPreview = "off" | "empty" | "partial" | "full";

/**
 * Which rows a run in each state is carrying.
 *
 * The screen lists only what is held, so these are the rows that exist rather than the ones that are
 * lit. The partial state deliberately spans both tiers and skips rows inside each: a run in progress
 * is never the first few of a catalogue, and the layout has to hold with the order broken up.
 */
const ROSTER_PREVIEW_HELD: Readonly<Record<Exclude<RosterPreview, "off">, readonly number[]>> = {
  empty: [],
  partial: [0, 2, 3, 6],
  full: PREVIEW_ROSTER.map((_entry, index) => index),
};

function previewPauseOverlay(state: Exclude<RosterPreview, "off">): NonNullable<DemoHudModel["overlay"]> {
  const held = ROSTER_PREVIEW_HELD[state];
  return {
    action: "Press Tab to resume",
    controls: [
      { key: "ESC", label: "Release mouse" },
      { key: "R", label: "Restart run" },
    ],
    eyebrow: "The depths are waiting",
    kind: "paused",
    roster: PREVIEW_ROSTER.filter((_entry, index) => held.includes(index)),
    title: "Paused",
  };
}

function field(label: string, input: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "debug-field";
  wrapper.append(label, input);
  return wrapper;
}

function numberInput(value: number, step = 1): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.step = String(step);
  return input;
}

function textInput(value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  return input;
}

function cloneAttacks(): MeleeAttackDefinition[] {
  return MELEE_ATTACKS.map((attack) => ({
    ...attack,
    windup: { ...attack.windup },
    follow: { ...attack.follow },
  }));
}

function poseInput(label: string, value: number, onInput: (value: number) => void, step = 0.01): HTMLLabelElement {
  const input = numberInput(value, step);
  input.addEventListener("input", () => onInput(Number(input.value)));
  return field(label, input);
}

/** Renders the pure HUD model and the authored melee geometry against real renderer panels. */
export function renderHudAttackWorkbench(mount: HTMLElement): void {
  const { page, content } = createDebugPage({
    title: "HUD Workbench",
    description:
      "Everything drawn over the world rather than in it: the HUD, the eight first-person attacks, and whatever the other hand is carrying — all against the same renderer and drawing seams the demo uses.",
    width: "wide",
  });
  const tabs = document.createElement("div");
  const hudTab = document.createElement("button");
  const attackTab = document.createElement("button");
  const carriedTab = document.createElement("button");
  const hudSection = document.createElement("div");
  const attackSection = document.createElement("div");
  const carriedSection = document.createElement("div");
  tabs.className = "workbench-tabs";
  tabs.setAttribute("role", "tablist");
  hudTab.type = "button";
  hudTab.textContent = "HUD";
  hudTab.setAttribute("role", "tab");
  hudTab.setAttribute("aria-controls", "hud-workbench-tab");
  attackTab.type = "button";
  attackTab.textContent = "Attack";
  attackTab.setAttribute("role", "tab");
  attackTab.setAttribute("aria-controls", "attack-workbench-tab");
  hudSection.id = "hud-workbench-tab";
  hudSection.setAttribute("role", "tabpanel");
  carriedTab.type = "button";
  carriedTab.textContent = "Carried";
  carriedTab.setAttribute("role", "tab");
  carriedTab.setAttribute("aria-controls", "carried-workbench-tab");
  attackSection.id = "attack-workbench-tab";
  attackSection.setAttribute("role", "tabpanel");
  carriedSection.id = "carried-workbench-tab";
  carriedSection.setAttribute("role", "tabpanel");
  tabs.append(hudTab, attackTab, carriedTab);

  let activeTab: WorkbenchTab = "hud";
  const selectTab = (tab: WorkbenchTab): void => {
    activeTab = tab;
    hudTab.setAttribute("aria-selected", String(activeTab === "hud"));
    attackTab.setAttribute("aria-selected", String(activeTab === "attack"));
    carriedTab.setAttribute("aria-selected", String(activeTab === "carried"));
    hudSection.hidden = activeTab !== "hud";
    attackSection.hidden = activeTab !== "attack";
    carriedSection.hidden = activeTab !== "carried";
  };
  hudTab.addEventListener("click", () => selectTab("hud"));
  attackTab.addEventListener("click", () => selectTab("attack"));
  carriedTab.addEventListener("click", () => selectTab("carried"));

  let hudModel = defaultHudModel();
  const hudControls = createDebugPanel(
    "HUD model",
    "Every field updates immutable display data; no game world is required.",
  );
  const hudGrid = document.createElement("div");
  hudGrid.className = "debug-form-grid";
  const hud = mountDemoHud();
  // Every command is inert here, the toggle included. This tab previews the corner against the
  // picture behind it and owns no world, so there is nothing for a kill or a spawn to act on; and
  // the two switches are already driven by this panel's own checkboxes, which a live chip would
  // silently disagree with the moment either was used.
  const noop = (): void => {};
  const dev = mountDemoDevOverlay({
    toggleGodMode: noop,
    testArena: noop,
    killAll: noop,
    fillCrowd: noop,
    dropKit: noop,
    grantBless: noop,
    restageCast: noop,
  });
  const refreshHud = (): void => hud.update(hudModel);
  /**
   * The dev overlay is previewed beside the HUD, not inside its model.
   *
   * It is a separate module with a separate subject — what the machine is doing — and the only reason
   * it is on this tab at all is that its corner has to be checked against the picture behind it.
   */
  // No stage behind this preview, so no cast row: the panel draws the row only where restaging means
  // something, and this tab owns no world to restage.
  let devModel: DemoDevOverlayModel = { mindsFrozen: false, worldFrozen: false, fps: 60, godMode: false };
  const refreshDev = (): void => dev.update(devModel);

  for (const [label, key] of [
    ["HP", "hp"],
    ["Max HP", "maxHp"],
  ] as const) {
    const input = numberInput(hudModel[key]);
    input.addEventListener("input", () => {
      hudModel = Object.assign({}, hudModel, { [key]: Number(input.value) });
      refreshHud();
    });
    hudGrid.append(field(label, input));
  }

  /**
   * The left hand, driven by two fields.
   *
   * Clearing the name is how the cell goes empty-handed, and a count of zero is how it becomes a
   * carried body — the one thing held that has no number.
   */
  const heldName = textInput(hudModel.held?.name ?? "");
  const heldCount = numberInput(hudModel.held?.count ?? 3);
  const refreshHeld = (): void => {
    const { held: _held, ...withoutHeld } = hudModel;
    hudModel = heldName.value
      ? {
          ...withoutHeld,
          held: {
            color: "#c9c2b4",
            glyph: "●",
            name: heldName.value,
            ...(Number(heldCount.value) > 0 ? { count: Number(heldCount.value) } : {}),
          },
        }
      : withoutHeld;
    refreshHud();
  };

  for (const [label, input] of [
    ["Held name", heldName],
    ["Held count", heldCount],
  ] as const) {
    input.addEventListener("input", refreshHeld);
    hudGrid.append(field(label, input));
  }

  const message = textInput(hudModel.message ?? "");
  message.addEventListener("input", () => {
    hudModel = Object.assign({}, hudModel, { message: message.value || undefined });
    refreshHud();
  });
  hudGrid.append(field("Message", message));

  const showCard = document.createElement("input");
  showCard.type = "checkbox";
  showCard.checked = true;
  showCard.addEventListener("change", () => {
    const { card: _card, ...withoutCard } = hudModel;
    const previewCard = defaultHudModel().card;
    hudModel = showCard.checked && previewCard ? { ...withoutCard, card: previewCard } : withoutCard;
    refreshHud();
  });
  hudGrid.append(field("Show blessing card", showCard));

  // Off by default: the pause screen is a full-surface button, so leaving it up would cover the four
  // corners this tab exists to check against the picture behind them.
  const rosterPreview = document.createElement("select");

  for (const [value, label] of [
    ["off", "Off"],
    ["empty", "Paused · nothing taken"],
    ["partial", "Paused · four taken"],
    ["full", "Paused · all taken"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    rosterPreview.append(option);
  }

  rosterPreview.addEventListener("change", () => {
    const state = rosterPreview.value as RosterPreview;
    const { overlay: _overlay, ...withoutOverlay } = hudModel;
    hudModel = state === "off" ? withoutOverlay : { ...withoutOverlay, overlay: previewPauseOverlay(state) };
    refreshHud();
  });
  hudGrid.append(field("Pause screen", rosterPreview));

  const devFps = numberInput(devModel.fps);
  devFps.addEventListener("input", () => {
    devModel = { ...devModel, fps: Number(devFps.value) };
    refreshDev();
  });
  hudGrid.append(field("FPS", devFps));

  for (const [label, key] of [
    ["God mode", "godMode"],
    ["Mind freeze", "mindsFrozen"],
    ["World freeze", "worldFrozen"],
  ] as const) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      devModel = { ...devModel, [key]: input.checked };
      refreshDev();
    });
    hudGrid.append(field(label, input));
  }

  hudControls.body.append(hudGrid);
  const hudRender = createRenderPanel({
    ariaLabel: "HUD preview dungeon",
    frame: () => ({ scene: roomScene(CAMERA) }),
  });
  hudRender.element.append(hud.element, dev.element);
  hudSection.append(hudControls.panel, hudRender.element);

  let attacks = cloneAttacks();
  let selectedAttackId: MeleeAttackId = attacks[0]?.id ?? "horizontal-left-high";
  let selectedTarget = 2;
  let swingRemaining = 0;
  let impact = 0;
  let resolved = false;
  const attackControls = createDebugPanel(
    "Attack authoring",
    "Choose a target, play the selected cut, edit both authored poses, then explicitly save JSON.",
  );
  const attackGrid = document.createElement("div");
  const poseGrid = document.createElement("div");
  const attackSelect = document.createElement("select");
  const targetSelect = document.createElement("select");
  const playButton = document.createElement("button");
  const saveButton = document.createElement("button");
  const reloadButton = document.createElement("button");
  const attackStatus = document.createElement("p");
  attackGrid.className = "debug-form-grid";
  poseGrid.className = "attack-pose-grid";
  playButton.type = "button";
  playButton.textContent = "Play selected attack";
  saveButton.type = "button";
  saveButton.textContent = "Save melee attacks JSON";
  reloadButton.type = "button";
  reloadButton.textContent = "Reload from disk";
  attackStatus.className = "attack-workbench-status";
  attackStatus.setAttribute("role", "status");

  for (const attack of attacks) {
    const option = document.createElement("option");
    option.value = attack.id;
    option.textContent = `${attack.label} · ${attack.id}`;
    attackSelect.append(option);
  }

  for (const [index, offset] of TARGET_OFFSETS.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Target ${index + 1} · ${((offset * 180) / Math.PI).toFixed(0)}°`;
    targetSelect.append(option);
  }
  targetSelect.value = String(selectedTarget);

  const currentAttack = (): MeleeAttackDefinition => {
    const attack = attacks.find(({ id }) => id === selectedAttackId) ?? attacks[0] ?? MELEE_ATTACKS[0];

    if (!attack) {
      throw new Error("Attack workbench requires at least one authored attack.");
    }

    return attack;
  };
  const replacePose = (poseName: PoseName, key: keyof MeleeViewmodelPose, value: number): void => {
    attacks = attacks.map((attack) =>
      attack.id === selectedAttackId ? { ...attack, [poseName]: { ...attack[poseName], [key]: value } } : attack,
    );
  };

  const renderPoseControls = (): void => {
    poseGrid.replaceChildren();
    const attack = currentAttack();

    for (const poseName of ["windup", "follow"] as const) {
      const group = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = poseName === "windup" ? "Windup pose" : "Follow-through pose";
      group.append(legend);

      for (const key of ["angle", "handX", "handY", "scale"] as const) {
        group.append(
          poseInput(
            key,
            attack[poseName][key],
            (value) => replacePose(poseName, key, value),
            key === "scale" || key === "angle" ? 0.01 : 1,
          ),
        );
      }
      poseGrid.append(group);
    }

    const hidden = document.createElement("input");
    hidden.type = "checkbox";
    hidden.checked = Boolean(attack.hideFollow);
    hidden.addEventListener("change", () => {
      attacks = attacks.map((item) => (item.id === selectedAttackId ? { ...item, hideFollow: hidden.checked } : item));
    });
    poseGrid.append(field("Hide follow-through sword", hidden));
  };

  const selectedPoint = (): Readonly<{ x: number; y: number; z: number; connected: boolean }> => {
    const point = targetPoint(TARGET_OFFSETS[selectedTarget] ?? 0);
    return { ...point, z: 0.62, connected: Math.abs(TARGET_OFFSETS[selectedTarget] ?? 0) <= MELEE_HALF_ANGLE };
  };

  const updateAttackStatus = (prefix = "Ready"): void => {
    const target = selectedPoint();
    attackStatus.textContent = `${prefix}. ${currentAttack().label}; target ${selectedTarget + 1} is ${target.connected ? "inside" : "outside"} the ±${((MELEE_HALF_ANGLE * 180) / Math.PI).toFixed(0)}° hit arc.`;
  };

  attackSelect.addEventListener("change", () => {
    selectedAttackId = attackSelect.value as MeleeAttackId;
    renderPoseControls();
    updateAttackStatus("Attack selected");
  });
  targetSelect.addEventListener("change", () => {
    selectedTarget = Number(targetSelect.value);
    updateAttackStatus("Aim moved");
  });
  playButton.addEventListener("click", () => {
    swingRemaining = MELEE_SWING_SECONDS;
    impact = 0;
    resolved = false;
    updateAttackStatus("Swing started");
  });
  saveButton.addEventListener("click", () => {
    saveButton.disabled = true;
    attackStatus.textContent = "Validating and saving melee attacks…";

    void saveCanonical("meleeAttacks", parseMeleeAttacks(attacks))
      .then((message) => {
        attackStatus.textContent = message;
      })
      .catch((error: unknown) => {
        attackStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        saveButton.disabled = false;
      });
  });

  // Asked for rather than done to you: the dev server does not watch these files, so that saving one
  // cannot reload the page out from under whoever is authoring it. This is how a hand edit is picked up,
  // or how poses changed but never saved are thrown away.
  reloadButton.addEventListener("click", () => {
    reloadButton.disabled = true;
    attackStatus.textContent = "Reading melee attacks from disk…";
    void loadCanonical("meleeAttacks")
      .then((source) => {
        attacks = parseMeleeAttacks(source).map((attack) => ({
          ...attack,
          windup: { ...attack.windup },
          follow: { ...attack.follow },
        }));
        renderPoseControls();
        attackStatus.textContent = "Reloaded melee attacks from disk.";
      })
      .catch((error: unknown) => {
        attackStatus.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        reloadButton.disabled = false;
      });
  });

  attackGrid.append(
    field("Attack", attackSelect),
    field("Aim target", targetSelect),
    playButton,
    saveButton,
    reloadButton,
  );
  attackControls.body.append(attackGrid, poseGrid, attackStatus);

  const attackRender = createRenderPanel({
    ariaLabel: "Attack hit arc preview dungeon",
    frame: (timing, renderer) => {
      const wasProgress = swingRemaining > 0 ? 1 - swingRemaining / MELEE_SWING_SECONDS : 0;
      swingRemaining = Math.max(0, swingRemaining - timing.frameSeconds);
      const progress = swingRemaining > 0 ? 1 - swingRemaining / MELEE_SWING_SECONDS : 0;
      const target = selectedPoint();

      if (!resolved && wasProgress < MELEE_CUT_START && progress >= MELEE_CUT_START) {
        resolved = true;

        if (target.connected) {
          impact = 1;
          updateAttackStatus("Connected with camera and arm impact hitch");
        } else {
          updateAttackStatus("Missed outside the hit arc");
        }
      }

      impact = Math.max(0, impact - timing.frameSeconds * 5.5);
      const scene = roomScene(
        { ...CAMERA, pitch: demoMeleeImpactPitch(impact) },
        targetBoxes(selectedTarget),
        attackArc(),
      );
      const projected = renderer.project(scene, target);
      const model: DemoViewmodelModel = {
        // The workbench previews the arm, not being hit: no marks, and a pose the bearing maths can
        // read without meaning anything, since nothing here ever records a hit to point at.
        damageMarks: [],
        soakSeconds: 0,
        player: { ...CAMERA, pitch: 0, pushX: 0, pushY: 0, hp: 1, maxHp: 1 },
        elapsedSeconds: timing.elapsedSeconds,
        held: undefined,
        impact,
        swing: swingRemaining,
        swingKind: selectedAttackId,
        swingTarget: swingRemaining > 0 ? target : undefined,
        swingTotal: MELEE_SWING_SECONDS,
        walkBob: 0,
      };

      return {
        scene,
        afterRender: (context, images) =>
          drawDemoViewmodel(
            context,
            images,
            model,
            projected ? { x: projected.screenX, y: projected.screenY } : undefined,
            currentAttack(),
          ),
      };
    },
  });
  attackSection.append(attackControls.panel, attackRender.element);

  carriedSection.append(createCarriedWorkbench());
  content.append(tabs, hudSection, attackSection, carriedSection);
  mount.replaceChildren(page);
  renderPoseControls();
  refreshHud();
  refreshDev();
  updateAttackStatus();
  selectTab("hud");
}
