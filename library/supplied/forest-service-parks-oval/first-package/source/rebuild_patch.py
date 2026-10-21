#!/usr/bin/env python3
"""Rebuild the supplied Forest Service / British Columbia / Parks patch.

Hand-drawn geometry and outlined, individually positioned letters.
This script does not sample contours or auto-trace the reference image.
Requires fontTools and numpy; rendered deliverables use Inkscape.
"""
from pathlib import Path
from math import sin, cos, atan2, pi, sqrt
import json
import xml.etree.ElementTree as ET
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

HERE = Path(__file__).resolve().parent
OUT = HERE / 'deliverables'
OUT.mkdir(parents=True, exist_ok=True)

SVG = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', SVG)
ET.register_namespace('inkscape', INK)

PALETTE = {
    'backing': '#E9DFC5',
    'field': '#203E2C',
    'seam': '#60755A',
    'gold': '#D3B253',
    'sky': '#A9A8B8',
    'mountains': '#9586AE',
    'ridge': '#514363',
    'tree': '#3C6B43',
}

FONT_DIR = Path('/usr/share/fonts/opentype/urw-base35')
REG = TTFont(FONT_DIR / 'NimbusSans-Regular.otf')
BOLD = TTFont(FONT_DIR / 'NimbusSans-Bold.otf')

def el(tag, parent=None, **attrs):
    attrs = {k.replace('_', '-'): str(v) for k, v in attrs.items()}
    n = ET.Element(f'{{{SVG}}}{tag}', attrs)
    if parent is not None:
        parent.append(n)
    return n

def layer(root, id, label):
    g = el('g', root, id=id)
    g.set(f'{{{INK}}}groupmode', 'layer')
    g.set(f'{{{INK}}}label', label)
    return g

def path(parent, d, fill, **attrs):
    return el('path', parent, d=d, fill=fill, **attrs)

def ellipse(parent, rx, ry, cy=223, **attrs):
    return el('ellipse', parent, cx=196, cy=cy, rx=rx, ry=ry, **attrs)

def silhouette(rx, ry, cy, tab_y, left, right, bottom):
    """One continuous outline: exact elliptical crown joined to tab."""
    dx = rx * sqrt(1 - ((tab_y - cy)/ry)**2)
    return (f'M {196-dx:.4f},{tab_y} '
            f'A {rx},{ry} 0 1 1 {196+dx:.4f},{tab_y} '
            f'L {right},{tab_y} L {right},{bottom} '
            f'L {left},{bottom} L {left},{tab_y} Z')

def glyph(font, ch):
    # Reconstruct the R with a straight diagonal leg, as in the sewn reference.
    if ch == 'R':
        if font is REG:
            return ('M85 0V718H350C514 718 606 637 606 514C606 414 549 352 466 330L629 0H529L376 317H171V0Z '
                    'M171 395H343C457 395 519 432 519 514C519 596 459 641 351 641H171Z',
                    (85,0,629,718),722)
        return ('M80 0V718H381C552 718 644 636 644 499C644 409 602 352 526 325L673 0H506L379 291H224V0Z '
                'M224 424H359C449 424 491 450 491 516C491 580 450 608 359 608H224Z',
                (80,0,673,718),722)
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    p = SVGPathPen(gs)
    gs[name].draw(p)
    b = BoundsPen(gs)
    gs[name].draw(b)
    return p.getCommands(), b.bounds, font['hmtx'][name][0]

