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
        
        // --- CAMBIO AQUÍ: Agregamos IDs dinámicos (ig-modal-title-text, ig-modal-body-text, ig-modal-confirm-btn) ---
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
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        UI.setupDrag(panel, panel.querySelector("#ig-header"));
        UI.loadPosition(panel);
        UI.setupTabs();
        UI.setupThemeObserver();
        UI.renderHistory(Storage.getHistory());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
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
    
    // --- CAMBIO AQUÍ: Función dinámica que acepta textos ---
    confirmAction: (title, message, confirmBtnText = "Yes, Continue") => {
        return new Promise((resolve) => {
            const modal = document.getElementById('ig-safety-modal');
            const titleEl = document.getElementById('ig-modal-title-text');
            const bodyEl = document.getElementById('ig-modal-body-text');
            const btnYes = document.getElementById('ig-modal-confirm');
            const btnNo = document.getElementById('ig-modal-cancel');

            if (!modal) return resolve(true);

            // Actualizamos los textos con lo que mande App.js
            titleEl.textContent = title;
            bodyEl.innerHTML = message; // Usamos innerHTML para permitir <br>
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
    
    // ... (El resto de funciones setupTabs, setStatus, etc. sigue igual) ...
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