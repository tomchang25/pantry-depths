import "@/ui/hud.css";

import type { KeyColor } from "@/core/run-state";
import { createFloorMinimap } from "@/ui/floor-minimap";
import { createRunOutcomeSurface } from "@/ui/run-outcome-surface";
import type { DamageFeedback, FacedEnemyReadout, HudView } from "@/ui/hud-view";

const KEY_COLORS: readonly KeyColor[] = ["red", "blue", "yellow"];

/** Letter as well as color, because the three key counts must not be told apart by hue alone. */
const KEY_INITIALS: Readonly<Record<KeyColor, string>> = { red: "R", blue: "B", yellow: "Y" };

const DAMAGE_VISIBLE_MS = 1100;

/**
 * Drawn rather than loaded: the project ships no image file for interface or environment surfaces,
 * and two flat shapes carry the attack/defense distinction without an asset pipeline.
 */
function createStatIcon(kind: "attack" | "defense"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", `hud-icon hud-icon--${kind}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    kind === "attack"
      ? "M13.5 1.5 6.6 8.4l1.9 1.9 6.9-6.9zM5.2 9.8 2.5 12.5l1 1 2.7-2.7zM1.2 13.3l1.4 1.4-2 .6z"
      : "M8 1.2 2.6 3.4v4.3c0 3.2 2.2 6.1 5.4 7.1 3.2-1 5.4-3.9 5.4-7.1V3.4z",
  );
  svg.append(path);
  return svg;
}

function createStat(kind: "attack" | "defense", label: string): Readonly<{ element: HTMLElement; value: HTMLElement }> {
  const element = document.createElement("p");
  element.className = "hud-stat";
  const value = document.createElement("span");
  value.className = "hud-stat__value";
  const name = document.createElement("span");
  name.className = "hud-visually-hidden";
  name.textContent = `${label} `;
  element.append(createStatIcon(kind), name, value);
  return { element, value };
}

function createMeter(className: string): Readonly<{ element: HTMLElement; fill: HTMLElement }> {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  fill.className = `${className}__fill`;
  element.append(fill);
  return { element, fill };
}

export type MountedHudOverlay = Readonly<{
  element: HTMLElement;
  update: (view: HudView) => void;
  dispose: () => void;
}>;

/**
 * Every value shown here is derived upstream. This module sets text, classes, and one width; it
 * makes no decision the DOM-free view tests cannot already reach.
 */
export function createHudOverlay(onRestart: () => void): MountedHudOverlay {
  const element = document.createElement("div");
  element.className = "hud";

  const status = document.createElement("section");
  status.className = "hud-panel hud-status";
  status.setAttribute("aria-label", "Your condition");
  const health = document.createElement("p");
  health.className = "hud-status__health";
  const healthMeter = createMeter("hud-meter");
  const attack = createStat("attack", "Attack");
  const defense = createStat("defense", "Defense");
  const stats = document.createElement("div");
  stats.className = "hud-status__stats";
  stats.append(attack.element, defense.element);
  const keys = document.createElement("ul");
  keys.className = "hud-keys";
  const keyValues = new Map<KeyColor, HTMLElement>();

  for (const color of KEY_COLORS) {
    const item = document.createElement("li");
    item.className = `hud-keys__key hud-keys__key--${color}`;
    const initial = document.createElement("span");
    initial.className = "hud-keys__initial";
    initial.textContent = KEY_INITIALS[color];
    const count = document.createElement("span");
    count.className = "hud-keys__count";
    const name = document.createElement("span");
    name.className = "hud-visually-hidden";
    name.textContent = ` ${color} keys`;
    item.append(initial, count, name);
    keys.append(item);
    keyValues.set(color, count);
  }

  const floor = document.createElement("p");
  floor.className = "hud-status__floor";
  status.append(health, healthMeter.element, stats, keys, floor);

  const enemy = document.createElement("section");
  enemy.className = "hud-panel hud-enemy";
  enemy.hidden = true;
  enemy.setAttribute("aria-label", "The target you are facing");
  const enemyName = document.createElement("p");
  enemyName.className = "hud-enemy__name";
  const enemyHealth = document.createElement("p");
  enemyHealth.className = "hud-enemy__health";
  const enemyMeter = createMeter("hud-meter");
  const enemyAttack = createStat("attack", "Attack");
  const enemyDefense = createStat("defense", "Defense");
  const enemyStats = document.createElement("div");
  enemyStats.className = "hud-enemy__stats";
  enemyStats.append(enemyAttack.element, enemyDefense.element);
  const penetration = document.createElement("p");
  penetration.className = "hud-enemy__penetration";
  enemy.append(enemyName, enemyHealth, enemyMeter.element, enemyStats, penetration);

  const damage = document.createElement("p");
  damage.className = "hud-damage";
  damage.setAttribute("role", "status");
  damage.hidden = true;

  const minimap = createFloorMinimap();
  const outcome = createRunOutcomeSurface(onRestart);
  element.append(status, minimap.element, enemy, damage, outcome.element);

  let damageTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  /**
   * Repeated exchanges extend the one message rather than replaying its entrance, matching the
   * blocked-move line: restarting the animation while a player leans on a key reads as flicker.
   */
  const showDamage = (feedback: DamageFeedback | undefined): void => {
    if (!feedback) {
      return;
    }

    damage.textContent = feedback.kind === "damaged" ? `−${feedback.amount}` : "Blocked";
    damage.className = `hud-damage hud-damage--${feedback.kind}`;
    damage.hidden = false;

    if (damageTimer !== undefined) {
      globalThis.clearTimeout(damageTimer);
    }

    damageTimer = globalThis.setTimeout(() => {
      damage.hidden = true;
    }, DAMAGE_VISIBLE_MS);
  };

  const showEnemy = (faced: FacedEnemyReadout | undefined): void => {
    if (!faced) {
      enemy.hidden = true;
      return;
    }

    enemy.hidden = false;
    enemyName.textContent = faced.name;
    enemyHealth.textContent = `${faced.health} / ${faced.maxHealth} HP`;
    enemyMeter.fill.style.width = `${faced.healthFraction * 100}%`;
    enemyAttack.value.textContent = String(faced.attack);
    enemyDefense.value.textContent = String(faced.defense);
    penetration.textContent = faced.canPenetrate
      ? `Hits you for ${faced.damageTakenPerHit}`
      : "Cannot penetrate its defense";
    penetration.className = `hud-enemy__penetration${faced.canPenetrate ? "" : " hud-enemy__penetration--blocked"}`;
  };

  const update = (view: HudView): void => {
    health.textContent = `${view.player.health} / ${view.player.maxHealth} HP`;
    healthMeter.fill.style.width = `${view.player.healthFraction * 100}%`;
    attack.value.textContent = String(view.player.attack);
    defense.value.textContent = String(view.player.defense);
    floor.textContent = view.player.floorId;

    for (const color of KEY_COLORS) {
      const count = keyValues.get(color);

      if (count) {
        count.textContent = String(view.player.keys[color]);
      }
    }

    showEnemy(view.facedEnemy);
    showDamage(view.damage);
    minimap.update(view.minimap);
    outcome.update(view.summary);
  };

  const dispose = (): void => {
    if (damageTimer !== undefined) {
      globalThis.clearTimeout(damageTimer);
    }

    element.remove();
  };

  return { element, update, dispose };
}
