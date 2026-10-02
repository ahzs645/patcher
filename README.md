# Patcher

Turn SVG patch art (e.g. [Wikimedia Commons police patches](https://commons.wikimedia.org/wiki/Category:SVG_police_patches))
into an embroidered patch: a side-by-side **Patch SVG** view and a textured **Embroidered** render,
plus a stitch plan and a Tajima `.dst` machine file.

```bash
npm install
npm run dev
```

Drop an SVG, pick a sample, or paste a URL (Commons `File:` page links work).

The **BC Forest Service** samples are the six presets of the [forestoval](https://github.com/ahzs645/forestoval)
live lettering editor (Forest Service, Forests, Forests · Wildfire Service, Long ministry, Long ministry · Wildfire,
Airtanker Operations), exported at their defaults with the lettering converted to outlines so they render
without the fonts installed. They are reference-based reconstructions, not official masters.

**Views:** Compare (wipe slider), Side by side, Embroidered, Stitch plan, Patch SVG — shared pan/zoom,
pinch-zoom on touch, sew-out simulator with scrubber. Keys: `1`–`5` views, `Space` play, `F` fit, `O` open.

**Raised lettering:** text in the SVG (`<text>`, or outlined lettering tagged `data-live-text` as forestoval exports it)
is sewn the way a digitizer sews type: the fill behind it runs on underneath, then each letter goes on top as satin
columns over a centre-walk underlay. Switch it off under Stitches → Lettering, or set any thread to Auto / Flat / Raised
in the Threads tab (e.g. raise a logo's outline, or keep a colour flat).

**Exports:** embroidered PNG mockup, Patch SVG, Tajima `.dst`, Melco `.exp` (lock stitches, trims,
long-stitch splitting), plus design details and a thread sequence matched to Brother / Janome charts.

## Pipeline

1. **Rasterise** the SVG with the browser (`src/svg.ts`) so text, gradients, clip paths, `<use>` and CSS all work,
   plus a lettering-only pass (everything else hidden) that marks which regions are text.
2. **Thread colours** (`src/digitize/quantize.ts`): histogram + greedy distinct colours, majority filter.
3. **Regions** (`src/digitize/regions.ts`): connected components, speck absorption, distance fields, outline trace.
4. **Stitches** (`src/digitize/stitches.ts`, runs in a Web Worker):
   - tatami fill on a canvas-anchored row grid with 4-step stagger + 90° underlay (inkstitch),
   - hidden travel stitches instead of trims where the path stays under unsewn rows (bastidor + inkstitch),
   - satin that follows the stroke via edge-normal rungs + occupancy mask (PEmbroider), falling back to fixed-angle satin,
   - raised regions (lettering, or threads set to raised) sewn last: the neighbouring fill is extended under them,
     then satin columns marched along each stroke (shortest chord through the centreline, short stitches on tight
     curves) over a centre-walk + zig-zag underlay, with a fixed-angle satin for junction corners,
   - merrow / satin border along the traced cut edge.
5. **Render** (`src/render/textured.ts`): pre-shaded thread sprites per stitch (ThreadText), matte finish that only
   darkens (inkstitch realistic filter), randomised ply texture (dst-format), relief/AO from region distance, twill backing.
