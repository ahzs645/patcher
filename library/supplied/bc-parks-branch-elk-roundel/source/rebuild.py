#!/usr/bin/env python3
"""Construct the badge from editable SVG primitives and intentionally placed Bezier paths.
No bitmap tracing, raster embedding, gradients, filters, or external font dependencies.
"""
from pathlib import Path
import json, math, re
from xml.sax.saxutils import escape
try:
    import cairosvg
except ImportError:
    cairosvg = None

HERE=Path(__file__).resolve().parent
OUT=HERE.parent
PALETTE={'paper':'#FFFFFF','frame':'#090909','ring':'#6F320C','sky':'#2D9DF3','elk':'#7E3F14','ink':'#2A1408','shadow':'#230E06'}

# A few geometrically clean ellipses replace the small irregularities of the raster.
GEOMETRY={
'outer':{'cx':624.8,'cy':619.8,'rx':580.55,'ry':577.50},
'brown':{'cx':624.94,'cy':620.59,'rx':544.46,'ry':540.65},
'scene':{'cx':624.6,'cy':614.95,'rx':402.88,'ry':399.05},
}
# Mountain ridge: deliberate vertices and only subtle smoothing at summit transitions.
MOUNTAINS='''M215 455 L257 449 L293 417 L325 389 L348 378
L380 342 Q387 335 395 331 L429 354 L453 379 L491 400
L529 440 L560 437 L611 488 L634 503 L658 527
L692 501 L732 471 L766 453 L790 426 L817 405
Q819 404 821 406 L856 429 L899 485 L926 501
L958 534 L1028 578 L1060 1060 L190 1060 Z'''
TERRAIN='''M302 899 C324 886 349 880 369 877
C386 872 394 883 406 881
C416 879 421 871 435 875
C452 879 458 882 472 878
C491 873 499 883 518 890
L534 896 C555 904 567 907 585 906
C598 905 607 903 619 908
C640 916 653 924 669 927
C683 928 691 936 705 935
C726 933 739 928 754 930
C767 933 777 935 789 931
C803 928 811 934 820 935
C839 935 851 932 869 927
C883 920 897 913 914 905
L1060 1039 L301 1065 Z'''
# One continuous hand-drafted elk silhouette includes its branching antlers and
# the distinctive beard. The four lower legs are retained, rather than replaced
# by a generic animal silhouette.
ANTLER_HEAD_BODY='''M461 476
L459 461
C491 449 523 435 551 418 L574 404
C585 397 597 397 612 413 C621 423 615 404 611 396
C608 390 604 386 600 382
C620 370 640 361 655 373 C670 382 679 392 685 405
C690 417 692 394 688 380 C685 367 678 358 672 352
C669 349 671 346 674 342 C687 323 691 303 689 283
C689 274 685 278 682 290 C674 315 662 332 648 331
C642 332 640 328 637 321 C630 305 625 286 621 275
C616 262 614 276 615 290 L617 313
C621 342 609 359 586 368 C590 356 593 348 592 340
C592 331 588 336 585 342 C572 364 566 364 562 352
C556 333 551 317 548 315 C543 310 544 326 544 339
C544 362 539 380 531 390 C526 397 527 378 527 366
C527 343 525 319 523 309 C520 294 517 316 514 336
C509 379 501 416 485 421 C473 425 454 405 450 384
C448 373 449 361 445 360 C440 358 439 376 440 390
C441 408 447 422 456 433 C460 438 450 436 444 433
C428 426 416 409 412 394 C407 374 405 391 408 407
C410 423 416 435 426 443 C409 444 389 438 378 427
C369 419 367 410 365 408 C360 401 361 421 367 432
C377 451 399 460 423 466 C428 467 423 470 418 472
L400 482 L390 491 L346 514
C335 519 329 525 332 534 C333 539 336 542 341 543
C342 551 352 553 360 551 C373 548 378 553 386 557
C391 561 398 563 402 564 C403 581 405 593 410 601
L414 599 C417 612 418 623 423 630 L429 626
C437 645 444 658 449 660 L452 654
C462 664 470 673 477 678 L480 667
C487 678 491 685 496 689 L500 682
C503 704 513 716 526 723
C538 731 541 762 547 787
C550 801 561 816 563 839
C566 866 561 886 548 901
L574 906 L577 892 C582 897 585 889 584 881
C583 863 580 844 581 824 C580 809 586 797 586 783
C587 763 588 742 593 723
C632 735 679 733 737 720
C753 739 778 758 802 776
C821 791 834 801 839 821
C844 840 843 865 842 883 C842 899 838 907 832 914
L820 937 L854 934 L858 917 C864 923 866 914 865 906
C864 879 864 849 867 823 L870 793
C872 782 868 777 863 772 C846 755 837 743 837 722
C836 703 844 683 849 664 C851 656 852 648 851 642
L858 651 C864 636 857 617 842 601
C837 591 829 586 817 585 C802 571 787 568 765 570
C731 571 699 575 668 571 C633 568 615 552 582 546
C563 541 548 544 539 541 C524 538 517 528 508 519
C499 510 490 504 480 497
C486 487 488 477 484 476 C480 473 470 475 461 476 Z'''
FAR_FRONT='''M498 684 C499 704 505 719 518 727
C525 755 531 789 531 822 C533 853 530 877 520 890
L548 901 C547 880 547 853 550 828 C552 811 553 794 550 778 L550 714 Z'''
FAR_HIND='''M718 710 C724 744 742 770 756 790
C771 812 763 836 754 861 C746 882 741 901 731 911
L719 931 L754 930 L758 914 C763 919 766 910 767 902
C775 868 786 838 802 807 C809 795 803 785 802 774
L756 722 Z'''
HIND_SHADOW='''M720 720 L737 714 L751 732
C747 741 750 756 755 767 C739 751 728 735 720 720 Z'''
FRONT_SHADOW='''M499 682 C503 704 514 716 526 723
C538 731 541 762 547 787 C551 805 558 816 561 832
L548 824 C542 789 537 754 523 732 C509 724 496 710 493 695 Z'''
EYE='''M400 503 C403 499 405 495 410 497 L417 500
C412 505 407 506 403 503 Z'''
EAR_LINE='''M450 488 C454 482 460 478 469 476
L474 477 C463 479 456 483 450 488 Z'''
FORE_KNEE='''M588 727 C593 717 599 709 599 695
C604 701 603 711 599 717 L594 728 Z'''
HIP_LINE='''M733 696 C736 708 746 720 757 732
C770 745 787 757 803 772 L805 780
C781 763 758 747 744 731 C735 720 730 706 733 696 Z'''
ROCK_LEFT='''M419 942 C433 930 444 925 451 920
C465 908 472 914 482 911 C491 908 494 902 504 900
L524 894 L534 899 L508 906 C496 908 491 917 481 918
C470 920 464 916 454 923 L419 942 Z'''
ROCK_MID='''M545 984 C555 974 568 970 580 960
C589 951 598 956 607 953 L624 938
C636 933 647 929 655 925 L668 928 L632 941
L612 958 C602 962 593 958 585 964 L569 974 Z'''


