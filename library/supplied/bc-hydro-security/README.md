# B.C. Hydro Security shield

S56-O21, the B.C. Hydro Security shield, with BC Hydro's own symbol in the centre: the ring round the
two-star H, green over blue, as PofBC draws it (Logos → BC Hydro → Full authority name). The atlas drew a
plain block H on a cream oval there; the photograph shows the symbol on a light disc.

```bash
node library/supplied/bc-hydro-security/compose.mjs ../PofBC   # writes composed/S56-O21.svg
npm run library:import
```

`compose.mjs` takes the atlas's drawing from the snapshot and keeps its shield, border and both captions. It
replaces the three centre-art groups with a disc the height of the old oval, and the symbol from PofBC's
`symbolMarkup` (`src/hydro/renderHydroSvg.js`) with the authority signature's default ring weight, star
scale and screen colours, its ring on the disc's edge. `preview-S56-O21.webp` is the result rendered in
Chromium, cropped and scaled to 440 px.

The shield and lettering are a reconstruction from a low-resolution collector board, and the symbol's
size on the patch is read from that photograph, so both are approximate.
