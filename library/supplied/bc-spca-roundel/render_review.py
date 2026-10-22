#!/usr/bin/env python3
"""Render the vector, preview and visual checks. Requires Inkscape and Pillow.

Run compose.mjs first. The photograph is used only in the review images; it is
never embedded in the patch SVG. Temporary renders stay outside the repository.
"""

from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image, ImageChops, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
REFERENCE = Image.open(HERE / "source/reference.jpeg").convert("RGBA")


def font(size):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ):
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default(size=size)


def render(svg, output, size=1000):
    subprocess.run([
        shutil.which("inkscape") or "inkscape", str(svg),
        "--export-type=png", f"--export-filename={output}",
        f"--export-width={size}", f"--export-height={size}",
    ], check=True, capture_output=True)
    return Image.open(output).convert("RGBA")


def on_background(im, size, colour="#f4f5f7"):
    canvas = Image.new("RGBA", size, colour)
    canvas.alpha_composite(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    return canvas.convert("RGB")


def photo_fit(im, factor=10):
    # One common affine fit to the sewn rim, used for BOTH old and revised vectors.
    # Source pixel coordinates: centre (30.5, 23.0), radii (25.7, 24.4).
    # This normalizes mild photographic flattening; there is no local warping.
    width, height = 2 * 25.7 / 0.96, 2 * 24.4 / 0.96
    x, y = 30.5 - width / 2, 23.0 - height / 2
    canvas = Image.new("RGBA", (66 * factor, 55 * factor))
    scaled = im.resize((round(width * factor), round(height * factor)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, (round(x * factor), round(y * factor)))
    return canvas


def overlay(im):
    fitted = photo_fit(im)
    # Show only the dark ink in cyan, retaining the original pixels underneath.
    mask = fitted.convert("L").point(lambda value: 150 if value < 100 else 0)
    mask = ImageChops.multiply(mask, fitted.getchannel("A"))
    cyan = Image.new("RGBA", fitted.size, "#00e8df")
    cyan.putalpha(mask)
    ref = REFERENCE.resize(fitted.size, Image.Resampling.NEAREST)
    return Image.alpha_composite(ref, cyan)


with tempfile.TemporaryDirectory(prefix="spca-review-") as tmp:
    tmp = Path(tmp)
    # Remove the atlas photo-crop padding, retaining its original 100-unit master.
    previous_svg = (HERE / "source/atlas-S56-O38.svg").read_text()
    previous_svg = previous_svg.replace('viewBox="0 0 57 53"', 'viewBox="2 0 53 53"')
    (tmp / "previous.svg").write_text(previous_svg)
    previous = render(tmp / "previous.svg", tmp / "previous.png")
    revised = render(HERE / "composed/S56-O38.svg", tmp / "revised.png")

    revised.save(HERE / "S56-O38.png", optimize=True)
    revised.resize((480, 480), Image.Resampling.LANCZOS).save(HERE / "preview.webp", lossless=True)

    sheet = Image.new("RGB", (1512, 650), "#f4f5f7")
    draw = ImageDraw.Draw(sheet)
    draw.text((32, 25), "BC SPCA / S56-O38", fill="#142039", font=font(28))
    draw.text((32, 65), "Reference-based vector reconstruction", fill="#586174", font=font(18))
    # Crop away excess surrounding cloth for a comparable patch width. Preserve the
    # photographed aspect ratio, and align its measured centre with the vector panels.
    ref_panel = Image.new("RGBA", (462, 462), "#f4f5f7")
    ref_crop = REFERENCE.crop((3, 0, 58, 50)).resize((462, 420), Image.Resampling.NEAREST)
    ref_panel.alpha_composite(ref_crop, (0, 38))
    panels = [
        ("Supplied photograph", ref_panel,
         "Crop of 66 x 55 original; no sharpening"),
        ("Previous reconstruction", previous.resize((462, 462), Image.Resampling.LANCZOS),
         "Thin cross; short title; steep lower lettering"),
        ("Revised reconstruction", revised.resize((462, 462), Image.Resampling.LANCZOS),
         "Heavier cross; taller title; shallow SPCA arc"),
    ]
    for i, (title, im, detail) in enumerate(panels):
        x = 24 + 500 * i
        draw.text((x + 8, 106), title, fill="#142039", font=font(23))
        sheet.paste(on_background(im, (462, 462)), (x + 8, 145))
        draw.text((x + 8, 609), detail, fill="#586174", font=font(16))
    sheet.save(HERE / "S56-O38-comparison.png", optimize=True)

    overlays = Image.new("RGB", (1380, 696), "#f4f5f7")
    draw = ImageDraw.Draw(overlays)
    draw.text((26, 23), "Photo alignment / cyan shows reconstructed ink", fill="#142039", font=font(25))
    draw.text((26, 60), "One whole-badge affine fit; no local warping. The top of the reference is cropped.",
              fill="#586174", font=font(18))
    for i, (title, im) in enumerate([("Previous", previous), ("Revised", revised)]):
        x = 20 + 680 * i
        draw.text((x, 94), title, fill="#142039", font=font(22))
        overlays.paste(overlay(im).convert("RGB"), (x, 126))
    overlays.save(HERE / "S56-O38-overlay.png", optimize=True)

print("Rendered SVG preview, transparent PNG, before/after comparison and alignment overlays.")
