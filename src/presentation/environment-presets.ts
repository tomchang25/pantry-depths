export type DecorationPreset = Readonly<{
  assetId: "presentation.bones" | "presentation.wallTorch" | "presentation.wallSpikes";
  scale: number;
  verticalAnchor: number;
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
  bones: { assetId: "presentation.bones", scale: 0.72, verticalAnchor: -0.42 },
  wallTorch: { assetId: "presentation.wallTorch", scale: 0.58, verticalAnchor: -0.08 },
  wallSpikes: { assetId: "presentation.wallSpikes", scale: 0.82, verticalAnchor: 0.08 },
};

export const LIGHT_PRESETS: Readonly<Record<string, LightPreset>> = {
  warmTorch: { radius: 5.5, color: [255, 151, 62], intensity: 0.95 },
  warmSpring: { radius: 4.25, color: [255, 111, 91], intensity: 0.58 },
};

export const EFFECT_PRESETS: Readonly<Record<string, EffectPreset>> = {
  torchEmbers: { kind: "embers", density: 9 },
  steam: { kind: "steam", density: 7 },
};
