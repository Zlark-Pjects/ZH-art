"""Stickville's Blender modelling kit: material and primitive helpers, and the models for the
game's buildings, vehicles and props. blender/build_city_art.py renders them; import it in your
own scripts to build models in the same style (see examples/make_rocket.py).

Units: metres. Models stand on Z = 0 with their front facing -Y (towards the camera) and, for
vehicles, pointing +X.
"""

import math
import os

import bpy

PX = 1 / 38  # some vehicle parts below were laid out in 38-px-per-metre units

# ---------- Helpers ----------


def lin(hex_color):
    h = hex_color.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


_mats = {}


def mat(color, rough=0.55, metal=0.0, emit=None, glass=False):
    key = (color, rough, metal, emit, glass)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(f"m{len(_mats)}")
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = lin(color)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = lin(emit)
        p.inputs["Emission Strength"].default_value = 3.0
    if glass:
        # Tinted see-through glass: the rider shows through the windows
        p.inputs["Alpha"].default_value = 0.35
        p.inputs["Roughness"].default_value = 0.05
    _mats[key] = m
    return m


def clear():
    for ob in list(bpy.data.objects):
        if ob.name.startswith("Stickville"):
            continue
        bpy.data.objects.remove(ob, do_unlink=True)


def _finish(ob, material, bevel):
    ob.data.materials.append(material)
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    for poly in ob.data.polygons:
        poly.use_smooth = True
    return ob


