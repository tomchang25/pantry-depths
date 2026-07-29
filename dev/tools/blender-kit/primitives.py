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
