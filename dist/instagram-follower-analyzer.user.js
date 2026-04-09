// ==UserScript==
// @name         Instagram Follower Analyzer
// @namespace    https://github.com/UNKchr/ig-analyzer
// @version      3.4.4
// @author       UNKchr
// @description  Analyze Instagram followers and following lists with Anti-Ban retry logic, Progress Bar, CSV Export, and Advanced Metrics.
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @downloadURL  https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @updateURL    https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @match        https://www.instagram.com/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@df759188874072c079c718c0f2cfdf4e5fa51246/tamperguide/tamperGuide.js
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  const d=new Set;const importCSS = async e=>{d.has(e)||(d.add(e),(t=>{typeof GM_addStyle=="function"?GM_addStyle(t):(document.head||document.documentElement).appendChild(document.createElement("style")).append(t);})(e));};

  const CONFIG = {
    STORAGE_KEY: "ig_snapshot_v2",
    POSITION_KEY: "ig_panel_position_v2",
    WHITELIST_KEY: "ig_whitelist_v2",
    HISTORY_KEY: "ig_history_v2",
    CHURN_KEY: "ig_churn_v3",
    DEACTIVATED_KEY: "ig_deactivated_v3",
    BLOCKED_KEY: "ig_blocked_v1",
    TOUR_KEY: "ig_tour_completed_v1",
    RENAMED_KEY: "ig_renamed_v1",
    FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
    FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
    PAGE_SIZE: 50,
    BASE_RATE_LIMIT_MS: 1500,
    MAX_RETRIES: 4,
    DEBUG: false,
    MIN_VISIBLE_PX: 50,
    DEFAULT_POSITION: { top: 80, right: 20 }
  };
  const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => ( new Date()).toISOString(),
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),
    getUserId: () => {
      const c = document.cookie.split("; ").find((x) => x.startsWith("ds_user_id="));
      return c ? c.split("=")[1] : null;
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
          return { id: u.id ? String(u.id) : null, username: String(u.username) };
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
      const bIds = new Set((b || []).map((x) => x?.id).filter(Boolean));
      return (a || []).filter((x) => x?.id && bIds.has(x.id));
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
      const csvContent = "Username,Profile URL\n" + data.map((u) => u.username + "," + u.url).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  const Storage = {
    load: () => {
      try {
        const snap = GM_getValue(CONFIG.STORAGE_KEY, null);
        return snap && Array.isArray(snap.followers) ? snap : null;
      } catch (e) {
        Utils.logError("Error loading snapshot", e);
        return null;
      }
    },
    save: (data) => GM_setValue(CONFIG.STORAGE_KEY, data),
    getWhitelist: () => GM_getValue(CONFIG.WHITELIST_KEY, []),
    addToWhitelist: (username) => {
      const wl = Storage.getWhitelist();
      if (!wl.includes(username)) {
        wl.push(username);
        GM_setValue(CONFIG.WHITELIST_KEY, wl);
      }
    },
    getHistory: () => GM_getValue(CONFIG.HISTORY_KEY, []),
    addHistoryEntry: (followersCount, followingCount) => {
      const hist = Storage.getHistory();
      const dateStr = Utils.now().split("T")[0];
      const existingIdx = hist.findIndex((h) => h.date === dateStr);
      if (existingIdx > -1) {
        hist[existingIdx] = { date: dateStr, followers: followersCount, following: followingCount };
      } else {
        hist.push({ date: dateStr, followers: followersCount, following: followingCount });
      }
      GM_setValue(CONFIG.HISTORY_KEY, hist);
    },
    getNominalList: (key) => GM_getValue(key, []),
    addNominalEntries: (key, usernames) => {
      if (!usernames || usernames.length === 0) return;
      const list = Storage.getNominalList(key);
      const dateStr = Utils.now().split("T")[0];
      usernames.forEach((u) => {
        if (!list.find((x) => x.username === u)) {
          list.push({ username: u, date: dateStr });
        }
      });
      GM_setValue(key, list);
    },
    addRenamedEntries: (entries) => {
      if (!Array.isArray(entries) || entries.length === 0) return;
      const list = Storage.getNominalList(CONFIG.RENAMED_KEY);
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
      GM_setValue(CONFIG.RENAMED_KEY, list);
    },
    resetAll: () => {
      GM_deleteValue(CONFIG.STORAGE_KEY);
      GM_deleteValue(CONFIG.WHITELIST_KEY);
      GM_deleteValue(CONFIG.HISTORY_KEY);
      GM_deleteValue(CONFIG.CHURN_KEY);
      GM_deleteValue(CONFIG.DEACTIVATED_KEY);
      GM_deleteValue(CONFIG.BLOCKED_KEY);
      GM_deleteValue(CONFIG.RENAMED_KEY);
    }
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
    mailbox: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6H17.2C18.8802 6 19.7202 6 20.362 6.32698C20.9265 6.6146 21.3854 7.07354 21.673 7.63803C22 8.27976 22 9.11984 22 10.8V18H11M7 6C9.20914 6 11 7.79086 11 10V18M7 6C4.79086 6 3 7.79086 3 10V18H11M17 3H14V12M10 18V21H14V18M7 12H7.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    metrics: '<svg fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" xml:space="preserve"><g><path d="M72,22H28c-3.3,0-6,2.7-6,6v44c0,3.3,2.7,6,6,6h44c3.3,0,6-2.7,6-6V28C78,24.7,75.3,22,72,22z M38,66 c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V55c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M48,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V40 c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M58,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V34c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z M68,66c0,1.1-0.9,2-2,2h-2c-1.1,0-2-0.9-2-2V47c0-1.1,0.9-2,2-2h2c1.1,0,2,0.9,2,2V66z"></path></g></svg>'
  };
  const mainCss = ':root{--ig-panel-bg: rgba(15, 15, 20, .92);--ig-panel-border: rgba(255, 255, 255, .08);--ig-text-main: #e5e7eb;--ig-text-muted: #6b7280;--ig-text-bright: #f9fafb;--ig-bg-input: rgba(255, 255, 255, .04);--ig-bg-hover: rgba(255, 255, 255, .08);--ig-bg-active: rgba(255, 255, 255, .12);--ig-scrollbar-thumb: rgba(255, 255, 255, .12);--ig-scrollbar-thumb-hover: rgba(255, 255, 255, .2);--ig-shadow: 0 25px 60px -12px rgba(0, 0, 0, .5);--ig-shadow-sm: 0 1px 3px rgba(0, 0, 0, .3);--ig-accent: #3b82f6;--ig-accent-hover: #2563eb;--ig-accent-soft: rgba(59, 130, 246, .12);--ig-success: #22c55e;--ig-success-hover: #16a34a;--ig-danger: #ef4444;--ig-danger-hover: #dc2626;--ig-warning: #f59e0b;--ig-btn-bg: rgba(255, 255, 255, .06);--ig-btn-border: rgba(255, 255, 255, .1);--ig-btn-text: #d1d5db;--ig-btn-disabled-bg: rgba(255, 255, 255, .04);--ig-btn-disabled-border: rgba(255, 255, 255, .06);--ig-btn-disabled-text: rgba(255, 255, 255, .3);--ig-radius-sm: 6px;--ig-radius-md: 10px;--ig-radius-lg: 16px;--ig-radius-full: 999px}.ig-light-theme{--ig-panel-bg: rgba(255, 255, 255, .92);--ig-panel-border: rgba(0, 0, 0, .08);--ig-text-main: #374151;--ig-text-muted: #9ca3af;--ig-text-bright: #111827;--ig-bg-input: rgba(0, 0, 0, .03);--ig-bg-hover: rgba(0, 0, 0, .05);--ig-bg-active: rgba(0, 0, 0, .08);--ig-scrollbar-thumb: rgba(0, 0, 0, .12);--ig-scrollbar-thumb-hover: rgba(0, 0, 0, .2);--ig-shadow: 0 25px 60px -12px rgba(0, 0, 0, .15);--ig-shadow-sm: 0 1px 3px rgba(0, 0, 0, .08);--ig-accent-soft: rgba(59, 130, 246, .08);--ig-btn-bg: rgba(0, 0, 0, .04);--ig-btn-border: rgba(0, 0, 0, .1);--ig-btn-text: #4b5563;--ig-btn-disabled-bg: rgba(0, 0, 0, .04);--ig-btn-disabled-border: rgba(0, 0, 0, .08);--ig-btn-disabled-text: rgba(0, 0, 0, .35)}#ig-analyzer-panel{position:fixed;top:80px;right:20px;width:400px;height:510px;max-height:calc(100vh - 100px);background:var(--ig-panel-bg);border:1px solid var(--ig-panel-border);color:var(--ig-text-main);box-shadow:var(--ig-shadow);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,sans-serif;font-size:13px;padding:20px;z-index:999999;border-radius:var(--ig-radius-lg);display:flex;flex-direction:column;resize:both;overflow:hidden;transition:background .3s ease,border-color .3s ease,box-shadow .3s ease}#ig-analyzer-panel *{box-sizing:border-box}#ig-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--ig-panel-border);cursor:move;-webkit-user-select:none;user-select:none}.ig-header-left{display:flex;align-items:center;gap:10px}.ig-logo{display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:var(--ig-accent-soft);border-radius:var(--ig-radius-md);color:var(--ig-accent)}.ig-title{font-size:15px;font-weight:700;color:var(--ig-text-bright);letter-spacing:-.3px}.ig-header-right{display:flex;align-items:center}#ig-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:500;background:var(--ig-bg-input);padding:5px 12px;border-radius:var(--ig-radius-full);color:var(--ig-text-muted);border:1px solid var(--ig-panel-border);transition:all .2s ease}.ig-status-dot{width:6px;height:6px;border-radius:50%;background:var(--ig-text-muted);display:inline-block;flex-shrink:0;animation:ig-pulse 2s ease-in-out infinite}@keyframes ig-pulse{0%,to{opacity:1}50%{opacity:.4}}.ig-actions-bar{display:flex;gap:8px;margin-bottom:14px}.ig-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 14px;border-radius:var(--ig-radius-sm);font-size:12px;font-weight:600;cursor:pointer;background:var(--ig-btn-bg);color:var(--ig-btn-text);border:1px solid var(--ig-btn-border);transition:all .2s cubic-bezier(.4,0,.2,1);flex:1;white-space:nowrap;line-height:1}.ig-btn-icon{display:inline-flex;align-items:center;opacity:.9}.ig-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--ig-shadow-sm)}.ig-btn:active:not(:disabled){transform:translateY(0)}.ig-btn.ig-btn-primary{background:var(--ig-accent);border-color:var(--ig-accent);color:#fff}.ig-btn.ig-btn-primary:hover:not(:disabled){background:var(--ig-accent-hover);border-color:var(--ig-accent-hover);color:#fff}#ig-export-csv:not(:disabled){background:#22c55e!important;border-color:#22c55e!important;color:#fff!important}#ig-export-csv:not(:disabled):hover{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important}#ig-export-csv:disabled{background:var(--ig-btn-disabled-bg)!important;border-color:var(--ig-btn-disabled-border)!important;color:var(--ig-btn-disabled-text)!important;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}#ig-export-csv:disabled .ig-btn-icon{opacity:.4}.ig-btn.ig-btn-danger{background:transparent;border-color:var(--ig-danger);color:var(--ig-danger)}.ig-btn.ig-btn-danger:hover:not(:disabled){background:var(--ig-danger);border-color:var(--ig-danger);color:#fff}.ig-btn.ig-btn-primary:disabled,.ig-btn.ig-btn-danger:disabled{background:var(--ig-btn-disabled-bg);border-color:var(--ig-btn-disabled-border);color:var(--ig-btn-disabled-text);cursor:not-allowed;transform:none;box-shadow:none}.ig-btn:disabled .ig-btn-icon{opacity:.4}#ig-progress-container{width:100%;background:var(--ig-bg-input);border-radius:var(--ig-radius-full);height:4px;margin-bottom:14px;overflow:hidden;display:none;border:none}#ig-progress-bar{width:0%;background:linear-gradient(90deg,var(--ig-accent),#8b5cf6);height:100%;border-radius:var(--ig-radius-full);transition:width .4s cubic-bezier(.4,0,.2,1);position:relative}#ig-progress-bar:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);animation:ig-shimmer 1.5s infinite}@keyframes ig-shimmer{0%{transform:translate(-100%)}to{transform:translate(100%)}}.ig-tabs-container{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:0;padding:4px;background:var(--ig-bg-input);border-radius:var(--ig-radius-md)}.ig-tab-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;padding:7px 10px!important;flex:auto!important;background:transparent!important;border:1px solid transparent!important;color:var(--ig-text-muted)!important;font-size:11px!important;font-weight:500!important;border-radius:var(--ig-radius-sm)!important;cursor:pointer!important;transition:all .2s ease!important;white-space:nowrap!important;line-height:1!important}.ig-tab-icon{display:inline-flex;align-items:center;flex-shrink:0}.ig-tab-label{pointer-events:none}.ig-tab-btn:hover{color:var(--ig-text-main)!important;background:var(--ig-bg-hover)!important}.ig-tab-btn.active{background:var(--ig-bg-active)!important;color:var(--ig-text-bright)!important;font-weight:600!important;box-shadow:var(--ig-shadow-sm)!important}.ig-view{display:none}.ig-view.active{display:block}.ig-view-container{flex-grow:1;overflow-y:auto;background:var(--ig-bg-input);border:1px solid var(--ig-panel-border);border-radius:var(--ig-radius-md);padding:14px;font-size:12px;color:var(--ig-text-main);margin-top:8px}.ig-view-container::-webkit-scrollbar{width:5px}.ig-view-container::-webkit-scrollbar-track{background:transparent}.ig-view-container::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:10px}.ig-view-container::-webkit-scrollbar-thumb:hover{background:var(--ig-scrollbar-thumb-hover)}#ig-log{font-family:SF Mono,Cascadia Code,Fira Code,ui-monospace,monospace;font-size:11px;line-height:1.6}.ig-log-entry{padding:3px 0;color:var(--ig-text-main);border-bottom:1px solid var(--ig-panel-border);transition:background .15s ease}.ig-log-entry:last-child{border-bottom:none}.ig-log-entry:hover{background:var(--ig-bg-hover);border-radius:4px;padding-left:6px}.ig-log-time{color:var(--ig-accent);font-weight:500}.ig-section-title{display:flex;align-items:center;font-weight:700;font-size:13px;margin-bottom:12px;color:var(--ig-text-bright);letter-spacing:-.2px}.ig-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;background:var(--ig-accent-soft);color:var(--ig-accent);padding:0 7px;border-radius:var(--ig-radius-full);font-size:11px;font-weight:700;margin-left:8px;border:none}.ig-empty-msg{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ig-text-muted);font-size:12px;padding:32px 16px;text-align:center}.ig-empty-icon{display:flex;align-items:center;justify-content:center;width:40px;height:40px;color:var(--ig-text-muted);opacity:.5}.ig-empty-icon svg{width:100%;height:100%}.ig-user-row{display:flex;justify-content:space-between;align-items:center;padding:10px 8px;border-bottom:1px solid var(--ig-panel-border);border-radius:var(--ig-radius-sm);transition:all .3s cubic-bezier(.4,0,.2,1)}.ig-user-row:last-child{border-bottom:none}.ig-user-row:hover{background:var(--ig-bg-hover)}.ig-user-info{display:flex;align-items:center;gap:10px;min-width:0}.ig-user-avatar{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--ig-accent-soft);color:var(--ig-accent);font-size:11px;font-weight:700;flex-shrink:0}.ig-username{color:var(--ig-text-bright);font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-user-actions{display:flex;align-items:center;gap:6px;flex-shrink:0}.ig-view-link{display:inline-flex;align-items:center;color:var(--ig-accent);text-decoration:none;font-weight:500;font-size:12px;padding:4px 8px;border-radius:var(--ig-radius-sm);transition:all .15s ease}.ig-view-link:hover{background:var(--ig-accent-soft);text-decoration:none}.btn-whitelist{background:var(--ig-btn-bg)!important;border:1px solid var(--ig-btn-border)!important;color:var(--ig-text-muted)!important;padding:4px 10px!important;font-size:10px!important;font-weight:500!important;margin-right:0!important;flex:none!important;border-radius:var(--ig-radius-sm)!important;cursor:pointer}.btn-whitelist:hover{background:var(--ig-bg-hover)!important;border-color:var(--ig-text-muted)!important;color:var(--ig-text-main)!important}.ig-table{width:100%;text-align:left;border-collapse:separate;border-spacing:0;margin-top:4px;font-size:12px}.ig-table thead th{color:var(--ig-text-muted);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:8px 8px 10px;border-bottom:1px solid var(--ig-panel-border);position:sticky;top:0;background:var(--ig-bg-input)}.ig-table td{padding:10px 8px;border-bottom:1px solid var(--ig-panel-border);color:var(--ig-text-main)}.ig-table tbody tr{transition:background .15s ease}.ig-table tbody tr:hover{background:var(--ig-bg-hover)}.ig-table tbody tr:last-child td{border-bottom:none}.ig-table-user{font-weight:500;color:var(--ig-text-bright)}.ig-table-date{color:var(--ig-text-muted);font-size:11px;font-variant-numeric:tabular-nums}.ig-table-link{display:inline-flex;align-items:center;color:var(--ig-accent);text-decoration:none;font-weight:500;font-size:11px}.ig-table-link:hover{text-decoration:underline}.ig-metric-value{display:inline-flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums;font-weight:500}.ig-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#0009;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483647;display:none;justify-content:center;align-items:center;animation:ig-fade-in .2s ease}@keyframes ig-fade-in{0%{opacity:0}to{opacity:1}}.ig-modal-content{background:#1a1a2e;border:1px solid rgba(255,255,255,.08);padding:32px 28px;border-radius:var(--ig-radius-lg);width:380px;max-width:90vw;text-align:center;color:#f3f4f6;box-shadow:0 25px 50px -12px #0009;display:flex;flex-direction:column;align-items:center;animation:ig-modal-slide-in .3s cubic-bezier(.4,0,.2,1)}@keyframes ig-modal-slide-in{0%{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}.ig-modal-icon{width:56px;height:56px;color:var(--ig-warning);margin-bottom:20px;padding:12px;background:#f59e0b1a;border-radius:50%}.ig-modal-icon svg{width:100%;height:100%}.ig-modal-title{font-size:18px;font-weight:700;margin-bottom:10px;color:#fff;letter-spacing:-.3px}.ig-modal-text{font-size:14px;line-height:1.6;color:#9ca3af;margin-bottom:28px}.ig-modal-actions{display:flex;gap:10px;width:100%}.ig-btn-cancel-modal,.ig-btn-confirm-modal{flex:1;padding:11px 16px;border-radius:var(--ig-radius-sm);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1)}.ig-btn-cancel-modal{background:transparent;border:1px solid rgba(255,255,255,.1);color:#9ca3af}.ig-btn-cancel-modal:hover{background:#ffffff0f;border-color:#fff3;color:#fff}.ig-btn-confirm-modal{background:var(--ig-accent);border:1px solid var(--ig-accent);color:#fff}.ig-btn-confirm-modal:hover{background:var(--ig-accent-hover);border-color:var(--ig-accent-hover);transform:translateY(-1px)}';
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
        "  </div>",
        "</div>",
        '<div class="ig-actions-bar">',
        '  <button id="ig-run" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.play + "</span>Run Analysis</button>",
        '  <button id="ig-export-csv" class="ig-btn ig-btn-success" disabled><span class="ig-btn-icon">' + Icons.download + "</span>Export CSV</button>",
        '  <button id="ig-reset" class="ig-btn ig-btn-danger"><span class="ig-btn-icon">' + Icons.trash + "</span>Reset</button>",
        "</div>",
        '<div id="ig-progress-container"><div id="ig-progress-bar"></div></div>',
        '<div class="ig-tabs-container" id="ig-tabs">',
        '  <button class="ig-tab-btn active" data-target="ig-log"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-history"><span class="ig-tab-icon">' + Icons.history + '</span><span class="ig-tab-label">History</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-notfollowing"><span class="ig-tab-icon">' + Icons.notFollowing + '</span><span class="ig-tab-label">Not Following</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-fans"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Fans</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-unfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Unfollowers</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-deactivated"><span class="ig-tab-icon">' + Icons.deactivated + '</span><span class="ig-tab-label">Deactivated</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-blocked"><span class="ig-tab-icon">' + Icons.blocked + '</span><span class="ig-tab-label">Blocked</span></button>',
        '  <button class="ig-tab-btn" data-target="ig-view-renamed"><span class="ig-tab-icon">' + Icons.renamed + '</span><span class="ig-tab-label">Renamed</span></button>',
        "</div>",
        '<div id="ig-log" class="ig-view-container ig-view active"></div>',
        '<div id="ig-view-history" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-notfollowing" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-fans" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-mutuals" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-unfollowers" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-deactivated" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-blocked" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-renamed" class="ig-view-container ig-view"></div>'
      ].join("\n");
      document.body.appendChild(panel);
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
      UI.setupDrag(panel, panel.querySelector("#ig-header"));
      UI.loadPosition(panel);
      UI.setupTabs();
      UI.setupThemeObserver();
      UI.renderHistory(Storage.getHistory());
      UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
      UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
      UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
      UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
    },
    setupThemeObserver: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      const checkTheme = () => {
        const bgColor = window.getComputedStyle(document.body).backgroundColor;
        if (bgColor === "rgb(255, 255, 255)" || bgColor === "#ffffff" || bgColor === "white") {
          panel.classList.add("ig-light-theme");
        } else {
          panel.classList.remove("ig-light-theme");
        }
      };
      checkTheme();
      const observer = new MutationObserver(() => checkTheme());
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
      observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    },
    confirmAction: (title, message, confirmBtnText = "Yes, Continue") => {
      return new Promise((resolve) => {
        const modal = document.getElementById("ig-safety-modal");
        const titleEl = document.getElementById("ig-modal-title-text");
        const bodyEl = document.getElementById("ig-modal-body-text");
        const btnYes = document.getElementById("ig-modal-confirm");
        const btnNo = document.getElementById("ig-modal-cancel");
        if (!modal) return resolve(true);
        titleEl.textContent = title;
        bodyEl.innerHTML = message;
        btnYes.textContent = confirmBtnText;
        modal.style.display = "flex";
        const closeAndResolve = (value) => {
          modal.style.display = "none";
          btnYes.onclick = null;
          btnNo.onclick = null;
          resolve(value);
        };
        btnYes.onclick = () => closeAndResolve(true);
        btnNo.onclick = () => closeAndResolve(false);
      });
    },
    setupTabs: () => {
      const btns = document.querySelectorAll(".ig-tab-btn");
      btns.forEach((btn) => {
        btn.onclick = (e) => {
          const target = e.target.closest(".ig-tab-btn");
          if (!target) return;
          document.querySelectorAll(".ig-tab-btn").forEach((b) => b.classList.remove("active"));
          document.querySelectorAll(".ig-view").forEach((v) => v.classList.remove("active"));
          target.classList.add("active");
          const targetId = target.getAttribute("data-target");
          document.getElementById(targetId).classList.add("active");
        };
      });
    },
    setStatus: (text) => {
      const el = document.getElementById("ig-status");
      if (el) {
        const dot = el.querySelector(".ig-status-dot");
        const dotHTML = dot ? dot.outerHTML : '<span class="ig-status-dot"></span>';
        el.innerHTML = dotHTML + text;
      }
    },
    log: (msg) => {
      const box = document.getElementById("ig-log");
      if (box) {
        const timeStr = Utils.now().split("T")[1].split(".")[0];
        const entry = document.createElement("div");
        entry.className = "ig-log-entry";
        entry.innerHTML = '<span class="ig-log-time">[' + timeStr + "]</span> " + msg;
        box.appendChild(entry);
        box.scrollTop = box.scrollHeight;
      }
      Utils.log(msg);
    },
    setProgress: (current, total, label) => {
      const container = document.getElementById("ig-progress-container");
      const bar = document.getElementById("ig-progress-bar");
      if (!container || !bar) return;
      container.style.display = "block";
      const percent = total > 0 ? Math.min(Math.round(current / total * 100), 100) : 100;
      bar.style.width = percent + "%";
      UI.setStatus(label + " " + percent + "%");
    },
    hideProgress: () => {
      const el = document.getElementById("ig-progress-container");
      if (el) el.style.display = "none";
    },
    renderResults: (users, title, containerId, isExportable = false) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      let html = '<div class="ig-section-title">' + title + ' <span class="ig-badge">' + users.length + "</span></div>";
      if (users.length === 0) html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No data available yet.</div>";
      users.forEach((u, index) => {
        const uniqueId = containerId + "-row-" + index;
        html += '<div class="ig-user-row" id="' + uniqueId + '">';
        html += '<div class="ig-user-info"><span class="ig-user-avatar">' + u.username.charAt(0).toUpperCase() + '</span><span class="ig-username">' + u.username + "</span></div>";
        html += '<div class="ig-user-actions">';
        if (containerId === "ig-view-notfollowing") {
          html += '<button class="btn-whitelist" data-user="' + u.username + '" data-idx="' + uniqueId + '">Ignore</button>';
        }
        html += '<a href="' + u.url + '" target="_blank" class="ig-view-link">View ' + Icons.link + "</a>";
        html += "</div></div>";
      });
      container.innerHTML = html;
      if (containerId === "ig-view-notfollowing") {
        const whitelistBtns = container.querySelectorAll(".btn-whitelist");
        whitelistBtns.forEach((btn) => {
          btn.onclick = (e) => {
            const targetUser = e.target.getAttribute("data-user");
            const rowId = e.target.getAttribute("data-idx");
            Storage.addToWhitelist(targetUser);
            const row = document.getElementById(rowId);
            if (row) {
              row.style.opacity = "0";
              row.style.transform = "translateX(20px)";
              setTimeout(() => row.style.display = "none", 300);
            }
            UI.log("[INFO] " + targetUser + " added to whitelist.");
            if (window.__igLastResults) {
              window.__igLastResults = window.__igLastResults.filter((u) => u.username !== targetUser);
              if (isExportable) {
                const exportBtn = document.getElementById("ig-export-csv");
                if (exportBtn) exportBtn.disabled = window.__igLastResults.length === 0;
              }
            }
          };
        });
      }
      if (isExportable) {
        const exportBtn = document.getElementById("ig-export-csv");
        if (exportBtn) exportBtn.disabled = users.length === 0;
      }
    },
    renderNominalList: (list, containerId, title) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      let html = '<div class="ig-section-title">' + title + ' <span class="ig-badge">' + list.length + "</span></div>";
      if (!list || list.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No historical records yet.</div>";
      } else {
        html += '<table class="ig-table"><thead><tr><th>Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
        list.slice().reverse().forEach((item) => {
          html += "<tr><td><span class='ig-table-user'>" + item.username + "</span></td><td><span class='ig-table-date'>" + item.date + '</span></td><td><a href="https://www.instagram.com/' + item.username + '/" target="_blank" class="ig-table-link">View ' + Icons.link + "</a></td></tr>";
        });
        html += "</tbody></table>";
      }
      container.innerHTML = html;
    },
