#!/usr/bin/env python3
"""Construct the Fish & Game title and Predator Control division flashes.

This is a small deliberately drawn alphabet, not a font substitution or a raster
trace. Lettering is fitted by geometric advance, with independent curve and cap
height controls for every row. Inkscape expands the editable strokes for export.
"""
from pathlib import Path
from math import atan, cos, sin, degrees
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
GREEN = '#243e32'
GOLD = '#d5b54f'
GLYPHS = {
    'A': (60, 'M0 100 L30 0 L60 100 M11 66 H49'),
    'B': (58, 'M0 100 V0 H24 C44 0 55 8 55 24 C55 40 43 48 24 48 H0 M24 48 C46 48 58 57 58 74 C58 92 44 100 24 100 H0'),
    'C': (57, 'M57 17 C51 6 43 0 29 0 C9 0 0 18 0 50 C0 82 9 100 29 100 C43 100 53 91 58 80'),
    'D': (60, 'M0 100 V0 H20 C47 0 60 17 60 50 C60 83 47 100 20 100 H0'),
    'E': (52, 'M52 0 H0 V100 H52 M0 49 H43'),
    'F': (52, 'M52 0 H0 V100 M0 49 H43'),
    'G': (60, 'M58 18 C52 5 42 0 29 0 C9 0 0 18 0 50 C0 82 9 100 30 100 C44 100 53 92 60 83 V59 H34'),
    'H': (58, 'M0 0 V100 M58 0 V100 M0 49 H58'),
    'I': (0, 'M0 0 V100'),
    'L': (49, 'M0 0 V100 H49'),
    'M': (72, 'M0 100 V0 L36 51 L72 0 V100'),
    'N': (60, 'M0 100 V0 L60 100 V0'),
    'O': (60, 'M30 0 C10 0 0 18 0 50 C0 82 10 100 30 100 C50 100 60 82 60 50 C60 18 50 0 30 0 Z'),
    'P': (56, 'M0 100 V0 H23 C45 0 56 9 56 25 C56 42 45 51 23 51 H0'),
    'R': (59, 'M0 100 V0 H23 C47 0 59 9 59 25 C59 42 47 50 23 50 H0 M25 50 L59 100'),
    'S': (56, 'M54 16 C48 5 40 0 26 0 C9 0 0 9 0 24 C0 39 12 44 29 50 C46 56 56 63 56 78 C56 92 45 100 28 100 C14 100 4 94 0 83'),
    'T': (58, 'M0 0 H58 M29 0 V100'),
    'U': (60, 'M0 0 V70 C0 90 9 100 30 100 C51 100 60 90 60 70 V0'),
    'V': (60, 'M0 0 L30 100 L60 0'),
    '&': (63, 'M62 98 L15 39 C-4 17 8 0 25 0 C44 0 50 18 32 34 L13 51 C-7 69 -2 100 24 100 C42 100 55 78 62 58'),
}

# Row controls are in the patch's own drawing coordinates. The baselines are
# parabolas evaluated at arc-length positions, not a font stretched along a path.
# The lower title has its own radius/rise; DIVISION is deliberately horizontal.
ROWS = {
    'MC12-O01': [
        dict(text='BRITISH COLUMBIA', span=234, cap=19.8, baseline=39, curve=.00248, stroke=1.95, tracking=2.8),
        dict(text='FISH & GAME BRANCH', span=220, cap=17.5, baseline=65, curve=.0023, stroke=1.8, tracking=2.35),
    ],
    'MC13-O02': [
        dict(text='PREDATOR CONTROL', span=185, cap=15.4, baseline=32, curve=.00365, stroke=1.55, tracking=1.8),
        dict(text='DIVISION', span=86, cap=15.6, baseline=58, curve=0, stroke=1.6, tracking=3.0),
    ],
}


def transform_path(path, sx, sy, tx, ty, angle):
    """Apply scale, placement and tangent rotation to our absolute Bezier grammar."""
    tokens = re.findall(r'[A-Za-z]|-?\d*\.?\d+', path)
    commands = []; i = 0; current = (0, 0)
    arity = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'Z': 0}
    def point(x, y):
        x *= sx; y = (y-100)*sy
        return (tx+x*cos(angle)-y*sin(angle), ty+x*sin(angle)+y*cos(angle))
    def numbers(points):
        return ' '.join(f'{v:.4f}'.rstrip('0').rstrip('.') for p in points for v in p)
    while i < len(tokens):
        cmd = tokens[i]; i += 1
        vals = list(map(float, tokens[i:i+arity[cmd]])); i += arity[cmd]
        if cmd == 'H': vals = [vals[0], current[1]]; cmd = 'L'
        elif cmd == 'V': vals = [current[0], vals[0]]; cmd = 'L'
        if cmd == 'Z': commands.append('Z'); continue
        points = list(zip(vals[::2], vals[1::2])); current = points[-1]
        commands.append(cmd+numbers([point(x,y) for x,y in points]))
    return ' '.join(commands)


