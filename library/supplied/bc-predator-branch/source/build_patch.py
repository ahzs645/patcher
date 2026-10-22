"""Assemble deliberately redrawn vector geometry; no bitmap tracing is used.

The reference image is only read by the separate visual comparison routine.
All artwork geometry lives in explicit paths, glyph constructions, and placement
measurements. Run with Python 3 and Inkscape installed.
"""
from pathlib import Path
from html import escape
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / 'output'
OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(HERE / 'lettering'))
from glyphs import GLYPHS

CREAM = '#ede7da'
BLACK = '#070706'
W, H = 1312, 1199
NS = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'

# A symmetric rounded triangular boundary made from six deliberate cubic arcs.
# The apex, shoulders, side bow and bottom sweep are independent control handles.
CENTERLINE = '''M 655.5 57
C 600 57 470 164 367 291
C 212.5 481.5 107 711 86.5 982
C 72 1079 348 1141.5 655.5 1141.5
C 963 1141.5 1239 1079 1224.5 982
C 1204 711 1098.5 481.5 944 291
C 841 164 711 57 655.5 57 Z'''

animal = json.loads((HERE / 'animal' / 'animal-path.json').read_text())['d']
placements = json.loads((HERE / 'placement' / 'placements.json').read_text())['placements']
row_labels = {
    'upper-left': '04 - B.C. GAME',
    'upper-right': '05 - DEPARTMENT',
    'predator': '06 - PREDATOR',
    'branch': '07 - BRANCH',
}

def layer(layer_id, name, body):
    return (f'<g id="{layer_id}" inkscape:groupmode="layer" '
            f'inkscape:label="{escape(name)}">{body}</g>')

pieces = [
    layer('base', '01 - Black patch base',
          f'<path id="patch-base" fill="{BLACK}" stroke="{BLACK}" stroke-width="68" '
          f'stroke-linejoin="round" d="{CENTERLINE}"/>'),
    layer('border', '02 - Cream border',
          f'<path id="border-band" fill="none" stroke="{CREAM}" stroke-width="34.5" '
          f'stroke-linejoin="round" d="{CENTERLINE}"/>'),
    layer('animal', '03 - Animal head',
          f'<path id="animal-head" fill="{CREAM}" d="{animal}"/>'),
]

for row, label in row_labels.items():
    glyph_paths = []
    for i, p in enumerate(x for x in placements if x['row'] == row):
        g = GLYPHS[p['char']]
        gw = g['width']
        tx = (f'translate({p["cx"]} {p["cy"]}) rotate({p["angle"]}) '
              f'scale({p["width"]/gw:.8f} {p["height"]/100:.8f}) '
              f'translate({-gw/2} -50)')
        char_id = 'period' if p['char'] == '.' else p['char']
        glyph_paths.append(
            f'<path id="{row}-{i+1:02d}-{char_id}" '
            f'inkscape:label="{escape(p["char"])}" fill="{CREAM}" '
            f'fill-rule="evenodd" transform="{tx}" d="{g["d"]}"/>'
        )
    pieces.append(layer(row, label, '\n'.join(glyph_paths)))

svg = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
       f'<svg xmlns="{NS}" xmlns:inkscape="{INK}" '
       f'width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
       f'role="img" aria-labelledby="title description">\n'
       '<title id="title">B.C. Game Department - Predator Branch</title>\n'
       '<desc id="description">Manual vector reconstruction from the supplied patch image. '
       'Custom outlined lettering, a hand-drawn animal silhouette, and a smooth symmetric border. '
       'Two flat colors; transparent outside the patch; no embedded raster images or font dependencies.'
       '</desc>\n' + '\n'.join(pieces) + '\n</svg>\n')

construction = OUT / 'bc-predator-branch-construction.svg'
master = OUT / 'bc-predator-branch-rebuilt.svg'
construction.write_text(svg)

# Expand authored vector strokes, not raster contours. This creates an all-fill
# master while keeping the original construction file with adjustable strokes.
env = os.environ.copy()
env['INKSCAPE_PROFILE_DIR'] = str(HERE / 'inkscape-profile')
env['XDG_CACHE_HOME'] = str(HERE / 'cache')
Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
Path(env['XDG_CACHE_HOME']).mkdir(exist_ok=True)
subprocess.run([
    'inkscape', str(construction), '--batch-process',
    '--actions=select-by-id:patch-base,border-band;object-stroke-to-path;'
    f'export-filename:{master};export-do'
], check=True, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

# Document the editable layers without altering Inkscape's valid path output.
tree = ET.parse(master)
node_counts = {}
for name, tag in [('paths','path'), ('images','image'), ('live_text','text')]:
    node_counts[name] = len(tree.findall(f'.//{{{NS}}}{tag}'))
assert node_counts['images'] == 0
assert node_counts['live_text'] == 0
assert node_counts['paths'] >= 35

for name, kind, width in [
    ('bc-predator-branch-preview.png', 'png', 2624),
    ('bc-predator-branch-vector.pdf', 'pdf', None),
]:
    args = ['inkscape', str(master), '--export-area-page',
            f'--export-type={kind}', f'--export-filename={OUT/name}']
    if width:
        args.append(f'--export-width={width}')
    subprocess.run(args, check=True, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

(HERE / 'validation.json').write_text(json.dumps(node_counts, indent=2))
print(json.dumps({'master': str(master), 'output': str(OUT), **node_counts}))
