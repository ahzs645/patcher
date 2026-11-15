#!/usr/bin/env python3
"""Rebuild S01-O01 from manually observed photo-coordinate paths, not font substitution.

Run from any directory: python library/supplied/junior-forest-warden/compose.py
The embedded drawing is all vector. source-reference.jpg is evidence only.
"""
from pathlib import Path
from hashlib import sha256
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
def el(tag, attrs=None, parent=None, text=None):
    node = ET.Element(f'{{{NS}}}{tag}', attrs or {})
    if text is not None: node.text = text
    if parent is not None: parent.append(node)
    return node

SOURCE_SHA = 'ccff597d5eefc59ddee05a70690de332b3a1844921a5ac9b2652a9e241544f09'
SOURCE_URL = 'https://drive.google.com/file/d/1INS_YP_UZWb3HuuJuolLxhmbafQ2Fo_W/view'
if sha256((ROOT / 'source-reference.jpg').read_bytes()).hexdigest() != SOURCE_SHA:
    raise SystemExit('Reference photo differs from the recorded source SHA-256.')

# The outline follows the photographed object. The original is not mirrored or
# projectively rectified: a single curved-object photo does not establish a die.
SILHOUETTE = '''M116 184 C150 192 176 183 204 169 C238 148 265 132 296 132
 C330 130 354 145 387 159 C427 175 470 185 509 167 Q516 164 521 173
 L556 230 Q562 237 556 246 C536 271 522 297 526 327 C530 366 551 405 572 451
 C593 493 601 531 595 567 C592 597 583 619 561 637 C531 660 481 671 432 683
 C391 693 361 703 338 717 Q333 721 328 717 C307 701 284 694 256 688
 C207 678 163 674 127 658 C90 642 73 622 68 590 C62 559 68 520 75 490
 C83 455 99 411 109 377 C117 349 119 329 111 304 C106 283 94 265 85 251
 Q77 241 84 226 L107 189 Q110 183 116 184 Z'''
RIM_OUTER = '''M117 194 C150 201 177 190 209 176 C243 155 268 141 296 141
 C325 138 353 153 384 168 C428 186 474 193 512 179 L546 235
 C523 264 512 294 516 328 C520 371 542 412 563 457 C584 499 592 532 586 568
 C583 594 575 613 555 629 C525 650 477 662 429 674 C387 684 356 694 333 708
 C309 690 285 684 258 678 C210 668 166 665 130 650 C98 636 82 615 78 588
 C73 559 77 526 84 494 C92 457 108 415 118 380 C126 350 128 328 120 301
 C114 277 101 256 93 240 L116 196 Z'''
RIM_INNER = '''M124 204 C158 210 184 198 214 183 C247 164 270 149 297 149
 C323 147 351 161 381 175 C425 194 469 201 508 188 L536 235
 C514 266 504 294 509 331 C514 374 533 413 556 462 C576 503 582 532 577 566
 C575 589 567 607 549 621 C519 643 472 653 425 665 C385 675 354 685 333 697
 C310 682 284 675 259 669 C212 659 169 657 134 642 C105 629 92 610 87 585
 C82 560 86 527 93 497 C102 459 116 417 126 384 C135 351 137 326 128 298
 C122 275 111 255 103 240 L124 205 Z'''

