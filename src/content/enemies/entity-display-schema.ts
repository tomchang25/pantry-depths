/**
 * How each enemy appearance is drawn, as authored numbers rather than constants in the renderer.
 *
 * These two are the project's own rule finally applied: the structure addendum names sprite `scale`
 * and `anchorY` among the numeric records that belong in `src/content/`, and until now the demo kept
 * them as literals beside the code that consumed them. That cost a rebuild-and-play cycle per guess,
 * and a body's size was guessed at three times in a row before anyone noticed the loop was the
 * problem rather than the number.
 *
 * Tuned in the entity workbench and saved back through the authoring endpoint, the same way decor
 * presets are. Nothing here changes behaviour: a body's reach, collision and damage are the
 * simulation's, and none of them read this file.
 */

import { type EnemyAppearanceId } from "@/content/combat/enemies";

const APPEARANCE_IDS: readonly EnemyAppearanceId[] = [
  "greenSlime",
  "yellowSlime",
  "blueSlime",
  "redSlime",
  "purpleSlime",
  "skeletonSwordsman",
  "skeletonHammerman",
  "skeletonJavelineer",
  "skeletonCrossbowman",
  "placeholder",
];

export type EntityDisplay = Readonly<{
  appearanceId: EnemyAppearanceId;
  /**
   * How tall the drawn body stands, in cells.
   *
   * Read only for a body drawn from authored artwork. A soft body's size comes from its own profile —
   * radius, height and colour together — and moving that here is its own change; see the tracker.
   */
  bodyScale: number;
  /**
   * Where anything worn over the head sits, in cells relative to the top of the body.
   *
   * Positive floats it clear; **negative pulls it down over the body**, which is not a mistake but a
   * trade. A mark directly above a tall head leaves the frame at the range the body is dangerous at,
   * so pulling it down onto the shoulders buys visibility at the cost of a clean silhouette. Which
   * side of that trade is right depends on how far away the thing is usually read from, which is why
   * the workbench that tunes this has a distance slider next to it.
   */
  markerOffset: number;
  /**
   * How large the wind-up mark is drawn at the start of a wind-up, in cells.
   *
   * Its own number rather than a share of the body, because the two want to move in opposite
   * directions: a mark exists to be seen from across a room, so a small creature needs a mark that is
   * large *relative* to it, and tying the two together makes the smallest enemies the hardest to read.
   */
  markerScale: number;
  /**
   * How much more of that scale the mark takes on as the wind-up completes, in cells.
   *
   * The swell is the only thing a mark does to say how long is left, so how much of it there is decides
   * whether the answer is "soon" or nothing at all. Zero is a mark that does not grow.
   */
  markerSwell: number;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  return value;
}

/**
 * Validates an authored display table and answers it in the shape the file holds.
 *
 * **The list, not a lookup, and that is load-bearing.** The authoring endpoint writes whatever its
 * validator returns, so a validator that answers a different shape from the one it was given cannot
 * round-trip: saving once rewrote this file as an object keyed by appearance, and the next load
 * rejected it for not being an array — taking the whole debug hub down with it. Anything that wants a
 * lookup builds one with `entityDisplaysByAppearance`.
 *
 * Every appearance must be present. A partial table would mean a body drawn at whatever the reader
 * happened to default to, and a silent default is exactly what this file exists to remove — an
 * appearance added to the union without a row here should fail loudly at load rather than render at
 * some arbitrary size until somebody notices.
 */
export function parseEntityDisplays(value: unknown): readonly EntityDisplay[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Entity displays must be an array.");
  }

  const parsed = new Map<EnemyAppearanceId, EntityDisplay>();

  value.forEach((entry, index) => {
    const source = record(entry, `entityDisplay[${index}]`);
    const appearanceId = source.appearanceId;

    if (typeof appearanceId !== "string" || !APPEARANCE_IDS.includes(appearanceId as EnemyAppearanceId)) {
      throw new TypeError(`entityDisplay[${index}].appearanceId must name an enemy appearance.`);
    }

    if (parsed.has(appearanceId as EnemyAppearanceId)) {
      throw new TypeError(`entityDisplay[${index}].appearanceId is listed twice.`);
    }

    const bodyScale = finiteNumber(source.bodyScale, `entityDisplay[${index}].bodyScale`);

    if (bodyScale <= 0) {
      throw new TypeError(`entityDisplay[${index}].bodyScale must be greater than zero.`);
    }

    const markerScale = finiteNumber(source.markerScale, `entityDisplay[${index}].markerScale`);

    if (markerScale <= 0) {
      throw new TypeError(`entityDisplay[${index}].markerScale must be greater than zero.`);
    }

    const markerSwell = finiteNumber(source.markerSwell, `entityDisplay[${index}].markerSwell`);

    if (markerSwell < 0) {
      throw new TypeError(`entityDisplay[${index}].markerSwell must not be negative.`);
    }

    parsed.set(appearanceId as EnemyAppearanceId, {
      appearanceId: appearanceId as EnemyAppearanceId,
      bodyScale,
      markerOffset: finiteNumber(source.markerOffset, `entityDisplay[${index}].markerOffset`),
      markerScale,
      markerSwell,
    });
  });

  const missing = APPEARANCE_IDS.filter((id) => !parsed.has(id));

  if (missing.length > 0) {
    throw new TypeError(`Entity displays are missing an entry for: ${missing.join(", ")}.`);
  }

  return [...parsed.values()];
}

/** The same table as a lookup, for the readers that want one. Order is not meaningful to either. */
export function entityDisplaysByAppearance(
  displays: readonly EntityDisplay[],
): Readonly<Record<EnemyAppearanceId, EntityDisplay>> {
  return Object.fromEntries(displays.map((display) => [display.appearanceId, display])) as Record<
    EnemyAppearanceId,
    EntityDisplay
  >;
}
