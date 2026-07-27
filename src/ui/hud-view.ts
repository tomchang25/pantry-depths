import { ENEMY_ARCHETYPES } from "@/content/combat/enemies";
import type { Facing } from "@/core/grid";
import {
  findFacedEnemy,
  type EntityKind,
  type KeyColor,
  type RunSnapshot,
  type RunWorld,
  type SemanticEvent,
  type WorldEntity,
} from "@/core/run-state";

export type PlayerReadout = Readonly<{
  health: number;
  maxHealth: number;
  healthFraction: number;
  attack: number;
  defense: number;
  keys: Readonly<Record<KeyColor, number>>;
  floorId: string;
}>;

export type FacedEnemyReadout = Readonly<{
  name: string;
  health: number;
  maxHealth: number;
  healthFraction: number;
  attack: number;
  defense: number;
  /** False when the sword cannot exceed the target's defense, which is the signal to go open a blue door. */
  canPenetrate: boolean;
  damageTakenPerHit: number;
}>;

/** What the minimap draws in a cell. Secrets are deliberately absent; see `minimapContentAt`. */
export type MinimapContent = "empty" | "enemy" | "key" | "door" | "stair" | "exit";

export type MinimapCellView = Readonly<{
  x: number;
  y: number;
  solid: boolean;
  content: MinimapContent;
  player: boolean;
}>;

export type MinimapView = Readonly<{
  width: number;
  height: number;
  facing: Facing;
  cells: readonly MinimapCellView[];
}>;

export type DamageFeedback = Readonly<{ kind: "damaged"; amount: number }> | Readonly<{ kind: "blocked" }>;

export type RunSummaryView = Readonly<{
  outcome: "dead" | "victory";
  deepestFloorId: string;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  doorsOpened: number;
}>;

export type HudView = Readonly<{
  player: PlayerReadout;
  facedEnemy: FacedEnemyReadout | undefined;
  minimap: MinimapView;
  damage: DamageFeedback | undefined;
  summary: RunSummaryView | undefined;
}>;

/**
 * Named targets that are not enemy archetypes. A breakable wall carries combat capability so the
 * sword resolves against it, but it was never assembled from the enemy table and has no name there.
 */
const UNARCHETYPED_NAMES: Readonly<Partial<Record<EntityKind, string>>> = {
  breakableWall: "Cracked Wall",
};

/**
 * Highest first. A cell can hold more than one entity, and the player needs the thing that changes
 * the route decision, so a threat outranks a reward.
 */
const CONTENT_PRIORITY: readonly Readonly<{ kind: EntityKind; content: MinimapContent }>[] = [
  { kind: "enemy", content: "enemy" },
  { kind: "door", content: "door" },
  { kind: "exit", content: "exit" },
  { kind: "stair", content: "stair" },
  { kind: "key", content: "key" },
];

function fraction(current: number, maximum: number): number {
  return maximum <= 0 ? 0 : Math.max(0, Math.min(1, current / maximum));
}

function targetName(entity: WorldEntity): string {
  const archetype = ENEMY_ARCHETYPES.find((candidate) => candidate.id === entity.archetypeId);
  return archetype?.name ?? UNARCHETYPED_NAMES[entity.kind] ?? "Unknown";
}

function activeEntityIds(snapshot: RunSnapshot): ReadonlySet<string> {
  return new Set(snapshot.entities.filter((entity) => entity.active).map((entity) => entity.id));
}

/**
 * Secrets stay off the map. The breakable wall reads as ordinary stone until it is broken and the
 * hot spring behind it is never marked, because revealing either would spend a designed discovery
 * to solve a problem — walking into an unseen enemy — that the rest of the map already solves.
 */
function minimapContentAt(entities: readonly WorldEntity[]): MinimapContent {
  for (const candidate of CONTENT_PRIORITY) {
    if (entities.some((entity) => entity.kind === candidate.kind)) {
      return candidate.content;
    }
  }

  return "empty";
}

