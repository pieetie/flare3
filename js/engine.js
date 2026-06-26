// Shared flare engine : one Pyodide runtime, loaded once and reused by every
window.flareEngine = (function () {
  let promise = null;

  const SETUP = `
import json
import flare_compat
import flpkg.dimer as _dimer
import flpkg.render as _render
import flpkg.params as _P

def _run(left, right, probe):
    oligos = {}
    if left:
        oligos["left"] = flare_compat.analyze(left)
    if right:
        oligos["right"] = flare_compat.analyze(right)
    if probe:
        oligos["probe"] = flare_compat.analyze(probe)
    cross = {}
    if left and right:
        cross["Left / Right"] = flare_compat.cross_dimer(left, right)
    if left and probe:
        cross["Left / Probe"] = flare_compat.cross_dimer(left, probe)
    if right and probe:
        cross["Right / Probe"] = flare_compat.cross_dimer(right, probe)
    return json.dumps({"oligos": oligos, "cross_dimers": cross})

# calibrated dimer config (matches the flare page numbers)
_CFG = {
    "dimer_dG37_table": _P.DG37_CALIBRATED_FIT,
    "dimer_init_dG": _P.DG37_CALIBRATED_FIT_INIT,
    "dimer_terminal_at_penalty": _P.DG37_CALIBRATED_FIT_AT_PENALTY,
    "dimer_min_run": 3,
    "dimer_threshold": _P.DG37_CALIBRATED_FIT_THRESHOLD,
}
_ANCHOR = 2  # run within this many bases of a 3' end = "end" binding

def _crossmatrix(seqs_json):
    seqs = json.loads(seqs_json)
    n = len(seqs)
    res = []
    for i in range(n):
        for j in range(i + 1, n):
            a, b = seqs[i], seqs[j]
            sts = _dimer.enumerate_cross_dimer(a, b, _CFG, cutoff=_CFG["dimer_threshold"])
            na = len(a)
            best_mid = 0.0
            best_end = 0.0
            for st in sts:
                dg = st["dg"]
                a_hi = st["start"] + st["length"] - 1
                b_lo = st["start"] - st["offset"]
                anchored = (a_hi >= na - _ANCHOR) or (b_lo <= _ANCHOR - 1)
                if anchored:
                    if dg < best_end:
                        best_end = dg
                elif dg < best_mid:
                    best_mid = dg
            dg = min(best_mid, best_end)
            ascii_ = _render.render_duplex_structure(a, b, sts[0]) if sts else ""
            res.append([i, j, round(best_mid, 1), round(best_end, 1), round(dg, 1), ascii_])
    return json.dumps(res)
`;

  function load() {
    if (promise) return promise;
    promise = (async () => {
      const py = await loadPyodide();
      const compat = await fetch("flare/flare_compat.py").then((r) => {
        if (!r.ok) throw new Error("flare/flare_compat.py not found (submodule initialized?)");
        return r.text();
      });
      py.FS.writeFile("flare_compat.py", compat);
      py.FS.mkdir("flpkg");
      py.FS.writeFile("flpkg/__init__.py", "");
      for (const m of ["params", "dimer", "render"]) {
        const src = await fetch("flare/flare/" + m + ".py").then((r) => {
          if (!r.ok) throw new Error("flare/flare/" + m + ".py not found (submodule initialized?)");
          return r.text();
        });
        py.FS.writeFile("flpkg/" + m + ".py", src);
      }
      py.runPython(SETUP);
      return py;
    })();
    return promise;
  }

  return { load };
})();
