# Changelog

## v0.3.0 (2026-07-01)

* New design page : primer3 TaqMan design (left/right primer + probe) in the browser via primer3-wasm
* Three parameter sets : flare (custom tuning), flare relaxed (wider primer3 ranges), and primer3 default
* flare modes recombine primer3 left/right pools and enumerate probe candidates with flare thermodynamics, primer3 default returns native pairs scored by flare
* Breakpoint target, excluded regions (highlighted on the template), and adjustable ΔG threshold with live verdict filtering

## v0.2.0 (2026-06-29)

* New prepare page 
* Detects DNA primers by length window (10-50 bp) and warns when a record does not contain exactly 3 sequences
* Copy prepared sequences or send them straight to the multiplex page

## v0.1.0 (2026-06-26)

First release of flare3, a web interface for the flare thermodynamics engine

* Single page web app with a hash based router (flare and multiplex pages)
* Runs the flare engine directly in the browser through Pyodide
* flare page for oligo thermodynamics (TaqMan)
* Multiplex page to analyze several primers and probes
