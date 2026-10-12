import { UI } from './UIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { API } from '../API.js';
import { createBackupUI } from '../Backup.js';
import { Icons } from '../../assets/Icons.js';

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
            '    <span class="ig-target-header-icon">' + Icons.target + '</span>',
            '    <span id="ig-target-header-title" class="ig-target-header-title">Target Network Audit</span>',
            '  </div>',
            '  <div class="ig-target-header-right">',
            '    <span id="ig-target-status"><span class="ig-status-dot"></span>Idle</span>',
            '    <div class="ig-target-header-actions">',
            '      <button id="ig-target-btn-refresh" class="ig-header-btn" title="Refresh Audit">' + Icons.refresh + '</button>',
            '      <button id="ig-target-btn-minimize" class="ig-header-btn" title="Minimize / Expand">' + Icons.minimize + '</button>',
            '      <button id="ig-target-btn-close" class="ig-header-btn ig-header-btn-close" title="Close Subpanel">',
            '        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
            '      </button>',
            '    </div>',
            '  </div>',
            '</div>',
            '<div class="ig-target-actions-bar">',
            '  <div class="ig-target-meta-summary" id="ig-target-meta-summary">',
            '    <span class="ig-target-meta-text">Target: None selected</span>',
            '  </div>',
            '  <div class="ig-target-actions-buttons">',
            '    <button id="ig-target-run" class="ig-btn ig-btn-primary ig-btn-sm"><span class="ig-btn-icon">' + Icons.play + '</span>Run Audit</button>',
            '    <button id="ig-target-export-csv" class="ig-btn ig-btn-success ig-btn-sm" disabled><span class="ig-btn-icon">' + Icons.download + '</span>Export CSV</button>',
            '  </div>',
            '</div>',
            '<div id="ig-target-progress-container" class="ig-progress-container" style="display:none;"><div id="ig-target-progress-bar" class="ig-progress-bar"></div></div>',
            '<div class="ig-tabs-wrapper ig-target-tabs-wrapper">',
            '  <div class="ig-tabs-container" id="ig-target-tabs">',
            '    <div id="ig-target-tab-indicator" class="ig-tab-indicator"></div>',
            '    <button class="ig-tab-btn active" data-target="ig-target-view-overview"><span class="ig-tab-icon">' + Icons.metrics + '</span><span class="ig-tab-label">Overview</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-mutuals"><span class="ig-tab-icon">' + Icons.mutuals + '</span><span class="ig-tab-label">Mutuals</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-newmutuals"><span class="ig-tab-icon">' + Icons.newMutuals + '</span><span class="ig-tab-label">New Mutuals</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-lostfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Lost Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-followers"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-following"><span class="ig-tab-icon">' + Icons.user + '</span><span class="ig-tab-label">Following</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-logs"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
            '  </div>',
            '</div>',
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

        // Header controls
        subpanel.querySelector('#ig-target-btn-minimize')?.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.toggleTargetMinimize();
        });
        subpanel.querySelector('#ig-target-btn-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.closeTargetSubpanel();
        });
        subpanel.querySelector('#ig-target-btn-refresh')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (UI.currentTargetUser && window.App?.runTargetAudit) {
                window.App.runTargetAudit(UI.currentTargetUser, true);
            }
        });

        // Tabs setup
        const tabsContainer = subpanel.querySelector("#ig-target-tabs");
        const indicator = subpanel.querySelector("#ig-target-tab-indicator");

        const updateIndicator = (activeBtn, animate = true) => {
            if (!activeBtn || !indicator || !tabsContainer) return;
            if (!animate) indicator.style.transition = 'none';
            else indicator.style.transition = '';
            indicator.style.transform = `translate3d(${activeBtn.offsetLeft}px, ${activeBtn.offsetTop}px, 0)`;
            indicator.style.width = `${activeBtn.offsetWidth}px`;
            indicator.style.height = `${activeBtn.offsetHeight}px`;
            indicator.style.opacity = '1';
            if (!animate) { indicator.offsetHeight; indicator.style.transition = ''; }
        };

        const btns = subpanel.querySelectorAll(".ig-tab-btn");
        btns.forEach((btn) => {
            btn.onclick = (e) => {
                const target = e.target.closest('.ig-tab-btn');
                if (!target) return;

                // Center tab horizontally inside subpanel tabs without bubbling scroll to ancestors
                const scrollLeft = target.offsetLeft - (tabsContainer.offsetWidth / 2) + (target.offsetWidth / 2);
                tabsContainer.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });

                const targetId = target.getAttribute("data-target");
                if (!targetId) return;
                btns.forEach((b) => b.classList.remove("active"));
                subpanel.querySelectorAll(".ig-view, .ig-target-view").forEach((v) => v.classList.remove("active"));
                target.classList.add("active");
                const targetView = subpanel.querySelector(`#${targetId}`);
                if (targetView) {
                    targetView.classList.add("active");
                    if (typeof UI.loadAvatarsProgressively === 'function') {
                        UI.loadAvatarsProgressively(targetView);
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
            tabsContainer.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    tabsContainer.scrollLeft += e.deltaY;
                }
            }, { passive: false });

            tabsContainer.addEventListener('scroll', () => {
                const currentActive = tabsContainer.querySelector('.ig-tab-btn.active');
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
            if (e.target.closest('.ig-header-btn, #ig-target-status')) return;
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

        const cleanUser = String(targetUserObj.username || '').replace(/^@/, '').trim();
        const titleEl = document.getElementById("ig-target-header-title");
        if (titleEl) {
            titleEl.innerHTML = '@' + Utils.escapeHtml(cleanUser) + (targetUserObj.isVerified ? ' ' + Icons.verified : '');
        }

        const summaryBar = document.getElementById("ig-target-meta-summary");
        if (summaryBar) {
            let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(cleanUser) + '</span>';
            if (targetUserObj.fullName) {
                summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(targetUserObj.fullName) + '</span>';
            }
            const fCount = (Array.isArray(storedData?.followers) && storedData.followers.length > 0)
                ? storedData.followers.length
                : (targetUserObj.followerCount || 0);
            const ingCount = (Array.isArray(storedData?.following) && storedData.following.length > 0)
                ? storedData.following.length
                : (targetUserObj.followingCount || 0);
            summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(fCount) + ' followers</span>';
            summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(ingCount) + ' following</span>';
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
                    '  <div class="ig-target-ready-icon">' + Icons.target + '</div>',
                    '  <div class="ig-target-ready-title">Ready to Audit @' + Utils.escapeHtml(cleanUser) + '</div>',
                    '  <div class="ig-target-ready-desc">Click <b>"Run Audit"</b> above to extract followers & following, discover mutual connections, and start tracking audience balance.</div>',
                    '</div>'
                ].join('');
            }
            ['mutuals', 'newmutuals', 'newfollowers', 'lostfollowers', 'followers', 'following'].forEach((key) => {
                const el = document.getElementById("ig-target-view-" + key);
                if (el) el.innerHTML = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>Run an audit to view ' + key + '.</div>';
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
            const dot = el.querySelector('.ig-status-dot');
            const dotHTML = dot ? dot.outerHTML : '<span class="ig-status-dot"></span>';
            el.innerHTML = dotHTML + Utils.escapeHtml(text);
            if (text && text.toLowerCase() !== 'idle' && text.toLowerCase() !== 'inactive') {
                el.classList.add('is-active');
            } else {
                el.classList.remove('is-active');
            }
        }
    },

    targetLog: (msg) => {
        try {
            const box = document.getElementById("ig-target-view-logs");
            if (box) {
                const nowStr = (typeof Utils.now === 'function' ? Utils.now() : new Date().toISOString());
                const timeParts = nowStr.split("T");
                const timeStr = (timeParts.length > 1 ? timeParts[1].split(".")[0] : '') || nowStr;
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
            const percent = Math.min(Math.max(Math.round((current / total) * 100), 0), 100);
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
        if (state === 'running') {
            btn.className = "ig-btn ig-btn-danger ig-btn-sm";
            btn.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + '</span>Cancel Audit';
            btn.disabled = false;
        } else if (state === 'cancelling') {
            btn.className = "ig-btn ig-btn-danger ig-btn-sm";
            btn.innerHTML = '<span class="ig-btn-icon">' + Icons.stop + '</span>Cancelling...';
            btn.disabled = true;
        } else {
            btn.className = "ig-btn ig-btn-primary ig-btn-sm";
            btn.innerHTML = '<span class="ig-btn-icon">' + Icons.play + '</span>Run Audit';
            btn.disabled = false;
        }
    },

    renderTargetOverview: (targetData) => {
        const container = document.getElementById("ig-target-view-overview");
        if (!container || !targetData) return;

        const u = targetData.user || {};
        const safeUser = Utils.escapeHtml(u.username || targetData.username || '');
        const safeName = Utils.escapeHtml(u.fullName || '');
        const avatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
        const isVerified = Boolean(u.isVerified);
        const isPrivate = Boolean(u.isPrivate);
        const isRestricted = Boolean(targetData.isRestricted);

        const safeInitial = safeUser ? safeUser.charAt(0).toUpperCase() : '?';
        const avatarHtml = '<div class="ig-user-avatar ig-avatar-monogram" data-avatar-url="' + (avatarUrl || '') + '" data-username="' + safeUser + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

        const followersCount = (Array.isArray(targetData.followers) && targetData.followers.length > 0)
            ? targetData.followers.length
            : (u.followerCount || 0);
        const followingCount = (Array.isArray(targetData.following) && targetData.following.length > 0)
            ? targetData.following.length
            : (u.followingCount || 0);
        const mutualsCount = (Array.isArray(targetData.mutuals) && targetData.mutuals.length > 0)
            ? targetData.mutuals.length
            : (typeof u.mutualsCount === 'number' ? u.mutualsCount : 0);
        const newCount = targetData.newFollowers ? targetData.newFollowers.length : 0;
        const lostCount = targetData.lostFollowers ? targetData.lostFollowers.length : 0;
        const newMutualsCount = targetData.newMutuals ? targetData.newMutuals.length : 0;
        const netFlow = newCount - lostCount;
        const netSign = netFlow > 0 ? '+' : '';
        const netClass = netFlow > 0 ? 'is-positive' : (netFlow < 0 ? 'is-negative' : 'is-neutral');

        let html = '';

        html += '<div class="ig-target-overview-header">';
        html += '  <div class="ig-target-overview-avatar-wrap">' + avatarHtml + '</div>';
        html += '  <div class="ig-target-overview-meta">';
        html += '    <div class="ig-target-overview-title-row">';
        html += '      <span class="ig-target-overview-username">@' + safeUser + '</span>';
        if (isVerified) html += '<span title="Verified">' + Icons.verified + '</span>';
        if (isPrivate) html += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + ' Private</span>';
        else html += '<span class="ig-badge-pill ig-badge-public">Public</span>';
        if (u.followedByViewer) html += '<span class="ig-badge-pill ig-badge-mutual">You follow</span>';
        if (u.followsViewer) html += '<span class="ig-badge-pill ig-badge-fan">Follows you</span>';
        html += '    </div>';
        if (safeName) html += '    <div class="ig-target-overview-fullname">' + safeName + '</div>';
        html += '    <div class="ig-target-overview-timestamps">Last audited: ' + (targetData.lastAuditAt ? Utils.formatDate(targetData.lastAuditAt) : 'Just now') + '</div>';
        html += '  </div>';
        html += '</div>';

        if (isRestricted) {
            html += '<div class="ig-target-restricted-alert">';
            html += '  <div class="ig-target-alert-icon">' + Icons.lock + '</div>';
            html += '  <div class="ig-target-alert-body">';
            html += '    <strong>Private Account Restriction:</strong> Meta restricts network extraction for private accounts you do not follow. Followers and following lists cannot be retrieved. Public header counts and profile updates continue to be tracked below.';
            html += '  </div>';
            html += '</div>';
        }

        html += '<div class="ig-history-kpi-grid" style="margin-top: 14px;">';
        html += '  <div class="ig-kpi-card">';
        html += '    <div class="ig-kpi-label">Followers</div>';
        html += '    <div class="ig-kpi-value">' + Utils.formatNumber(followersCount) + '</div>';
        html += '    <div class="ig-kpi-sub ' + (newCount > 0 ? 'is-positive' : '') + '">' + Icons.userPlus + ' <span>+' + newCount + ' new</span></div>';
        html += '  </div>';
        html += '  <div class="ig-kpi-card">';
        html += '    <div class="ig-kpi-label">Following</div>';
        html += '    <div class="ig-kpi-value">' + Utils.formatNumber(followingCount) + '</div>';
        html += '    <div class="ig-kpi-sub ' + (lostCount > 0 ? 'is-negative' : '') + '">' + Icons.unfollowers + ' <span>-' + lostCount + ' lost</span></div>';
        html += '  </div>';
        html += '  <div class="ig-kpi-card">';
        html += '    <div class="ig-kpi-label">Mutual Connections</div>';
        html += '    <div class="ig-kpi-value">' + (isRestricted ? '-' : Utils.formatNumber(mutualsCount)) + '</div>';
        if (newMutualsCount > 0) {
            html += '    <div class="ig-kpi-sub is-positive" style="cursor: pointer;" onclick="document.querySelector(\'[data-target=\\\'ig-target-view-newmutuals\\\']\').click()" title="View New Mutuals">' + Icons.sparkles + ' <span>+' + newMutualsCount + ' new</span></div>';
        } else {
            html += '    <div class="ig-kpi-sub is-neutral">' + Icons.mutuals + ' <span>' + (isRestricted ? 'Restricted' : 'Internal Mutuals') + '</span></div>';
        }
        html += '  </div>';
        html += '  <div class="ig-kpi-card">';
        html += '    <div class="ig-kpi-label">Audience Balance</div>';
        html += '    <div class="ig-kpi-value ' + netClass + '">' + (isRestricted ? '0' : netSign + netFlow) + '</div>';
        html += '    <div class="ig-kpi-sub"><span style="color:#22c55e;">+' + newCount + '</span> / <span style="color:#ef4444;">-' + lostCount + '</span></div>';
        html += '  </div>';
        html += '</div>';

        if (Array.isArray(targetData.history) && targetData.history.length > 0) {
            html += '<div class="ig-section-title" style="margin-top: 18px;">Audit History <span class="ig-badge">' + targetData.history.length + '</span></div>';
            html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th><th>Mutuals</th></tr></thead><tbody>';
            targetData.history.slice().reverse().forEach((h) => {
                html += '<tr>';
                html += '<td><span class="ig-table-date">' + Utils.escapeHtml(h.date || '') + '</span></td>';
                html += '<td><span class="ig-metric-value">' + Utils.formatNumber(h.followers) + '</span></td>';
                html += '<td><span class="ig-metric-value">' + Utils.formatNumber(h.following) + '</span></td>';
                html += '<td><span class="ig-metric-value">' + (h.mutuals !== undefined ? Utils.formatNumber(h.mutuals) : '-') + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
        }

        container.innerHTML = html;
        UI.loadAvatarsProgressively(container);
    },

    renderTargetLists: (targetData) => {
        if (!targetData) return;
        const newMutualsNames = (targetData.newMutuals || []).map(u => u.username);
        const newMutualsSet = new Set(newMutualsNames);

        UI.renderTargetSingleList("ig-target-view-mutuals", targetData.mutuals || [], "Mutual Connections", "No mutual connections found.", { newMutualsSet });
        UI.renderTargetSingleList("ig-target-view-newmutuals", targetData.newMutualsDetailed || targetData.newMutuals || [], "New Mutual Connections", "No new mutual connections discovered in this audit.", { newMutualsSet });
        UI.renderTargetSingleList("ig-target-view-newfollowers", targetData.newFollowers || [], "New Followers Gained", "No new followers detected since last scan.", { isNewBadge: true, newMutualsSet });
        UI.renderTargetSingleList("ig-target-view-lostfollowers", targetData.lostFollowers || [], "Followers Lost", "No lost followers detected since last scan.", { isLostBadge: true });
        UI.renderTargetSingleList("ig-target-view-followers", targetData.followers || [], "Target Followers", "No followers data available.");
        UI.renderTargetSingleList("ig-target-view-following", targetData.following || [], "Target Following", "No following data available.");
    },

    TARGET_CHIPS_DEF: [
        { id: 'all', label: 'All', icon: null },
        { id: 'private', label: 'Private', icon: Icons.lock },
        { id: 'public', label: 'Public', icon: null },
        { id: 'story', label: 'With Story', icon: Icons.storyRing },
        { id: 'verified', label: 'Verified', icon: Icons.verified }
    ],

    getTargetFilterCounts: (rawUsers, searchQuery = '', options = {}) => {
        const query = (searchQuery || '').trim().toLowerCase().replace(/^@+/, '');
        const baseList = query
            ? (rawUsers || []).filter((u) => {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                return uName.includes(query) || fName.includes(query);
            })
            : (rawUsers || []);

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

        const query = (state.searchQuery || '').trim().toLowerCase().replace(/^@+/, '');
        const filter = state.filterType || 'all';
        const newMutualsSet = state.options?.newMutualsSet;

        state.users = (state.rawUsers || []).filter((u) => {
            if (query) {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                if (!uName.includes(query) && !fName.includes(query)) {
                    return false;
                }
            }

            if (filter === 'private') return Boolean(u.isPrivate);
            if (filter === 'public') return u.isPrivate === false;
            if (filter === 'story') return Boolean(u.latestReelMedia && u.latestReelMedia > 0);
            if (filter === 'verified') return Boolean(u.isVerified);
            if (filter === 'newmutual') return Boolean(newMutualsSet && newMutualsSet.has(u.username));

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

        const chipsBar = container.querySelector('.ig-filter-chips');
        if (!chipsBar) return;

        const counts = UI.getTargetFilterCounts(state.rawUsers, state.searchQuery, state.options);
        const chips = chipsBar.querySelectorAll('.ig-filter-chip');
        chips.forEach((chip) => {
            const filterId = chip.getAttribute('data-filter');
            if (filterId && counts[filterId] !== undefined) {
                const countEl = chip.querySelector('.ig-chip-count');
                if (countEl) countEl.textContent = counts[filterId];
            }
            if (filterId === state.filterType) {
                chip.classList.add('is-active');
            } else {
                chip.classList.remove('is-active');
            }
        });

        const headerBadge = container.querySelector('.ig-section-title .ig-badge');
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
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    },

    renderTargetSingleList: (containerId, rawList, title, emptyMsg, options = {}) => {
        const safeList = Utils.toDetailedUserArray(rawList);
        UI.targetPaginationState[containerId] = {
            rawUsers: safeList,
            users: safeList,
            searchQuery: '',
            filterType: 'all',
            page: 1,
            pageSize: 50,
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

        const { rawUsers, users, title, emptyMsg, options, searchQuery, filterType } = state;
        const totalRaw = (rawUsers || []).length;
        const totalFiltered = (users || []).length;
        const safeTitle = Utils.escapeHtml(title);

        if (totalRaw === 0) {
            container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>' + Utils.escapeHtml(emptyMsg) + '</div>';
            return;
        }

        const pageSize = state.pageSize || 50;
        const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        state.page = Math.max(1, Math.min(state.page || 1, totalPages));
        const page = state.page;
        const startIndex = (page - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        let headerEl = container.querySelector('.ig-view-header');
        let toolbarEl = container.querySelector('.ig-filter-toolbar');
        let listEl = container.querySelector('.ig-view-list');
        let paginationEl = container.querySelector('.ig-view-pagination');

        const badgeCountText = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;

        if (!toolbarEl) {
            const counts = UI.getTargetFilterCounts(rawUsers, searchQuery, options);
            const chipsDef = [...UI.TARGET_CHIPS_DEF];
            if (options?.newMutualsSet && options.newMutualsSet.size > 0) {
                chipsDef.push({ id: 'newmutual', label: 'New Mutuals', icon: Icons.sparkles });
            }

            let chipsHtml = '';
            chipsDef.forEach((chip) => {
                const isActive = (filterType || 'all') === chip.id;
                const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : '';
                chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? ' is-active' : ''}" data-filter="${chip.id}">` +
                    iconHtml +
                    `<span class="ig-chip-label">${chip.label}</span>` +
                    `<span class="ig-chip-count">${counts[chip.id] || 0}</span>` +
                    `</button>`;
            });

            const clearStyle = searchQuery ? 'display: inline-flex;' : 'display: none;';
            container.innerHTML = [
                '<div class="ig-view-header">',
                '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>',
                '</div>',
                '<div class="ig-filter-toolbar">',
                '  <div class="ig-search-box">',
                '    <span class="ig-search-icon">' + Icons.search + '</span>',
                '    <input type="text" class="ig-search-input ig-target-list-search" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || '') + '" autocomplete="off" spellcheck="false" />',
                '    <button type="button" class="ig-search-clear ig-target-list-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + '</button>',
                '  </div>',
                '  <div class="ig-filter-chips">' + chipsHtml + '</div>',
                '</div>',
                '<div class="ig-view-list ig-target-inner-list"></div>',
                '<div class="ig-view-pagination"></div>'
            ].join('\n');

            headerEl = container.querySelector('.ig-view-header');
            toolbarEl = container.querySelector('.ig-filter-toolbar');
            listEl = container.querySelector('.ig-view-list');
            paginationEl = container.querySelector('.ig-view-pagination');

            const searchInput = toolbarEl.querySelector('.ig-target-list-search');
            const clearBtn = toolbarEl.querySelector('.ig-target-list-clear');
            let searchTimeout = null;

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        state.searchQuery = val;
                        UI.applyTargetFilters(containerId);
                    }, 120);
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (searchInput.value || state.searchQuery) {
                            searchInput.value = '';
                            if (clearBtn) clearBtn.style.display = 'none';
                            state.searchQuery = '';
                            UI.applyTargetFilters(containerId);
                        }
                    }
                });
            }

            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    state.searchQuery = '';
                    searchInput.focus();
                    UI.applyTargetFilters(containerId);
                });
            }

            const chipsBar = toolbarEl.querySelector('.ig-filter-chips');
            if (chipsBar) {
                chipsBar.addEventListener('click', (e) => {
                    const chipBtn = e.target.closest('.ig-filter-chip');
                    if (!chipBtn) return;
                    e.preventDefault();
                    const targetFilter = chipBtn.getAttribute('data-filter');
                    if (!targetFilter) return;

                    if (state.filterType === targetFilter && targetFilter !== 'all') {
                        state.filterType = 'all';
                    } else {
                        state.filterType = targetFilter;
                    }
                    UI.applyTargetFilters(containerId);
                });
            }
        } else {
            if (headerEl) {
                headerEl.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>';
            }
            UI.updateTargetFilterChips(containerId);
            const clearBtn = toolbarEl.querySelector('.ig-target-list-clear');
            if (clearBtn) {
                clearBtn.style.display = state.searchQuery ? 'inline-flex' : 'none';
            }
            const searchInput = toolbarEl.querySelector('.ig-target-list-search');
            if (searchInput && document.activeElement !== searchInput && searchInput.value !== (state.searchQuery || '')) {
                searchInput.value = state.searchQuery || '';
            }
        }

        let rowsHtml = '';
        if (totalFiltered === 0) {
            rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No accounts match your search or filter criteria.</div>';
        } else {
            pageUsers.forEach((u) => {
                const safeUsername = Utils.escapeHtml(u.username || '');
                const safeUrl = Utils.sanitizeUrl(u.username, u.url);
                const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : '';
                const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';
                const avatarClass = 'ig-user-avatar ig-avatar-monogram';
                const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || '') + '" data-username="' + safeUsername + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${Utils.escapeHtml(u.id || '')}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                let badges = '';
                if (u.isPrivate) badges += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + '</span>';
                if (u.isVerified) badges += '<span title="Verified">' + Icons.verified + '</span>';
                if (options.isNewBadge) badges += '<span class="ig-badge-pill ig-badge-new-mutual">' + Icons.sparkles + ' New</span>';
                if (options.isLostBadge) badges += '<span class="ig-badge-pill ig-badge-churn">' + Icons.unfollowers + ' Lost</span>';
                if (options.newMutualsSet && options.newMutualsSet.has(u.username)) badges += '<span class="ig-badge-pill ig-badge-new-mutual" style="background: #10b981 !important; color: white !important; font-weight: bold; border: none !important;">' + Icons.sparkles + ' New Mutual</span>';
                if (u.isViewerMutual) badges += '<span class="ig-badge-pill ig-badge-new-mutual" title="Shared mutual with you!">' + Icons.sparkles + ' Shared Mutual</span>';

                rowsHtml += '<div class="ig-user-row" data-user-id="' + Utils.escapeHtml(u.id || '') + '">';
                rowsHtml += '  <div class="ig-user-info">' + avatarTriggerHtml;
                rowsHtml += '    <div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                rowsHtml += '      <div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
                rowsHtml += '        <span class="ig-username">' + safeUsername + '</span>';
                rowsHtml += '        <span class="ig-user-badges">' + badges + '</span>';
                rowsHtml += '      </div>';
                if (safeFullName) rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                rowsHtml += '    </div>';
                rowsHtml += '  </div>';
                rowsHtml += '  <div class="ig-user-actions">';
                rowsHtml += '    <button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || '') + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                rowsHtml += '    <a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                rowsHtml += '  </div>';
                rowsHtml += '</div>';
            });
        }

        if (listEl) {
            listEl.innerHTML = rowsHtml;
            UI.loadAvatarsProgressively(listEl);
        }

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += '<div class="ig-pagination">';
            paginationHtml += '<button class="ig-page-btn ig-target-page-prev" data-container="' + containerId + '"' + (page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>';
            paginationHtml += '<span class="ig-page-info">Page ' + page + ' of ' + totalPages + ' (' + totalFiltered + ' accounts)</span>';
            paginationHtml += '<button class="ig-page-btn ig-target-page-next" data-container="' + containerId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>';
            paginationHtml += '</div>';
        }
        if (paginationEl) paginationEl.innerHTML = paginationHtml;
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
            '    <div class="ig-target-search-title"><span class="ig-btn-icon">' + Icons.target + '</span> Target Network Audit</div>',
            '    <div class="ig-target-search-desc">Audit any Instagram account network, discover mutual connections, inspect their audience, and track new or lost followers over time.</div>',
            '  </div>',
            '  <div class="ig-target-search-input-group">',
            '    <span class="ig-input-prefix">@</span>',
            '    <input type="text" id="ig-target-search-input" class="ig-target-input" placeholder="username (e.g. cristiano, friend_account)" autocomplete="off" spellcheck="false" />',
            '    <button id="ig-btn-target-search" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.search + '</span> Audit Account</button>',
            '  </div>',
            '  <div id="ig-target-search-feedback" class="ig-target-feedback" style="display: none;"></div>',
            '</div>',
            '<div class="ig-section-title" style="margin-top: 20px;">',
            '  Monitored Accounts <span class="ig-badge" id="ig-target-monitored-count">' + targetEntries.length + '</span>',
            '</div>',
            '<div id="ig-target-grid" class="ig-target-grid">'
        ].join('\n');

        if (targetEntries.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.target + '</span>No accounts being tracked yet.<br>Enter an @username above or click "Audit" on any user row in Mutuals to start monitoring.</div>';
        } else {
            targetEntries.slice().reverse().forEach((t) => {
                const u = t.user || {};
                const safeUser = Utils.escapeHtml(t.username || u.username || '');
                const safeName = Utils.escapeHtml(u.fullName || '');
                const avatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
                const isVerified = Boolean(u.isVerified);
                const isPrivate = Boolean(u.isPrivate);
                const fCount = (Array.isArray(t.followers) && t.followers.length > 0) ? t.followers.length : (u.followerCount || 0);
                const ingCount = (Array.isArray(t.following) && t.following.length > 0) ? t.following.length : (u.followingCount || 0);
                const mutCount = (Array.isArray(t.mutuals) && t.mutuals.length > 0) ? t.mutuals.length : (typeof u.mutualsCount === 'number' ? u.mutualsCount : 0);
                const newCount = t.newFollowers ? t.newFollowers.length : 0;
                const lostCount = t.lostFollowers ? t.lostFollowers.length : 0;
                const netFlow = newCount - lostCount;

                let diffBadge = '';
                if (netFlow > 0) {
                    diffBadge = '<span class="ig-target-card-diff is-positive">+' + netFlow + '</span>';
                } else if (netFlow < 0) {
                    diffBadge = '<span class="ig-target-card-diff is-negative">' + netFlow + '</span>';
                }

                const safeInitial = safeUser ? safeUser.charAt(0).toUpperCase() : '?';
                const avatarHtml = '<div class="ig-target-card-avatar ig-avatar-monogram" data-avatar-url="' + (avatarUrl || '') + '" data-username="' + safeUser + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

                const timeStr = t.lastAuditAt ? Utils.formatDate(t.lastAuditAt) : 'Recent';

                html += '<div class="ig-target-card" data-username="' + safeUser + '">';
                html += '  <div class="ig-target-card-top">';
                html += '    ' + avatarHtml;
                html += '    <div class="ig-target-card-info">';
                html += '      <div class="ig-target-card-name-row">';
                html += '        <span class="ig-target-card-user">@' + safeUser + '</span>';
                if (isVerified) html += '<span title="Verified">' + Icons.verified + '</span>';
                if (isPrivate) html += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + '</span>';
                html += '      </div>';
                if (safeName) html += '      <div class="ig-target-card-fullname">' + safeName + '</div>';
                html += '    </div>';
                html += '    <button class="ig-btn-target-delete btn-target-card-delete" data-username="' + safeUser + '" title="Remove from tracking">' + Icons.trash + '</button>';
                html += '  </div>';
                html += '  <div class="ig-target-card-metrics">';
                html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Followers</span><span class="ig-target-metric-val">' + Utils.formatNumber(fCount) + ' ' + diffBadge + '</span></div>';
                html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Following</span><span class="ig-target-metric-val">' + Utils.formatNumber(ingCount) + '</span></div>';
                html += '    <div class="ig-target-metric"><span class="ig-target-metric-label">Mutuals</span><span class="ig-target-metric-val">' + (t.isRestricted ? '-' : Utils.formatNumber(mutCount)) + '</span></div>';
                html += '  </div>';
                html += '  <div class="ig-target-card-footer">';
                html += '    <span class="ig-target-card-time">' + timeStr + '</span>';
                html += '    <div class="ig-target-card-actions">';
                html += '      <button class="ig-btn ig-btn-sm ig-btn-secondary btn-target-card-open" data-username="' + safeUser + '">' + Icons.target + ' View Details</button>';
                html += '      <button class="ig-btn ig-btn-sm ig-btn-primary btn-target-card-refresh" data-username="' + safeUser + '">' + Icons.refresh + ' Re-Audit</button>';
                html += '    </div>';
                html += '  </div>';
                html += '</div>';
            });
        }

        html += '</div>';
        container.innerHTML = html;
        UI.loadAvatarsProgressively(container);

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
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (window.App?.handleTargetSearch) window.App.handleTargetSearch();
                }
            };
        }
    }

});
