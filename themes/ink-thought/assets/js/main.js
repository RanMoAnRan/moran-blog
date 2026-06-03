(() => {
  const storageKey = "ink-theme";
  const root = document.documentElement;
  const themeColors = {
    light: "#f1f5f9",
    dark: "#0b1020",
  };

  const systemTheme = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const normalizeTheme = (value) => (value === "dark" || value === "light" ? value : systemTheme());

  const syncThemeColor = (theme) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", themeColors[normalizeTheme(theme)]);
  };

  // 背景动效只在“首次进入当前标签页会话”播放一次，后续页面跳转保持静止以降低资源占用。
  try {
    const ambientKey = "ink-ambient-played";
    if (sessionStorage.getItem(ambientKey) === "1") {
      root.setAttribute("data-ambient", "static");
    } else {
      sessionStorage.setItem(ambientKey, "1");
    }
  } catch {
    // ignore
  }

  const applyTheme = (theme) => {
    const next = normalizeTheme(theme);
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
    syncThemeColor(next);
  };

  const giscusThemeFor = (theme) => (normalizeTheme(theme) === "dark" ? "dark_dimmed" : "light");

  const setGiscusTheme = () => {
    const frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) return;

    try {
      if (!frame.src || new URL(frame.src).origin !== "https://giscus.app") return;
    } catch {
      return;
    }

    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: giscusThemeFor(root.getAttribute("data-theme")) } } },
      "https://giscus.app",
    );
  };

  const observeGiscus = () => {
    const bindFrame = (frame) => {
      if (!frame || frame.dataset.giscusThemeBound === "1") return;
      frame.dataset.giscusThemeBound = "1";
      frame.addEventListener("load", setGiscusTheme);
    };

    bindFrame(document.querySelector("iframe.giscus-frame"));

    const observer = new MutationObserver(() => {
      const frame = document.querySelector("iframe.giscus-frame");
      if (!frame) return;
      bindFrame(frame);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const getStoredTheme = () => {
    try {
      return normalizeTheme(localStorage.getItem(storageKey));
    } catch {
      return systemTheme();
    }
  };

  const setStoredTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, normalizeTheme(theme));
    } catch {
      // ignore
    }
  };

  const toggleTheme = (current) => (normalizeTheme(current) === "dark" ? "light" : "dark");

  const getThemeLabel = (theme) => (normalizeTheme(theme) === "dark" ? "主题：深色" : "主题：浅色");

  let theme = getStoredTheme();
  applyTheme(theme);
  observeGiscus();

  const button = document.querySelector("[data-theme-toggle]");
  if (button) button.setAttribute("aria-label", getThemeLabel(theme));

  if (button) {
    button.addEventListener("click", () => {
      theme = toggleTheme(theme);
      setStoredTheme(theme);
      applyTheme(theme);
      button.setAttribute("aria-label", getThemeLabel(theme));
      setGiscusTheme();
    });
  }

  const navToggle = document.querySelector("[data-nav-toggle]");
  const navMobile = document.querySelector("[data-nav-mobile]");

  if (navToggle && navMobile) {
    const setOpen = (open) => {
      navMobile.hidden = !open;
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    setOpen(false);

    navToggle.addEventListener("click", () => {
      setOpen(navMobile.hidden);
    });

    navMobile.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      setOpen(false);
    });

    document.addEventListener("click", (event) => {
      if (navMobile.hidden) return;
      if (event.target.closest("[data-nav-toggle]")) return;
      if (event.target.closest("[data-nav-mobile]")) return;
      setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (navMobile.hidden) return;
      setOpen(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768) setOpen(false);
    });
  }
})();

