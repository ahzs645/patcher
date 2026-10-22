#!/usr/bin/env python3
"""Construct MC05-O01 from a small, hand-drawn single-line alphabet.

The editable master contains geometric pen strokes. Inkscape expands these vector
strokes into filled paths for the released file; it never reads the photograph.
Build dependencies: Python 3, Pillow (preview encoding), and Inkscape.
"""
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
import json
import os

HERE = Path(__file__).resolve().parent
GREEN = '#16462c'
GOLD = '#d3ac52'
# All glyphs have a 100-unit skeleton cap height and nominal 60-unit width.
# M/W deliberately have half-height inner diagonals, and R a direct diagonal leg.
# Curved bowls are manually drawn cubic Beziers, not a traced bitmap or font.
GLYPHS = {
 'A': 'M0 100 L30 0 L60 100 M11 66 H49',
 'B': 'M0 100 V0 H23 C46 0 58 8 58 24 C58 40 45 48 23 48 H0 M23 48 C48 48 60 58 60 75 C60 92 47 100 23 100 H0',
 'C': 'M58 20 C55 6 45 0 31 0 C10 0 0 17 0 50 C0 83 10 100 31 100 C45 100 55 92 59 80',
 'D': 'M0 100 V0 H19 C47 0 60 17 60 50 C60 83 47 100 19 100 H0',
 'E': 'M60 0 H0 V100 H60 M0 49 H48',
 'G': 'M59 21 C55 6 44 0 30 0 C10 0 0 17 0 50 C0 83 11 100 32 100 C45 100 55 94 60 86 V60 H31',
 'H': 'M0 0 V100 M60 0 V100 M0 50 H60',
 'I': 'M30 0 V100',
 'L': 'M0 0 V100 H60',
 'M': 'M0 100 V0 L30 49 L60 0 V100',
 'N': 'M0 100 V0 L60 100 V0',
 'O': 'M30 0 C10 0 0 17 0 50 C0 83 10 100 30 100 C50 100 60 83 60 50 C60 17 50 0 30 0 Z',
 'R': 'M0 100 V0 H23 C47 0 60 9 60 25 C60 42 47 50 23 50 H0 M25 50 L60 100',
 'S': 'M58 16 C52 5 43 0 28 0 C10 0 0 9 0 24 C0 39 13 45 30 50 C47 56 60 63 60 78 C60 93 48 100 30 100 C15 100 4 94 0 83',
 'T': 'M0 0 H60 M30 0 V100',
 'U': 'M0 0 V70 C0 90 9 100 30 100 C51 100 60 90 60 70 V0',
 'W': 'M0 0 L14 100 L30 39 L46 100 L60 0',
}

# Positions are measured design relationships, regularized from the supplied
# photograph (the felt's visible bbox is roughly x45..1307, y24..604). Coordinates
# below use a tidy 1260 x 580 frame. They preserve the line's changing baseline,
# but do not force each glyph perpendicular to a circle.
HEADER = [
 # char, x, top, width, height, clockwise angle
 ('B',110,201,57,108,4),
 ('R',184,165,58,109,4),
 ('I',250,147,56,108,0),
 ('T',298,122,63,115,0),
 ('I',351,114,56,109,2),
 ('S',407,105,57,106,3),
 ('H',493,91,56,107,1),
 ('C',606,82,56,107,0),
 ('O',686,88,56,108,2),
 ('L',770,101,44,105,4),
 ('U',834,119,51,107,4),
 ('M',903,140,73,109,5),
 ('B',994,165,56,110,5),
 ('I',1050,185,56,106,6),
 ('A',1114,208,58,105,3),
]
GAME = [
 ('G',470,251,62,88,2),
 ('A',552,248,64,91,0),
 ('M',635,247,68,92,0),
 ('E',723,250,64,89,0),
]
WARDEN = [
 ('W',378,375,94,95,0),
 ('A',487,374,63,96,0),
 ('R',568,372,60,98,0),
 ('D',648,372,62,98,0),
 ('E',729,371,56,99,0),
 ('N',804,372,65,98,0),
]


def svg_header(title, description):
 return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 580" width="1260" height="580" role="img" aria-labelledby="title desc" data-reconstruction="bc-game-warden-v2">
