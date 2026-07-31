import * as THREE from "three";

import { addShadowFlags, createStandardMaterial, disposeObject, setObjectWireframe } from "./preview-utils";

export type SkeletonBoneName =
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "leftShoulder"
  | "leftElbow"
  | "leftHand"
  | "rightShoulder"
  | "rightElbow"
  | "rightHand"
  | "leftHip"
  | "leftKnee"
  | "leftFoot"
  | "rightHip"
  | "rightKnee"
  | "rightFoot";

export type SkeletonPart = Readonly<{
  group: "lower" | "upper";
  node: THREE.Object3D;
  radius: number;
  role: string;
}>;

const BONE_COLOR = 0xd7c9a4;
const DARK_BONE_COLOR = 0x9d8f70;
const STEEL_COLOR = 0xc8d0d8;

/**
 * The sword's own axes, expressed in the hand bone's local space.
 *
 * The model is built with its blade along `+Y` and its edges along `±X` — the
 * blade box is wider than it is thick — and it is then parented to the hand
 * turned a quarter turn about `Z`, which maps `+Y` to `−X` and `+X` to `+Y`.
 *
 * Both axes are exported because orienting a sword needs both. Aiming the blade
 * alone leaves the roll to whatever the shortest rotation arc happened to
 * produce, and a longsword guard is partly defined by which way its edge faces:
 * several of the fourteen share a hilt and a blade direction and are told apart
 * by nothing else.
 */
export const SWORD_BLADE_AXIS = new THREE.Vector3(-1, 0, 0);
export const SWORD_EDGE_AXIS = new THREE.Vector3(0, 1, 0);

function segment(length: number, radius = 0.105, color = BONE_COLOR): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.72, radius, length, 7),
    createStandardMaterial(color),
  );
  mesh.position.y = length / 2;
  return mesh;
}

function joint(radius = 0.14): THREE.Mesh {
  return new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), createStandardMaterial(BONE_COLOR));
}

function attachPart(
  parts: SkeletonPart[],
  bone: THREE.Bone,
  node: THREE.Object3D,
  role: string,
  group: "lower" | "upper",
  radius: number,
): void {
  bone.add(node);
  parts.push({ group, node, radius, role });
}

function createRibcage(): THREE.Group {
  const ribs = new THREE.Group();
  const material = createStandardMaterial(BONE_COLOR);

  for (let index = 0; index < 4; index += 1) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.48 - index * 0.025, 0.055, 5, 12), material);
    rib.rotation.x = Math.PI / 2;
    rib.scale.y = 0.58;
    rib.position.y = index * 0.2 + 0.08;
    ribs.add(rib);
  }

  const sternum = segment(0.82, 0.06, DARK_BONE_COLOR);
  sternum.position.set(0, 0.02, 0.28);
  ribs.add(sternum);
  return ribs;
}

function createSkull(): THREE.Group {
  const skull = new THREE.Group();
  const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.31, 1), createStandardMaterial(BONE_COLOR));
  cranium.scale.set(0.82, 1, 0.82);
  cranium.position.y = 0.22;

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.28), createStandardMaterial(DARK_BONE_COLOR));
  jaw.position.set(0, -0.03, 0.02);

  const socketMaterial = new THREE.MeshBasicMaterial({ color: 0x16130f });
  for (const x of [-0.11, 0.11]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 6), socketMaterial);
    socket.position.set(x, 0.24, 0.255);
    socket.scale.z = 0.35;
    skull.add(socket);
  }

  skull.add(cranium, jaw);
  return skull;
}

function createSword(): Readonly<{ model: THREE.Group; tip: THREE.Object3D }> {
  const model = new THREE.Group();
  const steel = createStandardMaterial(STEEL_COLOR);
  steel.metalness = 0.72;
  steel.roughness = 0.22;

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.105, 1.45, 0.035), steel);
  blade.position.y = 0.86;
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 4), steel);
  point.position.y = 1.69;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.12), createStandardMaterial(0x92713c));
  guard.position.y = 0.1;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.38, 8), createStandardMaterial(0x38251c));
  grip.position.y = -0.12;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), createStandardMaterial(0x92713c));
  pommel.position.y = -0.34;
  const tip = new THREE.Object3D();
  tip.position.y = 1.82;
  model.add(blade, point, guard, grip, pommel, tip);
  return { model, tip };
}

export class SkeletonSwordsman {
  readonly bones = new Map<SkeletonBoneName, THREE.Bone>();
  readonly helper: THREE.SkeletonHelper;
  readonly parts: SkeletonPart[] = [];
  readonly root = new THREE.Group();
  readonly swordTip: THREE.Object3D;

  private readonly baseQuaternions = new Map<SkeletonBoneName, THREE.Quaternion>();
  private readonly basePositions = new Map<SkeletonBoneName, THREE.Vector3>();

