#!/usr/bin/env python3
"""Build the aligned BC Parks scene from editable, authored path geometry.

Python 3.10+, standard library only. Does not read or trace image pixels.
The supplied isolated-landscape SVG is the base for the individually editable
forest/shoreline/water paths; the scene opening, mountain range and snowcaps
are newly authored for the badge reference.
"""
from __future__ import annotations
import argparse
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

SVG='http://www.w3.org/2000/svg'
INK='http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('',SVG)
ET.register_namespace('inkscape',INK)
S=lambda tag: f'{{{SVG}}}{tag}'
I=lambda key: f'{{{INK}}}{key}'
REFERENCE_SCALE='scale(1.02 1.01963636363636)'
FULL=(0,0,1122,1402)
CROP=(120,224,877,895)
PALETTE={
 'sky':'#5BA3EB', 'mountain':'#242D3A', 'snow':'#F8F8FA',
 'rear_shadow':'#243C2B','rear_green':'#628448','rear_light':'#678A4C',
 'central_shadow':'#104929','central_green':'#248E49',
 'fir_shadow':'#177C31','fir_mid':'#238F35','fir_light':'#65B940',
 'bank':'#164F2A','shore_mid':'#1C8534','shore_light':'#6DBD44',
 'water':'#4A9AE8','ripples':'#1D3555','border':'#FCFCFD',
}
# Geometry is in the 1100 x 1375 normalized reference coordinate system.
# Every top-level artwork layer carries the same precise reference scale.
OPENING='''M 244,548 C 244,380 380,244 548,244
 C 715,244 849,380 849,548 L 849,678
 C 849,727 880,749 949,749 L 949,1065 Q 949,1071 943,1071
 H 150 Q 144,1071 144,1065 V 749
 C 213,749 244,728 244,680 Z'''
BORDER='''M 225,548 C 225,372 370,229 548,229
 C 725,229 868,373 868,548 V 678
 C 868,717 885,731 960,731 Q 968,731 968,739
 V 1070 Q 968,1089 949,1089 H 145 Q 126,1089 126,1070
 V 739 Q 126,731 134,731 C 207,734 225,716 225,678 Z'''
MOUNTAIN='''M 124,780 L 218,586 L 244,559
 C 259,548 263,522 284,509 C 315,490 329,449 350,433
 C 359,427 365,400 377,401 C 388,403 388,374 401,375
 C 409,374 414,387 418,393 C 421,398 428,400 433,405
 C 443,417 448,433 447,443 C 444,453 448,461 455,457
 C 477,452 493,472 506,493 C 508,498 510,502 511,504
 C 517,488 523,485 536,475 C 552,464 555,443 570,442
 C 578,441 580,450 586,451 C 595,450 599,458 607,453
 C 620,446 636,404 651,390 C 663,379 672,370 677,362
 C 683,353 688,352 694,355 C 702,354 707,369 713,376
 C 717,381 724,383 730,389 C 734,394 736,400 742,403
 C 756,409 763,428 770,440 C 773,446 784,447 791,452
 C 803,458 811,466 815,475 C 818,482 826,483 832,488
 C 839,494 845,504 850,514 L 850,537 L 974,781 V 975 H 124 Z'''
SNOW_LEFT='''M 401,375 C 409,374 414,387 418,393
 C 421,398 428,400 433,405 C 443,417 448,433 447,443
 C 444,453 448,461 455,457 C 477,452 493,472 506,493
 C 510,501 512,507 516,517 C 526,538 512,531 505,524
 C 498,518 496,508 488,507 C 478,508 476,501 475,494
 C 473,483 465,476 458,477 C 446,477 439,487 437,497
 C 435,505 436,518 427,530 C 415,547 414,531 416,519
 C 418,507 411,492 416,480 C 418,471 426,463 415,460
 C 399,460 405,455 410,445 C 419,430 399,424 398,416
 C 395,411 398,398 400,390 C 400,385 397,379 401,375 Z'''
SNOW_RIGHT='''M 694,355 C 702,354 707,369 713,376
 C 717,381 724,383 730,389 C 734,394 736,400 742,403
 C 756,409 763,428 770,440 C 773,446 784,447 791,452
 C 803,458 811,466 815,475 C 818,482 826,483 832,488
 C 839,494 845,504 850,514 L 850,537
 C 842,531 843,521 834,515 C 827,508 819,513 815,503
 C 812,497 814,488 804,483 C 795,479 788,481 779,472
 C 770,463 764,458 760,463 C 755,470 765,477 762,485
 C 759,491 769,496 767,506 C 767,515 782,528 778,535
 C 774,546 758,532 753,525 C 748,519 748,508 743,501
 C 735,492 729,489 725,476 C 718,464 723,452 713,443
 C 701,433 712,427 717,418 C 721,410 710,407 705,399
 C 699,392 702,386 696,381 C 689,373 690,362 694,355 Z'''