def box(x, z, w, h, d, color, y=0.0, bevel=0.03, **kw):
    """A box whose bottom-centre-front sits at (x, y, z); w along X, h along Z, d deep along Y."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y + d / 2, z + h / 2))
    ob = bpy.context.object
    ob.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(ob, mat(color, **kw), bevel)


def cyl(x, z, r, length, color, axis="Y", y=0.0, verts=32, bevel=0.01, **kw):
    rot = {"X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0), "Z": (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=length, location=(x, y, z), rotation=rot)
    ob = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    return _finish(ob, mat(color, **kw), bevel)


def rod(a, b, r, color, **kw):
    """A tube from point a to point b (x, y, z)."""
    ax, ay, az = a
    bx, by, bz = b
    dx, dy, dz = bx - ax, by - ay, bz - az
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=length, location=((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2))
    ob = bpy.context.object
    ob.rotation_mode = "QUATERNION"
    from mathutils import Vector

    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector((dx, dy, dz)))
    bpy.ops.object.transform_apply(rotation=True)
    return _finish(ob, mat(color, **kw), 0)


def ball(x, z, r, color, y=0.0, sz=1.0, **kw):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z), segments=32, ring_count=16)
    ob = bpy.context.object
    ob.scale = (1, 1, sz)
    bpy.ops.object.transform_apply(scale=True)
    return _finish(ob, mat(color, **kw), 0)


def prism(x, z, w, h, d, color, y=0.0, apex=0.5, **kw):
    """A triangular prism (a roof): base w wide at height z, peak h above, d deep."""
    me = bpy.data.meshes.new("prism")
    x0, x1, xa = x - w / 2, x + w / 2, x - w / 2 + w * apex
    v = [(x0, y, z), (x1, y, z), (xa, y, z + h), (x0, y + d, z), (x1, y + d, z), (xa, y + d, z + h)]
    f = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    me.from_pydata(v, [], f)
    ob = bpy.data.objects.new("prism", me)
    bpy.context.scene.collection.objects.link(ob)
    return _finish(ob, mat(color, **kw), 0.02)


def text(s, x, z, size, color, y=-0.02, **kw):
    bpy.ops.object.text_add(location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    ob = bpy.context.object
    ob.data.body = s
    ob.data.size = size
    ob.data.align_x = "CENTER"
    ob.data.align_y = "CENTER"
    ob.data.extrude = 0.01
    ob.data.materials.append(mat(color, **kw))
    return ob


def window(x, z, w, h, frame="#edeae3", y=-0.03, lights=None):
    """A framed window. Its pane is also added to `lights` for the night-time glow pass."""
    box(x, z - 0.04, w + 0.12, h + 0.08, 0.06, frame, y=y, bevel=0.01)
    pane = box(x, z, w, h, 0.04, "#7fb8e6", y=y - 0.03, bevel=0.005, rough=0.15)
    glow = box(x, z, w, h, 0.04, "#ffd36b", y=y - 0.035, bevel=0.0, emit="#ffd36b")
    glow.hide_render = True
    if lights is not None:
        lights.append(glow)
    return pane


def cut_below_ground(ob):
    """Remove everything under Z = 0 (the object's transform must be applied)."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def scene_objects():
    return [o for o in bpy.context.scene.objects if o.type in {"MESH", "FONT", "CURVE"} and not o.name.startswith("Stickville")]


# ---------- Buildings (plot is 220 px ≈ 5.8 m wide; centred on the plot) ----------


def house(L, wall="#e08a5a", roof="#8a3a2a", trim="#a85a3a"):
    box(0, 0, 4.2, 2.9, 3.0, wall)
    box(0, 0, 4.45, 0.18, 3.1, trim, y=-0.05)
    prism(0, 2.85, 4.8, 1.65, 3.3, roof, y=-0.15)
    box(1.05, 3.1, 0.42, 1.3, 0.42, "#6a6a6a", y=1.0)
    box(0, 0, 0.75, 1.4, 0.1, "#5a3a2a", y=-0.06)
    ball(0.25, 0.7, 0.04, "#ffb224", y=-0.12)
    window(-1.35, 1.6, 0.9, 0.75, lights=L)
    window(1.35, 1.6, 0.9, 0.75, lights=L)
    box(0, 0, 1.2, 0.12, 0.6, "#8e8b84", y=-0.6)


def school(L):
    box(0, 0, 5.3, 3.7, 3.4, "#c94f4f")
    box(0, 3.65, 5.6, 0.28, 3.6, "#8c3434", y=-0.1)
    box(0, 3.9, 1.2, 1.35, 1.2, "#c94f4f", y=1.1)
    prism(0, 5.25, 1.5, 0.7, 1.5, "#8c3434", y=0.95)
    cyl(0, 4.55, 0.34, 0.06, "#edeae3", y=1.07)
    text("SCHOOL", 0, 3.15, 0.42, "#edeae3", y=-0.03)
    for i in range(4):
        window(-1.95 + i * 1.3, 1.55, 0.8, 0.8, lights=L)
    box(0, 0, 0.9, 1.25, 0.1, "#5a3a2a", y=-0.06)
    box(0, 0, 1.6, 0.16, 0.7, "#8e8b84", y=-0.7)


def garage(L):
    box(0, 0, 4.7, 2.9, 3.6, "#4f7fc9")
    box(0, 2.85, 5.25, 0.32, 3.8, "#2f4f86", y=-0.1)
    box(0, 0, 3.7, 2.1, 0.06, "#c9c9c9", y=-0.04, rough=0.35, metal=0.3)
    for i in range(8):
        box(0, 0.18 + i * 0.24, 3.7, 0.04, 0.03, "#8e8b84", y=-0.075, bevel=0)
    text("GARAGE", 0, 2.45, 0.32, "#edeae3", y=-0.03)
    box(0, 0, 4.0, 0.06, 1.6, "#5d5b56", y=-1.6, bevel=0)


def barracks(L):
    # A quonset hut: half a cylinder lying along X
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=2.0, depth=5.6, location=(0, 1.6, 0), rotation=(0, math.pi / 2, 0))
    hut = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True)
    _finish(cut_below_ground(hut), mat("#6b7a3a", rough=0.8), 0)
    for i in range(7):
        rx = -2.4 + i * 0.8
        bpy.ops.mesh.primitive_torus_add(major_radius=2.0, minor_radius=0.04, location=(rx, 1.6, 0), rotation=(0, math.pi / 2, 0))
        bpy.ops.object.transform_apply(location=True, rotation=True)
        _finish(cut_below_ground(bpy.context.object), mat("#4f5a2a"), 0)
    box(0, 0, 0.95, 1.35, 0.1, "#3a3f24", y=-0.45)
    window(-1.45, 1.05, 0.7, 0.45, lights=L, y=-0.3)
    window(1.45, 1.05, 0.7, 0.45, lights=L, y=-0.3)
    for k in range(4):
        ball(-2.4 + k * 0.45, 0.18, 0.24, "#c9b28a", y=-0.7, sz=0.65)
    # Flagpole (the flag itself waves in the game)
    cyl(104 * PX, 1.97, 0.04, 3.95, "#8e8b84", axis="Z", y=-0.2, metal=0.6, rough=0.3)
    ball(104 * PX, 3.95, 0.08, "#ffb224", y=-0.2)


