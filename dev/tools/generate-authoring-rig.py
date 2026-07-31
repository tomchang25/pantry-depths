"""Build the hand-authoring rig and leave a .blend to pose in.

Sister to `generate-skeletons.py`, and deliberately not part of it. That one is a bake: it drives
Blender four times, renders eight directions of every clip, and montages the atlases the game ships.
This one renders nothing and ships nothing. It writes one file for a person to open.

Keeping them apart is the point. The bake pipeline must not change to suit hand posing, and a rig
being reshaped while somebody learns it must not be able to break the atlases the game loads.
"""

from __future__ import annotations

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
    repository_root = Path(__file__).resolve().parents[2]
    implementation = repository_root / "dev" / "tools" / "skeletons" / "authoring_rig.py"
    target = repository_root / "assets" / "enemies" / "skeleton-swordsman" / "skeleton-swordsman-authoring.blend"

    # Removed first so that the check below cannot pass on a leftover file. A Blender script that
    # crashes on its way to saving still exits zero, so "the file is there" is not evidence the build
    # produced it — this makes the file's existence mean exactly one run.
    target.unlink(missing_ok=True)

    completed = subprocess.run(
        [
            require_blender(),
            "--background",
            "--factory-startup",
            "--python",
            str(implementation),
            "--",
            "--repository-root",
            str(repository_root),
        ],
        check=False,
    )

    if completed.returncode != 0:
        raise RuntimeError(f"blender exited with code {completed.returncode}")

    if not target.is_file():
        raise RuntimeError(f"blender reported success but wrote nothing to {target}")

    print(f"Authoring rig: {target}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"authoring rig generation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
