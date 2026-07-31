import * as THREE from "three";

import { readBodyScale } from "./body-frame";
import { guardFindings, guardRegister, measureGuard, type MeasuredGuard } from "./guard-metrics";
import type {
  PreviewDebugOptions,
  PreviewReadout,
  PreviewReadoutRow,
  PreviewSceneId,
  PreviewShowcase,
  PreviewStatus,
} from "./preview-contracts";
import { ProceduralAltar, ProceduralMortar } from "./procedural-models";
import { bisectSkeleton, BurstParticles, explodeSkeleton, RigidEffect } from "./rigid-effects";
import { SkeletonSwordsman } from "./skeleton-swordsman";
import { applySwordGuardPose, SWORD_GRIP_SPAN, SWORD_GUARD_POSES, type SwordGuardPose } from "./sword-guard-poses";
import { ATTACK_DURATION_SECONDS, sampleSwordAttack } from "./sword-attack-motion";
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

const GUARD_LABELS: Readonly<Record<SwordGuardPose, string>> = {
  middle: "Middle",
  high: "High",
  low: "Low",
  backRight: "Back right",
  hangingRight: "Hanging right",
  insideLeft: "Inside left",
  closeLeft: "Close left",
  hangingLeft: "Hanging left",
  insideRight: "Inside right",
  closeRight: "Close right",
  short: "Short",
  long: "Long",
  side: "Side",
  backLeft: "Back left",
};

/**
 * The three the reference plate leads with, and the only three tuned so far.
 *
 * The remaining eleven are selectable and are first drafts. Naming them here
 * rather than leaving the distinction in a commit message keeps the picker
 * honest about which poses have been looked at.
 */
const TUNED_GUARDS: ReadonlySet<SwordGuardPose> = new Set<SwordGuardPose>(["middle", "high", "low"]);

/**
 * Three-quarter, still facing the way the plate's figures face.
 *
 * A dead-on profile was tried first and does not survive a solid body. The
 * plate is a line drawing, so its figure hides nothing; a rendered skeleton
 * viewed from exactly the side puts both arms on the far centre line behind an
 * opaque ribcage, and three guards shipped looking armless while every
 * measurement agreed the arms were exactly where they should be — a hidden arm
 * reaches as far as a visible one.
 *
 * Turning the chest partly toward the camera brings the arms out in front of
 * the ribs without losing the silhouette the plate is read by. Orbit for the
 * true profile when the silhouette is the question.
 */
const GUARD_FACING = -Math.PI / 2 + 0.62;

class SwordAttackShowcase extends BaseShowcase {
  readonly description =
    "One long-sword guard at a time, turned to the profile the reference plate draws. Middle, High and Low are tuned; the other eleven are first drafts.";
  readonly id = "sword-attack" as const;
  readonly poseOptions = SWORD_GUARD_POSES.map((pose) => ({
    label: TUNED_GUARDS.has(pose) ? GUARD_LABELS[pose] : `${GUARD_LABELS[pose]} (draft)`,
    value: pose,
  }));
  readonly title = "Long-Sword Guard";

  private pose: SwordGuardPose = "middle";
  private readout: PreviewReadout | undefined;
  private skeleton: SkeletonSwordsman | undefined;

  constructor() {
    super();
    this.reset();
  }

  reset(): void {
    this.clear();

    const skeleton = new SkeletonSwordsman();
    applySwordGuardPose(skeleton, this.pose);
    skeleton.root.rotation.y = GUARD_FACING;
    skeleton.root.updateMatrixWorld(true);
    skeleton.setDebug(this.debug);
    this.root.add(skeleton.root);
    this.skeleton = skeleton;

    // Every guard is still measured on each rebuild, not only the visible one:
    // the register is a property of the set, and a pose tuned in isolation can
    // quietly collide with one nobody is looking at.
    this.readout = buildGuardReadout(measureEveryGuard(), this.pose, skeleton);
    this.update();
  }

  update(): void {
    const row = this.readout?.rows.find((entry) => entry.label === GUARD_LABELS[this.pose]);
    this.status = {
      detail: row?.flagged === true ? "the instrument flagged this guard" : "reachable, grounded, balanced",
      normalizedTime: 0,
      phase: GUARD_LABELS[this.pose],
      state: TUNED_GUARDS.has(this.pose) ? "tuned against the plate" : "first draft, not yet looked at",
    };
  }

  readReadout(): PreviewReadout | undefined {
    return this.readout;
  }

  setPose(value: string): void {
    if ((SWORD_GUARD_POSES as readonly string[]).includes(value)) {
      this.pose = value as SwordGuardPose;
      this.reset();
    }
  }

  override setDebug(options: PreviewDebugOptions): void {
    super.setDebug(options);
    this.skeleton?.setDebug(options);
  }
}

/** Pose a throwaway body once per guard, so the register covers the set rather than the visible one. */
function measureEveryGuard(): MeasuredGuard[] {
  const probe = new SkeletonSwordsman();
  const measured = SWORD_GUARD_POSES.map((pose) => {
    applySwordGuardPose(probe, pose);
    return { label: GUARD_LABELS[pose], metrics: measureGuard(probe) };
  });

  probe.dispose();
  return measured;
}

/**
 * Turn the measurements into something readable without opening the source.
 *
 * The register goes in the notes rather than the table because it is a property
 * of the set rather than of any one guard, and with fourteen poses the failure
 * that matters is not one looking wrong but two looking alike.
 */
function buildGuardReadout(
  measured: readonly MeasuredGuard[],
  selected: SwordGuardPose,
  sample: SkeletonSwordsman,
): PreviewReadout {
  const findings = guardFindings(measured, SWORD_GRIP_SPAN);
  const flagged = new Set(findings.map((finding) => finding.guard));
  const rows: PreviewReadoutRow[] = measured.map(({ label, metrics }) => ({
    cells: [
      `${metrics.reachRight.toFixed(2)} / ${metrics.reachLeft.toFixed(2)}`,
      `${metrics.hilt.up.toFixed(2)} ${metrics.hilt.forward.toFixed(2)} ${metrics.hilt.side.toFixed(2)}`,
      `${metrics.tip.height.toFixed(2)} ${Math.round(metrics.tip.pitch)}° ${Math.round(metrics.tip.yaw)}°`,
      `${Math.round(metrics.edge)}°`,
      metrics.balance.toFixed(2),
    ],
    flagged: flagged.has(label),
    label,
    selected: label === GUARD_LABELS[selected],
  }));

  const notes: string[] = [];
  const scale = readBodyScale(sample);
  notes.push(
    `Rig: arm ${scale.arm.toFixed(2)}, leg ${scale.leg.toFixed(2)}, ` +
      `arm is ${((100 * scale.arm) / scale.shoulderHeight).toFixed(0)}% of shoulder height (human is near 36%).`,
  );
  if (findings.length === 0) {
    notes.push(
      "No findings: every arm within reach, every foot on the floor, every grip at span, every body over its feet.",
    );
  }
  for (const finding of findings) {
    notes.push(`${finding.guard} — ${finding.detail}`);
  }
  for (const collision of guardRegister(measured).slice(0, 3)) {
    notes.push(`Closest pair: ${collision.left} ~ ${collision.right} at ${collision.distance.toFixed(2)}`);
  }

  return {
    columns: ["Guard", "Reach R/L", "Hilt u·f·s", "Tip h·pitch·yaw", "Edge", "Balance"],
    notes,
    rows,
    title: "Guard measurements",
  };
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
