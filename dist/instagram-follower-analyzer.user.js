// ==UserScript==
// @name                Instagram Follower Analyzer
// @name:es             Analizador de seguidores de Instagram
// @name:es-419         Analizador de seguidores de Instagram
// @name:pt             Analisador de seguidores do Instagram
// @name:pt-BR          Analisador de seguidores do Instagram
// @name:pt-PT          Analisador de seguidores do Instagram
// @namespace           https://github.com/UNKchr/ig-analyzer
// @version             3.12.0
// @author              UNKchr
// @description         Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.
// @description:es      Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.
// @description:es-419  Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos.
// @description:pt      Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.
// @description:pt-BR   Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados.
// @description:pt-PT   Analisa seguidores e quem não te segue de volta no Instagram, deteta anomalias em stories e exporte dados.
// @license             Custom
// @icon                https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @downloadURL         https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @updateURL           https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @match               https://www.instagram.com/*
// @require             https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@b92f576df4ee0baea5d113c6ad93ac2bf478c2cc/tamperguide/tamperGuide.js
// @grant               GM_addStyle
// @grant               GM_deleteValue
// @grant               GM_download
// @grant               GM_getValue
// @grant               GM_info
// @grant               GM_listValues
// @grant               GM_registerMenuCommand
// @grant               GM_setValue
// @grant               unsafeWindow
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const d=new Set;const importCSS = async e=>{d.has(e)||(d.add(e),(t=>{typeof GM_addStyle=="function"?GM_addStyle(t):(document.head||document.documentElement).appendChild(document.createElement("style")).append(t);})(e));};

  const CONFIG = {
    SCRIPT_ID: "ig-analyzer",
    SCRIPT_NAME: "Instagram Follower Analyzer",
    BACKUP_SCHEMA_VERSION: 1,
    STORAGE_KEY: "ig_snapshot_v2",
    POSITION_KEY: "ig_panel_position_v2",
    WHITELIST_KEY: "ig_whitelist_v2",
    HISTORY_KEY: "ig_history_v2",
    CHURN_KEY: "ig_churn_v3",
    DEACTIVATED_KEY: "ig_deactivated_v3",
    BLOCKED_KEY: "ig_blocked_v1",
    TOUR_KEY: "ig_tour_completed_v1",
    RENAMED_KEY: "ig_renamed_v1",
    NEW_FOLLOWERS_KEY: "ig_new_followers_v1",
    TARGET_TRACKER_KEY: "ig_target_tracker_v1",
    TARGET_SUBPANEL_POSITION_KEY: "ig_target_position_v1",
    STORY_ANOMALY_KEY: "ig_story_anomaly_v1",
    STORY_OBS_KEY: "ig_story_observations_v1",
    STORY_MIN_OBSERVATIONS: 3,
    STORY_MIN_ANOMALIES_FOR_FLAG: 2,
    STORY_STREAK_FOR_MEDIUM_CONFIDENCE: 2,
    FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
    FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
    PAGE_SIZE: 50,
    BASE_RATE_LIMIT_MS: 2e3,
MAX_RETRIES: 4,
    COOLDOWN_429_MS: 6e4,
MAX_AUTO_VERIFY_ACCOUNTS: 5,
ASBD_ID: "359341",
DEBUG: false,
    MIN_VISIBLE_PX: 50,
    DEFAULT_POSITION: { top: 80, right: 20, width: 717, height: 560 }
  };
  const Utils = {
    sleep: (ms, signal = null) => new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new DOMException("Aborted", "AbortError"));
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = setTimeout(() => {
        if (signal) signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }),
    now: () => ( new Date()).toISOString(),
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),
    escapeHtml: (str) => {
      if (str === null || str === void 0) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    sanitizeUrl: (username, customUrl) => {
      if (customUrl) {
        try {
          const parsed = new URL(customUrl, window.location.origin);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            return Utils.escapeHtml(parsed.href);
          }
        } catch (e) {
          Utils.logError("Error parsing custom URL", e);
        }
      }
      const safeUser = encodeURIComponent(username || "");
      return `https://www.instagram.com/${safeUser}/`;
    },
    sanitizeImageUrl: (url) => {
      if (!url || typeof url !== "string") return null;
      try {
        const clean = url.replace(/&amp;/g, "&").trim();
        const parsed = new URL(clean, window.location.origin);
        if (parsed.protocol === "https:") {
          return parsed.href;
        }
      } catch (e) {
        Utils.logError("Error parsing image URL", e);
      }
      return null;
    },
    getCsrfToken: () => {
      const match = document.cookie.match(/(?:^|;\s*)csrftoken=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : "";
    },
    getDtsg: () => {
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        if (win.DTSGInitialData?.token) return win.DTSGInitialData.token;
        if (win.DTSGInitData?.token) return win.DTSGInitData.token;
        if (typeof win.require === "function") {
          const mod = win.require("DTSGInitialData") || win.require("DTSGInitData");
          if (mod?.token) return mod.token;
        }
      } catch (e) {
      }
      try {
        const inputEl = document.querySelector('input[name="fb_dtsg"]');
        if (inputEl?.value) return inputEl.value;
      } catch (e) {
      }
      try {
        const scripts = document.querySelectorAll("script:not([src])");
        for (const script of scripts) {
          const text = script.textContent || "";
          if (!text) continue;
          const match = text.match(/"DTSGInitialData",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) || text.match(/\["DTSGInitData",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) || text.match(/["']token["']\s*:\s*["'](NAf[a-zA-Z0-9_\-:]+)["']/) || text.match(/name=["']fb_dtsg["']\s+value=["']([^"']+)["']/) || text.match(/"fb_dtsg"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            return match[1];
          }
        }
      } catch (e) {
      }
      return "";
    },
    calculateJazoest: (dtsg) => {
      if (!dtsg || typeof dtsg !== "string") return "";
      let sum = 0;
      for (let i = 0; i < dtsg.length; i++) {
        sum += dtsg.charCodeAt(i);
      }
      return "2" + sum;
    },
    getLsd: () => {
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        if (win._LSD?.token) return win._LSD.token;
        if (win.LSD?.token) return win.LSD.token;
        if (typeof win.require === "function") {
          const mod = win.require("LSD");
          if (mod?.token) return mod.token;
        }
      } catch (e) {
      }
      try {
        const inputEl = document.querySelector('input[name="lsd"]');
        if (inputEl?.value) return inputEl.value;
      } catch (e) {
      }
      try {
        const scripts = document.querySelectorAll("script:not([src])");
        for (const script of scripts) {
          const text = script.textContent || "";
          if (!text) continue;
          const match = text.match(/"LSD",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) || text.match(/["']lsd["']\s*:\s*["']([^"']+)["']/) || text.match(/name=["']lsd["']\s+value=["']([^"']+)["']/);
          if (match && match[1]) {
            return match[1];
          }
        }
      } catch (e) {
      }
      return "";
    },
    getUserId: () => {
      const matchCookie = document.cookie.match(/(?:^|;\s*)ds_user_id=([1-9][0-9]*)/);
      if (matchCookie && matchCookie[1] && matchCookie[1] !== "0") {
        return matchCookie[1];
      }
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const viewerId = win._sharedData?.config?.viewerId || win.__initialData?.pending?.viewer?.id || win.__initialData?.data?.viewer?.id || win._sharedData?.rawProfileUser?.id;
        if (viewerId && String(viewerId) !== "0" && /^[1-9][0-9]*$/.test(String(viewerId))) {
          return String(viewerId);
        }
        const lsId = win.localStorage?.getItem("ds_user_id") || win.sessionStorage?.getItem("ds_user_id");
        if (lsId && String(lsId) !== "0" && /^[1-9][0-9]*$/.test(String(lsId))) {
          return String(lsId);
        }
      } catch (e) {
      }
      try {
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          const text = script.textContent || "";
          if (!text) continue;
          const viewerObj = text.match(/"viewer"\s*:\s*\{\s*"id"\s*:\s*"([1-9][0-9]*)"/);
          if (viewerObj && viewerObj[1] && viewerObj[1] !== "0") return viewerObj[1];
          const vIdMatch = text.match(/"(?:viewerId|ds_user_id)"\s*:\s*"([1-9][0-9]*)"/);
          if (vIdMatch && vIdMatch[1] && vIdMatch[1] !== "0") return vIdMatch[1];
          const userMatch = text.match(/"(?:USER_ID|actorID)"\s*:\s*"([1-9][0-9]*)"/);
          if (userMatch && userMatch[1] && userMatch[1] !== "0") return userMatch[1];
        }
      } catch (e) {
      }
      try {
        const metaTag = document.querySelector('meta[property="instapp:owner_user_id"]');
        if (metaTag && metaTag.content && metaTag.content !== "0" && /^[1-9][0-9]*$/.test(metaTag.content)) {
          return metaTag.content;
        }
      } catch (e) {
      }
      return null;
    },
    getUsername: () => {
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const u = win._sharedData?.config?.viewer?.username || win.__initialData?.data?.viewer?.username || win.__initialData?.pending?.viewer?.username || win._sharedData?.rawProfileUser?.username;
        if (u && typeof u === "string") return u.trim();
      } catch (e) {
      }
      try {
        const navLink = document.querySelector('nav a[href^="/"][role="link"], a[href^="/"][aria-label*="Profile" i], a[href^="/"][aria-label*="Perfil" i]');
        if (navLink) {
          const href = navLink.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match) {
            const candidate = match[1];
            const systemRoutes = ["explore", "reels", "direct", "stories", "your_activity", "settings", "accounts", "developer", "about", "p", "reel"];
            if (!systemRoutes.includes(candidate.toLowerCase())) {
              return candidate;
            }
          }
        }
      } catch (e) {
      }
      return null;
    },
    getUserIdAsync: async (signal = null) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const syncId = Utils.getUserId();
      if (syncId && syncId !== "0") {
        return syncId;
      }
      const csrf = Utils.getCsrfToken();
      const baseHeaders = {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        "X-ASBD-ID": CONFIG.ASBD_ID,
        ...csrf ? { "X-CSRFToken": csrf } : {}
      };
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const res = await fetch("https://www.instagram.com/api/v1/accounts/edit/web_form_data/", {
          headers: baseHeaders,
          credentials: "include",
          signal
        });
        if (res.ok) {
          const data = await res.json();
          const username = data?.form_data?.username;
          if (username) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const profileRes = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
              credentials: "include",
              signal
            });
            if (profileRes.ok) {
              const html = await profileRes.text();
              const idMatch = html.match(/"id"\s*:\s*"([1-9][0-9]*)"/) || html.match(/"user_id"\s*:\s*"([1-9][0-9]*)"/) || html.match(/"pk"\s*:\s*"([1-9][0-9]*)"/);
              if (idMatch && idMatch[1] && idMatch[1] !== "0") return idMatch[1];
            }
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || signal?.aborted) throw e;
        Utils.logError("Async user ID detection fallback A failed", e);
      }
      try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const navLink = document.querySelector('nav a[href^="/"][role="link"], a[href^="/"][aria-label*="Profile" i], a[href^="/"][aria-label*="Perfil" i]');
        if (navLink) {
          const href = navLink.getAttribute("href") || "";
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match) {
            const candidate = match[1];
            const systemRoutes = ["explore", "reels", "direct", "stories", "your_activity", "settings", "accounts", "developer", "about", "p", "reel"];
            if (!systemRoutes.includes(candidate.toLowerCase())) {
              if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
              const profileRes = await fetch(`https://www.instagram.com/${encodeURIComponent(candidate)}/`, {
                credentials: "include",
                signal
              });
              if (profileRes.ok) {
                const html = await profileRes.text();
                const idMatch = html.match(/"id"\s*:\s*"([1-9][0-9]*)"/) || html.match(/"user_id"\s*:\s*"([1-9][0-9]*)"/) || html.match(/"pk"\s*:\s*"([1-9][0-9]*)"/);
                if (idMatch && idMatch[1] && idMatch[1] !== "0") return idMatch[1];
              }
            }
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || signal?.aborted) throw e;
        Utils.logError("Async user ID detection fallback B failed", e);
      }
      return null;
    },
    diff: (a, b) => {
      const setB = new Set(b);
      return a.filter((x) => !setB.has(x));
    },
    intersection: (a, b) => {
      const setB = new Set(b);
      return a.filter((x) => setB.has(x));
    },
    unique: (arr) => [...new Set(arr)],
    toDetailedUserArray: (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map((u) => {
        if (typeof u === "string") return { id: null, username: u };
        if (u && typeof u.username === "string") {
          return {
            id: u.id ? String(u.id) : null,
            username: String(u.username),
            fullName: u.fullName || u.full_name || "",
            isPrivate: Boolean(u.isPrivate ?? u.is_private),
            isVerified: Boolean(u.isVerified ?? u.is_verified),
            profilePicUrl: u.profilePicUrl || u.profile_pic_url || null,
            latestReelMedia: u.latestReelMedia ?? u.latest_reel_media ?? 0
          };
        }
        return null;
      }).filter(Boolean);
    },
    mapById: (arr) => {
      const map = new Map();
      (arr || []).forEach((u) => {
        if (u?.id) map.set(String(u.id), u);
      });
      return map;
    },
    intersectionById: (a, b) => {
      const bIDs = new Set((b || []).map((x) => x?.id).filter(Boolean));
      return (a || []).filter((x) => x?.id && bIDs.has(x.id));
    },
    detectRenamedMutuals: (prevMutuals, currentMutuals) => {
      const prevById = Utils.mapById(prevMutuals);
      const currById = Utils.mapById(currentMutuals);
      const changes = [];
      prevById.forEach((prevUser, id) => {
        const currUser = currById.get(id);
        if (!currUser) return;
        if (prevUser.username !== currUser.username) {
          changes.push({
            id,
            oldUsername: prevUser.username,
            newUsername: currUser.username
          });
        }
      });
      return changes;
    },
    exportCSV: (data, filename) => {
      if (!data || !data.length) return;
      const sanitizeCell = (val) => {
        let text = String(val ?? "");
        if (/^[=+\-@\t\r]/.test(text)) {
          text = "'" + text;
        }
        return `"${text.replace(/"/g, '""')}"`;
      };
      const header = ["Username", "Profile URL"].map(sanitizeCell).join(",");
      const rows = data.map((u) => [u.username, u.url].map(sanitizeCell).join(","));
      const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    },
    downloadImage: async (url, filename) => {
      if (!url) return;
      const cleanUrl = String(url).replace(/&amp;/g, "&").trim();
      const safeFilename = filename || "instagram_profile_hd.jpg";
      if (typeof GM_download === "function") {
        try {
          GM_download({
            url: cleanUrl,
            name: safeFilename,
            saveAs: false,
            onerror: () => {
              Utils.downloadImageFallback(cleanUrl, safeFilename);
            }
          });
          return;
        } catch (e) {
          console.warn("[IG Analyzer] GM_download failed, fallback to blob:", e);
        }
      }
      await Utils.downloadImageFallback(cleanUrl, safeFilename);
    },
    downloadImageFallback: async (url, filename) => {
      try {
        const resp = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1e3);
      } catch (err) {
        console.warn("[IG Analyzer] Blob download failed, opening in new tab:", err);
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    formatNumber: (num) => {
      if (num === null || num === void 0 || isNaN(num)) return "-";
      const n = Number(num);
      if (n >= 1e6) {
        return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
      }
      if (n >= 1e4) {
        return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
      }
      return n.toLocaleString();
    },
    formatDate: (isoOrTimestamp) => {
      if (!isoOrTimestamp) return "-";
      try {
        const d = new Date(isoOrTimestamp);
        if (isNaN(d.getTime())) return String(isoOrTimestamp);
        return d.toLocaleDateString(void 0, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch (e) {
        return String(isoOrTimestamp);
      }
    }
  };
  let currentUserId = null;
  const Storage = {
    setCurrentUserId: (id) => {
      if (id && String(id) !== "0") {
        currentUserId = String(id);
      }
    },
    getCurrentUserId: () => {
      if (!currentUserId) {
        const detected = Utils.getUserId();
        if (detected && String(detected) !== "0") {
          currentUserId = String(detected);
        }
      }
      return currentUserId;
    },
    getKey: (baseKey, userId = null) => {
      const id = userId || Storage.getCurrentUserId();
      return id ? `${baseKey}_${id}` : baseKey;
    },
    getScopedValue: (baseKey, defaultValue = null, userId = null) => {
      const id = userId || Storage.getCurrentUserId();
      if (id) {
        const scopedKey = `${baseKey}_${id}`;
        const val = GM_getValue(scopedKey, void 0);
        if (val !== void 0 && val !== null) {
          return val;
        }
        const legacyVal = GM_getValue(baseKey, void 0);
        if (legacyVal !== void 0 && legacyVal !== null) {
          try {
            GM_setValue(scopedKey, legacyVal);
            Utils.log(`[Storage] Migrated legacy data for "${baseKey}" to account key "${scopedKey}".`);
          } catch (e) {
            Utils.logError("Error migrating legacy storage key", e);
          }
          return legacyVal;
        }
      }
      return GM_getValue(baseKey, defaultValue);
    },
    setScopedValue: (baseKey, value, userId = null) => {
      const id = userId || Storage.getCurrentUserId();
      const key = id ? `${baseKey}_${id}` : baseKey;
      GM_setValue(key, value);
    },
    load: (userId = null) => {
      try {
        const snap = Storage.getScopedValue(CONFIG.STORAGE_KEY, null, userId);
        return snap && Array.isArray(snap.followers) ? snap : null;
      } catch (e) {
        Utils.logError("Error loading snapshot", e);
        return null;
      }
    },
    save: (data, userId = null) => {
      Storage.setScopedValue(CONFIG.STORAGE_KEY, data, userId);
    },
    getWhitelist: (userId = null) => {
      return Storage.getScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },
    addToWhitelist: (username, userId = null) => {
      const wl = Storage.getWhitelist(userId);
      if (!wl.includes(username)) {
        wl.push(username);
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, wl, userId);
      }
    },
    removeFromWhitelist: (username, userId = null) => {
      const wl = Storage.getWhitelist(userId);
      const filtered = wl.filter((u) => u !== username);
      Storage.setScopedValue(CONFIG.WHITELIST_KEY, filtered, userId);
    },
    clearWhitelist: (userId = null) => {
      Storage.setScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },
    getNewFollowersList: (userId = null) => {
      return Storage.getScopedValue(CONFIG.NEW_FOLLOWERS_KEY, [], userId);
    },
    addNewFollowersEntries: (entries, userId = null) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNewFollowersList(userId);
      const dateStr = Utils.now().split("T")[0];
      entries.forEach((item) => {
        const username = typeof item === "string" ? item : item.username;
        if (!username) return;
        const existingIdx = list.findIndex((x) => x.username === username);
        const entryObj = {
          id: item.id || null,
          username,
          fullName: item.fullName || "",
          profilePicUrl: item.profilePicUrl || "",
          isVerified: Boolean(item.isVerified),
          isPrivate: Boolean(item.isPrivate),
          isBestie: Boolean(item.isBestie),
          followsBack: item.followsBack !== void 0 ? item.followsBack : null,
          date: dateStr
        };
        if (existingIdx > -1) {
          list[existingIdx] = { ...list[existingIdx], ...entryObj };
        } else {
          list.push(entryObj);
        }
      });
      Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
    },
    getHistory: (userId = null) => {
      return Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
    },
    addHistoryEntry: (followersCount, followingCount, userId = null) => {
      const hist = Storage.getHistory(userId);
      const dateStr = Utils.now().split("T")[0];
      const existingIdx = hist.findIndex((h) => h.date === dateStr);
      if (existingIdx > -1) {
        hist[existingIdx] = { date: dateStr, followers: followersCount, following: followingCount };
      } else {
        hist.push({ date: dateStr, followers: followersCount, following: followingCount });
      }
      Storage.setScopedValue(CONFIG.HISTORY_KEY, hist, userId);
    },
    getNominalList: (key, userId = null) => {
      return Storage.getScopedValue(key, [], userId);
    },
    addNominalEntries: (key, usernames, userId = null) => {
      if (!usernames || usernames.length === 0) return;
      const list = Storage.getNominalList(key, userId);
      const dateStr = Utils.now().split("T")[0];
      usernames.forEach((u) => {
        if (!list.find((x) => x.username === u)) {
          list.push({ username: u, date: dateStr });
        }
      });
      Storage.setScopedValue(key, list, userId);
    },
    addRenamedEntries: (entries, userId = null) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNominalList(CONFIG.RENAMED_KEY, userId);
      const dateStr = Utils.now().split("T")[0];
      entries.forEach((entry) => {
        if (!entry?.id || !entry?.oldUsername || !entry?.newUsername) return;
        const exists = list.find((x) => x.id === entry.id && x.newUsername === entry.newUsername);
        if (!exists) {
          list.push({
            id: entry.id,
            username: entry.newUsername,
            oldUsername: entry.oldUsername,
            newUsername: entry.newUsername,
            date: dateStr
          });
        }
      });
      Storage.setScopedValue(CONFIG.RENAMED_KEY, list, userId);
    },
    getStoryObservations: (username, userId = null) => {
      const clean = String(username || "").replace(/^@/, "").toLowerCase().trim();
      const raw = String(username || "").trim();
      const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
      return obs[clean] || obs[raw] || obs[`@${raw}`] || [];
    },
    addStoryObservation: (username, data, userId = null) => {
      const clean = String(username || "").replace(/^@/, "").toLowerCase().trim();
      const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
      if (!obs[clean]) obs[clean] = [];
      data.timestamp = Utils.now();
      data.epochMs = Date.now();
      obs[clean].push(data);
      if (obs[clean].length > 10) {
        obs[clean].shift();
      }
      Storage.setScopedValue(CONFIG.STORY_OBS_KEY, obs, userId);
    },
    clearStoryObservations: (username, userId = null) => {
      const clean = String(username || "").replace(/^@/, "").toLowerCase().trim();
      const raw = String(username || "").trim();
      const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
      let modified = false;
      [clean, raw, `@${raw}`].forEach((k) => {
        if (obs[k]) {
          delete obs[k];
          modified = true;
        }
      });
      if (modified) {
        Storage.setScopedValue(CONFIG.STORY_OBS_KEY, obs, userId);
      }
    },
    getTargetTrackerMap: (userId = null) => {
      const map = Storage.getScopedValue(CONFIG.TARGET_TRACKER_KEY, {}, userId);
      const viewerId = Utils.getUserId();
      const viewerName = (Utils.getUsername() || "").toLowerCase();
      let modified = false;
      if (map && typeof map === "object") {
        Object.keys(map).forEach((k) => {
          const item = map[k];
          if (k !== viewerName && viewerId && item?.user && String(item.user.id) === String(viewerId)) {
            delete map[k];
            modified = true;
          }
        });
        if (modified) {
          Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
        }
      }
      return map;
    },
    getTargetData: (username, userId = null) => {
      const clean = String(username || "").replace(/^@+\s*/, "").toLowerCase().trim();
      const map = Storage.getTargetTrackerMap(userId);
      return map[clean] || null;
    },
    saveTargetData: (username, data, userId = null) => {
      const clean = String(username || "").replace(/^@+\s*/, "").toLowerCase().trim();
      if (!clean) return;
      const viewerId = Utils.getUserId();
      const viewerName = (Utils.getUsername() || "").toLowerCase();
      if (clean !== viewerName && viewerId && data?.user && String(data.user.id) === String(viewerId)) {
        console.warn(`[IG Analyzer] Refusing to save target data for @${clean} because ID matches logged-in viewer.`);
        return;
      }
      const map = Storage.getTargetTrackerMap(userId);
      map[clean] = {
        ...data,
        username: clean,
        updatedAt: Utils.now()
      };
      Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
    },
    removeTargetData: (username, userId = null) => {
      const clean = String(username || "").replace(/^@+\s*/, "").toLowerCase().trim();
      const map = Storage.getTargetTrackerMap(userId);
      if (map[clean]) {
        delete map[clean];
        Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
      }
    },
    resetAll: (userId = null) => {
      const keys = [
        CONFIG.STORAGE_KEY,
        CONFIG.WHITELIST_KEY,
        CONFIG.HISTORY_KEY,
        CONFIG.CHURN_KEY,
        CONFIG.DEACTIVATED_KEY,
        CONFIG.BLOCKED_KEY,
        CONFIG.RENAMED_KEY,
        CONFIG.NEW_FOLLOWERS_KEY,
        CONFIG.TARGET_TRACKER_KEY,
        CONFIG.STORY_OBS_KEY
      ];
      keys.forEach((k) => {
        const id = userId || Storage.getCurrentUserId();
        if (id) {
          GM_deleteValue(`${k}_${id}`);
        }
        GM_deleteValue(k);
      });
    }
  };
  const API = {
    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
      if (typeof options === "number") {
        retries = options;
        options = {};
      }
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const csrf = Utils.getCsrfToken();
      const defaultHeaders = {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest",
        "X-ASBD-ID": CONFIG.ASBD_ID,
        "Accept": "*/*",
        ...csrf ? { "X-CSRFToken": csrf } : {}
      };
      const fetchOptions = {
        credentials: "include",
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers || {}
        }
      };
      let rateLimitCount = 0;
      const maxRateLimitRetries = 2;
      for (let i = 0; i < retries; i++) {
        if (options.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        try {
          const res = await fetch(url, fetchOptions);
          if (res.ok) return await res.json();
          if (res.status === 429) {
            if (options.silent || options.optional) {
              throw new Error(`HTTP 429 on optional endpoint ${url}`);
            }
            rateLimitCount++;
            const retryAfterHeader = res.headers ? res.headers.get("Retry-After") : null;
            const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
            const waitMs = retrySeconds && !isNaN(retrySeconds) && retrySeconds > 0 ? retrySeconds * 1e3 : CONFIG.COOLDOWN_429_MS || 6e4;
            if (rateLimitCount >= maxRateLimitRetries) {
              UI.log(`[Rate Limit] HTTP 429 persistent. Aborting to safeguard your account.`);
              throw new Error("Instagram rate limit (429) persistent. Please wait at least 30-60 minutes before retrying.");
            }
            UI.setStatus(`Rate limit (429). Cooling down ${Math.round(waitMs / 1e3)}s...`);
            UI.log(`[Safety Cooldown] HTTP 429 detected. Pausing for ${Math.round(waitMs / 1e3)}s before retry ${rateLimitCount}/${maxRateLimitRetries}...`);
            await Utils.sleep(waitMs, options.signal);
            continue;
          } else {
            const errText = await res.text().catch(() => "");
            if (!options.silent) {
              console.warn(`[IG Analyzer] Request to ${url} failed (HTTP ${res.status}):`, errText.slice(0, 300));
            }
            throw new Error(`HTTP ${res.status} while requesting ${url}: ${errText.slice(0, 100)}`);
          }
        } catch (e) {
          if (e.name === "AbortError" || options.signal?.aborted) {
            throw e;
          }
          if (options.silent || options.optional) {
            throw e;
          }
          if (e.message && e.message.includes("rate limit (429) persistent")) {
            throw e;
          }
          if (i === retries - 1) throw e;
          await Utils.sleep(1500 * (i + 1) + Math.random() * 500, options.signal);
        }
      }
      throw new Error("Maximum retries achieved.");
    },
    getUserInfo: async (userId, options = {}) => {
      if (!userId || userId === "0") return null;
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const opts = { ...options, optional: true, silent: true };
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const rawUser = win._sharedData?.rawProfileUser || win.__initialData?.data?.user || win.__initialData?.pending?.viewer;
        if (rawUser) {
          const fCount = rawUser.edge_followed_by?.count ?? rawUser.follower_count;
          const fgCount = rawUser.edge_follow?.count ?? rawUser.following_count;
          if (typeof fCount === "number" || typeof fgCount === "number") {
            return {
              followerCount: Number(fCount || 0),
              followingCount: Number(fgCount || 0),
              username: rawUser.username || "",
              fullName: rawUser.full_name || "",
              profilePicUrl: rawUser.profile_pic_url || null
            };
          }
        }
      } catch (e) {
      }
      try {
        const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]')?.content || "";
        const match = metaDesc.match(/([0-9.,kKmM]+)\s+Followers.*?([0-9.,kKmM]+)\s+Following/i);
        if (match) {
          const parseCount = (str) => {
            str = str.replace(/,/g, "").trim().toLowerCase();
            if (str.endsWith("k")) return Math.round(parseFloat(str) * 1e3);
            if (str.endsWith("m")) return Math.round(parseFloat(str) * 1e6);
            return parseInt(str, 10) || 0;
          };
          const followerCount = parseCount(match[1]);
          const followingCount = parseCount(match[2]);
          if (followerCount > 0 || followingCount > 0) {
            return {
              followerCount,
              followingCount,
              username: Utils.getUsername() || "",
              fullName: "",
              profilePicUrl: null
            };
          }
        }
      } catch (e) {
      }
      try {
        const username = Utils.getUsername();
        if (username) {
          const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
          const json = await API.fetchWithRetry(url, opts, 1);
          const u = json?.data?.user;
          if (u) {
            return {
              followerCount: Number(u.edge_followed_by?.count ?? u.follower_count ?? 0),
              followingCount: Number(u.edge_follow?.count ?? u.following_count ?? 0),
              username: u.username || username,
              fullName: u.full_name || "",
              profilePicUrl: u.profile_pic_url || null
            };
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
      }
      return null;
    },
    getAllUsersViaGraphQL: async (userId, hash, label, options = {}, expectedTotal = 0) => {
      const users = [];
      let cursor = null;
      let hasNext = true;
      let totalCount = expectedTotal || 0;
      while (hasNext) {
        if (options.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const vars = encodeURIComponent(JSON.stringify({ id: userId, first: CONFIG.PAGE_SIZE, after: cursor }));
        const url = "https://www.instagram.com/graphql/query/?query_hash=" + hash + "&variables=" + vars;
        const json = await API.fetchWithRetry(url, options);
        const userNode = json?.data?.user;
        const edge = userNode?.edge_follow || userNode?.edge_followed_by;
        if (!edge || !Array.isArray(edge.edges)) {
          console.warn(`[IG Analyzer] Unexpected GraphQL structure for ${label}:`, json);
          return [];
        }
        if (totalCount === 0 && edge.count) totalCount = edge.count;
        edge.edges.forEach((e) => {
          const node = e?.node;
          const username = node?.username;
          if (!username) return;
          users.push({
            id: node?.id ? String(node.id) : null,
            username: String(username)
          });
        });
        hasNext = edge.page_info?.has_next_page === true;
        cursor = edge.page_info?.end_cursor || null;
        const total = totalCount > 0 ? totalCount : 0;
        const progressLabel = total > 0 ? `Extracting ${label}... (${users.length}/${total})` : `Extracting ${label}... (${users.length})`;
        UI.setProgress(users.length, total, progressLabel);
        if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500, options.signal);
      }
      if (users.length > 0) {
        UI.setProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
      }
      return users;
    },
    getAllUsersViaFriendships: async (userId, label, options = {}, expectedTotal = 0) => {
      const users = [];
      let maxId = null;
      let hasNext = true;
      const endpoint = label === "following" ? "following" : "followers";
      while (hasNext) {
        if (options.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        let url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpoint}/?count=50&search_surface=follow_list_page`;
        if (maxId) {
          url += `&max_id=${encodeURIComponent(maxId)}`;
        }
        const json = await API.fetchWithRetry(url, options);
        const list = json?.users;
        if (!Array.isArray(list)) {
          console.warn(`[IG Analyzer] Friendships API returned non-array for ${label}:`, json);
          break;
        }
        list.forEach((u) => {
          const username = u?.username;
          if (!username) return;
          users.push({
            id: u?.pk ? String(u.pk) : u?.id ? String(u.id) : null,
            username: String(username),
            fullName: u?.full_name || "",
            isPrivate: Boolean(u?.is_private),
            isVerified: Boolean(u?.is_verified),
            profilePicUrl: u?.profile_pic_url || null,
            latestReelMedia: u?.latest_reel_media || 0
          });
        });
        maxId = json?.next_max_id || null;
        hasNext = Boolean(maxId);
        const total = expectedTotal > 0 ? expectedTotal : 0;
        const progressLabel = total > 0 ? `Extracting ${label}... (${users.length}/${total})` : `Extracting ${label}... (${users.length})`;
        UI.setProgress(users.length, total, progressLabel);
        if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800, options.signal);
      }
      if (users.length > 0) {
        UI.setProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
      }
      return users;
    },
    getAllUsers: async (userId, hash, label, options = {}, expectedTotal = 0) => {
      let users = [];
      let friendshipsSuccess = false;
      try {
        users = await API.getAllUsersViaFriendships(userId, label, options, expectedTotal);
        friendshipsSuccess = true;
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
        console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e);
        users = [];
        friendshipsSuccess = false;
      }
      if (!friendshipsSuccess && hash) {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        UI.log(`Friendships API failed for '${label}'. Falling back to legacy GraphQL...`);
        try {
          users = await API.getAllUsersViaGraphQL(userId, hash, label, options, expectedTotal);
        } catch (e) {
          if (e.name === "AbortError" || options.signal?.aborted) throw e;
          Utils.logError(`GraphQL fallback failed for ${label}`, e);
        }
      }
      const withIdCount = users.filter((u) => !!u.id).length;
      UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");
      return users;
    },
    checkAccountStatus: async (username, options = {}) => {
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      if (!cleanUser) return "Active";
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        let authIsErrorPage = false;
        let authProfileFound = false;
        let authStatus = 0;
        try {
          const authHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
            credentials: "include",
            signal: options.signal
          });
          authStatus = authHtmlRes.status;
          if (authHtmlRes.status === 429) {
            return "Active";
          }
          if (authHtmlRes.ok) {
            const authHtml = await authHtmlRes.text();
            authIsErrorPage = authHtml.includes("Sorry, this page isn't available.") || authHtml.includes("Esta página no está disponible.") || authHtml.includes("page_not_found");
            authProfileFound = authHtml.includes(`"username":"${cleanUser}"`) || authHtml.includes(`/${cleanUser}/`) || authHtml.includes('"is_private":');
            if (authProfileFound && !authIsErrorPage) {
              return "Active";
            }
          } else if (authHtmlRes.status === 404) {
            authIsErrorPage = true;
          }
        } catch (err) {
          if (err.name === "AbortError" || options.signal?.aborted) throw err;
          console.warn(`[IG Analyzer] Error in auth HTML for ${cleanUser}:`, err);
        }
        if (!authIsErrorPage && authStatus !== 404) {
          return "Active";
        }
        await Utils.sleep(800, options.signal);
        try {
          const anonRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
            credentials: "omit",
            signal: options.signal
          });
          if (anonRes.status === 429) {
            return "Active";
          }
          const anonHtml = await anonRes.text();
          const anonIsErrorPage = anonRes.status === 404 || anonHtml.includes("page_not_found") || anonHtml.includes("Sorry, this page isn't available.") || anonHtml.includes("Esta página no está disponible.");
          const loginRedirectPath = `login/?next=%2F${cleanUser}%2F`;
          const anonExistsPublicly = anonHtml.includes(loginRedirectPath) || anonHtml.includes(`"username":"${cleanUser}"`) || anonHtml.includes(`/${cleanUser}/`);
          if (anonExistsPublicly && !anonIsErrorPage) {
            return "Blocked";
          } else {
            return "Deactivated";
          }
        } catch (err) {
          if (err.name === "AbortError" || options.signal?.aborted) throw err;
          console.warn(`[IG Analyzer] Error in anon check for ${cleanUser}:`, err);
          return "Active";
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
        console.error(`Error verifying account status for "${username}". Defaulting to Active.`, e);
        return "Active";
      }
    },
    searchUserByUsername: async (username, options = {}) => {
      const cleanUser = String(username || "").replace(/^@+\s*/, "").trim().toLowerCase();
      if (!cleanUser) return null;
      const viewerId = Utils.getUserId() || "0";
      try {
        const url = "https://www.instagram.com/api/graphql";
        const dtsg = Utils.getDtsg();
        const jazoest = Utils.calculateJazoest(dtsg);
        const lsd = Utils.getLsd();
        const params = new URLSearchParams();
        params.append("av", viewerId);
        params.append("__d", "www");
        params.append("__user", "0");
        params.append("__a", "1");
        params.append("__req", "1");
        params.append("fb_api_caller_class", "RelayModern");
        params.append("fb_api_req_friendly_name", "PolarisSearchBoxRefetchableQuery");
        params.append("doc_id", "27706427925724183");
        params.append("server_timestamps", "true");
        const rankToken = `${Date.now()}|${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
        const sessionId = `${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 14)}`;
        params.append("variables", JSON.stringify({
          data: {
            context: "blended",
            include_reel: "true",
            query: cleanUser,
            rank_token: rankToken,
            search_session_id: sessionId,
            search_surface: "web_top_search"
          },
          hasQuery: true
        }));
        if (dtsg) params.append("fb_dtsg", dtsg);
        if (jazoest) params.append("jazoest", jazoest);
        if (lsd) params.append("lsd", lsd);
        const headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-FB-Friendly-Name": "PolarisSearchBoxRefetchableQuery"
        };
        if (lsd) headers["X-FB-LSD"] = lsd;
        const json = await API.fetchWithRetry(url, {
          method: "POST",
          headers,
          body: params.toString(),
          optional: true,
          silent: true,
          signal: options.signal
        }, 1);
        const connection = json?.data?.xdt_api__v1__fbsearch__topsearch_connection;
        if (connection && Array.isArray(connection.users)) {
          for (const item of connection.users) {
            const u = item?.user;
            if (u && (u.username || "").toLowerCase() === cleanUser) {
              return {
                id: String(u.pk || u.id),
                username: u.username,
                fullName: u.full_name || "",
                isPrivate: Boolean(u.is_private),
                isVerified: Boolean(u.is_verified),
                profilePicUrl: u.hd_profile_pic_url_info?.url || u.profile_pic_url || null,
                rawUser: u,
                source: "graphql_search"
              };
            }
          }
        }
      } catch (gqlErr) {
        if (gqlErr.name === "AbortError" || options.signal?.aborted) throw gqlErr;
        console.warn(`[IG Analyzer] Native GraphQL topsearch failed for @${cleanUser}:`, gqlErr);
      }
      try {
        const url = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(cleanUser)}&rank_token=0.5`;
        const json = await API.fetchWithRetry(url, {
          headers: {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
          },
          optional: true,
          silent: true,
          signal: options.signal
        }, 1);
        const userList = json?.users || [];
        for (const item of userList) {
          const u = item?.user;
          if (u && (u.username || "").toLowerCase() === cleanUser) {
            return {
              id: String(u.pk || u.id),
              username: u.username,
              fullName: u.full_name || "",
              isPrivate: Boolean(u.is_private),
              isVerified: Boolean(u.is_verified),
              profilePicUrl: u.profile_pic_url || null,
              rawUser: u,
              source: "rest_search"
            };
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
        console.warn(`[IG Analyzer] REST topsearch fallback failed for @${cleanUser}:`, e);
      }
      return null;
    },
    resolveUserId: async (username, options = {}) => {
      const cleanUser = String(username || "").replace(/^@+\s*/, "").trim().toLowerCase();
      if (!cleanUser) return null;
      const viewerId = Utils.getUserId();
      const viewerName = (Utils.getUsername() || "").toLowerCase();
      if (cleanUser === viewerName && viewerId) {
        return String(viewerId);
      }
      for (const [id, user] of API.hdAvatarCache.entries()) {
        if ((user?.username || "").toLowerCase() === cleanUser && String(id) !== String(viewerId)) {
          return id;
        }
      }
      try {
        const pool = [
          ...window.__igLastResults || [],
          ...Storage.load()?.followers || [],
          ...Storage.load()?.following || []
        ];
        const match = pool.find((u) => {
          const name = typeof u === "string" ? u : u?.username;
          return name && name.toLowerCase() === cleanUser && u?.id && String(u.id) !== String(viewerId);
        });
        if (match && match.id && String(match.id) !== "0") {
          return String(match.id);
        }
      } catch (e) {
      }
      const searched = await API.searchUserByUsername(cleanUser, options);
      if (searched && searched.id && String(searched.id) !== String(viewerId)) {
        if (searched.profilePicUrl) {
          API.hdAvatarCache.set(String(searched.id), {
            id: String(searched.id),
            username: searched.username,
            fullName: searched.fullName,
            hdUrl: searched.profilePicUrl,
            isVerified: searched.isVerified,
            isPrivate: searched.isPrivate,
            isStub: true
          });
        }
        return String(searched.id);
      }
      return null;
    },
    checkStoryStatus: async (username, userId = null, options = {}) => {
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      if (!cleanUser) return null;
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      let targetId = userId && String(userId) !== "0" && String(userId) !== "null" && String(userId) !== "undefined" ? String(userId).trim() : null;
      if (!targetId) {
        targetId = await API.resolveUserId(cleanUser, options);
      }
      if (!targetId) {
        console.warn(`[IG Analyzer] Story Spy: Could not resolve target ID for @${cleanUser}`);
        return null;
      }
      try {
        const profile = await API.fetchUserProfileHd(targetId, cleanUser, {
          forceRefresh: true,
          signal: options.signal
        });
        const isPrivate = profile ? Boolean(profile.isPrivate) : false;
        const latestReelMedia = profile?.latestReelMedia ?? 0;
        const latestBestiesReelMedia = profile?.latestBestiesReelMedia ?? 0;
        const isGated = profile?.latestReelMedia === null;
        const authHasStory = typeof latestReelMedia === "number" && latestReelMedia > 0;
        const isBestieStory = typeof latestBestiesReelMedia === "number" && latestBestiesReelMedia > 0;
        let authHighlights = [];
        let authHighlightsCount = 0;
        try {
          const trayJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
            optional: true,
            signal: options.signal
          }, 1);
          if (Array.isArray(trayJson?.tray)) {
            authHighlights = trayJson.tray.map((item) => ({
              id: item.id || "",
              title: item.title || "Untitled",
              mediaCount: item.media_count || 0
            }));
            authHighlightsCount = authHighlights.length;
          }
        } catch (trayErr) {
          if (trayErr.name === "AbortError" || options.signal?.aborted) throw trayErr;
          console.warn(`[IG Analyzer] Highlights tray query failed for @${cleanUser}:`, trayErr);
        }
        let anonHighlightsCount = 0;
        let anonHasStory = false;
        if (!isPrivate) {
          try {
            const anonRes = await fetch(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
              credentials: "omit",
              headers: {
                "X-IG-App-ID": "936619743392459",
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "*/*"
              },
              signal: options.signal
            });
            if (anonRes.ok) {
              const anonJson = await anonRes.json();
              if (Array.isArray(anonJson?.tray)) {
                anonHighlightsCount = anonJson.tray.length;
              }
            }
          } catch (anonErr) {
            if (anonErr.name === "AbortError" || options.signal?.aborted) throw anonErr;
          }
        }
        return {
          userId: targetId,
          username: cleanUser,
          fullName: profile?.fullName || "",
          profilePicUrl: profile?.hdUrl || null,
          isPrivate,
          isGated,
          authHighlightsCount,
          authHighlights,
          latestReelMedia,
          latestBestiesReelMedia,
          authHasStory,
          isBestieStory,
          anonHighlightsCount,
          anonHasStory,
          fetchedAt: Date.now()
        };
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
        console.error(`[IG Analyzer] Error in checkStoryStatus for @${cleanUser}:`, e);
        return null;
      }
    },
    friendshipCache: new Map(),
    clearFriendshipCache: () => {
      API.friendshipCache.clear();
      API.hdAvatarCache.clear();
    },
    fetchFriendshipStatusesMany: async (userIds, options = {}) => {
      if (!Array.isArray(userIds) || userIds.length === 0) return {};
      const cleanIds = userIds.map((id) => id !== null && id !== void 0 ? String(id).trim() : "").filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");
      if (cleanIds.length === 0) return {};
      const missingIds = cleanIds.filter((id) => !API.friendshipCache.has(id));
      if (missingIds.length > 0) {
        try {
          const url = "https://www.instagram.com/api/v1/friendships/show_many/";
          const dtsg = Utils.getDtsg();
          const jazoest = Utils.calculateJazoest(dtsg);
          const params = new URLSearchParams();
          params.append("user_ids", missingIds.join(","));
          if (dtsg) params.append("fb_dtsg", dtsg);
          if (jazoest) params.append("jazoest", jazoest);
          const json = await API.fetchWithRetry(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString(),
            optional: true,
            signal: options.signal
          }, 2);
          const statuses = json?.friendship_statuses;
          if (statuses && typeof statuses === "object") {
            Object.entries(statuses).forEach(([id, status]) => {
              API.friendshipCache.set(String(id), {
                following: Boolean(status?.following),
                isBestie: Boolean(status?.is_bestie),
                isPrivate: Boolean(status?.is_private),
                isRestricted: Boolean(status?.is_restricted),
                outgoingRequest: Boolean(status?.outgoing_request),
                incomingRequest: Boolean(status?.incoming_request),
                isFeedFavorite: Boolean(status?.is_feed_favorite)
              });
            });
          }
          missingIds.forEach((id) => {
            if (!API.friendshipCache.has(id)) {
              API.friendshipCache.set(id, {
                following: false,
                isBestie: false,
                isPrivate: false,
                isRestricted: false,
                outgoingRequest: false,
                incomingRequest: false,
                isFeedFavorite: false
              });
            }
          });
        } catch (err) {
          if (err.name === "AbortError" || options.signal?.aborted) throw err;
          console.warn("[IG Analyzer] Error fetching friendship statuses in batch:", err);
        }
      }
      const result = {};
      cleanIds.forEach((id) => {
        if (API.friendshipCache.has(id)) {
          result[id] = API.friendshipCache.get(id);
        }
      });
      return result;
    },
    hdAvatarCache: new Map(),
    clearHdAvatarCache: () => {
      API.hdAvatarCache.clear();
    },
    fetchUserProfileHd: async (userId, username, options = {}) => {
      if (!userId || String(userId) === "0") return null;
      const idStr = String(userId);
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      if (!options.forceRefresh && API.hdAvatarCache.has(idStr)) {
        const cached = API.hdAvatarCache.get(idStr);
        if (cached && !cached.isStub && (cached.followerCount !== void 0 && cached.followerCount !== null)) {
          return cached;
        }
      }
      try {
        const url = "https://www.instagram.com/api/graphql";
        const dtsg = Utils.getDtsg();
        const jazoest = Utils.calculateJazoest(dtsg);
        const lsd = Utils.getLsd();
        const viewerId = Utils.getUserId() || "0";
        const params = new URLSearchParams();
        params.append("av", viewerId);
        params.append("__d", "www");
        params.append("__user", "0");
        params.append("__a", "1");
        params.append("__req", "1");
        params.append("fb_api_caller_class", "RelayModern");
        params.append("fb_api_req_friendly_name", "PolarisProfilePageContentQuery");
        params.append("doc_id", "28036671149327607");
        params.append("server_timestamps", "true");
        params.append("variables", JSON.stringify({
          enable_integrity_filters: true,
          id: idStr,
          __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
          __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
          __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
          __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true,
          __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: false
        }));
        if (dtsg) params.append("fb_dtsg", dtsg);
        if (jazoest) params.append("jazoest", jazoest);
        if (lsd) params.append("lsd", lsd);
        const headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-FB-Friendly-Name": "PolarisProfilePageContentQuery"
        };
        if (lsd) headers["X-FB-LSD"] = lsd;
        let user = null;
        try {
          const json = await API.fetchWithRetry(url, {
            method: "POST",
            headers,
            body: params.toString(),
            optional: true,
            signal: options.signal
          }, 1);
          user = json?.data?.user;
        } catch (graphqlErr) {
          if (graphqlErr.name === "AbortError" || options.signal?.aborted) throw graphqlErr;
          console.warn(`[IG Analyzer] GraphQL profile fetch failed for @${cleanUser}:`, graphqlErr);
        }
        if (user) {
          const rawHdUrl = user?.hd_profile_pic_url_info?.url || user?.profile_pic_url_hd || user?.profile_pic_url || null;
          const hdUrl = Utils.sanitizeImageUrl(rawHdUrl);
          const latestReelMedia = typeof user?.latest_reel_media === "number" ? user.latest_reel_media : user?.latest_reel_media === null ? null : user?.latest_reel_media ? Number(user.latest_reel_media) : 0;
          const latestBestiesReelMedia = typeof user?.latest_besties_reel_media === "number" ? user.latest_besties_reel_media : user?.latest_besties_reel_media ? Number(user.latest_besties_reel_media) : 0;
          const externalUrl = user?.external_url || user?.bio_links?.[0]?.url || null;
          const following = Boolean(user?.friendship_status?.following);
          const followedBy = Boolean(user?.friendship_status?.followed_by);
          const outgoingRequest = Boolean(user?.friendship_status?.outgoing_request);
          const incomingRequest = Boolean(user?.friendship_status?.incoming_request);
          const isRestricted = Boolean(user?.friendship_status?.is_restricted);
          const isBestie = Boolean(user?.friendship_status?.is_bestie);
          const mutualUsers = Array.isArray(user?.profile_context_links_with_user_ids) ? user.profile_context_links_with_user_ids.map((l) => l?.username).filter(Boolean) : [];
          const facepileUsers = Array.isArray(user?.profile_context_facepile_users) ? user.profile_context_facepile_users.map((f) => ({
            id: f.id,
            profilePicUrl: Utils.sanitizeImageUrl(f.profile_pic_url)
          })) : [];
          const result = {
            id: idStr,
            username: user?.username || cleanUser || "",
            fullName: user?.full_name || "",
            hdUrl,
            isBestie,
            isPrivate: Boolean(user?.is_private),
            isVerified: Boolean(user?.is_verified),
            mutualsCount: typeof user?.mutual_followers_count === "number" ? user.mutual_followers_count : null,
            mutualUsers,
            facepileUsers,
            followerCount: typeof user?.follower_count === "number" ? user.follower_count : typeof user?.edge_followed_by?.count === "number" ? user.edge_followed_by.count : user?.follower_count ? Number(user.follower_count) : user?.edge_followed_by?.count ? Number(user.edge_followed_by.count) : null,
            followingCount: typeof user?.following_count === "number" ? user.following_count : typeof user?.edge_follow?.count === "number" ? user.edge_follow.count : user?.following_count ? Number(user.following_count) : user?.edge_follow?.count ? Number(user.edge_follow.count) : null,
            mediaCount: user?.media_count ?? null,
            biography: user?.biography || "",
            externalUrl,
            following,
            followedBy,
            outgoingRequest,
            incomingRequest,
            isRestricted,
            isBusiness: Boolean(user?.is_business || user?.is_business_account || user?.account_type === 2),
            isCreator: Boolean(user?.account_type === 3),
            isProfessional: Boolean(user?.is_professional_account),
            category: user?.category || user?.category_name || null,
            latestReelMedia,
            latestBestiesReelMedia,
            rawUser: user
          };
          API.hdAvatarCache.set(idStr, result);
          if (API.friendshipCache.has(idStr)) {
            const st = API.friendshipCache.get(idStr);
            if (result.isBestie) st.isBestie = true;
            if (user.is_private !== void 0) st.isPrivate = result.isPrivate;
            if (user.friendship_status?.following !== void 0) st.following = following;
            if (user.friendship_status?.outgoing_request !== void 0) st.outgoingRequest = outgoingRequest;
            if (user.friendship_status?.incoming_request !== void 0) st.incomingRequest = incomingRequest;
            st.isBusiness = result.isBusiness;
            st.isCreator = result.isCreator;
          } else {
            API.friendshipCache.set(idStr, {
              following,
              isBestie,
              isPrivate: result.isPrivate,
              isRestricted,
              outgoingRequest,
              incomingRequest,
              isFeedFavorite: false,
              isBusiness: result.isBusiness,
              isCreator: result.isCreator
            });
          }
          return result;
        }
      } catch (err) {
        if (err.name === "AbortError" || options.signal?.aborted) throw err;
        console.warn(`[IG Analyzer] Error fetching HD profile for @${username}:`, err);
      }
      return null;
    },
    validateTargetAccount: async (username, options = {}) => {
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      if (!cleanUser) {
        return { exists: false, error: "Please enter a valid Instagram username." };
      }
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const cleanUserLower = cleanUser.toLowerCase();
      const viewerId = Utils.getUserId();
      const viewerName = (Utils.getUsername() || "").toLowerCase();
      const snap = Storage.load();
      const isFollowingInSnap = Array.isArray(snap?.following) && snap.following.some((u) => {
        const name = typeof u === "string" ? u : u?.username;
        return name && name.toLowerCase() === cleanUserLower;
      });
      const isFollowerInSnap = Array.isArray(snap?.followers) && snap.followers.some((u) => {
        const name = typeof u === "string" ? u : u?.username;
        return name && name.toLowerCase() === cleanUserLower;
      });
      let resolvedId = options.userId && String(options.userId) !== "0" && String(options.userId) !== "null" ? String(options.userId).trim() : null;
      if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
        resolvedId = null;
      }
      if (!resolvedId && snap) {
        const findInSnap = (list) => Array.isArray(list) ? list.find((u) => {
          const name = typeof u === "string" ? u : u?.username;
          return name && name.toLowerCase() === cleanUserLower && u?.id && String(u.id) !== String(viewerId);
        }) : null;
        const matchUser = findInSnap(snap.following) || findInSnap(snap.followers);
        if (matchUser && matchUser.id) {
          resolvedId = String(matchUser.id);
        }
      }
      if (!resolvedId) {
        const existingTarget = Storage.getTargetData(cleanUser);
        if (existingTarget?.user?.id && (cleanUserLower === viewerName || String(existingTarget.user.id) !== String(viewerId))) {
          resolvedId = String(existingTarget.user.id);
        }
      }
      if (!resolvedId) {
        try {
          resolvedId = await API.resolveUserId(cleanUser, options);
        } catch (rErr) {
          if (rErr.name === "AbortError" || options.signal?.aborted) throw rErr;
          if (rErr.status === 404 || rErr.message && rErr.message.includes("404")) {
            return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
          }
        }
      }
      if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
        resolvedId = null;
      }
      if (resolvedId) {
        try {
          const profile = await API.fetchUserProfileHd(resolvedId, cleanUser, { ...options, forceRefresh: true });
          if (profile) {
            const profileUsername = (profile.username || "").toLowerCase();
            if (profileUsername && profileUsername !== cleanUserLower) {
              return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            if (cleanUserLower !== viewerName && viewerId && String(profile.id) === String(viewerId)) {
              return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            let isFollowing = isFollowingInSnap;
            let isFollowedBy = isFollowerInSnap;
            let isPrivate = Boolean(profile.isPrivate);
            try {
              const friendshipRes = await API.fetchWithRetry(`https://www.instagram.com/api/v1/friendships/show/${resolvedId}/`, {
                headers: {
                  "X-IG-App-ID": "936619743392459",
                  "X-Requested-With": "XMLHttpRequest",
                  "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
                },
                optional: true,
                silent: true,
                signal: options.signal
              }, 1);
              if (friendshipRes) {
                if (friendshipRes.following !== void 0) isFollowing = Boolean(friendshipRes.following) || isFollowing;
                if (friendshipRes.followed_by !== void 0) isFollowedBy = Boolean(friendshipRes.followed_by) || isFollowedBy;
                if (friendshipRes.is_private !== void 0) isPrivate = Boolean(friendshipRes.is_private);
              }
            } catch (fErr) {
              if (fErr.name === "AbortError" || options.signal?.aborted) throw fErr;
            }
            return {
              exists: true,
              user: {
                id: resolvedId,
                username: profile.username || cleanUser,
                fullName: profile.fullName || "",
                isPrivate,
                isVerified: Boolean(profile.isVerified),
                followerCount: profile.followerCount || 0,
                followingCount: profile.followingCount || 0,
                mediaCount: profile.mediaCount || 0,
                profilePicUrl: profile.hdUrl || null,
                followedByViewer: isFollowing,
                followsViewer: isFollowedBy,
                requestedByViewer: Boolean(profile.outgoingRequest)
              }
            };
          }
        } catch (graphqlErr) {
          if (graphqlErr.name === "AbortError" || options.signal?.aborted) throw graphqlErr;
        }
      }
      try {
        const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`;
        const json = await API.fetchWithRetry(url, {
          headers: {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
          },
          optional: true,
          silent: true,
          signal: options.signal
        }, 1);
        const u = json?.data?.user;
        if (u && u.id) {
          const uName = (u.username || "").toLowerCase();
          if (uName !== cleanUserLower) {
            return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
          }
          if (cleanUserLower !== viewerName && viewerId && String(u.id) === String(viewerId)) {
            return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
          }
          const followedByViewer = u.followed_by_viewer !== void 0 ? Boolean(u.followed_by_viewer) : isFollowingInSnap;
          const followsViewer = u.follows_viewer !== void 0 ? Boolean(u.follows_viewer) : isFollowerInSnap;
          return {
            exists: true,
            user: {
              id: String(u.id),
              username: u.username || cleanUser,
              fullName: u.full_name || "",
              isPrivate: Boolean(u.is_private),
              isVerified: Boolean(u.is_verified),
              followerCount: u.edge_followed_by?.count || 0,
              followingCount: u.edge_follow?.count || 0,
              mediaCount: u.edge_owner_to_timeline_media?.count || 0,
              profilePicUrl: u.profile_pic_url_hd || u.profile_pic_url || null,
              followedByViewer,
              followsViewer,
              requestedByViewer: Boolean(u.requested_by_viewer)
            }
          };
        }
      } catch (err) {
        if (err.name === "AbortError" || options.signal?.aborted) throw err;
        if (err.message && err.message.includes("404")) {
          return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
        }
        if (err.message && err.message.includes("429")) {
          console.warn(`[IG Analyzer] web_profile_info returned 429 for @${cleanUser}, falling through to HTML verification.`);
        }
      }
      try {
        const res = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
          credentials: "include",
          signal: options.signal
        });
        if (res.status === 404) {
          return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
        }
        if (res.status === 429) {
          return { exists: false, error: `Instagram rate limit (429) active. Please wait a moment before trying again.` };
        }
        if (res.ok) {
          const html = await res.text();
          const isNotFound = html.includes("Page Not Found") || html.includes("Page not found") || html.includes("Página no encontrada") || html.includes("Sorry, this page isn't available") || html.includes("Esta página no está disponible") || html.includes('"entry_data":{"HttpErrorPage"');
          if (isNotFound) {
            return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
          }
          if (!html.includes(`/${cleanUser}/`) && !html.includes(`"${cleanUser}"`)) {
            return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
      }
      return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
    },
    fetchTargetNetwork: async (targetUser, options = {}, progressCallback = null, logCallback = null) => {
      if (!targetUser || !targetUser.id) {
        throw new Error("Invalid target user data provided.");
      }
      const log = (msg) => {
        if (typeof logCallback === "function") logCallback(msg);
      };
      const setProgress = (curr, total, label) => {
        if (typeof progressCallback === "function") progressCallback(curr, total, label);
      };
      const isRestricted = targetUser.isPrivate && !targetUser.followedByViewer;
      if (isRestricted) {
        log(`[Privacy Notice] @${targetUser.username} is a private account you do not follow. Network lists are restricted by Meta.`);
        return {
          followers: [],
          following: [],
          mutuals: [],
          isRestricted: true
        };
      }
      log(`[Extraction] Beginning extraction for target account @${targetUser.username}...`);
      const extractList = async (label, expectedTotal) => {
        const users = [];
        let maxId = null;
        let hasNext = true;
        const endpoint = label === "following" ? "following" : "followers";
        while (hasNext) {
          if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
          let url = `https://www.instagram.com/api/v1/friendships/${targetUser.id}/${endpoint}/?count=50&search_surface=follow_list_page`;
          if (maxId) {
            url += `&max_id=${encodeURIComponent(maxId)}`;
          }
          const json = await API.fetchWithRetry(url, options);
          const list = json?.users;
          if (!Array.isArray(list)) {
            log(`[Warning] Received non-array response for ${label}.`);
            break;
          }
          list.forEach((u) => {
            const username = u?.username;
            if (!username) return;
            users.push({
              id: u?.pk ? String(u.pk) : u?.id ? String(u.id) : null,
              username: String(username),
              fullName: u?.full_name || "",
              isPrivate: Boolean(u?.is_private),
              isVerified: Boolean(u?.is_verified),
              profilePicUrl: u?.profile_pic_url || null,
              latestReelMedia: u?.latest_reel_media || 0
            });
          });
          maxId = json?.next_max_id || null;
          hasNext = Boolean(maxId);
          const total = expectedTotal > 0 ? expectedTotal : 0;
          setProgress(users.length, total, `Extracting target ${label} (${users.length}${total > 0 ? "/" + total : ""})...`);
          if (hasNext) {
            await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800, options.signal);
          }
        }
        return users;
      };
      log(`Extracting followers for @${targetUser.username} (expected: ~${targetUser.followerCount || 0})...`);
      const followers = await extractList("followers", targetUser.followerCount || 0);
      log(`Extracted ${followers.length} followers for @${targetUser.username}.`);
      await Utils.sleep(1e3 + Math.random() * 500, options.signal);
      log(`Extracting following for @${targetUser.username} (expected: ~${targetUser.followingCount || 0})...`);
      const following = await extractList("following", targetUser.followingCount || 0);
      log(`Extracted ${following.length} following for @${targetUser.username}.`);
      const followerUsernames = new Set(followers.map((u) => u.username));
      const mutuals = following.filter((u) => followerUsernames.has(u.username));
      log(`Computed ${mutuals.length} mutual connections for @${targetUser.username}.`);
      return {
        followers,
        following,
        mutuals,
        isRestricted: false
      };
    }
  };
  const BACKUP_MAX_DEPTH = 20;
  const BACKUP_UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const BACKUP_TAB_ID = "ig-tab-backup";
  const BACKUP_POPUP_ID = "ig-backup-popup";
  let backupStatusNode = null;
  let backupFileInputNode = null;
  let backupPopupNode = null;
  let backupTabButtonNode = null;
  const getScriptMetadata = () => {
    const scriptInfo = typeof GM_info !== "undefined" ? GM_info?.script : null;
    return {
      scriptId: CONFIG.SCRIPT_ID,
      scriptName: scriptInfo?.name || CONFIG.SCRIPT_NAME,
      scriptVersion: scriptInfo?.version || "0.0.0"
    };
  };
  const setBackupStatus = (message, kind = "info") => {
    if (backupStatusNode) {
      backupStatusNode.dataset.state = kind;
      backupStatusNode.textContent = message;
    }
    if (kind === "error") {
      Utils.logError(message, null);
      return;
    }
    Utils.log(message);
  };
  const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";
  const isSafeJsonValue = (value, depth = 0) => {
    if (depth > BACKUP_MAX_DEPTH) return false;
    if (value === null) return true;
    const valueType = typeof value;
    if (valueType === "string" || valueType === "boolean") return true;
    if (valueType === "number") return Number.isFinite(value);
    if (Array.isArray(value)) {
      return value.every((item) => isSafeJsonValue(item, depth + 1));
    }
    if (!isPlainObject(value)) {
      return false;
    }
    return Object.entries(value).every(([key, entryValue]) => {
      if (typeof key !== "string" || BACKUP_UNSAFE_KEYS.has(key)) return false;
      return isSafeJsonValue(entryValue, depth + 1);
    });
  };
  const isSafeStorageKey = (key) => typeof key === "string" && key.length > 0 && !BACKUP_UNSAFE_KEYS.has(key);
  const ALLOWED_BACKUP_KEY_BASES = [
    CONFIG.STORAGE_KEY,
    CONFIG.WHITELIST_KEY,
    CONFIG.HISTORY_KEY,
    CONFIG.CHURN_KEY,
    CONFIG.DEACTIVATED_KEY,
    CONFIG.BLOCKED_KEY,
    CONFIG.RENAMED_KEY,
    CONFIG.NEW_FOLLOWERS_KEY,
    CONFIG.TARGET_TRACKER_KEY,
    CONFIG.STORY_ANOMALY_KEY,
    CONFIG.STORY_OBS_KEY,
    CONFIG.TOUR_KEY,
    CONFIG.POSITION_KEY,
    "followers",
    "following",
    "followersDetailed",
    "followingDetailed",
    "notFollowingBackDetailed",
    "fansDetailed",
    "mutualsDetailed",
    "newFollowers",
    "newFollowersDetailed",
    "whitelist",
    "targetTracker",
    "unfollowers",
    "deactivated",
    "blocked",
    "renamed",
    "history"
  ];
  const isAuthorizedBackupKey = (key) => {
    if (!isSafeStorageKey(key)) return false;
    return ALLOWED_BACKUP_KEY_BASES.some((base) => {
      if (key === base) return true;
      if (key.startsWith(base + "_")) {
        const suffix = key.slice(base.length + 1);
        return /^[0-9]+$/.test(suffix);
      }
      return false;
    });
  };
  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The backup file could not be read."));
    reader.readAsText(file);
  });
  const getCurrentStorageKeys = async () => {
    if (typeof GM_listValues !== "function") {
      throw new Error("The GM_listValues API is not available in this environment.");
    }
    const keys = await Promise.resolve(GM_listValues());
    return Array.isArray(keys) ? keys.filter(isSafeStorageKey) : [];
  };
  const getStoredValue = async (key) => Promise.resolve(GM_getValue(key));
  const createDownload = (filename, content) => {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };
  const buildBackupFilename = () => {
    const timestamp = ( new Date()).toISOString().replace(/[:]/g, "-").replace(/\.\d{3}Z$/, "Z");
    return `${CONFIG.SCRIPT_ID}-backup-${timestamp}.json`;
  };
  const writeBackupStatus = (message, kind = "info") => {
    setBackupStatus(message, kind);
  };
  const createSvgElement = (tagName, attributes = {}) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    return element;
  };
  const createBackupIcon = () => {
    const svg = createSvgElement("svg", {
      viewBox: "0 0 32 32",
      fill: "currentColor",
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true",
      focusable: "false"
    });
    const group = createSvgElement("g", {
      transform: "translate(-152 -515)",
      fill: "currentColor"
    });
    const path = createSvgElement("path", {
      d: "M171,525 C171.552,525 172,524.553 172,524 L172,520 C172,519.447 171.552,519 171,519 C170.448,519 170,519.447 170,520 L170,524 C170,524.553 170.448,525 171,525 L171,525 Z M182,543 C182,544.104 181.104,545 180,545 L156,545 C154.896,545 154,544.104 154,543 L154,519 C154,517.896 154.896,517 156,517 L158,517 L158,527 C158,528.104 158.896,529 160,529 L176,529 C177.104,529 178,528.104 178,527 L178,517 L180,517 C181.104,517 182,517.896 182,519 L182,543 L182,543 Z M160,517 L176,517 L176,526 C176,526.553 175.552,527 175,527 L161,527 C160.448,527 160,526.553 160,526 L160,517 L160,517 Z M180,515 L156,515 C153.791,515 152,516.791 152,519 L152,543 C152,545.209 153.791,547 156,547 L180,547 C182.209,547 184,545.209 184,543 L184,519 C184,516.791 182.209,515 180,515 L180,515 Z"
    });
    group.appendChild(path);
    svg.appendChild(group);
    return svg;
  };
  const createCloseIcon = () => {
    const svg = createSvgElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      stroke: "currentColor",
      "aria-hidden": "true",
      focusable: "false"
    });
    const group = createSvgElement("g", {
      id: "SVGRepo_iconCarrier"
    });
    const bgCarrier = createSvgElement("g", {
      id: "SVGRepo_bgCarrier",
      "stroke-width": "0"
    });
    const tracerCarrier = createSvgElement("g", {
      id: "SVGRepo_tracerCarrier",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    const innerGroup = createSvgElement("g", {
      id: "Menu / Close_LG"
    });
    const path = createSvgElement("path", {
      id: "Vector",
      d: "M21 21L12 12M12 12L3 3M12 12L21.0001 3M12 12L3 21.0001",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    group.appendChild(bgCarrier);
    group.appendChild(tracerCarrier);
    innerGroup.appendChild(path);
    group.appendChild(innerGroup);
    svg.appendChild(group);
    return svg;
  };
  const ensureBackupPopup = () => {
    if (backupPopupNode) return backupPopupNode;
    const overlay = document.createElement("div");
    overlay.id = BACKUP_POPUP_ID;
    overlay.className = "ig-backup-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const dialog = document.createElement("div");
    dialog.className = "ig-backup-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ig-backup-title");
    const header = document.createElement("div");
    header.className = "ig-backup-dialog-header";
    const heading = document.createElement("div");
    heading.id = "ig-backup-title";
    heading.className = "ig-backup-dialog-title";
    heading.textContent = "Backup";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "ig-backup-close-btn";
    closeButton.setAttribute("aria-label", "Close backup popup");
    closeButton.title = "Close";
    closeButton.appendChild(createCloseIcon());
    closeButton.addEventListener("click", () => {
      hideBackupPopup();
    });
    const description = document.createElement("p");
    description.className = "ig-backup-dialog-description";
    description.textContent = "Export or import the current script state as a local JSON backup.";
    const actions = document.createElement("div");
    actions.className = "ig-backup-dialog-actions";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.className = "ig-btn ig-backup-btn ig-backup-btn-export";
    exportButton.textContent = "Export Backup";
    exportButton.addEventListener("click", () => {
      exportBackup().catch(() => {
      });
    });
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "ig-btn ig-backup-btn ig-backup-btn-import";
    importButton.textContent = "Import Backup";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.className = "ig-backup-file-input";
    fileInput.tabIndex = -1;
    const status = document.createElement("div");
    status.id = "ig-backup-status";
    status.className = "ig-backup-status";
    status.textContent = "Backups are stored only in this browser.";
    importButton.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", async () => {
      const selectedFile = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
      if (!selectedFile) return;
      await importBackup(selectedFile);
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        hideBackupPopup();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) {
        hideBackupPopup();
      }
    });
    header.appendChild(heading);
    header.appendChild(closeButton);
    actions.appendChild(exportButton);
    actions.appendChild(importButton);
    dialog.appendChild(header);
    dialog.appendChild(description);
    dialog.appendChild(actions);
    dialog.appendChild(status);
    dialog.appendChild(fileInput);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    backupPopupNode = overlay;
    backupFileInputNode = fileInput;
    backupStatusNode = status;
    return backupPopupNode;
  };
  const openBackupPopup = () => {
    const popup = ensureBackupPopup();
    popup.classList.add("is-open");
    popup.setAttribute("aria-hidden", "false");
  };
  const hideBackupPopup = () => {
    if (!backupPopupNode) return;
    backupPopupNode.classList.remove("is-open");
    backupPopupNode.setAttribute("aria-hidden", "true");
  };
  const toggleBackupPopup = () => {
    if (!backupPopupNode || !backupPopupNode.classList.contains("is-open")) {
      openBackupPopup();
      return;
    }
    hideBackupPopup();
  };
  const validateBackupSchema = (payload) => {
    if (!isPlainObject(payload)) {
      return { valid: false, reason: "The file does not contain a valid JSON object." };
    }
    const meta = payload.meta;
    const data = payload.data;
    if (!isPlainObject(meta)) {
      return { valid: false, reason: "The backup metadata block is missing." };
    }
    if (!isPlainObject(data)) {
      return { valid: false, reason: "The backup data block is missing." };
    }
    const expectedSchemaVersion = CONFIG.BACKUP_SCHEMA_VERSION;
    if (meta.schemaVersion !== expectedSchemaVersion) {
      return {
        valid: false,
        reason: `The schema version is not compatible. Expected ${expectedSchemaVersion}.`
      };
    }
    if (typeof meta.scriptId !== "string" || meta.scriptId !== CONFIG.SCRIPT_ID) {
      return { valid: false, reason: "The backup does not belong to this script." };
    }
    if (typeof meta.scriptName !== "string" || typeof meta.scriptVersion !== "string") {
      return { valid: false, reason: "The backup metadata is incomplete." };
    }
    if (typeof meta.exportedAt !== "string" || Number.isNaN(Date.parse(meta.exportedAt))) {
      return { valid: false, reason: "The export timestamp is invalid." };
    }
    const dataEntries = Object.entries(data);
    if (typeof meta.keyCount === "number" && meta.keyCount !== dataEntries.length) {
      return { valid: false, reason: "The backup appears to be corrupted or truncated." };
    }
    for (const [key, value] of dataEntries) {
      if (!isAuthorizedBackupKey(key)) {
        return { valid: false, reason: `The key "${key}" is not recognized or authorized for this script.` };
      }
      if (!isSafeJsonValue(value)) {
        return { valid: false, reason: `The key "${key}" contains unsupported values.` };
      }
    }
    return {
      valid: true,
      payload: {
        meta,
        data
      }
    };
  };
  const exportBackup = async () => {
    try {
      const listedKeys = await getCurrentStorageKeys().catch(() => []);
      const currentId = Storage.getCurrentUserId() || Utils.getUserId();
      const baseKeys = [
        CONFIG.STORAGE_KEY,
        CONFIG.WHITELIST_KEY,
        CONFIG.HISTORY_KEY,
        CONFIG.CHURN_KEY,
        CONFIG.DEACTIVATED_KEY,
        CONFIG.BLOCKED_KEY,
        CONFIG.RENAMED_KEY,
        CONFIG.STORY_ANOMALY_KEY,
        CONFIG.STORY_OBS_KEY,
        CONFIG.TOUR_KEY,
        CONFIG.POSITION_KEY
      ];
      const allKeys = new Set(listedKeys);
      baseKeys.forEach((bk) => {
        allKeys.add(bk);
        if (currentId) {
          allKeys.add(`${bk}_${currentId}`);
        }
      });
      const data = Object.create(null);
      for (const key of allKeys) {
        if (isSafeStorageKey(key)) {
          const val = await getStoredValue(key);
          if (val !== void 0 && val !== null) {
            data[key] = val;
          }
        }
      }
      const metadata = getScriptMetadata();
      const payload = {
        meta: {
          scriptId: metadata.scriptId,
          scriptName: metadata.scriptName,
          scriptVersion: metadata.scriptVersion,
          schemaVersion: CONFIG.BACKUP_SCHEMA_VERSION,
          exportedAt: Utils.now(),
          keyCount: Object.keys(data).length
        },
        data
      };
      const filename = buildBackupFilename();
      createDownload(filename, JSON.stringify(payload, null, 2));
      writeBackupStatus(`Backup exported: ${filename}`, "success");
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The backup could not be exported.";
      writeBackupStatus(message, "error");
      throw error;
    }
  };
  const clearCurrentStorage = async () => {
    if (typeof GM_deleteValue !== "function") {
      throw new Error("The GM_deleteValue API is not available in this environment.");
    }
    const currentKeys = await getCurrentStorageKeys();
    for (const key of currentKeys) {
      GM_deleteValue(key);
    }
  };
  const importBackup = async (file) => {
    if (!(file instanceof File)) {
      writeBackupStatus("Select a valid .json file.", "error");
      return false;
    }
    try {
      const fileText = await readFileAsText(file);
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(fileText);
      } catch {
        throw new Error("The file is corrupted or does not contain valid JSON.");
      }
      const validation = validateBackupSchema(parsedPayload);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }
      const { meta, data } = validation.payload;
      const confirmationMessage = [
        "This backup will overwrite all current script data.",
        "",
        `Script: ${meta.scriptName}`,
        `Version: ${meta.scriptVersion}`,
        `Exported at: ${meta.exportedAt}`,
        "",
        "Do you want to continue?"
      ].join("\n");
      if (!window.confirm(confirmationMessage)) {
        writeBackupStatus("Import canceled by the user.", "info");
        return false;
      }
      await clearCurrentStorage();
      for (const [key, value] of Object.entries(data)) {
        GM_setValue(key, value);
      }
      const currentUserId2 = Storage.getCurrentUserId() || Utils.getUserId();
      let restoredSnapshot = null;
      if (currentUserId2 && isPlainObject(data[`${CONFIG.STORAGE_KEY}_${currentUserId2}`])) {
        restoredSnapshot = data[`${CONFIG.STORAGE_KEY}_${currentUserId2}`];
      } else if (isPlainObject(data[CONFIG.STORAGE_KEY])) {
        restoredSnapshot = data[CONFIG.STORAGE_KEY];
      } else {
        const anySnapKey = Object.keys(data).find((k) => k.startsWith(`${CONFIG.STORAGE_KEY}_`));
        if (anySnapKey && isPlainObject(data[anySnapKey])) {
          restoredSnapshot = data[anySnapKey];
        }
      }
      if (!restoredSnapshot && Array.isArray(data.followers)) {
        restoredSnapshot = {
          version: 4,
          lastRun: meta.exportedAt || Utils.now(),
          followers: data.followers || [],
          following: data.following || [],
          followersDetailed: data.followersDetailed || [],
          followingDetailed: data.followingDetailed || [],
          notFollowingBackDetailed: data.notFollowingBackDetailed || [],
          fansDetailed: data.fansDetailed || [],
          mutualsDetailed: data.mutualsDetailed || [],
          unfollowers: Array.isArray(data.unfollowers) ? data.unfollowers : [],
          deactivated: Array.isArray(data.deactivated) ? data.deactivated : [],
          blocked: Array.isArray(data.blocked) ? data.blocked : [],
          renamed: Array.isArray(data.renamed) ? data.renamed : [],
          history: Array.isArray(data.history) ? data.history : []
        };
      }
      if (restoredSnapshot) {
        if (currentUserId2) {
          Storage.save(restoredSnapshot, currentUserId2);
        }
        GM_setValue(CONFIG.STORAGE_KEY, restoredSnapshot);
      }
      const syncListKey = (baseKey) => {
        let val = null;
        if (currentUserId2 && data[`${baseKey}_${currentUserId2}`] !== void 0) {
          val = data[`${baseKey}_${currentUserId2}`];
        } else if (data[baseKey] !== void 0) {
          val = data[baseKey];
        } else {
          const anyKey = Object.keys(data).find((k) => k.startsWith(`${baseKey}_`));
          if (anyKey && data[anyKey] !== void 0) {
            val = data[anyKey];
          }
        }
        if (val !== null && val !== void 0) {
          if (currentUserId2) {
            Storage.setScopedValue(baseKey, val, currentUserId2);
          }
          GM_setValue(baseKey, val);
        }
      };
      syncListKey(CONFIG.HISTORY_KEY);
      syncListKey(CONFIG.WHITELIST_KEY);
      syncListKey(CONFIG.CHURN_KEY);
      syncListKey(CONFIG.DEACTIVATED_KEY);
      syncListKey(CONFIG.BLOCKED_KEY);
      syncListKey(CONFIG.RENAMED_KEY);
      syncListKey(CONFIG.STORY_OBS_KEY);
      syncListKey(CONFIG.POSITION_KEY);
      writeBackupStatus("Backup restored successfully. Reloading the interface...", "success");
      window.setTimeout(() => window.location.reload(), 400);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The backup could not be imported.";
      writeBackupStatus(message, "error");
      window.alert(`Backup import error:

${message}`);
      return false;
    } finally {
      if (backupFileInputNode) {
        backupFileInputNode.value = "";
      }
    }
  };
  const createBackupUI = (hostElement = document.getElementById("ig-analyzer-panel")) => {
    if (!(hostElement instanceof HTMLElement)) {
      return null;
    }
    if (!backupTabButtonNode) {
      const tabsContainer = hostElement.querySelector("#ig-tabs");
      if (!tabsContainer) {
        return null;
      }
      const backupButton = document.createElement("button");
      backupButton.type = "button";
      backupButton.id = BACKUP_TAB_ID;
      backupButton.className = "ig-tab-btn ig-backup-tab-btn";
      backupButton.addEventListener("click", () => {
        backupButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        toggleBackupPopup();
      });
      const iconHolder = document.createElement("span");
      iconHolder.className = "ig-tab-icon ig-backup-tab-icon";
      iconHolder.appendChild(createBackupIcon());
      const label = document.createElement("span");
      label.className = "ig-tab-label";
      label.textContent = "Backup";
      backupButton.appendChild(iconHolder);
      backupButton.appendChild(label);
      tabsContainer.appendChild(backupButton);
      backupTabButtonNode = backupButton;
    }
    ensureBackupPopup();
    return backupTabButtonNode;
  };
  const Icons = {
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    neutral: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M5 12h14"/></svg>',
    link: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 4px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>',
logs: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    history: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    notFollowing: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="11" x2="23" y2="11"/></svg>',
    fans: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    mutuals: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    unfollowers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/></svg>',
    deactivated: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    blocked: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>',
    renamed: '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M 4 2.5 L 3 3.5 L 3 8 L 7.5 8 L 8.5 7 L 4.6601562 7 L 5.4628906 6.0722656 L 5.7695312 5.7441406 L 6.0996094 5.4414062 L 6.4492188 5.1621094 L 6.8203125 4.9101562 L 7.2089844 4.6875 L 7.6152344 4.4941406 L 8.0332031 4.3300781 L 8.4609375 4.2011719 L 8.8984375 4.1015625 L 9.3417969 4.0351562 L 9.7890625 4.0039062 L 10.238281 4.0058594 L 10.685547 4.0390625 L 11.128906 4.1054688 L 11.564453 4.2070312 L 11.994141 4.3398438 L 12.410156 4.5058594 L 12.814453 4.7011719 L 13.201172 4.9257812 L 13.572266 5.1777344 L 13.921875 5.4589844 L 14.25 5.7636719 L 14.554688 6.09375 L 14.833984 6.4453125 L 15.083984 6.8164062 L 15.310547 7.2050781 L 15.501953 7.609375 L 15.666016 8.0273438 L 15.796875 8.4550781 L 15.896484 8.8925781 L 15.962891 9.3359375 L 15.994141 9.7851562 L 15.994141 10 L 17 10 L 17 9.9902344 L 16.982422 9.5058594 L 16.931641 9.0214844 L 16.847656 8.5449219 L 16.728516 8.0742188 L 16.580078 7.6113281 L 16.398438 7.1621094 L 16.185547 6.7265625 L 15.945312 6.3046875 L 15.675781 5.9023438 L 15.376953 5.5175781 L 15.054688 5.15625 L 14.707031 4.8183594 L 14.335938 4.5058594 L 13.945312 4.2167969 L 13.535156 3.9570312 L 13.109375 3.7285156 L 12.666016 3.5273438 L 12.210938 3.3574219 L 11.746094 3.2207031 L 11.271484 3.1152344 L 10.792969 3.0449219 L 10.306641 3.0058594 L 9.8222656 3 L 9.3378906 3.0292969 L 8.8574219 3.0917969 L 8.3808594 3.1894531 L 7.9140625 3.3183594 L 7.4550781 3.4785156 L 7.0097656 3.6699219 L 6.578125 3.8925781 L 6.1640625 4.1445312 L 5.7675781 4.4238281 L 5.390625 4.7304688 L 5.0371094 5.0605469 L 4.7070312 5.4179688 L 4 6.234375 L 4 2.5 z M 3 10 L 3 10.007812 L 3.0175781 10.492188 L 3.0683594 10.976562 L 3.1523438 11.453125 L 3.2714844 11.923828 L 3.4199219 12.386719 L 3.6015625 12.835938 L 3.8144531 13.271484 L 4.0546875 13.693359 L 4.3242188 14.095703 L 4.6230469 14.480469 L 4.9453125 14.841797 L 5.2929688 15.179688 L 5.6640625 15.492188 L 6.0546875 15.78125 L 6.4648438 16.041016 L 6.890625 16.269531 L 7.3339844 16.470703 L 7.7890625 16.640625 L 8.2539062 16.777344 L 8.7285156 16.882812 L 9.2070312 16.953125 L 9.6933594 16.992188 L 10.177734 16.998047 L 10.662109 16.96875 L 11.142578 16.90625 L 11.619141 16.808594 L 12.085938 16.679688 L 12.544922 16.519531 L 12.990234 16.328125 L 13.421875 16.105469 L 13.835938 15.853516 L 14.232422 15.574219 L 14.609375 15.267578 L 14.962891 14.9375 L 15.292969 14.580078 L 16 13.763672 L 16 17.498047 L 17 16.498047 L 17 11.998047 L 12.5 11.998047 L 11.5 12.998047 L 15.339844 12.998047 L 14.537109 13.925781 L 14.230469 14.253906 L 13.900391 14.556641 L 13.550781 14.835938 L 13.179688 15.087891 L 12.791016 15.310547 L 12.384766 15.503906 L 11.966797 15.667969 L 11.539062 15.796875 L 11.101562 15.896484 L 10.658203 15.962891 L 10.210938 15.994141 L 9.7617188 15.992188 L 9.3144531 15.958984 L 8.8710938 15.892578 L 8.4355469 15.791016 L 8.0058594 15.658203 L 7.5898438 15.492188 L 7.1855469 15.296875 L 6.7988281 15.072266 L 6.4277344 14.820312 L 6.078125 14.539062 L 5.75 14.234375 L 5.4453125 13.904297 L 5.1660156 13.552734 L 4.9160156 13.181641 L 4.6894531 12.792969 L 4.4980469 12.388672 L 4.3339844 11.970703 L 4.203125 11.542969 L 4.1035156 11.105469 L 4.0371094 10.662109 L 4.0058594 10.212891 L 4.0058594 10 L 3 10 z"></path></svg>',
logo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
warning: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>',
play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    minimize: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    mailbox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6H17.2C18.8802 6 19.7202 6 20.362 6.32698C20.9265 6.6146 21.3854 7.07354 21.673 7.63803C22 8.27976 22 9.11984 22 10.8V18H11M7 6C9.20914 6 11 7.79086 11 10V18M7 6C4.79086 6 3 7.79086 3 10V18H11M17 3H14V12M10 18V21H14V18M7 12H7.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    metrics: '<svg width="14" height="14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" xml:space="preserve"><g><path d="M72,22H28c-3.3,0-6,2.7-6,6v44c0,3.3,2.7,6,6,6h44c3.3,0,6-2.7,6-6V28C78,24.7,75.3,22,72,22z M38,66 c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V55c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M48,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V40 c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M58,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V34c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M68,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V47c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z"></path></g></svg>',
    spy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M11 8a3 3 0 0 0-3 3"/></svg>',
    stop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align: middle;"><rect x="5" y="5" width="14" height="14" rx="2" ry="2"/></svg>',
    coffee: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
    lock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    star: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align: middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    clock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    verified: '<svg width="12" height="12" viewBox="0 0 24 24" fill="#0095f6" stroke="none" style="vertical-align: middle; margin-left: 3px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
    search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    clear: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    storyRing: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="9"/></svg>',
    filter: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    externalLink: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    briefcase: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    creator: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    inspect: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    posts: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    mutualsContext: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    userPlus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
    shieldCheck: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
    restore: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 3px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    trendingUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    trendingDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
    target: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    sparkles: '<svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e" stroke="none" style="vertical-align: middle;"><path d="M12 2l2.4 7.2L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></svg>',
    refresh: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>'
  };
  const mainCss = '#ig-analyzer-panel,#ig-target-subpanel,#ig-safety-modal,.ig-backup-overlay{--iga-bg-primary: rgba(15, 23, 42, .92);--iga-bg-secondary: rgba(30, 41, 59, .7);--iga-surface: rgba(30, 41, 59, .55);--iga-surface-hover: rgba(51, 65, 85, .6);--iga-surface-active: rgba(51, 65, 85, .85);--iga-border: rgba(255, 255, 255, .08);--iga-border-hover: rgba(255, 255, 255, .16);--iga-border-focus: rgba(59, 130, 246, .5);--iga-text-bright: #f8fafc;--iga-text-main: #cbd5e1;--iga-text-muted: #94a3b8;--iga-text-dim: #64748b;--iga-accent: #3b82f6;--iga-accent-hover: #2563eb;--iga-accent-active: #1d4ed8;--iga-accent-subtle: rgba(59, 130, 246, .14);--iga-accent-glow: 0 0 16px rgba(59, 130, 246, .35);--iga-accent-gradient: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);--iga-success: #10b981;--iga-success-hover: #059669;--iga-success-subtle: rgba(16, 185, 129, .14);--iga-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);--iga-danger: #ef4444;--iga-danger-hover: #dc2626;--iga-danger-subtle: rgba(239, 68, 68, .14);--iga-warning: #f59e0b;--iga-warning-subtle: rgba(245, 158, 11, .14);--iga-shadow-sm: 0 1px 3px rgba(0, 0, 0, .35);--iga-shadow-md: 0 6px 16px -2px rgba(0, 0, 0, .4);--iga-shadow-lg: 0 24px 64px -12px rgba(0, 0, 0, .65), 0 0 0 1px rgba(255, 255, 255, .08);--iga-radius-sm: 6px;--iga-radius-md: 10px;--iga-radius-lg: 14px;--iga-radius-xl: 18px;--iga-radius-full: 9999px;--iga-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;--iga-font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", Menlo, Monaco, Consolas, monospace;--iga-ease-spring: cubic-bezier(.16, 1, .3, 1);--iga-ease-default: cubic-bezier(.4, 0, .2, 1);--ig-panel-bg: var(--iga-bg-primary);--ig-panel-border: var(--iga-border);--ig-text-main: var(--iga-text-main);--ig-text-muted: var(--iga-text-muted);--ig-text-bright: var(--iga-text-bright);--ig-bg-input: var(--iga-surface);--ig-bg-hover: var(--iga-surface-hover);--ig-bg-active: var(--iga-surface-active);--ig-scrollbar-thumb: rgba(255, 255, 255, .15);--ig-scrollbar-thumb-hover: rgba(255, 255, 255, .25);--ig-shadow: var(--iga-shadow-lg);--ig-shadow-sm: var(--iga-shadow-sm);--ig-accent: var(--iga-accent);--ig-accent-hover: var(--iga-accent-hover);--ig-accent-soft: var(--iga-accent-subtle);--ig-success: var(--iga-success);--ig-success-hover: var(--iga-success-hover);--ig-danger: var(--iga-danger);--ig-danger-hover: var(--iga-danger-hover);--ig-warning: var(--iga-warning);--ig-btn-bg: var(--iga-surface);--ig-btn-border: var(--iga-border);--ig-btn-text: var(--iga-text-bright);--ig-btn-disabled-bg: rgba(255, 255, 255, .03);--ig-btn-disabled-border: rgba(255, 255, 255, .05);--ig-btn-disabled-text: rgba(255, 255, 255, .25);--ig-radius-sm: var(--iga-radius-sm);--ig-radius-md: var(--iga-radius-md);--ig-radius-lg: var(--iga-radius-lg);--ig-radius-full: var(--iga-radius-full)}#ig-analyzer-panel.ig-light-theme,#ig-target-subpanel.ig-light-theme,#ig-safety-modal.ig-light-theme,.ig-backup-overlay.ig-light-theme{--iga-bg-primary: rgba(255, 255, 255, .96);--iga-bg-secondary: #f8fafc;--iga-surface: #f1f5f9;--iga-surface-hover: #e2e8f0;--iga-surface-active: #cbd5e1;--iga-border: #e2e8f0;--iga-border-hover: #cbd5e1;--iga-border-focus: rgba(37, 99, 235, .4);--iga-text-bright: #0f172a;--iga-text-main: #334155;--iga-text-muted: #64748b;--iga-text-dim: #94a3b8;--iga-accent: #2563eb;--iga-accent-hover: #1d4ed8;--iga-accent-active: #1e40af;--iga-accent-subtle: rgba(37, 99, 235, .08);--iga-accent-glow: 0 0 16px rgba(37, 99, 235, .2);--iga-accent-gradient: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);--iga-success: #10b981;--iga-success-hover: #059669;--iga-success-subtle: rgba(16, 185, 129, .1);--iga-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);--iga-danger: #dc2626;--iga-danger-hover: #b91c1c;--iga-danger-subtle: rgba(220, 38, 38, .08);--iga-warning: #d97706;--iga-warning-subtle: rgba(217, 119, 6, .08);--iga-shadow-sm: 0 1px 3px rgba(15, 23, 42, .08);--iga-shadow-md: 0 6px 16px -2px rgba(15, 23, 42, .1);--iga-shadow-lg: 0 24px 64px -12px rgba(15, 23, 42, .18), 0 0 0 1px rgba(15, 23, 42, .06);--ig-scrollbar-thumb: rgba(15, 23, 42, .15);--ig-scrollbar-thumb-hover: rgba(15, 23, 42, .25);--ig-btn-disabled-bg: rgba(15, 23, 42, .03);--ig-btn-disabled-border: rgba(15, 23, 42, .06);--ig-btn-disabled-text: rgba(15, 23, 42, .3)}#ig-analyzer-panel{position:fixed;top:80px;right:20px;width:717px;min-width:440px;max-width:calc(100vw - 40px);height:560px;min-height:260px;max-height:calc(100vh - 40px);background:var(--iga-bg-primary);border:1px solid var(--iga-border);color:var(--iga-text-main);box-shadow:var(--iga-shadow-lg);-webkit-backdrop-filter:blur(28px) saturate(190%);backdrop-filter:blur(28px) saturate(190%);font-family:var(--iga-font-sans);font-size:13px;line-height:1.5;padding:16px;z-index:999999;border-radius:var(--iga-radius-xl);display:flex;flex-direction:column;resize:both;overflow:hidden;transform-origin:center center;transition:background .3s var(--iga-ease-default),border-color .3s var(--iga-ease-default),box-shadow .28s cubic-bezier(.34,1.56,.64,1),transform .28s cubic-bezier(.34,1.56,.64,1),height .25s var(--iga-ease-spring);box-sizing:border-box}#ig-analyzer-panel.is-dragging{transform:scale(.985);box-shadow:0 35px 80px -15px #000c,0 0 0 1px #ffffff1f;-webkit-backdrop-filter:blur(36px) saturate(210%);backdrop-filter:blur(36px) saturate(210%);transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s cubic-bezier(.16,1,.3,1);cursor:grabbing!important}#ig-analyzer-panel.ig-light-theme.is-dragging{box-shadow:0 35px 80px -15px #0f172a40,0 0 0 1px #0f172a14}#ig-analyzer-panel *{box-sizing:border-box}#ig-analyzer-panel.is-minimized{height:64px!important;min-height:64px!important;resize:none!important;padding-bottom:0;overflow:hidden}#ig-analyzer-panel.is-minimized>*:not(#ig-header){display:none!important}#ig-analyzer-panel.is-minimized #ig-header{margin-bottom:0;padding-bottom:0;border-bottom:none}#ig-analyzer-panel #ig-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--iga-border);cursor:grab;-webkit-user-select:none;user-select:none;flex-shrink:0}#ig-analyzer-panel #ig-header:active{cursor:grabbing}#ig-analyzer-panel .ig-header-left{display:flex;align-items:center;gap:10px}#ig-analyzer-panel .ig-logo{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--iga-accent-subtle);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);color:var(--iga-accent);box-shadow:var(--iga-shadow-sm);transition:transform .2s var(--iga-ease-spring)}#ig-analyzer-panel .ig-logo:hover{transform:scale(1.06)}#ig-analyzer-panel .ig-title{font-size:14px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.3px;line-height:1}#ig-analyzer-panel .ig-header-right{display:flex;align-items:center;gap:8px}#ig-analyzer-panel #ig-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;background:var(--iga-surface);padding:4px 10px;border-radius:var(--iga-radius-full);color:var(--iga-text-muted);border:1px solid var(--iga-border);transition:all .2s var(--iga-ease-default)}#ig-analyzer-panel .ig-status-dot{width:7px;height:7px;border-radius:50%;background:var(--iga-text-dim);display:inline-block;flex-shrink:0;position:relative}#ig-analyzer-panel #ig-status.is-active .ig-status-dot,#ig-analyzer-panel #ig-status:not(:empty) .ig-status-dot{background:var(--iga-success);box-shadow:0 0 8px var(--iga-success);animation:iga-pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes iga-pulse{0%,to{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.15)}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-actions{display:flex;align-items:center;gap:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border-radius:var(--iga-radius-sm);background:transparent;border:1px solid transparent;color:var(--iga-text-muted);cursor:pointer;transition:all .15s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn:active{transform:scale(.94)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn-close:hover{background:var(--iga-danger-subtle);color:var(--iga-danger);border-color:#ef44444d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-actions-bar{display:flex;gap:8px;margin-bottom:12px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;background:var(--iga-surface);color:var(--iga-text-bright);border:1px solid var(--iga-border);transition:all .2s var(--iga-ease-default);flex:1;white-space:nowrap;line-height:1;position:relative;overflow:hidden}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-sm{padding:6px 12px;font-size:11px;flex:initial}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-icon svg{display:block}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--iga-shadow-md);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:active:not(:disabled){transform:translateY(0);box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:disabled{opacity:.45;cursor:not-allowed;background:var(--ig-btn-disabled-bg)!important;border-color:var(--ig-btn-disabled-border)!important;color:var(--ig-btn-disabled-text)!important;transform:none!important;box-shadow:none!important}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-run,#ig-target-run,.ig-btn-primary){background:linear-gradient(90deg,#1d4ed8,#3b82f6 28%,#60a5fa,#3b82f6 72%,#1d4ed8);background-size:200% 100%;background-position:0% 50%;border-color:#ffffff2e;color:#fff;box-shadow:0 4px 12px #2563eb4d;transition:transform .2s var(--iga-ease-default),box-shadow .2s var(--iga-ease-default),background-position .3s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-run,#ig-target-run,.ig-btn-primary):hover:not(:disabled){animation:iga-gradient-move 2s linear infinite;box-shadow:0 6px 20px #2563eb73;transform:translateY(-1px)}@keyframes iga-gradient-move{0%{background-position:200% 50%}to{background-position:0% 50%}}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):not(:disabled){background:var(--iga-success-gradient)!important;border-color:#ffffff26!important;color:#fff!important;box-shadow:0 4px 12px #10b98140}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):not(:disabled):hover{background:linear-gradient(135deg,#059669,#047857)!important;box-shadow:0 6px 18px #10b98166}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):disabled{background:var(--ig-btn-disabled-bg)!important;border-color:var(--ig-btn-disabled-border)!important;color:var(--ig-btn-disabled-text)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) #ig-reset,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn.ig-btn-danger{background:transparent;border-color:#ef444459;color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) #ig-reset:hover:not(:disabled),:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn.ig-btn-danger:hover:not(:disabled){background:var(--iga-danger-subtle);border-color:var(--iga-danger);color:var(--iga-danger-hover);box-shadow:0 4px 12px #ef444433}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-container,#ig-target-progress-container,.ig-progress-container){width:100%;background:var(--iga-surface);border-radius:var(--iga-radius-full);height:5px;margin-bottom:12px;overflow:hidden;display:none;border:1px solid var(--iga-border);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar){width:0%;background:linear-gradient(90deg,var(--iga-accent),#a855f7);height:100%;border-radius:var(--iga-radius-full);transition:width .35s var(--iga-ease-default);position:relative}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar):after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:iga-shimmer 1.5s infinite}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar).is-indeterminate{width:35%!important;animation:iga-indeterminate 1.5s cubic-bezier(.4,0,.2,1) infinite}@keyframes iga-shimmer{0%{transform:translate(-100%)}to{transform:translate(100%)}}@keyframes iga-indeterminate{0%{transform:translate(-100%)}50%{transform:translate(180%)}to{transform:translate(350%)}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-wrapper{position:relative;margin-bottom:8px;flex-shrink:0;display:flex;align-items:center}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-container{position:relative;display:flex;flex-wrap:nowrap;gap:4px;padding:4px;background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);overflow-x:auto;overflow-y:hidden;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none;width:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-container::-webkit-scrollbar{display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-indicator{position:absolute;top:0;left:0;height:0;width:0;opacity:0;border-radius:var(--iga-radius-md);background:var(--iga-bg-primary);border:1px solid var(--iga-border-hover);box-shadow:var(--iga-shadow-sm);pointer-events:none;z-index:1;transition:transform .3s cubic-bezier(.16,1,.3,1),width .3s cubic-bezier(.16,1,.3,1),height .3s cubic-bezier(.16,1,.3,1),opacity .2s ease;transform:translateZ(0)}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-tab-indicator{background:var(--iga-bg-primary);border:1px solid var(--iga-border-hover);box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn{position:relative!important;z-index:2!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:6px 12px!important;flex:0 0 auto!important;background:transparent!important;border:1px solid transparent!important;color:var(--iga-text-muted)!important;font-size:11px!important;font-weight:600!important;border-radius:var(--iga-radius-md)!important;cursor:pointer!important;transition:color .2s var(--iga-ease-default),background .2s var(--iga-ease-default),border-color .2s var(--iga-ease-default)!important;white-space:nowrap!important;line-height:1!important;-webkit-user-select:none!important;user-select:none!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn:hover:not(.active){color:var(--iga-text-bright)!important;background:var(--iga-surface-hover)!important;border-color:var(--iga-border)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:var(--iga-accent)!important;font-weight:600!important}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-tab-btn.active{color:var(--iga-accent)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:14px;height:14px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-icon svg{width:100%;height:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-label{pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-backup-tab-btn{color:var(--iga-text-muted)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-backup-tab-btn:hover:not(.active){color:var(--iga-text-bright)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(.ig-view,.ig-target-view){display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(.ig-view,.ig-target-view).active{display:block}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);padding:14px;font-size:12px;color:var(--iga-text-main);box-shadow:inset 0 1px 3px #0000001a}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar{width:6px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-track{background:transparent}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:var(--iga-radius-full)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-thumb:hover{background:var(--ig-scrollbar-thumb-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-log,#ig-target-view-logs){font-family:var(--iga-font-mono);font-size:11px;line-height:1.6}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry{display:flex;align-items:baseline;gap:8px;padding:4px 6px;color:var(--iga-text-main);border-bottom:1px solid rgba(255,255,255,.03);border-radius:var(--iga-radius-sm);transition:background .15s ease;word-break:break-word}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-log-entry{border-bottom:1px solid rgba(0,0,0,.03)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry:last-child{border-bottom:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry:hover{background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-time{color:var(--iga-accent);font-weight:600;font-size:10px;background:var(--iga-accent-subtle);padding:1px 6px;border-radius:var(--iga-radius-sm);flex-shrink:0;font-variant-numeric:tabular-nums;letter-spacing:-.2px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-section-title{display:flex;align-items:center;font-weight:700;font-size:13px;margin-bottom:12px;color:var(--iga-text-bright);letter-spacing:-.2px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;background:var(--iga-accent-subtle);color:var(--iga-accent);padding:0 8px;border-radius:var(--iga-radius-full);font-size:11px;font-weight:700;margin-left:8px;border:1px solid rgba(59,130,246,.2)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-toolbar{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-box{position:relative;display:flex;align-items:center;width:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-icon{position:absolute;left:10px;display:inline-flex;align-items:center;justify-content:center;color:var(--iga-text-dim);pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input{width:100%;height:32px;padding:0 30px 0 32px;font-size:11px;font-family:var(--iga-font-sans);color:var(--iga-text-bright);background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm);outline:none;box-sizing:border-box;transition:border-color .18s var(--iga-ease-default),box-shadow .18s var(--iga-ease-default),background .18s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input:focus{border-color:var(--iga-border-focus);background:var(--iga-surface-hover);box-shadow:0 0 0 2px var(--iga-accent-subtle)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input::placeholder{color:var(--iga-text-dim);font-size:11px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear{position:absolute;right:6px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--iga-text-dim);cursor:pointer;border-radius:50%;padding:0;transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chips{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:3px 2px;scrollbar-width:none;-ms-overflow-style:none;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chips::-webkit-scrollbar{display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:600;font-family:var(--iga-font-sans);color:var(--iga-text-muted);background:var(--iga-surface);border:1px solid var(--iga-border);cursor:pointer;transition:all .15s var(--iga-ease-default);-webkit-user-select:none;user-select:none;white-space:nowrap;line-height:1.2;box-sizing:border-box}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip.is-active{background:#3b82f62e;color:var(--iga-accent);border-color:var(--iga-accent);font-weight:700;box-shadow:0 1px 4px #3b82f640}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chip-count{font-size:9px;padding:0 4px;border-radius:6px;background:#ffffff14;color:var(--iga-text-dim);margin-left:2px;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip.is-active .ig-chip-count{background:var(--iga-accent);color:#fff}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-chip-count{background:#0000000f}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-filter-chip.is-active .ig-chip-count{background:var(--iga-accent);color:#fff}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chip-icon{display:inline-flex;align-items:center;justify-content:center}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-list{display:flex;flex-direction:column;flex:1;min-height:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--iga-text-muted);font-size:12px;padding:40px 16px;text-align:center;margin:auto 0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-icon{display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:var(--iga-text-dim);background:var(--iga-surface-hover);border-radius:var(--iga-radius-full);padding:10px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-icon svg{width:100%;height:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);background:var(--iga-surface);min-height:48px;flex-shrink:0;box-sizing:border-box;transition:background .2s var(--iga-ease-default),border-color .2s var(--iga-ease-default),transform .28s cubic-bezier(.4,0,.2,1),opacity .25s ease,max-height .28s ease,min-height .28s ease,margin .28s ease,padding .28s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row:hover{background:var(--iga-surface-hover);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row.ig-row-slide-out{transform:translate(100%);opacity:0;max-height:0;min-height:0;padding-top:0;padding-bottom:0;margin-bottom:0;border-color:transparent;pointer-events:none;overflow:hidden}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-info{display:flex;align-items:center;gap:10px;min-width:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-avatar{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--iga-accent-subtle);color:var(--iga-accent);font-size:12px;font-weight:700;flex-shrink:0;border:1px solid var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-username{color:var(--iga-text-bright);font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-badges{display:inline-flex;align-items:center;gap:4px;margin-left:6px;flex-wrap:wrap;vertical-align:middle}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-pill{display:inline-flex;align-items:center;gap:3px;padding:1px 5px;border-radius:var(--iga-radius-sm);font-size:10px;font-weight:600;line-height:1.3;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-private{background:#94a3b81f;color:var(--iga-text-muted);border:1px solid rgba(148,163,184,.22)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-bestie{background:#22c55e26;color:#22c55e;border:1px solid rgba(34,197,94,.35)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-pending{background:#f59e0b26;color:#f59e0b;border:1px solid rgba(245,158,11,.35)}:is(#ig-analyzer-panel,#ig-target-subpanel) .has-bestie-ring{outline:2px solid #22c55e!important;outline-offset:1px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-link{display:inline-flex;align-items:center;gap:4px;color:var(--iga-accent);text-decoration:none;font-weight:600;font-size:11px;padding:4px 8px;border-radius:var(--iga-radius-sm);background:var(--iga-accent-subtle);border:1px solid rgba(59,130,246,.2);transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-link:hover{background:var(--iga-accent);color:#fff;text-decoration:none}#ig-analyzer-panel .btn-whitelist,#ig-analyzer-panel .ig-btn-whitelist{background:var(--iga-surface)!important;border:1px solid var(--iga-border)!important;color:var(--iga-text-muted)!important;padding:4px 8px!important;font-size:10px!important;font-weight:600!important;border-radius:var(--iga-radius-sm)!important;cursor:pointer;transition:all .15s ease!important}#ig-analyzer-panel .btn-whitelist:hover,#ig-analyzer-panel .ig-btn-whitelist:hover{background:var(--iga-surface-active)!important;border-color:var(--iga-border-hover)!important;color:var(--iga-text-bright)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-spy-story,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-spy-story{display:inline-flex!important;align-items:center!important;gap:4px!important;background:#a855f71f!important;border:1px solid rgba(168,85,247,.3)!important;color:#c084fc!important;padding:4px 8px!important;font-size:10px!important;font-weight:600!important;border-radius:var(--iga-radius-sm)!important;cursor:pointer;transition:all .2s var(--iga-ease-default)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-spy-story:hover:not(:disabled),:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-spy-story:hover:not(:disabled){background:#a855f740!important;border-color:#c084fc!important;color:#fff!important;transform:translateY(-1px)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table{width:100%;text-align:left;border-collapse:separate;border-spacing:0;margin-top:4px;font-size:11px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table thead th{color:var(--iga-text-muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.6px;padding:8px 10px;border-bottom:1px solid var(--iga-border);position:sticky;top:0;background:var(--iga-surface);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:2}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table td{padding:8px 10px;border-bottom:1px solid var(--iga-border);color:var(--iga-text-main)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table tbody tr{transition:background .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table tbody tr:hover{background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-user{font-weight:600;color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-date{color:var(--iga-text-muted);font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-link{display:inline-flex;align-items:center;gap:4px;color:var(--iga-accent);text-decoration:none;font-weight:600}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-link:hover{text-decoration:underline}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-metric-value{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;font-weight:600;color:var(--iga-text-bright)}#ig-analyzer-panel .ig-pagination{display:flex;align-items:center;justify-content:space-between;padding:10px 4px 0;margin-top:8px;border-top:1px solid var(--iga-border);font-size:11px;color:var(--iga-text-muted);flex-shrink:0}#ig-analyzer-panel .ig-page-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:var(--iga-radius-sm);font-size:11px;font-weight:600;cursor:pointer;background:var(--iga-surface);color:var(--iga-text-main);border:1px solid var(--iga-border);transition:all .2s ease}#ig-analyzer-panel .ig-page-btn:hover:not(:disabled){background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-accent)}#ig-analyzer-panel .ig-page-btn:disabled{opacity:.35;cursor:not-allowed}#ig-analyzer-panel .ig-page-info{font-weight:600;letter-spacing:.02em}.ig-modal-overlay{position:fixed;inset:0;background:#000000a6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);z-index:2147483647;display:none;justify-content:center;align-items:center;animation:iga-fade-in .2s var(--iga-ease-default);padding:20px;box-sizing:border-box}.ig-modal-overlay *{box-sizing:border-box}@keyframes iga-fade-in{0%{opacity:0}to{opacity:1}}.ig-modal-content{background:var(--iga-bg-primary);border:1px solid var(--iga-border);padding:28px 24px;border-radius:var(--iga-radius-xl);width:440px;max-width:92vw;max-height:85vh;text-align:center;color:var(--iga-text-bright);box-shadow:var(--iga-shadow-lg);display:flex;flex-direction:column;align-items:center;animation:iga-modal-slide .25s var(--iga-ease-spring)}@keyframes iga-modal-slide{0%{opacity:0;transform:scale(.95) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}.ig-modal-icon{width:52px;height:52px;color:var(--iga-warning);margin-bottom:16px;padding:12px;background:var(--iga-warning-subtle);border:1px solid rgba(245,158,11,.25);border-radius:50%}.ig-modal-icon svg{width:100%;height:100%}.ig-modal-title{font-size:17px;font-weight:700;margin-bottom:8px;color:var(--iga-text-bright);letter-spacing:-.3px}.ig-modal-text{font-size:13px;line-height:1.6;color:var(--iga-text-muted);margin-bottom:24px;width:100%;max-height:58vh;overflow-y:auto;padding-right:2px}.ig-modal-actions{display:flex;gap:10px;width:100%}.ig-btn-cancel-modal,.ig-btn-confirm-modal{flex:1;padding:10px 16px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s var(--iga-ease-default)}.ig-btn-cancel-modal{background:var(--iga-surface);border:1px solid var(--iga-border);color:var(--iga-text-muted)}.ig-btn-cancel-modal:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}.ig-btn-confirm-modal{background:var(--iga-accent-gradient);border:1px solid rgba(255,255,255,.15);color:#fff;box-shadow:0 4px 12px #2563eb59}.ig-btn-confirm-modal:hover{box-shadow:0 6px 18px #2563eb80;transform:translateY(-1px)}#ig-analyzer-panel .ig-user-avatar-trigger{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;transition:transform .18s var(--iga-ease-default);flex-shrink:0}#ig-analyzer-panel .ig-user-avatar-trigger:hover{transform:scale(1.08)}#ig-analyzer-panel .ig-user-avatar-trigger:active{transform:scale(.96)}.ig-hd-modal-overlay{display:none;position:fixed;inset:0;background:#000000d1;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:100000;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:ig-hd-fade-in .2s ease forwards}@keyframes ig-hd-fade-in{0%{opacity:0}to{opacity:1}}.ig-hd-modal-card{background:var(--iga-bg-primary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-xl);padding:24px 20px 20px;width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;position:relative;box-shadow:0 24px 64px -12px #000000bf;color:var(--iga-text-bright);animation:iga-modal-slide .25s var(--iga-ease-spring);box-sizing:border-box}.ig-hd-modal-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:var(--iga-surface);border:1px solid var(--iga-border);color:var(--iga-text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;padding:0}.ig-hd-modal-close:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright)}.ig-hd-avatar-frame{position:relative;width:190px;height:190px;border-radius:50%;margin:8px 0 14px;display:flex;align-items:center;justify-content:center;background:var(--iga-surface);box-shadow:0 8px 32px #00000073;flex-shrink:0;border:2px solid var(--iga-border);box-sizing:border-box}.ig-hd-avatar-frame.has-bestie-ring{outline:4px solid #22c55e!important;outline-offset:3px;box-shadow:0 0 28px #22c55e73,0 8px 32px #00000073}.ig-hd-avatar-frame.has-story-ring{outline:4px solid #e1306c!important;outline-offset:3px;box-shadow:0 0 28px #e1306c73,0 8px 32px #00000073}.ig-hd-avatar-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;background:var(--iga-surface);transition:filter .25s ease,opacity .25s ease}.ig-hd-avatar-fallback{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:700;background:var(--iga-accent-subtle);color:var(--iga-accent)}.ig-hd-res-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:700;letter-spacing:.3px;background:#94a3b826;color:var(--iga-text-muted);border:1px solid var(--iga-border);margin-bottom:12px}.ig-hd-res-pill.is-hd{background:#2563eb29;color:#3b82f6;border-color:#3b82f666;box-shadow:0 0 12px #3b82f633}.ig-hd-spinner{width:10px;height:10px;border:2px solid rgba(148,163,184,.3);border-top-color:var(--iga-accent);border-radius:50%;animation:ig-hd-spin .7s linear infinite;display:inline-block}@keyframes ig-hd-spin{to{transform:rotate(360deg)}}.ig-hd-user-details{display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;margin-bottom:18px}.ig-hd-username-row{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;margin-bottom:2px}.ig-hd-username{font-size:16px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.2px}.ig-hd-fullname{font-size:12px;color:var(--iga-text-muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:8px}.ig-hd-badges{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap}.ig-hd-actions{display:flex;flex-direction:column;gap:8px;width:100%}.ig-hd-actions-row{display:flex;gap:8px;width:100%}.ig-btn-download-hd{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 16px;border-radius:var(--iga-radius-md);background:var(--iga-accent-gradient);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;transition:all .18s var(--iga-ease-default);box-shadow:0 2px 10px #3b82f659}.ig-btn-download-hd:hover{transform:translateY(-1px);box-shadow:0 4px 16px #3b82f673}.ig-btn-open-tab,.ig-btn-view-profile{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:1;padding:8px 12px;border-radius:var(--iga-radius-md);background:var(--iga-surface);color:var(--iga-text-main);border:1px solid var(--iga-border);font-size:11px;font-weight:600;text-decoration:none!important;cursor:pointer;transition:all .15s ease}.ig-btn-open-tab:hover,.ig-btn-view-profile:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}.ig-backup-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:#000000a6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);z-index:1000000;box-sizing:border-box}.ig-backup-overlay *{box-sizing:border-box}.ig-backup-overlay.is-open{display:flex;animation:iga-fade-in .2s var(--iga-ease-default)}.ig-backup-dialog{width:min(480px,100%);border-radius:var(--iga-radius-xl);background:var(--iga-bg-primary);border:1px solid var(--iga-border);box-shadow:var(--iga-shadow-lg);padding:20px;display:flex;flex-direction:column;gap:14px;color:var(--iga-text-main);animation:iga-modal-slide .25s var(--iga-ease-spring)}.ig-backup-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.ig-backup-dialog-title{font-size:16px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.3px}.ig-backup-close-btn{border:none;background:transparent;color:var(--iga-text-muted);border-radius:var(--iga-radius-sm);padding:4px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease}.ig-backup-close-btn:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover)}.ig-backup-close-btn svg{width:18px;height:18px;display:block}.ig-backup-dialog-description{margin:0;font-size:13px;line-height:1.5;color:var(--iga-text-muted)}.ig-backup-dialog-actions{display:flex;gap:10px}.ig-backup-dialog .ig-backup-btn{flex:1;padding:10px 14px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s var(--iga-ease-default)}.ig-backup-btn-export{background:var(--iga-accent-subtle);border:1px solid rgba(59,130,246,.35);color:var(--iga-text-bright)}.ig-backup-btn-export:hover:not(:disabled){background:var(--iga-accent);color:#fff;border-color:var(--iga-accent);box-shadow:0 4px 12px #3b82f659}.ig-backup-btn-import{background:var(--iga-warning-subtle);border:1px solid rgba(245,158,11,.35);color:var(--iga-text-bright)}.ig-backup-btn-import:hover:not(:disabled){background:var(--iga-warning);color:#fff;border-color:var(--iga-warning);box-shadow:0 4px 12px #f59e0b59}.ig-backup-status{font-size:11px;line-height:1.4;color:var(--iga-text-muted);min-height:16px;padding:6px 10px;background:var(--iga-surface);border-radius:var(--iga-radius-sm);border:1px solid var(--iga-border)}.ig-backup-status[data-state=success]{color:var(--iga-success);border-color:#10b9814d;background:var(--iga-success-subtle)}.ig-backup-status[data-state=error]{color:var(--iga-danger);border-color:#ef44444d;background:var(--iga-danger-subtle)}.ig-backup-file-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}#ig-analyzer-panel #ig-footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--iga-border);flex-shrink:0}#ig-analyzer-panel .ig-bmc-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:var(--iga-radius-full);background:#fd0;color:#000!important;font-family:var(--iga-font-sans);font-size:11px;font-weight:700;text-decoration:none!important;letter-spacing:-.2px;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px #ffdd0040;transition:transform .2s var(--iga-ease-default),box-shadow .2s var(--iga-ease-default),background .2s var(--iga-ease-default);line-height:1;-webkit-user-select:none;user-select:none}#ig-analyzer-panel .ig-bmc-btn:hover{background:#ffea47;transform:translateY(-1px);box-shadow:0 4px 14px #fd06;text-decoration:none!important;color:#000!important}#ig-analyzer-panel .ig-bmc-btn:active{transform:translateY(0);box-shadow:0 2px 6px #fd03}#ig-analyzer-panel .ig-bmc-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#000}#ig-analyzer-panel .ig-bmc-icon svg{display:block}#ig-analyzer-panel .ig-bmc-text{font-weight:700;color:#000}#ig-analyzer-panel .ig-footer-meta{font-size:11px;color:var(--iga-text-dim);font-weight:500;display:inline-flex;align-items:center;gap:4px;-webkit-user-select:none;user-select:none}#ig-analyzer-panel .ig-footer-dot{opacity:.5}.ig-quick-card{max-width:390px!important;max-height:88vh;overflow-y:auto;padding:22px 18px 18px!important}.ig-quick-card::-webkit-scrollbar{width:5px}.ig-quick-card::-webkit-scrollbar-thumb{background:#ffffff1f;border-radius:4px}.ig-qc-header{display:flex;flex-direction:column;align-items:center;width:100%}.ig-qc-rel-bar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;width:100%}.ig-qc-rel-pill{font-size:11px;font-weight:600;padding:3px 10px;border-radius:var(--iga-radius-full);display:inline-flex;align-items:center;gap:4px;background:var(--iga-surface);color:var(--iga-text-muted);border:1px solid var(--iga-border)}.ig-qc-rel-pill.is-positive{background:#10b98124;color:#10b981;border-color:#10b9814d}.ig-qc-rel-pill.is-neutral{background:#3b82f624;color:#3b82f6;border-color:#3b82f64d}.ig-qc-rel-pill.is-negative{background:#ef44441f;color:#f87171;border-color:#ef444440}.ig-qc-rel-pill.is-pending{background:#f59e0b24;color:#f59e0b;border-color:#f59e0b4d}.ig-qc-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin-bottom:12px}.ig-qc-stat-card{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:8px 6px;text-align:center;display:flex;flex-direction:column;align-items:center}.ig-qc-stat-value{font-size:15px;font-weight:700;color:var(--iga-text-bright);line-height:1.2}.ig-qc-stat-label{font-size:10px;color:var(--iga-text-muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}.ig-qc-bio-card{background:#0f172a8c;border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:10px 12px;margin-bottom:12px;width:100%;box-sizing:border-box;text-align:left}.ig-qc-bio-text{font-size:12px;line-height:1.45;color:var(--iga-text-main);white-space:pre-wrap;word-break:break-word;max-height:75px;overflow-y:auto}.ig-qc-bio-link{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--iga-accent);margin-top:6px;text-decoration:none;word-break:break-all}.ig-qc-bio-link:hover{text-decoration:underline;color:var(--iga-accent-hover)}.ig-qc-mutuals-card{background:#ffffff08;border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:8px 12px;margin-bottom:12px;width:100%;box-sizing:border-box;text-align:left}.ig-qc-mutuals-header{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--iga-text-main);margin-bottom:6px}.ig-qc-facepile-container{display:flex;align-items:center}.ig-facepile-avatar{width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid var(--iga-bg-primary);margin-left:-6px;box-shadow:0 1px 3px #0000004d}.ig-facepile-avatar:first-child{margin-left:0}.ig-badge-business{background:#9333ea26!important;color:#a855f7!important;border:1px solid rgba(147,51,234,.3)!important}.ig-badge-creator{background:#ec489926!important;color:#ec4899!important;border:1px solid rgba(236,72,153,.3)!important}#ig-analyzer-panel .btn-inspect-user,#ig-analyzer-panel .ig-btn-inspect-user{padding:4px 8px;font-size:11px;font-weight:500;color:var(--iga-text-muted);background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}#ig-analyzer-panel .btn-inspect-user:hover,#ig-analyzer-panel .ig-btn-inspect-user:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-card{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:10px 8px;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:var(--iga-shadow-sm);transition:transform .15s ease,border-color .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-card:hover{border-color:var(--iga-border-hover);transform:translateY(-1px)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--iga-text-muted);margin-bottom:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value{font-size:18px;font-weight:700;color:var(--iga-text-bright);line-height:1.2;margin-bottom:4px;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value.is-positive{color:#22c55e}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value.is-negative{color:#ef4444}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub{font-size:10px;color:var(--iga-text-muted);display:inline-flex;align-items:center;gap:3px;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub.is-positive{color:#22c55e}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub.is-negative{color:#ef4444}#ig-analyzer-panel .btn-unwhitelist,#ig-analyzer-panel .ig-btn-unwhitelist{padding:4px 8px;font-size:11px;font-weight:600;color:#3b82f6;background:#3b82f614;border:1px solid rgba(59,130,246,.25);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}#ig-analyzer-panel .btn-unwhitelist:hover,#ig-analyzer-panel .ig-btn-unwhitelist:hover{color:#fff;background:#3b82f6;border-color:#3b82f6;box-shadow:0 2px 6px #3b82f659}#ig-analyzer-panel .btn-clear-whitelist,#ig-analyzer-panel .ig-btn-clear-whitelist{padding:3px 8px;font-size:10.5px;font-weight:600;color:#ef4444;background:#ef444414;border:1px solid rgba(239,68,68,.25);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}#ig-analyzer-panel .btn-clear-whitelist:hover,#ig-analyzer-panel .ig-btn-clear-whitelist:hover{color:#fff;background:#ef4444;border-color:#ef4444;box-shadow:0 2px 6px #ef44444d}.ig-badge-mutual{background:#22c55e1f!important;color:#22c55e!important;border:1px solid rgba(34,197,94,.25)!important}.ig-badge-fan{background:#f59e0b1f!important;color:#f59e0b!important;border:1px solid rgba(245,158,11,.25)!important}.ig-badge-date{background:#94a3b81f!important;color:#94a3b8!important;border:1px solid rgba(148,163,184,.2)!important}.ig-btn-target-audit,.btn-target-audit{display:inline-flex;align-items:center;gap:4px;padding:3.5px 8px;font-size:11px;font-weight:600;border-radius:var(--iga-radius-sm, 6px);background:#6366f11f;color:#818cf8;border:1px solid rgba(99,102,241,.25);cursor:pointer;transition:all .15s ease}.ig-btn-target-audit:hover,.btn-target-audit:hover{background:#6366f1;color:#fff;border-color:#6366f1;box-shadow:0 2px 8px #6366f159}.ig-badge-new-mutual{background:#10b98126!important;color:#10b981!important;border:1px solid rgba(16,185,129,.3)!important;box-shadow:0 0 8px #10b98126}.ig-target-search-card{background:#ffffff08;border:1px solid var(--iga-border, rgba(255, 255, 255, .08));border-radius:var(--iga-radius-lg, 12px);padding:16px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px}.ig-target-search-title{font-size:13.5px;font-weight:700;color:var(--iga-text-bright, #f8fafc);display:flex;align-items:center;gap:6px}.ig-target-search-desc{font-size:11.5px;line-height:1.45;color:var(--iga-text-muted, #94a3b8)}.ig-target-search-input-group{display:flex;align-items:center;gap:8px;background:#0f172a99;border:1px solid var(--iga-border, rgba(255, 255, 255, .1));border-radius:var(--iga-radius-md, 8px);padding:3px 6px 3px 12px;transition:border-color .15s ease}.ig-target-search-input-group:focus-within{border-color:#6366f1;box-shadow:0 0 0 2px #6366f133}.ig-input-prefix{font-size:13px;font-weight:600;color:var(--iga-text-muted, #94a3b8)}.ig-target-input{flex:1;background:transparent;border:none;outline:none;color:var(--iga-text-bright, #f8fafc);font-size:12.5px;padding:6px 0}.ig-target-input::placeholder{color:#94a3b899}.ig-target-feedback{font-size:11.5px;padding:8px 12px;border-radius:var(--iga-radius-sm, 6px);margin-top:4px}.ig-target-feedback.is-error{background:#ef44441f;color:#ef4444;border:1px solid rgba(239,68,68,.25)}.ig-target-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px}.ig-target-card{background:#ffffff06;border:1px solid var(--iga-border, rgba(255, 255, 255, .07));border-radius:var(--iga-radius-md, 10px);padding:12px 14px;display:flex;flex-direction:column;gap:10px;transition:all .18s ease;cursor:pointer}.ig-target-card:hover{border-color:#6366f14d;background:#ffffff0a;transform:translateY(-1px)}.ig-target-card-top{display:flex;align-items:center;gap:10px}.ig-target-card-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#ffffff14;display:flex;align-items:center;justify-content:center;font-weight:700;color:#cbd5e1;flex-shrink:0}.ig-target-card-info{flex:1;min-width:0}.ig-target-card-name-row{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ig-target-card-user{font-weight:700;font-size:13px;color:var(--iga-text-bright, #f8fafc)}.ig-target-card-fullname{font-size:11px;color:var(--iga-text-muted, #94a3b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-btn-target-delete{background:transparent;border:none;color:var(--iga-text-muted, #94a3b8);cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .15s ease}.ig-btn-target-delete:hover{color:#ef4444;background:#ef44441a}.ig-target-card-metrics{display:flex;align-items:center;justify-content:space-between;background:#0003;padding:8px 12px;border-radius:var(--iga-radius-sm, 6px);border:1px solid rgba(255,255,255,.04)}.ig-target-metric{display:flex;flex-direction:column;align-items:center;gap:2px}.ig-target-metric-label{font-size:10px;color:var(--iga-text-muted, #94a3b8);text-transform:uppercase;letter-spacing:.4px}.ig-target-metric-val{font-size:12px;font-weight:700;color:var(--iga-text-bright, #f8fafc);display:flex;align-items:center;gap:4px}.ig-target-card-diff{font-size:10.5px;font-weight:700;padding:1px 4px;border-radius:4px}.ig-target-card-diff.is-positive{background:#22c55e26;color:#22c55e}.ig-target-card-diff.is-negative{background:#ef444426;color:#ef4444}.ig-target-card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:2px}.ig-target-card-time{font-size:10.5px;color:var(--iga-text-muted, #94a3b8)}.ig-target-card-actions{display:flex;align-items:center;gap:6px}#ig-target-subpanel{position:fixed;z-index:10000000;width:580px;min-width:440px;max-width:95vw;height:700px;min-height:420px;max-height:95vh;display:flex;flex-direction:column;resize:both;overflow:hidden;background:#0f172af0;border:1px solid rgba(255,255,255,.12);border-radius:var(--iga-radius-lg, 12px);box-shadow:0 20px 50px #000000a6,0 0 0 1px #6366f126;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:var(--iga-text-bright, #f8fafc);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;transition:height .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease}#ig-target-subpanel.is-minimized{height:48px!important;min-height:48px!important;resize:none!important;overflow:hidden!important}#ig-target-subpanel.is-minimized .ig-target-actions-bar,#ig-target-subpanel.is-minimized .ig-progress-container,#ig-target-subpanel.is-minimized .ig-target-tabs-wrapper,#ig-target-subpanel.is-minimized .ig-target-view,#ig-target-subpanel.is-minimized .ig-target-resize-grip{display:none!important}#ig-target-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#ffffff08;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .08));cursor:grab;-webkit-user-select:none;user-select:none;flex-shrink:0}#ig-target-subpanel.is-dragging #ig-target-header{cursor:grabbing}.ig-target-header-left{display:flex;align-items:center;gap:8px;min-width:0}.ig-target-header-icon{display:inline-flex;align-items:center;color:#818cf8}.ig-target-header-title{font-weight:700;font-size:13.5px;color:var(--iga-text-bright, #f8fafc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-target-header-right{display:flex;align-items:center;gap:10px;flex-shrink:0}#ig-target-status{font-size:11px;color:var(--iga-text-muted, #94a3b8);display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:12px;background:#ffffff0a}#ig-target-status.is-active{color:#60a5fa}#ig-target-status.is-active .ig-status-dot{background:#60a5fa;box-shadow:0 0 6px #60a5fa}.ig-target-header-actions{display:flex;align-items:center;gap:4px}.ig-target-actions-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#0003;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .06));flex-shrink:0;gap:8px}.ig-target-meta-summary{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.ig-target-meta-user{font-weight:700;font-size:12.5px;color:var(--iga-text-bright, #f8fafc)}.ig-target-meta-name{font-size:11px;color:var(--iga-text-muted, #94a3b8)}.ig-target-meta-pill{font-size:10.5px;padding:1.5px 6px;border-radius:4px;background:#ffffff0f;color:var(--iga-text-muted, #94a3b8)}.ig-target-actions-buttons{display:flex;align-items:center;gap:6px;flex-shrink:0}.ig-target-tabs-wrapper{background:#0f172a66;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .06));flex-shrink:0}.ig-target-view{flex:1;overflow-y:auto;padding:14px;display:none}.ig-target-view.active{display:block}.ig-target-ready-card{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;gap:12px}.ig-target-ready-icon{color:#818cf8;transform:scale(1.6);margin-bottom:8px}.ig-target-ready-title{font-size:16px;font-weight:700;color:var(--iga-text-bright, #f8fafc)}.ig-target-ready-desc{font-size:12px;line-height:1.5;color:var(--iga-text-muted, #94a3b8);max-width:380px}.ig-target-overview-header{display:flex;align-items:center;gap:14px;padding:14px;background:#ffffff08;border-radius:var(--iga-radius-lg, 12px);border:1px solid var(--iga-border, rgba(255, 255, 255, .08))}.ig-target-overview-avatar-wrap .ig-user-avatar{width:52px;height:52px;font-size:18px}.ig-target-overview-meta{flex:1;min-width:0}.ig-target-overview-title-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ig-target-overview-username{font-size:15px;font-weight:700;color:var(--iga-text-bright, #f8fafc)}.ig-target-overview-fullname{font-size:12px;color:var(--iga-text-muted, #94a3b8);margin-top:2px}.ig-target-overview-timestamps{font-size:10.5px;color:var(--iga-text-muted, #94a3b8);margin-top:4px}.ig-target-restricted-alert{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--iga-radius-md, 8px);background:#f59e0b1a;border:1px solid rgba(245,158,11,.3);color:#fbbf24;margin-top:12px;line-height:1.45;font-size:12px}.ig-target-alert-icon{color:#fbbf24;flex-shrink:0;margin-top:1px}.ig-target-resize-grip{position:absolute;bottom:2px;right:2px;width:14px;height:14px;cursor:se-resize;pointer-events:none}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme #ig-target-subpanel){background:#fffffff5;border-color:#0000001f;box-shadow:0 20px 50px #0003;color:#0f172a}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) #ig-target-header{background:#00000005;border-bottom-color:#00000014}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-actions-bar{background:#00000008;border-bottom-color:#0000000f}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-overview-header,:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-search-card,:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-card{background:#f8fafc;border-color:#00000014}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-search-input-group{background:#fff;border-color:#00000026}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-card-metrics{background:#f1f5f9;border-color:#0000000d}';
  importCSS(mainCss);
  const UI = {
    init: () => {
      if (document.getElementById("ig-analyzer-panel")) return;
      const panel = document.createElement("div");
      panel.id = "ig-analyzer-panel";
      panel.innerHTML = [
        '<div id="ig-header">',
        '  <div class="ig-header-left">',
        '    <span class="ig-logo">' + Icons.logo + "</span>",
        '    <span class="ig-title">IG Analyzer</span>',
        "  </div>",
        '  <div class="ig-header-right">',
        '    <span id="ig-status"><span class="ig-status-dot"></span>Inactive</span>',
        '    <div class="ig-header-actions">',
        '      <button id="ig-btn-minimize" class="ig-header-btn" title="Minimize / Expand" aria-label="Minimize or expand panel">' + Icons.minimize + "</button>",
        '      <button id="ig-btn-close" class="ig-header-btn ig-header-btn-close" title="Close Panel (F9 to reopen)" aria-label="Close panel">',
        '        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        "      </button>",
        "    </div>",
        "  </div>",
        "</div>",
        '<div class="ig-actions-bar">',
        '  <button id="ig-run" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.play + "</span>Run Analysis</button>",
        '  <button id="ig-export-csv" class="ig-btn ig-btn-success" disabled><span class="ig-btn-icon">' + Icons.download + "</span>Export CSV</button>",
        '  <button id="ig-reset" class="ig-btn ig-btn-danger"><span class="ig-btn-icon">' + Icons.trash + "</span>Reset</button>",
        "</div>",
        '<div id="ig-progress-container"><div id="ig-progress-bar"></div></div>',
        '<div class="ig-tabs-wrapper">',
        '  <div class="ig-tabs-container" id="ig-tabs">',
        '    <div id="ig-tab-indicator" class="ig-tab-indicator"></div>',
        '    <button class="ig-tab-btn active" data-target="ig-log"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-history"><span class="ig-tab-icon">' + Icons.history + '</span><span class="ig-tab-label">History</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-notfollowing"><span class="ig-tab-icon">' + Icons.notFollowing + '</span><span class="ig-tab-label">Not Following</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-fans"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Fans</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-targettracker"><span class="ig-tab-icon">' + Icons.target + '</span><span class="ig-tab-label">Target Tracker</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-whitelist"><span class="ig-tab-icon">' + Icons.shieldCheck + '</span><span class="ig-tab-label">Whitelist</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-unfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Unfollowers</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-deactivated"><span class="ig-tab-icon">' + Icons.deactivated + '</span><span class="ig-tab-label">Deactivated</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-blocked"><span class="ig-tab-icon">' + Icons.blocked + '</span><span class="ig-tab-label">Blocked</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-renamed"><span class="ig-tab-icon">' + Icons.renamed + '</span><span class="ig-tab-label">Renamed</span></button>',
        "  </div>",
        "</div>",
        '<div id="ig-log" class="ig-view-container ig-view active"></div>',
        '<div id="ig-view-history" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-notfollowing" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-fans" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-mutuals" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-targettracker" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-newfollowers" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-whitelist" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-unfollowers" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-deactivated" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-blocked" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-renamed" class="ig-view-container ig-view"></div>',
        '<div id="ig-footer" class="ig-panel-footer">',
        '  <a href="https://buymeacoffee.com/UNKchr" target="_blank" rel="noopener noreferrer" class="ig-bmc-btn" title="Support development on Buy Me a Coffee">',
        '    <span class="ig-bmc-icon">' + Icons.coffee + "</span>",
        '    <span class="ig-bmc-text">Buy me a coffee</span>',
        "  </a>",
        '  <span class="ig-footer-meta">v3.12.0</span>',
        "</div>"
      ].join("\n");
      document.body.appendChild(panel);
      createBackupUI(panel);
      const modalHTML = `
        <div id="ig-safety-modal" class="ig-modal-overlay">
            <div class="ig-modal-content">
                <div class="ig-modal-icon">
                    ${Icons.warning}
                </div>
                <div id="ig-modal-title-text" class="ig-modal-title">Attention</div>
                <div id="ig-modal-body-text" class="ig-modal-text">Are you sure?</div>
                <div class="ig-modal-actions">
                    <button id="ig-modal-cancel" class="ig-btn-cancel-modal">Cancel</button>
                    <button id="ig-modal-confirm" class="ig-btn-confirm-modal">Yes</button>
                </div>
            </div>
        </div>`;
      document.body.insertAdjacentHTML("beforeend", modalHTML);
      UI.initHdModal();
      UI.initTargetSubpanel();
      const btnMin = panel.querySelector("#ig-btn-minimize");
      if (btnMin) {
        btnMin.addEventListener("click", (e) => {
          e.stopPropagation();
          UI.toggleMinimize();
        });
      }
      const btnClose = panel.querySelector("#ig-btn-close");
      if (btnClose) {
        btnClose.addEventListener("click", (e) => {
          e.stopPropagation();
          UI.togglePanel();
        });
      }
      UI.setupDrag(panel, panel.querySelector("#ig-header"));
      UI.loadPosition(panel);
      UI.setupTabs();
      UI.setupThemeObserver();
      UI.renderHistory(Storage.getHistory());
      UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
      UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
      UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
      UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
      UI.renderNewFollowers(Storage.getNewFollowersList());
      UI.renderWhitelist(Storage.getWhitelist());
      UI.renderTargetTrackerMainView();
      UI.renderPersistedSnapshot(Storage.load());
      Utils.getUserIdAsync().then((asyncId) => {
        if (asyncId && asyncId !== Storage.getCurrentUserId()) {
          Storage.setCurrentUserId(asyncId);
          UI.renderHistory(Storage.getHistory(asyncId));
          UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY, asyncId), "ig-view-unfollowers", "Recent Unfollowers");
          UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY, asyncId), "ig-view-deactivated", "Deactivated Accounts");
          UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY, asyncId), "ig-view-blocked", "Blocked Accounts");
          UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY, asyncId), "ig-view-renamed", "Username Changes");
          UI.renderNewFollowers(Storage.getNewFollowersList(asyncId));
          UI.renderWhitelist(Storage.getWhitelist(asyncId));
          UI.renderTargetTrackerMainView(asyncId);
          UI.renderPersistedSnapshot(Storage.load(asyncId));
        }
      }).catch(() => {
      });
    },
    setupThemeObserver: () => {
      let rafId = null;
      const checkTheme = () => {
        const panel = document.getElementById("ig-analyzer-panel");
        const subpanel = document.getElementById("ig-target-subpanel");
        const safetyModal = document.getElementById("ig-safety-modal");
        const targets = [panel, subpanel, safetyModal].filter(Boolean);
        if (targets.length === 0) return;
        const html = document.documentElement;
        const body = document.body;
        const isExplicitDark = html.classList.contains("_aa55") || html.getAttribute("data-theme") === "dark" || body && body.getAttribute("data-theme") === "dark";
        if (isExplicitDark) {
          targets.forEach((t) => t.classList.remove("ig-light-theme"));
          return;
        }
        const isExplicitLight = html.getAttribute("data-theme") === "light" || body && body.getAttribute("data-theme") === "light";
        if (isExplicitLight) {
          targets.forEach((t) => t.classList.add("ig-light-theme"));
          return;
        }
        const bodyBg = window.getComputedStyle(body || html).backgroundColor;
        const isLightBg = bodyBg === "rgb(255, 255, 255)" || bodyBg === "#ffffff" || bodyBg === "white" || bodyBg === "rgb(250, 250, 250)" || bodyBg === "#fafafa";
        if (isLightBg) {
          targets.forEach((t) => t.classList.add("ig-light-theme"));
          return;
        }
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
          targets.forEach((t) => t.classList.add("ig-light-theme"));
        } else {
          targets.forEach((t) => t.classList.remove("ig-light-theme"));
        }
      };
      checkTheme();
      const observer = new MutationObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(checkTheme);
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
      if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
      }
      if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", checkTheme);
      }
    },
    confirmAction: (title, message, confirmBtnText = "Yes, Continue", showCancel = true, customIcon = null) => {
      return new Promise((resolve) => {
        const modal = document.getElementById("ig-safety-modal");
        const titleEl = document.getElementById("ig-modal-title-text");
        const bodyEl = document.getElementById("ig-modal-body-text");
        const btnYes = document.getElementById("ig-modal-confirm");
        const btnNo = document.getElementById("ig-modal-cancel");
        const iconEl = modal ? modal.querySelector(".ig-modal-icon") : null;
        if (!modal) return resolve(true);
        titleEl.textContent = title;
        bodyEl.innerHTML = message;
        btnYes.textContent = confirmBtnText;
        if (iconEl && customIcon) {
          iconEl.innerHTML = customIcon;
        }
        if (btnNo) {
          btnNo.style.display = showCancel ? "inline-block" : "none";
        }
        modal.style.display = "flex";
        const closeAndResolve = (value) => {
          modal.style.display = "none";
          if (btnNo) btnNo.style.display = "inline-block";
          if (iconEl) iconEl.innerHTML = Icons.warning;
          btnYes.onclick = null;
          if (btnNo) btnNo.onclick = null;
          resolve(value);
        };
        btnYes.onclick = () => closeAndResolve(true);
        if (btnNo) btnNo.onclick = () => closeAndResolve(false);
      });
    },
    currentHdUser: null,
    hdModalAbortController: null,
    initHdModal: () => {
      if (document.getElementById("ig-hd-modal")) return;
      const modalHtml = `
        <div id="ig-hd-modal" class="ig-hd-modal-overlay" aria-hidden="true">
            <div class="ig-hd-modal-card ig-quick-card">
                <button id="ig-hd-close-btn" class="ig-hd-modal-close" title="Close (Esc)">${Icons.clear}</button>
                
                <div class="ig-qc-header">
                    <div id="ig-hd-avatar-frame" class="ig-hd-avatar-frame">
                        <img id="ig-hd-avatar-img" class="ig-hd-avatar-img" src="" alt="Avatar" />
                        <span id="ig-hd-avatar-fallback" class="ig-hd-avatar-fallback" style="display:none;">?</span>
                    </div>
                    <div id="ig-hd-res-pill" class="ig-hd-res-pill">
                        <span class="ig-hd-spinner"></span> Loading profile...
                    </div>
                    <div class="ig-hd-user-details">
                        <div class="ig-hd-username-row">
                            <span id="ig-hd-username" class="ig-hd-username"></span>
                            <span id="ig-hd-verified-badge" style="display:none;">${Icons.verified}</span>
                        </div>
                        <div id="ig-hd-fullname" class="ig-hd-fullname"></div>
                        <div id="ig-hd-badges" class="ig-hd-badges"></div>
                    </div>
                </div>

                <!-- Relationship Status Bar -->
                <div id="ig-qc-rel-bar" class="ig-qc-rel-bar"></div>

                <!-- Metric Stat Cards -->
                <div class="ig-qc-stat-grid">
                    <div class="ig-qc-stat-card">
                        <span class="ig-qc-stat-value" id="ig-qc-followers-count">-</span>
                        <span class="ig-qc-stat-label">Followers</span>
                    </div>
                    <div class="ig-qc-stat-card">
                        <span class="ig-qc-stat-value" id="ig-qc-following-count">-</span>
                        <span class="ig-qc-stat-label">Following</span>
                    </div>
                    <div class="ig-qc-stat-card">
                        <span class="ig-qc-stat-value" id="ig-qc-posts-count">-</span>
                        <span class="ig-qc-stat-label">Posts</span>
                    </div>
                </div>

                <!-- Biography Section -->
                <div id="ig-qc-bio-card" class="ig-qc-bio-card" style="display:none;">
                    <div id="ig-qc-bio-text" class="ig-qc-bio-text"></div>
                    <a id="ig-qc-bio-link" class="ig-qc-bio-link" target="_blank" rel="noopener noreferrer" style="display:none;">
                        ${Icons.externalLink} <span id="ig-qc-bio-link-text"></span>
                    </a>
                </div>

                <!-- Mutual Connections Context -->
                <div id="ig-qc-mutuals-card" class="ig-qc-mutuals-card" style="display:none;">
                    <div class="ig-qc-mutuals-header">
                        ${Icons.mutualsContext}
                        <span id="ig-qc-mutuals-summary">Mutual Connections</span>
                    </div>
                    <div id="ig-qc-facepile-container" class="ig-qc-facepile-container"></div>
                </div>

                <!-- Action Buttons -->
                <div class="ig-hd-actions">
                    <button id="ig-btn-download-hd" class="ig-btn-download-hd">
                        ${Icons.download} Download HD Photo
                    </button>
                    <div class="ig-hd-actions-row">
                        <a id="ig-btn-open-tab" class="ig-btn-open-tab" target="_blank" rel="noopener noreferrer">
                            ${Icons.externalLink} Open in Tab
                        </a>
                        <a id="ig-btn-view-profile" class="ig-btn-view-profile" target="_blank" rel="noopener noreferrer">
                            View Profile ${Icons.link}
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
      document.body.insertAdjacentHTML("beforeend", modalHtml);
      const modal = document.getElementById("ig-hd-modal");
      const closeBtn = document.getElementById("ig-hd-close-btn");
      const closeModal = () => {
        if (modal) {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
        }
        if (UI.hdModalAbortController) {
          UI.hdModalAbortController.abort();
          UI.hdModalAbortController = null;
        }
      };
      if (closeBtn) closeBtn.addEventListener("click", closeModal);
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeModal();
        });
      }
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal && modal.style.display === "flex") {
          closeModal();
        }
      });
    },
    openHdPhotoModal: async (u) => {
      if (!u) return;
      UI.initHdModal();
      const modal = document.getElementById("ig-hd-modal");
      const imgEl = document.getElementById("ig-hd-avatar-img");
      const fallbackEl = document.getElementById("ig-hd-avatar-fallback");
      const frameEl = document.getElementById("ig-hd-avatar-frame");
      const pillEl = document.getElementById("ig-hd-res-pill");
      const usernameEl = document.getElementById("ig-hd-username");
      const verifiedEl = document.getElementById("ig-hd-verified-badge");
      const fullnameEl = document.getElementById("ig-hd-fullname");
      const badgesEl = document.getElementById("ig-hd-badges");
      const relBarEl = document.getElementById("ig-qc-rel-bar");
      const followersEl = document.getElementById("ig-qc-followers-count");
      const followingEl = document.getElementById("ig-qc-following-count");
      const postsEl = document.getElementById("ig-qc-posts-count");
      const bioCardEl = document.getElementById("ig-qc-bio-card");
      const bioTextEl = document.getElementById("ig-qc-bio-text");
      const bioLinkEl = document.getElementById("ig-qc-bio-link");
      const bioLinkTextEl = document.getElementById("ig-qc-bio-link-text");
      const mutualsCardEl = document.getElementById("ig-qc-mutuals-card");
      const mutualsSummaryEl = document.getElementById("ig-qc-mutuals-summary");
      const facepileEl = document.getElementById("ig-qc-facepile-container");
      const btnDownload = document.getElementById("ig-btn-download-hd");
      const linkOpenTab = document.getElementById("ig-btn-open-tab");
      const linkProfile = document.getElementById("ig-btn-view-profile");
      if (!modal) return;
      if (UI.hdModalAbortController) {
        UI.hdModalAbortController.abort();
      }
      UI.hdModalAbortController = new AbortController();
      const signal = UI.hdModalAbortController.signal;
      UI.currentHdUser = u;
      const safeUsername = u.username || "";
      const safeFullName = u.fullName || "";
      const initialAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
      const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
      const isBestie = Boolean(u.isBestie);
      usernameEl.textContent = "@" + safeUsername;
      fullnameEl.textContent = safeFullName;
      verifiedEl.style.display = u.isVerified ? "inline-flex" : "none";
      badgesEl.innerHTML = UI.renderUserBadgesHtml(u);
      frameEl.className = "ig-hd-avatar-frame";
      if (isBestie) {
        frameEl.classList.add("has-bestie-ring");
      } else if (hasStory) {
        frameEl.classList.add("has-story-ring");
      }
      imgEl.onerror = () => {
        imgEl.style.display = "none";
        fallbackEl.style.display = "flex";
      };
      imgEl.onload = () => {
        imgEl.style.display = "block";
        fallbackEl.style.display = "none";
      };
      if (initialAvatarUrl) {
        imgEl.src = initialAvatarUrl;
      } else {
        imgEl.style.display = "none";
        fallbackEl.style.display = "flex";
        fallbackEl.textContent = safeUsername.charAt(0).toUpperCase() || "?";
      }
      const profileUrl = Utils.sanitizeUrl(safeUsername, u.url);
      linkProfile.href = profileUrl;
      linkOpenTab.href = initialAvatarUrl || profileUrl;
      let currentTargetUrl = initialAvatarUrl;
      btnDownload.onclick = () => {
        if (currentTargetUrl) {
          const ext = currentTargetUrl.includes(".png") ? "png" : "jpg";
          Utils.downloadImage(currentTargetUrl, `@${safeUsername}_profile_pic.${ext}`);
        }
      };
      followersEl.textContent = Utils.formatNumber(u.followerCount ?? u.followersCount ?? null);
      followingEl.textContent = Utils.formatNumber(u.followingCount ?? null);
      postsEl.textContent = Utils.formatNumber(u.mediaCount ?? null);
      if (u.biography) {
        bioCardEl.style.display = "block";
        bioTextEl.textContent = u.biography;
      } else {
        bioCardEl.style.display = "none";
      }
      if (typeof u.mutualsCount === "number" && u.mutualsCount > 0) {
        mutualsCardEl.style.display = "block";
        mutualsSummaryEl.textContent = `${u.mutualsCount} mutual connection${u.mutualsCount === 1 ? "" : "s"}`;
        facepileEl.innerHTML = "";
      } else {
        mutualsCardEl.style.display = "none";
      }
      const cachedFriendship = u.id ? API.friendshipCache.get(String(u.id)) : null;
      let relPills = "";
      if (cachedFriendship) {
        relPills += cachedFriendship.following ? '<span class="ig-qc-rel-pill is-neutral">Following</span>' : '<span class="ig-qc-rel-pill">Not following</span>';
        if (cachedFriendship.outgoingRequest) {
          relPills += '<span class="ig-qc-rel-pill is-pending">Request Pending</span>';
        }
      } else if (u.containerId === "ig-view-mutuals") {
        relPills = '<span class="ig-qc-rel-pill is-positive">Follows you</span><span class="ig-qc-rel-pill is-neutral">You follow</span>';
      } else if (u.containerId === "ig-view-notfollowing") {
        relPills = '<span class="ig-qc-rel-pill is-negative">Does not follow you</span><span class="ig-qc-rel-pill is-neutral">You follow</span>';
      } else if (u.containerId === "ig-view-fans") {
        relPills = `<span class="ig-qc-rel-pill is-positive">Follows you</span><span class="ig-qc-rel-pill">You don't follow</span>`;
      }
      relBarEl.innerHTML = relPills;
      pillEl.className = "ig-hd-res-pill";
      pillEl.innerHTML = '<span class="ig-hd-spinner"></span> Loading 1080p...';
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      try {
        const hdData = await API.fetchUserProfileHd(u.id, safeUsername, { signal });
        if (signal.aborted) return;
        if (hdData) {
          followersEl.textContent = Utils.formatNumber(hdData.followerCount);
          followingEl.textContent = Utils.formatNumber(hdData.followingCount);
          postsEl.textContent = Utils.formatNumber(hdData.mediaCount);
          badgesEl.innerHTML = UI.renderUserBadgesHtml(hdData);
          let finalRelPills = "";
          finalRelPills += hdData.followedBy ? '<span class="ig-qc-rel-pill is-positive">Follows you</span>' : '<span class="ig-qc-rel-pill is-negative">Does not follow you</span>';
          finalRelPills += hdData.following ? '<span class="ig-qc-rel-pill is-neutral">Following</span>' : '<span class="ig-qc-rel-pill">Not following</span>';
          if (hdData.outgoingRequest) {
            finalRelPills += '<span class="ig-qc-rel-pill is-pending">Request Pending</span>';
          }
          relBarEl.innerHTML = finalRelPills;
          if (hdData.biography) {
            bioCardEl.style.display = "block";
            bioTextEl.textContent = hdData.biography;
          } else {
            bioCardEl.style.display = "none";
          }
          if (hdData.externalUrl) {
            bioLinkEl.style.display = "inline-flex";
            bioLinkEl.href = hdData.externalUrl;
            bioLinkTextEl.textContent = hdData.externalUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
          } else {
            bioLinkEl.style.display = "none";
          }
          if (typeof hdData.mutualsCount === "number" && hdData.mutualsCount > 0) {
            mutualsCardEl.style.display = "block";
            if (hdData.mutualUsers && hdData.mutualUsers.length > 0) {
              const namedMutuals = hdData.mutualUsers.slice(0, 2).map((m) => "@" + m).join(", ");
              const remaining = hdData.mutualsCount - hdData.mutualUsers.slice(0, 2).length;
              mutualsSummaryEl.textContent = `Followed by ${namedMutuals}${remaining > 0 ? ` and ${remaining} other${remaining === 1 ? "" : "s"}` : ""}`;
            } else {
              mutualsSummaryEl.textContent = `${hdData.mutualsCount} mutual connection${hdData.mutualsCount === 1 ? "" : "s"}`;
            }
            if (hdData.facepileUsers && hdData.facepileUsers.length > 0) {
              facepileEl.innerHTML = hdData.facepileUsers.slice(0, 5).map(
                (f) => `<img class="ig-facepile-avatar" src="${f.profilePicUrl}" alt="Mutual" />`
              ).join("");
            } else {
              facepileEl.innerHTML = "";
            }
          } else {
            mutualsCardEl.style.display = "none";
          }
          if (hdData.hdUrl) {
            const cleanHdUrl = Utils.sanitizeImageUrl(hdData.hdUrl);
            if (cleanHdUrl) {
              const preload = new Image();
              preload.onload = () => {
                if (signal.aborted) return;
                imgEl.src = cleanHdUrl;
                imgEl.style.display = "block";
                fallbackEl.style.display = "none";
                currentTargetUrl = cleanHdUrl;
                linkOpenTab.href = cleanHdUrl;
                pillEl.className = "ig-hd-res-pill is-hd";
                pillEl.innerHTML = `${Icons.verified} 1080p Full HD`;
                btnDownload.onclick = () => {
                  Utils.downloadImage(cleanHdUrl, `@${safeUsername}_profile_1080p.jpg`);
                };
              };
              preload.onerror = () => {
                if (signal.aborted) return;
                pillEl.className = "ig-hd-res-pill";
                pillEl.innerHTML = `Standard Resolution`;
              };
              preload.src = cleanHdUrl;
            } else {
              pillEl.className = "ig-hd-res-pill";
              pillEl.innerHTML = `Standard Resolution`;
            }
          } else {
            pillEl.className = "ig-hd-res-pill";
            pillEl.innerHTML = `Standard Resolution`;
          }
          if (hdData.isBestie) {
            frameEl.classList.add("has-bestie-ring");
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        console.warn("[IG Analyzer] Quick-Card profile fetch skipped/failed:", err);
        pillEl.className = "ig-hd-res-pill";
        pillEl.innerHTML = `Standard Resolution`;
      }
    },
    setupTabs: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      const tabsContainer = panel ? panel.querySelector("#ig-tabs") : document.getElementById("ig-tabs");
      const indicator = panel ? panel.querySelector("#ig-tab-indicator") : document.getElementById("ig-tab-indicator");
      if (!tabsContainer || !indicator) return;
      const updateIndicator = (activeBtn, animate = true) => {
        if (!activeBtn || !indicator || !tabsContainer) return;
        if (!animate) {
          indicator.style.transition = "none";
        } else {
          indicator.style.transition = "";
        }
        const left = activeBtn.offsetLeft;
        const top = activeBtn.offsetTop;
        const width = activeBtn.offsetWidth;
        const height = activeBtn.offsetHeight;
        indicator.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        indicator.style.width = `${width}px`;
        indicator.style.height = `${height}px`;
        indicator.style.opacity = "1";
        if (!animate) {
          indicator.offsetHeight;
          indicator.style.transition = "";
        }
      };
      const btns = tabsContainer.querySelectorAll(".ig-tab-btn");
      btns.forEach((btn) => {
        btn.onclick = (e) => {
          const target = e.target.closest(".ig-tab-btn");
          if (!target) return;
          const scrollLeft = target.offsetLeft - tabsContainer.offsetWidth / 2 + target.offsetWidth / 2;
          tabsContainer.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
          const targetId = target.getAttribute("data-target");
          if (!targetId) return;
          btns.forEach((b) => b.classList.remove("active"));
          if (panel) {
            panel.querySelectorAll(".ig-view").forEach((v) => v.classList.remove("active"));
          }
          target.classList.add("active");
          const targetView = panel ? panel.querySelector(`#${targetId}`) : document.getElementById(targetId);
          if (targetView) targetView.classList.add("active");
          updateIndicator(target, true);
        };
      });
      tabsContainer.addEventListener("wheel", (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          e.stopPropagation();
          tabsContainer.scrollLeft += e.deltaY;
        }
      }, { passive: false });
      tabsContainer.addEventListener("scroll", () => {
        const currentActive = tabsContainer.querySelector(".ig-tab-btn.active");
        if (currentActive) {
          updateIndicator(currentActive, false);
        }
      }, { passive: true });
      requestAnimationFrame(() => {
        const activeBtn = tabsContainer.querySelector(".ig-tab-btn.active");
        if (activeBtn) {
          updateIndicator(activeBtn, false);
        }
      });
      UI.updateTabIndicator = updateIndicator;
      window.addEventListener("resize", () => {
        const currentActive = tabsContainer.querySelector(".ig-tab-btn.active");
        if (currentActive) {
          updateIndicator(currentActive, false);
        }
      });
    },
    renderPersistedSnapshot: (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") return;
      if (Array.isArray(snapshot.notFollowingBackDetailed)) {
        UI.renderResults(snapshot.notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        window.__igLastResults = snapshot.notFollowingBackDetailed;
      }
      if (Array.isArray(snapshot.fansDetailed)) {
        UI.renderResults(snapshot.fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
      }
      if (Array.isArray(snapshot.mutualsDetailed)) {
        UI.renderResults(snapshot.mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
      }
      if (Array.isArray(snapshot.newFollowersDetailed) && snapshot.newFollowersDetailed.length > 0) {
        UI.renderNewFollowers(snapshot.newFollowersDetailed);
      } else {
        UI.renderNewFollowers(Storage.getNewFollowersList());
      }
      UI.renderWhitelist(Array.isArray(snapshot.whitelist) ? snapshot.whitelist : Storage.getWhitelist());
      if (Array.isArray(snapshot.unfollowers)) {
        UI.renderNominalList(snapshot.unfollowers, "ig-view-unfollowers", "Recent Unfollowers");
      }
      if (Array.isArray(snapshot.deactivated)) {
        UI.renderNominalList(snapshot.deactivated, "ig-view-deactivated", "Deactivated Accounts");
      }
      if (Array.isArray(snapshot.blocked)) {
        UI.renderNominalList(snapshot.blocked, "ig-view-blocked", "Blocked Accounts");
      }
      if (Array.isArray(snapshot.renamed)) {
        UI.renderRenamedList(snapshot.renamed, "ig-view-renamed", "Username Changes");
      }
      if (Array.isArray(snapshot.history)) {
        UI.renderHistory(snapshot.history);
      }
    },
    setStatus: (text) => {
      const el = document.getElementById("ig-status");
      if (el) {
        const dot = el.querySelector(".ig-status-dot");
        const dotHTML = dot ? dot.outerHTML : '<span class="ig-status-dot"></span>';
        const safeText = Utils.escapeHtml(text);
        el.innerHTML = dotHTML + safeText;
        if (text && text.toLowerCase() !== "inactive") {
          el.classList.add("is-active");
        } else {
          el.classList.remove("is-active");
        }
      }
    },
    log: (msg) => {
      try {
        const box = document.getElementById("ig-log");
        if (box) {
          const nowStr = typeof Utils.now === "function" ? Utils.now() : ( new Date()).toISOString();
          const timeParts = nowStr.split("T");
          const timeStr = (timeParts.length > 1 ? timeParts[1].split(".")[0] : "") || nowStr;
          const entry = document.createElement("div");
          entry.className = "ig-log-entry";
          const timeSpan = document.createElement("span");
          timeSpan.className = "ig-log-time";
          timeSpan.textContent = timeStr;
          const textNode = document.createTextNode(msg);
          entry.appendChild(timeSpan);
          entry.appendChild(textNode);
          box.appendChild(entry);
          box.scrollTop = box.scrollHeight;
        }
      } catch (err) {
        console.error("[IG Analyzer Log Box Error]", err);
      }
      try {
        Utils.log(msg);
      } catch (err) {
        console.log(`[IG Analyzer] ${msg}`);
      }
    },
    setProgress: (current, total, label) => {
      const container = document.getElementById("ig-progress-container");
      const bar = document.getElementById("ig-progress-bar");
      if (!container || !bar) return;
      container.style.display = "block";
      if (typeof total === "number" && total > 0) {
        bar.classList.remove("is-indeterminate");
        const percent = Math.min(Math.max(Math.round(current / total * 100), 0), 100);
        bar.style.width = percent + "%";
        const statusText = label.includes("%") ? label : `${label} ${percent}%`;
        UI.setStatus(statusText);
      } else {
        bar.classList.add("is-indeterminate");
        bar.style.width = "100%";
        UI.setStatus(label);
      }
    },
    hideProgress: () => {
      const container = document.getElementById("ig-progress-container");
      const bar = document.getElementById("ig-progress-bar");
      if (container) container.style.display = "none";
      if (bar) {
        bar.classList.remove("is-indeterminate");
        bar.style.width = "0%";
      }
    },
    setRunButtonState: (state) => {
      const btnRun = document.getElementById("ig-run");
      if (!btnRun) return;
      if (state === "running") {
        btnRun.className = "ig-btn ig-btn-danger";
        btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + "</span>Cancel Analysis";
        btnRun.disabled = false;
      } else if (state === "cancelling") {
        btnRun.className = "ig-btn ig-btn-danger";
        btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + "</span>Cancelling...";
        btnRun.disabled = true;
      } else {
        btnRun.className = "ig-btn ig-btn-primary";
        btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.play + "</span>Run Analysis";
        btnRun.disabled = false;
      }
    },
    paginationState: {},
    CHIPS_DEF: [
      { id: "all", label: "All", icon: null },
      { id: "private", label: "Private", icon: Icons.lock },
      { id: "public", label: "Public", icon: null },
      { id: "besties", label: "Besties", icon: Icons.star },
      { id: "pending", label: "Pending", icon: Icons.clock },
      { id: "story", label: "With Story", icon: Icons.storyRing },
      { id: "verified", label: "Verified", icon: Icons.verified }
    ],
    getFilterCounts: (rawUsers, searchQuery = "") => {
      const query = (searchQuery || "").trim().toLowerCase();
      const baseList = query ? (rawUsers || []).filter((u) => {
        const uName = (u.username || "").toLowerCase();
        const fName = (u.fullName || "").toLowerCase();
        return uName.includes(query) || fName.includes(query);
      }) : rawUsers || [];
      return {
        all: baseList.length,
        private: baseList.filter((u) => Boolean(u.isPrivate)).length,
        public: baseList.filter((u) => u.isPrivate === false).length,
        besties: baseList.filter((u) => Boolean(u.isBestie)).length,
        pending: baseList.filter((u) => Boolean(u.outgoingRequest)).length,
        story: baseList.filter((u) => Boolean(u.latestReelMedia && u.latestReelMedia > 0)).length,
        verified: baseList.filter((u) => Boolean(u.isVerified)).length
      };
    },
    applyFilters: (containerId) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      const query = (state.searchQuery || "").trim().toLowerCase();
      const filter = state.filterType || "all";
      state.users = (state.rawUsers || []).filter((u) => {
        if (query) {
          const uName = (u.username || "").toLowerCase();
          const fName = (u.fullName || "").toLowerCase();
          if (!uName.includes(query) && !fName.includes(query)) {
            return false;
          }
        }
        if (filter === "private") return Boolean(u.isPrivate);
        if (filter === "public") return u.isPrivate === false;
        if (filter === "besties") return Boolean(u.isBestie);
        if (filter === "pending") return Boolean(u.outgoingRequest);
        if (filter === "story") return Boolean(u.latestReelMedia && u.latestReelMedia > 0);
        if (filter === "verified") return Boolean(u.isVerified);
        return true;
      });
      state.page = 1;
      UI.renderResultsPage(containerId);
    },
    updateFilterChips: (containerId) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const chipsBar = container.querySelector(".ig-filter-chips");
      if (!chipsBar) return;
      const counts = UI.getFilterCounts(state.rawUsers, state.searchQuery);
      const chips = chipsBar.querySelectorAll(".ig-filter-chip");
      chips.forEach((chip) => {
        const filterId = chip.getAttribute("data-filter");
        if (filterId && counts[filterId] !== void 0) {
          const countEl = chip.querySelector(".ig-chip-count");
          if (countEl) countEl.textContent = counts[filterId];
        }
        if (filterId === state.filterType) {
          chip.classList.add("is-active");
        } else {
          chip.classList.remove("is-active");
        }
      });
      const headerBadge = container.querySelector(".ig-section-title .ig-badge");
      if (headerBadge) {
        const total = (state.rawUsers || []).length;
        const filtered = (state.users || []).length;
        headerBadge.textContent = filtered !== total ? `${filtered} / ${total}` : `${total}`;
      }
    },
    removeUserFromResults: (containerId, targetUsername) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      if (Array.isArray(state.rawUsers)) {
        state.rawUsers = state.rawUsers.filter((u) => u.username !== targetUsername);
      }
      if (Array.isArray(state.users)) {
        state.users = state.users.filter((u) => u.username !== targetUsername);
      }
      UI.renderResultsPage(containerId);
    },
    getActiveViewUsers: () => {
      const activeTab = document.querySelector("#ig-tabs .ig-tab-btn.active");
      if (!activeTab) return null;
      const targetId = activeTab.getAttribute("data-target");
      if (!targetId || !UI.paginationState[targetId]) return null;
      return UI.paginationState[targetId].users || null;
    },
    changePage: (containerId, delta) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      const totalPages = Math.max(1, Math.ceil(state.users.length / state.pageSize));
      const newPage = state.page + delta;
      if (newPage >= 1 && newPage <= totalPages) {
        state.page = newPage;
        UI.renderResultsPage(containerId);
      }
    },
    renderUserBadgesHtml: (u) => {
      let badges = "";
      if (u?.isPrivate) {
        badges += '<span class="ig-badge-pill ig-badge-private" title="Private Account">' + Icons.lock + "</span>";
      }
      if (u?.isBestie) {
        badges += '<span class="ig-badge-pill ig-badge-bestie" title="Close Friends">' + Icons.star + " Bestie</span>";
      }
      if (u?.outgoingRequest) {
        badges += '<span class="ig-badge-pill ig-badge-pending" title="Follow Request Pending">' + Icons.clock + " Pending</span>";
      }
      if (u?.isBusiness) {
        badges += '<span class="ig-badge-pill ig-badge-business" title="' + (u.category ? Utils.escapeHtml(u.category) : "Business Account") + '">' + Icons.briefcase + " Business</span>";
      } else if (u?.isCreator) {
        badges += '<span class="ig-badge-pill ig-badge-creator" title="' + (u.category ? Utils.escapeHtml(u.category) : "Content Creator") + '">' + Icons.creator + " Creator</span>";
      }
      if (u?.followsBack === true) {
        badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + " Mutual</span>";
      } else if (u?.followsBack === false) {
        badges += '<span class="ig-badge-pill ig-badge-fan" title="You do not follow them back">' + Icons.fans + " Fan</span>";
      }
      if (u?.date) {
        badges += '<span class="ig-badge-pill ig-badge-date" title="First detected on ' + Utils.escapeHtml(u.date) + '">' + Icons.clock + " " + Utils.escapeHtml(u.date) + "</span>";
      }
      return badges;
    },
    renderResultsPage: (containerId) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const { rawUsers, users, title, isExportable, pageSize, searchQuery, filterType } = state;
      const safeTitle = Utils.escapeHtml(title);
      const totalRaw = (rawUsers || []).length;
      const totalFiltered = (users || []).length;
      if (totalRaw === 0) {
        container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No data available yet.</div>";
        if (isExportable) {
          const exportBtn = document.getElementById("ig-export-csv");
          if (exportBtn) exportBtn.disabled = true;
        }
        return;
      }
      const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
      state.page = Math.max(1, Math.min(state.page, totalPages));
      const page = state.page;
      const startIndex = (page - 1) * pageSize;
      const pageUsers = users.slice(startIndex, startIndex + pageSize);
      let headerEl = container.querySelector(".ig-view-header");
      let toolbarEl = container.querySelector(".ig-filter-toolbar");
      let listEl = container.querySelector(".ig-view-list");
      let paginationEl = container.querySelector(".ig-view-pagination");
      const badgeCountText = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;
      if (!toolbarEl) {
        const counts = UI.getFilterCounts(rawUsers, searchQuery);
        let chipsHtml = "";
        UI.CHIPS_DEF.forEach((chip) => {
          const isActive = (filterType || "all") === chip.id;
          const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : "";
          chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? " is-active" : ""}" data-filter="${chip.id}">` + iconHtml + `<span class="ig-chip-label">${chip.label}</span><span class="ig-chip-count">${counts[chip.id] || 0}</span></button>`;
        });
        const clearStyle = searchQuery ? "display: inline-flex;" : "display: none;";
        const skeletonHtml = [
          '<div class="ig-view-header">',
          '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + "</span></div>",
          "</div>",
          '<div class="ig-filter-toolbar">',
          '  <div class="ig-search-box">',
          '    <span class="ig-search-icon">' + Icons.search + "</span>",
          '    <input type="text" class="ig-search-input" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || "") + '" autocomplete="off" spellcheck="false" />',
          '    <button type="button" class="ig-search-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + "</button>",
          "  </div>",
          '  <div class="ig-filter-chips">' + chipsHtml + "</div>",
          "</div>",
          '<div class="ig-view-list"></div>',
          '<div class="ig-view-pagination"></div>'
        ].join("\n");
        container.innerHTML = skeletonHtml;
        headerEl = container.querySelector(".ig-view-header");
        toolbarEl = container.querySelector(".ig-filter-toolbar");
        listEl = container.querySelector(".ig-view-list");
        paginationEl = container.querySelector(".ig-view-pagination");
        const searchInput = toolbarEl.querySelector(".ig-search-input");
        const clearBtn = toolbarEl.querySelector(".ig-search-clear");
        let searchTimeout = null;
        if (searchInput) {
          searchInput.addEventListener("input", (e) => {
            const val = e.target.value;
            if (clearBtn) clearBtn.style.display = val ? "inline-flex" : "none";
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              state.searchQuery = val;
              UI.applyFilters(containerId);
            }, 120);
          });
          searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && searchInput.value) {
              e.preventDefault();
              searchInput.value = "";
              if (clearBtn) clearBtn.style.display = "none";
              state.searchQuery = "";
              UI.applyFilters(containerId);
            }
          });
        }
        if (clearBtn && searchInput) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            searchInput.value = "";
            clearBtn.style.display = "none";
            state.searchQuery = "";
            searchInput.focus();
            UI.applyFilters(containerId);
          });
        }
        const chipsBar = toolbarEl.querySelector(".ig-filter-chips");
        if (chipsBar) {
          chipsBar.addEventListener("click", (e) => {
            const chipBtn = e.target.closest(".ig-filter-chip");
            if (!chipBtn) return;
            e.preventDefault();
            const targetFilter = chipBtn.getAttribute("data-filter");
            if (!targetFilter) return;
            if (state.filterType === targetFilter && targetFilter !== "all") {
              state.filterType = "all";
            } else {
              state.filterType = targetFilter;
            }
            UI.applyFilters(containerId);
          });
        }
      } else {
        if (headerEl) {
          headerEl.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + "</span></div>";
        }
        UI.updateFilterChips(containerId);
        const clearBtn = toolbarEl.querySelector(".ig-search-clear");
        if (clearBtn) {
          clearBtn.style.display = state.searchQuery ? "inline-flex" : "none";
        }
      }
      let rowsHtml = "";
      if (totalFiltered === 0) {
        rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + "</span>No users match your search or filter criteria.</div>";
      } else {
        pageUsers.forEach((u, index) => {
          const globalIndex = startIndex + index;
          const uniqueId = containerId + "-row-" + globalIndex;
          const safeUsername = Utils.escapeHtml(u.username || "");
          const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : "?";
          const safeUrl = Utils.sanitizeUrl(u.username, u.url);
          const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : "";
          const isVerified = Boolean(u.isVerified);
          const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
          const isBestieStory = hasStory && Boolean(u.isBestie);
          const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
          let avatarStyle = "object-fit:cover;";
          if (isBestieStory) {
            avatarStyle += " outline: 2px solid #22c55e; outline-offset: 1px;";
          } else if (hasStory) {
            avatarStyle += " outline: 2px solid #e1306c; outline-offset: 1px;";
          }
          const avatarClass = "ig-user-avatar" + (isBestieStory ? " has-bestie-ring" : "");
          const avatarHtml = safeAvatarUrl ? '<img class="' + avatarClass + '" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" style="' + avatarStyle + '" />' : '<span class="' + avatarClass + '" style="' + avatarStyle + '">' + safeInitial + "</span>";
          const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${Utils.escapeHtml(u.id || "")}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;
          const badgesHtml = UI.renderUserBadgesHtml(u);
          rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '">';
          rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
          rowsHtml += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
          rowsHtml += '<div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
          rowsHtml += '<span class="ig-username">' + safeUsername + "</span>";
          if (isVerified) {
            rowsHtml += '<span title="Verified" style="display:inline-flex; align-items:center;">' + Icons.verified + "</span>";
          }
          rowsHtml += '<span class="ig-user-badges" id="' + uniqueId + '-badges">' + badgesHtml + "</span>";
          rowsHtml += "</div>";
          if (safeFullName) {
            rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + "</span>";
          }
          rowsHtml += "</div></div>";
          rowsHtml += '<div class="ig-user-actions">';
          if (containerId === "ig-view-notfollowing") {
            rowsHtml += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
          }
          rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || "") + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + " Inspect</button>";
          if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers") {
            rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '" title="Audit Account Network in Subpanel">' + Icons.target + " Audit</button>";
            rowsHtml += '<button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '">' + Icons.spy + " Check Story</button>";
          }
          rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          rowsHtml += "</div></div>";
        });
      }
      if (listEl) listEl.innerHTML = rowsHtml;
      let paginationHtml = "";
      if (totalPages > 1) {
        paginationHtml += '<div class="ig-pagination">';
        paginationHtml += '<button class="ig-page-btn ig-page-prev" data-container="' + containerId + '"' + (page <= 1 ? " disabled" : "") + ">&larr; Prev</button>";
        paginationHtml += '<span class="ig-page-info">Page ' + page + " of " + totalPages + " (" + totalFiltered + " users)</span>";
        paginationHtml += '<button class="ig-page-btn ig-page-next" data-container="' + containerId + '"' + (page >= totalPages ? " disabled" : "") + ">Next &rarr;</button>";
        paginationHtml += "</div>";
      }
      if (paginationEl) paginationEl.innerHTML = paginationHtml;
      if (isExportable) {
        const exportBtn = document.getElementById("ig-export-csv");
        if (exportBtn) exportBtn.disabled = totalFiltered === 0 && totalRaw === 0;
      }
      const userIdsToFetch = pageUsers.map((u) => u.id).filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");
      if (userIdsToFetch.length > 0 && typeof API.fetchFriendshipStatusesMany === "function") {
        API.fetchFriendshipStatusesMany(userIdsToFetch).then((statusMap) => {
          const currentState = UI.paginationState[containerId];
          if (!currentState || currentState.page !== page) return;
          pageUsers.forEach((u, index) => {
            if (!u.id) return;
            const status = statusMap[u.id];
            if (!status) return;
            let stateChanged = false;
            if (u.isPrivate !== status.isPrivate) {
              u.isPrivate = status.isPrivate;
              stateChanged = true;
            }
            if (u.isBestie !== status.isBestie) {
              u.isBestie = status.isBestie;
              stateChanged = true;
            }
            if (u.outgoingRequest !== status.outgoingRequest) {
              u.outgoingRequest = status.outgoingRequest;
              stateChanged = true;
            }
            if (stateChanged) {
              const rowId = containerId + "-row-" + (startIndex + index);
              const badgeContainer = document.getElementById(rowId + "-badges");
              if (badgeContainer) {
                badgeContainer.innerHTML = UI.renderUserBadgesHtml(u);
              }
              if (status.isBestie && u.latestReelMedia > 0) {
                const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
                if (avatarEl) {
                  avatarEl.classList.add("has-bestie-ring");
                  avatarEl.style.outlineColor = "#22c55e";
                }
              }
            }
          });
          UI.updateFilterChips(containerId);
        }).catch((err) => {
          console.warn("[IG Analyzer] Error updating friendship statuses batch:", err);
        });
      }
    },
    renderResults: (users, title, containerId, isExportable = false) => {
      const safeUsers = Array.isArray(users) ? users : [];
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = "";
      }
      UI.paginationState[containerId] = {
        rawUsers: safeUsers,
        users: safeUsers,
        title,
        containerId,
        isExportable,
        page: 1,
        pageSize: 50,
        searchQuery: "",
        filterType: "all"
      };
      UI.renderResultsPage(containerId);
    },
    renderNewFollowers: (users, containerId = "ig-view-newfollowers") => {
      const safeUsers = Array.isArray(users) ? users : [];
      UI.renderResults(safeUsers, "New Followers", containerId, true);
    },
    whitelistSearchQuery: "",
    renderWhitelist: (whitelistUsers, containerId = "ig-view-whitelist") => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const rawList = Array.isArray(whitelistUsers) ? whitelistUsers : [];
      const safeTitle = "Ignored Accounts (Whitelist)";
      const total = rawList.length;
      if (total === 0) {
        container.innerHTML = '<div class="ig-view-header"><div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.shieldCheck + "</span>No ignored accounts in whitelist.</div>";
        return;
      }
      const query = (UI.whitelistSearchQuery || "").trim().toLowerCase();
      const filteredList = query ? rawList.filter((u) => String(u || "").toLowerCase().includes(query)) : rawList;
      const badgeText = filteredList.length !== total ? `${filteredList.length} / ${total}` : `${total}`;
      let html = [
        '<div class="ig-view-header" style="display:flex; justify-content:space-between; align-items:center;">',
        '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeText + "</span></div>",
        '  <button type="button" class="ig-btn-clear-whitelist btn-clear-whitelist" title="Clear all ignored accounts">' + Icons.trash + " Clear All</button>",
        "</div>",
        '<div class="ig-filter-toolbar">',
        '  <div class="ig-search-box">',
        '    <span class="ig-search-icon">' + Icons.search + "</span>",
        '    <input type="text" class="ig-search-input ig-whitelist-search-input" placeholder="Search ignored accounts..." value="' + Utils.escapeHtml(UI.whitelistSearchQuery || "") + '" autocomplete="off" spellcheck="false" />',
        '    <button type="button" class="ig-search-clear ig-whitelist-search-clear" title="Clear search" style="' + (UI.whitelistSearchQuery ? "display:inline-flex;" : "display:none;") + '">' + Icons.clear + "</button>",
        "  </div>",
        "</div>",
        '<div class="ig-view-list">'
      ].join("\n");
      if (filteredList.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + "</span>No accounts match your search.</div>";
      } else {
        const snapshot = Storage.load();
        const knownUsersMap = new Map();
        if (snapshot) {
          const candidates = [
            ...snapshot.followingDetailed || [],
            ...snapshot.followersDetailed || [],
            ...snapshot.notFollowingBackDetailed || []
          ];
          candidates.forEach((u) => {
            if (u?.username && !knownUsersMap.has(u.username)) {
              knownUsersMap.set(u.username, u);
            }
          });
        }
        filteredList.slice().reverse().forEach((username, idx) => {
          const safeUsername = Utils.escapeHtml(username);
          const safeUrl = Utils.sanitizeUrl(username);
          const known = knownUsersMap.get(username);
          const safeFullName = known?.fullName ? Utils.escapeHtml(known.fullName) : "";
          const safeAvatarUrl = known?.profilePicUrl ? Utils.sanitizeImageUrl(known.profilePicUrl) : null;
          const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : "?";
          const avatarHtml = safeAvatarUrl ? '<img class="ig-user-avatar" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" style="object-fit:cover;" />' : '<span class="ig-user-avatar">' + safeInitial + "</span>";
          const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;
          html += '<div class="ig-user-row" id="wl-row-' + idx + '" data-user="' + safeUsername + '">';
          html += '<div class="ig-user-info">' + avatarTriggerHtml;
          html += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
          html += '<span class="ig-username">' + safeUsername + "</span>";
          if (safeFullName) {
            html += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + "</span>";
          }
          html += "</div></div>";
          html += '<div class="ig-user-actions">';
          html += '<button class="ig-btn-unwhitelist btn-unwhitelist" data-user="' + safeUsername + '" title="Restore to Not Following">' + Icons.restore + " Restore</button>";
          html += '<button class="ig-btn-inspect-user btn-inspect-user" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + " Inspect</button>";
          html += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" title="Audit Account Network in Subpanel">' + Icons.target + " Audit</button>";
          html += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          html += "</div></div>";
        });
      }
      html += "</div>";
      container.innerHTML = html;
      const searchInput = container.querySelector(".ig-whitelist-search-input");
      const clearBtn = container.querySelector(".ig-whitelist-search-clear");
      let searchTimeout = null;
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          const val = e.target.value;
          if (clearBtn) clearBtn.style.display = val ? "inline-flex" : "none";
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            UI.whitelistSearchQuery = val;
            UI.renderWhitelist(whitelistUsers, containerId);
          }, 120);
        });
        searchInput.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && searchInput.value) {
            e.preventDefault();
            searchInput.value = "";
            UI.whitelistSearchQuery = "";
            UI.renderWhitelist(whitelistUsers, containerId);
          }
        });
      }
      if (clearBtn && searchInput) {
        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          searchInput.value = "";
          UI.whitelistSearchQuery = "";
          UI.renderWhitelist(whitelistUsers, containerId);
        });
      }
    },
    renderNominalList: (list, containerId, title) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const safeTitle = Utils.escapeHtml(title);
      const safeList = Array.isArray(list) ? list : [];
      let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + safeList.length + "</span></div>";
      if (safeList.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No historical records yet.</div>";
      } else {
        html += '<table class="ig-table"><thead><tr><th>Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
        safeList.slice().reverse().forEach((item) => {
          const safeUsername = Utils.escapeHtml(item.username || "");
          const safeDate = Utils.escapeHtml(item.date || "");
          const profileUrl = Utils.sanitizeUrl(item.username);
          html += "<tr>";
          html += "<td><span class='ig-table-user'>" + safeUsername + "</span></td>";
          html += "<td><span class='ig-table-date'>" + safeDate + "</span></td>";
          html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + "</a></td>";
          html += "</tr>";
        });
        html += "</tbody></table>";
      }
      container.innerHTML = html;
    },
    renderRenamedList: (list, containerId, title) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const safeList = Array.isArray(list) ? list : [];
      const safeTitle = Utils.escapeHtml(title);
      let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + safeList.length + "</span></div>";
      if (safeList.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No username changes detected yet.</div>";
      } else {
        html += '<table class="ig-table"><thead><tr><th>Previous Username</th><th>Current Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
        safeList.slice().reverse().forEach((item) => {
          const oldUsername = item.oldUsername || "-";
          const newUsername = item.newUsername || item.username || "-";
          const safeOldUser = Utils.escapeHtml(oldUsername);
          const safeNewUser = Utils.escapeHtml(newUsername);
          const safeDate = Utils.escapeHtml(item.date || "-");
          const profileUrl = newUsername !== "-" ? Utils.sanitizeUrl(newUsername) : "#";
          html += "<tr>";
          html += "<td><span class='ig-table-user'>" + safeOldUser + "</span></td>";
          html += "<td><span class='ig-table-user'>" + safeNewUser + "</span></td>";
          html += "<td><span class='ig-table-date'>" + safeDate + "</span></td>";
          html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + "</a></td>";
          html += "</tr>";
        });
        html += "</tbody></table>";
      }
      container.innerHTML = html;
    },
    renderHistory: (historyData) => {
      const container = document.getElementById("ig-view-history");
      if (!container) return;
      let html = '<div class="ig-section-title">Metrics History</div>';
      if (!historyData || historyData.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + "</span>No historical data available.</div>";
        container.innerHTML = html;
        return;
      }
      const reversedHistory = historyData.slice().reverse();
      const latest = reversedHistory[0];
      const prev = reversedHistory.length > 1 ? reversedHistory[1] : null;
      const currentFollowers = latest ? Utils.formatNumber(latest.followers) : "-";
      const currentFollowing = latest ? Utils.formatNumber(latest.following) : "-";
      let followerDiffText = "First record";
      let followerDiffClass = "is-neutral";
      let followerDiffIcon = Icons.neutral;
      let followingDiffText = "First record";
      let followingDiffClass = "is-neutral";
      let followingDiffIcon = Icons.neutral;
      if (prev) {
        const fDiff = latest.followers - prev.followers;
        if (fDiff > 0) {
          followerDiffText = "+" + fDiff + " vs previous";
          followerDiffClass = "is-positive";
          followerDiffIcon = Icons.trendingUp;
        } else if (fDiff < 0) {
          followerDiffText = fDiff + " vs previous";
          followerDiffClass = "is-negative";
          followerDiffIcon = Icons.trendingDown;
        } else {
          followerDiffText = "No change vs previous";
        }
        const ingDiff = latest.following - prev.following;
        if (ingDiff > 0) {
          followingDiffText = "+" + ingDiff + " vs previous";
          followingDiffClass = "is-positive";
          followingDiffIcon = Icons.trendingUp;
        } else if (ingDiff < 0) {
          followingDiffText = ingDiff + " vs previous";
          followingDiffClass = "is-negative";
          followingDiffIcon = Icons.trendingDown;
        } else {
          followingDiffText = "No change vs previous";
        }
      }
      const churnCount = Storage.getNominalList(CONFIG.CHURN_KEY).length;
      const newCount = Storage.getNewFollowersList().length;
      const netFlow = newCount - churnCount;
      const netFlowSign = netFlow > 0 ? "+" : "";
      const netFlowClass = netFlow > 0 ? "is-positive" : netFlow < 0 ? "is-negative" : "is-neutral";
      html += [
        '<div class="ig-history-kpi-grid">',
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Followers</div>',
        '    <div class="ig-kpi-value">' + currentFollowers + "</div>",
        '    <div class="ig-kpi-sub ' + followerDiffClass + '">' + followerDiffIcon + " <span>" + followerDiffText + "</span></div>",
        "  </div>",
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Following</div>',
        '    <div class="ig-kpi-value">' + currentFollowing + "</div>",
        '    <div class="ig-kpi-sub ' + followingDiffClass + '">' + followingDiffIcon + " <span>" + followingDiffText + "</span></div>",
        "  </div>",
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Audience Balance</div>',
        '    <div class="ig-kpi-value ' + netFlowClass + '">' + netFlowSign + netFlow + "</div>",
        '    <div class="ig-kpi-sub"><span style="color:#22c55e; font-weight:600;">+' + newCount + '</span> new / <span style="color:#ef4444; font-weight:600;">-' + churnCount + "</span> lost</div>",
        "  </div>",
        "</div>"
      ].join("\n");
      html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th></tr></thead><tbody>';
      reversedHistory.forEach((h, index) => {
        let followerIcon = Icons.neutral;
        let followingIcon = Icons.neutral;
        if (index < reversedHistory.length - 1) {
          const prevDay = reversedHistory[index + 1];
          if (h.followers > prevDay.followers) followerIcon = Icons.up;
          else if (h.followers < prevDay.followers) followerIcon = Icons.down;
          if (h.following > prevDay.following) followingIcon = Icons.up;
          else if (h.following < prevDay.following) followingIcon = Icons.down;
        }
        const safeDate = Utils.escapeHtml(h.date || "");
        const safeFollowers = Utils.escapeHtml(String(h.followers ?? ""));
        const safeFollowing = Utils.escapeHtml(String(h.following ?? ""));
        html += "<tr><td><span class='ig-table-date'>" + safeDate + "</span></td><td><span class='ig-metric-value'>" + safeFollowers + " " + followerIcon + "</span></td><td><span class='ig-metric-value'>" + safeFollowing + " " + followingIcon + "</span></td></tr>";
      });
      html += "</tbody></table>";
      container.innerHTML = html;
    },
    clampPosition: (panel, x, y) => {
      const panelWidth = panel.offsetWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const min = CONFIG.MIN_VISIBLE_PX;
      const clampedX = Math.max(min - panelWidth, Math.min(x, vw - min));
      const clampedY = Math.max(0, Math.min(y, vh - min));
      return { x: clampedX, y: clampedY };
    },
    setupDrag: (panel, handle) => {
      let isDragging = false, offsetX, offsetY;
      handle.addEventListener("mousedown", (e) => {
        if (e.target.closest(".ig-header-btn, #ig-status")) return;
        isDragging = true;
        panel.classList.add("is-dragging");
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.body.style.userSelect = "none";
      });
      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const raw = UI.clampPosition(panel, e.clientX - offsetX, e.clientY - offsetY);
        panel.style.left = raw.x + "px";
        panel.style.top = raw.y + "px";
        panel.style.right = "auto";
        const prev = GM_getValue(CONFIG.POSITION_KEY, {}) || {};
        GM_setValue(CONFIG.POSITION_KEY, { ...prev, x: raw.x, y: raw.y });
      });
      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.classList.remove("is-dragging");
          document.body.style.userSelect = "";
        }
      });
      window.addEventListener("resize", () => {
        const clamped = UI.clampPosition(panel, panel.offsetLeft, panel.offsetTop);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
        const prev = GM_getValue(CONFIG.POSITION_KEY, {}) || {};
        GM_setValue(CONFIG.POSITION_KEY, { ...prev, x: clamped.x, y: clamped.y });
      });
      if (typeof ResizeObserver === "function") {
        let resizeTimer = null;
        const ro = new ResizeObserver(() => {
          if (panel.classList.contains("is-minimized")) return;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (panel.classList.contains("is-minimized")) return;
            const w = panel.offsetWidth;
            const h = panel.offsetHeight;
            if (w >= 360 && h >= 200) {
              const prev = GM_getValue(CONFIG.POSITION_KEY, {}) || {};
              GM_setValue(CONFIG.POSITION_KEY, { ...prev, width: w, height: h });
            }
          }, 250);
        });
        ro.observe(panel);
      }
    },
    loadPosition: (panel) => {
      const pos = GM_getValue(CONFIG.POSITION_KEY, null);
      if (pos && typeof pos.x === "number") {
        const clamped = UI.clampPosition(panel, pos.x, pos.y);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
      }
      if (pos && typeof pos.width === "number" && typeof pos.height === "number") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const safeW = Math.min(pos.width, vw - 40);
        const safeH = Math.min(pos.height, vh - 40);
        if (safeW >= 360) panel.style.width = safeW + "px";
        if (safeH >= 200) panel.style.height = safeH + "px";
      }
    },
    resetPosition: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      if (!panel) return;
      panel.style.left = "auto";
      panel.style.top = CONFIG.DEFAULT_POSITION.top + "px";
      panel.style.right = CONFIG.DEFAULT_POSITION.right + "px";
      panel.style.width = CONFIG.DEFAULT_POSITION.width + "px";
      panel.style.height = CONFIG.DEFAULT_POSITION.height + "px";
      GM_deleteValue(CONFIG.POSITION_KEY);
    },
    toggleMinimize: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      if (panel) {
        panel.classList.toggle("is-minimized");
      }
    },
    togglePanel: () => {
      const p = document.getElementById("ig-analyzer-panel");
      if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
    },
    currentTargetUser: null,
    targetPaginationState: {},
    initTargetSubpanel: () => {
      if (document.getElementById("ig-target-subpanel")) return;
      const subpanel = document.createElement("div");
      subpanel.id = "ig-target-subpanel";
      subpanel.className = "ig-target-subpanel";
      subpanel.style.display = "none";
      subpanel.innerHTML = [
        '<div id="ig-target-header" class="ig-target-header">',
        '  <div class="ig-target-header-left">',
        '    <span class="ig-target-header-icon">' + Icons.target + "</span>",
        '    <span id="ig-target-header-title" class="ig-target-header-title">Target Network Audit</span>',
        "  </div>",
        '  <div class="ig-target-header-right">',
        '    <span id="ig-target-status"><span class="ig-status-dot"></span>Idle</span>',
        '    <div class="ig-target-header-actions">',
        '      <button id="ig-target-btn-refresh" class="ig-header-btn" title="Refresh Audit">' + Icons.refresh + "</button>",
        '      <button id="ig-target-btn-minimize" class="ig-header-btn" title="Minimize / Expand">' + Icons.minimize + "</button>",
        '      <button id="ig-target-btn-close" class="ig-header-btn ig-header-btn-close" title="Close Subpanel">',
        '        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        "      </button>",
        "    </div>",
        "  </div>",
        "</div>",
        '<div class="ig-target-actions-bar">',
        '  <div class="ig-target-meta-summary" id="ig-target-meta-summary">',
        '    <span class="ig-target-meta-text">Target: None selected</span>',
        "  </div>",
        '  <div class="ig-target-actions-buttons">',
        '    <button id="ig-target-run" class="ig-btn ig-btn-primary ig-btn-sm"><span class="ig-btn-icon">' + Icons.play + "</span>Run Audit</button>",
        '    <button id="ig-target-export-csv" class="ig-btn ig-btn-success ig-btn-sm" disabled><span class="ig-btn-icon">' + Icons.download + "</span>Export CSV</button>",
        "  </div>",
        "</div>",
        '<div id="ig-target-progress-container" class="ig-progress-container" style="display:none;"><div id="ig-target-progress-bar" class="ig-progress-bar"></div></div>',
        '<div class="ig-tabs-wrapper ig-target-tabs-wrapper">',
        '  <div class="ig-tabs-container" id="ig-target-tabs">',
        '    <div id="ig-target-tab-indicator" class="ig-tab-indicator"></div>',
        '    <button class="ig-tab-btn active" data-target="ig-target-view-overview"><span class="ig-tab-icon">' + Icons.metrics + '</span><span class="ig-tab-label">Overview</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-lostfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Lost Followers</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-followers"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Followers</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-following"><span class="ig-tab-icon">' + Icons.notFollowing + '</span><span class="ig-tab-label">Following</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-logs"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
        "  </div>",
        "</div>",
        '<div id="ig-target-view-overview" class="ig-view-container ig-view ig-target-view active"></div>',
        '<div id="ig-target-view-mutuals" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-newfollowers" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-lostfollowers" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-followers" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-following" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-logs" class="ig-view-container ig-view ig-target-view"></div>',
        '<div class="ig-target-resize-grip" title="Resize handle"></div>'
      ].join("\n");
      document.body.appendChild(subpanel);
      subpanel.querySelector("#ig-target-btn-minimize")?.addEventListener("click", (e) => {
        e.stopPropagation();
        UI.toggleTargetMinimize();
      });
      subpanel.querySelector("#ig-target-btn-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        UI.closeTargetSubpanel();
      });
      subpanel.querySelector("#ig-target-btn-refresh")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (UI.currentTargetUser && window.App?.runTargetAudit) {
          window.App.runTargetAudit(UI.currentTargetUser, true);
        }
      });
      const tabsContainer = subpanel.querySelector("#ig-target-tabs");
      const indicator = subpanel.querySelector("#ig-target-tab-indicator");
      const updateIndicator = (activeBtn, animate = true) => {
        if (!activeBtn || !indicator || !tabsContainer) return;
        if (!animate) indicator.style.transition = "none";
        else indicator.style.transition = "";
        indicator.style.transform = `translate3d(${activeBtn.offsetLeft}px, ${activeBtn.offsetTop}px, 0)`;
        indicator.style.width = `${activeBtn.offsetWidth}px`;
        indicator.style.height = `${activeBtn.offsetHeight}px`;
        indicator.style.opacity = "1";
        if (!animate) {
          indicator.offsetHeight;
          indicator.style.transition = "";
        }
      };
      const btns = subpanel.querySelectorAll(".ig-tab-btn");
      btns.forEach((btn) => {
        btn.onclick = (e) => {
          const target = e.target.closest(".ig-tab-btn");
          if (!target) return;
          const scrollLeft = target.offsetLeft - tabsContainer.offsetWidth / 2 + target.offsetWidth / 2;
          tabsContainer.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
          const targetId = target.getAttribute("data-target");
          if (!targetId) return;
          btns.forEach((b) => b.classList.remove("active"));
          subpanel.querySelectorAll(".ig-view, .ig-target-view").forEach((v) => v.classList.remove("active"));
          target.classList.add("active");
          const targetView = subpanel.querySelector(`#${targetId}`);
          if (targetView) targetView.classList.add("active");
          updateIndicator(target, true);
          const expBtn = subpanel.querySelector("#ig-target-export-csv");
          if (expBtn) {
            const activeList = UI.getTargetActiveList();
            expBtn.disabled = !activeList || activeList.length === 0;
          }
        };
      });
      if (tabsContainer) {
        tabsContainer.addEventListener("wheel", (e) => {
          if (e.deltaY !== 0) {
            e.preventDefault();
            e.stopPropagation();
            tabsContainer.scrollLeft += e.deltaY;
          }
        }, { passive: false });
        tabsContainer.addEventListener("scroll", () => {
          const currentActive = tabsContainer.querySelector(".ig-tab-btn.active");
          if (currentActive) {
            updateIndicator(currentActive, false);
          }
        }, { passive: true });
      }
      UI.setupTargetDrag(subpanel, subpanel.querySelector("#ig-target-header"));
      UI.loadTargetPosition(subpanel);
    },
    setupTargetDrag: (panel, handle) => {
      let isDragging = false, offsetX, offsetY;
      handle.addEventListener("mousedown", (e) => {
        if (e.target.closest(".ig-header-btn, #ig-target-status")) return;
        isDragging = true;
        panel.classList.add("is-dragging");
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.body.style.userSelect = "none";
      });
      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const raw = UI.clampPosition(panel, e.clientX - offsetX, e.clientY - offsetY);
        panel.style.left = raw.x + "px";
        panel.style.top = raw.y + "px";
        panel.style.right = "auto";
        GM_setValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, { x: raw.x, y: raw.y });
      });
      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.classList.remove("is-dragging");
          document.body.style.userSelect = "";
        }
      });
    },
    loadTargetPosition: (panel) => {
      const pos = GM_getValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, null);
      if (pos && typeof pos.x === "number") {
        const clamped = UI.clampPosition(panel, pos.x, pos.y);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
      } else {
        const vw = window.innerWidth;
        const left = Math.max(30, vw - 960);
        panel.style.left = left + "px";
        panel.style.top = "90px";
        panel.style.right = "auto";
      }
    },
    openTargetSubpanel: (targetUserObj, storedData = null) => {
      UI.currentTargetUser = targetUserObj;
      const subpanel = document.getElementById("ig-target-subpanel");
      if (!subpanel) return;
      const cleanUser = String(targetUserObj.username || "").replace(/^@/, "").trim();
      const titleEl = document.getElementById("ig-target-header-title");
      if (titleEl) {
        titleEl.innerHTML = "@" + Utils.escapeHtml(cleanUser) + (targetUserObj.isVerified ? " " + Icons.verified : "");
      }
      const summaryBar = document.getElementById("ig-target-meta-summary");
      if (summaryBar) {
        let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(cleanUser) + "</span>";
        if (targetUserObj.fullName) {
          summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(targetUserObj.fullName) + "</span>";
        }
        const fCount = Array.isArray(storedData?.followers) && storedData.followers.length > 0 ? storedData.followers.length : targetUserObj.followerCount || 0;
        const ingCount = Array.isArray(storedData?.following) && storedData.following.length > 0 ? storedData.following.length : targetUserObj.followingCount || 0;
        summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(fCount) + " followers</span>";
        summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(ingCount) + " following</span>";
        summaryBar.innerHTML = summaryHtml;
      }
      subpanel.style.display = "flex";
      subpanel.classList.remove("is-minimized");
      const overviewTab = subpanel.querySelector('[data-target="ig-target-view-overview"]');
      if (overviewTab) overviewTab.click();
      const dataToRender = storedData || Storage.getTargetData(cleanUser);
      if (dataToRender) {
        UI.renderTargetOverview(dataToRender);
        UI.renderTargetLists(dataToRender);
      } else {
        const overviewView = document.getElementById("ig-target-view-overview");
        if (overviewView) {
          overviewView.innerHTML = [
            '<div class="ig-target-ready-card">',
            '  <div class="ig-target-ready-icon">' + Icons.target + "</div>",
            '  <div class="ig-target-ready-title">Ready to Audit @' + Utils.escapeHtml(cleanUser) + "</div>",
            '  <div class="ig-target-ready-desc">Click <b>"Run Audit"</b> above to extract followers & following, discover mutual connections, and start tracking audience balance.</div>',
            "</div>"
          ].join("");
        }
        ["mutuals", "newfollowers", "lostfollowers", "followers", "following"].forEach((key) => {
          const el = document.getElementById("ig-target-view-" + key);
          if (el) el.innerHTML = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>Run an audit to view " + key + ".</div>";
        });
        const expBtn = document.getElementById("ig-target-export-csv");
        if (expBtn) expBtn.disabled = true;
      }
    },
    closeTargetSubpanel: () => {
      const p = document.getElementById("ig-target-subpanel");
      if (p) p.style.display = "none";
    },
    toggleTargetMinimize: () => {
      const p = document.getElementById("ig-target-subpanel");
      if (p) p.classList.toggle("is-minimized");
    },
    setTargetStatus: (text) => {
      const el = document.getElementById("ig-target-status");
      if (el) {
        const dot = el.querySelector(".ig-status-dot");
        const dotHTML = dot ? dot.outerHTML : '<span class="ig-status-dot"></span>';
        el.innerHTML = dotHTML + Utils.escapeHtml(text);
        if (text && text.toLowerCase() !== "idle" && text.toLowerCase() !== "inactive") {
          el.classList.add("is-active");
        } else {
          el.classList.remove("is-active");
        }
      }
    },
    targetLog: (msg) => {
      try {
        const box = document.getElementById("ig-target-view-logs");
        if (box) {
          const nowStr = typeof Utils.now === "function" ? Utils.now() : ( new Date()).toISOString();
          const timeParts = nowStr.split("T");
          const timeStr = (timeParts.length > 1 ? timeParts[1].split(".")[0] : "") || nowStr;
          const entry = document.createElement("div");
          entry.className = "ig-log-entry";
          const timeSpan = document.createElement("span");
          timeSpan.className = "ig-log-time";
          timeSpan.textContent = timeStr;
          const textNode = document.createTextNode(msg);
          entry.appendChild(timeSpan);
          entry.appendChild(textNode);
          box.appendChild(entry);
          box.scrollTop = box.scrollHeight;
        }
      } catch (err) {
        console.error("[Target Subpanel Log Error]", err);
      }
    },
    setTargetProgress: (current, total, label) => {
      const container = document.getElementById("ig-target-progress-container");
      const bar = document.getElementById("ig-target-progress-bar");
      if (!container || !bar) return;
      container.style.display = "block";
      if (typeof total === "number" && total > 0) {
        bar.classList.remove("is-indeterminate");
        const percent = Math.min(Math.max(Math.round(current / total * 100), 0), 100);
        bar.style.width = percent + "%";
        const statusText = label.includes("%") ? label : `${label} ${percent}%`;
        UI.setTargetStatus(statusText);
      } else {
        bar.classList.add("is-indeterminate");
        bar.style.width = "100%";
        UI.setTargetStatus(label);
      }
    },
    hideTargetProgress: () => {
      const container = document.getElementById("ig-target-progress-container");
      const bar = document.getElementById("ig-target-progress-bar");
      if (container) container.style.display = "none";
      if (bar) {
        bar.classList.remove("is-indeterminate");
        bar.style.width = "0%";
      }
    },
    setTargetRunButtonState: (state) => {
      const btn = document.getElementById("ig-target-run");
      if (!btn) return;
      if (state === "running") {
        btn.className = "ig-btn ig-btn-danger ig-btn-sm";
        btn.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + "</span>Cancel Audit";
        btn.disabled = false;
      } else if (state === "cancelling") {
        btn.className = "ig-btn ig-btn-danger ig-btn-sm";
        btn.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + "</span>Cancelling...";
        btn.disabled = true;
      } else {
        btn.className = "ig-btn ig-btn-primary ig-btn-sm";
        btn.innerHTML = '<span class="ig-btn-icon">' + Icons.play + "</span>Run Audit";
        btn.disabled = false;
      }
    },
    renderTargetOverview: (targetData) => {
      const container = document.getElementById("ig-target-view-overview");
      if (!container || !targetData) return;
      const u = targetData.user || {};
      const safeUser = Utils.escapeHtml(u.username || targetData.username || "");
      const safeName = Utils.escapeHtml(u.fullName || "");
      const avatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
      const isVerified = Boolean(u.isVerified);
      const isPrivate = Boolean(u.isPrivate);
      const isRestricted = Boolean(targetData.isRestricted);
      const avatarHtml = avatarUrl ? '<img class="ig-user-avatar" src="' + avatarUrl + '" alt="' + safeUser + '" />' : '<span class="ig-user-avatar">' + (safeUser ? safeUser.charAt(0).toUpperCase() : "?") + "</span>";
      const followersCount = Array.isArray(targetData.followers) && targetData.followers.length > 0 ? targetData.followers.length : u.followerCount || 0;
      const followingCount = Array.isArray(targetData.following) && targetData.following.length > 0 ? targetData.following.length : u.followingCount || 0;
      const mutualsCount = Array.isArray(targetData.mutuals) && targetData.mutuals.length > 0 ? targetData.mutuals.length : typeof u.mutualsCount === "number" ? u.mutualsCount : 0;
      const newCount = targetData.newFollowers ? targetData.newFollowers.length : 0;
      const lostCount = targetData.lostFollowers ? targetData.lostFollowers.length : 0;
      const netFlow = newCount - lostCount;
      const netSign = netFlow > 0 ? "+" : "";
      const netClass = netFlow > 0 ? "is-positive" : netFlow < 0 ? "is-negative" : "is-neutral";
      let html = "";
      html += '<div class="ig-target-overview-header">';
      html += '  <div class="ig-target-overview-avatar-wrap">' + avatarHtml + "</div>";
      html += '  <div class="ig-target-overview-meta">';
      html += '    <div class="ig-target-overview-title-row">';
      html += '      <span class="ig-target-overview-username">@' + safeUser + "</span>";
      if (isVerified) html += '<span title="Verified">' + Icons.verified + "</span>";
      if (isPrivate) html += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + " Private</span>";
      else html += '<span class="ig-badge-pill ig-badge-public">Public</span>';
      if (u.followedByViewer) html += '<span class="ig-badge-pill ig-badge-mutual">You follow</span>';
      if (u.followsViewer) html += '<span class="ig-badge-pill ig-badge-fan">Follows you</span>';
      html += "    </div>";
      if (safeName) html += '    <div class="ig-target-overview-fullname">' + safeName + "</div>";
      html += '    <div class="ig-target-overview-timestamps">Last audited: ' + (targetData.lastAuditAt ? Utils.formatDate(targetData.lastAuditAt) : "Just now") + "</div>";
      html += "  </div>";
      html += "</div>";
      if (isRestricted) {
        html += '<div class="ig-target-restricted-alert">';
        html += '  <div class="ig-target-alert-icon">' + Icons.lock + "</div>";
        html += '  <div class="ig-target-alert-body">';
        html += "    <strong>Private Account Restriction:</strong> Meta restricts network extraction for private accounts you do not follow. Followers and following lists cannot be retrieved. Public header counts and profile updates continue to be tracked below.";
        html += "  </div>";
        html += "</div>";
      }
      html += '<div class="ig-history-kpi-grid" style="margin-top: 14px;">';
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Followers</div>';
      html += '    <div class="ig-kpi-value">' + Utils.formatNumber(followersCount) + "</div>";
      html += '    <div class="ig-kpi-sub ' + (newCount > 0 ? "is-positive" : "") + '">' + Icons.userPlus + " <span>+" + newCount + " new</span></div>";
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Following</div>';
      html += '    <div class="ig-kpi-value">' + Utils.formatNumber(followingCount) + "</div>";
      html += '    <div class="ig-kpi-sub ' + (lostCount > 0 ? "is-negative" : "") + '">' + Icons.unfollowers + " <span>-" + lostCount + " lost</span></div>";
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Mutual Connections</div>';
      html += '    <div class="ig-kpi-value">' + (isRestricted ? "-" : Utils.formatNumber(mutualsCount)) + "</div>";
      html += '    <div class="ig-kpi-sub is-neutral">' + Icons.mutuals + " <span>" + (isRestricted ? "Restricted" : "Internal Mutuals") + "</span></div>";
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Audience Balance</div>';
      html += '    <div class="ig-kpi-value ' + netClass + '">' + (isRestricted ? "0" : netSign + netFlow) + "</div>";
      html += '    <div class="ig-kpi-sub"><span style="color:#22c55e;">+' + newCount + '</span> / <span style="color:#ef4444;">-' + lostCount + "</span></div>";
      html += "  </div>";
      html += "</div>";
      if (Array.isArray(targetData.history) && targetData.history.length > 0) {
        html += '<div class="ig-section-title" style="margin-top: 18px;">Audit History <span class="ig-badge">' + targetData.history.length + "</span></div>";
        html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th><th>Mutuals</th></tr></thead><tbody>';
        targetData.history.slice().reverse().forEach((h) => {
          html += "<tr>";
          html += '<td><span class="ig-table-date">' + Utils.escapeHtml(h.date || "") + "</span></td>";
          html += '<td><span class="ig-metric-value">' + Utils.formatNumber(h.followers) + "</span></td>";
          html += '<td><span class="ig-metric-value">' + Utils.formatNumber(h.following) + "</span></td>";
          html += '<td><span class="ig-metric-value">' + (h.mutuals !== void 0 ? Utils.formatNumber(h.mutuals) : "-") + "</span></td>";
          html += "</tr>";
        });
        html += "</tbody></table>";
      }
      container.innerHTML = html;
    },
    renderTargetLists: (targetData) => {
      if (!targetData) return;
      UI.renderTargetSingleList("ig-target-view-mutuals", targetData.mutuals || [], "Mutual Connections", "No mutual connections found.");
      UI.renderTargetSingleList("ig-target-view-newfollowers", targetData.newFollowers || [], "New Followers Gained", "No new followers detected since last scan.", { isNewBadge: true });
      UI.renderTargetSingleList("ig-target-view-lostfollowers", targetData.lostFollowers || [], "Followers Lost", "No lost followers detected since last scan.", { isLostBadge: true });
      UI.renderTargetSingleList("ig-target-view-followers", targetData.followers || [], "Target Followers", "No followers data available.");
      UI.renderTargetSingleList("ig-target-view-following", targetData.following || [], "Target Following", "No following data available.");
    },
    renderTargetSingleList: (containerId, rawList, title, emptyMsg, options = {}) => {
      const safeList = Array.isArray(rawList) ? rawList : [];
      UI.targetPaginationState[containerId] = {
        rawUsers: safeList,
        users: safeList,
        searchQuery: "",
        title,
        emptyMsg,
        options
      };
      UI.renderTargetSingleListPage(containerId);
    },
    renderTargetSingleListPage: (containerId) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const { rawUsers, users, title, emptyMsg, options, searchQuery } = state;
      const totalRaw = (rawUsers || []).length;
      const totalFiltered = (users || []).length;
      const safeTitle = Utils.escapeHtml(title);
      if (totalRaw === 0) {
        container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>" + Utils.escapeHtml(emptyMsg) + "</div>";
        return;
      }
      let toolbarEl = container.querySelector(".ig-filter-toolbar");
      let listEl = container.querySelector(".ig-view-list");
      if (!toolbarEl) {
        const clearStyle = searchQuery ? "display: inline-flex;" : "display: none;";
        container.innerHTML = [
          '<div class="ig-view-header">',
          '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + (totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : totalRaw) + "</span></div>",
          "</div>",
          '<div class="ig-filter-toolbar">',
          '  <div class="ig-search-box">',
          '    <span class="ig-search-icon">' + Icons.search + "</span>",
          '    <input type="text" class="ig-search-input ig-target-list-search" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || "") + '" autocomplete="off" spellcheck="false" />',
          '    <button type="button" class="ig-search-clear ig-target-list-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + "</button>",
          "  </div>",
          "</div>",
          '<div class="ig-view-list ig-target-inner-list"></div>'
        ].join("\n");
        toolbarEl = container.querySelector(".ig-filter-toolbar");
        listEl = container.querySelector(".ig-view-list");
        const searchInput = toolbarEl.querySelector(".ig-target-list-search");
        const clearBtn = toolbarEl.querySelector(".ig-target-list-clear");
        let searchTimeout = null;
        if (searchInput) {
          searchInput.addEventListener("input", (e) => {
            const val = e.target.value;
            if (clearBtn) clearBtn.style.display = val ? "inline-flex" : "none";
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              state.searchQuery = val;
              const q = val.trim().toLowerCase();
              state.users = q ? state.rawUsers.filter((u) => (u.username || "").toLowerCase().includes(q) || (u.fullName || "").toLowerCase().includes(q)) : state.rawUsers;
              UI.renderTargetSingleListPage(containerId);
            }, 120);
          });
        }
        if (clearBtn && searchInput) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            searchInput.value = "";
            clearBtn.style.display = "none";
            state.searchQuery = "";
            state.users = state.rawUsers;
            UI.renderTargetSingleListPage(containerId);
          });
        }
      } else {
        const headerBadge = container.querySelector(".ig-section-title .ig-badge");
        if (headerBadge) {
          headerBadge.textContent = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;
        }
      }
      let rowsHtml = "";
      if (totalFiltered === 0) {
        rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + "</span>No accounts match your search.</div>";
      } else {
        const displayUsers = users.slice(0, 100);
        displayUsers.forEach((u) => {
          const safeUsername = Utils.escapeHtml(u.username || "");
          const safeUrl = Utils.sanitizeUrl(u.username, u.url);
          const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : "";
          const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
          const avatarHtml = safeAvatarUrl ? '<img class="ig-user-avatar" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" />' : '<span class="ig-user-avatar">' + (safeUsername ? safeUsername.charAt(0).toUpperCase() : "?") + "</span>";
          let badges = "";
          if (u.isPrivate) badges += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + "</span>";
          if (u.isVerified) badges += '<span title="Verified">' + Icons.verified + "</span>";
          if (options.isNewBadge) badges += '<span class="ig-badge-pill ig-badge-new-mutual">' + Icons.sparkles + " New</span>";
          if (options.isLostBadge) badges += '<span class="ig-badge-pill ig-badge-churn">' + Icons.unfollowers + " Lost</span>";
          if (u.isViewerMutual) badges += '<span class="ig-badge-pill ig-badge-new-mutual" title="Shared mutual with you!">' + Icons.sparkles + " Shared Mutual</span>";
          rowsHtml += '<div class="ig-user-row" data-user-id="' + Utils.escapeHtml(u.id || "") + '">';
          rowsHtml += '  <div class="ig-user-info">' + avatarHtml;
          rowsHtml += '    <div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
          rowsHtml += '      <div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
          rowsHtml += '        <span class="ig-username">' + safeUsername + "</span>";
          rowsHtml += '        <span class="ig-user-badges">' + badges + "</span>";
          rowsHtml += "      </div>";
          if (safeFullName) rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + "</span>";
          rowsHtml += "    </div>";
          rowsHtml += "  </div>";
          rowsHtml += '  <div class="ig-user-actions">';
          rowsHtml += '    <a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          rowsHtml += "  </div>";
          rowsHtml += "</div>";
        });
        if (users.length > 100) {
          rowsHtml += '<div style="text-align:center; padding:10px; font-size:11px; color:#94a3b8;">Showing 100 of ' + users.length + " accounts. Filter by search to narrow down.</div>";
        }
      }
      if (listEl) listEl.innerHTML = rowsHtml;
    },
    getTargetActiveList: () => {
      const activeTab = document.querySelector("#ig-target-tabs .ig-tab-btn.active");
      if (!activeTab) return null;
      const targetId = activeTab.getAttribute("data-target");
      if (!targetId || !UI.targetPaginationState[targetId]) return null;
      return UI.targetPaginationState[targetId].users || UI.targetPaginationState[targetId].rawUsers || null;
    },
    renderTargetTrackerMainView: (userId = null) => {
      const container = document.getElementById("ig-view-targettracker");
      if (!container) return;
      const targetMap = Storage.getTargetTrackerMap(userId);
      const targetEntries = Object.values(targetMap || {});
      let html = [
        '<div class="ig-target-search-card">',
        '  <div class="ig-target-search-header">',
        '    <div class="ig-target-search-title"><span class="ig-btn-icon">' + Icons.target + "</span> Target Network Audit</div>",
        '    <div class="ig-target-search-desc">Audit any Instagram account network, discover mutual connections, inspect their audience, and track new or lost followers over time.</div>',
        "  </div>",
        '  <div class="ig-target-search-input-group">',
        '    <span class="ig-input-prefix">@</span>',
        '    <input type="text" id="ig-target-search-input" class="ig-target-input" placeholder="username (e.g. cristiano, friend_account)" autocomplete="off" spellcheck="false" />',
        '    <button id="ig-btn-target-search" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.search + "</span> Audit Account</button>",
        "  </div>",
        '  <div id="ig-target-search-feedback" class="ig-target-feedback" style="display: none;"></div>',
        "</div>",
        '<div class="ig-section-title" style="margin-top: 20px;">',
        '  Monitored Accounts <span class="ig-badge" id="ig-target-monitored-count">' + targetEntries.length + "</span>",
        "</div>",
        '<div id="ig-target-grid" class="ig-target-grid">'
      ].join("\n");
      if (targetEntries.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.target + '</span>No accounts being tracked yet.<br>Enter an @username above or click "Audit" on any user row in Mutuals to start monitoring.</div>';
      } else {
        targetEntries.slice().reverse().forEach((t) => {
          const u = t.user || {};
          const safeUser = Utils.escapeHtml(t.username || u.username || "");
          const safeName = Utils.escapeHtml(u.fullName || "");
          const avatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
          const isVerified = Boolean(u.isVerified);
          const isPrivate = Boolean(u.isPrivate);
          const fCount = Array.isArray(t.followers) && t.followers.length > 0 ? t.followers.length : u.followerCount || 0;
          const ingCount = Array.isArray(t.following) && t.following.length > 0 ? t.following.length : u.followingCount || 0;
          const mutCount = Array.isArray(t.mutuals) && t.mutuals.length > 0 ? t.mutuals.length : typeof u.mutualsCount === "number" ? u.mutualsCount : 0;
          const newCount = t.newFollowers ? t.newFollowers.length : 0;
          const lostCount = t.lostFollowers ? t.lostFollowers.length : 0;
          const netFlow = newCount - lostCount;
          let diffBadge = "";
          if (netFlow > 0) {
            diffBadge = '<span class="ig-target-card-diff is-positive">+' + netFlow + "</span>";
          } else if (netFlow < 0) {
            diffBadge = '<span class="ig-target-card-diff is-negative">' + netFlow + "</span>";
          }
          const avatarHtml = avatarUrl ? '<img class="ig-target-card-avatar" src="' + avatarUrl + '" alt="' + safeUser + '" />' : '<span class="ig-target-card-avatar">' + (safeUser ? safeUser.charAt(0).toUpperCase() : "?") + "</span>";
          const timeStr = t.lastAuditAt ? Utils.formatDate(t.lastAuditAt) : "Recent";
          html += '<div class="ig-target-card" data-username="' + safeUser + '">';
          html += '  <div class="ig-target-card-top">';
          html += "    " + avatarHtml;
          html += '    <div class="ig-target-card-info">';
          html += '      <div class="ig-target-card-name-row">';
          html += '        <span class="ig-target-card-user">@' + safeUser + "</span>";
          if (isVerified) html += '<span title="Verified">' + Icons.verified + "</span>";
          if (isPrivate) html += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + "</span>";
          html += "      </div>";
          if (safeName) html += '      <div class="ig-target-card-fullname">' + safeName + "</div>";
          html += "    </div>";
          html += '    <button class="ig-btn-target-delete btn-target-card-delete" data-username="' + safeUser + '" title="Remove from tracking">' + Icons.trash + "</button>";
          html += "  </div>";
          html += '  <div class="ig-target-card-metrics">';
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Followers</span><span class="ig-target-metric-val">' + Utils.formatNumber(fCount) + " " + diffBadge + "</span></div>";
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Following</span><span class="ig-target-metric-val">' + Utils.formatNumber(ingCount) + "</span></div>";
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Mutuals</span><span class="ig-target-metric-val">' + (t.isRestricted ? "-" : Utils.formatNumber(mutCount)) + "</span></div>";
          html += "  </div>";
          html += '  <div class="ig-target-card-footer">';
          html += '    <span class="ig-target-card-time">' + timeStr + "</span>";
          html += '    <div class="ig-target-card-actions">';
          html += '      <button class="ig-btn ig-btn-sm ig-btn-secondary btn-target-card-open" data-username="' + safeUser + '">' + Icons.target + " View Details</button>";
          html += '      <button class="ig-btn ig-btn-sm ig-btn-primary btn-target-card-refresh" data-username="' + safeUser + '">' + Icons.refresh + " Re-Audit</button>";
          html += "    </div>";
          html += "  </div>";
          html += "</div>";
        });
      }
      html += "</div>";
      container.innerHTML = html;
      const searchBtn = container.querySelector("#ig-btn-target-search");
      const searchInput = container.querySelector("#ig-target-search-input");
      if (searchBtn) {
        searchBtn.onclick = (e) => {
          e.preventDefault();
          if (window.App?.handleTargetSearch) window.App.handleTargetSearch();
        };
      }
      if (searchInput) {
        searchInput.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (window.App?.handleTargetSearch) window.App.handleTargetSearch();
          }
        };
      }
    }
  };
  const App = {
    isRunning: false,
    abortController: null,
    lastResults: null,
    abort: () => {
      if (App.isRunning && App.abortController) {
        UI.setStatus("Cancelling...");
        UI.setRunButtonState("cancelling");
        try {
          UI.log("[INFO] Analysis cancellation requested by user...");
        } catch (err) {
          console.log("[INFO] Analysis cancellation requested by user...");
        }
        App.abortController.abort();
      }
    },
    run: async () => {
      if (App.isRunning) {
        App.abort();
        return;
      }
      const userConfirmed = await UI.confirmAction(
        "Safety Precaution",
        "Excessive use of automation tools may result in temporary account restrictions.<br><br>It is recommended to run this analysis <b>only once per hour</b>.",
        "Yes, Continue"
      );
      if (!userConfirmed) {
        UI.log("Analysis cancelled by user.");
        console.log("Analysis cancelled by user.");
        return;
      }
      App.isRunning = true;
      App.abortController = new AbortController();
      const signal = App.abortController.signal;
      UI.setRunButtonState("running");
      UI.setStatus("Analyzing...");
      try {
        UI.log("Starting deep analysis...");
        const logTab = document.querySelector('[data-target="ig-log"]');
        if (logTab) logTab.click();
        const userId = await Utils.getUserIdAsync(signal);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        if (!userId || userId === "0") throw new Error("User ID could not be obtained. Are you logged in?");
        Storage.setCurrentUserId(userId);
        UI.log("User ID detected: " + userId);
        let userInfo = null;
        try {
          userInfo = await API.getUserInfo(userId, { signal });
          if (userInfo) {
            const infoStr = `@${userInfo.username || userId} (${userInfo.followerCount} followers, ${userInfo.followingCount} following)`;
            UI.log("Target profile: " + infoStr);
          }
        } catch (e) {
          if (signal.aborted) throw e;
          console.warn("[IG Analyzer] Could not fetch user profile info:", e);
        }
        const expectedFollowing = userInfo?.followingCount || 0;
        const expectedFollowers = userInfo?.followerCount || 0;
        UI.log("Fetching 'Following'...");
        const followingDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following", { signal }, expectedFollowing);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        UI.log("Fetching 'Followers'...");
        const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers", { signal }, expectedFollowers);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        const followingDetailed = Utils.toDetailedUserArray(followingDetailedRaw);
        const followersDetailed = Utils.toDetailedUserArray(followersDetailedRaw);
        const following = followingDetailed.map((u) => u.username);
        const followers = followersDetailed.map((u) => u.username);
        UI.hideProgress();
        UI.setStatus("Calculating Metrics...");
        Storage.addHistoryEntry(followers.length, following.length);
        UI.renderHistory(Storage.getHistory());
        const notFollowingBackUsernames = Utils.diff(following, followers);
        const fansUsernames = Utils.diff(followers, following);
        const mutualsUsernames = Utils.intersection(followers, following);
        const whitelist = Storage.getWhitelist();
        const filteredNotFollowing = notFollowingBackUsernames.filter((u) => !whitelist.includes(u));
        const allUsersMap = new Map();
        [...followingDetailed, ...followersDetailed].forEach((u) => {
          if (u?.username) allUsersMap.set(u.username, u);
        });
        const mapToDetailed = (arr) => arr.map((u) => {
          const userObj = allUsersMap.get(u) || {};
          return {
            ...userObj,
            username: u,
            url: "https://www.instagram.com/" + u + "/"
          };
        });
        const notFollowingBackDetailed = mapToDetailed(filteredNotFollowing);
        const fansDetailed = mapToDetailed(fansUsernames);
        const mutualsDetailed = mapToDetailed(mutualsUsernames);
        UI.log("Not Following Back (filtered): " + notFollowingBackDetailed.length);
        UI.log("Fans: " + fansDetailed.length);
        UI.log("Mutuals: " + mutualsDetailed.length);
        const prev = Storage.load();
        if (prev) {
          const prevFollowersDetailed = Utils.toDetailedUserArray(
            Array.isArray(prev.followersDetailed) ? prev.followersDetailed : prev.followers || []
          );
          const prevFollowingDetailed = Utils.toDetailedUserArray(
            Array.isArray(prev.followingDetailed) ? prev.followingDetailed : prev.following || []
          );
          const prevFollowers = prevFollowersDetailed.map((u) => u.username);
          const prevFollowing = prevFollowingDetailed.map((u) => u.username);
          const newFollowers = Utils.diff(followers, prevFollowers);
          UI.log("New followers since last run: " + newFollowers.length);
          const newFollowersDetailed = mapToDetailed(newFollowers).map((u) => ({
            ...u,
            followsBack: following.includes(u.username),
            date: Utils.now().split("T")[0]
          }));
          if (newFollowersDetailed.length > 0) {
            Storage.addNewFollowersEntries(newFollowersDetailed);
          }
          const lostFollowers = Utils.diff(prevFollowers, followers);
          const lostFollowing = Utils.diff(prevFollowing, following);
          const missingUsers = Utils.intersection(lostFollowers, lostFollowing);
          const prevMutualsDetailed = Utils.intersectionById(prevFollowersDetailed, prevFollowingDetailed);
          const currMutualsDetailed = Utils.intersectionById(followersDetailed, followingDetailed);
          const renamedEntries = Utils.detectRenamedMutuals(prevMutualsDetailed, currMutualsDetailed);
          const renamedOldUsernameSet = new Set(renamedEntries.map((r) => r.oldUsername));
          if (renamedEntries.length > 0) {
            Storage.addRenamedEntries(renamedEntries);
            UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
            UI.log("Detected " + renamedEntries.length + " confirmed username change(s) in mutuals.");
          }
          const newDeactivated = [];
          const newBlocked = [];
          const newUnfollowers = [];
          const filteredLostFollowers = lostFollowers.filter((u) => !renamedOldUsernameSet.has(u));
          const filteredMissingUsers = missingUsers.filter((u) => !renamedOldUsernameSet.has(u));
          const ordinaryUnfollowers = filteredLostFollowers.filter((u) => !filteredMissingUsers.includes(u));
          if (ordinaryUnfollowers.length > 0) {
            newUnfollowers.push(...ordinaryUnfollowers);
          }
          const maxVerify = CONFIG.MAX_AUTO_VERIFY_ACCOUNTS || 5;
          const accountsToVerify = filteredMissingUsers.slice(0, maxVerify);
          const unverifiedMissing = filteredMissingUsers.slice(maxVerify);
          if (unverifiedMissing.length > 0) {
            newUnfollowers.push(...unverifiedMissing);
          }
          if (accountsToVerify.length > 0) {
            UI.setStatus(`Verifying ${accountsToVerify.length} suspicious account(s)...`);
            for (let i = 0; i < accountsToVerify.length; i++) {
              if (signal.aborted) throw new DOMException("Aborted", "AbortError");
              const username = accountsToVerify[i];
              UI.setProgress(i + 1, accountsToVerify.length, `Verifying status (${i + 1}/${accountsToVerify.length}): @${username}`);
              const status = await API.checkAccountStatus(username, { signal });
              if (status === "Deactivated") {
                newDeactivated.push(username);
              } else if (status === "Blocked") {
                newBlocked.push(username);
              } else if (status === "Active") {
                newUnfollowers.push(username);
                let currentBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY);
                if (currentBlocked.some((b) => b.username === username)) {
                  currentBlocked = currentBlocked.filter((b) => b.username !== username);
                  Storage.setScopedValue(CONFIG.BLOCKED_KEY, currentBlocked);
                  UI.renderNominalList(currentBlocked, "ig-view-blocked", "Blocked Accounts");
                }
              } else {
                Utils.logError(
                  `Unexpected status "${status}" from checkAccountStatus for user "${username}"`,
                  null
                );
                newUnfollowers.push(username);
              }
              if (i < accountsToVerify.length - 1) {
                await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS, signal);
              }
            }
            UI.hideProgress();
          }
          if (newUnfollowers.length > 0) {
            UI.log("Identified " + newUnfollowers.length + " new unfollower(s).");
            Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers);
          }
          if (newDeactivated.length > 0) {
            UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
            Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated);
          }
          if (newBlocked.length > 0) {
            UI.log("Identified " + newBlocked.length + " account(s) that blocked you.");
            Storage.addNominalEntries(CONFIG.BLOCKED_KEY, newBlocked);
          }
          const activeHandles = new Set([...following, ...followers]);
          let storedBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY);
          const cleanedBlocked = storedBlocked.filter((b) => !activeHandles.has(b.username));
          if (cleanedBlocked.length !== storedBlocked.length) {
            Storage.setScopedValue(CONFIG.BLOCKED_KEY, cleanedBlocked);
            UI.renderNominalList(cleanedBlocked, "ig-view-blocked", "Blocked Accounts");
          }
        } else {
          UI.log("First run: Initial state established.");
        }
        Storage.save({
          version: 4,
          lastRun: Utils.now(),
          followers,
          following,
          followersDetailed,
          followingDetailed,
          notFollowingBackDetailed,
          fansDetailed,
          mutualsDetailed,
          newFollowersDetailed: Storage.getNewFollowersList(),
          whitelist: Storage.getWhitelist(),
          unfollowers: Storage.getNominalList(CONFIG.CHURN_KEY),
          deactivated: Storage.getNominalList(CONFIG.DEACTIVATED_KEY),
          blocked: Storage.getNominalList(CONFIG.BLOCKED_KEY),
          renamed: Storage.getNominalList(CONFIG.RENAMED_KEY),
          history: Storage.getHistory()
        });
        UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
        UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
        UI.renderNewFollowers(Storage.getNewFollowersList());
        UI.renderWhitelist(Storage.getWhitelist());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
        UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
        UI.renderPersistedSnapshot(Storage.load());
        App.lastResults = notFollowingBackDetailed;
        window.__igLastResults = notFollowingBackDetailed;
        UI.setStatus("Completed");
        UI.log("[OK] Analysis completed successfully.");
      } catch (e) {
        UI.hideProgress();
        if (e.name === "AbortError" || signal?.aborted) {
          UI.setStatus("Cancelled");
          UI.log("[INFO] Analysis cancelled by user.");
        } else {
          UI.setStatus("Error");
          UI.log("[ERROR] Analysis failed: " + (e.message || String(e)));
          Utils.logError("Failed analysis", e);
        }
      } finally {
        App.isRunning = false;
        App.abortController = null;
        UI.setRunButtonState("idle");
      }
    },
    runStorySpy: async (username, btnElement, targetUserId = null) => {
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      const safeUsername = Utils.escapeHtml(cleanUser);
      let resolvedUserId = targetUserId && String(targetUserId) !== "0" && String(targetUserId) !== "null" ? String(targetUserId) : btnElement?.getAttribute("data-user-id") || null;
      if (btnElement) {
        if (btnElement.disabled) return;
        btnElement.disabled = true;
        btnElement.innerHTML = `<span style="opacity:0.8; display:inline-flex; align-items:center; gap:4px;">${Icons.spy} Scanning...</span>`;
      }
      try {
        UI.log(`[Story Spy] Checking story & highlight visibility for @${cleanUser}...`);
        const status = await API.checkStoryStatus(cleanUser, resolvedUserId);
        if (!status) {
          await UI.confirmAction("Error", `Could not fetch data for @${safeUsername}. The profile might be unavailable or network connection failed.`, "Close", false);
          return;
        }
        const history = Storage.getStoryObservations(cleanUser);
        const previous = history.length > 0 ? history[history.length - 1] : null;
        let probability = 0;
        let reason = "";
        let anomalyBadge = "Normal";
        if (status.isGated) {
          probability = 95;
          anomalyBadge = "Gated Access";
          reason = "Meta's API returned a restricted/gated state (<code>latest_reel_media: null</code>) for your account session. You are restricted or hidden from viewing this user's stories.";
        } else if (!status.isPrivate && (status.anonHighlightsCount > 0 || status.anonHasStory) && (status.authHighlightsCount === 0 && !status.authHasStory)) {
          probability = 100;
          anomalyBadge = "Confirmed Hiding";
          reason = `Confirmed: Highlights (${status.anonHighlightsCount}) or active stories are publicly visible to anonymous guest visitors, but completely hidden from your logged-in account (0 highlights). This user is actively hiding stories from you.`;
        } else if (status.authHighlightsCount > 0 || status.authHasStory) {
          probability = 0;
          anomalyBadge = "Normal Visibility";
          const visibleItems = [];
          if (status.authHighlightsCount > 0) visibleItems.push(`<b>${status.authHighlightsCount} highlight(s)</b>`);
          if (status.isBestieStory) visibleItems.push("a <b>Close Friends Story</b> (green ring)");
          else if (status.authHasStory) visibleItems.push("an <b>Active Story</b>");
          reason = `Normal visibility: Your account can see ${visibleItems.join(" and ")}. No story or highlight hiding detected.`;
        } else if (previous) {
          const prevHighlights = previous.highlightsCount || previous.highlights || 0;
          const prevStory = Boolean(previous.hasStory || previous.latestReelMedia && previous.latestReelMedia > 0);
          const prevReelMedia = previous.latestReelMedia ? Number(previous.latestReelMedia) : 0;
          const nowSeconds = Math.floor(Date.now() / 1e3);
          const storyAgeSeconds = prevReelMedia > 0 ? nowSeconds - prevReelMedia : null;
          const isStoryUnexpired = storyAgeSeconds !== null && storyAgeSeconds >= 0 && storyAgeSeconds < 86400;
          if (prevHighlights > 0 && prevStory && isStoryUnexpired) {
            probability = 95;
            anomalyBadge = "Critical Anomaly";
            const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
            reason = `<b>Critical Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b> and an active story posted ~${hoursAgo}h ago. In this scan, <b>both the highlights and the story vanished simultaneously</b> (0 highlights, 0 stories). When an Instagram user hides stories from you, Meta instantly strips both active stories and highlights from your account feed.`;
          } else if (prevHighlights > 0) {
            probability = 90;
            anomalyBadge = "Highlights Vanished";
            const prevTitles = previous.highlightTitles?.length ? ` (e.g. <i>"${previous.highlightTitles.slice(0, 3).map((t) => Utils.escapeHtml(t)).join('", "')}"</i>)` : "";
            reason = `<b>High Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b>${prevTitles}. In this scan, 0 highlights were returned. Highlights do not expire after 24 hours. Unless the user deleted or archived all their highlights, they have hidden their stories and highlights from you.`;
          } else if (prevStory && isStoryUnexpired) {
            probability = 80;
            anomalyBadge = "Story Vanished Early";
            const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
            reason = `<b>Anomaly Detected:</b> An active story posted ~${hoursAgo}h ago is no longer visible to your account (stories last 24h). The user either deleted the story manually or hid their stories from you.`;
          } else {
            probability = 0;
            anomalyBadge = "No Content";
            reason = "No active stories or highlights currently detected for this account. Both previous and current scans show 0.";
          }
        } else {
          probability = 0;
          anomalyBadge = "Baseline Recorded";
          reason = `First scan baseline recorded: 0 highlights and no active stories currently visible. If this user posts stories or has highlights you should see, future scans will alert you immediately if discrepancies occur.`;
        }
        Storage.addStoryObservation(cleanUser, {
          highlightsCount: status.authHighlightsCount,
          latestReelMedia: status.latestReelMedia,
          latestBestiesReelMedia: status.latestBestiesReelMedia,
          hasStory: status.authHasStory,
          isBestieStory: status.isBestieStory,
          isPrivate: status.isPrivate,
          highlightTitles: (status.authHighlights || []).map((h) => h.title)
        });
        const updatedHistory = Storage.getStoryObservations(cleanUser);
        let statusColor = "#10b981";
        let badgeBg = "rgba(16, 185, 129, 0.14)";
        let badgeBorder = "rgba(16, 185, 129, 0.3)";
        if (probability >= 75) {
          statusColor = "#ef4444";
          badgeBg = "rgba(239, 68, 68, 0.14)";
          badgeBorder = "rgba(239, 68, 68, 0.3)";
        } else if (probability > 0) {
          statusColor = "#f59e0b";
          badgeBg = "rgba(245, 158, 11, 0.14)";
          badgeBorder = "rgba(245, 158, 11, 0.3)";
        }
        let storyStatusText = "None active";
        if (status.isGated) {
          storyStatusText = '<span style="color:#ef4444; font-weight:600;">Gated / Restricted</span>';
        } else if (status.isBestieStory) {
          storyStatusText = '<span style="color:#10b981; font-weight:600;">Close Friends Story (Active)</span>';
        } else if (status.authHasStory) {
          const nowSec = Math.floor(Date.now() / 1e3);
          const ageSec = nowSec - (status.latestReelMedia || nowSec);
          const ageHours = Math.max(0, Math.floor(ageSec / 3600));
          const ageMins = Math.max(0, Math.floor(ageSec % 3600 / 60));
          const timeStr = ageHours > 0 ? `${ageHours}h ${ageMins}m ago` : `${ageMins}m ago`;
          storyStatusText = `<span style="color:#3b82f6; font-weight:600;">Active Story (Posted ~${timeStr})</span>`;
        }
        let historyHtml = "";
        if (updatedHistory.length > 1) {
          const recentScans = updatedHistory.slice(-4).reverse();
          historyHtml = `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); text-align: left;">
                        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                            Scan History Timeline (${updatedHistory.length} recorded)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${recentScans.map((obs, idx) => {
          const isCurrent = idx === 0;
          const dateStr = (obs.timestamp || "").split("T")[1]?.slice(0, 5) || "Scan";
          const hCount = obs.highlightsCount ?? obs.highlights ?? 0;
          const hasS = obs.hasStory || obs.latestReelMedia && obs.latestReelMedia > 0;
          return `
                                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 5px 8px; border-radius: 6px; background: ${isCurrent ? "rgba(255,255,255,0.05)" : "transparent"}; border: 1px solid ${isCurrent ? "rgba(255,255,255,0.1)" : "transparent"};">
                                        <span style="color: ${isCurrent ? "#f8fafc" : "#94a3b8"}; font-weight: ${isCurrent ? "600" : "400"};">
                                            ${isCurrent ? "● Current" : `○ ${dateStr}`}
                                        </span>
                                        <span style="color: #cbd5e1;">
                                            ${hCount} highlights · ${hasS ? "Story Active" : "No Story"}
                                        </span>
                                    </div>
                                `;
        }).join("")}
                        </div>
                    </div>
                `;
        }
        const targetType = status.isPrivate ? "Private Account" : "Public Account";
        const highlightsDetail = status.authHighlightsCount > 0 ? `<b style="color:#10b981;">${status.authHighlightsCount} visible</b>` : '<span style="color:#94a3b8;">0 detected</span>';
        const resultHtml = `
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${badgeBg}; color: ${statusColor}; border: 1px solid ${badgeBorder}; margin-bottom: 10px;">
                        ${anomalyBadge}
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: ${statusColor}; letter-spacing: -1px; line-height: 1;">
                        ${probability}%
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        Story Hiding Probability
                    </div>
                </div>

                <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); text-align: left; margin-bottom: 14px;">
                    ${reason}
                </div>

                <div style="background: rgba(255, 255, 255, 0.03); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Target Profile:</span>
                        <span style="color: #f8fafc; font-weight: 600;">@${safeUsername} (${targetType})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Highlights (Tray):</span>
                        <span>${highlightsDetail}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; ${!status.isPrivate ? "border-bottom: 1px solid rgba(255,255,255,0.05);" : ""}">
                        <span style="color: #94a3b8;">Active Story:</span>
                        <span>${storyStatusText}</span>
                    </div>
                    ${!status.isPrivate ? `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                        <span style="color: #94a3b8;">Guest Session (Anon):</span>
                        <span style="color: #cbd5e1;">${status.anonHighlightsCount} highlights</span>
                    </div>` : ""}
                </div>

                ${historyHtml}
            `;
        UI.log(`[Story Spy] @${cleanUser}: ${probability}% anomaly probability (${status.isPrivate ? "Private" : "Public"}).`);
        await UI.confirmAction(`Story Spy: @${safeUsername}`, resultHtml, "Close", false, Icons.spy);
      } catch (e) {
        Utils.logError("Error in runStorySpy", e);
        await UI.confirmAction("Error", "An unexpected error occurred while checking story visibility.", "Close", false);
      } finally {
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = `${Icons.spy} Check Story`;
        }
      }
    },
    targetRunning: false,
    targetAbortController: null,
    abortTargetAudit: () => {
      if (App.targetRunning && App.targetAbortController) {
        UI.setTargetStatus("Cancelling...");
        UI.setTargetRunButtonState("cancelling");
        try {
          UI.targetLog("[INFO] Target audit cancellation requested by user...");
        } catch (e) {
        }
        App.targetAbortController.abort();
      }
    },
    openTargetAudit: async (username, userId = null, forceRefresh = false) => {
      const cleanUser = String(username || "").replace(/^@+\s*/, "").trim().replace(/\s+/g, "");
      if (!cleanUser) return;
      const stored = Storage.getTargetData(cleanUser);
      const stubUser = stored?.user || {
        username: cleanUser,
        id: userId || null
      };
      UI.openTargetSubpanel(stubUser, stored);
      if (forceRefresh || !stored) {
        await App.runTargetAudit(stubUser, forceRefresh);
      }
    },
    runTargetAudit: async (targetUserObj, forceRefresh = false) => {
      if (App.targetRunning) {
        App.abortTargetAudit();
        return;
      }
      const cleanUser = String(targetUserObj?.username || "").replace(/^@+\s*/, "").trim().replace(/\s+/g, "");
      if (!cleanUser) {
        UI.targetLog("[ERROR] Invalid target username.");
        return;
      }
      App.targetRunning = true;
      App.targetAbortController = new AbortController();
      const signal = App.targetAbortController.signal;
      UI.setTargetRunButtonState("running");
      UI.setTargetStatus("Validating...");
      UI.targetLog(`[Audit Start] Initializing audit for @${cleanUser}...`);
      const logsTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-logs"]');
      if (logsTab) logsTab.click();
      try {
        const valRes = await API.validateTargetAccount(cleanUser, { signal, userId: targetUserObj?.id });
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        if (!valRes || !valRes.exists || !valRes.user) {
          const errMsg = valRes?.error || `Account @${cleanUser} does not exist on Instagram.`;
          UI.targetLog(`[ERROR] ${errMsg}`);
          UI.setTargetStatus("Not Found");
          const searchFeedback = document.getElementById("ig-target-search-feedback");
          if (searchFeedback) {
            searchFeedback.style.display = "block";
            searchFeedback.className = "ig-target-feedback is-error";
            searchFeedback.textContent = errMsg;
          }
          await UI.confirmAction("Target Not Found", Utils.escapeHtml(errMsg), "Close", false, Icons.warning);
          return;
        }
        const validatedUser = valRes.user;
        UI.currentTargetUser = validatedUser;
        const titleEl = document.getElementById("ig-target-header-title");
        if (titleEl) {
          titleEl.innerHTML = "@" + Utils.escapeHtml(validatedUser.username) + (validatedUser.isVerified ? " " + Icons.verified : "");
        }
        const summaryBar = document.getElementById("ig-target-meta-summary");
        if (summaryBar) {
          let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + "</span>";
          if (validatedUser.fullName) {
            summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + "</span>";
          }
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + " followers</span>";
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + " following</span>";
          summaryBar.innerHTML = summaryHtml;
        }
        const prevData = Storage.getTargetData(validatedUser.username) || {};
        const isRestricted = validatedUser.isPrivate && !validatedUser.followedByViewer;
        if (isRestricted) {
          UI.targetLog(`[Privacy Notice] @${validatedUser.username} is a private account not followed by you. Network extraction is restricted by Meta.`);
          UI.targetLog(`[Metrics] Recorded public counts: ${validatedUser.followerCount} followers, ${validatedUser.followingCount} following.`);
          const todayStr2 = Utils.now().split("T")[0];
          const history2 = Array.isArray(prevData.history) ? [...prevData.history] : [];
          const existHistIdx2 = history2.findIndex((h) => h.date === todayStr2);
          if (existHistIdx2 > -1) {
            history2[existHistIdx2] = { date: todayStr2, followers: validatedUser.followerCount, following: validatedUser.followingCount };
          } else {
            history2.push({ date: todayStr2, followers: validatedUser.followerCount, following: validatedUser.followingCount });
          }
          const targetData2 = {
            user: validatedUser,
            username: validatedUser.username,
            isRestricted: true,
            followers: [],
            following: [],
            mutuals: [],
            newFollowers: [],
            lostFollowers: [],
            history: history2,
            lastAuditAt: Utils.now()
          };
          Storage.saveTargetData(validatedUser.username, targetData2);
          UI.renderTargetOverview(targetData2);
          UI.renderTargetLists(targetData2);
          UI.renderTargetTrackerMainView();
          UI.setTargetStatus("Completed (Restricted)");
          UI.targetLog(`[Audit Finished] Saved profile summary for @${validatedUser.username}.`);
          const overviewTab2 = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
          if (overviewTab2) overviewTab2.click();
          return;
        }
        const userConfirmed = await UI.confirmAction(
          "Target Network Audit",
          `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br><br>Network extraction will query their audience with safe anti-detection pacing. Proceed with network extraction?`,
          "Yes, Extract Network",
          true,
          Icons.target
        );
        if (!userConfirmed) {
          UI.targetLog("[INFO] Extraction skipped by user. Saved profile metrics.");
          const todayStr2 = Utils.now().split("T")[0];
          const history2 = Array.isArray(prevData.history) ? [...prevData.history] : [];
          const existHistIdx2 = history2.findIndex((h) => h.date === todayStr2);
          if (existHistIdx2 > -1) {
            history2[existHistIdx2] = { date: todayStr2, followers: validatedUser.followerCount, following: validatedUser.followingCount };
          } else {
            history2.push({ date: todayStr2, followers: validatedUser.followerCount, following: validatedUser.followingCount });
          }
          const targetData2 = {
            user: validatedUser,
            username: validatedUser.username,
            isRestricted: false,
            followers: prevData.followers || [],
            following: prevData.following || [],
            mutuals: prevData.mutuals || [],
            newFollowers: prevData.newFollowers || [],
            lostFollowers: prevData.lostFollowers || [],
            history: history2,
            lastAuditAt: Utils.now()
          };
          Storage.saveTargetData(validatedUser.username, targetData2);
          UI.renderTargetOverview(targetData2);
          UI.renderTargetLists(targetData2);
          UI.renderTargetTrackerMainView();
          UI.setTargetStatus("Profile Saved");
          const overviewTab2 = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
          if (overviewTab2) overviewTab2.click();
          return;
        }
        UI.setTargetStatus("Extracting Network...");
        const network = await API.fetchTargetNetwork(
          validatedUser,
          { signal },
          (curr, total, label) => UI.setTargetProgress(curr, total, label),
          (msg) => UI.targetLog(msg)
        );
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        UI.hideTargetProgress();
        UI.setTargetStatus("Calculating Diffs...");
        UI.targetLog("[Diffing] Calculating changes and mutual connections...");
        const currentFollowerNames = network.followers.map((u) => u.username);
        const currentFollowingNames = network.following.map((u) => u.username);
        const prevFollowerNames = (prevData.followers || []).map((u) => typeof u === "string" ? u : u.username);
        const prevFollowingNames = (prevData.following || []).map((u) => typeof u === "string" ? u : u.username);
        let newFollowersDetailed = [];
        let lostFollowersDetailed = [];
        if (prevData && prevFollowerNames.length > 0) {
          const newFollowersNames = Utils.diff(currentFollowerNames, prevFollowerNames);
          const lostFollowersNames = Utils.diff(prevFollowerNames, currentFollowerNames);
          const currentFollowersMap = new Map();
          network.followers.forEach((u) => currentFollowersMap.set(u.username, u));
          const prevFollowersMap = new Map();
          (prevData.followers || []).forEach((u) => {
            if (u?.username) prevFollowersMap.set(u.username, u);
          });
          newFollowersDetailed = newFollowersNames.map((name) => currentFollowersMap.get(name) || {
            username: name,
            url: `https://www.instagram.com/${name}/`
          });
          lostFollowersDetailed = lostFollowersNames.map((name) => prevFollowersMap.get(name) || {
            username: name,
            url: `https://www.instagram.com/${name}/`
          });
          UI.targetLog(`[Diff Results] Gained: +${newFollowersDetailed.length} followers | Lost: -${lostFollowersDetailed.length} followers.`);
        } else {
          UI.targetLog("[Diff Results] Initial baseline recorded for @" + validatedUser.username + ".");
        }
        const viewerSnapshot = Storage.load();
        if (viewerSnapshot && Array.isArray(viewerSnapshot.followers) && Array.isArray(viewerSnapshot.following)) {
          const viewerFollowers = new Set(viewerSnapshot.followers);
          const viewerFollowing = new Set(viewerSnapshot.following);
          network.mutuals.forEach((m) => {
            m.isViewerMutual = viewerFollowers.has(m.username) && viewerFollowing.has(m.username);
          });
        }
        const todayStr = Utils.now().split("T")[0];
        const history = Array.isArray(prevData.history) ? [...prevData.history] : [];
        const existHistIdx = history.findIndex((h) => h.date === todayStr);
        const histEntry = {
          date: todayStr,
          followers: network.followers.length,
          following: network.following.length,
          mutuals: network.mutuals.length
        };
        if (existHistIdx > -1) {
          history[existHistIdx] = histEntry;
        } else {
          history.push(histEntry);
        }
        if (Array.isArray(network.followers) && network.followers.length > 0) {
          validatedUser.followerCount = Math.max(validatedUser.followerCount || 0, network.followers.length);
        }
        if (Array.isArray(network.following) && network.following.length > 0) {
          validatedUser.followingCount = Math.max(validatedUser.followingCount || 0, network.following.length);
        }
        const targetData = {
          user: validatedUser,
          username: validatedUser.username,
          isRestricted: false,
          followers: network.followers,
          following: network.following,
          mutuals: network.mutuals,
          newFollowers: newFollowersDetailed,
          lostFollowers: lostFollowersDetailed,
          history,
          lastAuditAt: Utils.now()
        };
        Storage.saveTargetData(validatedUser.username, targetData);
        const finalSummaryBar = document.getElementById("ig-target-meta-summary");
        if (finalSummaryBar) {
          let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + "</span>";
          if (validatedUser.fullName) {
            summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + "</span>";
          }
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + " followers</span>";
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + " following</span>";
          finalSummaryBar.innerHTML = summaryHtml;
        }
        UI.renderTargetOverview(targetData);
        UI.renderTargetLists(targetData);
        UI.renderTargetTrackerMainView();
        UI.targetLog(`[Audit Finished] Successfully audited @${validatedUser.username} (${network.followers.length} followers, ${network.following.length} following, ${network.mutuals.length} mutuals).`);
        UI.setTargetStatus("Audit Completed");
        const overviewTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
        if (overviewTab) overviewTab.click();
      } catch (err) {
        if (err.name === "AbortError" || signal.aborted) {
          UI.targetLog("[INFO] Target audit cancelled by user.");
          UI.setTargetStatus("Cancelled");
        } else {
          Utils.logError("Error in runTargetAudit", err);
          UI.targetLog(`[ERROR] Target audit failed: ${err.message || "Unknown error"}`);
          UI.setTargetStatus("Error");
        }
      } finally {
        UI.hideTargetProgress();
        UI.setTargetRunButtonState("idle");
        App.targetRunning = false;
        App.targetAbortController = null;
      }
    },
    bindEvents: () => {
      const btnRun = document.getElementById("ig-run");
      if (btnRun) btnRun.onclick = App.run;
      const btnExport = document.getElementById("ig-export-csv");
      if (btnExport) btnExport.onclick = () => {
        const activeUsers = typeof UI.getActiveViewUsers === "function" ? UI.getActiveViewUsers() : null;
        const resultsToExport = activeUsers && activeUsers.length > 0 ? activeUsers : App.lastResults || window.__igLastResults;
        if (resultsToExport && resultsToExport.length > 0) {
          const dateStr = Utils.now().split("T")[0];
          Utils.exportCSV(resultsToExport, "ig_analysis_" + dateStr + ".csv");
          UI.log("CSV Exported (" + resultsToExport.length + " accounts).");
        }
      };
      const btnReset = document.getElementById("ig-reset");
      if (btnReset) {
        btnReset.onclick = async () => {
          const confirmed = await UI.confirmAction(
            "Delete All Data",
            "This action will wipe all your history, logs, and whitelists.<br><br>Are you sure you want to proceed?",
            "Yes, Delete"
          );
          if (confirmed) {
            Storage.resetAll();
            if (typeof API.clearFriendshipCache === "function") {
              API.clearFriendshipCache();
            }
            UI.log("[INFO] Data reset.");
            const mainPanel = document.getElementById("ig-analyzer-panel");
            if (mainPanel) {
              mainPanel.querySelectorAll(".ig-view-container").forEach((el) => {
                if (el.id !== "ig-log") el.innerHTML = "";
              });
            }
            if (btnExport) btnExport.disabled = true;
          }
        };
      }
      const panel = document.getElementById("ig-analyzer-panel");
      if (panel) {
        panel.addEventListener("click", async (e) => {
          const btnSpy = e.target.closest(".btn-spy-story, .ig-btn-spy-story");
          if (btnSpy) {
            e.preventDefault();
            e.stopPropagation();
            if (btnSpy.disabled) return;
            const username = btnSpy.getAttribute("data-user");
            const userId = btnSpy.getAttribute("data-user-id");
            if (!username) return;
            await App.runStorySpy(username, btnSpy, userId);
            return;
          }
          const inspectTrigger = e.target.closest(".ig-user-avatar-trigger, .btn-inspect-user, .ig-btn-inspect-user");
          if (inspectTrigger) {
            e.preventDefault();
            e.stopPropagation();
            const userId = inspectTrigger.getAttribute("data-user-id");
            const username = inspectTrigger.getAttribute("data-username");
            const containerId = inspectTrigger.getAttribute("data-container");
            let userObj = null;
            if (containerId && UI.paginationState[containerId]?.rawUsers) {
              userObj = UI.paginationState[containerId].rawUsers.find(
                (u) => userId && String(u.id) === String(userId) || u.username === username
              );
            }
            if (!userObj) {
              userObj = { id: userId, username };
            }
            if (containerId) {
              userObj.containerId = containerId;
            }
            UI.openHdPhotoModal(userObj);
            return;
          }
          const btnWl = e.target.closest(".btn-whitelist, .ig-btn-whitelist");
          if (btnWl) {
            e.preventDefault();
            e.stopPropagation();
            if (btnWl.disabled) return;
            const targetUser = btnWl.getAttribute("data-user");
            const containerId = btnWl.getAttribute("data-container");
            if (!targetUser) return;
            btnWl.disabled = true;
            Storage.addToWhitelist(targetUser);
            UI.log("[INFO] " + targetUser + " added to whitelist.");
            UI.renderWhitelist(Storage.getWhitelist());
            if (App.lastResults) {
              App.lastResults = App.lastResults.filter((u) => u.username !== targetUser);
            }
            if (window.__igLastResults) {
              window.__igLastResults = window.__igLastResults.filter((u) => u.username !== targetUser);
              const exportBtn = document.getElementById("ig-export-csv");
              if (exportBtn) exportBtn.disabled = window.__igLastResults.length === 0;
            }
            const row = btnWl.closest(".ig-user-row");
            if (row) {
              row.classList.add("ig-row-slide-out");
              setTimeout(() => {
                if (containerId && typeof UI.removeUserFromResults === "function") {
                  UI.removeUserFromResults(containerId, targetUser);
                } else if (containerId && UI.paginationState[containerId]) {
                  UI.paginationState[containerId].users = UI.paginationState[containerId].users.filter((u) => u.username !== targetUser);
                  UI.renderResultsPage(containerId);
                }
              }, 280);
            } else if (containerId && typeof UI.removeUserFromResults === "function") {
              UI.removeUserFromResults(containerId, targetUser);
            } else if (containerId && UI.paginationState[containerId]) {
              UI.paginationState[containerId].users = UI.paginationState[containerId].users.filter((u) => u.username !== targetUser);
              UI.renderResultsPage(containerId);
            }
            return;
          }
          const btnUnwl = e.target.closest(".btn-unwhitelist, .ig-btn-unwhitelist");
          if (btnUnwl) {
            e.preventDefault();
            e.stopPropagation();
            if (btnUnwl.disabled) return;
            const targetUser = btnUnwl.getAttribute("data-user");
            if (!targetUser) return;
            btnUnwl.disabled = true;
            Storage.removeFromWhitelist(targetUser);
            UI.log("[INFO] @" + targetUser + " restored from whitelist.");
            const row = btnUnwl.closest(".ig-user-row");
            if (row) {
              row.classList.add("ig-row-slide-out");
              setTimeout(() => {
                UI.renderWhitelist(Storage.getWhitelist());
              }, 280);
            } else {
              UI.renderWhitelist(Storage.getWhitelist());
            }
            const snapshot = Storage.load();
            if (snapshot && Array.isArray(snapshot.following) && Array.isArray(snapshot.followers)) {
              if (snapshot.following.includes(targetUser) && !snapshot.followers.includes(targetUser)) {
                const notFollowingState = UI.paginationState["ig-view-notfollowing"];
                if (notFollowingState && Array.isArray(notFollowingState.rawUsers)) {
                  if (!notFollowingState.rawUsers.some((u) => u.username === targetUser)) {
                    const knownObj = (snapshot.followingDetailed || []).find((u) => u.username === targetUser) || {
                      username: targetUser,
                      url: "https://www.instagram.com/" + targetUser + "/"
                    };
                    notFollowingState.rawUsers.unshift(knownObj);
                    UI.applyFilters("ig-view-notfollowing");
                    if (App.lastResults) App.lastResults.unshift(knownObj);
                    if (window.__igLastResults) window.__igLastResults.unshift(knownObj);
                  }
                }
              }
            }
            return;
          }
          const btnClearWl = e.target.closest(".btn-clear-whitelist, .ig-btn-clear-whitelist");
          if (btnClearWl) {
            e.preventDefault();
            e.stopPropagation();
            const confirmed = await UI.confirmAction(
              "Clear Whitelist",
              "Are you sure you want to remove all accounts from the whitelist?<br><br>They will be monitored again in future scans.",
              "Yes, Clear All"
            );
            if (confirmed) {
              Storage.clearWhitelist();
              UI.log("[INFO] Whitelist cleared.");
              UI.renderWhitelist([]);
              const snap = Storage.load();
              if (snap && Array.isArray(snap.following) && Array.isArray(snap.followers)) {
                const following = snap.following;
                const followers = snap.followers;
                const notFollowingBackUsernames = Utils.diff(following, followers);
                const allUsersMap = new Map();
                [...snap.followingDetailed || [], ...snap.followersDetailed || []].forEach((u) => {
                  if (u?.username) allUsersMap.set(u.username, u);
                });
                const restored = notFollowingBackUsernames.map((u) => ({
                  ...allUsersMap.get(u) || {},
                  username: u,
                  url: "https://www.instagram.com/" + u + "/"
                }));
                UI.renderResults(restored, "Not Following You Back", "ig-view-notfollowing", true);
                App.lastResults = restored;
                window.__igLastResults = restored;
              }
            }
            return;
          }
          const btnTargetAudit = e.target.closest(".btn-target-audit, .ig-btn-target-audit");
          if (btnTargetAudit) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnTargetAudit.getAttribute("data-user");
            const userId = btnTargetAudit.getAttribute("data-user-id");
            if (username) {
              App.openTargetAudit(username, userId, false);
            }
            return;
          }
          const btnCardOpen = e.target.closest(".btn-target-card-open");
          if (btnCardOpen) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnCardOpen.getAttribute("data-username");
            if (username) App.openTargetAudit(username, null, false);
            return;
          }
          const btnCardRefresh = e.target.closest(".btn-target-card-refresh");
          if (btnCardRefresh) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnCardRefresh.getAttribute("data-username");
            if (username) App.openTargetAudit(username, null, true);
            return;
          }
          const btnCardDelete = e.target.closest(".btn-target-card-delete");
          if (btnCardDelete) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnCardDelete.getAttribute("data-username");
            if (username) {
              const confirmed = await UI.confirmAction(
                "Remove Monitored Target",
                `Are you sure you want to stop tracking <b>@${Utils.escapeHtml(username)}</b>?<br><br>Their audit history will be deleted.`,
                "Yes, Remove",
                true,
                Icons.trash
              );
              if (confirmed) {
                Storage.removeTargetData(username);
                UI.renderTargetTrackerMainView();
                UI.log(`[INFO] @${username} removed from monitored targets.`);
              }
            }
            return;
          }
          const btnPrev = e.target.closest(".ig-page-prev");
          if (btnPrev && !btnPrev.disabled) {
            e.preventDefault();
            e.stopPropagation();
            const cId = btnPrev.getAttribute("data-container");
            if (cId) UI.changePage(cId, -1);
            return;
          }
          const btnNext = e.target.closest(".ig-page-next");
          if (btnNext && !btnNext.disabled) {
            e.preventDefault();
            e.stopPropagation();
            const cId = btnNext.getAttribute("data-container");
            if (cId) UI.changePage(cId, 1);
            return;
          }
          const btnTargetSearch = e.target.closest("#ig-btn-target-search, .btn-target-search");
          if (btnTargetSearch) {
            e.preventDefault();
            e.stopPropagation();
            handleTargetSearch();
            return;
          }
          const targetCard = e.target.closest(".ig-target-card");
          if (targetCard && !e.target.closest(".btn-target-card-delete, .btn-target-card-refresh, .btn-target-card-open, a, button")) {
            e.preventDefault();
            e.stopPropagation();
            const username = targetCard.getAttribute("data-username");
            if (username) App.openTargetAudit(username, null, false);
            return;
          }
        });
        panel.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && e.target && e.target.id === "ig-target-search-input") {
            e.preventDefault();
            e.stopPropagation();
            handleTargetSearch();
          }
        });
        panel.addEventListener("input", (e) => {
          if (e.target && e.target.id === "ig-target-search-input") {
            const fb = document.getElementById("ig-target-search-feedback");
            if (fb && fb.style.display !== "none") {
              fb.style.display = "none";
            }
          }
        });
      }
      const handleTargetSearch = () => {
        const input = document.getElementById("ig-target-search-input");
        const fb = document.getElementById("ig-target-search-feedback");
        const rawVal = input ? input.value : "";
        const cleanUser = String(rawVal || "").replace(/^@+\s*/, "").trim().replace(/\s+/g, "");
        if (!cleanUser) {
          if (fb) {
            fb.style.display = "block";
            fb.className = "ig-target-feedback is-error";
            fb.textContent = "Please enter an Instagram username.";
          }
          if (input) input.focus();
          return;
        }
        if (!/^[a-zA-Z0-9._]+$/.test(cleanUser)) {
          if (fb) {
            fb.style.display = "block";
            fb.className = "ig-target-feedback is-error";
            fb.textContent = `Invalid username format for "@${cleanUser}". Usernames can only contain letters, numbers, periods, and underscores.`;
          }
          if (input) input.focus();
          return;
        }
        if (fb) {
          fb.style.display = "none";
          fb.textContent = "";
        }
        App.openTargetAudit(cleanUser, null, true);
      };
      App.handleTargetSearch = handleTargetSearch;
      const subpanel = document.getElementById("ig-target-subpanel");
      if (subpanel) {
        const btnTargetRun = subpanel.querySelector("#ig-target-run");
        if (btnTargetRun) {
          btnTargetRun.onclick = () => {
            if (App.targetRunning) {
              App.abortTargetAudit();
            } else if (UI.currentTargetUser) {
              App.runTargetAudit(UI.currentTargetUser, true);
            }
          };
        }
        const btnTargetExport = subpanel.querySelector("#ig-target-export-csv");
        if (btnTargetExport) {
          btnTargetExport.onclick = () => {
            const listToExport = UI.getTargetActiveList();
            if (listToExport && listToExport.length > 0) {
              const targetName = UI.currentTargetUser?.username || "target";
              const activeTab = subpanel.querySelector("#ig-target-tabs .ig-tab-btn.active");
              const tabLabel = activeTab ? activeTab.innerText.trim().toLowerCase().replace(/\s+/g, "_") : "list";
              const dateStr = Utils.now().split("T")[0];
              Utils.exportCSV(listToExport, `@${targetName}_${tabLabel}_${dateStr}.csv`);
              UI.targetLog(`CSV Exported (${listToExport.length} accounts).`);
            }
          };
        }
      }
      document.addEventListener("keydown", (e) => {
        const tag = document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;
        if (e.key === "F9") UI.togglePanel();
        if (e.key === "F8") UI.resetPosition();
      });
    }
  };
  window.App = App;
  const TOUR_SEEN_KEY = "ig_tour_completed_v1";
  function getTamperGuide() {
    if (typeof window !== "undefined" && typeof window.tamperGuide === "function") {
      return window.tamperGuide;
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.tamperGuide === "function") {
      return globalThis.tamperGuide;
    }
    return null;
  }
  function buildUnifiedSteps() {
    return [
      {
        id: "welcome",
        popover: {
          title: "Welcome to IG Analyzer!",
          description: "Welcome to version 3.12.0! This complete guided tour walks you through every feature of your Instagram Follower Analyzer. Safe, private, and enriched with deep audience analytics.<br><br>Let's get started!"
        }
      },
      {
        id: "header",
        element: "#ig-header",
        popover: {
          title: "Header & Window Controls",
          description: "Drag this bar to position the panel anywhere on screen — your coordinates and custom dimensions are saved automatically.<br><br>• <b>&minus; Button:</b> Minimizes the panel into a compact bar while browsing.<br>• <b>&times; Button:</b> Closes the panel.<br>• <b>Shortcuts:</b> Press <b>F9</b> to toggle visibility and <b>F8</b> to reset to the default 717&times;560 size.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "status",
        element: "#ig-status",
        popover: {
          title: "Status & Progress Tracking",
          description: "Displays real-time analyzer state (<b>Inactive</b>, <b>Analyzing...</b>, <b>Completed</b>, or <b>Error</b>).<br><br>During an analysis, the progress bar tracks proportional progress against your actual follower and following counts, with smooth indeterminate animation fallback when totals cannot be predetermined.",
          side: "bottom",
          align: "end"
        }
      },
      {
        id: "run-analysis",
        element: "#ig-run",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        stageRadius: "auto",
        ariaLabel: "Click Run Analysis to start scanning",
        beacon: {
          shape: "adaptive",
          color: "#3b82f6",
          text: {
            content: "Click to Run Analysis",
            theme: "accent",
            position: "bottom",
            icon: "🚀"
          },
          dismissOnClick: true
        },
        advanceOn: { event: "click", selector: "#ig-run" }
      },
      {
        id: "analysis-progress",
        element: "#ig-run",
        popover: {
          title: "Running Deep Analysis...",
          description: "Confirm the safety prompt to start scanning your account.<br><br>The analyzer scans followers and following lists with safe anti-detection delays (2000ms + jitter).<br><br>Once the status badge shows <b>Completed</b>, click <b>Next &rarr;</b> below to explore your populated results, filters, and tools!",
          side: "bottom",
          align: "start"
        }
      },
      {
        id: "export-csv",
        element: "#ig-export-csv",
        popover: {
          title: "Export Sanitized CSV",
          description: "Download a spreadsheet of your results at any time. Sanitized against CSV Formula Injection (CWE-1236) and encoded with UTF-8 BOM for perfect compatibility with Excel, LibreOffice, and Google Sheets.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "reset-data",
        element: "#ig-reset",
        popover: {
          title: "Reset & Data Isolation",
          description: "Wipes all local data with a safety confirmation prompt.<br><br>All analyzer data stays strictly in your browser and is partitioned by your Instagram account ID (<code>${key}_${userId}</code>), ensuring zero cross-contamination when switching accounts in the same browser profile.",
          side: "bottom",
          align: "end"
        }
      },
      {
        id: "tabs-navigation",
        element: "#ig-tabs",
        popover: {
          title: "Navigation & Analytics Tabs",
          description: "Switch between specialized analytics views. You can scroll horizontally through tabs using your mouse wheel or touchpad swipe.<br><br>Let's take a look at each of the main views and populated tools!",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-logs",
        element: '#ig-tabs [data-target="ig-log"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-log"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Activity & Network Logs",
          description: "Real-time diagnostic feed displaying background Instagram API queries, pagination batches, GraphQL requests, and rate limit cooldowns. This tab is active during analysis so you can monitor progress in real time.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-history",
        element: '#ig-tabs [data-target="ig-view-history"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-history"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Audience Balance & History",
          description: "Inspect your long-term audience evolution. Features the <b>Audience Balance KPI grid</b> (Current Followers, Following, and Net Flow: <b>+X New / -Y Lost</b> with trend badges) alongside daily historical snapshots.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-notfollowing",
        element: '#ig-tabs [data-target="ig-view-notfollowing"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-notfollowing"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Not Following You Back",
          description: "Lists accounts you follow who do not follow you back. Uses client-side 50-user pagination (<b>&larr; Prev</b> and <b>Next &rarr;</b>) for lag-free scrolling.<br><br>Let's explore the powerful interactive tools available on each result!",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "feature-search",
        element: "#ig-view-notfollowing .ig-search-box, #ig-view-notfollowing .ig-search-input, .ig-search-box",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        beforeStep: async () => {
          const view = document.getElementById("ig-view-notfollowing");
          if (view) view.scrollTop = 0;
          const el = document.querySelector("#ig-view-notfollowing .ig-search-box, .ig-search-box");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          await new Promise((r) => setTimeout(r, 150));
        },
        popover: {
          title: "Live Instant Search",
          description: "Filter accounts instantly in real time by typing any part of a username (<code>@username</code>) or full display name, featuring debounced searching and a 1-click clear button.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "feature-chips",
        element: "#ig-view-notfollowing .ig-filter-chips, .ig-filter-chips",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        beforeStep: async () => {
          const view = document.getElementById("ig-view-notfollowing");
          if (view) view.scrollTop = 0;
          const el = document.querySelector("#ig-view-notfollowing .ig-filter-chips, .ig-filter-chips");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          await new Promise((r) => setTimeout(r, 150));
        },
        popover: {
          title: "Category Filter Chips",
          description: "Quickly toggle category filters with live count badges: <b>All</b>, <b>Private</b>, <b>Public</b>, <b>Besties (Close Friends)</b>, <b>With Story</b>, and <b>Verified</b>.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "feature-story-spy",
        element: "#ig-view-notfollowing .ig-user-row:first-child .btn-spy-story, #ig-view-notfollowing .btn-spy-story, .btn-spy-story",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        beforeStep: async () => {
          const btn = document.querySelector("#ig-view-notfollowing .ig-user-row:first-child .btn-spy-story, #ig-view-notfollowing .btn-spy-story, .btn-spy-story");
          if (btn) {
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise((r) => setTimeout(r, 150));
          }
        },
        popover: {
          title: "Story Spy 2.0 (Story Anomaly Detection)",
          description: "Click <b>Check Story</b> next to any user row to run an on-demand visibility test.<br><br>Compares Meta's GraphQL & Highlights Tray against anonymous guest sessions to detect if someone is hiding stories from your account with 24-hour decay window math.",
          side: "bottom",
          align: "end"
        }
      },
      {
        id: "feature-profile-inspector",
        element: "#ig-view-notfollowing .ig-user-row:first-child .btn-inspect-user, #ig-view-notfollowing .btn-inspect-user, .btn-inspect-user",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        beforeStep: async () => {
          const btn = document.querySelector("#ig-view-notfollowing .ig-user-row:first-child .btn-inspect-user, #ig-view-notfollowing .btn-inspect-user, .btn-inspect-user");
          if (btn) {
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise((r) => setTimeout(r, 150));
          }
        },
        popover: {
          title: "Quick-Card 1080p Profile Inspector",
          description: "Click the <b>Inspect</b> button (or any avatar) to open the HD Quick-Card modal:<br>• Full-resolution 1080p profile picture with a <b>1-click HD Download</b> button.<br>• Complete bio with clickable links, mutual friends facepile counters, and live relationship status pills (<i>Follows you</i>, <i>Following</i>, <i>Pending</i>).",
          side: "bottom",
          align: "end"
        }
      },
      {
        id: "feature-whitelist-action",
        element: "#ig-view-notfollowing .ig-user-row:first-child .btn-whitelist, #ig-view-notfollowing .btn-whitelist, .btn-whitelist",
        stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
        beforeStep: async () => {
          const btn = document.querySelector("#ig-view-notfollowing .ig-user-row:first-child .btn-whitelist, #ig-view-notfollowing .btn-whitelist, .btn-whitelist");
          if (btn) {
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise((r) => setTimeout(r, 150));
          }
        },
        popover: {
          title: "Ignore / Whitelist Action",
          description: "Click <b>Ignore</b> on accounts you follow intentionally without expecting a follow-back (celebrities, news channels, brands).<br><br>This moves them to the Whitelist tab so they don't clutter your non-follower audits.",
          side: "bottom",
          align: "end"
        }
      },
      {
        id: "tab-fans",
        element: '#ig-tabs [data-target="ig-view-fans"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-fans"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Fans (Followers You Don't Follow Back)",
          description: "Displays accounts that follow you, but you don't follow back. Inspect their profiles in 1080p HD, check story visibility, or audit their follower network.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-mutuals",
        element: '#ig-tabs [data-target="ig-view-mutuals"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-mutuals"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Mutual Connections",
          description: "Friends and connections who follow each other. User rows display live story status rings (gradient for standard stories, neon green for Close Friends / Besties).",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-targettracker",
        element: '#ig-tabs [data-target="ig-view-targettracker"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-targettracker"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Target Tracker & Network Audits",
          description: "Audit any public Instagram account! Enter any <code>@username</code> to inspect their audience, discover shared mutual connections, and track net follower gains or losses over time in a draggable, resizable child subpanel.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-newfollowers",
        element: '#ig-tabs [data-target="ig-view-newfollowers"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-newfollowers"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "New Followers Center",
          description: "Automatically identifies accounts gained since your previous scan, with detection timestamps and relationship badges: <b>Mutual</b> (if you follow back) or <b>Fan</b> (if you don't follow back yet).",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-whitelist",
        element: '#ig-tabs [data-target="ig-view-whitelist"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-whitelist"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Visual Whitelist Manager",
          description: "Review all ignored accounts with instant real-time search. Click <b>Restore</b> on any row to return them to the active Not Following list with a smooth animation, or clear the whitelist in batch.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-unfollowers",
        element: '#ig-tabs [data-target="ig-view-unfollowers"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-unfollowers"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Unfollowers Log",
          description: "Chronological dated log of accounts that stopped following you since your previous scan.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-deactivated",
        element: '#ig-tabs [data-target="ig-view-deactivated"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-deactivated"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Deactivated Accounts",
          description: "Accurately distinguishes genuine deactivated Instagram accounts from users who blocked you, safely verified using anonymous guest profile checks.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-blocked",
        element: '#ig-tabs [data-target="ig-view-blocked"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-blocked"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Blocked Accounts",
          description: "Identifies accounts that have blocked your profile. Confirmed when a profile remains publicly accessible to anonymous guest sessions but returns restricted errors to your logged-in account.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-renamed",
        element: '#ig-tabs [data-target="ig-view-renamed"]',
        beforeStep: async () => {
          const tab = document.querySelector('#ig-tabs [data-target="ig-view-renamed"]');
          if (tab) {
            tab.click();
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Username Changes (Renamed)",
          description: "Tracks mutual account <code>@username</code> changes by matching persistent numeric Instagram IDs, ensuring you never mistake a rename for an unfollow.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "tab-backup",
        element: "#ig-tab-backup",
        beforeStep: async () => {
          const tab = document.getElementById("ig-tab-backup");
          if (tab) {
            tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
            await new Promise((r) => setTimeout(r, 200));
          }
        },
        popover: {
          title: "Backup & Restore Database",
          description: "Safely export your entire analyzer database (snapshots, history, whitelists, and audits) to a local JSON file, or restore a previous backup at any time. Multi-account scoped and protected against prototype pollution and data loss.",
          side: "bottom",
          align: "center"
        }
      },
      {
        id: "outro",
        popover: {
          title: "You're All Set!",
          description: "You're now ready to use IG Analyzer! Press <b>F9</b> anytime to toggle panel visibility, or <b>F8</b> to reset position.<br><br>You can replay this complete tour at any time from your Tampermonkey extension menu."
        }
      }
    ];
  }
  function runGuide(steps, options = {}) {
    const tg = getTamperGuide();
    if (!tg) {
      console.warn(
        "[IG Analyzer] TamperGuide library not found in global scope. Make sure it is loaded via @require in the userscript header."
      );
      return null;
    }
    const panel = document.getElementById("ig-analyzer-panel");
    if (!panel) {
      console.warn("[IG Analyzer] Panel not found in DOM. Cannot start tour.");
      return null;
    }
    panel.style.display = "flex";
    const blockF9 = (e) => {
      if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", blockF9, true);
    const guide = tg({
      animate: true,
      overlayColor: "#000",
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 10,
      allowClose: true,
      allowKeyboardControl: true,
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next &rarr;",
      prevBtnText: "&larr; Back",
      doneBtnText: "Done &#10003;",
      smoothScroll: true,
      scrollIntoViewOptions: { behavior: "smooth", block: "nearest", inline: "nearest" },
      popoverOffset: 12,
      steps,
      onDestroyed: () => {
        document.removeEventListener("keydown", blockF9, true);
        markTourCompleted();
        if (typeof options.onDestroyed === "function") {
          options.onDestroyed();
        }
      },
      onDestroyStarted: (element, step, opts) => {
        if (opts.driver.isLastStep()) return;
        const skip = confirm(
          "Exit this guide?\n\nYou can restart it anytime from the Tampermonkey menu."
        );
        if (skip) {
          opts.driver.destroy();
        }
        return false;
      }
    });
    guide.drive();
    return guide;
  }
  function isTourCompleted() {
    return GM_getValue(TOUR_SEEN_KEY, false) === true;
  }
  function markTourCompleted() {
    GM_setValue(TOUR_SEEN_KEY, true);
  }
  function resetTour() {
    GM_deleteValue(TOUR_SEEN_KEY);
    console.log("[IG Analyzer] Unified tour reset. It will show on next page load.");
  }
  function startTour(options = {}) {
    const { force = false } = options;
    if (!force && isTourCompleted()) {
      return null;
    }
    return runGuide(buildUnifiedSteps(), {
      onDestroyed: () => {
        markTourCompleted();
        console.log("[IG Analyzer] Unified tour completed and saved.");
      }
    });
  }
  UI.init();
  window.App = App;
  App.bindEvents();
  setTimeout(() => {
    const panel = document.getElementById("ig-analyzer-panel");
    if (panel && panel.style.display !== "none") {
      startTour();
    }
  }, 800);
  if (typeof GM_registerMenuCommand === "function") {
    const ensurePanelOpen = () => {
      const panel = document.getElementById("ig-analyzer-panel");
      if (panel && panel.style.display === "none") {
        UI.togglePanel();
      }
    };
    GM_registerMenuCommand("IG Analyzer: Replay Tour", () => {
      ensurePanelOpen();
      resetTour();
      startTour({ force: true });
    });
  }
  UI.log("IG Analyzer loaded. Press F9 to toggle panel, F8 to reset position.");

})();