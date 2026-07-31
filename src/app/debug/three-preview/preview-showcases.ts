import * as THREE from "three";

import type { PreviewDebugOptions, PreviewSceneId, PreviewShowcase, PreviewStatus } from "./preview-contracts";
import { ProceduralAltar, ProceduralMortar } from "./procedural-models";
import { bisectSkeleton, BurstParticles, explodeSkeleton, RigidEffect } from "./rigid-effects";
import { SkeletonSwordsman } from "./skeleton-swordsman";
import { ATTACK_DURATION_SECONDS, sampleSwordAttack, type AttackSample } from "./sword-attack-motion";
import { createStandardMaterial, disposeObject, setObjectWireframe } from "./preview-utils";

abstract class BaseShowcase implements PreviewShowcase {
  abstract readonly description: string;
  abstract readonly id: PreviewSceneId;
  readonly root = new THREE.Group();
  abstract readonly title: string;

  protected debug: PreviewDebugOptions = { helpers: false, wireframe: false };
  protected elapsed = 0;
  protected status: PreviewStatus = {
    normalizedTime: 0,
    phase: "ready",
    state: "ready",
  };

  dispose(): void {
    disposeObject(this.root);
    this.root.removeFromParent();
  }

  readStatus(): PreviewStatus {
    return this.status;
  }

  setDebug(options: PreviewDebugOptions): void {
    this.debug = options;
    setObjectWireframe(this.root, options.wireframe);
  }

  abstract reset(): void;
  abstract update(deltaSeconds: number): void;

  protected clear(): void {
    disposeObject(this.root);
    this.root.clear();
    this.elapsed = 0;
  }
}

class SwordAttackShowcase extends BaseShowcase {
  readonly description =
    "Quaternion-slerped full-body sword attack with readable anticipation, step, slash, recovery, and a live sword-tip trail.";
  readonly id = "sword-attack" as const;
  readonly title = "Skeleton Sword Attack";

  private attack: AttackSample = { finished: false, normalizedTime: 0, phase: "idle" };
  private skeleton!: SkeletonSwordsman;
  private trail!: THREE.Line;
  private readonly trailPoints: THREE.Vector3[] = [];

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();
    this.skeleton = new SkeletonSwordsman();
    this.skeleton.root.rotation.y = -0.28;
    this.root.add(this.skeleton.root);
    const trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new THREE.BufferAttribute(new Float32Array(28 * 3), 3);
    trailPositions.setUsage(THREE.DynamicDrawUsage);
    trailGeometry.setAttribute("position", trailPositions);
    trailGeometry.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: 0xffca66,
        transparent: true,
        opacity: 0.82,
      }),
    );
    this.trail.frustumCulled = false;
    this.root.add(this.trail);
    this.trailPoints.length = 0;
    this.skeleton.setDebug(this.debug);
    this.update(0);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.attack = sampleSwordAttack(this.skeleton, this.elapsed);
    const tip = this.skeleton.swordTipWorld();
    this.root.worldToLocal(tip);
    this.trailPoints.push(tip);
    if (this.trailPoints.length > 28) this.trailPoints.shift();
    const positions = this.trail.geometry.getAttribute("position");
    if (positions instanceof THREE.BufferAttribute) {
      for (let index = 0; index < this.trailPoints.length; index += 1) {
        const point = this.trailPoints[index];
        if (point) positions.setXYZ(index, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
      this.trail.geometry.setDrawRange(0, this.trailPoints.length);
    }
    const trailMaterial = this.trail.material;
    if (trailMaterial instanceof THREE.LineBasicMaterial) {
      trailMaterial.opacity = this.attack.phase === "slash" ? 0.95 : 0.34;
    }
    this.status = {
      detail: `sword tip ${tip.x.toFixed(2)}, ${tip.y.toFixed(2)}, ${tip.z.toFixed(2)}`,
      normalizedTime: this.attack.normalizedTime,
      phase: this.attack.phase,
      state: this.attack.finished ? "complete" : "playing",
    };
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.skeleton.setDebug(options);
  }
}

class BisectShowcase extends BaseShowcase {
  readonly description =
    "The live animated pose is captured at blade contact, then the upper and lower assemblies separate without snapping to bind pose.";
  readonly id = "skeleton-bisect" as const;
  readonly title = "Pose-Preserving Bisection";

