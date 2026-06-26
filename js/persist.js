(function () {
  const PREFIX = "flare3:";
  const SKIP = new Set(["hidden", "submit", "button", "reset", "file", "password"]);

  function wire() {
    const fields = document.querySelectorAll("input[id], textarea[id], select[id]");
    for (const el of fields) {
      if (el.tagName === "INPUT" && SKIP.has(el.type)) continue;
      const key = PREFIX + el.id;
      const saved = localStorage.getItem(key);
      if (saved !== null) el.value = saved;
      el.addEventListener("input", () => localStorage.setItem(key, el.value));
    }
  }

  // Exposed so the router can re-wire fields after injecting a page fragment.
  window.flarePersist = wire;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
