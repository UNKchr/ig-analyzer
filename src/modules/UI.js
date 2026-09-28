import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { API } from './API.js';
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
            '  <span class="ig-footer-meta">v3.12.0</span>',
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
                UI.togglePanel();
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

    currentHdUser: null,
    hdModalAbortController: null,

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

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById("ig-hd-modal");
        const closeBtn = document.getElementById("ig-hd-close-btn");

        const closeModal = () => {
            if (modal) {
                modal.style.display = "none";
                modal.setAttribute('aria-hidden', 'true');
            }
            if (UI.hdModalAbortController) {
                UI.hdModalAbortController.abort();
                UI.hdModalAbortController = null;
            }
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
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

        const safeUsername = u.username || '';
        const safeFullName = u.fullName || '';
        const initialAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
        const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
        const isBestie = Boolean(u.isBestie);

        usernameEl.textContent = '@' + safeUsername;
        fullnameEl.textContent = safeFullName;
        verifiedEl.style.display = u.isVerified ? 'inline-flex' : 'none';

        badgesEl.innerHTML = UI.renderUserBadgesHtml(u);

        frameEl.className = 'ig-hd-avatar-frame';
        if (isBestie) {
            frameEl.classList.add('has-bestie-ring');
        } else if (hasStory) {
            frameEl.classList.add('has-story-ring');
        }

        imgEl.onerror = () => {
            imgEl.style.display = 'none';
            fallbackEl.style.display = 'flex';
        };
        imgEl.onload = () => {
            imgEl.style.display = 'block';
            fallbackEl.style.display = 'none';
        };

        if (initialAvatarUrl) {
            imgEl.src = initialAvatarUrl;
        } else {
            imgEl.style.display = 'none';
            fallbackEl.style.display = 'flex';
            fallbackEl.textContent = safeUsername.charAt(0).toUpperCase() || '?';
        }

        const profileUrl = Utils.sanitizeUrl(safeUsername, u.url);
        linkProfile.href = profileUrl;
        linkOpenTab.href = initialAvatarUrl || profileUrl;

        let currentTargetUrl = initialAvatarUrl;
        btnDownload.onclick = () => {
            if (currentTargetUrl) {
                const ext = currentTargetUrl.includes('.png') ? 'png' : 'jpg';
                Utils.downloadImage(currentTargetUrl, `@${safeUsername}_profile_pic.${ext}`);
            }
        };

        // Initial preview counts
        followersEl.textContent = Utils.formatNumber(u.followerCount ?? u.followersCount ?? null);
        followingEl.textContent = Utils.formatNumber(u.followingCount ?? null);
        postsEl.textContent = Utils.formatNumber(u.mediaCount ?? null);

        // Initial preview bio
        if (u.biography) {
            bioCardEl.style.display = 'block';
            bioTextEl.textContent = u.biography;
        } else {
            bioCardEl.style.display = 'none';
        }

        // Initial preview mutuals
        if (typeof u.mutualsCount === 'number' && u.mutualsCount > 0) {
            mutualsCardEl.style.display = 'block';
            mutualsSummaryEl.textContent = `${u.mutualsCount} mutual connection${u.mutualsCount === 1 ? '' : 's'}`;
            facepileEl.innerHTML = '';
        } else {
            mutualsCardEl.style.display = 'none';
        }

        // Initial preview relationship pills
        const cachedFriendship = u.id ? API.friendshipCache.get(String(u.id)) : null;
        let relPills = '';
        if (cachedFriendship) {
            relPills += cachedFriendship.following
                ? '<span class="ig-qc-rel-pill is-neutral">Following</span>'
                : '<span class="ig-qc-rel-pill">Not following</span>';
            if (cachedFriendship.outgoingRequest) {
                relPills += '<span class="ig-qc-rel-pill is-pending">Request Pending</span>';
            }
        } else if (u.containerId === 'ig-view-mutuals') {
            relPills = '<span class="ig-qc-rel-pill is-positive">Follows you</span><span class="ig-qc-rel-pill is-neutral">You follow</span>';
        } else if (u.containerId === 'ig-view-notfollowing') {
            relPills = '<span class="ig-qc-rel-pill is-negative">Does not follow you</span><span class="ig-qc-rel-pill is-neutral">You follow</span>';
        } else if (u.containerId === 'ig-view-fans') {
            relPills = '<span class="ig-qc-rel-pill is-positive">Follows you</span><span class="ig-qc-rel-pill">You don\'t follow</span>';
        }
        relBarEl.innerHTML = relPills;

        pillEl.className = 'ig-hd-res-pill';
        pillEl.innerHTML = '<span class="ig-hd-spinner"></span> Loading 1080p...';

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // 2. Background GraphQL query for true 1080p & complete profile data
        try {
            const hdData = await API.fetchUserProfileHd(u.id, safeUsername, { signal });
            if (signal.aborted) return;

            if (hdData) {
                // Update stats
                followersEl.textContent = Utils.formatNumber(hdData.followerCount);
                followingEl.textContent = Utils.formatNumber(hdData.followingCount);
                postsEl.textContent = Utils.formatNumber(hdData.mediaCount);

                // Update Badges
                badgesEl.innerHTML = UI.renderUserBadgesHtml(hdData);

                // Update Relationship Bar
                let finalRelPills = '';
                finalRelPills += hdData.followedBy
                    ? '<span class="ig-qc-rel-pill is-positive">Follows you</span>'
                    : '<span class="ig-qc-rel-pill is-negative">Does not follow you</span>';
                finalRelPills += hdData.following
                    ? '<span class="ig-qc-rel-pill is-neutral">Following</span>'
                    : '<span class="ig-qc-rel-pill">Not following</span>';
                if (hdData.outgoingRequest) {
                    finalRelPills += '<span class="ig-qc-rel-pill is-pending">Request Pending</span>';
                }
                relBarEl.innerHTML = finalRelPills;

                // Update Bio
                if (hdData.biography) {
                    bioCardEl.style.display = 'block';
                    bioTextEl.textContent = hdData.biography;
                } else {
                    bioCardEl.style.display = 'none';
                }

                if (hdData.externalUrl) {
                    bioLinkEl.style.display = 'inline-flex';
                    bioLinkEl.href = hdData.externalUrl;
                    bioLinkTextEl.textContent = hdData.externalUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                } else {
                    bioLinkEl.style.display = 'none';
                }

                // Update Mutuals Context
                if (typeof hdData.mutualsCount === 'number' && hdData.mutualsCount > 0) {
                    mutualsCardEl.style.display = 'block';
                    if (hdData.mutualUsers && hdData.mutualUsers.length > 0) {
                        const namedMutuals = hdData.mutualUsers.slice(0, 2).map((m) => '@' + m).join(', ');
                        const remaining = hdData.mutualsCount - hdData.mutualUsers.slice(0, 2).length;
                        mutualsSummaryEl.textContent = `Followed by ${namedMutuals}${remaining > 0 ? ` and ${remaining} other${remaining === 1 ? '' : 's'}` : ''}`;
                    } else {
                        mutualsSummaryEl.textContent = `${hdData.mutualsCount} mutual connection${hdData.mutualsCount === 1 ? '' : 's'}`;
                    }

                    if (hdData.facepileUsers && hdData.facepileUsers.length > 0) {
                        facepileEl.innerHTML = hdData.facepileUsers.slice(0, 5).map((f) => 
                            `<img class="ig-facepile-avatar" src="${f.profilePicUrl}" alt="Mutual" />`
                        ).join('');
                    } else {
                        facepileEl.innerHTML = '';
                    }
                } else {
                    mutualsCardEl.style.display = 'none';
                }

                // HD Avatar Image
                if (hdData.hdUrl) {
                    const cleanHdUrl = Utils.sanitizeImageUrl(hdData.hdUrl);
                    if (cleanHdUrl) {
                        const preload = new Image();
                        preload.onload = () => {
                            if (signal.aborted) return;
                            imgEl.src = cleanHdUrl;
                            imgEl.style.display = 'block';
                            fallbackEl.style.display = 'none';
                            currentTargetUrl = cleanHdUrl;
                            linkOpenTab.href = cleanHdUrl;

                            pillEl.className = 'ig-hd-res-pill is-hd';
                            pillEl.innerHTML = `${Icons.verified} 1080p Full HD`;

                            btnDownload.onclick = () => {
                                Utils.downloadImage(cleanHdUrl, `@${safeUsername}_profile_1080p.jpg`);
                            };
                        };
                        preload.onerror = () => {
                            if (signal.aborted) return;
                            pillEl.className = 'ig-hd-res-pill';
                            pillEl.innerHTML = `Standard Resolution`;
                        };
                        preload.src = cleanHdUrl;
                    } else {
                        pillEl.className = 'ig-hd-res-pill';
                        pillEl.innerHTML = `Standard Resolution`;
                    }
                } else {
                    pillEl.className = 'ig-hd-res-pill';
                    pillEl.innerHTML = `Standard Resolution`;
                }

                if (hdData.isBestie) {
                    frameEl.classList.add('has-bestie-ring');
                }
            }
        } catch (err) {
            if (signal.aborted) return;
            console.warn('[IG Analyzer] Quick-Card profile fetch skipped/failed:', err);
            pillEl.className = 'ig-hd-res-pill';
            pillEl.innerHTML = `Standard Resolution`;
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
                if (targetView) targetView.classList.add("active");
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

        if (Array.isArray(snapshot.newFollowersDetailed) && snapshot.newFollowersDetailed.length > 0) {
            UI.renderNewFollowers(snapshot.newFollowersDetailed);
        } else {
            UI.renderNewFollowers(Storage.getNewFollowersList());
        }

        UI.renderWhitelist(Array.isArray(snapshot.whitelist) ? snapshot.whitelist : Storage.getWhitelist());

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
            if (text && text.toLowerCase() !== 'inactive') {
                el.classList.add('is-active');
            } else {
                el.classList.remove('is-active');
            }
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
            const percent = Math.min(Math.max(Math.round((current / total) * 100), 0), 100);
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

    CHIPS_DEF: [
        { id: 'all', label: 'All', icon: null },
        { id: 'private', label: 'Private', icon: Icons.lock },
        { id: 'public', label: 'Public', icon: null },
        { id: 'besties', label: 'Besties', icon: Icons.star },
        { id: 'pending', label: 'Pending', icon: Icons.clock },
        { id: 'story', label: 'With Story', icon: Icons.storyRing },
        { id: 'verified', label: 'Verified', icon: Icons.verified }
    ],

    getFilterCounts: (rawUsers, searchQuery = '') => {
        const query = (searchQuery || '').trim().toLowerCase();
        const baseList = query
            ? (rawUsers || []).filter((u) => {
                const uName = (u.username || '').toLowerCase();
                const fName = (u.fullName || '').toLowerCase();
                return uName.includes(query) || fName.includes(query);
            })
            : (rawUsers || []);

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

        const query = (state.searchQuery || '').trim().toLowerCase();
        const filter = state.filterType || 'all';

        state.users = (state.rawUsers || []).filter((u) => {
            if (query) {
                const uName = (u.username || '').toLowerCase();
                const fName = (u.fullName || '').toLowerCase();
                if (!uName.includes(query) && !fName.includes(query)) {
                    return false;
                }
            }

            if (filter === 'private') return Boolean(u.isPrivate);
            if (filter === 'public') return u.isPrivate === false;
            if (filter === 'besties') return Boolean(u.isBestie);
            if (filter === 'pending') return Boolean(u.outgoingRequest);
            if (filter === 'story') return Boolean(u.latestReelMedia && u.latestReelMedia > 0);
            if (filter === 'verified') return Boolean(u.isVerified);

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

        const chipsBar = container.querySelector('.ig-filter-chips');
        if (!chipsBar) return;

        const counts = UI.getFilterCounts(state.rawUsers, state.searchQuery);
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
    },

    getActiveViewUsers: () => {
        const activeTab = document.querySelector('#ig-tabs .ig-tab-btn.active');
        if (!activeTab) return null;
        const targetId = activeTab.getAttribute('data-target');
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

    renderUserBadgesHtml: (u) => {
        let badges = '';
        if (u?.isPrivate) {
            badges += '<span class="ig-badge-pill ig-badge-private" title="Private Account">' + Icons.lock + '</span>';
        }
        if (u?.isBestie) {
            badges += '<span class="ig-badge-pill ig-badge-bestie" title="Close Friends">' + Icons.star + ' Bestie</span>';
        }
        if (u?.outgoingRequest) {
            badges += '<span class="ig-badge-pill ig-badge-pending" title="Follow Request Pending">' + Icons.clock + ' Pending</span>';
        }
        if (u?.isBusiness) {
            badges += '<span class="ig-badge-pill ig-badge-business" title="' + (u.category ? Utils.escapeHtml(u.category) : 'Business Account') + '">' + Icons.briefcase + ' Business</span>';
        } else if (u?.isCreator) {
            badges += '<span class="ig-badge-pill ig-badge-creator" title="' + (u.category ? Utils.escapeHtml(u.category) : 'Content Creator') + '">' + Icons.creator + ' Creator</span>';
        }
        if (u?.followsBack === true) {
            badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + ' Mutual</span>';
        } else if (u?.followsBack === false) {
            badges += '<span class="ig-badge-pill ig-badge-fan" title="You do not follow them back">' + Icons.fans + ' Fan</span>';
        }
        if (u?.date) {
            badges += '<span class="ig-badge-pill ig-badge-date" title="First detected on ' + Utils.escapeHtml(u.date) + '">' + Icons.clock + ' ' + Utils.escapeHtml(u.date) + '</span>';
        }
        return badges;
    },

    renderResultsPage: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const { rawUsers, users, title, isExportable, pageSize, searchQuery, filterType } = state;
        const safeTitle = Utils.escapeHtml(title);
        const totalRaw = (rawUsers || []).length;
        const totalFiltered = (users || []).length;

        // If rawUsers has nothing at all, show initial empty state
        if (totalRaw === 0) {
            container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No data available yet.</div>';
            if (isExportable) {
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

        let headerEl = container.querySelector('.ig-view-header');
        let toolbarEl = container.querySelector('.ig-filter-toolbar');
        let listEl = container.querySelector('.ig-view-list');
        let paginationEl = container.querySelector('.ig-view-pagination');

        const badgeCountText = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;

        if (!toolbarEl) {
            // First time render: Build complete skeleton
            const counts = UI.getFilterCounts(rawUsers, searchQuery);
            let chipsHtml = '';
            UI.CHIPS_DEF.forEach((chip) => {
                const isActive = (filterType || 'all') === chip.id;
                const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : '';
                chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? ' is-active' : ''}" data-filter="${chip.id}">` +
                    iconHtml +
                    `<span class="ig-chip-label">${chip.label}</span>` +
                    `<span class="ig-chip-count">${counts[chip.id] || 0}</span>` +
                    `</button>`;
            });

            const clearStyle = searchQuery ? 'display: inline-flex;' : 'display: none;';
            const skeletonHtml = [
                '<div class="ig-view-header">',
                '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>',
                '</div>',
                '<div class="ig-filter-toolbar">',
                '  <div class="ig-search-box">',
                '    <span class="ig-search-icon">' + Icons.search + '</span>',
                '    <input type="text" class="ig-search-input" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || '') + '" autocomplete="off" spellcheck="false" />',
                '    <button type="button" class="ig-search-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + '</button>',
                '  </div>',
                '  <div class="ig-filter-chips">' + chipsHtml + '</div>',
                '</div>',
                '<div class="ig-view-list"></div>',
                '<div class="ig-view-pagination"></div>'
            ].join('\n');

            container.innerHTML = skeletonHtml;

            headerEl = container.querySelector('.ig-view-header');
            toolbarEl = container.querySelector('.ig-filter-toolbar');
            listEl = container.querySelector('.ig-view-list');
            paginationEl = container.querySelector('.ig-view-pagination');

            // Bind search input events
            const searchInput = toolbarEl.querySelector('.ig-search-input');
            const clearBtn = toolbarEl.querySelector('.ig-search-clear');
            let searchTimeout = null;

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        state.searchQuery = val;
                        UI.applyFilters(containerId);
                    }, 120);
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && searchInput.value) {
                        e.preventDefault();
                        searchInput.value = '';
                        if (clearBtn) clearBtn.style.display = 'none';
                        state.searchQuery = '';
                        UI.applyFilters(containerId);
                    }
                });
            }

            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    state.searchQuery = '';
                    searchInput.focus();
                    UI.applyFilters(containerId);
                });
            }

            // Bind filter chips
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
                    UI.applyFilters(containerId);
                });
            }
        } else {
            // Already mounted: update header badge and chips without touching input focus
            if (headerEl) {
                headerEl.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>';
            }
            UI.updateFilterChips(containerId);
            const clearBtn = toolbarEl.querySelector('.ig-search-clear');
            if (clearBtn) {
                clearBtn.style.display = state.searchQuery ? 'inline-flex' : 'none';
            }
        }

        // Render rows in listEl
        let rowsHtml = '';
        if (totalFiltered === 0) {
            rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No users match your search or filter criteria.</div>';
        } else {
            pageUsers.forEach((u, index) => {
                const globalIndex = startIndex + index;
                const uniqueId = containerId + "-row-" + globalIndex;
                const safeUsername = Utils.escapeHtml(u.username || '');
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';
                const safeUrl = Utils.sanitizeUrl(u.username, u.url);
                const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : '';
                const isVerified = Boolean(u.isVerified);
                const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
                const isBestieStory = hasStory && Boolean(u.isBestie);
                const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);

                let avatarStyle = 'object-fit:cover;';
                if (isBestieStory) {
                    avatarStyle += ' outline: 2px solid #22c55e; outline-offset: 1px;';
                } else if (hasStory) {
                    avatarStyle += ' outline: 2px solid #e1306c; outline-offset: 1px;';
                }

                const avatarClass = 'ig-user-avatar' + (isBestieStory ? ' has-bestie-ring' : '');
                const avatarHtml = safeAvatarUrl
                    ? '<img class="' + avatarClass + '" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" style="' + avatarStyle + '" />'
                    : '<span class="' + avatarClass + '" style="' + avatarStyle + '">' + safeInitial + '</span>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${Utils.escapeHtml(u.id || '')}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                const badgesHtml = UI.renderUserBadgesHtml(u);

                rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '">';
                rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
                rowsHtml += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                rowsHtml += '<div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
                rowsHtml += '<span class="ig-username">' + safeUsername + '</span>';
                if (isVerified) {
                    rowsHtml += '<span title="Verified" style="display:inline-flex; align-items:center;">' + Icons.verified + '</span>';
                }
                rowsHtml += '<span class="ig-user-badges" id="' + uniqueId + '-badges">' + badgesHtml + '</span>';
                rowsHtml += '</div>';
                if (safeFullName) {
                    rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                }
                rowsHtml += '</div></div>';
                rowsHtml += '<div class="ig-user-actions">';
                if (containerId === "ig-view-notfollowing") {
                    rowsHtml += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
                }
                rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || '') + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers") {
                    rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                    rowsHtml += '<button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '">' + Icons.spy + ' Check Story</button>';
                }
                rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                rowsHtml += '</div></div>';
            });
        }
        if (listEl) listEl.innerHTML = rowsHtml;

        // Render pagination in paginationEl
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += '<div class="ig-pagination">';
            paginationHtml += '<button class="ig-page-btn ig-page-prev" data-container="' + containerId + '"' + (page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>';
            paginationHtml += '<span class="ig-page-info">Page ' + page + ' of ' + totalPages + ' (' + totalFiltered + ' users)</span>';
            paginationHtml += '<button class="ig-page-btn ig-page-next" data-container="' + containerId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>';
            paginationHtml += '</div>';
        }
        if (paginationEl) paginationEl.innerHTML = paginationHtml;

        if (isExportable) {
            const exportBtn = document.getElementById("ig-export-csv");
            if (exportBtn) exportBtn.disabled = totalFiltered === 0 && totalRaw === 0;
        }

        // Enrich visible page with batch friendship statuses (show_many)
        const userIdsToFetch = pageUsers
            .map((u) => u.id)
            .filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");

        if (userIdsToFetch.length > 0 && typeof API.fetchFriendshipStatusesMany === 'function') {
            API.fetchFriendshipStatusesMany(userIdsToFetch)
                .then((statusMap) => {
                    const currentState = UI.paginationState[containerId];
                    if (!currentState || currentState.page !== page) return;

                    pageUsers.forEach((u, index) => {
                        if (!u.id) return;
                        const status = statusMap[u.id];
                        if (!status) return;

                        let stateChanged = false;
                        if (u.isPrivate !== status.isPrivate) {
                            u.isPrivate = status.isPrivate;
                            stateChanged = true;
                        }
                        if (u.isBestie !== status.isBestie) {
                            u.isBestie = status.isBestie;
                            stateChanged = true;
                        }
                        if (u.outgoingRequest !== status.outgoingRequest) {
                            u.outgoingRequest = status.outgoingRequest;
                            stateChanged = true;
                        }

                        if (stateChanged) {
                            const rowId = containerId + "-row-" + (startIndex + index);
                            const badgeContainer = document.getElementById(rowId + "-badges");
                            if (badgeContainer) {
                                badgeContainer.innerHTML = UI.renderUserBadgesHtml(u);
                            }
                            if (status.isBestie && u.latestReelMedia > 0) {
                                const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
                                if (avatarEl) {
                                    avatarEl.classList.add("has-bestie-ring");
                                    avatarEl.style.outlineColor = "#22c55e";
                                }
                            }
                        }
                    });

                    UI.updateFilterChips(containerId);
                })
                .catch((err) => {
                    console.warn("[IG Analyzer] Error updating friendship statuses batch:", err);
                });
        }
    },

    renderResults: (users, title, containerId, isExportable = false) => {
        const safeUsers = Array.isArray(users) ? users : [];
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
            page: 1,
            pageSize: 50,
            searchQuery: '',
            filterType: 'all'
        };
        UI.renderResultsPage(containerId);
    },

    renderNewFollowers: (users, containerId = "ig-view-newfollowers") => {
        const safeUsers = Array.isArray(users) ? users : [];
        UI.renderResults(safeUsers, "New Followers", containerId, true);
    },

    whitelistSearchQuery: '',

    renderWhitelist: (whitelistUsers, containerId = "ig-view-whitelist") => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rawList = Array.isArray(whitelistUsers) ? whitelistUsers : [];
        const safeTitle = "Ignored Accounts (Whitelist)";
        const total = rawList.length;

        if (total === 0) {
            container.innerHTML = '<div class="ig-view-header">' +
                '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '</div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.shieldCheck + '</span>No ignored accounts in whitelist.</div>';
            return;
        }

        const query = (UI.whitelistSearchQuery || '').trim().toLowerCase();
        const filteredList = query 
            ? rawList.filter((u) => String(u || '').toLowerCase().includes(query))
            : rawList;

        const badgeText = filteredList.length !== total ? `${filteredList.length} / ${total}` : `${total}`;

        let html = [
            '<div class="ig-view-header" style="display:flex; justify-content:space-between; align-items:center;">',
            '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeText + '</span></div>',
            '  <button type="button" class="ig-btn-clear-whitelist btn-clear-whitelist" title="Clear all ignored accounts">' + Icons.trash + ' Clear All</button>',
            '</div>',
            '<div class="ig-filter-toolbar">',
            '  <div class="ig-search-box">',
            '    <span class="ig-search-icon">' + Icons.search + '</span>',
            '    <input type="text" class="ig-search-input ig-whitelist-search-input" placeholder="Search ignored accounts..." value="' + Utils.escapeHtml(UI.whitelistSearchQuery || '') + '" autocomplete="off" spellcheck="false" />',
            '    <button type="button" class="ig-search-clear ig-whitelist-search-clear" title="Clear search" style="' + (UI.whitelistSearchQuery ? 'display:inline-flex;' : 'display:none;') + '">' + Icons.clear + '</button>',
            '  </div>',
            '</div>',
            '<div class="ig-view-list">'
        ].join('\n');

        if (filteredList.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No accounts match your search.</div>';
        } else {
            const snapshot = Storage.load();
            const knownUsersMap = new Map();
            if (snapshot) {
                const candidates = [
                    ...(snapshot.followingDetailed || []),
                    ...(snapshot.followersDetailed || []),
                    ...(snapshot.notFollowingBackDetailed || [])
                ];
                candidates.forEach((u) => {
                    if (u?.username && !knownUsersMap.has(u.username)) {
                        knownUsersMap.set(u.username, u);
                    }
                });
            }

            filteredList.slice().reverse().forEach((username, idx) => {
                const safeUsername = Utils.escapeHtml(username);
                const safeUrl = Utils.sanitizeUrl(username);
                const known = knownUsersMap.get(username);
                const safeFullName = known?.fullName ? Utils.escapeHtml(known.fullName) : '';
                const safeAvatarUrl = known?.profilePicUrl ? Utils.sanitizeImageUrl(known.profilePicUrl) : null;
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';

                const avatarHtml = safeAvatarUrl
                    ? '<img class="ig-user-avatar" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" style="object-fit:cover;" />'
                    : '<span class="ig-user-avatar">' + safeInitial + '</span>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                html += '<div class="ig-user-row" id="wl-row-' + idx + '" data-user="' + safeUsername + '">';
                html += '<div class="ig-user-info">' + avatarTriggerHtml;
                html += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                html += '<span class="ig-username">' + safeUsername + '</span>';
                if (safeFullName) {
                    html += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                }
                html += '</div></div>';
                html += '<div class="ig-user-actions">';
                html += '<button class="ig-btn-unwhitelist btn-unwhitelist" data-user="' + safeUsername + '" title="Restore to Not Following">' + Icons.restore + ' Restore</button>';
                html += '<button class="ig-btn-inspect-user btn-inspect-user" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                html += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                html += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                html += '</div></div>';
            });
        }

        html += '</div>';
        container.innerHTML = html;

        // Bind search input events
        const searchInput = container.querySelector('.ig-whitelist-search-input');
        const clearBtn = container.querySelector('.ig-whitelist-search-clear');
        let searchTimeout = null;

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    UI.whitelistSearchQuery = val;
                    UI.renderWhitelist(whitelistUsers, containerId);
                }, 120);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && searchInput.value) {
                    e.preventDefault();
                    searchInput.value = '';
                    UI.whitelistSearchQuery = '';
                    UI.renderWhitelist(whitelistUsers, containerId);
                }
            });
        }

        if (clearBtn && searchInput) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchInput.value = '';
                UI.whitelistSearchQuery = '';
                UI.renderWhitelist(whitelistUsers, containerId);
            });
        }
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
            container.innerHTML = html;
            return;
        }

        const reversedHistory = historyData.slice().reverse();
        const latest = reversedHistory[0];
        const prev = reversedHistory.length > 1 ? reversedHistory[1] : null;

        const currentFollowers = latest ? Utils.formatNumber(latest.followers) : '-';
        const currentFollowing = latest ? Utils.formatNumber(latest.following) : '-';

        let followerDiffText = 'First record';
        let followerDiffClass = 'is-neutral';
        let followerDiffIcon = Icons.neutral;

        let followingDiffText = 'First record';
        let followingDiffClass = 'is-neutral';
        let followingDiffIcon = Icons.neutral;

        if (prev) {
            const fDiff = latest.followers - prev.followers;
            if (fDiff > 0) {
                followerDiffText = '+' + fDiff + ' vs previous';
                followerDiffClass = 'is-positive';
                followerDiffIcon = Icons.trendingUp;
            } else if (fDiff < 0) {
                followerDiffText = fDiff + ' vs previous';
                followerDiffClass = 'is-negative';
                followerDiffIcon = Icons.trendingDown;
            } else {
                followerDiffText = 'No change vs previous';
            }

            const ingDiff = latest.following - prev.following;
            if (ingDiff > 0) {
                followingDiffText = '+' + ingDiff + ' vs previous';
                followingDiffClass = 'is-positive';
                followingDiffIcon = Icons.trendingUp;
            } else if (ingDiff < 0) {
                followingDiffText = ingDiff + ' vs previous';
                followingDiffClass = 'is-negative';
                followingDiffIcon = Icons.trendingDown;
            } else {
                followingDiffText = 'No change vs previous';
            }
        }

        const churnCount = Storage.getNominalList(CONFIG.CHURN_KEY).length;
        const newCount = Storage.getNewFollowersList().length;
        const netFlow = newCount - churnCount;
        const netFlowSign = netFlow > 0 ? '+' : '';
        const netFlowClass = netFlow > 0 ? 'is-positive' : (netFlow < 0 ? 'is-negative' : 'is-neutral');

        html += [
            '<div class="ig-history-kpi-grid">',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Followers</div>',
            '    <div class="ig-kpi-value">' + currentFollowers + '</div>',
            '    <div class="ig-kpi-sub ' + followerDiffClass + '">' + followerDiffIcon + ' <span>' + followerDiffText + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Following</div>',
            '    <div class="ig-kpi-value">' + currentFollowing + '</div>',
            '    <div class="ig-kpi-sub ' + followingDiffClass + '">' + followingDiffIcon + ' <span>' + followingDiffText + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Audience Balance</div>',
            '    <div class="ig-kpi-value ' + netFlowClass + '">' + netFlowSign + netFlow + '</div>',
            '    <div class="ig-kpi-sub"><span style="color:#22c55e; font-weight:600;">+' + newCount + '</span> new / <span style="color:#ef4444; font-weight:600;">-' + churnCount + '</span> lost</div>',
            '  </div>',
            '</div>'
        ].join('\n');

        html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th></tr></thead><tbody>';
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
    
    togglePanel: () => {
        const p = document.getElementById("ig-analyzer-panel");
        if (p) p.style.display = p.style.display === "none" ? "flex" : "none";
    },

    currentTargetUser: null,
    targetPaginationState: {},

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
            '    <button class="ig-tab-btn" data-target="ig-target-view-newfollowers"><span class="ig-tab-icon">' + Icons.userPlus + '</span><span class="ig-tab-label">New Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-lostfollowers"><span class="ig-tab-icon">' + Icons.unfollowers + '</span><span class="ig-tab-label">Lost Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-followers"><span class="ig-tab-icon">' + Icons.fans + '</span><span class="ig-tab-label">Followers</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-following"><span class="ig-tab-icon">' + Icons.notFollowing + '</span><span class="ig-tab-label">Following</span></button>',
            '    <button class="ig-tab-btn" data-target="ig-target-view-logs"><span class="ig-tab-icon">' + Icons.logs + '</span><span class="ig-tab-label">Logs</span></button>',
            '  </div>',
            '</div>',
            '<div id="ig-target-view-overview" class="ig-view-container ig-view ig-target-view active"></div>',
            '<div id="ig-target-view-mutuals" class="ig-view-container ig-view ig-target-view"></div>',
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
                if (targetView) targetView.classList.add("active");
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
            ['mutuals', 'newfollowers', 'lostfollowers', 'followers', 'following'].forEach((key) => {
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

        const avatarHtml = avatarUrl
            ? '<img class="ig-user-avatar" src="' + avatarUrl + '" alt="' + safeUser + '" />'
            : '<span class="ig-user-avatar">' + (safeUser ? safeUser.charAt(0).toUpperCase() : '?') + '</span>';

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
        html += '    <div class="ig-kpi-sub is-neutral">' + Icons.mutuals + ' <span>' + (isRestricted ? 'Restricted' : 'Internal Mutuals') + '</span></div>';
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
    },

    renderTargetLists: (targetData) => {
        if (!targetData) return;
        UI.renderTargetSingleList("ig-target-view-mutuals", targetData.mutuals || [], "Mutual Connections", "No mutual connections found.");
        UI.renderTargetSingleList("ig-target-view-newfollowers", targetData.newFollowers || [], "New Followers Gained", "No new followers detected since last scan.", { isNewBadge: true });
        UI.renderTargetSingleList("ig-target-view-lostfollowers", targetData.lostFollowers || [], "Followers Lost", "No lost followers detected since last scan.", { isLostBadge: true });
        UI.renderTargetSingleList("ig-target-view-followers", targetData.followers || [], "Target Followers", "No followers data available.");
        UI.renderTargetSingleList("ig-target-view-following", targetData.following || [], "Target Following", "No following data available.");
    },

    renderTargetSingleList: (containerId, rawList, title, emptyMsg, options = {}) => {
        const safeList = Array.isArray(rawList) ? rawList : [];
        UI.targetPaginationState[containerId] = {
            rawUsers: safeList,
            users: safeList,
            searchQuery: '',
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

        const { rawUsers, users, title, emptyMsg, options, searchQuery } = state;
        const totalRaw = (rawUsers || []).length;
        const totalFiltered = (users || []).length;
        const safeTitle = Utils.escapeHtml(title);

        if (totalRaw === 0) {
            container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>' + Utils.escapeHtml(emptyMsg) + '</div>';
            return;
        }

        let toolbarEl = container.querySelector('.ig-filter-toolbar');
        let listEl = container.querySelector('.ig-view-list');

        if (!toolbarEl) {
            const clearStyle = searchQuery ? 'display: inline-flex;' : 'display: none;';
            container.innerHTML = [
                '<div class="ig-view-header">',
                '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + (totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : totalRaw) + '</span></div>',
                '</div>',
                '<div class="ig-filter-toolbar">',
                '  <div class="ig-search-box">',
                '    <span class="ig-search-icon">' + Icons.search + '</span>',
                '    <input type="text" class="ig-search-input ig-target-list-search" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || '') + '" autocomplete="off" spellcheck="false" />',
                '    <button type="button" class="ig-search-clear ig-target-list-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + '</button>',
                '  </div>',
                '</div>',
                '<div class="ig-view-list ig-target-inner-list"></div>'
            ].join('\n');

            toolbarEl = container.querySelector('.ig-filter-toolbar');
            listEl = container.querySelector('.ig-view-list');

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
                        const q = val.trim().toLowerCase();
                        state.users = q
                            ? state.rawUsers.filter((u) => (u.username || '').toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q))
                            : state.rawUsers;
                        UI.renderTargetSingleListPage(containerId);
                    }, 120);
                });
            }
            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    state.searchQuery = '';
                    state.users = state.rawUsers;
                    UI.renderTargetSingleListPage(containerId);
                });
            }
        } else {
            const headerBadge = container.querySelector('.ig-section-title .ig-badge');
            if (headerBadge) {
                headerBadge.textContent = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;
            }
        }

        let rowsHtml = '';
        if (totalFiltered === 0) {
            rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No accounts match your search.</div>';
        } else {
            const displayUsers = users.slice(0, 100);
            displayUsers.forEach((u) => {
                const safeUsername = Utils.escapeHtml(u.username || '');
                const safeUrl = Utils.sanitizeUrl(u.username, u.url);
                const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : '';
                const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);
                const avatarHtml = safeAvatarUrl
                    ? '<img class="ig-user-avatar" src="' + safeAvatarUrl + '" alt="' + safeUsername + '" />'
                    : '<span class="ig-user-avatar">' + (safeUsername ? safeUsername.charAt(0).toUpperCase() : '?') + '</span>';

                let badges = '';
                if (u.isPrivate) badges += '<span class="ig-badge-pill ig-badge-private">' + Icons.lock + '</span>';
                if (u.isVerified) badges += '<span title="Verified">' + Icons.verified + '</span>';
                if (options.isNewBadge) badges += '<span class="ig-badge-pill ig-badge-new-mutual">' + Icons.sparkles + ' New</span>';
                if (options.isLostBadge) badges += '<span class="ig-badge-pill ig-badge-churn">' + Icons.unfollowers + ' Lost</span>';
                if (u.isViewerMutual) badges += '<span class="ig-badge-pill ig-badge-new-mutual" title="Shared mutual with you!">' + Icons.sparkles + ' Shared Mutual</span>';

                rowsHtml += '<div class="ig-user-row" data-user-id="' + Utils.escapeHtml(u.id || '') + '">';
                rowsHtml += '  <div class="ig-user-info">' + avatarHtml;
                rowsHtml += '    <div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                rowsHtml += '      <div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
                rowsHtml += '        <span class="ig-username">' + safeUsername + '</span>';
                rowsHtml += '        <span class="ig-user-badges">' + badges + '</span>';
                rowsHtml += '      </div>';
                if (safeFullName) rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                rowsHtml += '    </div>';
                rowsHtml += '  </div>';
                rowsHtml += '  <div class="ig-user-actions">';
                rowsHtml += '    <a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                rowsHtml += '  </div>';
                rowsHtml += '</div>';
            });

            if (users.length > 100) {
                rowsHtml += '<div style="text-align:center; padding:10px; font-size:11px; color:#94a3b8;">Showing 100 of ' + users.length + ' accounts. Filter by search to narrow down.</div>';
            }
        }

        if (listEl) listEl.innerHTML = rowsHtml;
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

                const avatarHtml = avatarUrl
                    ? '<img class="ig-target-card-avatar" src="' + avatarUrl + '" alt="' + safeUser + '" />'
                    : '<span class="ig-target-card-avatar">' + (safeUser ? safeUser.charAt(0).toUpperCase() : '?') + '</span>';

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
};