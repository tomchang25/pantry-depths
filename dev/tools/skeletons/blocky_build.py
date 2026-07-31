"""A blocky skeleton whose every clip is a table of angles, built for the size the game draws it at.

This is a third body for the same enemy, and it exists because the first two answered a question
between them. The anatomical body driven by pose tables shipped clips of which only two read
correctly; the same body hand-posed through an inverse-kinematics rig produced correct poses at
minutes apiece, which does not scale to seven clips across four weapons. Neither result condemned
the tables — what they showed is that the body demanded more subtlety than a table can carry.

So this one lowers the body to meet them. Every limb is a single box on a single bone: no elbow, no
knee, no wrist, no ankle. Each joint that is absent is a way a pose can no longer be subtly wrong,
and what is left — "weapon arm at two hundred degrees, torso leaned back eight" — is unambiguous
enough that a number in a table is a sufficient author and a person is needed only to say yes or no.

The one manual path, when a table resists: open the generated `.blend` and rotate six bones in pose
mode. That is Blender's own facility and needs no tooling built for it, which is the whole reason
this body is authored here rather than in the browser.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender-kit"))

from primitives import box, clear_scene, material  # noqa: E402  (the path has to be set first)

FPS = 24

# Proportions, in one place. Four heads to the body rather than seven, because the figure is judged
# at the size the game draws it: a seven-head body forty pixels tall has a five-pixel skull and no
# identity, and a four-head one has ten pixels of skull and reads as a skeleton across a room.
GROUND = 0.0
HEAD_SIZE = 0.52
HEAD_CENTRE = 1.66
NECK = 1.40
SHOULDER = 1.38
HIP = 0.80
ARM_LENGTH = 0.62
LEG_LENGTH = 0.80
ARM_THICKNESS = 0.14
SHOULDER_SPAN = 0.29
HIP_SPAN = 0.11
# How far past the hand a weapon reaches. Short enough that the idle arm holds it clear of the floor.
WEAPON_REACH = 0.72

Pose = dict[str, dict[str, tuple[float, float, float]]]


def rig_bones(rig: bpy.types.Object) -> None:
    """Six bones and a socket. There is nothing else to pose.

    Named with underscores rather than Blender's own `.L`/`.R` convention, because three.js
    strips dots out of every node name it loads: `arm.R` arrives as `armR` and `Weapon.sword.Blade`
    as `WeaponswordBlade`. The viewer selects weapons and finds the swing hand by name, and with
    dots in them it found neither — every weapon stayed visible at once and nothing said so. The
    dotted convention buys mirroring tools this rig never uses.

    Arms and legs hang down the negative Z of the rest pose, so a positive rotation about X swings a
    limb forward — every angle in the clip tables reads against that one convention.
    """
    armature = rig.data
    bpy.ops.object.mode_set(mode="EDIT")

    def add(name: str, head: tuple[float, float, float], tail: tuple[float, float, float], parent: str | None) -> None:
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail

        if parent:
            bone.parent = armature.edit_bones[parent]

    add("root", (0, 0, HIP), (0, 0, HIP + 0.16), None)
    add("head", (0, 0, NECK), (0, 0, NECK + HEAD_SIZE), "root")
    add("arm_L", (-SHOULDER_SPAN, 0, SHOULDER), (-SHOULDER_SPAN, 0, SHOULDER - ARM_LENGTH), "root")
    add("arm_R", (SHOULDER_SPAN, 0, SHOULDER), (SHOULDER_SPAN, 0, SHOULDER - ARM_LENGTH), "root")
    add("leg_L", (-HIP_SPAN, 0, HIP), (-HIP_SPAN, 0, HIP - LEG_LENGTH), "root")
    add("leg_R", (HIP_SPAN, 0, HIP), (HIP_SPAN, 0, HIP - LEG_LENGTH), "root")
    # Not a joint anybody poses: it hangs off the weapon arm so the viewer can find the blade's tip
    # without knowing which weapon is showing, which is what the swing arc is drawn along.
    hand = SHOULDER - ARM_LENGTH
    add("weapon", (SHOULDER_SPAN, 0, hand), (SHOULDER_SPAN, 0, hand - WEAPON_REACH), "arm_R")

    bpy.ops.object.mode_set(mode="OBJECT")


def build_body(rig: bpy.types.Object, palette: dict[str, bpy.types.Material]) -> None:
    """Boxes only, and gaps where a rib cage would have ribs.

    The gaps are load-bearing. A solid torso at this scale is a person in a shirt; three slats with
    daylight between them is a skeleton, and that reading survives being forty pixels tall, which is
    the only place it has to survive.
    """
    bone_colour = palette["bone"]
    box("Head", (0, 0, HEAD_CENTRE), (HEAD_SIZE, HEAD_SIZE, HEAD_SIZE), bone_colour, rig, "head", "head")

    for name, x in (("EyeSocket.L", -0.12), ("EyeSocket.R", 0.12)):
        box(name, (x, HEAD_SIZE / 2 - 0.01, HEAD_CENTRE + 0.06), (0.13, 0.03, 0.11), palette["socket"], rig, "head", "head")

    box("NasalSlit", (0, HEAD_SIZE / 2 - 0.01, HEAD_CENTRE - 0.11), (0.06, 0.03, 0.1), palette["socket"], rig, "head", "head")
    box("Jaw", (0, 0.04, HEAD_CENTRE - 0.24), (0.42, 0.4, 0.08), palette["dark"], rig, "head", "head")

    for index, z in enumerate((1.00, 1.16, 1.32)):
        box(f"Rib.{index}", (0, 0, z), (0.44, 0.22, 0.10), bone_colour, rig, "root", "torso")

    box("Spine", (0, -0.06, 1.16), (0.10, 0.10, 0.50), palette["dark"], rig, "root", "torso")
    box("Pelvis", (0, 0, HIP + 0.06), (0.36, 0.22, 0.12), bone_colour, rig, "root", "pelvis")

    for side, sign in (("L", -1), ("R", 1)):
        box(
            f"Arm.{side}",
            (SHOULDER_SPAN * sign, 0, SHOULDER - ARM_LENGTH / 2),
            (ARM_THICKNESS, ARM_THICKNESS, ARM_LENGTH),
            bone_colour,
            rig,
            f"arm_{side}",
            f"arm_{side}",
        )
        box(
            f"Leg.{side}",
            (HIP_SPAN * sign, 0, HIP - LEG_LENGTH / 2),
            (ARM_THICKNESS, ARM_THICKNESS, LEG_LENGTH),
            bone_colour,
            rig,
            f"leg_{side}",
            f"leg_{side}",
        )


def build_weapons(rig: bpy.types.Object, palette: dict[str, bpy.types.Material]) -> None:
    """All four weapons, bound to the same socket, all present at once.

    The viewer shows one and hides the rest, which is why they share a bone and a naming prefix: one
    exported file answers "does a hammer read differently from a sword" without a second bake, and
    the melee three then provably share their clips rather than being asserted to.
    """
    x = SHOULDER_SPAN
    hand = SHOULDER - ARM_LENGTH

    def part(weapon: str, name: str, offset: float, size: tuple[float, float, float], colour: str) -> None:
        """Placed down the arm's own axis, so raising the arm raises the weapon with it."""
        obj = box(f"Weapon_{weapon}_{name}", (x, 0, hand - offset), size, palette[colour], rig, "weapon", "weapon")
        obj["weapon"] = weapon

    # Turned a quarter about its own long axis against the first version, which stood the blade with
    # its flat facing forward — a sword that swings edge-last, like a paddle. The chop travels in the
    # forward plane, so the blade's width has to lie in that plane and its thickness across it. The
    # crossguard turns with it, staying in the blade's plane as a crossguard does.
    part("sword", "Grip", -0.02, (0.07, 0.07, 0.20), "grip")
    part("sword", "Guard", 0.14, (0.09, 0.28, 0.07), "brass")
    part("sword", "Blade", 0.44, (0.045, 0.11, 0.52), "steel")
    part("sword", "Tip", 0.74, (0.035, 0.06, 0.10), "steel")

    part("hammer", "Haft", 0.22, (0.07, 0.07, 0.52), "grip")
    part("hammer", "Head", 0.60, (0.22, 0.19, 0.24), "steel")
    part("hammer", "Band", 0.60, (0.24, 0.21, 0.06), "brass")

    part("javelin", "Shaft", 0.32, (0.05, 0.05, 1.10), "grip")
    part("javelin", "Head", 0.92, (0.09, 0.09, 0.20), "steel")
    part("javelin", "Collar", 0.80, (0.07, 0.07, 0.06), "brass")

    part("crossbow", "Stock", 0.26, (0.09, 0.10, 0.46), "grip")
    part("crossbow", "Bow", 0.44, (0.54, 0.07, 0.06), "steel")
    part("crossbow", "String", 0.36, (0.50, 0.02, 0.02), "brass")
    part("crossbow", "Lath", 0.10, (0.12, 0.12, 0.10), "brass")


