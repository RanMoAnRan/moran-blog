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

  const MUSIC_STATE_KEY = "moran-home-music-state";

  const getTrackKey = (track) => [track?.url || "", track?.title || "", track?.artist || ""].join("|");

  const readMusicState = () => {
    try {
      return JSON.parse(window.localStorage.getItem(MUSIC_STATE_KEY) || "null") || {};
    } catch {
      return {};
    }
  };

  const writeMusicState = (state) => {
    try {
      window.localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify({ ...readMusicState(), ...state, updatedAt: Date.now() }));
    } catch {
      // localStorage may be unavailable in private browsing.
    }
  };

  const resolveTrackUrl = (url) => {
    try {
      return new URL(url || "", window.location.href).href;
    } catch {
      return url || "";
    }
  };

  const audioHasTrack = (audio, url) => Boolean(audio?.src) && audio.src === resolveTrackUrl(url);

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const getTrackInitial = (track) => {
    const first = Array.from(String(track?.title || "").trim()).find((char) => /[\p{L}\p{N}]/u.test(char));
    return first ? first.toLocaleUpperCase("zh-CN") : "♪";
  };

  const sanitizeMediaUrl = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href;
      }
    } catch {
      // ignore invalid URLs
    }
    return "";
  };

  const validPlayModes = new Set(["list", "one", "random"]);
  const playModeMeta = {
    list: { icon: "∞", title: "列表循环" },
    one: { icon: "①", title: "单曲循环" },
    random: { icon: "⌘", title: "随机播放" },
  };

  const clampVolume = (value, fallback = 0.7) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(1, Math.max(0, n));
  };

  const getMusicEngine = () => {
    if (window.__moranMusicEngine) return window.__moranMusicEngine;

    const audio = window.__moranHomeMusicAudio || new Audio();
    audio.removeAttribute("crossorigin");
    audio.preload = "none";
    window.__moranHomeMusicAudio = audio;

    const engine = {
      audio,
      playlist: [],
      index: 0,
      playMode: "list",
      volume: 0.7,
      sourceKey: "",
      loaded: false,
      loadingPromise: null,
      loadingSourceKey: "",
      errorMessage: "",
      controllers: [],
      lastTimeupdateSave: 0,
    };

    const activeControllers = () => {
      engine.controllers = engine.controllers.filter((ctrl) => ctrl?.widget && document.contains(ctrl.widget));
      return engine.controllers;
    };

    const persistState = (wasPlaying = !audio.paused) => {
      const currentTrack = engine.playlist[engine.index];
      if (!currentTrack) return;
      writeMusicState({
        sourceKey: engine.sourceKey,
        trackKey: getTrackKey(currentTrack),
        index: engine.index,
        currentTime: audio.currentTime || 0,
        playMode: engine.playMode,
        volume: engine.volume,
        wasPlaying,
      });
    };

    const syncErrorUI = () => {
      activeControllers().forEach((ctrl) => {
        if (!ctrl.els.error) return;
        ctrl.els.error.hidden = !engine.errorMessage;
        ctrl.els.error.textContent = engine.errorMessage;
      });
    };

    const syncPlayingUI = () => {
      const playing = !audio.paused;
      activeControllers().forEach((ctrl) => {
        ctrl.widget.classList.toggle("is-playing", playing);
        if (ctrl.els.play) {
          ctrl.els.play.textContent = playing ? "⏸" : "▶";
          ctrl.els.play.setAttribute("aria-label", playing ? "暂停" : "播放");
        }
        if (ctrl.els.cover) {
          ctrl.els.cover.style.animationPlayState = playing ? "running" : "paused";
        }
      });
    };

    const syncModeUI = () => {
      const meta = playModeMeta[engine.playMode] || playModeMeta.list;
      activeControllers().forEach((ctrl) => {
        if (!ctrl.els.mode) return;
        ctrl.els.mode.textContent = meta.icon;
        ctrl.els.mode.title = meta.title;
        ctrl.els.mode.setAttribute("aria-label", meta.title);
      });
    };

    const syncVolumeUI = () => {
      activeControllers().forEach((ctrl) => {
        if (!ctrl.els.volume) return;
        ctrl.els.volume.value = String(engine.volume);
      });
    };

    const syncTimeUI = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
      activeControllers().forEach((ctrl) => {
        if (ctrl.els.current) ctrl.els.current.textContent = formatTime(current);
        if (ctrl.els.duration) ctrl.els.duration.textContent = formatTime(duration);
        if (ctrl.els.progressBar) ctrl.els.progressBar.style.width = `${pct}%`;
        if (ctrl.els.progress) ctrl.els.progress.setAttribute("aria-valuenow", String(Math.round(pct)));
      });
    };

    const syncTrackToController = (ctrl) => {
      const track = engine.playlist[engine.index];
      if (!track) return;
      if (ctrl.els.title) ctrl.els.title.textContent = track.title;
      if (ctrl.els.artist) ctrl.els.artist.textContent = track.artist || "未知歌手";
      if (ctrl.els.cover) {
        const safeCover = sanitizeMediaUrl(track.cover);
        if (safeCover) {
          ctrl.els.cover.onload = () => ctrl.els.cover.classList.add("is-visible");
          ctrl.els.cover.onerror = () => {
            ctrl.els.cover.classList.remove("is-visible");
            ctrl.els.cover.removeAttribute("src");
          };
          if (ctrl.els.cover.getAttribute("src") !== safeCover) {
            ctrl.els.cover.classList.remove("is-visible");
            ctrl.els.cover.src = safeCover;
          } else if (ctrl.els.cover.complete && ctrl.els.cover.naturalWidth > 0) {
            ctrl.els.cover.classList.add("is-visible");
          }
        } else {
          ctrl.els.cover.classList.remove("is-visible");
          ctrl.els.cover.removeAttribute("src");
        }
      }
      if (ctrl.els.playlist) {
        ctrl.els.playlist.innerHTML = engine.playlist.map((item, idx) => {
          const cover = sanitizeMediaUrl(item.cover);
          return `
            <button type="button" class="home-music__playlist-item${idx === engine.index ? " is-active" : ""}" data-index="${idx}">
              ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : `<span class="home-music__playlist-initial" aria-hidden="true">${escapeHtml(getTrackInitial(item))}</span>`}
              <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.artist || "未知歌手")}</small></span>
            </button>
          `;
        }).join("");
      }
    };

    const syncAllUI = () => {
      activeControllers().forEach((ctrl) => syncTrackToController(ctrl));
      syncModeUI();
      syncVolumeUI();
      syncPlayingUI();
      syncTimeUI();
      syncErrorUI();
    };

    const setError = (message) => {
      engine.errorMessage = message || "";
      syncErrorUI();
    };

    const loadTrack = (index, autoplay = false) => {
      if (!engine.playlist.length) return;
      engine.index = (index + engine.playlist.length) % engine.playlist.length;
      const track = engine.playlist[engine.index];
      window.__moranHomeMusicSourceKey = engine.sourceKey;
      setError("");
      audio.volume = engine.volume;
      if (!audioHasTrack(audio, track.url)) audio.src = track.url;
      syncAllUI();
      persistState(autoplay ? true : !audio.paused);
      if (autoplay) {
        audio.play().then(() => {
          setError("");
          syncPlayingUI();
          persistState(true);
        }).catch(() => {
          syncPlayingUI();
        });
      }
    };

    const playCurrent = () => {
      if (!engine.playlist.length) return;
      const track = engine.playlist[engine.index];
      window.__moranHomeMusicSourceKey = engine.sourceKey;
      setError("");
      audio.volume = engine.volume;
      if (!audioHasTrack(audio, track.url)) audio.src = track.url;
      syncAllUI();
      persistState(true);
      audio.play().then(() => {
        setError("");
        syncPlayingUI();
        persistState(true);
      }).catch(() => {
        setError("当前歌曲无法播放，可能是音源限制。");
        syncPlayingUI();
      });
    };

    const next = () => {
      if (!engine.playlist.length) return;
      if (engine.playMode === "random" && engine.playlist.length > 1) {
        let candidate = Math.floor(Math.random() * engine.playlist.length);
        if (candidate === engine.index) candidate = (engine.index + 1) % engine.playlist.length;
        loadTrack(candidate, true);
      } else {
        loadTrack(engine.index + 1, true);
      }
    };

    const prev = () => {
      if (!engine.playlist.length) return;
      loadTrack(engine.index - 1, true);
    };

    const cyclePlayMode = () => {
      engine.playMode = engine.playMode === "list" ? "one" : engine.playMode === "one" ? "random" : "list";
      syncModeUI();
      persistState();
    };

    const setVolume = (value) => {
      engine.volume = clampVolume(value, engine.volume);
      audio.volume = engine.volume;
      syncVolumeUI();
      persistState();
    };

    audio.addEventListener("timeupdate", () => {
      if (!engine.playlist[engine.index]) return;
      syncTimeUI();
      const now = Date.now();
      if (now - engine.lastTimeupdateSave > 3000) {
        engine.lastTimeupdateSave = now;
        persistState();
      }
    });

    audio.addEventListener("loadedmetadata", () => {
      syncTimeUI();
    });

    audio.addEventListener("play", () => {
      setError("");
      syncPlayingUI();
      persistState(true);
    });

    audio.addEventListener("pause", () => {
      syncPlayingUI();
      persistState(false);
    });

    audio.addEventListener("ended", () => {
      if (!engine.playlist.length) return;
      if (engine.playMode === "one") loadTrack(engine.index, true);
      else next();
    });

    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      setError("当前歌曲无法播放，可能是音源限制。");
      syncPlayingUI();
    });

    engine.syncController = (ctrl) => {
      if (engine.playlist.length) {
        syncTrackToController(ctrl);
      }
      syncModeUI();
      syncVolumeUI();
      syncPlayingUI();
      syncTimeUI();
      syncErrorUI();
    };
    engine.loadTrack = loadTrack;
    engine.playCurrent = playCurrent;
    engine.next = next;
    engine.prev = prev;
    engine.cyclePlayMode = cyclePlayMode;
    engine.setVolume = setVolume;
    engine.setError = setError;
    engine.syncAllUI = syncAllUI;

    window.__moranMusicEngine = engine;
    return engine;
  };

  const initMusic = () => {
    const widgets = Array.from(document.querySelectorAll("[data-home-music]"));
    if (!widgets.length) return;

    const engine = getMusicEngine();
    const sharedAudio = engine.audio;
    const persisted = readMusicState();

    const ensurePlaylistLoaded = async (config, sourceKey) => {
      if (engine.loaded && engine.sourceKey === sourceKey && engine.playlist.length) {
        engine.syncAllUI();
        return;
      }
      if (engine.loadingPromise && engine.loadingSourceKey === sourceKey) {
        await engine.loadingPromise;
        engine.syncAllUI();
        return;
      }

      engine.loadingSourceKey = sourceKey;
      engine.loadingPromise = (async () => {
        const localTracks = Array.isArray(config.localPlaylist)
          ? config.localPlaylist.map(normalizeTrack).filter((track) => track.url)
          : [];

        let playlist = [];
        if (config.mode === "local") {
          playlist = localTracks;
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
          playlist = Array.isArray(data) ? data.map(normalizeTrack).filter((track) => track.url) : [];
          if (!playlist.length && localTracks.length) {
            playlist = localTracks;
          }
        }

        if (!playlist.length) throw new Error("empty playlist");

        engine.playlist = playlist;
        engine.sourceKey = sourceKey;
        engine.loaded = true;
        engine.playMode = validPlayModes.has(persisted.playMode)
          ? persisted.playMode
          : (validPlayModes.has(config.playMode) ? config.playMode : "list");
        engine.volume = persisted.sourceKey === sourceKey && Number.isFinite(Number(persisted.volume))
          ? clampVolume(persisted.volume, clampVolume(config.volume, 0.7))
          : clampVolume(config.volume, 0.7);
        sharedAudio.volume = engine.volume;

        const restoredIndex = persisted.sourceKey === sourceKey
          ? playlist.findIndex((track) => getTrackKey(track) === persisted.trackKey)
          : -1;
        const currentAudioIndex = sharedAudio.src
          ? playlist.findIndex((track) => audioHasTrack(sharedAudio, track.url))
          : -1;
        const shouldRestore = restoredIndex >= 0;
        const shouldReuseCurrentAudio = currentAudioIndex >= 0 && window.__moranHomeMusicSourceKey === sourceKey;
        const startIndex = shouldReuseCurrentAudio
          ? currentAudioIndex
          : shouldRestore
            ? restoredIndex
            : (config.randomOnLoad !== false ? Math.floor(Math.random() * playlist.length) : 0);

        const hasSavedPlayingState = shouldRestore && typeof persisted.wasPlaying === "boolean";
        const shouldAutoplay = !shouldReuseCurrentAudio && (
          hasSavedPlayingState ? persisted.wasPlaying : config.autoplay !== false
        );

        if (shouldReuseCurrentAudio) {
          engine.index = startIndex;
          engine.syncAllUI();
        } else {
          engine.loadTrack(startIndex, shouldAutoplay);
          if (shouldRestore && Number(persisted.currentTime) > 0) {
            const applySavedTime = () => {
              if (Number.isFinite(sharedAudio.duration) && sharedAudio.duration > 1) {
                sharedAudio.currentTime = Math.min(Number(persisted.currentTime), Math.max(0, sharedAudio.duration - 1));
              }
            };
            if (sharedAudio.readyState >= 1) applySavedTime();
            else sharedAudio.addEventListener("loadedmetadata", applySavedTime, { once: true });
          }
        }
      })();

      try {
        await engine.loadingPromise;
      } catch {
        engine.loadingSourceKey = "";
        engine.controllers.forEach((ctrl) => {
          if (ctrl.els.artist && !engine.playlist.length) ctrl.els.artist.textContent = "歌单加载失败";
        });
        engine.setError("Meting 歌单加载失败，可在 data/music.toml 或 hugo.toml 配置本地音乐备用。");
      } finally {
        engine.loadingPromise = null;
      }
    };

    widgets.forEach((widget) => {
      if (widget.dataset.musicReady === "1") return;
      widget.dataset.musicReady = "1";

      const config = parseJson(widget.querySelector("[data-home-music-config]"), {});
      const sourceKey = JSON.stringify({ mode: config.mode || "meting", meting: config.meting || {}, local: (config.localPlaylist || []).map(getTrackKey) });
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

      const controller = { widget, sourceKey, els };
      engine.controllers.push(controller);

      els.play?.addEventListener("click", () => {
        if (sharedAudio.paused) engine.playCurrent();
        else sharedAudio.pause();
      });
      els.prev?.addEventListener("click", engine.prev);
      els.next?.addEventListener("click", engine.next);
      els.mode?.addEventListener("click", engine.cyclePlayMode);
      els.volume?.addEventListener("input", () => {
        engine.setVolume(els.volume.value);
      });
      els.progress?.addEventListener("click", (event) => {
        const rect = els.progress.getBoundingClientRect();
        const pct = (event.clientX - rect.left) / rect.width;
        if (Number.isFinite(sharedAudio.duration) && rect.width > 0) {
          sharedAudio.currentTime = Math.max(0, Math.min(1, pct)) * sharedAudio.duration;
        }
      });
      els.listToggle?.addEventListener("click", () => {
        if (els.playlist) els.playlist.hidden = !els.playlist.hidden;
      });
      els.playlist?.addEventListener("click", (event) => {
        const item = event.target.closest("[data-index]");
        if (!item) return;
        engine.loadTrack(Number(item.dataset.index), true);
      });

      engine.syncController(controller);
      ensurePlaylistLoaded(config, sourceKey);
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
      let viewMode = "days";
      const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
      const weekdays = root.querySelector(".home-calendar__weekdays");
      const grid = root.querySelector("[data-calendar-grid]");
      const current = root.querySelector("[data-calendar-current]");
      const heatmap = root.querySelector("[data-calendar-heatmap]");
      const postsBox = root.querySelector("[data-calendar-posts]");

      const showPosts = (dateKey) => {
        const list = map.get(dateKey) || [];
        postsBox.hidden = !list.length;
        postsBox.innerHTML = list
          .map((post) => `<a href="${escapeHtml(post.url)}"><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.date)}</small></a>`)
          .join("");
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
        const nowDate = new Date();
        const todayKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;

        if (viewMode === "months") {
          current.textContent = `${year} 年`;
          if (weekdays) weekdays.hidden = true;
          grid.classList.add("is-months");
          const monthCounts = Array.from({ length: 12 }, () => 0);
          posts.forEach((post) => {
            if (post.dateObj.getFullYear() === year) monthCounts[post.dateObj.getMonth()] += 1;
          });
          grid.innerHTML = monthNames.map((label, idx) => {
            const count = monthCounts[idx];
            const isCurrent = year === nowDate.getFullYear() && idx === nowDate.getMonth();
            const isSelected = idx === month;
            return `<button type="button" class="${isCurrent ? "is-today" : ""} ${count ? "has-post" : ""} ${isSelected ? "is-selected" : ""}" data-pick-month="${idx}" title="${year} 年 ${label}${count ? `：${count} 篇文章` : ""}">${label}${count ? `<small>${count}</small>` : ""}</button>`;
          }).join("");
        } else {
          current.textContent = `${year} ${monthNames[month]}`;
          if (weekdays) weekdays.hidden = false;
          grid.classList.remove("is-months");
          const firstDay = new Date(year, month, 1).getDay();
          const days = new Date(year, month + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDay; i += 1) cells.push(`<span class="is-empty"></span>`);
          for (let day = 1; day <= days; day += 1) {
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const count = (map.get(key) || []).length;
            cells.push(`<button type="button" class="${key === todayKey ? "is-today" : ""} ${count ? "has-post" : ""}" data-date="${key}" title="${count ? `${count} 篇文章` : key}">${day}${count ? `<small>${count}</small>` : ""}</button>`);
          }
          grid.innerHTML = cells.join("");
        }
        renderHeatmap();
        postsBox.hidden = true;
        postsBox.innerHTML = "";
      };

      current?.addEventListener("click", () => {
        viewMode = viewMode === "days" ? "months" : "days";
        render();
      });
      root.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
        if (viewMode === "months") display.setFullYear(display.getFullYear() - 1);
        else display.setMonth(display.getMonth() - 1);
        render();
      });
      root.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
        if (viewMode === "months") display.setFullYear(display.getFullYear() + 1);
        else display.setMonth(display.getMonth() + 1);
        render();
      });
      root.querySelector("[data-calendar-reset]")?.addEventListener("click", () => {
        display = new Date();
        display.setDate(1);
        viewMode = "days";
        render();
      });
      grid.addEventListener("click", (event) => {
        const monthBtn = event.target.closest("[data-pick-month]");
        if (monthBtn) {
          display.setMonth(Number(monthBtn.dataset.pickMonth));
          viewMode = "days";
          render();
          return;
        }
        const day = event.target.closest("[data-date]");
        if (day) showPosts(day.dataset.date);
      });
      heatmap.addEventListener("click", (event) => {
        const cell = event.target.closest("[data-month]");
        if (!cell) return;
        display.setMonth(Number(cell.dataset.month));
        viewMode = "days";
        render();
      });
      render();
    });
  };


  const initHomeSidebars = () => {
    window.__moranHomeSidebarsCleanup?.();

    const sidebars = Array.from(document.querySelectorAll(".home-sidebar"));
    const reset = () => {
      sidebars.forEach((sidebar) => {
        sidebar.classList.remove("is-fixed");
        sidebar.style.removeProperty("--home-sidebar-fixed-left");
        sidebar.style.removeProperty("--home-sidebar-fixed-width");
        sidebar.style.removeProperty("--home-sidebar-placeholder-height");
      });
    };

    reset();
    window.__moranHomeSidebarsCleanup = reset;
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

  const initPage = () => {
    initStats();
    initMusic();
    initCalendar();
    initHomeSidebars();
  };

  const initOnce = () => {
    initPage();
    initHueAndPanels();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initOnce);
  else initOnce();

  document.addEventListener("moran:page-load", initPage);
})();