def workshop(L):
    box(0, 0, 4.2, 2.6, 3.2, "#8a6a4a")
    # Slanted roof
    me = bpy.data.meshes.new("roof")
    v = [(-2.45, -0.2, 2.55), (2.45, -0.2, 2.55), (2.45, -0.2, 3.4), (-1.1, -0.2, 3.4), (-2.45, 3.4, 2.55), (2.45, 3.4, 2.55), (2.45, 3.4, 3.4), (-1.1, 3.4, 3.4)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me.from_pydata(v, [], f)
    ob = bpy.data.objects.new("roof", me)
    bpy.context.scene.collection.objects.link(ob)
    _finish(ob, mat("#5a4320"), 0.02)
    box(-1.05, 0, 1.3, 1.7, 0.1, "#3a2a1a", y=-0.06)
    for i in range(5):
        box(-1.05, 0.15 + i * 0.32, 1.3, 0.03, 0.03, "#2a1a0a", y=-0.12, bevel=0)
    window(1.15, 1.3, 1.05, 0.8, lights=L)
    box(1.9, 0, 0.5, 0.9, 0.5, "#a07a3a", y=-0.7)
    cyl(1.25, 0.32, 0.28, 0.62, "#3a6a8a", axis="Z", y=-0.7, metal=0.4)


def solar(L):
    for i in range(3):
        px = -1.8 + i * 1.8
        cyl(px, 0.5, 0.05, 1.0, "#8e8b84", axis="Z", y=0.4, metal=0.7, rough=0.3)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(px, 0.4, 1.05))
        p = bpy.context.object
        p.scale = (1.6, 0.9, 0.06)
        p.rotation_euler = (math.radians(-35), 0, 0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        _finish(p, mat("#20406a", rough=0.15, metal=0.4), 0.01)
        for k in range(3):
            rod((px - 0.8 + 0.4 * (k + 1), 0.4 - 0.37, 1.05 - 0.26), (px - 0.8 + 0.4 * (k + 1), 0.4 + 0.37, 1.05 + 0.26), 0.008, "#9fd3ff", emit="#9fd3ff")
    box(2.6, 0, 0.6, 1.0, 0.6, "#5d5b56", y=0.6)


def tree(x, s=1.0, y=0.0, color="#3f8a3a"):
    cyl(x, 0.65 * s, 0.13 * s, 1.3 * s, "#6a4a2a", axis="Z", y=y + 0.3)
    ball(x, 1.75 * s, 0.8 * s, color, y=y + 0.3, rough=0.9)
    ball(x - 0.35 * s, 2.05 * s, 0.5 * s, "#4f9a4a", y=y + 0.1, rough=0.9)
    ball(x + 0.38 * s, 1.95 * s, 0.45 * s, "#357a30", y=y + 0.15, rough=0.9)


def park(L):
    tree(-1.85, 1.0)
    tree(1.4, 1.25, y=0.6)
    tree(-0.3, 0.8, y=1.2)
    box(0.2, 0.42, 1.6, 0.08, 0.45, "#8a5a2a", y=-0.4)
    box(0.2, 0.55, 1.6, 0.35, 0.06, "#8a5a2a", y=0.02)
    for dx in (-0.65, 0.65):
        box(0.2 + dx, 0, 0.08, 0.42, 0.4, "#3a3a42", y=-0.38, bevel=0)
    for k, c in enumerate(["#ff6b8a", "#ffb224", "#9b6bff", "#ff6b8a"]):
        ball(-2.6 + k * 0.25, 0.1, 0.09, c, y=-0.6)


def hospital(L):
    box(0, 0, 5.0, 4.75, 3.4, "#e8e8e8", rough=0.4)
    box(0, 4.7, 5.25, 0.22, 3.6, "#b8b8b8", y=-0.1)
    box(0, 3.75, 0.42, 1.15, 0.08, "#ff5a4e", y=-0.06)
    box(-0.42, 4.12, 0.42, 0.42, 0.08, "#ff5a4e", y=-0.06)
    box(0.42, 4.12, 0.42, 0.42, 0.08, "#ff5a4e", y=-0.06)
    for r in range(2):
        for i in range(4):
            window(-1.8 + i * 1.2, 1.55 + r * 1.1, 0.72, 0.68, frame="#b8b8b8", lights=L)
    box(0, 0, 0.95, 0.8, 0.1, "#9fd3ff", y=-0.06, rough=0.1)
    box(0, 0.8, 1.6, 0.12, 0.8, "#ff5a4e", y=-0.75)


def helipad(L):
    box(0, 0, 5.3, 0.36, 4.0, "#3a3a42", rough=0.7)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.4, minor_radius=0.05, location=(0, 1.9, 0.37))
    _finish(bpy.context.object, mat("#ffb224", emit="#ffb224"), 0)
    text("H", 0, 0.37, 1.2, "#edeae3", y=1.9).rotation_euler = (0, 0, 0)
    # Control tower (the windsock waves in the game)
    box(2.5, 0, 0.32, 1.6, 0.32, "#6a6a72", y=0.2)
    box(2.5, 1.55, 0.7, 0.55, 0.7, "#8e8b84", y=0.05)
    window(2.5, 1.62, 0.45, 0.35, lights=L, y=0.0)


