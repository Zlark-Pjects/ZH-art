"""Stickville ↔ Blender.

Turns Blender models into Stickville sprites. Three ways to use it:

1. As an add-on (Blender ≥ 4.2): Edit → Preferences → Add-ons → Install from Disk → pick this
   file. In the 3D view press N, open the "Stickville" tab, select your model and press
   "Export for Stickville". You get a .stickpack.json file: in the game open Creator →
   Import, and your model is in the item palette, ready to place in the world.

2. From the command line, for a whole .blend file (each top-level collection becomes an item):
       blender my_props.blend --background --python stickville_blender.py -- --out my_props.stickpack.json

3. As a library: blender/build_game_art.py imports render_sprite() to render the game's own
   buildings, vehicles and props.

Scale: 1 Blender unit = 1 metre = 38 game pixels (a stick figure is about 1.7 m tall).
Models stand on the ground at Z = 0 and face +X (right). The object origin's X is the
sprite's anchor, so centre your model on it.
"""

import base64
import json
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector

bl_info = {
    "name": "Stickville exporter",
    "author": "ZH-art",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "3D View → Sidebar (N) → Stickville",
    "description": "Render models as sprites for the Stickville game",
    "category": "Import-Export",
}

PX_PER_M = 38
SUPERSAMPLE = 2  # sprites are rendered at 2× so they stay sharp on high-density screens
PACK_FORMAT = "stickville-pack"


def _setup_scene(scene, samples=48, outline=True):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # Ink outlines tie the 3D art to the stick-figure world
    scene.render.use_freestyle = outline
    if outline:
        scene.render.line_thickness_mode = "ABSOLUTE"
        scene.render.line_thickness = 1.0
        layer = scene.view_layers[0]
        layer.use_freestyle = True
        fs = layer.freestyle_settings
        if not fs.linesets:
            fs.linesets.new("Ink")
        ls = fs.linesets[0]
        if ls.linestyle is None:
            ls.linestyle = bpy.data.linestyles.new("Ink")
        ls.select_by_visibility = True
        ls.select_by_edge_types = True
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = False
        ls.select_external_contour = True
        ls.linestyle.color = (0.11, 0.11, 0.14)
        ls.linestyle.thickness = 1.1 * SUPERSAMPLE
    world = scene.world or bpy.data.worlds.new("Stickville")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.78, 0.84, 0.95, 1)
        bg.inputs[1].default_value = 0.85


def _ensure_rig(scene, yaw_deg=18.0, pitch_deg=8.0):
    """An orthographic camera looking at the model's side, turned a little toward its front, and
    a warm sun from the upper left."""
    cam = scene.objects.get("StickvilleCam")
    if cam is None:
        cam = bpy.data.objects.new("StickvilleCam", bpy.data.cameras.new("StickvilleCam"))
        scene.collection.objects.link(cam)
    cam.data.type = "ORTHO"
    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    dist = 40.0
    cam.location = (math.sin(yaw) * dist * math.cos(pitch), -math.cos(yaw) * dist * math.cos(pitch), math.sin(pitch) * dist)
    cam.rotation_euler = (math.pi / 2 - pitch, 0, yaw)
    cam.data.clip_end = 200
    scene.camera = cam
    sun = scene.objects.get("StickvilleSun")
    if sun is None:
        sun = bpy.data.objects.new("StickvilleSun", bpy.data.lights.new("StickvilleSun", "SUN"))
        scene.collection.objects.link(sun)
    sun.data.energy = 3.2
    sun.data.angle = math.radians(8)
    sun.data.color = (1.0, 0.96, 0.88)
    sun.rotation_euler = (math.radians(50), math.radians(-28), math.radians(-30))
    return cam