COLOR_MAP={
 '#142942':PALETTE['mountain'], '#FAFBFD':PALETTE['snow'],
 '#143A24':PALETTE['rear_shadow'], '#4B7A3F':PALETTE['rear_green'],
 '#507E43':PALETTE['rear_light'], '#004421':PALETTE['central_shadow'],
 '#109B49':PALETTE['central_green'], '#04872E':PALETTE['fir_shadow'],
 '#069530':PALETTE['fir_mid'], '#70DB3F':PALETTE['fir_light'],
 '#063B27':PALETTE['bank'], '#058A2E':PALETTE['shore_mid'],
 '#74DF42':PALETTE['shore_light'], '#329FFB':PALETTE['water'],
 '#03305C':PALETTE['ripples'],
}
# Each row preserves a separate original tree group and maps its tip and
# proportions independently to the corresponding tree in the badge.
TREES={
 'tree-01-left-mid': ((158,755),(249,767),(.72,.74)),
 'tree-02-left-tall':((278,693),(340,731),(.72,.75)),
 'tree-03-left-inner':((384,735),(426,754),(.67,.76)),
 'tree-04-right-inner':((814,750),(739,752),(.69,.76)),
 'tree-05-right-tall':((906,732),(818,751),(.73,.75)),
 'tree-06-right-outer':((973,751),(885,778),(.72,.71)),
 'tree-07-left-edge':((101,847),(203,836),(.58,.72)),
 'tree-08-central-tall':((620,472),(602,545),(.73,.77)),
 'tree-09-foreground-left':((489,606),(503,645),(.75,.79)),
 'tree-10-foreground-right':((728,630),(677,666),(.76,.79)),
 'tree-11-small-left':((206,855),(287,841),(.72,.75)),
 'tree-12-small-middle-left':((336,829),(379,813),(.73,.77)),
 'tree-13-small-right':((957,832),(858,812),(.73,.81)),
 'tree-14-right-edge':((1049,937),(934,890),(.71,.83)),
}

def el(tag,attrs=None,parent=None):
    n=ET.Element(S(tag),attrs or {})
    if parent is not None:parent.append(n)
    return n

def path(parent,ident,d,fill):
    return el('path',{'id':ident,'d':d,'fill':fill},parent)

def layer(root,ident,label,clipped=True):
    g=el('g',{'id':ident,I('label'):label,I('groupmode'):'layer',
              'transform':REFERENCE_SCALE},root)
    if clipped:g.set('clip-path','url(#scene-opening-clip)')
    return g

def copy_group(base,ident,parent,transform=None):
    original=base.find(f".//*[@id='{ident}']")
    if original is None:raise ValueError(f'Missing base group: {ident}')
    g=copy.deepcopy(original)
    # A copied source layer is an ordinary object group in its new layer.
    g.attrib.pop(I('groupmode'),None)
    if transform:
        prior=g.get('transform','')
        g.set('transform',transform+' '+prior)
    for obj in g.iter():
        fill=obj.get('fill')
        if fill and fill.upper() in COLOR_MAP: obj.set('fill',COLOR_MAP[fill.upper()])
    parent.append(g)
    return g

def tree(base,ident,parent):
    (ox,oy),(tx,ty),(sx,sy)=TREES[ident]
    return copy_group(base,ident,parent,
        f'translate({tx} {ty}) scale({sx} {sy}) translate({-ox} {-oy})')

