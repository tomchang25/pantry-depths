/**
 * The rig coming apart, and the burst of dust that says it did.
 *
 * Carried over from the preview experiment this workbench replaces, and rebuilt on the way: that
 * version scattered a procedural swordsman whose boxes were plain meshes it could reparent one by
 * one. This rig's boxes are skinned, one bone per box at full weight, so a box has no transform of
 * its own to fly — what moves it is the bone. So a piece here is a **bone**, detached out of the
 * armature into a body of its own, and the meshes bound to it follow because skinning reads the
 * bone's world matrix wherever that bone happens to hang.
 *
 * That makes six pieces, not eleven: root with the ribs and pelvis on it, the head, two arms, two
 * legs. It is the honest number for this rig, and it is the number `humanoid_block_bodies.plan.md`
 * exists to change — its fourth child makes a tagged part addressable, and this preview gets finer
 * on the day that lands rather than by being written as though it already had.
 */

import * as THREE from "three";

type RigidBody = {
  angularVelocity: THREE.Vector3;
  node: THREE.Object3D;
  radius: number;
  sleeping: boolean;
  stillTime: number;
  velocity: THREE.Vector3;
};

/** Which bones ride up when a body is cut in half, and which drop. Everything else goes with the top. */
const LOWER_BONES: ReadonlySet<string> = new Set(["leg_L", "leg_R"]);

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Where each detached piece came to rest, so the rig can be put back exactly as it was.
 *
 * Recorded rather than recomputed: a bone's rest transform is the armature's business and reading it
 * back out of the glTF after the fact would be trusting a second copy of it.
 */
type BonePlacement = Readonly<{
  bone: THREE.Object3D;
  parent: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}>;

export class Scatter {
  private accumulator = 0;
  private readonly bodies: RigidBody[] = [];
  private readonly placements: BonePlacement[] = [];
  private readonly particles: Particles | undefined;

  /**
   * @param pieces Bones to detach, grouped: every bone in one group flies as one rigid piece.
   * @param container Where the freed pieces hang while they fall. Never the armature.
   */
  constructor(
    pieces: readonly (readonly THREE.Object3D[])[],
    container: THREE.Object3D,
    options: Readonly<{ dust: boolean; origin: THREE.Vector3; seed: number }>,
  ) {
    const random = seededRandom(options.seed);

    for (const group of pieces) {
      const body = new THREE.Group();
      const centre = new THREE.Vector3();

      for (const bone of group) {
        centre.add(bone.getWorldPosition(new THREE.Vector3()));
        this.placements.push({
          bone,
          parent: bone.parent ?? container,
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
          scale: bone.scale.clone(),
        });
      }

      centre.multiplyScalar(1 / Math.max(1, group.length));
      container.add(body);
      body.position.copy(centre);

      // `attach` rather than `add`: the bone keeps the world transform it had, so the piece leaves
      // the body from exactly where it was standing rather than snapping to the group's origin.
      for (const bone of group) {
        body.attach(bone);
      }

      const outward = centre
        .clone()
        .sub(options.origin)
        .setY(Math.max(0.18, centre.y - options.origin.y))
        .normalize();
      const scatter = new THREE.Vector3(random() - 0.5, random() * 0.8, random() - 0.5);
      const impulse = outward.multiplyScalar(2.6 + random() * 3.4).add(scatter.multiplyScalar(1.8));
      impulse.y += 1.8 + random() * 2.6;

      this.bodies.push({
        angularVelocity: new THREE.Vector3((random() - 0.5) * 9, (random() - 0.5) * 9, (random() - 0.5) * 9),
        node: body,
        radius: 0.2,
        sleeping: false,
        stillTime: 0,
        velocity: impulse,
      });
    }

    this.particles = options.dust ? new Particles(container, options.origin, options.seed) : undefined;
  }

  /** Puts every bone back where the armature had it, and clears the debris. */
  restore(): void {
    for (const placement of this.placements) {
      placement.parent.add(placement.bone);
      placement.bone.position.copy(placement.position);
      placement.bone.quaternion.copy(placement.quaternion);
      placement.bone.scale.copy(placement.scale);
    }

    for (const body of this.bodies) {
      body.node.removeFromParent();
    }

    this.particles?.dispose();
    this.bodies.length = 0;
    this.placements.length = 0;
  }

