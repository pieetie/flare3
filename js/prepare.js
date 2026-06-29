window.PREPARE = (function () {
  const MIN = 10, MAX = 50;  // primer length window 

  function extract(text) {
    const rows = [];
    for (const raw of text.split(/\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const primers = [];
      for (const tok of line.split(/\s+/)) {
        const s = tok.toUpperCase();
        if (/^[ACGT]+$/.test(s) && s.length >= MIN && s.length <= MAX) primers.push(s);
      }
      rows.push(primers);
    }
    return rows;
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render(rows) {
    const out = document.getElementById("prep-results");
    if (!rows.length) {
      out.innerHTML = '<p class="err">Paste at least one row.</p>';
      return;
    }
    const lines = [];
    const warnings = [];
    rows.forEach((primers, i) => {
      const n = i + 1;
      primers.slice(0, 3).forEach((p, k) => lines.push(`Seq${n}.${k + 1} ${p}`));
      if (primers.length !== 3) {
        warnings.push(`Line ${n}: found ${primers.length} primer sequence${primers.length === 1 ? "" : "s"} (expected 3).`);
      }
    });
    const text = lines.join("\n");

    let html = `<h2>Prepared (${rows.length} record${rows.length === 1 ? "" : "s"})</h2>`;
    if (warnings.length) {
      html += '<ul class="prep-warn">' + warnings.map((w) => `<li>${esc(w)}</li>`).join("") + "</ul>";
    }
    html += `<textarea id="prep-out" class="prep-out" rows="${Math.min(lines.length + 1, 18)}" spellcheck="false" readonly>${esc(text)}</textarea>`;
    html += '<div class="actions">' +
      '<button id="prep-use" type="button">Use in multiplex</button>' +
      '<button id="prep-copy" type="button" class="btn-secondary">Copy</button>' +
      "</div>";
    out.innerHTML = html;

    document.getElementById("prep-copy").addEventListener("click", () => {
      const ta = document.getElementById("prep-out");
      ta.select();
      navigator.clipboard.writeText(ta.value).catch(() => {});
    });
    document.getElementById("prep-use").addEventListener("click", () => {
      try { localStorage.setItem("flare3:seqs", text); } catch (_) {}
      location.hash = "#multiplex";
    });
  }

  function mount() {
    const btn = document.getElementById("prep-run");
    if (!btn) return;
    btn.addEventListener("click", () => {
      render(extract(document.getElementById("raw").value));
    });
  }

  return { mount };
})();