<title id="title">{title}</title>
<desc id="desc">{description}</desc>'''


def letter_group(caption, letters, stroke):
 out=[f'<g id="{caption.lower().replace(" ", "-")}" data-caption="{caption}" data-live-text="{caption}" fill="none" stroke="{GOLD}" stroke-width="{stroke}" stroke-linejoin="round" stroke-linecap="round">']
 for i,(char,x,y,w,h,angle) in enumerate(letters):
  # Bake nonuniform glyph widths into the path transform while compensating the
  # stroke width, so both narrow and broad letters stay approximately monoline.
  # Non-scaling-stroke is not used because it is inconsistently exported by tools.
  # The geometric skeleton is sampled below only to apply its affine coordinate
  # transform; its Bezier curves remain Bezier curves in the master.
  path = transformed_path(GLYPHS[char], x,y,w/60,h/100)
  cx=x+w/2; cy=y+h/2
  out.append(f'<path id="{caption.lower().replace(" ", "-")}-{i+1:02d}-{char}" data-glyph="{char}" d="{path}" transform="rotate({angle} {cx:g} {cy:g})"/>')
 out.append('</g>')
 return '\n'.join(out)


def transformed_path(d, x, y, sx, sy):
 """Transform this explicitly limited absolute-path grammar without flattening."""
 import re
 tokens=re.findall(r'[A-Za-z]|-?\d*\.?\d+',d)
 out=[]; i=0
 arity={'M':2,'L':2,'C':6,'H':1,'V':1,'Z':0}
 while i<len(tokens):
  command=tokens[i]; i+=1
  assert command in arity, command
  n=arity[command]
  values=[float(v) for v in tokens[i:i+n]]; i+=n
  if command in ('M','L','C'):
   values=[(x+v*sx) if j%2==0 else (y+v*sy) for j,v in enumerate(values)]
  elif command=='H': values=[x+values[0]*sx]
  elif command=='V': values=[y+values[0]*sy]
  out.append(command+' '.join(f'{v:.3f}'.rstrip('0').rstrip('.') for v in values))
 return ' '.join(out)


def build():
 title='British Columbia / Game / Warden — constructed felt patch'
 desc=('Reference-based vector reconstruction of the supplied Game Warden photograph. '
       'Custom Bezier-stroke lettering: tall narrow upper capitals individually positioned on a high arch '
       'with modest lean, broader closely stacked GAME and WARDEN. A symmetric shallow-domed felt shape '
       'and separate gold inset regularize the fabric distortion. Exact historical alphabet, dimensions '
       'and thread colours are unverified; no photograph, traced contours or installed fonts are used.')
 base='M6 151 C238 68 435 2 630 2 C825 2 1022 68 1254 151 L1254 575 H6 Z'
 inset='M56 180 C267 110 452 50 630 50 C808 50 993 110 1204 180 V512 H56 Z'
 svg='\n'.join([
 svg_header(title,desc),
 f'<g id="felt" data-component="felt-ground"><path d="{base}" fill="{GREEN}"/></g>',
 f'<g id="border" data-component="inset-border"><path d="{inset}" fill="none" stroke="{GOLD}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/></g>',
 letter_group('BRITISH COLUMBIA',HEADER,14.5),
 letter_group('GAME',GAME,17),
 letter_group('WARDEN',WARDEN,17),
 '</svg>\n'])
 master=HERE/'MC05-O01-editable.svg'
 master.write_text(svg)
 final=HERE/'MC05-O01.svg'
 env=dict(os.environ)
 env['INKSCAPE_PROFILE_DIR']='/tmp/pofbc-game-warden-inkscape'
 subprocess.run(['inkscape',str(master),'--batch-process',
   f'--actions=select-all:all;object-stroke-to-path;export-plain-svg;export-filename:{final};export-do'],check=True,env=env,stdout=subprocess.DEVNULL)
 # Inkscape adds namespaces/size metadata, but no dated or random data. Strip its
 # editor-specific attributes while retaining semantic groups and accessibility.
 NS='http://www.w3.org/2000/svg'; ET.register_namespace('',NS)
 root=ET.parse(final).getroot()
 for element in root.iter():
  for key in list(element.attrib):
   if key == 'stroke' or key.startswith('stroke-'):
    del element.attrib[key]
   elif key.startswith('{') and not key.startswith('{http://www.w3.org/XML/1998/namespace}'):
    del element.attrib[key]
  if element.tag == '{'+NS+'}path': element.set('stroke','none')
 ET.indent(root,space='  ')
 final.write_text(ET.tostring(root,encoding='unicode')+'\n')
 subprocess.run(['inkscape',str(final),'--export-type=png','--export-width=1260',f'--export-filename={HERE/"MC05-O01.png"}'],check=True,env=env,stdout=subprocess.DEVNULL)
 # The library card format is WebP; this is a render of our SVG, not photo editing.
 from PIL import Image
 im=Image.open(HERE/'MC05-O01.png')
 im.resize((440,round(440*580/1260)),Image.Resampling.LANCZOS).save(HERE/'preview-MC05-O01.webp',quality=95)
 (HERE/'layout.json').write_text(json.dumps({'canvas':[1260,580], 'colours':{'felt':GREEN,'gold':GOLD},'header':HEADER,'game':GAME,'warden':WARDEN,'construction':'Hand-drawn cubic Bezier skeleton glyphs; vector strokes expanded by Inkscape.'},indent=2)+'\n')
 print(f'Wrote {master.name}, {final.name}, preview-MC05-O01.webp and MC05-O01.png')

if __name__=='__main__': build()