# The clip tables.
#
# Angles in degrees about X unless a key says otherwise, and about X means the swing plane: positive
# is forward for a limb, backward for the torso, because a limb hangs down its bone and the torso
# stands up its own. Zero for the weapon arm is straight down; ninety is level; two hundred is
# overhead and past vertical, which is where a wind-up puts it.
#
# `lift` raises the whole body, `lean` tips it. Both live on the root. Everything a pose omits holds
# whatever the previous key left, which is why the neutral rows are empty rather than repeated.
MELEE_IDLE_ARM = 22.0


def degrees(**joints: float) -> Pose:
    """A pose, written as `arm_R=200, lean=8`, turned into what Blender wants."""
    pose: Pose = {}

    for name, value in joints.items():
        if name == "lift":
            pose["root"] = {**pose.get("root", {}), "location": (0, 0, value)}
        elif name == "lean":
            pose["root"] = {**pose.get("root", {}), "rotation": (math.radians(value), 0, 0)}
        else:
            pose[name] = {"rotation": (math.radians(value), 0, 0)}

    return pose


CLIPS: dict[str, dict[str, object]] = {
    "idle": {
        "loop": True,
        "keys": (
            (1, degrees(arm_L=4, arm_R=MELEE_IDLE_ARM, head=0, lift=0, lean=0)),
            (20, degrees(arm_L=1, arm_R=MELEE_IDLE_ARM + 3, head=-3, lift=0.02, lean=1)),
            (40, degrees(arm_L=4, arm_R=MELEE_IDLE_ARM, head=0, lift=0, lean=0)),
        ),
    },
    "walk": {
        "loop": True,
        "keys": (
            (1, degrees(arm_L=35, arm_R=MELEE_IDLE_ARM - 18, leg_L=-35, leg_R=35, lift=0)),
            (6, degrees(arm_L=0, arm_R=MELEE_IDLE_ARM, leg_L=0, leg_R=0, lift=0.03)),
            (11, degrees(arm_L=-35, arm_R=MELEE_IDLE_ARM + 18, leg_L=35, leg_R=-35, lift=0)),
            (16, degrees(arm_L=0, arm_R=MELEE_IDLE_ARM, leg_L=0, leg_R=0, lift=0.03)),
            (20, degrees(arm_L=35, arm_R=MELEE_IDLE_ARM - 18, leg_L=-35, leg_R=35, lift=0)),
        ),
    },
    # Holds its last frame: the simulation owns how long a telegraph lasts, so the clip owns only
    # how the body gets there.
    #
    # 228 rather than a vertical 180 because the sprite frame is 2.5 units tall and the body is
    # 1.92: an arm plus a weapon raised straight up reaches 2.72 from the floor and the blade tip
    # crops off the top of every cell. Cocked back over the shoulder at 228 the tip sits at 2.28,
    # inside the frame, and reads as a wind-up rather than as a salute. The strip found this; the
    # large view never would have.
    "windup": {
        "loop": False,
        "keys": (
            (1, degrees(arm_L=4, arm_R=MELEE_IDLE_ARM, head=0, lift=0, lean=0)),
            (12, degrees(arm_L=-26, arm_R=228, head=6, lift=0.02, lean=8)),
        ),
    },
    "strike": {
        "loop": False,
        "keys": (
            (1, degrees(arm_L=-26, arm_R=228, head=6, lift=0.02, lean=8)),
            (4, degrees(arm_L=16, arm_R=50, head=-8, lift=-0.06, lean=-12)),
        ),
    },
    # The overshoot is the point: a body that has just attacked has to be visibly not idling, and at
    # forty pixels the only thing carrying that is the arm still being somewhere idle never puts it.
    "recovery": {
        "loop": False,
        "keys": (
            (1, degrees(arm_L=16, arm_R=50, head=-8, lift=-0.06, lean=-12)),
            (8, degrees(arm_L=8, arm_R=8, head=2, lift=0.01, lean=4)),
            (14, degrees(arm_L=4, arm_R=MELEE_IDLE_ARM, head=0, lift=0, lean=0)),
        ),
    },
    "crossbowAim": {
        "loop": False,
        "keys": (
            (1, degrees(arm_L=4, arm_R=MELEE_IDLE_ARM, head=0, lean=0)),
            (10, degrees(arm_L=80, arm_R=88, head=0, lean=-2)),
        ),
    },
    "crossbowReload": {
        "loop": False,
        "keys": (
            (1, degrees(arm_L=80, arm_R=88, head=0, lean=0)),
            (8, degrees(arm_L=52, arm_R=34, head=-14, lean=-5)),
            (15, degrees(arm_L=76, arm_R=30, head=-14, lean=-5)),
            (22, degrees(arm_L=52, arm_R=34, head=-14, lean=-5)),
            (29, degrees(arm_L=80, arm_R=88, head=0, lean=0)),
        ),
    },
}


