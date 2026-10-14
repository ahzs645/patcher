#!/usr/bin/env python3
"""Rebuild a path-only scene from the surviving flat aligned preview.

This is a reference-fit vectorization, not a claim to recover lost SVG data.
Palette regions are separated semantically, simplified, and fitted with
smoothed cubic Bezier contours. Source raster is never embedded in SVG.
The separate build_aligned_scene.py builds the independently authored
redraw from the supplied editable tree/shoreline/water geometry.

Requires numpy, scipy, opencv-python and Pillow in addition to Python 3.10+.
"""
from __future__ import annotations
import argparse, copy, json, math
from pathlib import Path
import xml.etree.ElementTree as ET
try:
    import cv2
    import numpy as np
    from PIL import Image
    from scipy.ndimage import gaussian_filter1d
    from scipy.interpolate import splprep, splev
except ImportError as exc:
    raise SystemExit('Install Pillow, numpy, scipy and opencv-python to regenerate this reference-fit version.') from exc
import build_aligned_scene as authored

SVG=authored.SVG;INK=authored.INK
S=authored.S; I=authored.I
ET.register_namespace('',SVG);ET.register_namespace('inkscape',INK)
# Ordered, measured solid colours of the surviving aligned scene preview.
COLORS={
 'mountain':(35,45,59),'sky':(91,163,237),'water':(75,153,232),
 'fir-highlight':(105,184,68),'water-reflections':(29,52,82),
 'fir-mid-green':(24,124,49),'rear-foliage':(94,124,80),
 'central-tree-shadow':(17,75,42),'rear-tree-shadow':(38,63,47),
 'snow':(244,244,246),'central-tree-foliage':(35,142,77),
}
LABELS=list(COLORS)
EL=authored.el
PATH=authored.path
PIXEL_SCALE='translate(144 244) scale(0.87027027027027 0.87144362486828)'


def color_hex(color): return '#'+''.join(f'{v:02X}' for v in color)
def fmt(v): return f'{float(v):.3f}'.rstrip('0').rstrip('.')
def point(p): return f'{fmt(p[0])},{fmt(p[1])}'

def rounded_contour(points, radius=0.65):
    """Smooth sampling stair-steps, then fit periodic cubic Bezier segments."""
    points=np.asarray(points,dtype=float).reshape(-1,2)+.5
    if len(points)<4:return ''
    # The dense OpenCV contour has roughly one-pixel arc-length spacing.
    # Smooth only that sampling noise, not the overall branch arrangement.
    sigma=1.15 if radius<1 else 1.6
    points=gaussian_filter1d(points,sigma=sigma,axis=0,mode='wrap')
    points=np.vstack((points,points[0]))
    try:
        tck,_=splprep(points.T,s=max(.2,len(points)*.06),per=True,k=3)
    except (ValueError,TypeError):
        return 'M '+' L '.join(point(v) for v in points[:-1])+' Z'
    knots=np.unique(tck[0][3:-3])
    if len(knots)<2:return ''
    parts=['M '+point(splev(knots[0],tck))]
    for t0,t1 in zip(knots[:-1],knots[1:]):
        p0=np.asarray(splev(t0,tck));p1=np.asarray(splev(t1,tck))
        d0=np.asarray(splev(t0,tck,der=1));d1=np.asarray(splev(t1,tck,der=1))
        dt=(t1-t0)/3
        parts.append('C '+point(p0+d0*dt)+' '+point(p1-d1*dt)+' '+point(p1))
    parts.append('Z')
    return ' '.join(parts)