def attrs(d):return ' '.join(f'{k}="{v}"' for k,v in d.items())
def ellipse(name,**extra):return f'<ellipse {attrs(GEOMETRY[name])} {attrs(extra)}/>'
def layer(name,label,contents):return f'<g id="{name}" inkscape:groupmode="layer" inkscape:label="{label}">{contents}</g>'
def path(id,d,fill,stroke=None,sw=5.5):
 st=f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"' if stroke else ''
 return f'<path id="{id}" d="{re.sub(chr(10)," ",d)}" fill="{fill}"{st}/>'

def make_svg(background=False,scene_only=False):
 c=PALETTE
 s=['<?xml version="1.0" encoding="UTF-8"?>',
 f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="1254" height="1254" viewBox="0 0 1254 1254" role="img" aria-labelledby="title desc">',
 '<title id="title">British Columbia Parks Branch — constructed vector reconstruction</title>',
 '<desc id="desc">Flat-colour reconstruction from the supplied raster. Editable ellipses, mountain vertices, individually constructed letters, and hand-drafted elk Bezier curves. Not an authenticated original government master.</desc>',
 '<defs><clipPath id="scene-clip">'+ellipse('scene')+'</clipPath><clipPath id="elk-body-clip"><path d="'+ANTLER_HEAD_BODY+'"/></clipPath></defs>']
 if background:s.append(layer('page-background','00 • Page background',f'<rect width="1254" height="1254" fill="{c["paper"]}"/>'))
 if not scene_only:
  s.append(layer('badge-rim','01 • White rim and black outer rule',ellipse('outer',fill=c['paper'],stroke=c['frame'],**{'stroke-width':5.6})))
  s.append(layer('brown-band','02 • Brown lettering field',ellipse('brown',fill=c['ring'])))
 s.append(layer('sky','03 • Sky',ellipse('scene',fill=c['sky'])))
 s.append(layer('mountains','04 • White mountain ridge','<g clip-path="url(#scene-clip)">'+path('mountain-silhouette',MOUNTAINS,c['paper'])+'</g>'))
 s.append(layer('terrain','05 • Foreground terrain','<g clip-path="url(#scene-clip)">'+path('terrain-silhouette',TERRAIN,c['elk'],c['ink'],6.4)+'</g>'))
 legs=path('far-front-leg',FAR_FRONT,c['shadow'],c['ink'],5.6)+path('far-hind-leg',FAR_HIND,c['elk'],c['ink'],6.0)+path('far-hind-shadow',HIND_SHADOW,c['shadow'])
 s.append(layer('far-legs','06 • Elk — far legs',legs))
 s.append(layer('elk-main','07 • Elk — body, head and antlers',path('elk-silhouette',ANTLER_HEAD_BODY,c['elk'],c['ink'],5.2)))
 s.append(layer('elk-details','08 • Elk — eye, ear and anatomical lines',
  '<g clip-path="url(#elk-body-clip)">'+path('front-leg-shadow',FRONT_SHADOW,c['shadow'])+'</g>'+path('eye',EYE,c['ink'])+path('ear-junction',EAR_LINE,c['ink'])+path('foreleg-junction',FORE_KNEE,c['ink'])+path('hip-line',HIP_LINE,c['ink'])))
 s.append(layer('rock-lines','09 • Rock detail lines',path('left-rock-line',ROCK_LEFT,c['ink'])+path('middle-rock-line',ROCK_MID,c['ink'])))
 s.append(layer('scene-rule','10 • Black scene outline',ellipse('scene',fill='none',stroke=c['frame'],**{'stroke-width':7.0})))
 if not scene_only:
  letters=json.load(open(HERE/'letter_placements.json'))
  for start,stop,lid,llabel in [(0,15,'top-lettering','11 • BRITISH COLUMBIA — outlined letters'),(15,26,'bottom-lettering','12 • PARKS BRANCH — outlined letters')]:
   tt=[]
   for i in range(start,stop):
    r=letters[i];cx,cy,t,w,h=r['params'];d=r['path']
    tt.append(f'<path id="letter-{i+1:02d}-{r["char"]}" aria-label="{r["char"]}" d="{d}" transform="translate({cx:.4f},{cy:.4f}) rotate({t:.4f}) scale({w/100:.6f},{h/100:.6f}) translate(-50,-50)" fill="{c["paper"]}" fill-rule="evenodd"/>')
   s.append(layer(lid,llabel,''.join(tt)))
 s.append('</svg>');return '\n'.join(s)

def main():
 (OUT/'vectors').mkdir(parents=True,exist_ok=True);(OUT/'previews').mkdir(exist_ok=True)
 for name,bg,only in [('BC_Parks_Branch_Master',False,False),('BC_Parks_Branch_White_Background',True,False),('BC_Parks_Branch_Scene_Only',False,True)]:
  svg=make_svg(bg,only);p=OUT/'vectors'/f'{name}.svg';p.write_text(svg)
  if cairosvg is not None:
   cairosvg.svg2png(bytestring=svg.encode(),write_to=str(OUT/'previews'/f'{name}.png'),output_width=1254,output_height=1254)
 print('Wrote SVGs and review renders.')

if __name__=='__main__':main()