BUILDINGS = {
    "house": house, "school": school, "garage": garage, "barracks": barracks, "workshop": workshop,
    "solar": solar, "park": park, "hospital": hospital, "helipad": helipad,
}

# ---------- Vehicle bodies (wheels and rotors are drawn by the game) ----------


def bike():
    c = "#ef5a3c"
    rear, front = (-26 * PX, 0, 13 * PX), (26 * PX, 0, 13 * PX)
    seat, head, bb = (-4 * PX, 0, 32 * PX), (18 * PX, 0, 40 * PX), (2 * PX, 0, 18 * PX)
    for a, b in [(rear, seat), (seat, head), (head, front), (rear, bb), (bb, head), (bb, seat)]:
        rod(a, b, 0.045, "#2a2a30", metal=0.6, rough=0.3)
    for dy in (-0.09, 0.09):
        rod((head[0], dy, head[2]), (front[0], dy, front[2]), 0.03, "#8e8b84", metal=0.8, rough=0.2)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(4 * PX, 0, 39 * PX))
    tank = bpy.context.object
    tank.scale = (1.25, 0.6, 0.45)
    bpy.ops.object.transform_apply(scale=True)
    _finish(tank, mat(c, rough=0.25), 0)
    box(-12 * PX, 33 * PX, 0.5, 0.1, 0.24, "#1d1d24", y=-0.12, bevel=0.04)
    box(28 * PX, 13 * PX, 0.5, 0.06, 0.18, c, y=-0.09, bevel=0.02)
    box(-30 * PX, 15 * PX, 0.55, 0.06, 0.18, c, y=-0.09, bevel=0.02)
    rod((head[0], 0, head[2]), (22 * PX, 0, 48 * PX), 0.03, "#1d1d24")
    rod((22 * PX, -0.3, 48 * PX), (22 * PX, 0.3, 48 * PX), 0.025, "#1d1d24")
    cyl(-6 * PX, 18 * PX, 0.07, 0.6, "#8e8b84", axis="X", y=0.12, metal=0.9, rough=0.2)


