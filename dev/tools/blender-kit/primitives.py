"""Blender primitives shared by every offline model this project bakes.

Two tools build bodies out of the same handful of shapes — a cylinder between two points, an
ellipsoid, a box, a torus — bind them to a bone, and point a camera at them. They were written once
for the skeleton swordsman and copied nowhere, because the second tool that needed them is the one
that made this file: the player's sword is the skeleton's sword with different metal in it, and a
second copy of `create_sword` would have been two swords that drift apart.

Imported by path rather than as a package, since a Blender script runs with no project on the path:

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "blender-kit"))
    import primitives
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures, bpy.data.materials):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float], metallic: float = 0.0, roughness: float = 0.6):
    created = bpy.data.materials.new(name)
    created.diffuse_color = color
    created.use_nodes = True
    shader = created.node_tree.nodes.get("Principled BSDF")

    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Metallic"].default_value = metallic

    return created


def apply_transform(obj: bpy.types.Object) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def assign(obj: bpy.types.Object, assigned_material: bpy.types.Material) -> None:
    obj.data.materials.append(assigned_material)


def bind(obj: bpy.types.Object, rig: bpy.types.Object, bone_name: str, part: str) -> bpy.types.Object:
    obj["skeleton_part"] = part
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new(name="SkeletonRig", type="ARMATURE")
    modifier.object = rig
    obj.parent = rig
    return obj


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
) -> bpy.types.Object:
    start_vector = Vector(start)
    end_vector = Vector(end)
    delta = end_vector - start_vector
    midpoint = (start_vector + end_vector) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=delta.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    assign(obj, assigned_material)
    apply_transform(obj)

    if rig and bone_name and part:
        bind(obj, rig, bone_name, part)

    return obj


def ellipsoid(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, assigned_material)
    apply_transform(obj)

    if rig and bone_name and part:
        bind(obj, rig, bone_name, part)

    return obj


def box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    part: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, assigned_material)
    apply_transform(obj)

    if rig and bone_name and part:
        bind(obj, rig, bone_name, part)

    return obj


def torus(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    assigned_material: bpy.types.Material,
    rig: bpy.types.Object,
    bone_name: str,
    part: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=12,
        minor_segments=4,
        location=location,
        major_radius=0.2,
        minor_radius=0.022,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    assign(obj, assigned_material)
    apply_transform(obj)
    bind(obj, rig, bone_name, part)
    return obj


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def create_sword(
    prefix: str,
    assigned: dict[str, bpy.types.Material],
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    offset: tuple[float, float, float] = (0.44, 0.48, 1.08),
) -> list[bpy.types.Object]:
    x, y, z = offset
    part = "sword"
    blade = box(f"{prefix}SwordBlade", (x, y, z + 0.48), (0.07, 0.036, 0.92), assigned["steel"], rig, bone_name, part)
    tip = ellipsoid(f"{prefix}SwordTip", (x, y, z + 0.98), (0.04, 0.025, 0.09), assigned["steel"], rig, bone_name, part)
    guard = box(f"{prefix}SwordGuard", (x, y, z), (0.36, 0.07, 0.07), assigned["brass"], rig, bone_name, part)
    grip = cylinder_between(
        f"{prefix}SwordGrip",
        (x, y, z - 0.05),
        (x, y, z - 0.28),
        0.042,
        assigned["leather"],
        rig,
        bone_name,
        part,
    )
    pommel = ellipsoid(f"{prefix}SwordPommel", (x, y, z - 0.31), (0.065, 0.05, 0.065), assigned["brass"], rig, bone_name, part)
    return [blade, tip, guard, grip, pommel]


def create_hammer(
    prefix: str,
    assigned: dict[str, bpy.types.Material],
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    offset: tuple[float, float, float] = (0.44, 0.48, 1.08),
) -> list[bpy.types.Object]:
    """A short haft under a squared head: mass at the far end, and no edge anywhere on it."""
    x, y, z = offset
    part = "hammer"
    haft = cylinder_between(
        f"{prefix}HammerHaft",
        (x, y, z - 0.34),
        (x, y, z + 0.72),
        0.05,
        assigned["leather"],
        rig,
        bone_name,
        part,
    )
    head = box(f"{prefix}HammerHead", (x, y, z + 0.78), (0.15, 0.15, 0.3), assigned["steel"], rig, bone_name, part)
    face = box(f"{prefix}HammerFace", (x, y, z + 0.95), (0.19, 0.19, 0.08), assigned["steel"], rig, bone_name, part)
    peen = box(f"{prefix}HammerPeen", (x, y, z + 0.6), (0.1, 0.1, 0.12), assigned["iron"], rig, bone_name, part)
    butt = ellipsoid(
        f"{prefix}HammerButt", (x, y, z - 0.37), (0.06, 0.06, 0.05), assigned["iron"], rig, bone_name, part
    )
    return [haft, head, face, peen, butt]


def create_javelin(
    prefix: str,
    assigned: dict[str, bpy.types.Material],
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    offset: tuple[float, float, float] = (0.44, 0.48, 1.08),
) -> list[bpy.types.Object]:
    """One long shaft. Its whole silhouette is length, so it reads as a throw before it is thrown."""
    x, y, z = offset
    part = "javelin"
    shaft = cylinder_between(
        f"{prefix}JavelinShaft",
        (x, y, z - 0.72),
        (x, y, z + 1.02),
        0.032,
        assigned["bone"],
        rig,
        bone_name,
        part,
    )
    head = ellipsoid(
        f"{prefix}JavelinHead", (x, y, z + 1.12), (0.045, 0.045, 0.16), assigned["steel"], rig, bone_name, part
    )
    collar = box(f"{prefix}JavelinCollar", (x, y, z + 0.98), (0.06, 0.06, 0.05), assigned["brass"], rig, bone_name, part)
    grip = cylinder_between(
        f"{prefix}JavelinGrip",
        (x, y, z - 0.06),
        (x, y, z + 0.12),
        0.045,
        assigned["leather"],
        rig,
        bone_name,
        part,
    )
    return [shaft, head, collar, grip]


def create_crossbow(
    prefix: str,
    assigned: dict[str, bpy.types.Material],
    rig: bpy.types.Object | None = None,
    bone_name: str | None = None,
    offset: tuple[float, float, float] = (0.44, 0.48, 1.08),
) -> list[bpy.types.Object]:
    """A stock crossed by a bow. Held level rather than raised, which is the whole of how it reads."""
    x, y, z = offset
    part = "crossbow"
    stock = box(f"{prefix}CrossbowStock", (x, y + 0.24, z), (0.07, 0.72, 0.09), assigned["bone"], rig, bone_name, part)
    bow = box(f"{prefix}CrossbowBow", (x, y + 0.5, z + 0.04), (0.86, 0.05, 0.045), assigned["iron"], rig, bone_name, part)
    tiller = box(
        f"{prefix}CrossbowTiller", (x, y - 0.08, z - 0.08), (0.05, 0.22, 0.11), assigned["leather"], rig, bone_name, part
    )
    lath = cylinder_between(
        f"{prefix}CrossbowString",
        (x - 0.4, y + 0.5, z + 0.04),
        (x + 0.4, y + 0.5, z + 0.04),
        0.012,
        assigned["steel"],
        rig,
        bone_name,
        part,
    )
    return [stock, bow, tiller, lath]
