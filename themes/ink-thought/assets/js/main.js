(() => {
  const storageKey = "ink-theme";
  const root = document.documentElement;

  const applyTheme = (theme) => {
    if (!theme || theme === "auto") {
      root.removeAttribute("data-theme");
      return;
    }
    root.setAttribute("data-theme", theme);
  };

  const getStoredTheme = () => {
    try {
      return localStorage.getItem(storageKey) || "auto";
    } catch {
      return "auto";
    }
  };

  const setStoredTheme = (theme) => {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // ignore
    }
  };

  const cycleTheme = (current) => {
    if (current === "auto") return "light";
    if (current === "light") return "dark";
    return "auto";
  };

  let theme = getStoredTheme();
  applyTheme(theme);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;

    theme = cycleTheme(theme);
    setStoredTheme(theme);
    applyTheme(theme);

    const label =
      theme === "auto" ? "主题：跟随系统" : theme === "light" ? "主题：浅色" : "主题：深色";
    button.setAttribute("aria-label", label);
  });
})();
