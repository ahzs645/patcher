# Campus Security / University of Victoria — shield (S56-O59)

The atlas filed this patch under UBC and read its lower lettering as UNIVERSITY OF / BRITISH COLUMBIA. The
78 × 62 collector-board photograph shows the University of Victoria's arms (a chief with three martlets
over an open book on blue) with **UNIVERSITY OF VICTORIA** curving under the shield and **SERVICES** across
the bottom: Campus Security Services. It is filed under the University of Victoria (`orgs.json` relabel,
family `uvic-campus-security`).

`compose.mjs` keeps the atlas's navy field, gold edge, CAMPUS and SECURITY, and adds the shield from
`source/uvic-shield.svg` and the two lower lines on circles under it, standing inward, in Roboto Condensed
Bold and the patch's gold (`../lettering`).

```bash
node library/supplied/uvic-campus-security/compose.mjs   # then npm run library:import
```

## Source

`source/UVic_CoA.svg` is the university's full arms (crest, helm, mantling, supporters' scrolls and mottoes)
as reproduced on the English Wikipedia,
[File:UVic CoA.svg](https://en.wikipedia.org/wiki/File:UVic_CoA.svg), which gives its source as the
University of Victoria's brand guidelines and marks it non-free (used there under fair use). Copyright the
University of Victoria.

`source/uvic-shield.svg` is the shield alone, cut from it by `extract-shield.mjs` (run in a browser with
Playwright: `node extract-shield.mjs source/UVic_CoA.svg source/uvic-shield.svg`). It keeps the vector paths
that lie within the shield and are drawn over it, leaving out the helm, mantling and motto scroll, and
clips them to the shield's outline. Two repairs: the chief's white field is an embedded PNG in the original,
replaced by a white rectangle of the same box; and the middle martlet's black outline, which the original
draws as part of its base linework showing through the PNG, is the left martlet's outline moved by the
offset between their red bodies (the three martlets are the same drawing).

SERVICES is read from the blurred photograph; the embroidered alphabet and thread colours are interpreted.
