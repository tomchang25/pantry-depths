"""Build the blocky skeleton and put its clips where the browser can load them.

Two files come out. The `.blend` lands in the ignored asset tree and is the manual fallback: when a
clip table resists, somebody opens it, rotates a bone in pose mode, and folds the number back into
the table. The `.glb` lands under the workbench and is committed, because it is what the viewer
reads and what anyone without Blender sees.

Re-runnable. Editing an angle in the table and running this again is the whole authoring loop.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def require_blender() -> str:
    resolved = shutil.which("blender")

    if resolved:
        return resolved

    known = Path(r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe")

    if known.is_file():
        return str(known)

    raise RuntimeError("required tool is unavailable: blender")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the blocky skeleton, or re-export an edited one.")
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Skip the build and export the existing .blend, keeping any pose fixed by hand in it.",
    )
    args = parser.parse_args()
    repository_root = Path(__file__).resolve().parents[2]
    implementation = repository_root / "dev" / "tools" / "skeletons" / "blocky_build.py"
    blend = repository_root / "assets" / "enemies" / "skeleton-blocky" / "skeleton-blocky.blend"
    glb = repository_root / "src" / "sandbox" / "three-block" / "assets" / "skeleton-blocky.glb"

    if args.export_only and not blend.is_file():
        raise RuntimeError(f"nothing to export: {blend} does not exist")

    # Removed first, so that the check below cannot pass on a leftover file from an earlier run.
    # The .blend survives an export-only run, because that run exists to preserve what is in it.
    if not args.export_only:
        blend.unlink(missing_ok=True)

    glb.unlink(missing_ok=True)

    completed = subprocess.run(
        [
            require_blender(),
            "--background",
            *(["--factory-startup"] if not args.export_only else [str(blend)]),
            "--python",
            str(implementation),
            "--",
            "--blend",
            str(blend),
            "--glb",
            str(glb),
            *(["--export-only"] if args.export_only else []),
        ],
        check=False,
    )

    if completed.returncode != 0:
        raise RuntimeError(f"blender exited with code {completed.returncode}")

    for target in (blend, glb):
        if not target.is_file():
            raise RuntimeError(f"blender reported success but wrote nothing to {target}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"blocky skeleton generation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
