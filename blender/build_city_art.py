"""Model and render Stickville City's art in Blender.

    pip install bpy pillow
    python blender/build_city_art.py              # everything (a few minutes)
    python blender/build_city_art.py -- car_red   # only some items

or `blender --background --python blender/build_city_art.py`.

Everything is seen through the game's camera: orthographic, looking north, 50° down.
Buildings and props become one sprite each (plus a night pass of lit windows); vehicles become
a strip of 16 headings. Results go to src/features/city/art/ with manifest.json holding each
sprite's size, anchor and ground footprint.
"""

import json
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kit  # noqa: E402
from kit import PX, ball, box, cyl, mat, prism, rod, text, window  # noqa: E402
from stickville_blender import PX_PER_M, render_sprite  # noqa: E402

OUT = os.path.join(HERE, "..", "src", "features", "city", "art")
TMP = os.path.join(OUT, "_frames")
HEADINGS = 16


# ---------- New city models (front faces -Y, origin at the front-centre on the ground) ----------


def tower(L, wall="#b5654a", trim="#7a3f2c", floors=5, width=7.0, depth=6.0):
    h = floors * 3.0
    box(0, 0, width, h, depth, wall, rough=0.8)
    for f in range(floors):
        z = 0.9 + f * 3.0
        if f == 0:
            box(0, 0, 1.4, 2.3, 0.1, "#3a2a20", y=-0.05)
            for x in (-2.3, 2.3):
                window(x, 0.8, 1.3, 1.4, frame="#edeae3", lights=L)
        else:
            for x in (-2.4, -0.8, 0.8, 2.4):
                window(x, z, 1.0, 1.4, frame="#edeae3", lights=L)
            box(0, z - 0.25, width - 0.6, 0.12, 0.35, trim, y=-0.3, bevel=0.01)
    box(0, h, width + 0.3, 0.3, depth + 0.3, trim, y=-0.15)
    box(-1.6, h + 0.3, 1.2, 0.8, 1.2, "#8e8b84", y=2.0)
    cyl(2.0, h + 1.0, 0.7, 1.4, "#6a6a72", axis="Z", y=3.5)


def office(L, glass="#4f86b8", floors=7):
    h = floors * 3.0
    box(0, 0, 9.0, h, 7.0, "#3a4a5a", rough=0.3)
    box(0, 0.4, 8.6, h - 0.8, 0.08, glass, y=-0.06, rough=0.08, metal=0.5)
    for f in range(floors):
        box(0, f * 3.0 + 0.1, 9.05, 0.18, 0.12, "#cfd6de", y=-0.1, bevel=0.0)
        for k in range(5):
            lit = box(-3.4 + k * 1.7, f * 3.0 + 1.0, 1.2, 1.4, 0.04, "#ffd36b", y=-0.12, bevel=0, emit="#ffd36b")
            lit.hide_render = True
            L.append(lit)
    for x in (-4.45, 4.45):
        box(x, 0, 0.2, h, 0.2, "#cfd6de", y=-0.12, bevel=0)
    box(0, h, 9.4, 0.5, 7.4, "#2a3440", y=-0.2)
    rod((3, 3.5, h + 0.5), (3, 3.5, h + 4.5), 0.06, "#8e8b84")
    ball(3, h + 4.6, 0.12, "#ff5a4e", y=3.5, emit="#ff5a4e")


def shop(L, name, color, awning, accent="#edeae3"):
    box(0, 0, 8.0, 4.6, 6.0, color, rough=0.7)
    box(0, 4.55, 8.3, 0.35, 6.2, kit_mix(color, 0.35), y=-0.1)
    box(0, 0, 4.8, 2.6, 0.08, "#9fd3ff", y=-0.05, rough=0.05)
    glow = box(0, 0.1, 4.6, 2.4, 0.04, "#ffd36b", y=-0.1, bevel=0, emit="#ffd36b")
    glow.hide_render = True
    L.append(glow)
    box(3.0, 0, 1.1, 2.4, 0.1, "#3a2a20", y=-0.06)
    # Striped awning
    for i in range(8):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-3.5 + i + 0.5, -0.65, 2.95))
        a = bpy.context.object
        a.scale = (1.0, 1.4, 0.08)
        a.rotation_euler = (math.radians(-22), 0, 0)
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        kit._finish(a, mat(awning if i % 2 == 0 else "#edeae3", rough=0.8), 0.01)
    box(0, 3.45, 5.4, 0.9, 0.12, "#1d1d24", y=-0.12)
    text(name, 0, 3.9, 0.62, accent, y=-0.2, emit=accent)


