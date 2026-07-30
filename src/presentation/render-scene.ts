/**
 * The scene format the renderer draws.
 *
 * Types only. This module once also projected the turn-based game's world into a scene, but the
 * play surface builds its own scenes now, so what remains is the vocabulary the two sides agree
 * on — and keeping it free of world and content imports is what lets a caller describe a scene
 * without owning a floor set.
 */

import type { EnemyAppearanceId } from "@/content/combat/enemies";
import type { Cell, Facing } from "@/core/grid";

export type CameraPose = Readonly<{
  x: number;
  y: number;
  angle: number;
  /**
   * Vertical look, as a fraction of canvas height the horizon shifts by. Omitted means level, which
   * is what every baked floor uses; only the free-look demo surface ever sets it.
   */
  pitch?: number;
}>;

export type RenderSurfaceMaterial =
  | "stoneWall"
  | "oldBrickWall"
  | "ironBarWall"
  | "doorRed"
  | "doorBlue"
  | "doorYellow"
  | "breakableWall"
  // Added for the standalone demo surface; the baked floors never author these. They are separate
  // materials rather than improvements to the shipped ones so the shipped game renders unchanged.
  | "demoFoundation"
  // One material per point of damage a wall can have taken, so breaking one is a visible sequence
  // rather than a single swap halfway through.
  | "demoAshlar"
  | "demoAshlarWorn"
  | "demoAshlarCracked"
  | "demoAshlarFailing"
  | "woodWall"
  | "woodWallCracked"
  | "splinteredWoodWall";

export type RenderSurface = Readonly<{
  cell: Cell;
  material: RenderSurfaceMaterial;
  hintFaces?: readonly Facing[];
  /**
   * Height in cells, overriding the scene's. Only meaningful under an open sky: with a ceiling to
   * meet, every wall has to reach it, and the moment the ceiling is gone they no longer have to
   * agree — which is what lets a boundary wall stand well above the ones inside it.
   */
  height?: number;
}>;

/**
 * An open sky in place of a ceiling.
 *
 * Not geometry. Everything above the horizon that no wall covers is filled with a gradient, and the
 * stars are placed in screen space at a fixed elevation band rather than in the world — a point at
 * infinite distance projects onto the horizon itself in this camera, so a literally distant star
 * would collapse to a line. Treating the sky as a backdrop is both the correct look and far cheaper
 * than the textured plane it replaces: no sampling, no cell lookup, one write per pixel.
 */
export type RenderSky = Readonly<{
  horizonColor: readonly [number, number, number];
  zenithColor: readonly [number, number, number];
  stars: number;
  /** Direction of the moon in radians, or omitted for a moonless sky. */
  moonAngle?: number;
}>;

/**
 * A floor material other than the level's default one.
 *
 * The floor is drawn per pixel from a single tiling texture, so a cell that should look different
 * has to be named here rather than covered with a sprite: a sprite laid flat is a squashed billboard
 * that floats, tiles against its neighbours with a visible seam, and cannot be walked over correctly.
 */
export type RenderFloorMaterial =
  | "water"
  // A pool with bodies in it, one material per body it has swallowed, and the ground left when it
  // has taken as many as it can hold. They are floor materials rather than corpses laid over water
  // because what is under a surface cannot be drawn as something standing on it.
  | "waterFouled"
  | "waterChoked"
  | "demoCarrion"
  | "demoFlagstone"
  | "demoVault"
  | "demoBlood";

export type RenderFloorPatch = Readonly<{ cell: Cell; material: RenderFloorMaterial }>;

/**
 * A material mixed into the floor already at a cell, rather than replacing it.
 *
 * Blood belongs here and not on a sprite: a stain is part of the floor, so it has to be walked over,
 * lit, and fogged as floor. `amount` is how much of the cell it has taken, so a stain can deepen as
 * more is spilled on it.
 */
