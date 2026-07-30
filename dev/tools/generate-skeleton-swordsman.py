"""Build the authored skeleton swordsman and bake its runtime sprite atlases."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# Every clip, and how many frames it is baked at.
#
# A frame count per clip rather than one for the set. Most of these do not need eight: what a count
# buys is motion, and a clip with none in it pays the same memory for eight copies of one pose. The
# runtime half of this table is `src/content/enemies/skeleton-swordsman-definitions.ts`, and the two
# must agree or the image loader refuses the sheet at startup.
#
# The two tables are also two destinations. What a type privately owns is the clips its own weapon is
# in, and those land under its own directory; how a body dies is the same performance whichever
# weapon it was carrying, so the deaths are baked once and land in the shared one.
ACTION_FRAMES = {
    "idle": 8,
    "walk": 8,
    "attack": 8,
    "hurt": 8,
    "block": 8,
}
DEATH_FRAMES = {
    "death-collapse": 8,
    "death-drowning": 8,
    "death-cleaved": 4,
    "death-slammed": 1,
    "death-impaled": 1,
}
# Three sizes, and they are not the same number.
#
# `RENDER_SIZE` is what Blender writes per frame, `TILE_SIZE` is the atlas cell it is filtered down
# to on the way in, and `STILL_SIZE` is what the three shipped single-image assets must be, because
# the presentation manifest's loader rejects anything that is not 512 square. Rendering above the
# cell is what makes the downsample an anti-aliasing step instead of a resize.
RENDER_SIZE = 512
TILE_SIZE = 256
STILL_SIZE = 512
DIRECTIONS = 8


def require_tool(name: str, known_path: Path | None = None) -> str:
    resolved = shutil.which(name)

    if resolved:
        return resolved

    if known_path and known_path.is_file():
        return str(known_path)

    raise RuntimeError(f"required tool is unavailable: {name}")


def run(command: list[str]) -> None:
    completed = subprocess.run(command, check=False)

    if completed.returncode != 0:
        raise RuntimeError(f"command failed with exit code {completed.returncode}: {' '.join(command)}")


def bake_atlas(magick: str, frames_root: Path, target: Path, clip: str, frames: int) -> Path:
    sources = [
        str(frames_root / f"{clip}-{direction}-{frame}.png")
        for direction in range(DIRECTIONS)
        for frame in range(frames)
    ]
    run(
        [
            magick,
            "montage",
            "-quiet",
            *sources,
            "-background",
            "none",
            "-filter",
            "Lanczos",
            "-geometry",
            f"{TILE_SIZE}x{TILE_SIZE}+0+0",
            "-tile",
            f"{frames}x{DIRECTIONS}",
            str(target),
        ]
    )
    return target


def extract_still(magick: str, atlas: Path, column: int, row: int, target: Path) -> None:
    x = column * TILE_SIZE
    y = row * TILE_SIZE
    run(
        [
            magick,
            str(atlas),
            "-crop",
            f"{TILE_SIZE}x{TILE_SIZE}+{x}+{y}",
            "+repage",
            # Cut from the atlas rather than rendered again, so the still can never disagree with the
            # first frame of the clip it is taken from. It is enlarged to reach the manifest's size,
            # smoothly rather than by nearest neighbour: these three are a fallback appearance, and a
            # blocky one would reintroduce exactly the look the tile size was raised to remove.
            "-filter",
            "Catrom",
            "-resize",
            f"{STILL_SIZE}x{STILL_SIZE}",
            str(target),
        ]
    )


def main() -> int:
    repository_root = Path(__file__).resolve().parents[2]
    implementation = repository_root / "dev" / "tools" / "skeleton-swordsman" / "build.py"
    source_root = repository_root / "assets" / "enemies" / "skeleton-swordsman"
    runtime_root = repository_root / "src" / "content" / "enemies" / "assets" / "skeleton-swordsman"
    shared_root = repository_root / "src" / "content" / "enemies" / "assets" / "skeleton-common"
    source_root.mkdir(parents=True, exist_ok=True)
    runtime_root.mkdir(parents=True, exist_ok=True)
    shared_root.mkdir(parents=True, exist_ok=True)

    blender = require_tool(
        "blender",
        Path(r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe"),
    )
    magick = require_tool("magick")

    with tempfile.TemporaryDirectory(prefix="pantry-skeleton-") as temporary:
        frames_root = Path(temporary)
        run(
            [
                blender,
                "--background",
                "--factory-startup",
                "--python",
                str(implementation),
                "--",
                "--repository-root",
                str(repository_root),
                "--frames-root",
                str(frames_root),
                "--frame-size",
                str(RENDER_SIZE),
            ]
        )

        atlases = {
            clip: bake_atlas(magick, frames_root, runtime_root / f"skeleton-swordsman-atlas-{clip}.png", clip, frames)
            for clip, frames in ACTION_FRAMES.items()
        }
        atlases.update(
            {
                clip: bake_atlas(magick, frames_root, shared_root / f"skeleton-{clip}.png", clip, frames)
                for clip, frames in DEATH_FRAMES.items()
            }
        )

    extract_still(
        magick,
        atlases["idle"],
        0,
        0,
        runtime_root / "skeleton-swordsman-normal.png",
    )
    extract_still(
        magick,
        atlases["attack"],
        4,
        0,
        runtime_root / "skeleton-swordsman-attack.png",
    )
    extract_still(
        magick,
        atlases["hurt"],
        4,
        0,
        runtime_root / "skeleton-swordsman-hurt.png",
    )

    for clip, atlas in atlases.items():
        identify = subprocess.run(
            [magick, "identify", "-format", "%wx%h", str(atlas)],
            check=True,
            capture_output=True,
            text=True,
        )
        frames = ACTION_FRAMES.get(clip) or DEATH_FRAMES[clip]
        expected = f"{frames * TILE_SIZE}x{DIRECTIONS * TILE_SIZE}"

        if identify.stdout != expected:
            raise RuntimeError(f"unexpected atlas dimensions for {atlas}: {identify.stdout}, expected {expected}")

    print(f"Skeleton source: {source_root / 'skeleton-swordsman.blend'}")
    print(f"Runtime atlases: {runtime_root}")
    print(f"Shared deaths: {shared_root}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"skeleton generation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
