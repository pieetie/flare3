window.MULTIPLEX = (function () {
  const COMP = { A: "T", T: "A", G: "C", C: "G" };

  // flare calibrated stacking dG37 per nearest-neighbor step (kcal/mol)
  const DG37_RAW = {
    AA: -1.1370, AT: -0.9730, TA: -0.7130, CA: -1.5870, GT: -1.5730,
    CT: -1.3955, GA: -1.4430, CG: -2.3500, GC: -2.3830, GG: -1.9250,
  };
  const DIMER_INIT = 1.87;
  const DIMER_AT_PENALTY = 0.1455;
  const DIMER_MIN_RUN = 3;
  const ANCHOR_3P = 2;  // run within this many bases of a 3' end = "end" binding

  function revcomp(s) {
    let o = "";
    for (let i = s.length - 1; i >= 0; i--) o += COMP[s[i]];
    return o;
  }
  const DG37 = Object.assign({}, DG37_RAW);
  for (const k in DG37_RAW) {
    const rc = revcomp(k);
    if (!(rc in DG37)) DG37[rc] = DG37_RAW[k];
  }

  function runDG(run) {
    if (run.length < DIMER_MIN_RUN) return null;
    let g = DIMER_INIT;
    for (let k = 0; k < run.length - 1; k++) g += DG37[run.substr(k, 2)];
    g += DIMER_AT_PENALTY * ((run[0] === "A" || run[0] === "T") +
      (run[run.length - 1] === "A" || run[run.length - 1] === "T"));
    return g;
  }

  // Most stable complementary duplex between a (5'->3') and b, split by where
  // the binding sits: {end, mid} dG (0 = none), end = anchored at a 3' terminus
  function crossPair(a, b) {
    const br = b.split("").reverse().join("");
    const na = a.length, nb = br.length;
    let mid = 0, end = 0;
    for (let d = -(nb - 1); d < na; d++) {
      let j = 0;
      while (j < nb) {
        const i = j + d;
        if (i >= 0 && i < na && COMP[br[j]] === a[i]) {
          const js = j;
          let run = "";
          while (j < nb && j + d >= 0 && j + d < na && COMP[br[j]] === a[j + d]) {
            run += a[j + d];
            j++;
          }
          const aHi = j - 1 + d;
          const g = runDG(run);
          if (g !== null) {
            const anchored = aHi >= na - ANCHOR_3P || js <= ANCHOR_3P - 1;
            if (anchored) { if (g < end) end = g; }
            else if (g < mid) mid = g;
          }
        } else j++;
      }
    }
    const dg = Math.min(mid, end);
    return { mid: r1(mid), end: r1(end), dg: r1(dg) };
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  function parseSeqs(text) {
    const out = [];
    for (const raw of text.split(/\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(\S+)\s+([ACGTacgt\s]+)$/);
      if (!m) continue;
      const seq = m[2].toUpperCase().replace(/[^ACGT]/g, "");
      if (seq) out.push({ name: m[1], seq });
    }
    return out;
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function thr(id, def) {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? def : v;
  }

  function compute(oligos) {
    const n = oligos.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(null));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const p = crossPair(oligos[i].seq, oligos[j].seq);
        M[i][j] = M[j][i] = p;
      }
    return M;
  }

  function fails(p, tMid, tEnd) {
    return (p.end < 0 && p.end <= tEnd) || (p.mid < 0 && p.mid <= tMid);
  }

  function toCSV(oligos, M) {
    const names = oligos.map((o) => o.name);
    const lines = ["," + names.join(",")];
    for (let i = 0; i < oligos.length; i++) {
      const row = [oligos[i].name];
      for (let j = 0; j < oligos.length; j++) row.push(i === j ? "" : M[i][j].dg.toFixed(1));
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }

  const DL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="m4,7h3c.552,0,1-.448,1-1v-3" stroke="currentColor" stroke-linejoin="round" stroke-width="2" fill="currentColor"></path><line x1="15" y1="17" x2="15" y2="11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><path d="m16,7.663v-1.663c0-1.657-1.343-3-3-3h-4.586c-.265,0-.52.105-.707.293l-3.414,3.414c-.188.188-.293.442-.293.707v6.586c0,1.657,1.343,3,3,3h3.05l-.025-.025" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><polyline points="12.5 14.5 15 17 17.5 14.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polyline></svg>';

  function render(oligos) {
    const out = document.getElementById("mux-results");
    const tMid = thr("thr-mid", -4), tEnd = thr("thr-end", -4);
    const M = compute(oligos);
    const n = oligos.length;

    // failing pairs
    const bad = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (fails(M[i][j], tMid, tEnd))
          bad.push({ a: oligos[i].name, b: oligos[j].name, p: M[i][j] });
    bad.sort((x, y) => x.p.dg - y.p.dg);

    let html = `<h2>Failing cross-dimers (mid ≤ ${tMid}, 3' end ≤ ${tEnd})</h2>`;
    if (bad.length) {
      html += `<p class="muted">${bad.length} pair${bad.length === 1 ? "" : "s"} above threshold.</p>`;
      html += '<ul class="fail-list">' + bad.map((x) => {
        const tag = (x.p.end < 0 && x.p.end <= tEnd) ? "3'" : "mid";
        return `<li>${esc(x.a)} - ${esc(x.b)} <span class="dimer-dg">(${x.p.dg.toFixed(1)}, ${tag})</span></li>`;
      }).join("") + "</ul>";
    } else {
      html += '<p class="muted">None above threshold.</p>';
    }

    html += `<h2>Cross-dimer ΔG matrix (${n}×${n}, flare) ` +
      `<button id="mux-dl" class="icon-btn" type="button" title="Download CSV" aria-label="Download CSV">${DL_ICON}</button></h2>`;
    html += '<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>';
    for (const o of oligos) html += `<th>${esc(o.name)}</th>`;
    html += "</tr></thead><tbody>";
    for (let i = 0; i < n; i++) {
      html += `<tr><th>${esc(oligos[i].name)}</th>`;
      for (let j = 0; j < n; j++) {
        if (i === j) { html += '<td class="diag"></td>'; continue; }
        const p = M[i][j];
        const cls = fails(p, tMid, tEnd) ? "bad" : "";
        html += `<td class="${cls}">${p.dg.toFixed(1)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    out.innerHTML = html;

    const dl = document.getElementById("mux-dl");
    if (dl) dl.addEventListener("click", () => {
      const csv = toCSV(oligos, M);
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      a.download = "cross_dimer_matrix.csv";
      a.click();
    });
  }

  function mount() {
    const btn = document.getElementById("mux-run");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const oligos = parseSeqs(document.getElementById("seqs").value);
      if (oligos.length < 2) {
        document.getElementById("mux-results").innerHTML =
          '<p class="err">Enter at least 2 oligos (name sequence per line).</p>';
        return;
      }
      render(oligos);
    });
  }

  return { mount };
})();
