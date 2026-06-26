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

  let lastOligos = null, lastM = null, lastKey = null, lastView = "matrix";

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svConflicts(oligos, M, tMid, tEnd) {
    const svList = [];
    const idx = new Map();
    for (const o of oligos) {
      const sv = svOf(o.name);
      if (!idx.has(sv)) { idx.set(sv, 0); svList.push(sv); }
    }
    svList.sort((p, q) => svNum(p) - svNum(q));
    idx.clear();
    svList.forEach((s, i) => idx.set(s, i));
    const m = svList.length;
    const conf = Array.from({ length: m }, () => new Array(m).fill(false));
    const worst = new Map();
    const n = oligos.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const sa = svOf(oligos[i].name), sb = svOf(oligos[j].name);
        if (sa === sb || !fails(M[i][j], tMid, tEnd)) continue;
        const x = idx.get(sa), y = idx.get(sb);
        conf[x][y] = conf[y][x] = true;
        const key = x < y ? x + "|" + y : y + "|" + x;
        const rec = { a: oligos[i].name, b: oligos[j].name, p: M[i][j] };
        const cur = worst.get(key);
        if (!cur || rec.p.dg < cur.p.dg) worst.set(key, rec);
      }
    return { svList, conf, worst };
  }

  function degrees(m, conf) {
    const d = new Array(m).fill(0);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (conf[i][j]) d[i]++;
    return d;
  }
  // place s into the most-filled compatible non-full bin; -1 if none
  function fitBin(bins, conf, s, size) {
    let cand = -1, fill = -1;
    for (let b = 0; b < bins.length; b++) {
      if (bins[b].length >= size || bins[b].some((q) => conf[s][q])) continue;
      if (bins[b].length > fill) { fill = bins[b].length; cand = b; }
    }
    return cand;
  }

  // A group "passes" as long as it holds no failing cross-dimer 
  // Mode A : fixed K = ceil(m/size) groups, maximize placed, drop the rest
  function packFixed(m, conf, size) {
    const K = Math.max(1, Math.ceil(m / size));
    const deg = degrees(m, conf);
    const byHard = [...Array(m).keys()].sort((a, b) => deg[b] - deg[a]);
    const rnd = mulberry32(12345);
    let best = null;
    for (let r = 0; r < 3000; r++) {
      const order = r === 0 ? byHard.slice() : shuffle([...Array(m).keys()], rnd);
      const bins = Array.from({ length: K }, () => []);
      let placed = 0;
      for (const s of order) {
        const b = fitBin(bins, conf, s, size);
        if (b >= 0) { bins[b].push(s); placed++; }
      }
      const nonEmpty = bins.filter((b) => b.length).length;
      if (!best || placed > best.placed || (placed === best.placed && nonEmpty < best.nonEmpty)) {
        best = { placed, nonEmpty, groups: bins.filter((b) => b.length).map((b) => b.slice()) };
      }
      if (best.placed === m) break;
    }
    const used = new Set(best.groups.flat());
    best.dropped = [...Array(m).keys()].filter((i) => !used.has(i));
    return best;
  }

  // Mode B : place everyone, minimize the number of groups (extra reactions ok)
  function packGrowing(m, conf, size) {
    const deg = degrees(m, conf);
    const byHard = [...Array(m).keys()].sort((a, b) => deg[b] - deg[a]);
    const rnd = mulberry32(12345);
    let best = null;
    for (let r = 0; r < 3000; r++) {
      const order = r === 0 ? byHard.slice() : shuffle([...Array(m).keys()], rnd);
      const bins = [];
      for (const s of order) {
        const b = fitBin(bins, conf, s, size);
        if (b >= 0) bins[b].push(s);
        else bins.push([s]);
      }
      if (!best || bins.length < best.groups.length) best = { groups: bins.map((b) => b.slice()) };
    }
    best.dropped = [];
    return best;
  }

  function paintGroups(oligos, M) {
    const out = document.getElementById("mux-results");
    const tMid = thr("thr-mid", -4), tEnd = thr("thr-end", -4);
    let size = parseInt(document.getElementById("grp-size").value, 10);
    if (!(size >= 2)) size = 5;
    const { svList, conf, worst } = svConflicts(oligos, M, tMid, tEnd);
    if (svList.length < 2) {
      out.innerHTML = '<p class="err">Need at least 2 named groups (e.g. Seq1.1, Seq2.1).</p>';
      return;
    }
    const avoidEl = document.getElementById("grp-avoid");
    const avoid = avoidEl && avoidEl.checked;
    const sol = avoid ? packGrowing(svList.length, conf, size)
                      : packFixed(svList.length, conf, size);
    const placed = svList.length - sol.dropped.length;

    let html = `<h2>Groups (≤ ${size})</h2>`;
    html += `<p class="muted">${sol.groups.length} group${sol.groups.length === 1 ? "" : "s"}` +
      ` (${placed}/${svList.length} placed` +
      (sol.dropped.length ? `, ${sol.dropped.length} to redesign).</p>` : ").</p>");

    sol.groups.forEach((g, gi) => {
      const members = g.map((u) => svList[u]);
      let wd = null;
      for (let i = 0; i < g.length; i++)
        for (let j = i + 1; j < g.length; j++) {
          const k = g[i] < g[j] ? g[i] + "|" + g[j] : g[j] + "|" + g[i];
          const rec = worst.get(k);
          if (rec && (wd === null || rec.p.dg < wd)) wd = rec.p.dg;
        }
      const note = wd === null ? "no failing cross-dimers" : `worst ΔG ${wd.toFixed(1)} (ok)`;
      html += `<div class="group"><div class="group-h">Group ${gi + 1} ` +
        `<span class="muted">${esc(members.join(", "))}</span></div>` +
        `<div class="group-sub muted">${note}</div></div>`;
    });

    if (sol.dropped.length) {
      html += "<h2>To redesign</h2>";
      for (const u of sol.dropped) {
        const sv = svList[u];
        const clashes = [];
        for (let v = 0; v < svList.length; v++) {
          if (v === u || !conf[u][v]) continue;
          const k = u < v ? u + "|" + v : v + "|" + u;
          clashes.push({ other: svList[v], rec: worst.get(k) });
        }
        clashes.sort((a, b) => a.rec.p.dg - b.rec.p.dg);
        html += `<div class="group"><div class="group-h">${esc(sv)} ` +
          `<span class="muted">clashes with ${clashes.length}</span></div>`;
        html += '<ul class="group-dimers">' + clashes.slice(0, 8).map((c) =>
          `<li>${esc(sv)} / ${esc(c.other)} - ${esc(c.rec.a)} ↔ ${esc(c.rec.b)} ` +
          `<span class="dimer-dg">ΔG ${c.rec.p.dg.toFixed(1)}</span></li>`).join("") + "</ul></div>";
      }
    }
    out.innerHTML = html;
  }

  async function ensure(oligos) {
    const key = JSON.stringify(oligos.map((o) => o.seq));
    if (lastM && key === lastKey) return lastM;
    const py = await window.flareEngine.load();
    const res = JSON.parse(py.globals.get("_crossmatrix")(JSON.stringify(oligos.map((o) => o.seq))));
    const n = oligos.length;
    const M = Array.from({ length: n }, () => new Array(n).fill(null));
    for (const [i, j, mid, end, dg, ascii] of res) {
      M[i][j] = { mid, end, dg, ascii };
      M[j][i] = { mid, end, dg, ascii };
    }
    lastKey = key; lastM = M; lastOligos = oligos;
    return M;
  }

  function rerender() {
    if (!lastM) return;
    if (lastView === "groups") paintGroups(lastOligos, lastM);
    else paint(lastOligos, lastM);
  }

  async function show(view) {
    const out = document.getElementById("mux-results");
    const oligos = parseSeqs(document.getElementById("seqs").value);
    if (oligos.length < 2) {
      out.innerHTML = '<p class="err">Enter at least 2 oligos (name sequence per line).</p>';
      return;
    }
    lastView = view;
    out.innerHTML = '<p class="muted">Loading flare…</p>';
    try {
      await ensure(oligos);
    } catch (e) {
      out.innerHTML = '<p class="err">flare engine failed: ' + esc(e.message) + "</p>";
      return;
    }
    rerender();
  }

  function mount() {
    const run = document.getElementById("mux-run");
    if (!run) return;
    run.addEventListener("click", () => show("matrix"));
    const grp = document.getElementById("mux-group");
    if (grp) grp.addEventListener("click", () => show("groups"));
    for (const id of ["thr-mid", "thr-end", "grp-size"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener("change", rerender);
      attachScrub(el);
    }
    const av = document.getElementById("grp-avoid");
    if (av) av.addEventListener("change", rerender);
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

  return { mount };
})();
