"""Build Android launcher icons + splash from the Blender car sprite."""
import glob, json
from PIL import Image, ImageDraw, ImageFont

RES = "android/app/src/main/res"
AMBER, DARK = (251, 191, 36, 255), (8, 8, 10, 255)
sheet = Image.open("src/features/city/art/car_pink.webp").convert("RGBA")
fr = json.load(open("src/features/city/art/manifest.json"))["spinners"]["car_pink"]["frames"][2]
scale = sheet.height / max(f["h"] for f in json.load(open("src/features/city/art/manifest.json"))["spinners"]["car_pink"]["frames"])
car = sheet.crop((fr["sx"], 0, fr["sx"] + int(fr["w"] * scale), sheet.height))
car = car.crop(car.getbbox())

def place(canvas, frac):
    s = canvas.width * frac / max(car.size)
    c = car.resize((max(1, int(car.width * s)), max(1, int(car.height * s))), Image.LANCZOS)
    canvas.alpha_composite(c, ((canvas.width - c.width) // 2, (canvas.height - c.height) // 2))
    return canvas

def legacy(n, round_):
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if round_: d.ellipse((0, 0, n - 1, n - 1), fill=AMBER)
    else: d.rounded_rectangle((0, 0, n - 1, n - 1), radius=n // 5, fill=AMBER)
    return place(im, 0.78)

for dpi, n in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    d = f"{RES}/mipmap-{dpi}"
    legacy(n, False).save(f"{d}/ic_launcher.png")
    legacy(n, True).save(f"{d}/ic_launcher_round.png")
    fg = n * 108 // 48  # adaptive foreground: 108dp canvas, 66dp safe zone
    place(Image.new("RGBA", (fg, fg), (0, 0, 0, 0)), 0.58).save(f"{d}/ic_launcher_foreground.png")

with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FBBF24</color>\n</resources>\n')

for p in glob.glob(f"{RES}/drawable*/splash.png"):
    w, h = Image.open(p).size
    im = Image.new("RGBA", (w, h), DARK)
    s = min(w, h)
    c = place(Image.new("RGBA", (s, s), (0, 0, 0, 0)), 0.35)
    im.alpha_composite(c, ((w - s) // 2, (h - s) // 2 - s // 10))
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", max(12, s // 14))
    except OSError: font = ImageFont.load_default()
    t = "STICKVILLE CITY"
    tw = d.textlength(t, font=font)
    d.text(((w - tw) / 2, h / 2 + s * 0.16), t, font=font, fill=AMBER)
    im.convert("RGB").save(p)
print("icons ok")
