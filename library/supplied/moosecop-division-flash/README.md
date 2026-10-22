# Division flashes: a rocker and a box, merged

MC13-O02 is now supplied by `../bc-fish-game-rockers/`, with its own photograph-
based proportions and custom lettering. This older construction is kept for
MC09-O02 only; its historical MC13 files are retained as source history.

MC09-O02 (Wildlife Protection / Division) and MC13-O02 (Predator Control / Division) are the regular
curved felt flash with a box joined under its centre for DIVISION. The atlas drew each as one freehand
outline with notched shoulders; here it is the two shapes merged.

```bash
node library/supplied/moosecop-division-flash/compose.mjs   # writes composed/MC09-O02.svg
npm run library:import
```

- The rocker is the two-line flash's own (`moosecop-early-two-line-flash-v1`, as on MC09-O01 and
  MC12-O01): the same outer arc, ends and inner arc in the flash master's 100-unit frame.
- The box is the atlas's (x 23–77), dropped to sit as deep as the rocker's ends.
- The outline is their union, worked out exactly: the inner arc is split where it meets the box's sides,
  so the curves are the rocker's own and the box's sides are straight. The gold inset is the same union
  of the rocker's inset and the box's.

The lettering and colours are the atlas's, and the canvas is deepened to the rocker's ends. Both designs
share the flash master, so both are rebuilt. Previews are rendered in Chromium at 440 px wide.
