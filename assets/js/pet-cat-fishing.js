(() => {
  const storageKey = "ink-pet-cat-fishing";
  const root = document.documentElement;

  const getEnabled = () => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  };

  const setEnabled = (enabled) => {
    try {
      localStorage.setItem(storageKey, enabled ? "1" : "0");
    } catch {
      // ignore
    }

    if (enabled) {
      root.setAttribute("data-pet-cat", "on");
    } else {
      root.removeAttribute("data-pet-cat");
    }

    const btn = document.querySelector("[data-pet-cat-toggle]");
    if (btn) {
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.setAttribute("aria-label", enabled ? "关闭小猫动效" : "开启小猫动效");
      btn.setAttribute("title", enabled ? "关闭小猫动效" : "开启小猫动效");
    }
  };

  const isMobile = () => window.matchMedia && window.matchMedia("(max-width: 640px)").matches;

  const applyVisualViewportPin = () => {
    const el = document.querySelector(".pet-cat-fishing");
    if (!el) return;
    const vv = window.visualViewport;
    if (!vv) return;
    if (!isMobile()) return;

    // Keep the pet stable on iOS/Android browsers where the URL/toolbar collapses/expands during scroll.
    // Pin to the visual viewport bottom-left (use current computed CSS offsets as the canonical margin).
    const style = window.getComputedStyle(el);
    const marginLeft = Number.parseFloat(style.left) || 10;
    const marginBottom = Number.parseFloat(style.bottom) || 10;

    const update = () => {
      // Read current height (can change with responsive / zoom).
      const rect = el.getBoundingClientRect();
      const h = rect.height || 112;

      el.style.left = `${Math.round(marginLeft + vv.offsetLeft)}px`;
      el.style.bottom = "auto";
      el.style.top = `${Math.round(vv.offsetTop + vv.height - h - marginBottom)}px`;
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    vv.addEventListener("resize", schedule, { passive: true });
    vv.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    schedule();
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        // Init toggle first so CSS state is correct ASAP.
        let enabled = getEnabled();
        setEnabled(enabled);

        const btn = document.querySelector("[data-pet-cat-toggle]");
        if (btn) {
          btn.addEventListener("click", () => {
            enabled = !enabled;
            setEnabled(enabled);
          });
        }

        applyVisualViewportPin();
      },
      { once: true },
    );
  } else {
    let enabled = getEnabled();
    setEnabled(enabled);

    const btn = document.querySelector("[data-pet-cat-toggle]");
    if (btn) {
      btn.addEventListener("click", () => {
        enabled = !enabled;
        setEnabled(enabled);
      });
    }

    applyVisualViewportPin();
  }
})();
