import * as THREE from "three";

import { BLOCK_WEAPONS, type BlockWeapon } from "@/presentation/scene-3d/block-clips";

/**
 * Procedural figures built to the exported rig's joint contract.
 *
 * The seven joints below carry the rest transforms read out of `skeleton-blocky.glb`. That is the
 * whole reason a figure assembled here can be driven by the clips loaded from that file: an
 * `AnimationClip` addresses its targets by node name, and every track in every clip names one of
 * these seven. A joint whose offset drifts from the exported value does not fail — it silently
 * mis-poses every clip, which is why the numbers are copied rather than re-derived.
 *
 * Reconstruction decisions for both figures live in their sculpt specs, authored through
 * img2threejs. What is transcribed here is the part table each spec settled on.
 */

export const BLOCKY_BODIES = ["skeleton", "zombie"] as const;
export type BlockyBody = (typeof BLOCKY_BODIES)[number];

export const BLOCKY_JOINTS = ["root", "head", "arm_L", "arm_R", "leg_L", "leg_R", "weapon"] as const;
export type BlockyJoint = (typeof BLOCKY_JOINTS)[number];

type Vector3Tuple = readonly [number, number, number];

type JointRecord = Readonly<{
  id: BlockyJoint;
  parent: BlockyJoint | undefined;
  position: Vector3Tuple;
  /** Half a turn about X on every limb: the bone points down its own +Y, as the exported rig does. */
  flipped: boolean;
}>;

/**
 * Joint rest transforms, in the parent joint's frame.
 *
 * Read from the exported rig rather than from the Blender source, because the export applies the
 * Z-up to Y-up conversion and it is the converted numbers the clips are keyed against.
 */
const JOINTS: readonly JointRecord[] = [
  { id: "root", parent: undefined, position: [0, 0.8, 0], flipped: false },
  { id: "head", parent: "root", position: [0, 0.6, 0], flipped: false },
  { id: "arm_L", parent: "root", position: [-0.29, 0.58, 0], flipped: true },
  { id: "arm_R", parent: "root", position: [0.29, 0.58, 0], flipped: true },
  { id: "leg_L", parent: "root", position: [-0.11, 0, 0], flipped: true },
  { id: "leg_R", parent: "root", position: [0.11, 0, 0], flipped: true },
  { id: "weapon", parent: "arm_R", position: [0, 0.62, 0], flipped: false },
];

type PartRecord = Readonly<{
  name: string;
  joint: BlockyJoint;
  position: Vector3Tuple;
  size: Vector3Tuple;
  material: string;
}>;

/**
 * The skeletal figure.
 *
 * Four rib slats rather than three, tapering away from the widest pair, because uniform slats read
 * as a ladder. The clavicles exist for the same kind of reason: without them the arms hang off
 * nothing, which is visible at every distance.
 */
