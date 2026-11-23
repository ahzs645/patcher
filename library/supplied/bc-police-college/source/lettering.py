"""Manually constructed lowercase forms for the BC Police College patch.

This is a small drawing vocabulary for the two photographed inscriptions, not
a font or a digital-font conversion. All outlines are original geometric
constructions fitted by visual inspection to the supplied embroidered patch.
In particular, the b/p/a open joints and the sloping e crossbar are deliberate.

Coordinates: baseline y=0, x-height 100, ascenders 143, y increases downward.
`advance` is the natural drawing width, with a modest built-in side bearing.
Callers can add arc tracking. Paths use normal nonzero winding and closed
subpaths; they require no strokes, external fonts, images, or CSS.
"""

from math import cos, sin, tan, radians, ceil


def _n(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"


def _arc(cx, cy, radius, start, end):
    """Return cubic arc commands, measured in degrees, without a move."""
    count = max(1, ceil(abs(end - start) / 90))
    delta = (end - start) / count
    pieces = []
    for index in range(count):
        a = radians(start + index * delta)
        b = radians(start + (index + 1) * delta)
        factor = 4 / 3 * tan((b - a) / 4)
        x0, y0 = cx + radius * cos(a), cy + radius * sin(a)
        x3, y3 = cx + radius * cos(b), cy + radius * sin(b)
        x1, y1 = x0 - factor * radius * sin(a), y0 + factor * radius * cos(a)
        x2, y2 = x3 + factor * radius * sin(b), y3 - factor * radius * cos(b)
        pieces.append("C " + " ".join(_n(v) for v in (x1, y1, x2, y2, x3, y3)))
    return " ".join(pieces)


def _circle(cx, cy, radius, reverse=False):
    return f"M {_n(cx + radius)} {_n(cy)} " + _arc(cx, cy, radius, 0, -360 if reverse else 360) + " Z"


def _open_ring(cx=50, cy=-50, outer=50, inner=26, aperture=40):
    start, end = -aperture, aperture - 360
    x0, y0 = cx + outer * cos(radians(start)), cy + outer * sin(radians(start))
    xi, yi = cx + inner * cos(radians(end)), cy + inner * sin(radians(end))
    return (f"M {_n(x0)} {_n(y0)} " + _arc(cx, cy, outer, start, end)
            + f" L {_n(xi)} {_n(yi)} " + _arc(cx, cy, inner, end, start) + " Z")


def _glyph(path, advance, bounds, notes=""):
    return {"path": " ".join(path.split()), "advance": advance,
            "bounds": bounds, "notes": notes}


GLYPHS = {
    "b": _glyph("""
        M 0 -143 L 24 -143 L 24 -50
        C 24 -35.6406 35.6406 -24 50 -24
        C 64.3594 -24 76 -35.6406 76 -50
        C 76 -64.3594 64.3594 -76 50 -76
        L 37 -76 L 37 -100 L 50 -100
        C 77.6142 -100 100 -77.6142 100 -50
        C 100 -22.3858 77.6142 0 50 0
        C 22.3858 0 0 -22.3858 0 -50 Z
    """, 110, (0, -143, 100, 0), "Open upper-left bowl joint; retain the 13-unit slit."),
    "p": _glyph("""
        M 0 43 L 24 43 L 24 -50
        C 24 -64.3594 35.6406 -76 50 -76
        C 64.3594 -76 76 -64.3594 76 -50
        C 76 -35.6406 64.3594 -24 50 -24
        L 37 -24 L 37 0 L 50 0
        C 77.6142 0 100 -22.3858 100 -50
        C 100 -77.6142 77.6142 -100 50 -100
        C 22.3858 -100 0 -77.6142 0 -50 Z
    """, 110, (0, -100, 100, 43), "Open lower-left bowl joint; descender reaches 43."),
    "a": _glyph("""
        M 100 0 L 76 0 L 76 -50
        C 76 -64.3594 64.3594 -76 50 -76
        C 35.6406 -76 24 -64.3594 24 -50
        C 24 -35.6406 35.6406 -24 50 -24
        L 63 -24 L 63 0 L 50 0
        C 22.3858 0 0 -22.3858 0 -50
        C 0 -77.6142 22.3858 -100 50 -100
        C 77.6142 -100 100 -77.6142 100 -50 Z
    """, 110, (0, -100, 100, 0), "Single-storey form with an open lower-right bowl joint."),
    "c": _glyph(_open_ring(), 101, (0, -100, 88.3023, 0), "Geometric C-shaped lowercase; oblique terminals."),
    "o": _glyph(_circle(50, -50, 50) + " " + _circle(50, -50, 26, True),
                110, (0, -100, 100, 0), "Circular bowl, circular counter; nominal stroke 24."),
    "e": _glyph("""
        M 96 -66 L 31 -28
        C 36 -23 43 -20 51 -20
        C 64 -20 74 -26 80 -36
        L 96 -25
        C 87 -8 70 2 50 2
        C 22 2 0 -20 0 -49
        C 0 -78 21 -100 49 -100
        C 70 -100 89 -87 96 -66 Z
        M 24 -48 L 69 -74
        C 64 -78 57 -80 50 -80
        C 35 -80 24 -67 24 -48 Z
    """, 106, (0, -100, 96, 2), "Closed upper counter and oblique rising crossbar; lower-right aperture remains open."),
    "g": _glyph("""
        M 100 -50 L 100 1
        C 100 25 81 38 53 38
        C 37 38 24 34 14 26
        L 27 9
        C 35 15 42 18 53 18
        C 68 18 76 10 76 0
        L 76 -6
        C 69 -1 59 2 49 2
        C 20 2 0 -20 0 -49
        C 0 -78 21 -100 50 -100
        C 79 -100 100 -79 100 -50 Z
    """ + " " + _circle(50, -50, 26, True),
        110, (0, -100, 100, 38), "Single-storey bowl and short curved descender, fitted to the normalized photo; not a double-storey g."),
    "h": _glyph("""
        M 0 0 L 0 -143 L 24 -143 L 24 -82
        C 31 -94 43 -100 56 -100
        C 78 -100 94 -83 94 -58
        L 94 0 L 70 0 L 70 -55
        C 70 -68 62 -77 48 -77
        C 33 -77 24 -66 24 -51 L 24 0 Z
    """, 104, (0, -143, 94, 0), "Tall straight stem with a rounded, open shoulder."),
    "i": _glyph("M 0 -100 L 24 -100 L 24 0 L 0 0 Z " + _circle(12, -131, 12),
                38, (0, -143, 24, 0), "Round dot, independent from the square-ended stem."),
    "l": _glyph("M 0 -143 L 24 -143 L 24 0 L 0 0 Z",
                38, (0, -143, 24, 0), "Plain narrow ascender; no hook or serif."),
    "m": _glyph("""
        M 0 0 L 0 -100 L 24 -100 L 24 -87
        C 30 -96 39 -100 50 -100
        C 66 -100 77 -93 83 -81
        C 89 -94 103 -100 117 -100
        C 140 -100 156 -84 156 -58
        L 156 0 L 132 0 L 132 -57
        C 132 -70 125 -78 114 -78
        C 102 -78 94 -68 94 -55
        L 94 0 L 70 0 L 70 -57
        C 70 -71 62 -78 50 -78
        C 35 -78 24 -67 24 -53 L 24 0 Z
    """, 166, (0, -100, 156, 0), "Two rounded shoulders, nominal stem width 24."),
    "r": _glyph("""
        M 0 0 L 0 -54
        C 0 -82 20 -100 47 -100
        L 61 -100 L 61 -76 L 47 -76
        C 33 -76 24 -66 24 -53 L 24 0 Z
    """, 71, (0, -100, 61, 0), "Rounded arch with a short horizontal right terminal."),
    "s": _glyph("""
        M 88 -100 L 88 -76 L 77 -76
        C 60 -76 52 -65 52 -49
        C 52 -19 33 0 6 0
        L 0 0 L 0 -24 L 8 -24
        C 21 -24 28 -36 28 -50
        C 28 -80 46 -100 76 -100 Z
    """, 98, (0, -100, 88, 0), "Integral-like rising Bauhaus s; this distinctive open form is visible between i and h."),
    "t": _glyph("""
        M 18 -136 L 42 -136 L 42 -100
        L 69 -100 L 69 -76 L 42 -76 L 42 -36
        C 42 -28 48 -23 58 -23
        L 70 -23 L 70 0 L 56 0
        C 33 0 18 -13 18 -36
        L 18 -76 L 0 -76 L 0 -100 L 18 -100 Z
    """, 80, (0, -136, 70, 0), "Short ascender and rounded lower hook."),
    "u": _glyph("""
        M 0 -100 L 24 -100 L 24 -45
        C 24 -30 33 -22 47 -22
        C 61 -22 70 -31 70 -45
        L 70 -100 L 94 -100 L 94 -45
        C 94 -17 75 2 47 2
        C 19 2 0 -17 0 -45 Z
    """, 104, (0, -100, 94, 2), "Rounded bottom; straight, square-ended upper terminals."),
    " ": _glyph("", 49, (0, 0, 0, 0), "Word space; tune with arc placement if required."),
}


def get_glyphs():
    """Return independent entries suitable for an SVG drawing script."""
    return {character: dict(glyph) for character, glyph in GLYPHS.items()}


def proof_svg(scale=0.5):
    """Return a temporary flat proof of the two inscriptions for inspection."""
    lines = ("british columbia", "police college", "bpaeog")
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="440" viewBox="0 0 1200 440">',
             '<rect width="1200" height="440" fill="#272b67"/>']
    for index, line in enumerate(lines):
        advance = 0
        for character in line:
            glyph = GLYPHS[character]
            if glyph["path"]:
                parts.append(f'<path d="{glyph["path"]}" fill="#e7e6cc" transform="translate({40 + scale * advance},{110 + index * 135}) scale({scale})"/>')
            advance += glyph["advance"] + 5
    parts.append('</svg>')
    return '\n'.join(parts)

