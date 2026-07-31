"""Export the authoring rig and whatever is posed on it to a glTF binary the browser can load.

The `.blend` is the authoring surface and is deliberately outside version control; this is the
artefact that crosses into the repository, so that what the preview shows is a file somebody
exported rather than a Blender install somebody happens to have.

Only the rig and the meshes bound to it go out. The controllers travel too, because they are ordinary
bones and the animation is keyed on them — a glTF with the deform bones alone would carry a skeleton
that no longer knows why it is in that shape.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy

RIG_NAME = "SkeletonAuthoringRig"


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Export the authoring rig to glTF binary.")
    parser.add_argument("--target", type=Path, required=True)
    return parser.parse_args(arguments)


def main() -> None:
    args = parse_arguments()
    rig = bpy.data.objects[RIG_NAME]
    args.target.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)

    exported = 0
    for obj in bpy.data.objects:
        # The controller widgets are viewport furniture; they are not the body and must not ship.
        if obj.type == "MESH" and obj.get("skeleton_part") is not None:
            obj.select_set(True)
            exported += 1

    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(args.target),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=False,
        export_apply=False,
    )

    action = rig.animation_data.action if rig.animation_data else None
    size = args.target.stat().st_size
    print(f"\nexported {exported} meshes and {len(rig.data.bones)} bones")
    print(f"action: {action.name if action else 'none'}   frames: {tuple(int(v) for v in action.frame_range) if action else '-'}")
    print(f"wrote {args.target} ({size / 1024:.0f} KB)")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001  (re-raised as a process failure after the traceback is shown)
        import traceback

        traceback.print_exc()
        sys.exit(1)
