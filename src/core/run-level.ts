/**
 * The run's one difficulty number.
 *
 * Derived from the two things a run spends — the time it has taken and the floors it has gone down —
 * and never stored, so the number and its sources cannot drift apart. It never falls and no descent
 * resets it: a clock that reset would turn descending into a way to buy difficulty back, which is the
 * incentive the floor's tasks exist to remove.
 *
 * The two rates together price a floor at five minutes. Five minutes spent on a floor costs the same
 * level as one descent, and that exchange rate is what the player is really deciding against every
 * time they take a secondary task. A floor whose full business runs far past five minutes is telling
 * whoever set its tasks that they are priced above what they pay.
 *
 * **Nothing reads this but the display.** Wiring it into enemy statistics is the first thing to do
 * once the concurrent rewrite of those tables lands, and doing it before then would put this plan and
 * that one in the same file.
 */

export const LEVEL_PER_MINUTE = 1;
export const LEVEL_PER_DESCENT = 5;

/**
 * How a rise in the number reaches the card on screen.
 *
 * The card channel carries one token, and every other token it has ever carried names a blessing. A
 * prefix is what keeps this one from being looked up as one, and putting it here rather than at either
 * end keeps the writer and the reader agreeing on it by construction.
 */
export const LEVEL_CARD_PREFIX = "threat:";

export type RunClock = Readonly<{ elapsedSeconds: number; depth: number }>;

export function runLevel(run: RunClock): number {
  const minutes = Math.floor(Math.max(0, run.elapsedSeconds) / 60);
  const descents = Math.max(0, run.depth - 1);
  return minutes * LEVEL_PER_MINUTE + descents * LEVEL_PER_DESCENT;
}
