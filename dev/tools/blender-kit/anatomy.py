"""Skeletal anatomy built out of primitives, one step past the shapes that prove a pipeline works.

`primitives.py` owns the shapes and the binding, and the body it was written for is a proof: a
cylinder per bone, an identical ball at every joint, four equal rings for a ribcage, a sphere and a
box for a head. That body was right for what it was for — it proved the rig, the bake and the atlas
before anyone spent time on how it looked.

This module is what that body becomes when somebody has to look at it. The rules it follows:

- **Silhouette before surface.** The art direction is low-poly and flat-shaded, so detail that only
  exists in shading is detail nobody sees. Everything here changes an outline: a ribcage that is
  wider than it is deep and tapers at both ends, a spine that is a stack rather than a pole, a skull
  with a brow and a jaw rather than a ball with a box under it.
- **A long bone is not a tube.** Real ones are wide at both ends and narrow between, which is most of
  what makes a rendered bone read as bone instead of as pipe.
- **Nothing is symmetrical by accident.** Where a real skeleton is asymmetric the model is too.

It does not replace `primitives.py` and nothing here is imported by the bake. The sprite atlases the
game already ships were rendered from the simpler body, and they change when somebody deliberately
re-bakes them, not as a side effect of this file existing.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Euler, Vector

from primitives import apply_transform, assign, bind


def _finish(
    obj: bpy.types.Object,
    name: str,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None,
    bone_name: str | None,
    part: str | None,
) -> bpy.types.Object:
    obj.name = name
    assign(obj, assigned_material)
    apply_transform(obj)

    if rig and bone_name and part:
        bind(obj, rig, bone_name, part)

    return obj


def shaped_box(
    name: str,
    location,
    scale,
    rotation,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
) -> bpy.types.Object:
    """A box that can be turned. The kit's own box is axis-aligned, and a skeleton is mostly angles."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    return _finish(obj, name, assigned_material, rig, bone_name, part)


def shaped_sphere(
    name: str,
    location,
    scale,
    rotation,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
    subdivisions: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    return _finish(obj, name, assigned_material, rig, bone_name, part)


def tapered(
    name: str,
    start,
    end,
    radius_start: float,
    radius_end: float,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
    vertices: int = 8,
) -> bpy.types.Object:
    """A cone frustum between two points — the shape a tube cannot make."""
    start_vector = Vector(start)
    end_vector = Vector(end)
    delta = end_vector - start_vector
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=max(delta.length, 1e-5),
        location=(start_vector + end_vector) / 2,
    )
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    return _finish(obj, name, assigned_material, rig, bone_name, part)


def long_bone(
    name: str,
    start,
    end,
    shaft_radius: float,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
    part: str,
    head_scale: float = 1.75,
    tail_scale: float = 1.5,
) -> list[bpy.types.Object]:
    """A shaft that narrows to its waist, with a knob at each end.

    The proof body drew every limb as one cylinder of constant width with a ball on the far end,
    which is why its arms and legs read as plumbing. A real long bone is widest where it meets its
    neighbours and thinnest halfway along, and that waist is visible in silhouette from across a
    room — it is the difference between a femur and a pipe.
    """
    start_vector = Vector(start)
    end_vector = Vector(end)
    waist = shaft_radius * 0.72
    middle = start_vector.lerp(end_vector, 0.5)

    return [
        tapered(f"{name}.upper", start_vector, middle, shaft_radius, waist, assigned_material, rig, bone_name, part),
        tapered(f"{name}.lower", middle, end_vector, waist, shaft_radius, assigned_material, rig, bone_name, part),
        shaped_sphere(
            f"{name}.head",
            start_vector,
            (shaft_radius * head_scale, shaft_radius * head_scale, shaft_radius * head_scale * 0.86),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            part,
            subdivisions=1,
        ),
        shaped_sphere(
            f"{name}.tail",
            end_vector,
            (shaft_radius * tail_scale, shaft_radius * tail_scale, shaft_radius * tail_scale * 0.86),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            part,
            subdivisions=1,
        ),
    ]


