# BC Fire Commissioner badge — outer shape study

This package interprets the OUTER badge shape in the user-supplied photograph.
It does not reconstruct the lettering or the central coat of arms.

## Shape

Descriptive name: ornamental scalloped shield, or badge cartouche.
This is a visual description, not a verified official heraldic classification.

The defining features are the rounded central crest, short stepped shoulder
projections, inward notches, broad convex side curves, smaller lower projections,
and a broad taper into a softly rounded bottom point.

## Construction

- Hand-constructed cubic Bezier curves; no raster auto-trace.
- The right half is mirrored exactly to construct the left half.
- Working outer dimensions: 96 design units wide by 100 high.
- Coordinates are arbitrary design units, not millimetres.
- The blank badge uses two separately editable paths: the outer gold silhouette
  and the dark inset field. The border file uses a compound even-odd path.
- The inner contour was drawn independently. It is not a mathematically exact
  constant-distance offset, and final border widths should be decided at the
  intended manufacturing size.
- Gold and navy are illustrative colours, not a verified colour specification.

## Files

- bc-fire-commissioner-shape.svg — gold surround and dark field; two editable paths.
- bc-fire-commissioner-outline.svg — the outer outline alone, transparent background.
- bc-fire-commissioner-border.svg — gold border with a transparent centre.
- bc-fire-commissioner-shape-study.png — viewable source / overlay / template comparison.
- bc-fire-commissioner-shape-study.svg — editable comparison sheet. This comparison
  sheet embeds the photograph; the three standalone badge SVGs contain vectors only.
- geometry.json — exact normalized control points and source overlay placement.

## Evidence and limits

Source: the supplied 165 x 174 pixel photograph. Its small size, blur, embroidery
texture and slight apparent tilt limit precision. The source supports the broad
shape, but cannot resolve exact small corner radii or original production dimensions.

The overlay is the cleaned symmetric template placed over the unwarped photograph.
Its SVG transform is:

    translate(82 89.5) rotate(2.4) scale(1.5) translate(0 -50)

This is an approximate visual registration, not proof of an exact match. The
photograph itself has not been locally distorted to fit the template. The small
green fragment above the patch is unrelated and is clipped out of the comparison.

The template is a useful editable starting point, not recovered official artwork
or an embroidery machine file. A better straight-on image could refine the outline.
