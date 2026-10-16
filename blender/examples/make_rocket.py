"""An example of the exporter: model a small rocket and save it as rocket.stickpack.json.

    python blender/examples/make_rocket.py        (or: blender --background --python ...)
Then in Stickville: Create → Import → rocket.stickpack.json.
"""
import math
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import build_game_art as kit  # noqa: E402
from stickville_blender import export_pack  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
kit.cyl(0, 1.4, 0.45, 2.0, "#edeae3", axis="Z", rough=0.3)
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.45, depth=1.0, location=(0, 0, 2.9))
kit._finish(bpy.context.object, kit.mat("#ef5a3c", rough=0.3), 0)
kit.cyl(0, 1.9, 0.2, 0.06, "#3fa7ff", axis="Y", y=-0.45, emit="#9fd3ff")
for a in (0, 2 * math.pi / 3, 4 * math.pi / 3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 0.55, math.sin(a) * 0.55, 0.5))
    fin = bpy.context.object
    fin.scale = (0.5, 0.08, 0.9)
    fin.rotation_euler = (0, 0, a)
    kit._finish(fin, kit.mat("#ef5a3c", rough=0.3), 0.02)
kit.cyl(0, 0.2, 0.3, 0.4, "#5d5b56", axis="Z", metal=0.7)
out = os.path.join(HERE, "rocket.stickpack.json")
export_pack([("Rocket", kit.scene_objects(), False)], out)
print("wrote", out, os.path.getsize(out), "bytes")
