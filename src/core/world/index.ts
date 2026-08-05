/**
 * What the layers outside the rules read the run through.
 *
 * The renderer, the interface, the frame loop and the development tools all need the run state and a
 * handful of the values that describe it. Rather than have each of them learn which module inside the
 * rules layer owns which piece, they import from here.
 *
 * A rules-layer module may not import this file, and the boundary checker holds that. The fences
 * around the decision modules are stated in terms of concrete modules, so a re-export that reached
 * back into the layer would launder every one of them; inside the rules, every import names its owner.
 */

export type {
  Altar,
  DamageMark,
  Death,
  DeathCause,
  Enemy,
  EnemyMind,
  Hazard,
  HazardKind,
  Held,
  Intent,
  Mortar,
  MortarPhase,
  Player,
  Projectile,
  Prop,
  RunStatus,
  SfxEvent,
  SwingKind,
  SwingTarget,
  Vfx,
  VfxSpec,
  World,
} from "@/core/world/world";

export {
  ALTAR_HITS,
  AMMO_KINDS,
  bodyFootprint,
  collectMortars,
  createEnemy,
  createWorld,
  crowdHere,
  flattenFloorForTesting,
  IDLE_SPAWN_RECHECK_SECONDS,
  MORTAR_DEAD_ZONE,
  MORTAR_IDLE_SECONDS,
  MORTAR_LOCK_SECONDS,
  PLAYER_BASE_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  populateFloor,
  randomAmmo,
  REACH,
  rollIdleSeconds,
  SHELL_BLAST_RADIUS,
  SHELL_DAMAGE,
  spawnReinforcement,
  standCast,
  SWING_SECONDS,
  THROW_SWING_SECONDS,
} from "@/core/world/world";

export { runClockSeconds } from "@/core/world/run-transition";
export { dropProp } from "@/core/world/props";
export { awardBless } from "@/core/progression/award-bless";
export { stepWorld, descend, DEATH_SECONDS } from "@/core/world/step-world";
export type { PlayerInput } from "@/core/player/movement";