def line(row, center, index):
    text = row['text']; cap = row['cap']; stroke = row['stroke']
    chars = [c for c in text if c != ' ']
    # Stroke width contributes to the visible advance even for a single-stem I.
    spaces = text.count(' '); gaps = len(chars)-1
    space = cap*.38
    natural = sum(GLYPHS[c][0] for c in chars)
    sx = (row['span']-spaces*space-gaps*row['tracking']-len(chars)*stroke)/natural
    # Sample arc length deterministically; only a geometric baseline is sampled.
    curve = row['curve']; xs = [(-200+i*.1) for i in range(4001)]
    lengths = [0.]
    for a,b in zip(xs,xs[1:]):
        lengths.append(lengths[-1]+((b-a)**2+(curve*(b*b-a*a))**2)**.5)
    mid = lengths[2000]
    def arc_point(s):
        import bisect
        at = mid+s; j = max(1, min(len(xs)-1,bisect.bisect_left(lengths,at)))
        fraction=(at-lengths[j-1])/(lengths[j]-lengths[j-1])
        x=xs[j-1]+fraction*(xs[j]-xs[j-1])
        return center+x,row['baseline']+curve*x*x,atan(2*curve*x)
    safe=text.replace('&','&amp;')
    out=[f'<g id="lettering-{index}" data-caption="{safe}" data-live-text="{safe}" fill="none" stroke="{GOLD}" stroke-width="{stroke}" stroke-linejoin="round" stroke-linecap="round">']
    cursor=-row['span']/2; n=0; placement=[]
    for c in text:
        if c==' ': cursor += space; continue
        width=GLYPHS[c][0]*sx
        x,y,angle=arc_point(cursor+stroke/2)
        path=transform_path(GLYPHS[c][1],sx,cap/100,x,y,angle)
        out.append(f'<path id="row-{index}-letter-{n+1}" data-glyph="{c.replace("&","&amp;")}" d="{path}"/>')
        placement.append({'glyph':c,'x':round(x,4),'baseline':round(y,4),'rotation':round(degrees(angle),3),'width':round(width,4)})
        cursor += width+stroke+row['tracking']; n += 1
    out.append('</g>')
    return '\n'.join(out), placement


def build(id):
    if id=='MC12-O01':
        width,height=300,112; center=150
        title='British Columbia / Fish & Game Branch — constructed felt title rocker'
        # Deliberately smooth paired cubic arcs, with straight bevelled ends.
        outer='M3 59 C47 24 99 3 150 3 C201 3 253 24 297 59 L258 109 C224 87 188 79 150 79 C112 79 76 87 42 109 Z'
        inset='M13 60 C54 29 102 12 150 12 C198 12 246 29 287 60 L252 100 C220 80 186 72 150 72 C114 72 80 80 48 100 Z'
    else:
        width,height=234,82; center=117
        title='Predator Control / Division — constructed connected felt rocker'
        # The center box joins the lower shoulder curve. All corners remain part
        # of the same closed silhouette, with a deliberately smaller central tab.
        outer='M2 45 C34 18 75 3 117 3 C159 3 200 18 232 45 L210 80 C198 69 184 61 170 55 L170 71 H64 V55 C50 61 36 69 24 80 Z'
        inset='M12 46 C41 23 78 12 117 12 C156 12 193 23 222 46 L207 69 C193 58 180 51 165 45 V63 H69 V45 C54 51 41 58 27 69 Z'
    desc=('Constructed from the supplied photograph with a manually drawn Bezier-stroke alphabet. '
          'Independent cap heights, spacing and curved baselines preserve the two rows. '
          'No raster trace or installed typeface. Exact historical lettering and thread colours are unverified; '
          'the paired reference image is only 306 by 172 pixels.')
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-labelledby="title desc" data-reconstruction="bc-fish-game-rockers-v2">',
         f'<title id="title">{title.replace("&","&amp;")}</title><desc id="desc">{desc}</desc>',
         f'<g id="felt" data-component="felt-ground"><path d="{outer}" fill="{GREEN}"/></g>',
         f'<g id="border" data-component="inset-border"><path d="{inset}" fill="none" stroke="{GOLD}" stroke-width="1.6" stroke-linejoin="round"/></g>']
    layouts=[]
    for i,row in enumerate(ROWS[id],1):
        group,placements=line(row,center,i); svg.append(group)
        layouts.append({**row,'glyphs':placements})
    svg.append('</svg>\n')
    master=HERE/f'{id}-editable.svg'; master.write_text('\n'.join(svg))
    final=HERE/f'{id}.svg'
    env=dict(os.environ,INKSCAPE_PROFILE_DIR='/tmp/pofbc-rockers-inkscape')
    subprocess.run(['inkscape',str(master),'--batch-process',f'--actions=select-all:all;object-stroke-to-path;export-plain-svg;export-filename:{final};export-do'],check=True,env=env,stdout=subprocess.DEVNULL)
    ns='http://www.w3.org/2000/svg'; ET.register_namespace('',ns)
    root=ET.parse(final).getroot()
    for element in root.iter():
        for key in list(element.attrib):
            if key=='stroke' or key.startswith('stroke-') or (key.startswith('{') and not key.startswith('{http://www.w3.org/XML/1998/namespace}')):
                del element.attrib[key]
        if element.tag==f'{{{ns}}}path': element.set('stroke','none')
    ET.indent(root,space='  '); final.write_text(ET.tostring(root,encoding='unicode')+'\n')
    png=HERE/f'{id}.png'
    subprocess.run(['inkscape',str(final),'--export-type=png','--export-width=1200',f'--export-filename={png}'],check=True,env=env,stdout=subprocess.DEVNULL)
    from PIL import Image
    im=Image.open(png); im.resize((440,round(440*height/width)),Image.Resampling.LANCZOS).save(HERE/f'preview-{id}.webp',quality=95)
    (HERE/f'{id}-layout.json').write_text(json.dumps({'canvas':[width,height],'colours':{'felt':GREEN,'gold':GOLD},'rows':layouts},indent=2)+'\n')
    print(f'{id}: editable master, outlined SVG, PNG, WebP, measured layout')


if __name__=='__main__':
    for id in ROWS: build(id)
