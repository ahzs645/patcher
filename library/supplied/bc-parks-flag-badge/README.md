# BC Parks flag badge, from PofBC

The two BC Parks flag patches, the rounded square (atlas S30-O01) and the semicircle (S30-O02), use
the BC Parks **flag badge** as PofBC draws it in its Logos gallery
(<https://projects.ahmadjalil.com/PofBC/?view=gallery&logos=bc-parks>). That drawing has the
badge's hand-drawn frame and BC, flag and Parks shapes, where the atlas had approximations.

- `source/pofbc-flag-badge-ink.svg`: the badge exported by PofBC's own generator (flag identity,
  badge symbol, "Parks", one-ink flag, no clear space, **text converted to outlines**), so the file
  needs no font. Exported from the live site through its WebMCP tools (`set_lockup`,
  `export_lockup`).
- `compose.mjs`: builds the two patches from it, in the atlas's thread colours (green `#164b47`
  on cloth `#ebeaf4`):
  - `composed/S30-O01.svg`: the rounded square. It's PofBC's badge whole, with the cloth filling
    the frame's outer edge, so it's cut at the frame.
  - The semicircle (S30-O02) is built from the same badge by `../bc-parks-semicircles/compose.mjs`,
    which constructs the semicircle itself as exact geometry.

The badge's dating, sources and rights are as PofBC records them: seen on BC Parks brochures by
2002 (Alice Lake Provincial Park, 03/2002), rights unresolved. "BC" and "Parks" are set in the
Helvetica Bold that PofBC embeds, here as outlines of those six letters only.

Rebuild with `node library/supplied/bc-parks-flag-badge/compose.mjs`, then `npm run library:import`.
