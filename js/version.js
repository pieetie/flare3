window.APP_VERSION = "0.1.0";

(function () {
  function apply() {
    for (const el of document.querySelectorAll("[data-version]")) {
      el.textContent = "v" + window.APP_VERSION;
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
