# Stickville × Blender

Stickville's buildings, vehicles and props are 3D models built and rendered in Blender, and
anyone can add their own models to the game.

## Put your own model in the game

1. In Blender (4.2 or newer): **Edit → Preferences → Add-ons → Install from Disk**, and pick
   `stickville_blender.py`. Enable "Stickville exporter".
2. Model something. 1 Blender unit = 1 metre (a stick figure is about 1.7 m tall). Stand it on
   the ground at Z = 0, facing +X (right), centred on the object origin.
3. Press **N** in the 3D view, open the **Stickville** tab, select your objects, give the item
   a name, tick **Solid** if players should be able to stand on it, and press
   **Export for Stickville**. You get `<name>.stickpack.json`.
4. In the game: **Create → Import**, pick the file, then click the world to place it. It's
   saved with your game and goes into your world file when you share it.

From the command line, every top-level collection in a .blend becomes one item (name a
collection `… solid` to make it solid):

```bash
blender my_props.blend --background --python blender/stickville_blender.py -- --out my_props.stickpack.json
```

`examples/make_rocket.py` builds and exports a small rocket; its output,
`examples/rocket.stickpack.json`, is ready to import.

A plain PNG works too (Create → Import): it's scaled to fit and stands on its bottom edge.

## Rebuild the game's own art

`build_game_art.py` models every building, vehicle body and prop from primitives and renders
them, with a night pass for lit windows, into `src/features/game/art/` (WebP when Pillow is
installed) plus `manifest.json` with each sprite's size and anchor. Change a size or colour and
run it again:

```bash
pip install bpy pillow            # Blender as a Python module
npm run art                       # = python blender/build_game_art.py
npm run art -- house car          # only some
```

or with a Blender install: `blender --background --python blender/build_game_art.py`.

Wheels, rotors, flags and the workshop gear are still drawn by the game because they move. The
**3D art / Drawn art** button in the game switches back to the hand-drawn look.
