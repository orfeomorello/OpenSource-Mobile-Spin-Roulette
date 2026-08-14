(() => {
  const data = window.MSR_HOSTING;
  if (!data?.locales) return;

  const storageKey = "msr-hosting-locale";
  const ids = Object.keys(data.locales);

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function linkify(value) {
    const escaped = escapeHtml(value);
    const href = escapeHtml(data.github);
    return escaped.replaceAll(href, `<a href="${href}" rel="noopener noreferrer">${href}</a>`);
  }

  function preferredLocale() {
    const query = new URLSearchParams(location.search).get("lang");
    if (query && data.locales[query]) return query;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && data.locales[saved]) return saved;
    } catch {
      /* private mode */
    }
    const nav = (navigator.language || "en").toLowerCase();
    if (data.locales[nav]) return nav;
    if (nav.startsWith("pt")) return "pt-BR";
    const short = nav.slice(0, 2);
    return ids.find((id) => id === short || id.toLowerCase().startsWith(short)) || "en";
  }

  function apply(id) {
    const pack = data.locales[id];
    if (!pack) return;

    document.documentElement.lang = pack.htmlLang;
    document.title = pack.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", pack.description);

    for (const node of document.querySelectorAll("[data-i18n]")) {
      const key = node.getAttribute("data-i18n");
      if (key && pack.chrome[key]) node.textContent = pack.chrome[key];
    }

    const intro = document.querySelector("[data-field=intro]");
    if (intro) intro.textContent = pack.intro;

    const short = document.querySelector("[data-field=short]");
    if (short) short.textContent = pack.description;

    const heading = document.querySelector("[data-field=featuresHeading]");
    if (heading) heading.textContent = pack.featuresHeading;

    const list = document.querySelector("[data-field=features]");
    if (list) {
      list.replaceChildren(
        ...pack.features.map((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          return li;
        }),
      );
    }

    for (const card of document.querySelectorAll("[data-section]")) {
      const section = pack.sections[Number(card.getAttribute("data-section"))];
      if (!section) continue;
      const title = card.querySelector("h2");
      const body = card.querySelector("p");
      if (title) title.textContent = section.heading;
      if (body) body.innerHTML = linkify(section.body);
    }

    for (const button of document.querySelectorAll(".lang-btn")) {
      button.setAttribute("aria-pressed", button.getAttribute("data-lang") === id ? "true" : "false");
    }

    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* private mode */
    }

    const url = new URL(location.href);
    url.searchParams.set("lang", id);
    history.replaceState(null, "", url);
  }

  for (const button of document.querySelectorAll(".lang-btn")) {
    button.addEventListener("click", () => apply(button.getAttribute("data-lang")));
  }

  apply(preferredLocale());
})();
