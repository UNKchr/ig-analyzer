import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { createBackupUI } from './Backup.js';
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
            '  <button class="ig-tab-btn" data-target="ig-view-renamed"><span class="ig-tab-icon">' + Icons.renamed + '</span><span class="ig-tab-label">Renamed</span></button>', 
            '</div>',
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
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        UI.setupDrag(panel, panel.querySelector("#ig-header"));
        UI.loadPosition(panel);
        UI.setupTabs();
        UI.setupThemeObserver();
        UI.renderHistory(Storage.getHistory());
        UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
        UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
        UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
        UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
        UI.renderPersistedSnapshot(Storage.load());

        Utils.getUserIdAsync().then((asyncId) => {
            if (asyncId && asyncId !== Storage.getCurrentUserId()) {
                Storage.setCurrentUserId(asyncId);
                UI.renderHistory(Storage.getHistory(asyncId));
                UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY, asyncId), "ig-view-unfollowers", "Recent Unfollowers");
                UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY, asyncId), "ig-view-deactivated", "Deactivated Accounts");
                UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY, asyncId), "ig-view-blocked", "Blocked Accounts");
                UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY, asyncId), "ig-view-renamed", "Username Changes"); 
                UI.renderPersistedSnapshot(Storage.load(asyncId));
            }
        }).catch(() => {});
    },

    setupThemeObserver: () => {
        const panel = document.getElementById('ig-analyzer-panel');
        let rafId = null;

        const checkTheme = () => {
            const html = document.documentElement;
            const body = document.body;

            // 1. Check for explicit dark mode classes/attributes on Instagram Web
            const isExplicitDark = html.classList.contains('_aa55') || 
                                   html.getAttribute('data-theme') === 'dark' || 
                                   (body && body.getAttribute('data-theme') === 'dark');

            if (isExplicitDark) {
                panel.classList.remove('ig-light-theme');
                return;
            }

            // 2. Computed background color with Instagram light theme (#fafafa / rgb(250, 250, 250)) tolerance
            const bodyBg = window.getComputedStyle(body || html).backgroundColor;
            const isLightBg = bodyBg === 'rgb(255, 255, 255)' || 
                              bodyBg === '#ffffff' || 
                              bodyBg === 'white' || 
                              bodyBg === 'rgb(250, 250, 250)' || 
                              bodyBg === '#fafafa';

            if (isLightBg) {
                panel.classList.add('ig-light-theme');
            } else {
                panel.classList.remove('ig-light-theme');
            }
        };

        checkTheme();

        // Use requestAnimationFrame to eliminate layout thrashing during DOM mutation bursts
        const observer = new MutationObserver(() => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(checkTheme);
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        if (document.body) {
            observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        }
    },
    
    confirmAction: (title, message, confirmBtnText = "Yes, Continue", showCancel = true, customIcon = null) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('ig-safety-modal');
            const titleEl = document.getElementById('ig-modal-title-text');
            const bodyEl = document.getElementById('ig-modal-body-text');
            const btnYes = document.getElementById('ig-modal-confirm');
            const btnNo = document.getElementById('ig-modal-cancel');
            const iconEl = modal ? modal.querySelector('.ig-modal-icon') : null;

            if (!modal) return resolve(true);

            titleEl.textContent = title;
            bodyEl.innerHTML = message;
            btnYes.textContent = confirmBtnText;

            if (iconEl && customIcon) {
                iconEl.innerHTML = customIcon;
            }

            if (btnNo) {
                btnNo.style.display = showCancel ? 'inline-block' : 'none';
            }

            modal.style.display = 'flex';

            const closeAndResolve = (value) => {
                modal.style.display = 'none';
                if (btnNo) btnNo.style.display = 'inline-block';
                if (iconEl) iconEl.innerHTML = Icons.warning;
                btnYes.onclick = null;
                if (btnNo) btnNo.onclick = null;
                resolve(value);
            };

            btnYes.onclick = () => closeAndResolve(true);
            if (btnNo) btnNo.onclick = () => closeAndResolve(false);
        });
    },
    
    setupTabs: () => {
        const btns = document.querySelectorAll(".ig-tab-btn");
        btns.forEach((btn) => {
            btn.onclick = (e) => {
                const target = e.target.closest('.ig-tab-btn');
                if (!target) return;
                const targetId = target.getAttribute("data-target");
                if (!targetId) return;
                document.querySelectorAll(".ig-tab-btn").forEach((b) => b.classList.remove("active"));
                document.querySelectorAll(".ig-view").forEach((v) => v.classList.remove("active"));
                target.classList.add("active");
                document.getElementById(targetId).classList.add("active");
            };
        });
    },

    renderPersistedSnapshot: (snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return;

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
            const dot = el.querySelector('.ig-status-dot');
            const dotHTML = dot ? dot.outerHTML : '<span class="ig-status-dot"></span>';
            const safeText = Utils.escapeHtml(text);
            el.innerHTML = dotHTML + safeText;
        }
    },
    
    log: (msg) => {
        try {
            const box = document.getElementById("ig-log");
            if (box) {
                const nowStr = (typeof Utils.now === 'function' ? Utils.now() : new Date().toISOString());
                const timeParts = nowStr.split("T");
                const timeStr = (timeParts.length > 1 ? timeParts[1].split(".")[0] : '') || nowStr;
                const entry = document.createElement("div");
                entry.className = "ig-log-entry";
                
                const timeSpan = document.createElement("span");
                timeSpan.className = "ig-log-time";
                timeSpan.textContent = '[' + timeStr + '] ';
                
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
        const percent = total > 0 ? Math.min(Math.round(current / total * 100), 100) : 100;
        bar.style.width = percent + "%";
        UI.setStatus(label + " " + percent + "%");
    },
    
    hideProgress: () => {
        const el = document.getElementById("ig-progress-container");
        if (el) el.style.display = "none";
    },

    setRunButtonState: (state) => {
        const btnRun = document.getElementById("ig-run");
        if (!btnRun) return;

        if (state === 'running') {
            btnRun.className = "ig-btn ig-btn-danger";
            btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + '</span>Cancel Analysis';
            btnRun.disabled = false;
        } else if (state === 'cancelling') {
            btnRun.className = "ig-btn ig-btn-danger";
            btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + '</span>Cancelling...';
            btnRun.disabled = true;
        } else {
            btnRun.className = "ig-btn ig-btn-primary";
            btnRun.innerHTML = '<span class="ig-btn-icon">' + Icons.play + '</span>Run Analysis';
            btnRun.disabled = false;
        }
    },
    
    paginationState: {},

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

    renderResultsPage: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const { users, title, isExportable, pageSize } = state;
        const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
        state.page = Math.max(1, Math.min(state.page, totalPages));
        const page = state.page;

        const startIndex = (page - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        const safeTitle = Utils.escapeHtml(title);
        let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + users.length + "</span></div>";

        if (users.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No data available yet.</div>';
            container.innerHTML = html;
            if (isExportable) {
                const exportBtn = document.getElementById("ig-export-csv");
                if (exportBtn) exportBtn.disabled = true;
            }
            return;
        }

        pageUsers.forEach((u, index) => {
            const globalIndex = startIndex + index;
            const uniqueId = containerId + "-row-" + globalIndex;
            const safeUsername = Utils.escapeHtml(u.username || '');
            const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';
            const safeUrl = Utils.sanitizeUrl(u.username, u.url);
            const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : '';
            const isVerified = Boolean(u.isVerified);
            const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
            const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);

            const avatarHtml = safeAvatarUrl
                ? '<img class="ig-user-avatar" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" style="object-fit:cover;' + (hasStory ? ' outline: 2px solid #e1306c; outline-offset: 1px;' : '') + '" />'
                : '<span class="ig-user-avatar"' + (hasStory ? ' style="outline: 2px solid #e1306c; outline-offset: 1px;"' : '') + '>' + safeInitial + '</span>';

            html += '<div class="ig-user-row" id="' + uniqueId + '">';
            html += '<div class="ig-user-info">' + avatarHtml;
            html += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
            html += '<span class="ig-username">' + safeUsername + (isVerified ? ' <span title="Verified" style="color:#0095f6; font-size:11px;">✓</span>' : '') + '</span>';
            if (safeFullName) {
                html += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + safeFullName + '</span>';
            }
            html += '</div></div>';
            html += '<div class="ig-user-actions">';
            if (containerId === "ig-view-notfollowing") {
                html += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
            }
            if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing") {
                html += '<button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '">' + Icons.spy + ' Check Story</button>';
            }
            html += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
            html += '</div></div>';
        });

        if (totalPages > 1) {
            html += '<div class="ig-pagination">';
            html += '<button class="ig-page-btn ig-page-prev" data-container="' + containerId + '"' + (page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>';
            html += '<span class="ig-page-info">Page ' + page + ' of ' + totalPages + ' (' + users.length + ' users)</span>';
            html += '<button class="ig-page-btn ig-page-next" data-container="' + containerId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>';
            html += '</div>';
        }

        container.innerHTML = html;

        if (isExportable) {
            const exportBtn = document.getElementById("ig-export-csv");
            if (exportBtn) exportBtn.disabled = users.length === 0;
        }
    },

    renderResults: (users, title, containerId, isExportable = false) => {
        const safeUsers = Array.isArray(users) ? users : [];
        UI.paginationState[containerId] = {
            users: safeUsers,
            title,
            containerId,
            isExportable,
            page: 1,
            pageSize: 50
        };
        UI.renderResultsPage(containerId);
    },
    
    renderNominalList: (list, containerId, title) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const safeTitle = Utils.escapeHtml(title);
        const safeList = Array.isArray(list) ? list : [];
        let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + safeList.length + "</span></div>";
        
        if (safeList.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No historical records yet.</div>';
        } else {
            html += '<table class="ig-table"><thead><tr><th>Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
            safeList.slice().reverse().forEach((item) => {
                const safeUsername = Utils.escapeHtml(item.username || '');
                const safeDate = Utils.escapeHtml(item.date || '');
                const profileUrl = Utils.sanitizeUrl(item.username);

                html += "<tr>";
                html += "<td><span class='ig-table-user'>" + safeUsername + "</span></td>";
                html += "<td><span class='ig-table-date'>" + safeDate + "</span></td>";
                html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + '</a></td>';
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
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No username changes detected yet.</div>';
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
                html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + '</a></td>';
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
                const safeDate = Utils.escapeHtml(h.date || '');
                const safeFollowers = Utils.escapeHtml(String(h.followers ?? ''));
                const safeFollowing = Utils.escapeHtml(String(h.following ?? ''));

                html += "<tr><td><span class='ig-table-date'>" + safeDate + "</span></td><td><span class='ig-metric-value'>" + safeFollowers + " " + followerIcon + "</span></td><td><span class='ig-metric-value'>" + safeFollowing + " " + followingIcon + "</span></td></tr>";
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