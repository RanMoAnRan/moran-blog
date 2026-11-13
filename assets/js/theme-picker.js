import { themeChange } from "../vendor/theme-change/index.mjs";

const initThemePicker = () => {
  const { themes, key, system, valid, apply } = window.MoranTheme;
  const root = document.documentElement;
  const cards = [...document.querySelectorAll(".theme-card[data-set-theme]")];
  const systemButton = document.querySelector("[data-theme-system]");
  const toggle = document.querySelector("[data-theme-toggle]");
  const status = document.querySelector("[data-theme-status]");
  let storageAvailable = true;
  let lastLight = root.dataset.mode === "light" ? root.dataset.theme : "moran";
  let lastDark = root.dataset.mode === "dark" ? root.dataset.theme : "dim";
  let followsSystem = true;
  try {
    localStorage.setItem("moran-theme-probe", "1");
    localStorage.removeItem("moran-theme-probe");
    followsSystem = !valid(localStorage.getItem(key));
  } catch { storageAvailable = false; }

  const sync = () => {
    const theme = apply(root.dataset.theme);
    if (theme.mode === "light") lastLight = theme.id;
    else lastDark = theme.id;
    cards.forEach(card => {
      const active = card.dataset.setTheme === theme.id;
      card.classList.toggle("is-selected", active);
      card.setAttribute("aria-pressed", String(active));
    });
    systemButton?.setAttribute("aria-pressed", String(followsSystem));
    if (status) status.textContent = `${followsSystem ? "跟随系统 · " : "当前主题 · "}${theme.name}`;
    if (toggle) {
      const darkName = themes.find(item => item.id === lastDark).name;
      toggle.setAttribute("aria-label", theme.mode === "dark" ? "切换到浅色主题" : `切换到 ${darkName} 深色主题`);
      toggle.title = theme.mode === "dark" ? "切换到浅色主题" : "切换到深色主题";
      toggle.setAttribute("aria-pressed", String(theme.mode === "dark"));
    }
    document.dispatchEvent(new CustomEvent("moran:theme-change", { detail: theme }));
  };

  // theme-change owns the selected theme and persistence; the adapter supplies
  // legacy light/dark styling, accessibility, and the system preference option.
  cards.forEach(card => card.addEventListener("click", () => {
    followsSystem = false;
    if (!storageAvailable) root.dataset.theme = card.dataset.setTheme;
  }));
  if (storageAvailable) themeChange(false);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  sync();

  const filters = [...document.querySelectorAll("[data-theme-filter]")];
  filters.forEach(button => button.addEventListener("click", () => {
    const filter = button.dataset.themeFilter;
    filters.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    cards.forEach(card => { card.hidden = filter !== "all" && card.dataset.themeMode !== filter; });
    document.querySelector(".theme-panel__grid").scrollTop = 0;
  }));

  const choose = id => cards.find(card => card.dataset.setTheme === id)?.click();
  toggle?.addEventListener("click", () => choose(root.dataset.mode === "dark" ? lastLight : lastDark));
  systemButton?.addEventListener("click", () => {
    followsSystem = true;
    if (storageAvailable) {
      localStorage.removeItem(key);
      localStorage.removeItem("ink-theme");
    }
    apply(system());
    sync();
  });
  const colorScheme = matchMedia("(prefers-color-scheme: dark)");
  window.MoranTheme.colorScheme = colorScheme;
  colorScheme.addEventListener("change", () => {
    if (followsSystem) { apply(system()); sync(); }
  });
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    followsSystem = !valid(event.newValue);
    apply(followsSystem ? system() : event.newValue);
    sync();
  });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initThemePicker);
else initThemePicker();
