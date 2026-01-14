(() => {
  const storageKey = "ink-theme";
  const root = document.documentElement;

  const normalizeTheme = (value) => (value === "dark" ? "dark" : "light");

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", normalizeTheme(theme));
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

  const button = document.querySelector("[data-theme-toggle]");
  if (button) button.setAttribute("aria-label", getThemeLabel(theme));

  if (button) {
    button.addEventListener("click", () => {
      theme = toggleTheme(theme);
      setStoredTheme(theme);
      applyTheme(theme);
      button.setAttribute("aria-label", getThemeLabel(theme));
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
