"""Regenerate the editable badge SVG from construction.json.

Requires Python 3 only. No fonts, network, image-tracing program, or input raster
are needed. The construction data contains the authored curves and placements.
Run: python rebuild_vector.py
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / 'construction.json').read_text())
SVG = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', SVG)
ET.register_namespace('inkscape', INK)

def add(parent, tag, attrs=None, text=None):
    item = ET.SubElement(parent, '{' + SVG + '}' + tag,
                         {k: str(v) for k, v in (attrs or {}).items()})
    item.text = text
    return item

root = ET.Element('{' + SVG + '}svg', {
    'version': '1.1', 'width': '1448', 'height': '1086',
    'viewBox': '0 0 1448 1086', 'role': 'img',
    'aria-labelledby': 'artwork-title artwork-desc'})
add(root, 'title', {'id': 'artwork-title'},
    'Justice Institute British Columbia badge - reconstructed vector')
add(root, 'desc', {'id': 'artwork-desc'},
    DATA['method'] + ' ' + DATA['font_identification'])

def layer(identifier, title):
    return add(root, 'g', {'id': identifier,
        '{' + INK + '}groupmode': 'layer', '{' + INK + '}label': title})

border = layer('badge-outline', '01 - Badge outline and white field')
for shape in DATA['border']:
    add(border, 'path', shape)
monogram = layer('central-monogram', '02 - Geometric JIBC monogram')
for shape in DATA['monogram']:
    add(monogram, 'path', shape)
for row, title in [('upper', '03 - Justice Institute'),
                   ('lower', '04 - British Columbia')]:
    group = layer(row + '-lettering', title)
    group.set('fill', DATA['blue'])
    for glyph in DATA['lettering']:
        if glyph['row'] != row:
            continue
        letter = add(group, 'g', {'id': glyph['id'],
                                  'aria-label': glyph['character']})
        matrix = 'matrix(' + ' '.join(f'{v:.7f}' for v in glyph['matrix']) + ')'
        add(letter, 'path', {'id': glyph['id'] + '-outline',
                            'd': glyph['d'], 'transform': matrix})
        if glyph.get('dot_circle'):
            add(letter, 'circle', {'id': glyph['id'] + '-dot',
                **{k: f'{v:.5f}' for k, v in glyph['dot_circle'].items()}})
ET.indent(root, space='  ')
destination = HERE / 'JIBC_Badge_Rebuilt.svg'
ET.ElementTree(root).write(destination, encoding='utf-8', xml_declaration=True)
print(destination)
