# S01-O01 — Junior Forest Warden / Canadian Forestry Ass’n.

This package replaces the earlier generic shield, font outlines and schematic maple leaf with an editable vector reconstruction fitted to the supplied photograph. It is a **photo-registered study**, not an authenticated historical master or a flattened manufacturing die.

## Evidence and coordinates

- [Original photograph on Google Drive](https://drive.google.com/file/d/1INS_YP_UZWb3HuuJuolLxhmbafQ2Fo_W/view).
- Original filename: `128873478_10156519763887325_2381551517176016451_n.jpg`.
- Local evidence: `source-reference.jpg`, copied without alteration; 720 × 960 pixels, 140,634 bytes.
- Source SHA-256: `ccff597d5eefc59ddee05a70690de332b3a1844921a5ac9b2652a9e241544f09`.
- Crop: `[65, 125, 604, 732]` in native source pixels; output canvas 539 × 607.
- Artwork coordinates use the full original photo; the one wrapper translates by `(-65, -125)`. No perspective, lens, or curvature correction is claimed.

This is the **same photo already recorded by the earlier atlas reconstruction**, verified by the original SHA-256. It is not a new or higher-resolution specimen. The source is included as reference evidence, without a claim that it is an official master or that its original publication/licensing is established.

## What changed

1. The shield follows the photographed domed top, shoulder recesses, waist, broad lower body and offset bottom point. The inset rim is drawn separately rather than scaling the outer outline.
2. Every letter is a positioned path, with explicit relief-boundary and letter-face widths. The rows retain their distinct arches and slants, including the tall FOREST WARDEN row and enlarged F, W, C and A initials. There are no font dependencies or live text.
3. Both dots beside JUNIOR, the apostrophe before the final N, and the terminal period are retained. The apostrophe has an independent contour rather than joining the adjacent letters.
4. The maple leaf has asymmetric five-lobe geometry, a short stem, and tapered, connected principal and secondary veins. The left recess follows the photographed valley near (313, 423), removing the broad filled web in the first candidate. Its irregular margin turns and distinct basal lobes replace the earlier smooth scallops. It does not reuse the geometric flag maple leaf.
5. Grain, wear specks, broad cast shadows and JPEG noise are excluded. Flat warm colours distinguish the field, rim and relief; they do not measure the material's original colour.

The clean SVG has named groups for `silhouette`, `rim`, `junior`, `forest-warden`, `canadian`, `forestry-assn` and the leaf. Each glyph has `data-letter` and its row has `data-caption`, preserving downstream lettering recognition. The output contains paths and circles only, with no embedded raster, filters, gradients, external resources or scripts.

## Remaining interpretation

The photograph has bevel lighting, shadows, wear and compression. Some fine letter widths, small serifs/scallops and vein details remain interpreted. The tracing convention follows ridge centrelines with simplified visible relief boundaries; it does not copy every shadow as a separate decorative feature. The photographed perspective and possible curvature are retained. A flat scan or calibrated straight-on photograph would be needed to establish a frontal geometry more confidently.

The existing catalogue calls the object a **leather badge**. This package preserves that attribution but does not independently authenticate the material, date, maker, physical dimensions or original die from this single photograph.

## Rebuild and verify

From the repository root:

```bash
python library/supplied/junior-forest-warden/compose.py
```

`compose.py` checks the original photo checksum and combines the explicitly recorded shield/letter paths with `maple-leaf-component.svg`. It deterministically writes `composed/S01-O01.svg`; neither file is produced by automatic raster tracing.

Regenerate the small WebP preview from that SVG with an SVG renderer at 400 pixels wide, keeping transparency and the original aspect ratio. The committed preview was rendered with Sharp, WebP quality 92 and alpha quality 100. Then import through the normal library pipeline:

```bash
npm run library:import -- --zip /path/to/bc-forestry-patch-atlas-codebase-02f524d650e2.zip
node scripts/verify-library.mjs --zip /path/to/bc-forestry-patch-atlas-codebase-02f524d650e2.zip
```

`library/orgs.json` records the supplied replacement and the corrected punctuation in its label. The importer retains the original atlas SVG checksum under the generated record's `replaced` field. Do not edit the generated organization SVG, preview or manifest by hand.

## Review

The overlay uses the unchanged native photo crop and the identical SVG canvas, with no independent fitting between the images. The shield, rim, row positions and leaf were inspected together; a second pass separated the apostrophe, corrected the final WARDEN N position and smoothed JUNIOR's O. The subsequent leaf pass deepened the left recess, sharpened only the larger visible margin changes, separated the basal lobes and replaced uniform vein strokes with tapered faces. A detached upper-right branch was joined to its principal vein; a 4× raster geometry check found one connected vein network and no vein pixels outside the blade. `review/leaf-comparison.png` compares the source, first candidate and corrected leaf at the same registration. Small teeth and bevel widths remain interpreted. This remains a refinement candidate, not a claim of exact specimen or die fidelity.