  update(deltaSeconds: number): void {
    this.particles?.update(deltaSeconds);
    this.accumulator += Math.min(deltaSeconds, 0.05);
    const stepSeconds = 1 / 120;
    let substeps = 0;

    while (this.accumulator >= stepSeconds && substeps < 8) {
      this.integrate(stepSeconds);
      this.accumulator -= stepSeconds;
      substeps += 1;
    }
  }

  private integrate(deltaSeconds: number): void {
    const axis = new THREE.Vector3();
    const spin = new THREE.Quaternion();

    for (const body of this.bodies) {
      if (body.sleeping) {
        continue;
      }

      body.velocity.y -= 9.81 * deltaSeconds;
      body.node.position.addScaledVector(body.velocity, deltaSeconds);
      const angularSpeed = body.angularVelocity.length();

      if (angularSpeed > 0.0001) {
        axis.copy(body.angularVelocity).normalize();
        spin.setFromAxisAngle(axis, angularSpeed * deltaSeconds);
        body.node.quaternion.premultiply(spin).normalize();
      }

      if (body.node.position.y < body.radius) {
        body.node.position.y = body.radius;

        if (body.velocity.y < 0) {
          body.velocity.y *= -0.36;
        }

        const friction = 0.28 ** deltaSeconds;
        body.velocity.x *= friction;
        body.velocity.z *= friction;
        body.angularVelocity.multiplyScalar(0.18 ** deltaSeconds);
      }

      body.velocity.multiplyScalar(0.985 ** (deltaSeconds * 60));
      const quiet = body.velocity.lengthSq() < 0.01 && body.angularVelocity.lengthSq() < 0.03;
      body.stillTime = quiet ? body.stillTime + deltaSeconds : 0;

      if (body.stillTime > 0.55) {
        body.sleeping = true;
      }
    }
  }
}

/** The puff of bone dust a burst throws up. Additive points, gravity, and a fade. */
class Particles {
  private readonly ages: Float32Array;
  private elapsed = 0;
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly velocities: THREE.Vector3[] = [];

  constructor(container: THREE.Object3D, origin: THREE.Vector3, seed: number) {
    const count = 90;
    const random = seededRandom(seed ^ 0x9e37);
    const positions = new Float32Array(count * 3);
    this.ages = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      this.velocities.push(
        new THREE.Vector3(random() - 0.5, random(), random() - 0.5).normalize().multiplyScalar(1.4 + random() * 3.2),
      );
      positions[index * 3] = origin.x;
      positions[index * 3 + 1] = origin.y;
      positions[index * 3 + 2] = origin.z;
      this.ages[index] = random() * 0.16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xd7c9a4,
        depthWrite: false,
        opacity: 0.92,
        size: 0.06,
        transparent: true,
      }),
    );
    container.add(this.points);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points.removeFromParent();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const position = this.points.geometry.getAttribute("position");

    if (!(position instanceof THREE.BufferAttribute)) {
      return;
    }

    for (const [index, velocity] of this.velocities.entries()) {
      this.ages[index] = (this.ages[index] ?? 0) + deltaSeconds;
      velocity.y -= 4.8 * deltaSeconds;
      position.setXYZ(
        index,
        position.getX(index) + velocity.x * deltaSeconds,
        Math.max(0.03, position.getY(index) + velocity.y * deltaSeconds),
        position.getZ(index) + velocity.z * deltaSeconds,
      );
    }

    position.needsUpdate = true;
    this.points.material.opacity = Math.max(0, 0.92 - this.elapsed * 0.55);
  }
}

/** Every bone flies on its own, away from the body's middle. */
export function burstPieces(bones: ReadonlyMap<string, THREE.Object3D>): (readonly THREE.Object3D[])[] {
  return [...bones.values()].map((bone) => [bone]);
}

/** Two pieces: what was above the cut and what was below it. */
export function bisectPieces(bones: ReadonlyMap<string, THREE.Object3D>): (readonly THREE.Object3D[])[] {
  const upper: THREE.Object3D[] = [];
  const lower: THREE.Object3D[] = [];

  for (const [name, bone] of bones) {
    (LOWER_BONES.has(name) ? lower : upper).push(bone);
  }

  return [upper, lower].filter((group) => group.length > 0);
}