def kit_mix(hex_color, dark):
    h = hex_color.lstrip("#")
    c = [int(h[i : i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(v * (1 - dark)):02x}" for v in c)


def warehouse(L, sign="DEPOT", color="#ffb224"):
    box(0, 0, 12.0, 5.5, 9.0, "#8e8b84", rough=0.6, metal=0.3)
    for i in range(13):
        box(-6 + i, 0, 0.06, 5.5, 0.05, "#6a6a72", y=-0.04, bevel=0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=6.2, depth=9.0, location=(0, 4.5, 3.6), rotation=(math.pi / 2, 0, 0))
    roof = bpy.context.object
    roof.scale = (1, 1, 0.32)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(roof.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 5.4), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(roof.data)
    bm.free()
    kit._finish(roof, mat("#6a6a72", rough=0.5, metal=0.4), 0)
    for x in (-3.0, 3.0):
        box(x, 0, 3.4, 3.6, 0.1, "#c9b28a", y=-0.06)
        for k in range(9):
            box(x, 0.2 + k * 0.38, 3.4, 0.04, 0.04, "#8a7a5a", y=-0.12, bevel=0)
    window(0, 4.3, 1.6, 0.6, lights=L)
    text(sign, 0, 4.8, 0.5, color, y=-0.1)


def hq(L):
    box(0, 0, 10.0, 4.6, 7.0, "#9a9a8a", rough=0.9)
    box(0, 4.5, 10.4, 0.3, 7.4, "#6b7a3a", y=-0.2)
    box(0, 0, 1.6, 2.4, 0.1, "#3a3f24", y=-0.06)
    for x in (-3.4, -1.8, 1.8, 3.4):
        window(x, 2.2, 1.0, 0.8, frame="#6b7a3a", lights=L)
    text("HQ", 0, 3.6, 0.9, "#ffb224", y=-0.08)
    for k in range(6):
        ball(-4.6 + k * 0.5, 0.2, 0.28, "#c9b28a", y=-1.0, sz=0.6)
        ball(2.4 + k * 0.5, 0.2, 0.28, "#c9b28a", y=-1.0, sz=0.6)
    cyl(-4.6, 3.5, 0.06, 7.0, "#8e8b84", axis="Z", y=-0.6, metal=0.7)


def watchtower(L):
    for x in (-1.0, 1.0):
        for y in (-1.0, 1.0):
            rod((x * 1.1, y * 1.1 + 1.2, 0), (x * 0.9, y * 0.9 + 1.2, 5.5), 0.1, "#7a5a3a")
    rod((-1.05, 0.15, 1.5), (1.05, 0.15, 4.0), 0.06, "#7a5a3a")
    box(0, 5.4, 2.6, 0.2, 2.6, "#8a6a4a", y=-0.1)
    box(0, 5.6, 2.6, 0.9, 0.1, "#8a6a4a", y=-0.1)
    prism(0, 7.0, 3.0, 1.0, 3.0, "#6b7a3a", y=-0.3)
    for x in (-1.2, 1.2):
        rod((x, -0.05, 5.6), (x, -0.05, 7.0), 0.06, "#7a5a3a")
    ball(0, 6.7, 0.25, "#ffe08a", y=0.1, emit="#ffe08a")


def lab(L):
    box(0, 0, 7.0, 4.0, 6.0, "#e8e8e8", rough=0.4)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=2.4, location=(0, 3.0, 4.0))
    dome = bpy.context.object
    kit._finish(dome, mat("#9fd3ff", rough=0.1, metal=0.3), 0)
    box(0, 0, 1.4, 2.4, 0.1, "#3fa7ff", y=-0.06)
    for x in (-2.5, 2.5):
        window(x, 1.4, 1.4, 1.2, frame="#b8b8b8", lights=L)
    text("LAB", 0, 3.3, 0.6, "#3fa7ff", y=-0.08)


def palm():
    rod((0, 0, 0), (0.4, 0, 2.2), 0.14, "#8a6a3a")
    rod((0.4, 0, 2.2), (0.9, 0, 4.2), 0.12, "#8a6a3a")
    for k in range(7):
        a = k * 2 * math.pi / 7
        tip = (0.9 + math.cos(a) * 1.9, math.sin(a) * 1.9, 3.6 + (0.2 if k % 2 else -0.1))
        rod((0.9, 0, 4.25), tip, 0.13, "#3f8a3a" if k % 2 else "#4f9a4a")
    for k in range(3):
        ball(0.9 + (k - 1) * 0.18, 4.05, 0.16, "#6a4a2a", y=0.15)


def bench():
    box(0, 0.42, 1.8, 0.08, 0.5, "#8a5a2a", y=-0.25)
    box(0, 0.55, 1.8, 0.4, 0.06, "#8a5a2a", y=0.22)
    for dx in (-0.75, 0.75):
        box(dx, 0, 0.08, 0.42, 0.45, "#3a3a42", y=-0.22, bevel=0)


def cone():
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.25, radius2=0.03, depth=0.7, location=(0, 0, 0.4))
    kit._finish(bpy.context.object, mat("#ff8a3a", rough=0.5), 0)
    cyl(0, 0.45, 0.17, 0.12, "#edeae3", axis="Z")
    box(0, 0, 0.6, 0.06, 0.6, "#ff8a3a", y=-0.3, bevel=0.01)


