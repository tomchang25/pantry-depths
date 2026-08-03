/**
 * The one assembled value of everything the rules read as authored data.
 *
 * Core's `GameCatalog` names the shape; the tables in this layer fill it; whoever creates a world
 * hands it over. One assembly site, so a table added to the contract is missing here exactly once
 * and loudly.
 */

import { ENEMY_ARCHETYPES } from "@/content/enemies/enemy-archetypes";
import { BLESS_CATALOG, BLESS_STACKING_CATALOG } from "@/content/progression/bless-definitions";
import { CORE_CATALOG, MODIFIER_CATALOG } from "@/content/progression/modifier-definitions";
import { CORE_SHARE, FRAGMENT_EFFECTS } from "@/content/progression/sealed-reward-definitions";
import { DEFAULT_BODY_WEIGHT, PROP_BEHAVIOURS, PROP_WEIGHTS } from "@/content/props/prop-definitions";
import type { GameCatalog } from "@/core/catalog";

export const GAME_CATALOG: GameCatalog = {
  archetypes: ENEMY_ARCHETYPES,
  propWeights: PROP_WEIGHTS,
  propBehaviours: PROP_BEHAVIOURS,
  defaultBodyWeight: DEFAULT_BODY_WEIGHT,
  blessCatalog: BLESS_CATALOG,
  blessStackingCatalog: BLESS_STACKING_CATALOG,
  modifierCatalog: MODIFIER_CATALOG,
  coreCatalog: CORE_CATALOG,
  coreShare: CORE_SHARE,
  fragmentEffects: FRAGMENT_EFFECTS,
};