const SKELETON_PARTS: readonly PartRecord[] = [
  { name: "Cranium", joint: "head", position: [0, 0.26, 0], size: [0.52, 0.44, 0.5], material: "bone" },
  // Narrower than the cranium and barely proud of it. At full width it read as a plate stuck to
  // the front of the skull rather than a ridge in it.
  { name: "BrowRidge", joint: "head", position: [0, 0.4, -0.238], size: [0.42, 0.06, 0.05], material: "boneShadow" },
  { name: "EyeSocket_L", joint: "head", position: [-0.12, 0.32, -0.252], size: [0.14, 0.12, 0.03], material: "socket" },
  { name: "EyeSocket_R", joint: "head", position: [0.12, 0.32, -0.252], size: [0.14, 0.12, 0.03], material: "socket" },
  { name: "NasalSlit", joint: "head", position: [0, 0.2, -0.252], size: [0.05, 0.11, 0.03], material: "socket" },
  // Below the cranium and forward of it. Set back and level, it sat inside the cranium's own volume
  // and the figure had no jaw at all.
  { name: "Mandible", joint: "head", position: [0, 0.015, -0.05], size: [0.38, 0.1, 0.34], material: "boneShadow" },
  { name: "Sacrum", joint: "root", position: [0, 0.06, 0.03], size: [0.18, 0.16, 0.12], material: "boneShadow" },
  // Small and high. At the earlier size the pair merged with the legs into a pair of shorts.
  { name: "Ilium_L", joint: "root", position: [-0.125, 0.14, 0], size: [0.12, 0.14, 0.13], material: "bone" },
  { name: "Ilium_R", joint: "root", position: [0.125, 0.14, 0], size: [0.12, 0.14, 0.13], material: "bone" },
  { name: "Vertebra_0", joint: "root", position: [0, 0.26, 0.07], size: [0.1, 0.1, 0.1], material: "boneShadow" },
  { name: "Vertebra_1", joint: "root", position: [0, 0.4, 0.07], size: [0.1, 0.1, 0.1], material: "boneShadow" },
  { name: "Vertebra_2", joint: "root", position: [0, 0.54, 0.07], size: [0.1, 0.1, 0.1], material: "boneShadow" },
  { name: "Rib_0", joint: "root", position: [0, 0.24, -0.01], size: [0.4, 0.075, 0.19], material: "bone" },
  { name: "Rib_1", joint: "root", position: [0, 0.37, -0.01], size: [0.46, 0.075, 0.2], material: "bone" },
  { name: "Rib_2", joint: "root", position: [0, 0.5, -0.01], size: [0.47, 0.075, 0.2], material: "bone" },
  { name: "Rib_3", joint: "root", position: [0, 0.62, -0.01], size: [0.43, 0.075, 0.18], material: "bone" },
  // Narrow. Wider, it crossed the slats into a grid and the cage read as a lattice.
  { name: "Sternum", joint: "root", position: [0, 0.44, -0.095], size: [0.06, 0.34, 0.05], material: "boneShadow" },
  { name: "Clavicle_L", joint: "root", position: [-0.16, 0.56, -0.04], size: [0.24, 0.07, 0.09], material: "bone" },
  { name: "Clavicle_R", joint: "root", position: [0.16, 0.56, -0.04], size: [0.24, 0.07, 0.09], material: "bone" },
  { name: "Humerus_L", joint: "arm_L", position: [0, 0.16, 0], size: [0.145, 0.32, 0.145], material: "bone" },
  { name: "Radius_L", joint: "arm_L", position: [0, 0.45, 0], size: [0.115, 0.3, 0.115], material: "bone" },
  { name: "Hand_L", joint: "arm_L", position: [0, 0.62, 0], size: [0.13, 0.1, 0.13], material: "boneShadow" },
  { name: "Humerus_R", joint: "arm_R", position: [0, 0.16, 0], size: [0.145, 0.32, 0.145], material: "bone" },
  { name: "Radius_R", joint: "arm_R", position: [0, 0.45, 0], size: [0.115, 0.3, 0.115], material: "bone" },
  { name: "Hand_R", joint: "arm_R", position: [0, 0.62, 0], size: [0.13, 0.1, 0.13], material: "boneShadow" },
  { name: "Femur_L", joint: "leg_L", position: [0, 0.2, 0], size: [0.15, 0.4, 0.15], material: "bone" },
  { name: "Tibia_L", joint: "leg_L", position: [0, 0.55, 0], size: [0.12, 0.32, 0.12], material: "bone" },
  { name: "Foot_L", joint: "leg_L", position: [0, 0.755, 0.07], size: [0.15, 0.09, 0.26], material: "boneShadow" },
  { name: "Femur_R", joint: "leg_R", position: [0, 0.2, 0], size: [0.15, 0.4, 0.15], material: "bone" },
  { name: "Tibia_R", joint: "leg_R", position: [0, 0.55, 0], size: [0.12, 0.32, 0.12], material: "bone" },
  { name: "Foot_R", joint: "leg_R", position: [0, 0.755, 0.07], size: [0.15, 0.09, 0.26], material: "boneShadow" },
];

