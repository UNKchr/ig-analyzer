import { UI } from './UIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { API } from '../API.js';
import { createBackupUI } from '../Backup.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(UI, {
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
            '    <div class="ig-header-actions">',
            '      <button id="ig-btn-minimize" class="ig-header-btn" title="Minimize / Expand" aria-label="Minimize or expand panel">' + Icons.minimize + '</button>',
            '      <button id="ig-btn-close" class="ig-header-btn ig-header-btn-close" title="Close Panel (F9 to reopen)" aria-label="Close panel">',
            '        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
            '      </button>',
            '    </div>',
            '  </div>',
            '</div>',
            '<div class="ig-actions-bar">',
            '  <button id="ig-run" class="ig-btn ig-btn-primary"><span class="ig-btn-icon">' + Icons.play + '</span>Run Analysis</button>',
            '  <button id="ig-export-csv" class="ig-btn ig-btn-success" disabled><span class="ig-btn-icon">' + Icons.download + '</span>Export CSV</button>',
            '  <button id="ig-reset" class="ig-btn ig-btn-danger"><span class="ig-btn-icon">' + Icons.trash + '</span>Reset</button>',
            '</div>',
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
            '  </div>',
            '</div>',
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
            '    <span class="ig-bmc-icon">' + Icons.coffee + '</span>',
            '    <span class="ig-bmc-text">Buy me a coffee</span>',
            '  </a>',
            '  <span class="ig-footer-meta">v3.13.1</span>',
            '</div>'
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
        UI.initHdModal();
        UI.initTargetSubpanel();

        // Header window controls
        const btnMin = panel.querySelector('#ig-btn-minimize');
        if (btnMin) {
            btnMin.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.toggleMinimize();
            });
        }
        const btnClose = panel.querySelector('#ig-btn-close');
        if (btnClose) {
            btnClose.addEventListener('click', (e) => {
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
        }).catch(() => {});
    },

    setupThemeObserver: () => {
        let rafId = null;

        const checkTheme = () => {
            const panel = document.getElementById('ig-analyzer-panel');
            const subpanel = document.getElementById('ig-target-subpanel');
            const safetyModal = document.getElementById('ig-safety-modal');
            const targets = [panel, subpanel, safetyModal].filter(Boolean);
            if (targets.length === 0) return;

            const html = document.documentElement;
            const body = document.body;

            // 1. Check for explicit dark mode classes/attributes on Instagram Web
            const isExplicitDark = html.classList.contains('_aa55') || 
                                   html.getAttribute('data-theme') === 'dark' || 
                                   (body && body.getAttribute('data-theme') === 'dark');

            if (isExplicitDark) {
                targets.forEach(t => t.classList.remove('ig-light-theme'));
                return;
            }

            // 2. Check for explicit light mode attribute
            const isExplicitLight = html.getAttribute('data-theme') === 'light' ||
                                    (body && body.getAttribute('data-theme') === 'light');

            if (isExplicitLight) {
                targets.forEach(t => t.classList.add('ig-light-theme'));
                return;
            }

            // 3. Computed background color with Instagram light theme (#fafafa / rgb(250, 250, 250)) tolerance
            const bodyBg = window.getComputedStyle(body || html).backgroundColor;
            const isLightBg = bodyBg === 'rgb(255, 255, 255)' || 
                              bodyBg === '#ffffff' || 
                              bodyBg === 'white' || 
                              bodyBg === 'rgb(250, 250, 250)' || 
                              bodyBg === '#fafafa';

            if (isLightBg) {
                targets.forEach(t => t.classList.add('ig-light-theme'));
                return;
            }

            // 4. Fallback to OS prefers-color-scheme
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                targets.forEach(t => t.classList.add('ig-light-theme'));
            } else {
                targets.forEach(t => t.classList.remove('ig-light-theme'));
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

        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', checkTheme);
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
                indicator.style.transition = 'none';
            } else {
                indicator.style.transition = '';
            }

            const left = activeBtn.offsetLeft;
            const top = activeBtn.offsetTop;
            const width = activeBtn.offsetWidth;
            const height = activeBtn.offsetHeight;

            indicator.style.transform = `translate3d(${left}px, ${top}px, 0)`;
            indicator.style.width = `${width}px`;
            indicator.style.height = `${height}px`;
            indicator.style.opacity = '1';

            if (!animate) {
                indicator.offsetHeight;
                indicator.style.transition = '';
            }
        };

        const btns = tabsContainer.querySelectorAll(".ig-tab-btn");
        btns.forEach((btn) => {
            btn.onclick = (e) => {
                const target = e.target.closest('.ig-tab-btn');
                if (!target) return;

                // Center tab horizontally inside tabsContainer without triggering ancestor scroll
                const scrollLeft = target.offsetLeft - (tabsContainer.offsetWidth / 2) + (target.offsetWidth / 2);
                tabsContainer.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });

                const targetId = target.getAttribute("data-target");
                if (!targetId) return;

                // Only deactivate buttons and views inside the main panel
                btns.forEach((b) => b.classList.remove("active"));
                if (panel) {
                    panel.querySelectorAll(".ig-view").forEach((v) => v.classList.remove("active"));
                }
                target.classList.add("active");
                const targetView = panel ? panel.querySelector(`#${targetId}`) : document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.add("active");
                    if (typeof UI.loadAvatarsProgressively === 'function') {
                        UI.loadAvatarsProgressively(targetView);
                    }
                }
                updateIndicator(target, true);
            };
        });

        // Enable horizontal scrolling with mouse wheel directly over the tab bar
        tabsContainer.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                e.stopPropagation();
                tabsContainer.scrollLeft += e.deltaY;
            }
        }, { passive: false });

        // Keep indicator aligned during horizontal scroll
        tabsContainer.addEventListener('scroll', () => {
            const currentActive = tabsContainer.querySelector('.ig-tab-btn.active');
            if (currentActive) {
                updateIndicator(currentActive, false);
            }
        }, { passive: true });

        // Initialize indicator on the active tab once rendered
        requestAnimationFrame(() => {
            const activeBtn = tabsContainer.querySelector('.ig-tab-btn.active');
            if (activeBtn) {
                updateIndicator(activeBtn, false);
            }
        });

        UI.updateTabIndicator = updateIndicator;

        window.addEventListener('resize', () => {
            const currentActive = tabsContainer.querySelector('.ig-tab-btn.active');
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
            if (e.target.closest('.ig-header-btn, #ig-status')) return;
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
        panel.style.top = (CONFIG.DEFAULT_POSITION.top || 80) + "px";
        panel.style.right = (CONFIG.DEFAULT_POSITION.right || 20) + "px";
        panel.style.width = (CONFIG.DEFAULT_POSITION.width || 717) + "px";
        panel.style.height = (CONFIG.DEFAULT_POSITION.height || 560) + "px";
        GM_deleteValue(CONFIG.POSITION_KEY);
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
            mainPanel &&
            mainPanel.style.display !== "none" &&
            (mainPanel.offsetParent !== null || window.getComputedStyle(mainPanel).display !== "none")
        );
        const isSubVisible = Boolean(
            subpanel &&
            subpanel.style.display !== "none" &&
            (subpanel.offsetParent !== null || window.getComputedStyle(subpanel).display !== "none")
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
        { id: 'all', label: 'All', icon: null },
        { id: 'private', label: 'Private', icon: Icons.lock },
        { id: 'public', label: 'Public', icon: null },
        { id: 'besties', label: 'Besties', icon: Icons.star },
        { id: 'pending', label: 'Pending', icon: Icons.clock },
        { id: 'story', label: 'With Story', icon: Icons.storyRing },
        { id: 'verified', label: 'Verified', icon: Icons.verified }
    ]
});
