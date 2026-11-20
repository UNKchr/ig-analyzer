// ==UserScript==
// @name                Instagram Follower Analyzer
// @name:en             Instagram Follower Analyzer
// @name:es             Analizador de seguidores de Instagram
// @name:es-419         Analizador de seguidores de Instagram
// @name:pt             Analisador de seguidores do Instagram
// @name:pt-BR          Analisador de seguidores do Instagram
// @name:pt-PT          Analisador de seguidores do Instagram
// @namespace           https://github.com/UNKchr/ig-analyzer
// @version             3.14.0
// @author              UNKchr
// @description         Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.
// @description:en      Analyze Instagram followers and following lists, detect non-followers, story anomalies, and export your data securely.
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

  const UI = {
currentHdUser: null,
    hdModalAbortController: null,
paginationState: {},
    whitelistSearchQuery: "",
currentTargetUser: null,
    targetPaginationState: {},
chartState: {
      main: { metric: "followers", range: "30d" },
      target: { metric: "followers", range: "30d" }
    }
  };
  const CONFIG = {
    SCRIPT_ID: "ig-analyzer",
    SCRIPT_NAME: "Instagram Follower Analyzer",
    BACKUP_SCHEMA_VERSION: 2,
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
    FOLLOWING_ALT_HASH: "3dec7e2c57367ef3da3d987d89f9dbc8",
    FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
    HIGHLIGHTS_HASH: "d4d88dc1500312af6f937f7b804c68c3",
    EXTRACTION_ENGINE_KEY: "ig_extraction_engine_v1",
    DEFAULT_EXTRACTION_ENGINE: "hybrid",
    PAGE_SIZE: 50,
    FRIENDSHIPS_PAGE_SIZE: 12,
GRAPHQL_FOLLOW_LIST_PAGE_SIZE: 20,
HYBRID_RECONCILE_THRESHOLD: 0.92,
HYBRID_MIN_MISSING_USERS: 6,
RELAY_DOC_IDS: {
      FOLLOW_LIST_QUERY: "40819242737691319",
FOLLOW_LIST_WRAPPER_QUERY: "26750505977951904",
PROFILE_QUERY: "28036671149327607",
PROFILE_ALT_QUERY: "40158838120366999",
HIGHLIGHTS_TRAY_QUERY: "26970053832668570",
HOVER_CARD_QUERY: "28949219061332276",
SEARCH_BOX_QUERY: "27706427925724183",
SEARCH_BOX_NON_PROFILED_QUERY: "27634848489527274"
    },
    FRIENDSHIPS_RATE_LIMIT_MS: 1400,
BASE_RATE_LIMIT_MS: 2e3,
MAX_RETRIES: 4,
    COOLDOWN_429_MS: 6e4,
RATE_LIMIT_STATE_KEY: "ig_rate_limit_buckets_v1",
    RATE_LIMIT_CIRCUIT_MS: 3e5,
    BREATHER_EVERY_PAGES: 8,
BREATHER_PAUSE_MS: 3200,
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
localDateStr: (dateInput = null) => {
      if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        return dateInput.trim();
      }
      try {
        if (dateInput === null || dateInput === void 0) {
          if (typeof globalThis.Temporal !== "undefined" && typeof globalThis.Temporal.Now?.plainDateISO === "function") {
            return globalThis.Temporal.Now.plainDateISO().toString();
          }
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        }
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (Number.isNaN(d.getTime())) {
          return Utils.localDateStr(null);
        }
        if (typeof globalThis.Temporal !== "undefined" && typeof globalThis.Temporal.Instant?.fromEpochMilliseconds === "function") {
          const tz = globalThis.Temporal.Now.timeZoneId();
          return globalThis.Temporal.Instant.fromEpochMilliseconds(d.getTime()).toZonedDateTimeISO(tz).toPlainDate().toString();
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      } catch (e) {
        const fallback = new Date();
        return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}-${String(fallback.getDate()).padStart(2, "0")}`;
      }
    },
localTimeStr: (dateInput = null) => {
      try {
        if ((dateInput === null || dateInput === void 0) && typeof globalThis.Temporal !== "undefined" && typeof globalThis.Temporal.Now?.plainTimeISO === "function") {
          const pt = globalThis.Temporal.Now.plainTimeISO();
          return `${String(pt.hour).padStart(2, "0")}:${String(pt.minute).padStart(2, "0")}:${String(pt.second).padStart(2, "0")}`;
        }
        const d = dateInput === null || dateInput === void 0 ? new Date() : dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (Number.isNaN(d.getTime())) return "";
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
      } catch (e) {
        return "";
      }
    },
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),
    escapeHtml: (str) => {
      if (str === null || str === void 0) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    sanitizeUrl: (username, customUrl) => {
      const cleanUser = String(username || "").replace(/^@+/, "").trim();
      if (cleanUser) {
        return `https://www.instagram.com/${encodeURIComponent(cleanUser)}/`;
      }
      if (customUrl) {
        try {
          const parsed = new URL(customUrl, window.location.origin);
          if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.includes("instagram.com")) {
            return Utils.escapeHtml(parsed.href);
          }
        } catch (e) {
          Utils.logError("Error parsing custom URL", e);
        }
      }
      return "https://www.instagram.com/";
    },
    isCdnUrlExpired: (url) => {
      if (!url || typeof url !== "string") return true;
      try {
        const clean = url.replace(/&amp;/g, "&");
        const parsed = new URL(clean, window.location.origin);
        const oeHex = parsed.searchParams.get("oe");
        if (oeHex) {
          const expSec = parseInt(oeHex, 16);
          if (!isNaN(expSec) && expSec > 0) {
            const nowSec = Math.floor(Date.now() / 1e3);
            return expSec <= nowSec;
          }
        }
      } catch (e) {
      }
      return false;
    },
    sanitizeImageUrl: (url) => {
      if (!url || typeof url !== "string") return null;
      try {
        const clean = url.replace(/&amp;/g, "&").trim();
        if (Utils.isCdnUrlExpired(clean)) {
          return null;
        }
        const parsed = new URL(clean, window.location.origin);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
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
    generateUuid: () => {
      try {
        if (typeof globalThis.crypto?.randomUUID === "function") {
          return globalThis.crypto.randomUUID();
        }
      } catch (e) {
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === "x" ? r : r & 3 | 8;
        return v.toString(16);
      });
    },
getRelayDocId: (operationName, fallbackDocId = null) => {
      if (!operationName || typeof operationName !== "string") return fallbackDocId;
      const isNumericDocId = (val) => val !== null && val !== void 0 && /^[0-9]{10,25}$/.test(String(val).trim());
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        if (typeof win?.require === "function") {
          const candidateModules = [
            `${operationName}_instagramRelayOperation`,
            `${operationName}.graphql`,
            `${operationName}$Parameters`,
            operationName
          ];
          for (const modName of candidateModules) {
            try {
              const mod = win.require(modName);
              if (isNumericDocId(mod)) return String(mod).trim();
              if (isNumericDocId(mod?.default)) return String(mod.default).trim();
              if (isNumericDocId(mod?.params?.id)) return String(mod.params.id).trim();
              if (isNumericDocId(mod?.default?.params?.id)) return String(mod.default.params.id).trim();
              if (isNumericDocId(mod?.id)) return String(mod.id).trim();
            } catch (innerErr) {
            }
          }
        }
      } catch (e) {
      }
      try {
        const scripts = document.querySelectorAll("script:not([src])");
        const escapedOp = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const opRegex = new RegExp(
          `(?:"${escapedOp}_instagramRelayOperation"[^"0-9]{1,80}"([0-9]{10,25})")|(?:"name"\\s*:\\s*"${escapedOp}"[\\s\\S]{1,160}?"id"\\s*:\\s*"([0-9]{10,25})")`
        );
        for (const script of scripts) {
          const text = script.textContent || "";
          if (!text || !text.includes(operationName)) continue;
          const match = text.match(opRegex);
          const resolved = match?.[1] || match?.[2] || null;
          if (isNumericDocId(resolved)) {
            return String(resolved).trim();
          }
        }
      } catch (e) {
      }
      return fallbackDocId;
    },
resolveRelayDocIdAsync: async (operationName, fallbackDocId = null, lazyResourceName = null) => {
      const syncDocId = Utils.getRelayDocId(operationName, null);
      if (syncDocId) return syncDocId;
      if (lazyResourceName && typeof lazyResourceName === "string") {
        try {
          const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
          if (typeof win?.require === "function") {
            const jsResource = win.require("JSResourceForInteraction");
            if (typeof jsResource === "function") {
              const resourceObj = jsResource(lazyResourceName);
              if (resourceObj && typeof resourceObj.load === "function") {
                await Promise.race([
                  Promise.resolve(resourceObj.load()).catch(() => null),
                  new Promise((resolve) => setTimeout(resolve, 1500))
                ]);
              }
            }
          }
        } catch (_e) {
        }
      }
      return Utils.getRelayDocId(operationName, fallbackDocId);
    },
    getUserId: () => {
      const matchCookie = document.cookie.match(/(?:^|;\s*)ds_user_id=([1-9][0-9]*)/);
      if (matchCookie && matchCookie[1] && matchCookie[1] !== "0") {
        return matchCookie[1];
      }
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const viewerId = win._sharedData?.config?.viewerId || win._sharedData?.config?.viewer?.id || win.__initialData?.pending?.viewer?.id || win.__initialData?.data?.viewer?.id;
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
      return null;
    },
    getUsername: () => {
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const u = win._sharedData?.config?.viewer?.username || win.__initialData?.data?.viewer?.username || win.__initialData?.pending?.viewer?.username;
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
      const seenIds = new Set();
      const seenUsernames = new Set();
      const result = [];
      for (const u of arr) {
        let normalized = null;
        if (typeof u === "string") {
          const cleanName = String(u).replace(/^@+/, "").trim();
          if (cleanName) {
            normalized = {
              id: null,
              username: cleanName,
              fullName: "",
              isPrivate: false,
              isPrivateKnown: false,
              isVerified: false,
              profilePicUrl: null,
              latestReelMedia: 0,
              isBestie: false,
              outgoingRequest: false,
              url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
            };
          }
        } else if (u && typeof u === "object") {
          const rawName = u.username || u.name || "";
          const cleanName = String(rawName).replace(/^@+/, "").trim();
          if (cleanName) {
            const pic = Utils.sanitizeImageUrl(u.profilePicUrl || u.profile_pic_url || null);
            const idStr = u.id && String(u.id) !== "0" && String(u.id) !== "null" && String(u.id) !== "undefined" ? String(u.id) : null;
            const rawPriv = u.isPrivate !== void 0 ? u.isPrivate : u.is_private;
            const isPrivateKnown = typeof u.isPrivateKnown === "boolean" ? u.isPrivateKnown : typeof rawPriv === "boolean" || Boolean(rawPriv) === true;
            normalized = {
              id: idStr,
              username: cleanName,
              fullName: u.fullName || u.full_name || "",
              isPrivate: Boolean(rawPriv),
              isPrivateKnown,
              isVerified: Boolean(u.isVerified ?? u.is_verified),
              profilePicUrl: pic,
              latestReelMedia: u.latestReelMedia ?? u.latest_reel_media ?? 0,
              isBestie: Boolean(u.isBestie ?? u.is_bestie),
              outgoingRequest: Boolean(u.outgoingRequest ?? u.outgoing_request),
              url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
            };
            if (u.followsBack !== void 0 && u.followsBack !== null) {
              normalized.followsBack = Boolean(u.followsBack);
            }
            if (u.date) {
              normalized.date = String(u.date);
            }
            if (u.isBusiness !== void 0) {
              normalized.isBusiness = Boolean(u.isBusiness);
            }
            if (u.isCreator !== void 0) {
              normalized.isCreator = Boolean(u.isCreator);
            }
            if (u.category) {
              normalized.category = String(u.category);
            }
            if (u.isViewerMutual !== void 0) {
              normalized.isViewerMutual = Boolean(u.isViewerMutual);
            }
            if (u.previousUsername) {
              normalized.previousUsername = String(u.previousUsername);
            }
            if (u.occurrences !== void 0 && u.occurrences !== null) {
              normalized.occurrences = Number(u.occurrences) || 1;
            }
          }
        }
        if (!normalized) continue;
        const lowerName = normalized.username.toLowerCase();
        if (normalized.id && seenIds.has(normalized.id) || seenUsernames.has(lowerName)) {
          continue;
        }
        if (normalized.id) seenIds.add(normalized.id);
        seenUsernames.add(lowerName);
        result.push(normalized);
      }
      return result;
    },
    deduplicateUsers: (arr) => Utils.toDetailedUserArray(arr),
    mapById: (arr) => {
      const map = new Map();
      (arr || []).forEach((u) => {
        if (u?.id && String(u.id) !== "0") map.set(String(u.id), u);
      });
      return map;
    },
    intersectionById: (a, b) => {
      const bIDs = new Set((b || []).map((x) => x?.id ? String(x.id) : null).filter(Boolean));
      return (a || []).filter((x) => x?.id && bIDs.has(String(x.id)));
    },
detectRenamedUsers: (prevUsers, currentUsers) => {
      const prevById = Utils.mapById(prevUsers);
      const currById = Utils.mapById(currentUsers);
      const changes = [];
      prevById.forEach((prevUser, id) => {
        const currUser = currById.get(id);
        if (!currUser || !prevUser?.username || !currUser?.username) return;
        if (prevUser.username !== currUser.username) {
          changes.push({
            id: String(id),
            oldUsername: prevUser.username,
            newUsername: currUser.username,
            fullName: currUser.fullName || prevUser.fullName || "",
            profilePicUrl: currUser.profilePicUrl || prevUser.profilePicUrl || null,
            isVerified: Boolean(currUser.isVerified ?? prevUser.isVerified),
            isPrivate: Boolean(currUser.isPrivate ?? prevUser.isPrivate)
          });
        }
      });
      return changes;
    },
    detectRenamedMutuals: (prevMutuals, currentMutuals) => Utils.detectRenamedUsers(prevMutuals, currentMutuals),
    exportCSV: (data, filename) => {
      if (!data || !data.length) return;
      const sanitizeCell = (val) => {
        let text = String(val ?? "");
        if (/^[=+\-@\t\r]/.test(text)) {
          text = "'" + text;
        }
        return `"${text.replace(/"/g, '""')}"`;
      };
      const hasRenamedCols = data.some((u) => u && typeof u === "object" && (u.oldUsername || u.newUsername));
      const hasPrevUserCol = !hasRenamedCols && data.some((u) => u && typeof u === "object" && u.previousUsername);
      const hasOccurrencesCol = !hasRenamedCols && data.some((u) => u && typeof u === "object" && Number(u.occurrences) > 1);
      const hasDateCol = data.some((u) => u && typeof u === "object" && u.date);
      let headerCols = ["Username"];
      if (hasRenamedCols) {
        headerCols = ["Previous Username", "Current Username", "Relationship"];
      } else {
        if (hasPrevUserCol) headerCols.push("Previous Username");
        if (hasOccurrencesCol) headerCols.push("Occurrences");
      }
      if (hasDateCol) headerCols.push("Detected Date");
      headerCols.push("Profile URL");
      const header = headerCols.map(sanitizeCell).join(",");
      const rows = data.map((u) => {
        const isObj = u && typeof u === "object";
        const uName = typeof u === "string" ? u : u?.newUsername || u?.username || "";
        const profileUrl = isObj && u?.url ? u.url : Utils.sanitizeUrl(uName);
        let cols = [uName];
        if (hasRenamedCols) {
          cols = [
            isObj ? u.oldUsername || "" : "",
            uName,
            isObj ? u.relationship || "" : ""
          ];
        } else {
          if (hasPrevUserCol) cols.push(isObj ? u.previousUsername || "" : "");
          if (hasOccurrencesCol) cols.push(isObj ? String(Number(u.occurrences) || 1) : "1");
        }
        if (hasDateCol) cols.push(isObj ? u.date || "" : "");
        cols.push(profileUrl);
        return cols.map(sanitizeCell).join(",");
      });
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
    exportHistoryCSV: (historyList, filename) => {
      if (!Array.isArray(historyList) || historyList.length === 0) return;
      const sanitizeCell = (val) => {
        let text = String(val ?? "");
        if (/^[=+\-@\t\r]/.test(text)) {
          text = "'" + text;
        }
        return `"${text.replace(/"/g, '""')}"`;
      };
      const headerCols = [
        "Date",
        "Followers",
        "Start Followers",
        "Day Delta Followers",
        "Intraday Delta Followers",
        "Following",
        "Day Delta Following",
        "Mutuals",
        "Scans Count"
      ];
      const header = headerCols.map(sanitizeCell).join(",");
      const rows = historyList.map((entry) => {
        const followers = Number(entry?.followers ?? 0);
        const startFollowers = Number(entry?.startFollowers ?? followers);
        const dayDeltaFollowers = Number(entry?.dayDeltaFollowers ?? entry?.lastDeltaFollowers ?? 0);
        const intradayDeltaFollowers = Number(entry?.intradayDeltaFollowers ?? followers - startFollowers);
        const following = Number(entry?.following ?? 0);
        const dayDeltaFollowing = Number(entry?.dayDeltaFollowing ?? entry?.lastDeltaFollowing ?? 0);
        const mutuals = entry?.mutuals !== void 0 && entry?.mutuals !== null ? Number(entry.mutuals) : "";
        const scansCount = Number(entry?.scansCount || 1);
        return [
          entry?.date || "",
          followers,
          startFollowers,
          dayDeltaFollowers,
          intradayDeltaFollowers,
          following,
          dayDeltaFollowing,
          mutuals,
          scansCount
        ].map(sanitizeCell).join(",");
      });
      const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", filename || `ig_history_${Utils.localDateStr()}.csv`);
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
    formatExactNumber: (num) => {
      if (num === null || num === void 0 || num === "" || isNaN(Number(num))) return "—";
      return Number(num).toLocaleString();
    },
    formatDate: (isoOrTimestamp) => {
      if (!isoOrTimestamp) return "-";
      try {
        const raw = String(isoOrTimestamp).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          if (typeof globalThis.Temporal !== "undefined" && typeof globalThis.Temporal.PlainDate?.from === "function") {
            return globalThis.Temporal.PlainDate.from(raw).toLocaleString(void 0, {
              year: "numeric",
              month: "short",
              day: "numeric"
            });
          }
          const [y, m, day] = raw.split("-").map(Number);
          const localDay = new Date(y, m - 1, day);
          return localDay.toLocaleDateString(void 0, {
            year: "numeric",
            month: "short",
            day: "numeric"
          });
        }
        const d = isoOrTimestamp instanceof Date ? isoOrTimestamp : new Date(isoOrTimestamp);
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
  const GLOBAL_UI_KEYS = new Set([
    CONFIG.POSITION_KEY,
    CONFIG.TARGET_SUBPANEL_POSITION_KEY,
    CONFIG.TOUR_KEY,
    CONFIG.EXTRACTION_ENGINE_KEY
  ]);
  const ACCOUNT_SCOPED_KEYS = [
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
    CONFIG.STORY_OBS_KEY
  ];
  const Storage = {
    setCurrentUserId: (id) => {
      if (id && String(id) !== "0") {
        currentUserId = String(id);
      } else if (id === null) {
        currentUserId = null;
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
    isGlobalUiKey: (baseKey) => GLOBAL_UI_KEYS.has(baseKey),
    getAccountScopedKeys: () => ACCOUNT_SCOPED_KEYS.slice(),
    getKey: (baseKey, userId = null) => {
      if (GLOBAL_UI_KEYS.has(baseKey)) return baseKey;
      const id = userId || Storage.getCurrentUserId();
      return id ? `${baseKey}_${id}` : baseKey;
    },
    getScopedValue: (baseKey, defaultValue = null, userId = null) => {
      if (GLOBAL_UI_KEYS.has(baseKey)) {
        return GM_getValue(baseKey, defaultValue);
      }
      const id = userId || Storage.getCurrentUserId();
      if (id) {
        const idStr = String(id);
        const scopedKey = `${baseKey}_${idStr}`;
        const val = GM_getValue(scopedKey, void 0);
        if (val !== void 0 && val !== null) {
          return val;
        }
        const legacyVal = GM_getValue(baseKey, void 0);
        if (legacyVal !== void 0 && legacyVal !== null) {
          const legacyOwner = legacyVal && typeof legacyVal === "object" && !Array.isArray(legacyVal) && legacyVal.ownerUserId ? String(legacyVal.ownerUserId) : null;
          if (legacyOwner && legacyOwner !== idStr) {
            try {
              const rightfulKey = `${baseKey}_${legacyOwner}`;
              const existingOwnerVal = GM_getValue(rightfulKey, void 0);
              if (existingOwnerVal === void 0 || existingOwnerVal === null) {
                GM_setValue(rightfulKey, legacyVal);
              }
              if (typeof GM_deleteValue === "function") {
                GM_deleteValue(baseKey);
              }
            } catch (e) {
              Utils.logError("Error isolating foreign legacy storage key", e);
            }
            return defaultValue;
          }
          let migratedVal = legacyVal;
          if (baseKey === CONFIG.STORAGE_KEY && legacyVal && typeof legacyVal === "object" && !Array.isArray(legacyVal)) {
            migratedVal = { ...legacyVal, ownerUserId: idStr };
          }
          try {
            GM_setValue(scopedKey, migratedVal);
            if (typeof GM_deleteValue === "function") {
              GM_deleteValue(baseKey);
            }
            Utils.log(`[Storage] Migrated legacy data for "${baseKey}" to "${scopedKey}" and removed unscoped copy.`);
          } catch (e) {
            Utils.logError("Error migrating legacy storage key", e);
          }
          return migratedVal;
        }
        return defaultValue;
      }
      return GM_getValue(baseKey, defaultValue);
    },
    setScopedValue: (baseKey, value, userId = null) => {
      if (GLOBAL_UI_KEYS.has(baseKey)) {
        GM_setValue(baseKey, value);
        return;
      }
      const id = userId || Storage.getCurrentUserId();
      const key = id ? `${baseKey}_${id}` : baseKey;
      GM_setValue(key, value);
    },
    hasScopedValue: (baseKey, userId = null) => {
      if (GLOBAL_UI_KEYS.has(baseKey)) {
        const gVal = GM_getValue(baseKey, void 0);
        return gVal !== void 0 && gVal !== null;
      }
      const id = userId || Storage.getCurrentUserId();
      if (id) {
        const idStr = String(id);
        const scopedVal = GM_getValue(`${baseKey}_${idStr}`, void 0);
        if (scopedVal !== void 0 && scopedVal !== null) return true;
        const legacyVal2 = GM_getValue(baseKey, void 0);
        if (legacyVal2 === void 0 || legacyVal2 === null) return false;
        if (legacyVal2 && typeof legacyVal2 === "object" && !Array.isArray(legacyVal2) && legacyVal2.ownerUserId) {
          return String(legacyVal2.ownerUserId) === idStr;
        }
        return true;
      }
      const legacyVal = GM_getValue(baseKey, void 0);
      return legacyVal !== void 0 && legacyVal !== null;
    },
getExtractionEngine: () => {
      const raw = String(Storage.getScopedValue(CONFIG.EXTRACTION_ENGINE_KEY, CONFIG.DEFAULT_EXTRACTION_ENGINE) || "").toLowerCase().trim();
      if (raw === "graphql" || raw === "rest" || raw === "hybrid") {
        return raw;
      }
      return CONFIG.DEFAULT_EXTRACTION_ENGINE;
    },
setExtractionEngine: (engine) => {
      const raw = String(engine || "").toLowerCase().trim();
      const valid = raw === "graphql" || raw === "rest" || raw === "hybrid" ? raw : CONFIG.DEFAULT_EXTRACTION_ENGINE;
      Storage.setScopedValue(CONFIG.EXTRACTION_ENGINE_KEY, valid);
      return valid;
    },
    normalizeItemDates: (rawList) => {
      if (!Array.isArray(rawList)) return { list: [], modified: false };
      const todayStr = Utils.localDateStr();
      let modified = false;
      const list = rawList.map((item) => {
        if (!item || typeof item !== "object") return item;
        if (typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date > todayStr) {
          modified = true;
          return { ...item, date: todayStr };
        }
        return item;
      });
      return { list, modified };
    },
normalizeHistoryRecords: (rawHistory) => {
      if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
        return { list: [], modified: false };
      }
      const todayStr = Utils.localDateStr();
      let modified = false;
      const byDate = new Map();
      rawHistory.forEach((raw) => {
        if (!raw || typeof raw !== "object") {
          modified = true;
          return;
        }
        let dStr = typeof raw.date === "string" ? raw.date.trim() : "";
        if (!dStr) {
          dStr = raw.updatedAt ? Utils.localDateStr(raw.updatedAt) : todayStr;
          modified = true;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dStr) && dStr > todayStr) {
          const healedDate = raw.updatedAt ? Utils.localDateStr(raw.updatedAt) : todayStr;
          dStr = healedDate > todayStr ? todayStr : healedDate;
          modified = true;
        }
        const followers = Number(raw.followers ?? 0);
        const following = Number(raw.following ?? 0);
        const hasMutuals = raw.mutuals !== void 0 && raw.mutuals !== null;
        const mutuals = hasMutuals ? Number(raw.mutuals) : void 0;
        if (!byDate.has(dStr)) {
          byDate.set(dStr, {
            ...raw,
            date: dStr,
            followers,
            following,
            ...hasMutuals ? { mutuals } : {}
          });
        } else {
          modified = true;
          const prev = byDate.get(dStr);
          const startFollowers = Number(prev.startFollowers ?? prev.followers ?? followers);
          const startFollowing = Number(prev.startFollowing ?? prev.following ?? following);
          const startMutuals = hasMutuals ? Number(prev.startMutuals ?? prev.mutuals ?? mutuals) : prev.startMutuals;
          byDate.set(dStr, {
            ...prev,
            ...raw,
            date: dStr,
            followers,
            following,
            ...hasMutuals ? { mutuals, startMutuals } : {},
            startFollowers,
            startFollowing,
            prevScanFollowers: Number(raw.prevScanFollowers ?? prev.followers ?? startFollowers),
            prevScanFollowing: Number(raw.prevScanFollowing ?? prev.following ?? startFollowing),
            intradayDeltaFollowers: followers - startFollowers,
            intradayDeltaFollowing: following - startFollowing,
            scansCount: (Number(prev.scansCount) || 1) + (Number(raw.scansCount) || 1)
          });
        }
      });
      const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
      const originalDates = rawHistory.map((r) => r?.date || "");
      if (sortedDates.length !== originalDates.length || sortedDates.some((d, idx) => d !== originalDates[idx])) {
        modified = true;
      }
      const list = sortedDates.map((d, idx) => {
        const entry = byDate.get(d);
        const prevDay = idx > 0 ? byDate.get(sortedDates[idx - 1]) : null;
        const startFollowers = Number(entry.startFollowers ?? entry.followers ?? 0);
        const startFollowing = Number(entry.startFollowing ?? entry.following ?? 0);
        const intradayDeltaFollowers = Number(entry.followers ?? 0) - startFollowers;
        const intradayDeltaFollowing = Number(entry.following ?? 0) - startFollowing;
        const expectedDayDeltaF = prevDay ? Number(entry.followers ?? 0) - Number(prevDay.followers ?? startFollowers) : intradayDeltaFollowers;
        const expectedDayDeltaIng = prevDay ? Number(entry.following ?? 0) - Number(prevDay.following ?? startFollowing) : intradayDeltaFollowing;
        if (entry.dayDeltaFollowers === void 0 || modified) {
          entry.dayDeltaFollowers = expectedDayDeltaF;
          entry.dayDeltaFollowing = expectedDayDeltaIng;
          entry.intradayDeltaFollowers = intradayDeltaFollowers;
          entry.intradayDeltaFollowing = intradayDeltaFollowing;
        }
        return entry;
      });
      return { list, modified };
    },
upsertHistoryRecord: (rawHistory, metrics = {}) => {
      const todayStr = metrics.dateStr ? Utils.localDateStr(metrics.dateStr) : Utils.localDateStr();
      const { list: hist } = Storage.normalizeHistoryRecords(rawHistory);
      const followers = Number(metrics.followers ?? 0);
      const following = Number(metrics.following ?? 0);
      const hasMutuals = metrics.mutuals !== void 0 && metrics.mutuals !== null;
      const mutuals = hasMutuals ? Number(metrics.mutuals) : void 0;
      const existingIdx = hist.findIndex((h) => h.date === todayStr);
      if (existingIdx > -1) {
        const existing = hist[existingIdx];
        const prevDay = existingIdx > 0 ? hist[existingIdx - 1] : null;
        const startFollowers = Number(existing.startFollowers ?? existing.followers ?? followers);
        const startFollowing = Number(existing.startFollowing ?? existing.following ?? following);
        const startMutuals = hasMutuals ? Number(existing.startMutuals ?? existing.mutuals ?? mutuals) : existing.startMutuals;
        const prevScanFollowers = Number(existing.followers ?? followers);
        const prevScanFollowing = Number(existing.following ?? following);
        const prevScanMutuals = hasMutuals && existing.mutuals !== void 0 && existing.mutuals !== null ? Number(existing.mutuals) : null;
        const lastDeltaFollowers = followers - prevScanFollowers;
        const lastDeltaFollowing = following - prevScanFollowing;
        const lastDeltaMutuals = hasMutuals && prevScanMutuals !== null ? mutuals - prevScanMutuals : 0;
        const intradayDeltaFollowers = followers - startFollowers;
        const intradayDeltaFollowing = following - startFollowing;
        const dayDeltaFollowers = prevDay ? followers - Number(prevDay.followers ?? startFollowers) : intradayDeltaFollowers;
        const dayDeltaFollowing = prevDay ? following - Number(prevDay.following ?? startFollowing) : intradayDeltaFollowing;
        let mergedSummary = existing.scanSummary || null;
        if (metrics.scanSummary && typeof metrics.scanSummary === "object") {
          const prevSum = existing.scanSummary || {};
          mergedSummary = {
            gained: (prevSum.gained || 0) + (metrics.scanSummary.gained || 0),
            lost: (prevSum.lost || 0) + (metrics.scanSummary.lost || 0),
            deactivated: (prevSum.deactivated || 0) + (metrics.scanSummary.deactivated || 0),
            blocked: (prevSum.blocked || 0) + (metrics.scanSummary.blocked || 0),
            renamed: (prevSum.renamed || 0) + (metrics.scanSummary.renamed || 0),
            lastScanGained: metrics.scanSummary.gained || 0,
            lastScanLost: metrics.scanSummary.lost || 0
          };
        }
        hist[existingIdx] = {
          ...existing,
          date: todayStr,
          followers,
          following,
          ...hasMutuals ? { mutuals, startMutuals, prevScanMutuals, lastDeltaMutuals } : {},
          ...metrics.fans !== void 0 ? { fans: Number(metrics.fans) } : {},
          ...metrics.notFollowingBack !== void 0 ? { notFollowingBack: Number(metrics.notFollowingBack) } : {},
          startFollowers,
          startFollowing,
          prevScanFollowers,
          prevScanFollowing,
          lastDeltaFollowers,
          lastDeltaFollowing,
          intradayDeltaFollowers,
          intradayDeltaFollowing,
          dayDeltaFollowers,
          dayDeltaFollowing,
          scansCount: (Number(existing.scansCount) || 1) + 1,
          ...mergedSummary ? { scanSummary: mergedSummary } : {},
          updatedAt: Utils.now()
        };
      } else {
        const priorEntries = hist.filter((h) => String(h.date || "") < todayStr);
        const prevDay = priorEntries.length > 0 ? priorEntries[priorEntries.length - 1] : null;
        const prevScanFollowers = prevDay ? Number(prevDay.followers ?? followers) : null;
        const prevScanFollowing = prevDay ? Number(prevDay.following ?? following) : null;
        const prevScanMutuals = hasMutuals && prevDay && prevDay.mutuals !== void 0 && prevDay.mutuals !== null ? Number(prevDay.mutuals) : null;
        const lastDeltaFollowers = prevScanFollowers !== null ? followers - prevScanFollowers : 0;
        const lastDeltaFollowing = prevScanFollowing !== null ? following - prevScanFollowing : 0;
        const lastDeltaMutuals = hasMutuals && prevScanMutuals !== null ? mutuals - prevScanMutuals : 0;
        let initialSummary = null;
        if (metrics.scanSummary && typeof metrics.scanSummary === "object") {
          initialSummary = {
            gained: metrics.scanSummary.gained || 0,
            lost: metrics.scanSummary.lost || 0,
            deactivated: metrics.scanSummary.deactivated || 0,
            blocked: metrics.scanSummary.blocked || 0,
            renamed: metrics.scanSummary.renamed || 0,
            lastScanGained: metrics.scanSummary.gained || 0,
            lastScanLost: metrics.scanSummary.lost || 0
          };
        }
        hist.push({
          date: todayStr,
          followers,
          following,
          ...hasMutuals ? {
            mutuals,
            startMutuals: mutuals,
            prevScanMutuals,
            lastDeltaMutuals
          } : {},
          ...metrics.fans !== void 0 ? { fans: Number(metrics.fans) } : {},
          ...metrics.notFollowingBack !== void 0 ? { notFollowingBack: Number(metrics.notFollowingBack) } : {},
          startFollowers: followers,
          startFollowing: following,
          prevScanFollowers,
          prevScanFollowing,
          lastDeltaFollowers,
          lastDeltaFollowing,
          intradayDeltaFollowers: 0,
          intradayDeltaFollowing: 0,
          dayDeltaFollowers: lastDeltaFollowers,
          dayDeltaFollowing: lastDeltaFollowing,
          scansCount: 1,
          ...initialSummary ? { scanSummary: initialSummary } : {},
          updatedAt: Utils.now()
        });
        hist.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      }
      return hist;
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
      const id = userId || Storage.getCurrentUserId();
      const payload = data && typeof data === "object" && !Array.isArray(data) && id ? { ...data, ownerUserId: String(id) } : data;
      Storage.setScopedValue(CONFIG.STORAGE_KEY, payload, id);
    },
    getWhitelist: (userId = null) => {
      const raw = Storage.getScopedValue(CONFIG.WHITELIST_KEY, [], userId);
      return Array.isArray(raw) ? raw : [];
    },
    addToWhitelist: (username, userId = null) => {
      const clean = String(username || "").replace(/^@+/, "").trim();
      if (!clean) return;
      const wl = Storage.getWhitelist(userId);
      const lower = clean.toLowerCase();
      if (!wl.some((u) => String(u || "").toLowerCase() === lower)) {
        wl.push(clean);
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, wl, userId);
      }
    },
    removeFromWhitelist: (username, userId = null) => {
      const clean = String(username || "").replace(/^@+/, "").trim().toLowerCase();
      if (!clean) return;
      const wl = Storage.getWhitelist(userId);
      const filtered = wl.filter((u) => String(u || "").toLowerCase() !== clean);
      Storage.setScopedValue(CONFIG.WHITELIST_KEY, filtered, userId);
    },
    clearWhitelist: (userId = null) => {
      Storage.setScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },
    getNewFollowersList: (userId = null) => {
      const raw = Storage.getScopedValue(CONFIG.NEW_FOLLOWERS_KEY, [], userId);
      const { list, modified } = Storage.normalizeItemDates(raw);
      if (modified) {
        Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
      }
      return list;
    },
    addNewFollowersEntries: (entries, userId = null) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNewFollowersList(userId);
      const dateStr = Utils.localDateStr();
      entries.forEach((item) => {
        const rawName = typeof item === "string" ? item : item?.username;
        const username = String(rawName || "").replace(/^@+/, "").trim();
        if (!username) return;
        const lowerName = username.toLowerCase();
        const itemId = typeof item === "object" && item?.id && String(item.id) !== "0" ? String(item.id) : null;
        const existingIdx = list.findIndex((x) => {
          if (itemId && x?.id && String(x.id) === itemId) return true;
          return String(x?.username || "").toLowerCase() === lowerName;
        });
        const entryObj = {
          id: itemId || (existingIdx > -1 ? list[existingIdx].id : null) || null,
          username,
          fullName: (typeof item === "object" ? item.fullName : "") || (existingIdx > -1 ? list[existingIdx].fullName : "") || "",
          profilePicUrl: (typeof item === "object" ? item.profilePicUrl : "") || (existingIdx > -1 ? list[existingIdx].profilePicUrl : "") || "",
          isVerified: typeof item === "object" && item.isVerified !== void 0 ? Boolean(item.isVerified) : Boolean(existingIdx > -1 && list[existingIdx].isVerified),
          isPrivate: typeof item === "object" && item.isPrivate !== void 0 ? Boolean(item.isPrivate) : Boolean(existingIdx > -1 && list[existingIdx].isPrivate),
          isBestie: typeof item === "object" && item.isBestie !== void 0 ? Boolean(item.isBestie) : Boolean(existingIdx > -1 && list[existingIdx].isBestie),
          followsBack: typeof item === "object" && item.followsBack !== void 0 ? item.followsBack : existingIdx > -1 ? list[existingIdx].followsBack : null,
          date: typeof item === "object" && item.date ? Utils.localDateStr(item.date) : dateStr
        };
        if (existingIdx > -1) {
          list.splice(existingIdx, 1);
        }
        list.push(entryObj);
      });
      Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
    },
    getHistory: (userId = null) => {
      const raw = Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
      const { list, modified } = Storage.normalizeHistoryRecords(raw);
      if (modified) {
        Storage.setScopedValue(CONFIG.HISTORY_KEY, list, userId);
      }
      return list;
    },
    addHistoryEntry: (followersCount, followingCount, userId = null, extraMetrics = {}) => {
      const raw = Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
      const updated = Storage.upsertHistoryRecord(raw, {
        ...extraMetrics,
        followers: followersCount,
        following: followingCount
      });
      Storage.setScopedValue(CONFIG.HISTORY_KEY, updated, userId);
      return updated;
    },
    getNominalList: (key, userId = null) => {
      const raw = Storage.getScopedValue(key, [], userId);
      const { list, modified } = Storage.normalizeItemDates(raw);
      if (modified) {
        Storage.setScopedValue(key, list, userId);
      }
      return list;
    },
    clearNominalList: (key, userId = null) => {
      if (!key) return;
      Storage.setScopedValue(key, [], userId);
    },
addNominalEntries: (key, entries, userId = null) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNominalList(key, userId);
      const dateStr = Utils.localDateStr();
      entries.forEach((item) => {
        const isObj = item && typeof item === "object";
        const rawName = isObj ? item.username : item;
        const username = String(rawName || "").replace(/^@+/, "").trim();
        if (!username) return;
        const lowerName = username.toLowerCase();
        const itemId = isObj && item.id && String(item.id) !== "0" ? String(item.id) : null;
        const existingIdx = list.findIndex((x) => {
          if (itemId && x?.id && String(x.id) === itemId) return true;
          return String(x?.username || "").toLowerCase() === lowerName;
        });
        const existing = existingIdx > -1 ? list[existingIdx] : null;
        const merged = {
          ...existing || {},
          id: itemId || existing?.id || null,
          username,
          fullName: isObj && item.fullName ? item.fullName : existing?.fullName || "",
          profilePicUrl: isObj && item.profilePicUrl ? item.profilePicUrl : existing?.profilePicUrl || null,
          isVerified: isObj && item.isVerified !== void 0 ? Boolean(item.isVerified) : Boolean(existing?.isVerified),
          isPrivate: isObj && item.isPrivate !== void 0 ? Boolean(item.isPrivate) : Boolean(existing?.isPrivate),
          ...isObj && item.previousUsername ? { previousUsername: item.previousUsername } : {},
          occurrences: existing ? (Number(existing.occurrences) || 1) + 1 : 1,
          date: isObj && item.date ? Utils.localDateStr(item.date) : dateStr
        };
        if (existingIdx > -1) {
          list.splice(existingIdx, 1);
        }
        list.push(merged);
      });
      Storage.setScopedValue(key, list, userId);
    },
    addRenamedEntries: (entries, userId = null) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNominalList(CONFIG.RENAMED_KEY, userId);
      const dateStr = Utils.localDateStr();
      entries.forEach((entry) => {
        if (!entry?.id || !entry?.oldUsername || !entry?.newUsername) return;
        const idStr = String(entry.id);
        const existsIdx = list.findIndex(
          (x) => String(x.id) === idStr && x.oldUsername === entry.oldUsername && x.newUsername === entry.newUsername
        );
        const record = {
          ...existsIdx > -1 ? list[existsIdx] : {},
          id: idStr,
          username: entry.newUsername,
          oldUsername: entry.oldUsername,
          newUsername: entry.newUsername,
          relationship: entry.relationship || (existsIdx > -1 ? list[existsIdx].relationship : null) || null,
          fullName: entry.fullName || (existsIdx > -1 ? list[existsIdx].fullName : "") || "",
          profilePicUrl: entry.profilePicUrl || (existsIdx > -1 ? list[existsIdx].profilePicUrl : null) || null,
          isVerified: entry.isVerified !== void 0 ? Boolean(entry.isVerified) : Boolean(existsIdx > -1 && list[existsIdx].isVerified),
          isPrivate: entry.isPrivate !== void 0 ? Boolean(entry.isPrivate) : Boolean(existsIdx > -1 && list[existsIdx].isPrivate),
          date: entry.date ? Utils.localDateStr(entry.date) : existsIdx > -1 ? list[existsIdx].date : dateStr
        };
        if (existsIdx > -1) {
          list[existsIdx] = record;
        } else {
          list.push(record);
        }
      });
      Storage.setScopedValue(CONFIG.RENAMED_KEY, list, userId);
    },
reconcileAudienceState: ({ followersDetailed = [], followingDetailed = [], allRenames = [] } = {}, userId = null) => {
      const followersByLower = new Map();
      const followersById = new Map();
      followersDetailed.forEach((u) => {
        if (!u?.username) return;
        followersByLower.set(u.username.toLowerCase(), u);
        if (u.id && String(u.id) !== "0") followersById.set(String(u.id), u);
      });
      const followingByLower = new Map();
      const followingById = new Map();
      followingDetailed.forEach((u) => {
        if (!u?.username) return;
        followingByLower.set(u.username.toLowerCase(), u);
        if (u.id && String(u.id) !== "0") followingById.set(String(u.id), u);
      });
      const renameByOldLower = new Map();
      const renameById = new Map();
      (allRenames || []).forEach((r) => {
        if (r?.oldUsername && r?.newUsername) {
          renameByOldLower.set(r.oldUsername.toLowerCase(), r);
        }
        if (r?.id && String(r.id) !== "0") {
          renameById.set(String(r.id), r);
        }
      });
      const rawWhitelist = Storage.getWhitelist(userId);
      let wlChanged = false;
      const wlSeen = new Set();
      const healedWhitelist = [];
      rawWhitelist.forEach((rawName) => {
        const clean = String(rawName || "").replace(/^@+/, "").trim();
        if (!clean) {
          wlChanged = true;
          return;
        }
        const ren = renameByOldLower.get(clean.toLowerCase());
        const resolved = ren ? ren.newUsername : clean;
        if (resolved !== rawName) wlChanged = true;
        const lower = resolved.toLowerCase();
        if (!wlSeen.has(lower)) {
          wlSeen.add(lower);
          healedWhitelist.push(resolved);
        } else {
          wlChanged = true;
        }
      });
      if (wlChanged) {
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, healedWhitelist, userId);
      }
      const resolveLiveAccount = (entry) => {
        const idStr = entry?.id && String(entry.id) !== "0" ? String(entry.id) : null;
        const uLower = String(entry?.username || "").toLowerCase();
        const ren = idStr && renameById.get(idStr) || renameByOldLower.get(uLower) || null;
        const candidateLower = ren ? ren.newUsername.toLowerCase() : uLower;
        const inFollower = idStr && followersById.get(idStr) || followersByLower.get(candidateLower) || followersByLower.get(uLower) || null;
        const inFollowing = idStr && followingById.get(idStr) || followingByLower.get(candidateLower) || followingByLower.get(uLower) || null;
        return { inFollower, inFollowing, rename: ren };
      };
      const reactivatedFollowersLowerSet = new Set();
      const storedDeactivated = Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId);
      let deactivatedChanged = false;
      const nextDeactivated = [];
      storedDeactivated.forEach((entry) => {
        const { inFollower, inFollowing } = resolveLiveAccount(entry);
        if (inFollower || inFollowing) {
          deactivatedChanged = true;
          if (inFollower?.username) {
            reactivatedFollowersLowerSet.add(inFollower.username.toLowerCase());
          }
        } else {
          nextDeactivated.push(entry);
        }
      });
      if (deactivatedChanged) {
        Storage.setScopedValue(CONFIG.DEACTIVATED_KEY, nextDeactivated, userId);
      }
      const storedBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY, userId);
      let blockedChanged = false;
      const nextBlocked = storedBlocked.filter((entry) => {
        const { inFollower, inFollowing } = resolveLiveAccount(entry);
        if (inFollower || inFollowing) {
          blockedChanged = true;
          return false;
        }
        return true;
      });
      if (blockedChanged) {
        Storage.setScopedValue(CONFIG.BLOCKED_KEY, nextBlocked, userId);
      }
      const storedChurn = Storage.getNominalList(CONFIG.CHURN_KEY, userId);
      let churnChanged = false;
      const nextChurn = [];
      storedChurn.forEach((entry) => {
        const { inFollower, inFollowing, rename } = resolveLiveAccount(entry);
        if (inFollower) {
          churnChanged = true;
          return;
        }
        if (inFollowing && inFollowing.username !== entry.username) {
          churnChanged = true;
          nextChurn.push({
            ...entry,
            id: inFollowing.id || entry.id || null,
            previousUsername: entry.previousUsername || entry.username,
            username: inFollowing.username,
            fullName: inFollowing.fullName || entry.fullName || "",
            profilePicUrl: inFollowing.profilePicUrl || entry.profilePicUrl || null,
            isVerified: Boolean(inFollowing.isVerified ?? entry.isVerified),
            isPrivate: Boolean(inFollowing.isPrivate ?? entry.isPrivate)
          });
        } else if (rename && rename.newUsername !== entry.username) {
          churnChanged = true;
          nextChurn.push({
            ...entry,
            id: rename.id || entry.id || null,
            previousUsername: entry.previousUsername || entry.username,
            username: rename.newUsername
          });
        } else {
          nextChurn.push(entry);
        }
      });
      if (churnChanged) {
        Storage.setScopedValue(CONFIG.CHURN_KEY, nextChurn, userId);
      }
      const storedNewFollowers = Storage.getNewFollowersList(userId);
      let nfChanged = false;
      const nfSeenLower = new Set();
      const nextNewFollowers = [];
      storedNewFollowers.forEach((entry) => {
        const { inFollower, inFollowing } = resolveLiveAccount(entry);
        if (!inFollower) {
          nfChanged = true;
          return;
        }
        const liveUsername = inFollower.username;
        const liveLower = liveUsername.toLowerCase();
        if (nfSeenLower.has(liveLower)) {
          nfChanged = true;
          return;
        }
        nfSeenLower.add(liveLower);
        const liveFollowsBack = Boolean(inFollowing);
        const liveId = inFollower.id || entry.id || null;
        const liveFullName = inFollower.fullName || inFollowing?.fullName || entry.fullName || "";
        const livePic = inFollower.profilePicUrl || inFollowing?.profilePicUrl || entry.profilePicUrl || "";
        const liveVerified = Boolean(inFollower.isVerified ?? entry.isVerified);
        const livePrivate = inFollower.isPrivateKnown !== false && inFollower.isPrivate !== void 0 && inFollower.isPrivate !== null ? Boolean(inFollower.isPrivate) : inFollowing?.isPrivateKnown !== false && typeof inFollowing?.isPrivate === "boolean" ? inFollowing.isPrivate : Boolean(entry.isPrivate);
        const liveBestie = Boolean(inFollower.isBestie ?? inFollowing?.isBestie ?? entry.isBestie);
        if (entry.username !== liveUsername || entry.id !== liveId || entry.followsBack !== liveFollowsBack || entry.fullName !== liveFullName || entry.profilePicUrl !== livePic || entry.isVerified !== liveVerified || entry.isPrivate !== livePrivate || entry.isBestie !== liveBestie) {
          nfChanged = true;
        }
        nextNewFollowers.push({
          ...entry,
          id: liveId,
          username: liveUsername,
          fullName: liveFullName,
          profilePicUrl: livePic,
          isVerified: liveVerified,
          isPrivate: livePrivate,
          isBestie: liveBestie,
          followsBack: liveFollowsBack
        });
      });
      if (nfChanged) {
        Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, nextNewFollowers, userId);
      }
      return {
        whitelist: healedWhitelist,
        reactivatedFollowersLowerSet
      };
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
    mergeTargetEntriesById: (olderEntry = {}, newerEntry = {}) => {
      const oldUser = olderEntry?.user || {};
      const newUser = newerEntry?.user || {};
      const oldHandle = String(oldUser.username || olderEntry?.username || "").replace(/^@+\s*/, "").trim();
      const newHandle = String(newUser.username || newerEntry?.username || oldHandle || "").replace(/^@+\s*/, "").trim();
      const newLower = newHandle.toLowerCase();
      const prevNames = Utils.unique([
        ...Array.isArray(oldUser.previousUsernames) ? oldUser.previousUsernames : [],
        ...oldUser.previousUsername ? [oldUser.previousUsername] : [],
        ...Array.isArray(newUser.previousUsernames) ? newUser.previousUsernames : [],
        ...newUser.previousUsername ? [newUser.previousUsername] : [],
        ...oldHandle && oldHandle.toLowerCase() !== newLower ? [oldHandle] : []
      ].map((n) => String(n || "").replace(/^@+\s*/, "").trim()).filter((n) => n && n.toLowerCase() !== newLower));
      const previousUsername = prevNames.length > 0 ? prevNames[prevNames.length - 1] : null;
      const oldHist = Storage.normalizeHistoryRecords(Array.isArray(olderEntry?.history) ? olderEntry.history : []).list;
      const newHist = Storage.normalizeHistoryRecords(Array.isArray(newerEntry?.history) ? newerEntry.history : []).list;
      const histByDate = new Map();
      oldHist.forEach((h) => {
        if (h?.date) histByDate.set(h.date, { ...h });
      });
      newHist.forEach((h) => {
        if (!h?.date) return;
        if (!histByDate.has(h.date)) {
          histByDate.set(h.date, { ...h });
        } else {
          const prev = histByDate.get(h.date);
          const startF = Number(prev.startFollowers ?? prev.followers ?? h.startFollowers ?? h.followers ?? 0);
          const startIng = Number(prev.startFollowing ?? prev.following ?? h.startFollowing ?? h.following ?? 0);
          const startMut = prev.startMutuals !== void 0 && prev.startMutuals !== null ? Number(prev.startMutuals) : prev.mutuals !== void 0 && prev.mutuals !== null ? Number(prev.mutuals) : h.startMutuals;
          const currF = Number(h.followers ?? prev.followers ?? 0);
          const currIng = Number(h.following ?? prev.following ?? 0);
          const currMut = h.mutuals !== void 0 && h.mutuals !== null ? Number(h.mutuals) : prev.mutuals;
          histByDate.set(h.date, {
            ...prev,
            ...h,
            followers: currF,
            following: currIng,
            ...currMut !== void 0 && currMut !== null ? { mutuals: currMut } : {},
            startFollowers: startF,
            startFollowing: startIng,
            ...startMut !== void 0 && startMut !== null ? { startMutuals: startMut } : {},
            lastDeltaFollowers: currF - Number(prev.followers ?? startF),
            lastDeltaFollowing: currIng - Number(prev.following ?? startIng),
            scansCount: (Number(prev.scansCount) || 1) + (Number(h.scansCount) || 1),
            updatedAt: h.updatedAt || prev.updatedAt || Utils.now()
          });
        }
      });
      const mergedHistory = Storage.normalizeHistoryRecords(Array.from(histByDate.values())).list;
      for (let i = 0; i < mergedHistory.length; i++) {
        const cur = mergedHistory[i];
        const prevDay = i > 0 ? mergedHistory[i - 1] : null;
        cur.dayDeltaFollowers = prevDay ? cur.followers - prevDay.followers : cur.followers - Number(cur.startFollowers ?? cur.followers);
        cur.dayDeltaFollowing = prevDay ? cur.following - prevDay.following : cur.following - Number(cur.startFollowing ?? cur.following);
      }
      const oldFollowers = Utils.toDetailedUserArray(olderEntry?.followers || []);
      const oldFollowing = Utils.toDetailedUserArray(olderEntry?.following || []);
      const oldMutuals = Utils.toDetailedUserArray(olderEntry?.mutuals || []);
      const newFollowersList = Utils.toDetailedUserArray(newerEntry?.followers || []);
      const newFollowingList = Utils.toDetailedUserArray(newerEntry?.following || []);
      const newMutualsList = Utils.toDetailedUserArray(newerEntry?.mutuals || []);
      const hasNewNetwork = newFollowersList.length > 0 || newFollowingList.length > 0;
      const hasOldNetwork = oldFollowers.length > 0 || oldFollowing.length > 0;
      let newFollowersDiff = Utils.toDetailedUserArray(newerEntry?.newFollowers || []);
      let lostFollowersDiff = Utils.toDetailedUserArray(newerEntry?.lostFollowers || []);
      let newMutualsDiff = Utils.toDetailedUserArray(newerEntry?.newMutuals || []);
      let newFollowingDiff = Utils.toDetailedUserArray(newerEntry?.newFollowing || []);
      let lostFollowingDiff = Utils.toDetailedUserArray(newerEntry?.lostFollowing || []);
      let lastAuditDelta = newerEntry?.lastAuditDelta || olderEntry?.lastAuditDelta || null;
      const newerHadNoDiffs = newFollowersDiff.length === 0 && lostFollowersDiff.length === 0 && newMutualsDiff.length === 0;
      if (hasNewNetwork && hasOldNetwork && newerHadNoDiffs) {
        const auditDateStr = Utils.localDateStr(newerEntry?.lastAuditAt || newerEntry?.updatedAt || Utils.now());
        const followerRenames = Utils.detectRenamedUsers(oldFollowers, newFollowersList);
        const followingRenames = Utils.detectRenamedUsers(oldFollowing, newFollowingList);
        const mutualRenames = Utils.detectRenamedUsers(oldMutuals, newMutualsList);
        const fRenOld = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
        const fRenNew = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
        const ingRenOld = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
        const ingRenNew = new Set(followingRenames.map((r) => r.newUsername.toLowerCase()));
        const mutRenNew = new Set(mutualRenames.map((r) => r.newUsername.toLowerCase()));
        const oldFByLower = new Map(oldFollowers.map((u) => [u.username.toLowerCase(), u]));
        const oldFIds = new Set(oldFollowers.map((u) => u.id ? String(u.id) : null).filter(Boolean));
        const newFByLower = new Map(newFollowersList.map((u) => [u.username.toLowerCase(), u]));
        const newFIds = new Set(newFollowersList.map((u) => u.id ? String(u.id) : null).filter(Boolean));
        const oldIngByLower = new Map(oldFollowing.map((u) => [u.username.toLowerCase(), u]));
        const oldIngIds = new Set(oldFollowing.map((u) => u.id ? String(u.id) : null).filter(Boolean));
        const newIngByLower = new Map(newFollowingList.map((u) => [u.username.toLowerCase(), u]));
        const newIngIds = new Set(newFollowingList.map((u) => u.id ? String(u.id) : null).filter(Boolean));
        const oldMutLower = new Set(oldMutuals.map((u) => u.username.toLowerCase()));
        const oldMutIds = new Set(oldMutuals.map((u) => u.id ? String(u.id) : null).filter(Boolean));
        const computedNewF = newFollowersList.filter((u) => {
          const lower = u.username.toLowerCase();
          if (u.id && oldFIds.has(String(u.id))) return false;
          return !oldFByLower.has(lower) && !fRenNew.has(lower);
        }).map((u) => ({ ...u, date: auditDateStr }));
        const computedLostF = oldFollowers.filter((u) => {
          const lower = u.username.toLowerCase();
          if (u.id && newFIds.has(String(u.id))) return false;
          return !newFByLower.has(lower) && !fRenOld.has(lower);
        }).map((u) => ({ ...u, date: auditDateStr }));
        const computedNewIng = newFollowingList.filter((u) => {
          const lower = u.username.toLowerCase();
          if (u.id && oldIngIds.has(String(u.id))) return false;
          return !oldIngByLower.has(lower) && !ingRenNew.has(lower);
        }).map((u) => ({ ...u, date: auditDateStr }));
        const computedLostIng = oldFollowing.filter((u) => {
          const lower = u.username.toLowerCase();
          if (u.id && newIngIds.has(String(u.id))) return false;
          return !newIngByLower.has(lower) && !ingRenOld.has(lower);
        }).map((u) => ({ ...u, date: auditDateStr }));
        const computedNewMut = newMutualsList.filter((u) => {
          const lower = u.username.toLowerCase();
          if (u.id && oldMutIds.has(String(u.id))) return false;
          return !oldMutLower.has(lower) && !mutRenNew.has(lower);
        }).map((u) => ({ ...u, date: auditDateStr }));
        newFollowersDiff = Utils.toDetailedUserArray([...(olderEntry?.newFollowers || []).filter((u) => newFByLower.has(u.username.toLowerCase())), ...computedNewF]);
        lostFollowersDiff = Utils.toDetailedUserArray([...(olderEntry?.lostFollowers || []).filter((u) => !newFByLower.has(u.username.toLowerCase())), ...computedLostF]);
        newMutualsDiff = Utils.toDetailedUserArray([...(olderEntry?.newMutuals || []).filter((u) => newMutualsList.some((m) => m.username.toLowerCase() === u.username.toLowerCase())), ...computedNewMut]);
        newFollowingDiff = Utils.toDetailedUserArray([...(olderEntry?.newFollowing || []).filter((u) => newIngByLower.has(u.username.toLowerCase())), ...computedNewIng]);
        lostFollowingDiff = Utils.toDetailedUserArray([...(olderEntry?.lostFollowing || []).filter((u) => !newIngByLower.has(u.username.toLowerCase())), ...computedLostIng]);
        lastAuditDelta = {
          gainedFollowers: computedNewF.length,
          lostFollowers: computedLostF.length,
          gainedFollowing: computedNewIng.length,
          lostFollowing: computedLostIng.length,
          newMutuals: computedNewMut.length,
          renamed: followerRenames.length + followingRenames.length
        };
      } else if (!hasNewNetwork && hasOldNetwork) {
        newFollowersDiff = Utils.toDetailedUserArray(olderEntry?.newFollowers || []);
        lostFollowersDiff = Utils.toDetailedUserArray(olderEntry?.lostFollowers || []);
        newMutualsDiff = Utils.toDetailedUserArray(olderEntry?.newMutuals || []);
        newFollowingDiff = Utils.toDetailedUserArray(olderEntry?.newFollowing || []);
        lostFollowingDiff = Utils.toDetailedUserArray(olderEntry?.lostFollowing || []);
      }
      const mergedUser = {
        ...oldUser,
        ...newUser,
        id: String(newUser.id || oldUser.id || ""),
        username: newHandle,
        ...previousUsername ? { previousUsername, previousUsernames: prevNames } : {}
      };
      return {
        ...olderEntry,
        ...newerEntry,
        user: mergedUser,
        username: newLower,
        followers: hasNewNetwork ? newFollowersList : oldFollowers,
        following: hasNewNetwork ? newFollowingList : oldFollowing,
        mutuals: hasNewNetwork ? newMutualsList : oldMutuals,
        newFollowers: newFollowersDiff,
        lostFollowers: lostFollowersDiff,
        newMutuals: newMutualsDiff,
        newFollowing: newFollowingDiff,
        lostFollowing: lostFollowingDiff,
        lastAuditDelta,
        history: mergedHistory,
        lastAuditAt: newerEntry?.lastAuditAt || olderEntry?.lastAuditAt || Utils.now(),
        updatedAt: newerEntry?.updatedAt || olderEntry?.updatedAt || Utils.now()
      };
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
            return;
          }
          if (item && Array.isArray(item.history) && item.history.length > 0) {
            const { list: healedHist, modified: histMod } = Storage.normalizeHistoryRecords(item.history);
            if (histMod) {
              item.history = healedHist;
              modified = true;
            }
          }
        });
        const keysById = new Map();
        Object.keys(map).forEach((k) => {
          const item = map[k];
          const rawId = item?.user?.id;
          const idStr = rawId !== null && rawId !== void 0 && String(rawId).trim() !== "" && String(rawId) !== "0" && String(rawId) !== "null" ? String(rawId).trim() : null;
          if (!idStr) return;
          if (!keysById.has(idStr)) keysById.set(idStr, []);
          keysById.get(idStr).push(k);
        });
        keysById.forEach((groupKeys) => {
          if (groupKeys.length > 1) {
            const sortedKeys = groupKeys.slice().sort((a, b) => {
              const tA = new Date(map[a]?.lastAuditAt || map[a]?.updatedAt || 0).getTime() || 0;
              const tB = new Date(map[b]?.lastAuditAt || map[b]?.updatedAt || 0).getTime() || 0;
              return tA - tB;
            });
            let merged = map[sortedKeys[0]];
            for (let i = 1; i < sortedKeys.length; i++) {
              merged = Storage.mergeTargetEntriesById(merged, map[sortedKeys[i]]);
            }
            const canonicalKey = String(merged?.user?.username || merged?.username || sortedKeys[sortedKeys.length - 1]).replace(/^@+\s*/, "").toLowerCase().trim();
            sortedKeys.forEach((k) => delete map[k]);
            map[canonicalKey] = {
              ...merged,
              username: canonicalKey
            };
            modified = true;
          } else if (groupKeys.length === 1) {
            const k = groupKeys[0];
            const item = map[k];
            const liveUsername = String(item?.user?.username || "").replace(/^@+\s*/, "").trim();
            const liveKey = liveUsername.toLowerCase();
            if (liveKey && liveKey !== k) {
              const prevNames = Utils.unique([
                ...Array.isArray(item.user?.previousUsernames) ? item.user.previousUsernames : [],
                ...item.user?.previousUsername ? [item.user.previousUsername] : [],
                k
              ].filter((n) => n && String(n).toLowerCase() !== liveKey));
              delete map[k];
              map[liveKey] = {
                ...item,
                username: liveKey,
                user: {
                  ...item.user,
                  username: liveUsername,
                  ...prevNames.length > 0 ? { previousUsername: prevNames[prevNames.length - 1], previousUsernames: prevNames } : {}
                }
              };
              modified = true;
            }
          }
        });
        if (modified) {
          Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
        }
      }
      return map;
    },
    getTargetData: (username, userId = null, targetId = null) => {
      let rawName = username;
      let resolvedTargetId = targetId;
      if (username && typeof username === "object") {
        rawName = username.username || "";
        resolvedTargetId = resolvedTargetId || username.id || null;
      }
      const clean = String(rawName || "").replace(/^@+\s*/, "").toLowerCase().trim();
      const cleanId = resolvedTargetId !== null && resolvedTargetId !== void 0 && String(resolvedTargetId).trim() !== "" && String(resolvedTargetId) !== "0" && String(resolvedTargetId) !== "null" ? String(resolvedTargetId).trim() : null;
      const map = Storage.getTargetTrackerMap(userId);
      if (clean && map[clean]) {
        return map[clean];
      }
      if (map && typeof map === "object") {
        for (const entry of Object.values(map)) {
          if (!entry) continue;
          const entryId = entry?.user?.id ? String(entry.user.id).trim() : null;
          if (cleanId && entryId && entryId === cleanId) {
            return entry;
          }
          if (clean) {
            const prevSingle = String(entry?.user?.previousUsername || "").toLowerCase().trim();
            const prevList = Array.isArray(entry?.user?.previousUsernames) ? entry.user.previousUsernames.map((n) => String(n || "").toLowerCase().trim()) : [];
            if (prevSingle === clean || prevList.includes(clean)) {
              return entry;
            }
          }
        }
      }
      return null;
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
      const incomingId = data?.user?.id && String(data.user.id) !== "0" && String(data.user.id) !== "null" ? String(data.user.id).trim() : null;
      let mergedPayload = {
        ...data,
        username: clean,
        updatedAt: Utils.now()
      };
      if (incomingId) {
        Object.keys(map).forEach((existingKey) => {
          if (existingKey === clean) return;
          const existingEntry = map[existingKey];
          const existingId = existingEntry?.user?.id ? String(existingEntry.user.id).trim() : null;
          if (existingId && existingId === incomingId) {
            mergedPayload = Storage.mergeTargetEntriesById(existingEntry, mergedPayload);
            delete map[existingKey];
          }
        });
      }
      map[clean] = mergedPayload;
      const keys = Object.keys(map);
      if (keys.length > 5) {
        keys.sort((a, b) => new Date(map[b].updatedAt).getTime() - new Date(map[a].updatedAt).getTime());
        const keysToRemove = keys.slice(5);
        keysToRemove.forEach((k) => delete map[k]);
      }
      Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
    },
    removeTargetData: (username, userId = null, targetId = null) => {
      const clean = String(username || "").replace(/^@+\s*/, "").toLowerCase().trim();
      const cleanId = targetId && String(targetId) !== "0" && String(targetId) !== "null" ? String(targetId).trim() : null;
      const map = Storage.getTargetTrackerMap(userId);
      let modified = false;
      if (clean && map[clean]) {
        delete map[clean];
        modified = true;
      }
      if (cleanId && map && typeof map === "object") {
        Object.keys(map).forEach((k) => {
          if (String(map[k]?.user?.id || "") === cleanId) {
            delete map[k];
            modified = true;
          }
        });
      }
      if (modified) {
        Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
      }
    },
    deleteTargetData: (username, userId = null, targetId = null) => {
      return Storage.removeTargetData(username, userId, targetId);
    },
    hydrateUsersFromMemory: (currentUsers = [], prevUsers = [], options = {}) => {
      const normalized = Utils.toDetailedUserArray(currentUsers);
      if (normalized.length === 0) return [];
      const knownById = new Map();
      const knownByLower = new Map();
      const indexKnown = (candidate) => {
        if (!candidate || typeof candidate !== "object" || !candidate.username) return;
        const idStr = candidate.id && String(candidate.id) !== "0" && String(candidate.id) !== "null" && String(candidate.id) !== "undefined" ? String(candidate.id).trim() : null;
        const lower = String(candidate.username).toLowerCase().trim();
        if (!lower) return;
        const existing = idStr && knownById.get(idStr) || knownByLower.get(lower) || null;
        const incPrivKnown = candidate.isPrivateKnown !== false && typeof candidate.isPrivate === "boolean";
        const extPrivKnown = Boolean(existing && existing.isPrivateKnown !== false && typeof existing.isPrivate === "boolean");
        const merged = existing ? {
          ...existing,
          ...candidate,
          id: idStr || existing.id || null,
          isPrivate: incPrivKnown ? candidate.isPrivate : extPrivKnown ? existing.isPrivate : Boolean(candidate.isPrivate ?? existing.isPrivate),
          isPrivateKnown: Boolean(incPrivKnown || extPrivKnown),
          isBestie: Boolean(candidate.isBestie || existing.isBestie),
          outgoingRequest: Boolean(candidate.outgoingRequest || existing.outgoingRequest),
          latestReelMedia: Number(candidate.latestReelMedia) > 0 ? Number(candidate.latestReelMedia) : Number(existing.latestReelMedia) || 0,
          isBusiness: candidate.isBusiness !== void 0 ? candidate.isBusiness : existing.isBusiness,
          isCreator: candidate.isCreator !== void 0 ? candidate.isCreator : existing.isCreator,
          category: candidate.category || existing.category
        } : candidate;
        if (idStr) knownById.set(idStr, merged);
        knownByLower.set(lower, merged);
      };
      const snap = Storage.load(options.userId || null);
      if (snap && typeof snap === "object") {
        [
          snap.followersDetailed,
          snap.followingDetailed,
          snap.mutualsDetailed,
          snap.fansDetailed,
          snap.notFollowingBackDetailed,
          snap.newFollowersDetailed
        ].forEach((pool) => {
          if (Array.isArray(pool)) pool.forEach(indexKnown);
        });
      }
      if (Array.isArray(prevUsers)) {
        Utils.toDetailedUserArray(prevUsers).forEach(indexKnown);
      }
      let preserveRecentStories = false;
      if (options.prevScanAt) {
        const prevMs = new Date(options.prevScanAt).getTime();
        if (!Number.isNaN(prevMs) && prevMs > 0) {
          const ageMs = Date.now() - prevMs;
          preserveRecentStories = ageMs >= 0 && ageMs < 6 * 3600 * 1e3;
        }
      }
      const friendshipCache = options.friendshipCache instanceof Map ? options.friendshipCache : null;
      return normalized.map((u) => {
        const idStr = u.id && String(u.id) !== "0" ? String(u.id) : null;
        const prev = idStr && knownById.get(idStr) || knownByLower.get(u.username.toLowerCase()) || null;
        const cachedStatus = idStr && friendshipCache ? friendshipCache.get(idStr) : null;
        if (!u.isPrivateKnown) {
          if (cachedStatus && typeof cachedStatus.isPrivate === "boolean") {
            u.isPrivate = cachedStatus.isPrivate;
            u.isPrivateKnown = true;
          } else if (prev && prev.isPrivateKnown !== false && typeof prev.isPrivate === "boolean") {
            u.isPrivate = prev.isPrivate;
            u.isPrivateKnown = true;
          }
        }
        if (!u.isBestie && (cachedStatus?.isBestie || prev?.isBestie)) {
          u.isBestie = true;
        }
        if (!u.outgoingRequest && (cachedStatus?.outgoingRequest || prev?.outgoingRequest)) {
          u.outgoingRequest = true;
        }
        if ((!u.latestReelMedia || u.latestReelMedia === 0) && preserveRecentStories && Number(prev?.latestReelMedia) > 0) {
          u.latestReelMedia = Number(prev.latestReelMedia);
        }
        if (u.isBusiness === void 0 && (cachedStatus?.isBusiness !== void 0 || prev?.isBusiness !== void 0)) {
          u.isBusiness = Boolean(cachedStatus?.isBusiness ?? prev?.isBusiness);
        }
        if (u.isCreator === void 0 && (cachedStatus?.isCreator !== void 0 || prev?.isCreator !== void 0)) {
          u.isCreator = Boolean(cachedStatus?.isCreator ?? prev?.isCreator);
        }
        if (!u.category && prev?.category) {
          u.category = String(prev.category);
        }
        return u;
      });
    },
    syncFreshUserData: (freshUsersArray, userId = null) => {
      if (!Array.isArray(freshUsersArray) || freshUsersArray.length === 0) return;
      const freshMap = new Map();
      freshUsersArray.forEach((u) => {
        const username = typeof u === "string" ? u : u?.username;
        if (username) {
          freshMap.set(String(username).toLowerCase(), u);
        }
      });
      const newFollowers = Storage.getNewFollowersList(userId);
      let newFollowersChanged = false;
      if (Array.isArray(newFollowers) && newFollowers.length > 0) {
        newFollowers.forEach((entry) => {
          const cleanUser = String(entry.username || "").toLowerCase();
          const fresh = freshMap.get(cleanUser);
          if (fresh) {
            if (fresh.profilePicUrl && fresh.profilePicUrl !== entry.profilePicUrl) {
              entry.profilePicUrl = fresh.profilePicUrl;
              newFollowersChanged = true;
            }
            if (fresh.fullName && fresh.fullName !== entry.fullName) {
              entry.fullName = fresh.fullName;
              newFollowersChanged = true;
            }
            if (fresh.isVerified !== void 0 && entry.isVerified !== Boolean(fresh.isVerified)) {
              entry.isVerified = Boolean(fresh.isVerified);
              newFollowersChanged = true;
            }
            const hasFreshPrivate = fresh.isPrivateKnown !== false && fresh.isPrivate !== void 0 && fresh.isPrivate !== null || fresh.isPrivate === true;
            if (hasFreshPrivate && entry.isPrivate !== Boolean(fresh.isPrivate)) {
              entry.isPrivate = Boolean(fresh.isPrivate);
              newFollowersChanged = true;
            }
            if (fresh.isBestie !== void 0 && entry.isBestie !== Boolean(fresh.isBestie)) {
              entry.isBestie = Boolean(fresh.isBestie);
              newFollowersChanged = true;
            }
            if (fresh.followsBack !== void 0 && entry.followsBack !== fresh.followsBack) {
              entry.followsBack = fresh.followsBack;
              newFollowersChanged = true;
            }
          }
        });
        if (newFollowersChanged) {
          Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, newFollowers, userId);
        }
      }
      const snap = Storage.load(userId);
      if (snap) {
        let snapChanged = false;
        const syncList = (list) => {
          if (!Array.isArray(list)) return;
          list.forEach((item) => {
            const uName = typeof item === "string" ? item : item?.username;
            if (!uName) return;
            const fresh = freshMap.get(String(uName).toLowerCase());
            if (fresh && typeof item === "object") {
              if (fresh.profilePicUrl && fresh.profilePicUrl !== item.profilePicUrl) {
                item.profilePicUrl = fresh.profilePicUrl;
                snapChanged = true;
              }
              if (fresh.fullName && fresh.fullName !== item.fullName) {
                item.fullName = fresh.fullName;
                snapChanged = true;
              }
              if (fresh.isPrivateKnown !== false && fresh.isPrivate !== void 0 && fresh.isPrivate !== null && item.isPrivate !== Boolean(fresh.isPrivate)) {
                item.isPrivate = Boolean(fresh.isPrivate);
                item.isPrivateKnown = true;
                snapChanged = true;
              }
              if (fresh.isBestie && !item.isBestie) {
                item.isBestie = true;
                snapChanged = true;
              }
              if (fresh.outgoingRequest && !item.outgoingRequest) {
                item.outgoingRequest = true;
                snapChanged = true;
              }
            }
          });
        };
        syncList(snap.followersDetailed);
        syncList(snap.followingDetailed);
        syncList(snap.mutualsDetailed);
        syncList(snap.fansDetailed);
        syncList(snap.notFollowingBackDetailed);
        syncList(snap.newFollowersDetailed);
        if (snapChanged) {
          Storage.save(snap, userId);
        }
      }
    },
    syncTargetUsersData: (targetUsername, freshUsersArray = [], userId = null) => {
      if (!Array.isArray(freshUsersArray) || freshUsersArray.length === 0) return;
      Storage.syncFreshUserData(freshUsersArray, userId);
      const cleanTarget = String(targetUsername || "").replace(/^@+\s*/, "").toLowerCase().trim();
      if (!cleanTarget) return;
      const targetMap = Storage.getTargetTrackerMap(userId);
      if (!targetMap || typeof targetMap !== "object") return;
      let matchedKey = targetMap[cleanTarget] ? cleanTarget : null;
      if (!matchedKey) {
        matchedKey = Object.keys(targetMap).find((k) => {
          const entry = targetMap[k];
          if (!entry) return false;
          if (String(entry.username || "").toLowerCase().trim() === cleanTarget) return true;
          if (String(entry.user?.username || "").toLowerCase().trim() === cleanTarget) return true;
          return false;
        }) || null;
      }
      const tData = matchedKey ? targetMap[matchedKey] : null;
      if (!tData || typeof tData !== "object") return;
      const freshById = new Map();
      const freshByLower = new Map();
      freshUsersArray.forEach((u) => {
        if (!u || typeof u !== "object") return;
        if (u.id && String(u.id) !== "0") freshById.set(String(u.id), u);
        if (u.username) freshByLower.set(String(u.username).toLowerCase(), u);
      });
      let targetChanged = false;
      const syncTargetList = (list) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (!item || typeof item !== "object") return;
          const match = item.id && freshById.get(String(item.id)) || (item.username ? freshByLower.get(String(item.username).toLowerCase()) : null);
          if (!match) return;
          if (match.isPrivateKnown !== false && typeof match.isPrivate === "boolean") {
            if (item.isPrivate !== match.isPrivate || item.isPrivateKnown !== true) {
              item.isPrivate = match.isPrivate;
              item.isPrivateKnown = true;
              targetChanged = true;
            }
          }
          if (typeof match.isBestie === "boolean" && item.isBestie !== match.isBestie) {
            item.isBestie = match.isBestie;
            targetChanged = true;
          }
          if (typeof match.outgoingRequest === "boolean" && item.outgoingRequest !== match.outgoingRequest) {
            item.outgoingRequest = match.outgoingRequest;
            targetChanged = true;
          }
        });
      };
      syncTargetList(tData.followers);
      syncTargetList(tData.following);
      syncTargetList(tData.mutuals);
      syncTargetList(tData.newFollowers);
      syncTargetList(tData.lostFollowers);
      syncTargetList(tData.newMutuals);
      if (targetChanged) {
        targetMap[matchedKey] = tData;
        Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, targetMap, userId);
      }
    },
    updateUserProfile: (username, updates = {}, userId = null) => {
      if (!username || typeof updates !== "object") return;
      const cleanUser = String(username).replace(/^@+/, "").toLowerCase().trim();
      if (!cleanUser) return;
      const newFollowers = Storage.getNewFollowersList(userId);
      let nfChanged = false;
      if (Array.isArray(newFollowers)) {
        const entry = newFollowers.find((x) => String(x.username || "").toLowerCase() === cleanUser);
        if (entry) {
          Object.assign(entry, updates);
          nfChanged = true;
        }
        if (nfChanged) {
          Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, newFollowers, userId);
        }
      }
      const snap = Storage.load(userId);
      if (snap) {
        let snapChanged = false;
        const updateInList = (list) => {
          if (!Array.isArray(list)) return;
          const match = list.find((x) => typeof x === "object" && String(x.username || "").toLowerCase() === cleanUser);
          if (match) {
            Object.assign(match, updates);
            snapChanged = true;
          }
        };
        updateInList(snap.followersDetailed);
        updateInList(snap.followingDetailed);
        updateInList(snap.mutualsDetailed);
        updateInList(snap.fansDetailed);
        updateInList(snap.notFollowingBackDetailed);
        updateInList(snap.newFollowersDetailed);
        if (snapChanged) {
          Storage.save(snap, userId);
        }
      }
      const targetMap = Storage.getTargetTrackerMap(userId);
      if (targetMap && typeof targetMap === "object") {
        let targetChanged = false;
        Object.values(targetMap).forEach((tData) => {
          if (!tData) return;
          if (String(tData.username || "").toLowerCase() === cleanUser && tData.user) {
            Object.assign(tData.user, updates);
            targetChanged = true;
          }
          const updateInTargetList = (tList) => {
            if (!Array.isArray(tList)) return;
            const match = tList.find((x) => typeof x === "object" && String(x.username || "").toLowerCase() === cleanUser);
            if (match) {
              Object.assign(match, updates);
              targetChanged = true;
            }
          };
          updateInTargetList(tData.followers);
          updateInTargetList(tData.following);
          updateInTargetList(tData.mutuals);
          updateInTargetList(tData.newFollowers);
          updateInTargetList(tData.newMutuals);
        });
        if (targetChanged) {
          Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, targetMap, userId);
        }
      }
      [CONFIG.CHURN_KEY, CONFIG.DEACTIVATED_KEY, CONFIG.BLOCKED_KEY, CONFIG.RENAMED_KEY].forEach((listKey) => {
        const list = Storage.getNominalList(listKey, userId);
        if (!Array.isArray(list) || list.length === 0) return;
        let listChanged = false;
        list.forEach((entry) => {
          if (!entry || typeof entry !== "object") return;
          const entryName = String(entry.newUsername || entry.username || "").toLowerCase();
          if (entryName === cleanUser) {
            Object.assign(entry, updates);
            listChanged = true;
          }
        });
        if (listChanged) {
          Storage.setScopedValue(listKey, list, userId);
        }
      });
    },
findKnownUserByUsername: (username, userId = null) => {
      const cleanUser = String(username || "").replace(/^@+\s*/, "").trim().toLowerCase();
      if (!cleanUser) return null;
      let bestMatch = null;
      const consider = (candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const cName = String(candidate.newUsername || candidate.username || "").toLowerCase();
        const cOld = String(candidate.oldUsername || candidate.previousUsername || "").toLowerCase();
        if (cName !== cleanUser && cOld !== cleanUser) return false;
        const normalized = {
          ...candidate,
          username: candidate.newUsername || candidate.username || cleanUser
        };
        if (!bestMatch) {
          bestMatch = normalized;
        } else {
          bestMatch = {
            ...bestMatch,
            ...normalized,
            id: normalized.id && String(normalized.id) !== "0" ? String(normalized.id) : bestMatch.id,
            fullName: normalized.fullName || bestMatch.fullName || "",
            profilePicUrl: normalized.profilePicUrl || bestMatch.profilePicUrl || null
          };
        }
        return Boolean(bestMatch?.id && String(bestMatch.id) !== "0");
      };
      try {
        const activeId = Storage.getCurrentUserId();
        if ((!userId || String(userId) === String(activeId)) && typeof window !== "undefined" && Array.isArray(window.__igLastResults)) {
          for (const item of window.__igLastResults) {
            if (consider(item)) return bestMatch;
          }
        }
      } catch (e) {
      }
      const snap = Storage.load(userId);
      if (snap && typeof snap === "object") {
        const detailedPools = [
          snap.followersDetailed,
          snap.followingDetailed,
          snap.mutualsDetailed,
          snap.fansDetailed,
          snap.notFollowingBackDetailed,
          snap.newFollowersDetailed
        ];
        for (const pool of detailedPools) {
          if (!Array.isArray(pool)) continue;
          for (const item of pool) {
            if (consider(item)) return bestMatch;
          }
        }
      }
      const nominalPools = [
        Storage.getNewFollowersList(userId),
        Storage.getNominalList(CONFIG.CHURN_KEY, userId),
        Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId),
        Storage.getNominalList(CONFIG.BLOCKED_KEY, userId),
        Storage.getNominalList(CONFIG.RENAMED_KEY, userId)
      ];
      for (const pool of nominalPools) {
        if (!Array.isArray(pool)) continue;
        for (const item of pool) {
          if (consider(item)) return bestMatch;
        }
      }
      const targetMap = Storage.getTargetTrackerMap(userId);
      if (targetMap && typeof targetMap === "object") {
        for (const tData of Object.values(targetMap)) {
          if (!tData) continue;
          if (tData.user && consider(tData.user)) return bestMatch;
          const tPools = [tData.followers, tData.following, tData.mutuals, tData.newFollowers, tData.lostFollowers];
          for (const pool of tPools) {
            if (!Array.isArray(pool)) continue;
            for (const item of pool) {
              if (consider(item)) return bestMatch;
            }
          }
        }
      }
      return bestMatch;
    },
    resetAll: (userId = null) => {
      const id = userId || Storage.getCurrentUserId();
      ACCOUNT_SCOPED_KEYS.forEach((k) => {
        if (id) {
          GM_deleteValue(`${k}_${id}`);
        }
        const legacyVal = GM_getValue(k, void 0);
        if (legacyVal !== void 0 && legacyVal !== null) {
          const legacyOwner = legacyVal && typeof legacyVal === "object" && !Array.isArray(legacyVal) && legacyVal.ownerUserId ? String(legacyVal.ownerUserId) : null;
          if (!legacyOwner || !id || legacyOwner === String(id)) {
            GM_deleteValue(k);
          }
        }
      });
    }
  };
  const API = {
    friendshipCache: new Map(),
    hdAvatarCache: new Map(),
    rateLimitBuckets: new Map()
  };
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage) {
      sessionStorage.removeItem(CONFIG.RATE_LIMIT_STATE_KEY || "ig_rate_limit_buckets_v1");
    }
  } catch (_e) {
  }
  Object.assign(API, {
    getRateLimitBucket: (urlOrBucket = "") => {
      const raw = String(urlOrBucket || "");
      if (!raw) return "general";
      if (raw === "global" || raw === "friendships:followers" || raw === "friendships:following" || raw === "graphql" || raw === "web_profile_info" || raw === "general") {
        return raw;
      }
      if (raw.includes("/api/v1/friendships/")) {
        if (raw.includes("/followers")) return "friendships:followers";
        if (raw.includes("/following")) return "friendships:following";
        return "friendships:other";
      }
      if (raw.includes("/graphql/query") || raw.includes("/api/graphql")) {
        return "graphql";
      }
      if (raw.includes("/users/web_profile_info")) {
        return "web_profile_info";
      }
      return "general";
    },
    tripRateLimit: (urlOrBucket, cooldownMs = CONFIG.RATE_LIMIT_CIRCUIT_MS, isGlobal = false) => {
      if (!(API.rateLimitBuckets instanceof Map)) {
        API.rateLimitBuckets = new Map();
      }
      const bucket = API.getRateLimitBucket(urlOrBucket);
      const duration = Math.max(1e3, Number(cooldownMs) || CONFIG.RATE_LIMIT_CIRCUIT_MS);
      const until = Date.now() + duration;
      API.rateLimitBuckets.set(bucket, until);
      if (isGlobal) {
        API.rateLimitBuckets.set("global", until);
      }
      return { bucket, until, remainingMs: duration };
    },
    getRateLimitRemainingMs: (urlOrBucket = "global") => {
      if (!(API.rateLimitBuckets instanceof Map)) {
        API.rateLimitBuckets = new Map();
        return 0;
      }
      const now = Date.now();
      const bucket = API.getRateLimitBucket(urlOrBucket);
      const globalUntil = API.rateLimitBuckets.get("global") || 0;
      const bucketUntil = API.rateLimitBuckets.get(bucket) || 0;
      if (globalUntil > 0 && globalUntil <= now) {
        API.rateLimitBuckets.delete("global");
      }
      if (bucketUntil > 0 && bucketUntil <= now) {
        API.rateLimitBuckets.delete(bucket);
      }
      const effectiveUntil = Math.max(
        globalUntil > now ? globalUntil : 0,
        bucketUntil > now ? bucketUntil : 0
      );
      return effectiveUntil > now ? effectiveUntil - now : 0;
    },
    isRateLimited: (urlOrBucket = "global") => {
      return API.getRateLimitRemainingMs(urlOrBucket) > 0;
    },
    clearRateLimits: (urlOrBucket = null) => {
      if (!(API.rateLimitBuckets instanceof Map)) {
        API.rateLimitBuckets = new Map();
      }
      if (urlOrBucket) {
        const bucket = API.getRateLimitBucket(urlOrBucket);
        API.rateLimitBuckets.delete(bucket);
      } else {
        API.rateLimitBuckets.clear();
      }
    },
    isSoftRateLimitPayload: (json) => {
      if (!json || typeof json !== "object") return false;
      if (json.spam === true || json.feedback_required === true) return true;
      const msg = String(json.message || json.error_title || "").toLowerCase();
      if (msg.includes("wait a few minutes") || msg.includes("please wait") || msg.includes("rate limit") || msg.includes("try again later")) {
        return true;
      }
      return false;
    },
    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
      if (typeof options === "number") {
        retries = options;
        options = {};
      }
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (options.respectCircuitBreaker && API.isRateLimited(url)) {
        const remSec = Math.ceil(API.getRateLimitRemainingMs(url) / 1e3);
        const bucket = API.getRateLimitBucket(url);
        const cbErr = new Error(`Instagram rate limit (429) active on ${bucket} (${remSec}s cooldown remaining). Request blocked to safeguard your account.`);
        Object.defineProperty(cbErr, "isRateLimited", { value: true, enumerable: false, configurable: true });
        throw cbErr;
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
        credentials: options.credentials || "include",
        headers: {
          ...defaultHeaders,
          ...options.headers || {}
        }
      };
      if (options.method) fetchOptions.method = options.method;
      if (options.body !== void 0) fetchOptions.body = options.body;
      if (options.signal) fetchOptions.signal = options.signal;
      if (options.mode) fetchOptions.mode = options.mode;
      if (options.cache) fetchOptions.cache = options.cache;
      if (options.redirect) fetchOptions.redirect = options.redirect;
      if (options.referrer) fetchOptions.referrer = options.referrer;
      if (options.referrerPolicy) fetchOptions.referrerPolicy = options.referrerPolicy;
      let rateLimitCount = 0;
      const maxRateLimitRetries = 2;
      for (let i = 0; i < retries; i++) {
        if (options.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        try {
          const res = await fetch(url, fetchOptions);
          if (res.ok) {
            const contentType = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") || "" : "";
            if (contentType && contentType.toLowerCase().includes("text/html")) {
              if (typeof res.text === "function") {
                await res.text().catch(() => "");
              }
              const htmlErr = new Error(`Non-JSON HTML response received from ${url}`);
              Object.defineProperty(htmlErr, "isNonJson", { value: true, enumerable: false, configurable: true });
              throw htmlErr;
            }
            let json;
            try {
              json = await res.json();
            } catch (parseErr) {
              const nonJsonErr = new Error(`Expected JSON from ${url}, but received non-JSON payload (${parseErr?.message || "parse error"}).`);
              Object.defineProperty(nonJsonErr, "isNonJson", { value: true, enumerable: false, configurable: true });
              throw nonJsonErr;
            }
            if (API.isSoftRateLimitPayload(json)) {
              const isGlobalBlock = Boolean(json.feedback_required || json.spam);
              API.tripRateLimit(url, CONFIG.RATE_LIMIT_CIRCUIT_MS || 3e5, isGlobalBlock);
              const softErr = new Error(`Instagram rate limit (429) / action block detected: ${json.message || "feedback_required"}`);
              Object.defineProperty(softErr, "isRateLimited", { value: true, enumerable: false, configurable: true });
              throw softErr;
            }
            return json;
          }
          if (res.status === 429) {
            const retryAfterHeader = res.headers ? res.headers.get("Retry-After") : null;
            const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
            const waitMs = retrySeconds && !isNaN(retrySeconds) && retrySeconds > 0 ? retrySeconds * 1e3 : CONFIG.COOLDOWN_429_MS || 6e4;
            const circuitMs = Math.max(waitMs, CONFIG.RATE_LIMIT_CIRCUIT_MS || 3e5);
            if (options.abortOnRateLimit || options.silent || options.optional) {
              if (options.tripCircuitOn429 !== false) {
                API.tripRateLimit(url, circuitMs, false);
              }
              const optErr = new Error(`Instagram rate limit (429) on ${url}`);
              Object.defineProperty(optErr, "isRateLimited", { value: true, enumerable: false, configurable: true });
              throw optErr;
            }
            rateLimitCount++;
            if (rateLimitCount >= maxRateLimitRetries) {
              API.tripRateLimit(url, circuitMs, false);
              UI.log(`[Rate Limit] HTTP 429 persistent. Aborting to safeguard your account.`);
              const persistErr = new Error("Instagram rate limit (429) persistent. Please wait at least 30-60 minutes before retrying.");
              Object.defineProperty(persistErr, "isRateLimited", { value: true, enumerable: false, configurable: true });
              throw persistErr;
            }
            UI.setStatus(`Rate limit (429). Cooling down ${Math.round(waitMs / 1e3)}s...`);
            UI.log(`[Safety Cooldown] HTTP 429 detected. Pausing for ${Math.round(waitMs / 1e3)}s before retry ${rateLimitCount}/${maxRateLimitRetries}...`);
            await Utils.sleep(waitMs, options.signal);
            continue;
          } else {
            const errText = await res.text().catch(() => "");
            const lowerErr = errText.toLowerCase();
            if (lowerErr.includes("wait a few minutes") || lowerErr.includes("feedback_required") || lowerErr.includes('"spam":true')) {
              API.tripRateLimit(url, CONFIG.RATE_LIMIT_CIRCUIT_MS || 3e5, lowerErr.includes("feedback_required"));
              const blockErr = new Error(`Instagram rate limit (429) / action guard on ${url}: ${errText.slice(0, 120)}`);
              Object.defineProperty(blockErr, "isRateLimited", { value: true, enumerable: false, configurable: true });
              throw blockErr;
            }
            if (!options.silent) {
              console.warn(`[IG Analyzer] Request to ${url} failed (HTTP ${res.status}):`, errText.slice(0, 300));
            }
            throw new Error(`HTTP ${res.status} while requesting ${url}: ${errText.slice(0, 100)}`);
          }
        } catch (e) {
          if (e.name === "AbortError" || options.signal?.aborted) {
            throw e;
          }
          if (e.isRateLimited || options.silent || options.optional || e.isNonJson) {
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
    }
  });
  const normalizeUserId = (rawId) => {
    if (rawId === null || rawId === void 0) return null;
    const str = String(rawId).trim();
    if (!str || str === "0" || str === "null" || str === "undefined") return null;
    return str;
  };
  let cumulativeBurstPages = 0;
  let lastBurstPageTimestamp = 0;
  const recordBurstPageAndGetCount = () => {
    const now = Date.now();
    if (lastBurstPageTimestamp > 0 && now - lastBurstPageTimestamp > 3e4) {
      cumulativeBurstPages = 0;
    }
    cumulativeBurstPages++;
    lastBurstPageTimestamp = now;
    return cumulativeBurstPages;
  };
  const sleepPaginationDelay = async (burstPageCount, signal) => {
    const baseDelay = CONFIG.FRIENDSHIPS_RATE_LIMIT_MS + Math.random() * 750;
    const breatherEvery = CONFIG.BREATHER_EVERY_PAGES;
    const extraBreather = burstPageCount > 0 && burstPageCount % breatherEvery === 0 ? CONFIG.BREATHER_PAUSE_MS + Math.random() * 1e3 : 0;
    await Utils.sleep(baseDelay + extraBreather, signal);
  };
  Object.assign(API, {
    mergeExtractedUsers: (primaryList = [], secondaryList = []) => {
      const merged = [];
      const indexById = new Map();
      const indexByLower = new Map();
      const upsert = (rawUser) => {
        if (!rawUser || typeof rawUser !== "object") return;
        const username = rawUser.username ? String(rawUser.username).trim() : "";
        if (!username) return;
        const id = normalizeUserId(rawUser.id ?? rawUser.pk_id ?? rawUser.strong_id__ ?? rawUser.pk ?? null);
        const lower = username.toLowerCase();
        const rawPriv = rawUser.isPrivate !== void 0 ? rawUser.isPrivate : rawUser.is_private;
        const hasExplicitPrivate = typeof rawUser.isPrivateKnown === "boolean" ? rawUser.isPrivateKnown : typeof rawPriv === "boolean";
        const isBestie = Boolean(rawUser.isBestie ?? rawUser.is_bestie ?? rawUser.friendship_status?.is_bestie);
        const outgoingRequest = Boolean(rawUser.outgoingRequest ?? rawUser.outgoing_request ?? rawUser.friendship_status?.outgoing_request);
        const profilePicUrl = rawUser.hd_profile_pic_url_info?.url || rawUser.profilePicUrl || rawUser.profile_pic_url || null;
        const latestReelMedia = Number(rawUser.latestReelMedia ?? rawUser.latest_reel_media ?? rawUser.reel?.latest_reel_media ?? 0) || 0;
        const fullName = rawUser.fullName || rawUser.full_name || "";
        const isVerified = Boolean(rawUser.isVerified ?? rawUser.is_verified);
        const existingIdx = id && indexById.has(id) ? indexById.get(id) : indexByLower.has(lower) ? indexByLower.get(lower) : -1;
        if (existingIdx !== -1 && existingIdx !== void 0) {
          const existing = merged[existingIdx];
          if (!existing.id && id) {
            existing.id = id;
            indexById.set(id, existingIdx);
          }
          if (!existing.fullName && fullName) existing.fullName = fullName;
          if (!existing.profilePicUrl && profilePicUrl) existing.profilePicUrl = profilePicUrl;
          if ((!existing.isPrivateKnown || existing.isPrivate === null || existing.isPrivate === void 0) && hasExplicitPrivate) {
            existing.isPrivate = Boolean(rawPriv);
            existing.isPrivateKnown = true;
          } else if (existing.isPrivate === false && rawPriv === true) {
            existing.isPrivate = true;
            existing.isPrivateKnown = true;
          }
          if (!existing.isVerified && isVerified) existing.isVerified = true;
          if (!existing.isBestie && isBestie) existing.isBestie = true;
          if (!existing.outgoingRequest && outgoingRequest) existing.outgoingRequest = true;
          if (latestReelMedia > (existing.latestReelMedia || 0)) existing.latestReelMedia = latestReelMedia;
          return;
        }
        const entry = {
          id,
          username,
          fullName,
          isPrivate: hasExplicitPrivate ? Boolean(rawPriv) : null,
          isPrivateKnown: hasExplicitPrivate,
          isVerified,
          profilePicUrl,
          latestReelMedia,
          isBestie,
          outgoingRequest
        };
        const nextIdx = merged.length;
        merged.push(entry);
        if (id) indexById.set(id, nextIdx);
        indexByLower.set(lower, nextIdx);
      };
      (Array.isArray(primaryList) ? primaryList : []).forEach(upsert);
      (Array.isArray(secondaryList) ? secondaryList : []).forEach(upsert);
      return merged;
    },
    getAllUsersViaGraphQL: async (userId, hash, label, options = {}, expectedTotal = 0, callbacks = null) => {
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const isNumericDocId = (val) => typeof val === "string" && /^[0-9]{10,25}$/.test(val.trim());
      const defaultFollowDocId = CONFIG.RELAY_DOC_IDS?.FOLLOW_LIST_QUERY;
      const hashStr = String(hash || "").trim();
      const activeDocId = isNumericDocId(hashStr) ? hashStr : await Utils.resolveRelayDocIdAsync(
        "usePolarisGetFollowListQuery",
        defaultFollowDocId,
        "PolarisFollowListModal.next.react"
      );
      if (options.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const users = [];
      const seenIds = new Set();
      const seenUsernames = new Set();
      const seenCursors = new Set();
      let cursor = null;
      let hasNext = true;
      let totalCount = expectedTotal || 0;
      let limitedByMeta = false;
      let pagesFetched = 0;
      let rawItemsCount = 0;
      let duplicateItemsCount = 0;
      const isFollowerList = label !== "following";
      const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : CONFIG.GRAPHQL_FOLLOW_LIST_PAGE_SIZE;
      const viewerId = Utils.getUserId() || "0";
      const dtsg = Utils.getDtsg();
      const jazoest = Utils.calculateJazoest(dtsg);
      const lsd = Utils.getLsd();
      const endpoints = [
        "https://www.instagram.com/graphql/query",
        "https://www.instagram.com/api/graphql"
      ];
      let endpointIdx = 0;
      const reportProgress = typeof callbacks?.onProgress === "function" ? callbacks.onProgress : (curr, total, msg) => UI.setProgress(curr, total, msg);
      try {
        while (hasNext) {
          if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const params = new URLSearchParams();
          params.append("av", viewerId);
          params.append("__d", "www");
          params.append("__user", "0");
          params.append("__a", "1");
          params.append("__req", String(pagesFetched + 1));
          params.append("fb_api_caller_class", "RelayModern");
          params.append("fb_api_req_friendly_name", "usePolarisGetFollowListQuery");
          params.append("doc_id", activeDocId);
          params.append("server_timestamps", "true");
          params.append("variables", JSON.stringify({
            after: cursor,
            before: null,
            first: pageSize,
            isFollowerList,
            last: null,
            query: "",
            userID: String(userId)
          }));
          if (dtsg) params.append("fb_dtsg", dtsg);
          if (jazoest) params.append("jazoest", jazoest);
          if (lsd) params.append("lsd", lsd);
          const headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-FB-Friendly-Name": "usePolarisGetFollowListQuery",
            ...lsd ? { "X-FB-LSD": lsd } : {},
            ...options.headers || {}
          };
          let json;
          let activeConn;
          try {
            json = await API.fetchWithRetry(endpoints[endpointIdx], {
              ...options,
              method: "POST",
              headers,
              body: params.toString(),
              abortOnRateLimit: true
            });
            const conn = label === "following" ? json?.data?.xdt_api__v1__friendships__following__connection || json?.data?.xdt_api__v1__friendships__followers__connection : json?.data?.xdt_api__v1__friendships__followers__connection || json?.data?.xdt_api__v1__friendships__following__connection;
            const legacyUserNode = json?.data?.user;
            const legacyEdge = label === "following" ? legacyUserNode?.edge_follow || legacyUserNode?.edge_followed_by : legacyUserNode?.edge_followed_by || legacyUserNode?.edge_follow;
            activeConn = conn && Array.isArray(conn.edges) ? conn : legacyEdge && Array.isArray(legacyEdge.edges) ? legacyEdge : null;
            if (!activeConn) {
              const gqlErrMsg = Array.isArray(json?.errors) && json.errors[0]?.message ? ` (${json.errors[0].message})` : "";
              if (!options.silent) {
                console.warn(`[IG Analyzer] GraphQL Relay returned invalid ${label} connection:`, json);
              }
              if (pagesFetched === 0) {
                throw new Error(`GraphQL Relay returned invalid ${label} payload${gqlErrMsg}`);
              }
              break;
            }
          } catch (reqErr) {
            if (reqErr.name === "AbortError" || options.signal?.aborted || reqErr.isRateLimited) {
              throw reqErr;
            }
            if (pagesFetched === 0 && endpointIdx + 1 < endpoints.length) {
              endpointIdx++;
              continue;
            }
            throw reqErr;
          }
          pagesFetched++;
          const burstPages = recordBurstPageAndGetCount();
          if (activeConn.should_limit_list_of_followers || activeConn.should_limit_list_of_followings) {
            limitedByMeta = true;
          }
          if (totalCount === 0 && activeConn.count) {
            totalCount = Number(activeConn.count) || 0;
          }
          rawItemsCount += activeConn.edges.length;
          activeConn.edges.forEach((e) => {
            const node = e?.node || e;
            const username = node?.username ? String(node.username).trim() : "";
            if (!username) return;
            const id = normalizeUserId(node?.pk ?? node?.id ?? node?.pk_id ?? node?.strong_id__ ?? null);
            const lower = username.toLowerCase();
            if (id && seenIds.has(id) || seenUsernames.has(lower)) {
              duplicateItemsCount++;
              return;
            }
            if (id) seenIds.add(id);
            seenUsernames.add(lower);
            users.push({
              id,
              username,
              fullName: node?.full_name || "",
              isPrivate: typeof node?.is_private === "boolean" ? node.is_private : null,
              isVerified: Boolean(node?.is_verified),
              profilePicUrl: node?.hd_profile_pic_url_info?.url || node?.profile_pic_url || null,
              latestReelMedia: Number(node?.latest_reel_media ?? node?.reel?.latest_reel_media ?? 0) || 0,
              isBestie: Boolean(node?.friendship_status?.is_bestie ?? node?.is_bestie),
              outgoingRequest: Boolean(node?.friendship_status?.outgoing_request ?? node?.outgoing_request)
            });
          });
          const nextCursor = activeConn.page_info?.has_next_page === true && activeConn.page_info?.end_cursor ? String(activeConn.page_info.end_cursor) : null;
          if (nextCursor && seenCursors.has(nextCursor)) {
            console.warn(`[IG Analyzer] Duplicate GraphQL pagination cursor detected for ${label}, stopping loop.`);
            hasNext = false;
          } else {
            if (nextCursor) seenCursors.add(nextCursor);
            cursor = nextCursor;
            hasNext = Boolean(nextCursor);
          }
          const total = totalCount > 0 ? totalCount : 0;
          const progressLabel = total > 0 ? `Extracting ${label}... (${users.length}/${total})` : `Extracting ${label}... (${users.length})`;
          reportProgress(users.length, total, progressLabel);
          if (hasNext) {
            await sleepPaginationDelay(burstPages, options.signal);
          }
        }
      } catch (err) {
        if (err.name === "AbortError" || options.signal?.aborted) throw err;
        if (users.length > 0) {
          Object.defineProperty(err, "partialUsers", { value: users, enumerable: false, configurable: true });
        }
        throw err;
      }
      if (users.length > 0 && !callbacks?.suppressFinalProgress) {
        reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
      }
      Object.defineProperty(users, "_meta", {
        value: { limitedByMeta, pagesFetched, rawItemsCount, duplicateItemsCount, engine: "graphql" },
        enumerable: false,
        configurable: true
      });
      return users;
    },
    getAllUsersViaFriendships: async (userId, label, options = {}, expectedTotal = 0, callbacks = null) => {
      const users = [];
      const seenIds = new Set();
      const seenUsernames = new Set();
      const seenCursors = new Set();
      let maxId = null;
      let hasNext = true;
      let limitedByMeta = false;
      let pagesFetched = 0;
      let rawItemsCount = 0;
      let duplicateItemsCount = 0;
      const endpoint = label === "following" ? "following" : "followers";
      const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : CONFIG.FRIENDSHIPS_PAGE_SIZE;
      const searchSurface = options.searchSurface ? String(options.searchSurface) : null;
      const rankToken = options.useRankToken ? options.rankToken || Utils.generateUuid() : null;
      const reportProgress = typeof callbacks?.onProgress === "function" ? callbacks.onProgress : (curr, total, msg) => UI.setProgress(curr, total, msg);
      try {
        while (hasNext) {
          if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const params = new URLSearchParams();
          params.set("count", String(pageSize));
          if (searchSurface) {
            params.set("search_surface", String(searchSurface));
          }
          if (rankToken) {
            params.set("rank_token", String(rankToken));
          }
          if (maxId !== null) {
            params.set("max_id", String(maxId));
          }
          const url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpoint}/?${params.toString()}`;
          const json = await API.fetchWithRetry(url, { ...options, abortOnRateLimit: true });
          pagesFetched++;
          const burstPages = recordBurstPageAndGetCount();
          if (json?.should_limit_list_of_followers || json?.should_limit_list_of_followings) {
            limitedByMeta = true;
          }
          const list = json?.users;
          if (!Array.isArray(list)) {
            if (!options.silent) {
              console.warn(`[IG Analyzer] Friendships API returned non-array for ${label}:`, json);
            }
            if (pagesFetched === 1) {
              throw new Error(`Friendships API returned invalid users payload for ${label}`);
            }
            break;
          }
          rawItemsCount += list.length;
          list.forEach((u) => {
            const username = u?.username ? String(u.username).trim() : "";
            if (!username) return;
            const id = normalizeUserId(u?.pk_id ?? u?.strong_id__ ?? u?.pk ?? u?.id ?? null);
            const lower = username.toLowerCase();
            if (id && seenIds.has(id) || seenUsernames.has(lower)) {
              duplicateItemsCount++;
              return;
            }
            if (id) seenIds.add(id);
            seenUsernames.add(lower);
            users.push({
              id,
              username,
              fullName: u?.full_name || "",
              isPrivate: Boolean(u?.is_private),
              isVerified: Boolean(u?.is_verified),
              profilePicUrl: u?.profile_pic_url || null,
              latestReelMedia: u?.latest_reel_media || 0,
              isBestie: Boolean(u?.friendship_status?.is_bestie ?? u?.is_bestie),
              outgoingRequest: Boolean(u?.friendship_status?.outgoing_request ?? u?.outgoing_request)
            });
          });
          const rawNext = json?.next_max_id;
          const nextCursor = rawNext !== void 0 && rawNext !== null && String(rawNext) !== "" ? String(rawNext) : null;
          if (nextCursor && seenCursors.has(nextCursor)) {
            console.warn(`[IG Analyzer] Duplicate pagination cursor detected for ${label}, stopping loop.`);
            hasNext = false;
          } else {
            if (nextCursor) seenCursors.add(nextCursor);
            maxId = nextCursor;
            hasNext = Boolean(nextCursor);
          }
          const total = expectedTotal > 0 ? expectedTotal : 0;
          const progressLabel = total > 0 ? `Extracting ${label}... (${users.length}/${total})` : `Extracting ${label}... (${users.length})`;
          reportProgress(users.length, total, progressLabel);
          if (hasNext) {
            await sleepPaginationDelay(burstPages, options.signal);
          }
        }
      } catch (err) {
        if (err.name === "AbortError" || options.signal?.aborted) throw err;
        if (users.length > 0) {
          Object.defineProperty(err, "partialUsers", { value: users, enumerable: false, configurable: true });
        }
        throw err;
      }
      if (users.length > 0 && !callbacks?.suppressFinalProgress) {
        reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
      }
      Object.defineProperty(users, "_meta", {
        value: { limitedByMeta, pagesFetched, rawItemsCount, duplicateItemsCount, engine: "rest" },
        enumerable: false,
        configurable: true
      });
      return users;
    },
    extractCompleteUserList: async (userId, hash, label, options = {}, expectedTotal = 0, callbacks = null) => {
      const logMsg = typeof callbacks?.onLog === "function" ? callbacks.onLog : (msg) => UI.log(msg);
      const reportProgress = typeof callbacks?.onProgress === "function" ? callbacks.onProgress : (curr, total, msg) => UI.setProgress(curr, total, msg);
      const rawEngine = String(options.engine || CONFIG.DEFAULT_EXTRACTION_ENGINE).toLowerCase();
      const engine = rawEngine === "graphql" || rawEngine === "rest" || rawEngine === "hybrid" ? rawEngine : "hybrid";
      let users = [];
      let friendshipsSuccess = false;
      let graphqlSuccess = false;
      let limitedByMeta = false;
      let rateLimited = false;
      const runRest = async (isFallback = false) => {
        try {
          const res = await API.getAllUsersViaFriendships(
            userId,
            label,
            {
              ...options,
              pageSize: CONFIG.FRIENDSHIPS_PAGE_SIZE || 12,
              searchSurface: null,
              useRankToken: false,
              abortOnRateLimit: true
            },
            expectedTotal,
            {
              onProgress: (curr, total, msg) => {
                reportProgress(Math.max(users.length, curr), total, msg);
              },
              suppressFinalProgress: true
            }
          );
          users = users.length > 0 ? API.mergeExtractedUsers(users, res) : res;
          limitedByMeta = limitedByMeta || Boolean(res?._meta?.limitedByMeta);
          friendshipsSuccess = true;
        } catch (e) {
          if (e.name === "AbortError" || options.signal?.aborted) throw e;
          const partial = Array.isArray(e.partialUsers) ? e.partialUsers : [];
          if (partial.length > 0) {
            users = users.length > 0 ? API.mergeExtractedUsers(users, partial) : partial;
          }
          friendshipsSuccess = false;
          if (e.isRateLimited) {
            rateLimited = true;
            logMsg(`[Anti-Ban Guard] Instagram rate limit (429) detected on '${label}' (${users.length} collected). Halting extraction immediately to protect your account.`);
          } else if (isFallback) {
            Utils.logError(`REST fallback failed for ${label}`, e);
          } else {
            console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e?.message || e);
          }
        }
      };
      const runGraphQL = async (gqlOptions = {}, isReconciliation = false) => {
        try {
          const res = await API.getAllUsersViaGraphQL(
            userId,
            hash,
            label,
            {
              pageSize: options.pageSize || CONFIG.GRAPHQL_FOLLOW_LIST_PAGE_SIZE || 20,
              ...options,
              ...gqlOptions,
              abortOnRateLimit: true
            },
            expectedTotal,
            {
              onProgress: (curr, total, msg) => {
                reportProgress(Math.max(users.length, curr), total, msg);
              },
              suppressFinalProgress: true
            }
          );
          users = users.length > 0 ? API.mergeExtractedUsers(users, res) : res;
          limitedByMeta = limitedByMeta || Boolean(res?._meta?.limitedByMeta);
          graphqlSuccess = true;
        } catch (gqlErr) {
          if (gqlErr.name === "AbortError" || options.signal?.aborted) throw gqlErr;
          const partial = Array.isArray(gqlErr.partialUsers) ? gqlErr.partialUsers : [];
          if (partial.length > 0) {
            users = users.length > 0 ? API.mergeExtractedUsers(users, partial) : partial;
          }
          graphqlSuccess = false;
          if (gqlErr.isRateLimited) {
            rateLimited = true;
            logMsg(`[Anti-Ban Guard] Instagram rate limit (429) detected on '${label}' (${users.length} collected). Halting extraction immediately to protect your account.`);
          } else if (!isReconciliation) {
            Utils.logError(`GraphQL Relay error for ${label}`, gqlErr);
          } else {
            console.warn(`[IG Analyzer] GraphQL Relay reconciliation failed for ${label}:`, gqlErr?.message || gqlErr);
          }
        }
      };
      if (engine === "graphql") {
        await runGraphQL({ optional: false, silent: false }, false);
        if (!graphqlSuccess && !rateLimited) {
          if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
          logMsg(`GraphQL Relay interrupted for '${label}' (${users.length} partial). Falling back to REST Friendships API...`);
          if (users.length > 0) {
            await Utils.sleep(800 + Math.random() * 400, options.signal);
          }
          await runRest(true);
        }
      } else {
        await runRest(false);
        const reconcileThreshold = Number(CONFIG.HYBRID_RECONCILE_THRESHOLD) || 0.92;
        const minMissingUsers = Number(CONFIG.HYBRID_MIN_MISSING_USERS) || 6;
        const missingCount = expectedTotal > 0 ? Math.max(0, expectedTotal - users.length) : 0;
        const needsHybridReconcile = engine === "hybrid" && friendshipsSuccess && !limitedByMeta && expectedTotal >= 15 && users.length < expectedTotal * reconcileThreshold && missingCount >= minMissingUsers;
        const shouldRunGraphQL = !rateLimited && (!friendshipsSuccess || needsHybridReconcile);
        if (shouldRunGraphQL) {
          if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
          if (!friendshipsSuccess) {
            logMsg(`Friendships API interrupted for '${label}' (${users.length} partial). Completing via GraphQL Relay...`);
          }
          const beforeGqlCount = users.length;
          if (friendshipsSuccess && users.length > 0) {
            await Utils.sleep(1200 + Math.random() * 600, options.signal);
          }
          await runGraphQL(
            friendshipsSuccess ? { optional: true, silent: true } : {},
            friendshipsSuccess
          );
          if (friendshipsSuccess && users.length > beforeGqlCount) {
            logMsg(`[Reconciled] Recovered +${users.length - beforeGqlCount} '${label}' account(s) via GraphQL Relay.`);
          }
        }
      }
      if (users.length > 0) {
        reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
      }
      const isPartial = Boolean(
        rateLimited || limitedByMeta || expectedTotal >= 20 && users.length < expectedTotal * 0.85
      );
      return {
        users,
        friendshipsSuccess,
        graphqlSuccess,
        engineUsed: engine,
        limitedByMeta,
        isPartial,
        rateLimited
      };
    },
    getAllUsers: async (userId, hash, label, options = {}, expectedTotal = 0) => {
      const result = await API.extractCompleteUserList(userId, hash, label, options, expectedTotal);
      const users = result.users;
      const withIdCount = users.filter((u) => !!u.id).length;
      UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");
      if (expectedTotal > 0 && users.length < expectedTotal) {
        UI.log(`[Info] Profile header counter: ${expectedTotal} ${label} | Accessible accounts returned by list API: ${users.length}.`);
      }
      return users;
    }
  });
  Object.assign(API, {
    getUserInfo: async (userId, options = {}) => {
      if (!userId || String(userId) === "0") return null;
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const targetIdStr = String(userId).trim();
      const opts = { ...options, optional: true, silent: true };
      const viewerUsername = Utils.getUsername() || Storage.load(targetIdStr)?.ownerUsername || "";
      try {
        const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
        const candidates = [
          win.__initialData?.pending?.viewer,
          win.__initialData?.data?.viewer,
          win._sharedData?.config?.viewer,
          win._sharedData?.rawProfileUser,
          win.__initialData?.data?.user
        ];
        for (const cand of candidates) {
          if (!cand || typeof cand !== "object") continue;
          const candId = String(cand.id || cand.pk || "").trim();
          if (candId !== targetIdStr) continue;
          const fCount = cand.edge_followed_by?.count ?? cand.follower_count;
          const fgCount = cand.edge_follow?.count ?? cand.following_count;
          if (typeof fCount === "number" || typeof fgCount === "number") {
            return {
              followerCount: Number(fCount || 0),
              followingCount: Number(fgCount || 0),
              username: cand.username || viewerUsername,
              fullName: cand.full_name || "",
              profilePicUrl: cand.profile_pic_url || null
            };
          }
        }
      } catch (e) {
      }
      try {
        const currentSlug = typeof window !== "undefined" ? String(window.location?.pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase() : "";
        if (viewerUsername && currentSlug && currentSlug === viewerUsername.toLowerCase()) {
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
                username: viewerUsername,
                fullName: "",
                profilePicUrl: null
              };
            }
          }
        }
      } catch (e) {
      }
      try {
        if (viewerUsername) {
          const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(viewerUsername)}`;
          const json = await API.fetchWithRetry(url, opts, 1);
          const u = json?.data?.user;
          if (u && (!u.id || String(u.id) === targetIdStr)) {
            return {
              followerCount: Number(u.edge_followed_by?.count ?? u.follower_count ?? 0),
              followingCount: Number(u.edge_follow?.count ?? u.following_count ?? 0),
              username: u.username || viewerUsername,
              fullName: u.full_name || "",
              profilePicUrl: u.profile_pic_url || null
            };
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
      }
      try {
        if (typeof API.fetchUserProfileHd === "function") {
          const hd = await API.fetchUserProfileHd(targetIdStr, viewerUsername, opts);
          if (hd && (typeof hd.followerCount === "number" || typeof hd.followingCount === "number")) {
            return {
              followerCount: Number(hd.followerCount ?? 0),
              followingCount: Number(hd.followingCount ?? 0),
              username: hd.username || viewerUsername,
              fullName: hd.fullName || "",
              profilePicUrl: hd.hdUrl || null
            };
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
      }
      return null;
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
        const searchDocId = Utils.getRelayDocId(
          "PolarisSearchBoxRefetchableQuery",
          CONFIG.RELAY_DOC_IDS?.SEARCH_BOX_QUERY || "27706427925724183"
        );
        params.append("fb_api_caller_class", "RelayModern");
        params.append("fb_api_req_friendly_name", "PolarisSearchBoxRefetchableQuery");
        params.append("doc_id", searchDocId);
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
        if (typeof Storage.findKnownUserByUsername === "function") {
          const known = Storage.findKnownUserByUsername(cleanUser);
          if (known?.id && String(known.id) !== "0" && (cleanUser === viewerName || String(known.id) !== String(viewerId))) {
            return String(known.id);
          }
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
    fetchHighlightsTray: async (targetId, cleanUser, profile = null, options = {}) => {
      const normalizeItems = (items) => {
        if (!Array.isArray(items)) return [];
        return items.map((entry) => {
          const node = entry?.node && typeof entry.node === "object" ? entry.node : entry;
          if (!node || typeof node !== "object") return null;
          return {
            id: String(node.id || node.pk || ""),
            title: String(node.title || "Untitled"),
            mediaCount: Number(node.media_count ?? node.mediaCount ?? node.edge_highlight_media?.count ?? 0)
          };
        }).filter(Boolean);
      };
      const rawUser = profile?.rawUser || null;
      if (Array.isArray(rawUser?.edge_highlight_reels?.edges)) {
        const highlights = normalizeItems(rawUser.edge_highlight_reels.edges);
        const count = typeof rawUser.highlight_reel_count === "number" ? Math.max(highlights.length, rawUser.highlight_reel_count) : highlights.length;
        return { available: true, count, highlights, source: "profile_raw" };
      }
      const relayDocId = Utils.getRelayDocId(
        "PolarisProfileStoryHighlightsTrayContentQuery",
        CONFIG.RELAY_DOC_IDS?.HIGHLIGHTS_TRAY_QUERY
      );
      if (relayDocId) {
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
        params.append("fb_api_req_friendly_name", "PolarisProfileStoryHighlightsTrayContentQuery");
        params.append("doc_id", relayDocId);
        params.append("server_timestamps", "true");
        params.append("variables", JSON.stringify({ user_id: String(targetId) }));
        if (dtsg) params.append("fb_dtsg", dtsg);
        if (jazoest) params.append("jazoest", jazoest);
        if (lsd) params.append("lsd", lsd);
        const headers = {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-FB-Friendly-Name": "PolarisProfileStoryHighlightsTrayContentQuery"
        };
        if (lsd) headers["X-FB-LSD"] = lsd;
        const relayEndpoints = [
          "https://www.instagram.com/graphql/query",
          "https://www.instagram.com/api/graphql"
        ];
        for (const relayUrl of relayEndpoints) {
          try {
            const relayJson = await API.fetchWithRetry(relayUrl, {
              method: "POST",
              headers,
              body: params.toString(),
              optional: true,
              silent: true,
              signal: options.signal
            }, 1);
            const rawEdges = relayJson?.data?.highlights_tray?.edges ?? relayJson?.data?.xdt_api__v1__highlights__highlights_tray?.tray ?? relayJson?.data?.user?.edge_highlight_reels?.edges;
            if (Array.isArray(rawEdges)) {
              const highlights = normalizeItems(rawEdges);
              return {
                available: true,
                count: highlights.length,
                highlights,
                source: "relay_graphql"
              };
            }
          } catch (relayErr) {
            if (relayErr.name === "AbortError" || options.signal?.aborted) throw relayErr;
          }
        }
      }
      try {
        const trayJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
          optional: true,
          silent: true,
          signal: options.signal
        }, 1);
        if (Array.isArray(trayJson?.tray)) {
          const highlights = normalizeItems(trayJson.tray);
          return {
            available: true,
            count: highlights.length,
            highlights,
            source: "rest_tray"
          };
        }
      } catch (trayErr) {
        if (trayErr.name === "AbortError" || options.signal?.aborted) throw trayErr;
      }
      if (typeof rawUser?.highlight_reel_count === "number") {
        return {
          available: true,
          count: Number(rawUser.highlight_reel_count),
          highlights: [],
          source: "profile_count"
        };
      }
      if (cleanUser) {
        try {
          const webJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`, {
            optional: true,
            silent: true,
            signal: options.signal
          }, 1);
          const webUser = webJson?.data?.user;
          if (Array.isArray(webUser?.edge_highlight_reels?.edges)) {
            const highlights = normalizeItems(webUser.edge_highlight_reels.edges);
            const count = typeof webUser.highlight_reel_count === "number" ? Math.max(highlights.length, webUser.highlight_reel_count) : highlights.length;
            return { available: true, count, highlights, source: "web_profile_info" };
          }
          if (typeof webUser?.highlight_reel_count === "number") {
            return {
              available: true,
              count: Number(webUser.highlight_reel_count),
              highlights: [],
              source: "web_profile_count"
            };
          }
        } catch (webErr) {
          if (webErr.name === "AbortError" || options.signal?.aborted) throw webErr;
        }
        try {
          const htmlRes = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
            credentials: "include",
            signal: options.signal
          });
          if (htmlRes.ok && typeof htmlRes.text === "function") {
            const html = await htmlRes.text();
            const countMatch = html.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/) || html.match(/\\?"edge_highlight_reels\\?"\s*:\s*\{\s*\\?"count\\?"\s*:\s*([0-9]+)/);
            if (countMatch && countMatch[1] !== void 0) {
              return {
                available: true,
                count: parseInt(countMatch[1], 10) || 0,
                highlights: [],
                source: "auth_html"
              };
            }
          }
        } catch (htmlErr) {
          if (htmlErr.name === "AbortError" || options.signal?.aborted) throw htmlErr;
        }
      }
      return {
        available: false,
        count: 0,
        highlights: [],
        source: "unavailable"
      };
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
        const trayResult = await API.fetchHighlightsTray(targetId, cleanUser, profile, options);
        const authHighlightsAvailable = Boolean(trayResult?.available);
        const authHighlights = Array.isArray(trayResult?.highlights) ? trayResult.highlights : [];
        const authHighlightsCount = Number(trayResult?.count || 0);
        let anonHighlightsCount = 0;
        let anonHighlightsAvailable = false;
        let anonHasStory = false;
        if (!isPrivate) {
          const parseSafeAnonJson = async (res) => {
            if (!res || !res.ok) return null;
            const ct = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-type") || "" : "";
            if (ct && ct.toLowerCase().includes("text/html")) {
              if (typeof res.text === "function") await res.text().catch(() => "");
              return null;
            }
            try {
              return await res.json();
            } catch (err) {
              return null;
            }
          };
          try {
            const anonWebRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`, {
              credentials: "omit",
              headers: {
                "X-IG-App-ID": "936619743392459",
                "X-Requested-With": "XMLHttpRequest",
                "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
                "Accept": "application/json, text/plain, */*"
              },
              signal: options.signal
            });
            const anonWebJson = await parseSafeAnonJson(anonWebRes);
            const anonUser = anonWebJson?.data?.user;
            if (anonUser) {
              if (typeof anonUser.highlight_reel_count === "number") {
                anonHighlightsAvailable = true;
                anonHighlightsCount = anonUser.highlight_reel_count;
              } else if (Array.isArray(anonUser.edge_highlight_reels?.edges)) {
                anonHighlightsAvailable = true;
                anonHighlightsCount = anonUser.edge_highlight_reels.edges.length;
              }
              if (typeof anonUser.latest_reel_media === "number" && anonUser.latest_reel_media > 0) {
                anonHasStory = true;
              }
            }
          } catch (anonWebErr) {
            if (anonWebErr.name === "AbortError" || options.signal?.aborted) throw anonWebErr;
          }
          if (!anonHighlightsAvailable) {
            try {
              const anonHtmlRes = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
                credentials: "omit",
                signal: options.signal
              });
              if (anonHtmlRes.ok && typeof anonHtmlRes.text === "function") {
                const anonHtml = await anonHtmlRes.text();
                const hMatch = anonHtml.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/);
                if (hMatch && hMatch[1] !== void 0) {
                  anonHighlightsAvailable = true;
                  anonHighlightsCount = parseInt(hMatch[1], 10) || 0;
                }
                const sMatch = anonHtml.match(/\\?"latest_reel_media\\?"\s*:\s*([1-9][0-9]*)/);
                if (sMatch) {
                  anonHasStory = true;
                }
              }
            } catch (anonHtmlErr) {
              if (anonHtmlErr.name === "AbortError" || options.signal?.aborted) throw anonHtmlErr;
            }
          }
        }
        return {
          userId: targetId,
          username: cleanUser,
          fullName: profile?.fullName || "",
          profilePicUrl: profile?.hdUrl || null,
          isPrivate,
          isGated,
          authHighlightsAvailable,
          authHighlightsCount,
          authHighlights,
          latestReelMedia,
          latestBestiesReelMedia,
          authHasStory,
          isBestieStory,
          anonHighlightsAvailable,
          anonHighlightsCount,
          anonHasStory,
          fetchedAt: Date.now()
        };
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
        console.error(`[IG Analyzer] Error in checkStoryStatus for @${cleanUser}:`, e);
        return null;
      }
    }
  });
  Object.assign(API, {
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
        const PROVEN_PROFILE_DOC_ID = CONFIG.RELAY_DOC_IDS?.PROFILE_QUERY || "28036671149327607";
        const ALT_PROFILE_DOC_ID = CONFIG.RELAY_DOC_IDS?.PROFILE_ALT_QUERY || "40158838120366999";
        const liveProfileDocId = Utils.getRelayDocId("PolarisProfilePageContentQuery", null);
        const profileDocIds = Utils.unique([PROVEN_PROFILE_DOC_ID, liveProfileDocId, ALT_PROFILE_DOC_ID].filter(Boolean));
        params.append("fb_api_caller_class", "RelayModern");
        params.append("fb_api_req_friendly_name", "PolarisProfilePageContentQuery");
        params.append("doc_id", PROVEN_PROFILE_DOC_ID);
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
        for (const docId of profileDocIds) {
          params.set("doc_id", docId);
          try {
            const json = await API.fetchWithRetry(url, {
              method: "POST",
              headers,
              body: params.toString(),
              optional: true,
              signal: options.signal
            }, 1);
            user = json?.data?.user || null;
          } catch (graphqlErr) {
            if (graphqlErr.name === "AbortError" || options.signal?.aborted) throw graphqlErr;
            console.warn(`[IG Analyzer] GraphQL profile fetch failed for @${cleanUser} (doc_id ${docId}):`, graphqlErr?.message || graphqlErr);
          }
          if (user) break;
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
            id: f?.id ? String(f.id) : null,
            username: f?.username || "",
            fullName: f?.full_name || "",
            profilePicUrl: Utils.sanitizeImageUrl(f?.profile_pic_url)
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
    }
  });
  Object.assign(API, {
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
      let resolvedFromKnownSource = Boolean(resolvedId);
      if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
        resolvedId = null;
        resolvedFromKnownSource = false;
      }
      if (!resolvedId && typeof Storage.findKnownUserByUsername === "function") {
        const knownUser = Storage.findKnownUserByUsername(cleanUser);
        if (knownUser?.id && String(knownUser.id) !== "0" && (cleanUserLower === viewerName || String(knownUser.id) !== String(viewerId))) {
          resolvedId = String(knownUser.id);
          resolvedFromKnownSource = true;
        }
      }
      if (!resolvedId) {
        const existingTarget = Storage.getTargetData(cleanUser);
        if (existingTarget?.user?.id && (cleanUserLower === viewerName || String(existingTarget.user.id) !== String(viewerId))) {
          resolvedId = String(existingTarget.user.id);
          resolvedFromKnownSource = true;
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
        resolvedFromKnownSource = false;
      }
      if (resolvedId) {
        try {
          const profile = await API.fetchUserProfileHd(resolvedId, cleanUser, { ...options, forceRefresh: true });
          if (profile) {
            const profileUsername = (profile.username || "").toLowerCase();
            if (cleanUserLower !== viewerName && viewerId && String(profile.id) === String(viewerId)) {
              return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            const sameNumericId = Boolean(profile.id && String(profile.id) === String(resolvedId));
            if (profileUsername && profileUsername !== cleanUserLower && !sameNumericId && !resolvedFromKnownSource) {
              return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            const isRenamedTarget = Boolean(profileUsername && profileUsername !== cleanUserLower && (sameNumericId || resolvedFromKnownSource));
            const isFollowingInSnapCurrent = isRenamedTarget && Array.isArray(snap?.following) && snap.following.some((u) => {
              const name = typeof u === "string" ? u : u?.username;
              return name && name.toLowerCase() === profileUsername;
            });
            const isFollowerInSnapCurrent = isRenamedTarget && Array.isArray(snap?.followers) && snap.followers.some((u) => {
              const name = typeof u === "string" ? u : u?.username;
              return name && name.toLowerCase() === profileUsername;
            });
            let isFollowing = isFollowingInSnap || isFollowingInSnapCurrent;
            let isFollowedBy = isFollowerInSnap || isFollowerInSnapCurrent;
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
              ...isRenamedTarget ? { renamedFrom: cleanUser } : {},
              user: {
                id: resolvedId,
                username: profile.username || cleanUser,
                ...isRenamedTarget ? { previousUsername: cleanUser } : {},
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
          const idMatch = html.match(/\\?"profile_id\\?"\s*:\s*\\?"([1-9][0-9]{4,})\\?"/) || html.match(/\\?"target_id\\?"\s*:\s*\\?"([1-9][0-9]{4,})\\?"/) || html.match(new RegExp(`\\\\?"username\\\\?"\\s*:\\s*\\\\?"${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\\\?"[\\s\\S]{0,400}?\\\\?"(?:id|pk)\\\\?"\\s*:\\s*\\\\?"([1-9][0-9]{4,})\\\\?"`, "i"));
          const htmlId = idMatch?.[1] || null;
          if (htmlId && !options._htmlRetry && (cleanUserLower === viewerName || htmlId !== String(viewerId))) {
            return API.validateTargetAccount(cleanUser, { ...options, userId: htmlId, _htmlRetry: true });
          }
        }
      } catch (e) {
        if (e.name === "AbortError" || options.signal?.aborted) throw e;
      }
      return { exists: false, error: `Could not verify @${cleanUser} right now (Instagram did not return profile data). Please try again in a few minutes.` };
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
      const expectedFollowers = Number(targetUser.followerCount || 0);
      const expectedFollowing = Number(targetUser.followingCount || 0);
      log(`Extracting followers for @${targetUser.username} (expected: ~${expectedFollowers})...`);
      const followersRes = await API.extractCompleteUserList(
        targetUser.id,
        CONFIG.FOLLOWERS_HASH,
        "followers",
        options,
        expectedFollowers,
        {
          onProgress: (curr, total) => setProgress(curr, total, `Extracting target followers (${curr}${total > 0 ? "/" + total : ""})...`),
          onLog: (msg) => log(msg)
        }
      );
      const followers = followersRes.users;
      log(`Extracted ${followers.length} followers for @${targetUser.username}.`);
      if (expectedFollowers > 0 && followers.length < expectedFollowers && !followersRes.rateLimited) {
        if (followersRes.limitedByMeta || followersRes.isPartial) {
          log(`[Meta Notice] Instagram restricted full follower enumeration for @${targetUser.username} (${followers.length}/${expectedFollowers} accessible).`);
        } else {
          log(`[Info] Profile header counter: ${expectedFollowers} followers | Accessible accounts returned by list API: ${followers.length}.`);
        }
      }
      let followingRes;
      if (followersRes.rateLimited) {
        log(`[Anti-Ban Guard] Skipping 'following' extraction because rate limit (429) was detected during 'followers'.`);
        followingRes = {
          users: [],
          isPartial: true,
          rateLimited: true,
          limitedByMeta: false
        };
      } else {
        await Utils.sleep(3500 + Math.random() * 1500, options.signal);
        log(`Extracting following for @${targetUser.username} (expected: ~${expectedFollowing})...`);
        followingRes = await API.extractCompleteUserList(
          targetUser.id,
          CONFIG.FOLLOWING_HASH,
          "following",
          options,
          expectedFollowing,
          {
            onProgress: (curr, total) => setProgress(curr, total, `Extracting target following (${curr}${total > 0 ? "/" + total : ""})...`),
            onLog: (msg) => log(msg)
          }
        );
      }
      const following = followingRes.users;
      if (!followersRes.rateLimited) {
        log(`Extracted ${following.length} following for @${targetUser.username}.`);
      }
      if (expectedFollowing > 0 && following.length < expectedFollowing && !followingRes.rateLimited) {
        if (followingRes.limitedByMeta || followingRes.isPartial) {
          log(`[Meta Notice] Instagram restricted full following enumeration for @${targetUser.username} (${following.length}/${expectedFollowing} accessible).`);
        } else {
          log(`[Info] Profile header counter: ${expectedFollowing} following | Accessible accounts returned by list API: ${following.length}.`);
        }
      }
      const followerIds = new Set(followers.map((u) => u.id).filter(Boolean));
      const followerUsernamesLower = new Set(followers.map((u) => u.username.toLowerCase()));
      const mutuals = following.filter(
        (u) => u.id && followerIds.has(u.id) || followerUsernamesLower.has(u.username.toLowerCase())
      );
      log(`Computed ${mutuals.length} mutual connections for @${targetUser.username}.`);
      return {
        followers,
        following,
        mutuals,
        isRestricted: false,
        isPartialFollowers: Boolean(followersRes.isPartial),
        isPartialFollowing: Boolean(followingRes.isPartial),
        isRateLimitedFollowers: Boolean(followersRes.rateLimited),
        isRateLimitedFollowing: Boolean(followingRes.rateLimited)
      };
    }
  });
  const BACKUP_MAX_DEPTH = 20;
  const BACKUP_UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const BACKUP_TAB_ID = "ig-tab-backup";
  const BACKUP_POPUP_ID = "ig-backup-popup";
  const ACCOUNT_DATA_KEY_BASES = [
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
    CONFIG.STORY_OBS_KEY
  ];
  const GLOBAL_UI_KEY_BASES = [
    CONFIG.POSITION_KEY,
    CONFIG.TARGET_SUBPANEL_POSITION_KEY,
    CONFIG.TOUR_KEY
  ];
  const LEGACY_FLAT_KEYS = [
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
    ...ACCOUNT_DATA_KEY_BASES,
    ...GLOBAL_UI_KEY_BASES,
    ...LEGACY_FLAT_KEYS
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
    if (typeof UI.applyCurrentTheme === "function") {
      UI.applyCurrentTheme();
    } else {
      const panel = document.getElementById("ig-analyzer-panel");
      if (panel?.classList.contains("ig-light-theme")) {
        popup.classList.add("ig-light-theme");
      } else {
        popup.classList.remove("ig-light-theme");
      }
    }
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
    const maxSupportedSchema = CONFIG.BACKUP_SCHEMA_VERSION;
    if (typeof meta.schemaVersion !== "number" || !Number.isInteger(meta.schemaVersion) || meta.schemaVersion < 1 || meta.schemaVersion > maxSupportedSchema) {
      return {
        valid: false,
        reason: `The schema version is not compatible. Supported versions: 1..${maxSupportedSchema}.`
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
    if (meta.ownerUserId !== void 0 && meta.ownerUserId !== null && typeof meta.ownerUserId !== "string") {
      return { valid: false, reason: "The backup ownerUserId field is invalid." };
    }
    if (meta.ownerUsername !== void 0 && meta.ownerUsername !== null && typeof meta.ownerUsername !== "string") {
      return { valid: false, reason: "The backup ownerUsername field is invalid." };
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
      const currentUsername = Utils.getUsername() || null;
      const allKeys = new Set(listedKeys.filter(isAuthorizedBackupKey));
      GLOBAL_UI_KEY_BASES.forEach((gk) => allKeys.add(gk));
      ACCOUNT_DATA_KEY_BASES.forEach((bk) => {
        if (currentId) {
          allKeys.add(`${bk}_${currentId}`);
        } else {
          allKeys.add(bk);
        }
      });
      const data = Object.create(null);
      for (const key of allKeys) {
        if (!isAuthorizedBackupKey(key)) continue;
        if (currentId && ACCOUNT_DATA_KEY_BASES.includes(key)) {
          const scopedCandidate = await getStoredValue(`${key}_${currentId}`);
          if (scopedCandidate !== void 0 && scopedCandidate !== null) {
            continue;
          }
        }
        const val = await getStoredValue(key);
        if (val !== void 0 && val !== null) {
          data[key] = val;
        }
      }
      const metadata = getScriptMetadata();
      const payload = {
        meta: {
          scriptId: metadata.scriptId,
          scriptName: metadata.scriptName,
          scriptVersion: metadata.scriptVersion,
          schemaVersion: CONFIG.BACKUP_SCHEMA_VERSION,
          ownerUserId: currentId ? String(currentId) : null,
          ownerUsername: currentUsername || null,
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
  const clearTargetAccountStorage = async (targetUserId = null) => {
    if (typeof GM_deleteValue !== "function") {
      throw new Error("The GM_deleteValue API is not available in this environment.");
    }
    const currentKeys = await getCurrentStorageKeys();
    const idStr = targetUserId ? String(targetUserId) : null;
    for (const key of currentKeys) {
      if (!isAuthorizedBackupKey(key)) continue;
      if (GLOBAL_UI_KEY_BASES.includes(key) || LEGACY_FLAT_KEYS.includes(key)) {
        GM_deleteValue(key);
        continue;
      }
      if (ACCOUNT_DATA_KEY_BASES.includes(key)) {
        GM_deleteValue(key);
        continue;
      }
      if (idStr && key.endsWith(`_${idStr}`)) {
        GM_deleteValue(key);
        continue;
      }
      if (!idStr) {
        GM_deleteValue(key);
      }
    }
  };
  const promptBackupConfirmation = async (meta, currentUserId2, isAccountMismatch) => {
    const safetyModal = typeof document !== "undefined" ? document.getElementById("ig-safety-modal") : null;
    if (safetyModal && typeof UI.confirmAction === "function") {
      const ownerLine = meta.ownerUsername ? `@${Utils.escapeHtml(String(meta.ownerUsername))}${meta.ownerUserId ? ` (${Utils.escapeHtml(String(meta.ownerUserId))})` : ""}` : meta.ownerUserId ? `ID ${Utils.escapeHtml(String(meta.ownerUserId))}` : "Legacy v1 Backup";
      const mismatchWarning = isAccountMismatch ? `<div style="margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--iga-warning-subtle); border:1px solid var(--iga-border); color:var(--iga-warning); font-size:11.5px; text-align:left;"><b>Account Notice:</b> This backup was exported from <b>${ownerLine}</b>, which differs from your active account (<b>${Utils.escapeHtml(String(currentUserId2))}</b>). Importing will restore this data into your active account without deleting other saved accounts.</div>` : "";
      const htmlMsg = [
        '<div style="text-align:left; font-size:12.5px; line-height:1.55;">',
        '  <div style="margin-bottom:8px;">This backup will overwrite the data for your active Instagram session:</div>',
        `  <div><b>Script:</b> ${Utils.escapeHtml(String(meta.scriptName))} (${Utils.escapeHtml(String(meta.scriptVersion))})</div>`,
        `  <div><b>Source Account:</b> ${ownerLine}</div>`,
        `  <div><b>Exported At:</b> ${Utils.escapeHtml(Utils.formatDate(String(meta.exportedAt)))}</div>`,
        mismatchWarning,
        "</div>"
      ].join("\n");
      return UI.confirmAction("Restore Backup", htmlMsg, "Import Backup", true);
    }
    const lines = [
      "This backup will overwrite the current account data.",
      "",
      `Script: ${meta.scriptName}`,
      `Version: ${meta.scriptVersion}`,
      `Exported at: ${meta.exportedAt}`
    ];
    if (isAccountMismatch) {
      lines.push(`Warning: Backup owner (${meta.ownerUserId}) differs from active account (${currentUserId2}).`);
    }
    lines.push("", "Do you want to continue?");
    return typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(lines.join("\n")) : true;
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
      const currentUserId2 = Storage.getCurrentUserId() || Utils.getUserId();
      const backupOwnerId = typeof meta.ownerUserId === "string" && meta.ownerUserId.trim() ? meta.ownerUserId.trim() : null;
      const isAccountMismatch = Boolean(currentUserId2 && backupOwnerId && String(currentUserId2) !== String(backupOwnerId));
      const confirmed = await promptBackupConfirmation(meta, currentUserId2, isAccountMismatch);
      if (!confirmed) {
        writeBackupStatus("Import canceled by the user.", "info");
        return false;
      }
      await clearTargetAccountStorage(currentUserId2);
      for (const [key, value] of Object.entries(data)) {
        if (GLOBAL_UI_KEY_BASES.includes(key)) {
          GM_setValue(key, value);
          continue;
        }
        if (LEGACY_FLAT_KEYS.includes(key)) {
          continue;
        }
        if (ACCOUNT_DATA_KEY_BASES.includes(key)) {
          if (!currentUserId2) {
            GM_setValue(key, value);
          }
          continue;
        }
        if (!isAccountMismatch || currentUserId2 && key.endsWith(`_${currentUserId2}`)) {
          GM_setValue(key, value);
        }
      }
      const pickBackupValueForBase = (baseKey) => {
        if (currentUserId2 && data[`${baseKey}_${currentUserId2}`] !== void 0) {
          return data[`${baseKey}_${currentUserId2}`];
        }
        if (backupOwnerId && data[`${baseKey}_${backupOwnerId}`] !== void 0) {
          return data[`${baseKey}_${backupOwnerId}`];
        }
        if (data[baseKey] !== void 0) {
          return data[baseKey];
        }
        const anyKey = Object.keys(data).find((k) => k.startsWith(`${baseKey}_`));
        if (anyKey && data[anyKey] !== void 0) {
          return data[anyKey];
        }
        return void 0;
      };
      let restoredSnapshot = pickBackupValueForBase(CONFIG.STORAGE_KEY);
      if (!isPlainObject(restoredSnapshot)) {
        restoredSnapshot = null;
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
          if (typeof GM_deleteValue === "function") {
            GM_deleteValue(CONFIG.STORAGE_KEY);
          }
        } else {
          GM_setValue(CONFIG.STORAGE_KEY, restoredSnapshot);
        }
      }
      const legacyFlatFallbackMap = {
        [CONFIG.HISTORY_KEY]: data.history,
        [CONFIG.WHITELIST_KEY]: data.whitelist,
        [CONFIG.CHURN_KEY]: data.unfollowers,
        [CONFIG.DEACTIVATED_KEY]: data.deactivated,
        [CONFIG.BLOCKED_KEY]: data.blocked,
        [CONFIG.RENAMED_KEY]: data.renamed,
        [CONFIG.NEW_FOLLOWERS_KEY]: data.newFollowersDetailed || data.newFollowers,
        [CONFIG.TARGET_TRACKER_KEY]: data.targetTracker
      };
      ACCOUNT_DATA_KEY_BASES.forEach((baseKey) => {
        if (baseKey === CONFIG.STORAGE_KEY) return;
        let val = pickBackupValueForBase(baseKey);
        if (val === void 0 && legacyFlatFallbackMap[baseKey] !== void 0) {
          val = legacyFlatFallbackMap[baseKey];
        }
        if (val !== void 0 && val !== null) {
          if (currentUserId2) {
            Storage.setScopedValue(baseKey, val, currentUserId2);
          } else {
            GM_setValue(baseKey, val);
          }
        }
        if (currentUserId2 && typeof GM_deleteValue === "function") {
          GM_deleteValue(baseKey);
        }
      });
      GLOBAL_UI_KEY_BASES.forEach((globalKey) => {
        const val = pickBackupValueForBase(globalKey);
        if (val !== void 0 && val !== null) {
          GM_setValue(globalKey, val);
        }
      });
      writeBackupStatus("Backup restored successfully. Reloading the interface...", "success");
      window.setTimeout(() => window.location.reload(), 400);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The backup could not be imported.";
      writeBackupStatus(message, "error");
      const safetyModal = typeof document !== "undefined" ? document.getElementById("ig-safety-modal") : null;
      if (safetyModal && typeof UI.confirmAction === "function") {
        await UI.confirmAction("Backup Import Error", Utils.escapeHtml(message), "Close", false);
      } else if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(`Backup import error:

${message}`);
      }
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
    newMutuals: '<svg width="14" height="14" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke-width="4" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M30,52.16c.81-2.07,7.06-17,19.76-19.86a.09.09,0,0,0,0-.18c-2.14-.86-15.22-6.57-19.38-20.26a.09.09,0,0,0-.18,0c-.51,2.27-3.94,14.43-20,20a.1.1,0,0,0,0,.19c2.24.38,13.48,3.14,19.62,20.15A.1.1,0,0,0,30,52.16Z"></path><path d="M48.79,25.08c.29-.74,2.52-6.07,7.06-7.09a0,0,0,0,0,0-.07c-.76-.3-5.43-2.34-6.92-7.23a0,0,0,0,0-.07,0c-.18.82-1.4,5.16-7.14,7.13a0,0,0,0,0,0,.07c.8.14,4.81,1.12,7,7.2A0,0,0,0,0,48.79,25.08Z"></path></svg>',
    unfollowers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
    user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
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
    refresh: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    arrowRight: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>',
    repeat: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    chartArea: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/></svg>'
  };
  Object.assign(UI, {
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
        '    <button class="ig-tab-btn" data-target="ig-view-history"><span class="ig-tab-icon">' + Icons.history + '</span><span class="ig-tab-label">History</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-history">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-notfollowing"><span class="ig-tab-icon">' + Icons.notFollowing + '</span><span class="ig-tab-label">Not Following</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-notfollowing">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-fans"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Fans</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-fans">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-mutuals">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-targettracker"><span class="ig-tab-icon">' + Icons.target + '</span><span class="ig-tab-label">Target Tracker</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-targettracker">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-newfollowers">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-whitelist"><span class="ig-tab-icon">' + Icons.shieldCheck + '</span><span class="ig-tab-label">Whitelist</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-whitelist">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-unfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Unfollowers</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-unfollowers">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-deactivated"><span class="ig-tab-icon">' + Icons.deactivated + '</span><span class="ig-tab-label">Deactivated</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-deactivated">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-blocked"><span class="ig-tab-icon">' + Icons.blocked + '</span><span class="ig-tab-label">Blocked</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-blocked">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-view-renamed"><span class="ig-tab-icon">' + Icons.renamed + '</span><span class="ig-tab-label">Renamed</span><span class="ig-tab-count is-empty" data-tab-count="ig-view-renamed">0</span></button>',
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
        '  <span class="ig-footer-meta">v3.14.0</span>',
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
          if (panel) panel.style.display = "none";
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
      UI.updateMainTabCounts();
      UI.syncMainExportButton();
      Utils.getUserIdAsync().then((asyncId) => {
        if (asyncId && asyncId !== Storage.getCurrentUserId()) {
          Storage.setCurrentUserId(asyncId);
          UI.renderHistory(Storage.getHistory(asyncId), asyncId);
          UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY, asyncId), "ig-view-unfollowers", "Recent Unfollowers", { userId: asyncId });
          UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY, asyncId), "ig-view-deactivated", "Deactivated Accounts", { userId: asyncId });
          UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY, asyncId), "ig-view-blocked", "Blocked Accounts", { userId: asyncId });
          UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY, asyncId), "ig-view-renamed", "Username Changes", { userId: asyncId });
          UI.renderNewFollowers(Storage.getNewFollowersList(asyncId));
          UI.renderWhitelist(Storage.getWhitelist(asyncId));
          UI.renderTargetTrackerMainView(asyncId);
          UI.renderPersistedSnapshot(Storage.load(asyncId), asyncId);
          UI.updateMainTabCounts(asyncId);
          UI.syncMainExportButton();
        }
      }).catch(() => {
      });
    },
    applyCurrentTheme: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      const subpanel = document.getElementById("ig-target-subpanel");
      const safetyModal = document.getElementById("ig-safety-modal");
      const hdModal = document.getElementById("ig-hd-modal");
      const backupPopup = document.getElementById("ig-backup-popup");
      const backupOverlays = typeof document.querySelectorAll === "function" ? Array.from(document.querySelectorAll(".ig-backup-overlay")) : [];
      const targets = Array.from(new Set([panel, subpanel, safetyModal, hdModal, backupPopup, ...backupOverlays].filter(Boolean)));
      if (targets.length === 0) return;
      const html = document.documentElement;
      const body = document.body;
      const isExplicitDark = Boolean(
        html?.classList?.contains("_aa55") || html?.getAttribute?.("data-theme") === "dark" || body && body.getAttribute?.("data-theme") === "dark"
      );
      if (isExplicitDark) {
        targets.forEach((t) => t.classList.remove("ig-light-theme"));
        return;
      }
      const isExplicitLight = Boolean(
        html?.getAttribute?.("data-theme") === "light" || body && body.getAttribute?.("data-theme") === "light"
      );
      if (isExplicitLight) {
        targets.forEach((t) => t.classList.add("ig-light-theme"));
        return;
      }
      const bodyBg = typeof window !== "undefined" && typeof window.getComputedStyle === "function" && (body || html) ? window.getComputedStyle(body || html).backgroundColor : "";
      const isLightBg = bodyBg === "rgb(255, 255, 255)" || bodyBg === "#ffffff" || bodyBg === "white" || bodyBg === "rgb(250, 250, 250)" || bodyBg === "#fafafa";
      if (isLightBg) {
        targets.forEach((t) => t.classList.add("ig-light-theme"));
        return;
      }
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        targets.forEach((t) => t.classList.add("ig-light-theme"));
      } else {
        targets.forEach((t) => t.classList.remove("ig-light-theme"));
      }
    },
    setupThemeObserver: () => {
      let rafId = null;
      const checkTheme = () => {
        UI.applyCurrentTheme();
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
          if (targetView) {
            targetView.classList.add("active");
            if (typeof UI.loadAvatarsProgressively === "function") {
              UI.loadAvatarsProgressively(targetView);
            }
            if (typeof UI.hydrateVisibleMainPageFriendships === "function") {
              UI.hydrateVisibleMainPageFriendships(targetId);
            }
          }
          updateIndicator(target, true);
          if (typeof UI.syncMainExportButton === "function") {
            UI.syncMainExportButton();
          }
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
      if (panel) {
        panel.style.left = "auto";
        panel.style.top = CONFIG.DEFAULT_POSITION.top + "px";
        panel.style.right = CONFIG.DEFAULT_POSITION.right + "px";
        panel.style.width = CONFIG.DEFAULT_POSITION.width + "px";
        panel.style.height = CONFIG.DEFAULT_POSITION.height + "px";
        GM_deleteValue(CONFIG.POSITION_KEY);
      }
      const subpanel = document.getElementById("ig-target-subpanel");
      if (subpanel) {
        const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
        subpanel.style.left = Math.max(30, vw - 960) + "px";
        subpanel.style.top = "90px";
        subpanel.style.right = "auto";
        subpanel.style.width = "";
        subpanel.style.height = "";
        GM_deleteValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY);
      }
    },
    toggleMinimize: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      if (panel) {
        panel.classList.toggle("is-minimized");
      }
    },
    lastPanelsState: null,
    togglePanel: () => {
      const mainPanel = document.getElementById("ig-analyzer-panel");
      const subpanel = document.getElementById("ig-target-subpanel");
      const isMainVisible = Boolean(
        mainPanel && mainPanel.style.display !== "none" && (mainPanel.offsetParent !== null || window.getComputedStyle(mainPanel).display !== "none")
      );
      const isSubVisible = Boolean(
        subpanel && subpanel.style.display !== "none" && (subpanel.offsetParent !== null || window.getComputedStyle(subpanel).display !== "none")
      );
      if (isMainVisible || isSubVisible) {
        UI.lastPanelsState = {
          main: isMainVisible,
          sub: isSubVisible
        };
        if (mainPanel) mainPanel.style.display = "none";
        if (subpanel) subpanel.style.display = "none";
      } else {
        if (mainPanel) mainPanel.style.display = "flex";
        if (subpanel && UI.lastPanelsState?.sub) {
          subpanel.style.display = "flex";
        }
      }
    },
    CHIPS_DEF: [
      { id: "all", label: "All", icon: null },
      { id: "private", label: "Private", icon: Icons.lock },
      { id: "public", label: "Public", icon: null },
      { id: "besties", label: "Besties", icon: Icons.star },
      { id: "pending", label: "Pending", icon: Icons.clock },
      { id: "story", label: "With Story", icon: Icons.storyRing },
      { id: "verified", label: "Verified", icon: Icons.verified }
    ],
    NOMINAL_CHIPS_DEF: [
      { id: "all", label: "All", icon: null },
      { id: "repeat", label: "Repeat 2x+", icon: Icons.repeat },
      { id: "renamed", label: "Renamed", icon: Icons.renamed },
      { id: "private", label: "Private", icon: Icons.lock },
      { id: "verified", label: "Verified", icon: Icons.verified }
    ],
    RENAMED_CHIPS_DEF: [
      { id: "all", label: "All", icon: null },
      { id: "mutual", label: "Mutual", icon: Icons.mutuals },
      { id: "fan", label: "Fan", icon: Icons.fans },
      { id: "following", label: "Following", icon: Icons.user },
      { id: "verified", label: "Verified", icon: Icons.verified }
    ],
    refreshMainTabIndicator: () => {
      const tabsContainer = document.getElementById("ig-tabs");
      if (!tabsContainer || typeof UI.updateTabIndicator !== "function") return;
      const activeBtn = tabsContainer.querySelector(".ig-tab-btn.active");
      if (activeBtn) {
        UI.updateTabIndicator(activeBtn, false);
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => UI.updateTabIndicator(activeBtn, false));
        }
      }
    },
    getActiveExportContext: () => {
      const activeTab = document.querySelector("#ig-tabs .ig-tab-btn.active");
      const targetId = activeTab ? activeTab.getAttribute("data-target") : "ig-log";
      const paginatedSlugs = {
        "ig-view-notfollowing": "not_following_back",
        "ig-view-fans": "fans",
        "ig-view-mutuals": "mutuals",
        "ig-view-newfollowers": "new_followers",
        "ig-view-unfollowers": "unfollowers",
        "ig-view-deactivated": "deactivated",
        "ig-view-blocked": "blocked",
        "ig-view-renamed": "renamed"
      };
      if (targetId && Object.prototype.hasOwnProperty.call(paginatedSlugs, targetId)) {
        const state = UI.paginationState[targetId];
        return {
          mode: "users",
          slug: paginatedSlugs[targetId],
          items: Array.isArray(state?.users) ? state.users : []
        };
      }
      if (targetId === "ig-view-whitelist") {
        const rawWl = Storage.getWhitelist();
        const q = String(UI.whitelistSearchQuery || "").trim().toLowerCase();
        const filtered = q ? rawWl.filter((u) => String(u || "").toLowerCase().includes(q)) : rawWl;
        const items = filtered.slice().reverse().map((username) => {
          const known = typeof Storage.findKnownUserByUsername === "function" ? Storage.findKnownUserByUsername(username) : null;
          return {
            ...known || {},
            username: String(username || "").replace(/^@+/, "").trim(),
            url: Utils.sanitizeUrl(username)
          };
        });
        return { mode: "users", slug: "whitelist", items };
      }
      if (targetId === "ig-view-history") {
        return {
          mode: "history",
          slug: "history",
          items: Storage.getHistory()
        };
      }
      if (targetId === "ig-log") {
        const nfRaw = UI.paginationState["ig-view-notfollowing"]?.rawUsers;
        const fallback = Array.isArray(nfRaw) ? nfRaw : Array.isArray(window.__igLastResults) ? window.__igLastResults : [];
        return {
          mode: "users",
          slug: "not_following_back",
          items: fallback
        };
      }
      return { mode: "none", slug: "none", items: [] };
    },
    syncMainExportButton: () => {
      const exportBtn = document.getElementById("ig-export-csv");
      if (!exportBtn) return;
      const ctx = typeof UI.getActiveExportContext === "function" ? UI.getActiveExportContext() : null;
      exportBtn.disabled = !ctx || !Array.isArray(ctx.items) || ctx.items.length === 0;
    },
    updateMainTabCounts: (userId = null) => {
      const tabsContainer = document.getElementById("ig-tabs");
      if (!tabsContainer) return;
      const snap = Storage.load(userId);
      const countsMap = {
        "ig-view-history": Storage.getHistory(userId).length,
        "ig-view-notfollowing": UI.paginationState["ig-view-notfollowing"]?.rawUsers?.length ?? 0,
        "ig-view-fans": UI.paginationState["ig-view-fans"]?.rawUsers?.length ?? (snap?.fansDetailed?.length ?? 0),
        "ig-view-mutuals": UI.paginationState["ig-view-mutuals"]?.rawUsers?.length ?? (snap?.mutualsDetailed?.length ?? 0),
        "ig-view-targettracker": Object.keys(Storage.getTargetTrackerMap(userId) || {}).length,
        "ig-view-newfollowers": Storage.getNewFollowersList(userId).length,
        "ig-view-whitelist": Storage.getWhitelist(userId).length,
        "ig-view-unfollowers": Storage.getNominalList(CONFIG.CHURN_KEY, userId).length,
        "ig-view-deactivated": Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId).length,
        "ig-view-blocked": Storage.getNominalList(CONFIG.BLOCKED_KEY, userId).length,
        "ig-view-renamed": Storage.getNominalList(CONFIG.RENAMED_KEY, userId).length
      };
      Object.entries(countsMap).forEach(([tabId, rawCount]) => {
        const badge = tabsContainer.querySelector(`[data-tab-count="${tabId}"]`);
        if (!badge) return;
        const count = Math.max(0, Number(rawCount) || 0);
        badge.textContent = count > 0 ? Utils.formatNumber(count) : "0";
        if (count > 0) {
          badge.classList.remove("is-empty");
        } else {
          badge.classList.add("is-empty");
        }
      });
      UI.refreshMainTabIndicator();
    }
  });
  Object.assign(UI, {
    confirmAction: (title, message, confirmBtnText = "Yes, Continue", showCancel = true, customIcon = null) => {
      return new Promise((resolve) => {
        const modal = document.getElementById("ig-safety-modal");
        const titleEl = document.getElementById("ig-modal-title-text");
        const bodyEl = document.getElementById("ig-modal-body-text");
        const btnYes = document.getElementById("ig-modal-confirm");
        const btnNo = document.getElementById("ig-modal-cancel");
        const iconEl = modal ? modal.querySelector(".ig-modal-icon") : null;
        if (!modal) return resolve(true);
        const contentEl = modal.querySelector(".ig-modal-content");
        if (contentEl) contentEl.classList.remove("is-engine-modal");
        titleEl.textContent = title;
        bodyEl.innerHTML = message;
        btnYes.textContent = confirmBtnText;
        if (iconEl && customIcon) {
          iconEl.innerHTML = customIcon;
        }
        if (btnNo) {
          btnNo.style.display = showCancel ? "inline-block" : "none";
        }
        if (typeof UI.applyCurrentTheme === "function") {
          UI.applyCurrentTheme();
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
getEngineDisplayName: (engine) => {
      const mode = String(engine || "").toLowerCase();
      if (mode === "graphql") return "GraphQL Relay (usePolarisGetFollowListQuery · batch 20)";
      if (mode === "rest") return "REST Classic (Friendships API · batch 12)";
      return "Smart Hybrid (REST + Auto GraphQL Rescue)";
    },
confirmExtractionModal: ({ title, message, confirmBtnText = "Yes, Continue", customIcon = null } = {}) => {
      return new Promise((resolve) => {
        const modal = document.getElementById("ig-safety-modal");
        const contentEl = modal ? modal.querySelector(".ig-modal-content") : null;
        const titleEl = document.getElementById("ig-modal-title-text");
        const bodyEl = document.getElementById("ig-modal-body-text");
        const btnYes = document.getElementById("ig-modal-confirm");
        const btnNo = document.getElementById("ig-modal-cancel");
        const iconEl = modal ? modal.querySelector(".ig-modal-icon") : null;
        let selectedEngine = typeof Storage.getExtractionEngine === "function" ? Storage.getExtractionEngine() : CONFIG.DEFAULT_EXTRACTION_ENGINE;
        if (!modal) {
          return resolve({ confirmed: true, engine: selectedEngine });
        }
        const engineOptions = [
          {
            id: "hybrid",
            name: "Smart Hybrid",
            badge: "Recommended",
            badgeClass: "is-recommended",
            desc: "<b>Gain:</b> 100% live 24h Story rings (<i>With Story</i>) &amp; instant <i>Private/Public</i> locks via REST, plus automatic GraphQL Relay rescue if REST truncates the list (&lt;92%).<br><b>Note:</b> Runs a second pass only when REST drops 6+ border accounts."
          },
          {
            id: "graphql",
            name: "GraphQL Relay",
            badge: "-40% Requests · Max Accuracy",
            badgeClass: "is-accent",
            desc: "<b>Gain:</b> Batch size 20 with opaque Base64 cursors (zero dropped border accounts), native <i>Besties</i> &amp; <i>Pending</i> flags, and page-level <i>Private</i> locks via <code>show_many</code>.<br><b>Lose:</b> Bulk 24h <i>With Story</i> filter in toolbar (row <i>Story</i> button still works). Auto-falls back to REST on error."
          },
          {
            id: "rest",
            name: "REST Classic",
            badge: "100% Live Stories",
            badgeClass: "is-neutral",
            desc: "<b>Gain:</b> Single-pass native modal endpoint (<code>?count=12</code>) with live <i>With Story</i> rings and <i>Private/Public</i> status in every page.<br><b>Lose:</b> Numeric <code>max_id</code> cursor may omit 5%–15% of accounts on some third-party profiles. Auto-falls back to GraphQL on error."
          }
        ];
        const cardsHtml = engineOptions.map((opt) => {
          const isSelected = opt.id === selectedEngine;
          return [
            `<div class="ig-engine-card${isSelected ? " is-selected" : ""}" data-engine="${opt.id}" role="radio" tabindex="0" aria-checked="${isSelected ? "true" : "false"}">`,
            '  <div class="ig-engine-card-header">',
            '    <span class="ig-engine-radio" aria-hidden="true"></span>',
            `    <span class="ig-engine-name">${opt.name}</span>`,
            `    <span class="ig-engine-badge ${opt.badgeClass}">${opt.badge}</span>`,
            "  </div>",
            `  <div class="ig-engine-desc">${opt.desc}</div>`,
            "</div>"
          ].join("\n");
        }).join("\n");
        if (contentEl) contentEl.classList.add("is-engine-modal");
        titleEl.textContent = title || "Confirm Extraction";
        bodyEl.innerHTML = [
          `<div class="ig-engine-intro">${message || ""}</div>`,
          '<div class="ig-engine-selector" role="radiogroup" aria-label="Extraction Engine">',
          '  <div class="ig-engine-selector-label">Extraction Engine</div>',
          cardsHtml,
          "</div>"
        ].join("\n");
        btnYes.textContent = confirmBtnText;
        if (iconEl) {
          iconEl.innerHTML = customIcon || Icons.warning;
        }
        if (btnNo) {
          btnNo.style.display = "inline-block";
        }
        if (typeof UI.applyCurrentTheme === "function") {
          UI.applyCurrentTheme();
        }
        const cards = Array.from(bodyEl.querySelectorAll(".ig-engine-card[data-engine]"));
        const selectEngine = (nextEngine) => {
          if (!nextEngine) return;
          selectedEngine = typeof Storage.setExtractionEngine === "function" ? Storage.setExtractionEngine(nextEngine) : nextEngine;
          cards.forEach((card) => {
            const active = card.getAttribute("data-engine") === selectedEngine;
            card.classList.toggle("is-selected", active);
            card.setAttribute("aria-checked", active ? "true" : "false");
          });
        };
        cards.forEach((card) => {
          card.addEventListener("click", () => {
            selectEngine(card.getAttribute("data-engine"));
          });
          card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectEngine(card.getAttribute("data-engine"));
            }
          });
        });
        modal.style.display = "flex";
        const closeAndResolve = (confirmed) => {
          modal.style.display = "none";
          if (contentEl) contentEl.classList.remove("is-engine-modal");
          if (btnNo) btnNo.style.display = "inline-block";
          if (iconEl) iconEl.innerHTML = Icons.warning;
          bodyEl.innerHTML = "";
          btnYes.onclick = null;
          if (btnNo) btnNo.onclick = null;
          resolve({ confirmed, engine: confirmed ? selectedEngine : null });
        };
        btnYes.onclick = () => closeAndResolve(true);
        if (btnNo) btnNo.onclick = () => closeAndResolve(false);
      });
    },
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
      if (typeof UI.applyCurrentTheme === "function") {
        UI.applyCurrentTheme();
      }
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
      } else if (u.containerId === "ig-view-newfollowers") {
        relPills = '<span class="ig-qc-rel-pill is-positive">New Follower</span>' + (u.followsBack === true ? '<span class="ig-qc-rel-pill is-neutral">Mutual</span>' : u.followsBack === false ? '<span class="ig-qc-rel-pill">Fan</span>' : "");
      } else if (u.containerId === "ig-view-unfollowers") {
        relPills = '<span class="ig-qc-rel-pill is-negative">Unfollowed you</span>';
      } else if (u.containerId === "ig-view-deactivated") {
        relPills = '<span class="ig-qc-rel-pill is-pending">Deactivated</span>';
      } else if (u.containerId === "ig-view-blocked") {
        relPills = '<span class="ig-qc-rel-pill is-negative">Unavailable / Blocked</span>';
      } else if (u.containerId === "ig-view-renamed") {
        const safeOld = u.oldUsername ? Utils.escapeHtml(u.oldUsername) : "";
        relPills = safeOld ? `<span class="ig-qc-rel-pill is-neutral">was @${safeOld}</span>` : '<span class="ig-qc-rel-pill is-neutral">Renamed</span>';
      } else if (u.containerId === "ig-view-whitelist") {
        relPills = '<span class="ig-qc-rel-pill is-neutral">Whitelisted</span>';
      }
      relBarEl.innerHTML = relPills;
      const setResPill = (mode, labelText) => {
        pillEl.innerHTML = "";
        pillEl.className = mode === "hd" ? "ig-hd-res-pill is-hd" : "ig-hd-res-pill";
        if (mode === "loading") {
          const spin = document.createElement("span");
          spin.className = "ig-hd-spinner";
          pillEl.appendChild(spin);
          pillEl.appendChild(document.createTextNode(" " + labelText));
        } else if (mode === "hd") {
          pillEl.insertAdjacentHTML("afterbegin", Icons.verified);
          pillEl.appendChild(document.createTextNode(" " + labelText));
        } else {
          pillEl.textContent = labelText;
        }
      };
      setResPill("loading", "Loading 1080p...");
      if (typeof UI.applyCurrentTheme === "function") {
        UI.applyCurrentTheme();
      }
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      try {
        let targetId = u.id && String(u.id) !== "0" && String(u.id) !== "null" && String(u.id) !== "undefined" ? String(u.id).trim() : null;
        if (!targetId && safeUsername) {
          if (typeof Storage.findKnownUserByUsername === "function") {
            const knownLocal = Storage.findKnownUserByUsername(safeUsername);
            if (knownLocal?.id && String(knownLocal.id) !== "0") {
              targetId = String(knownLocal.id);
            }
          }
          if (!targetId && typeof API.resolveUserId === "function") {
            targetId = await API.resolveUserId(safeUsername, { signal });
          }
          if (signal.aborted) return;
          if (targetId) {
            u.id = targetId;
            Storage.updateUserProfile(safeUsername, { id: targetId });
            if (typeof document.querySelectorAll === "function") {
              const lowerTarget = safeUsername.toLowerCase();
              document.querySelectorAll(".ig-user-avatar-trigger, .btn-inspect-user, .ig-btn-inspect-user, .ig-user-row").forEach((node) => {
                const nodeUser = (node.getAttribute("data-username") || node.getAttribute("data-user") || "").toLowerCase();
                if (nodeUser === lowerTarget) {
                  node.setAttribute("data-user-id", targetId);
                }
              });
            }
          }
        }
        const hdData = targetId ? await API.fetchUserProfileHd(targetId, safeUsername, { signal }) : null;
        if (signal.aborted) return;
        if (hdData) {
          if (hdData.fullName) {
            fullnameEl.textContent = hdData.fullName;
          }
          verifiedEl.style.display = hdData.isVerified || u.isVerified ? "inline-flex" : "none";
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
          facepileEl.innerHTML = "";
          if (typeof hdData.mutualsCount === "number" && hdData.mutualsCount > 0) {
            mutualsCardEl.style.display = "block";
            if (hdData.mutualUsers && hdData.mutualUsers.length > 0) {
              const namedMutuals = hdData.mutualUsers.slice(0, 2).map((m) => "@" + m).join(", ");
              const remaining = hdData.mutualsCount - hdData.mutualUsers.slice(0, 2).length;
              mutualsSummaryEl.textContent = `Followed by ${namedMutuals}${remaining > 0 ? ` and ${remaining} other${remaining === 1 ? "" : "s"}` : ""}`;
            } else {
              mutualsSummaryEl.textContent = `${hdData.mutualsCount} mutual connection${hdData.mutualsCount === 1 ? "" : "s"}`;
            }
            if (Array.isArray(hdData.facepileUsers) && hdData.facepileUsers.length > 0) {
              hdData.facepileUsers.slice(0, 5).forEach((f) => {
                const fName = String(f?.username || f?.fullName || "").trim();
                const initial = fName ? fName.charAt(0).toUpperCase() : "M";
                const safePic = Utils.sanitizeImageUrl(f?.profilePicUrl);
                const fallbackSpan = document.createElement("span");
                fallbackSpan.className = "ig-facepile-avatar ig-facepile-fallback";
                fallbackSpan.textContent = initial;
                if (f?.username) fallbackSpan.title = "@" + f.username;
                if (safePic) {
                  fallbackSpan.style.display = "none";
                  const fImg = document.createElement("img");
                  fImg.className = "ig-facepile-avatar";
                  fImg.src = safePic;
                  fImg.alt = f?.username ? `@${f.username}` : "";
                  fImg.loading = "lazy";
                  if (f?.username) fImg.title = "@" + f.username;
                  fImg.addEventListener("error", () => {
                    fImg.style.display = "none";
                    fallbackSpan.style.display = "inline-flex";
                  }, { once: true });
                  facepileEl.appendChild(fImg);
                } else {
                  fallbackSpan.style.display = "inline-flex";
                }
                facepileEl.appendChild(fallbackSpan);
              });
            }
          } else {
            mutualsCardEl.style.display = "none";
          }
          Storage.updateUserProfile(safeUsername, {
            id: hdData.id || targetId || null,
            fullName: hdData.fullName || u.fullName || "",
            isVerified: Boolean(hdData.isVerified ?? u.isVerified),
            isPrivate: Boolean(hdData.isPrivate ?? u.isPrivate)
          });
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
                setResPill("hd", "1080p Full HD");
                UI.updateUserAvatarInDom(safeUsername, cleanHdUrl);
                Storage.updateUserProfile(safeUsername, {
                  profilePicUrl: cleanHdUrl,
                  fullName: hdData.fullName || u.fullName || ""
                });
                btnDownload.onclick = () => {
                  Utils.downloadImage(cleanHdUrl, `@${safeUsername}_profile_1080p.jpg`);
                };
              };
              preload.onerror = () => {
                if (signal.aborted) return;
                setResPill("standard", "Standard Resolution");
              };
              preload.src = cleanHdUrl;
            } else {
              setResPill("standard", "Standard Resolution");
            }
          } else {
            setResPill("standard", "Standard Resolution");
          }
          if (hdData.isBestie) {
            frameEl.classList.add("has-bestie-ring");
          } else if (hdData.latestReelMedia && hdData.latestReelMedia > 0) {
            frameEl.classList.add("has-story-ring");
          }
        } else {
          setResPill(
            "unavailable",
            initialAvatarUrl ? "Standard Resolution" : "Profile Unavailable"
          );
        }
      } catch (err) {
        if (signal.aborted) return;
        console.warn("[IG Analyzer] Quick-Card profile fetch skipped/failed:", err);
        setResPill("standard", initialAvatarUrl ? "Standard Resolution" : "Profile Unavailable");
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
    lastLogMessage: null,
    lastLogTimeMs: 0,
    log: (msg) => {
      try {
        const nowMs = Date.now();
        if (UI.lastLogMessage === msg && nowMs - (UI.lastLogTimeMs || 0) < 1200) {
          return;
        }
        UI.lastLogMessage = msg;
        UI.lastLogTimeMs = nowMs;
        const box = document.getElementById("ig-log");
        if (box) {
          const timeStr = (typeof Utils.localTimeStr === "function" ? Utils.localTimeStr() : "") || ((typeof Utils.now === "function" ? Utils.now() : ( new Date()).toISOString()).split("T")[1]?.split(".")[0] || "");
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
    }
  });
  const METRIC_CONFIG = {
    followers: {
      label: "Followers",
      startField: "startFollowers",
      lastDeltaField: "lastDeltaFollowers",
      intradayField: "intradayDeltaFollowers",
      stroke: "#3b82f6"
    },
    following: {
      label: "Following",
      startField: "startFollowing",
      lastDeltaField: "lastDeltaFollowing",
      intradayField: "intradayDeltaFollowing",
      stroke: "#8b5cf6"
    },
    mutuals: {
      label: "Mutuals",
      startField: "startMutuals",
      lastDeltaField: "lastDeltaMutuals",
      intradayField: "intradayDeltaMutuals",
      stroke: "#10b981"
    }
  };
  const RANGE_LIMITS = {
    "7d": 7,
    "30d": 30,
    "all": Infinity
  };
  const roundCoord = (n) => Math.round(Number(n) * 100) / 100;
  const shortDateLabel = (dateStr) => {
    const raw = String(dateStr || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw.slice(5);
    }
    return raw.slice(0, 10);
  };
  Object.assign(UI, {
buildKpiDelta: (currVal, prevDayVal, startVal, lastDeltaVal, scansCount) => {
      const curr = Number(currVal ?? 0);
      const scans = Number(scansCount) || 1;
      const hasLastDelta = lastDeltaVal !== void 0 && lastDeltaVal !== null;
      const lastDelta = hasLastDelta ? Number(lastDeltaVal) : 0;
      if (prevDayVal !== null && prevDayVal !== void 0) {
        const dayDiff = curr - Number(prevDayVal);
        const intraDiff = curr - Number(startVal ?? curr);
        if (dayDiff > 0) {
          const suffix = scans > 1 && hasLastDelta && lastDelta !== dayDiff && lastDelta !== 0 ? ` (${lastDelta > 0 ? "+" : ""}${lastDelta} last)` : "";
          return { text: `+${dayDiff.toLocaleString()} vs prev${suffix}`, cls: "is-positive", icon: Icons.trendingUp };
        }
        if (dayDiff < 0) {
          const suffix = scans > 1 && hasLastDelta && lastDelta !== dayDiff && lastDelta !== 0 ? ` (${lastDelta > 0 ? "+" : ""}${lastDelta} last)` : "";
          return { text: `${dayDiff.toLocaleString()} vs prev${suffix}`, cls: "is-negative", icon: Icons.trendingDown };
        }
        if (scans > 1 && intraDiff !== 0) {
          const sign = intraDiff > 0 ? "+" : "";
          return {
            text: `0 vs prev (${sign}${intraDiff.toLocaleString()} today)`,
            cls: intraDiff > 0 ? "is-positive" : "is-negative",
            icon: intraDiff > 0 ? Icons.trendingUp : Icons.trendingDown
          };
        }
        return { text: "No change vs prev", cls: "is-neutral", icon: Icons.neutral };
      }
      if (scans > 1) {
        const intraDiff = curr - Number(startVal ?? curr);
        if (intraDiff > 0) {
          return { text: `+${intraDiff.toLocaleString()} today`, cls: "is-positive", icon: Icons.trendingUp };
        }
        if (intraDiff < 0) {
          return { text: `${intraDiff.toLocaleString()} today`, cls: "is-negative", icon: Icons.trendingDown };
        }
        if (hasLastDelta && lastDelta !== 0) {
          const sign = lastDelta > 0 ? "+" : "";
          return {
            text: `0 today (${sign}${lastDelta.toLocaleString()} last)`,
            cls: lastDelta > 0 ? "is-positive" : "is-negative",
            icon: lastDelta > 0 ? Icons.trendingUp : Icons.trendingDown
          };
        }
        return { text: "No change today", cls: "is-neutral", icon: Icons.neutral };
      }
      return { text: "First record", cls: "is-neutral", icon: Icons.neutral };
    },
formatDeltaPillHtml: (dayDelta, { intradayDelta = 0, scansCount = 1, isBaselineRow = false } = {}) => {
      const scans = Number(scansCount) || 1;
      const intra = Number(intradayDelta || 0);
      if (isBaselineRow) {
        if (scans > 1 && intra !== 0) {
          const cls = intra > 0 ? "is-positive" : "is-negative";
          const sign = intra > 0 ? "+" : "";
          return `<span class="ig-delta-pill ${cls}" title="Intraday change on baseline day">${sign}${intra.toLocaleString()}</span>`;
        }
        return '<span class="ig-delta-pill is-neutral" title="Opening baseline">—</span>';
      }
      const diff = Number(dayDelta || 0);
      if (diff > 0) {
        return `<span class="ig-delta-pill is-positive">+${diff.toLocaleString()}</span>`;
      }
      if (diff < 0) {
        return `<span class="ig-delta-pill is-negative">${diff.toLocaleString()}</span>`;
      }
      if (scans > 1 && intra !== 0) {
        const cls = intra > 0 ? "is-positive" : "is-negative";
        const sign = intra > 0 ? "+" : "";
        return `<span class="ig-delta-pill ${cls}" title="Net 0 vs previous day, ${sign}${intra} intraday">${sign}${intra.toLocaleString()} today</span>`;
      }
      return '<span class="ig-delta-pill is-neutral">0</span>';
    },
computeTrendSeries: (historyList, { metric = "followers", range = "30d" } = {}) => {
      const normalized = Storage.normalizeHistoryRecords(Array.isArray(historyList) ? historyList : []).list;
      const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.followers;
      const metricKey = METRIC_CONFIG[metric] ? metric : "followers";
      const limit = RANGE_LIMITS[range] || 30;
      const withMetric = [];
      normalized.forEach((entry, idx) => {
        const rawVal = entry?.[metricKey];
        if (rawVal !== void 0 && rawVal !== null && !Number.isNaN(Number(rawVal))) {
          withMetric.push({ entry, fullIdx: idx });
        }
      });
      const viewWidth = 520;
      const viewHeight = 158;
      const padLeft = 48;
      const padRight = 16;
      const padTop = 14;
      const padBottom = 26;
      const plotW = viewWidth - padLeft - padRight;
      const plotH = viewHeight - padTop - padBottom;
      const bottomY = padTop + plotH;
      if (withMetric.length === 0) {
        return {
          isEmpty: true,
          metric: metricKey,
          metricLabel: cfg.label,
          range,
          points: [],
          viewWidth,
          viewHeight
        };
      }
      const windowed = Number.isFinite(limit) ? withMetric.slice(-limit) : withMetric;
      let mode = "multi-day";
      let rawPoints = [];
      if (windowed.length === 1) {
        const { entry } = windowed[0];
        const currVal = Number(entry[metricKey] ?? 0);
        const startRaw = entry[cfg.startField];
        const startVal = startRaw !== void 0 && startRaw !== null && !Number.isNaN(Number(startRaw)) ? Number(startRaw) : currVal;
        const scans = Number(entry.scansCount) || 1;
        if (scans > 1) {
          mode = "intraday-single-day";
          rawPoints = [
            {
              date: entry.date,
              displayDate: `${entry.date} (Open)`,
              axisLabel: "Start",
              value: startVal,
              startValue: startVal,
              delta: 0,
              intradayDelta: 0,
              scansCount: 1,
              isOpeningAnchor: true
            },
            {
              date: entry.date,
              displayDate: `${entry.date} (Current)`,
              axisLabel: "Now",
              value: currVal,
              startValue: startVal,
              delta: currVal - startVal,
              intradayDelta: currVal - startVal,
              scansCount: scans,
              isOpeningAnchor: false
            }
          ];
        } else {
          mode = "single-baseline";
          rawPoints = [
            {
              date: entry.date,
              displayDate: entry.date,
              axisLabel: shortDateLabel(entry.date),
              value: currVal,
              startValue: startVal,
              delta: 0,
              intradayDelta: 0,
              scansCount: 1,
              isBaselineOnly: true
            }
          ];
        }
      } else {
        rawPoints = windowed.map(({ entry, fullIdx }, idx) => {
          const val = Number(entry[metricKey] ?? 0);
          const startRaw = entry[cfg.startField];
          const startVal = startRaw !== void 0 && startRaw !== null && !Number.isNaN(Number(startRaw)) ? Number(startRaw) : val;
          let prevVal = null;
          if (idx > 0) {
            prevVal = Number(windowed[idx - 1].entry[metricKey] ?? 0);
          } else if (fullIdx > 0) {
            const prevCandidate = normalized[fullIdx - 1]?.[metricKey];
            if (prevCandidate !== void 0 && prevCandidate !== null && !Number.isNaN(Number(prevCandidate))) {
              prevVal = Number(prevCandidate);
            }
          }
          const delta = prevVal !== null ? val - prevVal : val - startVal;
          const intradayDelta = val - startVal;
          return {
            date: entry.date,
            displayDate: entry.date,
            axisLabel: shortDateLabel(entry.date),
            value: val,
            startValue: startVal,
            delta,
            intradayDelta,
            scansCount: Number(entry.scansCount) || 1,
            hasPrevDay: prevVal !== null
          };
        });
      }
      const values = rawPoints.map((p) => p.value);
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const rawSpan = rawMax - rawMin;
      let yMin = 0;
      let yMax = 4;
      if (rawSpan === 0) {
        yMin = Math.max(0, rawMin - 2);
        yMax = yMin + 4;
      } else {
        const pad = Math.max(1, Math.ceil(rawSpan * 0.18));
        yMin = Math.max(0, rawMin - pad);
        yMax = rawMax + pad;
        if (yMax - yMin < 2) {
          yMax = yMin + 2;
        }
      }
      const ySpan = Math.max(1, yMax - yMin);
      const yMid = Math.round((yMin + yMax) / 2);
      const count = rawPoints.length;
      const points = rawPoints.map((p, idx) => {
        const xRatio = count === 1 ? 0.5 : idx / (count - 1);
        const x = roundCoord(padLeft + xRatio * plotW);
        const yRatio = (p.value - yMin) / ySpan;
        const y = roundCoord(bottomY - yRatio * plotH);
        let hitX = padLeft;
        let hitW = plotW;
        if (count > 1) {
          const prevX = idx === 0 ? padLeft : padLeft + (idx - 1) / (count - 1) * plotW;
          const nextX = idx === count - 1 ? padLeft + plotW : padLeft + (idx + 1) / (count - 1) * plotW;
          const leftEdge = idx === 0 ? padLeft : (prevX + x) / 2;
          const rightEdge = idx === count - 1 ? padLeft + plotW : (x + nextX) / 2;
          hitX = roundCoord(leftEdge);
          hitW = roundCoord(Math.max(6, rightEdge - leftEdge));
        }
        return {
          ...p,
          index: idx,
          x,
          y,
          xRatio: roundCoord(xRatio),
          hitX,
          hitW
        };
      });
      let linePath = "";
      let areaPath = "";
      if (points.length === 1) {
        const pt = points[0];
        linePath = `M ${padLeft} ${pt.y} L ${padLeft + plotW} ${pt.y}`;
        areaPath = `M ${padLeft} ${bottomY} L ${padLeft} ${pt.y} L ${padLeft + plotW} ${pt.y} L ${padLeft + plotW} ${bottomY} Z`;
      } else {
        linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
        const firstPt = points[0];
        const lastPt = points[points.length - 1];
        areaPath = `M ${firstPt.x} ${bottomY} ` + points.map((pt) => `L ${pt.x} ${pt.y}`).join(" ") + ` L ${lastPt.x} ${bottomY} Z`;
      }
      const firstVal = points[0].value;
      const lastVal = points[points.length - 1].value;
      const windowDelta = lastVal - firstVal;
      let strokeColor = cfg.stroke;
      if (metricKey === "followers") {
        if (windowDelta > 0) strokeColor = "#22c55e";
        else if (windowDelta < 0) strokeColor = "#ef4444";
        else strokeColor = "#3b82f6";
      }
      return {
        isEmpty: false,
        mode,
        metric: metricKey,
        metricLabel: cfg.label,
        range,
        strokeColor,
        points,
        linePath,
        areaPath,
        yMin,
        yMid,
        yMax,
        rawMin,
        rawMax,
        windowDelta,
        viewWidth,
        viewHeight,
        padLeft,
        padRight,
        padTop,
        padBottom,
        plotW,
        plotH,
        bottomY
      };
    },
renderChartPointReadoutHtml: (pt, metricLabel) => {
      if (!pt) return "";
      const exactVal = Utils.formatExactNumber(pt.value);
      const safeDate = Utils.escapeHtml(pt.displayDate || pt.date || "");
      const scans = Number(pt.scansCount) || 1;
      let deltaBadge = "";
      if (pt.isBaselineOnly || pt.isOpeningAnchor) {
        deltaBadge = '<span class="ig-chart-readout-delta is-neutral">Baseline</span>';
      } else if (pt.delta > 0) {
        deltaBadge = `<span class="ig-chart-readout-delta is-positive">+${pt.delta.toLocaleString()}</span>`;
      } else if (pt.delta < 0) {
        deltaBadge = `<span class="ig-chart-readout-delta is-negative">${pt.delta.toLocaleString()}</span>`;
      } else {
        deltaBadge = '<span class="ig-chart-readout-delta is-neutral">0</span>';
      }
      let intraNote = "";
      if (scans > 1 && !pt.isOpeningAnchor) {
        const intraSign = pt.intradayDelta > 0 ? "+" : "";
        intraNote = `<span class="ig-chart-readout-intra">Open ${Utils.formatExactNumber(pt.startValue)} (${intraSign}${pt.intradayDelta.toLocaleString()} · ${scans}x)</span>`;
      }
      return [
        `<span class="ig-chart-readout-date">${safeDate}</span>`,
        `<span class="ig-chart-readout-val">${exactVal} <span class="ig-chart-readout-unit">${Utils.escapeHtml(metricLabel)}</span></span>`,
        deltaBadge,
        intraNote
      ].filter(Boolean).join(" ");
    },
renderTrendChartCard: (historyList, { scope = "main", isRestricted = false } = {}) => {
      const normalized = Storage.normalizeHistoryRecords(Array.isArray(historyList) ? historyList : []).list;
      if (normalized.length === 0) return "";
      const hasMutualsData = !isRestricted && normalized.some(
        (h) => h.mutuals !== void 0 && h.mutuals !== null && !Number.isNaN(Number(h.mutuals))
      );
      if (!UI.chartState[scope]) {
        UI.chartState[scope] = { metric: "followers", range: "30d" };
      }
      let activeMetric = UI.chartState[scope].metric || "followers";
      if (activeMetric === "mutuals" && !hasMutualsData) {
        activeMetric = "followers";
        UI.chartState[scope].metric = "followers";
      }
      const activeRange = UI.chartState[scope].range || "30d";
      const series = UI.computeTrendSeries(normalized, { metric: activeMetric, range: activeRange });
      if (series.isEmpty) return "";
      const latestPt = series.points[series.points.length - 1];
      const firstPt = series.points[0];
      const gradId = `ig-trend-grad-${scope}-${series.metric}`;
      let windowSummaryHtml = "";
      if (series.mode === "single-baseline") {
        windowSummaryHtml = '<span class="ig-chart-window-pill is-neutral">Baseline Point</span>';
      } else {
        const wSign = series.windowDelta > 0 ? "+" : "";
        const wCls = series.windowDelta > 0 ? "is-positive" : series.windowDelta < 0 ? "is-negative" : "is-neutral";
        const rangeText = activeRange === "all" ? "All-time" : activeRange.toUpperCase();
        windowSummaryHtml = `<span class="ig-chart-window-pill ${wCls}">${wSign}${series.windowDelta.toLocaleString()} (${rangeText})</span>`;
      }
      const metricsList = [
        { id: "followers", label: "Followers" },
        { id: "following", label: "Following" },
        ...hasMutualsData ? [{ id: "mutuals", label: "Mutuals" }] : []
      ];
      const metricButtonsHtml = metricsList.map((m) => `<button type="button" class="ig-chart-seg-btn${series.metric === m.id ? " is-active" : ""}" data-chart-metric="${m.id}">${m.label}</button>`).join("");
      const rangeButtonsHtml = [
        { id: "7d", label: "7D" },
        { id: "30d", label: "30D" },
        { id: "all", label: "All" }
      ].map((r) => `<button type="button" class="ig-chart-seg-btn${activeRange === r.id ? " is-active" : ""}" data-chart-range="${r.id}">${r.label}</button>`).join("");
      const midYCoord = roundCoord(series.padTop + series.plotH / 2);
      const showDots = series.points.length <= 32;
      const dotsSvg = series.points.map((pt, idx) => {
        const isLast = idx === series.points.length - 1;
        if (!showDots && !isLast && idx !== 0) return "";
        const r = isLast ? 3.8 : 2.6;
        return `<circle class="ig-chart-dot${isLast ? " is-latest" : ""}" cx="${pt.x}" cy="${pt.y}" r="${r}" fill="${series.strokeColor}" />`;
      }).join("");
      const hitRectsSvg = series.points.map((pt) => {
        const aria = `${pt.displayDate}: ${pt.value.toLocaleString()} ${series.metricLabel} (${pt.delta >= 0 ? "+" : ""}${pt.delta})`;
        return `<rect class="ig-chart-hit" tabindex="0" role="button" aria-label="${Utils.escapeHtml(aria)}" x="${pt.hitX}" y="${series.padTop}" width="${pt.hitW}" height="${series.plotH}" data-point-index="${pt.index}" data-x="${pt.x}" data-y="${pt.y}" data-x-ratio="${pt.xRatio}" data-date="${Utils.escapeHtml(pt.displayDate)}" data-val="${pt.value}" data-delta="${pt.delta}" data-intra="${pt.intradayDelta}" data-scans="${pt.scansCount}" data-start="${pt.startValue}" data-baseline="${pt.isBaselineOnly || pt.isOpeningAnchor ? "1" : "0"}" />`;
      }).join("");
      let xAxisSvg = "";
      if (series.points.length === 1) {
        xAxisSvg = `<text x="${latestPt.x}" y="${series.viewHeight - 6}" text-anchor="middle" class="ig-chart-axis-text">${Utils.escapeHtml(latestPt.axisLabel)}</text>`;
      } else {
        const midPt = series.points.length >= 5 ? series.points[Math.floor(series.points.length / 2)] : null;
        xAxisSvg = [
          `<text x="${series.padLeft}" y="${series.viewHeight - 6}" text-anchor="start" class="ig-chart-axis-text">${Utils.escapeHtml(firstPt.axisLabel)}</text>`,
          midPt ? `<text x="${midPt.x}" y="${series.viewHeight - 6}" text-anchor="middle" class="ig-chart-axis-text">${Utils.escapeHtml(midPt.axisLabel)}</text>` : "",
          `<text x="${series.padLeft + series.plotW}" y="${series.viewHeight - 6}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(latestPt.axisLabel)}</text>`
        ].join("");
      }
      const lineDashAttr = series.mode === "single-baseline" ? ' stroke-dasharray="5 4"' : "";
      return [
        `<div class="ig-trend-chart-card" data-chart-scope="${Utils.escapeHtml(scope)}" data-metric-label="${Utils.escapeHtml(series.metricLabel)}">`,
        `  <div class="ig-chart-header">`,
        `    <div class="ig-chart-title-group">`,
        `      <span class="ig-chart-title">${Icons.chartArea} Audience Trend</span>`,
        `      ${windowSummaryHtml}`,
        `    </div>`,
        `    <div class="ig-chart-controls">`,
        `      <div class="ig-chart-seg-group" role="group" aria-label="Chart metric">${metricButtonsHtml}</div>`,
        `      <div class="ig-chart-seg-group" role="group" aria-label="Chart time range">${rangeButtonsHtml}</div>`,
        `    </div>`,
        `  </div>`,
        `  <div class="ig-chart-readout" data-default-index="${latestPt.index}">`,
        `    ${UI.renderChartPointReadoutHtml(latestPt, series.metricLabel)}`,
        `  </div>`,
        `  <div class="ig-chart-stage">`,
        `    <svg class="ig-trend-svg" viewBox="0 0 ${series.viewWidth} ${series.viewHeight}" preserveAspectRatio="none" role="img" aria-label="${Utils.escapeHtml(series.metricLabel)} trend chart">`,
        `      <defs>`,
        `        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`,
        `          <stop offset="0%" stop-color="${series.strokeColor}" stop-opacity="0.30" />`,
        `          <stop offset="100%" stop-color="${series.strokeColor}" stop-opacity="0.01" />`,
        `        </linearGradient>`,
        `      </defs>`,
        `      <line x1="${series.padLeft}" y1="${series.padTop}" x2="${series.padLeft + series.plotW}" y2="${series.padTop}" class="ig-chart-grid-line" />`,
        `      <line x1="${series.padLeft}" y1="${midYCoord}" x2="${series.padLeft + series.plotW}" y2="${midYCoord}" class="ig-chart-grid-line is-mid" />`,
        `      <line x1="${series.padLeft}" y1="${series.bottomY}" x2="${series.padLeft + series.plotW}" y2="${series.bottomY}" class="ig-chart-grid-line" />`,
        `      <text x="${series.padLeft - 6}" y="${series.padTop + 4}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMax))}</text>`,
        `      <text x="${series.padLeft - 6}" y="${midYCoord + 3}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMid))}</text>`,
        `      <text x="${series.padLeft - 6}" y="${series.bottomY + 3}" text-anchor="end" class="ig-chart-axis-text">${Utils.escapeHtml(Utils.formatNumber(series.yMin))}</text>`,
        `      <path d="${series.areaPath}" fill="url(#${gradId})" class="ig-chart-area" />`,
        `      <path d="${series.linePath}" fill="none" stroke="${series.strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${lineDashAttr} class="ig-chart-line" />`,
        `      <line x1="${latestPt.x}" y1="${series.padTop}" x2="${latestPt.x}" y2="${series.bottomY}" class="ig-chart-crosshair" style="opacity:0;" />`,
        `      ${dotsSvg}`,
        `      <circle class="ig-chart-active-dot" cx="${latestPt.x}" cy="${latestPt.y}" r="5" fill="${series.strokeColor}" style="opacity:0;" />`,
        `      ${xAxisSvg}`,
        `      ${hitRectsSvg}`,
        `    </svg>`,
        `    <div class="ig-chart-tooltip" style="display:none;" aria-hidden="true"></div>`,
        `  </div>`,
        `</div>`
      ].join("\n");
    },
bindChartInteractions: (mountEl, { historyList, scope = "main", isRestricted = false } = {}) => {
      if (!mountEl) return;
      mountEl._chartConfig = { historyList, scope, isRestricted };
      if (mountEl.getAttribute("data-chart-bound") === "1") return;
      mountEl.setAttribute("data-chart-bound", "1");
      const activateHit = (hitEl) => {
        const card = hitEl.closest(".ig-trend-chart-card");
        if (!card) return;
        const x = Number(hitEl.getAttribute("data-x") || 0);
        const y = Number(hitEl.getAttribute("data-y") || 0);
        const xRatio = Number(hitEl.getAttribute("data-x-ratio") || 0.5);
        const pt = {
          displayDate: hitEl.getAttribute("data-date") || "",
          value: Number(hitEl.getAttribute("data-val") || 0),
          delta: Number(hitEl.getAttribute("data-delta") || 0),
          intradayDelta: Number(hitEl.getAttribute("data-intra") || 0),
          scansCount: Number(hitEl.getAttribute("data-scans") || 1),
          startValue: Number(hitEl.getAttribute("data-start") || 0),
          isBaselineOnly: hitEl.getAttribute("data-baseline") === "1"
        };
        const metricLabel = card.getAttribute("data-metric-label") || "Followers";
        const crosshair = card.querySelector(".ig-chart-crosshair");
        if (crosshair) {
          crosshair.setAttribute("x1", String(x));
          crosshair.setAttribute("x2", String(x));
          crosshair.style.opacity = "1";
        }
        const activeDot = card.querySelector(".ig-chart-active-dot");
        if (activeDot) {
          activeDot.setAttribute("cx", String(x));
          activeDot.setAttribute("cy", String(y));
          activeDot.style.opacity = "1";
        }
        const readout = card.querySelector(".ig-chart-readout");
        if (readout) {
          readout.innerHTML = UI.renderChartPointReadoutHtml(pt, metricLabel);
        }
        const tooltip = card.querySelector(".ig-chart-tooltip");
        if (tooltip) {
          const sign = pt.delta > 0 ? "+" : "";
          const deltaCls = pt.isBaselineOnly ? "is-neutral" : pt.delta > 0 ? "is-positive" : pt.delta < 0 ? "is-negative" : "is-neutral";
          const deltaLabel = pt.isBaselineOnly ? "Baseline" : `${sign}${pt.delta.toLocaleString()} vs prev`;
          tooltip.innerHTML = `<div class="ig-chart-tt-date">${Utils.escapeHtml(pt.displayDate)}</div><div class="ig-chart-tt-val">${Utils.formatExactNumber(pt.value)}</div><div class="ig-chart-tt-delta ${deltaCls}">${Utils.escapeHtml(deltaLabel)}</div>`;
          tooltip.style.display = "block";
          const leftPct = Math.min(92, Math.max(8, Math.round(x / 520 * 100)));
          tooltip.style.left = `${leftPct}%`;
          if (xRatio > 0.6) tooltip.classList.add("is-right");
          else tooltip.classList.remove("is-right");
        }
      };
      const resetChartHover = () => {
        const card = mountEl.querySelector(".ig-trend-chart-card");
        if (!card) return;
        const crosshair = card.querySelector(".ig-chart-crosshair");
        const activeDot = card.querySelector(".ig-chart-active-dot");
        const tooltip = card.querySelector(".ig-chart-tooltip");
        if (crosshair) crosshair.style.opacity = "0";
        if (activeDot) activeDot.style.opacity = "0";
        if (tooltip) tooltip.style.display = "none";
        const readout = card.querySelector(".ig-chart-readout");
        const defaultIdx = readout ? readout.getAttribute("data-default-index") : null;
        const latestHit = defaultIdx !== null ? card.querySelector(`.ig-chart-hit[data-point-index="${defaultIdx}"]`) : null;
        if (readout && latestHit) {
          const metricLabel = card.getAttribute("data-metric-label") || "Followers";
          const pt = {
            displayDate: latestHit.getAttribute("data-date") || "",
            value: Number(latestHit.getAttribute("data-val") || 0),
            delta: Number(latestHit.getAttribute("data-delta") || 0),
            intradayDelta: Number(latestHit.getAttribute("data-intra") || 0),
            scansCount: Number(latestHit.getAttribute("data-scans") || 1),
            startValue: Number(latestHit.getAttribute("data-start") || 0),
            isBaselineOnly: latestHit.getAttribute("data-baseline") === "1"
          };
          readout.innerHTML = UI.renderChartPointReadoutHtml(pt, metricLabel);
        }
      };
      mountEl.addEventListener("click", (e) => {
        const metricBtn = e.target.closest("[data-chart-metric]");
        const rangeBtn = e.target.closest("[data-chart-range]");
        if (!metricBtn && !rangeBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const cfg = mountEl._chartConfig;
        if (!cfg) return;
        if (!UI.chartState[cfg.scope]) {
          UI.chartState[cfg.scope] = { metric: "followers", range: "30d" };
        }
        if (metricBtn) {
          UI.chartState[cfg.scope].metric = metricBtn.getAttribute("data-chart-metric") || "followers";
        }
        if (rangeBtn) {
          UI.chartState[cfg.scope].range = rangeBtn.getAttribute("data-chart-range") || "30d";
        }
        mountEl.innerHTML = UI.renderTrendChartCard(cfg.historyList, {
          scope: cfg.scope,
          isRestricted: cfg.isRestricted
        });
      });
      mountEl.addEventListener("pointerover", (e) => {
        const hit = e.target.closest(".ig-chart-hit");
        if (hit) activateHit(hit);
      });
      mountEl.addEventListener("pointerleave", () => {
        resetChartHover();
      });
      mountEl.addEventListener("focusin", (e) => {
        const hit = e.target.closest(".ig-chart-hit");
        if (hit) activateHit(hit);
      });
      mountEl.addEventListener("focusout", (e) => {
        if (!mountEl.contains(e.relatedTarget)) {
          resetChartHover();
        }
      });
    },
renderAudienceCompositionCard: ({
      followers = 0,
      following = 0,
      mutuals = 0,
      fans = null,
      notFollowingBack = null,
      mode = "main"
    } = {}) => {
      const fCount = Math.max(0, Number(followers || 0));
      const ingCount = Math.max(0, Number(following || 0));
      const mutCount = Math.max(0, Number(mutuals || 0));
      const fansCount = fans !== null && fans !== void 0 ? Math.max(0, Number(fans)) : Math.max(0, fCount - mutCount);
      const notBackCount = notFollowingBack !== null && notFollowingBack !== void 0 ? Math.max(0, Number(notFollowingBack)) : Math.max(0, ingCount - mutCount);
      const unionTotal = mutCount + fansCount + notBackCount;
      if (unionTotal === 0) return "";
      const mutPct = roundCoord(mutCount / unionTotal * 100);
      const fansPct = roundCoord(fansCount / unionTotal * 100);
      const notBackPct = roundCoord(Math.max(0, 100 - mutPct - fansPct));
      const followBackRate = ingCount > 0 ? `${(mutCount / ingCount * 100).toFixed(1)}%` : "—";
      const fanShare = fCount > 0 ? `${(fansCount / fCount * 100).toFixed(1)}%` : "—";
      const ffRatio = ingCount > 0 ? `${(fCount / ingCount).toFixed(2)}x` : "—";
      const fansLabel = mode === "target" ? "Followers Only" : "Fans";
      const notBackLabel = mode === "target" ? "Following Only" : "Not Following Back";
      const cardTitle = mode === "target" ? "Network Composition" : "Audience Composition & Reciprocity";
      return [
        `<div class="ig-composition-card">`,
        `  <div class="ig-comp-header">`,
        `    <span class="ig-comp-title">${Icons.mutuals} ${cardTitle}</span>`,
        `    <span class="ig-comp-ratio-pill" title="Followers to Following ratio">F/F Ratio: <strong>${ffRatio}</strong></span>`,
        `  </div>`,
        `  <div class="ig-comp-bar" role="img" aria-label="Mutuals ${mutPct}%, ${fansLabel} ${fansPct}%, ${notBackLabel} ${notBackPct}%">`,
        mutCount > 0 ? `    <div class="ig-comp-seg is-mutuals" style="width:${mutPct}%" title="Mutuals: ${mutCount.toLocaleString()} (${mutPct}%)"></div>` : "",
        fansCount > 0 ? `    <div class="ig-comp-seg is-fans" style="width:${fansPct}%" title="${fansLabel}: ${fansCount.toLocaleString()} (${fansPct}%)"></div>` : "",
        notBackCount > 0 ? `    <div class="ig-comp-seg is-notback" style="width:${notBackPct}%" title="${notBackLabel}: ${notBackCount.toLocaleString()} (${notBackPct}%)"></div>` : "",
        `  </div>`,
        `  <div class="ig-comp-legend">`,
        `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-mutuals"></span>Mutuals <strong>${mutCount.toLocaleString()}</strong></span>`,
        `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-fans"></span>${fansLabel} <strong>${fansCount.toLocaleString()}</strong></span>`,
        `    <span class="ig-comp-legend-item"><span class="ig-comp-dot is-notback"></span>${notBackLabel} <strong>${notBackCount.toLocaleString()}</strong></span>`,
        `  </div>`,
        `  <div class="ig-comp-metrics">`,
        `    <div class="ig-comp-metric-box">`,
        `      <span class="ig-comp-metric-label">Reciprocity</span>`,
        `      <span class="ig-comp-metric-val">${followBackRate}</span>`,
        `    </div>`,
        `    <div class="ig-comp-metric-box">`,
        `      <span class="ig-comp-metric-label">${fansLabel} Share</span>`,
        `      <span class="ig-comp-metric-val">${fanShare}</span>`,
        `    </div>`,
        `    <div class="ig-comp-metric-box">`,
        `      <span class="ig-comp-metric-label">Total Reach</span>`,
        `      <span class="ig-comp-metric-val">${unionTotal.toLocaleString()}</span>`,
        `    </div>`,
        `  </div>`,
        `</div>`
      ].filter(Boolean).join("\n");
    },
renderSparklineSvg: (historyList, { metric = "followers", width = 68, height = 22 } = {}) => {
      const series = UI.computeTrendSeries(historyList, { metric, range: "30d" });
      if (series.isEmpty || series.points.length === 0) return "";
      const pts = series.points;
      const vals = pts.map((p) => p.value);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const span = Math.max(1, maxV - minV);
      const pad = 2.5;
      const innerW = width - pad * 2;
      const innerH = height - pad * 2;
      let stroke = "#60a5fa";
      if (series.windowDelta > 0) stroke = "#22c55e";
      else if (series.windowDelta < 0) stroke = "#ef4444";
      if (pts.length === 1) {
        const cy = roundCoord(height / 2);
        return `<svg class="ig-sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><line x1="${pad}" y1="${cy}" x2="${width - pad}" y2="${cy}" stroke="${stroke}" stroke-width="1.6" stroke-dasharray="3 2" opacity="0.7" /><circle cx="${roundCoord(width / 2)}" cy="${cy}" r="2.4" fill="${stroke}" /></svg>`;
      }
      const coords = pts.map((p, idx) => {
        const x = roundCoord(pad + idx / (pts.length - 1) * innerW);
        const yRatio = maxV === minV ? 0.5 : (p.value - minV) / span;
        const y = roundCoord(height - pad - yRatio * innerH);
        return { x, y };
      });
      const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
      const lastC = coords[coords.length - 1];
      return `<svg class="ig-sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /><circle cx="${lastC.x}" cy="${lastC.y}" r="2.2" fill="${stroke}" /></svg>`;
    }
  });
  Object.assign(UI, {
    renderResultsPage: (containerId) => {
      const state = UI.paginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const {
        rawUsers,
        users,
        title,
        isExportable,
        pageSize,
        searchQuery,
        filterType,
        listVariant = "standard",
        clearNominalKey = null,
        emptyMessage = "No data available yet."
      } = state;
      const safeTitle = Utils.escapeHtml(title);
      const totalRaw = (rawUsers || []).length;
      const totalFiltered = (users || []).length;
      if (totalRaw === 0) {
        container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>" + Utils.escapeHtml(emptyMessage) + "</div>";
        if (isExportable && typeof UI.syncMainExportButton === "function") {
          UI.syncMainExportButton();
        } else if (isExportable) {
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
      const clearNominalBtnHtml = clearNominalKey ? `<button type="button" class="ig-btn-clear-nominal" data-clear-key="${Utils.escapeHtml(clearNominalKey)}" data-container="${Utils.escapeHtml(containerId)}" data-title="${safeTitle}" title="Clear ${safeTitle}">${Icons.trash} Clear</button>` : "";
      const headerInnerHtml = '<div class="ig-section-title" style="margin-bottom:0;">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + "</span></div>" + clearNominalBtnHtml;
      const chipsDef = listVariant === "nominal" ? UI.NOMINAL_CHIPS_DEF || UI.CHIPS_DEF : listVariant === "renamed" ? UI.RENAMED_CHIPS_DEF || UI.CHIPS_DEF : UI.CHIPS_DEF;
      const searchPlaceholder = listVariant === "renamed" ? "Search by @old, @current or full name..." : listVariant === "nominal" ? "Search by @username, previous @handle or name..." : "Search by @username or full name...";
      if (!toolbarEl) {
        const counts = UI.getFilterCounts(rawUsers, searchQuery, listVariant);
        let chipsHtml = "";
        chipsDef.forEach((chip) => {
          const isActive = (filterType || "all") === chip.id;
          const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : "";
          chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? " is-active" : ""}" data-filter="${chip.id}">` + iconHtml + `<span class="ig-chip-label">${chip.label}</span><span class="ig-chip-count">${counts[chip.id] || 0}</span></button>`;
        });
        const clearStyle = searchQuery ? "display: inline-flex;" : "display: none;";
        const skeletonHtml = [
          '<div class="ig-view-header ig-view-header-row">' + headerInnerHtml + "</div>",
          '<div class="ig-filter-toolbar">',
          '  <div class="ig-search-box">',
          '    <span class="ig-search-icon">' + Icons.search + "</span>",
          '    <input type="text" class="ig-search-input" placeholder="' + searchPlaceholder + '" value="' + Utils.escapeHtml(searchQuery || "") + '" autocomplete="off" spellcheck="false" />',
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
              const currentState = UI.paginationState[containerId];
              if (!currentState) return;
              currentState.searchQuery = val;
              UI.applyFilters(containerId);
            }, 120);
          });
          searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              e.stopImmediatePropagation();
              e.preventDefault();
              const currentState = UI.paginationState[containerId];
              if (!currentState) return;
              searchInput.value = "";
              if (clearBtn) clearBtn.style.display = "none";
              currentState.searchQuery = "";
              UI.applyFilters(containerId);
            }
          });
        }
        if (clearBtn && searchInput) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const currentState = UI.paginationState[containerId];
            if (!currentState) return;
            searchInput.value = "";
            clearBtn.style.display = "none";
            currentState.searchQuery = "";
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
            const currentState = UI.paginationState[containerId];
            if (!currentState) return;
            if (currentState.filterType === targetFilter && targetFilter !== "all") {
              currentState.filterType = "all";
            } else {
              currentState.filterType = targetFilter;
            }
            UI.applyFilters(containerId);
          });
        }
      } else {
        if (headerEl) {
          headerEl.className = "ig-view-header ig-view-header-row";
          headerEl.innerHTML = headerInnerHtml;
        }
        UI.updateFilterChips(containerId);
        const clearBtn = toolbarEl.querySelector(".ig-search-clear");
        if (clearBtn) {
          clearBtn.style.display = state.searchQuery ? "inline-flex" : "none";
        }
        const searchInput = toolbarEl.querySelector(".ig-search-input");
        if (searchInput && document.activeElement !== searchInput && searchInput.value !== (state.searchQuery || "")) {
          searchInput.value = state.searchQuery || "";
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
          let avatarStyle = "";
          if (isBestieStory) {
            avatarStyle += " outline: 2px solid #22c55e; outline-offset: 1px;";
          } else if (hasStory) {
            avatarStyle += " outline: 2px solid #e1306c; outline-offset: 1px;";
          }
          const avatarClass = "ig-user-avatar ig-avatar-monogram" + (isBestieStory ? " has-bestie-ring" : "");
          const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || "") + '" data-username="' + safeUsername + '" style="' + avatarStyle + '"><span class="ig-monogram-letter">' + safeInitial + "</span></div>";
          const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${Utils.escapeHtml(u.id || "")}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;
          const badgesHtml = UI.renderUserBadgesHtml(u, { variant: listVariant });
          let identityHtml = '<span class="ig-username">' + safeUsername + "</span>";
          if (listVariant === "renamed") {
            const safeOld = Utils.escapeHtml(u.oldUsername || "-");
            const safeNew = Utils.escapeHtml(u.newUsername || u.username || "-");
            identityHtml = `<span class="ig-rename-flow"><span class="ig-rename-old" title="Previous handle: @${safeOld}">@${safeOld}</span><span class="ig-rename-arrow">${Icons.arrowRight}</span><span class="ig-rename-new" title="Current handle: @${safeNew}">@${safeNew}</span></span>`;
          }
          rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '">';
          rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
          rowsHtml += '<div class="ig-user-text-col">';
          rowsHtml += '<div class="ig-user-title-line">';
          rowsHtml += identityHtml;
          if (isVerified) {
            rowsHtml += '<span title="Verified" style="display:inline-flex; align-items:center;">' + Icons.verified + "</span>";
          }
          rowsHtml += '<span class="ig-user-badges" id="' + uniqueId + '-badges">' + badgesHtml + "</span>";
          rowsHtml += "</div>";
          if (safeFullName) {
            rowsHtml += '<span class="ig-user-fullname">' + safeFullName + "</span>";
          }
          rowsHtml += "</div></div>";
          rowsHtml += '<div class="ig-user-actions">';
          if (containerId === "ig-view-notfollowing") {
            rowsHtml += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
          }
          rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || "") + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + " Inspect</button>";
          if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers" || containerId === "ig-view-unfollowers" || containerId === "ig-view-renamed") {
            rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '" title="Audit Account Network in Subpanel">' + Icons.target + " Audit</button>";
          }
          if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers") {
            rowsHtml += '<button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || "") + '">' + Icons.spy + " Check Story</button>";
          }
          rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          rowsHtml += "</div></div>";
        });
      }
      if (listEl) {
        listEl.innerHTML = rowsHtml;
        UI.loadAvatarsProgressively(listEl);
      }
      let paginationHtml = "";
      if (totalPages > 1) {
        paginationHtml += '<div class="ig-pagination">';
        paginationHtml += '<button class="ig-page-btn ig-page-prev" data-container="' + containerId + '"' + (page <= 1 ? " disabled" : "") + ">&larr; Prev</button>";
        paginationHtml += '<span class="ig-page-info">Page ' + page + " of " + totalPages + " (" + totalFiltered + " users)</span>";
        paginationHtml += '<button class="ig-page-btn ig-page-next" data-container="' + containerId + '"' + (page >= totalPages ? " disabled" : "") + ">Next &rarr;</button>";
        paginationHtml += "</div>";
      }
      if (paginationEl) paginationEl.innerHTML = paginationHtml;
      if (isExportable && typeof UI.syncMainExportButton === "function") {
        UI.syncMainExportButton();
      } else if (isExportable) {
        const exportBtn = document.getElementById("ig-export-csv");
        if (exportBtn) exportBtn.disabled = totalFiltered === 0 && totalRaw === 0;
      }
      if (typeof UI.hydrateVisibleMainPageFriendships === "function") {
        UI.hydrateVisibleMainPageFriendships(containerId);
      }
      if (typeof UI.syncMainExportButton === "function") {
        UI.syncMainExportButton();
      }
    },
    hydrateVisibleMainPageFriendships: (containerId) => {
      const state = UI.paginationState[containerId];
      if (!state || (state.listVariant || "standard") !== "standard") return;
      const container = document.getElementById(containerId);
      if (!container || !container.classList.contains("active")) return;
      const pageSize = state.pageSize || 50;
      const page = state.page || 1;
      const startIndex = (page - 1) * pageSize;
      const pageUsers = (state.users || []).slice(startIndex, startIndex + pageSize);
      const userIdsToFetch = pageUsers.map((u) => u.id).filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");
      if (userIdsToFetch.length === 0 || typeof API.fetchFriendshipStatusesMany !== "function") return;
      API.fetchFriendshipStatusesMany(userIdsToFetch).then((statusMap) => {
        const currentState = UI.paginationState[containerId];
        if (!currentState || currentState.page !== page) return;
        const updatedUsers = [];
        const updatedById = new Map();
        pageUsers.forEach((u, index) => {
          if (!u.id) return;
          const status = statusMap[u.id];
          if (!status) return;
          let rowDomChanged = false;
          let metaChanged = false;
          if (!u.isPrivateKnown) {
            u.isPrivateKnown = true;
            metaChanged = true;
          }
          if (u.isPrivate !== status.isPrivate) {
            u.isPrivate = status.isPrivate;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (u.isBestie !== status.isBestie) {
            u.isBestie = status.isBestie;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (u.outgoingRequest !== status.outgoingRequest) {
            u.outgoingRequest = status.outgoingRequest;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (rowDomChanged) {
            const rowId = containerId + "-row-" + (startIndex + index);
            const badgeContainer = document.getElementById(rowId + "-badges");
            if (badgeContainer) {
              badgeContainer.innerHTML = UI.renderUserBadgesHtml(u, { variant: currentState.listVariant || "standard" });
            }
            if (status.isBestie && u.latestReelMedia > 0) {
              const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
              if (avatarEl) {
                avatarEl.classList.add("has-bestie-ring");
                avatarEl.style.outlineColor = "#22c55e";
              }
            }
          }
          if (metaChanged) {
            updatedUsers.push(u);
            updatedById.set(String(u.id), status);
          }
        });
        if (updatedById.size > 0) {
          Object.entries(UI.paginationState).forEach(([tabContainerId, tabState]) => {
            if (!tabState || !Array.isArray(tabState.rawUsers)) return;
            let tabChanged = false;
            tabState.rawUsers.forEach((item) => {
              if (!item?.id || !updatedById.has(String(item.id))) return;
              const st = updatedById.get(String(item.id));
              if (item.isPrivate !== st.isPrivate || !item.isPrivateKnown || item.isBestie !== st.isBestie || item.outgoingRequest !== st.outgoingRequest) {
                item.isPrivate = st.isPrivate;
                item.isPrivateKnown = true;
                item.isBestie = st.isBestie;
                item.outgoingRequest = st.outgoingRequest;
                tabChanged = true;
              }
            });
            if (tabChanged) {
              UI.updateFilterChips(tabContainerId);
            }
          });
          UI.updateFilterChips(containerId);
          if (typeof Storage.syncFreshUserData === "function") {
            Storage.syncFreshUserData(updatedUsers);
          }
        }
      }).catch((err) => {
        console.warn("[IG Analyzer] Error updating friendship statuses batch:", err);
      });
    },
    renderUserBadgesHtml: (u, options = {}) => {
      const variant = options.variant || "standard";
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
      if (variant === "renamed") {
        if (u?.relationship === "mutual") {
          badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + " Mutual</span>";
        } else if (u?.relationship === "fan") {
          badges += '<span class="ig-badge-pill ig-badge-fan" title="Follower (Fan)">' + Icons.fans + " Fan</span>";
        } else if (u?.relationship === "following") {
          badges += '<span class="ig-badge-pill ig-badge-following" title="Account you follow">' + Icons.user + " Following</span>";
        }
      } else {
        if (u?.followsBack === true) {
          badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + " Mutual</span>";
        } else if (u?.followsBack === false) {
          badges += '<span class="ig-badge-pill ig-badge-fan" title="You do not follow them back">' + Icons.fans + " Fan</span>";
        }
        if (Number(u?.occurrences) > 1) {
          badges += '<span class="ig-badge-pill ig-badge-repeat" title="Detected ' + Number(u.occurrences) + ' times">' + Icons.repeat + " " + Number(u.occurrences) + "x</span>";
        }
        if (u?.previousUsername) {
          const safePrev = Utils.escapeHtml(u.previousUsername);
          badges += '<span class="ig-badge-pill ig-badge-prev-user" title="Previously @' + safePrev + '">' + Icons.renamed + " was @" + safePrev + "</span>";
        }
      }
      if (u?.date) {
        badges += '<span class="ig-badge-pill ig-badge-date" title="Detected on ' + Utils.escapeHtml(u.date) + '">' + Icons.clock + " " + Utils.escapeHtml(u.date) + "</span>";
      }
      return badges;
    },
    renderResults: (users, title, containerId, isExportable = false) => {
      const safeUsers = Utils.toDetailedUserArray(users);
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
        listVariant: "standard",
        clearNominalKey: null,
        emptyMessage: "No data available yet.",
        page: 1,
        pageSize: 50,
        searchQuery: "",
        filterType: "all"
      };
      UI.renderResultsPage(containerId);
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts();
      }
    },
    renderNewFollowers: (users, containerId = "ig-view-newfollowers") => {
      const safeUsers = Array.isArray(users) ? users : [];
      UI.renderResults(safeUsers, "New Followers", containerId, true);
    },
    renderWhitelist: (whitelistUsers, containerId = "ig-view-whitelist") => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const rawList = Array.isArray(whitelistUsers) ? whitelistUsers : [];
      const safeTitle = "Ignored Accounts (Whitelist)";
      const total = rawList.length;
      if (total === 0) {
        container.innerHTML = '<div class="ig-view-header"><div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.shieldCheck + "</span>No ignored accounts in whitelist.</div>";
        if (typeof UI.updateMainTabCounts === "function") {
          UI.updateMainTabCounts();
        }
        if (typeof UI.syncMainExportButton === "function") {
          UI.syncMainExportButton();
        }
        return;
      }
      const query = (UI.whitelistSearchQuery || "").trim().toLowerCase();
      const filteredList = query ? rawList.filter((u) => String(u || "").toLowerCase().includes(query)) : rawList;
      const badgeText = filteredList.length !== total ? `${filteredList.length} / ${total}` : `${total}`;
      let rowsHtml = "";
      if (filteredList.length === 0) {
        rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + "</span>No accounts match your search.</div>";
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
            if (u?.username && !knownUsersMap.has(u.username.toLowerCase())) {
              knownUsersMap.set(u.username.toLowerCase(), u);
            }
          });
        }
        filteredList.slice().reverse().forEach((username, idx) => {
          const safeUsername = Utils.escapeHtml(username);
          const safeUrl = Utils.sanitizeUrl(username);
          const lower = String(username || "").toLowerCase();
          const known = knownUsersMap.get(lower) || (typeof Storage.findKnownUserByUsername === "function" ? Storage.findKnownUserByUsername(username) : null);
          const safeUserId = Utils.escapeHtml(known?.id || "");
          const safeFullName = known?.fullName ? Utils.escapeHtml(known.fullName) : "";
          const safeAvatarUrl = known?.profilePicUrl ? Utils.sanitizeImageUrl(known.profilePicUrl) : null;
          const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : "?";
          const hasStory = Boolean(known?.latestReelMedia && known.latestReelMedia > 0);
          const avatarClass = "ig-user-avatar ig-avatar-monogram" + (hasStory ? known?.isBestie ? " has-bestie-ring" : " has-story-ring" : "");
          const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || "") + '" data-username="' + safeUsername + '"><span class="ig-monogram-letter">' + safeInitial + "</span></div>";
          const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${safeUserId}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;
          rowsHtml += '<div class="ig-user-row" id="wl-row-' + idx + '" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '">';
          rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
          rowsHtml += '<div class="ig-user-text-col">';
          rowsHtml += '<span class="ig-username">' + safeUsername + "</span>";
          if (safeFullName) {
            rowsHtml += '<span class="ig-user-fullname">' + safeFullName + "</span>";
          }
          rowsHtml += "</div></div>";
          rowsHtml += '<div class="ig-user-actions">';
          rowsHtml += '<button class="ig-btn-unwhitelist btn-unwhitelist" data-user="' + safeUsername + '" title="Restore to Not Following">' + Icons.restore + " Restore</button>";
          rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + safeUserId + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + " Inspect</button>";
          rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '" title="Audit Account Network in Subpanel">' + Icons.target + " Audit</button>";
          rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          rowsHtml += "</div></div>";
        });
      }
      const existingSearchInput = container.querySelector(".ig-whitelist-search-input");
      const existingListEl = container.querySelector(".ig-view-list");
      if (existingSearchInput && existingListEl) {
        const badgeEl = container.querySelector(".ig-section-title .ig-badge");
        if (badgeEl) badgeEl.textContent = badgeText;
        const clearBtn = container.querySelector(".ig-whitelist-search-clear");
        if (clearBtn) clearBtn.style.display = UI.whitelistSearchQuery ? "inline-flex" : "none";
        if (document.activeElement !== existingSearchInput && existingSearchInput.value !== (UI.whitelistSearchQuery || "")) {
          existingSearchInput.value = UI.whitelistSearchQuery || "";
        }
        existingListEl.innerHTML = rowsHtml;
        UI.loadAvatarsProgressively(existingListEl);
      } else {
        container.innerHTML = [
          '<div class="ig-view-header-row">',
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
          '<div class="ig-view-list">' + rowsHtml + "</div>"
        ].join("\n");
        UI.loadAvatarsProgressively(container);
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
              UI.renderWhitelist(Storage.getWhitelist(), containerId);
            }, 120);
          });
          searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && searchInput.value) {
              e.preventDefault();
              e.stopPropagation();
              searchInput.value = "";
              UI.whitelistSearchQuery = "";
              UI.renderWhitelist(Storage.getWhitelist(), containerId);
            }
          });
        }
        if (clearBtn && searchInput) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            searchInput.value = "";
            UI.whitelistSearchQuery = "";
            UI.renderWhitelist(Storage.getWhitelist(), containerId);
            searchInput.focus();
          });
        }
      }
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts();
      }
      if (typeof UI.syncMainExportButton === "function") {
        UI.syncMainExportButton();
      }
    },
enrichNominalItems: (rawList, { variant = "nominal", userId = null } = {}) => {
      if (!Array.isArray(rawList) || rawList.length === 0) return [];
      const snapshot = Storage.load(userId);
      const knownById = new Map();
      const knownByLower = new Map();
      const followersLowerSet = new Set();
      const followingLowerSet = new Set();
      if (snapshot && typeof snapshot === "object") {
        (snapshot.followers || []).forEach((u) => {
          const name = typeof u === "string" ? u : u?.username;
          if (name) followersLowerSet.add(String(name).toLowerCase());
        });
        (snapshot.following || []).forEach((u) => {
          const name = typeof u === "string" ? u : u?.username;
          if (name) followingLowerSet.add(String(name).toLowerCase());
        });
        [
          ...snapshot.mutualsDetailed || [],
          ...snapshot.followersDetailed || [],
          ...snapshot.followingDetailed || [],
          ...snapshot.fansDetailed || [],
          ...snapshot.notFollowingBackDetailed || []
        ].forEach((u) => {
          if (!u || typeof u !== "object") return;
          if (u.id && String(u.id) !== "0" && !knownById.has(String(u.id))) {
            knownById.set(String(u.id), u);
          }
          if (u.username && !knownByLower.has(u.username.toLowerCase())) {
            knownByLower.set(u.username.toLowerCase(), u);
          }
        });
      }
      const reversed = rawList.slice().reverse();
      const result = [];
      const seenKeys = new Set();
      for (const item of reversed) {
        if (!item) continue;
        const isObj = typeof item === "object";
        if (variant === "renamed") {
          const oldUsername = String(isObj ? item.oldUsername || "" : "").replace(/^@+/, "").trim();
          const newUsername = String(isObj ? item.newUsername || item.username || "" : item).replace(/^@+/, "").trim();
          if (!oldUsername && !newUsername) continue;
          const idStr = isObj && item.id && String(item.id) !== "0" ? String(item.id) : null;
          const known = idStr && knownById.get(idStr) || newUsername && knownByLower.get(newUsername.toLowerCase()) || oldUsername && knownByLower.get(oldUsername.toLowerCase()) || null;
          const liveUsername = newUsername || known?.username || oldUsername;
          const dedupKey = `${idStr || liveUsername.toLowerCase()}:${oldUsername.toLowerCase()}->${newUsername.toLowerCase()}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);
          const lowerLive = liveUsername.toLowerCase();
          let relationship = isObj ? item.relationship || null : null;
          if (!relationship) {
            const inF = followersLowerSet.has(lowerLive);
            const inIng = followingLowerSet.has(lowerLive);
            if (inF && inIng) relationship = "mutual";
            else if (inF) relationship = "fan";
            else if (inIng) relationship = "following";
          }
          result.push({
            id: idStr || (known?.id ? String(known.id) : null),
            username: liveUsername,
            oldUsername: oldUsername || "-",
            newUsername: newUsername || liveUsername,
            relationship,
            fullName: (isObj ? item.fullName : "") || known?.fullName || "",
            profilePicUrl: Utils.sanitizeImageUrl((isObj ? item.profilePicUrl : null) || known?.profilePicUrl || null),
            isVerified: Boolean((isObj ? item.isVerified : void 0) ?? known?.isVerified),
            isPrivate: Boolean((isObj ? item.isPrivate : void 0) ?? known?.isPrivate),
            date: isObj && item.date ? String(item.date) : "",
            url: `https://www.instagram.com/${encodeURIComponent(liveUsername)}/`
          });
        } else {
          const rawName = isObj ? item.username || item.newUsername || "" : item;
          const cleanName = String(rawName || "").replace(/^@+/, "").trim();
          if (!cleanName) continue;
          const idStr = isObj && item.id && String(item.id) !== "0" ? String(item.id) : null;
          const dedupKey = idStr ? `id:${idStr}` : `u:${cleanName.toLowerCase()}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);
          const known = idStr && knownById.get(idStr) || knownByLower.get(cleanName.toLowerCase()) || (isObj && item.previousUsername ? knownByLower.get(String(item.previousUsername).toLowerCase()) : null) || null;
          result.push({
            id: idStr || (known?.id ? String(known.id) : null),
            username: cleanName,
            fullName: (isObj ? item.fullName : "") || known?.fullName || "",
            profilePicUrl: Utils.sanitizeImageUrl((isObj ? item.profilePicUrl : null) || known?.profilePicUrl || null),
            isVerified: Boolean((isObj ? item.isVerified : void 0) ?? known?.isVerified),
            isPrivate: Boolean((isObj ? item.isPrivate : void 0) ?? known?.isPrivate),
            previousUsername: isObj && item.previousUsername ? String(item.previousUsername) : null,
            occurrences: Math.max(1, Number(isObj ? item.occurrences : 1) || 1),
            date: isObj && item.date ? String(item.date) : "",
            url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
          });
        }
      }
      return result;
    },
    renderNominalList: (list, containerId, title, options = {}) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const keyByContainer = {
        "ig-view-unfollowers": CONFIG.CHURN_KEY,
        "ig-view-deactivated": CONFIG.DEACTIVATED_KEY,
        "ig-view-blocked": CONFIG.BLOCKED_KEY
      };
      const clearNominalKey = options.storageKey || keyByContainer[containerId] || null;
      const enriched = UI.enrichNominalItems(list, { variant: "nominal", userId: options.userId || null });
      container.innerHTML = "";
      UI.paginationState[containerId] = {
        rawUsers: enriched,
        users: enriched,
        title,
        containerId,
        isExportable: true,
        listVariant: "nominal",
        clearNominalKey,
        emptyMessage: "No historical records yet.",
        page: 1,
        pageSize: 50,
        searchQuery: "",
        filterType: "all"
      };
      UI.renderResultsPage(containerId);
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts(options.userId || null);
      }
    },
    renderRenamedList: (list, containerId, title, options = {}) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const clearNominalKey = options.storageKey || CONFIG.RENAMED_KEY;
      const enriched = UI.enrichNominalItems(list, { variant: "renamed", userId: options.userId || null });
      container.innerHTML = "";
      UI.paginationState[containerId] = {
        rawUsers: enriched,
        users: enriched,
        title,
        containerId,
        isExportable: true,
        listVariant: "renamed",
        clearNominalKey,
        emptyMessage: "No username changes detected yet.",
        page: 1,
        pageSize: 50,
        searchQuery: "",
        filterType: "all"
      };
      UI.renderResultsPage(containerId);
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts(options.userId || null);
      }
    },
    renderHistory: (historyData, userId = null) => {
      const container = document.getElementById("ig-view-history");
      if (!container) return;
      let html = '<div class="ig-section-title">Metrics History</div>';
      if (!Array.isArray(historyData) || historyData.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + "</span>No historical data available.</div>";
        container.innerHTML = html;
        if (typeof UI.updateMainTabCounts === "function") UI.updateMainTabCounts(userId);
        return;
      }
      const safeHistory = Storage.normalizeHistoryRecords(historyData).list;
      if (safeHistory.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + "</span>No historical data available.</div>";
        container.innerHTML = html;
        if (typeof UI.updateMainTabCounts === "function") UI.updateMainTabCounts(userId);
        return;
      }
      const oldest = safeHistory[0];
      const reversedHistory = safeHistory.slice().reverse();
      const latest = reversedHistory[0];
      const prev = reversedHistory.length > 1 ? reversedHistory[1] : null;
      const currentFollowers = latest ? Utils.formatNumber(latest.followers) : "-";
      const currentFollowing = latest ? Utils.formatNumber(latest.following) : "-";
      const exactFollowersTitle = latest ? `${Utils.formatExactNumber(latest.followers)} followers` : "";
      const exactFollowingTitle = latest ? `${Utils.formatExactNumber(latest.following)} following` : "";
      const fMeta = UI.buildKpiDelta(
        latest.followers,
        prev ? prev.followers : null,
        latest.startFollowers,
        latest.lastDeltaFollowers,
        latest.scansCount
      );
      const ingMeta = UI.buildKpiDelta(
        latest.following,
        prev ? prev.following : null,
        latest.startFollowing,
        latest.lastDeltaFollowing,
        latest.scansCount
      );
      const baselineFollowers = Number(oldest.startFollowers ?? oldest.followers ?? latest.followers ?? 0);
      const netFlow = Number(latest.followers ?? 0) - baselineFollowers;
      const netFlowSign = netFlow > 0 ? "+" : "";
      const netFlowClass = netFlow > 0 ? "is-positive" : netFlow < 0 ? "is-negative" : "is-neutral";
      const newCount = Storage.getNewFollowersList(userId).length;
      const churnCount = Storage.getNominalList(CONFIG.CHURN_KEY, userId).length;
      const deactivatedCount = Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId).length;
      const blockedCount = Storage.getNominalList(CONFIG.BLOCKED_KEY, userId).length;
      const totalLostCount = churnCount + deactivatedCount + blockedCount;
      const lossBreakdownTitle = `Unfollowers: ${churnCount} · Deactivated: ${deactivatedCount} · Blocked: ${blockedCount}`;
      html += [
        '<div class="ig-history-kpi-grid">',
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Followers</div>',
        '    <div class="ig-kpi-value" title="' + Utils.escapeHtml(exactFollowersTitle) + '">' + currentFollowers + "</div>",
        '    <div class="ig-kpi-sub ' + fMeta.cls + '">' + fMeta.icon + " <span>" + Utils.escapeHtml(fMeta.text) + "</span></div>",
        "  </div>",
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Following</div>',
        '    <div class="ig-kpi-value" title="' + Utils.escapeHtml(exactFollowingTitle) + '">' + currentFollowing + "</div>",
        '    <div class="ig-kpi-sub ' + ingMeta.cls + '">' + ingMeta.icon + " <span>" + Utils.escapeHtml(ingMeta.text) + "</span></div>",
        "  </div>",
        '  <div class="ig-kpi-card">',
        '    <div class="ig-kpi-label">Audience Balance</div>',
        '    <div class="ig-kpi-value ' + netFlowClass + '" title="Net vs opening baseline (' + Utils.formatExactNumber(baselineFollowers) + ')">' + netFlowSign + netFlow.toLocaleString() + "</div>",
        '    <div class="ig-kpi-sub ig-kpi-sub-split">',
        '      <button type="button" class="ig-kpi-jump-btn is-positive" data-main-tab="ig-view-newfollowers" title="Open New Followers">+' + newCount + " new</button>",
        '      <span class="ig-kpi-sep">/</span>',
        '      <button type="button" class="ig-kpi-jump-btn is-negative" data-main-tab="ig-view-unfollowers" title="' + Utils.escapeHtml(lossBreakdownTitle) + '">-' + totalLostCount + " lost</button>",
        "    </div>",
        "  </div>",
        "</div>"
      ].join("\n");
      html += '<div class="ig-trend-chart-mount">' + UI.renderTrendChartCard(safeHistory, { scope: "main" }) + "</div>";
      const snap = Storage.load(userId);
      const compFollowers = snap?.followers?.length ?? Number(latest.followers ?? 0);
      const compFollowing = snap?.following?.length ?? Number(latest.following ?? 0);
      const compMutuals = snap?.mutualsDetailed?.length ?? (latest.mutuals !== void 0 ? Number(latest.mutuals) : null);
      const compFans = snap?.fansDetailed?.length ?? (latest.fans !== void 0 ? Number(latest.fans) : null);
      const compNotBack = snap ? Math.max(0, compFollowing - (compMutuals ?? 0)) : latest.notFollowingBack !== void 0 ? Number(latest.notFollowingBack) : null;
      if (compMutuals !== null && (compFollowers > 0 || compFollowing > 0)) {
        html += UI.renderAudienceCompositionCard({
          followers: compFollowers,
          following: compFollowing,
          mutuals: compMutuals,
          fans: compFans,
          notFollowingBack: compNotBack,
          mode: "main"
        });
      }
      html += '<div class="ig-section-title" style="margin-top: 14px;">Daily Log <span class="ig-badge">' + safeHistory.length + "</span></div>";
      html += '<div class="ig-table-scroll-region" tabindex="0" role="region" aria-label="Historical metrics table">';
      html += '<table class="ig-table ig-history-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th><th>Mutuals</th></tr></thead><tbody>';
      reversedHistory.forEach((h, index) => {
        const isBaselineRow = index === reversedHistory.length - 1;
        const prevDay = !isBaselineRow ? reversedHistory[index + 1] : null;
        const scans = Number(h.scansCount) || 1;
        const dayDiffF = prevDay ? Number(h.followers ?? 0) - Number(prevDay.followers ?? 0) : 0;
        const intraF = Number(h.followers ?? 0) - Number(h.startFollowers ?? h.followers ?? 0);
        const fDeltaHtml = UI.formatDeltaPillHtml(dayDiffF, {
          intradayDelta: intraF,
          scansCount: scans,
          isBaselineRow
        });
        const dayDiffIng = prevDay ? Number(h.following ?? 0) - Number(prevDay.following ?? 0) : 0;
        const intraIng = Number(h.following ?? 0) - Number(h.startFollowing ?? h.following ?? 0);
        const ingDeltaHtml = UI.formatDeltaPillHtml(dayDiffIng, {
          intradayDelta: intraIng,
          scansCount: scans,
          isBaselineRow
        });
        let mutCellHtml = '<span class="ig-metric-muted">—</span>';
        if (h.mutuals !== void 0 && h.mutuals !== null && !Number.isNaN(Number(h.mutuals))) {
          const hasPrevMut = prevDay && prevDay.mutuals !== void 0 && prevDay.mutuals !== null;
          const dayDiffMut = hasPrevMut ? Number(h.mutuals) - Number(prevDay.mutuals) : 0;
          const intraMut = Number(h.mutuals) - Number(h.startMutuals ?? h.mutuals);
          const mutDeltaHtml = UI.formatDeltaPillHtml(dayDiffMut, {
            intradayDelta: intraMut,
            scansCount: scans,
            isBaselineRow: !hasPrevMut
          });
          mutCellHtml = '<span class="ig-metric-value">' + Utils.formatExactNumber(h.mutuals) + " " + mutDeltaHtml + "</span>";
        }
        const safeDate = Utils.escapeHtml(h.date || "");
        const scansBadge = scans > 1 ? `<span class="ig-scans-pill" title="${scans} scans recorded on ${safeDate}">${scans}x</span>` : "";
        html += '<tr><th scope="row"><span class="ig-table-date">' + safeDate + "</span>" + scansBadge + '</th><td><span class="ig-metric-value">' + Utils.formatExactNumber(h.followers) + " " + fDeltaHtml + '</span></td><td><span class="ig-metric-value">' + Utils.formatExactNumber(h.following) + " " + ingDeltaHtml + "</span></td><td>" + mutCellHtml + "</td></tr>";
      });
      html += "</tbody></table></div>";
      container.innerHTML = html;
      const chartMount = container.querySelector(".ig-trend-chart-mount");
      if (chartMount && typeof UI.bindChartInteractions === "function") {
        UI.bindChartInteractions(chartMount, { historyList: safeHistory, scope: "main" });
      }
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts(userId);
      }
    },
    getFilterCounts: (rawUsers, searchQuery = "", listVariant = "standard") => {
      const query = (searchQuery || "").trim().toLowerCase().replace(/^@+/, "");
      const baseList = query ? (rawUsers || []).filter((u) => {
        const uName = (u?.username || "").toLowerCase();
        const fName = (u?.fullName || "").toLowerCase();
        const oldName = (u?.oldUsername || "").toLowerCase();
        const prevName = (u?.previousUsername || "").toLowerCase();
        return uName.includes(query) || fName.includes(query) || oldName.includes(query) || prevName.includes(query);
      }) : rawUsers || [];
      if (listVariant === "nominal") {
        return {
          all: baseList.length,
          repeat: baseList.filter((u) => Number(u.occurrences) > 1).length,
          renamed: baseList.filter((u) => Boolean(u.previousUsername)).length,
          private: baseList.filter((u) => Boolean(u.isPrivate)).length,
          verified: baseList.filter((u) => Boolean(u.isVerified)).length
        };
      }
      if (listVariant === "renamed") {
        return {
          all: baseList.length,
          mutual: baseList.filter((u) => u.relationship === "mutual").length,
          fan: baseList.filter((u) => u.relationship === "fan").length,
          following: baseList.filter((u) => u.relationship === "following").length,
          verified: baseList.filter((u) => Boolean(u.isVerified)).length
        };
      }
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
      const query = (state.searchQuery || "").trim().toLowerCase().replace(/^@+/, "");
      const filter = state.filterType || "all";
      const variant = state.listVariant || "standard";
      state.users = (state.rawUsers || []).filter((u) => {
        if (query) {
          const uName = (u?.username || "").toLowerCase();
          const fName = (u?.fullName || "").toLowerCase();
          const oldName = (u?.oldUsername || "").toLowerCase();
          const prevName = (u?.previousUsername || "").toLowerCase();
          if (!uName.includes(query) && !fName.includes(query) && !oldName.includes(query) && !prevName.includes(query)) {
            return false;
          }
        }
        if (variant === "nominal") {
          if (filter === "repeat") return Number(u.occurrences) > 1;
          if (filter === "renamed") return Boolean(u.previousUsername);
          if (filter === "private") return Boolean(u.isPrivate);
          if (filter === "verified") return Boolean(u.isVerified);
          return true;
        }
        if (variant === "renamed") {
          if (filter === "mutual") return u.relationship === "mutual";
          if (filter === "fan") return u.relationship === "fan";
          if (filter === "following") return u.relationship === "following";
          if (filter === "verified") return Boolean(u.isVerified);
          return true;
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
      const counts = UI.getFilterCounts(state.rawUsers, state.searchQuery, state.listVariant || "standard");
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
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts();
      }
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
    renderPersistedSnapshot: (snapshot, userId = null) => {
      if (!snapshot || typeof snapshot !== "object") {
        if (typeof window !== "undefined") window.__igLastResults = [];
        UI.renderResults([], "Not Following You Back", "ig-view-notfollowing", true);
        UI.renderResults([], "Fans (They follow you, you don't)", "ig-view-fans", true);
        UI.renderResults([], "Mutual Connections", "ig-view-mutuals", true);
        if (typeof UI.updateMainTabCounts === "function") {
          UI.updateMainTabCounts(userId);
        }
        if (typeof UI.syncMainExportButton === "function") {
          UI.syncMainExportButton();
        }
        return;
      }
      const migrateMissingKeyFromSnapshot = (baseKey, snapVal, renderFn) => {
        if (!Storage.hasScopedValue(baseKey, userId) && Array.isArray(snapVal) && snapVal.length > 0) {
          Storage.setScopedValue(baseKey, snapVal, userId);
          if (typeof renderFn === "function") renderFn();
        }
      };
      migrateMissingKeyFromSnapshot(CONFIG.WHITELIST_KEY, snapshot.whitelist, () => {
        UI.renderWhitelist(Storage.getWhitelist(userId));
      });
      migrateMissingKeyFromSnapshot(CONFIG.NEW_FOLLOWERS_KEY, snapshot.newFollowersDetailed, () => {
        UI.renderNewFollowers(Storage.getNewFollowersList(userId));
      });
      migrateMissingKeyFromSnapshot(CONFIG.CHURN_KEY, snapshot.unfollowers, () => {
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY, userId), "ig-view-unfollowers", "Recent Unfollowers", { userId });
      });
      migrateMissingKeyFromSnapshot(CONFIG.DEACTIVATED_KEY, snapshot.deactivated, () => {
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId), "ig-view-deactivated", "Deactivated Accounts", { userId });
      });
      migrateMissingKeyFromSnapshot(CONFIG.BLOCKED_KEY, snapshot.blocked, () => {
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY, userId), "ig-view-blocked", "Blocked Accounts", { userId });
      });
      migrateMissingKeyFromSnapshot(CONFIG.RENAMED_KEY, snapshot.renamed, () => {
        UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY, userId), "ig-view-renamed", "Username Changes", { userId });
      });
      migrateMissingKeyFromSnapshot(CONFIG.HISTORY_KEY, snapshot.history, () => {
        UI.renderHistory(Storage.getHistory(userId), userId);
      });
      const liveWhitelist = Storage.getWhitelist(userId);
      const wlLowerSet = new Set(liveWhitelist.map((u) => String(u || "").toLowerCase()));
      if (Array.isArray(snapshot.following) && Array.isArray(snapshot.followers)) {
        const followersLowerSet = new Set(snapshot.followers.map((u) => {
          const name = typeof u === "string" ? u : u?.username;
          return String(name || "").toLowerCase();
        }));
        const knownByLower = new Map();
        [
          ...snapshot.followingDetailed || [],
          ...snapshot.notFollowingBackDetailed || [],
          ...snapshot.followersDetailed || []
        ].forEach((u) => {
          if (u && typeof u === "object" && u.username) {
            const lower = u.username.toLowerCase();
            if (!knownByLower.has(lower)) knownByLower.set(lower, u);
          }
        });
        const liveNotFollowingDetailed = [];
        const seenLower = new Set();
        snapshot.following.forEach((rawItem) => {
          const rawName = typeof rawItem === "string" ? rawItem : rawItem?.username;
          const cleanName = String(rawName || "").replace(/^@+/, "").trim();
          if (!cleanName) return;
          const lower = cleanName.toLowerCase();
          if (seenLower.has(lower) || followersLowerSet.has(lower) || wlLowerSet.has(lower)) return;
          seenLower.add(lower);
          const detail = knownByLower.get(lower) || (typeof rawItem === "object" ? rawItem : {});
          const canonicalName = detail.username || cleanName;
          liveNotFollowingDetailed.push({
            ...detail,
            username: canonicalName,
            url: `https://www.instagram.com/${encodeURIComponent(canonicalName)}/`
          });
        });
        UI.renderResults(liveNotFollowingDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        window.__igLastResults = liveNotFollowingDetailed;
      } else if (Array.isArray(snapshot.notFollowingBackDetailed)) {
        const filtered = snapshot.notFollowingBackDetailed.filter(
          (u) => !wlLowerSet.has(String(u?.username || "").toLowerCase())
        );
        UI.renderResults(filtered, "Not Following You Back", "ig-view-notfollowing", true);
        window.__igLastResults = filtered;
      }
      if (Array.isArray(snapshot.fansDetailed)) {
        UI.renderResults(snapshot.fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", true);
      }
      if (Array.isArray(snapshot.mutualsDetailed)) {
        UI.renderResults(snapshot.mutualsDetailed, "Mutual Connections", "ig-view-mutuals", true);
      }
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts(userId);
      }
    },
    loadAvatarsProgressively: (containerEl, delayMs = 35) => {
      if (!containerEl) return;
      const parentView = containerEl.closest(".ig-view");
      if (parentView && !parentView.classList.contains("active")) {
        return;
      }
      const scopeEl = containerEl.classList.contains("ig-view-list") ? containerEl : containerEl.querySelector(".ig-view-list") || containerEl;
      scopeEl._avatarQueueToken = (scopeEl._avatarQueueToken || 0) + 1;
      const currentToken = scopeEl._avatarQueueToken;
      const monograms = scopeEl.querySelectorAll(".ig-avatar-monogram[data-avatar-url]");
      const items = Array.from(monograms).filter((el) => {
        const url = el.getAttribute("data-avatar-url");
        return url && !el.classList.contains("is-loaded") && !Utils.isCdnUrlExpired(url);
      });
      items.forEach((el, index) => {
        setTimeout(() => {
          if (scopeEl._avatarQueueToken !== currentToken || !el.isConnected || el.classList.contains("is-loaded")) return;
          const url = el.getAttribute("data-avatar-url");
          if (!url || Utils.isCdnUrlExpired(url)) return;
          const img = new Image();
          img.onload = () => {
            if (!el.isConnected || el.classList.contains("is-loaded")) return;
            el.classList.add("is-loaded");
            const imgTag = document.createElement("img");
            imgTag.className = "ig-avatar-img-loaded";
            imgTag.src = url;
            imgTag.alt = "";
            imgTag.loading = "lazy";
            el.innerHTML = "";
            el.appendChild(imgTag);
          };
          img.onerror = () => {
          };
          img.src = url;
        }, index * delayMs);
      });
    },
    updateUserAvatarInDom: (username, newAvatarUrl) => {
      if (!username || !newAvatarUrl) return;
      const cleanUser = String(username).replace(/^@+/, "").toLowerCase().trim();
      const safeUrl = Utils.sanitizeImageUrl(newAvatarUrl);
      if (!safeUrl) return;
      const triggers = document.querySelectorAll(".ig-user-avatar-trigger, .ig-target-card-avatar, .ig-target-overview-avatar-wrap");
      triggers.forEach((trigger) => {
        const trigUser = (trigger.getAttribute("data-username") || "").toLowerCase();
        const parentRow = trigger.closest(".ig-user-row, .ig-target-card");
        const rowUser = (parentRow?.getAttribute("data-user") || parentRow?.getAttribute("data-username") || "").toLowerCase();
        if (trigUser === cleanUser || rowUser === cleanUser) {
          const monogram = trigger.classList.contains("ig-avatar-monogram") ? trigger : trigger.querySelector(".ig-avatar-monogram");
          if (!monogram) return;
          monogram.setAttribute("data-avatar-url", safeUrl);
          const img = new Image();
          img.onload = () => {
            if (!monogram.isConnected) return;
            monogram.classList.add("is-loaded");
            const imgTag = document.createElement("img");
            imgTag.className = "ig-avatar-img-loaded";
            imgTag.src = safeUrl;
            imgTag.alt = "";
            imgTag.loading = "lazy";
            monogram.innerHTML = "";
            monogram.appendChild(imgTag);
          };
          img.src = safeUrl;
        }
      });
    }
  });
  Object.assign(UI, {
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
        '    <button class="ig-tab-btn" data-target="ig-target-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-mutuals">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-newmutuals"><span class="ig-tab-icon">' + Icons.newMutuals + '</span><span class="ig-tab-label">New Mutuals</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-newmutuals">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-newfollowers">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-lostfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Lost Followers</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-lostfollowers">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-followers"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Followers</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-followers">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-following"><span class="ig-tab-icon">' + Icons.user + '</span><span class="ig-tab-label">Following</span><span class="ig-tab-count is-empty" data-target-count="ig-target-view-following">0</span></button>',
        '    <button class="ig-tab-btn" data-target="ig-target-view-logs"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
        "  </div>",
        "</div>",
        '<div id="ig-target-view-overview" class="ig-view-container ig-view ig-target-view active"></div>',
        '<div id="ig-target-view-mutuals" class="ig-view-container ig-view ig-target-view"></div>',
        '<div id="ig-target-view-newmutuals" class="ig-view-container ig-view ig-target-view"></div>',
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
          if (targetView) {
            targetView.classList.add("active");
            if (typeof UI.loadAvatarsProgressively === "function") {
              UI.loadAvatarsProgressively(targetView);
            }
            if (typeof UI.hydrateVisibleTargetPageFriendships === "function") {
              UI.hydrateVisibleTargetPageFriendships(targetId);
            }
          }
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
      UI.updateTargetTabIndicator = updateIndicator;
      UI.setupTargetDrag(subpanel, subpanel.querySelector("#ig-target-header"));
      UI.loadTargetPosition(subpanel);
    },
    refreshTargetTabIndicator: () => {
      const tabsContainer = document.getElementById("ig-target-tabs");
      if (!tabsContainer || typeof UI.updateTargetTabIndicator !== "function") return;
      const activeBtn = tabsContainer.querySelector(".ig-tab-btn.active");
      if (activeBtn) {
        UI.updateTargetTabIndicator(activeBtn, false);
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(() => UI.updateTargetTabIndicator(activeBtn, false));
        }
      }
    },
    updateTargetTabCounts: (targetData = null) => {
      const tabsContainer = document.getElementById("ig-target-tabs");
      if (!tabsContainer) return;
      const isRestricted = Boolean(targetData?.isRestricted);
      const countsMap = !targetData || isRestricted ? {
        "ig-target-view-mutuals": 0,
        "ig-target-view-newmutuals": 0,
        "ig-target-view-newfollowers": 0,
        "ig-target-view-lostfollowers": 0,
        "ig-target-view-followers": 0,
        "ig-target-view-following": 0
      } : {
        "ig-target-view-mutuals": (targetData.mutuals || []).length,
        "ig-target-view-newmutuals": (targetData.newMutualsDetailed || targetData.newMutuals || []).length,
        "ig-target-view-newfollowers": (targetData.newFollowers || []).length,
        "ig-target-view-lostfollowers": (targetData.lostFollowers || []).length,
        "ig-target-view-followers": (targetData.followers || []).length,
        "ig-target-view-following": (targetData.following || []).length
      };
      Object.entries(countsMap).forEach(([tabId, rawCount]) => {
        const badge = tabsContainer.querySelector(`[data-target-count="${tabId}"]`);
        if (!badge) return;
        const count = Math.max(0, Number(rawCount) || 0);
        badge.textContent = count > 0 ? Utils.formatNumber(count) : "0";
        if (count > 0) {
          badge.classList.remove("is-empty");
        } else {
          badge.classList.add("is-empty");
        }
      });
      UI.refreshTargetTabIndicator();
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
        const prev = GM_getValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, {}) || {};
        GM_setValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, { ...prev, x: raw.x, y: raw.y });
      });
      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.classList.remove("is-dragging");
          document.body.style.userSelect = "";
        }
      });
      window.addEventListener("resize", () => {
        if (panel.style.display === "none") return;
        const clamped = UI.clampPosition(panel, panel.offsetLeft, panel.offsetTop);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
        const prev = GM_getValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, {}) || {};
        GM_setValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, { ...prev, x: clamped.x, y: clamped.y });
      });
      if (typeof ResizeObserver === "function") {
        let resizeTimer = null;
        const ro = new ResizeObserver(() => {
          if (panel.style.display === "none" || panel.classList.contains("is-minimized")) return;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (panel.style.display === "none" || panel.classList.contains("is-minimized")) return;
            const w = panel.offsetWidth;
            const h = panel.offsetHeight;
            if (w >= 360 && h >= 260) {
              const prev = GM_getValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, {}) || {};
              GM_setValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, { ...prev, width: w, height: h });
            }
          }, 250);
        });
        ro.observe(panel);
      }
    },
    loadTargetPosition: (panel) => {
      const pos = GM_getValue(CONFIG.TARGET_SUBPANEL_POSITION_KEY, null);
      if (pos && typeof pos.width === "number" && typeof pos.height === "number") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const safeW = Math.min(pos.width, vw - 40);
        const safeH = Math.min(pos.height, vh - 40);
        if (safeW >= 360) panel.style.width = safeW + "px";
        if (safeH >= 260) panel.style.height = safeH + "px";
      }
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
      if (typeof UI.applyCurrentTheme === "function") UI.applyCurrentTheme();
      const cleanUser = String(targetUserObj.username || "").replace(/^@/, "").trim();
      const titleEl = document.getElementById("ig-target-header-title");
      if (titleEl) {
        titleEl.innerHTML = "@" + Utils.escapeHtml(cleanUser) + (targetUserObj.isVerified ? " " + Icons.verified : "");
      }
      const summaryBar = document.getElementById("ig-target-meta-summary");
      if (summaryBar) {
        const prevHandle = targetUserObj.previousUsername || storedData?.user?.previousUsername || "";
        let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(cleanUser) + "</span>";
        if (prevHandle && prevHandle.toLowerCase() !== cleanUser.toLowerCase()) {
          summaryHtml += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + Utils.escapeHtml(prevHandle) + '">Formerly @' + Utils.escapeHtml(prevHandle) + "</span>";
        }
        if (targetUserObj.fullName) {
          summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(targetUserObj.fullName) + "</span>";
        }
        const fCount = Math.max(
          Number(targetUserObj.followerCount ?? storedData?.user?.followerCount) || 0,
          Array.isArray(storedData?.followers) ? storedData.followers.length : 0
        );
        const ingCount = Math.max(
          Number(targetUserObj.followingCount ?? storedData?.user?.followingCount) || 0,
          Array.isArray(storedData?.following) ? storedData.following.length : 0
        );
        summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(fCount) + " followers</span>";
        summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(ingCount) + " following</span>";
        summaryBar.innerHTML = summaryHtml;
      }
      subpanel.style.display = "flex";
      subpanel.classList.remove("is-minimized");
      UI.loadTargetPosition(subpanel);
      const overviewTab = subpanel.querySelector('[data-target="ig-target-view-overview"]');
      if (overviewTab) overviewTab.click();
      const dataToRender = storedData || Storage.getTargetData(cleanUser, null, targetUserObj.id);
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
        ["mutuals", "newmutuals", "newfollowers", "lostfollowers", "followers", "following"].forEach((key) => {
          const el = document.getElementById("ig-target-view-" + key);
          if (el) el.innerHTML = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>Run an audit to view " + key + ".</div>";
        });
        const expBtn = document.getElementById("ig-target-export-csv");
        if (expBtn) expBtn.disabled = true;
        UI.updateTargetTabCounts(null);
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
          const timeStr = (typeof Utils.localTimeStr === "function" ? Utils.localTimeStr() : "") || ( new Date()).toLocaleTimeString();
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
      const safeInitial = safeUser ? safeUser.charAt(0).toUpperCase() : "?";
      const avatarHtml = '<div class="ig-user-avatar ig-avatar-monogram" data-avatar-url="' + (avatarUrl || "") + '" data-username="' + safeUser + '"><span class="ig-monogram-letter">' + safeInitial + "</span></div>";
      const followersCount = Math.max(
        Number(u.followerCount) || 0,
        Array.isArray(targetData.followers) ? targetData.followers.length : 0
      );
      const followingCount = Math.max(
        Number(u.followingCount) || 0,
        Array.isArray(targetData.following) ? targetData.following.length : 0
      );
      const mutualsCount = Array.isArray(targetData.mutuals) && targetData.mutuals.length > 0 ? targetData.mutuals.length : typeof u.mutualsCount === "number" ? u.mutualsCount : 0;
      const newCount = Array.isArray(targetData.newFollowers) ? targetData.newFollowers.length : 0;
      const lostCount = Array.isArray(targetData.lostFollowers) ? targetData.lostFollowers.length : 0;
      const newIngCount = Array.isArray(targetData.newFollowing) ? targetData.newFollowing.length : 0;
      const lostIngCount = Array.isArray(targetData.lostFollowing) ? targetData.lostFollowing.length : 0;
      const newMutualsCount = Array.isArray(targetData.newMutuals) ? targetData.newMutuals.length : 0;
      const safeHistory = Storage.normalizeHistoryRecords(Array.isArray(targetData.history) ? targetData.history : []).list;
      const reversedHistory = safeHistory.slice().reverse();
      const latestHist = reversedHistory[0] || null;
      const prevHist = reversedHistory.length > 1 ? reversedHistory[1] : null;
      const oldestHist = safeHistory[0] || null;
      const baselineFollowers = oldestHist ? Number(oldestHist.startFollowers ?? oldestHist.followers ?? followersCount) : followersCount;
      const netFlow = safeHistory.length > 0 ? Number(followersCount) - baselineFollowers : newCount - lostCount;
      const netSign = netFlow > 0 ? "+" : "";
      const netClass = netFlow > 0 ? "is-positive" : netFlow < 0 ? "is-negative" : "is-neutral";
      const fHistMeta = latestHist ? UI.buildKpiDelta(
        followersCount,
        prevHist ? prevHist.followers : null,
        latestHist.startFollowers,
        latestHist.lastDeltaFollowers,
        latestHist.scansCount
      ) : { text: "First record", cls: "is-neutral", icon: Icons.neutral };
      const ingHistMeta = latestHist ? UI.buildKpiDelta(
        followingCount,
        prevHist ? prevHist.following : null,
        latestHist.startFollowing,
        latestHist.lastDeltaFollowing,
        latestHist.scansCount
      ) : { text: "First record", cls: "is-neutral", icon: Icons.neutral };
      let followersSubHtml = "";
      if (!isRestricted && (newCount > 0 || lostCount > 0)) {
        followersSubHtml = '<div class="ig-kpi-sub ig-kpi-sub-split"><button type="button" class="ig-kpi-jump-btn is-positive" data-target-tab="ig-target-view-newfollowers" title="View New Followers">+' + newCount + ' new</button><span class="ig-kpi-sep">/</span><button type="button" class="ig-kpi-jump-btn is-negative" data-target-tab="ig-target-view-lostfollowers" title="View Lost Followers">-' + lostCount + " lost</button></div>";
      } else {
        followersSubHtml = '<div class="ig-kpi-sub ' + fHistMeta.cls + '">' + fHistMeta.icon + " <span>" + Utils.escapeHtml(fHistMeta.text) + "</span></div>";
      }
      let followingSubHtml = "";
      if (!isRestricted && (newIngCount > 0 || lostIngCount > 0)) {
        followingSubHtml = '<div class="ig-kpi-sub ig-kpi-sub-split"><span class="is-positive" style="font-weight:600;">+' + newIngCount + '</span><span class="ig-kpi-sep">/</span><span class="is-negative" style="font-weight:600;">-' + lostIngCount + "</span><span>following</span></div>";
      } else {
        followingSubHtml = '<div class="ig-kpi-sub ' + ingHistMeta.cls + '">' + ingHistMeta.icon + " <span>" + Utils.escapeHtml(ingHistMeta.text) + "</span></div>";
      }
      let mutualsSubHtml = "";
      if (!isRestricted && newMutualsCount > 0) {
        mutualsSubHtml = '<div class="ig-kpi-sub"><button type="button" class="ig-kpi-jump-btn is-positive" data-target-tab="ig-target-view-newmutuals" title="View New Mutuals">' + Icons.sparkles + " <span>+" + newMutualsCount + " new</span></button></div>";
      } else if (isRestricted) {
        mutualsSubHtml = '<div class="ig-kpi-sub is-neutral">' + Icons.lock + " <span>Restricted</span></div>";
      } else {
        const recipPct = followingCount > 0 ? Math.round(mutualsCount / followingCount * 100) : 0;
        mutualsSubHtml = '<div class="ig-kpi-sub is-neutral">' + Icons.mutuals + " <span>" + recipPct + "% reciprocity</span></div>";
      }
      let balanceSubHtml = "";
      if (isRestricted) {
        const sinceText = oldestHist?.date ? `Since ${oldestHist.date}` : "Header tracking";
        balanceSubHtml = '<div class="ig-kpi-sub is-neutral"><span>' + Utils.escapeHtml(sinceText) + "</span></div>";
      } else {
        balanceSubHtml = '<div class="ig-kpi-sub ig-kpi-sub-split"><button type="button" class="ig-kpi-jump-btn is-positive" data-target-tab="ig-target-view-newfollowers" title="New followers tracked">+' + newCount + '</button><span class="ig-kpi-sep">/</span><button type="button" class="ig-kpi-jump-btn is-negative" data-target-tab="ig-target-view-lostfollowers" title="Lost followers tracked">-' + lostCount + "</button></div>";
      }
      let html = "";
      const prevUserStr = u.previousUsername && String(u.previousUsername).toLowerCase() !== String(u.username || targetData.username || "").toLowerCase() ? Utils.escapeHtml(u.previousUsername) : "";
      html += '<div class="ig-target-overview-header">';
      html += '  <div class="ig-target-overview-avatar-wrap">' + avatarHtml + "</div>";
      html += '  <div class="ig-target-overview-meta">';
      html += '    <div class="ig-target-overview-title-row">';
      html += '      <span class="ig-target-overview-username">@' + safeUser + "</span>";
      if (isVerified) html += '<span title="Verified">' + Icons.verified + "</span>";
      if (prevUserStr) html += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + prevUserStr + '">Formerly @' + prevUserStr + "</span>";
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
      html += '    <div class="ig-kpi-value" title="' + Utils.formatExactNumber(followersCount) + ' followers">' + Utils.formatNumber(followersCount) + "</div>";
      html += "    " + followersSubHtml;
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Following</div>';
      html += '    <div class="ig-kpi-value" title="' + Utils.formatExactNumber(followingCount) + ' following">' + Utils.formatNumber(followingCount) + "</div>";
      html += "    " + followingSubHtml;
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Mutual Connections</div>';
      html += '    <div class="ig-kpi-value" title="' + (isRestricted ? "Restricted" : Utils.formatExactNumber(mutualsCount) + " mutuals") + '">' + (isRestricted ? "—" : Utils.formatNumber(mutualsCount)) + "</div>";
      html += "    " + mutualsSubHtml;
      html += "  </div>";
      html += '  <div class="ig-kpi-card">';
      html += '    <div class="ig-kpi-label">Audience Balance</div>';
      html += '    <div class="ig-kpi-value ' + netClass + '" title="Net vs opening baseline (' + Utils.formatExactNumber(baselineFollowers) + ')">' + netSign + netFlow.toLocaleString() + "</div>";
      html += "    " + balanceSubHtml;
      html += "  </div>";
      html += "</div>";
      if (safeHistory.length > 0) {
        html += '<div class="ig-trend-chart-mount">' + UI.renderTrendChartCard(safeHistory, { scope: "target", isRestricted }) + "</div>";
      }
      if (!isRestricted && (followersCount > 0 || followingCount > 0)) {
        html += UI.renderAudienceCompositionCard({
          followers: followersCount,
          following: followingCount,
          mutuals: mutualsCount,
          fans: Math.max(0, followersCount - mutualsCount),
          notFollowingBack: Math.max(0, followingCount - mutualsCount),
          mode: "target"
        });
      }
      if (safeHistory.length > 0) {
        html += '<div class="ig-section-title" style="margin-top: 16px;">Audit History <span class="ig-badge">' + safeHistory.length + "</span></div>";
        html += '<div class="ig-table-scroll-region" tabindex="0" role="region" aria-label="Target audit history table">';
        html += '<table class="ig-table ig-history-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th><th>Mutuals</th></tr></thead><tbody>';
        reversedHistory.forEach((h, index) => {
          const isBaselineRow = index === reversedHistory.length - 1;
          const prevDay = !isBaselineRow ? reversedHistory[index + 1] : null;
          const scans = Number(h.scansCount) || 1;
          const dayDiffF = prevDay ? Number(h.followers ?? 0) - Number(prevDay.followers ?? 0) : 0;
          const intraF = Number(h.followers ?? 0) - Number(h.startFollowers ?? h.followers ?? 0);
          const fDeltaHtml = UI.formatDeltaPillHtml(dayDiffF, { intradayDelta: intraF, scansCount: scans, isBaselineRow });
          const dayDiffIng = prevDay ? Number(h.following ?? 0) - Number(prevDay.following ?? 0) : 0;
          const intraIng = Number(h.following ?? 0) - Number(h.startFollowing ?? h.following ?? 0);
          const ingDeltaHtml = UI.formatDeltaPillHtml(dayDiffIng, { intradayDelta: intraIng, scansCount: scans, isBaselineRow });
          let mutCellHtml = '<span class="ig-metric-muted">—</span>';
          if (!isRestricted && h.mutuals !== void 0 && h.mutuals !== null && !Number.isNaN(Number(h.mutuals))) {
            const hasPrevMut = prevDay && prevDay.mutuals !== void 0 && prevDay.mutuals !== null;
            const dayDiffMut = hasPrevMut ? Number(h.mutuals) - Number(prevDay.mutuals) : 0;
            const intraMut = Number(h.mutuals) - Number(h.startMutuals ?? h.mutuals);
            const mutDeltaHtml = UI.formatDeltaPillHtml(dayDiffMut, {
              intradayDelta: intraMut,
              scansCount: scans,
              isBaselineRow: !hasPrevMut
            });
            mutCellHtml = '<span class="ig-metric-value">' + Utils.formatExactNumber(h.mutuals) + " " + mutDeltaHtml + "</span>";
          }
          const safeDate = Utils.escapeHtml(h.date || "");
          const scansBadge = scans > 1 ? `<span class="ig-scans-pill" title="${scans} audits recorded on ${safeDate}">${scans}x</span>` : "";
          html += "<tr>";
          html += '<th scope="row"><span class="ig-table-date">' + safeDate + "</span>" + scansBadge + "</th>";
          html += '<td><span class="ig-metric-value">' + Utils.formatExactNumber(h.followers) + " " + fDeltaHtml + "</span></td>";
          html += '<td><span class="ig-metric-value">' + Utils.formatExactNumber(h.following) + " " + ingDeltaHtml + "</span></td>";
          html += "<td>" + mutCellHtml + "</td>";
          html += "</tr>";
        });
        html += "</tbody></table></div>";
      }
      container.innerHTML = html;
      UI.loadAvatarsProgressively(container);
      const chartMount = container.querySelector(".ig-trend-chart-mount");
      if (chartMount && typeof UI.bindChartInteractions === "function") {
        UI.bindChartInteractions(chartMount, {
          historyList: safeHistory,
          scope: "target",
          isRestricted
        });
      }
      UI.updateTargetTabCounts(targetData);
    },
    renderTargetLists: (targetData) => {
      if (!targetData) return;
      const newMutualsNames = (targetData.newMutuals || []).map((u) => u.username);
      const newMutualsSet = new Set(newMutualsNames);
      UI.renderTargetSingleList("ig-target-view-mutuals", targetData.mutuals || [], "Mutual Connections", "No mutual connections found.", { newMutualsSet });
      UI.renderTargetSingleList("ig-target-view-newmutuals", targetData.newMutualsDetailed || targetData.newMutuals || [], "New Mutual Connections", "No new mutual connections discovered in this audit.", { newMutualsSet });
      UI.renderTargetSingleList("ig-target-view-newfollowers", targetData.newFollowers || [], "New Followers Gained", "No new followers detected since last scan.", { isNewBadge: true, newMutualsSet });
      UI.renderTargetSingleList("ig-target-view-lostfollowers", targetData.lostFollowers || [], "Followers Lost", "No lost followers detected since last scan.", { isLostBadge: true });
      UI.renderTargetSingleList("ig-target-view-followers", targetData.followers || [], "Target Followers", "No followers data available.");
      UI.renderTargetSingleList("ig-target-view-following", targetData.following || [], "Target Following", "No following data available.");
      UI.updateTargetTabCounts(targetData);
    },
    TARGET_CHIPS_DEF: [
      { id: "all", label: "All", icon: null },
      { id: "private", label: "Private", icon: Icons.lock },
      { id: "public", label: "Public", icon: null },
      { id: "story", label: "With Story", icon: Icons.storyRing },
      { id: "verified", label: "Verified", icon: Icons.verified }
    ],
    getTargetFilterCounts: (rawUsers, searchQuery = "", options = {}) => {
      const query = (searchQuery || "").trim().toLowerCase().replace(/^@+/, "");
      const baseList = query ? (rawUsers || []).filter((u) => {
        const uName = (u?.username || "").toLowerCase();
        const fName = (u?.fullName || "").toLowerCase();
        return uName.includes(query) || fName.includes(query);
      }) : rawUsers || [];
      const counts = {
        all: baseList.length,
        private: baseList.filter((u) => Boolean(u.isPrivate)).length,
        public: baseList.filter((u) => u.isPrivate === false).length,
        story: baseList.filter((u) => Boolean(u.latestReelMedia && u.latestReelMedia > 0)).length,
        verified: baseList.filter((u) => Boolean(u.isVerified)).length
      };
      if (options?.newMutualsSet && options.newMutualsSet.size > 0) {
        counts.newmutual = baseList.filter((u) => options.newMutualsSet.has(u.username)).length;
      }
      return counts;
    },
    applyTargetFilters: (containerId) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const query = (state.searchQuery || "").trim().toLowerCase().replace(/^@+/, "");
      const filter = state.filterType || "all";
      const newMutualsSet = state.options?.newMutualsSet;
      state.users = (state.rawUsers || []).filter((u) => {
        if (query) {
          const uName = (u?.username || "").toLowerCase();
          const fName = (u?.fullName || "").toLowerCase();
          if (!uName.includes(query) && !fName.includes(query)) {
            return false;
          }
        }
        if (filter === "private") return Boolean(u.isPrivate);
        if (filter === "public") return u.isPrivate === false;
        if (filter === "story") return Boolean(u.latestReelMedia && u.latestReelMedia > 0);
        if (filter === "verified") return Boolean(u.isVerified);
        if (filter === "newmutual") return Boolean(newMutualsSet && newMutualsSet.has(u.username));
        return true;
      });
      state.page = 1;
      UI.renderTargetSingleListPage(containerId);
    },
    updateTargetFilterChips: (containerId) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const chipsBar = container.querySelector(".ig-filter-chips");
      if (!chipsBar) return;
      const counts = UI.getTargetFilterCounts(state.rawUsers, state.searchQuery, state.options);
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
    changeTargetPage: (containerId, delta) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const pageSize = state.pageSize || 50;
      const totalPages = Math.max(1, Math.ceil((state.users || []).length / pageSize));
      const newPage = (state.page || 1) + delta;
      if (newPage >= 1 && newPage <= totalPages) {
        state.page = newPage;
        UI.renderTargetSingleListPage(containerId);
        const container = document.getElementById(containerId);
        if (container) {
          container.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    },
    renderTargetSingleList: (containerId, rawList, title, emptyMsg, options = {}) => {
      const safeList = Utils.toDetailedUserArray(rawList);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = "";
      }
      UI.targetPaginationState[containerId] = {
        rawUsers: safeList,
        users: safeList,
        searchQuery: "",
        filterType: "all",
        page: 1,
        pageSize: 50,
        title,
        emptyMsg,
        options
      };
      UI.renderTargetSingleListPage(containerId);
    },
    renderTargetRowBadgesHtml: (u, options = {}) => {
      let badges = "";
      if (u?.isPrivate) badges += '<span class="ig-badge-pill ig-badge-private" title="Private Account">' + Icons.lock + "</span>";
      if (u?.isVerified) badges += '<span title="Verified">' + Icons.verified + "</span>";
      if (u?.isBestie) badges += '<span class="ig-badge-pill ig-badge-bestie" title="Close Friends">' + Icons.star + " Bestie</span>";
      if (u?.outgoingRequest) badges += '<span class="ig-badge-pill ig-badge-pending" title="Follow Request Pending">' + Icons.clock + " Pending</span>";
      if (options?.isNewBadge) badges += '<span class="ig-badge-pill ig-badge-new-mutual">' + Icons.sparkles + " New</span>";
      if (options?.isLostBadge) badges += '<span class="ig-badge-pill ig-badge-churn">' + Icons.unfollowers + " Lost</span>";
      if (options?.newMutualsSet && options.newMutualsSet.has(u?.username)) badges += '<span class="ig-badge-pill ig-badge-new-mutual-solid">' + Icons.sparkles + " New Mutual</span>";
      if (u?.isViewerMutual) badges += '<span class="ig-badge-pill ig-badge-new-mutual" title="Shared mutual with you!">' + Icons.sparkles + " Shared Mutual</span>";
      return badges;
    },
    hydrateVisibleTargetPageFriendships: (containerId) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container || !container.classList.contains("active")) return;
      const pageSize = state.pageSize || 50;
      const page = state.page || 1;
      const startIndex = (page - 1) * pageSize;
      const pageUsers = (state.users || []).slice(startIndex, startIndex + pageSize);
      const userIdsToFetch = pageUsers.map((u) => u.id).filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");
      if (userIdsToFetch.length === 0 || typeof API.fetchFriendshipStatusesMany !== "function") return;
      API.fetchFriendshipStatusesMany(userIdsToFetch).then((statusMap) => {
        const currentState = UI.targetPaginationState[containerId];
        if (!currentState || currentState.page !== page) return;
        const updatedUsers = [];
        const updatedById = new Map();
        pageUsers.forEach((u, index) => {
          if (!u.id) return;
          const status = statusMap[u.id];
          if (!status) return;
          let rowDomChanged = false;
          let metaChanged = false;
          if (!u.isPrivateKnown) {
            u.isPrivateKnown = true;
            metaChanged = true;
          }
          if (u.isPrivate !== status.isPrivate) {
            u.isPrivate = status.isPrivate;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (u.isBestie !== status.isBestie) {
            u.isBestie = status.isBestie;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (u.outgoingRequest !== status.outgoingRequest) {
            u.outgoingRequest = status.outgoingRequest;
            rowDomChanged = true;
            metaChanged = true;
          }
          if (rowDomChanged) {
            const rowId = containerId + "-row-" + (startIndex + index);
            const badgeContainer = document.getElementById(rowId + "-badges");
            if (badgeContainer) {
              badgeContainer.innerHTML = UI.renderTargetRowBadgesHtml(u, currentState.options);
            }
            if (status.isBestie && u.latestReelMedia > 0) {
              const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
              if (avatarEl) {
                avatarEl.classList.add("has-bestie-ring");
                avatarEl.style.outlineColor = "#22c55e";
              }
            }
          }
          if (metaChanged) {
            updatedUsers.push(u);
            updatedById.set(String(u.id), status);
          }
        });
        if (updatedById.size > 0) {
          Object.entries(UI.targetPaginationState).forEach(([tabContainerId, tabState]) => {
            if (!tabState || !Array.isArray(tabState.rawUsers)) return;
            let tabChanged = false;
            tabState.rawUsers.forEach((item) => {
              if (!item?.id || !updatedById.has(String(item.id))) return;
              const st = updatedById.get(String(item.id));
              if (item.isPrivate !== st.isPrivate || !item.isPrivateKnown || item.isBestie !== st.isBestie || item.outgoingRequest !== st.outgoingRequest) {
                item.isPrivate = st.isPrivate;
                item.isPrivateKnown = true;
                item.isBestie = st.isBestie;
                item.outgoingRequest = st.outgoingRequest;
                tabChanged = true;
              }
            });
            if (tabChanged) {
              UI.updateTargetFilterChips(tabContainerId);
            }
          });
          UI.updateTargetFilterChips(containerId);
          if (typeof Storage.syncTargetUsersData === "function") {
            Storage.syncTargetUsersData(UI.currentTargetUser?.username, updatedUsers);
          }
        }
      }).catch((err) => {
        console.warn("[IG Analyzer] Error updating target friendship statuses batch:", err);
      });
    },
    renderTargetSingleListPage: (containerId) => {
      const state = UI.targetPaginationState[containerId];
      if (!state) return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const { rawUsers, users, title, emptyMsg, options, searchQuery, filterType } = state;
      const totalRaw = (rawUsers || []).length;
      const totalFiltered = (users || []).length;
      const safeTitle = Utils.escapeHtml(title);
      if (totalRaw === 0) {
        container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div><div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>" + Utils.escapeHtml(emptyMsg) + "</div>";
        return;
      }
      const pageSize = state.pageSize || 50;
      const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
      state.page = Math.max(1, Math.min(state.page || 1, totalPages));
      const page = state.page;
      const startIndex = (page - 1) * pageSize;
      const pageUsers = users.slice(startIndex, startIndex + pageSize);
      let headerEl = container.querySelector(".ig-view-header");
      let toolbarEl = container.querySelector(".ig-filter-toolbar");
      let listEl = container.querySelector(".ig-view-list");
      let paginationEl = container.querySelector(".ig-view-pagination");
      const badgeCountText = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;
      if (!toolbarEl) {
        const counts = UI.getTargetFilterCounts(rawUsers, searchQuery, options);
        const chipsDef = [...UI.TARGET_CHIPS_DEF];
        if (options?.newMutualsSet && options.newMutualsSet.size > 0) {
          chipsDef.push({ id: "newmutual", label: "New Mutuals", icon: Icons.sparkles });
        }
        let chipsHtml = "";
        chipsDef.forEach((chip) => {
          const isActive = (filterType || "all") === chip.id;
          const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : "";
          chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? " is-active" : ""}" data-filter="${chip.id}">` + iconHtml + `<span class="ig-chip-label">${chip.label}</span><span class="ig-chip-count">${counts[chip.id] || 0}</span></button>`;
        });
        const clearStyle = searchQuery ? "display: inline-flex;" : "display: none;";
        container.innerHTML = [
          '<div class="ig-view-header">',
          '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + "</span></div>",
          "</div>",
          '<div class="ig-filter-toolbar">',
          '  <div class="ig-search-box">',
          '    <span class="ig-search-icon">' + Icons.search + "</span>",
          '    <input type="text" class="ig-search-input ig-target-list-search" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || "") + '" autocomplete="off" spellcheck="false" />',
          '    <button type="button" class="ig-search-clear ig-target-list-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + "</button>",
          "  </div>",
          '  <div class="ig-filter-chips">' + chipsHtml + "</div>",
          "</div>",
          '<div class="ig-view-list ig-target-inner-list"></div>',
          '<div class="ig-view-pagination"></div>'
        ].join("\n");
        headerEl = container.querySelector(".ig-view-header");
        toolbarEl = container.querySelector(".ig-filter-toolbar");
        listEl = container.querySelector(".ig-view-list");
        paginationEl = container.querySelector(".ig-view-pagination");
        const searchInput = toolbarEl.querySelector(".ig-target-list-search");
        const clearBtn = toolbarEl.querySelector(".ig-target-list-clear");
        let searchTimeout = null;
        if (searchInput) {
          searchInput.addEventListener("input", (e) => {
            const val = e.target.value;
            if (clearBtn) clearBtn.style.display = val ? "inline-flex" : "none";
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
              const currentState = UI.targetPaginationState[containerId];
              if (!currentState) return;
              currentState.searchQuery = val;
              UI.applyTargetFilters(containerId);
            }, 120);
          });
          searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              const currentState = UI.targetPaginationState[containerId];
              if (!currentState) return;
              if (searchInput.value || currentState.searchQuery) {
                searchInput.value = "";
                if (clearBtn) clearBtn.style.display = "none";
                currentState.searchQuery = "";
                UI.applyTargetFilters(containerId);
              }
            }
          });
        }
        if (clearBtn && searchInput) {
          clearBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const currentState = UI.targetPaginationState[containerId];
            if (!currentState) return;
            searchInput.value = "";
            clearBtn.style.display = "none";
            currentState.searchQuery = "";
            searchInput.focus();
            UI.applyTargetFilters(containerId);
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
            const currentState = UI.targetPaginationState[containerId];
            if (!currentState) return;
            if (currentState.filterType === targetFilter && targetFilter !== "all") {
              currentState.filterType = "all";
            } else {
              currentState.filterType = targetFilter;
            }
            UI.applyTargetFilters(containerId);
          });
        }
      } else {
        if (headerEl) {
          headerEl.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + "</span></div>";
        }
        UI.updateTargetFilterChips(containerId);
        const clearBtn = toolbarEl.querySelector(".ig-target-list-clear");
        if (clearBtn) {
          clearBtn.style.display = state.searchQuery ? "inline-flex" : "none";
        }
        const searchInput = toolbarEl.querySelector(".ig-target-list-search");
        if (searchInput && document.activeElement !== searchInput && searchInput.value !== (state.searchQuery || "")) {
          searchInput.value = state.searchQuery || "";
        }
      }
      let rowsHtml = "";
      if (totalFiltered === 0) {
        rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + "</span>No accounts match your search or filter criteria.</div>";
      } else {
        pageUsers.forEach((u, index) => {
          const uniqueId = containerId + "-row-" + (startIndex + index);
          const safeUsername = Utils.escapeHtml(u.username || "");
          const safeUserId = Utils.escapeHtml(u.id || "");
          const safeUrl = Utils.sanitizeUrl(u.username, u.url);
          const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : "";
          const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
          const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : "?";
          const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
          const avatarClass = "ig-user-avatar ig-avatar-monogram" + (hasStory ? u.isBestie ? " has-bestie-ring" : " has-story-ring" : "");
          const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || "") + '" data-username="' + safeUsername + '"><span class="ig-monogram-letter">' + safeInitial + "</span></div>";
          const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${safeUserId}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;
          const badges = UI.renderTargetRowBadgesHtml(u, options);
          rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '">';
          rowsHtml += '  <div class="ig-user-info">' + avatarTriggerHtml;
          rowsHtml += '    <div class="ig-user-text-col">';
          rowsHtml += '      <div class="ig-user-title-line">';
          rowsHtml += '        <span class="ig-username">' + safeUsername + "</span>";
          rowsHtml += '        <span class="ig-user-badges" id="' + uniqueId + '-badges">' + badges + "</span>";
          rowsHtml += "      </div>";
          if (safeFullName) rowsHtml += '<span class="ig-user-fullname">' + safeFullName + "</span>";
          rowsHtml += "    </div>";
          rowsHtml += "  </div>";
          rowsHtml += '  <div class="ig-user-actions">';
          rowsHtml += '    <button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '" title="Check Story & Highlight Visibility">' + Icons.spy + " Story</button>";
          rowsHtml += '    <button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + safeUserId + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + " Inspect</button>";
          rowsHtml += '    <button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '" title="Audit @' + safeUsername + '">' + Icons.target + " Audit</button>";
          rowsHtml += '    <a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + "</a>";
          rowsHtml += "  </div>";
          rowsHtml += "</div>";
        });
      }
      if (listEl) {
        listEl.innerHTML = rowsHtml;
        UI.loadAvatarsProgressively(listEl);
      }
      let paginationHtml = "";
      if (totalPages > 1) {
        paginationHtml += '<div class="ig-pagination">';
        paginationHtml += '<button class="ig-page-btn ig-target-page-prev" data-container="' + containerId + '"' + (page <= 1 ? " disabled" : "") + ">&larr; Prev</button>";
        paginationHtml += '<span class="ig-page-info">Page ' + page + " of " + totalPages + " (" + totalFiltered + " accounts)</span>";
        paginationHtml += '<button class="ig-page-btn ig-target-page-next" data-container="' + containerId + '"' + (page >= totalPages ? " disabled" : "") + ">Next &rarr;</button>";
        paginationHtml += "</div>";
      }
      if (paginationEl) paginationEl.innerHTML = paginationHtml;
      UI.hydrateVisibleTargetPageFriendships(containerId);
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
          const safeUser = Utils.escapeHtml(u.username || t.username || "");
          const safeUserId = Utils.escapeHtml(u.id || "");
          const safePrevUser = u.previousUsername && String(u.previousUsername).toLowerCase() !== String(u.username || t.username || "").toLowerCase() ? Utils.escapeHtml(u.previousUsername) : "";
          const safeName = Utils.escapeHtml(u.fullName || "");
          const avatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
          const isVerified = Boolean(u.isVerified);
          const isPrivate = Boolean(u.isPrivate);
          const fCount = Math.max(Number(u.followerCount) || 0, Array.isArray(t.followers) ? t.followers.length : 0);
          const ingCount = Math.max(Number(u.followingCount) || 0, Array.isArray(t.following) ? t.following.length : 0);
          const mutCount = Array.isArray(t.mutuals) && t.mutuals.length > 0 ? t.mutuals.length : typeof u.mutualsCount === "number" ? u.mutualsCount : 0;
          const newCount = t.newFollowers ? t.newFollowers.length : 0;
          const lostCount = t.lostFollowers ? t.lostFollowers.length : 0;
          const tHist = Array.isArray(t.history) ? t.history : [];
          let netFlow = newCount - lostCount;
          if (tHist.length > 0 && (t.isRestricted || netFlow === 0)) {
            const firstH = tHist[0];
            const baseF = Number(firstH?.startFollowers ?? firstH?.followers ?? fCount);
            netFlow = Number(fCount) - baseF;
          }
          let diffBadge = "";
          if (netFlow > 0) {
            diffBadge = '<span class="ig-target-card-diff is-positive">+' + netFlow.toLocaleString() + "</span>";
          } else if (netFlow < 0) {
            diffBadge = '<span class="ig-target-card-diff is-negative">' + netFlow.toLocaleString() + "</span>";
          }
          const sparklineHtml = typeof UI.renderSparklineSvg === "function" && tHist.length > 0 ? '<div class="ig-target-card-sparkline" title="Followers trend">' + UI.renderSparklineSvg(tHist, { metric: "followers", width: 64, height: 20 }) + "</div>" : "";
          const safeInitial = safeUser ? safeUser.charAt(0).toUpperCase() : "?";
          const avatarHtml = '<div class="ig-target-card-avatar ig-avatar-monogram" data-avatar-url="' + (avatarUrl || "") + '" data-username="' + safeUser + '"><span class="ig-monogram-letter">' + safeInitial + "</span></div>";
          const timeStr = t.lastAuditAt ? Utils.formatDate(t.lastAuditAt) : "Recent";
          html += '<div class="ig-target-card" data-username="' + safeUser + '" data-user-id="' + safeUserId + '">';
          html += '  <div class="ig-target-card-top">';
          html += "    " + avatarHtml;
          html += '    <div class="ig-target-card-info">';
          html += '      <div class="ig-target-card-name-row">';
          html += '        <span class="ig-target-card-user">@' + safeUser + "</span>";
          if (isVerified) html += '<span title="Verified">' + Icons.verified + "</span>";
          if (safePrevUser) html += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + safePrevUser + '">Formerly @' + safePrevUser + "</span>";
          if (isPrivate) html += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + "</span>";
          html += "      </div>";
          if (safeName) html += '      <div class="ig-target-card-fullname">' + safeName + "</div>";
          html += "    </div>";
          html += "    " + sparklineHtml;
          html += '    <button class="ig-btn-target-delete btn-target-card-delete" data-username="' + safeUser + '" data-user-id="' + safeUserId + '" title="Remove from tracking">' + Icons.trash + "</button>";
          html += "  </div>";
          html += '  <div class="ig-target-card-metrics">';
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Followers</span><span class="ig-target-metric-val">' + Utils.formatNumber(fCount) + " " + diffBadge + "</span></div>";
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Following</span><span class="ig-target-metric-val">' + Utils.formatNumber(ingCount) + "</span></div>";
          html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Mutuals</span><span class="ig-target-metric-val">' + (t.isRestricted ? "-" : Utils.formatNumber(mutCount)) + "</span></div>";
          html += "  </div>";
          html += '  <div class="ig-target-card-footer">';
          html += '    <span class="ig-target-card-time">' + timeStr + "</span>";
          html += '    <div class="ig-target-card-actions">';
          html += '      <button class="ig-btn ig-btn-sm ig-btn-secondary btn-target-card-open" data-username="' + safeUser + '" data-user-id="' + safeUserId + '">' + Icons.target + " View Details</button>";
          html += '      <button class="ig-btn ig-btn-sm ig-btn-primary btn-target-card-refresh" data-username="' + safeUser + '" data-user-id="' + safeUserId + '">' + Icons.refresh + " Re-Audit</button>";
          html += "    </div>";
          html += "  </div>";
          html += "</div>";
        });
      }
      html += "</div>";
      container.innerHTML = html;
      UI.loadAvatarsProgressively(container);
      if (typeof UI.updateMainTabCounts === "function") {
        UI.updateMainTabCounts(userId);
      }
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
  });
  const mainCss = '#ig-analyzer-panel,#ig-target-subpanel,#ig-safety-modal,#ig-hd-modal,.ig-backup-overlay{--iga-bg-primary: rgba(15, 23, 42, .92);--iga-bg-secondary: rgba(30, 41, 59, .7);--iga-surface: rgba(30, 41, 59, .55);--iga-surface-hover: rgba(51, 65, 85, .6);--iga-surface-active: rgba(51, 65, 85, .85);--iga-border: rgba(255, 255, 255, .08);--iga-border-hover: rgba(255, 255, 255, .16);--iga-border-focus: rgba(59, 130, 246, .5);--iga-text-bright: #f8fafc;--iga-text-main: #cbd5e1;--iga-text-muted: #94a3b8;--iga-text-dim: #64748b;--iga-accent: #3b82f6;--iga-accent-hover: #2563eb;--iga-accent-active: #1d4ed8;--iga-accent-subtle: rgba(59, 130, 246, .14);--iga-accent-glow: 0 0 16px rgba(59, 130, 246, .35);--iga-accent-gradient: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);--iga-success: #10b981;--iga-success-hover: #059669;--iga-success-subtle: rgba(16, 185, 129, .14);--iga-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);--iga-danger: #ef4444;--iga-danger-hover: #dc2626;--iga-danger-subtle: rgba(239, 68, 68, .14);--iga-warning: #f59e0b;--iga-warning-subtle: rgba(245, 158, 11, .14);--iga-shadow-sm: 0 1px 3px rgba(0, 0, 0, .35);--iga-shadow-md: 0 6px 16px -2px rgba(0, 0, 0, .4);--iga-shadow-lg: 0 24px 64px -12px rgba(0, 0, 0, .65), 0 0 0 1px rgba(255, 255, 255, .08);--iga-radius-sm: 6px;--iga-radius-md: 10px;--iga-radius-lg: 14px;--iga-radius-xl: 18px;--iga-radius-full: 9999px;--iga-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;--iga-font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Fira Code", Menlo, Monaco, Consolas, monospace;--iga-ease-spring: cubic-bezier(.16, 1, .3, 1);--iga-ease-default: cubic-bezier(.4, 0, .2, 1);--ig-panel-bg: var(--iga-bg-primary);--ig-panel-border: var(--iga-border);--ig-text-main: var(--iga-text-main);--ig-text-muted: var(--iga-text-muted);--ig-text-bright: var(--iga-text-bright);--ig-bg-input: var(--iga-surface);--ig-bg-hover: var(--iga-surface-hover);--ig-bg-active: var(--iga-surface-active);--ig-scrollbar-thumb: rgba(255, 255, 255, .15);--ig-scrollbar-thumb-hover: rgba(255, 255, 255, .25);--ig-shadow: var(--iga-shadow-lg);--ig-shadow-sm: var(--iga-shadow-sm);--ig-accent: var(--iga-accent);--ig-accent-hover: var(--iga-accent-hover);--ig-accent-soft: var(--iga-accent-subtle);--ig-success: var(--iga-success);--ig-success-hover: var(--iga-success-hover);--ig-danger: var(--iga-danger);--ig-danger-hover: var(--iga-danger-hover);--ig-warning: var(--iga-warning);--ig-btn-bg: var(--iga-surface);--ig-btn-border: var(--iga-border);--ig-btn-text: var(--iga-text-bright);--ig-btn-disabled-bg: rgba(255, 255, 255, .03);--ig-btn-disabled-border: rgba(255, 255, 255, .05);--ig-btn-disabled-text: rgba(255, 255, 255, .25);--ig-radius-sm: var(--iga-radius-sm);--ig-radius-md: var(--iga-radius-md);--ig-radius-lg: var(--iga-radius-lg);--ig-radius-full: var(--iga-radius-full)}#ig-analyzer-panel.ig-light-theme,#ig-target-subpanel.ig-light-theme,#ig-safety-modal.ig-light-theme,#ig-hd-modal.ig-light-theme,.ig-backup-overlay.ig-light-theme{--iga-bg-primary: rgba(255, 255, 255, .96);--iga-bg-secondary: #f8fafc;--iga-surface: #f1f5f9;--iga-surface-hover: #e2e8f0;--iga-surface-active: #cbd5e1;--iga-border: #e2e8f0;--iga-border-hover: #cbd5e1;--iga-border-focus: rgba(37, 99, 235, .4);--iga-text-bright: #0f172a;--iga-text-main: #334155;--iga-text-muted: #64748b;--iga-text-dim: #94a3b8;--iga-accent: #2563eb;--iga-accent-hover: #1d4ed8;--iga-accent-active: #1e40af;--iga-accent-subtle: rgba(37, 99, 235, .08);--iga-accent-glow: 0 0 16px rgba(37, 99, 235, .2);--iga-accent-gradient: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);--iga-success: #10b981;--iga-success-hover: #059669;--iga-success-subtle: rgba(16, 185, 129, .1);--iga-success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);--iga-danger: #dc2626;--iga-danger-hover: #b91c1c;--iga-danger-subtle: rgba(220, 38, 38, .08);--iga-warning: #d97706;--iga-warning-subtle: rgba(217, 119, 6, .08);--iga-shadow-sm: 0 1px 3px rgba(15, 23, 42, .08);--iga-shadow-md: 0 6px 16px -2px rgba(15, 23, 42, .1);--iga-shadow-lg: 0 24px 64px -12px rgba(15, 23, 42, .18), 0 0 0 1px rgba(15, 23, 42, .06);--ig-scrollbar-thumb: rgba(15, 23, 42, .15);--ig-scrollbar-thumb-hover: rgba(15, 23, 42, .25);--ig-btn-disabled-bg: rgba(15, 23, 42, .03);--ig-btn-disabled-border: rgba(15, 23, 42, .06);--ig-btn-disabled-text: rgba(15, 23, 42, .3)}#ig-analyzer-panel{position:fixed;top:80px;right:20px;width:717px;min-width:440px;max-width:calc(100vw - 40px);height:560px;min-height:260px;max-height:calc(100vh - 40px);background:var(--iga-bg-primary);border:1px solid var(--iga-border);color:var(--iga-text-main);box-shadow:var(--iga-shadow-lg);-webkit-backdrop-filter:blur(28px) saturate(190%);backdrop-filter:blur(28px) saturate(190%);font-family:var(--iga-font-sans);font-size:13px;line-height:1.5;padding:16px;z-index:999999;border-radius:var(--iga-radius-xl);display:flex;flex-direction:column;resize:both;overflow:hidden;transform-origin:center center;transition:background .3s var(--iga-ease-default),border-color .3s var(--iga-ease-default),box-shadow .28s cubic-bezier(.34,1.56,.64,1),transform .28s cubic-bezier(.34,1.56,.64,1),height .25s var(--iga-ease-spring);box-sizing:border-box}#ig-analyzer-panel.is-dragging{transform:scale(.985);box-shadow:0 35px 80px -15px #000c,0 0 0 1px #ffffff1f;-webkit-backdrop-filter:blur(36px) saturate(210%);backdrop-filter:blur(36px) saturate(210%);transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s cubic-bezier(.16,1,.3,1);cursor:grabbing!important}#ig-analyzer-panel.ig-light-theme.is-dragging{box-shadow:0 35px 80px -15px #0f172a40,0 0 0 1px #0f172a14}#ig-analyzer-panel *{box-sizing:border-box}#ig-analyzer-panel.is-minimized{height:64px!important;min-height:64px!important;resize:none!important;padding-bottom:0;overflow:hidden}#ig-analyzer-panel.is-minimized>*:not(#ig-header){display:none!important}#ig-analyzer-panel.is-minimized #ig-header{margin-bottom:0;padding-bottom:0;border-bottom:none}#ig-analyzer-panel #ig-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--iga-border);cursor:grab;-webkit-user-select:none;user-select:none;flex-shrink:0}#ig-analyzer-panel #ig-header:active{cursor:grabbing}#ig-analyzer-panel .ig-header-left{display:flex;align-items:center;gap:10px}#ig-analyzer-panel .ig-logo{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--iga-accent-subtle);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);color:var(--iga-accent);box-shadow:var(--iga-shadow-sm);transition:transform .2s var(--iga-ease-spring)}#ig-analyzer-panel .ig-logo:hover{transform:scale(1.06)}#ig-analyzer-panel .ig-title{font-size:14px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.3px;line-height:1}#ig-analyzer-panel .ig-header-right{display:flex;align-items:center;gap:8px}#ig-analyzer-panel #ig-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;background:var(--iga-surface);padding:4px 10px;border-radius:var(--iga-radius-full);color:var(--iga-text-muted);border:1px solid var(--iga-border);transition:all .2s var(--iga-ease-default)}#ig-analyzer-panel .ig-status-dot{width:7px;height:7px;border-radius:50%;background:var(--iga-text-dim);display:inline-block;flex-shrink:0;position:relative}#ig-analyzer-panel #ig-status.is-active .ig-status-dot,#ig-analyzer-panel #ig-status:not(:empty) .ig-status-dot{background:var(--iga-success);box-shadow:0 0 8px var(--iga-success);animation:iga-pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes iga-pulse{0%,to{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.15)}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-actions{display:flex;align-items:center;gap:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border-radius:var(--iga-radius-sm);background:transparent;border:1px solid transparent;color:var(--iga-text-muted);cursor:pointer;transition:all .15s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn:active{transform:scale(.94)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-header-btn-close:hover{background:var(--iga-danger-subtle);color:var(--iga-danger);border-color:#ef44444d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-actions-bar{display:flex;gap:8px;margin-bottom:12px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;background:var(--iga-surface);color:var(--iga-text-bright);border:1px solid var(--iga-border);transition:all .2s var(--iga-ease-default);flex:1;white-space:nowrap;line-height:1;position:relative;overflow:hidden}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-sm{padding:6px 12px;font-size:11px;flex:initial}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-icon svg{display:block}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--iga-shadow-md);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:active:not(:disabled){transform:translateY(0);box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn:disabled{opacity:.45;cursor:not-allowed;background:var(--ig-btn-disabled-bg)!important;border-color:var(--ig-btn-disabled-border)!important;color:var(--ig-btn-disabled-text)!important;transform:none!important;box-shadow:none!important}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-run,#ig-target-run,.ig-btn-primary){background:linear-gradient(90deg,#1d4ed8,#3b82f6 28%,#60a5fa,#3b82f6 72%,#1d4ed8);background-size:200% 100%;background-position:0% 50%;border-color:#ffffff2e;color:#fff;box-shadow:0 4px 12px #2563eb4d;transition:transform .2s var(--iga-ease-default),box-shadow .2s var(--iga-ease-default),background-position .3s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-run,#ig-target-run,.ig-btn-primary):hover:not(:disabled){animation:iga-gradient-move 2s linear infinite;box-shadow:0 6px 20px #2563eb73;transform:translateY(-1px)}@keyframes iga-gradient-move{0%{background-position:200% 50%}to{background-position:0% 50%}}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):not(:disabled){background:var(--iga-success-gradient)!important;border-color:#ffffff26!important;color:#fff!important;box-shadow:0 4px 12px #10b98140}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):not(:disabled):hover{background:linear-gradient(135deg,#059669,#047857)!important;box-shadow:0 6px 18px #10b98166}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-export-csv,#ig-target-export-csv,.ig-btn-success):disabled{background:var(--ig-btn-disabled-bg)!important;border-color:var(--ig-btn-disabled-border)!important;color:var(--ig-btn-disabled-text)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) #ig-reset,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn.ig-btn-danger{background:transparent;border-color:#ef444459;color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) #ig-reset:hover:not(:disabled),:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn.ig-btn-danger:hover:not(:disabled){background:var(--iga-danger-subtle);border-color:var(--iga-danger);color:var(--iga-danger-hover);box-shadow:0 4px 12px #ef444433}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-container,#ig-target-progress-container,.ig-progress-container){width:100%;background:var(--iga-surface);border-radius:var(--iga-radius-full);height:5px;margin-bottom:12px;overflow:hidden;display:none;border:1px solid var(--iga-border);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar){width:0%;background:linear-gradient(90deg,var(--iga-accent),#a855f7);height:100%;border-radius:var(--iga-radius-full);transition:width .35s var(--iga-ease-default);position:relative}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar):after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:iga-shimmer 1.5s infinite}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-progress-bar,#ig-target-progress-bar,.ig-progress-bar).is-indeterminate{width:35%!important;animation:iga-indeterminate 1.5s cubic-bezier(.4,0,.2,1) infinite}@keyframes iga-shimmer{0%{transform:translate(-100%)}to{transform:translate(100%)}}@keyframes iga-indeterminate{0%{transform:translate(-100%)}50%{transform:translate(180%)}to{transform:translate(350%)}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-wrapper{position:relative;margin-bottom:8px;flex-shrink:0;display:flex;align-items:center}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-container{position:relative;display:flex;flex-wrap:nowrap;gap:4px;padding:4px;background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);overflow-x:auto;overflow-y:hidden;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none;width:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tabs-container::-webkit-scrollbar{display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-indicator{position:absolute;top:0;left:0;height:0;width:0;opacity:0;border-radius:var(--iga-radius-md);background:var(--iga-bg-primary);border:1px solid var(--iga-border-hover);box-shadow:var(--iga-shadow-sm);pointer-events:none;z-index:1;transition:transform .3s cubic-bezier(.16,1,.3,1),width .3s cubic-bezier(.16,1,.3,1),height .3s cubic-bezier(.16,1,.3,1),opacity .2s ease;transform:translateZ(0)}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-tab-indicator{background:var(--iga-bg-primary);border:1px solid var(--iga-border-hover);box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn{position:relative!important;z-index:2!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;padding:6px 12px!important;flex:0 0 auto!important;background:transparent!important;border:1px solid transparent!important;color:var(--iga-text-muted)!important;font-size:11px!important;font-weight:600!important;border-radius:var(--iga-radius-md)!important;cursor:pointer!important;transition:color .2s var(--iga-ease-default),background .2s var(--iga-ease-default),border-color .2s var(--iga-ease-default)!important;white-space:nowrap!important;line-height:1!important;-webkit-user-select:none!important;user-select:none!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn:hover:not(.active){color:var(--iga-text-bright)!important;background:var(--iga-surface-hover)!important;border-color:var(--iga-border)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn.active{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:var(--iga-accent)!important;font-weight:600!important}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-tab-btn.active{color:var(--iga-accent)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:14px;height:14px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-icon svg{width:100%;height:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-label{pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-backup-tab-btn{color:var(--iga-text-muted)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-backup-tab-btn:hover:not(.active){color:var(--iga-text-bright)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(.ig-view,.ig-target-view){display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(.ig-view,.ig-target-view).active{display:block}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;container-type:inline-size;background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);padding:14px;font-size:12px;color:var(--iga-text-main);box-shadow:inset 0 1px 3px #0000001a}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar{width:6px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-track{background:transparent}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:var(--iga-radius-full)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-container::-webkit-scrollbar-thumb:hover{background:var(--ig-scrollbar-thumb-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) :is(#ig-log,#ig-target-view-logs){font-family:var(--iga-font-mono);font-size:11px;line-height:1.6}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry{display:flex;align-items:baseline;gap:8px;padding:4px 6px;color:var(--iga-text-main);border-bottom:1px solid rgba(255,255,255,.03);border-radius:var(--iga-radius-sm);transition:background .15s ease;word-break:break-word}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-log-entry{border-bottom:1px solid rgba(0,0,0,.03)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry:last-child{border-bottom:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-entry:hover{background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-log-time{color:var(--iga-accent);font-weight:600;font-size:10px;background:var(--iga-accent-subtle);padding:1px 6px;border-radius:var(--iga-radius-sm);flex-shrink:0;font-variant-numeric:tabular-nums;letter-spacing:-.2px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-section-title{display:flex;align-items:center;font-weight:700;font-size:13px;margin-bottom:12px;color:var(--iga-text-bright);letter-spacing:-.2px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;background:var(--iga-accent-subtle);color:var(--iga-accent);padding:0 8px;border-radius:var(--iga-radius-full);font-size:11px;font-weight:700;margin-left:8px;border:1px solid rgba(59,130,246,.2)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-toolbar{display:flex;flex-direction:column;gap:8px;margin-bottom:10px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-box{position:relative;display:flex;align-items:center;width:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-icon{position:absolute;left:10px;display:inline-flex;align-items:center;justify-content:center;color:var(--iga-text-dim);pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input{width:100%;height:32px;padding:0 30px 0 32px;font-size:11px;font-family:var(--iga-font-sans);color:var(--iga-text-bright);background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm);outline:none;box-sizing:border-box;transition:border-color .18s var(--iga-ease-default),box-shadow .18s var(--iga-ease-default),background .18s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input:focus{border-color:var(--iga-border-focus);background:var(--iga-surface-hover);box-shadow:0 0 0 2px var(--iga-accent-subtle)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-input::placeholder{color:var(--iga-text-dim);font-size:11px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear{position:absolute;right:6px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--iga-text-dim);cursor:pointer;border-radius:50%;padding:0;transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear svg,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-search-clear line{pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chips{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:3px 2px;scrollbar-width:none;-ms-overflow-style:none;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chips::-webkit-scrollbar{display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:600;font-family:var(--iga-font-sans);color:var(--iga-text-muted);background:var(--iga-surface);border:1px solid var(--iga-border);cursor:pointer;transition:all .15s var(--iga-ease-default);-webkit-user-select:none;user-select:none;white-space:nowrap;line-height:1.2;box-sizing:border-box}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip.is-active{background:#3b82f62e;color:var(--iga-accent);border-color:var(--iga-accent);font-weight:700;box-shadow:0 1px 4px #3b82f640}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chip-count{font-size:9px;padding:0 4px;border-radius:6px;background:#ffffff14;color:var(--iga-text-dim);margin-left:2px;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-filter-chip.is-active .ig-chip-count{background:var(--iga-accent);color:#fff}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-chip-count{background:#0000000f}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-filter-chip.is-active .ig-chip-count{background:var(--iga-accent);color:#fff}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chip-icon{display:inline-flex;align-items:center;justify-content:center}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-list{display:flex;flex-direction:column;flex:1;min-height:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--iga-text-muted);font-size:12px;padding:40px 16px;text-align:center;margin:auto 0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-icon{display:flex;align-items:center;justify-content:center;width:44px;height:44px;color:var(--iga-text-dim);background:var(--iga-surface-hover);border-radius:var(--iga-radius-full);padding:10px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-empty-icon svg{width:100%;height:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);background:var(--iga-surface);min-height:48px;flex-shrink:0;box-sizing:border-box;content-visibility:auto;contain-intrinsic-size:auto 300px auto 52px;transition:background .2s var(--iga-ease-default),border-color .2s var(--iga-ease-default),transform .28s cubic-bezier(.4,0,.2,1),opacity .25s ease,max-height .28s ease,min-height .28s ease,margin .28s ease,padding .28s ease}@supports not (content-visibility: auto){:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row{contain:layout style paint}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row:hover{background:var(--iga-surface-hover);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-row.ig-row-slide-out{content-visibility:visible;contain-intrinsic-size:none;transform:translate(100%);opacity:0;max-height:0;min-height:0;padding-top:0;padding-bottom:0;margin-bottom:0;border-color:transparent;pointer-events:none;overflow:hidden}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-info{display:flex;align-items:center;gap:10px;min-width:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-avatar{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:var(--iga-accent-subtle);color:var(--iga-accent);font-size:12px;font-weight:700;flex-shrink:0;border:1px solid var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-avatar-monogram{position:relative;overflow:hidden;user-select:none;-webkit-user-select:none;background:linear-gradient(135deg,#2a2a2a,#1a1a1a);color:#e4e4e7}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-avatar-monogram .ig-monogram-letter{display:flex;align-items:center;justify-content:center;width:100%;height:100%;text-transform:uppercase;font-weight:700;font-size:13px;letter-spacing:.5px;color:#f4f4f5;transition:opacity .2s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-avatar-img-loaded{position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;opacity:0;transition:opacity .22s cubic-bezier(.4,0,.2,1)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-avatar-monogram.is-loaded .ig-avatar-img-loaded{opacity:1}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-username{color:var(--iga-text-bright);font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-badges{display:inline-flex;align-items:center;gap:4px;margin-left:6px;flex-wrap:wrap;vertical-align:middle}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-pill{display:inline-flex;align-items:center;gap:3px;padding:1px 5px;border-radius:var(--iga-radius-sm);font-size:10px;font-weight:600;line-height:1.3;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-private{background:#94a3b81f;color:var(--iga-text-muted);border:1px solid rgba(148,163,184,.22)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-bestie{background:#22c55e26;color:#22c55e;border:1px solid rgba(34,197,94,.35)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-pending{background:#f59e0b26;color:#f59e0b;border:1px solid rgba(245,158,11,.35)}:is(#ig-analyzer-panel,#ig-target-subpanel) .has-bestie-ring{outline:2px solid #22c55e!important;outline-offset:1px}:is(#ig-analyzer-panel,#ig-target-subpanel) .has-story-ring{outline:2px solid #e1306c!important;outline-offset:1px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-link{display:inline-flex;align-items:center;gap:4px;color:var(--iga-accent);text-decoration:none;font-weight:600;font-size:11px;padding:4px 8px;border-radius:var(--iga-radius-sm);background:var(--iga-accent-subtle);border:1px solid rgba(59,130,246,.2);transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-link:hover{background:var(--iga-accent);color:#fff;text-decoration:none}#ig-analyzer-panel .btn-whitelist,#ig-analyzer-panel .ig-btn-whitelist{background:var(--iga-surface)!important;border:1px solid var(--iga-border)!important;color:var(--iga-text-muted)!important;padding:4px 8px!important;font-size:10px!important;font-weight:600!important;border-radius:var(--iga-radius-sm)!important;cursor:pointer;transition:all .15s ease!important}#ig-analyzer-panel .btn-whitelist:hover,#ig-analyzer-panel .ig-btn-whitelist:hover{background:var(--iga-surface-active)!important;border-color:var(--iga-border-hover)!important;color:var(--iga-text-bright)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-spy-story,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-spy-story{display:inline-flex!important;align-items:center!important;gap:4px!important;background:#a855f71f!important;border:1px solid rgba(168,85,247,.3)!important;color:#c084fc!important;padding:4px 8px!important;font-size:10px!important;font-weight:600!important;border-radius:var(--iga-radius-sm)!important;cursor:pointer;transition:all .2s var(--iga-ease-default)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-spy-story:hover:not(:disabled),:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-spy-story:hover:not(:disabled){background:#a855f740!important;border-color:#c084fc!important;color:#fff!important;transform:translateY(-1px)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table{width:100%;text-align:left;border-collapse:separate;border-spacing:0;margin-top:4px;font-size:11px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table thead th{color:var(--iga-text-muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.6px;padding:8px 10px;border-bottom:1px solid var(--iga-border);position:sticky;top:0;background:var(--iga-surface);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);z-index:2}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table td{padding:8px 10px;border-bottom:1px solid var(--iga-border);color:var(--iga-text-main)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table tbody tr{transition:background .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table tbody tr:hover{background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-user{font-weight:600;color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-date{color:var(--iga-text-muted);font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-link{display:inline-flex;align-items:center;gap:4px;color:var(--iga-accent);text-decoration:none;font-weight:600}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-link:hover{text-decoration:underline}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-metric-value{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;font-weight:600;color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-pagination{display:flex;align-items:center;justify-content:space-between;padding:10px 4px 0;margin-top:8px;border-top:1px solid var(--iga-border);font-size:11px;color:var(--iga-text-muted);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-page-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:var(--iga-radius-sm);font-size:11px;font-weight:600;cursor:pointer;background:var(--iga-surface);color:var(--iga-text-main);border:1px solid var(--iga-border);transition:all .2s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-page-btn:hover:not(:disabled){background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-accent)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-page-btn:disabled{opacity:.35;cursor:not-allowed}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-page-info{font-weight:600;letter-spacing:.02em}.ig-modal-overlay{position:fixed;inset:0;background:#000000a6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);z-index:2147483647;display:none;justify-content:center;align-items:center;animation:iga-fade-in .2s var(--iga-ease-default);padding:20px;box-sizing:border-box}.ig-modal-overlay *{box-sizing:border-box}@keyframes iga-fade-in{0%{opacity:0}to{opacity:1}}.ig-modal-content{background:var(--iga-bg-primary);border:1px solid var(--iga-border);padding:28px 24px;border-radius:var(--iga-radius-xl);width:440px;max-width:92vw;max-height:85vh;text-align:center;color:var(--iga-text-bright);box-shadow:var(--iga-shadow-lg);display:flex;flex-direction:column;align-items:center;animation:iga-modal-slide .25s var(--iga-ease-spring)}@keyframes iga-modal-slide{0%{opacity:0;transform:scale(.95) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}.ig-modal-icon{width:52px;height:52px;color:var(--iga-warning);margin-bottom:16px;padding:12px;background:var(--iga-warning-subtle);border:1px solid rgba(245,158,11,.25);border-radius:50%}.ig-modal-icon svg{width:100%;height:100%}.ig-modal-title{font-size:17px;font-weight:700;margin-bottom:8px;color:var(--iga-text-bright);letter-spacing:-.3px}.ig-modal-text{font-size:13px;line-height:1.6;color:var(--iga-text-muted);margin-bottom:24px;width:100%;max-height:58vh;overflow-y:auto;padding-right:2px}.ig-modal-actions{display:flex;gap:10px;width:100%}.ig-btn-cancel-modal,.ig-btn-confirm-modal{flex:1;padding:10px 16px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s var(--iga-ease-default)}.ig-btn-cancel-modal{background:var(--iga-surface);border:1px solid var(--iga-border);color:var(--iga-text-muted)}.ig-btn-cancel-modal:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}.ig-btn-confirm-modal{background:var(--iga-accent-gradient);border:1px solid rgba(255,255,255,.15);color:#fff;box-shadow:0 4px 12px #2563eb59}.ig-btn-confirm-modal:hover{box-shadow:0 6px 18px #2563eb80;transform:translateY(-1px)}#ig-safety-modal .ig-modal-content.is-engine-modal{width:500px;padding:22px}#ig-safety-modal .ig-modal-content.is-engine-modal .ig-modal-icon{width:44px;height:44px;padding:10px;margin-bottom:10px}#ig-safety-modal .ig-modal-content.is-engine-modal .ig-modal-text{max-height:64vh;text-align:left;margin-bottom:18px}.ig-engine-intro{text-align:center;line-height:1.5}.ig-engine-selector{display:flex;flex-direction:column;gap:8px;margin-top:12px}.ig-engine-selector-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--iga-text-dim);margin-bottom:2px}.ig-engine-card{border:1px solid var(--iga-border);background:var(--iga-surface);border-radius:var(--iga-radius-md);padding:10px 12px;cursor:pointer;transition:border-color .16s var(--iga-ease-default),background .16s var(--iga-ease-default),box-shadow .16s var(--iga-ease-default);-webkit-user-select:none;user-select:none}.ig-engine-card:hover{background:var(--iga-surface-hover);border-color:var(--iga-border-hover)}.ig-engine-card:focus-visible{outline:2px solid var(--iga-accent);outline-offset:2px}.ig-engine-card.is-selected{border-color:var(--iga-accent);background:var(--iga-accent-subtle);box-shadow:0 0 0 1px #3b82f640}.ig-engine-card-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ig-engine-radio{position:relative;width:14px;height:14px;border-radius:50%;border:2px solid var(--iga-text-dim);flex-shrink:0;transition:border-color .16s var(--iga-ease-default)}.ig-engine-card.is-selected .ig-engine-radio{border-color:var(--iga-accent)}.ig-engine-card.is-selected .ig-engine-radio:after{content:"";position:absolute;inset:2px;border-radius:50%;background:var(--iga-accent)}.ig-engine-name{font-size:12.5px;font-weight:700;color:var(--iga-text-bright)}.ig-engine-badge{margin-left:auto;font-size:10px;font-weight:700;padding:2px 7px;border-radius:var(--iga-radius-full);letter-spacing:.01em}.ig-engine-badge.is-recommended{background:var(--iga-success-subtle);color:var(--iga-success);border:1px solid rgba(16,185,129,.3)}.ig-engine-badge.is-accent{background:var(--iga-accent-subtle);color:var(--iga-accent);border:1px solid rgba(59,130,246,.3)}.ig-engine-badge.is-neutral{background:#94a3b824;color:var(--iga-text-main);border:1px solid var(--iga-border)}.ig-engine-desc{font-size:11.5px;line-height:1.45;color:var(--iga-text-muted);margin-top:5px;padding-left:22px}.ig-engine-desc b{color:var(--iga-text-bright);font-weight:600}.ig-engine-desc code{font-family:var(--iga-font-mono);font-size:10.5px;padding:1px 4px;border-radius:4px;background:#ffffff12;color:var(--iga-text-bright)}#ig-safety-modal.ig-light-theme .ig-engine-desc code{background:#0f172a12}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-avatar-trigger{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;transition:transform .18s var(--iga-ease-default);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-avatar-trigger:hover{transform:scale(1.08)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-avatar-trigger:active{transform:scale(.96)}.ig-hd-modal-overlay{display:none;position:fixed;inset:0;background:#000000d1;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:20000000;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:ig-hd-fade-in .2s ease forwards}@keyframes ig-hd-fade-in{0%{opacity:0}to{opacity:1}}.ig-hd-modal-card{background:var(--iga-bg-primary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-xl);padding:24px 20px 20px;width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;position:relative;box-shadow:0 24px 64px -12px #000000bf;color:var(--iga-text-bright);animation:iga-modal-slide .25s var(--iga-ease-spring);box-sizing:border-box}.ig-hd-modal-close{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:var(--iga-surface);border:1px solid var(--iga-border);color:var(--iga-text-dim);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;padding:0}.ig-hd-modal-close:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright)}.ig-hd-avatar-frame{position:relative;width:190px;height:190px;border-radius:50%;margin:8px 0 14px;display:flex;align-items:center;justify-content:center;background:var(--iga-surface);box-shadow:0 8px 32px #00000073;flex-shrink:0;border:2px solid var(--iga-border);box-sizing:border-box}.ig-hd-avatar-frame.has-bestie-ring{outline:4px solid #22c55e!important;outline-offset:3px;box-shadow:0 0 28px #22c55e73,0 8px 32px #00000073}.ig-hd-avatar-frame.has-story-ring{outline:4px solid #e1306c!important;outline-offset:3px;box-shadow:0 0 28px #e1306c73,0 8px 32px #00000073}.ig-hd-avatar-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;background:var(--iga-surface);transition:filter .25s ease,opacity .25s ease}.ig-hd-avatar-fallback{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:700;background:var(--iga-accent-subtle);color:var(--iga-accent)}.ig-hd-res-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:700;letter-spacing:.3px;background:#94a3b826;color:var(--iga-text-muted);border:1px solid var(--iga-border);margin-bottom:12px}.ig-hd-res-pill.is-hd{background:#2563eb29;color:#3b82f6;border-color:#3b82f666;box-shadow:0 0 12px #3b82f633}.ig-hd-spinner{width:10px;height:10px;border:2px solid rgba(148,163,184,.3);border-top-color:var(--iga-accent);border-radius:50%;animation:ig-hd-spin .7s linear infinite;display:inline-block}@keyframes ig-hd-spin{to{transform:rotate(360deg)}}.ig-hd-user-details{display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;margin-bottom:18px}.ig-hd-username-row{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;margin-bottom:2px}.ig-hd-username{font-size:16px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.2px}.ig-hd-fullname{font-size:12px;color:var(--iga-text-muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:8px}.ig-hd-badges{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap}.ig-hd-actions{display:flex;flex-direction:column;gap:8px;width:100%}.ig-hd-actions-row{display:flex;gap:8px;width:100%}.ig-btn-download-hd{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:9px 16px;border-radius:var(--iga-radius-md);background:var(--iga-accent-gradient);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;transition:all .18s var(--iga-ease-default);box-shadow:0 2px 10px #3b82f659}.ig-btn-download-hd:hover{transform:translateY(-1px);box-shadow:0 4px 16px #3b82f673}.ig-btn-open-tab,.ig-btn-view-profile{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex:1;padding:8px 12px;border-radius:var(--iga-radius-md);background:var(--iga-surface);color:var(--iga-text-main);border:1px solid var(--iga-border);font-size:11px;font-weight:600;text-decoration:none!important;cursor:pointer;transition:all .15s ease}.ig-btn-open-tab:hover,.ig-btn-view-profile:hover{background:var(--iga-surface-hover);color:var(--iga-text-bright);border-color:var(--iga-border-hover)}.ig-backup-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:#000000a6;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);z-index:15000000;box-sizing:border-box}.ig-backup-overlay *{box-sizing:border-box}.ig-backup-overlay.is-open{display:flex;animation:iga-fade-in .2s var(--iga-ease-default)}.ig-backup-dialog{width:min(480px,100%);border-radius:var(--iga-radius-xl);background:var(--iga-bg-primary);border:1px solid var(--iga-border);box-shadow:var(--iga-shadow-lg);padding:20px;display:flex;flex-direction:column;gap:14px;color:var(--iga-text-main);animation:iga-modal-slide .25s var(--iga-ease-spring)}.ig-backup-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.ig-backup-dialog-title{font-size:16px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.3px}.ig-backup-close-btn{border:none;background:transparent;color:var(--iga-text-muted);border-radius:var(--iga-radius-sm);padding:4px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease}.ig-backup-close-btn:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover)}.ig-backup-close-btn svg{width:18px;height:18px;display:block}.ig-backup-dialog-description{margin:0;font-size:13px;line-height:1.5;color:var(--iga-text-muted)}.ig-backup-dialog-actions{display:flex;gap:10px}.ig-backup-dialog .ig-backup-btn{flex:1;padding:10px 14px;border-radius:var(--iga-radius-md);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s var(--iga-ease-default)}.ig-backup-btn-export{background:var(--iga-accent-subtle);border:1px solid rgba(59,130,246,.35);color:var(--iga-text-bright)}.ig-backup-btn-export:hover:not(:disabled){background:var(--iga-accent);color:#fff;border-color:var(--iga-accent);box-shadow:0 4px 12px #3b82f659}.ig-backup-btn-import{background:var(--iga-warning-subtle);border:1px solid rgba(245,158,11,.35);color:var(--iga-text-bright)}.ig-backup-btn-import:hover:not(:disabled){background:var(--iga-warning);color:#fff;border-color:var(--iga-warning);box-shadow:0 4px 12px #f59e0b59}.ig-backup-status{font-size:11px;line-height:1.4;color:var(--iga-text-muted);min-height:16px;padding:6px 10px;background:var(--iga-surface);border-radius:var(--iga-radius-sm);border:1px solid var(--iga-border)}.ig-backup-status[data-state=success]{color:var(--iga-success);border-color:#10b9814d;background:var(--iga-success-subtle)}.ig-backup-status[data-state=error]{color:var(--iga-danger);border-color:#ef44444d;background:var(--iga-danger-subtle)}.ig-backup-file-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}#ig-analyzer-panel #ig-footer{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--iga-border);flex-shrink:0}#ig-analyzer-panel .ig-bmc-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:var(--iga-radius-full);background:#fd0;color:#000!important;font-family:var(--iga-font-sans);font-size:11px;font-weight:700;text-decoration:none!important;letter-spacing:-.2px;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px #ffdd0040;transition:transform .2s var(--iga-ease-default),box-shadow .2s var(--iga-ease-default),background .2s var(--iga-ease-default);line-height:1;-webkit-user-select:none;user-select:none}#ig-analyzer-panel .ig-bmc-btn:hover{background:#ffea47;transform:translateY(-1px);box-shadow:0 4px 14px #fd06;text-decoration:none!important;color:#000!important}#ig-analyzer-panel .ig-bmc-btn:active{transform:translateY(0);box-shadow:0 2px 6px #fd03}#ig-analyzer-panel .ig-bmc-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#000}#ig-analyzer-panel .ig-bmc-icon svg{display:block}#ig-analyzer-panel .ig-bmc-text{font-weight:700;color:#000}#ig-analyzer-panel .ig-footer-meta{font-size:11px;color:var(--iga-text-dim);font-weight:500;display:inline-flex;align-items:center;gap:4px;-webkit-user-select:none;user-select:none}#ig-analyzer-panel .ig-footer-dot{opacity:.5}.ig-quick-card{max-width:390px!important;max-height:88vh;overflow-y:auto;padding:22px 18px 18px!important;scrollbar-width:thin;scrollbar-color:var(--ig-scrollbar-thumb) transparent}@supports not (scrollbar-color: auto){.ig-quick-card::-webkit-scrollbar{width:5px}.ig-quick-card::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:4px}}.ig-qc-header{display:flex;flex-direction:column;align-items:center;width:100%}.ig-qc-rel-bar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;width:100%}.ig-qc-rel-pill{font-size:11px;font-weight:600;padding:3px 10px;border-radius:var(--iga-radius-full);display:inline-flex;align-items:center;gap:4px;background:var(--iga-surface);color:var(--iga-text-muted);border:1px solid var(--iga-border)}.ig-qc-rel-pill.is-positive{background:#10b98124;color:#10b981;border-color:#10b9814d}.ig-qc-rel-pill.is-neutral{background:#3b82f624;color:#3b82f6;border-color:#3b82f64d}.ig-qc-rel-pill.is-negative{background:#ef44441f;color:#f87171;border-color:#ef444440}.ig-qc-rel-pill.is-pending{background:#f59e0b24;color:#f59e0b;border-color:#f59e0b4d}.ig-qc-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin-bottom:12px}.ig-qc-stat-card{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:8px 6px;text-align:center;display:flex;flex-direction:column;align-items:center}.ig-qc-stat-value{font-size:15px;font-weight:700;color:var(--iga-text-bright);line-height:1.2}.ig-qc-stat-label{font-size:10px;color:var(--iga-text-muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}.ig-qc-bio-card{background:var(--iga-bg-secondary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:10px 12px;margin-bottom:12px;width:100%;box-sizing:border-box;text-align:left}.ig-qc-bio-text{font-size:12px;line-height:1.45;color:var(--iga-text-main);white-space:pre-wrap;word-break:break-word;max-height:75px;overflow-y:auto}.ig-qc-bio-link{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--iga-accent);margin-top:6px;text-decoration:none;word-break:break-all}.ig-qc-bio-link:hover{text-decoration:underline;color:var(--iga-accent-hover)}.ig-qc-mutuals-card{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:8px 12px;margin-bottom:12px;width:100%;box-sizing:border-box;text-align:left}.ig-qc-mutuals-header{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--iga-text-main);margin-bottom:6px}.ig-qc-facepile-container{display:flex;align-items:center}.ig-facepile-avatar{width:22px;height:22px;border-radius:50%;object-fit:cover;border:2px solid var(--iga-bg-primary);margin-left:-6px;box-shadow:0 1px 3px #0000004d}.ig-facepile-avatar.ig-facepile-fallback{display:inline-flex;align-items:center;justify-content:center;background:var(--iga-accent-subtle);color:var(--iga-accent);font-size:10px;font-weight:700;-webkit-user-select:none;user-select:none}.ig-facepile-avatar:first-child{margin-left:0}.ig-badge-business{background:#9333ea26!important;color:#a855f7!important;border:1px solid rgba(147,51,234,.3)!important}.ig-badge-creator{background:#ec489926!important;color:#ec4899!important;border:1px solid rgba(236,72,153,.3)!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-inspect-user,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-inspect-user{padding:4px 8px;font-size:11px;font-weight:500;color:var(--iga-text-muted);background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .btn-inspect-user:hover,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-inspect-user:hover{color:var(--iga-text-bright);background:var(--iga-surface-hover);border-color:var(--iga-border-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-card{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:10px 8px;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:var(--iga-shadow-sm);transition:transform .15s ease,border-color .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-card:hover{border-color:var(--iga-border-hover);transform:translateY(-1px)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-label{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--iga-text-muted);margin-bottom:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value{font-size:18px;font-weight:700;color:var(--iga-text-bright);line-height:1.2;margin-bottom:4px;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value.is-positive{color:#22c55e}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value.is-negative{color:#ef4444}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub{font-size:10px;color:var(--iga-text-muted);display:inline-flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:3px;line-height:1.25;text-align:center;white-space:normal}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub.is-positive{color:#22c55e}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub.is-negative{color:#ef4444}#ig-analyzer-panel .btn-unwhitelist,#ig-analyzer-panel .ig-btn-unwhitelist{padding:4px 8px;font-size:11px;font-weight:600;color:#3b82f6;background:#3b82f614;border:1px solid rgba(59,130,246,.25);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}#ig-analyzer-panel .btn-unwhitelist:hover,#ig-analyzer-panel .ig-btn-unwhitelist:hover{color:#fff;background:#3b82f6;border-color:#3b82f6;box-shadow:0 2px 6px #3b82f659}#ig-analyzer-panel .btn-clear-whitelist,#ig-analyzer-panel .ig-btn-clear-whitelist{padding:3px 8px;font-size:10.5px;font-weight:600;color:#ef4444;background:#ef444414;border:1px solid rgba(239,68,68,.25);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}#ig-analyzer-panel .btn-clear-whitelist:hover,#ig-analyzer-panel .ig-btn-clear-whitelist:hover{color:#fff;background:#ef4444;border-color:#ef4444;box-shadow:0 2px 6px #ef44444d}.ig-badge-mutual{background:#22c55e1f!important;color:#22c55e!important;border:1px solid rgba(34,197,94,.25)!important}.ig-badge-fan{background:#f59e0b1f!important;color:#f59e0b!important;border:1px solid rgba(245,158,11,.25)!important}.ig-badge-date{background:#94a3b81f!important;color:#94a3b8!important;border:1px solid rgba(148,163,184,.2)!important}.ig-btn-target-audit,.btn-target-audit{display:inline-flex;align-items:center;gap:4px;padding:3.5px 8px;font-size:11px;font-weight:600;border-radius:var(--iga-radius-sm, 6px);background:#6366f11f;color:#818cf8;border:1px solid rgba(99,102,241,.25);cursor:pointer;transition:all .15s ease}.ig-btn-target-audit:hover,.btn-target-audit:hover{background:#6366f1;color:#fff;border-color:#6366f1;box-shadow:0 2px 8px #6366f159}.ig-badge-new-mutual{background:#10b98126!important;color:#10b981!important;border:1px solid rgba(16,185,129,.3)!important;box-shadow:0 0 8px #10b98126}.ig-target-search-card{background:#ffffff08;border:1px solid var(--iga-border, rgba(255, 255, 255, .08));border-radius:var(--iga-radius-lg, 12px);padding:16px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px}.ig-target-search-title{font-size:13.5px;font-weight:700;color:var(--iga-text-bright, #f8fafc);display:flex;align-items:center;gap:6px}.ig-target-search-desc{font-size:11.5px;line-height:1.45;color:var(--iga-text-muted, #94a3b8)}.ig-target-search-input-group{display:flex;align-items:center;gap:8px;background:#0f172a99;border:1px solid var(--iga-border, rgba(255, 255, 255, .1));border-radius:var(--iga-radius-md, 8px);padding:3px 6px 3px 12px;transition:border-color .15s ease}.ig-target-search-input-group:focus-within{border-color:#6366f1;box-shadow:0 0 0 2px #6366f133}.ig-input-prefix{font-size:13px;font-weight:600;color:var(--iga-text-muted, #94a3b8)}.ig-target-input{flex:1;background:transparent;border:none;outline:none;color:var(--iga-text-bright, #f8fafc);font-size:12.5px;padding:6px 0}.ig-target-input::placeholder{color:#94a3b899}.ig-target-feedback{font-size:11.5px;padding:8px 12px;border-radius:var(--iga-radius-sm, 6px);margin-top:4px}.ig-target-feedback.is-error{background:#ef44441f;color:#ef4444;border:1px solid rgba(239,68,68,.25)}.ig-target-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px}.ig-target-card{background:#ffffff06;border:1px solid var(--iga-border, rgba(255, 255, 255, .07));border-radius:var(--iga-radius-md, 10px);padding:12px 14px;display:flex;flex-direction:column;gap:10px;transition:all .18s ease;cursor:pointer}.ig-target-card:hover{border-color:#6366f14d;background:#ffffff0a;transform:translateY(-1px)}.ig-target-card-top{display:flex;align-items:center;gap:10px}.ig-target-card-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#ffffff14;display:flex;align-items:center;justify-content:center;font-weight:700;color:#cbd5e1;flex-shrink:0}.ig-target-card-info{flex:1;min-width:0}.ig-target-card-name-row{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ig-target-card-user{font-weight:700;font-size:13px;color:var(--iga-text-bright, #f8fafc)}.ig-target-card-fullname{font-size:11px;color:var(--iga-text-muted, #94a3b8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-btn-target-delete{background:transparent;border:none;color:var(--iga-text-muted, #94a3b8);cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:all .15s ease}.ig-btn-target-delete:hover{color:#ef4444;background:#ef44441a}.ig-target-card-metrics{display:flex;align-items:center;justify-content:space-between;background:#0003;padding:8px 12px;border-radius:var(--iga-radius-sm, 6px);border:1px solid rgba(255,255,255,.04)}.ig-target-metric{display:flex;flex-direction:column;align-items:center;gap:2px}.ig-target-metric-label{font-size:10px;color:var(--iga-text-muted, #94a3b8);text-transform:uppercase;letter-spacing:.4px}.ig-target-metric-val{font-size:12px;font-weight:700;color:var(--iga-text-bright, #f8fafc);display:flex;align-items:center;gap:4px}.ig-target-card-diff{font-size:10.5px;font-weight:700;padding:1px 4px;border-radius:4px}.ig-target-card-diff.is-positive{background:#22c55e26;color:#22c55e}.ig-target-card-diff.is-negative{background:#ef444426;color:#ef4444}.ig-target-card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:2px}.ig-target-card-time{font-size:10.5px;color:var(--iga-text-muted, #94a3b8)}.ig-target-card-actions{display:flex;align-items:center;gap:6px}#ig-target-subpanel{position:fixed;z-index:10000000;width:580px;min-width:440px;max-width:95vw;height:700px;min-height:420px;max-height:95vh;display:flex;flex-direction:column;resize:both;overflow:hidden;background:#0f172af0;border:1px solid rgba(255,255,255,.12);border-radius:var(--iga-radius-lg, 12px);box-shadow:0 20px 50px #000000a6,0 0 0 1px #6366f126;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);color:var(--iga-text-bright, #f8fafc);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;transition:height .2s cubic-bezier(.16,1,.3,1),box-shadow .2s ease}#ig-target-subpanel.is-minimized{height:48px!important;min-height:48px!important;resize:none!important;overflow:hidden!important}#ig-target-subpanel.is-minimized .ig-target-actions-bar,#ig-target-subpanel.is-minimized .ig-progress-container,#ig-target-subpanel.is-minimized .ig-target-tabs-wrapper,#ig-target-subpanel.is-minimized .ig-target-view,#ig-target-subpanel.is-minimized .ig-target-resize-grip{display:none!important}#ig-target-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#ffffff08;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .08));cursor:grab;-webkit-user-select:none;user-select:none;flex-shrink:0}#ig-target-subpanel.is-dragging #ig-target-header{cursor:grabbing}.ig-target-header-left{display:flex;align-items:center;gap:8px;min-width:0}.ig-target-header-icon{display:inline-flex;align-items:center;color:#818cf8}.ig-target-header-title{font-weight:700;font-size:13.5px;color:var(--iga-text-bright, #f8fafc);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-target-header-right{display:flex;align-items:center;gap:10px;flex-shrink:0}#ig-target-status{font-size:11px;color:var(--iga-text-muted, #94a3b8);display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:12px;background:#ffffff0a}#ig-target-status.is-active{color:#60a5fa}#ig-target-status.is-active .ig-status-dot{background:#60a5fa;box-shadow:0 0 6px #60a5fa}.ig-target-header-actions{display:flex;align-items:center;gap:4px}.ig-target-actions-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#0003;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .06));flex-shrink:0;gap:8px}.ig-target-meta-summary{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.ig-target-meta-user{font-weight:700;font-size:12.5px;color:var(--iga-text-bright, #f8fafc)}.ig-target-meta-name{font-size:11px;color:var(--iga-text-muted, #94a3b8)}.ig-target-meta-pill{font-size:10.5px;padding:1.5px 6px;border-radius:4px;background:#ffffff0f;color:var(--iga-text-muted, #94a3b8)}.ig-target-actions-buttons{display:flex;align-items:center;gap:6px;flex-shrink:0}.ig-target-tabs-wrapper{background:transparent;border-bottom:1px solid var(--iga-border, rgba(255, 255, 255, .06));flex-shrink:0}.ig-target-view{flex:1;overflow-y:auto;overflow-x:hidden;container-type:inline-size;padding:14px;display:none}.ig-target-view.active{display:block}.ig-target-ready-card{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;gap:12px}.ig-target-ready-icon{color:#818cf8;transform:scale(1.6);margin-bottom:8px}.ig-target-ready-title{font-size:16px;font-weight:700;color:var(--iga-text-bright, #f8fafc)}.ig-target-ready-desc{font-size:12px;line-height:1.5;color:var(--iga-text-muted, #94a3b8);max-width:380px}.ig-target-overview-header{display:flex;align-items:center;gap:14px;padding:14px;background:#ffffff08;border-radius:var(--iga-radius-lg, 12px);border:1px solid var(--iga-border, rgba(255, 255, 255, .08))}.ig-target-overview-avatar-wrap .ig-user-avatar{width:52px;height:52px;font-size:18px}.ig-target-overview-meta{flex:1;min-width:0}.ig-target-overview-title-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ig-target-overview-username{font-size:15px;font-weight:700;color:var(--iga-text-bright, #f8fafc)}.ig-target-overview-fullname{font-size:12px;color:var(--iga-text-muted, #94a3b8);margin-top:2px}.ig-target-overview-timestamps{font-size:10.5px;color:var(--iga-text-muted, #94a3b8);margin-top:4px}.ig-target-restricted-alert{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--iga-radius-md, 8px);background:#f59e0b1a;border:1px solid rgba(245,158,11,.3);color:#fbbf24;margin-top:12px;line-height:1.45;font-size:12px}.ig-target-alert-icon{color:#fbbf24;flex-shrink:0;margin-top:1px}.ig-target-resize-grip{position:absolute;bottom:2px;right:2px;width:14px;height:14px;cursor:se-resize;pointer-events:none}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme #ig-target-subpanel){background:#fffffff5;border-color:#0000001f;box-shadow:0 20px 50px #0003;color:#0f172a}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) #ig-target-header{background:#00000005;border-bottom-color:#00000014}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-actions-bar{background:#00000008;border-bottom-color:#0000000f}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-overview-header,:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-search-card,:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-card{background:#f8fafc;border-color:#00000014}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-search-input-group{background:#fff;border-color:#00000026}:is(#ig-target-subpanel.ig-light-theme,.ig-light-theme) .ig-target-card-metrics{background:#f1f5f9;border-color:#0000000d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-count{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:15px;padding:0 5px;border-radius:var(--iga-radius-full);font-size:9.5px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;background:#94a3b829;color:var(--iga-text-muted);pointer-events:none;transition:background .2s var(--iga-ease-default),color .2s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-tab-count{background:#0f172a14}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-btn.active .ig-tab-count{background:var(--iga-accent-subtle);color:var(--iga-accent);border:1px solid rgba(59,130,246,.25)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-tab-count.is-empty{display:none!important}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-value.is-neutral,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub.is-neutral{color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sub-split{gap:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-sep{color:var(--iga-text-dim);font-weight:500;-webkit-user-select:none;user-select:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn{appearance:none;-webkit-appearance:none;background:transparent;border:1px solid transparent;padding:1px 5px;border-radius:5px;font-family:var(--iga-font-sans);font-size:10px;font-weight:700;line-height:1.25;color:var(--iga-text-muted);cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-variant-numeric:tabular-nums;transition:background .15s ease,border-color .15s ease,transform .12s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn.is-positive{color:var(--iga-success)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn.is-negative{color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn:hover{background:var(--iga-surface-hover);border-color:var(--iga-border-hover);text-decoration:underline}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn.is-positive:hover{background:var(--iga-success-subtle);border-color:#10b9814d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn.is-negative:hover{background:var(--iga-danger-subtle);border-color:#ef44444d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-kpi-jump-btn:focus-visible{outline:2px solid var(--iga-border-focus);outline-offset:1px}@media(max-width:560px){:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@supports (container-type: inline-size){@media(max-width:560px){:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}}@container (max-width: 480px){:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-kpi-grid>.ig-kpi-card:nth-child(3):last-child{grid-column:1 / -1}}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-trend-chart-mount{margin-bottom:12px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-trend-chart-card{background:var(--iga-bg-secondary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);padding:12px 14px;box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-title-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-title{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.2px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-window-pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--iga-surface);color:var(--iga-text-muted);border:1px solid var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-window-pill.is-positive{background:var(--iga-success-subtle);color:var(--iga-success);border-color:#10b9814d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-window-pill.is-negative{background:var(--iga-danger-subtle);color:var(--iga-danger);border-color:#ef44444d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-seg-group{display:inline-flex;align-items:center;gap:2px;padding:2px;background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-seg-btn{appearance:none;-webkit-appearance:none;background:transparent;border:none;padding:3px 7px;border-radius:4px;font-family:var(--iga-font-sans);font-size:10px;font-weight:600;line-height:1.2;color:var(--iga-text-muted);cursor:pointer;transition:background .15s ease,color .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-seg-btn:hover:not(.is-active){color:var(--iga-text-bright);background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-seg-btn.is-active{background:var(--iga-accent);color:#fff;box-shadow:0 1px 3px #2563eb4d}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:22px;padding:4px 8px;margin-bottom:6px;border-radius:var(--iga-radius-sm);background:var(--iga-surface);border:1px solid var(--iga-border);font-size:11px;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-date{font-family:var(--iga-font-mono);font-size:10.5px;font-weight:600;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-val{font-weight:700;color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-unit{font-weight:500;font-size:10px;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-delta{display:inline-flex;align-items:center;padding:1px 6px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:700;background:#94a3b824;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-delta.is-positive{background:var(--iga-success-subtle);color:var(--iga-success)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-delta.is-negative{background:var(--iga-danger-subtle);color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-readout-intra{font-size:10px;color:var(--iga-text-dim);margin-left:auto}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-stage{position:relative;width:100%;height:158px;user-select:none;-webkit-user-select:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-trend-svg{width:100%;height:100%;display:block;overflow:visible}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-grid-line{stroke:var(--iga-border);stroke-width:1;vector-effect:non-scaling-stroke}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-grid-line.is-mid{stroke-dasharray:3 3}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-axis-text{fill:var(--iga-text-dim);font-size:9.5px;font-family:var(--iga-font-mono);font-variant-numeric:tabular-nums;pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-area,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-line{pointer-events:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-dot{pointer-events:none;stroke:var(--iga-bg-primary);stroke-width:1.5}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-active-dot{pointer-events:none;stroke:var(--iga-text-bright);stroke-width:2;transition:opacity .12s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-crosshair{stroke:var(--iga-text-dim);stroke-width:1;stroke-dasharray:3 3;pointer-events:none;transition:opacity .12s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-hit{fill:transparent;cursor:crosshair;outline:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-hit:focus-visible{fill:#3b82f614}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tooltip{position:absolute;top:6px;transform:translate(-14%);pointer-events:none;z-index:6;background:var(--iga-bg-primary);border:1px solid var(--iga-border-hover);border-radius:var(--iga-radius-sm);padding:5px 8px;box-shadow:var(--iga-shadow-md);font-size:10.5px;line-height:1.3;white-space:nowrap;font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tooltip.is-right{transform:translate(-86%)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tt-date{font-size:9.5px;font-family:var(--iga-font-mono);color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tt-val{font-size:12px;font-weight:700;color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tt-delta{font-size:10px;font-weight:600;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tt-delta.is-positive{color:var(--iga-success)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-chart-tt-delta.is-negative{color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-composition-card{background:var(--iga-bg-secondary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-lg);padding:12px 14px;margin-bottom:12px;box-shadow:var(--iga-shadow-sm)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-title{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--iga-text-bright);letter-spacing:-.2px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-ratio-pill{font-size:10.5px;padding:2px 8px;border-radius:var(--iga-radius-full);background:var(--iga-surface);border:1px solid var(--iga-border);color:var(--iga-text-muted);font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-ratio-pill strong{color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-bar{display:flex;width:100%;height:9px;border-radius:var(--iga-radius-full);overflow:hidden;background:var(--iga-surface);gap:2px;margin:9px 0 8px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-seg{height:100%;min-width:4px;transition:width .35s var(--iga-ease-default)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-seg.is-mutuals,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-dot.is-mutuals{background:#10b981}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-seg.is-fans,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-dot.is-fans{background:#3b82f6}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-seg.is-notback,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-dot.is-notback{background:#f59e0b}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10.5px;color:var(--iga-text-muted);font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-legend-item{display:inline-flex;align-items:center;gap:5px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-legend-item strong{color:var(--iga-text-bright)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-metric-box{background:var(--iga-surface);border:1px solid var(--iga-border);border-radius:var(--iga-radius-sm);padding:6px 8px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:1px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-metric-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-comp-metric-val{font-size:12px;font-weight:700;color:var(--iga-text-bright);font-variant-numeric:tabular-nums}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-target-card-sparkline{display:inline-flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:var(--iga-radius-sm);background:var(--iga-surface);border:1px solid var(--iga-border);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-sparkline-svg{display:block;overflow:visible}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-scroll-region{overflow:auto;max-inline-size:100%;max-block-size:min(340px,55vh);container-type:inline-size;border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);background:var(--iga-bg-secondary);outline:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-scroll-region:focus-visible{border-color:var(--iga-border-focus);box-shadow:0 0 0 2px var(--iga-accent-subtle)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-scroll-region::-webkit-scrollbar{width:6px;height:6px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-table-scroll-region::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:var(--iga-radius-full)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table{margin-top:0;border-collapse:separate;border-spacing:0;width:100%}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table thead{position:sticky;inset-block-start:0;z-index:2}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table thead th{position:sticky;inset-block-start:0;z-index:2;background:var(--iga-bg-secondary)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody th{position:sticky;inset-inline-start:0;z-index:1;background:var(--iga-bg-secondary);padding:8px 10px;border-bottom:1px solid var(--iga-border);font-weight:600;text-align:left;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody tr:hover th{background:var(--iga-surface-hover)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody tr:last-child th,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody tr:last-child td{border-bottom:none}@container (width < 380px){:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table thead,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tr,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table th,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table td{display:block}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table thead{display:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tr{border-bottom:1px solid var(--iga-border);padding-block-end:4px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table tbody th{position:sticky;inset-block-start:0;z-index:2;background:var(--iga-surface);border-bottom:1px solid var(--iga-border)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table{--label-2: "Followers";--label-3: "Following";--label-4: "Mutuals"}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table td{display:flex;align-items:center;justify-content:space-between;padding:5px 10px;border-bottom:none}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table td:nth-child(2):before{content:var(--label-2) ": ";color:var(--iga-text-muted);font-weight:600;font-size:10px;text-transform:uppercase}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table td:nth-child(3):before{content:var(--label-3) ": ";color:var(--iga-text-muted);font-weight:600;font-size:10px;text-transform:uppercase}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-history-table td:nth-child(4):before{content:var(--label-4) ": ";color:var(--iga-text-muted);font-weight:600;font-size:10px;text-transform:uppercase}}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-delta-pill{display:inline-flex;align-items:center;padding:1px 6px;margin-left:4px;border-radius:var(--iga-radius-full);font-size:10px;font-weight:700;line-height:1.3;font-variant-numeric:tabular-nums;background:#94a3b824;color:var(--iga-text-muted)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-delta-pill.is-positive{background:var(--iga-success-subtle);color:var(--iga-success)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-delta-pill.is-negative{background:var(--iga-danger-subtle);color:var(--iga-danger)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-scans-pill{display:inline-flex;align-items:center;padding:0 5px;margin-left:6px;border-radius:var(--iga-radius-sm);font-size:9.5px;font-weight:700;font-variant-numeric:tabular-nums;background:var(--iga-accent-subtle);color:var(--iga-accent);border:1px solid rgba(59,130,246,.22)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-metric-muted{color:var(--iga-text-dim);font-weight:500}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-view-header-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-clear-nominal{padding:3px 9px;font-size:10.5px;font-weight:600;color:var(--iga-danger);background:var(--iga-danger-subtle);border:1px solid rgba(239,68,68,.25);border-radius:var(--iga-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all .15s ease}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-btn-clear-nominal:hover{color:#fff;background:var(--iga-danger);border-color:var(--iga-danger);box-shadow:0 2px 6px #ef444447}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-text-col{display:flex;flex-direction:column;min-width:0;line-height:1.25;gap:2px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-title-line{display:flex;align-items:center;gap:5px;min-width:0;flex-wrap:wrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-user-fullname{font-size:11px;color:var(--iga-text-muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-rename-flow{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-rename-old{color:var(--iga-text-muted);font-family:var(--iga-font-mono);font-size:11px;text-decoration:line-through;text-decoration-color:#ef444473}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-rename-arrow{display:inline-flex;align-items:center;color:var(--iga-accent);flex-shrink:0}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-rename-new{color:var(--iga-text-bright);font-weight:700;font-size:12px}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-repeat{background:var(--iga-warning-subtle);color:var(--iga-warning);border:1px solid rgba(245,158,11,.3)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-prev-user{background:#6366f124;color:#818cf8;border:1px solid rgba(99,102,241,.3)}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-badge-prev-user{background:#4f46e51a;color:#4f46e5;border-color:#4f46e540}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-following,:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-public{background:var(--iga-accent-subtle);color:var(--iga-accent);border:1px solid rgba(59,130,246,.25)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-churn{background:var(--iga-danger-subtle);color:var(--iga-danger);border:1px solid rgba(239,68,68,.28)}:is(#ig-analyzer-panel,#ig-target-subpanel) .ig-badge-new-mutual-solid{background:var(--iga-success)!important;color:#fff!important;font-weight:700!important;border:none!important}#ig-analyzer-panel,#ig-target-subpanel,.ig-backup-overlay .ig-backup-dialog{color-scheme:dark;background:var(--iga-bg-primary);color:var(--iga-text-main)}#ig-safety-modal .ig-modal-content,#ig-hd-modal .ig-hd-modal-card{color-scheme:dark;background:var(--iga-bg-primary);color:var(--iga-text-bright)}#ig-analyzer-panel.ig-light-theme,#ig-target-subpanel.ig-light-theme,.ig-backup-overlay.ig-light-theme .ig-backup-dialog{color-scheme:light;background:var(--iga-bg-primary);color:var(--iga-text-main)}#ig-safety-modal.ig-light-theme .ig-modal-content,#ig-hd-modal.ig-light-theme .ig-hd-modal-card{color-scheme:light;background:var(--iga-bg-primary);color:var(--iga-text-bright)}#ig-hd-modal.ig-light-theme .ig-hd-modal-card{box-shadow:var(--iga-shadow-lg)}#ig-hd-modal.ig-light-theme .ig-hd-avatar-frame{box-shadow:0 8px 24px #0f172a24}#ig-analyzer-panel.ig-light-theme .ig-target-card-avatar{background:#e2e8f0;color:#334155}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .btn-spy-story,:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-btn-spy-story{background:#9333ea1a!important;border-color:#9333ea47!important;color:#7e22ce!important}:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .btn-spy-story:hover:not(:disabled),:is(#ig-analyzer-panel,#ig-target-subpanel).ig-light-theme .ig-btn-spy-story:hover:not(:disabled){background:#7e22ce!important;border-color:#7e22ce!important;color:#fff!important}.ig-spy-btn-busy{opacity:.65;cursor:wait!important}#ig-safety-modal .ig-spy-hero{margin-bottom:12px;padding:12px 14px;border-radius:var(--iga-radius-md);border:1px solid var(--iga-border);background:var(--iga-surface);text-align:center}#ig-safety-modal .ig-spy-hero.is-safe,#ig-safety-modal .ig-spy-hero:has(.is-safe){background:var(--iga-success-subtle);border-color:#10b98159;--ig-spy-tone: var(--iga-success)}#ig-safety-modal .ig-spy-hero.is-warn,#ig-safety-modal .ig-spy-hero:has(.is-warn){background:var(--iga-warning-subtle);border-color:#f59e0b59;--ig-spy-tone: var(--iga-warning)}#ig-safety-modal .ig-spy-hero.is-danger,#ig-safety-modal .ig-spy-hero:has(.is-danger){background:var(--iga-danger-subtle);border-color:#ef444459;--ig-spy-tone: var(--iga-danger)}#ig-safety-modal .ig-spy-badge{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--ig-spy-tone, var(--iga-accent));margin-bottom:4px}#ig-safety-modal .ig-spy-badge.is-safe{color:var(--iga-success)}#ig-safety-modal .ig-spy-badge.is-warn{color:var(--iga-warning)}#ig-safety-modal .ig-spy-badge.is-danger{color:var(--iga-danger)}#ig-safety-modal .ig-spy-prob{font-size:28px;font-weight:800;color:var(--iga-text-bright);line-height:1.1;font-variant-numeric:tabular-nums}#ig-safety-modal .ig-spy-prob.is-safe{color:var(--iga-success)}#ig-safety-modal .ig-spy-prob.is-warn{color:var(--iga-warning)}#ig-safety-modal .ig-spy-prob.is-danger{color:var(--iga-danger)}#ig-safety-modal .ig-spy-prob-label{font-size:11px;font-weight:600;color:var(--iga-text-muted);margin-top:2px}#ig-safety-modal .ig-spy-reason-card{text-align:left;font-size:12px;line-height:1.55;color:var(--iga-text-main);background:var(--iga-bg-secondary);padding:11px 13px;border-radius:var(--iga-radius-md);border:1px solid var(--iga-border);margin-bottom:10px}#ig-safety-modal .ig-spy-meta-card{text-align:left;font-size:11px;color:var(--iga-text-muted);background:var(--iga-surface);padding:9px 12px;border-radius:var(--iga-radius-md);border:1px solid var(--iga-border);display:flex;flex-direction:column;gap:5px}#ig-safety-modal .ig-spy-meta-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:4px;border-bottom:1px solid var(--iga-border)}#ig-safety-modal .ig-spy-meta-row.is-last,#ig-safety-modal .ig-spy-meta-row:last-child{padding-bottom:0;border-bottom:none}#ig-safety-modal .ig-spy-meta-label{color:var(--iga-text-muted)}#ig-safety-modal .ig-spy-meta-val{font-weight:600;color:var(--iga-text-bright);display:inline-flex;align-items:center;gap:5px}#ig-safety-modal .ig-spy-meta-val.is-strong{font-weight:700;color:var(--iga-text-bright)}#ig-safety-modal .ig-spy-val-muted{color:var(--iga-text-muted);font-weight:500}#ig-safety-modal .ig-spy-val-safe,#ig-safety-modal .ig-spy-val-success{color:var(--iga-success);font-weight:600}#ig-safety-modal .ig-spy-val-warn{color:var(--iga-warning);font-weight:600}#ig-safety-modal .ig-spy-val-danger{color:var(--iga-danger);font-weight:600}#ig-safety-modal .ig-spy-val-story,#ig-safety-modal .ig-spy-val-accent{color:#e1306c;font-weight:700}#ig-safety-modal .ig-spy-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--iga-text-dim);flex-shrink:0}#ig-safety-modal .ig-spy-dot.is-current{background:var(--iga-accent);box-shadow:0 0 6px #3b82f673}#ig-safety-modal .ig-spy-dot.is-story{background:#e1306c;box-shadow:0 0 6px #e1306c80}#ig-safety-modal .ig-spy-dot.is-empty{background:transparent;border:1.5px solid var(--iga-text-dim)}#ig-safety-modal .ig-spy-timeline{margin-top:10px;text-align:left;background:var(--iga-bg-secondary);border:1px solid var(--iga-border);border-radius:var(--iga-radius-md);padding:9px 11px}#ig-safety-modal .ig-spy-timeline-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--iga-text-muted);margin-bottom:6px}#ig-safety-modal .ig-spy-timeline-list{max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;padding-right:4px}#ig-safety-modal .ig-spy-timeline-row{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:10.5px;padding:4px 7px;border-radius:4px;background:var(--iga-surface)}#ig-safety-modal .ig-spy-timeline-row.is-current{border:1px solid var(--iga-border-focus)}#ig-safety-modal .ig-spy-timeline-when{color:var(--iga-text-muted);font-family:var(--iga-font-mono);font-size:10px;display:inline-flex;align-items:center;gap:5px;flex-shrink:0}#ig-safety-modal .ig-spy-timeline-summary{font-weight:600;color:var(--iga-text-main);text-align:right}#ig-safety-modal .ig-spy-timeline-summary.is-safe{color:var(--iga-success)}#ig-safety-modal .ig-spy-timeline-summary.is-warn{color:var(--iga-warning)}#ig-safety-modal .ig-spy-timeline-summary.is-danger{color:var(--iga-danger)}';
  importCSS(mainCss);
  const App = {
isRunning: false,
    abortController: null,
    lastResults: null,
targetRunning: false,
    targetAbortController: null
  };
  Object.assign(App, {
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
      const confirmRes = typeof UI.confirmExtractionModal === "function" ? await UI.confirmExtractionModal({
        title: "Safety Precaution",
        message: "Excessive use of automation tools may result in temporary account restrictions.<br>It is recommended to run this analysis <b>only once per hour</b>.",
        confirmBtnText: "Yes, Continue"
      }) : {
        confirmed: await UI.confirmAction(
          "Safety Precaution",
          "Excessive use of automation tools may result in temporary account restrictions.<br><br>It is recommended to run this analysis <b>only once per hour</b>.",
          "Yes, Continue"
        ),
        engine: Storage.getExtractionEngine()
      };
      if (!confirmRes || !confirmRes.confirmed) {
        UI.log("Analysis cancelled by user.");
        console.log("Analysis cancelled by user.");
        return;
      }
      const selectedEngine = confirmRes.engine || Storage.getExtractionEngine();
      App.isRunning = true;
      App.abortController = new AbortController();
      const signal = App.abortController.signal;
      UI.setRunButtonState("running");
      UI.setStatus("Analyzing...");
      try {
        UI.log("Starting deep analysis...");
        const engineLabel = typeof UI.getEngineDisplayName === "function" ? UI.getEngineDisplayName(selectedEngine) : selectedEngine;
        UI.log(`[Engine] Selected extraction mode: ${engineLabel}`);
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
        const followingRes = await API.extractCompleteUserList(userId, CONFIG.FOLLOWING_HASH, "following", { signal, engine: selectedEngine }, expectedFollowing);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        UI.log(`Total following: ${followingRes.users.length} (with IDs: ${followingRes.users.filter((u) => !!u.id).length})`);
        if (expectedFollowing > 0 && followingRes.users.length < expectedFollowing) {
          UI.log(`[Info] Profile header counter: ${expectedFollowing} following | Accessible accounts returned by list API: ${followingRes.users.length}.`);
        }
        let followersRes;
        if (followingRes.rateLimited) {
          UI.log("[Anti-Ban Guard] Skipping 'Followers' extraction because rate limit (429) was detected during 'Following'.");
          followersRes = {
            users: [],
            isPartial: true,
            rateLimited: true,
            limitedByMeta: false
          };
        } else {
          await Utils.sleep(3500 + Math.random() * 1500, signal);
          UI.log("Fetching 'Followers'...");
          followersRes = await API.extractCompleteUserList(userId, CONFIG.FOLLOWERS_HASH, "followers", { signal, engine: selectedEngine }, expectedFollowers);
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          UI.log(`Total followers: ${followersRes.users.length} (with IDs: ${followersRes.users.filter((u) => !!u.id).length})`);
          if (expectedFollowers > 0 && followersRes.users.length < expectedFollowers) {
            UI.log(`[Info] Profile header counter: ${expectedFollowers} followers | Accessible accounts returned by list API: ${followersRes.users.length}.`);
          }
        }
        const prev = Storage.load();
        let prevFollowersDetailed = [];
        let prevFollowingDetailed = [];
        let followerRenames = [];
        let followingRenames = [];
        let allRenames = [];
        if (prev) {
          prevFollowersDetailed = Utils.toDetailedUserArray(
            Array.isArray(prev.followersDetailed) ? prev.followersDetailed : prev.followers || []
          );
          prevFollowingDetailed = Utils.toDetailedUserArray(
            Array.isArray(prev.followingDetailed) ? prev.followingDetailed : prev.following || []
          );
        }
        let followingDetailed = Storage.hydrateUsersFromMemory(followingRes.users || [], prevFollowingDetailed, {
          friendshipCache: API.friendshipCache,
          prevScanAt: prev?.lastRun
        });
        let followersDetailed = Storage.hydrateUsersFromMemory(followersRes.users || [], prevFollowersDetailed, {
          friendshipCache: API.friendshipCache,
          prevScanAt: prev?.lastRun
        });
        let prevHeaderFollowers = 0;
        let prevHeaderFollowing = 0;
        let followersTruncatedGuard = false;
        let followersCumulativeGuard = false;
        let followingTruncatedGuard = false;
        let followingCumulativeGuard = false;
        if (prev) {
          followerRenames = Utils.detectRenamedUsers(prevFollowersDetailed, followersDetailed);
          followingRenames = Utils.detectRenamedUsers(prevFollowingDetailed, followingDetailed);
          prevHeaderFollowers = Number(prev.headerFollowerCount || prevFollowersDetailed.length || 0);
          prevHeaderFollowing = Number(prev.headerFollowingCount || prevFollowingDetailed.length || 0);
          followersTruncatedGuard = Boolean(followersRes.isPartial && prevFollowersDetailed.length > followersDetailed.length);
          followersCumulativeGuard = Boolean(
            !followersTruncatedGuard && expectedFollowers > 0 && followersDetailed.length < expectedFollowers && prevFollowersDetailed.length > followersDetailed.length && (prevHeaderFollowers === 0 || expectedFollowers >= prevHeaderFollowers)
          );
          if (followersTruncatedGuard || followersCumulativeGuard) {
            const beforeLen = followersDetailed.length;
            const followerRenamedOldInit = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
            const unrenamedPrevFollowers = prevFollowersDetailed.filter((u) => !followerRenamedOldInit.has(u.username.toLowerCase()));
            let mergedFollowers = Utils.toDetailedUserArray(API.mergeExtractedUsers(followersDetailed, unrenamedPrevFollowers));
            if (followersCumulativeGuard && expectedFollowers > 0 && mergedFollowers.length > expectedFollowers) {
              mergedFollowers = mergedFollowers.slice(0, expectedFollowers);
            }
            followersDetailed = mergedFollowers;
            if (followersRes.rateLimited) {
              UI.log(`[Anti-Ban Guard] Rate limit active on 'followers'. Preserved ${followersDetailed.length} known followers from memory & suppressed false Unfollowers.`);
            } else if (followersTruncatedGuard) {
              UI.log(`[Safety Guard] Meta returned a partial followers subset (${beforeLen}/${expectedFollowers || "?"}). Preserving baseline & suppressing false Unfollowers.`);
            } else if (followersDetailed.length > beforeLen) {
              UI.log(`[Cumulative Memory] Reconciled +${followersDetailed.length - beforeLen} previously discovered follower(s) (${followersDetailed.length}/${expectedFollowers} total).`);
            }
          }
          followingTruncatedGuard = Boolean(followingRes.isPartial && prevFollowingDetailed.length > followingDetailed.length);
          followingCumulativeGuard = Boolean(
            !followingTruncatedGuard && expectedFollowing > 0 && followingDetailed.length < expectedFollowing && prevFollowingDetailed.length > followingDetailed.length && (prevHeaderFollowing === 0 || expectedFollowing >= prevHeaderFollowing)
          );
          if (followingTruncatedGuard || followingCumulativeGuard) {
            const beforeLen = followingDetailed.length;
            const followingRenamedOldInit = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
            const unrenamedPrevFollowing = prevFollowingDetailed.filter((u) => !followingRenamedOldInit.has(u.username.toLowerCase()));
            let mergedFollowing = Utils.toDetailedUserArray(API.mergeExtractedUsers(followingDetailed, unrenamedPrevFollowing));
            if (followingCumulativeGuard && expectedFollowing > 0 && mergedFollowing.length > expectedFollowing) {
              mergedFollowing = mergedFollowing.slice(0, expectedFollowing);
            }
            followingDetailed = mergedFollowing;
            if (followingRes.rateLimited) {
              UI.log(`[Anti-Ban Guard] Rate limit active on 'following'. Preserved ${followingDetailed.length} known following from memory & suppressed false lost following.`);
            } else if (followingTruncatedGuard) {
              UI.log(`[Safety Guard] Meta returned a partial following subset (${beforeLen}/${expectedFollowing || "?"}). Preserving baseline & suppressing false lost following.`);
            } else if (followingDetailed.length > beforeLen) {
              UI.log(`[Cumulative Memory] Reconciled +${followingDetailed.length - beforeLen} previously discovered following account(s) (${followingDetailed.length}/${expectedFollowing} total).`);
            }
          }
        }
        const following = followingDetailed.map((u) => u.username);
        const followers = followersDetailed.map((u) => u.username);
        const currFollowingLowerSet = new Set(following.map((u) => u.toLowerCase()));
        const currFollowersLowerSet = new Set(followers.map((u) => u.toLowerCase()));
        const allUsersByLower = new Map();
        [...followingDetailed, ...followersDetailed].forEach((u) => {
          if (!u?.username) return;
          const key = u.username.toLowerCase();
          const existing = allUsersByLower.get(key);
          if (!existing) {
            allUsersByLower.set(key, u);
          } else {
            allUsersByLower.set(key, {
              ...existing,
              ...u,
              id: u.id || existing.id || null,
              fullName: u.fullName || existing.fullName || "",
              profilePicUrl: u.profilePicUrl || existing.profilePicUrl || null,
              isPrivate: u.isPrivateKnown ? u.isPrivate : existing.isPrivate,
              isPrivateKnown: Boolean(u.isPrivateKnown || existing.isPrivateKnown),
              isBestie: Boolean(u.isBestie || existing.isBestie),
              outgoingRequest: Boolean(u.outgoingRequest || existing.outgoingRequest),
              latestReelMedia: Math.max(Number(u.latestReelMedia || 0), Number(existing.latestReelMedia || 0))
            });
          }
        });
        UI.hideProgress();
        UI.setStatus("Calculating Metrics...");
        if (prev) {
          const renameMapById = new Map();
          followerRenames.forEach((r) => {
            const isMutualNow = currFollowingLowerSet.has(r.newUsername.toLowerCase());
            renameMapById.set(String(r.id), {
              ...r,
              relationship: isMutualNow ? "mutual" : "fan"
            });
          });
          followingRenames.forEach((r) => {
            const idStr = String(r.id);
            if (renameMapById.has(idStr)) {
              renameMapById.get(idStr).relationship = "mutual";
            } else {
              const isMutualNow = currFollowersLowerSet.has(r.newUsername.toLowerCase());
              renameMapById.set(idStr, {
                ...r,
                relationship: isMutualNow ? "mutual" : "following"
              });
            }
          });
          allRenames = Array.from(renameMapById.values());
        }
        const { whitelist, reactivatedFollowersLowerSet } = Storage.reconcileAudienceState({
          followersDetailed,
          followingDetailed,
          allRenames
        });
        const whitelistLowerSet = new Set(whitelist.map((u) => String(u || "").toLowerCase()));
        const notFollowingBackUsernames = following.filter((u) => !currFollowersLowerSet.has(u.toLowerCase()));
        const filteredNotFollowing = notFollowingBackUsernames.filter((u) => !whitelistLowerSet.has(u.toLowerCase()));
        const fansUsernames = followers.filter((u) => !currFollowingLowerSet.has(u.toLowerCase()));
        const mutualsUsernames = followers.filter((u) => currFollowingLowerSet.has(u.toLowerCase()));
        const mapToDetailed = (arr) => arr.map((u) => {
          const userObj = allUsersByLower.get(String(u || "").toLowerCase()) || {};
          const canonicalName = userObj.username || u;
          return {
            ...userObj,
            username: canonicalName,
            url: `https://www.instagram.com/${encodeURIComponent(canonicalName)}/`
          };
        });
        const notFollowingBackDetailed = mapToDetailed(filteredNotFollowing);
        const fansDetailed = mapToDetailed(fansUsernames);
        const mutualsDetailed = mapToDetailed(mutualsUsernames);
        UI.log("Not Following Back (filtered): " + notFollowingBackDetailed.length);
        UI.log("Fans: " + fansDetailed.length);
        UI.log("Mutuals: " + mutualsDetailed.length);
        const todayLocalStr = Utils.localDateStr();
        const scanSummary = {
          gained: 0,
          lost: 0,
          deactivated: 0,
          blocked: 0,
          renamed: allRenames.length
        };
        if (prev) {
          const prevFollowers = prevFollowersDetailed.map((u) => u.username);
          const prevFollowing = prevFollowingDetailed.map((u) => u.username);
          const prevFollowersLowerSet = new Set(prevFollowers.map((u) => u.toLowerCase()));
          const prevFollowingLowerSet = new Set(prevFollowing.map((u) => u.toLowerCase()));
          const prevUsersByLower = new Map();
          [...prevFollowingDetailed, ...prevFollowersDetailed].forEach((u) => {
            if (u?.username) prevUsersByLower.set(u.username.toLowerCase(), u);
          });
          if (allRenames.length > 0) {
            Storage.addRenamedEntries(allRenames);
            UI.log("Detected " + allRenames.length + " confirmed username change(s).");
          }
          if (reactivatedFollowersLowerSet.size > 0) {
            UI.log("Restored " + reactivatedFollowersLowerSet.size + " reactivated account(s) from Deactivated.");
          }
          const followerRenamedNewLowerSet = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
          const rawNewFollowers = followers.filter((u) => !prevFollowersLowerSet.has(u.toLowerCase()));
          let newFollowers = rawNewFollowers.filter((u) => {
            const lower = u.toLowerCase();
            return !followerRenamedNewLowerSet.has(lower) && !reactivatedFollowersLowerSet.has(lower);
          });
          const followerRenamedOldLowerSet = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
          const followingRenamedOldLowerSet = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
          const followingRenamedByOldLower = new Map(followingRenames.map((r) => [r.oldUsername.toLowerCase(), r]));
          const rawLostFollowers = prevFollowers.filter((u) => !currFollowersLowerSet.has(u.toLowerCase()));
          const lostFollowers = followersTruncatedGuard || followersCumulativeGuard ? [] : rawLostFollowers.filter((u) => !followerRenamedOldLowerSet.has(u.toLowerCase()));
          const rawLostFollowing = prevFollowing.filter((u) => !currFollowingLowerSet.has(u.toLowerCase()));
          const lostFollowing = followingTruncatedGuard || followingCumulativeGuard ? [] : rawLostFollowing.filter((u) => !followingRenamedOldLowerSet.has(u.toLowerCase()));
          const lostFollowingLowerSet = new Set(lostFollowing.map((u) => u.toLowerCase()));
          const prevExtractedF = Number(prev.extractedFollowersCount) || prevFollowersDetailed.length;
          const prevMissingFollowers = prevHeaderFollowers > 0 && prevFollowersDetailed.length > 0 ? Math.max(0, prevHeaderFollowers - Math.min(prevFollowersDetailed.length, prevExtractedF)) : 0;
          if (prevMissingFollowers >= 4 && expectedFollowers > 0) {
            const maxPossibleRealNew = Math.max(0, expectedFollowers - prevHeaderFollowers) + lostFollowers.length;
            if (newFollowers.length > maxPossibleRealNew) {
              const reconciledCount = newFollowers.length - maxPossibleRealNew;
              newFollowers = newFollowers.slice(0, maxPossibleRealNew);
              UI.log(`[Baseline Reconciled] Absorbed +${reconciledCount} previously unindexed follower(s) into baseline without false 'New Followers' alert.`);
            }
          }
          UI.log("New followers since last run: " + newFollowers.length);
          const newFollowersDetailed = mapToDetailed(newFollowers).map((u) => ({
            ...u,
            followsBack: currFollowingLowerSet.has(u.username.toLowerCase()),
            date: todayLocalStr
          }));
          if (newFollowersDetailed.length > 0) {
            Storage.addNewFollowersEntries(newFollowersDetailed);
          }
          scanSummary.gained = newFollowersDetailed.length;
          const missingUsers = lostFollowers.filter((u) => lostFollowingLowerSet.has(u.toLowerCase()));
          const missingLowerSet = new Set(missingUsers.map((u) => u.toLowerCase()));
          const buildLostEntry = (rawHandle) => {
            const lower = String(rawHandle || "").toLowerCase();
            const ren = followingRenamedByOldLower.get(lower);
            if (ren) {
              const liveProfile = allUsersByLower.get(ren.newUsername.toLowerCase());
              return {
                id: ren.id || liveProfile?.id || null,
                username: ren.newUsername,
                previousUsername: ren.oldUsername,
                fullName: liveProfile?.fullName || ren.fullName || "",
                profilePicUrl: liveProfile?.profilePicUrl || ren.profilePicUrl || null,
                isVerified: Boolean(liveProfile?.isVerified ?? ren.isVerified),
                isPrivate: Boolean(liveProfile?.isPrivate ?? ren.isPrivate),
                date: todayLocalStr
              };
            }
            const liveOrPrev = allUsersByLower.get(lower) || prevUsersByLower.get(lower) || {};
            return {
              id: liveOrPrev.id || null,
              username: liveOrPrev.username || rawHandle,
              fullName: liveOrPrev.fullName || "",
              profilePicUrl: liveOrPrev.profilePicUrl || null,
              isVerified: Boolean(liveOrPrev.isVerified),
              isPrivate: Boolean(liveOrPrev.isPrivate),
              date: todayLocalStr
            };
          };
          const newDeactivated = [];
          const newBlocked = [];
          const newUnfollowers = [];
          const ordinaryUnfollowers = lostFollowers.filter((u) => !missingLowerSet.has(u.toLowerCase()));
          if (ordinaryUnfollowers.length > 0) {
            newUnfollowers.push(...ordinaryUnfollowers);
          }
          const maxVerify = CONFIG.MAX_AUTO_VERIFY_ACCOUNTS || 5;
          const accountsToVerify = missingUsers.slice(0, maxVerify);
          const unverifiedMissing = missingUsers.slice(maxVerify);
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
                const uLower = username.toLowerCase();
                if (currentBlocked.some((b) => String(b.username || "").toLowerCase() === uLower)) {
                  currentBlocked = currentBlocked.filter((b) => String(b.username || "").toLowerCase() !== uLower);
                  Storage.setScopedValue(CONFIG.BLOCKED_KEY, currentBlocked);
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
            Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers.map(buildLostEntry));
          }
          if (newDeactivated.length > 0) {
            UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
            Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated.map(buildLostEntry));
          }
          if (newBlocked.length > 0) {
            UI.log("Identified " + newBlocked.length + " account(s) that blocked you.");
            Storage.addNominalEntries(CONFIG.BLOCKED_KEY, newBlocked.map(buildLostEntry));
          }
          scanSummary.lost = newUnfollowers.length;
          scanSummary.deactivated = newDeactivated.length;
          scanSummary.blocked = newBlocked.length;
        } else {
          UI.log("First run: Initial state established.");
        }
        const authoritativeFollowersCount = Math.max(expectedFollowers || 0, followers.length);
        const authoritativeFollowingCount = Math.max(expectedFollowing || 0, following.length);
        Storage.addHistoryEntry(authoritativeFollowersCount, authoritativeFollowingCount, null, {
          mutuals: mutualsDetailed.length,
          fans: fansDetailed.length,
          notFollowingBack: notFollowingBackDetailed.length,
          scanSummary
        });
        Storage.syncFreshUserData([...followingDetailed, ...followersDetailed]);
        Storage.save({
          version: 4,
          lastRun: Utils.now(),
          headerFollowerCount: expectedFollowers || authoritativeFollowersCount,
          headerFollowingCount: expectedFollowing || authoritativeFollowingCount,
          extractedFollowersCount: (followersRes.users || []).length,
          extractedFollowingCount: (followingRes.users || []).length,
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
        UI.renderHistory(Storage.getHistory());
        UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
        UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
        UI.renderNewFollowers(Storage.getNewFollowersList());
        UI.renderWhitelist(Storage.getWhitelist());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
        UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
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
    }
  });
  Object.assign(App, {
    runStorySpy: async (username, btnElement, targetUserId = null) => {
      const cleanUser = String(username || "").replace(/^@/, "").trim();
      const safeUsername = Utils.escapeHtml(cleanUser);
      let resolvedUserId = targetUserId && String(targetUserId) !== "0" && String(targetUserId) !== "null" ? String(targetUserId) : btnElement?.getAttribute("data-user-id") || null;
      if (btnElement) {
        if (btnElement.disabled) return;
        btnElement.disabled = true;
        btnElement.innerHTML = `<span class="ig-spy-btn-busy">${Icons.spy} Scanning...</span>`;
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
        const trayAvailable = status.authHighlightsAvailable !== false;
        let probability = 0;
        let reason = "";
        let anomalyBadge = "Normal";
        if (status.isGated) {
          probability = 95;
          anomalyBadge = "Gated Access";
          reason = "Meta's API returned a restricted/gated state (<code>latest_reel_media: null</code>) for your account session. You are restricted or hidden from viewing this user's stories.";
        } else if (trayAvailable && !status.isPrivate && (status.anonHighlightsCount > 0 || status.anonHasStory) && (status.authHighlightsCount === 0 && !status.authHasStory)) {
          probability = 100;
          anomalyBadge = "Confirmed Hiding";
          reason = `Confirmed: Highlights (${status.anonHighlightsCount}) or active stories are publicly visible to anonymous guest visitors, but completely hidden from your logged-in account (0 highlights). This user is actively hiding stories from you.`;
        } else if (trayAvailable && status.authHighlightsCount > 0 || status.authHasStory) {
          probability = 0;
          anomalyBadge = "Normal Visibility";
          const visibleItems = [];
          if (trayAvailable && status.authHighlightsCount > 0) visibleItems.push(`<b>${status.authHighlightsCount} highlight(s)</b>`);
          if (status.isBestieStory) visibleItems.push("a <b>Close Friends Story</b> (green ring)");
          else if (status.authHasStory) visibleItems.push("an <b>Active Story</b>");
          const trayNote = !trayAvailable ? " (Highlights tray temporarily rate-limited.)" : "";
          reason = `Normal visibility: Your account can see ${visibleItems.join(" and ")}. No story hiding detected.${trayNote}`;
        } else if (!trayAvailable) {
          const prevStory = Boolean(previous && (previous.hasStory || previous.latestReelMedia && previous.latestReelMedia > 0));
          const prevReelMedia = previous?.latestReelMedia ? Number(previous.latestReelMedia) : 0;
          const nowSeconds = Math.floor(Date.now() / 1e3);
          const storyAgeSeconds = prevReelMedia > 0 ? nowSeconds - prevReelMedia : null;
          const isStoryUnexpired = storyAgeSeconds !== null && storyAgeSeconds >= 0 && storyAgeSeconds < 86400;
          if (prevStory && isStoryUnexpired) {
            probability = 80;
            anomalyBadge = "Story Vanished Early";
            const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
            reason = `<b>Anomaly Detected:</b> An active story posted ~${hoursAgo}h ago is no longer visible to your account (stories last 24h). Highlights tray could not be checked due to a temporary Instagram rate limit, so your previous highlight baseline was preserved.`;
          } else {
            probability = 0;
            anomalyBadge = "Tray Unavailable";
            reason = "Instagram's Highlights Tray endpoint was temporarily rate-limited or unavailable during this check, and no active 24h story is currently posted. Your previous highlight baseline was preserved without triggering a false vanish alert.";
          }
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
        const persistedHighlightsCount = trayAvailable ? status.authHighlightsCount : previous ? previous.highlightsCount ?? previous.highlights ?? 0 : 0;
        const persistedTitles = trayAvailable ? (status.authHighlights || []).map((h) => h.title) : previous?.highlightTitles || [];
        Storage.addStoryObservation(cleanUser, {
          highlightsCount: persistedHighlightsCount,
          trayUnavailable: !trayAvailable,
          latestReelMedia: status.latestReelMedia,
          latestBestiesReelMedia: status.latestBestiesReelMedia,
          hasStory: status.authHasStory,
          isBestieStory: status.isBestieStory,
          isPrivate: status.isPrivate,
          highlightTitles: persistedTitles
        });
        const updatedHistory = Storage.getStoryObservations(cleanUser);
        let stateMod = "is-safe";
        if (probability >= 75) {
          stateMod = "is-danger";
        } else if (probability > 0 || !trayAvailable) {
          stateMod = "is-warn";
        }
        let storyStatusHtml = '<span class="ig-spy-val-muted">None active</span>';
        if (status.isGated) {
          storyStatusHtml = '<span class="ig-spy-val-danger">Gated / Restricted</span>';
        } else if (status.isBestieStory) {
          storyStatusHtml = '<span class="ig-spy-val-success">Close Friends Story (Active)</span>';
        } else if (status.authHasStory) {
          const nowSec = Math.floor(Date.now() / 1e3);
          const ageSec = nowSec - (status.latestReelMedia || nowSec);
          const ageHours = Math.max(0, Math.floor(ageSec / 3600));
          const ageMins = Math.max(0, Math.floor(ageSec % 3600 / 60));
          const timeStr = ageHours > 0 ? `${ageHours}h ${ageMins}m ago` : `${ageMins}m ago`;
          storyStatusHtml = `<span class="ig-spy-val-accent">Active Story (Posted ~${timeStr})</span>`;
        }
        let historyHtml = "";
        if (updatedHistory.length > 1) {
          const recentScans = updatedHistory.slice(-4).reverse();
          historyHtml = `
                    <div class="ig-spy-timeline">
                        <div class="ig-spy-timeline-title">
                            Scan History Timeline (${updatedHistory.length} recorded)
                        </div>
                        <div class="ig-spy-timeline-list">
                            ${recentScans.map((obs, idx) => {
          const isCurrent = idx === 0;
          const localHm = Utils.localTimeStr(obs.timestamp || obs.epochMs).slice(0, 5) || "Scan";
          const hCount = obs.highlightsCount ?? obs.highlights ?? 0;
          const hLabel = obs.trayUnavailable ? `${hCount} highlights (cached)` : `${hCount} highlights`;
          const hasS = obs.hasStory || obs.latestReelMedia && obs.latestReelMedia > 0;
          return `
                                    <div class="ig-spy-timeline-row${isCurrent ? " is-current" : ""}">
                                        <span class="ig-spy-timeline-when">
                                            <span class="ig-spy-dot${isCurrent ? " is-current" : ""}"></span>
                                            ${isCurrent ? "Current" : Utils.escapeHtml(localHm)}
                                        </span>
                                        <span class="ig-spy-timeline-summary">
                                            ${Utils.escapeHtml(hLabel)} · ${hasS ? "Story Active" : "No Story"}
                                        </span>
                                    </div>
                                `;
        }).join("")}
                        </div>
                    </div>
                `;
        }
        const targetType = status.isPrivate ? "Private Account" : "Public Account";
        const highlightsDetail = !trayAvailable ? '<span class="ig-spy-val-warn">Unavailable (Rate Limit)</span>' : status.authHighlightsCount > 0 ? `<b class="ig-spy-val-success">${status.authHighlightsCount} visible</b>` : '<span class="ig-spy-val-muted">0 detected</span>';
        const guestDetail = status.anonHighlightsAvailable === false ? '<span class="ig-spy-val-muted">Unavailable</span>' : `<span class="ig-spy-meta-val">${status.anonHighlightsCount} highlights</span>`;
        const resultHtml = `
                <div class="ig-spy-hero">
                    <div class="ig-spy-badge ${stateMod}">
                        ${Utils.escapeHtml(anomalyBadge)}
                    </div>
                    <div class="ig-spy-prob ${stateMod}">
                        ${probability}%
                    </div>
                    <div class="ig-spy-prob-label">
                        Story Hiding Probability
                    </div>
                </div>

                <div class="ig-spy-reason-card">
                    ${reason}
                </div>

                <div class="ig-spy-meta-card">
                    <div class="ig-spy-meta-row">
                        <span class="ig-spy-meta-label">Target Profile:</span>
                        <span class="ig-spy-meta-val is-strong">@${safeUsername} (${targetType})</span>
                    </div>
                    <div class="ig-spy-meta-row">
                        <span class="ig-spy-meta-label">Highlights (Tray):</span>
                        <span>${highlightsDetail}</span>
                    </div>
                    <div class="ig-spy-meta-row${status.isPrivate ? " is-last" : ""}">
                        <span class="ig-spy-meta-label">Active Story:</span>
                        <span>${storyStatusHtml}</span>
                    </div>
                    ${!status.isPrivate ? `
                    <div class="ig-spy-meta-row is-last">
                        <span class="ig-spy-meta-label">Guest Session (Anon):</span>
                        ${guestDetail}
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
    }
  });
  Object.assign(App, {
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
      const stored = Storage.getTargetData(cleanUser, null, userId);
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
        const prevData = Storage.getTargetData(validatedUser.username, null, validatedUser.id) || Storage.getTargetData(cleanUser, null, targetUserObj?.id) || {};
        const prevTargetHandle = String(
          valRes.renamedFrom || prevData?.user?.username || prevData?.username || ""
        ).replace(/^@+\s*/, "").trim();
        const isTargetRenamed = Boolean(
          prevTargetHandle && prevTargetHandle.toLowerCase() !== String(validatedUser.username || "").toLowerCase()
        );
        const collectedPrevNames = Utils.unique([
          ...Array.isArray(prevData?.user?.previousUsernames) ? prevData.user.previousUsernames : [],
          ...prevData?.user?.previousUsername ? [prevData.user.previousUsername] : [],
          ...validatedUser.previousUsername ? [validatedUser.previousUsername] : [],
          ...isTargetRenamed ? [prevTargetHandle] : []
        ].map((n) => String(n || "").replace(/^@+\s*/, "").trim()).filter((n) => n && n.toLowerCase() !== String(validatedUser.username || "").toLowerCase()));
        if (collectedPrevNames.length > 0) {
          validatedUser.previousUsername = collectedPrevNames[collectedPrevNames.length - 1];
          validatedUser.previousUsernames = collectedPrevNames;
        }
        if (isTargetRenamed) {
          UI.targetLog(`[Target Renamed] @${prevTargetHandle} changed username to @${validatedUser.username} (ID: ${validatedUser.id}). Continuing existing audit history.`);
          if ((validatedUser.followedByViewer || validatedUser.followsViewer) && typeof Storage.addRenamedEntries === "function") {
            const rel = validatedUser.followedByViewer && validatedUser.followsViewer ? "mutual" : validatedUser.followsViewer ? "fan" : "following";
            Storage.addRenamedEntries([{
              id: String(validatedUser.id),
              oldUsername: prevTargetHandle,
              newUsername: validatedUser.username,
              relationship: rel,
              fullName: validatedUser.fullName || "",
              profilePicUrl: validatedUser.profilePicUrl || null,
              isVerified: Boolean(validatedUser.isVerified),
              isPrivate: Boolean(validatedUser.isPrivate)
            }]);
          }
        }
        UI.currentTargetUser = validatedUser;
        const titleEl = document.getElementById("ig-target-header-title");
        if (titleEl) {
          titleEl.innerHTML = "@" + Utils.escapeHtml(validatedUser.username) + (validatedUser.isVerified ? " " + Icons.verified : "");
        }
        const summaryBar = document.getElementById("ig-target-meta-summary");
        if (summaryBar) {
          let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + "</span>";
          if (validatedUser.previousUsername) {
            summaryHtml += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + Utils.escapeHtml(validatedUser.previousUsername) + '">Formerly @' + Utils.escapeHtml(validatedUser.previousUsername) + "</span>";
          }
          if (validatedUser.fullName) {
            summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + "</span>";
          }
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + " followers</span>";
          summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + " following</span>";
          summaryBar.innerHTML = summaryHtml;
        }
        const isRestricted = validatedUser.isPrivate && !validatedUser.followedByViewer;
        if (isRestricted) {
          UI.targetLog(`[Privacy Notice] @${validatedUser.username} is a private account not followed by you. Network extraction is restricted by Meta.`);
          UI.targetLog(`[Metrics] Recorded public counts: ${validatedUser.followerCount} followers, ${validatedUser.followingCount} following.`);
          const history2 = Storage.upsertHistoryRecord(prevData.history || [], {
            followers: validatedUser.followerCount || 0,
            following: validatedUser.followingCount || 0
          });
          const targetData2 = {
            user: validatedUser,
            username: validatedUser.username,
            isRestricted: true,
            followers: [],
            following: [],
            mutuals: [],
            newFollowers: [],
            lostFollowers: [],
            newMutuals: [],
            newFollowing: [],
            lostFollowing: [],
            lastAuditDelta: null,
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
        const confirmRes = typeof UI.confirmExtractionModal === "function" ? await UI.confirmExtractionModal({
          title: "Target Network Audit",
          message: `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br>Select an extraction engine below to query their audience with safe anti-detection pacing:`,
          confirmBtnText: "Yes, Extract Network",
          customIcon: Icons.target
        }) : {
          confirmed: await UI.confirmAction(
            "Target Network Audit",
            `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br><br>Network extraction will query their audience with safe anti-detection pacing. Proceed with network extraction?`,
            "Yes, Extract Network",
            true,
            Icons.target
          ),
          engine: Storage.getExtractionEngine()
        };
        if (!confirmRes || !confirmRes.confirmed) {
          UI.targetLog("[INFO] Extraction skipped by user. Saved profile metrics.");
          const hasExtractedBaseline = Array.isArray(prevData.followers) && prevData.followers.length > 0 || Array.isArray(prevData.following) && prevData.following.length > 0;
          const history2 = hasExtractedBaseline ? Storage.normalizeHistoryRecords(prevData.history || []).list : Storage.upsertHistoryRecord(prevData.history || [], {
            followers: validatedUser.followerCount || 0,
            following: validatedUser.followingCount || 0
          });
          const targetData2 = {
            user: validatedUser,
            username: validatedUser.username,
            isRestricted: false,
            followers: prevData.followers || [],
            following: prevData.following || [],
            mutuals: prevData.mutuals || [],
            newFollowers: prevData.newFollowers || [],
            lostFollowers: prevData.lostFollowers || [],
            newMutuals: prevData.newMutuals || [],
            newFollowing: prevData.newFollowing || [],
            lostFollowing: prevData.lostFollowing || [],
            lastAuditDelta: prevData.lastAuditDelta || null,
            history: history2,
            lastAuditAt: prevData.lastAuditAt || Utils.now()
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
        const selectedEngine = confirmRes.engine || Storage.getExtractionEngine();
        const engineLabel = typeof UI.getEngineDisplayName === "function" ? UI.getEngineDisplayName(selectedEngine) : selectedEngine;
        UI.targetLog(`[Engine] Selected extraction mode: ${engineLabel}`);
        UI.setTargetStatus("Extracting Network...");
        const network = await API.fetchTargetNetwork(
          validatedUser,
          { signal, engine: selectedEngine },
          (curr, total, label) => UI.setTargetProgress(curr, total, label),
          (msg) => UI.targetLog(msg)
        );
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        UI.hideTargetProgress();
        UI.setTargetStatus("Calculating Diffs...");
        UI.targetLog("[Diffing] Calculating changes and mutual connections...");
        const prevFollowersDetailed = Utils.toDetailedUserArray(prevData.followers || []);
        const prevFollowingDetailed = Utils.toDetailedUserArray(prevData.following || []);
        const prevMutualsDetailed = Utils.toDetailedUserArray(prevData.mutuals || []);
        let currFollowers = Storage.hydrateUsersFromMemory(network.followers || [], prevFollowersDetailed, {
          friendshipCache: API.friendshipCache,
          prevScanAt: prevData.lastAuditAt
        });
        let currFollowing = Storage.hydrateUsersFromMemory(network.following || [], prevFollowingDetailed, {
          friendshipCache: API.friendshipCache,
          prevScanAt: prevData.lastAuditAt
        });
        const viewerSnapshot = Storage.load();
        const tagSharedViewerMutuals = (list) => {
          if (!viewerSnapshot || !Array.isArray(viewerSnapshot.followers) || !Array.isArray(viewerSnapshot.following)) return;
          const viewerFollowersLower = new Set(viewerSnapshot.followers.map((u) => String(u || "").toLowerCase()));
          const viewerFollowingLower = new Set(viewerSnapshot.following.map((u) => String(u || "").toLowerCase()));
          list.forEach((u) => {
            const lower = String(u.username || "").toLowerCase();
            u.isViewerMutual = viewerFollowersLower.has(lower) && viewerFollowingLower.has(lower);
          });
        };
        tagSharedViewerMutuals(currFollowers);
        tagSharedViewerMutuals(currFollowing);
        let currFollowersByLower = new Map(currFollowers.map((u) => [u.username.toLowerCase(), u]));
        let currFollowersById = new Map(currFollowers.filter((u) => u.id).map((u) => [String(u.id), u]));
        let currFollowingByLower = new Map(currFollowing.map((u) => [u.username.toLowerCase(), u]));
        const computeMutualsList = (followingList, fById, fByLower) => {
          return followingList.filter((u) => u.id && fById.has(String(u.id)) || fByLower.has(u.username.toLowerCase())).map((u) => {
            const matchF = u.id && fById.get(String(u.id)) || fByLower.get(u.username.toLowerCase());
            if (!matchF) return u;
            return {
              ...matchF,
              ...u,
              id: u.id || matchF.id || null,
              fullName: u.fullName || matchF.fullName || "",
              profilePicUrl: u.profilePicUrl || matchF.profilePicUrl || null,
              isPrivate: u.isPrivateKnown ? u.isPrivate : matchF.isPrivate,
              isPrivateKnown: Boolean(u.isPrivateKnown || matchF.isPrivateKnown),
              isBestie: Boolean(u.isBestie || matchF.isBestie),
              outgoingRequest: Boolean(u.outgoingRequest || matchF.outgoingRequest),
              latestReelMedia: Math.max(Number(u.latestReelMedia || 0), Number(matchF.latestReelMedia || 0))
            };
          });
        };
        let currMutuals = computeMutualsList(currFollowing, currFollowersById, currFollowersByLower);
        let currMutualsByLower = new Map(currMutuals.map((u) => [u.username.toLowerCase(), u]));
        const hasPreviousNetwork = prevFollowersDetailed.length > 0 || prevFollowingDetailed.length > 0;
        const todayLocalStr = Utils.localDateStr();
        const MAX_TRACKED_DIFF_ITEMS = 500;
        let newFollowersDetailed = [];
        let lostFollowersDetailed = [];
        let newMutualsDetailed = [];
        let newFollowingDetailed = [];
        let lostFollowingDetailed = [];
        let lastAuditDelta = {
          gainedFollowers: 0,
          lostFollowers: 0,
          gainedFollowing: 0,
          lostFollowing: 0,
          newMutuals: 0,
          renamed: 0
        };
        if (hasPreviousNetwork) {
          const followerRenames = Utils.detectRenamedUsers(prevFollowersDetailed, currFollowers);
          const followingRenames = Utils.detectRenamedUsers(prevFollowingDetailed, currFollowing);
          const mutualRenames = Utils.detectRenamedUsers(prevMutualsDetailed, currMutuals);
          const renameByOldLower = new Map();
          [...followerRenames, ...followingRenames].forEach((r) => {
            if (r?.oldUsername && r?.newUsername) {
              renameByOldLower.set(r.oldUsername.toLowerCase(), r);
            }
          });
          const followerRenamedOldLower = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
          const followerRenamedNewLower = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
          const followingRenamedOldLower = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
          const followingRenamedNewLower = new Set(followingRenames.map((r) => r.newUsername.toLowerCase()));
          const followingRenamedByOldLower = new Map(followingRenames.map((r) => [r.oldUsername.toLowerCase(), r]));
          const mutualRenamedNewLower = new Set(mutualRenames.map((r) => r.newUsername.toLowerCase()));
          const prevFollowersByLower = new Map(prevFollowersDetailed.map((u) => [u.username.toLowerCase(), u]));
          const prevFollowerIdsSet = new Set(prevFollowersDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));
          const prevFollowingByLower = new Map(prevFollowingDetailed.map((u) => [u.username.toLowerCase(), u]));
          const prevFollowingIdsSet = new Set(prevFollowingDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));
          const prevMutualsLowerSet = new Set(prevMutualsDetailed.map((u) => u.username.toLowerCase()));
          const prevMutualIdsSet = new Set(prevMutualsDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));
          let scanNewFollowers = currFollowers.filter((u) => {
            const lower = u.username.toLowerCase();
            if (u.id && prevFollowerIdsSet.has(String(u.id))) return false;
            return !prevFollowersByLower.has(lower) && !followerRenamedNewLower.has(lower);
          }).map((u) => ({ ...u, date: todayLocalStr }));
          const prevHeaderFollowers = Number(prevData?.user?.headerFollowerCount || prevData?.user?.followerCount || 0);
          const currHeaderFollowers = Number(validatedUser.followerCount || 0);
          const prevHeaderFollowing = Number(prevData?.user?.headerFollowingCount || prevData?.user?.followingCount || 0);
          const currHeaderFollowing = Number(validatedUser.followingCount || 0);
          const followersTruncatedGuard = Boolean(network.isPartialFollowers && prevFollowersDetailed.length > currFollowers.length);
          const followingTruncatedGuard = Boolean(network.isPartialFollowing && prevFollowingDetailed.length > currFollowing.length);
          const followersCumulativeGuard = Boolean(
            !followersTruncatedGuard && currHeaderFollowers > 0 && currFollowers.length < currHeaderFollowers && prevFollowersDetailed.length > 0 && (prevHeaderFollowers === 0 || currHeaderFollowers >= prevHeaderFollowers)
          );
          const followingCumulativeGuard = Boolean(
            !followingTruncatedGuard && currHeaderFollowing > 0 && currFollowing.length < currHeaderFollowing && prevFollowingDetailed.length > 0 && (prevHeaderFollowing === 0 || currHeaderFollowing >= prevHeaderFollowing)
          );
          if (followersTruncatedGuard || followersCumulativeGuard) {
            const beforeLen = currFollowers.length;
            const unrenamedPrevFollowers = prevFollowersDetailed.filter((u) => !followerRenamedOldLower.has(u.username.toLowerCase()));
            let mergedFollowers = Utils.toDetailedUserArray(API.mergeExtractedUsers(currFollowers, unrenamedPrevFollowers));
            if (followersCumulativeGuard && currHeaderFollowers > 0 && mergedFollowers.length > currHeaderFollowers) {
              mergedFollowers = mergedFollowers.slice(0, currHeaderFollowers);
            }
            currFollowers = mergedFollowers;
            tagSharedViewerMutuals(currFollowers);
            currFollowersByLower = new Map(currFollowers.map((u) => [u.username.toLowerCase(), u]));
            currFollowersById = new Map(currFollowers.filter((u) => u.id).map((u) => [String(u.id), u]));
            if (network.isRateLimitedFollowers) {
              UI.targetLog(`[Anti-Ban Guard] Rate limit active on 'followers'. Preserved ${currFollowers.length} known followers from audit memory & suppressed false Lost Followers.`);
            } else if (followersTruncatedGuard) {
              UI.targetLog(`[Safety Guard] Meta returned a partial followers subset (${beforeLen}/${validatedUser.followerCount}). Preserving baseline & suppressing false Lost Followers alerts.`);
            } else if (currFollowers.length > beforeLen) {
              UI.targetLog(`[Cumulative Memory] Reconciled +${currFollowers.length - beforeLen} previously discovered follower(s) (${currFollowers.length}/${validatedUser.followerCount} total).`);
            }
          }
          if (followingTruncatedGuard || followingCumulativeGuard) {
            const beforeLen = currFollowing.length;
            const unrenamedPrevFollowing = prevFollowingDetailed.filter((u) => !followingRenamedOldLower.has(u.username.toLowerCase()));
            let mergedFollowing = Utils.toDetailedUserArray(API.mergeExtractedUsers(currFollowing, unrenamedPrevFollowing));
            if (followingCumulativeGuard && currHeaderFollowing > 0 && mergedFollowing.length > currHeaderFollowing) {
              mergedFollowing = mergedFollowing.slice(0, currHeaderFollowing);
            }
            currFollowing = mergedFollowing;
            tagSharedViewerMutuals(currFollowing);
            currFollowingByLower = new Map(currFollowing.map((u) => [u.username.toLowerCase(), u]));
            if (network.isRateLimitedFollowing) {
              UI.targetLog(`[Anti-Ban Guard] Rate limit active on 'following'. Preserved ${currFollowing.length} known following from audit memory & suppressed false Lost Following.`);
            } else if (followingTruncatedGuard) {
              UI.targetLog(`[Safety Guard] Meta returned a partial following subset (${beforeLen}/${validatedUser.followingCount}). Preserving baseline & suppressing false Lost Following calculations.`);
            } else if (currFollowing.length > beforeLen) {
              UI.targetLog(`[Cumulative Memory] Reconciled +${currFollowing.length - beforeLen} previously discovered following account(s) (${currFollowing.length}/${validatedUser.followingCount} total).`);
            }
          }
          if (followersTruncatedGuard || followingTruncatedGuard || followersCumulativeGuard || followingCumulativeGuard) {
            currMutuals = computeMutualsList(currFollowing, currFollowersById, currFollowersByLower);
            currMutualsByLower = new Map(currMutuals.map((u) => [u.username.toLowerCase(), u]));
          }
          const currFollowerIdsSet = new Set(currFollowers.map((u) => u.id ? String(u.id) : null).filter(Boolean));
          const currFollowingIdsSet = new Set(currFollowing.map((u) => u.id ? String(u.id) : null).filter(Boolean));
          const scanLostFollowers = followersTruncatedGuard || followersCumulativeGuard ? [] : prevFollowersDetailed.filter((u) => {
            const lower = u.username.toLowerCase();
            if (u.id && currFollowerIdsSet.has(String(u.id))) return false;
            return !currFollowersByLower.has(lower) && !followerRenamedOldLower.has(lower);
          }).map((u) => {
            const lower = u.username.toLowerCase();
            const ren = followingRenamedByOldLower.get(lower);
            if (ren) {
              const liveInFollowing2 = currFollowingByLower.get(ren.newUsername.toLowerCase());
              return {
                ...liveInFollowing2 || u,
                id: ren.id || u.id || null,
                username: ren.newUsername,
                previousUsername: ren.oldUsername,
                url: `https://www.instagram.com/${encodeURIComponent(ren.newUsername)}/`,
                date: todayLocalStr
              };
            }
            const liveInFollowing = currFollowingByLower.get(lower);
            return {
              ...liveInFollowing || u,
              date: todayLocalStr
            };
          });
          let scanNewFollowing = currFollowing.filter((u) => {
            const lower = u.username.toLowerCase();
            if (u.id && prevFollowingIdsSet.has(String(u.id))) return false;
            return !prevFollowingByLower.has(lower) && !followingRenamedNewLower.has(lower);
          }).map((u) => ({ ...u, date: todayLocalStr }));
          const scanLostFollowing = followingTruncatedGuard || followingCumulativeGuard ? [] : prevFollowingDetailed.filter((u) => {
            const lower = u.username.toLowerCase();
            if (u.id && currFollowingIdsSet.has(String(u.id))) return false;
            return !currFollowingByLower.has(lower) && !followingRenamedOldLower.has(lower);
          }).map((u) => {
            const lower = u.username.toLowerCase();
            const liveInFollowers = currFollowersByLower.get(lower);
            return {
              ...liveInFollowers || u,
              date: todayLocalStr
            };
          });
          let reconciledFollowerLowers = new Set();
          let reconciledFollowingLowers = new Set();
          const prevExtractedF = Number(prevData?.user?.extractedFollowersCount) || prevFollowersDetailed.length;
          const prevMissingFollowers = prevHeaderFollowers > 0 && prevFollowersDetailed.length > 0 ? Math.max(0, prevHeaderFollowers - Math.min(prevFollowersDetailed.length, prevExtractedF)) : 0;
          const maxPossibleRealNewF = prevHeaderFollowers > 0 && currHeaderFollowers > 0 ? Math.max(0, currHeaderFollowers - prevHeaderFollowers) + scanLostFollowers.length : scanNewFollowers.length;
          if (prevMissingFollowers >= 4 && scanNewFollowers.length > maxPossibleRealNewF) {
            const reconciledFollowers = scanNewFollowers.slice(maxPossibleRealNewF);
            scanNewFollowers = scanNewFollowers.slice(0, maxPossibleRealNewF);
            reconciledFollowerLowers = new Set(reconciledFollowers.map((u) => u.username.toLowerCase()));
            if (reconciledFollowers.length > 0) {
              UI.targetLog(`[Baseline Reconciled] Absorbed +${reconciledFollowers.length} previously unindexed follower(s) into @${validatedUser.username}'s baseline (suppressed false 'New Followers').`);
            }
          }
          const prevExtractedIng = Number(prevData?.user?.extractedFollowingCount) || prevFollowingDetailed.length;
          const prevMissingFollowing = prevHeaderFollowing > 0 && prevFollowingDetailed.length > 0 ? Math.max(0, prevHeaderFollowing - Math.min(prevFollowingDetailed.length, prevExtractedIng)) : 0;
          const maxPossibleRealNewIng = prevHeaderFollowing > 0 && currHeaderFollowing > 0 ? Math.max(0, currHeaderFollowing - prevHeaderFollowing) + scanLostFollowing.length : scanNewFollowing.length;
          if (prevMissingFollowing >= 4 && scanNewFollowing.length > maxPossibleRealNewIng) {
            const reconciledFollowing = scanNewFollowing.slice(maxPossibleRealNewIng);
            scanNewFollowing = scanNewFollowing.slice(0, maxPossibleRealNewIng);
            reconciledFollowingLowers = new Set(reconciledFollowing.map((u) => u.username.toLowerCase()));
            if (reconciledFollowing.length > 0) {
              UI.targetLog(`[Baseline Reconciled] Absorbed +${reconciledFollowing.length} previously unindexed following account(s) into @${validatedUser.username}'s baseline.`);
            }
          }
          const scanNewFollowersLowers = new Set(scanNewFollowers.map((u) => u.username.toLowerCase()));
          const scanNewFollowingLowers = new Set(scanNewFollowing.map((u) => u.username.toLowerCase()));
          const scanNewMutuals = currMutuals.filter((u) => {
            const lower = u.username.toLowerCase();
            if (u.id && prevMutualIdsSet.has(String(u.id))) return false;
            if (prevMutualsLowerSet.has(lower) || mutualRenamedNewLower.has(lower)) return false;
            if (reconciledFollowerLowers.has(lower) && !scanNewFollowingLowers.has(lower)) return false;
            if (reconciledFollowingLowers.has(lower) && !scanNewFollowersLowers.has(lower)) return false;
            return true;
          }).map((u) => ({ ...u, date: todayLocalStr }));
          lastAuditDelta = {
            gainedFollowers: scanNewFollowers.length,
            lostFollowers: scanLostFollowers.length,
            gainedFollowing: scanNewFollowing.length,
            lostFollowing: scanLostFollowing.length,
            newMutuals: scanNewMutuals.length,
            renamed: renameByOldLower.size
          };
          const mergeActiveGains = (prevGains, scanGains, activeLookupMap) => {
            const mergedByLower = new Map();
            Utils.toDetailedUserArray(prevGains || []).forEach((item) => {
              const ren = renameByOldLower.get(item.username.toLowerCase());
              const targetLower = (ren ? ren.newUsername : item.username).toLowerCase();
              const live = activeLookupMap.get(targetLower);
              if (!live) return;
              mergedByLower.set(targetLower, {
                ...item,
                ...live,
                isPrivate: live.isPrivateKnown ? live.isPrivate : Boolean(item.isPrivate),
                isPrivateKnown: Boolean(live.isPrivateKnown || item.isPrivateKnown),
                date: item.date ? Utils.localDateStr(item.date) : todayLocalStr
              });
            });
            scanGains.forEach((item) => {
              const lower = item.username.toLowerCase();
              if (mergedByLower.has(lower)) mergedByLower.delete(lower);
              mergedByLower.set(lower, item);
            });
            const arr = Utils.toDetailedUserArray(Array.from(mergedByLower.values()));
            return arr.length > MAX_TRACKED_DIFF_ITEMS ? arr.slice(arr.length - MAX_TRACKED_DIFF_ITEMS) : arr;
          };
          const mergeActiveLosses = (prevLosses, scanLosses, activeLookupMap, secondaryLookupMap) => {
            const mergedByLower = new Map();
            Utils.toDetailedUserArray(prevLosses || []).forEach((item) => {
              const ren = renameByOldLower.get(item.username.toLowerCase());
              const resolvedName = ren ? ren.newUsername : item.username;
              const targetLower = resolvedName.toLowerCase();
              if (activeLookupMap.has(targetLower)) return;
              if (item.id && Array.from(activeLookupMap.values()).some((u) => u.id && String(u.id) === String(item.id))) return;
              const secondaryLive = secondaryLookupMap ? secondaryLookupMap.get(targetLower) : null;
              mergedByLower.set(targetLower, {
                ...item,
                ...secondaryLive || {},
                username: resolvedName,
                url: `https://www.instagram.com/${encodeURIComponent(resolvedName)}/`,
                date: item.date ? Utils.localDateStr(item.date) : todayLocalStr
              });
            });
            scanLosses.forEach((item) => {
              const lower = item.username.toLowerCase();
              if (mergedByLower.has(lower)) mergedByLower.delete(lower);
              mergedByLower.set(lower, item);
            });
            const arr = Utils.toDetailedUserArray(Array.from(mergedByLower.values()));
            return arr.length > MAX_TRACKED_DIFF_ITEMS ? arr.slice(arr.length - MAX_TRACKED_DIFF_ITEMS) : arr;
          };
          newFollowersDetailed = mergeActiveGains(prevData.newFollowers, scanNewFollowers, currFollowersByLower);
          lostFollowersDetailed = mergeActiveLosses(prevData.lostFollowers, scanLostFollowers, currFollowersByLower, currFollowingByLower);
          newMutualsDetailed = mergeActiveGains(prevData.newMutuals, scanNewMutuals, currMutualsByLower);
          newFollowingDetailed = mergeActiveGains(prevData.newFollowing, scanNewFollowing, currFollowingByLower);
          lostFollowingDetailed = mergeActiveLosses(prevData.lostFollowing, scanLostFollowing, currFollowingByLower, currFollowersByLower);
          const formatPreviewList = (arr, limit = 5) => {
            const names = (arr || []).slice(0, limit).map((u) => `@${u.username}`);
            const extra = (arr || []).length - names.length;
            return extra > 0 ? `${names.join(", ")} (+${extra} more)` : names.join(", ");
          };
          if (renameByOldLower.size > 0) {
            const renamePairs = Array.from(renameByOldLower.values()).slice(0, 5).map((r) => `@${r.oldUsername} -> @${r.newUsername}`);
            const extraRenames = renameByOldLower.size - renamePairs.length;
            UI.targetLog(`[Network Renames] Detected ${renameByOldLower.size} username change(s) in @${validatedUser.username}'s network: ${renamePairs.join(", ")}${extraRenames > 0 ? ` (+${extraRenames} more)` : ""}.`);
          }
          if (scanNewMutuals.length > 0) {
            UI.targetLog(`[New Mutuals] Detected +${scanNewMutuals.length} new mutual connection(s) for @${validatedUser.username}: ${formatPreviewList(scanNewMutuals)} (added to 'New Mutuals' tab).`);
          }
          if (scanNewFollowers.length > 0) {
            UI.targetLog(`[New Followers] Detected +${scanNewFollowers.length} new follower(s): ${formatPreviewList(scanNewFollowers)}.`);
          }
          if (scanLostFollowers.length > 0) {
            UI.targetLog(`[Lost Followers] Detected -${scanLostFollowers.length} lost follower(s): ${formatPreviewList(scanLostFollowers)}.`);
          }
          UI.targetLog(`[Diff Results] This scan: +${scanNewFollowers.length} followers, -${scanLostFollowers.length} lost, +${scanNewMutuals.length} new mutuals | Active tracked: +${newFollowersDetailed.length} followers / -${lostFollowersDetailed.length} lost / +${newMutualsDetailed.length} new mutuals`);
        } else {
          UI.targetLog("[Diff Results] Initial baseline recorded for @" + validatedUser.username + ".");
        }
        const authoritativeFollowersCount = Math.max(Number(validatedUser.followerCount) || 0, currFollowers.length);
        const authoritativeFollowingCount = Math.max(Number(validatedUser.followingCount) || 0, currFollowing.length);
        validatedUser.headerFollowerCount = Number(validatedUser.followerCount) || authoritativeFollowersCount;
        validatedUser.headerFollowingCount = Number(validatedUser.followingCount) || authoritativeFollowingCount;
        validatedUser.followerCount = authoritativeFollowersCount;
        validatedUser.followingCount = authoritativeFollowingCount;
        validatedUser.extractedFollowersCount = currFollowers.length;
        validatedUser.extractedFollowingCount = currFollowing.length;
        const history = Storage.upsertHistoryRecord(prevData.history || [], {
          followers: authoritativeFollowersCount,
          following: authoritativeFollowingCount,
          mutuals: currMutuals.length,
          scanSummary: {
            gained: lastAuditDelta.gainedFollowers,
            lost: lastAuditDelta.lostFollowers,
            deactivated: 0,
            blocked: 0,
            renamed: lastAuditDelta.renamed
          }
        });
        const targetData = {
          user: validatedUser,
          username: validatedUser.username,
          isRestricted: false,
          followers: currFollowers,
          following: currFollowing,
          mutuals: currMutuals,
          newFollowers: newFollowersDetailed,
          lostFollowers: lostFollowersDetailed,
          newMutuals: newMutualsDetailed,
          newFollowing: newFollowingDetailed,
          lostFollowing: lostFollowingDetailed,
          lastAuditDelta,
          history,
          lastAuditAt: Utils.now()
        };
        Storage.syncFreshUserData([...currFollowers, ...currFollowing]);
        Storage.saveTargetData(validatedUser.username, targetData);
        const finalSummaryBar = document.getElementById("ig-target-meta-summary");
        if (finalSummaryBar) {
          let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + "</span>";
          if (validatedUser.previousUsername) {
            summaryHtml += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + Utils.escapeHtml(validatedUser.previousUsername) + '">Formerly @' + Utils.escapeHtml(validatedUser.previousUsername) + "</span>";
          }
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
        UI.targetLog(`[Audit Finished] Successfully audited @${validatedUser.username} (${authoritativeFollowersCount} followers, ${authoritativeFollowingCount} following, ${currMutuals.length} mutuals).`);
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
    }
  });
  Object.assign(App, {
    bindEvents: () => {
      const btnRun = document.getElementById("ig-run");
      if (btnRun) btnRun.onclick = App.run;
      const btnExport = document.getElementById("ig-export-csv");
      if (btnExport) btnExport.onclick = () => {
        const ctx = typeof UI.getActiveExportContext === "function" ? UI.getActiveExportContext() : { mode: "none", slug: null, items: [] };
        if (!ctx || !Array.isArray(ctx.items) || ctx.items.length === 0) {
          UI.log("[INFO] No data in the active view to export.");
          return;
        }
        const dateStr = Utils.localDateStr();
        if (ctx.mode === "history") {
          Utils.exportHistoryCSV(ctx.items, `ig_history_${dateStr}.csv`);
          UI.log(`CSV Exported (${ctx.items.length} history entries).`);
          return;
        }
        const slug = ctx.slug || "analysis";
        Utils.exportCSV(ctx.items, `ig_${slug}_${dateStr}.csv`);
        UI.log(`CSV Exported (${ctx.items.length} accounts from ${slug}).`);
      };
      const btnReset = document.getElementById("ig-reset");
      if (btnReset) {
        btnReset.onclick = async () => {
          const confirmed = await UI.confirmAction(
            "Delete All Data",
            "This action will wipe all your history, logs, and whitelists for the active account.<br><br>Are you sure you want to proceed?",
            "Yes, Delete"
          );
          if (confirmed) {
            Storage.resetAll();
            UI.paginationState = {};
            UI.targetPaginationState = {};
            UI.whitelistSearchQuery = "";
            UI.currentTargetUser = null;
            App.lastResults = [];
            if (typeof window !== "undefined") window.__igLastResults = [];
            if (typeof API.clearFriendshipCache === "function") {
              API.clearFriendshipCache();
            }
            const subpanel2 = document.getElementById("ig-target-subpanel");
            if (subpanel2) subpanel2.style.display = "none";
            UI.renderHistory([]);
            UI.renderNominalList([], "ig-view-unfollowers", "Recent Unfollowers");
            UI.renderNominalList([], "ig-view-deactivated", "Deactivated Accounts");
            UI.renderNominalList([], "ig-view-blocked", "Blocked Accounts");
            UI.renderRenamedList([], "ig-view-renamed", "Username Changes");
            UI.renderNewFollowers([]);
            UI.renderWhitelist([]);
            if (typeof UI.renderTargetTrackerMainView === "function") {
              UI.renderTargetTrackerMainView();
            }
            UI.renderPersistedSnapshot(null);
            if (typeof UI.updateMainTabCounts === "function") {
              UI.updateMainTabCounts();
            }
            if (typeof UI.syncMainExportButton === "function") {
              UI.syncMainExportButton();
            }
            UI.log("[INFO] Data reset.");
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
            }
            if (typeof UI.syncMainExportButton === "function") {
              UI.syncMainExportButton();
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
              const targetLower = targetUser.toLowerCase();
              const inFollowing = snapshot.following.some((x) => String(typeof x === "string" ? x : x?.username || "").toLowerCase() === targetLower);
              const inFollowers = snapshot.followers.some((x) => String(typeof x === "string" ? x : x?.username || "").toLowerCase() === targetLower);
              if (inFollowing && !inFollowers) {
                const notFollowingState = UI.paginationState["ig-view-notfollowing"];
                if (notFollowingState && Array.isArray(notFollowingState.rawUsers)) {
                  if (!notFollowingState.rawUsers.some((u) => String(u.username || "").toLowerCase() === targetLower)) {
                    const knownObj = (snapshot.followingDetailed || []).find((u) => String(u?.username || "").toLowerCase() === targetLower) || (typeof Storage.findKnownUserByUsername === "function" ? Storage.findKnownUserByUsername(targetUser) : null) || {
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
            if (typeof UI.syncMainExportButton === "function") {
              UI.syncMainExportButton();
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
                const followingNames = snap.following.map((x) => typeof x === "string" ? x : x?.username).filter(Boolean);
                const followerNames = snap.followers.map((x) => typeof x === "string" ? x : x?.username).filter(Boolean);
                const notFollowingBackUsernames = Utils.diff(followingNames, followerNames);
                const allUsersMap = new Map();
                [...snap.followingDetailed || [], ...snap.followersDetailed || []].forEach((u) => {
                  if (u?.username) allUsersMap.set(u.username.toLowerCase(), u);
                });
                const restored = notFollowingBackUsernames.map((u) => ({
                  ...allUsersMap.get(String(u).toLowerCase()) || {},
                  username: u,
                  url: "https://www.instagram.com/" + u + "/"
                }));
                UI.renderResults(restored, "Not Following You Back", "ig-view-notfollowing", true);
                App.lastResults = restored;
                window.__igLastResults = restored;
              }
              if (typeof UI.syncMainExportButton === "function") {
                UI.syncMainExportButton();
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
            const userId = btnCardOpen.getAttribute("data-user-id");
            if (username) App.openTargetAudit(username, userId || null, false);
            return;
          }
          const btnCardRefresh = e.target.closest(".btn-target-card-refresh");
          if (btnCardRefresh) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnCardRefresh.getAttribute("data-username");
            const userId = btnCardRefresh.getAttribute("data-user-id");
            if (username) App.openTargetAudit(username, userId || null, true);
            return;
          }
          const btnCardDelete = e.target.closest(".btn-target-card-delete");
          if (btnCardDelete) {
            e.preventDefault();
            e.stopPropagation();
            const username = btnCardDelete.getAttribute("data-username");
            const userId = btnCardDelete.getAttribute("data-user-id");
            if (username) {
              const confirmed = await UI.confirmAction(
                "Remove Monitored Target",
                `Are you sure you want to stop tracking <b>@${Utils.escapeHtml(username)}</b>?<br><br>Their audit history will be deleted.`,
                "Yes, Remove",
                true,
                Icons.trash
              );
              if (confirmed) {
                Storage.removeTargetData(username, null, userId || null);
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
          const btnMainJump = e.target.closest(".ig-kpi-jump-btn[data-main-tab]");
          if (btnMainJump) {
            e.preventDefault();
            e.stopPropagation();
            const destId = btnMainJump.getAttribute("data-main-tab");
            const tabBtn = destId ? panel.querySelector(`#ig-tabs .ig-tab-btn[data-target="${destId}"]`) : null;
            if (tabBtn) tabBtn.click();
            return;
          }
          const btnClearNominal = e.target.closest(".ig-btn-clear-nominal[data-clear-key]");
          if (btnClearNominal) {
            e.preventDefault();
            e.stopPropagation();
            const clearKey = btnClearNominal.getAttribute("data-clear-key");
            const cId = btnClearNominal.getAttribute("data-container") || "";
            const viewTitle = btnClearNominal.getAttribute("data-title") || "Records";
            if (!clearKey) return;
            const confirmed = await UI.confirmAction(
              `Clear ${viewTitle}`,
              `Are you sure you want to clear all saved entries in <b>${Utils.escapeHtml(viewTitle)}</b>?<br><br>Your main audience snapshot and other tabs will remain intact.`,
              "Yes, Clear",
              true,
              Icons.trash
            );
            if (confirmed) {
              Storage.clearNominalList(clearKey);
              if (cId === "ig-view-renamed") {
                UI.renderRenamedList([], cId, viewTitle);
              } else if (cId) {
                UI.renderNominalList([], cId, viewTitle, { storageKey: clearKey });
              }
              UI.renderHistory(Storage.getHistory());
              if (typeof UI.updateMainTabCounts === "function") {
                UI.updateMainTabCounts();
              }
              UI.log(`[INFO] Cleared ${viewTitle}.`);
            }
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
            const userId = targetCard.getAttribute("data-user-id");
            if (username) App.openTargetAudit(username, userId || null, false);
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
              const rawLabel = activeTab?.querySelector(".ig-tab-label")?.textContent || activeTab?.innerText || "list";
              const tabLabel = rawLabel.trim().toLowerCase().replace(/\s+/g, "_");
              const dateStr = Utils.localDateStr();
              Utils.exportCSV(listToExport, `@${targetName}_${tabLabel}_${dateStr}.csv`);
              UI.targetLog(`CSV Exported (${listToExport.length} accounts).`);
            }
          };
        }
        subpanel.addEventListener("click", async (e) => {
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
          const inspectTrigger = e.target.closest(".ig-user-avatar-trigger, .btn-inspect-user, .ig-btn-inspect-user");
          if (inspectTrigger) {
            e.preventDefault();
            e.stopPropagation();
            const userId = inspectTrigger.getAttribute("data-user-id");
            const username = inspectTrigger.getAttribute("data-username");
            const containerId = inspectTrigger.getAttribute("data-container");
            let userObj = null;
            if (containerId && UI.targetPaginationState[containerId]?.rawUsers) {
              userObj = UI.targetPaginationState[containerId].rawUsers.find(
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
          const btnTargetJump = e.target.closest(".ig-kpi-jump-btn[data-target-tab]");
          if (btnTargetJump) {
            e.preventDefault();
            e.stopPropagation();
            const destId = btnTargetJump.getAttribute("data-target-tab");
            const tabBtn = destId ? subpanel.querySelector(`#ig-target-tabs .ig-tab-btn[data-target="${destId}"]`) : null;
            if (tabBtn) tabBtn.click();
            return;
          }
          const btnPrev = e.target.closest(".ig-target-page-prev");
          if (btnPrev && !btnPrev.disabled) {
            e.preventDefault();
            e.stopPropagation();
            const cId = btnPrev.getAttribute("data-container");
            if (cId) UI.changeTargetPage(cId, -1);
            return;
          }
          const btnNext = e.target.closest(".ig-target-page-next");
          if (btnNext && !btnNext.disabled) {
            e.preventDefault();
            e.stopPropagation();
            const cId = btnNext.getAttribute("data-container");
            if (cId) UI.changeTargetPage(cId, 1);
            return;
          }
        });
      }
      window.addEventListener("keydown", (e) => {
        if (e.key === "F9") {
          e.preventDefault();
          e.stopPropagation();
          UI.togglePanel();
          return;
        }
        if (e.key === "F8") {
          const tag = document.activeElement?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
          e.preventDefault();
          e.stopPropagation();
          UI.resetPosition();
          return;
        }
      }, true);
    }
  });
  const TOUR_SEEN_KEY = CONFIG.TOUR_KEY;
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
          description: "Welcome to version 3.14.0! This complete guided tour walks you through every feature of your Instagram Follower Analyzer. Safe, private, and enriched with deep audience analytics.<br><br>Let's get started!"
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
            icon: Icons.play
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
  function bootstrap() {
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    if (win.__igAnalyzerRunning || document.getElementById("ig-analyzer-panel")) {
      console.warn("[IG Analyzer] Execution halted: Instance already active on this page.");
      return;
    }
    win.__igAnalyzerRunning = true;
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
  }
  bootstrap();

})();