# (glyph id, photo-coordinate ridge centreline, outer relief width, face width).
# Every glyph is positioned independently. Sizes, slants, and arches come from
# this specimen; there is no font or generic textPath baseline in the output.
CAPTIONS = [
 ('junior', '• JUNIOR •', [
  ('J','M205 245 L205 278 C205 289 199 294 190 295 Q177 298 179 286',13,6),
  ('U','M231 233 L232 259 C231 271 240 277 251 271 Q263 267 263 255 L262 227',13,6),
  ('N','M289 265 L289 225 L321 263 L321 222',13,6),
  ('I','M348 222 L348 263',12,5.5),
  ('O','M391 228 C380 225 373 231 373 241 C371 254 379 266 390 267 C403 270 410 260 408 246 C406 235 401 229 391 228 Z',13,6),
  ('R','M429 277 L429 235 Q451 236 455 248 Q458 260 430 258 M441 260 L457 284',13,6),
 ]),
 ('forest-warden', 'FOREST WARDEN', [
  ('F','M145 403 L147 345 L167 334 M147 369 L162 361',10,4),
  ('O','M187 336 C197 330 198 341 197 350 L195 364 Q194 376 186 376 Q178 375 180 361 L181 346 Q182 339 187 336 Z',10,4),
  ('R','M216 362 L215 323 Q230 313 232 327 Q234 339 217 343 M221 342 L231 356',9,3.5),
  ('E','M262 306 L247 312 L247 350 L262 345 M247 328 L259 324',9,3.5),
  ('S','M286 308 C286 298 275 301 277 310 C277 318 289 317 289 331 C290 341 284 347 278 342 Q273 340 274 332',9,3.5),
  ('T','M292 300 L309 298 M301 299 L303 338',9,3.5),
  ('W','M328 289 L339 338 L346 300 L355 338 L365 290',10,4),
  ('A','M374 340 L384 309 Q385 307 386 310 L395 345 M379 330 L390 331',9,3.5),
  ('R','M403 344 L401 312 Q418 311 419 327 Q418 340 404 337 M407 338 L419 350',9,3.5),
  ('D','M432 356 L430 319 C445 320 448 329 447 342 L446 349 Q444 362 432 356 Z',9,3.5),
  ('E','M472 335 L458 328 L458 368 L473 376 M458 348 L469 354',9,3.5),
  ('N','M487 386 L487 345 L501 393 L501 353',9,3.5),
 ]),
 ('canadian', 'CANADIAN', [
  ('C','M211 480 C208 458 192 454 183 472 C174 491 180 514 194 518 C205 522 215 515 215 503',15,7),
  ('A','M230 529 L240 502 Q242 498 245 504 L254 533 M234 520 L250 522',11,5),
  ('N','M276 535 L275 508 Q275 505 278 508 L300 535 L299 509',11,5),
  ('A','M319 537 L332 510 Q334 507 336 511 L348 536 M324 528 L344 528',11,5),
  ('D','M363 535 L362 509 C379 504 391 510 391 522 C389 534 379 538 363 535 Z',11,5),
  ('I','M407 499 L407 529',11,5),
  ('A','M422 527 L432 492 Q433 487 435 492 L446 517 M427 513 L442 509',11,5),
  ('N','M457 508 L457 477 Q457 473 461 478 L479 495 L478 464',11,5),
 ]),
 ('forestry-assn', 'FORESTRY ASS’N.', [
  ('F','M115 575 L115 522 L134 534 M115 547 L128 554',11,4.8),
  ('O','M150 562 C140 559 141 572 142 584 Q143 596 155 598 Q166 599 164 583 L163 573 Q163 563 150 562 Z',12,5),
  ('R','M181 603 L181 571 Q201 574 201 586 Q200 595 182 591 M186 593 L198 608',12,5),
  ('E','M230 584 L212 578 L211 611 L229 615 M212 594 L224 598',12,5),
  ('S','M264 592 C260 581 244 581 245 591 C246 600 263 600 266 611 C269 622 256 626 248 617 L245 612',12,5),
  ('T','M282 591 L308 592 M295 592 L295 621',12,5),
  ('R','M321 621 L320 594 Q342 589 343 602 Q343 614 321 612 M333 612 L342 622',12,5),
  ('Y','M355 593 L369 609 L381 591 M369 609 L369 620',12,5),
  ('A','M402 608 L415 565 Q416 561 418 565 L431 603 M407 593 L427 588',12,5),
  ('S','M468 574 C463 564 448 568 450 577 C451 584 467 582 470 593 C472 602 459 609 449 601 Q445 598 445 594',12,5),
  ('S','M505 554 C501 544 487 549 486 557 C486 566 501 564 507 575 C513 585 500 592 490 587 Q484 585 483 580',12,5),
  ('apostrophe','M509 539 Q512 537 511 541 L508 545',4.6,1.8),
  ('N','M520 575 L518 545 L538 560 L538 531',11,4.8),
 ]),
]

