/**
 * Presentation-only particles.
 *
 * Nothing in the simulation reads this file. Every burst here is raised by something that already
 * happened — a wall took a hit, a body came apart, a rock landed — so the particles can be dropped
 * entirely without changing a single outcome, and the cap below does exactly that when the screen
 * gets busy.
 */

export type DemoParticleKind = "blood" | "stoneChip" | "woodChip" | "dust" | "ember" | "splash";

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