renderRenamedList: (list, containerId, title) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const safeList = Array.isArray(list) ? list : [];
      let html = '<div class="ig-section-title">' + title + ' <span class="ig-badge">' + safeList.length + "</span></div>";
      if (safeList.length === 0) {
        html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + "</span>No username changes detected yet.</div>";
      } else {
        html += '<table class="ig-table"><thead><tr><th>Previous Username</th><th>Current Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
        safeList.slice().reverse().forEach((item) => {
          const oldUsername = item.oldUsername || "-";
          const newUsername = item.newUsername || item.username || "-";
          const detectedDate = item.date || "-";
          const profileUrl = newUsername !== "-" ? "https://www.instagram.com/" + newUsername + "/" : "#";
          html += "<tr>";
          html += "<td><span class='ig-table-user'>" + oldUsername + "</span></td>";
          html += "<td><span class='ig-table-user'>" + newUsername + "</span></td>";
          html += "<td><span class='ig-table-date'>" + detectedDate + "</span></td>";
          html += '<td><a href="' + profileUrl + '" target="_blank" class="ig-table-link">View ' + Icons.link + "</a></td>";
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
      } else {
        html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th></tr></thead><tbody>';
        const reversedHistory = historyData.slice().reverse();
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
          html += "<tr><td><span class='ig-table-date'>" + h.date + "</span></td><td><span class='ig-metric-value'>" + h.followers + " " + followerIcon + "</span></td><td><span class='ig-metric-value'>" + h.following + " " + followingIcon + "</span></td></tr>";
        });
        html += "</tbody></table>";
      }
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
        isDragging = true;
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
        GM_setValue(CONFIG.POSITION_KEY, { x: raw.x, y: raw.y });
      });
      document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
      });
      window.addEventListener("resize", () => {
        const clamped = UI.clampPosition(panel, panel.offsetLeft, panel.offsetTop);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
        GM_setValue(CONFIG.POSITION_KEY, { x: clamped.x, y: clamped.y });
      });
    },
    loadPosition: (panel) => {
      const pos = GM_getValue(CONFIG.POSITION_KEY, null);
      if (pos && typeof pos.x === "number") {
        const clamped = UI.clampPosition(panel, pos.x, pos.y);
        panel.style.left = clamped.x + "px";
        panel.style.top = clamped.y + "px";
        panel.style.right = "auto";
      }
    },
