/**
 * Everything the rules read as authored data, as one injected record.
 *
 * Core defines what these tables are; content owns what is in them; whoever creates a world passes
 * the assembled value in, and the world carries it — the same arrangement the resolved map has had
 * since the map contract landed. No core module imports a content path: a rule that wants a number
 * an author owns reads it from here.
 */

import type { EnemyArchetype } from "@/core/combat/enemy-contract";
import type { MapCastKind } from "@/core/floor/room-contract";
import type { PropBehaviour, ThrowWeight } from "@/core/prop-contract";
import type { PropKind } from "@/core/prop-kinds";
import type {
  BlessDefinition,
  CoreCurse,
  CoreDefinition,
  ModifierDefinition,
  StackingBlessDefinition,
} from "@/core/progression/progression-contract";

export type GameCatalog = Readonly<{
  archetypes: Readonly<Record<MapCastKind, EnemyArchetype>>;
  propWeights: Readonly<Record<PropKind, ThrowWeight>>;
  propBehaviours: Readonly<Record<PropKind, PropBehaviour>>;
  /** A thrown body whose archetype is unknown; the plain slime's weight, because that is the common throw. */
  defaultBodyWeight: ThrowWeight;
  blessCatalog: readonly BlessDefinition[];
  blessStackingCatalog: readonly StackingBlessDefinition[];
  modifierCatalog: readonly ModifierDefinition[];
  coreCatalog: readonly CoreDefinition[];
  coreShare: Readonly<Record<CoreCurse, number>>;
  fragmentEffects: Readonly<Record<CoreCurse, number>>;
}>;