def car(c="#3fa7ff", trim="#2c78c0"):
    box(0, 14 * PX, 112 * PX, 32 * PX, 1.7, c, y=-0.85 + 0.85, rough=0.25, bevel=0.12)
    # Cabin: a sloped glasshouse
    me = bpy.data.meshes.new("cabin")
    z0, z1 = 46 * PX - 0.02, 78 * PX
    xs = [-40 * PX, 36 * PX, 18 * PX, -30 * PX]
    v = [(xs[0], 0.15, z0), (xs[1], 0.15, z0), (xs[2], 0.15, z1), (xs[3], 0.15, z1), (xs[0], 1.55, z0), (xs[1], 1.55, z0), (xs[2], 1.55, z1), (xs[3], 1.55, z1)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me.from_pydata(v, [], f)
    ob = bpy.data.objects.new("cabin", me)
    bpy.context.scene.collection.objects.link(ob)
    _finish(ob, mat("#9fd3ff", glass=True), 0.02)
    # Pillars and roof
    for a, b in [((xs[0], 0.12, z0), (xs[3], 0.12, z1)), ((xs[1], 0.12, z0), (xs[2], 0.12, z1)), ((-5 * PX, 0.12, z0), (-5 * PX, 0.12, z1))]:
        rod(a, b, 0.05, trim)
    box(-6 * PX, z1 - 0.04, 50 * PX, 0.1, 1.45, trim, y=0.12, bevel=0.04)
    box(52 * PX, 32 * PX, 0.12, 0.16, 0.35, "#ffe08a", y=0.12, emit="#ffe08a", bevel=0.02)
    box(-54 * PX, 32 * PX, 0.1, 0.16, 0.3, "#ff5a4e", y=0.15, emit="#ff5a4e", bevel=0.02)
    box(0, 14 * PX, 116 * PX, 0.12, 1.6, "#2a2a30", y=0.05, bevel=0.03)
    # Wheel arches
    for wx in (-34 * PX, 34 * PX):
        cyl(wx, 14 * PX, 0.46, 1.74, "#1d1d24", axis="Y", y=0.85)


def jeep():
    c = "#6b7a3a"
    box(0, 16 * PX, 120 * PX, 34 * PX, 1.75, c, rough=0.8, bevel=0.05)
    box(0, 16 * PX, 124 * PX, 8 * PX, 1.8, "#4f5a2a", y=-0.03, bevel=0.03)
    box(42 * PX, 50 * PX - 0.02, 36 * PX, 0.18, 1.7, "#4f5a2a", bevel=0.04)
    rod((30 * PX, 0.05, 50 * PX), (38 * PX, 0.05, 76 * PX), 0.04, "#2a2a30")
    rod((30 * PX, 1.65, 50 * PX), (38 * PX, 1.65, 76 * PX), 0.04, "#2a2a30")
    rod((38 * PX, 0.05, 76 * PX), (38 * PX, 1.65, 76 * PX), 0.04, "#2a2a30")
    box(56 * PX, 34 * PX, 0.16, 0.18, 0.3, "#ffe08a", y=0.2, emit="#ffe08a")
    # Seats
    box(-10 * PX, 50 * PX - 0.05, 0.5, 0.2, 1.4, "#3a3f24", y=0.15)
    # White star on the door
    me = bpy.data.meshes.new("star")
    pts = []
    for i in range(10):
        r = 3.5 * PX if i % 2 else 8 * PX
        a = math.pi / 2 + i * math.pi / 5
        pts.append((-8 * PX + math.cos(a) * r, -0.015, 34 * PX + math.sin(a) * r))
    me.from_pydata(pts + [(-8 * PX, -0.015, 34 * PX)], [], [(i, (i + 1) % 10, 10) for i in range(10)])
    st = bpy.data.objects.new("star", me)
    bpy.context.scene.collection.objects.link(st)
    st.data.materials.append(mat("#edeae3"))
    for wx in (-38 * PX, 38 * PX):
        cyl(wx, 16 * PX, 0.5, 1.8, "#3a3f24", axis="Y", y=0.87)


def heli():
    c = "#ffb224"
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0.6, 38 * PX), segments=40, ring_count=20)
    body = bpy.context.object
    body.scale = (48 * PX, 0.75, 22 * PX)
    bpy.ops.object.transform_apply(scale=True)
    _finish(body, mat(c, rough=0.3), 0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(18 * PX, 0.55, 42 * PX), segments=40, ring_count=20)
    bub = bpy.context.object
    bub.scale = (26 * PX, 0.68, 17 * PX)
    bpy.ops.object.transform_apply(scale=True)
    _finish(bub, mat("#9fd3ff", glass=True), 0)
    # Tail boom and fin
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.32, radius2=0.1, depth=78 * PX, location=(-66 * PX, 0.6, 44 * PX), rotation=(0, -math.pi / 2, 0))
    bpy.ops.object.transform_apply(rotation=True)
    _finish(bpy.context.object, mat(c, rough=0.3), 0)
    box(-106 * PX, 38 * PX, 0.22, 26 * PX, 0.08, "#c98a1a", y=0.56)
    box(-104 * PX, 44 * PX, 0.5, 0.06, 0.6, "#c98a1a", y=0.3)
    # Mast and skids
    cyl(0, 62 * PX, 0.08, 0.4, "#1d1d24", axis="Z", y=0.6)
    for dy in (0.05, 1.15):
        cyl(0, 2 * PX, 0.05, 84 * PX, "#1d1d24", axis="X", y=dy, metal=0.6)
        rod((-24 * PX, dy, 2 * PX), (-20 * PX, dy, 22 * PX), 0.04, "#1d1d24")
        rod((22 * PX, dy, 2 * PX), (18 * PX, dy, 22 * PX), 0.04, "#1d1d24")
    box(-6 * PX, 28 * PX, 0.5, 0.08, 0.04, "#1d1d24", y=-0.17, bevel=0)