def region_paths(mask,epsilon=0.56,rounding=0.65,min_area=1.1):
    contours,hierarchy=cv2.findContours(mask.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:return []
    h=hierarchy[0];result=[]
    for i,c in enumerate(contours):
        if h[i][3]!=-1 or abs(cv2.contourArea(c))<min_area:continue
        d=rounded_contour(c,rounding)
        child=h[i][2]
        while child!=-1:
            hole=contours[child]
            if abs(cv2.contourArea(hole))>=min_area:
                d+=' '+rounded_contour(hole,rounding)
            child=h[child][0]
        if d:result.append((d,float(cv2.contourArea(c))))
    return sorted(result,key=lambda item:-item[1])


def layer(root,ident,label):
    outer=EL('g',{'id':ident,I('label'):label,I('groupmode'):'layer',
        'transform':authored.REFERENCE_SCALE,'clip-path':'url(#scene-opening-clip)'},root)
    inner=EL('g',{'id':ident+'-fitted-geometry','transform':PIXEL_SCALE},outer)
    return outer,inner


def put_regions(root,ident,label,mask,color,*,epsilon=.56,rounding=.65,stroke=.66):
    outer,inner=layer(root,ident,label)
    for i,(d,area) in enumerate(region_paths(mask,epsilon,rounding),1):
        obj=PATH(inner,f'{ident}-region-{i:03d}',d,color)
        obj.set('fill-rule','evenodd')
        # Tiny same-colour overlap prevents antialias seams between adjacent
        # fitted regions. It remains a normal, editable vector stroke.
        if stroke:
            obj.set('stroke',color);obj.set('stroke-width',str(stroke))
            obj.set('stroke-linejoin','round');obj.set('stroke-linecap','round')
        obj.set('data-source-region-area-px',fmt(area))
    return outer


def new_root(full=False):
    vb=authored.FULL if full else authored.CROP
    root=EL('svg',{'version':'1.1','viewBox':' '.join(map(str,vb)),
                  'width':str(vb[2]),'height':str(vb[3]),'preserveAspectRatio':'xMidYMid meet'})
    EL('title',parent=root).text='BC Parks scene — reference-fit editable vector'
    EL('desc',parent=root).text=(
       'Independent reference-fit reconstruction of the inner scene. '
       'Colour regions of the surviving aligned flat preview were converted '
       'to smoothed cubic Bezier contours and separated into named layers. '
       'Not recovered original or previous SVG geometry. All artwork is SVG '
       'path geometry, with no embedded raster images or fonts. Outer badge '
       'and lettering are intentionally excluded. The package also includes '
       'an independently authored redraw with separate editable tree groups.')
    defs=EL('defs',parent=root)
    clip=EL('clipPath',{'id':'scene-opening-clip','clipPathUnits':'userSpaceOnUse'},defs)
    PATH(clip,'scene-opening-geometry',authored.OPENING,'#000000')
    return root


def build(labels,alpha,full=False):
    index=lambda name:LABELS.index(name)
    root=new_root(full)
    sky=authored.layer(root,'layer-sky','01 · Flat blue sky')
    PATH(sky,'sky-fill',authored.OPENING,color_hex(COLORS['sky']))
    # Use the newly authored, continuously curved mountain and snow paths.
    # Their shared external edges avoid double-contour seams at the ridge.
    mountains=authored.layer(root,'layer-mountains','02 · Authored mountain silhouette')
    PATH(mountains,'mountain-range',authored.MOUNTAIN,color_hex(COLORS['mountain']))
    snow=authored.layer(root,'layer-snowcaps','03 · Independent authored snowcaps')
    PATH(snow,'snowcap-left',authored.SNOW_LEFT,color_hex(COLORS['snow']))
    PATH(snow,'snowcap-right',authored.SNOW_RIGHT,color_hex(COLORS['snow']))
    yy,xx=np.indices(labels.shape)
    forest_roi=(yy>=338)&(yy<840)&((yy>=550)|((yy>=452)&(xx>=300)&(xx<=780))|((xx>=420)&(xx<=640)))
    order=['rear-tree-shadow','rear-foliage','central-tree-shadow','fir-mid-green',
           'central-tree-foliage','fir-highlight']
    for j,name in enumerate(order,4):
        mask=(labels==index(name))&(alpha>64)
        # Continuous underpaintings prevent dark seams between neighbouring
        # foliage colours after the contours are smoothed independently.
        if name=='rear-tree-shadow':
            mask=np.isin(labels,[index(n) for n in order])&(alpha>64)
        elif name=='central-tree-shadow':
            mask=np.isin(labels,[index(name),index('central-tree-foliage')])&(alpha>64)
        elif name=='fir-mid-green':
            mask=np.isin(labels,[index(name),index('fir-highlight')])&(alpha>64)
        mask &= forest_roi
        stroke=1.05 if name.endswith('shadow') or name=='fir-mid-green' else .4
        put_regions(root,'layer-'+name,f'{j:02} · '+name.replace('-',' ').title(),mask,color_hex(COLORS[name]),stroke=stroke)
    lake=(yy>=780)&(alpha>64)&((labels==index('water'))|(labels==index('water-reflections')))
    put_regions(root,'layer-lake','10 · Lake base and shoreline edge',lake,
                color_hex(COLORS['water']),epsilon=.6,rounding=.8,stroke=.7)
    put_regions(root,'layer-reflections','11 · Individual water reflections',
                (yy>=780)&(labels==index('water-reflections'))&(alpha>64),color_hex(COLORS['water-reflections']),
                epsilon=.58,rounding=1.25,stroke=.42)
    return root


def add_border(root):
    border=EL('g',{'id':'layer-white-frame',I('label'):'00 · Optional white scene frame',
        I('groupmode'):'layer','transform':authored.REFERENCE_SCALE})
    frame=PATH(border,'white-scene-frame',authored.BORDER+' '+authored.OPENING,'#FCFCFD')
    frame.set('fill-rule','evenodd')
    pos=next(i for i,x in enumerate(root) if x.tag==S('g'))
    root.insert(pos,border)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out-dir',type=Path,default=Path(__file__).resolve().parents[1])
    args=p.parse_args();out=args.out_dir
    source=Path(__file__).resolve().parents[1]/'reference'/'aligned-scene-preview.png'
    rgba=np.asarray(Image.open(source).convert('RGBA'))
    if rgba.shape[:2]!=(949,925):raise ValueError('Expected 925 x 949 aligned preview source.')
    rgb=rgba[:,:,:3].astype(np.float32)
    palette=np.array(list(COLORS.values()),dtype=np.float32)
    # One nearest-palette classification of the flat preview, not a search
    # for photographic texture or a purported recovery of hidden vector data.
    distances=((rgb[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3)
    labels=distances.argmin(axis=2);alpha=rgba[:,:,3]
    v=out/'vectors';root=build(labels,alpha)
    authored.write(root,v/'bc-parks-scene-editable.svg')
    aligned=copy.deepcopy(root)
    for key,value in {'viewBox':'0 0 1122 1402','width':'1122','height':'1402'}.items():aligned.set(key,value)
    authored.write(aligned,v/'bc-parks-scene-badge-aligned.svg')
    no_sky=copy.deepcopy(root)
    no_sky.remove(no_sky.find(f"{S('g')}[@id='layer-sky']"))
    authored.write(no_sky,v/'bc-parks-landscape-no-sky.svg')
    framed=copy.deepcopy(root);add_border(framed)
    authored.write(framed,v/'bc-parks-scene-with-white-frame.svg')
    components={
      '01-sky':{'layer-sky'},
      '02-mountains-snowcaps':{'layer-mountains','layer-snowcaps'},
      '03-forest-shoreline':{'layer-'+name for name in ['rear-tree-shadow','rear-foliage',
        'central-tree-shadow','fir-mid-green','central-tree-foliage','fir-highlight']},
      '04-lake-reflections':{'layer-lake','layer-reflections'},
      '05-white-scene-frame':{'layer-white-frame'},
    }
    for name,ids in components.items():
        r=copy.deepcopy(framed)
        for child in list(r):
            if child.tag==S('g') and child.get('id') not in ids:r.remove(child)
        authored.write(r,v/'components'/f'{name}.svg')
    (out/'source'/'reference-fit-palette.json').write_text(json.dumps({k:color_hex(v) for k,v in COLORS.items()},indent=2)+'\n')
    print('Reference-fit SVGs written to',v)

if __name__=='__main__':main()
