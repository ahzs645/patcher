# Fire Commissioner, on the supplied badge shape

S56-O43, the Fire Commissioner / British Columbia patch, on the badge's own outline: the ornamental
scalloped shield of the supplied shape study in `source/` (its README says how it was made). The atlas drew
a four-arm Maltese cross.

```bash
node library/supplied/fire-commissioner-badge/compose.mjs   # writes composed/S56-O43.svg
npm run library:import
```

`compose.mjs` takes the atlas's drawing from the snapshot and replaces its stroked border with the shape's
two paths, the gold silhouette and the dark field, fitted to the atlas's 74 × 73 canvas (72 units high,
centred) and painted in the atlas's gold and navy. The coat of arms and the three captions are the
atlas's; the badge's foot is narrower than the cross's, so BRITISH COLUMBIA is drawn 90% the size and a
unit higher to stay clear of the gold. `source/` is the package as supplied, less the comparison sheet's
SVG, which embeds the photograph (the PNG of it is kept).
