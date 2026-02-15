// ==UserScript==
// @name        Instagram Follower Analyzer
// @namespace   https://github.com/UNKchr/ig-analyzer
// @version     2.0.2
// @description Analyze Instagram followers and following lists with Anti-Ban retry logic, Progress Bar, and CSV Export.
// @author      UNKchr
// @match       https://www.instagram.com/*
// @updateURL   https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js
// @downloadURL https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @run-at      document-idle
// @license     MIT
// ==/UserScript== 

(function() {
    'use strict';

    /* ======================= CONFIGURATION ======================= */
    const CONFIG = {
        STORAGE_KEY: "ig_snapshot_v2",
        POSITION_KEY: "ig_panel_position_v2",
        FOLLOWING_HASH: "d04b0a864b4b54837c0d870b0e77e076",
        FOLLOWERS_HASH: "c76146de99bb02f6415203be841dd25a",
        PAGE_SIZE: 50,
        BASE_RATE_LIMIT_MS: 1500, 
        MAX_RETRIES: 4,           
        DEBUG: false
    };

    /* ======================= UTILITIES ======================= */
    const Utils = {
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),
        
        now: () => new Date().toISOString(),
        
        getUserId: () => {
            const c = document.cookie.split("; ").find(x => x.startsWith("ds_user_id="));
            return c ? c.split("=")[1] : null;
        },
        
        diff: (a, b) => {
            const setB = new Set(b);
            return a.filter(x => !setB.has(x));
        },
        
        exportCSV: (data, filename) => {
            if (!data || !data.length) return;
            const csvContent = "Username,Profile URL\n" + data.map(u => u.username + "," + u.url).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    /* ======================= STORAGE ======================= */
    const Storage = {
        load: () => {
            try {
                const snap = GM_getValue(CONFIG.STORAGE_KEY, null);
                return snap && Array.isArray(snap.followers) ? snap : null;
            } catch (e) {
                UI.logError("Error loading snapshot", e);
                return null;
            }
        },
        save: (data) => GM_setValue(CONFIG.STORAGE_KEY, data),
        reset: () => GM_deleteValue(CONFIG.STORAGE_KEY)
    };

    /* ======================= UI CONTROLLER ======================= */
    const UI = {
        init: () => {
            if (document.getElementById("ig-analyzer-panel")) return;

            const panel = document.createElement("div");
            panel.id = "ig-analyzer-panel";
            panel.style.cssText = "position: fixed; top: 80px; right: 20px; width: 340px; height: 480px; background: #1a1a1a; color: #e0e0e0; font-family: system-ui, sans-serif; font-size: 13px; padding: 16px; z-index: 99999999; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); border: 1px solid #333; display: flex; flex-direction: column; resize: both; overflow: hidden;";

            panel.innerHTML = [
                '<style>',
                '  #ig-analyzer-panel button { background: #2d2d2d; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 8px; font-size: 12px; cursor: pointer; transition: 0.2s; flex: 1; }',
                '  #ig-analyzer-panel button:hover { background: #3d3d3d; }',
                '  #ig-analyzer-panel button:disabled { opacity: 0.5; cursor: not-allowed; }',
                '  .btn-primary { background: #0d6efd !important; border-color: #0b5ed7 !important; }',
                '  .btn-success { background: #198754 !important; border-color: #146c43 !important; }',
                '  .btn-danger { background: #dc3545 !important; border-color: #b02a37 !important; }',
                '  #ig-progress-container { width: 100%; background: #333; border-radius: 4px; height: 8px; margin: 10px 0; overflow: hidden; display: none; }',
                '  #ig-progress-bar { width: 0%; background: #0d6efd; height: 100%; transition: width 0.3s ease; }',
                '  #ig-log, #ig-results { flex-grow: 1; overflow-y: auto; background: #0a0a0a; border: 1px solid #222; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; color: #569cd6; }',
                '  #ig-results { display: none; color: #d4d4d4; }',
                '  .ig-user-row { padding: 4px 0; border-bottom: 1px solid #222; display: flex; justify-content: space-between; }',
                '  .ig-user-row a { color: #58a6ff; text-decoration: none; }',
                '  .ig-user-row a:hover { text-decoration: underline; }',
                '</style>',
                '<div id="ig-header" style="font-weight: 600; font-size: 15px; margin-bottom: 12px; cursor: move; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; justify-content: space-between;">',
                '  <span>IG Analyzer</span>',
                '  <span id="ig-status" style="font-size: 11px; background: #333; padding: 3px 8px; border-radius: 12px; color: #bbb;">Inactive</span>',
                '</div>',
                '<div style="display: flex; gap: 8px; margin-bottom: 8px;">',
                '  <button id="ig-run" class="btn-primary">Run</button>',
                '  <button id="ig-export-csv" class="btn-success" disabled>CSV</button>',
                '  <button id="ig-reset" class="btn-danger">Reset</button>',
                '</div>',
                '<div style="display: flex; gap: 8px; margin-bottom: 8px;">',
                '  <button id="ig-tab-log" style="background: #444;">Logs</button>',
                '  <button id="ig-tab-results">Results</button>',
                '</div>',
                '<div id="ig-progress-container"><div id="ig-progress-bar"></div></div>',
                '<div id="ig-log"></div>',
                '<div id="ig-results"></div>'
            ].join('\n');

            document.body.appendChild(panel);
            UI.setupDrag(panel, panel.querySelector("#ig-header"));
            UI.loadPosition(panel);
            UI.setupTabs();
        },

        setupTabs: () => {
            const logTab = document.getElementById("ig-tab-log");
            const resTab = document.getElementById("ig-tab-results");
            const logView = document.getElementById("ig-log");
            const resView = document.getElementById("ig-results");

            logTab.onclick = () => { logView.style.display = 'block'; resView.style.display = 'none'; logTab.style.background = '#444'; resTab.style.background = '#2d2d2d'; };
            resTab.onclick = () => { logView.style.display = 'none'; resView.style.display = 'block'; resTab.style.background = '#444'; logTab.style.background = '#2d2d2d'; };
        },

        setStatus: (text) => { document.getElementById("ig-status").textContent = text; },
        
        log: (msg) => {
            const box = document.getElementById("ig-log");
            if (box) { 
                const timeStr = Utils.now().split('T')[1].split('.')[0];
                box.textContent += "[" + timeStr + "] " + msg + "\n"; 
                box.scrollTop = box.scrollHeight; 
            }
            if (CONFIG.DEBUG) console.log(msg);
        },

        logError: (msg, err) => {
            UI.log("ERROR: " + msg);
            if (err) UI.log(String(err));
            console.error("IG Analyzer Error:", msg, err);
        },

        setProgress: (current, total, label) => {
            const container = document.getElementById("ig-progress-container");
            const bar = document.getElementById("ig-progress-bar");
            container.style.display = "block";
            const percent = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 100;
            bar.style.width = percent + "%";
            UI.setStatus(label + " " + percent + "%");
        },

        hideProgress: () => { document.getElementById("ig-progress-container").style.display = "none"; },

        renderResults: (users, title) => {
            const container = document.getElementById("ig-results");
            let html = '<div style="font-weight:bold; margin-bottom:8px;">' + title + ' (' + users.length + ')</div>';
            if (users.length === 0) html += '<div>No data available.</div>';
            
            users.forEach(u => {
                html += '<div class="ig-user-row"><span>' + u.username + '</span> <a href="' + u.url + '" target="_blank">View profile ↗</a></div>';
            });
            
            container.innerHTML = html;
            document.getElementById("ig-export-csv").disabled = users.length === 0;
            document.getElementById("ig-tab-results").click(); 
        },

        setupDrag: (panel, handle) => {
            let isDragging = false, offsetX, offsetY;
            handle.addEventListener("mousedown", e => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; document.body.style.userSelect = "none"; });
            document.addEventListener("mousemove", e => { if (!isDragging) return; const x = e.clientX - offsetX; const y = e.clientY - offsetY; panel.style.left = x + "px"; panel.style.top = y + "px"; panel.style.right = "auto"; GM_setValue(CONFIG.POSITION_KEY, { x, y }); });
            document.addEventListener("mouseup", () => { isDragging = false; document.body.style.userSelect = ""; });
        },

        loadPosition: (panel) => {
            const pos = GM_getValue(CONFIG.POSITION_KEY, null);
            if (pos && typeof pos.x === "number") { panel.style.left = pos.x + "px"; panel.style.top = pos.y + "px"; panel.style.right = "auto"; }
        },
        
        togglePanel: () => {
            const p = document.getElementById("ig-analyzer-panel");
            if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
        }
    };

    /* ======================= API CONTROLLER ======================= */
    const API = {
        fetchWithRetry: async (url, retries = CONFIG.MAX_RETRIES, backoff = 3000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const res = await fetch(url, { credentials: "include" });
                    if (res.ok) return await res.json();
                    
                    if (res.status === 429) {
                        UI.log("Request limit (429). Retrying in " + (backoff/1000) + "s... (Attempt " + (i+1) + "/" + retries + ")");
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
                const vars = encodeURIComponent(JSON.stringify({id: userId, first: CONFIG.PAGE_SIZE, after: cursor}));
                const url = "https://www.instagram.com/graphql/query/?query_hash=" + hash + "&variables=" + vars;
                
                const json = await API.fetchWithRetry(url);
                const userNode = json?.data?.user;
                const edge = userNode?.edge_follow || userNode?.edge_followed_by;

                if (!edge || !Array.isArray(edge.edges)) throw new Error("Unexpected GraphQL structure. The API may have changed.");

                if (totalCount === 0 && edge.count) totalCount = edge.count; 

                edge.edges.forEach(e => { if (e?.node?.username) users.push(e.node.username); });

                hasNext = edge.page_info?.has_next_page === true;
                cursor = edge.page_info?.end_cursor || null;

                UI.setProgress(users.length, totalCount, "Extracting " + label + "...");
                
                if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500); 
            }

            UI.log("Total of " + label + " extracted: " + users.length);
            return users;
        }
    };

    /* ======================= MAIN ORCHESTRATOR ======================= */
    const App = {
        run: async () => {
            const btnRun = document.getElementById("ig-run");
            btnRun.disabled = true;
            UI.setStatus("Analyzing...");
            UI.log("Starting deep analysis...");
            document.getElementById("ig-tab-log").click();

            try {
                const userId = Utils.getUserId();
                if (!userId) throw new Error("The user ID could not be obtained. Are you logged in?");

                UI.log("User detected. Getting 'Following'...");
                const following = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following");
                
                UI.log("Getting 'Followers' (Followers)...");
                const followers = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers");

                UI.hideProgress();
                UI.setStatus("Calculating...");

                const notFollowingBackUsernames = Utils.diff(following, followers);
                const notFollowingBackDetailed = notFollowingBackUsernames.map(u => ({ username: u, url: "https://www.instagram.com/" + u + "/" }));

                UI.log("Users that DON'T follow back: " + notFollowingBackDetailed.length);

                const prev = Storage.load();
                if (prev) {
                    const lostFollowers = Utils.diff(prev.followers, followers);
                    UI.log("Followers lost since last time: " + lostFollowers.length);
                } else {
                    UI.log("First run: Initial state has been saved.");
                }

                Storage.save({ version: 2, lastRun: Utils.now(), followers, following, notFollowingBack: notFollowingBackDetailed });
                
                UI.renderResults(notFollowingBackDetailed, "They don't follow you back");
                window.__igLastResults = notFollowingBackDetailed; 

                UI.setStatus("Completed");
                UI.log("Analysis completed.");

            } catch (e) {
                UI.setStatus("Error");
                UI.hideProgress();
                UI.logError("Failed analysis", e);
            } finally {
                btnRun.disabled = false;
            }
        },

        bindEvents: () => {
            document.getElementById("ig-run").onclick = App.run;
            document.getElementById("ig-export-csv").onclick = () => {
                if (window.__igLastResults) {
                    const dateStr = Utils.now().split('T')[0];
                    Utils.exportCSV(window.__igLastResults, "ig_no_follow_back_" + dateStr + ".csv");
                    UI.log("CSV Exported.");
                }
            };
            document.getElementById("ig-reset").onclick = () => {
                Storage.reset();
                UI.log("Historical data deleted.");
                document.getElementById("ig-results").innerHTML = "";
                document.getElementById("ig-export-csv").disabled = true;
            };

            document.addEventListener('keydown', (e) => {
                const tag = document.activeElement.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;
                if (e.key === 'F9') UI.togglePanel();
            });
        }
    };

    /* ======================= INITIALIZE ======================= */
    UI.init();
    App.bindEvents();
    UI.log("IG Analyzer loaded. Press F9 to show/hide the panel.");

})();