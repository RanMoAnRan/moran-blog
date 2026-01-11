(() => {
  const input =
    document.getElementById("search-input") || document.getElementById("header-search-input");
  const results = document.getElementById("search-results");
  const status = document.getElementById("search-status");

  if (!input || !results || !status) return;

  const container = document.querySelector("[data-search-index]");
  const endpoint = (container && container.getAttribute("data-search-index")) || "/index.json";
  let pages = [];
  let loaded = false;

  const setStatus = (text) => {
    status.textContent = text;
  };

  const normalize = (value) => (value || "").toString().trim().toLowerCase();

  const tokenize = (query) => normalize(query).split(/\s+/).filter(Boolean);

  const updateUrl = (query) => {
    try {
      const url = new URL(window.location.href);
      const value = (query || "").toString().trim();
      if (value) {
        url.searchParams.set("q", value);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  };

  const includesAny = (haystack, tokens) => {
    const text = normalize(haystack);
    let hits = 0;
    for (const token of tokens) {
      if (token && text.includes(token)) hits += 1;
    }
    return hits;
  };

  const scorePage = (page, tokens) => {
    if (!tokens.length) return 0;

    const titleHits = includesAny(page.title, tokens);
    const summaryHits = includesAny(page.summary, tokens);
    const contentHits = includesAny(page.content, tokens);

    const tagsText = Array.isArray(page.tags) ? page.tags.join(" ") : "";
    const categoriesText = Array.isArray(page.categories) ? page.categories.join(" ") : "";
    const tagsHits = includesAny(tagsText, tokens);
    const categoriesHits = includesAny(categoriesText, tokens);

    return titleHits * 10 + tagsHits * 8 + categoriesHits * 6 + summaryHits * 5 + contentHits * 1;
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

  const renderResults = (items, query) => {
    results.innerHTML = "";

    if (!query) {
      setStatus("输入关键词开始搜索。");
      return;
    }

    if (!items.length) {
      setStatus("没有找到匹配结果。");
      return;
    }

    setStatus(`找到 ${items.length} 条结果。`);

    for (const item of items) {
      const article = document.createElement("article");
      article.className = "post-card search-result";

      const title = escapeHtml(item.title);
      const summary = escapeHtml(item.summary || "");
      const date = escapeHtml(item.date || "");
      const url = item.url || "#";

      article.innerHTML = `
        <header class="post-card__header">
          <h3 class="post-card__title">
            <a class="post-card__title-link" href="${url}">${title}</a>
          </h3>
          <div class="post-card__meta"><span class="meta">${date}</span></div>
        </header>
        ${summary ? `<p class="post-card__summary">${summary}</p>` : ""}
      `;

      results.appendChild(article);
    }
  };

  const doSearch = (query) => {
    if (!loaded) return;

    updateUrl(query);

    const tokens = tokenize(query);
    if (!tokens.length) {
      renderResults([], "");
      return;
    }

    const matches = [];
    for (const page of pages) {
      const score = scorePage(page, tokens);
      if (score > 0) matches.push({ page, score });
    }

    matches.sort((a, b) => b.score - a.score);
    renderResults(
      matches.slice(0, 30).map((m) => m.page),
      query,
    );
  };

  const prefillFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (!q) return;
    input.value = q;
    doSearch(q);
  };

  const focusInput = () => {
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  };

  const load = async () => {
    try {
      const res = await fetch(endpoint, { cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pages = await res.json();
      loaded = true;
      setStatus("输入关键词开始搜索。");
      focusInput();
      prefillFromUrl();
    } catch {
      setStatus("索引加载失败，请稍后刷新。");
    }
  };

  const form = input.closest("form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      doSearch(input.value);
    });
  }

  input.addEventListener("input", () => doSearch(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      doSearch("");
      return;
    }
    if (event.key !== "Enter") return;
    doSearch(input.value);
  });

  load();
})();
