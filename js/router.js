// Hash-based SPA router. Fetches a page fragment and mounts it in #view.
(function () {
  const view = document.getElementById("view");
  const routes = {
    flare: "pages/flare.html",
    prepare: "pages/prepare.html",
    multiplex: "pages/multiplex.html",
  };
  const DEFAULT = "flare";

  async function render() {
    let route = location.hash.replace(/^#/, "") || DEFAULT;
    if (!routes[route]) route = DEFAULT;

    const html = await fetch(routes[route]).then((r) => r.text());
    view.innerHTML = html;

    for (const a of document.querySelectorAll("#nav a")) {
      a.classList.toggle("active", a.dataset.route === route);
    }

    if (window.flarePersist) window.flarePersist();
    if (route === "flare" && window.FLARE) window.FLARE.mount();
    if (route === "prepare" && window.PREPARE) window.PREPARE.mount();
    if (route === "multiplex" && window.MULTIPLEX) window.MULTIPLEX.mount();
  }

  window.addEventListener("hashchange", render);
  render();
})();
