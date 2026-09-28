"""
Open Hangar link-preview image (og:image, 1200x630): the Starfarer scene from
the Draco Foundry banner, with the Open Hangar icon, name and pitch on the left.

    python docs/brand/open-hangar/og.py

Writes site/img/og.jpg. Needs Pillow; the icon is rendered from icons/icon.svg
into docs/brand/open-hangar/icon-560.png (commit it when the icon changes).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'docs/brand/draco-foundry'))
from banner import font, spaced, text_width  # noqa: E402  (shared type helpers)

W, H = 2400, 1260  # 2x of 1200x630, downscaled at the end
SCENE = ROOT / 'docs/brand/draco-foundry/banner-scene.jpg'
ICON = Path(__file__).parent / 'icon-560.png'
OUT = ROOT / 'site/img/og.jpg'


def build():
    scene = Image.open(SCENE).convert('RGB')
    s = max(W / scene.width, H / scene.height)
    scene = scene.resize((round(scene.width * s), round(scene.height * s)), Image.LANCZOS)
    # keep the ship: crop from the right side of the scene, a little below the top
    left = scene.width - W
    top = int((scene.height - H) * 0.35)
    img = scene.crop((left, top, left + W, top + H)).convert('RGBA')

    # darken the left side where the text goes
    shade = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shade).ellipse((-700, -500, 1500, H + 500), fill=175)
    shade = shade.filter(ImageFilter.GaussianBlur(220))
    img = Image.composite(Image.new('RGBA', (W, H), (4, 8, 16, 255)), img, shade)

    MAX_X = int(W * 0.47)
    x0, y0 = 130, 250
    icon = Image.open(ICON).convert('RGBA').resize((250, 250), Image.LANCZOS)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((x0 - 10, y0 - 10, x0 + 260, y0 + 260), 60, fill=(47, 129, 247, 140))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(36)))
    img.alpha_composite(icon, (x0, y0))

    d = ImageDraw.Draw(img)
    size = 190
    while text_width('HANGAR', font(size), 16) > MAX_X - x0 and size > 80:
        size -= 4
    big = font(size, 'Bold')
    ty = y0 + 300
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i, word in enumerate(('OPEN', 'HANGAR')):
        spaced(gd, (x0, ty + i * int(size * 0.95)), word, big, (47, 129, 247, 190), 16)
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(img)
    for i, word in enumerate(('OPEN', 'HANGAR')):
        spaced(d, (x0, ty + i * int(size * 0.95)), word, big, (236, 242, 250, 255), 16)

    ry = ty + 2 * int(size * 0.95) + 30
    d.rectangle((x0 + 4, ry, x0 + text_width('HANGAR', big, 16), ry + 6), fill=(88, 166, 255, 255))
    body = font(54, 'SemiBold')
    small = font(40, 'SemiLight')
    d.text((x0 + 4, ry + 36), 'Your Star Citizen hangar,', font=body, fill=(220, 230, 242, 255))
    d.text((x0 + 4, ry + 100), 'in one clean dashboard.', font=body, fill=(220, 230, 242, 255))
    d.text((x0 + 4, ry + 186), 'Free · Open source · openhangar.space', font=small, fill=(150, 175, 205, 255))
    return img.convert('RGB')


if __name__ == '__main__':
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build().resize((1200, 630), Image.LANCZOS).save(OUT, quality=88, optimize=True, progressive=True)
    print(f'wrote {OUT.relative_to(ROOT)}')
