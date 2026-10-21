# Forest Service / British Columbia / Parks — vector reconstruction

## Main files

- `forest-service-parks-patch.svg`: layered editable master, with cream backing.
- `forest-service-parks-patch-expanded.svg`: companion with visible strokes expanded into filled vector paths, for applications that handle outlines more reliably than strokes.
- `forest-service-parks-patch-no-backing.svg`: the same artwork with the cream outer backing omitted.
- `forest-service-parks-centre-symbol.svg`: the isolated tree and landscape inside the illustrated oval.
- Matching PNG files: transparent raster previews, generated from the SVG artwork.
- `forest-service-parks-comparison.png`: photograph and reconstruction side by side.
- `forest-service-parks-overlay.png`: magenta vector edges over the source photograph, without fitted geometric registration.
- `palette.json`: the editable flat-colour palette.
- `source/rebuild_patch.py`: complete construction source (Python, numpy and fontTools).
- `reference/reference-photo.png`: the user-supplied 401 × 498 px photograph.

## Construction

The patch was rebuilt using a continuous oval/tab silhouette, ellipse geometry,
manually authored conifer and landscape paths, and separately positioned outline
letters. No photograph, raster image, tracing bitmap, or external image is embedded
in any SVG. The SVG files contain no live text or required installed fonts.

The master has eight named layers: cream backing; green foundation; green border
accent; gold oval piping; central landscape; tree and foreground; oval lettering;
and PARKS lettering. Individual letters and principal shapes have descriptive IDs.
The centre-symbol version contains only the landscape and tree layers.

Seven principal bough tiers, the visible trunk, the low purple mountain backdrop,
and the pale strip above the foreground are retained. Fabric shading, fuzzy thread
edges, stitch-direction texture, and incidental distortion were not reproduced.

## Interpretation and limits

This is a clean reconstruction from the supplied photograph, not recovered original
production art. The precise original typeface, thread specifications, physical patch
size, and some small mountain details are not established by the photo. Nimbus Sans
was used as a construction basis for the lettering; its width, positioning, and R
shapes were adjusted. The included SVG lettering is already outlined.

All eight palette colours are approximate flat interpretations of the photograph.
The fine green seam accent is separate and can be recoloured to match the dark
field or omitted. The green foundation and cream backing share an idealized
centreline; the photographed patch has minor sewing and perspective irregularities.

The master viewBox is `23 25 346 450`, including a small transparent margin.
The actual cream backing is 334 drawing units wide and 438 high. Its width-to-height
ratio is approximately 0.7626. No physical millimetre size has been assumed. Set the
actual artwork height, excluding canvas padding, to the desired finished patch size.

An embroidery digitizer can use the SVG artwork to set thread choices, stitch
directions, densities, underlay, pull compensation, and machine format after the
finished size is selected. Small landscape lines should be reviewed at that size.

## Verification

- The SVGs were parsed and rendered successfully in Inkscape.
- No SVG contains an embedded raster image or live text element.
- Both the master and expanded companion were rendered and compared. Differences
  are restricted to small antialiasing effects associated with stroke expansion.
- The reconstruction was reviewed beside the reference, and the second pass adjusted
  the oval lettering placement/weight, the R legs, and the tree-to-ground transition.
- The comparison and overlay use the photograph's original 401 × 498 coordinate
  system. They show an idealized reconstruction, not a claim of pixel identity.

## Rebuilding

The SVGs are directly editable and do not require the Python source. To regenerate
the geometry from the script, install Python with numpy and fontTools and provide
NimbusSans-Regular.otf and NimbusSans-Bold.otf in FONT_DIR. Run
`python3 source/rebuild_patch.py`. Its `source/deliverables` directory receives
the generated SVG files. Update PALETTE and the authored geometry to revise the
design. PNG and expanded-stroke exports can be regenerated with Inkscape.
