"""Blender-side authoring rig: the skeleton swordsman, posed by hand rather than by a table.

This is a second rig for the same body, and the two exist for opposite reasons.

`build.py` produces a rig for a script. Its poses are quaternion tables, so it needs no inverse
kinematics, no controllers, and no weapon bone: nothing there ever grabs a joint and pulls. That rig
bakes the sprite atlases and nothing about it should change to suit a person.

This one produces a rig for hands. It is never baked from and it ships nothing; its whole output is a
`.blend` somebody opens, poses in, and takes keyframes out of. Four differences follow from that, and
each one is a thing the bake rig gets away with and a person cannot:

- **The sword owns a bone, and the hands follow it.** On the bake rig the blade is parented to the
  right hand, so a pose has to place a hand and hope the blade lands somewhere. Here the sword is a
  free controller with a grip at each end of its handle; both arms solve to those grips. Moving the
  sword moves both hands, both forearms and both wrists together, which is the way a two-handed
  weapon is actually posed.
- **Every limb has inverse kinematics.** Four chains, four targets, four pole controllers.
- **The hand is a hand.** The bake rig's hand bone is half the length of its forearm and wears the
  same cylinder-and-knuckle as the arm segments, so it reads as a third arm joint and behaves like
  one — the reported complaint was that it is impossible to pose without an extra bend appearing.
  Here it is a short palm.
- **The grip is on the grip.** The bake rig seats the hand at the crossguard, which is where a sword
  is held by nobody. Both palms here sit on the leather.

The rest pose is a two-handed hold rather than a T-pose, for a reason that is not cosmetic: a pole
target cannot be aimed at a limb that is perfectly straight, because a straight limb's middle joint
sits on the axis the pole is measured around. The arms are bent because they are holding something
and the knees are bent because the hips are lowered to make them bend.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender-kit"))

from primitives import (  # noqa: E402  (the path has to be set before this import can resolve)
    box,
    clear_scene,
    cylinder_between,
    ellipsoid,
    material,
    torus,
)

Point = tuple[float, float, float]

# The body faces +Y and stands up +Z, so its own right is +X. Every coordinate below is world space
# at rest, which is the same convention `build.py` uses — the two bodies must measure alike or the
# poses authored here will not transfer to the rig that bakes them.
FORWARD = Vector((0, 1, 0))
UP = Vector((0, 0, 1))

# How far the hips drop out of the bake rig's stance.
#
# Not a stylistic crouch. On the bake rig the distance from hip to ankle is 0.852 and the leg bones
# sum to 0.852, so the leg is exactly, degenerately straight: its knee lies on the hip-ankle axis,
# the angle a pole target would measure is undefined, and inverse kinematics has no side to bend
# toward. Lowering the hips this much puts a real bend in the knee and costs three centimetres of
# height that no pose authored here will notice.
HIP_DROP = 0.045

# Where each hand sits on the handle, measured down from the crossguard.
#
# The handle runs from 0.05 to 0.28 below the guard. The leading hand takes the top of it and the
# supporting hand the bottom, and both are palms: the wrist is one palm-length further down again,
# because that is where a forearm ends when a hand is wrapped around a grip in line with it.
PALM_LEAD = 0.08
PALM_SUPPORT = 0.20
PALM_LENGTH = 0.09

# The bake rig's hand is 0.184 long against a 0.34 forearm. This is what it becomes.
HAND_LENGTH = PALM_LENGTH

# Where the sword rests before anybody poses it: upright, in front of the chest, held in both hands.
SWORD_AT: Point = (0, 0.28, 1.42)


def solve_middle_joint(root: Vector, end: Vector, pole: Vector, upper: float, lower: float) -> Vector:
    """Where a two-bone chain's middle joint lands, given both ends and the side it bends toward.

    The same construction the inverse kinematics solver will run at pose time, used here at build
    time so the rest pose already sits where the solver would put it. That matters for one specific
    reason: the pole angles are tuned by measuring how far the solver moves each middle joint away
    from where this function put it, so a rest pose the solver disagrees with would bake that
    disagreement into the tuning.
    """
    direction = end - root
    distance = min(max(direction.length, abs(upper - lower) + 1e-4), upper + lower - 1e-4)
    direction.normalize()

    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    height = math.sqrt(max(0.0, upper * upper - along * along))
    bend = pole - root
    bend -= direction * bend.dot(direction)

    if bend.length_squared < 1e-8:
        bend = Vector((0, 1, 0))

    bend.normalize()
    return root + direction * along + bend * height


def build_skeleton_table() -> dict[str, tuple[Point, Point]]:
    """Every bone's head and tail, solved rather than typed.

    The arms and the legs are not written down here: their middle joints come out of the same
    two-bone construction the rig will use, so the rest pose cannot disagree with the solver by a
    typing error. What is written down is where the ends go — shoulder, wrist, hip, ankle — and which
    way each joint is meant to fold.
    """
    guard = Vector(SWORD_AT)
    table: dict[str, tuple[Point, Point]] = {}

    def add(name: str, head: Vector, tail: Vector) -> None:
        table[name] = (tuple(round(value, 5) for value in head), tuple(round(value, 5) for value in tail))

    drop = Vector((0, 0, -HIP_DROP))
    hips = Vector((0, 0, 0.92)) + drop
    chest = Vector((0, 0, 1.68)) + drop

    add("root", hips, hips + Vector((0, 0, 0.16)))
    add("spine", hips + Vector((0, 0, 0.13)), chest)
    add("head", chest, chest + Vector((0, 0, 0.4)))

    # The sword bone runs the length of the blade from the crossguard, so rotating it in pose mode
    # swings the point rather than sliding the handle. Its head is the pivot a hand actually turns a
    # sword around.
    add("sword", guard, guard + Vector((0, 0, 1.02)))

    for side, sign in (("L", -1), ("R", 1)):
        shoulder = Vector((0.2 * sign, 0, 1.62)) + drop
        palm_depth = PALM_LEAD if side == "R" else PALM_SUPPORT
        palm = guard - Vector((0, 0, palm_depth))
        wrist = palm - Vector((0, 0, PALM_LENGTH))
        # Elbows fold down, back and away from the ribs — the direction an elbow goes when both hands
        # come together in front of the chest.
        pole = shoulder + Vector((0.45 * sign, -0.5, -0.55))
        elbow = solve_middle_joint(shoulder, wrist, pole, 0.354, 0.34)

        add(f"upper_arm.{side}", shoulder, elbow)
        add(f"forearm.{side}", elbow, wrist)
        add(f"hand.{side}", wrist, palm)
        add(f"grip.{side}", wrist, palm)

        hip = Vector((0.13 * sign, 0, 0.98)) + drop
        ankle = Vector((0.16 * sign, 0.05, 0.13))
        knee = solve_middle_joint(hip, ankle, hip + Vector((0, 0.6, -0.3)), 0.431, 0.421)

        add(f"thigh.{side}", hip, knee)
        add(f"shin.{side}", knee, ankle)
        add(f"foot.{side}", ankle, ankle + Vector((0, 0.23, -0.06)))

    return table


def create_rig(table: dict[str, tuple[Point, Point]]) -> bpy.types.Object:
    armature = bpy.data.armatures.new("SkeletonAuthoringArmature")
    rig = bpy.data.objects.new("SkeletonAuthoringRig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    parents = {
        "spine": "root",
        "head": "spine",
        "upper_arm.L": "spine",
        "forearm.L": "upper_arm.L",
        "hand.L": "forearm.L",
        "upper_arm.R": "spine",
        "forearm.R": "upper_arm.R",
        "hand.R": "forearm.R",
        "thigh.L": "root",
        "shin.L": "thigh.L",
        "foot.L": "shin.L",
        "thigh.R": "root",
        "shin.R": "thigh.R",
        "foot.R": "shin.R",
        # The grips hang off the sword, not off the arms. That direction is the whole design: the
        # arms chase the sword, so a grip that were a child of a hand would close the loop and
        # Blender would refuse to solve it.
        "grip.L": "sword",
        "grip.R": "sword",
    }

    for name, (head, tail) in table.items():
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail

    for name, parent in parents.items():
        armature.edit_bones[name].parent = armature.edit_bones[parent]

    # Controllers, placed after the body so they can be measured off it.
    def control(name: str, head: Vector, tail: Vector, parent: str | None = None) -> None:
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = False

        if parent:
            bone.parent = armature.edit_bones[parent]

    for side, sign in (("L", -1), ("R", 1)):
        ankle = Vector(table[f"shin.{side}"][1])
        control(f"ctrl_foot.{side}", ankle, ankle + Vector((0, 0.23, 0)))

        knee = Vector(table[f"thigh.{side}"][1])
        control(f"pole_knee.{side}", knee + Vector((0, 0.55, 0)), knee + Vector((0, 0.55, 0.12)))

        elbow = Vector(table[f"forearm.{side}"][0])
        control(
            f"pole_elbow.{side}",
            elbow + Vector((0.3 * sign, -0.45, -0.1)),
            elbow + Vector((0.3 * sign, -0.45, 0.02)),
        )

    armature.edit_bones["sword"].use_deform = True
    armature.edit_bones["grip.L"].use_deform = False
    armature.edit_bones["grip.R"].use_deform = False

    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    rig.show_in_front = True
    return rig


def create_body(rig: bpy.types.Object, table: dict[str, tuple[Point, Point]], assigned) -> list[bpy.types.Object]:
    """The same body the bake rig wears, rebuilt at this rig's own rest pose.

    Only the hands differ in shape. Everything else is placed off the solved bone table rather than
    off typed coordinates, so the mesh cannot drift away from the skeleton underneath it.
    """
    built: list[bpy.types.Object] = []
    hips = Vector(table["root"][0])
    chest = Vector(table["spine"][1])

    def add(obj: bpy.types.Object) -> None:
        built.append(obj)

    add(ellipsoid("Pelvis.L", tuple(hips + Vector((-0.11, 0, 0.06))), (0.16, 0.12, 0.16), assigned["bone"], rig, "root", "pelvis"))
    add(ellipsoid("Pelvis.R", tuple(hips + Vector((0.11, 0, 0.06))), (0.16, 0.12, 0.16), assigned["bone"], rig, "root", "pelvis"))
    add(cylinder_between("Spine", tuple(hips + Vector((0, 0, 0.1))), tuple(chest), 0.045, assigned["bone"], rig, "spine", "torso"))
    add(box("Sternum", tuple(chest + Vector((0, 0.18, -0.22))), (0.055, 0.035, 0.25), assigned["bone"], rig, "spine", "torso"))

    for index, offset in enumerate((-0.44, -0.32, -0.2, -0.08)):
        add(
            torus(
                f"Rib.{index}",
                tuple(chest + Vector((0, 0, offset))),
                (1.22 - index * 0.08, 0.68, 1),
                assigned["bone"],
                rig,
                "spine",
                "torso",
            )
        )

    add(
        cylinder_between(
            "Clavicle",
            tuple(chest + Vector((-0.27, 0, -0.04))),
            tuple(chest + Vector((0.27, 0, -0.04))),
            0.035,
            assigned["bone"],
            rig,
            "spine",
            "torso",
        )
    )

    skull = Vector(table["head"][0])
    add(ellipsoid("Cranium", tuple(skull + Vector((0, 0, 0.23))), (0.19, 0.16, 0.22), assigned["bone"], rig, "head", "head"))
    add(box("Jaw", tuple(skull + Vector((0, 0.08, 0.04))), (0.135, 0.1, 0.075), assigned["bone"], rig, "head", "head"))
    add(ellipsoid("EyeSocket.L", tuple(skull + Vector((-0.072, 0.145, 0.26))), (0.052, 0.025, 0.06), assigned["socket"], rig, "head", "head"))
    add(ellipsoid("EyeSocket.R", tuple(skull + Vector((0.072, 0.145, 0.26))), (0.052, 0.025, 0.06), assigned["socket"], rig, "head", "head"))
    add(ellipsoid("NoseSocket", tuple(skull + Vector((0, 0.158, 0.18))), (0.035, 0.02, 0.045), assigned["socket"], rig, "head", "head"))
    add(box("HelmetBand", tuple(skull + Vector((0, -0.005, 0.355))), (0.215, 0.175, 0.045), assigned["iron"], rig, "head", "head"))

    limbs = (
        ("upper_arm.L", 0.052, "arm.L"),
        ("forearm.L", 0.046, "arm.L"),
        ("upper_arm.R", 0.052, "arm.R"),
        ("forearm.R", 0.046, "arm.R"),
        ("thigh.L", 0.065, "leg.L"),
        ("shin.L", 0.055, "leg.L"),
        ("foot.L", 0.065, "foot.L"),
        ("thigh.R", 0.065, "leg.R"),
        ("shin.R", 0.055, "leg.R"),
        ("foot.R", 0.065, "foot.R"),
    )

    for bone_name, radius, part in limbs:
        head, tail = table[bone_name]
        add(cylinder_between(bone_name, head, tail, radius, assigned["bone"], rig, bone_name, part))
        add(ellipsoid(f"{bone_name}.joint", tail, (radius * 1.25,) * 3, assigned["bone"], rig, bone_name, part))

    # The hand, which is the one part of this body that is not the bake rig's.
    #
    # A palm and a knuckle line rather than a cylinder with a joint ball on the end. The old shape
    # was the arm segment's shape, and a third segment on the end of a two-segment arm is exactly
    # what it looked like: every wrist rotation read as an extra elbow.
    for side in ("L", "R"):
        wrist, palm = (Vector(point) for point in table[f"hand.{side}"])
        centre = (wrist + palm) / 2
        add(box(f"Palm.{side}", tuple(centre), (0.085, 0.075, PALM_LENGTH * 0.86), assigned["bone"], rig, f"hand.{side}", f"hand.{side}"))
        add(ellipsoid(f"Knuckles.{side}", tuple(palm), (0.08, 0.07, 0.035), assigned["bone"], rig, f"hand.{side}", f"hand.{side}"))

    add(box("ShoulderGuard.L", tuple(chest + Vector((-0.25, -0.01, -0.04))), (0.16, 0.13, 0.07), assigned["iron"], rig, "upper_arm.L", "armour"))
    add(box("ShoulderGuard.R", tuple(chest + Vector((0.25, -0.01, -0.04))), (0.16, 0.13, 0.07), assigned["iron"], rig, "upper_arm.R", "armour"))
    add(box("WaistCloth", tuple(hips + Vector((0, -0.02, -0.02))), (0.23, 0.11, 0.18), assigned["cloth"], rig, "root", "armour"))
    return built


def create_sword_on_bone(rig: bpy.types.Object, assigned) -> list[bpy.types.Object]:
    """The sword, bound to its own bone instead of to a hand.

    Same five shapes and same dimensions as the bake rig's sword — this is the same weapon, and a
    second set of numbers for it would be two swords that drift apart. What changes is only what it
    hangs from.
    """
    x, y, z = SWORD_AT
    part = "sword"
    return [
        box("SwordBlade", (x, y, z + 0.48), (0.07, 0.036, 0.92), assigned["steel"], rig, "sword", part),
        ellipsoid("SwordTip", (x, y, z + 0.98), (0.04, 0.025, 0.09), assigned["steel"], rig, "sword", part),
        box("SwordGuard", (x, y, z), (0.36, 0.07, 0.07), assigned["brass"], rig, "sword", part),
        cylinder_between("SwordGrip", (x, y, z - 0.05), (x, y, z - 0.28), 0.042, assigned["leather"], rig, "sword", part),
        ellipsoid("SwordPommel", (x, y, z - 0.31), (0.065, 0.05, 0.065), assigned["brass"], rig, "sword", part),
    ]


def create_widgets() -> dict[str, bpy.types.Object]:
    """Shapes for the controllers, so what is grabbable looks grabbable.

    A rig whose controllers are drawn as bones gives a person no way to tell a thing they should
    pull from a thing they should leave alone, which on this rig is most of it: nine controllers
    against fifteen bones that follow them.
    """
    collection = bpy.data.collections.new("Widgets")
    bpy.context.scene.collection.children.link(collection)
    collection.hide_viewport = True
    collection.hide_render = True
    widgets: dict[str, bpy.types.Object] = {}

    def adopt(name: str, obj: bpy.types.Object) -> None:
        for existing in obj.users_collection:
            existing.objects.unlink(obj)
        collection.objects.link(obj)
        obj.name = name
        widgets[name] = obj

    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
    adopt("WGT.cube", bpy.context.object)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0, 0, 0))
    adopt("WGT.sphere", bpy.context.object)
    bpy.ops.mesh.primitive_circle_add(vertices=16, radius=1, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    adopt("WGT.circle", bpy.context.object)
    return widgets


def pose_position(rig: bpy.types.Object, bone_name: str, tail: bool = False) -> Vector:
    """Where a bone actually ended up once its constraints have been solved.

    Read through the evaluated depsgraph rather than off the rig directly. The rig's own pose data is
    the input to the solver, not its output, and in a background Blender the two are not the same
    object — measuring the input is how a tuning pass congratulates itself on a limb it never moved.
    """
    evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    bone = evaluated.pose.bones[bone_name]
    return evaluated.matrix_world @ (bone.tail if tail else bone.head)


def tune_pole_angle(rig: bpy.types.Object, ik_bone: str, rest_middle: Vector) -> tuple[float, float]:
    """Find the pole angle that leaves a limb where the rest pose put it.

    Blender measures a pole angle from the constrained bone's roll, which is a number no build script
    should try to predict: the closed form needs the bone's roll, the chain's rest orientation and the
    solver's own handedness to all be agreed on, and being wrong about any of them produces a limb
    that is confidently bent the wrong way round.

    So this does not derive it. It sweeps the angle, measures where the middle joint lands against
    where the rest pose wanted it, and keeps the best — coarsely over the full turn to find the right
    basin, then finely inside it. The objective is exact and the parameter is one-dimensional, which
    is the case where searching beats deriving.
    """
    constraint = rig.pose.bones[ik_bone].constraints["IK"]

    def drift_at(angle: float) -> float:
        constraint.pole_angle = angle
        bpy.context.view_layer.update()
        return (pose_position(rig, ik_bone) - rest_middle).length

    best_angle, best_drift = 0.0, drift_at(0.0)

    for step in range(180):
        angle = math.radians(step * 2) - math.pi
        drift = drift_at(angle)

        if drift < best_drift:
            best_angle, best_drift = angle, drift

    for step in range(-20, 21):
        angle = best_angle + math.radians(step * 0.1)
        drift = drift_at(angle)

        if drift < best_drift:
            best_angle, best_drift = angle, drift

    constraint.pole_angle = best_angle
    bpy.context.view_layer.update()
    return best_angle, best_drift


def add_constraints(rig: bpy.types.Object, table: dict[str, tuple[Point, Point]], widgets) -> None:
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")

    chains = []

    for side in ("L", "R"):
        chains.append((f"forearm.{side}", f"upper_arm.{side}", f"grip.{side}", f"pole_elbow.{side}"))
        chains.append((f"shin.{side}", f"thigh.{side}", f"ctrl_foot.{side}", f"pole_knee.{side}"))

    for ik_bone, chain_root, target, pole in chains:
        constraint = rig.pose.bones[ik_bone].constraints.new("IK")
        constraint.name = "IK"
        constraint.target = rig
        constraint.subtarget = target
        constraint.pole_target = rig
        constraint.pole_subtarget = pole
        constraint.chain_count = 2
        constraint.use_stretch = False

    for ik_bone, _chain_root, _target, _pole in chains:
        tune_pole_angle(rig, ik_bone, Vector(table[ik_bone][0]))

    # The wrist takes its angle from the handle it is wrapped around. Without this the hand keeps
    # whatever the forearm gave it, so turning the blade leaves the palm behind and the wrist reads
    # as broken — the one failure a two-handed grip produces that no amount of arm posing fixes.
    for side in ("L", "R"):
        copy = rig.pose.bones[f"hand.{side}"].constraints.new("COPY_ROTATION")
        copy.name = "Follow Grip"
        copy.target = rig
        copy.subtarget = f"grip.{side}"
        copy.target_space = "WORLD"
        copy.owner_space = "WORLD"

    # The feet keep the angle their controller has rather than the shin's, so a raised knee does not
    # drag the sole up with it.
    for side in ("L", "R"):
        copy = rig.pose.bones[f"foot.{side}"].constraints.new("COPY_ROTATION")
        copy.name = "Follow Foot Control"
        copy.target = rig
        copy.subtarget = f"ctrl_foot.{side}"
        copy.target_space = "WORLD"
        copy.owner_space = "WORLD"

    shapes = {
        "sword": ("WGT.cube", (0.4, 0.4, 0.4)),
        "ctrl_foot.L": ("WGT.cube", (0.9, 1.1, 0.5)),
        "ctrl_foot.R": ("WGT.cube", (0.9, 1.1, 0.5)),
        "pole_knee.L": ("WGT.sphere", (0.5, 0.5, 0.5)),
        "pole_knee.R": ("WGT.sphere", (0.5, 0.5, 0.5)),
        "pole_elbow.L": ("WGT.sphere", (0.5, 0.5, 0.5)),
        "pole_elbow.R": ("WGT.sphere", (0.5, 0.5, 0.5)),
        "grip.L": ("WGT.circle", (1.4, 1.4, 1.4)),
        "grip.R": ("WGT.circle", (1.4, 1.4, 1.4)),
        "root": ("WGT.circle", (3.2, 3.2, 3.2)),
    }

    for bone_name, (widget, scale) in shapes.items():
        pose_bone = rig.pose.bones[bone_name]
        pose_bone.custom_shape = widgets[widget]

        if hasattr(pose_bone, "custom_shape_scale_xyz"):
            pose_bone.custom_shape_scale_xyz = scale
        else:  # Blender 2.8x kept a single scalar here.
            pose_bone.custom_shape_scale = scale[0]

    groups = {
        "Sword": ("THEME09", ("sword", "grip.L", "grip.R")),
        "Targets": ("THEME01", ("ctrl_foot.L", "ctrl_foot.R")),
        "Poles": ("THEME04", ("pole_elbow.L", "pole_elbow.R", "pole_knee.L", "pole_knee.R")),
        "Body": ("THEME03", ("root", "spine", "head")),
    }

    for group_name, (colour, members) in groups.items():
        group = rig.pose.bone_groups.new(name=group_name)
        group.color_set = colour

        for bone_name in members:
            rig.pose.bones[bone_name].bone_group = group

    bpy.ops.object.mode_set(mode="OBJECT")


def report(rig: bpy.types.Object, table: dict[str, tuple[Point, Point]]) -> None:
    """Print what the rig actually resolved to, so a build that silently did nothing is visible."""
    bpy.context.view_layer.update()
    print("\n--- authoring rig ---")
    print(f"bones: {len(rig.data.bones)}   constraints: {sum(len(b.constraints) for b in rig.pose.bones)}")

    for side in ("L", "R"):
        for ik_bone, chain_root in ((f"forearm.{side}", f"upper_arm.{side}"), (f"shin.{side}", f"thigh.{side}")):
            constraint = rig.pose.bones[ik_bone].constraints["IK"]
            drift = (pose_position(rig, ik_bone) - Vector(table[ik_bone][0])).length
            print(
                f"  {ik_bone:<12} target {constraint.subtarget:<14} pole {constraint.pole_subtarget:<14}"
                f" angle {math.degrees(constraint.pole_angle):7.2f}deg  rest drift {drift * 100:5.2f}cm"
            )

    for side in ("L", "R"):
        palm = Vector(table[f"hand.{side}"][1])
        guard_z = SWORD_AT[2]
        print(f"  palm.{side} sits {(guard_z - palm.z) * 100:.1f}cm below the crossguard (handle spans 5-28cm)")

    print(f"  hand length {HAND_LENGTH:.3f} against forearm 0.340 (bake rig: 0.184)")


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Build the hand-authoring rig for the skeleton swordsman.")
    parser.add_argument("--repository-root", type=Path, required=True)
    return parser.parse_args(arguments)


def main() -> None:
    args = parse_arguments()
    source_root = args.repository_root / "assets" / "enemies" / "skeleton-swordsman"
    source_root.mkdir(parents=True, exist_ok=True)
    clear_scene()

    assigned = {
        "bone": material("AgedBone", (0.72, 0.63, 0.45, 1), roughness=0.78),
        "socket": material("DeepSocket", (0.035, 0.018, 0.028, 1), roughness=1),
        "steel": material("NotchedSteel", (0.28, 0.31, 0.34, 1), metallic=0.72, roughness=0.34),
        "iron": material("BlackenedIron", (0.11, 0.12, 0.14, 1), metallic=0.62, roughness=0.52),
        "brass": material("OldBrass", (0.42, 0.28, 0.08, 1), metallic=0.55, roughness=0.42),
        "leather": material("GripLeather", (0.12, 0.045, 0.025, 1), roughness=0.9),
        "cloth": material("BurialCloth", (0.22, 0.055, 0.065, 1), roughness=0.95),
    }

    table = build_skeleton_table()
    rig = create_rig(table)
    create_body(rig, table, assigned)
    create_sword_on_bone(rig, assigned)
    widgets = create_widgets()
    add_constraints(rig, table, widgets)
    report(rig, table)

    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_root / "skeleton-swordsman-authoring.blend"))


if __name__ == "__main__":
    main()
