import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { Icons } from '../assets/Icons.js';
import '../styles/main.css'; 

export const UI = {
    init: () => {
        if (document.getElementById("ig-analyzer-panel")) return;
        
        const panel = document.createElement("div");
        panel.id = "ig-analyzer-panel";
        panel.innerHTML = [
            '<div id="ig-header">',
            '  <div class="ig-header-left">',
            '    <span class="ig-logo">' + Icons.logo + '</span>',
            '    <span class="ig-title">IG Analyzer</span>',
            '  </div>',
            '  <div class="ig-header-right">',
            '    <span id="ig-status"><span class="ig-status-dot"></span>Inactive</span>',
            '  </div>',
            '</div>',
            '<div class="ig-actions-bar">',
            '  <button id="ig-run" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.play + '</span>Run Analysis</button>',
            '  <button id="ig-export-csv" class="ig-btn ig-btn-success" disabled><span class="ig-btn-icon">' + Icons.download + '</span>Export CSV</button>',
            '  <button id="ig-reset" class="ig-btn ig-btn-danger"><span class="ig-btn-icon">' + Icons.trash + '</span>Reset</button>',
            '</div>',
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
            '</div>',
            '<div id="ig-log" class="ig-view-container ig-view active"></div>',
            '<div id="ig-view-history" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-notfollowing" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-fans" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-mutuals" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-unfollowers" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-deactivated" class="ig-view-container ig-view"></div>',
            '<div id="ig-view-blocked" class="ig-view-container ig-view"></div>'
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
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        UI.setupDrag(panel, panel.querySelector("#ig-header"));
        UI.loadPosition(panel);
        UI.setupTabs();
        UI.setupThemeObserver();
        UI.renderHistory(Storage.getHistory());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
    },

    setupThemeObserver: () => {
        const panel = document.getElementById('ig-analyzer-panel');
        const checkTheme = () => {
            const bgColor = window.getComputedStyle(document.body).backgroundColor;
            if (bgColor === 'rgb(255, 255, 255)' || bgColor === '#ffffff' || bgColor === 'white') {
                panel.classList.add('ig-light-theme');
            } else {
                panel.classList.remove('ig-light-theme');
            }
        };
        checkTheme();
        const observer = new MutationObserver(() => checkTheme());
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    },
    
    confirmAction: (title, message, confirmBtnText = "Yes, Continue") => {
        return new Promise((resolve) => {
            const modal = document.getElementById('ig-safety-modal');
            const titleEl = document.getElementById('ig-modal-title-text');
            const bodyEl = document.getElementById('ig-modal-body-text');
            const btnYes = document.getElementById('ig-modal-confirm');
            const btnNo = document.getElementById('ig-modal-cancel');

            if (!modal) return resolve(true);

            titleEl.textContent = title;
            bodyEl.innerHTML = message;
            btnYes.textContent = confirmBtnText;

            modal.style.display = 'flex';

            const closeAndResolve = (value) => {
                modal.style.display = 'none';
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
                const target = e.target.closest('.ig-tab-btn');
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
            const dot = el.querySelector('.ig-status-dot');
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
            entry.innerHTML = '<span class="ig-log-time">[' + timeStr + ']</span> ' + msg;
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
        if (users.length === 0) html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No data available yet.</div>';
        
        users.forEach((u, index) => {
            const uniqueId = containerId + "-row-" + index;
            html += '<div class="ig-user-row" id="' + uniqueId + '">';
            html += '<div class="ig-user-info"><span class="ig-user-avatar">' + u.username.charAt(0).toUpperCase() + '</span><span class="ig-username">' + u.username + '</span></div>';
            html += '<div class="ig-user-actions">';
            if (containerId === "ig-view-notfollowing") {
                html += '<button class="btn-whitelist" data-user="' + u.username + '" data-idx="' + uniqueId + '">Ignore</button>';
            }
            html += '<a href="' + u.url + '" target="_blank" class="ig-view-link">View ' + Icons.link + '</a>';
            html += '</div></div>';
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
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No historical records yet.</div>';
        } else {
            html += '<table class="ig-table"><thead><tr><th>Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
            list.slice().reverse().forEach((item) => {
                html += "<tr><td><span class='ig-table-user'>" + item.username + "</span></td><td><span class='ig-table-date'>" + item.date + '</span></td><td><a href="https://www.instagram.com/' + item.username + '/" target="_blank" class="ig-table-link">View ' + Icons.link + '</a></td></tr>';
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
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + '</span>No historical data available.</div>';
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
    
    /**
     * Clamps the given (x, y) coordinates so that at least
     * CONFIG.MIN_VISIBLE_PX pixels of the panel remain visible
     * within the current viewport boundaries.
     */
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

    /**
     * Resets the panel position to its default location and clears
     * the stored position from persistent storage.
     */
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