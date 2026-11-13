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

  const isValidTrack = (track) => {
    if (!track || !track.url) return false;
    if (/[?&]id=undefined(?:&|$)/i.test(track.url)) return false;
    if (track.title === "未知歌曲" && !track.artist) return false;
    return true;
  };

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
  const getTrackDedupKey = (track) => [
    String(track?.title || "").trim().toLowerCase(),
    String(track?.artist || "").trim().toLowerCase(),
  ].join("|");
  const PLAYLIST_BATCH_SIZE = 20;

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
    list: { title: "列表循环" },
    one: { title: "单曲循环" },
    random: { title: "随机播放" },
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
      playlistCache: new Map(),
      index: 0,
      renderedCount: 0,
      playMode: "list",
      volume: 0.7,
      sourceKey: "",
      activeSourceId: "",
      sources: new Map(),
      config: {},
      loaded: false,
      loadingPromise: null,
      loadingSourceKey: "",
      loadToken: 0,
      consecutiveErrors: 0,
      autoAdvanceOnError: false,
      errorSkipTimer: 0,
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
      writeMusicState({
        activeSourceId: engine.activeSourceId,
        sourceKey: engine.sourceKey,
        trackKey: currentTrack ? getTrackKey(currentTrack) : "",
        index: engine.index,
        currentTime: audio.currentTime || 0,
        playMode: engine.playMode,
        volume: engine.volume,
        muted: audio.muted,
        wasPlaying,
      });
    };

    const syncSourceUI = () => {
      activeControllers().forEach((ctrl) => {
        ctrl.widget.querySelectorAll("[data-music-source]").forEach((btn) => {
          const active = btn.getAttribute("data-music-source") === engine.activeSourceId;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
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
      const mode = Object.hasOwn(playModeMeta, engine.playMode) ? engine.playMode : "list";
      const meta = playModeMeta[mode];
      activeControllers().forEach((ctrl) => {
        if (!ctrl.els.mode) return;
        ctrl.els.mode.querySelectorAll("[data-music-mode-icon]").forEach((icon) => {
          icon.toggleAttribute("hidden", icon.dataset.musicModeIcon !== mode);
        });
        ctrl.els.mode.title = meta.title;
        ctrl.els.mode.setAttribute("aria-label", meta.title);
      });
    };

    const syncVolumeUI = () => {
      const muted = audio.muted || engine.volume === 0;
      activeControllers().forEach((ctrl) => {
        if (ctrl.els.volume) ctrl.els.volume.value = String(muted ? 0 : engine.volume);
        if (ctrl.els.mute) {
          ctrl.els.mute.classList.toggle("is-muted", muted);
          ctrl.els.mute.setAttribute("aria-pressed", String(muted));
          ctrl.els.mute.setAttribute("aria-label", muted ? "取消静音" : "静音");
          ctrl.els.mute.title = muted ? "取消静音" : "静音";
        }
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

    const buildTrackItemHTML = (item, idx) => {
      const cover = sanitizeMediaUrl(item.cover);
      return `
        <button type="button" class="home-music__playlist-item${idx === engine.index ? " is-active" : ""}" data-index="${idx}">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : `<span class="home-music__playlist-initial" aria-hidden="true">${escapeHtml(getTrackInitial(item))}</span>`}
          <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.artist || "未知歌手")}</small></span>
        </button>
      `;
    };

    const buildPlaylistFooterHTML = () => {
      const total = engine.playlist.length;
      if (!total) return "";
      const meta = engine.playlistCache.get(engine.sourceKey);
      const hasMoreLocal = engine.renderedCount < total;
      const hasMoreQueue = Boolean(meta && meta.extraQueue.length > 0);
      if (meta?.loadingMore) {
        return '<span class="home-music__playlist-status">正在加载更多歌曲…</span>';
      }
      if (hasMoreLocal || hasMoreQueue) {
        return `<button type="button" class="home-music__playlist-more" data-playlist-more>滑动或点击加载更多（${engine.renderedCount}/${total}${hasMoreQueue ? "+" : ""}）</button>`;
      }
      return `<span class="home-music__playlist-status">已加载全部 ${total} 首</span>`;
    };

    const syncPlaylistFooter = (ctrl) => {
      const footer = ctrl.els.playlist?.querySelector("[data-playlist-footer]");
      if (footer) footer.innerHTML = buildPlaylistFooterHTML();
    };

    const syncPlaylistActiveItem = (ctrl) => {
      if (!ctrl.els.playlist) return;
      ctrl.els.playlist.querySelectorAll("[data-index]").forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.dataset.index) === engine.index);
      });
    };

    const syncPlaylistDOM = (ctrl) => {
      if (!ctrl.els.playlist) return;
      const targetCount = Math.min(engine.playlist.length, Math.max(engine.renderedCount, 0));
      if (ctrl.renderedSourceKey !== engine.sourceKey || ctrl.renderedCount > targetCount) {
        const itemsHtml = engine.playlist.slice(0, targetCount).map((item, idx) => buildTrackItemHTML(item, idx)).join("");
        ctrl.els.playlist.innerHTML = `${itemsHtml}<div class="home-music__playlist-footer" data-playlist-footer>${buildPlaylistFooterHTML()}</div>`;
        ctrl.renderedSourceKey = engine.sourceKey;
        ctrl.renderedCount = targetCount;
        return;
      }

      if (ctrl.renderedCount < targetCount) {
        const footer = ctrl.els.playlist.querySelector("[data-playlist-footer]");
        const html = engine.playlist.slice(ctrl.renderedCount, targetCount)
          .map((item, offset) => buildTrackItemHTML(item, ctrl.renderedCount + offset))
          .join("");
        if (footer) footer.insertAdjacentHTML("beforebegin", html);
        else ctrl.els.playlist.insertAdjacentHTML("beforeend", html);
        ctrl.renderedCount = targetCount;
      }
      syncPlaylistActiveItem(ctrl);
      syncPlaylistFooter(ctrl);
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
        syncPlaylistDOM(ctrl);
      }
    };

    const syncAllUI = () => {
      if (engine.playlist.length && engine.index >= engine.renderedCount) {
        engine.renderedCount = Math.min(
          engine.playlist.length,
          Math.ceil((engine.index + 1) / PLAYLIST_BATCH_SIZE) * PLAYLIST_BATCH_SIZE,
        );
      }
      activeControllers().forEach((ctrl) => syncTrackToController(ctrl));
      syncSourceUI();
      syncModeUI();
      syncVolumeUI();
      syncPlayingUI();
      syncTimeUI();
      syncErrorUI();
    };

    engine.syncPlaylistFooters = () => activeControllers().forEach(syncPlaylistFooter);
    engine.syncAllPlaylistDOM = () => activeControllers().forEach(syncPlaylistDOM);

    engine.locateWidgetTrack = (widgetEl, { openList = true } = {}) => {
      const ctrl = activeControllers().find((item) => item.widget === widgetEl);
      const playlistEl = ctrl?.els?.playlist;
      if (!ctrl || !playlistEl) return;
      if (openList) playlistEl.hidden = false;
      if (playlistEl.hidden || !engine.playlist.length) return;
      if (engine.index >= engine.renderedCount) {
        engine.renderedCount = Math.min(
          engine.playlist.length,
          Math.ceil((engine.index + 1) / PLAYLIST_BATCH_SIZE) * PLAYLIST_BATCH_SIZE,
        );
      }
      syncPlaylistDOM(ctrl);
      const activeItem = playlistEl.querySelector(`[data-index="${engine.index}"]`);
      if (!activeItem) return;
      window.requestAnimationFrame(() => {
        const listRect = playlistEl.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const targetTop = playlistEl.scrollTop + (itemRect.top - listRect.top) - (playlistEl.clientHeight - itemRect.height) / 2;
        const maxTop = Math.max(0, playlistEl.scrollHeight - playlistEl.clientHeight);
        const clampedTop = Math.min(maxTop, Math.max(0, targetTop));
        if (typeof playlistEl.scrollTo === "function") {
          playlistEl.scrollTo({ top: clampedTop, behavior: "smooth" });
        } else {
          playlistEl.scrollTop = clampedTop;
        }
        activeItem.classList.remove("is-located");
        void activeItem.offsetWidth;
        activeItem.classList.add("is-located");
        if (ctrl.locateTimer) window.clearTimeout(ctrl.locateTimer);
        ctrl.locateTimer = window.setTimeout(() => {
          activeItem.classList.remove("is-located");
        }, 1400);
      });
    };

    const setError = (message) => {
      engine.errorMessage = message || "";
      syncErrorUI();
    };

    const loadTrack = (index, autoplay = false, { keepError = false, resetErrors = true } = {}) => {
      if (!engine.playlist.length) return;
      if (engine.errorSkipTimer) {
        window.clearTimeout(engine.errorSkipTimer);
        engine.errorSkipTimer = 0;
      }
      if (resetErrors) engine.consecutiveErrors = 0;
      engine.autoAdvanceOnError = Boolean(autoplay);
      engine.index = (index + engine.playlist.length) % engine.playlist.length;
      const track = engine.playlist[engine.index];
      window.__moranHomeMusicSourceKey = engine.sourceKey;
      if (!keepError) setError("");
      audio.volume = engine.volume;
      if (!audioHasTrack(audio, track.url)) audio.src = track.url;
      syncAllUI();
      persistState(autoplay ? true : !audio.paused);
      if (autoplay) {
        audio.play().then(() => {
          syncPlayingUI();
          persistState(true);
        }).catch(() => {
          syncPlayingUI();
        });
      }
    };

    const playCurrent = () => {
      if (!engine.playlist.length) return;
      if (engine.errorSkipTimer) {
        window.clearTimeout(engine.errorSkipTimer);
        engine.errorSkipTimer = 0;
      }
      engine.consecutiveErrors = 0;
      engine.autoAdvanceOnError = true;
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
      }).catch((err) => {
        if (err?.name !== "NotAllowedError" && !audio.error && !engine.errorMessage) {
          setError("当前歌曲无法播放（可能为版权/VIP 限制），请切歌或切换音源。");
        }
        syncPlayingUI();
      });
    };

    const next = (options = {}) => {
      if (!engine.playlist.length) return;
      if (engine.playMode === "random" && engine.playlist.length > 1) {
        let candidate = Math.floor(Math.random() * engine.playlist.length);
        if (candidate === engine.index) candidate = (engine.index + 1) % engine.playlist.length;
        loadTrack(candidate, true, options);
      } else {
        loadTrack(engine.index + 1, true, options);
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
      audio.muted = false;
      syncVolumeUI();
      persistState();
    };

    const toggleMute = () => {
      if (engine.volume === 0) {
        setVolume(clampVolume(engine.config.volume, 0.7) || 0.7);
        return;
      }
      audio.muted = !audio.muted;
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
      syncPlayingUI();
      persistState(true);
    });

    audio.addEventListener("playing", () => {
      engine.consecutiveErrors = 0;
      setError("");
    });

    audio.addEventListener("canplay", () => {
      engine.consecutiveErrors = 0;
      setError("");
    });

    audio.addEventListener("pause", () => {
      syncPlayingUI();
      persistState(false);
    });

    audio.addEventListener("ended", () => {
      if (!engine.playlist.length) return;
      if (engine.playMode === "one") loadTrack(engine.index, true, { resetErrors: false });
      else next();
    });

    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      engine.consecutiveErrors += 1;
      const failedTitle = engine.playlist[engine.index]?.title || "当前歌曲";
      const maxAutoSkip = Math.min(5, Math.max(0, engine.playlist.length - 1));
      if (engine.autoAdvanceOnError && engine.consecutiveErrors <= maxAutoSkip) {
        const skipSourceKey = engine.sourceKey;
        setError(`《${failedTitle}》暂不可用，已自动切至下一首…`);
        if (engine.errorSkipTimer) window.clearTimeout(engine.errorSkipTimer);
        engine.errorSkipTimer = window.setTimeout(() => {
          engine.errorSkipTimer = 0;
          if (!engine.autoAdvanceOnError || engine.sourceKey !== skipSourceKey) return;
          next({ keepError: true, resetErrors: false });
        }, 260);
      } else {
        engine.autoAdvanceOnError = false;
        setError("当前歌曲无法播放（可能为版权/VIP 限制），请手动切歌或切换音源。");
      }
      syncPlayingUI();
    });

    engine.syncController = (ctrl) => {
      if (engine.playlist.length) {
        syncTrackToController(ctrl);
      }
      syncSourceUI();
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
    engine.toggleMute = toggleMute;
    engine.setError = setError;
    engine.syncSourceUI = syncSourceUI;
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

    const buildSourcesMap = (config) => {
      const map = new Map();
      const list = Array.isArray(config.sources) ? config.sources : [];
      list.forEach((src) => {
        if (src && src.id) map.set(src.id, src);
      });
      if (!map.size) {
        if (Array.isArray(config.localPlaylist) && config.localPlaylist.length) {
          map.set("local", { id: "local", label: "内置", mode: "local" });
        }
        if (config.meting) {
          map.set(config.meting.server || "netease", {
            id: config.meting.server || "netease",
            label: config.meting.server === "tencent" ? "QQ" : "网易云",
            mode: "meting",
            meting: config.meting,
          });
        }
      }
      return map;
    };

    const getSourceSignature = (sourceId, srcConfig, config) => JSON.stringify({
      sourceId,
      mode: srcConfig?.mode || config.mode || "meting",
      meting: srcConfig?.meting || config.meting || {},
      local: srcConfig?.mode === "local" ? (config.localPlaylist || []).map(getTrackKey) : [],
    });

    const fetchSourceTracks = async (sourceConfig, config) => {
      const localTracks = Array.isArray(config.localPlaylist)
        ? config.localPlaylist.map(normalizeTrack).filter(isValidTrack)
        : [];

      if (sourceConfig?.mode === "local") {
        return localTracks;
      }

      const meting = sourceConfig?.meting || config.meting || {};
      const apis = [meting.api, ...(meting.fallbackApis || [])].filter(Boolean);
      for (const api of apis) {
        try {
          const res = await fetch(fillApiUrl(api, meting), { cache: "no-store", referrerPolicy: "no-referrer" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const tracks = Array.isArray(data) ? data.map(normalizeTrack).filter(isValidTrack) : [];
          if (tracks.length) return tracks;
        } catch {
          // try next fallback api
        }
      }
      return [];
    };

    const loadSource = async (sourceId, config, { userTriggered = false } = {}) => {
      const sourcesMap = buildSourcesMap(config);
      engine.sources = sourcesMap;
      engine.config = config;

      const resolvedId = sourcesMap.has(sourceId)
        ? sourceId
        : (sourcesMap.has(config.defaultSource) ? config.defaultSource : Array.from(sourcesMap.keys())[0]);
      if (!resolvedId) return;

      const sourceConfig = sourcesMap.get(resolvedId);
      const sourceKey = getSourceSignature(resolvedId, sourceConfig, config);

      if (!userTriggered && engine.loaded && engine.sourceKey === sourceKey && engine.playlist.length) {
        engine.activeSourceId = resolvedId;
        engine.syncAllUI();
        return;
      }

      if (!userTriggered && engine.loadingPromise && engine.loadingSourceKey === sourceKey) {
        await engine.loadingPromise;
        engine.syncAllUI();
        return;
      }

      engine.activeSourceId = resolvedId;
      engine.syncSourceUI();
      engine.setError("");

      if (userTriggered) {
        engine.autoAdvanceOnError = false;
        engine.consecutiveErrors = 0;
        if (engine.errorSkipTimer) {
          window.clearTimeout(engine.errorSkipTimer);
          engine.errorSkipTimer = 0;
        }
        engine.controllers.forEach((ctrl) => {
          if (!ctrl?.widget || !document.contains(ctrl.widget)) return;
          if (ctrl.els.title) ctrl.els.title.textContent = sourceConfig.label || "音乐";
          if (ctrl.els.artist) ctrl.els.artist.textContent = "正在加载歌单…";
          if (ctrl.els.playlist) {
            ctrl.els.playlist.innerHTML = "";
            ctrl.renderedSourceKey = "";
            ctrl.renderedCount = 0;
          }
        });
      }

      const token = ++engine.loadToken;
      engine.loadingSourceKey = sourceKey;
      const currentPersisted = readMusicState();

      engine.loadingPromise = (async () => {
        let cacheEntry = engine.playlistCache.get(sourceKey);
        if (!cacheEntry) {
          const initialTracks = await fetchSourceTracks(sourceConfig, config);
          if (initialTracks.length) {
            const trackKeys = new Set();
            const dedupKeys = new Set();
            const uniqueTracks = [];
            initialTracks.forEach((track) => {
              const tk = getTrackKey(track);
              const dk = getTrackDedupKey(track);
              if (trackKeys.has(tk) || dedupKeys.has(dk)) return;
              trackKeys.add(tk);
              dedupKeys.add(dk);
              uniqueTracks.push(track);
            });
            const extraQueue = Array.isArray(sourceConfig?.meting?.extraIds)
              ? sourceConfig.meting.extraIds.map((id) => String(id)).filter((id) => id && id !== String(sourceConfig?.meting?.id || ""))
              : [];
            cacheEntry = {
              tracks: uniqueTracks,
              trackKeys,
              dedupKeys,
              extraQueue,
              loadingMore: false,
              sourceConfig,
              config,
            };
            engine.playlistCache.set(sourceKey, cacheEntry);
          }
        }
        if (token !== engine.loadToken) return;

        const playlist = cacheEntry?.tracks || [];
        if (!playlist.length) {
          throw new Error(`empty playlist for ${resolvedId}`);
        }

        engine.playlist = playlist;
        engine.sourceKey = sourceKey;
        engine.renderedCount = Math.min(playlist.length, PLAYLIST_BATCH_SIZE);
        engine.loaded = true;
        engine.playMode = validPlayModes.has(currentPersisted.playMode)
          ? currentPersisted.playMode
          : (validPlayModes.has(config.playMode) ? config.playMode : "list");
        engine.volume = Number.isFinite(Number(currentPersisted.volume))
          ? clampVolume(currentPersisted.volume, clampVolume(config.volume, 0.7))
          : clampVolume(config.volume, 0.7);
        sharedAudio.volume = engine.volume;
        sharedAudio.muted = currentPersisted.muted === true;

        const restoredIndex = currentPersisted.sourceKey === sourceKey
          ? playlist.findIndex((track) => getTrackKey(track) === currentPersisted.trackKey)
          : -1;
        const currentAudioIndex = sharedAudio.src
          ? playlist.findIndex((track) => audioHasTrack(sharedAudio, track.url))
          : -1;
        const shouldRestore = !userTriggered && restoredIndex >= 0;
        const shouldReuseCurrentAudio = !userTriggered && currentAudioIndex >= 0 && window.__moranHomeMusicSourceKey === sourceKey;
        const startIndex = shouldReuseCurrentAudio
          ? currentAudioIndex
          : shouldRestore
            ? restoredIndex
            : (config.randomOnLoad !== false ? Math.floor(Math.random() * playlist.length) : 0);

        const hasSavedPlayingState = shouldRestore && typeof currentPersisted.wasPlaying === "boolean";
        const shouldAutoplay = userTriggered
          ? true
          : (!shouldReuseCurrentAudio && (hasSavedPlayingState ? currentPersisted.wasPlaying : config.autoplay !== false));

        if (shouldReuseCurrentAudio) {
          engine.index = startIndex;
          engine.syncAllUI();
        } else {
          engine.loadTrack(startIndex, shouldAutoplay);
          if (shouldRestore && Number(currentPersisted.currentTime) > 0) {
            const applySavedTime = () => {
              if (Number.isFinite(sharedAudio.duration) && sharedAudio.duration > 1) {
                sharedAudio.currentTime = Math.min(Number(currentPersisted.currentTime), Math.max(0, sharedAudio.duration - 1));
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
        if (token !== engine.loadToken) return;
        engine.loadingSourceKey = "";
        engine.loaded = false;
        engine.playlist = [];
        engine.renderedCount = 0;
        sharedAudio.pause();
        sharedAudio.removeAttribute("src");
        sharedAudio.load();
        writeMusicState({ activeSourceId: resolvedId, wasPlaying: false });
        engine.controllers.forEach((ctrl) => {
          if (!ctrl?.widget || !document.contains(ctrl.widget)) return;
          if (ctrl.els.artist) ctrl.els.artist.textContent = "歌单加载失败";
          if (ctrl.els.playlist) ctrl.els.playlist.innerHTML = "";
        });
        engine.syncAllUI();
        engine.setError(`${sourceConfig.label || resolvedId} 歌单加载失败，请切换其他音源或稍后重试。`);
      } finally {
        if (token === engine.loadToken) engine.loadingPromise = null;
      }
    };

    engine.switchSource = (sourceId) => loadSource(sourceId, engine.config, { userTriggered: true });

    const loadMoreTracks = async () => {
      const targetSourceKey = engine.sourceKey;
      const targetToken = engine.loadToken;
      const meta = engine.playlistCache.get(targetSourceKey);
      if (!engine.loaded || !engine.playlist.length) return;

      if (engine.renderedCount < engine.playlist.length) {
        engine.renderedCount = Math.min(engine.playlist.length, engine.renderedCount + PLAYLIST_BATCH_SIZE);
        engine.syncAllPlaylistDOM();
        return;
      }

      if (!meta || meta.loadingMore || !meta.extraQueue.length) return;

      meta.loadingMore = true;
      engine.syncPlaylistFooters();

      try {
        let added = 0;
        while (meta.extraQueue.length > 0 && added === 0) {
          const nextId = meta.extraQueue.shift();
          if (!nextId) continue;
          const nextConfig = {
            ...meta.sourceConfig,
            meting: {
              ...(meta.sourceConfig?.meting || {}),
              id: nextId,
            },
          };
          const fetched = await fetchSourceTracks(nextConfig, meta.config);
          if (targetToken !== engine.loadToken || engine.sourceKey !== targetSourceKey) return;

          fetched.forEach((track) => {
            const tk = getTrackKey(track);
            const dk = getTrackDedupKey(track);
            if (meta.trackKeys.has(tk) || meta.dedupKeys.has(dk)) return;
            meta.trackKeys.add(tk);
            meta.dedupKeys.add(dk);
            meta.tracks.push(track);
            added += 1;
          });
        }
        if (added > 0) {
          engine.renderedCount = Math.min(engine.playlist.length, engine.renderedCount + PLAYLIST_BATCH_SIZE);
        }
      } finally {
        meta.loadingMore = false;
        if (targetToken === engine.loadToken && engine.sourceKey === targetSourceKey) {
          engine.syncAllPlaylistDOM();
        }
      }
    };

    widgets.forEach((widget) => {
      if (widget.dataset.musicReady === "1") return;
      widget.dataset.musicReady = "1";

      const config = parseJson(widget.querySelector("[data-home-music-config]"), {});
      const sourcesMap = buildSourcesMap(config);
      const initialSourceId = (persisted.activeSourceId && sourcesMap.has(persisted.activeSourceId))
        ? persisted.activeSourceId
        : (config.defaultSource && sourcesMap.has(config.defaultSource) ? config.defaultSource : Array.from(sourcesMap.keys())[0]);
      const els = {
        locate: widget.querySelector("[data-music-locate]"),
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
        mute: widget.querySelector("[data-music-mute]"),
        listToggle: widget.querySelector("[data-music-playlist-toggle]"),
        playlist: widget.querySelector("[data-music-playlist]"),
        error: widget.querySelector("[data-music-error]"),
      };

      const controller = { widget, sourceKey: initialSourceId, els };
      engine.controllers.push(controller);

      widget.querySelectorAll("[data-music-source]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const nextId = btn.getAttribute("data-music-source");
          if (!nextId) return;
          loadSource(nextId, config, { userTriggered: true });
        });
      });

      els.play?.addEventListener("click", () => {
        if (sharedAudio.paused) engine.playCurrent();
        else {
          engine.autoAdvanceOnError = false;
          if (engine.errorSkipTimer) {
            window.clearTimeout(engine.errorSkipTimer);
            engine.errorSkipTimer = 0;
          }
          sharedAudio.pause();
        }
      });
      els.locate?.addEventListener("click", () => {
        engine.locateWidgetTrack(widget, { openList: true });
      });
      els.prev?.addEventListener("click", () => engine.prev());
      els.next?.addEventListener("click", () => engine.next());
      els.mode?.addEventListener("click", engine.cyclePlayMode);
      els.mute?.addEventListener("click", engine.toggleMute);
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
        if (!els.playlist) return;
        els.playlist.hidden = !els.playlist.hidden;
        if (!els.playlist.hidden) {
          engine.locateWidgetTrack(widget, { openList: false });
        }
      });
      els.playlist?.addEventListener("click", (event) => {
        const moreBtn = event.target.closest("[data-playlist-more]");
        if (moreBtn) {
          loadMoreTracks();
          return;
        }
        const item = event.target.closest("[data-index]");
        if (!item) return;
        engine.loadTrack(Number(item.dataset.index), true);
      });
      els.playlist?.addEventListener("scroll", () => {
        if (!els.playlist || els.playlist.hidden) return;
        const remaining = els.playlist.scrollHeight - els.playlist.scrollTop - els.playlist.clientHeight;
        if (remaining <= 28) {
          loadMoreTracks();
        }
      }, { passive: true });

      engine.syncController(controller);
      loadSource(engine.activeSourceId || initialSourceId, config, { userTriggered: false });
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

  const initHeaderPanels = () => {
    const bindPanel = (buttonSelector, panelSelector, onOpen) => {
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
        document.querySelectorAll("[data-header-music-toggle], [data-theme-panel-toggle]").forEach((other) => {
          if (other !== button) other.setAttribute("aria-expanded", "false");
        });
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
        onOpen?.(panel);
      };
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.hidden ? open() : close();
      });
      panel.addEventListener("click", (event) => event.stopPropagation());
      document.addEventListener("click", close);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.hidden) { close(); button.focus(); }
      });
    };

    bindPanel("[data-header-music-toggle]", "[data-header-music-panel]", (panel) => {
      const widget = panel.querySelector("[data-home-music]");
      if (widget) window.__moranMusicEngine?.locateWidgetTrack?.(widget, { openList: true });
    });
    bindPanel("[data-theme-panel-toggle]", "[data-theme-panel]");
  };

  const initPage = () => {
    initStats();
    initMusic();
    initCalendar();
    initHomeSidebars();
  };

  const initOnce = () => {
    initPage();
    initHeaderPanels();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initOnce);
  else initOnce();

  document.addEventListener("moran:page-load", initPage);
})();
