"""Carry the authored poses out of Blender and into the repository.

The authoring `.blend` lives under the ignored asset tree, so nothing in `src/` can depend on it and
nobody without Blender can see what was posed. This writes the one file that crosses that line: a
glTF binary under the Three.js preview, committed, which the workbench loads.

Run it after posing. It exports whatever the action currently holds.
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
    source = repository_root / "assets" / "enemies" / "skeleton-swordsman" / "skeleton-swordsman-authoring.blend"
    target = repository_root / "src" / "sandbox" / "three-preview" / "assets" / "skeleton-swordsman-authored.glb"
    implementation = repository_root / "dev" / "tools" / "skeletons" / "export_glb.py"

    if not source.is_file():
        raise RuntimeError(f"no authoring file at {source}; run generate-authoring-rig.py first")

    target.unlink(missing_ok=True)
    completed = subprocess.run(
        [
            require_blender(),
            "--background",
            str(source),
            "--python",
            str(implementation),
            "--",
            "--target",
            str(target),
        ],
        check=False,
    )

    if completed.returncode != 0:
        raise RuntimeError(f"blender exited with code {completed.returncode}")

    if not target.is_file():
        raise RuntimeError(f"blender reported success but wrote nothing to {target}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"authoring export failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
