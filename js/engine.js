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

# mixing engine: primer3 gives the left/right pools, flare3 enumerates the probe candidates itself (sliding window over the template, avoiding the junction), then every left x right x probe combo is flare scored and the thermo-ok ones are returned, ranked by primer3 penalty
def _mix(payload):
    d = json.loads(payload)
    tpl = d["template"]
    n = len(tpl)
    j = d["j"]
    delta = d["delta"]
    avoid = set()
    if j > 0:
        avoid.add(j)
        avoid.add(j + 1)
    for st, ln in d["ghosts"]:
        for k in range(st, st + ln):
            avoid.add(k)

    an = {}
    cx = {}

    def AN(s):
        v = an.get(s)
        if v is None:
            a = flare_compat.analyze(s)
            v = (a["self_dimer_dG_kcal"], a["hairpin_dG_kcal"])
            an[s] = v
        return v

    def CX(a, b):
        v = cx.get((a, b))
        if v is None:
            v = flare_compat.cross_dimer(a, b)
            cx[(a, b)] = v
        return v

    # enumerate clean probe candidates once
    pmin, pmax = d["plen_min"], d["plen_max"]
    tmin, tmax = d["ptm_min"], d["ptm_max"]
    gmin, gmax = d["pgc_min"], d["pgc_max"]
    ppx = d["ppolyx"]
    probes = []
    for st in range(1, n + 1):
        for L in range(pmin, pmax + 1):
            en = st + L - 1
            if en > n:
                break
            bad = False
            for a in avoid:
                if st <= a <= en:
                    bad = True
                    break
            if bad:
                continue
            p = tpl[st - 1:en]
            g = 100.0 * (p.count("G") + p.count("C")) / L
            if g < gmin or g > gmax:
                continue
            mx = 1
            c = 1
            for i in range(1, L):
                if p[i] == p[i - 1]:
                    c += 1
                    if c > mx:
                        mx = c
                else:
                    c = 1
            if mx > ppx:
                continue
            tm = flare_compat.tm(p)
            if tm < tmin or tm > tmax:
                continue
            sd, hp = AN(p)
            if sd < delta or hp < delta:
                continue
            probes.append((p, st, L, tm))

    smin, smax = d["size_min"], d["size_max"]
    out = []
    for lseq, ls, ll, lpen, ltm in d["lefts"]:
        le = ls + ll - 1
        lsd, lhp = AN(lseq)
        for rseq, rs, rl, rpen, rtm in d["rights"]:
            ri = rs - rl + 1
            prod = rs - ls + 1
            if prod < smin or prod > smax or le >= ri:
                continue
            if j > 0 and not (ls <= j and rs >= j + 1):
                continue
            rsd, rhp = AN(rseq)
            lr = CX(lseq, rseq)
            base = lpen + rpen
            for pseq, pst, pl, ptm in probes:
                pe = pst + pl - 1
                if pst <= le or pe >= ri:
                    continue
                psd, php = AN(pseq)
                lp = CX(lseq, pseq)
                rp = CX(rseq, pseq)
                pairs = (
                    ("self (Left)", lsd), ("hairpin (Left)", lhp),
                    ("self (Right)", rsd), ("hairpin (Right)", rhp),
                    ("self (Probe)", psd), ("hairpin (Probe)", php),
                    ("cross (Left / Right)", lr),
                    ("cross (Left / Probe)", lp),
                    ("cross (Right / Probe)", rp),
                )
                worst = None
                wl = ""
                for nm, dg in pairs:
                    if worst is None or dg < worst:
                        worst = dg
                        wl = nm
                if worst >= delta:
                    out.append((base, worst, {
                        "L": lseq, "R": rseq, "P": pseq,
                        "tmL": ltm, "tmR": rtm, "tmP": ptm,
                        "worst": worst, "worstLabel": wl,
                        "prod": prod, "pen": round(base, 3),
                    }))
    out.sort(key=lambda x: (x[0], -x[1]))
    return json.dumps([o[2] for o in out[: d["top"]]])

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
