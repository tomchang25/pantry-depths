"""Lift an authored action back onto the floor, without altering the pose in it.

A pose authored a hand's width below the ground is not a pose with a mistake in it — it is a correct
pose standing in the wrong place. So this moves the master control, which every other control hangs
from, and touches nothing else: joint angles, stance, sword placement and the relationship between
the hips and the feet all come through exactly as they were dragged.

Raising the feet alone would have been the other option and is wrong for the same reason. The feet
are where they were put relative to the hips; pulling them up without the hips compresses the legs
and quietly re-authors the stance.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

RIG_NAME = "SkeletonAuthoringRig"
FOOT_PARTS = ("foot.L", "foot.R")


def lowest_sole(rig: bpy.types.Object) -> float:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    heights = [
        (obj.evaluated_get(depsgraph).matrix_world @ Vector(corner)).z
        for obj in bpy.data.objects
        if obj.get("skeleton_part") in FOOT_PARTS
        for corner in obj.bound_box
    ]

    if not heights:
        raise RuntimeError("no foot meshes found; is this the authoring rig?")

    return min(heights)


def keyed_frames(rig: bpy.types.Object, bone: str) -> list[int]:
    action = rig.animation_data.action if rig.animation_data else None

    if action is None:
        raise RuntimeError("the rig carries no action; there is nothing to ground")

    frames: set[int] = set()
    for curve in action.fcurves:
        if f'"{bone}"' in curve.data_path:
            frames.update(int(round(key.co[0])) for key in curve.keyframe_points)

    return sorted(frames)


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Stand an authored action back on the floor.")
    parser.add_argument("--blend", type=Path, required=True)
    parser.add_argument(
        "--ground",
        type=float,
        default=None,
        help="Sole height to land on. Defaults to whatever the rest pose stands at.",
    )
    return parser.parse_args(arguments)


def main() -> None:
    args = parse_arguments()
    rig = bpy.data.objects[RIG_NAME]
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")

    if args.ground is not None:
        ground = args.ground
    else:
        # The rest pose is the reference: it is where the body was built standing.
        stored = {bone.name: (bone.location.copy(), bone.rotation_quaternion.copy()) for bone in rig.pose.bones}
        for bone in rig.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = (1, 0, 0, 0)
            bone.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        ground = lowest_sole(rig)
        for bone in rig.pose.bones:
            bone.location, bone.rotation_quaternion = stored[bone.name]
        bpy.context.view_layer.update()

    frames = keyed_frames(rig, "ctrl_master")
    print(f"\n--- grounding to {ground:.3f} ---")
    print(f"{'frame':>5} {'sole before':>12} {'lift':>8} {'sole after':>11}")

    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        before = lowest_sole(rig)
        lift = ground - before

        master = rig.pose.bones["ctrl_master"]
        matrix = master.matrix.copy()
        matrix.translation += Vector((0, 0, lift))
        master.matrix = matrix
        bpy.context.view_layer.update()
        master.keyframe_insert(data_path="location", frame=frame)

        print(f"{frame:5d} {before:12.3f} {lift:+8.3f} {lowest_sole(rig):11.3f}")

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend))
    print(f"saved {args.blend}")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001  (re-raised as a process failure after the traceback is shown)
        import traceback

        traceback.print_exc()
        sys.exit(1)
