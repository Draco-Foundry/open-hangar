"""
Draco Foundry banner: the Dreamina Starfarer scene with the gear logo and the
wordmark laid over the dark space on the left. Builds a 3840x2160 master, then
the sizes Discord and GitHub want.

    python docs/brand/draco-foundry/banner.py [scene.jpg]

Needs Pillow and Windows' Bahnschrift font (any bold sans works: set FONT).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
SCENE = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'banner-scene.jpg'
FONT = 'C:/Windows/Fonts/bahnschrift.ttf'
W, H = 3840, 2160


def font(size, weight='Bold'):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass  # not a variable font: use it as is
    return f


def spaced(draw, xy, text, fnt, fill, tracking):
    """Draw text with extra letter spacing; returns the end x."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x - tracking


def text_width(text, fnt, tracking):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    return sum(d.textlength(c, font=fnt) for c in text) + tracking * (len(text) - 1)


def build(ly=330):
    """ly = top of the brand block (px on the 3840x2160 master)."""
    scene = Image.open(SCENE).convert('RGB')
    # cover-fit to 16:9
    s = max(W / scene.width, H / scene.height)
    scene = scene.resize((round(scene.width * s), round(scene.height * s)), Image.LANCZOS)
    left, top = (scene.width - W) // 2, (scene.height - H) // 2
    img = scene.crop((left, top, left + W, top + H)).convert('RGBA')

    # soft darkening behind the brand block so it reads on any scene
    shade = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shade).ellipse((-900, ly - 1030, 2100, ly + 1170), fill=150)
    shade = shade.filter(ImageFilter.GaussianBlur(260))
    img = Image.composite(Image.new('RGBA', (W, H), (4, 8, 16, 255)), img, shade)

    # Brand block (logo + DRACO / FOUNDRY + tagline) must stay in the dark space
    # left of the ship: everything is sized to end before MAX_X.
    MAX_X = int(W * 0.42)
    L = 400
    lx = 200
    tx = lx + L + 70
    tr_big = 20
    size = 200
    while text_width('FOUNDRY', font(size), tr_big) > MAX_X - tx and size > 80:
        size -= 4
    big = font(size, 'Bold')
    word_w = text_width('FOUNDRY', big, tr_big)
    tag_text = 'FREE TOOLS FOR STAR CITIZEN PLAYERS'
    tsize = 72
    while text_width(tag_text, font(tsize, 'SemiBold'), 6) > MAX_X - lx and tsize > 30:
        tsize -= 2
    small = font(tsize, 'SemiBold')
    line_h = int(size * 0.98)
    y1 = ly + (L - 2 * line_h) // 2 - int(size * 0.12)

    # logo: round crop of the icon with a thin glowing rim
    logo = Image.open(HERE / 'dreamina-source.jpg').convert('RGBA').resize((L, L), Image.LANCZOS)
    mask = Image.new('L', (L, L), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, L - 1, L - 1), fill=255)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((lx - 16, ly - 16, lx + L + 16, ly + L + 16), fill=(60, 150, 255, 150))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(36)))
    img.paste(logo, (lx, ly), mask)
    ImageDraw.Draw(img).ellipse((lx, ly, lx + L - 1, ly + L - 1), outline=(120, 190, 255, 200), width=4)

    # wordmark: DRACO over FOUNDRY, beside the logo, with a soft blue glow
    lines = [('DRACO', y1), ('FOUNDRY', y1 + line_h)]
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for text, y in lines:
        spaced(gd, (tx, y), text, big, (70, 160, 255, 200), tr_big)
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(img)
    for text, y in lines:
        spaced(d, (tx, y), text, big, (236, 242, 250, 255), tr_big)

    # accent rule + tagline under the whole block
    ry = ly + L + 60
    d.rectangle((lx, ry, tx + word_w, ry + 5), fill=(90, 170, 255, 255))
    spaced(d, (lx, ry + 34), tag_text, small, (170, 192, 215, 255), 6)

    return img.convert('RGB')


def logo_only(L=560, pad=190):
    """Scene with just the round gear logo in the bottom-left corner."""
    scene = Image.open(SCENE).convert('RGB').resize((W, H), Image.LANCZOS).convert('RGBA')
    lx, ly = pad, H - pad - L
    shade = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shade).ellipse((lx - 500, ly - 500, lx + L + 500, ly + L + 500), fill=120)
    shade = shade.filter(ImageFilter.GaussianBlur(200))
    img = Image.composite(Image.new('RGBA', (W, H), (4, 8, 16, 255)), scene, shade)
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((lx - 20, ly - 20, lx + L + 20, ly + L + 20), fill=(60, 150, 255, 170))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(44)))
    logo = Image.open(HERE / 'dreamina-source.jpg').convert('RGBA').resize((L, L), Image.LANCZOS)
    mask = Image.new('L', (L, L), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, L - 1, L - 1), fill=255)
    img.paste(logo, (lx, ly), mask)
    ImageDraw.Draw(img).ellipse((lx, ly, lx + L - 1, ly + L - 1), outline=(120, 190, 255, 210), width=5)
    return img.convert('RGB')


def main():
    master = build()
    master.save(HERE / 'banner-3840x2160.jpg', quality=92)
    master.resize((1920, 1080), Image.LANCZOS).save(HERE / 'banner-1920x1080.jpg', quality=92)
    master.resize((960, 540), Image.LANCZOS).save(HERE / 'banner-960x540.jpg', quality=92)
    # GitHub social preview is 2:1: trim a little off the bottom
    gh = master.crop((0, 0, W, W // 2)).resize((1280, 640), Image.LANCZOS)
    gh.save(HERE / 'banner-1280x640.jpg', quality=92)
    # Discord server banner: Discord writes the server name over the top-left,
    # so the brand block sits lower, under that strip.
    build(ly=1010).resize((960, 540), Image.LANCZOS).save(HERE / 'server-banner-960x540.jpg', quality=92)
    # Logo-only Discord banner: Discord already shows the server name up top,
    # so just the gear, bottom-left.
    logo_only().resize((960, 540), Image.LANCZOS).save(
        HERE / 'server-banner-logo-960x540.jpg', quality=92
    )
    # clean scene (no text) for Discord's invite background
    Image.open(SCENE).convert('RGB').resize((1920, 1080), Image.LANCZOS).save(
        HERE / 'invite-splash-1920x1080.jpg', quality=92
    )
    print('banner files written')


if __name__ == '__main__':
    main()