def curved_letters(parent, text, id, cap, width_scale, rx, ry, cy, start, end, lower=False):
    """Place optical glyph centres on an ellipse; keep all artwork as paths."""
    group = el('g', parent, id=id, fill=PALETTE['gold'], aria_label=text)
    el('title', group).text = text
    scale = cap / REG['OS/2'].sCapHeight
    records = []
    for ch in text:
        d, bounds, adv = glyph(REG, ch)
        width = (bounds[2]-bounds[0])*scale*width_scale if bounds else 17.0
        records.append((ch, d, bounds, width))
    spacing = 2.7 if not lower else 2.5
    weights = [r[3] + spacing for r in records]
    # A word space separates the two words without changing individual letters.
    weights = [18.5 if r[0] == ' ' else w for r,w in zip(records, weights)]
    ts = np.linspace(start*pi/180, end*pi/180, 12001)
    xs = 196 + rx*np.sin(ts)
    ys = cy + (ry*np.cos(ts) if lower else -ry*np.cos(ts))
    distances = np.concatenate([[0], np.cumsum(np.hypot(np.diff(xs), np.diff(ys)))])
    total = sum(weights)
    cursor = 0
    placements = []
    lower_angles = [-84.5,-73.4,-65.9,-58.3,-52,-39,-25,None,-2.2,13.2,26,39.8,52.9,65,73.7,82]
    for idx, ((ch, d, bounds, width), w) in enumerate(zip(records, weights)):
        centre = (cursor+w/2)/total*distances[-1]
        t = np.interp(centre, distances, ts)
        cursor += w
        if ch == ' ':
            continue
        if lower:
            t = lower_angles[idx]*pi/180
        x = 196 + rx*sin(t)
        y = cy + (ry*cos(t) if lower else -ry*cos(t))
        angle = atan2((-ry*sin(t) if lower else ry*sin(t)),rx*cos(t))*180/pi
        if not lower and idx < 6:
            # Preserve the higher placement of FOREST in the original lettering.
            y = cy-146*cos(t)
            x += [-0.5,-2.0,-3.0,-3.0,-3.0,-2.0][idx]
            angle = atan2(146*sin(t),rx*cos(t))*180/pi
        elif not lower and idx == 7:
            y -= 3.5
        midx = (bounds[0]+bounds[2])/2
        midy = REG['OS/2'].sCapHeight/2
        node = path(group, d, PALETTE['gold'], id=f'{id}-{idx+1:02d}-{ch}', fill_rule='evenodd',
                    stroke=PALETTE['gold'],stroke_width=7.5,stroke_linejoin='round',
                    transform=f'translate({x:.5f},{y:.5f}) rotate({angle:.5f}) scale({scale*width_scale:.8f},{-scale:.8f}) translate({-midx:.5f},{-midy:.5f})')
        el('title', node).text = ch
        placements.append({'letter':ch,'x':round(x,2),'y':round(y,2),'angle':round(angle,2)})
    return placements

def parks_letters(parent):
    group = el('g', parent, id='parks-lettering', fill=PALETTE['gold'], aria_label='PARKS')
    el('title', group).text = 'PARKS'
    cap = 39.5
    sy = cap / BOLD['OS/2'].sCapHeight
    # Tracking and overall width reflect the unusually broad sewn wordmark.
    records = [glyph(BOLD, ch) for ch in 'PARKS']
    raw_widths = [r[1][2]-r[1][0] for r in records]
    target_width = 246
    gap = 7.4
    sx = (target_width - gap*4) / sum(raw_widths)
    cursor = 196-target_width/2
    for i, (ch,(d,bounds,adv)) in enumerate(zip('PARKS',records)):
        path(group,d,PALETTE['gold'],id=f'parks-{ch}',fill_rule='evenodd',
             transform=f'translate({cursor:.5f},435) scale({sx:.8f},{-sy:.8f}) translate({-bounds[0]},0)')
        cursor += (bounds[2]-bounds[0])*sx + gap

