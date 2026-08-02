import * as THREE from "three";

import type { SkeletonPart } from "./skeleton-swordsman";
import { SkeletonSwordsman } from "./skeleton-swordsman";
import { disposeObject, seededRandom } from "./preview-utils";

type RigidBody = {
  angularVelocity: THREE.Vector3;
  node: THREE.Group;
  radius: number;
  sleeping: boolean;
  stillTime: number;
  velocity: THREE.Vector3;
};

export class RigidEffect {
  private accumulator = 0;

  constructor(
    readonly root: THREE.Group,
    private readonly bodies: RigidBody[],
  ) {}

  dispose(): void {
    disposeObject(this.root);
    this.root.removeFromParent();
  }

  update(deltaSeconds: number): void {
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
      if (body.sleeping) continue;

      body.velocity.y -= 9.81 * deltaSeconds;
      body.node.position.addScaledVector(body.velocity, deltaSeconds);

      const angularSpeed = body.angularVelocity.length();
      if (angularSpeed > 0.0001) {
        axis.copy(body.angularVelocity).normalize();
        spin.setFromAxisAngle(axis, angularSpeed * deltaSeconds);
        body.node.quaternion.premultiply(spin).normalize();
      }

      const floor = body.radius * 0.46;
      if (body.node.position.y < floor) {
        body.node.position.y = floor;
        if (body.velocity.y < 0) {
          body.velocity.y *= -0.36;
        }
        const friction = Math.pow(0.28, deltaSeconds);
        body.velocity.x *= friction;
        body.velocity.z *= friction;
        body.angularVelocity.multiplyScalar(Math.pow(0.18, deltaSeconds));
      }

      body.velocity.multiplyScalar(Math.pow(0.985, deltaSeconds * 60));
      const quiet = body.velocity.lengthSq() < 0.01 && body.angularVelocity.lengthSq() < 0.03;
      body.stillTime = quiet ? body.stillTime + deltaSeconds : 0;
      if (body.stillTime > 0.55) {
        body.sleeping = true;
      }
    }
  }
}

function createBodyAroundParts(container: THREE.Group, parts: readonly SkeletonPart[]): THREE.Group {
  const center = new THREE.Vector3();
  for (const part of parts) {
    center.add(part.node.getWorldPosition(new THREE.Vector3()));
  }
  center.multiplyScalar(1 / Math.max(1, parts.length));

  const body = new THREE.Group();
  container.add(body);
  body.position.copy(center);
  for (const part of parts) {
    body.attach(part.node);
  }
  return body;
}

export function bisectSkeleton(skeleton: SkeletonSwordsman, container: THREE.Group): RigidEffect {
  skeleton.root.updateMatrixWorld(true);
  const upperParts = skeleton.parts.filter((part) => part.group === "upper");
  const lowerParts = skeleton.parts.filter((part) => part.group === "lower");
  const upper = createBodyAroundParts(container, upperParts);
  const lower = createBodyAroundParts(container, lowerParts);
  skeleton.root.visible = false;

  const bodies: RigidBody[] = [
    {
      angularVelocity: new THREE.Vector3(0.8, 0.25, -1.1),
      node: upper,
      radius: 0.68,
      sleeping: false,
      stillTime: 0,
      velocity: new THREE.Vector3(1.25, 3.25, -0.35),
    },
    {
      angularVelocity: new THREE.Vector3(-0.35, 0.18, 0.42),
      node: lower,
      radius: 0.72,
      sleeping: false,
      stillTime: 0,
      velocity: new THREE.Vector3(-0.35, 1.05, 0.25),
    },
  ];

  return new RigidEffect(container, bodies);
}

export function explodeSkeleton(
  skeleton: SkeletonSwordsman,
  container: THREE.Group,
  origin: THREE.Vector3,
  seed = 0x51ce,
): RigidEffect {
  skeleton.root.updateMatrixWorld(true);
  const random = seededRandom(seed);
  const bodies: RigidBody[] = [];

  for (const part of skeleton.parts) {
    const body = createBodyAroundParts(container, [part]);
    const outward = body.position
      .clone()
      .sub(origin)
      .setY(Math.max(0.18, body.position.y - origin.y))
      .normalize();
    const scatter = new THREE.Vector3(random() - 0.5, random() * 0.8, random() - 0.5);
    const impulse = outward.multiplyScalar(4.2 + random() * 5.2).add(scatter.multiplyScalar(3.2));
    impulse.y += 2.8 + random() * 4.5;

    bodies.push({
      angularVelocity: new THREE.Vector3((random() - 0.5) * 11, (random() - 0.5) * 11, (random() - 0.5) * 11),
      node: body,
      radius: part.radius,
      sleeping: false,
      stillTime: 0,
      velocity: impulse,
    });
  }

  skeleton.root.visible = false;
  return new RigidEffect(container, bodies);
}

export class BurstParticles {
  readonly points: THREE.Points;
  private readonly ages: Float32Array;
  private readonly velocities: THREE.Vector3[];
  private elapsed = 0;

  constructor(
    container: THREE.Object3D,
    origin: THREE.Vector3,
    options: Readonly<{ color: THREE.ColorRepresentation; count: number; seed: number }>,
  ) {
    const random = seededRandom(options.seed);
    const positions = new Float32Array(options.count * 3);
    this.ages = new Float32Array(options.count);
    this.velocities = [];

    for (let index = 0; index < options.count; index += 1) {
      const direction = new THREE.Vector3(random() - 0.5, random(), random() - 0.5)
        .normalize()
        .multiplyScalar(1.4 + random() * 4.4);
      this.velocities.push(direction);
      positions[index * 3] = origin.x;
      positions[index * 3 + 1] = origin.y;
      positions[index * 3 + 2] = origin.z;
      this.ages[index] = random() * 0.16;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color: options.color,
      depthWrite: false,
      opacity: 0.92,
      size: 0.12,
      transparent: true,
    });
    this.points = new THREE.Points(geometry, material);
    container.add(this.points);
  }

  dispose(): void {
    disposeObject(this.points);
    this.points.removeFromParent();
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const position = this.points.geometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) return;

    for (let index = 0; index < this.velocities.length; index += 1) {
      const velocity = this.velocities[index];
      if (!velocity) continue;
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
    const material = this.points.material;
    if (material instanceof THREE.PointsMaterial) {
      material.opacity = Math.max(0, 0.92 - this.elapsed * 0.55);
    }
  }
}
