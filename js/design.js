window.DESIGN = (function () {
  const MODULE_URL = new URL("primer3-wasm/dist/primer3.js", document.baseURI).href;

  const PARAM_SETS = {
    default: {},
    // our config, primer3web v4 base plus tuning
    custom: {
      PRIMER_TASK: "generic",
      PRIMER_NUM_RETURN: "30",
      PRIMER_PICK_ANYWAY: "1",
      PRIMER_EXPLAIN_FLAG: "1",
      PRIMER_MIN_THREE_PRIME_DISTANCE: "3",
      PRIMER_PRODUCT_SIZE_RANGE: "80-200",
      // primers size tm gc
      PRIMER_MIN_SIZE: "18",
      PRIMER_OPT_SIZE: "20",
      PRIMER_MAX_SIZE: "27",
      PRIMER_MIN_TM: "57",
      PRIMER_OPT_TM: "59",
      PRIMER_MAX_TM: "62",
      PRIMER_PAIR_MAX_DIFF_TM: "5",
      PRIMER_MIN_GC: "30",
      PRIMER_MAX_GC: "70",
      PRIMER_MAX_POLY_X: "4",
      PRIMER_MAX_NS_ACCEPTED: "0",
      PRIMER_GC_CLAMP: "0",
      PRIMER_MAX_END_STABILITY: "9.0",
      // tm model and salt
      PRIMER_TM_FORMULA: "1",
      PRIMER_SALT_CORRECTIONS: "1",
      PRIMER_SALT_MONOVALENT: "50",
      PRIMER_SALT_DIVALENT: "1.5",
      PRIMER_DNTP_CONC: "0.6",
      PRIMER_DNA_CONC: "50",
      // secondary structure filters
      PRIMER_THERMODYNAMIC_OLIGO_ALIGNMENT: "1",
      PRIMER_THERMODYNAMIC_TEMPLATE_ALIGNMENT: "0",
      PRIMER_MAX_SELF_ANY_TH: "45",
      PRIMER_MAX_SELF_END_TH: "35",
      PRIMER_PAIR_MAX_COMPL_ANY_TH: "45",
      PRIMER_PAIR_MAX_COMPL_END_TH: "35",
      PRIMER_MAX_HAIRPIN_TH: "24",
      PRIMER_MAX_SELF_ANY: "8",
      PRIMER_MAX_SELF_END: "3",
      PRIMER_PAIR_MAX_COMPL_ANY: "8",
      PRIMER_PAIR_MAX_COMPL_END: "3",
      PRIMER_MAX_TEMPLATE_MISPRIMING_TH: "40",
      PRIMER_PAIR_MAX_TEMPLATE_MISPRIMING_TH: "70",
      PRIMER_MAX_TEMPLATE_MISPRIMING: "12",
      PRIMER_PAIR_MAX_TEMPLATE_MISPRIMING: "24",
      PRIMER_MAX_LIBRARY_MISPRIMING: "12",
      PRIMER_PAIR_MAX_LIBRARY_MISPRIMING: "20",
      // taqman probe
      PRIMER_INTERNAL_MIN_SIZE: "18",
      PRIMER_INTERNAL_OPT_SIZE: "20",
      PRIMER_INTERNAL_MAX_SIZE: "27",
      PRIMER_INTERNAL_MIN_TM: "57",
      PRIMER_INTERNAL_OPT_TM: "60",
      PRIMER_INTERNAL_MAX_TM: "63",
      PRIMER_INTERNAL_MIN_GC: "20",
      PRIMER_INTERNAL_MAX_GC: "80",
      PRIMER_INTERNAL_MAX_POLY_X: "5",
      PRIMER_INTERNAL_MAX_NS_ACCEPTED: "0",
      PRIMER_INTERNAL_MAX_SELF_ANY: "12",
      PRIMER_INTERNAL_MAX_SELF_END: "12",
      PRIMER_INTERNAL_SALT_MONOVALENT: "50",
      PRIMER_INTERNAL_SALT_DIVALENT: "1.5",
      PRIMER_INTERNAL_DNTP_CONC: "0",
      PRIMER_INTERNAL_DNA_CONC: "50",
    },
  };

  // relaxed widening applied on top when the relaxed toggle is on
  const RELAXED = {
    PRIMER_MIN_TM: "54",
    PRIMER_MAX_TM: "66",
    PRIMER_MIN_SIZE: "17",
    PRIMER_MAX_SIZE: "30",
    PRIMER_MIN_GC: "25",
    PRIMER_MAX_GC: "80",
    PRIMER_MAX_POLY_X: "5",
    PRIMER_INTERNAL_MIN_TM: "54",
    PRIMER_INTERNAL_MAX_TM: "68",
    PRIMER_INTERNAL_MIN_SIZE: "17",
    PRIMER_INTERNAL_MAX_SIZE: "30",
  };

  let designFn = null;
  let loading = null;
  let lastCands = null; 

  const cache = { default: null, custom: null, relaxed: null };

  function status(msg) {
    const el = document.getElementById("design-status");
    if (el) el.textContent = msg;
  }

  function load() {
    if (loading) return loading;
    loading = import(MODULE_URL)
      .then((m) => {
        designFn = m.design;
      })
      .catch((e) => {
        console.error("[design] primer3 load failed:", e);
        throw e;
      });
    return loading;
  }

  function clean(seq) {
    return (seq || "").toUpperCase().replace(/[^ACGT]/g, "");
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function fmt(x) {
    return x === null ? "—" : (x > 0 ? "+" : "") + x.toFixed(1);
  }

  function currentMode() {
    const el = document.querySelector("#design-mode button:not(.btn-secondary)");
    return el ? el.dataset.mode : "custom";
  }
  // show a short note only when relaxed mode is active
  function updateModeHint() {
    const el = document.getElementById("design-mode-hint");
    if (!el) return;
    if (currentMode() === "relaxed") {
      el.textContent =
        "Relaxed widens the primer3 ranges (primers Tm 54-66, size 17-30, GC 25-80, poly-X 5; probe Tm 54-68, size 17-30) to find candidates when flare returns none. Thermo scoring is unchanged.";
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  }

  function inputKey() {
    const seq = clean(document.getElementById("design-seq").value);
    const ex = (document.getElementById("design-excluded").value || "").trim();
    const bp = (document.getElementById("design-breakpoint").value || "").trim();
    return seq + " | " + ex + " | " + bp;
  }
  function currentDelta() {
    const d = parseFloat(document.getElementById("design-delta").value);
    return isNaN(d) ? -4 : d;
  }

  function parseExcluded(s) {
    const out = [];
    const re = /(\d+)\s*,\s*(\d+)/g;
    let m;
    while ((m = re.exec(s || ""))) {
      const start = parseInt(m[1], 10);
      const len = parseInt(m[2], 10);
      if (len > 0) out.push({ start, end: start + len - 1 });
    }
    return out;
  }

  function renderHighlight() {
    const ta = document.getElementById("design-seq");
    const bd = document.getElementById("design-seq-bd");
    if (!ta || !bd) return;
    const ranges = parseExcluded(document.getElementById("design-excluded").value);
    const bpEl = document.getElementById("design-breakpoint");
    const bp = bpEl ? parseInt(bpEl.value, 10) : NaN;
    const hasBp = !isNaN(bp) && bp > 0;
    let html = "";
    let base = 0;
    let openCls = null;
    for (const ch of ta.value) {
      const isBase = /[ACGTacgt]/.test(ch);
      let cls = null;
      if (isBase) {
        base++;
        if (hasBp && base >= bp && base <= bp + 1) cls = "bp";
        else if (ranges.some((r) => base >= r.start && base <= r.end)) cls = "ex";
      }
      if (cls !== openCls) {
        if (openCls) html += "</mark>";
        if (cls) html += cls === "bp" ? '<mark class="bp">' : "<mark>";
        openCls = cls;
      }
      html +=
        ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
    }
    if (openCls) html += "</mark>";
    bd.innerHTML = html + "\n";
    bd.scrollTop = ta.scrollTop;
    bd.scrollLeft = ta.scrollLeft;
  }

  function buildInput(seq, excluded, breakpoint, mode) {
    const params = {
      SEQUENCE_ID: "flare-design",
      SEQUENCE_TEMPLATE: seq,
      PRIMER_PICK_LEFT_PRIMER: "1",
      PRIMER_PICK_INTERNAL_OLIGO: "1",
      PRIMER_PICK_RIGHT_PRIMER: "1",
      PRIMER_NUM_RETURN: "50",
      PRIMER_PRODUCT_SIZE_RANGE: "70-200",
      PRIMER_THERMODYNAMIC_PARAMETERS_PATH: "primer3_config/",
      PRIMER_FIRST_BASE_INDEX: "1",
    };
    if (excluded) params.SEQUENCE_EXCLUDED_REGION = excluded;
    // breakpoint sets the target and keeps the probe off the junction
    const bp = parseInt(breakpoint, 10);
    if (!isNaN(bp) && bp > 0) {
      params.SEQUENCE_TARGET = bp + ",2";
      params.SEQUENCE_INTERNAL_EXCLUDED_REGION =
        bp + ",2" + (excluded ? " " + excluded : "");
    }
    // relaxed = custom params plus widened ranges
    Object.assign(params, PARAM_SETS[mode === "relaxed" ? "custom" : mode] || {});
    if (mode === "relaxed") Object.assign(params, RELAXED);
    const lines = Object.entries(params).map(([k, v]) => k + "=" + v);
    lines.push("=");
    return lines.join("\n") + "\n";
  }

  function parse(out) {
    const map = {};
    for (const line of out.split(/\n/)) {
      const i = line.indexOf("=");
      if (i <= 0) continue;
      map[line.slice(0, i)] = line.slice(i + 1);
    }
    return map;
  }

  function candidates(map) {
    const n = parseInt(map.PRIMER_PAIR_NUM_RETURNED || "0", 10);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        L: map[`PRIMER_LEFT_${i}_SEQUENCE`] || "",
        R: map[`PRIMER_RIGHT_${i}_SEQUENCE`] || "",
        P: map[`PRIMER_INTERNAL_${i}_SEQUENCE`] || "",
        tmL: map[`PRIMER_LEFT_${i}_TM`],
        tmR: map[`PRIMER_RIGHT_${i}_TM`],
        tmP: map[`PRIMER_INTERNAL_${i}_TM`],
      });
    }
    return out;
  }

  async function scoreThermo(cands) {
    const py = await window.flareEngine.load();
    const run = py.globals.get("_run");
    const LABEL = { left: "Left", right: "Right", probe: "Probe" };
    for (const c of cands) {
      const res = JSON.parse(run(c.L, c.R, c.P || ""));
      const checks = [];
      for (const k of Object.keys(res.oligos)) {
        checks.push([`self (${LABEL[k] || k})`, res.oligos[k].self_dimer_dG_kcal]);
        checks.push([`hairpin (${LABEL[k] || k})`, res.oligos[k].hairpin_dG_kcal]);
      }
      for (const key of Object.keys(res.cross_dimers)) {
        checks.push([`cross (${key})`, res.cross_dimers[key]]);
      }
      let worst = null;
      let worstLabel = "";
      for (const [name, dg] of checks) {
        if (worst === null || dg < worst) {
          worst = dg;
          worstLabel = name;
        }
      }
      c.worst = worst;
      c.worstLabel = worstLabel;
    }
  }

  function render(pool, delta) {
    const out = document.getElementById("design-results");
    if (!pool.length) {
      out.innerHTML = '<p class="err">No primer pair found for this template.</p>';
      return;
    }
    const passing = pool.filter((c) => c.worst !== null && c.worst >= delta);
    if (!passing.length) {
      out.innerHTML =
        `<p class="err">No thermo-ok candidate: every design has ΔG &lt; ${delta}. ` +
        "Loosen the ΔG threshold, try relaxed, or switch parameter set.</p>";
      return;
    }
    const MAX_SHOW = 10;
    const shown = passing.slice(0, MAX_SHOW);
    let html =
      `<h2>${passing.length} thermo-ok candidate${passing.length === 1 ? "" : "s"} ` +
      `(ΔG &ge; ${delta})${passing.length > shown.length ? `, showing ${shown.length}` : ""}</h2>`;
    shown.forEach((c, i) => {
      const rows = [
        ["Left", c.L, c.tmL],
        ["Right", c.R, c.tmR],
        ["Probe", c.P, c.tmP],
      ];
      html += '<div class="cand">';
      html +=
        `<div class="cand-head"><span class="cand-n">#${i + 1}</span>` +
        `<span class="verdict ok">ΔG ${fmt(c.worst)}</span>` +
        `<span class="muted">limiting: ${esc(c.worstLabel)}</span></div>`;
      html +=
        '<table class="cand-tbl"><thead><tr><th>Oligo</th><th>Sequence</th>' +
        "<th>Len</th><th>Tm</th></tr></thead><tbody>";
      for (const r of rows) {
        html +=
          `<tr><td>${r[0]}</td><td class="seq">${esc(r[1] || "—")}</td>` +
          `<td>${r[1] ? r[1].length : "—"}</td>` +
          `<td>${r[2] ? Number(r[2]).toFixed(1) : "—"}</td></tr>`;
      }
      html += "</tbody></table></div>";
    });
    out.innerHTML = html;
  }

  function rerenderVerdicts() {
    if (!lastCands) return;
    const d = parseFloat(document.getElementById("design-delta").value);
    render(lastCands, isNaN(d) ? -4 : d);
  }

  function attachScrub(el) {
    const PX_PER_STEP = 5;
    let startY = 0, startVal = 0, dragging = false, moved = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startY = e.clientY;
      startVal = parseFloat(el.value) || 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add("scrubbing");
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = startY - e.clientY;
      if (Math.abs(dy) > 2) moved = true;
      const step = parseFloat(el.step) || 1;
      let next = startVal + Math.round(dy / PX_PER_STEP) * step;
      const min = parseFloat(el.min);
      if (!isNaN(min)) next = Math.max(min, next);
      const dec = String(el.step).indexOf(".") >= 0 ? 1 : 0;
      const str = next.toFixed(dec);
      if (str !== el.value) {
        el.value = str;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      e.preventDefault();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("scrubbing");
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      if (moved) el.blur();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  // let the browser paint before heavy work
  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => r()));
  }
  function progress(msg) {
    const p = document.getElementById("design-progress");
    if (p) p.textContent = msg;
    status(msg);
  }

  async function run() {
    const seq = clean(document.getElementById("design-seq").value);
    const excluded = (document.getElementById("design-excluded").value || "").trim();
    const breakpoint = (document.getElementById("design-breakpoint").value || "").trim();
    const out = document.getElementById("design-results");
    const btn = document.getElementById("design-run");
    if (seq.length < 50) {
      out.innerHTML =
        '<p class="err">Provide a template of at least ~50 nt (A/C/G/T).</p>';
      return;
    }
    const mode = currentMode();
    const key = inputKey();
    // same mode and inputs so just show cached, no recompute
    const cached = cache[mode];
    if (cached && cached.key === key) {
      lastCands = cached.cands;
      render(lastCands, currentDelta());
      return;
    }
    if (btn) btn.disabled = true;
    out.innerHTML =
      '<div class="loading"><span class="spinner"></span>' +
      '<span id="design-progress">Designing…</span></div>';
    try {
      await load();
      await nextFrame();
      const map = parse(await designFn(buildInput(seq, excluded, breakpoint, mode)));
      if (map.PRIMER_ERROR) {
        out.innerHTML = '<p class="err">' + esc(map.PRIMER_ERROR) + "</p>";
        return;
      }
      const cands = candidates(map);
      if (cands.length) {
        progress("Scoring " + cands.length + " candidates with flare…");
        await nextFrame();
        await scoreThermo(cands);
      }
      cache[mode] = { key, cands };
      lastCands = cands;
      render(cands, currentDelta());
    } catch (e) {
      out.innerHTML = '<p class="err">' + esc(e && e.message ? e.message : e) + "</p>";
    } finally {
      if (btn) btn.disabled = false;
      status("");
    }
  }

  function mount() {
    const btn = document.getElementById("design-run");
    if (!btn) return;

    const segs = document.querySelectorAll("#design-mode button");
    for (const b of segs) {
      b.addEventListener("click", () => {
        if (!b.classList.contains("btn-secondary")) return; // already active
        for (const o of segs) o.classList.toggle("btn-secondary", o !== b);
        updateModeHint();
        // show cached result if inputs match, else hide
        const out = document.getElementById("design-results");
        const c = cache[currentMode()];
        if (c && c.key === inputKey()) {
          lastCands = c.cands;
          render(lastCands, currentDelta());
        } else {
          lastCands = null;
          if (out) out.innerHTML = "";
        }
      });
    }

    updateModeHint();

    // highlight excluded in yellow and breakpoint in orange
    const ta = document.getElementById("design-seq");
    const bd = document.getElementById("design-seq-bd");
    const ex = document.getElementById("design-excluded");
    const bpInput = document.getElementById("design-breakpoint");
    if (ta && bd) {
      ta.addEventListener("input", renderHighlight);
      ta.addEventListener("scroll", () => {
        bd.scrollTop = ta.scrollTop;
        bd.scrollLeft = ta.scrollLeft;
      });
      if (ex) ex.addEventListener("input", renderHighlight);
      if (bpInput) bpInput.addEventListener("input", renderHighlight);
      renderHighlight();
    }

    // dG filter, drag like multiplex and refresh verdicts live
    const delta = document.getElementById("design-delta");
    if (delta) {
      attachScrub(delta);
      delta.addEventListener("change", rerenderVerdicts);
      delta.addEventListener("input", rerenderVerdicts);
    }
    status("Loading primer3…");
    load()
      .then(() => {
        btn.disabled = false;
        status("");
      })
      .catch((e) => status("Failed to load primer3: " + (e.message || e)));

    btn.addEventListener("click", run);
  }

  return { mount };
})();
