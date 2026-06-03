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

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const decodeHtmlEntities = (value) => {
    const text = (value || "").toString();
    if (!text.includes("&")) return text;
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  };

  const uniqueTokens = (tokens) => Array.from(new Set(tokens.filter(Boolean))).sort((a, b) => b.length - a.length);

  const highlightText = (value, tokens) => {
    const text = decodeHtmlEntities(value);
    const terms = uniqueTokens(tokens);
    if (!text || !terms.length) return escapeHtml(text);

    const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
    let cursor = 0;
    let html = "";

    text.replace(pattern, (match, _term, index) => {
      html += escapeHtml(text.slice(cursor, index));
      html += `<mark class="search-hit">${escapeHtml(match)}</mark>`;
      cursor = index + match.length;
      return match;
    });

    html += escapeHtml(text.slice(cursor));
    return html;
  };

  const excerptAroundHit = (value, tokens, size = 120) => {
    const text = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
    const terms = uniqueTokens(tokens);
    if (!text || !terms.length) return "";

    const lower = text.toLowerCase();
    let hitIndex = -1;
    for (const token of terms) {
      const index = lower.indexOf(token);
      if (index !== -1 && (hitIndex === -1 || index < hitIndex)) hitIndex = index;
    }
    if (hitIndex === -1) return "";

    const start = Math.max(0, hitIndex - Math.floor(size / 2));
    const end = Math.min(text.length, start + size);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < text.length ? "…" : "";
    return `${prefix}${text.slice(start, end)}${suffix}`;
  };

  const renderResults = (items, query, tokens = tokenize(query)) => {
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
      article.dataset.postCard = "";
      article.dataset.postUrl = item.url || "#";
      article.dataset.postTitle = item.title || "";

      const titleHitCount = includesAny(item.title, tokens);
      const summaryHitCount = includesAny(item.summary || "", tokens);
      const title = highlightText(item.title, tokens);
      const summary = highlightText(item.summary || "", tokens);
      const contentExcerpt = titleHitCount || summaryHitCount ? "" : excerptAroundHit(item.content || "", tokens);
      const excerpt = contentExcerpt ? highlightText(contentExcerpt, tokens) : "";
      const date = escapeHtml(item.date || "");
      const url = escapeHtml(item.url || "#");

      article.innerHTML = `
        <header class="post-card__header">
          <h3 class="post-card__title">
            <a class="post-card__title-link" href="${url}">${title}</a>
          </h3>
          <div class="post-card__meta"><span class="meta">${date}</span></div>
        </header>
        <div class="post-card__read-state" data-read-state hidden></div>
        ${summary ? `<p class="post-card__summary">${summary}</p>` : ""}
        ${excerpt ? `<p class="search-result__excerpt"><span class="search-result__excerpt-label">正文命中</span>${excerpt}</p>` : ""}
        <footer class="post-card__footer search-result__footer">
          <span></span>
          <a href="${url}" class="read-more-link" data-read-more-link><span data-read-more-text>阅读全文</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a>
        </footer>
      `;

      results.appendChild(article);
    }

    if (window.inkReadState && typeof window.inkReadState.refresh === "function") {
      window.inkReadState.refresh();
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
      tokens,
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
