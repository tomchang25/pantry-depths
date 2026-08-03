/**
 * Everything the rules read as authored data, as one injected record.
 *
 * Core defines what these tables are; content owns what is in them; whoever creates a world passes
 * the assembled value in, and the world carries it — the same arrangement the resolved map has had
 * since the map contract landed. No core module imports a content path: a rule that wants a number
 * an author owns reads it from here.
 */

import type { DemoArchetypeId, DemoEnemyArchetype } from "@/core/enemy-contract";
import type { DemoPropBehaviour, DemoPropKind, DemoThrowWeight } from "@/core/prop-contract";
import type {
  BlessDefinition,
  CoreCurse,
  CoreDefinition,
  ModifierDefinition,
  StackingBlessDefinition,
} from "@/core/progression-contract";

export type GameCatalog = Readonly<{
  archetypes: Readonly<Record<DemoArchetypeId, DemoEnemyArchetype>>;
  propWeights: Readonly<Record<DemoPropKind, DemoThrowWeight>>;
  propBehaviours: Readonly<Record<DemoPropKind, DemoPropBehaviour>>;
  /** A thrown body whose archetype is unknown; the plain slime's weight, because that is the common throw. */
  defaultBodyWeight: DemoThrowWeight;
  blessCatalog: readonly BlessDefinition[];
  blessStackingCatalog: readonly StackingBlessDefinition[];
  modifierCatalog: readonly ModifierDefinition[];
  coreCatalog: readonly CoreDefinition[];
  coreShare: Readonly<Record<CoreCurse, number>>;
  fragmentEffects: Readonly<Record<CoreCurse, number>>;
}>;