TREE = '''M 196,119
 C 193.5,129 190,139 185,147.5
 Q 182.8,150.2 179.8,152
 Q 184.8,154 189.6,150.4
 C 186.5,159 180.8,167.4 175.4,172
 Q 180.2,175.6 187,171.5
 C 182.7,181 176.3,188.8 170.5,193.8
 Q 176,197.2 183.3,193.4
 C 178.5,203.2 172.3,210.5 166.7,214.4
 Q 172.9,218.9 181.5,214.8
 C 176.3,225 169.7,232.4 163.5,237.2
 Q 170.7,241.5 179.9,236.7
 C 173.9,247 165.2,254.4 158.6,258.2
 Q 167,262.4 180.9,255.2
 C 174.1,265.9 164.8,271.5 156.9,274.2
 Q 171,277 190.8,265.7
 L 190.8,289.8 Q 190,293.2 184.7,296.1
 L 207.8,296.1 Q 202.2,293.5 201.3,289.9
 L 201.3,265.5
 Q 220.5,277.1 235.2,274.4
 C 225.4,269.5 217.3,263 212.7,255.3
 Q 226.6,262.6 233.3,258.2
 C 224.6,253.1 216.9,245.2 212,236.9
 Q 222.7,241.3 229.3,237.3
 C 221.4,231.4 215,223.1 210.5,214.7
 Q 219.5,218.6 226,214.6
 C 219.2,209.3 212.8,201.1 208.6,193.6
 Q 216,197.1 221.1,193.8
 C 215.2,189 208.8,181.2 204.9,171.7
 Q 211.5,175.6 216.5,172.2
 C 210.8,167.2 205.4,158.4 202.7,150.6
 Q 208.5,154 212.3,152
 C 204.9,146 199.2,129.5 196,119 Z'''

MOUNTAIN_RIDGE = '''M 125,244.5 L 132.5,240.5 L 139.6,238.1
 L 143.4,240.8 L 148.8,249.6 L 153.2,251.3 L 158.9,258.3
 L 165.2,260.9 L 174.2,252.7 L 180.5,256.3 L 187.7,253.7
 L 197,259.4 L 208.1,255.2 L 216.2,245.1 L 222.1,250.6
 L 230.1,238.2 L 236.1,242.4 L 241.3,233.1 L 246.2,235.6
 L 250.1,246.3 L 254.7,239.8 L 260.2,246.1 L 268,240.5'''

