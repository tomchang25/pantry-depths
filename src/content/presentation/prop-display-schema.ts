/**
 * What kinds of loose object exist, and how each one is drawn where it lies.
 *
 * The kind list lives here rather than beside the behaviour tables that consume it, because
 * `src/content/` may only import content and core — a validator in this layer cannot reach into the
 * demo for the union it is checking against. Keeping one list and having the demo alias it is the only
 * arrangement where a kind added later cannot be missing a display row and compile anyway.
 *
 * The numbers cover two of the three contexts a prop is drawn in: where it lies on the floor, and how it
 * sits in the hand. Each arrived with its own preview — the pickup on the prop workbench's tab, the hand
 * on the HUD workbench's — because a number nobody can look at is a number that gets guessed. Flight is
 * the one still missing, and it stays out until it has a preview of its own rather than being authored
 * blind alongside two contexts that can be seen.
 */

export const PROP_KINDS = [
  "stick",
  "rock",
  "bomb",
  "hammer",
  "skeletonSword",
  "skeletonSkull",
  "skeletonFemur",
  "skeletonFemurCracked",
  "skeletonJavelin",
  "skeletonJavelinCracked",
  "crossbow",
  "crossbowSpent",
  "crossbowBolt",
] as const;

export type PropKind = (typeof PROP_KINDS)[number];

export type PropDisplay = Readonly<{
  kind: PropKind;
  /** How large the pickup is drawn where it lies, in cells. */
  floorScale: number;
  /**
   * How far the pickup floats above the floor line, in cells.
   *
   * Its own number per kind rather than the one value every prop shared, because a bomb sitting in the
   * dust and a stake leaning on it do not rest at the same height, and one number could only ever be
   * right for whichever was authored first.
   */
  floorAnchor: number;
  /**
   * How much of the carried-object slot this prop fills in the first-person view.
   *
   * One for the size the slot was built around. Every prop used to be drawn into exactly that square,
   * so a thrown stake and a bomb were the same size in the hand however different they are on the
   * floor — this is what lets a long thing read as long while it is being carried.
   */
  handScale: number;
  /** How far the carried object is turned in the hand, in radians. */
  handRotation: number;
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
 * Validates an authored pickup table and answers it in the shape the file holds.
 *
 * The list, not a lookup. The authoring endpoint writes whatever its validator returns, so answering a
 * different shape from the one handed in produces a file the next load rejects — which is how the
 * entity table took the debug hub down once already. Callers that want a lookup build one below.
 */
export function parsePropDisplays(value: unknown): readonly PropDisplay[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Prop displays must be an array.");
  }

  const parsed = new Map<PropKind, PropDisplay>();

  value.forEach((entry, index) => {
    const source = record(entry, `propDisplay[${index}]`);
    const kind = source.kind;

    if (typeof kind !== "string" || !PROP_KINDS.includes(kind as PropKind)) {
      throw new TypeError(`propDisplay[${index}].kind must name a prop kind.`);
    }

    if (parsed.has(kind as PropKind)) {
      throw new TypeError(`propDisplay[${index}].kind is listed twice.`);
    }

    const floorScale = finiteNumber(source.floorScale, `propDisplay[${index}].floorScale`);

    if (floorScale <= 0) {
      throw new TypeError(`propDisplay[${index}].floorScale must be greater than zero.`);
    }

    const handScale = finiteNumber(source.handScale, `propDisplay[${index}].handScale`);

    if (handScale <= 0) {
      throw new TypeError(`propDisplay[${index}].handScale must be greater than zero.`);
    }

    parsed.set(kind as PropKind, {
      kind: kind as PropKind,
      floorScale,
      floorAnchor: finiteNumber(source.floorAnchor, `propDisplay[${index}].floorAnchor`),
      handScale,
      handRotation: finiteNumber(source.handRotation, `propDisplay[${index}].handRotation`),
    });
  });

  const missing = PROP_KINDS.filter((kind) => !parsed.has(kind));

  if (missing.length > 0) {
    throw new TypeError(`Prop displays are missing an entry for: ${missing.join(", ")}.`);
  }

  return [...parsed.values()];
}

/** The same table as a lookup, for the readers that want one. Order is not meaningful to either. */
export function propDisplaysByKind(displays: readonly PropDisplay[]): Readonly<Record<PropKind, PropDisplay>> {
  return Object.fromEntries(displays.map((display) => [display.kind, display])) as Record<PropKind, PropDisplay>;
}
