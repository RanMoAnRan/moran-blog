(() => {
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
    document.addEventListener("DOMContentLoaded", applyVisualViewportPin, { once: true });
  } else {
    applyVisualViewportPin();
  }
})();