/**
 * The fleshed figure.
 *
 * Every asymmetry here is an offset on a part, never an angle on a joint. The clip set is shared
 * with the skeletal figure, so a joint rotation authored as rest pose is overwritten on the first
 * frame of any clip; only what hangs off a joint survives. The dropped left shoulder and the tilted
 * skull are the two that carry the silhouette.
 */
const ZOMBIE_PARTS: readonly PartRecord[] = [
  { name: "Cranium", joint: "head", position: [0, 0.26, 0], size: [0.5, 0.42, 0.48], material: "flesh" },
  // Caps the skull rather than resting on it. A patch narrower than the head read as a plank laid
  // across the crown; slightly proud of it on every side, it reads as hair.
  { name: "HairPatch", joint: "head", position: [-0.01, 0.45, 0.015], size: [0.52, 0.07, 0.5], material: "hair" },
  { name: "EyeSocket_L", joint: "head", position: [-0.12, 0.32, -0.242], size: [0.13, 0.12, 0.03], material: "socket" },
  { name: "Sclera_R", joint: "head", position: [0.12, 0.32, -0.242], size: [0.11, 0.08, 0.03], material: "sclera" },
  { name: "Pupil_R", joint: "head", position: [0.12, 0.32, -0.25], size: [0.04, 0.04, 0.02], material: "socket" },
  { name: "NoseStub", joint: "head", position: [0, 0.21, -0.245], size: [0.07, 0.07, 0.04], material: "fleshShadow" },
  { name: "Mandible", joint: "head", position: [0, -0.01, -0.04], size: [0.34, 0.1, 0.34], material: "fleshShadow" },
  // A dark slot on the face between cranium and jaw. Tucked under the head it was never visible,
  // which left the figure merely green rather than slack-jawed.
  { name: "Maw", joint: "head", position: [0, 0.055, -0.2], size: [0.24, 0.06, 0.09], material: "socket" },
  { name: "Pelvis", joint: "root", position: [0, 0.09, 0], size: [0.34, 0.22, 0.22], material: "trouser" },
  { name: "Torso", joint: "root", position: [0, 0.42, 0], size: [0.44, 0.6, 0.26], material: "flesh" },
  { name: "Shirt", joint: "root", position: [0, 0.46, 0], size: [0.46, 0.46, 0.28], material: "cloth" },
  { name: "ShirtHem_0", joint: "root", position: [-0.13, 0.21, 0], size: [0.19, 0.08, 0.285], material: "cloth" },
  { name: "ShirtHem_1", joint: "root", position: [0.08, 0.17, 0], size: [0.16, 0.1, 0.285], material: "cloth" },
  // Sunk into the shirt's own front face, left of centre. Out on the flank it was only visible in
  // profile; hung off the corner it read as a plaque floating clear of the chest.
  { name: "FlankGash", joint: "root", position: [-0.13, 0.4, -0.142], size: [0.16, 0.22, 0.02], material: "socket" },
  { name: "BareRib_0", joint: "root", position: [-0.13, 0.45, -0.15], size: [0.14, 0.045, 0.02], material: "bone" },
  { name: "BareRib_1", joint: "root", position: [-0.13, 0.36, -0.15], size: [0.14, 0.045, 0.02], material: "bone" },
  // Shallower than they were: at full depth the pair read as two crates set on the shoulders. The
  // drop on the left is the asymmetry, so it stays.
  { name: "Shoulder_L", joint: "root", position: [-0.26, 0.5, -0.02], size: [0.17, 0.13, 0.2], material: "cloth" },
  { name: "Shoulder_R", joint: "root", position: [0.26, 0.57, 0], size: [0.17, 0.13, 0.2], material: "cloth" },
  { name: "Sleeve_L", joint: "arm_L", position: [0, 0.12, 0], size: [0.19, 0.26, 0.19], material: "cloth" },
  { name: "UpperArm_L", joint: "arm_L", position: [0, 0.34, 0], size: [0.16, 0.24, 0.16], material: "flesh" },
  { name: "Forearm_L", joint: "arm_L", position: [0, 0.55, 0], size: [0.15, 0.22, 0.15], material: "flesh" },
  { name: "Hand_L", joint: "arm_L", position: [0, 0.66, 0], size: [0.15, 0.12, 0.15], material: "fleshShadow" },
  { name: "Sleeve_R", joint: "arm_R", position: [0, 0.1, 0], size: [0.19, 0.2, 0.19], material: "cloth" },
  { name: "UpperArm_R", joint: "arm_R", position: [0, 0.28, 0], size: [0.16, 0.2, 0.16], material: "flesh" },
  { name: "Ulna_R", joint: "arm_R", position: [0, 0.5, 0], size: [0.1, 0.28, 0.1], material: "bone" },
  { name: "Hand_R", joint: "arm_R", position: [0, 0.65, 0], size: [0.11, 0.1, 0.11], material: "bone" },
  { name: "Trouser_L", joint: "leg_L", position: [0, 0.22, 0], size: [0.19, 0.44, 0.19], material: "trouser" },
  { name: "Shin_L", joint: "leg_L", position: [0, 0.56, 0], size: [0.15, 0.3, 0.15], material: "trouser" },
  { name: "Foot_L", joint: "leg_L", position: [0, 0.755, 0.07], size: [0.16, 0.09, 0.27], material: "fleshShadow" },
  { name: "Trouser_R", joint: "leg_R", position: [0, 0.2, 0], size: [0.19, 0.4, 0.19], material: "trouser" },
  { name: "Shin_R", joint: "leg_R", position: [0, 0.55, 0], size: [0.14, 0.3, 0.14], material: "flesh" },
  { name: "Foot_R", joint: "leg_R", position: [0, 0.755, 0.07], size: [0.16, 0.09, 0.27], material: "fleshShadow" },
];

