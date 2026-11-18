# BC Forest Service overlap review

The PDF and enlarged PNG sheets analyze the current reconstructed vector against the supplied 674 x 676 photograph. They do not apply the proposed changes to that vector.

- Overlap_Review.pdf: four-page visual review, exact SVG positions, estimated corrections, border measurements, and limits.
- Overlap_Overview.png: full source and current contours.
- Overlap_Details.png: enlarged regions with findings.
- Contour_Overlay.png: full-resolution contour overlay.
- Oval_Diagnostic.png: existing oval centreline and diagnostic fit to its bright ridge.
- Overlap_Measurements.json: source hashes, numerical border results, and qualified visual findings.
- Oval_Profiles.csv: all 720 samples, offsets and selection flags.

## Measurement interpretation

The border summary uses all 707 contrast/search-corridor-qualified profiles before the robust fit's further outlier rejection. Median absolute offset: 1.756 source pixels; 90th percentile: 5.424. These values are distances to a photographic highlight, not true die geometry. The nearby samples are correlated.

Letter and branch corrections are visual estimates in original source-image coordinates (origin top-left, x right, y down). They are not calibrated confidence intervals. A whole-logo overlap/accuracy percentage is not established by this photograph.

## Reproducing the border measurement

The `reproducibility` folder includes the exact source image, the reviewed SVG and `measure_ring.py`. Run that script from a Python environment with NumPy, SciPy and Pillow; it writes the numerical border diagnostics next to itself. Its input path is relative to the script. The `working_scripts` folder preserves the figure and PDF construction scripts, which refer to the original workspace layout and supplied analysis crops.

The interactive in-conversation inspection uses the same registered current paths as these figures. Its script/controls were syntax-checked and exercised with DOM event stubs; native browser rendering could not be checked in the execution environment.