def _camera_space_bounds(cam, objects):
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    deps = bpy.context.evaluated_depsgraph_get()
    for ob in objects:
        if ob.type not in {"MESH", "CURVE", "FONT", "SURFACE", "META"}:
            continue
        ev = ob.evaluated_get(deps)
        mesh = ev.to_mesh()
        for v in mesh.vertices:
            p = inv @ (ev.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    if not xs:
        raise ValueError("Nothing to render: select at least one mesh")
    return min(xs), max(xs), min(ys), max(ys)


def render_sprite(objects, filepath, samples=48, outline=True, margin_px=6, anchor=(0.0, 0.0, 0.0), only_visible=None):
    """Render `objects` to a transparent PNG at `filepath`.

    Returns the sprite's size in game pixels and the game-pixel position, inside the sprite, of
    the anchor point (ground under the origin by default): the game draws the sprite with that
    point on the world position.
    """
    scene = bpy.context.scene
    _setup_scene(scene, samples=samples, outline=outline)
    cam = _ensure_rig(scene)
    shown = set(only_visible if only_visible is not None else objects)
    hidden = []
    for ob in scene.objects:
        if ob.type in {"CAMERA", "LIGHT"}:
            continue
        hide = ob not in shown
        if ob.hide_render != hide:
            hidden.append((ob, ob.hide_render))
            ob.hide_render = hide
    try:
        bpy.context.view_layer.update()
        x0, x1, y0, y1 = _camera_space_bounds(cam, objects)
        m = margin_px / PX_PER_M
        x0 -= m
        x1 += m
        y0 -= m
        y1 += m
        w_m, h_m = x1 - x0, y1 - y0
        ppm = PX_PER_M * SUPERSAMPLE
        res_x = max(4, math.ceil(w_m * ppm))
        res_y = max(4, math.ceil(h_m * ppm))
        scene.render.resolution_x = res_x
        scene.render.resolution_y = res_y
        cam.data.ortho_scale = max(res_x, res_y) / ppm
        cam.data.sensor_fit = "AUTO"
        # Shift the camera so the bounds fill the frame
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        cam.data.shift_x = cx / cam.data.ortho_scale
        cam.data.shift_y = cy / cam.data.ortho_scale
        scene.render.filepath = filepath
        bpy.ops.render.render(write_still=True)
        # Where the anchor lands in the sprite (game pixels, from the top-left)
        a = cam.matrix_world.inverted() @ Vector(anchor)
        ax = (a.x - x0) * PX_PER_M
        ay = (y1 - a.y) * PX_PER_M
        return {"w": round(res_x / SUPERSAMPLE, 2), "h": round(res_y / SUPERSAMPLE, 2), "ax": round(ax, 2), "ay": round(ay, 2)}
    finally:
        cam.data.shift_x = cam.data.shift_y = 0
        for ob, was in hidden:
            ob.hide_render = was


def _data_url(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")


def export_pack(items, out_path):
    """items: [(name, objects, solid)] → one .stickpack.json the game can import."""
    pack = {"format": PACK_FORMAT, "version": 1, "items": []}
    with tempfile.TemporaryDirectory() as tmp:
        for i, (name, objects, solid) in enumerate(items):
            png = os.path.join(tmp, f"{i}.png")
            meta = render_sprite(objects, png)
            pack["items"].append({"name": name, "solid": bool(solid), **meta, "png": _data_url(png)})
    with open(out_path, "w") as f:
        json.dump(pack, f)
    return pack


# ---------- Add-on UI ----------


class STICKVILLE_PG_settings(bpy.types.PropertyGroup):
    name: bpy.props.StringProperty(name="Item name", default="My prop")
    solid: bpy.props.BoolProperty(name="Solid (stand on it)", default=False, description="Players and vehicles can stand on top of it")
    out_dir: bpy.props.StringProperty(name="Save to", subtype="DIR_PATH", default="//")


class STICKVILLE_OT_export(bpy.types.Operator):
    bl_idname = "stickville.export"
    bl_label = "Export for Stickville"
    bl_description = "Render the selected objects as a Stickville item (.stickpack.json)"

    def execute(self, context):
        s = context.scene.stickville
        objs = [o for o in context.selected_objects if o.type in {"MESH", "CURVE", "FONT", "SURFACE", "META"}]
        if not objs:
            self.report({"ERROR"}, "Select the objects that make up your item")
            return {"CANCELLED"}
        folder = bpy.path.abspath(s.out_dir) or tempfile.gettempdir()
        os.makedirs(folder, exist_ok=True)
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in s.name) or "item"
        out = os.path.join(folder, f"{safe}.stickpack.json")
        export_pack([(s.name, objs, s.solid)], out)
        self.report({"INFO"}, f"Saved {out} — import it in Stickville: Creator → Import")
        return {"FINISHED"}


class STICKVILLE_PT_panel(bpy.types.Panel):
    bl_label = "Stickville"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Stickville"

    def draw(self, context):
        s = context.scene.stickville
        col = self.layout.column()
        col.label(text="1 unit = 1 m · face +X · stand on Z = 0")
        col.prop(s, "name")
        col.prop(s, "solid")
        col.prop(s, "out_dir")
        col.operator(STICKVILLE_OT_export.bl_idname, icon="RENDER_STILL")


_classes = (STICKVILLE_PG_settings, STICKVILLE_OT_export, STICKVILLE_PT_panel)


def register():
    for c in _classes:
        bpy.utils.register_class(c)
    bpy.types.Scene.stickville = bpy.props.PointerProperty(type=STICKVILLE_PG_settings)


def unregister():
    del bpy.types.Scene.stickville
    for c in reversed(_classes):
        bpy.utils.unregister_class(c)


def _cli():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else os.path.splitext(bpy.data.filepath or "stickville")[0] + ".stickpack.json"
    items = []
    for coll in bpy.context.scene.collection.children:
        objs = [o for o in coll.all_objects if o.type in {"MESH", "CURVE", "FONT", "SURFACE", "META"} and not o.hide_render]
        if objs:
            items.append((coll.name, objs, coll.name.lower().endswith("solid")))
    if not items:
        objs = [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE", "FONT", "SURFACE", "META"} and not o.hide_render]
        items.append((bpy.path.display_name(bpy.data.filepath) or "Item", objs, False))
    export_pack(items, out)
    print(f"Stickville: wrote {len(items)} item(s) to {out}")


if __name__ == "__main__" and bpy.app.background and "--" in sys.argv:
    _cli()