resetPosition: () => {
      const panel = document.getElementById("ig-analyzer-panel");
      if (!panel) return;
      panel.style.left = "auto";
      panel.style.top = CONFIG.DEFAULT_POSITION.top + "px";
      panel.style.right = CONFIG.DEFAULT_POSITION.right + "px";
      GM_deleteValue(CONFIG.POSITION_KEY);
    },
    togglePanel: () => {
      const p = document.getElementById("ig-analyzer-panel");
      if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
    }
  };
  const API = {
    fetchWithRetry: async (url, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, { credentials: "include" });
          if (res.ok) return await res.json();
          if (res.status === 429) {
            UI.log("Request limit (429). Retrying in " + backoff / 1e3 + "s... (Attempt " + (i + 1) + "/" + retries + ")");
            await Utils.sleep(backoff);
            backoff *= 2;
          } else {
            throw new Error("HTTP " + res.status + " while requesting " + url);
          }
        } catch (e) {
          if (i === retries - 1) throw e;
        }
      }
      throw new Error("Maximum retries achieved.");
    },
    getAllUsers: async (userId, hash, label) => {
      const users = [];
      let cursor = null;
      let hasNext = true;
      let totalCount = 0;
      while (hasNext) {
        const vars = encodeURIComponent(JSON.stringify({ id: userId, first: CONFIG.PAGE_SIZE, after: cursor }));
        const url = "https://www.instagram.com/graphql/query/?query_hash=" + hash + "&variables=" + vars;
        const json = await API.fetchWithRetry(url);
        const userNode = json?.data?.user;
        const edge = userNode?.edge_follow || userNode?.edge_followed_by;
        if (!edge || !Array.isArray(edge.edges)) throw new Error("Unexpected GraphQL structure while extracting " + label + ". The API shape may have changed.");
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
        UI.setProgress(users.length, totalCount, "Extracting " + label + "...");
        if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500);
      }
      const withIdCount = users.filter((u) => !!u.id).length;
      UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");
      return users;
    },
    checkAccountStatus: async (username) => {
      try {
        const authRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
          headers: { "X-IG-App-ID": "936619743392459" },
          credentials: "include"
        });
        let authData = null;
        if (authRes.ok) {
          const json = await authRes.json();
          authData = json?.data?.user;
        }
        if (authData) {
          return "Active";
        }
        const anonRes = await fetch(`https://www.instagram.com/${username}/`, { credentials: "omit" });
        const anonText = await anonRes.text();
        const loginRedirectPath = `login/?next=%2F${username}%2F`;
        const existsPublicly = anonText.includes(loginRedirectPath) || anonText.includes(`"username":"${username}"`);
        const isErrorPage = anonText.includes("page_not_found") || anonText.includes("Sorry, this page isn't available.") || anonText.includes("Esta página no está disponible.");
        if (existsPublicly && !isErrorPage) {
          return "Blocked";
        } else {
          return "Deactivated";
        }
      } catch (e) {
        console.error(`Error verifying account status for "${username}". Defaulting to Active.`, e);
        return "Active";
      }
    }
  };
  const App = {
    run: async () => {
      const btnRun = document.getElementById("ig-run");
      if (btnRun) btnRun.disabled = true;
      const userConfirmed = await UI.confirmAction(
        "Safety Precaution",
        "Excessive use of automation tools may result in temporary account restrictions.<br><br>It is recommended to run this analysis <b>only once per hour</b>.",
        "Yes, Continue"
      );
      if (!userConfirmed) {
        UI.log("Analysis cancelled by user.");
        console.log("Analysis cancelled by user.");
        if (btnRun) btnRun.disabled = false;
        return;
      }
      UI.setStatus("Analyzing...");
      UI.log("Starting deep analysis...");
      const logTab = document.querySelector('[data-target="ig-log"]');
      if (logTab) logTab.click();
      try {
        const userId = Utils.getUserId();
        if (!userId) throw new Error("User ID could not be obtained. Are you logged in?");
        UI.log("Fetching 'Following'...");
        const followingDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following");
        UI.log("Fetching 'Followers'...");
        const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers");
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
        const mapToDetailed = (arr) => arr.map((u) => ({ username: u, url: "https://www.instagram.com/" + u + "/" }));
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
          const accountsToVerify = Utils.unique([...filteredLostFollowers, ...filteredMissingUsers]);
          if (accountsToVerify.length > 0) {
            UI.setStatus("Verifying lost accounts...");
            for (const username of accountsToVerify) {
              const status = await API.checkAccountStatus(username);
              if (status === "Deactivated") {
                newDeactivated.push(username);
              } else if (status === "Blocked") {
                newBlocked.push(username);
              } else if (status === "Active") {
                if (filteredLostFollowers.includes(username)) {
                  newUnfollowers.push(username);
                }
              } else {
                Utils.logError(
                  `Unexpected status "${status}" from checkAccountStatus for user "${username}"`,
                  null
                );
              }
            }
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
        } else {
          UI.log("First run: Initial state established.");
        }
        Storage.save({
          version: 4,
          lastRun: Utils.now(),
          followers,
          following,
          followersDetailed,
          followingDetailed
        });
        UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
        UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
        UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes");
        window.__igLastResults = notFollowingBackDetailed;
        UI.setStatus("Completed");
        UI.log("[OK] Analysis completed successfully.");
      } catch (e) {
        UI.setStatus("Error");
        UI.hideProgress();
        Utils.logError("Failed analysis", e);
      } finally {
        if (btnRun) btnRun.disabled = false;
      }
    },
    bindEvents: () => {
      const btnRun = document.getElementById("ig-run");
      if (btnRun) btnRun.onclick = App.run;
      const btnExport = document.getElementById("ig-export-csv");
      if (btnExport) btnExport.onclick = () => {
        if (window.__igLastResults) {
          const dateStr = Utils.now().split("T")[0];
          Utils.exportCSV(window.__igLastResults, "ig_no_follow_back_" + dateStr + ".csv");
          UI.log("CSV Exported.");
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
            UI.log("[INFO] Data reset.");
            document.querySelectorAll(".ig-view-container").forEach((el) => {
              if (el.id !== "ig-log") el.innerHTML = "";
            });
            if (btnExport) btnExport.disabled = true;
          }
        };
      }
      document.addEventListener("keydown", (e) => {
        const tag = document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;
        if (e.key === "F9") UI.togglePanel();
        if (e.key === "F8") UI.resetPosition();
      });
    }
  };
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
  function buildSteps() {
    return [
      {
        popover: {
          title: "Welcome to IG Analyzer!",
          description: "This quick tour will walk you through all the features of the panel. It only takes a moment — let's get started!"
        }
      },
      {
        element: "#ig-header",
        popover: {
          title: "Draggable Header",
          description: "Grab this area to drag the panel anywhere on screen. Your position is saved automatically between sessions.",
          side: "bottom",
          align: "center"
        }
      },
      {
        element: "#ig-status",
        popover: {
          title: "Status Indicator",
          description: "Shows the current state of the analyzer: <b>Inactive</b>, <b>Analyzing...</b>, <b>Completed</b>, or <b>Error</b>.",
          side: "bottom",
          align: "end"
        }
      },
      {
        element: "#ig-run",
        popover: {
          title: "Run Analysis",
          description: "Click here to start scanning your followers and following lists. The process uses Instagram's API with built-in rate limiting to keep your account safe.<br><br><b>Tip:</b> Run it only once per hour to avoid restrictions.",
          side: "bottom",
          align: "start"
        }
      },
      {
        element: "#ig-export-csv",
        popover: {
          title: "Export CSV",
          description: "After an analysis completes, this button lets you download a <b>.csv</b> file with all users who don't follow you back. Ready for Excel or Google Sheets.",
          side: "bottom",
          align: "center"
        }
      },
      {
        element: "#ig-reset",
        popover: {
          title: "Reset Data",
          description: "Wipes all local data: history, snapshots, whitelists, and logs. A confirmation dialog will appear before anything is deleted.",
          side: "bottom",
          align: "end"
        }
      },
      {
        element: "#ig-tabs",
        popover: {
          title: "Navigation Tabs",
          description: "Switch between different views using these tabs:<br>• <b>Logs</b> — Real-time execution log<br>• <b>History</b> — Follower/following trends over time<br>• <b>Not Following</b> — Users who don't follow you back<br>• <b>Fans</b> — Users who follow you but you don't follow<br>• <b>Mutuals</b> — Users you both follow each other<br>• <b>Unfollowers</b> — Users who recently unfollowed you<br>• <b>Deactivated</b> — Accounts that were deactivated or suspended<br>• <b>Blocked</b> — Accounts that have blocked you<br>• <b>Renamed</b> — Mutuals that changed their usernames",
          side: "bottom",
          align: "center"
        }
      },
      {
        element: "#ig-log",
        popover: {
          title: "Logs View",
          description: "All actions and API requests are logged here in real time. Useful for monitoring progress and debugging issues.",
          side: "top",
          align: "center"
        }
      },
      {
        popover: {
          title: "You're all set!",
          description: `That's everything you need to know. Press <b>F9</b> anytime to toggle the panel visibility.<br><br>Click <b>"Done"</b> to close this tour and start analyzing!`
        }
      }
    ];
  }
  function isTourCompleted() {
    return GM_getValue(TOUR_SEEN_KEY, false) === true;
  }
  function markTourCompleted() {
    GM_setValue(TOUR_SEEN_KEY, true);
  }
  function resetTour() {
    GM_deleteValue(TOUR_SEEN_KEY);
    console.log("[IG Analyzer] Tour reset. It will show on next page load.");
  }
  function startTour(options = {}) {
    const { force = false } = options;
    const tg = getTamperGuide();
    if (!tg) {
      console.warn(
        "[IG Analyzer] TamperGuide library not found in global scope. Make sure it is loaded via @require in the userscript header."
      );
      return null;
    }
    if (!document.getElementById("ig-analyzer-panel")) {
      console.warn("[IG Analyzer] Panel not found in DOM. Cannot start tour.");
      return null;
    }
    if (!force && isTourCompleted()) {
      return null;
    }
    const blockF9 = (e) => {
      if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("keydown", blockF9, true);
    const panel = document.getElementById("ig-analyzer-panel");
    if (panel) {
      panel.style.display = "flex";
    }
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
      smoothScroll: false,
popoverOffset: 12,
      steps: buildSteps(),
      onDestroyed: () => {
        document.removeEventListener("keydown", blockF9, true);
        markTourCompleted();
        console.log("[IG Analyzer] Tour completed and saved.");
      },
      onDestroyStarted: (element, step, opts) => {
        if (opts.driver.isLastStep()) return;
        const skip = confirm(
          "Skip the tour?\n\nYou can restart it anytime from the Tampermonkey menu."
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
  UI.init();
  App.bindEvents();
  setTimeout(() => {
    startTour();
  }, 800);
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Replay IG Analyzer Tour", () => {
      resetTour();
      startTour({ force: true });
    });
  }
  UI.log("IG Analyzer loaded. Press F9 to toggle panel, F8 to reset position.");

})();