def ramp():
    me = bpy.data.meshes.new("ramp")
    w, d, h = 4.0, 3.0, 1.2
    v = [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (w / 2, -d / 2, h), (-w / 2, d / 2, 0), (w / 2, d / 2, 0), (w / 2, d / 2, h)]
    f = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    me.from_pydata(v, [], f)
    ob = bpy.data.objects.new("ramp", me)
    bpy.context.scene.collection.objects.link(ob)
    kit._finish(ob, mat("#a0723a", rough=0.8), 0.02)
    for k in range(6):
        x = -w / 2 + (k + 0.5) * w / 6
        rod((x, -d / 2 - 0.01, 0.02), (x, -d / 2 - 0.01, h * (x + w / 2) / w), 0.025, "#5a4320")
    box(w / 2 - 0.1, h - 0.05, 0.2, 0.1, d, "#ffb224", y=-d / 2, bevel=0)


def drone():
    box(0, 0.0, 0.7, 0.25, 0.7, "#2a2a30", y=-0.35, bevel=0.06)
    for x in (-0.55, 0.55):
        for y in (-0.55, 0.55):
            rod((0, 0, 0.15), (x, y, 0.2), 0.04, "#1d1d24")
            cyl(x, 0.25, 0.32, 0.03, "#5d5b56", axis="Z", y=y)
    ball(0, 0.05, 0.13, "#ff5a4e", y=-0.36, emit="#ff5a4e")


def truck(c="#6b7a3a"):
    box(-0.9, 0.45, 4.6, 2.4, 2.3, c, y=-1.15 + 1.15, rough=0.8)
    box(2.25, 0.45, 1.7, 1.9, 2.2, kit_mix(c, 0.2), y=0.05)
    box(2.8, 1.5, 0.6, 0.8, 2.0, "#9fd3ff", y=0.1, glass=True)
    box(3.1, 0.6, 0.12, 0.25, 1.8, "#ffe08a", y=0.2, emit="#ffe08a")
    text("SUPPLY", -0.9, 1.7, 0.5, "#edeae3", y=-0.02)


def wheels(spots, y0, y1, color="#1d1d24"):
    """Tyres on both sides of a vehicle: spots are (x, z_centre, radius)."""
    for x, z, r in spots:
        for y in (y0, y1):
            cyl(x, z, r, 0.28, color, axis="Y", y=y, rough=0.9)
            cyl(x, z, r * 0.5, 0.3, "#8e8b84", axis="Y", y=y, metal=0.6, rough=0.3)