  private effect: RigidEffect | undefined;
  private flash: BurstParticles | undefined;
  private skeleton!: SkeletonSwordsman;
  private split = false;
  private readonly splitAt = ATTACK_DURATION_SECONDS * 0.515;
  private readonly totalDuration = 5.4;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();
    this.effect = undefined;
    this.flash = undefined;
    this.split = false;
    this.skeleton = new SkeletonSwordsman();
    this.skeleton.root.rotation.y = -0.2;
    this.root.add(this.skeleton.root);
    this.skeleton.setDebug(this.debug);
    sampleSwordAttack(this.skeleton, 0);
    this.status = { normalizedTime: 0, phase: "approach", state: "playing" };
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (!this.split) {
      const attack = sampleSwordAttack(this.skeleton, Math.min(this.elapsed, this.splitAt));
      if (this.elapsed >= this.splitAt) {
        const fragments = new THREE.Group();
        this.root.add(fragments);
        this.effect = bisectSkeleton(this.skeleton, fragments);
        this.flash = new BurstParticles(this.root, new THREE.Vector3(0.1, 1.9, 0.45), {
          color: 0xff7a45,
          count: 28,
          seed: 0xb15e,
        });
        this.split = true;
      }
      this.status = {
        normalizedTime: Math.min(1, this.elapsed / this.totalDuration),
        phase: attack.phase,
        state: "capturing animated pose",
      };
    } else {
      this.effect?.update(deltaSeconds);
      this.flash?.update(deltaSeconds);
      this.status = {
        detail: "upper/lower world transforms retained",
        normalizedTime: Math.min(1, this.elapsed / this.totalDuration),
        phase: this.elapsed < this.splitAt + 0.35 ? "blade contact" : "separation",
        state: this.elapsed >= this.totalDuration ? "complete" : "physics",
      };
    }
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.skeleton.setDebug(options);
  }
}

class BoneExplosionShowcase extends BaseShowcase {
  readonly description =
    "Every visible bone and the equipped sword become deterministic rigid fragments with impulse, spin, gravity, bounce, friction, and sleep.";
  readonly id = "bone-explosion" as const;
  readonly title = "Bone Fragment Explosion";

  private burst: BurstParticles | undefined;
  private effect: RigidEffect | undefined;
  private exploded = false;
  private skeleton!: SkeletonSwordsman;
  private readonly explodeAt = 1.25;
  private readonly totalDuration = 5.5;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();
    this.burst = undefined;
    this.effect = undefined;
    this.exploded = false;
    this.skeleton = new SkeletonSwordsman();
    this.skeleton.root.rotation.y = -0.28;
    this.root.add(this.skeleton.root);
    this.skeleton.setDebug(this.debug);
    sampleSwordAttack(this.skeleton, 0.55);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    if (!this.exploded) {
      sampleSwordAttack(this.skeleton, 0.55 + Math.sin(this.elapsed * 2.4) * 0.06);
      if (this.elapsed >= this.explodeAt) {
        const fragments = new THREE.Group();
        this.root.add(fragments);
        const origin = new THREE.Vector3(0, 1.75, 0.15);
        this.effect = explodeSkeleton(this.skeleton, fragments, origin, 0xb0_0e);
        this.burst = new BurstParticles(this.root, origin, {
          color: 0xff9d52,
          count: 54,
          seed: 0xb00e,
        });
        this.exploded = true;
      }
    } else {
      this.effect?.update(deltaSeconds);
      this.burst?.update(deltaSeconds);
    }
    this.status = {
      detail: this.exploded ? "deterministic seed 0xB00E" : "impulse armed",
      normalizedTime: Math.min(1, this.elapsed / this.totalDuration),
      phase: this.exploded ? "fragment simulation" : "fuse",
      state: this.elapsed >= this.totalDuration ? "complete" : this.exploded ? "physics" : "playing",
    };
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.skeleton.setDebug(options);
  }
}

class AltarShowcase extends BaseShowcase {
  readonly description =
    "A procedural low-poly altar shifts from a cold silhouette into pulsing emissive runes, orbiting motes, and local purple light.";
  readonly id = "altar" as const;
  readonly title = "Procedural Ritual Altar";

  private altar!: ProceduralAltar;
  private readonly totalDuration = 5.5;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();
    this.altar = new ProceduralAltar();
    this.root.add(this.altar.root);
    this.altar.setDebug(this.debug);
    this.update(0);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    let strength = 0;
    let phase = "dormant";
    if (this.elapsed >= 1 && this.elapsed < 2.1) {
      strength = THREE.MathUtils.smoothstep(this.elapsed, 1, 2.1);
      phase = "awakening";
    } else if (this.elapsed >= 2.1) {
      strength = 1;
      phase = "active pulse";
    }
    this.altar.update(this.elapsed, strength);
    this.status = {
      detail: `energy ${Math.round(strength * 100)}%`,
      normalizedTime: Math.min(1, this.elapsed / this.totalDuration),
      phase,
      state: this.elapsed >= this.totalDuration ? "complete" : "playing",
    };
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.altar.setDebug(options);
  }
}

class MortarShowcase extends BaseShowcase {
  readonly description =
    "A hierarchical mortar aims, charges, recoils, and launches a true ballistic projectile; impact reuses the skeleton fragment system.";
  readonly id = "mortar" as const;
  readonly title = "Mortar Ballistic Impact";

