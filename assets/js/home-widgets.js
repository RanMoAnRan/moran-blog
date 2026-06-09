(() => {
  const formatNumber = (value) => Number(value || 0).toLocaleString("zh-CN");
  const dayMs = 24 * 60 * 60 * 1000;

  const initStats = () => {
    document.querySelectorAll("[data-home-stats]").forEach((root) => {
      root.querySelectorAll("[data-format-number]").forEach((el) => {
        el.textContent = formatNumber(el.textContent);
      });

      const now = new Date();
      const start = new Date(root.dataset.startDate || "2026-01-01");
      const last = root.dataset.lastPostDate ? new Date(root.dataset.lastPostDate) : null;
      const runningDays = Number.isNaN(start.getTime()) ? 0 : Math.max(1, Math.ceil((now - start) / dayMs));
      const runningEl = root.querySelector("[data-running-days]");
      if (runningEl) runningEl.textContent = String(runningDays);

      if (last && !Number.isNaN(last.getTime())) {
        const days = Math.max(0, Math.floor((now - last) / dayMs));
        const lastEl = root.querySelector("[data-last-update]");
        const suffixEl = root.querySelector("[data-last-update-suffix]");
        if (lastEl) lastEl.textContent = days === 0 ? "今天" : String(days);
        if (suffixEl) suffixEl.hidden = days === 0;
      }
    });
  };

  const parseJson = (el, fallback) => {
    try {
      const parsed = JSON.parse(el?.textContent || "");
      return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    } catch {
      return fallback;
    }
  };

  const normalizeTrack = (item) => ({
    title: item.name || item.title || "未知歌曲",
    artist: item.artist || item.author || item.artists || "未知歌手",
    url: item.url || "",
    cover: item.pic || item.cover || "",
    lrc: item.lrc || "",
  });

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const fillApiUrl = (template, meting) => template
    .replaceAll(":server", encodeURIComponent(meting.server || "netease"))
    .replaceAll(":type", encodeURIComponent(meting.type || "playlist"))
    .replaceAll(":id", encodeURIComponent(meting.id || ""))
    .replaceAll(":r", String(Math.random()));

  const initMusic = () => {
    const widgets = Array.from(document.querySelectorAll("[data-home-music]"));
    if (!widgets.length) return;

    let sharedAudio = window.__moranHomeMusicAudio;
    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.crossOrigin = "anonymous";
      sharedAudio.preload = "none";
      window.__moranHomeMusicAudio = sharedAudio;
    }

    let autoplayClaimed = false;

    widgets.forEach((widget) => {
      if (widget.dataset.musicReady === "1") return;
      widget.dataset.musicReady = "1";

      const config = parseJson(widget.querySelector("[data-home-music-config]"), {});
      const state = {
        playlist: [],
        index: 0,
        playMode: config.playMode || "list",
        autoplay: config.autoplay !== false && !autoplayClaimed,
        randomOnLoad: config.randomOnLoad !== false,
        playing: false,
      };
      if (state.autoplay) autoplayClaimed = true;

      const els = {
        cover: widget.querySelector("[data-music-cover]"),
        title: widget.querySelector("[data-music-title]"),
        artist: widget.querySelector("[data-music-artist]"),
        current: widget.querySelector("[data-music-current]"),
        duration: widget.querySelector("[data-music-duration]"),
        progress: widget.querySelector("[data-music-progress]"),
        progressBar: widget.querySelector("[data-music-progress-bar]"),
        play: widget.querySelector("[data-music-play]"),
        prev: widget.querySelector("[data-music-prev]"),
        next: widget.querySelector("[data-music-next]"),
        mode: widget.querySelector("[data-music-mode]"),
        volume: widget.querySelector("[data-music-volume]"),
        listToggle: widget.querySelector("[data-music-playlist-toggle]"),
        playlist: widget.querySelector("[data-music-playlist]"),
        error: widget.querySelector("[data-music-error]"),
      };

      const showError = (message) => {
        if (!els.error) return;
        els.error.hidden = false;
        els.error.textContent = message;
      };

      const setTrackInfo = (track) => {
        if (!track) return;
        els.title.textContent = track.title;
        els.artist.textContent = track.artist || "未知歌手";
        if (track.cover) {
          els.cover.src = track.cover;
          els.cover.classList.add("is-visible");
        } else {
          els.cover.removeAttribute("src");
          els.cover.classList.remove("is-visible");
        }
        widget.classList.toggle("is-playing", state.playing);
      };

      const renderPlaylist = () => {
        if (!els.playlist) return;
        els.playlist.innerHTML = state.playlist.map((track, index) => `
          <button type="button" class="home-music__playlist-item${index === state.index ? " is-active" : ""}" data-index="${index}">
            ${track.cover ? `<img src="${track.cover}" alt="" loading="lazy">` : `<span>♪</span>`}
            <span><strong>${track.title}</strong><small>${track.artist || "未知歌手"}</small></span>
          </button>
        `).join("");
      };

      const loadTrack = (index, autoplay = false) => {
        if (!state.playlist.length) return;
        state.index = (index + state.playlist.length) % state.playlist.length;
        const track = state.playlist[state.index];
        setTrackInfo(track);
        renderPlaylist();
        if (sharedAudio.src !== track.url) sharedAudio.src = track.url;
        if (autoplay) {
          sharedAudio.play().then(() => {
            state.playing = true;
            updatePlaying();
          }).catch(() => showError("浏览器阻止了有声自动播放，请手动点击一次播放。"));
        }
      };

      const updatePlaying = () => {
        state.playing = !sharedAudio.paused;
        widget.classList.toggle("is-playing", state.playing);
        els.play.textContent = state.playing ? "⏸" : "▶";
        els.play.setAttribute("aria-label", state.playing ? "暂停" : "播放");
        if (els.cover) els.cover.style.animationPlayState = state.playing ? "running" : "paused";
      };

      const playCurrent = () => {
        if (!state.playlist.length) return;
        const track = state.playlist[state.index];
        if (sharedAudio.src !== track.url) sharedAudio.src = track.url;
        sharedAudio.volume = Number(els.volume?.value || config.volume || 0.7);
        sharedAudio.play().then(updatePlaying).catch(() => showError("当前歌曲无法播放，可能是音源限制。"));
      };

      const next = () => {
        if (state.playMode === "random" && state.playlist.length > 1) {
          loadTrack(Math.floor(Math.random() * state.playlist.length), true);
        } else {
          loadTrack(state.index + 1, true);
        }
      };

      const prev = () => loadTrack(state.index - 1, true);

      const bindAudioEvents = () => {
        sharedAudio.addEventListener("timeupdate", () => {
          if (!state.playlist[state.index]) return;
          const duration = sharedAudio.duration || 0;
          const current = sharedAudio.currentTime || 0;
          const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
          els.current.textContent = formatTime(current);
          els.duration.textContent = formatTime(duration);
          els.progressBar.style.width = `${pct}%`;
          els.progress.setAttribute("aria-valuenow", String(Math.round(pct)));
        });
        sharedAudio.addEventListener("play", updatePlaying);
        sharedAudio.addEventListener("pause", updatePlaying);
        sharedAudio.addEventListener("ended", () => {
          if (state.playMode === "one") loadTrack(state.index, true);
          else next();
        });
      };

      const fetchPlaylist = async () => {
        try {
          if (config.mode === "local" && Array.isArray(config.localPlaylist)) {
            state.playlist = config.localPlaylist.map(normalizeTrack).filter((track) => track.url);
          } else {
            const meting = config.meting || {};
            const apis = [meting.api, ...(meting.fallbackApis || [])].filter(Boolean);
            let data = null;
            for (const api of apis) {
              try {
                const res = await fetch(fillApiUrl(api, meting), { cache: "no-store", referrerPolicy: "no-referrer" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                data = await res.json();
                if (Array.isArray(data) && data.length) break;
              } catch {
                data = null;
              }
            }
            state.playlist = Array.isArray(data) ? data.map(normalizeTrack).filter((track) => track.url) : [];
          }
          if (!state.playlist.length) throw new Error("empty playlist");
          const startIndex = state.randomOnLoad
            ? Math.floor(Math.random() * state.playlist.length)
            : 0;
          loadTrack(startIndex, state.autoplay);
          els.artist.textContent = state.playlist[startIndex].artist || "暂未播放";
        } catch {
          els.artist.textContent = "歌单加载失败";
          showError("Meting 歌单加载失败，可在 hugo.toml 配置本地音乐备用。");
        }
      };

      els.play?.addEventListener("click", () => {
        if (sharedAudio.paused) playCurrent();
        else sharedAudio.pause();
      });
      els.prev?.addEventListener("click", prev);
      els.next?.addEventListener("click", next);
      els.mode?.addEventListener("click", () => {
        state.playMode = state.playMode === "list" ? "one" : state.playMode === "one" ? "random" : "list";
        els.mode.textContent = state.playMode === "one" ? "🔂" : state.playMode === "random" ? "🔀" : "↻";
      });
      els.volume?.addEventListener("input", () => {
        sharedAudio.volume = Number(els.volume.value);
      });
      els.progress?.addEventListener("click", (event) => {
        const rect = els.progress.getBoundingClientRect();
        const pct = (event.clientX - rect.left) / rect.width;
        if (Number.isFinite(sharedAudio.duration)) sharedAudio.currentTime = Math.max(0, Math.min(1, pct)) * sharedAudio.duration;
      });
      els.listToggle?.addEventListener("click", () => {
        els.playlist.hidden = !els.playlist.hidden;
      });
      els.playlist?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-index]");
        if (!item) return;
        loadTrack(Number(item.dataset.index), true);
      });

      bindAudioEvents();
      fetchPlaylist();
    });
  };

  const initCalendar = () => {
    document.querySelectorAll("[data-home-calendar]").forEach((root) => {
      if (root.dataset.calendarReady === "1") return;
      root.dataset.calendarReady = "1";
      const posts = parseJson(root.querySelector("[data-calendar-posts-json]"), []).map((post) => ({
        ...post,
        dateObj: new Date(`${post.date}T00:00:00`),
      }));
      const map = new Map();
      posts.forEach((post) => {
        if (!map.has(post.date)) map.set(post.date, []);
        map.get(post.date).push(post);
      });

      let display = new Date();
      display.setDate(1);
      const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const grid = root.querySelector("[data-calendar-grid]");
      const current = root.querySelector("[data-calendar-current]");
      const heatmap = root.querySelector("[data-calendar-heatmap]");
      const postsBox = root.querySelector("[data-calendar-posts]");

      const showPosts = (dateKey) => {
        const list = map.get(dateKey) || [];
        postsBox.hidden = !list.length;
        postsBox.innerHTML = list.map((post) => `<a href="${post.url}"><strong>${post.title}</strong><small>${post.date}</small></a>`).join("");
      };

      const renderHeatmap = () => {
        const year = display.getFullYear();
        const counts = Array.from({ length: 48 }, () => 0);
        posts.forEach((post) => {
          if (post.dateObj.getFullYear() !== year) return;
          const month = post.dateObj.getMonth();
          const week = Math.min(3, Math.floor((post.dateObj.getDate() - 1) / 7));
          counts[week * 12 + month] += 1;
        });
        heatmap.innerHTML = counts.map((count, index) => {
          const level = Math.min(4, count);
          const month = (index % 12) + 1;
          const week = Math.floor(index / 12) + 1;
          return `<button type="button" data-month="${month - 1}" data-level="${level}" title="${month}月第${week}周：${count}篇"></button>`;
        }).join("");
      };

      const render = () => {
        const year = display.getFullYear();
        const month = display.getMonth();
        current.textContent = `${year} ${monthNames[month]}`;
        const firstDay = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();
        const todayKey = new Date().toISOString().slice(0, 10);
        const cells = [];
        for (let i = 0; i < firstDay; i += 1) cells.push(`<span class="is-empty"></span>`);
        for (let day = 1; day <= days; day += 1) {
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = (map.get(key) || []).length;
          cells.push(`<button type="button" class="${key === todayKey ? "is-today" : ""} ${count ? "has-post" : ""}" data-date="${key}" title="${count ? `${count} 篇文章` : key}">${day}${count ? `<small>${count}</small>` : ""}</button>`);
        }
        grid.innerHTML = cells.join("");
        renderHeatmap();
        postsBox.hidden = true;
        postsBox.innerHTML = "";
      };

      root.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
        display.setMonth(display.getMonth() - 1);
        render();
      });
      root.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
        display.setMonth(display.getMonth() + 1);
        render();
      });
      root.querySelector("[data-calendar-reset]")?.addEventListener("click", () => {
        display = new Date();
        display.setDate(1);
        render();
      });
      grid.addEventListener("click", (event) => {
        const day = event.target.closest("[data-date]");
        if (day) showPosts(day.dataset.date);
      });
      heatmap.addEventListener("click", (event) => {
        const cell = event.target.closest("[data-month]");
        if (!cell) return;
        display.setMonth(Number(cell.dataset.month));
        render();
      });
      render();
    });
  };

  const initHueAndPanels = () => {
    const root = document.documentElement;
    const defaultHue = Number.parseInt(getComputedStyle(root).getPropertyValue("--hue"), 10) || 262;
    const normalizeHue = (value) => {
      let hue = Number.parseInt(value, 10);
      if (!Number.isFinite(hue)) hue = defaultHue;
      return ((hue % 360) + 360) % 360;
    };
    const applyHue = (value, persist = true) => {
      const hue = normalizeHue(value);
      root.style.setProperty("--hue", String(hue));
      document.querySelectorAll("[data-hue-range]").forEach((range) => {
        range.value = String(hue);
      });
      document.querySelectorAll("[data-hue-preset]").forEach((btn) => {
        btn.classList.toggle("is-active", normalizeHue(btn.dataset.huePreset) === hue);
      });
      if (persist) {
        try { localStorage.setItem("ink-hue", String(hue)); } catch {}
      }
    };

    try {
      const stored = localStorage.getItem("ink-hue");
      if (stored !== null) applyHue(stored, false);
      else applyHue(defaultHue, false);
    } catch {
      applyHue(defaultHue, false);
    }

    document.querySelectorAll("[data-hue-range]").forEach((range) => {
      range.addEventListener("input", () => applyHue(range.value));
    });
    document.querySelectorAll("[data-hue-preset]").forEach((btn) => {
      btn.addEventListener("click", () => applyHue(btn.dataset.huePreset));
    });
    document.querySelectorAll("[data-hue-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        try { localStorage.removeItem("ink-hue"); } catch {}
        applyHue(defaultHue, false);
      });
    });

    const bindPanel = (buttonSelector, panelSelector) => {
      const button = document.querySelector(buttonSelector);
      const panel = document.querySelector(panelSelector);
      if (!button || !panel) return;
      const close = () => {
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
      };
      const open = () => {
        document.querySelectorAll(".header-floating-panel").forEach((other) => {
          if (other !== panel) other.hidden = true;
        });
        document.querySelectorAll("[data-header-music-toggle], [data-hue-toggle]").forEach((other) => {
          if (other !== button) other.setAttribute("aria-expanded", "false");
        });
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
      };
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.hidden ? open() : close();
      });
      panel.addEventListener("click", (event) => event.stopPropagation());
      document.addEventListener("click", close);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    };

    bindPanel("[data-header-music-toggle]", "[data-header-music-panel]");
    bindPanel("[data-hue-toggle]", "[data-hue-panel]");
  };

  const init = () => {
    initStats();
    initMusic();
    initCalendar();
    initHueAndPanels();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