/** Colour and roughness per material id. Metalness is zero everywhere except the weapon hardware. */
const PALETTES: Readonly<Record<BlockyBody, Readonly<Record<string, readonly [number, number]>>>> = {
  skeleton: {
    bone: [0xcbb18b, 0.86],
    boneShadow: [0x9b855f, 0.9],
    socket: [0x241a15, 0.95],
  },
  zombie: {
    flesh: [0x7d9068, 0.88],
    fleshShadow: [0x5d6b4d, 0.92],
    cloth: [0x6b6152, 0.95],
    trouser: [0x4a4740, 0.95],
    hair: [0x33291f, 0.9],
    sclera: [0xc9c6ba, 0.7],
    bone: [0xcbb18b, 0.86],
    socket: [0x241a15, 0.95],
  },
};

const PARTS: Readonly<Record<BlockyBody, readonly PartRecord[]>> = {
  skeleton: SKELETON_PARTS,
  zombie: ZOMBIE_PARTS,
};

/**
 * Weapon parts, in the weapon socket's own frame.
 *
 * Transcribed from the same table the exported rig builds its weapons from, so a procedural figure
 * and the loaded one hold the same four shapes. The socket's local +Y runs down the arm, which is
 * the axis the Blender table calls an offset past the hand.
 */
const WEAPON_PARTS: Readonly<
  Record<BlockWeapon, readonly Readonly<{ name: string; offset: number; size: Vector3Tuple; material: string }>[]>
> = {
  sword: [
    { name: "Grip", offset: -0.02, size: [0.07, 0.2, 0.07], material: "grip" },
    { name: "Guard", offset: 0.14, size: [0.09, 0.07, 0.28], material: "brass" },
    { name: "Blade", offset: 0.44, size: [0.045, 0.52, 0.11], material: "steel" },
    { name: "Tip", offset: 0.74, size: [0.035, 0.1, 0.06], material: "steel" },
  ],
  hammer: [
    { name: "Haft", offset: 0.22, size: [0.07, 0.52, 0.07], material: "grip" },
    { name: "Head", offset: 0.6, size: [0.22, 0.24, 0.19], material: "steel" },
    { name: "Band", offset: 0.6, size: [0.24, 0.06, 0.21], material: "brass" },
  ],
  javelin: [
    { name: "Shaft", offset: 0.32, size: [0.05, 1.1, 0.05], material: "grip" },
    { name: "Head", offset: 0.92, size: [0.09, 0.2, 0.09], material: "steel" },
    { name: "Collar", offset: 0.8, size: [0.07, 0.06, 0.07], material: "brass" },
  ],
  crossbow: [
    { name: "Stock", offset: 0.26, size: [0.09, 0.46, 0.1], material: "grip" },
    { name: "Bow", offset: 0.44, size: [0.54, 0.06, 0.07], material: "steel" },
    { name: "String", offset: 0.36, size: [0.5, 0.02, 0.02], material: "brass" },
    { name: "Lath", offset: 0.1, size: [0.12, 0.1, 0.12], material: "brass" },
  ],
};

