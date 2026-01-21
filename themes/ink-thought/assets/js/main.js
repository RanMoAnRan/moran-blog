(() => {
  const storageKey = "ink-theme";
  const root = document.documentElement;

  const normalizeTheme = (value) => (value === "dark" ? "dark" : "light");

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", normalizeTheme(theme));
  };

  const giscusThemeFor = (theme) => (normalizeTheme(theme) === "dark" ? "dark_dimmed" : "light");

  const setGiscusTheme = () => {
    const frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: giscusThemeFor(root.getAttribute("data-theme")) } } },
      "https://giscus.app",
    );
  };

  const observeGiscus = () => {
    if (document.querySelector("iframe.giscus-frame")) {
      setGiscusTheme();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!document.querySelector("iframe.giscus-frame")) return;
      setGiscusTheme();
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const getStoredTheme = () => {
    try {
      return normalizeTheme(localStorage.getItem(storageKey));
    } catch {
      return "light";
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
