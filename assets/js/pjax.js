(() => {
  window.__moranPjaxLoaded = true;
  const mainSelector = "#main";
  const cache = new Map();
  let navigating = false;

  const sameOrigin = (url) => url.origin === window.location.origin;

  const isModifiedClick = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

  const shouldSkipLink = (link, url) => {
    if (!link || !url) return true;
    if (!sameOrigin(url)) return true;
    if (link.target && link.target !== "_self") return true;
    if (link.hasAttribute("download")) return true;
    if (link.dataset.noPjax === "1") return true;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return true;
    if (url.pathname.match(/\.(?:xml|json|txt|pdf|zip|rar|7z|mp3|flac|m4a|ogg|wav|png|jpe?g|webp|avif|gif|svg)$/i)) return true;
    return false;
  };

  const parsePage = (html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nextMain = doc.querySelector(mainSelector);
    if (!nextMain) throw new Error("PJAX target main not found");
    return {
      title: doc.title || document.title,
      bodyClass: doc.body?.className || "",
      mainHTML: nextMain.innerHTML,
      mainClass: nextMain.className || "site-main",
    };
  };

  const fetchPage = async (url) => {
    const key = url.href;
    if (cache.has(key)) return cache.get(key);
    const res = await fetch(key, {
      headers: { "X-Requested-With": "fetch", "Accept": "text/html,application/xhtml+xml" },
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parsePage(await res.text());
    cache.set(key, data);
    return data;
  };

  const runMainScripts = (main) => {
    const scripts = Array.from(main.querySelectorAll("script"));
    scripts.forEach((oldScript) => {
      const src = oldScript.getAttribute("src") || "";
      if (src && src.includes("/js/bundle")) return;
      try {
        const script = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
        script.textContent = oldScript.textContent;
        oldScript.replaceWith(script);
      } catch (error) {
        console.warn("[moran-pjax] skipped page script", error);
      }
    });
  };

  const stripSlash = (value) => value.replace(/\/+$/, "") || "/";

  const updateActiveLinks = () => {
    const path = stripSlash(window.location.pathname);
    document.querySelectorAll(".nav-link, .nav-mobile-link, .nav-dropdown__item").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      try {
        const url = new URL(href, window.location.href);
        const linkPath = stripSlash(url.pathname);
        const desktopNav = link.closest(".nav-desktop");
        const mobileNav = link.closest(".nav-mobile-menu");
        const isHomeLink = (desktopNav && link === desktopNav.querySelector(".nav-link")) || (mobileNav && link === mobileNav.querySelector(".nav-mobile-link"));
        const active = isHomeLink || linkPath === "/"
          ? path === linkPath
          : path === linkPath || path.startsWith(`${linkPath}/`);
        link.classList.toggle("is-active", active);
      } catch {
        // ignore malformed links
      }
    });

    document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
      dropdown.classList.toggle("is-active", Boolean(dropdown.querySelector(".nav-dropdown__item.is-active")));
      const trigger = dropdown.querySelector(".nav-dropdown__trigger");
      if (trigger) trigger.classList.toggle("is-active", dropdown.classList.contains("is-active"));
    });
  };


  const cleanupCurrentMain = () => {
    const main = document.querySelector(mainSelector);
    if (!main) return;
    main.querySelectorAll("iframe, audio, video").forEach((el) => {
      try { el.removeAttribute("src"); } catch {}
      try { el.remove(); } catch {}
    });
  };

  const closeNavigationOverlays = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll("[data-nav-mobile]").forEach((nav) => { nav.hidden = true; });
    document.querySelectorAll("[data-nav-toggle]").forEach((button) => {
      button.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".header-floating-panel").forEach((panel) => { panel.hidden = true; });
    document.querySelectorAll("[data-header-music-toggle], [data-hue-toggle]").forEach((button) => { button.setAttribute("aria-expanded", "false"); });
    document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
      dropdown.classList.remove("is-open");
      dropdown.classList.add("is-suppressed");
      window.setTimeout(() => dropdown.classList.remove("is-suppressed"), 180);
    });
  };

  const applyPage = (page, url, options = {}) => {
    const main = document.querySelector(mainSelector);
    if (!main) throw new Error("Current main not found");

    cleanupCurrentMain();
    document.title = page.title;
    document.body.className = page.bodyClass;
    main.className = page.mainClass;
    main.innerHTML = page.mainHTML;

    try { runMainScripts(main); } catch (error) { console.warn("[moran-pjax] page scripts failed", error); }
    try { updateActiveLinks(); } catch (error) { console.warn("[moran-pjax] active link update failed", error); }
    try { closeNavigationOverlays(); } catch (error) { console.warn("[moran-pjax] overlay close failed", error); }

    if (!options.preserveScroll) {
      try {
        if (url.hash) {
          const id = decodeURIComponent(url.hash.slice(1));
          const target = document.getElementById(id) || document.querySelector(`[name="${CSS.escape(id)}"]`);
          if (target) target.scrollIntoView();
          else window.scrollTo({ top: 0, behavior: "auto" });
        } else {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      } catch {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }

    document.dispatchEvent(new CustomEvent("moran:page-load", { detail: { url: url.href } }));
  };

  const visit = async (url, options = {}) => {
    if (navigating) return;
    navigating = true;
    document.documentElement.classList.add("is-pjax-loading");
    window.__moranPjaxLast = { url: url.href, status: "fetching" };
    let page = null;
    try {
      page = await fetchPage(url);
    } catch (error) {
      window.__moranPjaxLast = { url: url.href, status: "fetch-failed", error: String(error) };
      console.warn("[moran-pjax] fallback to full navigation", error);
      window.location.href = url.href;
      return;
    }

    try {
      if (!options.replace) history.pushState({ pjax: true }, "", url.href);
      applyPage(page, url, options);
      window.__moranPjaxLast = { url: url.href, status: "applied" };
    } catch (error) {
      // Do not fall back after a successful fetch: full navigation would destroy the audio.
      window.__moranPjaxLast = { url: url.href, status: "apply-failed", error: String(error) };
      console.error("[moran-pjax] apply failed without full reload", error);
    } finally {
      navigating = false;
      document.documentElement.classList.remove("is-pjax-loading");
    }
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || isModifiedClick(event)) return;
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (shouldSkipLink(link, url)) return;
    event.preventDefault();
    visit(url);
  }, true);

  window.addEventListener("popstate", () => {
    visit(new URL(window.location.href), { replace: true, preserveScroll: false });
  });

  window.moranPjax = { visit };
})();