/** The exported rig's weapon palette, converted out of Blender's linear values. */
const HARDWARE: Readonly<Record<string, readonly [number, number, number]>> = {
  steel: [0x90979e, 0.4, 0.6],
  brass: [0xad9050, 0.45, 0.5],
  grip: [0x613c2c, 0.9, 0],
};

export type BlockyRig = Readonly<{
  /** Wrapper carrying the same half turn the loaded rig gets, so the figure faces the camera. */
  root: THREE.Group;
  /** The seven joints by name. What the mixer binds to and what a break detaches. */
  joints: Map<string, THREE.Object3D>;
  /** Weapon meshes by weapon, for the visibility swap. */
  weaponParts: Map<string, THREE.Object3D[]>;
  materials: THREE.Material[];
}>;

function box(name: string, position: Vector3Tuple, size: Vector3Tuple, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBlockyRig(body: BlockyBody): BlockyRig {
  const materials: THREE.Material[] = [];
  const palette = new Map<string, THREE.Material>();

  for (const [id, [colour, roughness]] of Object.entries(PALETTES[body])) {
    const material = new THREE.MeshStandardMaterial({ color: colour, metalness: 0, roughness });
    material.name = `${body}:${id}`;
    palette.set(id, material);
    materials.push(material);
  }

  for (const [id, [colour, roughness, metalness]] of Object.entries(HARDWARE)) {
    const material = new THREE.MeshStandardMaterial({ color: colour, metalness, roughness });
    material.name = `weapon:${id}`;
    palette.set(id, material);
    materials.push(material);
  }

  const joints = new Map<string, THREE.Object3D>();

  for (const record of JOINTS) {
    // A plain Object3D, not a Bone. Nothing here is skinned, so a bone would buy only the type: the
    // mixer binds by name and a break reparents whatever object it is handed.
    const joint = new THREE.Object3D();
    joint.name = record.id;
    joint.position.set(record.position[0], record.position[1], record.position[2]);

    if (record.flipped) {
      joint.rotation.x = Math.PI;
    }

    joints.set(record.id, joint);
    (record.parent === undefined ? undefined : joints.get(record.parent))?.add(joint);
  }

  for (const part of PARTS[body]) {
    const material = palette.get(part.material);

    if (!material) {
      throw new Error(`blocky figure '${body}' part '${part.name}' wants unknown material '${part.material}'`);
    }

    joints.get(part.joint)!.add(box(part.name, part.position, part.size, material));
  }

  const weaponParts = new Map<string, THREE.Object3D[]>();
  const socket = joints.get("weapon")!;

  for (const weapon of BLOCK_WEAPONS) {
    const parts: THREE.Object3D[] = [];

    for (const part of WEAPON_PARTS[weapon]) {
      // Named to the same pattern the exported rig uses, because the viewer selects a weapon by
      // matching that prefix and does not care which figure produced the mesh.
      const mesh = box(`Weapon_${weapon}_${part.name}`, [0, part.offset, 0], part.size, palette.get(part.material)!);
      socket.add(mesh);
      parts.push(mesh);
    }

    weaponParts.set(weapon, parts);
  }

  const root = new THREE.Group();
  root.name = `blocky-${body}`;
  // The same half turn the loaded rig is given. The parts are authored in the exported frame, where
  // the figure faces -Z, so without this it stands with its back to every camera in the scene.
  root.rotation.y = Math.PI;
  root.add(joints.get("root")!);

  return { root, joints, weaponParts, materials };
}
