# Stickville City × Blender

Every building, vehicle and prop in Stickville City is a 3D model built and rendered in Blender,
and anyone can add their own models to the city.

## Put your own model in the game

1. In Blender (4.2 or newer): **Edit → Preferences → Add-ons → Install from Disk**, and pick
   `stickville_blender.py`. Enable "Stickville exporter".
2. Model something. 1 Blender unit = 1 metre (a person is about 1.7 m tall). Stand it on the
   ground at Z = 0 with its front facing −Y (south, towards the camera), centred on the object
   origin.
3. Press **N** in the 3D view, open the **Stickville** tab, select your objects, name the item,
   tick **Solid** if people and cars should bump into it, and press **Export for Stickville**.
   It's rendered through the game's own camera (looking north, 50° down) into
   `<name>.stickpack.json`.
4. In the game: **Builder → Import**, pick the file, then click the city to place it. It's
   saved with your game and goes into your world code when you share it.

From the command line, every top-level collection in a .blend becomes one item (name a
collection `… solid` to make it solid):

```bash
blender my_props.blend --background --python blender/stickville_blender.py -- --out my_props.stickpack.json
```

`examples/make_rocket.py` builds and exports a small rocket with the kit; its output,
`examples/rocket.stickpack.json`, is ready to import. A plain PNG works too.

## Rebuild the city's art

`build_city_art.py` models every building, prop and vehicle with `kit.py` and renders them into
`src/features/city/art/`: one WebP per building and prop (plus a night pass of lit windows) and
one strip of 16 headings per vehicle and ramp, with `manifest.json` holding sizes, anchors and
ground footprints for collisions. Change a size or colour and run it again:

```bash
pip install bpy pillow       # Blender as a Python module
npm run art                  # everything, a few minutes
npm run art -- car_red shop_pizza   # only some
```

or with a Blender install: `blender --background --python blender/build_city_art.py`.