(() => {
  const copiedLabel = "已复制";
  const copyLabel = "复制";

  const getCodeText = (codeEl) => {
    if (!codeEl) return "";
    return String(codeEl.textContent || "").replace(/\n$/, "");
  };

  const copyToClipboard = async (text) => {
    if (!text) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch {
      return false;
    }
  };

  const enhanceCodeBlocks = () => {
    const pres = document.querySelectorAll(".prose pre");
    if (!pres.length) return;

    pres.forEach((pre) => {
      const container = pre.closest(".highlight") || pre;
      if (container.dataset.codeCopyReady === "1") return;

      const codeEl = pre.querySelector("code") || pre;
      const codeText = getCodeText(codeEl);
      if (!codeText.trim()) return;

      container.dataset.codeCopyReady = "1";
      container.classList.add("has-copy-btn");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy-btn";
      btn.textContent = copyLabel;
      btn.setAttribute("aria-label", "复制代码");

      let timer = null;
      btn.addEventListener("click", async () => {
        const ok = await copyToClipboard(codeText);
        if (timer) window.clearTimeout(timer);
        btn.textContent = ok ? copiedLabel : "复制失败";
        btn.classList.toggle("is-copied", ok);
        timer = window.setTimeout(() => {
          btn.textContent = copyLabel;
          btn.classList.remove("is-copied");
        }, 1200);
      });

      container.insertBefore(btn, container.firstChild);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceCodeBlocks);
  } else {
    enhanceCodeBlocks();
  }
})();


(() => {
  const progress = document.querySelector("[data-reading-progress]");
  const progressBar = document.querySelector("[data-reading-progress-bar]");
  const article = document.querySelector(".post-detail-card");
  const prose = document.querySelector(".post-detail-card .detail-prose");
  const backToTop = document.querySelector("[data-back-to-top]");
  const readingPercent = document.querySelector("[data-reading-percent]");
  const toc = document.querySelector("[data-post-toc]");
  const tocToggle = document.querySelector("[data-toc-toggle]");
  const tocLinks = toc ? Array.from(toc.querySelectorAll('a[href*="#"]')) : [];
  const headings = prose ? Array.from(prose.querySelectorAll("h2[id], h3[id], h4[id]")) : [];

  const copyToClipboard = async (text) => {
    if (!text) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch {
      return false;
    }
  };

  const decodeHash = (hash) => {
    if (!hash) return "";
    try {
      return decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
      return hash.replace(/^#/, "");
    }
  };

  const baseUrl = () => `${window.location.origin}${window.location.pathname}`;

  const enhanceHeadingAnchors = () => {
    if (!headings.length) return;

    headings.forEach((heading) => {
      if (heading.dataset.headingAnchorReady === "1") return;
      heading.dataset.headingAnchorReady = "1";
      heading.classList.add("has-heading-anchor");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "heading-anchor-copy";
      btn.setAttribute("aria-label", "复制标题链接");
      btn.title = "复制标题链接";
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

      let timer = null;
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const ok = await copyToClipboard(`${baseUrl()}#${encodeURIComponent(heading.id)}`);
        if (timer) window.clearTimeout(timer);
        btn.classList.toggle("is-copied", ok);
        btn.setAttribute("aria-label", ok ? "标题链接已复制" : "复制失败");
        btn.title = ok ? "已复制" : "复制失败";
        timer = window.setTimeout(() => {
          btn.classList.remove("is-copied");
          btn.setAttribute("aria-label", "复制标题链接");
          btn.title = "复制标题链接";
        }, 1400);
      });

      heading.appendChild(btn);
    });
  };

  const linkById = new Map();
  tocLinks.forEach((link) => {
    try {
      const url = new URL(link.getAttribute("href"), window.location.href);
      const id = decodeHash(url.hash);
      if (id && !linkById.has(id)) linkById.set(id, link);
    } catch {
      const id = decodeHash(link.getAttribute("href").split("#")[1] || "");
      if (id && !linkById.has(id)) linkById.set(id, link);
    }
  });

  const setTocOpen = (open) => {
    if (!toc || !tocToggle) return;
    toc.classList.toggle("is-open", open);
    tocToggle.setAttribute("aria-expanded", open ? "true" : "false");
    tocToggle.setAttribute("aria-label", open ? "关闭文章目录" : "打开文章目录");
  };

  if (toc && tocToggle) {
    setTocOpen(false);

    tocToggle.addEventListener("click", () => {
      setTocOpen(!toc.classList.contains("is-open"));
    });

    tocLinks.forEach((link) => {
      link.addEventListener("click", () => setTocOpen(false));
    });

    document.addEventListener("click", (event) => {
      if (!toc.classList.contains("is-open")) return;
      if (event.target.closest("[data-post-toc]")) return;
      if (event.target.closest("[data-toc-toggle]")) return;
      setTocOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setTocOpen(false);
    });
  }

  let ticking = false;
  const update = () => {
    ticking = false;

    const progressTarget = prose || article;
    if (progress && progressBar && progressTarget) {
      const rect = progressTarget.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + progressTarget.offsetHeight - window.innerHeight;
      const total = Math.max(1, end - start);
      const value = Math.min(1, Math.max(0, (window.scrollY - start) / total));
      const percent = Math.round(value * 100);
      progressBar.style.transform = `scaleX(${value})`;
      progress.hidden = rect.bottom <= 0;

      if (readingPercent) readingPercent.textContent = `${percent}%`;
      if (backToTop) {
        const visible = window.scrollY > Math.min(520, Math.max(240, window.innerHeight * 0.55));
        backToTop.classList.toggle("is-visible", visible);
        backToTop.setAttribute("aria-hidden", visible ? "false" : "true");
        backToTop.setAttribute("aria-label", `回到顶部，当前阅读进度 ${percent}%`);
      }
    }

    if (headings.length && linkById.size) {
      const offset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 64;
      const threshold = offset + 32;
      let active = headings[0];

      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= threshold) active = heading;
        else break;
      }

      tocLinks.forEach((link) => link.classList.remove("is-active"));
      const activeLink = active ? linkById.get(active.id) : null;
      if (activeLink) activeLink.classList.add("is-active");
    }
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const init = () => {
    enhanceHeadingAnchors();
    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


(() => {
  const storagePrefix = "ink-read:";
  const maxRecentItems = 80;

  const normalizePath = (value) => {
    try {
      return new URL(value, window.location.origin).pathname.replace(/\/+$/, "/");
    } catch {
      return (value || window.location.pathname).toString().replace(/\/+$/, "/");
    }
  };

  const stateKey = (url) => `${storagePrefix}${normalizePath(url)}`;

  const readState = (url) => {
    try {
      const raw = window.localStorage.getItem(stateKey(url));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeState = (state) => {
    try {
      const url = normalizePath(state.url || window.location.pathname);
      const next = {
        url,
        title: state.title || document.title || "",
        percent: Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0))),
        scrollY: Math.max(0, Math.round(Number(state.scrollY) || 0)),
        read: !!state.read,
        updatedAt: Number(state.updatedAt) || Date.now(),
      };

      if (next.percent >= 90) next.read = true;
      window.localStorage.setItem(stateKey(url), JSON.stringify(next));
      rememberRecent(url);
      return next;
    } catch {
      return null;
    }
  };

  const rememberRecent = (url) => {
    try {
      const indexKey = `${storagePrefix}index`;
      const normalized = normalizePath(url);
      const list = JSON.parse(window.localStorage.getItem(indexKey) || "[]");
      const next = [normalized, ...list.filter((item) => item !== normalized)].slice(0, maxRecentItems);
      window.localStorage.setItem(indexKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const continueHref = (url) => {
    try {
      const target = new URL(url, window.location.origin);
      target.searchParams.set("continue", "1");
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return url;
    }
  };

  const readIndex = () => {
    try {
      const list = JSON.parse(window.localStorage.getItem(`${storagePrefix}index`) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const readAllStates = () =>
    readIndex()
      .map((url) => readState(url))
      .filter(Boolean)
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));

  const formatTimeAgo = (timestamp) => {
    const diff = Date.now() - (Number(timestamp) || 0);
    if (!timestamp || diff < 0) return "刚刚";
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return "刚刚";
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
    return new Date(timestamp).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  };

  const renderPulse = () => {
    const root = document.querySelector("[data-reading-pulse]");
    if (!root) return;

    const states = readAllStates();
    const readCount = states.filter((item) => item.read || item.percent >= 90).length;
    const progressItems = states.filter((item) => !(item.read || item.percent >= 90) && item.percent >= 5);
    const totalPosts = Number(root.getAttribute("data-total-posts")) || 0;
    const completionRate = totalPosts ? Math.round((readCount / totalPosts) * 100) : 0;

    const setText = (selector, value) => {
      const el = root.querySelector(selector);
      if (el) el.textContent = value;
    };

    setText("[data-read-count]", String(readCount));
    setText("[data-progress-count]", String(progressItems.length));
    setText("[data-completion-rate]", states.length ? `${completionRate}%` : "--");

    const list = root.querySelector("[data-reading-recent]");
    const empty = root.querySelector("[data-reading-empty]");
    const clear = root.querySelector("[data-reading-clear]");
    const recent = states.slice(0, 4);

    if (!list || !empty) return;

    if (!recent.length) {
      list.hidden = true;
      list.innerHTML = "";
      empty.hidden = false;
      if (clear) clear.hidden = true;
      return;
    }

    empty.hidden = true;
    list.hidden = false;
    if (clear) clear.hidden = false;
    list.innerHTML = recent
      .map((item) => {
        const isRead = item.read || item.percent >= 90;
        const label = isRead ? "读过" : `继续 ${item.percent || 0}%`;
        const href = isRead ? item.url : continueHref(item.url);
        return `
          <a class="reading-pulse__item" href="${href}">
            <span class="reading-pulse__item-main">
              <strong>${escapeHtml(item.title || "未命名文章")}</strong>
              <small>${formatTimeAgo(item.updatedAt)}</small>
            </span>
            <span class="reading-pulse__item-state${isRead ? " is-read" : ""}">${label}</span>
          </a>
        `;
      })
      .join("");

    if (clear && clear.dataset.bound !== "1") {
      clear.dataset.bound = "1";
      clear.addEventListener("click", () => {
        try {
          readIndex().forEach((url) => window.localStorage.removeItem(stateKey(url)));
          window.localStorage.removeItem(`${storagePrefix}index`);
        } catch {
          // ignore
        }
        renderCards();
        renderPulse();
      });
    }
  };

  const escapeHtml = (value) =>
    (value || "").toString().replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return ch;
      }
    });

  const renderCards = () => {
    const cards = document.querySelectorAll("[data-post-card]");
    if (!cards.length) return;

    cards.forEach((card) => {
      const url = card.getAttribute("data-post-url");
      const state = readState(url);
      const badge = card.querySelector("[data-read-state]");
      const readMore = card.querySelector("[data-read-more-link]");
      const readMoreText = card.querySelector("[data-read-more-text]");

      card.classList.remove("is-read", "is-in-progress", "is-recent-read");
      if (badge) {
        badge.hidden = true;
        badge.textContent = "";
        badge.className = "post-card__read-state";
      }
      if (readMore && readMoreText && url) {
        readMore.setAttribute("href", url);
        readMoreText.textContent = "阅读全文";
      }

      if (!state || (!state.percent && !state.updatedAt)) return;

      let label = "最近阅读";
      let statusClass = "is-recent-read";
      if (state.read || state.percent >= 90) {
        label = "读过";
        statusClass = "is-read";
      } else if (state.percent >= 5) {
        label = `继续阅读 ${state.percent}%`;
        statusClass = "is-in-progress";
        if (readMore && readMoreText && url) {
          readMore.setAttribute("href", continueHref(url));
          readMoreText.textContent = `继续阅读 ${state.percent}%`;
        }
      }

      card.classList.add(statusClass);
      if (badge) {
        badge.hidden = false;
        badge.textContent = label;
        badge.classList.add(statusClass);
      }
    });
  };

  const refreshReadState = () => {
    renderCards();
    renderPulse();
  };

  window.inkReadState = {
    refresh: refreshReadState,
    read: readState,
    continueHref,
  };

  const setupArticleTracking = () => {
    const prose = document.querySelector(".post-detail-card .detail-prose");
    const article = document.querySelector(".post-detail-card");
    if (!article || !prose) return;

    const title = (document.querySelector(".detail-title") || {}).textContent || document.title || "";
    const url = normalizePath(window.location.pathname);
    let lastWrite = 0;
    let lastPercent = -1;

    const currentProgress = () => {
      const rect = prose.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + prose.offsetHeight - window.innerHeight;
      const total = Math.max(1, end - start);
      return Math.min(100, Math.max(0, Math.round(((window.scrollY - start) / total) * 100)));
    };

    const save = (force = false) => {
      const now = Date.now();
      const percent = currentProgress();
      if (!force && now - lastWrite < 1200 && Math.abs(percent - lastPercent) < 4) return;
      lastWrite = now;
      lastPercent = percent;
      writeState({ url, title: title.trim(), percent, scrollY: window.scrollY, read: percent >= 90, updatedAt: now });
      renderCards();
      renderPulse();
    };

    const restoreIfRequested = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("continue") !== "1") return false;
        const state = readState(url);
        if (!state || !state.scrollY) return false;
        window.setTimeout(() => {
          window.scrollTo({ top: state.scrollY, behavior: "auto" });
          save(true);
        }, 80);
        return true;
      } catch {
        return false;
      }
    };

    if (!restoreIfRequested() && !readState(url)) save(true);
    window.addEventListener("scroll", () => save(false), { passive: true });
    window.addEventListener("pagehide", () => save(true));
    window.addEventListener("beforeunload", () => save(true));
  };

  const init = () => {
    setupArticleTracking();
    refreshReadState();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(() => {
  const selector = ".post-detail-card .detail-prose img";

  const ensureLightbox = () => {
    let root = document.querySelector("[data-img-lightbox]");
    if (root) return root;

    root = document.createElement("div");
    root.className = "img-lightbox";
    root.dataset.imgLightbox = "1";
    root.innerHTML = `
      <div class="img-lightbox__backdrop" data-img-lightbox-close></div>
      <figure class="img-lightbox__figure" role="dialog" aria-modal="true" aria-label="图片预览">
        <img class="img-lightbox__img" alt="">
        <figcaption class="img-lightbox__caption" data-img-lightbox-caption></figcaption>
      </figure>
      <button class="img-lightbox__close" type="button" aria-label="关闭" data-img-lightbox-close>×</button>
    `;
    document.body.appendChild(root);
    return root;
  };

  const openLightbox = (img) => {
    const root = ensureLightbox();
    const elImg = root.querySelector(".img-lightbox__img");
    const elCaption = root.querySelector("[data-img-lightbox-caption]");
    if (!elImg || !elCaption) return;

    const src = img.currentSrc || img.src;
    const alt = img.getAttribute("alt") || "";
    elImg.src = src;
    elImg.alt = alt;
    elCaption.textContent = alt;
    elCaption.style.display = alt ? "block" : "none";

    root.classList.add("is-open");
    document.body.classList.add("is-lightbox-open");

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeLightbox();
    };
    const closeLightbox = () => {
      root.classList.remove("is-open");
      document.body.classList.remove("is-lightbox-open");
      elImg.removeAttribute("src");
      document.removeEventListener("keydown", onKeyDown);
    };

    root.querySelectorAll("[data-img-lightbox-close]").forEach((el) => {
      el.addEventListener("click", closeLightbox, { once: true });
    });
    elImg.addEventListener("click", closeLightbox, { once: true });
    document.addEventListener("keydown", onKeyDown);
  };

  const enhanceImages = () => {
    const images = document.querySelectorAll(selector);
    if (!images.length) return;

    images.forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.noZoom === "1") return;
      if (img.closest("a")) return;
      if (img.classList.contains("img-zoomable")) return;

      img.classList.add("img-zoomable");
      img.addEventListener("click", () => openLightbox(img));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceImages);
  } else {
    enhanceImages();
  }
})();
