/**
 * Presentation-only particles.
 *
 * Nothing in the simulation reads this file. Every burst here is raised by something that already
 * happened — a wall took a hit, a body came apart, a rock landed — so the particles can be dropped
 * entirely without changing a single outcome, and the cap below does exactly that when the screen
 * gets busy.
 */

import type { SfxCueId } from "@/content/sfx/sfx-cue-definitions";
import { playSfx } from "@/presentation/audio/sfx";

export type DemoParticleKind = "blood" | "stoneChip" | "woodChip" | "dust" | "ember" | "splash" | "bone";

/**
 * What each spray sounds like.
 *
 * A total map rather than a branch chain, so a particle kind added later cannot compile without an
 * answer here. This is the coverage floor: every kind of spray already marks a moment worth hearing, so
 * hanging a sound on the funnel means nothing that throws particles is silent, even before anything is
 * hooked at the place it actually happened.
 */
const PARTICLE_CUES: Readonly<Record<DemoParticleKind, SfxCueId>> = {
  blood: "particleBlood",
  stoneChip: "particleStoneChip",
  woodChip: "particleWoodChip",
  dust: "particleDust",
  ember: "particleEmber",
  splash: "particleSplash",
  bone: "particleBone",
};

export type DemoParticle = {
  kind: DemoParticleKind;
  x: number;
  y: number;
  z: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  gravity: number;
  drag: number;
  size: number;
  age: number;
  life: number;
  spin: number;
  /** Set once a particle has settled, so blood only stains the floor at the moment it lands. */
  landed: boolean;
};

/** Beyond this the oldest are dropped. Chosen so a bomb in a crowd cannot stall a frame. */
const PARTICLE_LIMIT = 420;

export type DemoParticleField = { items: DemoParticle[] };

export function createParticleField(): DemoParticleField {
  return { items: [] };
}

function random(from: number, to: number): number {
  return from + Math.random() * (to - from);
}

function push(field: DemoParticleField, particle: DemoParticle): void {
  if (field.items.length >= PARTICLE_LIMIT) {
    field.items.shift();
  }

  field.items.push(particle);
}

/**
 * Throws a spray outward from a point.
 *
 * `spreadZ` is separate from the horizontal spread because the two read very differently: chips off
 * a wall go sideways and drop, while blood goes up first and then drops, and that arc is most of
 * what tells the two apart at a glance.
 */
export function burst(
  field: DemoParticleField,
  kind: DemoParticleKind,
  x: number,
  y: number,
  z: number,
  count: number,
  options: Readonly<{
    speed?: number;
    spreadZ?: number;
    gravity?: number;
    drag?: number;
    size?: number;
    life?: number;
    directionX?: number;
    directionY?: number;
    focus?: number;
  }> = {},
): void {
  const speed = options.speed ?? 3;
  const spreadZ = options.spreadZ ?? 2;
  const gravity = options.gravity ?? 9;
  const drag = options.drag ?? 1.4;
  const size = options.size ?? 0.08;
  const life = options.life ?? 1.1;
  const focus = options.focus ?? 0;
  const facing = Math.atan2(options.directionY ?? 0, options.directionX ?? 1);

  // One sound per burst, not per particle: the spray is one event however many pieces it throws.
  playSfx(PARTICLE_CUES[kind], { x, y });

  for (let index = 0; index < count; index += 1) {
    // With `focus` at one every particle leaves along the given direction; at zero the spray is
    // even in every direction. Wall chips want the former, a corpse the latter.
    const angle = facing + random(-Math.PI, Math.PI) * (1 - focus);
    const launch = speed * random(0.45, 1.25);
    push(field, {
      kind,
      x,
      y,
      z,
      velocityX: Math.cos(angle) * launch,
      velocityY: Math.sin(angle) * launch,
      velocityZ: random(0.15, 1) * spreadZ,
      gravity,
      drag,
      size: size * random(0.65, 1.4),
      age: 0,
      life: life * random(0.7, 1.3),
      spin: random(-8, 8),
      landed: false,
    });
  }
}

/**
 * A body coming apart, thrown outward from where it stood.
 *
 * Four of the six deaths lean on this rather than on baked frames: a cleaved body needs its halves
 * separating, a blasted one is nothing but the scatter, and the two held poses are single frames
 * with the bones doing the rest of the work. `violence` is how hard the death threw them — a bomb
 * sends them further and higher than a blade does — and it is the only thing that varies, because
 * the fragments themselves are the same bones whatever took them off the body.
 *
 * Fragments only. Nothing here becomes a prop and nothing here can be picked up: what killing a
 * skeleton is worth is one drop table and this is not it.
 */
export function shatterBones(field: DemoParticleField, x: number, y: number, violence: number): void {
  burst(field, "bone", x, y, 0.62, 6 + Math.round(violence * 2), {
    speed: 2.4 + violence * 3.4,
    spreadZ: 2.2 + violence * 1.6,
    gravity: 11,
    drag: 0.9,
    size: 0.09,
    life: 1.3,
  });
}

export type ParticleLanding = Readonly<{ kind: DemoParticleKind; x: number; y: number }>;

/**
 * Advances every particle and reports the ones that touched down this tick.
 *
 * The landings are what the blood staining hangs off: a drop marks the floor where it actually
 * fell, so a spray leaves a scatter and a pool leaves a pool, without anyone authoring either.
 */
export function stepParticles(
  field: DemoParticleField,
  deltaSeconds: number,
  blocked: (x: number, y: number) => boolean,
): ParticleLanding[] {
  const landings: ParticleLanding[] = [];

  for (let index = field.items.length - 1; index >= 0; index -= 1) {
    const particle = field.items[index] as DemoParticle;
    particle.age += deltaSeconds;

    if (particle.age >= particle.life) {
      field.items.splice(index, 1);
      continue;
    }

    if (particle.landed) {
      continue;
    }

    const decay = Math.exp(-particle.drag * deltaSeconds);
    particle.velocityX *= decay;
    particle.velocityY *= decay;
    particle.velocityZ -= particle.gravity * deltaSeconds;
    const nextX = particle.x + particle.velocityX * deltaSeconds;
    const nextY = particle.y + particle.velocityY * deltaSeconds;

    // Walls stop a particle dead rather than deflecting it; a chip that slides along a wall reads
    // as a bug, and one that stops reads as having hit something.
    if (blocked(nextX, nextY)) {
      particle.velocityX = 0;
      particle.velocityY = 0;
    } else {
      particle.x = nextX;
      particle.y = nextY;
    }

    particle.z += particle.velocityZ * deltaSeconds;

    if (particle.z <= 0.02) {
      particle.z = 0.02;
      particle.landed = true;
      particle.velocityX = 0;
      particle.velocityY = 0;
      particle.velocityZ = 0;
      landings.push({ kind: particle.kind, x: particle.x, y: particle.y });
    }
  }

  return landings;
}
