import { WORLD_SPRITE_PLACEMENTS, type SpritePlacement } from "@/content/presentation/sprite-placements";

export type DecorationPreset = SpritePlacement &
  Readonly<{
    assetId: "presentation.bones" | "presentation.wallTorch" | "presentation.wallSpikes";
  }>;

export type LightPreset = Readonly<{
  radius: number;
  color: readonly [number, number, number];
  intensity: number;
}>;

export type EffectPreset = Readonly<{
  kind: "embers" | "steam";
  density: number;
}>;

export const DECORATION_PRESETS: Readonly<Record<string, DecorationPreset>> = {
  bones: { assetId: "presentation.bones", ...WORLD_SPRITE_PLACEMENTS.bones },
  wallTorch: { assetId: "presentation.wallTorch", ...WORLD_SPRITE_PLACEMENTS.wallTorch },
  wallSpikes: { assetId: "presentation.wallSpikes", ...WORLD_SPRITE_PLACEMENTS.wallSpikes },
};

export const LIGHT_PRESETS: Readonly<Record<string, LightPreset>> = {
  warmTorch: { radius: 5.5, color: [255, 151, 62], intensity: 0.95 },
  warmSpring: { radius: 4.25, color: [255, 111, 91], intensity: 0.58 },
};

export const EFFECT_PRESETS: Readonly<Record<string, EffectPreset>> = {
  torchEmbers: { kind: "embers", density: 9 },
  steam: { kind: "steam", density: 7 },
};
