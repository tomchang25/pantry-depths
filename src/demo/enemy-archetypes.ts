/**
 * What is left of the archetype module after its table moved to content: the one random roll.
 *
 * The rows, types, tuning constants, and pure accessors live in `@/content/enemies/enemy-archetypes`
 * now. This remnant waits for the rules child of the demo migration, which moves it into core with
 * the behaviour that calls it.
 */

/**
 * How long a body stands about before deciding where to go next.
 *
 * A range, rolled per body per pause. The point of the pause is that a floor reads as somewhere
 * creatures live rather than a set of patrols, and a fixed length would defeat that on its own: bodies
 * created in one pass stay in phase forever, so the whole room would stop and start together.
 */
export function rollIdleSeconds(): number {
  return 2 + Math.random() * 2;
}