def build(backing=True, symbol_only=False):
    vb = '123 107 146 234' if symbol_only else '23 25 346 450'
    root = el('svg',viewBox=vb, version='1.1', width=('584' if symbol_only else '1038'),
              height=('936' if symbol_only else '1350'), role='img', aria_label='Reconstructed Forest Service British Columbia Parks patch')
    title = el('title', root)
    title.text = 'Forest Service — British Columbia — Parks: clean vector reconstruction'
    el('desc',root).text = ('Hand-rebuilt from the supplied 401 × 498 pixel photograph. '
         'Symmetric idealized patch geometry; outlined lettering; no raster image or auto-traced stitch contours. '
         'Colours, font identity, and small mountain contours are approximate. Physical size is unspecified.')
    defs = el('defs',root)
    clip = el('clipPath', defs, id='illustration-window', clipPathUnits='userSpaceOnUse')
    ellipse(clip,68.4,113.5,cy=224,fill='white')
    if not symbol_only:
        if backing:
            g=layer(root,'backing','01 · Cream backing / outer cut silhouette')
            path(g,silhouette(149,193,224,367,29,363,469),PALETTE['backing'],id='backing-contour')
        g=layer(root,'green-foundation','02 · Forest-green oval and PARKS tab')
        path(g,silhouette(136,180,223,381,44,348,453),PALETTE['field'],id='combined-green-contour')
        g=layer(root,'seam-accent','03 · Fine green border accent')
        path(g,silhouette(131.3,175.4,223,385.2,48.4,343.6,448.7),'none',
             id='inset-green-border',stroke=PALETTE['seam'],stroke_width=0.9,stroke_linejoin='round')
        g=layer(root,'gold-oval-borders','04 · Gold oval piping')
        ellipse(g,119.2,165,fill='none',stroke=PALETTE['gold'],stroke_width=1.8,id='outer-gold-oval')
        ellipse(g,73.5,119.1,cy=224,fill='none',stroke=PALETTE['gold'],stroke_width=1.9,id='inner-gold-oval')

    g=layer(root,'central-landscape','05 · Lavender field and low mountain backdrop')
    g.set('clip-path','url(#illustration-window)')
    ellipse(g,68.4,113.5,cy=224,fill=PALETTE['sky'],id='lavender-field')
    path(g,MOUNTAIN_RIDGE+' L 269,280.6 L 125,280.6 Z',PALETTE['mountains'],id='mountain-fill')
    path(g,MOUNTAIN_RIDGE,'none',id='main-mountain-ridge',stroke=PALETTE['ridge'],stroke_width=1.35,stroke_linejoin='round',stroke_linecap='round')
    path(g,'M 146.5,247.4 L 149.9,254.7 L 158,261.2 M 242.1,239.9 L 245.1,247.9 L 250.6,252.3',
         'none',id='short-ridge-facets',stroke=PALETTE['ridge'],stroke_width=1.1,stroke_linejoin='round',stroke_linecap='round')
    path(g,'M 129,270.3 L 140.8,272.1 L 151.8,270.3 L 162.3,271.4 L 173.8,268.1 L 185.8,271.5 L 204.7,270.7 L 218.8,272.1 L 230.1,270.5 L 239.9,267.5 L 247.7,269.8 L 261.1,272.2',
         'none',id='low-foothill-ridge',stroke=PALETTE['ridge'],stroke_width=1.05,stroke_linejoin='round',stroke_linecap='round')
    path(g,'M 132.5,279.4 Q 164,280.8 191.2,280.2 Q 225,280.9 259.7,279.8','none',
         id='mountain-base-line',stroke=PALETTE['ridge'],stroke_width=1.1,stroke_linecap='round')

    g=layer(root,'tree-and-ground','06 · Solid green conifer and foreground')
    g.set('clip-path','url(#illustration-window)')
    path(g,'M 126,296.8 C 142,294.8 152,298.1 169,296.6 S 185,294.5 193,295.4 C 207,296.5 212,294.9 226,296.7 S 249,295.6 267,296.4 L 270,344 L 124,344 Z',
         PALETTE['tree'],id='foreground')
    path(g,TREE,PALETTE['tree'],id='seven-tier-conifer')

    placements={}
    if not symbol_only:
        g=layer(root,'oval-lettering','07 · FOREST SERVICE / BRITISH COLUMBIA · outlined letters')
        placements['upper']=curved_letters(g,'FOREST SERVICE','forest-service',27.0,0.81,94.7,136,224,-79.5,79.5)
        placements['lower']=curved_letters(g,'BRITISH COLUMBIA','british-columbia',27.7,0.83,96.4,137.6,223,-90.5,90.5,lower=True)
        g=layer(root,'tab-lettering','08 · PARKS · outlined letters')
        parks_letters(g)
    return root,placements

def write_svg(root, filename):
    ET.indent(root,space='  ')
    ET.ElementTree(root).write(OUT/filename,encoding='utf-8',xml_declaration=True)

if __name__=='__main__':
    root,placements=build()
    write_svg(root,'forest-service-parks-patch.svg')
    root,_=build(backing=False)
    write_svg(root,'forest-service-parks-patch-no-backing.svg')
    root,_=build(symbol_only=True)
    write_svg(root,'forest-service-parks-centre-symbol.svg')
    # Same source coordinate system for honest side-by-side / registered overlays.
    root,_=build()
    root.set('viewBox','0 0 401 498');root.set('width','401');root.set('height','498')
    write_svg(root,'review-coordinate-master.svg')
    (OUT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    (HERE/'letter-placement-review.json').write_text(json.dumps(placements,indent=2)+'\n')
    print('Created SVGs in',OUT)
