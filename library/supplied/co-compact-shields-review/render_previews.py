#!/usr/bin/env python3
"""Render WebP previews, and optionally an exact source/before/after contact sheet.

The SVG composition script first renders its before/after PNGs with resvg.
This script only lays out existing images for inspection; it makes no artwork edits.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--atlas-dir', type=Path, help='Extracted atlas dist directory, to include original source crops')
args = parser.parse_args()
root = Path(__file__).resolve().parent
layout = json.loads((root / 'layout.json').read_text())
for patch in layout['patches']:
    image = Image.open(root / 'review' / f"{patch['id']}.png")
    image.thumbnail((440, 440), Image.Resampling.LANCZOS)
    image.save(root / f"preview-{patch['id']}.webp", quality=90)

if args.atlas_dir:
    catalogue = json.loads((args.atlas_dir / 'assets/catalogue.json').read_text())
    sources = {source['sourceId']: source for source in catalogue['sources']}
    sheet = Image.new('RGB', (1200, 450 * len(layout['patches'])), '#f4f2ec')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('DejaVuSans.ttf', 20)
    for row, patch in enumerate(layout['patches']):
        source = sources[patch['source']['sourceId']]
        photograph = Image.open(args.atlas_dir / source['fullImageUrl']).convert('RGBA')
        photograph = photograph.crop(patch['source']['bbox'])
        images = [photograph, Image.open(root / 'review' / f"{patch['id']}-before.png"), Image.open(root / 'review' / f"{patch['id']}.png")]
        for column, (image, label) in enumerate(zip(images, ['Source photograph', 'Previous vector', 'Partial refinement'])):
            image = image.convert('RGBA')
            image = image.crop(image.getbbox())
            ratio = min(370 / image.width, 390 / image.height)
            image = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
            sheet.paste(image, (column * 400 + (400 - image.width) // 2, row * 450 + 45 + (390 - image.height) // 2), image)
            draw.text((column * 400 + 15, row * 450 + 10), patch['id'] + ' — ' + label, font=font, fill='#222222')
    sheet.save(root / 'review/source-before-after.jpg', quality=94)
