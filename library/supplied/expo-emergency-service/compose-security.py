"""Build the companion Security shield from its atlas SVG and the collected Expo 86 logo."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
with ZipFile(sys.argv[1]) as atlas:
    root = ET.fromstring(atlas.read('dist/assets/reconstructions/S56-O24.svg'))
# Retain SECURITY, the blue field and both borders. Replace the separate
# EXPO caption and schematic loops with the complete stacked lockup.
body = root.find(".//*[@data-caption='SECURITY']/..")
body.remove(body.find("./*[@data-caption='EXPO']"))
body.remove(body.find("./*[@data-component='specialty-centre-art']"))
master = ET.parse(HERE / 'composed/S56-O23.svg')
lockup = master.find(".//*[@data-component='expo86-lockup']")
lockup.set('transform', 'translate(33.5 22.5) scale(0.126)')
body.append(lockup)
ET.SubElement(root, f'{{{NS}}}desc').text = 'Expo 86 Security shield. Its photographed heading and borders enclose the collected Expo 86 lockup. Thread colours and fine spacing are interpreted from the small collector-board image.'
ET.ElementTree(root).write(HERE / 'composed/S56-O24.svg', encoding='unicode')
