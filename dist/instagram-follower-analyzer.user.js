// ==UserScript==
// @name         Instagram Follower Analyzer
// @namespace    https://github.com/UNKchr/ig-analyzer
// @version      3.1.0
// @author       UNKchr
// @description  Analyze Instagram followers and following lists with Anti-Ban retry logic, Progress Bar, CSV Export, and Advanced Metrics.
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @downloadURL  https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @updateURL    https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js
// @match        https://www.instagram.com/*
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
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
    FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
    FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
    PAGE_SIZE: 50,
    BASE_RATE_LIMIT_MS: 1500,
    MAX_RETRIES: 4,
    DEBUG: false
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
    resetAll: () => {
      GM_deleteValue(CONFIG.STORAGE_KEY);
      GM_deleteValue(CONFIG.WHITELIST_KEY);
      GM_deleteValue(CONFIG.HISTORY_KEY);
      GM_deleteValue(CONFIG.CHURN_KEY);
      GM_deleteValue(CONFIG.DEACTIVATED_KEY);
    }
  };
  const Icons = {
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    neutral: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M5 12h14"/></svg>',
    link: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 4px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>'
  };
  const mainCss = ":root{--ig-panel-bg: rgba(20, 20, 20, .95);--ig-panel-border: rgba(255, 255, 255, .2);--ig-text-main: #f3f4f6;--ig-text-muted: #9ca3af;--ig-bg-input: #111827;--ig-bg-hover: #4b5563;--ig-scrollbar-thumb: #4b5563;--ig-shadow: rgba(0,0,0,.6);--ig-btn-bg: #1f2937;--ig-btn-border: rgba(255, 255, 255, .2);--ig-btn-text: #f3f4f6}.ig-light-theme{--ig-panel-bg: rgba(255, 255, 255, .95);--ig-panel-border: #a3a3a3;--ig-text-main: #262626;--ig-text-muted: #525252;--ig-bg-input: #ffffff;--ig-bg-hover: #e5e5e5;--ig-scrollbar-thumb: #a3a3a3;--ig-shadow: rgba(0,0,0,.25);--ig-btn-bg: #f5f5f5;--ig-btn-border: #a3a3a3;--ig-btn-text: #262626}#ig-analyzer-panel{position:fixed;top:80px;right:20px;width:380px;height:560px;background:var(--ig-panel-bg);border:1px solid var(--ig-panel-border);color:var(--ig-text-main);box-shadow:0 10px 40px var(--ig-shadow);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);font-family:system-ui,-apple-system,sans-serif;font-size:13px;padding:16px;z-index:99999999;border-radius:12px;display:flex;flex-direction:column;resize:both;overflow:hidden;transition:background .2s ease,border-color .2s ease}#ig-analyzer-panel *{box-sizing:border-box}#ig-analyzer-panel button{background:var(--ig-btn-bg);color:var(--ig-btn-text);border:1px solid var(--ig-btn-border);border-radius:6px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s ease;flex:1}#ig-analyzer-panel button:hover{background:var(--ig-bg-hover);border-color:var(--ig-text-muted);transform:translateY(-1px)}#ig-analyzer-panel button:disabled{opacity:.5;cursor:not-allowed;transform:none}.btn-primary{background:#0095f6!important;border-color:#0095f6!important;color:#fff!important}.btn-primary:hover{background:#1877f2!important;border-color:#1877f2!important}.btn-success{background:#16a34a!important;border-color:#15803d!important;color:#fff!important}.btn-success:hover{background:#15803d!important}.btn-danger{background:#ed4956!important;border-color:#ed4956!important;color:#fff!important}.btn-danger:hover{background:#c63b46!important}.btn-whitelist{background:var(--ig-btn-bg)!important;border-color:var(--ig-btn-border)!important;color:var(--ig-text-main)!important;padding:4px 8px!important;font-size:10px!important;margin-right:8px;flex:none!important}.btn-whitelist:hover{background:var(--ig-bg-hover)!important;border-color:var(--ig-text-muted)!important}#ig-progress-container{width:100%;background:var(--ig-bg-input);border-radius:999px;height:6px;margin:12px 0;overflow:hidden;display:none;border:1px solid var(--ig-panel-border)}#ig-progress-bar{width:0%;background:#0095f6;height:100%;transition:width .3s ease}.ig-view-container{flex-grow:1;overflow-y:auto;background:var(--ig-bg-input);border:1px solid var(--ig-panel-border);border-radius:8px;padding:12px;font-size:12px;color:var(--ig-text-main);margin-top:8px}.ig-view-container::-webkit-scrollbar{width:6px}.ig-view-container::-webkit-scrollbar-track{background:transparent}.ig-view-container::-webkit-scrollbar-thumb{background:var(--ig-scrollbar-thumb);border-radius:10px}#ig-log{font-family:ui-monospace,monospace;font-size:11px;color:#0095f6;white-space:pre-wrap;word-wrap:break-word}.ig-view{display:none}.ig-view.active{display:block}.ig-user-row{padding:8px 0;border-bottom:1px solid var(--ig-panel-border);display:flex;justify-content:space-between;align-items:center}.ig-user-row:last-child{border-bottom:none}.ig-user-row span{color:var(--ig-text-main)}.ig-user-row a{color:#0095f6;text-decoration:none;font-weight:500;display:flex;align-items:center}.ig-user-row a:hover{text-decoration:underline}.ig-table{width:100%;text-align:left;border-collapse:collapse;margin-top:4px;font-size:11px}.ig-table th{color:var(--ig-text-muted);font-weight:600;padding-bottom:8px;border-bottom:1px solid var(--ig-panel-border)}.ig-table td{padding:8px 4px;border-bottom:1px solid var(--ig-panel-border);color:var(--ig-text-main)}.ig-tabs-container{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}.ig-tab-btn{padding:6px 10px!important;flex:auto!important;background:var(--ig-bg-input)!important;border-color:var(--ig-panel-border)!important;color:var(--ig-text-muted)!important;transition:all .2s ease}.ig-tab-btn:hover{background:var(--ig-bg-hover)!important;color:var(--ig-text-main)!important;border-color:var(--ig-text-muted)!important}.ig-tab-btn.active{background:var(--ig-bg-hover)!important;border-color:var(--ig-text-main)!important;color:var(--ig-text-main)!important;font-weight:700}.ig-badge{background:var(--ig-bg-hover);padding:2px 6px;border-radius:4px;font-size:10px;color:var(--ig-text-main);margin-left:6px;border:1px solid var(--ig-panel-border)}#ig-header{font-weight:600;font-size:15px;margin-bottom:16px;cursor:move;border-bottom:1px solid var(--ig-panel-border);padding-bottom:12px;display:flex;justify-content:space-between;align-items:center;color:var(--ig-text-main)}#ig-status{font-size:11px;background:var(--ig-bg-input);padding:4px 10px;border-radius:999px;color:var(--ig-text-muted);border:1px solid var(--ig-panel-border)}.ig-section-title{font-weight:600;font-size:13px;margin-bottom:12px;color:var(--ig-text-main)}.ig-empty-msg{color:var(--ig-text-muted)}.ig-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:#0009;-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);z-index:2147483647;display:none;justify-content:center;align-items:center}.ig-modal-content{background:#1f2937;border:1px solid #374151;padding:24px;border-radius:12px;width:360px;text-align:center;color:#f3f4f6;box-shadow:0 20px 25px -5px #00000080;display:flex;flex-direction:column;align-items:center}.ig-modal-icon{width:48px;height:48px;color:#facc15;margin-bottom:16px}.ig-modal-icon svg{width:100%;height:100%}.ig-modal-title{font-size:18px;font-weight:600;margin-bottom:12px;color:#fff}.ig-modal-text{font-size:14px;line-height:1.5;color:#d1d5db;margin-bottom:24px}.ig-modal-actions{display:flex;gap:12px;width:100%}.ig-btn-cancel-modal,.ig-btn-confirm-modal{flex:1;padding:10px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:background .2s}.ig-btn-cancel-modal{background:transparent;border:1px solid #4b5563;color:#d1d5db}.ig-btn-cancel-modal:hover{background:#ffffff1a;color:#fff}.ig-btn-confirm-modal{background:#0095f6;border:1px solid #0095f6;color:#fff}.ig-btn-confirm-modal:hover{background:#1877f2}";
  importCSS(mainCss);
  const UI = {
    init: () => {
      if (document.getElementById("ig-analyzer-panel")) return;
      const panel = document.createElement("div");
      panel.id = "ig-analyzer-panel";
      panel.innerHTML = [
        '<div id="ig-header">',
        "  <span>IG Analyzer</span>",
        '  <span id="ig-status">Inactive</span>',
        "</div>",
        '<div style="display: flex; gap: 8px; margin-bottom: 12px;">',
        '  <button id="ig-run" class="btn-primary">Run Analysis</button>',
        '  <button id="ig-export-csv" class="btn-success" disabled>Export CSV</button>',
        '  <button id="ig-reset" class="btn-danger">Reset Data</button>',
        "</div>",
        '<div class="ig-tabs-container" id="ig-tabs">',
        '  <button class="ig-tab-btn active" data-target="ig-log">Logs</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-history">History</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-notfollowing">Not Following</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-fans">Fans</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-mutuals">Mutuals</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-unfollowers">Unfollowers</button>',
        '  <button class="ig-tab-btn" data-target="ig-view-deactivated">Deactivated</button>',
        "</div>",
        '<div id="ig-progress-container"><div id="ig-progress-bar"></div></div>',
        '<div id="ig-log" class="ig-view-container ig-view active"></div>',
        '<div id="ig-view-history" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-notfollowing" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-fans" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-mutuals" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-unfollowers" class="ig-view-container ig-view"></div>',
        '<div id="ig-view-deactivated" class="ig-view-container ig-view"></div>'
      ].join("\n");
      document.body.appendChild(panel);
      const modalHTML = `
        <div id="ig-safety-modal" class="ig-modal-overlay">
            <div class="ig-modal-content">
                <div class="ig-modal-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
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
          document.querySelectorAll(".ig-tab-btn").forEach((b) => b.classList.remove("active"));
          document.querySelectorAll(".ig-view").forEach((v) => v.classList.remove("active"));
          e.target.classList.add("active");
          const targetId = e.target.getAttribute("data-target");
          document.getElementById(targetId).classList.add("active");
        };
      });
    },
    setStatus: (text) => {
      const el = document.getElementById("ig-status");
      if (el) el.textContent = text;
    },
    log: (msg) => {
      const box = document.getElementById("ig-log");
      if (box) {
        const timeStr = Utils.now().split("T")[1].split(".")[0];
        box.textContent += "[" + timeStr + "] " + msg + "\n";
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
      if (users.length === 0) html += '<div class="ig-empty-msg">No data available yet.</div>';
      users.forEach((u, index) => {
        const uniqueId = containerId + "-row-" + index;
        html += '<div class="ig-user-row" id="' + uniqueId + '"><span>' + u.username + "</span> <div>";
        if (containerId === "ig-view-notfollowing") {
          html += '<button class="btn-whitelist" data-user="' + u.username + '" data-idx="' + uniqueId + '">Ignore</button>';
        }
        html += '<a href="' + u.url + '" target="_blank">View ' + Icons.link + "</a></div></div>";
      });
      container.innerHTML = html;
      if (containerId === "ig-view-notfollowing") {
        const whitelistBtns = container.querySelectorAll(".btn-whitelist");
        whitelistBtns.forEach((btn) => {
          btn.onclick = (e) => {
            const targetUser = e.target.getAttribute("data-user");
            const rowId = e.target.getAttribute("data-idx");
            Storage.addToWhitelist(targetUser);
            document.getElementById(rowId).style.display = "none";
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
        html += '<div class="ig-empty-msg">No historical records yet.</div>';
      } else {
        html += '<table class="ig-table"><tr><th>Username</th><th>Detected Date</th><th>Profile</th></tr>';
        list.slice().reverse().forEach((item) => {
          html += "<tr><td>" + item.username + "</td><td>" + item.date + '</td><td><a href="https://www.instagram.com/' + item.username + '/" target="_blank">Link</a></td></tr>';
        });
        html += "</table>";
      }
      container.innerHTML = html;
    },
    renderHistory: (historyData) => {
      const container = document.getElementById("ig-view-history");
      if (!container) return;
      let html = '<div class="ig-section-title">Metrics History</div>';
      if (!historyData || historyData.length === 0) {
        html += '<div class="ig-empty-msg">No historical data available.</div>';
      } else {
        html += '<table class="ig-table"><tr><th>Date</th><th>Followers</th><th>Following</th></tr>';
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
          html += "<tr><td>" + h.date + "</td><td>" + h.followers + " " + followerIcon + "</td><td>" + h.following + " " + followingIcon + "</td></tr>";
        });
        html += "</table>";
      }
      container.innerHTML = html;
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
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        panel.style.left = x + "px";
        panel.style.top = y + "px";
        panel.style.right = "auto";
        GM_setValue(CONFIG.POSITION_KEY, { x, y });
      });
      document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
      });
    },
    loadPosition: (panel) => {
      const pos = GM_getValue(CONFIG.POSITION_KEY, null);
      if (pos && typeof pos.x === "number") {
        panel.style.left = pos.x + "px";
        panel.style.top = pos.y + "px";
        panel.style.right = "auto";
      }
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
            throw new Error("HTTP " + res.status);
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
        if (!edge || !Array.isArray(edge.edges)) throw new Error("Unexpected GraphQL structure. The API may have changed.");
        if (totalCount === 0 && edge.count) totalCount = edge.count;
        edge.edges.forEach((e) => {
          if (e?.node?.username) users.push(e.node.username);
        });
        hasNext = edge.page_info?.has_next_page === true;
        cursor = edge.page_info?.end_cursor || null;
        UI.setProgress(users.length, totalCount, "Extracting " + label + "...");
        if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500);
      }
      UI.log("Total " + label + ": " + users.length);
      return users;
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
        const following = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following");
        UI.log("Fetching 'Followers'...");
        const followers = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers");
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
          const newFollowers = Utils.diff(followers, prev.followers);
          UI.log("New followers since last run: " + newFollowers.length);
          const lostFollowers = Utils.diff(prev.followers, followers);
          const lostFollowing = Utils.diff(prev.following, following);
          const newDeactivated = Utils.intersection(lostFollowers, lostFollowing);
          const newUnfollowers = Utils.diff(lostFollowers, newDeactivated);
          if (newUnfollowers.length > 0) {
            UI.log("Identified " + newUnfollowers.length + " new unfollower(s)!");
            Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers);
          }
          if (newDeactivated.length > 0) {
            UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
            Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated);
          }
        } else {
          UI.log("First run: Initial state established.");
        }
        Storage.save({ version: 3, lastRun: Utils.now(), followers, following });
        UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
        UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
        UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
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
      });
    }
  };
  UI.init();
  App.bindEvents();
  console.log("IG Analyzer loaded. Press F9.");

})();