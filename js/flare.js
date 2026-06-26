// flare page logic. Pyodide loads once; mount() wires the form on each visit.
window.FLARE = (function () {
  let runAssay = null;
  let ready = false;
  let errorMsg = null;

  async function loadEngine() {
    try {
      const py = await window.flareEngine.load();
      runAssay = py.globals.get("_run");
      ready = true;
    } catch (e) {
      errorMsg = e.message;
    }
    syncStatus();
  }

  // Only touch flare elements when the flare page is mounted.
  function syncStatus() {
    const page = document.getElementById("flare-page");
    if (!page) return;
    const statusEl = document.getElementById("status");
    const runBtn = document.getElementById("run");
    if (errorMsg) {
      statusEl.textContent = "Error: " + errorMsg;
      return;
    }
    if (ready) {
      statusEl.textContent = "";
      runBtn.disabled = false;
    } else {
      statusEl.textContent = "Loading flare…";
      runBtn.disabled = true;
    }
  }

  function clean(seq) {
    return (seq || "").toUpperCase().replace(/[^ACGT]/g, "");
  }
  function fmt(x) {
    return (x > 0 ? "+" : "") + x.toFixed(1);
  }

  function render(res, threshold) {
    const resultsEl = document.getElementById("results");
    const oligos = res.oligos;
    const cross = res.cross_dimers;
    const isFail = (dg) => dg <= threshold;
    const labels = { left: "Left primer", right: "Right primer", probe: "Probe" };
    const order = ["left", "right", "probe"].filter((k) => oligos[k]);

    let html =
      "<h2>Oligos</h2><table><thead><tr>" +
      "<th>Oligo</th><th>Sequence</th><th>Len</th><th>Tm (°C)</th><th>GC %</th>" +
      "<th>GC clamp</th><th>Self-dimer ΔG</th><th>Hairpin ΔG</th></tr></thead><tbody>";
    for (const k of order) {
      const d = oligos[k];
      html +=
        `<tr><td>${labels[k]}</td><td class="seq">${d.sequence}</td>` +
        `<td>${d.length}</td><td>${d.tm_C.toFixed(1)}</td><td>${d.gc_pct.toFixed(1)}</td>` +
        `<td>${d.gc_clamp}</td>` +
        `<td class="${isFail(d.self_dimer_dG_kcal) ? "fail" : ""}">${fmt(d.self_dimer_dG_kcal)}</td>` +
        `<td class="${isFail(d.hairpin_dG_kcal) ? "fail" : ""}">${fmt(d.hairpin_dG_kcal)}</td></tr>`;
    }
    html += "</tbody></table>";

    const crossKeys = Object.keys(cross);
    if (crossKeys.length) {
      html +=
        "<h2>Cross-dimers</h2><table><thead><tr><th>Pair</th><th>ΔG (kcal/mol)</th></tr></thead><tbody>";
      for (const key of crossKeys) {
        const dg = cross[key];
        html += `<tr><td>${key}</td><td class="${isFail(dg) ? "fail" : ""}">${fmt(dg)}</td></tr>`;
      }
      html += "</tbody></table>";
    }

    const checks = [];
    for (const k of order) {
      checks.push([`${labels[k]} self-dimer`, oligos[k].self_dimer_dG_kcal]);
      checks.push([`${labels[k]} hairpin`, oligos[k].hairpin_dG_kcal]);
    }
    for (const key of crossKeys) checks.push([key, cross[key]]);

    const failed = checks.filter(([, dg]) => isFail(dg)).map(([n]) => n);
    if (failed.length === 0) {
      html += `<p class="verdict ok">PASS (all ΔG > ${threshold})</p>`;
    } else {
      html += `<p class="verdict ko">FAIL (ΔG ≤ ${threshold}): ${failed.join(", ")}</p>`;
    }

    resultsEl.innerHTML = html;
  }

  // Wire the freshly injected flare fragment.
  function mount() {
    syncStatus();
    const resultsEl = document.getElementById("results");

    document.getElementById("form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!runAssay) return;
      const left = clean(document.getElementById("left").value);
      const right = clean(document.getElementById("right").value);
      const probe = clean(document.getElementById("probe").value);
      const threshold = parseFloat(document.getElementById("threshold").value);
      if (!left && !right && !probe) {
        resultsEl.innerHTML = '<p class="err">Enter at least one sequence.</p>';
        return;
      }
      const res = JSON.parse(runAssay(left, right, probe));
      render(res, threshold);
    });

    document.getElementById("reset").addEventListener("click", () => {
      for (const id of ["left", "right", "probe"]) {
        const el = document.getElementById(id);
        el.value = "";
        el.dispatchEvent(new Event("input"));
      }
      resultsEl.innerHTML = "";
    });
  }

  loadEngine();
  return { mount };
})();