def v_car(c, trim):
    kit.car(c, trim)
    wheels([(-34 * PX, 14 * PX, 14 * PX), (34 * PX, 14 * PX, 14 * PX)], 0.12, 1.58)


def v_taxi():
    v_car("#ffcc33", "#c99a1a")
    box(-6 * PX, 78 * PX + 0.06, 0.7, 0.22, 0.4, "#1d1d24", y=0.65, bevel=0.03)
    text("TAXI", -6 * PX, 78 * PX + 0.17, 0.16, "#ffcc33", y=0.63, emit="#ffcc33")


def v_bike():
    kit.bike()
    wheels([(-26 * PX, 13 * PX, 13 * PX), (26 * PX, 13 * PX, 13 * PX)], 0.0, 0.0)


def v_jeep():
    kit.jeep()
    wheels([(-38 * PX, 16 * PX, 16 * PX), (38 * PX, 16 * PX, 16 * PX)], 0.12, 1.63)
    cyl(-66 * PX, 36 * PX, 11 * PX, 0.25, "#1d1d24", axis="X", y=0.87)


def v_truck():
    truck()
    wheels([(-2.2, 0.45, 0.45), (-0.6, 0.45, 0.45), (2.3, 0.45, 0.45)], -0.0, 2.2)


def v_heli():
    kit.heli()


PAINTS = {"blue": ("#3fa7ff", "#2c78c0"), "red": ("#ef5a3c", "#a8361f"), "green": ("#5fa35a", "#3d7a38"), "white": ("#edeae3", "#a8a59e"), "purple": ("#9b6bff", "#6a42c9"), "black": ("#2a2a30", "#111114"), "pink": ("#ff6b8a", "#c94a66")}

BUILDINGS = {
    "house_orange": lambda L: kit.house(L),
    "house_blue": lambda L: kit.house(L, wall="#6f9fd8", roof="#2f4f86", trim="#3f6aa8"),
    "house_green": lambda L: kit.house(L, wall="#8fc98a", roof="#3d6a3a", trim="#5a8a55"),
    "house_cream": lambda L: kit.house(L, wall="#efe2c4", roof="#a85a3a", trim="#c9b28a"),
    "tower_brick": lambda L: tower(L),
    "tower_teal": lambda L: tower(L, wall="#4fa3a0", trim="#2f6a68", floors=6),
    "office": office,
    "shop_pizza": lambda L: shop(L, "PIZZA", "#c94f4f", "#ef5a3c", "#ffe08a"),
    "shop_cafe": lambda L: shop(L, "CAFÉ", "#8a6a4a", "#5fa35a", "#edeae3"),
    "shop_style": lambda L: shop(L, "STYLE", "#9b6bff", "#ff6b8a", "#edeae3"),
    "shop_mods": lambda L: shop(L, "MODS", "#3a3a42", "#ffb224", "#ffb224"),
    "school": kit.school,
    "hospital": kit.hospital,
    "garage": kit.garage,
    "solar": kit.solar,
    "park": kit.park,
    "helipad": kit.helipad,
    "barracks": kit.barracks,
    "warehouse": warehouse,
    "warehouse_red": lambda L: warehouse(L, "NO ENTRY", "#ff5a4e"),
    "hq": hq,
    "watchtower": watchtower,
    "lab": lab,
}

PROPS = {
    "tree": (kit.p_tree, True), "pine": (kit.p_pine, True), "bush": (kit.p_bush, False), "rock": (kit.p_rock, True),
    "crate": (kit.p_crate, True), "barrel": (kit.p_barrel, True), "lamp": (kit.p_lamp, False), "fountain": (kit.p_fountain, True),
    "statue": (kit.p_statue, True), "tent": (kit.p_tent, True), "cactus": (kit.p_cactus, True), "palm": (palm, True),
    "bench": (bench, False), "cone": (cone, False), "drone": (drone, False),
}