VEHICLES = {"bike": bike, "car": car, "jeep": jeep, "heli": heli}

# ---------- Props for the Creator palette ----------


def p_tree():
    tree(0, 1.1)


def p_pine():
    cyl(0, 0.4, 0.12, 0.8, "#6a4a2a", axis="Z")
    for k, (r, z) in enumerate([(0.9, 0.7), (0.72, 1.45), (0.5, 2.1)]):
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r, depth=1.1, location=(0, 0, z + 0.5))
        _finish(bpy.context.object, mat(["#2f6a35", "#357a3a", "#3f8a3a"][k], rough=0.9), 0)


def p_bush():
    for dx, r, c in [(-0.35, 0.42, "#3f8a3a"), (0.3, 0.48, "#357a30"), (0, 0.55, "#4f9a4a")]:
        ball(dx, r * 0.75, r, c, sz=0.8, rough=0.9)
    for k in range(3):
        ball(-0.3 + k * 0.3, 0.75 - abs(k - 1) * 0.15, 0.06, "#ff6b8a", y=-0.42)


def p_rock():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.6, location=(0, 0, 0.35))
    r = bpy.context.object
    r.scale = (1.3, 0.9, 0.7)
    import random

    rnd = random.Random(7)
    for v in r.data.vertices:
        v.co *= 0.85 + rnd.random() * 0.3
    bpy.ops.object.transform_apply(scale=True)
    _finish(r, mat("#8e8b84", rough=0.95), 0)
    for poly in r.data.polygons:
        poly.use_smooth = False