export type RenderFloorOverlay = Readonly<{ cell: Cell; material: RenderFloorMaterial; amount: number }>;

/**
 * The shape a decal covers, in world units.
 *
 * A lane is measured forward from the decal's own point along its direction, so a charger paints one
 * by handing over where it is standing and which way it has committed. The circles are centred on
 * that point instead.
 */
export type RenderFloorDecalShape =
  | Readonly<{ kind: "disc"; radius: number }>
  | Readonly<{ kind: "ring"; radius: number; thickness: number }>
  | Readonly<{
      kind: "lane";
      directionX: number;
      directionY: number;
      length: number;
      halfWidth: number;
    }>
  /**
   * A wedge of ground, measured either side of the direction it is pointed.
   *
   * The direction is the wedge's bisector rather than one of its edges, so a caller that wants a
   * wedge growing from one side to the other moves the bisector as it widens the angle. That keeps
   * one shape covering both a fixed cone and a sweeping one.
   */
  | Readonly<{
      kind: "sector";
      radius: number;
      directionX: number;
      directionY: number;
      halfAngle: number;
    }>;

/**
 * A shape painted into the floor, at whatever resolution the floor is drawn at.
 *
 * Distinct from both of the things above it, and the distinction is the point. A floor patch or
 * overlay is a whole cell and nothing finer, which is right for terrain and for blood but cannot
 * describe a circle two cells across or a lane running at forty degrees. A sprite laid flat is not on
 * the floor at all — the sprite pipeline draws a camera-facing quad squashed to a fraction of its
 * height, so it lifts away from the ground at close range and at the edges of the view, keeps its own
 * colour instead of taking the floor's light and fog, and reads as a sticker rather than as a mark.
 *
 * This is neither: the floor is already sampled per pixel from a known world position, so a decal is
 * a test against that position and a blend into the texel before it is lit. It is therefore shaded,
 * fogged, and walked over exactly like the ground it is part of, and it holds its shape at any angle.
 *
 * Cost is bounded by marking which cells each decal reaches and leaving every other cell on the fast
 * path, so a floor with no decals on it costs nothing at all.
 */
export type RenderFloorDecal = Readonly<{
  x: number;
  y: number;
  shape: RenderFloorDecalShape;
  color: readonly [number, number, number];
  /** How much of the floor's own colour it takes where it covers, from nothing to all of it. */
  strength: number;
}>;

/**
 * An axis-aligned box standing in the world.
 *
 * The demo's altars, stair mouths and pedestals were flat images laid on the ground, which is what
 * makes them read as decals rather than as things in the room. A box is drawn as its own faces with
 * the depth buffer respected, so it is occluded correctly, shaded per face, and has a silhouette
 * that changes as you walk around it.
 */
export type RenderBox = Readonly<{
  id: string;
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  /** Vertical extent in cells; `bottom` may be negative, which sinks the box below the floor. */
  bottom: number;
  top: number;
  color: readonly [number, number, number];
  /** Top face colour. Defaults to the body lightened, which is what an overhead light would do. */
  topColor?: readonly [number, number, number];
}>;

/** A cleaved body: the halves separate, tilt outward and settle. All values grow from zero. */
export type RenderBlobSplit = Readonly<{
  /** How far each half has moved from the centre, in cells. */
  separation: number;
  /** How far each half has toppled outward, in radians. */
  tilt: number;
  /** How far the halves have dropped down the screen, in cells. */
  drop: number;
}>;

export type RenderBlobFace = "normal" | "hurt" | "attack";

/**
 * A soft body standing in the world, drawn as a stack of deformed rings rather than a flat image.
 *
 * A billboard is the same picture from every side and at every moment; a blob is a profile curve
 * the scene deforms — squashed on landing, stretched into a lunge, collapsed into a puddle, split
 * in half — so a boneless creature can act with its whole body instead of swapping between three
 * drawings. Everything here is presentation-frame data; the scene recomputes it per frame.
 */
