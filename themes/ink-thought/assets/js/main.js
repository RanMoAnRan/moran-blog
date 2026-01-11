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