def build_actions(rig: bpy.types.Object) -> dict[str, bpy.types.Action]:
    """One action per clip, each keyed on every bone so no channel is left to a neighbour's curve."""
    if not rig.animation_data:
        rig.animation_data_create()

    built: dict[str, bpy.types.Action] = {}

    for name, clip in CLIPS.items():
        action = bpy.data.actions.new(name=name)
        action.use_fake_user = True
        rig.animation_data.action = action

        for frame, pose in clip["keys"]:  # type: ignore[index]
            bpy.context.scene.frame_set(frame)

            for pose_bone in rig.pose.bones:
                pose_bone.rotation_mode = "XYZ"
                pose_bone.location = (0, 0, 0)
                pose_bone.rotation_euler = (0, 0, 0)

            for bone_name, transform in pose.items():
                pose_bone = rig.pose.bones[bone_name]

                if "rotation" in transform:
                    pose_bone.rotation_euler = transform["rotation"]

                if "location" in transform:
                    pose_bone.location = transform["location"]

            for pose_bone in rig.pose.bones:
                pose_bone.keyframe_insert("location", frame=frame, group=pose_bone.name)
                pose_bone.keyframe_insert("rotation_euler", frame=frame, group=pose_bone.name)

        built[name] = action

    rig.animation_data.action = None
    return built


