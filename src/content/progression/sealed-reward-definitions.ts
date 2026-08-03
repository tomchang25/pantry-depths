/**
 * The two rates that tell a sealed reward's sources apart.
 *
 * A clean reward comes from finishing a floor's main task and leans towards fragments. A cursed one
 * comes from smashing the altar, leans towards cores, and rolls those cores over a range widened at
 * both ends. The two sources differ in these rates and in that width, and in nothing else — paying
 * the cursed altar at a strictly higher rate would make it strictly better, which is not a curse.
 *
 * The sealing, resolution, and bank live with the run state in the demo half; these are the numbers
 * they draw against.
 */

import type { CoreCurse } from "@/core/progression-contract";

/** How often a sealed reward turns out to be a core rather than a fragment. */
export const CORE_SHARE: Readonly<Record<CoreCurse, number>> = { clean: 0.2, cursed: 0.6 };

/** Blessing effects one fragment carries. A cursed fragment carries more than a clean one. */
export const FRAGMENT_EFFECTS: Readonly<Record<CoreCurse, number>> = { clean: 1, cursed: 2 };
