window.MULTIPLEX = (function () {
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
  function fails(p, tMid, tEnd) {
    return (p.end < 0 && p.end <= tEnd) || (p.mid < 0 && p.mid <= tMid);
  }
  function svOf(name) {
    return name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  }
  function svNum(s) { const m = s.match(/(\d+)/); return m ? +m[1] : 0; }
  function oligoNum(s) { const m = s.match(/\.(\d+)/); return m ? +m[1] : 0; }

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

  function paint(oligos, M) {
    const out = document.getElementById("mux-results");
    const tMid = thr("thr-mid", -4), tEnd = thr("thr-end", -4);
    const n = oligos.length;

    const bad = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        if (svOf(oligos[i].name) === svOf(oligos[j].name)) continue;
        if (fails(M[i][j], tMid, tEnd))
          bad.push({ a: oligos[i].name, b: oligos[j].name, p: M[i][j] });
      }
    bad.sort((x, y) => x.p.dg - y.p.dg);

    let html = `<h2>Failing cross-dimers (mid ≤ ${tMid}, 3' end ≤ ${tEnd})</h2>`;
    if (bad.length) {
      const tree = new Map();
      const addEntry = (self, other, p) => {
        const sv = svOf(self);
        if (!tree.has(sv)) tree.set(sv, new Map());
        const m = tree.get(sv);
        if (!m.has(self)) m.set(self, []);
        m.get(self).push({ other, p });
      };
      for (const x of bad) { addEntry(x.a, x.b, x.p); addEntry(x.b, x.a, x.p); }

      const svs = [...tree.keys()].sort((p, q) => svNum(p) - svNum(q));
      html += `<p class="muted">${bad.length} pair${bad.length === 1 ? "" : "s"} above threshold.</p>`;
      html += '<ul class="tree">';
      for (const sv of svs) {
        const oligos = [...tree.get(sv).keys()].sort((p, q) => oligoNum(p) - oligoNum(q));
        const svCount = oligos.reduce((s, o) => s + tree.get(sv).get(o).length, 0);
        html += `<li class="node"><div class="node-head"><span class="tri"></span>${esc(sv)} ` +
          `<span class="dimer-dg">${svCount}</span></div><ul class="node-body">`;
        for (const ol of oligos) {
          const pairs = tree.get(sv).get(ol).sort((p, q) => p.p.dg - q.p.dg);
          html += `<li class="node"><div class="node-head"><span class="tri"></span>${esc(ol)} ` +
            `<span class="dimer-dg">${pairs.length}</span></div><ul class="node-body">`;
          for (const { other, p } of pairs) {
            const tag = (p.end < 0 && p.end <= tEnd) ? "3'" : "mid";
            html += `<li class="node"><div class="node-head"><span class="tri"></span>` +
              `${esc(ol)} - ${esc(other)} <span class="dimer-dg">(${p.dg.toFixed(1)}, ${tag})</span></div>` +
              `<pre class="fail-struct">${esc(p.ascii || "")}</pre></li>`;
          }
          html += "</ul></li>";
        }
        html += "</ul></li>";
      }
      html += "</ul>";
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
        html += `<td class="${fails(p, tMid, tEnd) ? "bad" : ""}">${p.dg.toFixed(1)}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    out.innerHTML = html;

    for (const head of out.querySelectorAll(".tree .node-head")) {
      head.addEventListener("click", (e) => {
        e.stopPropagation();
        head.parentElement.classList.toggle("open");
      });
    }
    const dl = document.getElementById("mux-dl");
    if (dl) dl.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(toCSV(oligos, M));
      a.download = "cross_dimer_matrix.csv";
      a.click();
    });
  }

  let lastOligos = null, lastM = null;

  async function compute(oligos) {
    const out = document.getElementById("mux-results");
    out.innerHTML = '<p class="muted">Loading flare…</p>';
    let py;
    try {
      py = await window.flareEngine.load();
    } catch (e) {
      out.innerHTML = '<p class="err">flare engine failed: ' + esc(e.message) + "</p>";
      return;
    }
    const seqs = oligos.map((o) => o.seq);
    const res = JSON.parse(py.globals.get("_crossmatrix")(JSON.stringify(seqs)));
    const n = oligos.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(null));
    for (const [i, j, mid, end, dg, ascii] of res) {
      M[i][j] = { mid, end, dg, ascii };
      M[j][i] = { mid, end, dg, ascii };
    }
    lastOligos = oligos; lastM = M;
    paint(oligos, M);
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
      compute(oligos);
    });
    // re-threshold without recompute when the inputs change
    for (const id of ["thr-mid", "thr-end"]) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => { if (lastM) paint(lastOligos, lastM); });
    }
  }

  return { mount };
})();
