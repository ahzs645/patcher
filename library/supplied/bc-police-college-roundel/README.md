# British Columbia / Police College — blue roundel (S56-O47)

The atlas drew this roundel as **British Columbia / Traffic Officers** and filed it with Highways and Motor
Vehicles. Enlarged, the 60 × 57 collector-board photograph reads, in lower case, **british columbia** over
the top and **police college** underneath. The BC Police College became part of the Justice Institute of
British Columbia (its Police Academy), so the patch is filed there (`orgs.json` relabel, family
`justice-institute-police-college-roundel`).

`compose.mjs` keeps the atlas's cream rim, navy ring, grey disc and centre figure, and resets both captions
in lower case with `../lettering`: Poppins SemiBold stands in for the unidentified geometric face, in the
atlas's cream thread, the upper line standing outward from the disc, the lower standing inward with its
descenders towards the rim.

```bash
node library/supplied/bc-police-college-roundel/compose.mjs   # then npm run library:import
```

The centre is still the atlas's coarse interpretation; a clearer photograph is needed to draw it properly.
