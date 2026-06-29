# Changelog

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
