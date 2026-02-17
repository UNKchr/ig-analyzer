import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { Icons } from '../assets/Icons.js';

export const UI = {
    init: () => {
        if (document.getElementById("ig-analyzer-panel")) return;
        
        // CSS directo (Vite lo maneja)
        GM_addStyle(`
            #ig-analyzer-panel{position:fixed;top:80px;right:20px;width:380px;height:560px;background:#141414f2;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;font-size:13px;padding:16px;z-index:99999999;border-radius:12px;box-shadow:0 10px 40px #00000080;border:1px solid #374151;display:flex;flex-direction:column;resize:both;overflow:hidden}
            #ig-analyzer-panel *{box-sizing:border-box}
            #ig-analyzer-panel button{background:#374151;color:#f3f4f6;border:1px solid #4b5563;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s;flex:1}
            #ig-analyzer-panel button:hover{background:#4b5563}
            #ig-analyzer-panel button:disabled{opacity:.5;cursor:not-allowed}
            .btn-primary{background:#2563eb!important;border-color:#1d4ed8!important}
            .btn-primary:hover{background:#1d4ed8!important}
            .btn-success{background:#16a34a!important;border-color:#15803d!important}
            .btn-danger{background:#dc2626!important;border-color:#b91c1c!important}
            .btn-whitelist{background:#374151!important;border-color:#4b5563!important;padding:4px 8px!important;font-size:10px!important;margin-right:8px;flex:none!important}
            #ig-progress-container{width:100%;background:#1f2937;border-radius:999px;height:6px;margin:12px 0;overflow:hidden;display:none}
            #ig-progress-bar{width:0%;background:#3b82f6;height:100%;transition:width .3s ease}
            .ig-view-container{flex-grow:1;overflow-y:auto;background:#111827;border:1px solid #374151;border-radius:8px;padding:12px;font-size:12px;color:#d1d5db;margin-top:8px}
            .ig-view-container::-webkit-scrollbar{width:6px}
            .ig-view-container::-webkit-scrollbar-track{background:transparent}
            .ig-view-container::-webkit-scrollbar-thumb{background:#4b5563;border-radius:10px}
            #ig-log{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#60a5fa;white-space:pre-wrap;word-wrap:break-word}
            .ig-view{display:none}.ig-view.active{display:block}
            .ig-user-row{padding:8px 0;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center}
            .ig-user-row:last-child{border-bottom:none}
            .ig-user-row a{color:#60a5fa;text-decoration:none;font-weight:500;display:flex;align-items:center}
            .ig-user-row a:hover{color:#93c5fd}
            .ig-table{width:100%;text-align:left;border-collapse:collapse;margin-top:4px;font-size:11px}
            .ig-table th{color:#9ca3af;font-weight:600;padding-bottom:8px;border-bottom:1px solid #374151}
            .ig-table td{padding:8px 4px;border-bottom:1px solid #1f2937}
            .ig-tabs-container{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}
            .ig-tab-btn{padding:6px 10px!important;flex:auto!important;background:#1f2937!important;border-color:#374151!important}
            .ig-tab-btn.active{background:#4b5563!important;border-color:#6b7280!important;color:#fff!important}
            .ig-badge{background:#374151;padding:2px 6px;border-radius:4px;font-size:10px;color:#9ca3af;margin-left:6px}
            #ig-header{font-weight:600;font-size:15px;margin-bottom:16px;cursor:move;border-bottom:1px solid #374151;padding-bottom:12px;display:flex;justify-content:space-between;align-items:center}
            #ig-status{font-size:11px;background:#1f2937;padding:4px 10px;border-radius:999px;color:#9ca3af;border:1px solid #374151}
        `);

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
        
        UI.setupDrag(panel, panel.querySelector("#ig-header"));
        UI.loadPosition(panel);
        UI.setupTabs();
        UI.renderHistory(Storage.getHistory());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
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
        let html = '<div style="font-weight:600; font-size: 13px; margin-bottom:12px; color:#fff;">' + title + ' <span class="ig-badge">' + users.length + "</span></div>";
        if (users.length === 0) html += '<div style="color:#9ca3af;">No data available yet.</div>';
        
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
        let html = '<div style="font-weight:600; font-size: 13px; margin-bottom:12px; color:#fff;">' + title + ' <span class="ig-badge">' + list.length + "</span></div>";
        if (!list || list.length === 0) {
            html += '<div style="color:#9ca3af;">No historical records yet.</div>';
        } else {
            html += '<table class="ig-table"><tr><th>Username</th><th>Detected Date</th><th>Profile</th></tr>';
            list.slice().reverse().forEach((item) => {
                html += "<tr><td>" + item.username + "</td><td>" + item.date + '</td><td><a href="https://www.instagram.com/' + item.username + '/" target="_blank" style="color:#60a5fa; text-decoration:none;">Link</a></td></tr>';
            });
            html += "</table>";
        }
        container.innerHTML = html;
    },
    
    renderHistory: (historyData) => {
        const container = document.getElementById("ig-view-history");
        if (!container) return;
        let html = '<div style="font-weight:600; font-size: 13px; margin-bottom:12px; color:#fff;">Metrics History</div>';
        if (!historyData || historyData.length === 0) {
            html += '<div style="color:#9ca3af;">No historical data available.</div>';
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