# Expo 86 Emergency Service shield — S56-O23

Corrects the atlas's **CRIME PREVENTION** reading to **EMERGENCY**, adds the short
**SERVICE** row beneath it, and replaces the schematic EXPO letters and loose 86
loops with the complete stacked Expo logo already collected in PofBC.

**SERVICE is a provisional transcription.** The source clearly supports the
upper EMERGENCY heading, but its 75 × 57 pixels do not establish every letter of
the second row or exclude a final S. The user suggested SERVICE. This correction
does not claim a fully authenticated issue design.

## Evidence and reused artwork

- Specimen: S56-O23, bbox `[127, 513, 202, 570]` in the 480 × 640 collector board
  [S56 on Google Drive](https://drive.google.com/file/d/1ptQyL4EWkBbEo74gaC7jHaIzm6NCXbwY/view).
  PofBC retains the crop at `public/patch-review/crops/S56-O23.webp`.
- Original atlas SVG SHA-256:
  `ce38984b19c265c5c0b79aef3d6b925073db55e93475ced0caaa8655d16b47d8`.
- `source/expo86-symbol.svg` is an exact copy of
  [PofBC's collected Expo logo](https://github.com/ahzs645/PofBC/blob/1fb9e08dbb105bd691bed0790c81365b46ebc4f0/public/identity-collected/expo-86-corporation/expo86-symbol.svg).
  SHA-256: `3f51b5e0355222bd5399fc5e35ece3c4204c8527681d20f0385a8825bec5a1c7`.
  It is the **whole EXPO-over-86 lockup**, despite the filename “symbol”.
- The collected record credits **Mwtoews**, via
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Expo86logo.svg),
  as a modern third-party vector reconstruction from merchandise photographs;
  its licence field records Commons' public-domain/PD-textlogo assertion.
  It is not an original historical vector master.
- `source/lettering.json` stores outlined Nimbus Sans Bold letters (URW Base 35),
  matching the existing atlas Expo shield alphabet, with the source font hash.
  For example, the E, R and C paths match the atlas outlines exactly. The G is
  taken from that same font. This preserves the reconstruction's lettering style
  without claiming that the embroidery used this exact typeface.

## Construction and limits

The upper caption follows a circular baseline, with individual glyphs rotated to
its tangent. The smaller SERVICE row follows a shallow arc below it. Both use
paths, so the result requires no installed font. The shield is constructed with
a broad curved crown, tapered sides, dark edging and a narrow gold inner border.
The photograph's skew and fabric distortion are not baked into the symmetric
construction. The blue field is an interpreted screen colour.

The Expo asset is embedded as vector geometry, recoloured gold and scaled
uniformly from its `263 × 347` viewBox. Its EXPO letters, numeral curves, stroke
weights and proportions are preserved; no tracing or substitute text is used.
The lockup is 23 viewBox units wide and positioned below SERVICE. All dimensions
describe the drawing, not the physical patch.

The second-line reading, exact border contours, embroidered alphabet and thread
colours need a clearer specimen photograph to verify. The corrected metadata
retains that uncertainty, the original photograph and the atlas hash.

## Rebuild

```bash
node library/supplied/expo-emergency-service/compose.mjs
npm run library:import
npm run library:verify -- --source
```

`compose.mjs` checks the copied logo's hash, reads the retained letter outlines
and writes `composed/S56-O23.svg` without network access or font dependencies.
The preview is a transparent 440-pixel-wide WebP rendered from that composed SVG.
After changing the composition, regenerate the preview before importing.
`library/orgs.json` applies both the replacement and the corrected label/family,
so a later atlas import retains this fix.