svg = el('svg', {'viewBox':'0 0 539 607','role':'img','aria-labelledby':'title desc'})
el('title', {'id':'title'}, svg, 'Junior Forest Warden / Canadian Forestry Ass’n. — photo-registered vector study')
el('desc', {'id':'desc'}, svg, 'Editable paths traced and reconstructed against the supplied photograph. The shield, inset rim, individual lettering and maple leaf retain photographed asymmetry and perspective. Broad relief edges are simplified; grain, cast shadows and JPEG noise are omitted. This is not authenticated issue artwork or a rectified manufacturing die. Existing catalogue attribution: leather badge; material is not authenticated from this photograph.')
metadata = {
 'occurrenceId':'S01-O01','sourceId':'S01','sourceUrl':SOURCE_URL,'sourceSha256':SOURCE_SHA,
 'sourceDimensions':[720,960],'bbox':[65,125,604,732],
 'registration':{'type':'photo crop translation only','translate':[-65,-125], 'perspectiveCorrection':False},
 'method':'Manually observed cubic silhouette and rim, individually drawn ridge-centreline lettering with explicit relief/face widths, and five-lobe leaf with corrected lobe recesses and connected tapered veins; no fonts, image-derived texture paths, or embedded raster',
 'quality':'Photo-registered vector reconstruction; fine relief remains interpreted',
 'materialAttribution':'Leather badge (inherited catalogue attribution; not verified from the photograph)',
 'captionRuns':[{'id':k,'text':t,'glyphCount':len(g)} for k,t,g in CAPTIONS],
 'limits':['Perspective and curvature retained from one photograph; not a frontal die master.', 'Fine glyph boundaries and veins are softened by the photograph and interpreted.', 'Flat warm colours are display choices, not a calibrated material measurement.'],
}
el('metadata', parent=svg, text=json.dumps(metadata,ensure_ascii=False,separators=(',',':')))
art = el('g',{'id':'photo-registered-artwork','transform':'translate(-65 -125)','stroke-linejoin':'round','stroke-linecap':'round'},svg)
base = el('g',{'id':'silhouette'},art)
el('path',{'id':'outer-silhouette','d':SILHOUETTE,'fill':'#b98048','stroke':'#80522e','stroke-width':'2'},base)
rim = el('g',{'id':'rim'},art)
el('path',{'id':'outer-rim','d':RIM_OUTER,'fill':'#dfaa70','stroke':'#edbb82','stroke-width':'2.5'},rim)
el('path',{'id':'inner-rim','d':RIM_INNER,'fill':'#d39a5e','stroke':'#a96f3f','stroke-width':'2'},rim)
for group_id, caption, glyphs in CAPTIONS:
    group=el('g',{'id':group_id,'data-caption':caption},art)
    for i,(char,path,edge,face) in enumerate(glyphs):
        letter=el('g',{'id':f'{group_id}-{i+1}-{char}','data-letter':char},group)
        el('path',{'d':path,'fill':'none','stroke':'#80522e','stroke-width':str(edge),'data-role':'relief-boundary'},letter)
        el('path',{'d':path,'fill':'none','stroke':'#edbd85','stroke-width':str(face),'data-role':'letter-face'},letter)
    if group_id=='junior':
        for x,y in [(157.5,287.5),(479,276)]:
            el('circle',{'cx':str(x),'cy':str(y),'r':'8','fill':'#80522e','data-letter':'dot'},group)
            el('circle',{'cx':str(x),'cy':str(y+1),'r':'3','fill':'#edbd85','aria-hidden':'true'},group)
    if group_id=='forestry-assn':
        el('circle',{'cx':'548','cy':'561','r':'5.2','fill':'#80522e','data-letter':'period'},group)
        el('circle',{'cx':'548','cy':'561.6','r':'2','fill':'#edbd85','aria-hidden':'true'},group)

leaf=ET.parse(ROOT/'maple-leaf-component.svg').getroot()
for child in leaf:
    if child.tag==f'{{{NS}}}g': art.append(child)

ET.indent(svg,space='  ')
out=ROOT/'composed'/'S01-O01.svg'
out.parent.mkdir(exist_ok=True)
out.write_text(ET.tostring(svg,encoding='unicode')+'\n')
print(f'{out.relative_to(ROOT)}: {out.stat().st_size} bytes; SHA-256 {sha256(out.read_bytes()).hexdigest()}')