def stash_actions(rig: bpy.types.Object, actions: dict[str, bpy.types.Action]) -> None:
    """Put every action on its own track, which is the only way more than one of them leaves.

    glTF has no concept of a library of actions: the exporter emits one animation per NLA track and
    names it after the track, or — with strips switched off — emits only whatever action happens to
    be active. The existing sword export carries exactly one clip for that reason. Seven need seven
    tracks, named exactly as the viewer asks for them, because the name is the contract between this
    file and the browser.
    """
    for name, action in actions.items():
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, action)


def export(rig: bpy.types.Object, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)

    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.get("skeleton_part") is not None:
            obj.select_set(True)

    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
    )


def report(rig: bpy.types.Object, blend: Path, glb: Path) -> None:
    meshes = [obj for obj in bpy.data.objects if obj.get("skeleton_part") is not None]
    weapons = sorted({obj["weapon"] for obj in meshes if obj.get("weapon") is not None})
    top = max((obj.matrix_world @ obj.data.vertices[index].co).z for obj in meshes for index in range(len(obj.data.vertices)))
    bottom = min(
        (obj.matrix_world @ obj.data.vertices[index].co).z
        for obj in meshes
        if obj.get("weapon") is None
        for index in range(len(obj.data.vertices))
    )
    height = top - bottom

    print("\n--- blocky skeleton ---")
    print(f"bones: {len(rig.data.bones)}   meshes: {len(meshes)}   weapons: {', '.join(weapons)}")
    print(f"height {height:.3f} with a {HEAD_SIZE:.2f} head -> {height / HEAD_SIZE:.2f} heads   (anatomical body: 6.97)")
    print(f"tracks: {', '.join(track.name for track in rig.animation_data.nla_tracks)}")
    print(f"wrote {blend}")
    print(f"wrote {glb} ({glb.stat().st_size / 1024:.0f} KB)")


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Build the blocky skeleton and export it.")
    parser.add_argument("--blend", type=Path, required=True)
    parser.add_argument("--glb", type=Path, required=True)
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Export the already-open file without rebuilding it — the path a hand-fixed pose leaves by.",
    )
    return parser.parse_args(arguments)