VEHICLES = {**{f"car_{k}": (lambda c=c, t=t: v_car(c, t)) for k, (c, t) in PAINTS.items()}, "taxi": v_taxi, "bike": v_bike, "jeep": v_jeep, "truck": v_truck, "heli": v_heli}
# Rotating sprites that aren't vehicles: ramps can face any of the 16 headings too
SPINNERS = {**VEHICLES, "ramp": ramp}


# ---------- Rendering ----------


def clear():
    kit.clear()
    for m in list(bpy.data.meshes):
        if m.users == 0:
            bpy.data.meshes.remove(m)


def join_centred():
    """Join the model into one object centred on the origin, so it can spin in place."""
    objs = kit.scene_objects()
    for o in objs:
        o.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        if o.type == "FONT":
            bpy.context.view_layer.objects.active = o
            o.select_set(True)
            bpy.ops.object.convert(target="MESH")
            o = bpy.context.object
        o.select_set(True)
    objs = kit.scene_objects()
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    for o in objs:
        for mod in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    xs = [(ob.matrix_world @ v.co).x for v in ob.data.vertices]
    ys = [(ob.matrix_world @ v.co).y for v in ob.data.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    ob.data.transform(__import__("mathutils").Matrix.Translation((-cx, -cy, 0)))
    ob.location = (0, 0, 0)
    ob.rotation_mode = "XYZ"
    ob.rotation_euler = (0, 0, 0)
    return ob


def main():
    from PIL import Image

    os.makedirs(TMP, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    only = set(sys.argv[sys.argv.index("--") + 1 :]) if "--" in sys.argv else None
    path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(path)) if only and os.path.exists(path) else {}
    manifest.update({"pxPerM": PX_PER_M, "pitch": 50, "headings": HEADINGS})
    for g in ("buildings", "props", "spinners"):
        manifest.setdefault(g, {})

    def save_webp(png, name, q=86):
        Image.open(png).save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=q, method=6)
        os.remove(png)

    def static(group, name, build, solid=None):
        if only and name not in only:
            return
        clear()
        lights = []
        build(lights) if group == "buildings" else build()
        objs = kit.scene_objects()
        visible = [o for o in objs if o not in lights]
        png = os.path.join(TMP, f"{name}.png")
        meta = render_sprite(objs, png, samples=32, only_visible=visible)
        save_webp(png, name)
        if lights:
            for g in lights:
                g.hide_render = False
            npng = os.path.join(TMP, f"{name}-night.png")
            render_sprite(objs, npng, samples=6, outline=False, only_visible=lights)
            save_webp(npng, f"{name}-night", 80)
            meta["night"] = True
        if solid is not None:
            meta["solid"] = solid
        manifest[group][name] = meta
        print("rendered", name, meta["w"], meta["h"])

    def spinner(name, build):
        if only and name not in only:
            return
        clear()
        build()
        ob = join_centred()
        frames, imgs = [], []
        for i in range(HEADINGS):
            # Game headings turn clockwise on screen (y grows south); Blender turns counter-clockwise
            ob.rotation_euler = (0, 0, -i * 2 * math.pi / HEADINGS)
            bpy.context.view_layer.update()
            png = os.path.join(TMP, f"{name}-{i}.png")
            meta = render_sprite([ob], png, samples=16, margin_px=3)
            meta.pop("fp", None)
            frames.append(meta)
            imgs.append(Image.open(png).convert("RGBA"))
        sheet = Image.new("RGBA", (sum(im.width for im in imgs), max(im.height for im in imgs)))
        x = 0
        for im, meta in zip(imgs, frames):
            sheet.paste(im, (x, 0))
            meta["sx"] = x
            x += im.width
        sheet.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=88, method=6)
        for i in range(HEADINGS):
            os.remove(os.path.join(TMP, f"{name}-{i}.png"))
        manifest["spinners"][name] = {"frames": frames}
        print("rendered", name, "16 headings")

    for name, fn in BUILDINGS.items():
        static("buildings", name, fn)
    for name, (fn, solid) in PROPS.items():
        static("props", name, fn, solid)
    for name, fn in SPINNERS.items():
        spinner(name, fn)
    os.rmdir(TMP)
    with open(path, "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    print("wrote", path)


if __name__ == "__main__":
    main()
