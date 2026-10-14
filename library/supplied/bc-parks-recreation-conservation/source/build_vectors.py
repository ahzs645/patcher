#!/usr/bin/env python3
"""Rebuild the BC Parks recreation/conservation badge as editable vector geometry.

Requirements: Python 3.10+, fonttools. Inkscape is only needed for PNG/PDF/EPS exports.
No bitmap sampling, contour tracing, or embedded raster artwork is used.
The outlined master can be edited without installing fonts. No font files are bundled.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
import subprocess
from pathlib import Path
import xml.etree.ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

SVG = 'http://www.w3.org/2000/svg'
# Inkscape uses this namespace for its named layer metadata.
INK = 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', SVG)
ET.register_namespace('inkscape', INK)
S = lambda tag: '{'+SVG+'}'+tag
I = lambda tag: '{'+INK+'}'+tag
PALETTE = {
 'navy': '#102338', 'gold': '#E9BE36', 'white': '#FFFFFF',
 'leaf': '#97CA69', 'leaf_vein': '#578044', 'flower_outline': '#07111C'
}
CROP = (155, 65, 730, 940)
FULL = (0, 0, 1080, 1080)
OUTER = ('M 173,994 Q 168,994 168,989 V 426 C 168,232 326,74 520,74 '
         'C 714,74 872,232 872,426 V 989 Q 872,994 867,994 Z')
FIELD = 'M 188,972 V 427 C 188,243 337,94 520,94 C 703,94 852,243 852,427 V 972 Z'
# The portal-style frame follows the same arch/shoulder/base construction as
# the supplied scene package, with proportions re-authored for this patch.
FRAME_OUTER = ('M 244,816 V 542 C 286,526 303,504 303,466 V 430 '
               'C 303,307 399,208 520,208 C 641,208 737,307 737,430 V 466 '
               'C 737,504 754,526 796,542 V 816 Z')
FRAME_INNER = ('M 254,806 V 550 C 296,532 313,507 313,466 V 430 '
               'C 313,313 404,218 520,218 C 636,218 727,313 727,430 V 466 '
               'C 727,507 744,532 786,550 V 806 Z')

# Individually authored dogwood leaves. Their modest asymmetry follows the
# supplied embroidered reference rather than inventing a radial flower.
LEAVES = [
 ('top', 'M 498,277 C 503,268 514,263 517,254 L 523,256 L 532,239 '
         'L 535,254 L 542,259 L 539,268 L 545,277 L 537,280 L 539,289 '
         'L 531,291 L 529,303 C 514,300 505,291 498,277 Z',
         'M 513,294 C 520,281 526,263 531,246'),
 ('upper-left','M 432,366 C 414,363 402,352 397,341 L 388,341 L 391,335 '
               'L 384,324 C 402,316 422,322 432,334 C 439,344 439,356 432,366 Z',
               'M 427,358 C 417,345 405,332 391,326'),
 ('upper-right','M 608,361 C 611,345 617,331 628,325 L 632,329 L 640,323 '
                'L 643,330 L 652,330 L 651,335 L 668,338 L 655,346 '
                'L 653,351 L 645,352 L 641,360 L 633,359 L 628,366 Z',
                'M 616,359 C 630,347 646,340 661,338'),
 ('lower-left-outer','M 447,463 C 430,452 411,440 396,436 L 393,445 L 383,445 '
                     'L 385,453 L 375,459 L 380,465 L 372,473 L 376,477 '
                     'L 359,500 L 378,493 L 386,494 L 390,485 L 401,487 '
                     'L 409,480 L 419,483 C 429,480 439,471 447,463 Z',
                     'M 441,463 C 414,461 390,475 365,496'),
 ('lower-left-inner','M 449,454 C 463,469 463,482 456,493 L 458,501 L 450,503 '
                     'L 449,513 L 442,513 L 439,524 L 433,523 L 424,539 '
                     'C 415,522 414,507 420,495 L 411,489 L 417,482 '
                     'C 429,472 441,462 449,454 Z',
                     'M 447,462 C 437,484 430,507 425,533'),
 ('lower-right-outer','M 596,478 C 599,466 610,450 621,443 L 625,450 '
                      'L 634,449 L 633,457 L 642,461 L 638,466 L 649,472 '
                      'L 646,478 L 654,484 L 654,489 L 670,501 L 653,501 '
                      'L 646,506 L 640,499 L 632,502 L 626,494 L 617,496 Z',
                      'M 603,479 C 620,482 644,491 664,499'),
 ('lower-right-inner','M 574,468 C 589,470 605,478 615,489 L 612,495 L 619,501 '
                      'L 614,506 L 620,513 L 613,515 L 613,527 L 605,519 '
                      'L 598,522 L 595,512 L 586,511 L 586,503 L 580,502 '
                      'C 574,490 571,479 574,468 Z',
                      'M 579,474 C 590,487 603,505 611,522'),
]
PETALS = [
 ('upper-left', 'M 491,365 C 475,361 451,355 440,342 C 426,325 428,306 438,287 '
                'C 445,274 452,268 452,254 C 457,262 458,267 466,269 '
                'C 481,275 500,282 510,298 C 520,313 522,329 515,347 '
                'C 510,358 501,363 491,365 Z'),
 ('upper-right','M 520,355 C 519,334 523,305 539,291 C 557,274 578,286 596,288 '
                'C 606,289 613,286 619,280 C 615,294 619,306 616,321 '
                'C 613,345 595,363 574,367 C 554,373 535,367 520,355 Z'),
 ('left','M 486,369 C 465,360 442,357 420,365 C 399,371 390,384 390,402 '
          'C 389,412 387,418 378,425 L 388,427 C 399,438 412,440 426,444 '
          'C 435,447 443,450 449,456 L 454,447 C 474,446 486,431 492,413 '
          'C 498,397 497,381 486,369 Z'),
 ('right','M 539,378 C 559,375 582,369 603,371 C 625,372 637,385 639,402 '
           'C 641,414 636,428 642,439 L 631,435 C 620,449 609,462 596,463 '
           'C 578,464 564,448 554,434 C 544,420 539,399 539,378 Z'),
 ('bottom','M 506,404 C 494,421 478,441 470,459 C 459,483 468,495 489,503 '
            'C 500,507 508,508 516,518 L 521,509 C 539,506 555,498 562,488 '
            'C 565,479 558,462 550,449 C 541,432 527,417 519,405 Z')
]
CENTER = ('M 486,349 C 494,340 510,337 523,341 C 534,342 541,350 541,361 '
          'C 549,369 546,380 544,389 C 541,400 533,406 524,409 '
          'C 515,416 503,412 496,409 C 484,409 476,399 477,389 '
          'C 472,379 477,370 478,364 C 478,356 481,352 486,349 Z')
CENTER_LINES = ('M 502,341 C 507,351 508,360 505,370 '
                'M 525,342 C 527,353 525,361 520,369 '
                'M 479,363 C 487,369 496,369 503,372 '
                'M 540,362 C 535,367 529,370 521,371 '
                'M 503,372 L 519,369 L 527,381 L 518,392 L 505,389 Z '
                'M 476,383 C 486,381 495,382 506,383 '
                'M 545,384 C 539,380 533,379 527,381 '
                'M 505,389 C 500,398 495,402 489,406 '
                'M 518,392 C 515,399 514,405 515,412 '
                'M 520,391 C 529,393 534,398 536,401')
PARKS_GLYPHS = [
 ('P',98,'M 0,0 H 61 C 87,0 98,10 98,29 C 98,48 85,60 61,60 H 20 V 100 H 0 Z '
          'M 20,18 V 41 H 60 C 72,41 78,38 78,29 C 78,21 72,18 60,18 Z'),
 ('A',119,'M 0,100 L 51,0 H 68 L 119,100 H 96 L 83,75 H 35 L 22,100 Z '
           'M 44,57 H 75 L 60,24 Z'),
 ('R',106,'M 0,0 H 64 C 87,0 99,11 99,29 C 99,45 88,55 73,58 L 106,100 '
           'H 81 L 51,60 H 20 V 100 H 0 Z '
           'M 20,18 V 41 H 63 C 74,41 79,37 79,29 C 79,21 73,18 63,18 Z'),
 ('K',111,'M 0,0 H 20 V 42 L 80,0 H 108 L 54,43 L 111,100 H 84 L 38,56 '
           'L 20,70 V 100 H 0 Z'),
 ('S',108,'M 102,9 C 80,-3 54,-3 31,1 C 10,5 0,16 0,31 C 0,50 15,56 44,59 '
           'L 67,61 C 82,62 88,66 88,73 C 88,81 77,85 59,85 '
           'C 37,85 18,80 2,72 V 92 C 19,100 40,102 60,102 '
           'C 92,102 108,91 108,72 C 108,54 96,46 71,44 '
           'L 43,41 C 27,39 20,36 20,29 C 20,22 31,18 49,18 '
           'C 69,18 87,22 102,29 Z'),
]

def el(tag, attrs=None, parent=None, text=None):
    n = ET.Element(S(tag), {k:str(v) for k,v in (attrs or {}).items()})
    if text is not None: n.text = text
    if parent is not None: parent.append(n)
    return n

def layer(root, ident, label):
    return el('g', {'id':ident,I('groupmode'):'layer',I('label'):label}, root)

def path(parent, ident, d, fill, **kwargs):
    return el('path', {'id':ident, 'd':d, 'fill':fill, **kwargs}, parent)

class Font:
    def __init__(self, file_path):
        self.path = Path(file_path)
        if not self.path.is_file(): raise FileNotFoundError(f'Font not found: {self.path}')
        self.font = TTFont(self.path)
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font['head'].unitsPerEm
        self.cap = self.bounds('H')[3]
        self.family = self.font['name'].getDebugName(1)
    def name(self, c): return self.cmap.get(ord(c), '.notdef')
    def advance(self, c): return self.glyphs[self.name(c)].width
    def d(self, c):
        p = SVGPathPen(self.glyphs)
        self.glyphs[self.name(c)].draw(p)
        return p.getCommands()
    def bounds(self, c):
        p = BoundsPen(self.glyphs)
        self.glyphs[self.name(c)].draw(p)
        return p.bounds or (0,0,0,0)


def header(root, fnt, live):
    g = layer(root,'lettering-header','04 · BRITISH COLUMBIA · curved lettering')
    g.set('fill',PALETTE['gold'])
    text = 'BRITISH COLUMBIA'
    cap, rad, cx, cy = 66, 236, 520, 436
    k = cap / fnt.cap
    # Uniform cap height, modest tracking, authentic wrap onto the side stems.
    native_adv = [fnt.advance(c)*k for c in text]
    letter_space = 1.2
    extent = math.radians(195)*rad
    sx = (extent-letter_space*(len(text)-1))/sum(native_adv)
    advance = [x*sx for x in native_adv]
    total = sum(advance)+letter_space*(len(text)-1)
    cursor = -total/2
    for i,c in enumerate(text):
        a = advance[i]
        theta = (cursor+a/2)/rad
        x, y = cx+rad*math.sin(theta), cy-rad*math.cos(theta)
        if c != ' ':
            cg = el('g', {'id':f'header-letter-{i:02d}-{c}',
                'transform':f'translate({x:.6f} {y:.6f}) rotate({math.degrees(theta):.6f})'},g)
            if live:
                el('text',{'x':-fnt.advance(c)/2,'y':'0',
                   'transform':f'scale({k*sx:.8f} {k:.8f})',
                   'font-family':fnt.family,'font-weight':'700',
                   'font-size':fnt.upm,'xml:space':'preserve'},cg,c)
            else:
                path(cg,f'outline-header-{i:02d}',fnt.d(c),PALETTE['gold'],
                    transform=f'scale({k*sx:.8f} {-k:.8f}) translate({-fnt.advance(c)/2:.6f} 0)')
        cursor += a+letter_space


def line(root, fnt, ident, wording, box, live, tracking=28):
    x,y,w,h=box
    positions=[]; cursor=0
    xs=[]; ys=[]
    for c in wording:
        positions.append(cursor)
        b=fnt.bounds(c)
        if c!=' ':
            xs.extend([cursor+b[0],cursor+b[2]])
            ys.extend([b[1],b[3]])
        cursor+=fnt.advance(c)+tracking
    xmin,xmax,ymin,ymax=min(xs),max(xs),min(ys),max(ys)
    sx,sy=w/(xmax-xmin),h/(ymax-ymin)
    g=el('g', {'id':ident,I('label'):wording, 'fill':PALETTE['gold'],
          'transform':f'translate({x-xmin*sx:.6f} {y+ymax*sy:.6f}) scale({sx:.9f} {sy:.9f})'},root)
    el('title',parent=g,text=wording)
    for i,(c,p) in enumerate(zip(wording,positions)):
        if c==' ': continue
        if live:
            el('text',{'id':f'{ident}-letter-{i:02d}','x':p,'y':0,
                'font-family':fnt.family,'font-size':fnt.upm,'font-weight':'700'},g,c)
        else:
            path(g,f'{ident}-letter-{i:02d}',fnt.d(c),PALETTE['gold'],
                 transform=f'translate({p} 0) scale(1 -1)')


def make(outlined=True, full=False, header_font=None, body_font=None):
    vb=FULL if full else CROP
    attrs={'version':'1.1','viewBox':' '.join(map(str,vb)),
           'width':f'{vb[2]}','height':f'{vb[3]}','preserveAspectRatio':'xMidYMid meet'}
    if not full: attrs.update({'width':'100mm','height':f'{100*vb[3]/vb[2]:.6f}mm'})
    root=el('svg',attrs)
    el('title',parent=root,text='British Columbia — Department of Recreation and Conservation — Parks')
    el('desc',parent=root,text=(
        'Independent reconstruction from the supplied embroidered patch photograph. '
        'Smooth authored badge/frame and dogwood geometry; no bitmap tracing or raster embedding. '
        'Gold header is a visual substitute in Roboto Slab Bold, not an identified historical typeface. '
        'Body lettering uses a proportion-adjusted sans-serif substitute; PARKS is custom outlined lettering. '
        'Not an official original file or an embroidery-machine file.'))
    b=layer(root,'badge-base','01 · Navy field and white outside edging')
    # Filled geometry for predictable recolouring and scaling.
    path(b,'outer-border',OUTER,PALETTE['white'])
    path(b,'navy-field',FIELD,PALETTE['navy'])
    frame=layer(root,'portal-frame','02 · White arch / shoulder / base frame')
    path(frame,'inner-white-frame',FRAME_OUTER+' '+FRAME_INNER,PALETTE['white'],**{'fill-rule':'evenodd'})
    flower=layer(root,'dogwood-emblem','03 · Dogwood · individually editable leaves and petals')
    leaves=el('g',{'id':'dogwood-leaves'},flower)
    veins=el('g',{'id':'dogwood-leaf-veins','fill':'none','stroke':PALETTE['leaf_vein'],
                   'stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round'},flower)
    for ident,d,v in LEAVES:
        path(leaves,'leaf-'+ident,d,PALETTE['leaf'])
        path(veins,'vein-'+ident,v,'none')
    petals=el('g',{'id':'dogwood-petals','stroke':PALETTE['flower_outline'],
                   'stroke-width':'6','stroke-linejoin':'round','stroke-linecap':'round'},flower)
    for ident,d in PETALS: path(petals,'petal-'+ident,d,PALETTE['white'])
    center=el('g',{'id':'dogwood-gold-center','stroke':PALETTE['flower_outline'],
                   'stroke-width':'2.2','stroke-linejoin':'round','stroke-linecap':'round'},flower)
    path(center,'center-shape',CENTER,PALETTE['gold'])
    path(center,'center-divisions',CENTER_LINES,'none',**{'stroke-width':'1.8'})
    header(root,header_font,not outlined)
    body=layer(root,'department-lettering','05 · Department wording · four separate lines')
    line(body,body_font,'department-of','DEPARTMENT OF',(286,551,468,47),not outlined)
    line(body,body_font,'recreation','RECREATION',(303,614,434,53),not outlined)
    line(body,body_font,'and','AND',(449,681,142,49),not outlined)
    line(body,body_font,'conservation','CONSERVATION',(272,742,496,55),not outlined)
    parks=layer(root,'parks-lettering','06 · PARKS · custom extended outlines')
    total=sum(w for _,w,_ in PARKS_GLYPHS)+9*4
    pg=el('g',{'id':'parks-word','transform':f'translate(235 842) scale({570/total:.8f} .88)',
               'fill':PALETTE['gold']},parks)
    el('title',parent=pg,text='PARKS')
    x=0
    for c,w,d in PARKS_GLYPHS:
        path(pg,'parks-'+c,d,PALETTE['gold'],transform=f'translate({x} 0)',**{'fill-rule':'evenodd'})
        x+=w+9
    return root


def write(root,path_out):
    path_out.parent.mkdir(parents=True,exist_ok=True)
    ET.indent(root,space='  ')
    ET.ElementTree(root).write(path_out,encoding='utf-8',xml_declaration=True)


def component(root,ids,title,viewbox=None):
    n=copy.deepcopy(root)
    for child in list(n):
        if child.tag==S('g') and child.get('id') not in ids: n.remove(child)
    n.find(S('title')).text=title
    if viewbox:
        n.set('viewBox',' '.join(map(str,viewbox)))
        n.set('width',str(viewbox[2]));n.set('height',str(viewbox[3]))
    return n


def find_font(pattern):
    result=subprocess.run(['fc-match',pattern,'-f','%{file}'],capture_output=True,text=True,check=True)
    return result.stdout.strip()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out-dir',type=Path,default=Path(__file__).resolve().parents[1])
    p.add_argument('--header-font',type=Path)
    p.add_argument('--body-font',type=Path)
    a=p.parse_args()
    hf=Font(a.header_font or find_font('Roboto Slab:style=Bold'))
    bf=Font(a.body_font or find_font('Liberation Sans:style=Bold'))
    r=make(True,False,hf,bf)
    v=a.out_dir/'vectors'
    write(r,v/'bc-parks-recreation-conservation-outlined.svg')
    write(make(False,False,hf,bf),v/'bc-parks-recreation-conservation-editable-text.svg')
    write(make(True,True,hf,bf),v/'bc-parks-recreation-conservation-photo-aligned.svg')
    comps=[
      (['badge-base','portal-frame'],'01-badge-and-frame.svg','Blank badge and portal frame'),
      (['dogwood-emblem'],'02-dogwood-registered.svg','Dogwood emblem, original badge registration'),
      (['lettering-header','department-lettering','parks-lettering'],'03-lettering-registered.svg','Outlined badge lettering'),
      (['badge-base','portal-frame','dogwood-emblem'],'04-rebranding-template.svg','Badge and dogwood template, no wording'),
    ]
    for ids,fn,title in comps: write(component(r,ids,title),v/'components'/fn)
    write(component(r,['dogwood-emblem'],'Dogwood, tight transparent crop',(350,230,330,320)),v/'components/05-dogwood-isolated.svg')
    meta={
      'coordinate_system': {'photo_aligned_viewBox':FULL,'main_viewBox':CROP,'main_page_width_mm':100},
      'palette':PALETTE,
      'construction':'Author-defined Bezier curves and polygon shapes; font outlines for header/body; custom PARKS outlines.',
      'header_font_substitute':hf.family+' Bold','body_font_substitute':bf.family+' Bold',
      'font_identification':'Visual substitutes only; original historical fonts were not identified.',
      'editable_text_note':'Each header/body character is editable separately for consistent spacing; PARKS remains custom paths.',
      'source_photo':'reference/original-patch.jpg',
      'shared_setup':'Layered arch/shoulder/frame construction and registered component workflow from supplied BC Parks scene package. Proportions adjusted to recreation/conservation patch.',
      'fidelity':'Reconstructed, straightened flat design. Not an official source, pixel-perfect tracing, or digitized embroidery file.'
    }
    (a.out_dir/'source').mkdir(exist_ok=True)
    (a.out_dir/'source/design.json').write_text(json.dumps(meta,indent=2)+'\n')
    print('Wrote outlined master, editable-type variant, aligned variant and five components.')

if __name__=='__main__':main()
