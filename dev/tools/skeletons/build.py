"""Blender-side model, rig, animation, and sprite-frame authoring."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Iterable

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender-kit"))

from primitives import (  # noqa: E402  (the path has to be set before this import can resolve)
    assign,
    box,
    clear_scene,
    create_crossbow,
    create_hammer,
    create_javelin,
    create_sword,
    cylinder_between,
    ellipsoid,
    look_at,
    material,
    torus,
)


# The frame size is the caller's: it is rendered above the atlas cell it will be filtered down into,
# and the entry point owns both numbers so they cannot drift apart. EEVEE's sampling smooths an edge
# inside a pixel; it cannot do anything about the pixel being too big, and at the 128 this started at
# a skeleton two cells away was magnified three times with smoothing off while the masonry behind it
# was drawn per pixel. That gap was the whole complaint.
PICKUP_SIZE = 512
DIRECTIONS = 8
# Each clip, as the animation length it is authored at and the number of frames baked out of it.
#
# The two are separate on purpose. Length is what makes the motion read in Blender; samples are what
# the atlas pays for. A body driven into masonry holds one pose and needs one sample of a movement
# that still has to be animated to arrive at that pose, and a death opened by a blade reads in four.
# Sampling one takes the clip's last frame, which is the pose it is held at.
ACTION_FRAMES = {
    "idle": (24, 4),
    "walk": (24, 4),
    "hurt": (16, 4),
    "stunned": (20, 4),
    "windup": (16, 4),
    "strike": (10, 4),
    "recovery": (16, 4),
}
DEATH_FRAMES = {
    "death-collapse": (24, 8),
    "death-drowning": (24, 8),
    "death-cleaved": (24, 4),
    "death-slammed": (16, 1),
    "death-impaled": (24, 1),
}
CLIP_FRAMES = {**ACTION_FRAMES, **DEATH_FRAMES}

# The weapon each type carries, which is the whole of what makes its clips its own.
#
# The weapon is modelled as part of the body rather than composited over a shared one, so there is no
# such thing as a shared walk: it would put a swordsman's blade in a hammer-bearer's hands.
WEAPONS = {
    "swordsman": create_sword,
    "hammerman": create_hammer,
    "javelineer": create_javelin,
    "crossbowman": create_crossbow,
}
PoseTransform = dict[str, dict[str, tuple[float, float, float]]]
Keyframes = tuple[tuple[int, PoseTransform], ...]

# The three attack clips, per weapon.
#
# Three clips rather than one, because there are three states and the player has to tell them apart:
# a wind-up says get out of the way, a strike says too late, and a recovery says free hits now. The
# wind-up arrives at its final pose and the runtime holds it there for however long that type's
# telegraph runs, so the same four frames read at one second and at three. Recovery is the same
# journey back, and it is the clip that did not exist at all - a body on cooldown stood in its idle
# pose, so the most punishable window in a fight looked like an enemy that had not noticed you.
#
# These poses are provisional. What this table owns is that the three states exist and are separable;
# whether each one reads is judged in the entity workbench and expected to replace keyframes.
SWORD_RAISED = {
    "root": {"rotation": (0, 0, -0.3)},
    "spine": {"rotation": (-0.16, 0, -0.38)},
    "upper_arm.R": {"rotation": (-1.15, 0.18, -0.5)},
    "forearm.R": {"rotation": (-0.7, 0, -0.24)},
}
SWORD_FOLLOWED_THROUGH = {
    "root": {"rotation": (0, 0, 0.36)},
    "spine": {"rotation": (0.2, 0, 0.55)},
    "upper_arm.R": {"rotation": (0.8, -0.22, 0.85)},
    "forearm.R": {"rotation": (0.32, 0, 0.55)},
}
HAMMER_HAULED_BACK = {
    "root": {"rotation": (-0.12, 0, -0.44), "location": (0, -0.1, 0)},
    "spine": {"rotation": (-0.3, 0, -0.4)},
    "upper_arm.R": {"rotation": (-1.5, 0.3, -0.35)},
    "forearm.R": {"rotation": (-1.1, 0, -0.15)},
    "upper_arm.L": {"rotation": (-0.6, 0, 0.4)},
}
HAMMER_DRIVEN_HOME = {
    "root": {"rotation": (0.24, 0, 0.42), "location": (0, 0.16, -0.1)},
    "spine": {"rotation": (0.42, 0, 0.5)},
    "upper_arm.R": {"rotation": (1.05, -0.25, 0.6)},
    "forearm.R": {"rotation": (0.2, 0, 0.3)},
    "upper_arm.L": {"rotation": (0.5, 0, -0.35)},
}
JAVELIN_COCKED = {
    "root": {"rotation": (0, 0, -0.35)},
    "spine": {"rotation": (-0.1, 0, -0.42)},
    "upper_arm.R": {"rotation": (-1.35, 0.1, -0.15)},
    "forearm.R": {"rotation": (-0.85, 0, 0.1)},
    "upper_arm.L": {"rotation": (-0.2, 0, 0.9)},
}
JAVELIN_RELEASED = {
    "root": {"rotation": (0.1, 0, 0.3)},
    "spine": {"rotation": (0.28, 0, 0.42)},
    "upper_arm.R": {"rotation": (0.95, -0.15, 0.25)},
    "forearm.R": {"rotation": (0.1, 0, 0.1)},
    "upper_arm.L": {"rotation": (0.3, 0, -0.4)},
}
CROSSBOW_LEVELLED = {
    "spine": {"rotation": (0, 0, 0.18)},
    "head": {"rotation": (0.1, 0, 0.12)},
    "upper_arm.R": {"rotation": (-1.32, 0, 0.05)},
    "forearm.R": {"rotation": (-0.2, 0, 0.35)},
    "upper_arm.L": {"rotation": (-1.15, 0, -0.35)},
    "forearm.L": {"rotation": (-0.35, 0, -0.5)},
}
CROSSBOW_RECOILED = {
    "root": {"location": (0, -0.06, 0)},
    "spine": {"rotation": (-0.14, 0, 0.14)},
    "head": {"rotation": (-0.06, 0, 0.1)},
    "upper_arm.R": {"rotation": (-1.42, 0, 0.02)},
    "forearm.R": {"rotation": (-0.3, 0, 0.3)},
    "upper_arm.L": {"rotation": (-1.2, 0, -0.3)},
}
CROSSBOW_RELOADING = {
    "spine": {"rotation": (-0.3, 0, 0)},
    "head": {"rotation": (-0.25, 0, 0)},
    "upper_arm.R": {"rotation": (-0.7, 0.2, -0.2)},
    "forearm.R": {"rotation": (-0.9, 0, -0.3)},
    "upper_arm.L": {"rotation": (-0.5, 0, 0.3)},
    "forearm.L": {"rotation": (-0.8, 0, 0.4)},
}

ATTACK_POSES: dict[str, dict[str, Keyframes]] = {
    # Overhead, and the arc comes down across the body.
    "swordsman": {
        "windup": ((1, {}), (16, SWORD_RAISED)),
        "strike": ((1, SWORD_RAISED), (10, SWORD_FOLLOWED_THROUGH)),
        "recovery": ((1, SWORD_FOLLOWED_THROUGH), (16, {})),
    },
    # Hauled back over the shoulder, and driven forward with the whole body behind it.
    "hammerman": {
        "windup": ((1, {}), (16, HAMMER_HAULED_BACK)),
        "strike": ((1, HAMMER_HAULED_BACK), (10, HAMMER_DRIVEN_HOME)),
        "recovery": (
            (1, HAMMER_DRIVEN_HOME),
            (8, {"root": {"rotation": (0.1, 0, 0.14)}, "spine": {"rotation": (0.22, 0, 0.2)}}),
            (16, {}),
        ),
    },
    # Cocked back past the ear, and thrown through with the shoulder.
    "javelineer": {
        "windup": ((1, {}), (16, JAVELIN_COCKED)),
        "strike": ((1, JAVELIN_COCKED), (10, JAVELIN_RELEASED)),
        "recovery": ((1, JAVELIN_RELEASED), (16, {})),
    },
    # Levelled rather than raised: it comes up to the eye and stays there. The recovery is the
    # reload, which is what six seconds of cooldown is actually spent doing.
    "crossbowman": {
        "windup": ((1, {}), (16, CROSSBOW_LEVELLED)),
        "strike": ((1, CROSSBOW_LEVELLED), (10, CROSSBOW_RECOILED)),
        "recovery": ((1, CROSSBOW_RECOILED), (8, CROSSBOW_RELOADING), (16, {})),
    },
}


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository-root", type=Path, required=True)
    parser.add_argument("--frames-root", type=Path, required=True)
    parser.add_argument("--frame-size", type=int, required=True)
    parser.add_argument("--skeleton-type", choices=sorted(WEAPONS), required=True)
    # The deaths are one set for every type, so exactly one invocation is asked to render them.
    parser.add_argument("--with-deaths", action="store_true")
    parser.add_argument("--with-pickups", action="store_true")
    return parser.parse_args(arguments)


def create_rig() -> bpy.types.Object:
    armature = bpy.data.armatures.new("SkeletonSwordsmanArmature")
    rig = bpy.data.objects.new("SkeletonSwordsmanRig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    bones: dict[str, bpy.types.EditBone] = {}

    def add_bone(
        name: str,
        head: tuple[float, float, float],
        tail: tuple[float, float, float],
        parent: str | None = None,
    ) -> None:
        bone = armature.edit_bones.new(name)
        bone.head = head
        bone.tail = tail

        if parent:
            bone.parent = bones[parent]

        bones[name] = bone

    add_bone("root", (0, 0, 0.92), (0, 0, 1.08))
    add_bone("spine", (0, 0, 1.05), (0, 0, 1.68), "root")
    add_bone("head", (0, 0, 1.68), (0, 0, 2.08), "spine")
    add_bone("upper_arm.L", (-0.2, 0, 1.62), (-0.46, 0.02, 1.38), "spine")
    add_bone("forearm.L", (-0.46, 0.02, 1.38), (-0.55, 0.14, 1.08), "upper_arm.L")
    add_bone("hand.L", (-0.55, 0.14, 1.08), (-0.54, 0.25, 0.98), "forearm.L")
    add_bone("upper_arm.R", (0.2, 0, 1.62), (0.46, 0.08, 1.4), "spine")
    add_bone("forearm.R", (0.46, 0.08, 1.4), (0.45, 0.33, 1.15), "upper_arm.R")
    add_bone("hand.R", (0.45, 0.33, 1.15), (0.44, 0.5, 1.08), "forearm.R")
    add_bone("thigh.L", (-0.13, 0, 0.98), (-0.15, 0.02, 0.55), "root")
    add_bone("shin.L", (-0.15, 0.02, 0.55), (-0.16, 0.05, 0.13), "thigh.L")
    add_bone("foot.L", (-0.16, 0.05, 0.13), (-0.16, 0.28, 0.07), "shin.L")
    add_bone("thigh.R", (0.13, 0, 0.98), (0.15, 0.02, 0.55), "root")
    add_bone("shin.R", (0.15, 0.02, 0.55), (0.16, 0.05, 0.13), "thigh.R")
    add_bone("foot.R", (0.16, 0.05, 0.13), (0.16, 0.28, 0.07), "shin.R")

    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    rig.show_in_front = True
    return rig


def create_character(
    rig: bpy.types.Object, assigned: dict[str, bpy.types.Material], skeleton_type: str
) -> list[bpy.types.Object]:
    built: list[bpy.types.Object] = []

    def add(obj: bpy.types.Object) -> None:
        built.append(obj)

    add(ellipsoid("Pelvis.L", (-0.11, 0, 0.98), (0.16, 0.12, 0.16), assigned["bone"], rig, "root", "pelvis"))
    add(ellipsoid("Pelvis.R", (0.11, 0, 0.98), (0.16, 0.12, 0.16), assigned["bone"], rig, "root", "pelvis"))
    add(cylinder_between("Spine", (0, 0, 1.02), (0, 0, 1.68), 0.045, assigned["bone"], rig, "spine", "torso"))
    add(box("Sternum", (0, 0.18, 1.46), (0.055, 0.035, 0.25), assigned["bone"], rig, "spine", "torso"))

    for index, z in enumerate((1.24, 1.36, 1.48, 1.6)):
        add(torus(f"Rib.{index}", (0, 0, z), (1.22 - index * 0.08, 0.68, 1), assigned["bone"], rig, "spine", "torso"))

    add(cylinder_between("Clavicle", (-0.27, 0, 1.64), (0.27, 0, 1.64), 0.035, assigned["bone"], rig, "spine", "torso"))
    add(ellipsoid("Cranium", (0, 0, 1.91), (0.19, 0.16, 0.22), assigned["bone"], rig, "head", "head"))
    add(box("Jaw", (0, 0.08, 1.72), (0.135, 0.1, 0.075), assigned["bone"], rig, "head", "head"))
    add(ellipsoid("EyeSocket.L", (-0.072, 0.145, 1.94), (0.052, 0.025, 0.06), assigned["socket"], rig, "head", "head"))
    add(ellipsoid("EyeSocket.R", (0.072, 0.145, 1.94), (0.052, 0.025, 0.06), assigned["socket"], rig, "head", "head"))
    add(ellipsoid("NoseSocket", (0, 0.158, 1.86), (0.035, 0.02, 0.045), assigned["socket"], rig, "head", "head"))
    add(box("HelmetBand", (0, -0.005, 2.035), (0.215, 0.175, 0.045), assigned["iron"], rig, "head", "head"))

    limb_specs = (
        ("upper_arm.L", (-0.2, 0, 1.62), (-0.46, 0.02, 1.38), 0.052, "arm.L"),
        ("forearm.L", (-0.46, 0.02, 1.38), (-0.55, 0.14, 1.08), 0.046, "arm.L"),
        ("hand.L", (-0.55, 0.14, 1.08), (-0.54, 0.25, 0.98), 0.06, "hand.L"),
        ("upper_arm.R", (0.2, 0, 1.62), (0.46, 0.08, 1.4), 0.052, "arm.R"),
        ("forearm.R", (0.46, 0.08, 1.4), (0.45, 0.33, 1.15), 0.046, "arm.R"),
        ("hand.R", (0.45, 0.33, 1.15), (0.44, 0.5, 1.08), 0.06, "hand.R"),
        ("thigh.L", (-0.13, 0, 0.98), (-0.15, 0.02, 0.55), 0.065, "leg.L"),
        ("shin.L", (-0.15, 0.02, 0.55), (-0.16, 0.05, 0.13), 0.055, "leg.L"),
        ("foot.L", (-0.16, 0.05, 0.13), (-0.16, 0.28, 0.07), 0.065, "foot.L"),
        ("thigh.R", (0.13, 0, 0.98), (0.15, 0.02, 0.55), 0.065, "leg.R"),
        ("shin.R", (0.15, 0.02, 0.55), (0.16, 0.05, 0.13), 0.055, "leg.R"),
        ("foot.R", (0.16, 0.05, 0.13), (0.16, 0.28, 0.07), 0.065, "foot.R"),
    )

    for bone_name, start, end, radius, part in limb_specs:
        add(cylinder_between(bone_name, start, end, radius, assigned["bone"], rig, bone_name, part))
        add(ellipsoid(f"{bone_name}.joint", end, (radius * 1.25,) * 3, assigned["bone"], rig, bone_name, part))

    add(box("ShoulderGuard.L", (-0.25, -0.01, 1.64), (0.16, 0.13, 0.07), assigned["iron"], rig, "upper_arm.L", "armour"))
    add(box("ShoulderGuard.R", (0.25, -0.01, 1.64), (0.16, 0.13, 0.07), assigned["iron"], rig, "upper_arm.R", "armour"))
    add(box("WaistCloth", (0, -0.02, 0.9), (0.23, 0.11, 0.18), assigned["cloth"], rig, "root", "armour"))
    built.extend(WEAPONS[skeleton_type]("", assigned, rig, "hand.R"))
    return built


def create_actions(rig: bpy.types.Object, skeleton_type: str) -> dict[str, bpy.types.Action]:
    if not rig.animation_data:
        rig.animation_data_create()

    def create(name: str, keys: Iterable[tuple[int, PoseTransform]]) -> bpy.types.Action:
        action = bpy.data.actions.new(name=f"Skeleton.{skeleton_type}.{name}")
        action.use_fake_user = True
        rig.animation_data.action = action

        for frame, transforms in keys:
            bpy.context.scene.frame_set(frame)

            for pose_bone in rig.pose.bones:
                pose_bone.rotation_mode = "XYZ"
                pose_bone.location = (0, 0, 0)
                pose_bone.rotation_euler = (0, 0, 0)
                pose_bone.scale = (1, 1, 1)

            for bone_name, transform in transforms.items():
                pose_bone = rig.pose.bones[bone_name]

                if "rotation" in transform:
                    pose_bone.rotation_euler = transform["rotation"]

                if "location" in transform:
                    pose_bone.location = transform["location"]

                if "scale" in transform:
                    pose_bone.scale = transform["scale"]

            for pose_bone in rig.pose.bones:
                pose_bone.keyframe_insert("location", frame=frame, group=pose_bone.name)
                pose_bone.keyframe_insert("rotation_euler", frame=frame, group=pose_bone.name)
                pose_bone.keyframe_insert("scale", frame=frame, group=pose_bone.name)

        for curve in action.fcurves:
            for point in curve.keyframe_points:
                point.interpolation = "BEZIER"

        return action

    walk_a = {
        "root": {"location": (0, 0, 0.035)},
        "thigh.L": {"rotation": (0.58, 0, 0)},
        "shin.L": {"rotation": (-0.35, 0, 0)},
        "thigh.R": {"rotation": (-0.5, 0, 0)},
        "upper_arm.L": {"rotation": (-0.42, 0, 0)},
        "upper_arm.R": {"rotation": (0.28, 0, 0)},
    }
    walk_b = {
        "root": {"location": (0, 0, -0.015)},
        "thigh.L": {"rotation": (-0.5, 0, 0)},
        "thigh.R": {"rotation": (0.58, 0, 0)},
        "shin.R": {"rotation": (-0.35, 0, 0)},
        "upper_arm.L": {"rotation": (0.42, 0, 0)},
        "upper_arm.R": {"rotation": (-0.28, 0, 0)},
    }

    actions = {
        "idle": create(
            "idle",
            (
                (1, {"root": {"location": (0, 0, 0)}, "head": {"rotation": (0, 0, -0.05)}}),
                (12, {"root": {"location": (0, 0, 0.025)}, "head": {"rotation": (0.04, 0, 0.05)}}),
                (24, {"root": {"location": (0, 0, 0)}, "head": {"rotation": (0, 0, -0.05)}}),
            ),
        ),
        "walk": create("walk", ((1, walk_a), (7, {}), (13, walk_b), (19, {}), (24, walk_a))),
        "windup": create("windup", ATTACK_POSES[skeleton_type]["windup"]),
        "strike": create("strike", ATTACK_POSES[skeleton_type]["strike"]),
        "recovery": create("recovery", ATTACK_POSES[skeleton_type]["recovery"]),
        "hurt": create(
            "hurt",
            (
                (1, {}),
                (
                    5,
                    {
                        "root": {"rotation": (-0.22, 0, -0.18), "location": (0, -0.06, 0)},
                        "spine": {"rotation": (-0.3, 0.12, 0.18)},
                        "head": {"rotation": (-0.35, 0, -0.22)},
                        "upper_arm.L": {"rotation": (0.45, 0, -0.45)},
                    },
                ),
                (10, {"root": {"rotation": (0.08, 0, 0.08)}}),
                (16, {}),
            ),
        ),
        # Named for what the body is doing rather than for a mechanic. Nothing in the demo blocks an
        # attack; this is the pose a body holds while it is stunned, and it loops so a five-second
        # stun is a body swaying on its feet rather than a single frame held until it wears off.
        "stunned": create(
            "stunned",
            (
                (1, {}),
                (
                    7,
                    {
                        "spine": {"rotation": (-0.12, 0, -0.12)},
                        "upper_arm.R": {"rotation": (-1.15, 0.25, -0.72)},
                        "forearm.R": {"rotation": (-0.55, 0, -0.65)},
                        "upper_arm.L": {"rotation": (-0.45, 0, 0.35)},
                    },
                ),
                (
                    14,
                    {
                        "spine": {"rotation": (-0.1, 0, -0.08)},
                        "upper_arm.R": {"rotation": (-1.08, 0.2, -0.64)},
                        "forearm.R": {"rotation": (-0.5, 0, -0.6)},
                    },
                ),
                (20, {}),
            ),
        ),
        "death-collapse": create(
            "death-collapse",
            (
                (1, {}),
                (7, {"root": {"rotation": (-0.25, 0, 0.18)}, "spine": {"rotation": (-0.3, 0, -0.2)}}),
                (
                    15,
                    {
                        "root": {"rotation": (-1.0, 0, 0.28), "location": (0, -0.12, -0.48)},
                        "spine": {"rotation": (-0.4, 0.2, 0.25)},
                        "head": {"rotation": (-0.5, 0.3, -0.35)},
                        "upper_arm.L": {"rotation": (0.55, 0, -0.6)},
                        "upper_arm.R": {"rotation": (-0.35, 0, 0.65)},
                    },
                ),
                (
                    24,
                    {
                        "root": {"rotation": (-1.42, 0, 0.3), "location": (0, -0.18, -0.72)},
                        "spine": {"rotation": (-0.55, 0.2, 0.25)},
                        "head": {"rotation": (-0.7, 0.3, -0.4)},
                    },
                ),
            ),
        ),
        "death-cleaved": create(
            "death-cleaved",
            (
                (1, {}),
                (
                    8,
                    {
                        "root": {"rotation": (-0.15, 0, -0.32)},
                        "spine": {"rotation": (-0.2, 0.45, 0.5)},
                        "head": {"rotation": (0.2, 0.35, -0.4)},
                        "upper_arm.L": {"rotation": (1.3, 0.5, -1.1)},
                        "upper_arm.R": {"rotation": (-1.2, -0.5, 1.0)},
                    },
                ),
                (
                    16,
                    {
                        "root": {"rotation": (-0.7, 0, -0.5), "location": (0.16, 0, -0.34)},
                        "spine": {"rotation": (-0.1, 0.9, 0.85), "location": (0.22, 0, 0.1)},
                        "head": {"rotation": (0.4, 0.6, -0.7), "location": (0.18, 0.1, 0.06)},
                        "upper_arm.L": {"rotation": (1.9, 0.7, -1.5)},
                        "upper_arm.R": {"rotation": (-1.7, -0.7, 1.4)},
                        "thigh.L": {"rotation": (0.5, 0.3, -0.5)},
                        "thigh.R": {"rotation": (-0.5, -0.3, 0.5)},
                    },
                ),
                (
                    24,
                    {
                        "root": {"rotation": (-1.35, 0, -0.55), "location": (0.26, 0, -0.74)},
                        "spine": {"rotation": (0.1, 1.2, 1.0), "location": (0.42, 0.1, 0.14)},
                        "head": {"rotation": (0.6, 0.8, -0.9), "location": (0.34, 0.2, 0.1)},
                        "upper_arm.L": {"rotation": (2.2, 0.9, -1.7)},
                        "upper_arm.R": {"rotation": (-2.0, -0.9, 1.6)},
                        "thigh.L": {"rotation": (0.9, 0.4, -0.8)},
                        "thigh.R": {"rotation": (-0.9, -0.4, 0.8)},
                    },
                ),
            ),
        ),
        "death-slammed": create(
            "death-slammed",
            (
                (1, {}),
                (
                    6,
                    {
                        "root": {"rotation": (0.35, 0, 0.1), "location": (0, 0.18, 0.1)},
                        "spine": {"rotation": (0.4, 0, -0.1)},
                        "head": {"rotation": (0.5, 0, 0.15)},
                        "upper_arm.L": {"rotation": (1.5, 0.3, -1.0)},
                        "upper_arm.R": {"rotation": (1.4, -0.3, 1.0)},
                    },
                ),
                (
                    16,
                    {
                        "root": {"rotation": (-1.5, 0, 0.12), "location": (0, 0.06, -0.78)},
                        "spine": {"rotation": (0.25, 0.1, -0.2)},
                        "head": {"rotation": (0.7, 0.15, 0.3)},
                        "upper_arm.L": {"rotation": (1.1, 0.4, -0.9)},
                        "upper_arm.R": {"rotation": (1.0, -0.4, 0.9)},
                        "thigh.L": {"rotation": (0.6, 0.25, -0.45)},
                        "thigh.R": {"rotation": (-0.4, -0.25, 0.45)},
                    },
                ),
            ),
        ),
        "death-impaled": create(
            "death-impaled",
            (
                (1, {}),
                (7, {"root": {"location": (0, -0.08, 0.12)}, "spine": {"rotation": (-0.3, 0, 0)}}),
                (
                    15,
                    {
                        "root": {"location": (0, -0.12, 0.02)},
                        "spine": {"rotation": (0.45, 0.12, 0.08)},
                        "head": {"rotation": (0.6, 0.2, -0.2)},
                        "upper_arm.L": {"rotation": (0.8, 0, -0.6)},
                        "upper_arm.R": {"rotation": (0.7, 0, 0.6)},
                    },
                ),
                (
                    24,
                    {
                        "root": {"location": (0, -0.12, -0.04)},
                        "spine": {"rotation": (0.6, 0.15, 0.1)},
                        "head": {"rotation": (0.85, 0.2, -0.25)},
                        "upper_arm.L": {"rotation": (1.0, 0, -0.75)},
                        "upper_arm.R": {"rotation": (0.9, 0, 0.75)},
                    },
                ),
            ),
        ),
        "death-drowning": create(
            "death-drowning",
            (
                (1, {}),
                (8, {"root": {"location": (0, 0, -0.2)}, "upper_arm.L": {"rotation": (0.5, 0, -0.4)}}),
                (
                    16,
                    {
                        "root": {"location": (0, 0, -0.68), "rotation": (-0.3, 0, 0.15)},
                        "head": {"rotation": (0.4, 0.1, -0.2)},
                    },
                ),
                (24, {"root": {"location": (0, 0, -1.25), "rotation": (-0.55, 0, 0.2)}}),
            ),
        ),
    }
    rig.animation_data.action = actions["idle"]
    return actions


def configure_render(frame_size: int) -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 64
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3
    scene.eevee.gtao_factor = 1.4
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = frame_size
    scene.render.resolution_y = frame_size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    # Lit for the room it stands in. The first pass keyed this at 620W with a contrast look on top,
    # which drove aged bone to near white — and a white figure against a dark purple dungeon lit by
    # torchlight reads as pasted on no matter how good the silhouette is. The renderer darkens and
    # warms a sprite by depth and by lamp, so what is baked has to sit below the range it will be
    # pushed into, not at the top of it.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium Contrast"
    scene.view_settings.exposure = -0.45
    scene.view_settings.gamma = 1

    camera_data = bpy.data.cameras.new("SpriteCamera")
    camera = bpy.data.objects.new("SpriteCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.5
    scene.camera = camera

    key_data = bpy.data.lights.new("KeyLight", type="AREA")
    key_data.energy = 430
    key_data.size = 4
    key = bpy.data.objects.new("KeyLight", key_data)
    bpy.context.collection.objects.link(key)

    fill_data = bpy.data.lights.new("FillLight", type="AREA")
    fill_data.energy = 190
    fill_data.size = 5
    fill = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill)

    scene.world.color = (0.015, 0.01, 0.025)
    return camera, key, fill


def aim_camera(camera: bpy.types.Object, key: bpy.types.Object, fill: bpy.types.Object, direction: int) -> None:
    # The wheel turns clockwise, and the minus sign is the whole reason the walk cycle reads at all.
    #
    # The game's projection is left-handed: facing +X it puts world +Y on the right of the screen
    # (`#projectSprite` computes `transformX` from `relY` with an inverse that carries the sign), and
    # a Blender camera looking the same way puts +Y on the left. The game world is therefore a mirror
    # image of this one, so mapping game coordinates onto Blender's directly and stepping the camera
    # counter-clockwise baked a wheel that is correct at the front and back and reversed at both
    # profiles. On screen that is a skeleton whose feet walk one way while its body points the other.
    #
    # Row `d` is selected at runtime from `viewerAngle - facingAngle` in game space; negating the step
    # here is the same map applied to the bake, which puts the camera where that row's viewer actually
    # stands. Nothing is flipped afterwards: a reflection is not a rotation, so the skeleton on screen
    # is a mirrored one and holds its sword in what looks like its left hand. It is a skeleton. Nobody
    # can tell, and every clip mirrors with it, so the swing and the pose stay consistent.
    angle = math.pi / 2 - (direction / DIRECTIONS) * math.pi * 2
    outward = Vector((math.cos(angle), math.sin(angle), 0))
    sideways = Vector((-outward.y, outward.x, 0))
    camera.location = outward * 5.8 + Vector((0, 0, 1.15))
    look_at(camera, (0, 0, 1.08))
    key.location = outward * 3.2 - sideways * 2.2 + Vector((0, 0, 4.4))
    look_at(key, (0, 0, 1.1))
    fill.location = -outward * 2.2 + sideways * 1.5 + Vector((0, 0, 2.7))
    look_at(fill, (0, 0, 1.0))


def render_frames(
    frames_root: Path,
    rig: bpy.types.Object,
    actions: dict[str, bpy.types.Action],
    clips: dict[str, tuple[int, int]],
    camera: bpy.types.Object,
    key: bpy.types.Object,
    fill: bpy.types.Object,
) -> None:
    scene = bpy.context.scene
    frames_root.mkdir(parents=True, exist_ok=True)

    for clip, (duration, samples) in clips.items():
        rig.animation_data.action = actions[clip]

        for direction in range(DIRECTIONS):
            aim_camera(camera, key, fill, direction)

            for sample in range(samples):
                # A single-sample clip is the pose the body is left in, which is the end of it. There
                # is nothing to spread across, and dividing by the gap between samples would be a
                # division by zero besides.
                frame = duration if samples == 1 else 1 + round((duration - 1) * sample / (samples - 1))
                scene.frame_set(frame)
                scene.render.filepath = str(frames_root / f"{clip}-{direction}-{sample}.png")
                bpy.ops.render.render(write_still=True)


def render_pickups(
    runtime_root: Path,
    rig: bpy.types.Object,
    character: list[bpy.types.Object],
    assigned: dict[str, bpy.types.Material],
    camera: bpy.types.Object,
    key: bpy.types.Object,
    fill: bpy.types.Object,
    frame_size: int,
) -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = PICKUP_SIZE
    scene.render.resolution_y = PICKUP_SIZE
    camera.data.ortho_scale = 1.35
    camera.location = (0, 4.8, 0.72)
    look_at(camera, (0, 0, 0.52))
    key.location = (-2.2, 3.2, 3.4)
    look_at(key, (0, 0, 0.45))
    fill.location = (2.1, -1.6, 2.2)
    look_at(fill, (0, 0, 0.4))
    rig.hide_render = True

    for obj in character:
        obj.hide_render = True

    def render(objects: list[bpy.types.Object], filename: str) -> None:
        for obj in objects:
            obj.hide_render = False

        scene.render.filepath = str(runtime_root / filename)
        bpy.ops.render.render(write_still=True)

        for obj in objects:
            obj.hide_render = True

    sword = create_sword("Pickup", assigned, offset=(0, 0, 0.32))
    root = bpy.data.objects.new("PickupSwordRoot", None)
    bpy.context.collection.objects.link(root)

    for obj in sword:
        obj.parent = root

    root.rotation_euler[1] = -0.62
    render(sword, "skeleton-sword.png")

    skull = [
        ellipsoid("PickupSkull", (0, 0, 0.52), (0.24, 0.2, 0.26), assigned["bone"]),
        box("PickupJaw", (0, 0.1, 0.31), (0.17, 0.12, 0.09), assigned["bone"]),
        ellipsoid("PickupEye.L", (-0.085, 0.19, 0.55), (0.06, 0.025, 0.07), assigned["socket"]),
        ellipsoid("PickupEye.R", (0.085, 0.19, 0.55), (0.06, 0.025, 0.07), assigned["socket"]),
    ]
    render(skull, "skeleton-skull.png")

    femur = [
        cylinder_between("PickupFemur", (-0.27, 0, 0.22), (0.27, 0, 0.82), 0.065, assigned["bone"]),
        ellipsoid("PickupFemurEnd.A", (-0.27, 0, 0.22), (0.1, 0.08, 0.1), assigned["bone"]),
        ellipsoid("PickupFemurEnd.B", (0.27, 0, 0.82), (0.1, 0.08, 0.1), assigned["bone"]),
    ]
    render(femur, "skeleton-femur.png")

    # The same bone after one throw: the far knob is gone, the shaft ends in splinters, and the break
    # shows the dark marrow the socket material is already used for. Read against the whole femur it
    # has to say "one more throw" at a glance and from across the room, so the silhouette changes —
    # shorter, and no longer symmetrical — rather than only the surface.
    cracked = [
        cylinder_between("PickupCrackedFemur", (-0.27, 0, 0.22), (0.05, 0, 0.58), 0.062, assigned["bone"]),
        ellipsoid("PickupCrackedFemurEnd", (-0.27, 0, 0.22), (0.1, 0.08, 0.1), assigned["bone"]),
        # Wider than the shaft and pushed just past its end, so the marrow reads as a dark cap on the
        # break rather than as a shadow inside it. At the size a prop is drawn on the floor this is
        # most of what says "broken" — a splinter alone is a few pixels and disappears.
        ellipsoid("PickupCrackedFemurBreak", (0.06, 0, 0.59), (0.072, 0.066, 0.055), assigned["socket"]),
        cylinder_between("PickupCrackedFemurSplinter.A", (0.04, 0.03, 0.57), (0.2, 0.05, 0.78), 0.03, assigned["bone"]),
        cylinder_between(
            "PickupCrackedFemurSplinter.B", (0.05, -0.035, 0.57), (0.15, -0.06, 0.72), 0.024, assigned["bone"]
        ),
    ]
    render(cracked, "skeleton-femur-cracked.png")

    rig.hide_render = False
    scene.render.resolution_x = frame_size
    scene.render.resolution_y = frame_size


def main() -> None:
    args = parse_arguments()
    skeleton_type = args.skeleton_type
    source_root = args.repository_root / "assets" / "enemies" / f"skeleton-{skeleton_type}"
    runtime_root = args.repository_root / "src" / "content" / "enemies" / "assets" / "skeleton-swordsman"
    source_root.mkdir(parents=True, exist_ok=True)
    runtime_root.mkdir(parents=True, exist_ok=True)
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
    rig = create_rig()
    character = create_character(rig, assigned, skeleton_type)
    actions = create_actions(rig, skeleton_type)
    camera, key, fill = configure_render(args.frame_size)

    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_root / f"skeleton-{skeleton_type}.blend"))

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)

    for obj in character:
        obj.select_set(True)

    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(source_root / f"skeleton-{skeleton_type}.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=False,
    )

    clips = {**ACTION_FRAMES, **DEATH_FRAMES} if args.with_deaths else dict(ACTION_FRAMES)
    render_frames(args.frames_root, rig, actions, clips, camera, key, fill)

    if args.with_pickups:
        render_pickups(runtime_root, rig, character, assigned, camera, key, fill, args.frame_size)


if __name__ == "__main__":
    main()
