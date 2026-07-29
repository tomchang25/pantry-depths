export const DECOR_ASSET_IDS = [
  "presentation.wallTorch",
  "presentation.wallSpikes",
  "presentation.bones",
  "presentation.hotSpring",
] as const;

export type DecorAssetId = (typeof DECOR_ASSET_IDS)[number];
export type DecorPlacement = "ground" | "wall";

/** One named visual variant; map placement supplies the tile origin and wall face separately. */
export type DecorPreset = Readonly<{
  assetId: DecorAssetId;
  id: string;
  label: string;
  offsetX: number;
  offsetY: number;
  placement: DecorPlacement;
  scale: number;
  verticalAnchor: number;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  return value;
}

/** Closes authored JSON into the flat sprite-preset contract used by renderer projections. */
export function parseDecorPresets(value: unknown): readonly DecorPreset[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("Decor presets must be a non-empty array.");
  }

  const presets = value.map((entry, index) => {
    const source = record(entry, `decor[${index}]`);
    const assetId = source.assetId;
    const placement = source.placement;
    const scale = finiteNumber(source.scale, `decor[${index}].scale`);

    if (typeof assetId !== "string" || !DECOR_ASSET_IDS.includes(assetId as DecorAssetId)) {
      throw new TypeError(`decor[${index}].assetId must name a decor asset.`);
    }

    if (placement !== "ground" && placement !== "wall") {
      throw new TypeError(`decor[${index}].placement must be ground or wall.`);
    }

    if (scale <= 0) {
      throw new RangeError(`decor[${index}].scale must be greater than zero.`);
    }

    return {
      assetId: assetId as DecorAssetId,
      id: nonEmptyString(source.id, `decor[${index}].id`),
      label: nonEmptyString(source.label, `decor[${index}].label`),
      offsetX: finiteNumber(source.offsetX, `decor[${index}].offsetX`),
      offsetY: finiteNumber(source.offsetY, `decor[${index}].offsetY`),
      placement: placement as DecorPlacement,
      scale,
      verticalAnchor: finiteNumber(source.verticalAnchor, `decor[${index}].verticalAnchor`),
    };
  });
  const ids = new Set(presets.map(({ id }) => id));

  if (ids.size !== presets.length) {
    throw new TypeError("Decor preset ids must be unique.");
  }

  return presets;
}