export type RenderBlob = Readonly<{
  id: string;
  x: number;
  y: number;
  /** Resting footprint radius in cells. */
  radius: number;
  /** Resting body height in cells. */
  height: number;
  color: readonly [number, number, number];
  /** Vertical scale. The footprint widens as this drops, so the volume reads as conserved. */
  squash: number;
  /** World-space offset of the crown relative to the base — a lean, a lunge, a slump. */
  leanX: number;
  leanY: number;
  /** Sinusoidal radius modulation along the height: jiggle, shivers, ripples. */
  wobbleAmp: number;
  wobblePhase: number;
  /**
   * Base height offset from the floor. Zero rests on it; negative sinks below and is cut off at
   * the floor line; positive rides above it — a body carried through the air.
   */
  sink: number;
  /** Downward sag of the upper body in cells, strongest at the crown — a body going limp. */
  droop: number;
  /** 0..1 white mixed into the body colour, shared with the sprite pipeline's hit flash. */
  flash: number;
  alpha: number;
  /** Facial expression, drawn on the camera-facing side. Omitted for the dead. */
  face?: RenderBlobFace;
  /** Set while the body is cleaved in two; overrides the face. */
  split?: RenderBlobSplit;
}>;

export type RenderSprite = Readonly<{
  id: string;
  x: number;
  y: number;
  placement: "billboard" | "ground" | "wall";
  assetId: string;
  scale: number;
  verticalAnchor: number;
  /** Which baked artwork this sprite draws. Archetypes share appearances, so this is not an identity. */
  appearanceId?: EnemyAppearanceId;
  wallFace?: Facing;
  /**
   * 0..1 white laid over the drawn picture — the sprite side of `RenderBlob.flash`.
   *
   * A blob can express a hit with its whole body; a billboard has only the frame it was authored
   * with, so without this an enemy drawn from artwork takes a blow and changes nothing but which
   * drawing is on screen. Carried on the sprite rather than through the effects channel because
   * that is where every other piece of per-entity state moved.
   */
  flash?: number;
  /**
   * Draws a second, glowing silhouette of this sprite that ignores what is in front of it, so the
   * thing stays locatable through walls. Only the demo surface marks anything this way.
   */
  xray?: Readonly<{ color: readonly [number, number, number]; alpha: number }>;
  /**
   * How much of the picture has gone under the surface it stands on, as a fraction of its own height.
   *
   * The sprite drops by that much and everything below the floor line is not drawn, which is the
   * waterline cut `RenderBlob.sink` already has and the sprite pipeline did not: lowering a billboard
   * without it paints the legs over the water in front of them, and the body reads as standing in a
   * hole rather than as going under. One at the point there is nothing left above the surface.
   */
  submerged?: number;
  /** One cell inside a sprite atlas. Omitted when the asset is already one complete image. */
  frame?: Readonly<{ column: number; row: number; columns: number; rows: number }>;
  /**
   * Radians to turn the picture about its own centre, for a thing that tumbles as it flies.
   *
   * Quantised and cached by the renderer, so a spinning sprite costs a fixed set of pre-turned copies
   * rather than a transform per frame. The turn happens inside the sprite's own square: authored art
   * that reaches into the corners will lose them, and everything that spins today sits well inside.
   */
  spin?: number;
}>;

/** A world-space point, where `z` is height above the floor in cell units — eye level is 0.5. */
export type RenderPoint = Readonly<{ x: number; y: number; z: number }>;

/**
 * A rod in the world, drawn as an oriented segment rather than a camera-facing image.
 *
 * A billboard cannot express a thrown stick: it is the same picture whichever way the stick is
 * travelling, so throwing one away from the camera reads as a picture of a stick sliding backwards.
 * A beam is projected end to end, so it foreshortens to a stub when it points into the screen and
 * runs its full length when it crosses the view — which is the whole difference between an image of
 * a thrown object and a thrown object.
 */
