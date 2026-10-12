import { UI } from './UIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { API } from '../API.js';
import { createBackupUI } from '../Backup.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(UI, {
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
                            `<img class="ig-facepile-avatar" src="${Utils.sanitizeImageUrl(f.profilePicUrl) || ''}" alt="" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" /><span class="ig-facepile-avatar" style="display:none;">${(f.username || '?').charAt(0).toUpperCase()}</span>`
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

                            UI.updateUserAvatarInDom(safeUsername, cleanHdUrl);
                            Storage.updateUserProfile(safeUsername, {
                                profilePicUrl: cleanHdUrl,
                                fullName: hdData.fullName || u.fullName || ''
                            });

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
    
    lastLogMessage: null,
    lastLogTimeMs: 0,

    log: (msg) => {
        try {
            const nowMs = Date.now();
            if (UI.lastLogMessage === msg && (nowMs - (UI.lastLogTimeMs || 0)) < 1200) {
                return;
            }
            UI.lastLogMessage = msg;
            UI.lastLogTimeMs = nowMs;

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
    }
});