def spine_column(
    base: Vector,
    top: Vector,
    count: int,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """Vertebrae, stacked, each with a spur pointing back.

    One cylinder from hips to neck is the single cheapest thing to draw and the single most obvious
    tell that a body was never modelled. A stack costs a dozen small shapes and is what a viewer
    actually recognises a spine by — most of all from behind, where the spurs make a ridge.
    """
    built: list[bpy.types.Object] = []
    axis = top - base

    for index in range(count):
        fraction = index / max(count - 1, 1)
        centre = base + axis * fraction
        # Lumbar vertebrae carry the weight and are visibly the heavy end of the column.
        width = 0.052 - 0.016 * fraction
        built.append(
            shaped_box(
                f"Vertebra.{index:02d}",
                tuple(centre),
                (width * 2, width * 1.5, 0.036),
                (0, 0, 0),
                assigned_material,
                rig,
                bone_name,
                "torso",
            )
        )
        built.append(
            shaped_box(
                f"VertebraSpur.{index:02d}",
                tuple(centre + Vector((0, -width * 1.5, -0.008))),
                (width * 0.7, width * 1.6, 0.018),
                (math.radians(18), 0, 0),
                assigned_material,
                rig,
                bone_name,
                "torso",
            )
        )

    return built


def rib_cage(
    chest: Vector,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """A cage that is wider than it is deep, widest below the middle, and closed by a sternum.

    The proof body used four rings of the same radius, which builds a barrel. A chest is an egg
    standing on its narrow end: the first rib is small, the widest sit below the middle, and the
    lowest turn back in again. It is also flattened front to back, so it reads as a chest from the
    side and not as a drum.
    """
    built: list[bpy.types.Object] = []
    # Ribs from the top down, as a fraction of the widest one.
    profile = (0.58, 0.76, 0.90, 0.98, 1.0, 0.96, 0.86, 0.70)
    widest = 0.235

    for index, factor in enumerate(profile):
        drop = 0.055 + index * 0.062
        radius = widest * factor
        # Ribs hang forward and down from the spine rather than sitting level.
        tilt = math.radians(7 + index * 1.6)
        bpy.ops.mesh.primitive_torus_add(
            major_segments=14,
            minor_segments=4,
            location=tuple(chest + Vector((0, 0.012, -drop))),
            rotation=(tilt, 0, 0),
            major_radius=radius,
            minor_radius=0.0165,
        )
        obj = bpy.context.object
        # Flattened front to back: a chest is not round.
        obj.scale = (1.0, 0.74, 1.0)
        built.append(_finish(obj, f"Rib.{index:02d}", assigned_material, rig, bone_name, "torso"))

    sternum_top = chest + Vector((0, 0.168, -0.09))
    built.append(
        tapered(
            "Sternum",
            sternum_top,
            sternum_top + Vector((0, -0.012, -0.30)),
            0.030,
            0.046,
            assigned_material,
            rig,
            bone_name,
            "torso",
        )
    )
    built.append(
        shaped_box(
            "Manubrium",
            tuple(sternum_top + Vector((0, 0.002, 0.028))),
            (0.086, 0.03, 0.062),
            (math.radians(-8), 0, 0),
            assigned_material,
            rig,
            bone_name,
            "torso",
        )
    )
    return built


def shoulder_girdle(
    chest: Vector,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """Collarbones that sweep rather than a rod across the chest, and blades behind."""
    built: list[bpy.types.Object] = []

    for sign in (-1, 1):
        built.append(
            tapered(
                f"Clavicle.{'L' if sign < 0 else 'R'}",
                tuple(chest + Vector((0.02 * sign, 0.075, -0.012))),
                tuple(chest + Vector((0.185 * sign, 0.012, 0.004))),
                0.017,
                0.023,
                assigned_material,
                rig,
                bone_name,
                "torso",
            )
        )
        built.append(
            shaped_box(
                f"Scapula.{'L' if sign < 0 else 'R'}",
                tuple(chest + Vector((0.125 * sign, -0.10, -0.085))),
                (0.135, 0.032, 0.175),
                (math.radians(-9), 0, math.radians(-13 * sign)),
                assigned_material,
                rig,
                bone_name,
                "torso",
            )
        )

    return built


def pelvis(
    hips: Vector,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """Blades that flare up and out, over a sacrum. Two balls do not make a pelvis."""
    built: list[bpy.types.Object] = []

    for sign in (-1, 1):
        side = "L" if sign < 0 else "R"
        # Narrow enough to read as bone. A wide flat blade here reads as a plate strapped to the
        # waist, which is what the first pass produced.
        built.append(
            shaped_box(
                f"Ilium.{side}",
                tuple(hips + Vector((0.088 * sign, 0.004, 0.072))),
                (0.055, 0.135, 0.125),
                (math.radians(9), math.radians(-24 * sign), 0),
                assigned_material,
                rig,
                bone_name,
                "pelvis",
            )
        )
        built.append(
            shaped_sphere(
                f"HipSocket.{side}",
                tuple(hips + Vector((0.132 * sign, 0.004, -0.012))),
                (0.062, 0.07, 0.062),
                (0, 0, 0),
                assigned_material,
                rig,
                bone_name,
                "pelvis",
                subdivisions=1,
            )
        )

    built.append(
        shaped_box(
            "Sacrum",
            tuple(hips + Vector((0, -0.052, 0.028))),
            (0.085, 0.055, 0.16),
            (math.radians(14), 0, 0),
            assigned_material,
            rig,
            bone_name,
            "pelvis",
        )
    )
    return built


def pauldron(
    shoulder: Vector,
    right_side: bool,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """A cap over the shoulder joint rather than a slab beside it.

    A box parked near the shoulder reads as luggage: it has corners the body does not, and it does
    not sit on anything. A domed cap follows the joint it covers, which is what armour does.
    """
    sign = 1 if right_side else -1
    side = "R" if right_side else "L"
    return [
        shaped_sphere(
            f"Pauldron.{side}",
            tuple(shoulder + Vector((0.012 * sign, -0.004, 0.016))),
            (0.062, 0.058, 0.05),
            (0, math.radians(14 * sign), 0),
            assigned_material,
            rig,
            bone_name,
            "armour",
            subdivisions=1,
        ),
        shaped_box(
            f"PauldronRim.{side}",
            tuple(shoulder + Vector((0.026 * sign, -0.004, -0.018))),
            (0.052, 0.098, 0.03),
            (0, math.radians(24 * sign), 0),
            assigned_material,
            rig,
            bone_name,
            "armour",
        ),
    ]


def skull(
    base: Vector,
    height: float,
    assigned_material: bpy.types.Material,
    socket_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """A cranium with a brow, cheekbones and a hinged jaw, sized off one number.

    Everything here scales from `height`, so the head is retuned by changing what a head is worth
    rather than by editing eleven coordinates that have to keep agreeing with each other. That
    matters because head size is the proportion a viewer reads a body by: the same arm reads short
    against a big head and correct against a smaller one, and the number was being argued about
    before it could be adjusted in one place.
    """
    built: list[bpy.types.Object] = []
    unit = height

    built.append(
        shaped_sphere(
            "Cranium",
            tuple(base + Vector((0, -0.02 * unit, 0.66 * unit))),
            (0.30 * unit, 0.33 * unit, 0.34 * unit),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            "head",
        )
    )
    built.append(
        shaped_box(
            "BrowRidge",
            tuple(base + Vector((0, 0.235 * unit, 0.60 * unit))),
            (0.44 * unit, 0.13 * unit, 0.10 * unit),
            (math.radians(-12), 0, 0),
            assigned_material,
            rig,
            bone_name,
            "head",
        )
    )
    built.append(
        shaped_box(
            "Maxilla",
            tuple(base + Vector((0, 0.185 * unit, 0.34 * unit))),
            (0.34 * unit, 0.20 * unit, 0.19 * unit),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            "head",
        )
    )

    for sign in (-1, 1):
        side = "L" if sign < 0 else "R"
        built.append(
            shaped_box(
                f"Zygomatic.{side}",
                tuple(base + Vector((0.185 * sign * unit, 0.12 * unit, 0.44 * unit))),
                (0.13 * unit, 0.20 * unit, 0.075 * unit),
                (0, 0, math.radians(11 * sign)),
                assigned_material,
                rig,
                bone_name,
                "head",
            )
        )
        built.append(
            shaped_sphere(
                f"EyeSocket.{side}",
                tuple(base + Vector((0.125 * sign * unit, 0.175 * unit, 0.505 * unit))),
                (0.115 * unit, 0.10 * unit, 0.125 * unit),
                (0, 0, 0),
                socket_material,
                rig,
                bone_name,
                "head",
                subdivisions=1,
            )
        )
        # The jaw is two angled halves meeting at the chin, not a block.
        built.append(
            shaped_box(
                f"Mandible.{side}",
                tuple(base + Vector((0.115 * sign * unit, 0.075 * unit, 0.155 * unit))),
                (0.085 * unit, 0.33 * unit, 0.14 * unit),
                (0, 0, math.radians(-15 * sign)),
                assigned_material,
                rig,
                bone_name,
                "head",
            )
        )

    built.append(
        shaped_box(
            "Chin",
            tuple(base + Vector((0, 0.20 * unit, 0.15 * unit))),
            (0.20 * unit, 0.10 * unit, 0.13 * unit),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            "head",
        )
    )
    built.append(
        shaped_sphere(
            "NasalAperture",
            tuple(base + Vector((0, 0.235 * unit, 0.40 * unit))),
            (0.055 * unit, 0.06 * unit, 0.085 * unit),
            (0, 0, 0),
            socket_material,
            rig,
            bone_name,
            "head",
            subdivisions=1,
        )
    )
    return built


def gripping_hand(
    wrist: Vector,
    palm: Vector,
    right_side: bool,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
    part: str,
) -> list[bpy.types.Object]:
    """A palm with fingers curled around whatever it is holding.

    Fingers rather than a knuckle ball, because these hands are always wrapped around a handle and
    the gap between an open block and a closed grip is the first thing the eye checks on a figure
    carrying a weapon.
    """
    built: list[bpy.types.Object] = []
    axis = (palm - wrist).normalized()
    across = axis.cross(Vector((0, 1, 0)))

    if across.length_squared < 1e-6:
        across = Vector((1, 0, 0))

    across.normalize()
    forward = across.cross(axis).normalized()
    centre = wrist.lerp(palm, 0.5)
    sign = 1 if right_side else -1

    built.append(
        shaped_box(
            f"Palm.{'R' if right_side else 'L'}",
            tuple(centre),
            (0.062, 0.075, 0.082),
            (0, 0, 0),
            assigned_material,
            rig,
            bone_name,
            part,
        )
    )

    for index in range(3):
        offset = centre + axis * (0.022 - index * 0.024) + forward * 0.044
        built.append(
            shaped_box(
                f"Finger.{'R' if right_side else 'L'}.{index}",
                tuple(offset),
                (0.052, 0.03, 0.022),
                (0, 0, 0),
                assigned_material,
                rig,
                bone_name,
                part,
            )
        )

    built.append(
        shaped_box(
            f"Thumb.{'R' if right_side else 'L'}",
            tuple(centre + axis * 0.03 - across * 0.032 * sign + forward * 0.018),
            (0.032, 0.05, 0.026),
            (0, 0, math.radians(22 * sign)),
            assigned_material,
            rig,
            bone_name,
            part,
        )
    )
    return built


def detailed_sword(
    guard: Vector,
    assigned: dict[str, bpy.types.Material],
    rig: bpy.types.Object,
    bone_name: str,
) -> list[bpy.types.Object]:
    """The same sword, with a taper, a fuller, a bound grip and a shaped crossguard.

    Dimensions match the kit's sword so that a pose authored against this blade transfers to the one
    the bake uses; what changes is that the blade narrows toward the point instead of being a
    constant slab, which is most of what a sword's silhouette is.
    """
    x, y, z = guard
    part = "sword"
    built: list[bpy.types.Object] = []

    built.append(
        tapered(
            "SwordBlade",
            (x, y, z + 0.02),
            (x, y, z + 0.86),
            0.048,
            0.030,
            assigned["steel"],
            rig,
            bone_name,
            part,
            vertices=4,
        )
    )
    built.append(
        tapered(
            "SwordPoint",
            (x, y, z + 0.86),
            (x, y, z + 1.03),
            0.030,
            0.004,
            assigned["steel"],
            rig,
            bone_name,
            part,
            vertices=4,
        )
    )
    # The groove down the middle of the blade, sunk a shade darker.
    built.append(
        shaped_box(
            "SwordFuller",
            (x, y, z + 0.44),
            (0.022, 0.042, 0.80),
            (0, 0, 0),
            assigned["iron"],
            rig,
            bone_name,
            part,
        )
    )
    built.append(
        tapered("SwordGuard", (x - 0.19, y, z), (x + 0.19, y, z), 0.030, 0.030, assigned["brass"], rig, bone_name, part, vertices=6)
    )

    for sign in (-1, 1):
        built.append(
            shaped_box(
                f"SwordGuardTip.{'L' if sign < 0 else 'R'}",
                (x + 0.185 * sign, y, z),
                (0.055, 0.055, 0.055),
                (0, math.radians(45), 0),
                assigned["brass"],
                rig,
                bone_name,
                part,
            )
        )

    built.append(
        tapered("SwordGrip", (x, y, z - 0.05), (x, y, z - 0.27), 0.038, 0.034, assigned["leather"], rig, bone_name, part)
    )

    # Wire binding: three rings up the leather, which is what stops a grip reading as a dowel.
    for index in range(3):
        built.append(
            shaped_sphere(
                f"SwordBinding.{index}",
                (x, y, z - 0.09 - index * 0.06),
                (0.042, 0.042, 0.012),
                (0, 0, 0),
                assigned["brass"],
                rig,
                bone_name,
                part,
                subdivisions=1,
            )
        )

    built.append(
        shaped_sphere(
            "SwordPommel",
            (x, y, z - 0.30),
            (0.058, 0.058, 0.052),
            (0, 0, 0),
            assigned["brass"],
            rig,
            bone_name,
            part,
        )
    )
    return built