  constructor(options: Readonly<{ sword?: boolean }> = {}) {
    this.root.name = "skeleton-swordsman";

    const createBone = (name: SkeletonBoneName, parent: THREE.Object3D, position: THREE.Vector3Tuple): THREE.Bone => {
      const bone = new THREE.Bone();
      bone.name = name;
      bone.position.set(...position);
      parent.add(bone);
      this.bones.set(name, bone);
      return bone;
    };

    const hips = createBone("hips", this.root, [0, 1.72, 0]);
    const spine = createBone("spine", hips, [0, 0.24, 0]);
    const chest = createBone("chest", spine, [0, 0.72, 0]);
    const neck = createBone("neck", chest, [0, 0.68, 0]);
    const head = createBone("head", neck, [0, 0.24, 0]);

    const leftShoulder = createBone("leftShoulder", chest, [0.5, 0.56, 0]);
    const leftElbow = createBone("leftElbow", leftShoulder, [0.53, -0.03, 0]);
    createBone("leftHand", leftElbow, [0.48, 0, 0]);
    const rightShoulder = createBone("rightShoulder", chest, [-0.5, 0.56, 0]);
    const rightElbow = createBone("rightElbow", rightShoulder, [-0.53, -0.03, 0]);
    createBone("rightHand", rightElbow, [-0.48, 0, 0]);

    const leftHip = createBone("leftHip", hips, [0.22, 0, 0]);
    const leftKnee = createBone("leftKnee", leftHip, [0, -0.8, 0]);
    createBone("leftFoot", leftKnee, [0, -0.78, 0]);
    const rightHip = createBone("rightHip", hips, [-0.22, 0, 0]);
    const rightKnee = createBone("rightKnee", rightHip, [0, -0.8, 0]);
    createBone("rightFoot", rightKnee, [0, -0.78, 0]);

    attachPart(this.parts, hips, joint(0.25), "pelvis", "lower", 0.25);
    attachPart(this.parts, spine, segment(0.62, 0.085, DARK_BONE_COLOR), "spine", "upper", 0.32);
    attachPart(this.parts, chest, createRibcage(), "ribcage", "upper", 0.48);
    attachPart(this.parts, neck, segment(0.24, 0.085), "neck", "upper", 0.13);
    attachPart(this.parts, head, createSkull(), "skull", "upper", 0.3);

    const limbPairs: readonly [SkeletonBoneName, SkeletonBoneName, number, "lower" | "upper"][] = [
      ["leftShoulder", "leftElbow", 0.53, "upper"],
      ["leftElbow", "leftHand", 0.48, "upper"],
      ["rightShoulder", "rightElbow", 0.53, "upper"],
      ["rightElbow", "rightHand", 0.48, "upper"],
      ["leftHip", "leftKnee", 0.8, "lower"],
      ["leftKnee", "leftFoot", 0.78, "lower"],
      ["rightHip", "rightKnee", 0.8, "lower"],
      ["rightKnee", "rightFoot", 0.78, "lower"],
    ];

    for (const [startName, endName, length, group] of limbPairs) {
      const start = this.getBone(startName);
      const end = this.getBone(endName);
      const node = new THREE.Group();
      const boneMesh = segment(length, group === "lower" ? 0.115 : 0.09);
      boneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.position.clone().normalize());
      boneMesh.position.copy(end.position).multiplyScalar(0.5);
      node.add(boneMesh, joint(group === "lower" ? 0.135 : 0.115));
      attachPart(this.parts, start, node, startName, group, length * 0.34);
    }

    for (const footName of ["leftFoot", "rightFoot"] as const) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.52), createStandardMaterial(BONE_COLOR));
      foot.position.set(0, -0.06, 0.18);
      attachPart(this.parts, this.getBone(footName), foot, footName, "lower", 0.25);
    }

    for (const handName of ["leftHand", "rightHand"] as const) {
      const hand = joint(0.12);
      hand.scale.set(0.78, 1.15, 0.72);
      attachPart(this.parts, this.getBone(handName), hand, handName, "upper", 0.12);
    }

    if (options.sword !== false) {
      const sword = createSword();
      this.swordTip = sword.tip;
      sword.model.position.set(0, -0.08, 0);
      sword.model.rotation.z = Math.PI / 2;
      this.getBone("rightHand").add(sword.model);
      this.parts.push({
        group: "upper",
        node: sword.model,
        radius: 0.42,
        role: "sword",
      });
    } else {
      this.swordTip = new THREE.Object3D();
      this.getBone("rightHand").add(this.swordTip);
    }

    for (const [name, bone] of this.bones) {
      this.baseQuaternions.set(name, bone.quaternion.clone());
      this.basePositions.set(name, bone.position.clone());
    }

    this.helper = new THREE.SkeletonHelper(this.root);
    const helperMaterials = Array.isArray(this.helper.material) ? this.helper.material : [this.helper.material];
    for (const material of helperMaterials) {
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.72;
    }
    this.helper.visible = false;
    this.root.add(this.helper);
    addShadowFlags(this.root);
  }

  dispose(): void {
    disposeObject(this.root);
  }

  getBone(name: SkeletonBoneName): THREE.Bone {
    const bone = this.bones.get(name);
    if (!bone) {
      throw new Error(`Skeleton bone not found: ${name}`);
    }
    return bone;
  }

  /**
   * Where a bone sits before anything poses it.
   *
   * The body's own ruler is derived from these — arm length, leg length, the
   * height a foot rests at — so the measurements a guard reports stay tied to
   * the rig rather than to constants copied out of it.
   */
  restPosition(name: SkeletonBoneName): THREE.Vector3 {
    const position = this.basePositions.get(name);
    if (!position) {
      throw new Error(`Skeleton bone not found: ${name}`);
    }
    return position.clone();
  }

  resetPose(): void {
    for (const [name, bone] of this.bones) {
      const position = this.basePositions.get(name);
      const quaternion = this.baseQuaternions.get(name);
      if (position && quaternion) {
        bone.position.copy(position);
        bone.quaternion.copy(quaternion);
        bone.scale.setScalar(1);
      }
    }
    this.root.position.set(0, 0, 0);
    this.root.quaternion.identity();
  }

  setDebug(options: Readonly<{ helpers: boolean; wireframe: boolean }>): void {
    this.helper.visible = options.helpers;
    setObjectWireframe(this.root, options.wireframe);
  }

  swordTipWorld(target = new THREE.Vector3()): THREE.Vector3 {
    return this.swordTip.getWorldPosition(target);
  }
}