def p_crate():
    box(0, 0, 1.05, 1.05, 1.05, "#a07a3a", rough=0.8, bevel=0.02)
    for z in (0.02, 0.95):
        box(0, z, 1.08, 0.09, 1.08, "#5a4320", bevel=0.01)
    for x in (-0.48, 0.48):
        box(x, 0, 0.09, 1.05, 1.08, "#5a4320", bevel=0.01)
    rod((-0.48, -0.03, 0.1), (0.48, -0.03, 0.95), 0.04, "#5a4320")


def p_barrel():
    cyl(0, 0.55, 0.42, 1.1, "#c94f4f", axis="Z", rough=0.35, metal=0.3)
    for z in (0.2, 0.9):
        cyl(0, z, 0.44, 0.06, "#5d5b56", axis="Z", metal=0.7)


def p_lamp():
    cyl(0, 1.4, 0.06, 2.8, "#3a3a42", axis="Z", metal=0.6, rough=0.3)
    cyl(0, 0.08, 0.2, 0.16, "#3a3a42", axis="Z")
    rod((0, 0, 2.75), (0.5, 0, 2.85), 0.04, "#3a3a42")
    ball(0.5, 2.72, 0.16, "#ffe08a", emit="#ffe08a")


def p_cactus():
    c = "#4f8a4a"
    cyl(0, 0.9, 0.2, 1.8, c, axis="Z", rough=0.8)
    ball(0, 1.8, 0.2, c, rough=0.8)
    for side in (-1, 1):
        rod((0, 0, 0.85 + (side > 0) * 0.2), (side * 0.5, 0, 0.85 + (side > 0) * 0.2), 0.13, c)
        rod((side * 0.5, 0, 0.85 + (side > 0) * 0.2), (side * 0.5, 0, 1.4 + (side > 0) * 0.2), 0.13, c)
        ball(side * 0.5, 1.4 + (side > 0) * 0.2, 0.13, c)


def p_tent():
    prism(0, 0, 2.4, 1.6, 2.0, "#6b7a3a", rough=0.85)
    prism(0, 0, 0.7, 1.0, 0.05, "#3a3f24", y=-0.03)


def p_fountain():
    cyl(0, 0.25, 1.0, 0.5, "#b8b8b8", axis="Z", rough=0.6)
    cyl(0, 0.46, 0.85, 0.06, "#3fa7ff", axis="Z", rough=0.05, emit="#3fa7ff")
    cyl(0, 0.9, 0.12, 0.9, "#b8b8b8", axis="Z")
    cyl(0, 1.35, 0.4, 0.12, "#b8b8b8", axis="Z")


def p_statue():
    box(0, 0, 0.9, 0.9, 0.9, "#8e8b84", rough=0.8)
    ball(0, 2.35, 0.22, "#c9a25c", metal=0.8, rough=0.3)
    rod((0, 0, 0.9), (0, 0, 2.1), 0.07, "#c9a25c", metal=0.8, rough=0.3)
    rod((0, 0, 1.95), (0.45, 0, 2.55), 0.05, "#c9a25c", metal=0.8, rough=0.3)
    rod((0, 0, 1.95), (-0.35, 0, 1.6), 0.05, "#c9a25c", metal=0.8, rough=0.3)


PROPS = {
    "tree": (p_tree, False), "pine": (p_pine, False), "bush": (p_bush, False), "rock": (p_rock, True),
    "crate": (p_crate, True), "barrel": (p_barrel, True), "lamp": (p_lamp, False), "cactus": (p_cactus, False),
    "tent": (p_tent, False), "fountain": (p_fountain, False), "statue": (p_statue, False),
}