function deriveMinimap(world: RunWorld, snapshot: RunSnapshot): MinimapView {
  const floor = world.floors.find((candidate) => candidate.id === snapshot.player.floorId);

  if (!floor) {
    throw new Error(`hud: unknown floor ${snapshot.player.floorId}`);
  }

  const active = activeEntityIds(snapshot);
  const onFloor = world.entities.filter((entity) => entity.floorId === floor.id && active.has(entity.id));
  const cells: MinimapCellView[] = [];

  for (let y = 0; y < floor.height; y += 1) {
    for (let x = 0; x < floor.width; x += 1) {
      const here = onFloor.filter((entity) => entity.cell.x === x && entity.cell.y === y);
      const solid =
        floor.solidCells.some((cell) => cell.x === x && cell.y === y) ||
        here.some((entity) => entity.kind === "breakableWall");

      cells.push({
        x,
        y,
        solid,
        content: solid ? "empty" : minimapContentAt(here),
        player: snapshot.player.cell.x === x && snapshot.player.cell.y === y,
      });
    }
  }

  return { width: floor.width, height: floor.height, facing: snapshot.player.facing, cells };
}

/**
 * Two adjacent enemies both strike in one tick, so the readout reports the whole exchange rather
 * than whichever landed last. An exchange that happened but cost nothing is the blocked case and
 * must stay visible: it is the player's proof that a defense upgrade changed later costs.
 */
function deriveDamage(events: readonly SemanticEvent[]): DamageFeedback | undefined {
  const retaliations = events.filter((event) => event.type === "entityRetaliated");

  if (retaliations.length === 0) {
    return undefined;
  }

  const amount = retaliations.reduce((total, event) => total + event.damage, 0);
  return amount > 0 ? { kind: "damaged", amount } : { kind: "blocked" };
}

function deriveSummary(world: RunWorld, snapshot: RunSnapshot, deepestFloorId: string): RunSummaryView | undefined {
  if (snapshot.outcome === "active") {
    return undefined;
  }

  const active = activeEntityIds(snapshot);

  return {
    outcome: snapshot.outcome,
    deepestFloorId,
    health: snapshot.player.health,
    maxHealth: snapshot.player.maxHealth,
    attack: snapshot.player.attack,
    defense: snapshot.player.defense,
    doorsOpened: world.entities.filter((entity) => entity.kind === "door" && !active.has(entity.id)).length,
  };
}

/**
 * Projects everything the readout draws from settled state, so no surface below this becomes a
 * second source of truth. Only `damage` is event-derived: a snapshot says the player is at 84
 * health, never that they just lost 6, and two identical exchanges are indistinguishable in it.
 */
export function deriveHudView(
  world: RunWorld,
  snapshot: RunSnapshot,
  events: readonly SemanticEvent[],
  deepestFloorId: string,
): HudView {
  const faced = findFacedEnemy(world, snapshot);

  return {
    player: {
      health: snapshot.player.health,
      maxHealth: snapshot.player.maxHealth,
      healthFraction: fraction(snapshot.player.health, snapshot.player.maxHealth),
      attack: snapshot.player.attack,
      defense: snapshot.player.defense,
      keys: snapshot.player.keys,
      floorId: snapshot.player.floorId,
    },
    facedEnemy: faced && {
      name: targetName(faced.entity),
      health: faced.health,
      maxHealth: faced.maxHealth,
      healthFraction: fraction(faced.health, faced.maxHealth),
      attack: faced.entity.combat?.attack ?? 0,
      defense: faced.entity.combat?.defense ?? 0,
      canPenetrate: faced.playerDamagePerHit > 0,
      damageTakenPerHit: faced.enemyDamagePerHit,
    },
    minimap: deriveMinimap(world, snapshot),
    damage: deriveDamage(events),
    summary: deriveSummary(world, snapshot, deepestFloorId),
  };
}
