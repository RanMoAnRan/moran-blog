(() => {
  const mobile = window.matchMedia("(max-width: 768px)");
  const shortenLabels = () => {
    document.querySelectorAll(".breadcrumbs ol a, .breadcrumbs [aria-current='page']").forEach((label) => {
      const full = label.title || label.textContent;
      const characters = Array.from(full);
      label.title = full;
      label.setAttribute("aria-label", full);
      label.textContent = mobile.matches && characters.length > 8
        ? `${characters.slice(0, 8).join("")}…`
        : full;
    });
  };

  const updateBreadcrumbs = () => {
    const nav = document.querySelector("[data-breadcrumb-origin]");
    if (!nav) return;
    const previous = window.__moranPrevUrl || document.referrer;
    if (!previous) return;

    try {
      const source = new URL(previous, window.location.href);
      if (source.origin !== window.location.origin) return;
      if (source.pathname === window.location.pathname) return;

      const sources = JSON.parse(nav.querySelector("[data-breadcrumb-sources]").textContent);
      // Paginated lists use the same hierarchy, but link back to the actual page.
      const path = `${source.pathname.replace(/\/page\/\d+\/?$/, "/").replace(/\/+$/, "")}/`;
      const ancestors = sources[path];
      if (!ancestors) return;
      const currentLabel = nav.querySelector('[aria-current="page"]');
      const current = currentLabel.title || currentLabel.textContent;
      const list = document.createElement("ol");

      ancestors.forEach((item, index) => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = index === ancestors.length - 1
          ? `${source.pathname}${source.search}${source.hash}`
          : item.url;
        const query = source.searchParams.get("q");
        link.textContent = index === ancestors.length - 1 && query
          ? `${item.title}：${query}`
          : item.title;
        li.append(link);
        list.append(li);
      });

      const li = document.createElement("li");
      const label = document.createElement("span");
      label.setAttribute("aria-current", "page");
      label.textContent = current;
      li.append(label);
      list.append(li);
      nav.querySelector("ol").replaceWith(list);
    } catch {
      // Keep the server-rendered hierarchy for unknown or unavailable sources.
    }
  };

  const refresh = () => {
    updateBreadcrumbs();
    shortenLabels();
  };
  refresh();
  mobile.addEventListener("change", shortenLabels);
  document.addEventListener("moran:page-load", refresh);
})();
