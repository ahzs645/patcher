"""Manual reconstruction of the patch's rounded, heavy block capitals.

Designed with explicit Bezier geometry; no raster contour extraction. Coordinates
use a 100-unit cap height, y downward. Use fill-rule='evenodd' for counters.
Widths are intrinsic outline widths, not spacing advances. Period is a full 100-unit square; scale it separately to the required punctuation size.
"""
GLYPHS = {
    'P': {'width':84, 'd': '''M3 0 H46 C70 0 84 13 84 35 C84 56 71 69 46 69 H34 Q32 69 32 71 V97 Q32 100 29 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z M34 25 H42 C49 25 52 28.5 52 34 C52 40 48.5 43 42 43 H34 Q32 43 32 41 V27 Q32 25 34 25 Z'''},
    'R': {'width':84, 'd': '''M3 0 H47 C70 0 84 12 84 32 C84 47 77 57 65 61 L83 96 Q85 100 81 100 H55 Q52 100 51 98 L35 69 Q32 65 32 69 V97 Q32 100 29 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z M34 25 H43 C49 25 52 28 52 33 C52 39 48 41 43 41 H34 Q32 41 32 39 V27 Q32 25 34 25 Z'''},
    'E': {'width':69, 'd': '''M3 0 H66 Q69 0 69 3 V23 Q69 26 66 26 H34 Q32 26 32 28 V35 Q32 37 34 37 H59 Q62 37 62 40 V58 Q62 61 59 61 H34 Q32 61 32 63 V73 Q32 75 34 75 H66 Q69 75 69 78 V97 Q69 100 66 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z'''},
    'D': {'width':83, 'd': '''M3 0 H43 C69 0 83 14 83 38 V63 C83 87 69 100 43 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z M32 27 H40 C48 27 52 33 52 42 V63 C52 71 48 75 40 75 H32 Z'''},
    'A': {'width':94, 'd': '''M32 0 H61 Q64 0 65 3 L93 96 Q94 100 90 100 H65 Q62 100 61 97 L58 86 H34 L30.5 97 Q30 100 27 100 H4 Q0 100 1 96 L28 4 Q29 0 32 0 Z M47 39 L41.5 61.5 Q41 63 42.5 63 H51.5 Q53 63 52.5 61.5 Z'''},
    'T': {'width':77, 'd': '''M3 0 H74 Q77 0 77 3 V24 Q77 27 74 27 H55 V97 Q55 100 52 100 H26 Q23 100 23 97 V27 H3 Q0 27 0 24 V3 Q0 0 3 0 Z'''},
    'O': {'width':77, 'd': '''M38.5 0 C64 0 77 11 77 35 V66 C77 90 64 100 38.5 100 C13 100 0 90 0 66 V35 C0 11 13 0 38.5 0 Z M38.5 26 C32.5 26 29.5 30 29.5 36 V66 C29.5 72 32.5 76 38.5 76 C44.5 76 47.5 72 47.5 66 V36 C47.5 30 44.5 26 38.5 26 Z'''},
    'B': {'width':87, 'd': '''M3 0 H53 C74 0 85 12 85 29 C85 39 81 45 73 49 C83 54 87 62 87 74 C87 91 75 100 54 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z M34 23 H44 C50 23 53 26 53 31 C53 36 50 39 44 39 H34 Q32 39 32 37 V25 Q32 23 34 23 Z M34 61 H44 C51 61 54 64 54 69 C54 74 51 77 44 77 H34 Q32 77 32 75 V63 Q32 61 34 61 Z'''},
    'N': {'width':82, 'd': '''M3 0 H24 Q27 0 29 3 L52 40 V3 Q52 0 55 0 H79 Q82 0 82 3 V97 Q82 100 79 100 H57 Q54 100 52 97 L30 63 V97 Q30 100 27 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z'''},
    'C': {'width':76, 'd': '''M38 0 C60 0 74 12 76 32 Q76 35 73 36 L51 42 Q47 43 47 39 C47 30 44 26 38 26 C31 26 29 31 29 38 V62 C29 70 32 75 38 75 C44 75 47 71 47 64 Q47 59 51 60 L73 65 Q76 66 76 69 C75 89 61 100 38 100 C13 100 0 87 0 64 V36 C0 13 13 0 38 0 Z'''},
    'H': {'width':78, 'd': '''M3 0 H28 Q31 0 31 3 V34 Q31 36 33 36 H45 Q47 36 47 34 V3 Q47 0 50 0 H75 Q78 0 78 3 V97 Q78 100 75 100 H50 Q47 100 47 97 V67 Q47 65 45 65 H33 Q31 65 31 67 V97 Q31 100 28 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z'''},
    'G': {'width':77, 'd': '''M39 0 C64 0 77 10 77 28 Q77 31 74 31 H51 Q48 31 47 28 C46 25 43 24 39 24 C32 24 29 29 29 35 V64 C29 70 32 74 39 74 C46 74 49 70 49 65 V62 H38 Q35 62 35 59 V44 Q35 41 38 41 H74 Q77 41 77 44 V66 C77 90 64 100 39 100 C13 100 0 89 0 65 V35 C0 11 13 0 39 0 Z'''},
    'M': {'width':96, 'd': '''M3 0 H27 Q30 0 31 3 L48 35 L65 3 Q66 0 69 0 H93 Q96 0 96 3 V97 Q96 100 93 100 H69 Q66 100 66 97 V57 L52 87 Q50 90 48 90 Q46 90 44 87 L30 57 V97 Q30 100 27 100 H3 Q0 100 0 97 V3 Q0 0 3 0 Z'''},
    '.': {'width':100, 'd': '''M12 0 H88 Q100 0 100 12 V88 Q100 100 88 100 H12 Q0 100 0 88 V12 Q0 0 12 0 Z'''},
}

def render_glyph(char, x=0, y=0, height=100, color='#eee9db'):
    """Make an isolated path; positions are the unrotated cap-height origin."""
    g=GLYPHS[char]
    return f'<path d="{g["d"]}" fill="{color}" fill-rule="evenodd" transform="translate({x} {y}) scale({height/100})"/>'

if __name__ == '__main__':
    from pathlib import Path
    from html import escape
    out=Path(__file__).parent
    rows=['B.C. GAME', 'DEPARTMENT', 'PREDATOR', 'BRANCH']
    items=[]
    for r, row in enumerate(rows):
        x=35
        for ch in row:
            if ch==' ':
                x+=35
                continue
            items.append(render_glyph(ch,x,35+r*140+(78 if ch=='.' else 0),22 if ch=='.' else 100))
            x+=(22 if ch=='.' else GLYPHS[ch]['width'])+10
    svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#101010"/>'+''.join(items)+'</svg>'
    (out/'glyph-review.svg').write_text(svg)
    try:
        import cairosvg
        cairosvg.svg2png(bytestring=svg.encode(),write_to=str(out/'glyph-review.png'))
    except ImportError:
        pass
    print(out/'glyph-review.svg')
