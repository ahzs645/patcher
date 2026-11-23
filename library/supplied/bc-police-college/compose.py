#!/usr/bin/env python3
"""Rebuild the Police College patch from authored geometry and lowercase glyphs.

Python standard library only; no photograph, font, tracing program or network is
needed to generate the vectors. The reference photograph is retained separately
for comparison and provenance, and is never embedded in the output.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import sys
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True


def n(value: float) -> str:
    return f"{value:.6f}".rstrip("0").rstrip(".") or "0"


def disc_path(cx: float, cy: float, radius: float) -> str:
    return f"M{n(cx-radius)} {n(cy)} A{n(radius)} {n(radius)} 0 1 0 {n(cx+radius)} {n(cy)} A{n(radius)} {n(radius)} 0 1 0 {n(cx-radius)} {n(cy)} Z"


def caption(row: dict, lower: bool, glyphs: dict, palette: dict, cx: float, cy: float) -> str:
    scale = row["xHeight"] / 100
    chars = list(row["text"])
    widths = [glyphs[c]["advance"] * scale for c in chars]
    extent = sum(widths) + row["tracking"] * (len(chars)-1)
    along = -extent / 2
    radius = row["radius"]
    group = "lower-lettering" if lower else "upper-lettering"
    out = [f'  <g id="{group}" data-component="lettering" data-caption="{escape(row["text"])}" fill="{palette["ivory"]}" fill-rule="evenodd">']
    for index, char in enumerate(chars):
        angle = (along + widths[index]/2) / radius + math.radians(row["angleOffset"])
        x = cx + radius * math.sin(angle)
        y = cy + radius * math.cos(angle) if lower else cy - radius * math.cos(angle)
        rotation = -math.degrees(angle) if lower else math.degrees(angle)
        along += widths[index] + row["tracking"]
        glyph = glyphs[char]
        if not glyph["path"]:
            continue
        transform = f'translate({n(x)} {n(y)}) rotate({n(rotation)}) scale({n(scale)}) translate({n(-glyph["advance"]/2)} 0)'
        out.append(f'    <path id="{group}-{index+1:02d}-{char}" data-glyph="{char}" d="{glyph["path"]}" transform="{transform}"/>')
    out.append("  </g>")
    return "\n".join(out)


def main() -> None:
    geometry = json.loads((HERE / "source/geometry.json").read_text())
    spec = importlib.util.spec_from_file_location("lettering", HERE / "source/lettering.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    glyphs = module.GLYPHS
    p = geometry["palette"]
    cx, cy = geometry["canvas"]["cx"], geometry["canvas"]["cy"]
    r = geometry["radii"]
    offset = geometry["referenceOffset"]
    emblem = f'''  <g id="centre-emblem" data-component="police-college-emblem" transform="translate({n(offset['x'])} {n(offset['y'])})">
    <path id="emblem-light-blue" data-component="rear-light-blue-shape" fill="{p['lightBlue']}" d="{geometry['emblem']['lightBlue']}"/>
    <path id="emblem-navy" data-component="front-navy-shape" fill="{p['navy']}" d="{geometry['emblem']['navy']}"/>
  </g>'''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" role="img" aria-labelledby="police-college-title police-college-description" data-reconstruction="bc-police-college-v1">
  <title id="police-college-title">British Columbia / Police College — blue roundel</title>
  <desc id="police-college-description">Manual reconstruction of S56-O47 from a supplied 500 by 666 photograph: ivory edge and lowercase geometric lettering, navy ring, grey-green disc and a two-colour abstract centre emblem. The open joints in the lettering and the downward-open counter in the navy emblem are intentional. All artwork is editable vector geometry. Colours, letterforms and small contours are interpreted from the photograph, not recovered official artwork.</desc>
  <g id="patch-foundation" data-component="base-border">
    <path id="ivory-edge" fill="{p['ivory']}" d="{disc_path(cx, cy, r['outer'])}"/>
    <path id="navy-ring" fill="{p['navy']}" d="{disc_path(cx, cy, r['navy'])}"/>
    <path id="centre-disc" fill="{p['disc']}" d="{disc_path(cx, cy, r['disc'])}"/>
  </g>
{caption(geometry['lettering']['upper'], False, glyphs, p, cx, cy)}
{caption(geometry['lettering']['lower'], True, glyphs, p, cx, cy)}
{emblem}
</svg>
'''
    out = HERE / "composed"
    out.mkdir(exist_ok=True)
    (out / "S56-O47.svg").write_text(svg)
    isolated = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="130 110 240 290" width="480" height="580" role="img" aria-labelledby="emblem-title emblem-description">
  <title id="emblem-title">British Columbia Police College — reconstructed centre emblem</title>
  <desc id="emblem-description">Two editable, manually authored filled paths on a transparent background. Reconstructed from the supplied patch photograph; not an authenticated original logo master. The navy shape's open counter is intentional.</desc>
{emblem}
</svg>
'''
    (out / "bc-police-college-emblem.svg").write_text(isolated)
    print(json.dumps({"svg": str(out / "S56-O47.svg"), "bytes": len(svg.encode()), "sha256": hashlib.sha256(svg.encode()).hexdigest(), "letterInstances": len(geometry['lettering']['upper']['text'].replace(' ',''))+len(geometry['lettering']['lower']['text'].replace(' ','')), "rasterElements": 0, "fontDependencies": 0}, indent=2))


if __name__ == "__main__":
    main()