def main() -> None:
    args = parse_arguments()

    # The fallback's exit. A pose fixed by hand lives in this file's actions and nowhere else, so
    # rebuilding would throw it away; this carries it out without touching what produced it.
    if args.export_only:
        rig = bpy.data.objects["BlockSkeletonRig"]
        bpy.ops.object.mode_set(mode="OBJECT")
        export(rig, args.glb)
        report(rig, args.blend, args.glb)
        return

    clear_scene()
    bpy.context.scene.render.fps = FPS

    palette = {
        "bone": material("BlockBone", (0.72, 0.63, 0.45, 1), roughness=0.78),
        "dark": material("BlockDarkBone", (0.5, 0.42, 0.3, 1), roughness=0.82),
        "socket": material("BlockSocket", (0.035, 0.018, 0.028, 1), roughness=1),
        "steel": material("BlockSteel", (0.28, 0.31, 0.34, 1), metallic=0.6, roughness=0.4),
        "brass": material("BlockBrass", (0.42, 0.28, 0.08, 1), metallic=0.5, roughness=0.45),
        "grip": material("BlockGrip", (0.12, 0.045, 0.025, 1), roughness=0.9),
    }

    armature = bpy.data.armatures.new("BlockSkeletonArmature")
    rig = bpy.data.objects.new("BlockSkeletonRig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig_bones(rig)
    rig.select_set(False)
    rig.show_in_front = True

    build_body(rig, palette)
    build_weapons(rig, palette)
    actions = build_actions(rig)
    stash_actions(rig, actions)

    bpy.context.scene.frame_set(1)
    args.blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend))
    export(rig, args.glb)
    report(rig, args.blend, args.glb)


if __name__ == "__main__":
    # Blender prints a traceback for an unhandled exception in a `--python` script and then exits
    # zero anyway, so a build that crashed before writing reports success. This turns it back into a
    # failing exit code.
    try:
        main()
    except Exception:  # noqa: BLE001  (re-raised as a process failure after the traceback is shown)
        import traceback

        traceback.print_exc()
        sys.exit(1)
