# Simon Fraser University / Security Services — fan (S56-O48)

The atlas read this fan as **British Columbia / Motor Vehicles** and drew its centre as a few polygons. The
113 × 48 collector-board photograph reads **SIMON FRASER UNIVERSITY** around the top and **SECURITY SERVICES**
along the two lower edges, about the university's arms (red chief, blue and white quarters, blue motto
scroll). It is filed under Simon Fraser University (`orgs.json` relabel, family `sfu-security-fan`).

`compose.mjs` keeps the atlas's cream fan, navy edge and navy thread, and adds:

- the arms, whole, from `source/SFU_coat_of_arms_colour.svg`, centred on the fan's axis from just under the
  upper caption to clear of the lower ones, where the photograph has them;
- SIMON FRASER UNIVERSITY set along the fan's own upper edge (its three curves, moved inward), and SECURITY
  and SERVICES on lines parallel to the lower edges, all in Roboto Condensed Bold (`../lettering`).

```bash
node library/supplied/sfu-security-fan/compose.mjs   # then npm run library:import
```

## Source

`source/SFU_coat_of_arms_colour.svg` was supplied with this change: the full-colour vector arms extracted
from Simon Fraser University's Brand Guidelines (May 2015, page 5), as its own `<desc>` records. Copyright
Simon Fraser University; no reuse rights are granted by the extraction. It is used unchanged apart from
prefixing its one clip-path id.

The lower caption reads SERVICES in the photograph (eight letters ending in S); the embroidered alphabet and
thread colours are interpreted.