  private burst: BurstParticles | undefined;
  private effect: RigidEffect | undefined;
  private flightStart = new THREE.Vector3();
  private impact = new THREE.Vector3();
  private impacted = false;
  private mortar!: ProceduralMortar;
  private projectile!: THREE.Mesh;
  private smoke: BurstParticles | undefined;
  private target!: SkeletonSwordsman;
  private trajectory!: THREE.Line;
  private velocity = new THREE.Vector3();
  private readonly fireAt = 1.55;
  private readonly flightDuration = 1.5;
  private readonly totalDuration = 6.3;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();
    this.burst = undefined;
    this.effect = undefined;
    this.impacted = false;
    this.smoke = undefined;

    this.mortar = new ProceduralMortar();
    this.mortar.root.position.set(-2.25, 0, -1.15);
    this.target = new SkeletonSwordsman({ sword: false });
    this.target.root.position.set(2.35, 0, 0.95);
    this.target.root.rotation.y = 0.45;
    this.root.add(this.mortar.root, this.target.root);
    this.impact.set(2.35, 1.55, 0.95);
    this.mortar.aimAt(this.impact);
    this.root.updateMatrixWorld(true);
    this.flightStart.copy(this.mortar.muzzle.getWorldPosition(new THREE.Vector3()));
    this.root.worldToLocal(this.flightStart);

    const gravity = new THREE.Vector3(0, -9.81, 0);
    this.velocity
      .copy(this.impact)
      .sub(this.flightStart)
      .addScaledVector(gravity, -0.5 * this.flightDuration * this.flightDuration)
      .divideScalar(this.flightDuration);

    this.projectile = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), createStandardMaterial(0x22282b));
    this.projectile.visible = false;
    this.projectile.castShadow = true;
    this.root.add(this.projectile);

    const trajectoryPoints: THREE.Vector3[] = [];
    for (let index = 0; index <= 32; index += 1) {
      const time = (index / 32) * this.flightDuration;
      trajectoryPoints.push(
        this.flightStart
          .clone()
          .addScaledVector(this.velocity, time)
          .addScaledVector(gravity, 0.5 * time * time),
      );
    }
    this.trajectory = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(trajectoryPoints),
      new THREE.LineDashedMaterial({
        color: 0x72d5ff,
        dashSize: 0.16,
        gapSize: 0.1,
        opacity: 0.58,
        transparent: true,
      }),
    );
    this.trajectory.computeLineDistances();
    this.root.add(this.trajectory);
    this.setDebug(this.debug);
    this.update(0);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const flightTime = this.elapsed - this.fireAt;
    let phase = "aim";

    if (this.elapsed < this.fireAt) {
      phase = this.elapsed < 0.7 ? "aim" : "charge";
      this.mortar.barrel.rotation.y = Math.sin(this.elapsed * 12) * this.elapsed * 0.004;
    } else if (flightTime <= this.flightDuration) {
      phase = "projectile flight";
      this.projectile.visible = true;
      this.projectile.position
        .copy(this.flightStart)
        .addScaledVector(this.velocity, flightTime)
        .addScaledVector(new THREE.Vector3(0, -9.81, 0), 0.5 * flightTime * flightTime);
      this.projectile.rotation.x += deltaSeconds * 8;
      this.projectile.rotation.z += deltaSeconds * 5;
      const recoilTime = Math.max(0, flightTime);
      this.mortar.recoil.position.y = -Math.sin(Math.min(1, recoilTime * 6) * Math.PI) * 0.28;
      if (!this.smoke) {
        this.smoke = new BurstParticles(this.root, this.flightStart, {
          color: 0xa7b0b2,
          count: 34,
          seed: 0x600d,
        });
      }
    } else {
      phase = this.impacted ? "impact / fragments" : "impact";
      this.projectile.visible = false;
      this.mortar.recoil.position.y *= Math.pow(0.02, deltaSeconds);
      if (!this.impacted) {
        const fragments = new THREE.Group();
        this.root.add(fragments);
        this.effect = explodeSkeleton(this.target, fragments, this.impact, 0xc4_11);
        this.burst = new BurstParticles(this.root, this.impact, {
          color: 0xffbb5d,
          count: 68,
          seed: 0xc411,
        });
        this.impacted = true;
      }
      this.effect?.update(deltaSeconds);
      this.burst?.update(deltaSeconds);
    }

    this.smoke?.update(deltaSeconds);
    this.status = {
      detail: this.impacted ? "shared bone explosion system" : "ballistic arc g = 9.81",
      normalizedTime: Math.min(1, this.elapsed / this.totalDuration),
      phase,
      state: this.elapsed >= this.totalDuration ? "complete" : "playing",
    };
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.mortar.setDebug(options);
    this.target.setDebug(options);
    this.trajectory.visible = options.helpers;
  }
}

export function createPreviewShowcase(id: PreviewSceneId): PreviewShowcase {
  switch (id) {
    case "sword-attack":
      return new SwordAttackShowcase();
    case "skeleton-bisect":
      return new BisectShowcase();
    case "bone-explosion":
      return new BoneExplosionShowcase();
    case "altar":
      return new AltarShowcase();
    case "mortar":
      return new MortarShowcase();
  }
}
