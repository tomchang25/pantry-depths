import { MELEE_ATTACK_IDS, type MeleeAttackId } from "@/core/combat/melee-contract";

export type MeleeViewmodelPose = Readonly<{
  angle: number;
  handX: number;
  handY: number;
  opacity?: number;
  scale: number;
  swordVisible?: boolean | undefined;
}>;

export type MeleeAttackDefinition = Readonly<{
  follow: MeleeViewmodelPose;
  hideFollow?: boolean;
  id: MeleeAttackId;
  label: string;
  windup: MeleeViewmodelPose;
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

function pose(value: unknown, label: string): MeleeViewmodelPose {
  const source = record(value, label);
  const opacity = source.opacity;
  const swordVisible = source.swordVisible;

  if (opacity !== undefined && (typeof opacity !== "number" || !Number.isFinite(opacity))) {
    throw new TypeError(`${label}.opacity must be a finite number when provided.`);
  }

  if (swordVisible !== undefined && typeof swordVisible !== "boolean") {
    throw new TypeError(`${label}.swordVisible must be boolean when provided.`);
  }

  return {
    angle: finiteNumber(source.angle, `${label}.angle`),
    handX: finiteNumber(source.handX, `${label}.handX`),
    handY: finiteNumber(source.handY, `${label}.handY`),
    scale: finiteNumber(source.scale, `${label}.scale`),
    ...(opacity === undefined ? {} : { opacity }),
    ...(swordVisible === undefined ? {} : { swordVisible }),
  };
}

function attackId(value: unknown, label: string): MeleeAttackId {
  if (typeof value !== "string" || !MELEE_ATTACK_IDS.includes(value as MeleeAttackId)) {
    throw new TypeError(`${label} must name one of the eight authored attacks.`);
  }

  return value as MeleeAttackId;
}

/** Closes untrusted JSON into the exact eight-attack authored contract. */
export function parseMeleeAttacks(value: unknown): readonly MeleeAttackDefinition[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Melee attacks must be an array.");
  }

  const parsed = value.map((entry, index) => {
    const source = record(entry, `attacks[${index}]`);
    const id = attackId(source.id, `attacks[${index}].id`);

    if (typeof source.label !== "string" || source.label.trim().length === 0) {
      throw new TypeError(`attacks[${index}].label must be a non-empty string.`);
    }

    if (source.hideFollow !== undefined && typeof source.hideFollow !== "boolean") {
      throw new TypeError(`attacks[${index}].hideFollow must be boolean when provided.`);
    }

    return {
      id,
      label: source.label,
      windup: pose(source.windup, `attacks[${index}].windup`),
      follow: pose(source.follow, `attacks[${index}].follow`),
      ...(source.hideFollow === undefined ? {} : { hideFollow: source.hideFollow }),
    };
  });
  const ids = new Set(parsed.map(({ id }) => id));

  if (parsed.length !== MELEE_ATTACK_IDS.length || ids.size !== MELEE_ATTACK_IDS.length) {
    throw new TypeError("Melee attacks must contain each of the eight attack ids exactly once.");
  }

  for (const id of MELEE_ATTACK_IDS) {
    if (!ids.has(id)) {
      throw new TypeError(`Melee attacks are missing ${id}.`);
    }
  }

  return parsed;
}
