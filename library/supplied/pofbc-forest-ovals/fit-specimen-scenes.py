"""Fit the specimen-specific interior art after capture.mjs and drawings.mjs."""
from copy import deepcopy
from pathlib import Path
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')


def element(root, name):
    found = root.find(f".//*[@id='{name}']")
    if found is None:
        raise ValueError(f'Missing source layer {name}')
    return found


def save(tree, path):
    text = ET.tostring(tree.getroot(), encoding='unicode')
    path.write_text('\n'.join(line.rstrip() for line in text.splitlines()) + '\n')


def reset(group):
    for child in list(group):
        group.remove(child)


def add(group, tag, **attrs):
    return ET.SubElement(group, f'{{{NS}}}{tag}', attrs)


# The light-band cloth in S46 and the two tabbed specimens R11 and R21
# share the narrow conifer, yellow understory and blue water of atlas study F01.
historic = ET.parse(HERE / 'historic-scene.svg').getroot()[0]
for file, layer, cx, cy, rx, ry in [
    ('green-gold/light-band', 'scene-layer', 650.5, 596.5, 239.5, 364.5),
    ('forest-service/fire-control', 'bc15-scene-tree', 337.12, 419.34, 214.37, 304.97),
    ('forest-service/wildfire-management', 'bc13-scene-tree', 337.12, 419.34, 214.37, 304.97),
]:
    path = HERE / (file + '.svg')
    tree = ET.parse(path)
    group = element(tree.getroot(), layer)
    reset(group)
    window = add(add(group, 'defs'), 'clipPath', id='specimen-scene-window')
    add(window, 'ellipse', cx=str(cx), cy=str(cy), rx=str(rx), ry=str(ry))
    fitted = add(group, 'g', **{'clip-path': 'url(#specimen-scene-window)'})
    placement = add(fitted, 'g', transform=f'translate({cx} {cy}) scale({rx/197:.8f} {ry/294:.8f}) translate(-338.36631 -420.9648)')
    placement.append(deepcopy(historic))
    if file.startswith('forest-service/'):
        add(group, 'ellipse', cx=str(cx), cy=str(cy), rx=str(rx), ry=str(ry),
            fill='none', stroke='#314c3c', **{'stroke-width': '10'})
    save(tree, path)
