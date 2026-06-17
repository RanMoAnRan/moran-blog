(() => {
  let cleanup = null;

  const initPostReadingControls = () => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }

    const progress = document.querySelector("[data-reading-progress]");
    const progressBar = document.querySelector("[data-reading-progress-bar]");
    const article = document.querySelector(".post-detail-card");
    const prose = document.querySelector(".post-detail-card .detail-prose");
    const backToTop = document.querySelector("[data-back-to-top]");
    const readingPercent = document.querySelector("[data-reading-percent]");

    if (!progress && !backToTop) return;

    const controller = new AbortController();
    const { signal } = controller;
    let ticking = false;

    const update = () => {
      ticking = false;

      const target = prose || article;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + target.offsetHeight - window.innerHeight;
      const total = Math.max(1, end - start);
      const value = Math.min(1, Math.max(0, (window.scrollY - start) / total));
      const percent = Math.round(value * 100);

      if (progress && progressBar) {
        progressBar.style.transform = `scaleX(${value})`;
        progress.hidden = rect.bottom <= 0;
      }

      if (readingPercent) readingPercent.textContent = `${percent}%`;

      if (backToTop) {
        const visible = window.scrollY > Math.min(520, Math.max(240, window.innerHeight * 0.55));
        backToTop.classList.toggle("is-visible", visible);
        backToTop.setAttribute("aria-hidden", visible ? "false" : "true");
        backToTop.setAttribute("aria-label", `回到顶部，当前阅读进度 ${percent}%`);
      }
    };

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true, signal });
    window.addEventListener("resize", requestUpdate, { signal });

    if (backToTop) {
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, { signal });
    }

    requestUpdate();
    window.setTimeout(requestUpdate, 80);

    cleanup = () => controller.abort();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPostReadingControls, { once: true });
  } else {
    initPostReadingControls();
  }

  document.addEventListener("moran:page-load", initPostReadingControls);
})();