def build(base,*,full=False,sky=True,border=False,only=None):
    vb=FULL if full else CROP
    root=el('svg',{'version':'1.1','viewBox':' '.join(map(str,vb)),
        'width':str(vb[2]),'height':str(vb[3]),'preserveAspectRatio':'xMidYMid meet'})
    el('title',parent=root).text='BC Parks landscape — editable scene aligned to the supplied badge'
    el('desc',parent=root).text=(
        'Independent vector reconstruction, not an official source file. '
        'All scene artwork consists of editable paths. Existing authored tree, '
        'shoreline and lake paths were repositioned for the supplied badge; '
        'the scene opening, mountains and snowcaps were redrawn. '
        'Solid colours; no raster images, fonts, filters or external dependencies. '
        'No outer badge or lettering. Individual branches are a reconstruction, '
        'not a pixel-exact facsimile of the raster reference.')
    defs=el('defs',parent=root)
    clip=el('clipPath',{'id':'scene-opening-clip','clipPathUnits':'userSpaceOnUse'},defs)
    path(clip,'scene-opening-geometry',OPENING,'#000000')
    if border:
        path(layer(root,'layer-frame','00 · Optional white scene frame',False),
             'white-scene-frame',BORDER+' '+OPENING,PALETTE['border']).set('fill-rule','evenodd')
    if sky:
        path(layer(root,'layer-sky','01 · Sky and scene opening'),
             'sky-fill',OPENING,PALETTE['sky'])
    m=layer(root,'layer-mountains','02 · Mountain range and independent snowcaps')
    path(m,'mountain-range',MOUNTAIN,PALETTE['mountain'])
    path(m,'snowcap-left',SNOW_LEFT,PALETTE['snow'])
    path(m,'snowcap-right',SNOW_RIGHT,PALETTE['snow'])
    # Place the dark land mass first so every tree can remain independent.
    shore_transform='translate(124.87 186) scale(0.7652091255 0.76)'
    bank=layer(root,'layer-bank','03 · Dark bank behind the forest')
    copy_group(base,'forest-bank-underlay',bank,shore_transform)
    rear=layer(root,'layer-rear-forest','04 · Seven independent rear trees')
    for ident in list(TREES)[:7]:tree(base,ident,rear)
    central=layer(root,'layer-central-tree','05 · Central tall evergreen')
    tree(base,'tree-08-central-tall',central)
    firs=layer(root,'layer-foreground-firs','06 · Left and right foreground firs')
    for ident in ['tree-09-foreground-left','tree-10-foreground-right']:tree(base,ident,firs)
    saplings=layer(root,'layer-saplings','07 · Four small and edge trees')
    for ident in list(TREES)[10:]:tree(base,ident,saplings)
    bank=layer(root,'layer-shoreline','08 · Shoreline and understory')
    copy_group(base,'shoreline',bank,shore_transform)
    water=layer(root,'layer-lake','09 · Lake and 24 independent reflection paths')
    # End the lake at the flat lower scene boundary; keep source ripple shapes.
    copy_group(base,'lake',water,'translate(124.87 281.106383) scale(0.7652091255 0.664893617)')
    if only is not None:
        for child in list(root):
            if child.tag==S('g') and child.get('id') not in only:root.remove(child)
    return root

def write(root,out):
    ET.indent(root,space='  ')
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(ET.tostring(root,encoding='utf-8',xml_declaration=True))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir',type=Path,default=Path(__file__).resolve().parents[1])
    args=parser.parse_args()
    base=ET.parse(Path(__file__).with_name('base-landscape-redraw.svg')).getroot()
    out=args.out_dir; v=out/'vectors'/'authored-redraw'
    write(build(base),v/'bc-parks-scene-editable.svg')
    write(build(base,full=True),v/'bc-parks-scene-badge-aligned.svg')
    write(build(base,sky=False),v/'bc-parks-landscape-no-sky.svg')
    write(build(base,border=True),v/'bc-parks-scene-with-white-frame.svg')
    components={
     '01-sky':{'layer-sky'},
     '02-mountains-snowcaps':{'layer-mountains'},
     '03-forest-shoreline':{'layer-bank','layer-rear-forest','layer-central-tree',
       'layer-foreground-firs','layer-saplings','layer-shoreline'},
     '04-lake-reflections':{'layer-lake'},
     '05-white-scene-frame':{'layer-frame'},
    }
    for name,ids in components.items():
        write(build(base,border=True,only=ids),v/'components'/f'{name}.svg')
    (out/'source'/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')
    (out/'source'/'alignment-landmarks.json').write_text(json.dumps({
        'source_reference_image_px':[1122,1402],
        'drawing_coordinates':[1100,1375],
        'drawing_to_reference_scale':[1.02,1402/1375],
        'full_artboard_viewBox':FULL,'cropped_scene_viewBox':CROP,
        'tree_tip_placements':TREES,
        'note':'Manually selected placement landmarks, not measured per-branch accuracy.'
    },indent=2)+'\n')
    print('Wrote scene SVGs to',v)

if __name__=='__main__':main()