export type RenderBeam = Readonly<{
  id: string;
  from: RenderPoint;
  to: RenderPoint;
  /** Thickness in cell units, projected like any other world measurement. */
  width: number;
  color: readonly [number, number, number];
  /** Colour at the `to` end. Absent means one flat colour along the whole rod. */
  tipColor?: readonly [number, number, number];
}>;

/**
 * A flat coloured dot in the world: sparks, chips, blood, dust, trails.
 *
 * Deliberately not a sprite. A sprite is fetched from the image map and then tinted for its depth
 * and the light on it, and the tinted result is cached per bucket in a full-size offscreen canvas —
 * which is worth it for a slime and ruinous for four hundred specks that are three pixels across.
 * This is drawn straight as a circle, depth-tested once, with no image and no cache.
 */
export type RenderParticle = Readonly<{
  x: number;
  y: number;
  /** Height above the floor in cells. */
  z: number;
  /** Diameter in cells. */
  size: number;
  color: readonly [number, number, number];
  alpha: number;
  /** Adds rather than covers. Right for sparks and embers, wrong for blood and chips. */
  additive?: boolean;
}>;

export type RenderLight = Readonly<{
  id: string;
  x: number;
  y: number;
  radius: number;
  color: readonly [number, number, number];
  intensity: number;
}>;

export type RenderEmitter = Readonly<{
  id: string;
  x: number;
  y: number;
  kind: "embers" | "steam";
  density: number;
}>;

export type RenderScene = Readonly<{
  floorId: string;
  theme: string;
  width: number;
  height: number;
  tiles: readonly string[];
  camera: CameraPose;
  surfaces: readonly RenderSurface[];
  /** Cells whose floor is drawn from a different texture. Baked floors author none of these. */
  floorPatches?: readonly RenderFloorPatch[];
  /** Replaces the default ceiling texture for the whole scene. Ignored when `sky` is set. */
  ceilingMaterial?: RenderFloorMaterial;
  /** Opens the roof. Takes the place of the ceiling entirely. */
  sky?: RenderSky;
  /**
   * Room height in cells, and how far up it the eye sits.
   *
   * The projection had both baked in at one and a half: floor rows and ceiling rows were mirrored
   * about the horizon because they were the same distance from the eye, and a wall column was
   * exactly `canvasHeight / depth` tall. Naming them lets a floor be built taller without touching
   * anything else, and the defaults reproduce the old arithmetic exactly.
   */
  wallHeight?: number;
  eyeHeight?: number;
  /** Materials blended over the floor already there, by amount. Used for staining, not for terrain. */
  floorOverlays?: readonly RenderFloorOverlay[];
  /**
   * Shapes painted into the floor at sub-cell resolution. Baked floors author none of these.
   *
   * Deliberately a separate channel from the overlays rather than more of them: an overlay is one
   * material per cell, so a warning drawn through that channel would erase whatever blood had been
   * spilled on the cells it crosses and put it back when it expired.
   */
  floorDecals?: readonly RenderFloorDecal[];
  /** Volumetric props. Boxes, because everything the demo needs to stand up is box-shaped. */
  boxes?: readonly RenderBox[];
  /** Soft bodies drawn as deformed ring stacks. Baked floors author none of these. */
  blobs?: readonly RenderBlob[];
  /**
   * Ambient light everywhere, before any placed light contributes. Only read under enhanced
   * lighting; without it the renderer's fixed torch model is the only illumination.
   */
  ambient?: readonly [number, number, number];
  sprites: readonly RenderSprite[];
  /** Oriented rods. Baked floors author none of these. */
  beams?: readonly RenderBeam[];
  /** Cheap dots — particles, trails, sparks. Never goes near the sprite pipeline. */
  particles?: readonly RenderParticle[];
  lights: readonly RenderLight[];
  emitters: readonly RenderEmitter[];
}>;
