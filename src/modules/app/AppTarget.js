import { App } from './AppState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { UI } from '../UI.js';
import { API } from '../API.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(App, {
    abortTargetAudit: () => {
        if (App.targetRunning && App.targetAbortController) {
            UI.setTargetStatus("Cancelling...");
            UI.setTargetRunButtonState('cancelling');
            try {
                UI.targetLog("[INFO] Target audit cancellation requested by user...");
            } catch (e) {}
            App.targetAbortController.abort();
        }
    },

    openTargetAudit: async (username, userId = null, forceRefresh = false) => {
        const cleanUser = String(username || '').replace(/^@+\s*/, '').trim().replace(/\s+/g, '');
        if (!cleanUser) return;

        const stored = Storage.getTargetData(cleanUser);
        const stubUser = stored?.user || {
            username: cleanUser,
            id: userId || null
        };

        UI.openTargetSubpanel(stubUser, stored);

        if (forceRefresh || !stored) {
            await App.runTargetAudit(stubUser, forceRefresh);
        }
    },

    runTargetAudit: async (targetUserObj, forceRefresh = false) => {
        if (App.targetRunning) {
            App.abortTargetAudit();
            return;
        }

        const cleanUser = String(targetUserObj?.username || '').replace(/^@+\s*/, '').trim().replace(/\s+/g, '');
        if (!cleanUser) {
            UI.targetLog("[ERROR] Invalid target username.");
            return;
        }

        App.targetRunning = true;
        App.targetAbortController = new AbortController();
        const signal = App.targetAbortController.signal;

        UI.setTargetRunButtonState('running');
        UI.setTargetStatus("Validating...");
        UI.targetLog(`[Audit Start] Initializing audit for @${cleanUser}...`);

        const logsTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-logs"]');
        if (logsTab) logsTab.click();

        try {
            // 1. Validate account and obtain fresh header data
            const valRes = await API.validateTargetAccount(cleanUser, { signal, userId: targetUserObj?.id });
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            if (!valRes || !valRes.exists || !valRes.user) {
                const errMsg = valRes?.error || `Account @${cleanUser} does not exist on Instagram.`;
                UI.targetLog(`[ERROR] ${errMsg}`);
                UI.setTargetStatus("Not Found");

                // Update feedback in main panel Target Tracker search card if visible
                const searchFeedback = document.getElementById("ig-target-search-feedback");
                if (searchFeedback) {
                    searchFeedback.style.display = 'block';
                    searchFeedback.className = 'ig-target-feedback is-error';
                    searchFeedback.textContent = errMsg;
                }

                await UI.confirmAction("Target Not Found", Utils.escapeHtml(errMsg), "Close", false, Icons.warning);
                return;
            }

            const validatedUser = valRes.user;
            UI.currentTargetUser = validatedUser;

            const titleEl = document.getElementById("ig-target-header-title");
            if (titleEl) {
                titleEl.innerHTML = '@' + Utils.escapeHtml(validatedUser.username) + (validatedUser.isVerified ? ' ' + Icons.verified : '');
            }

            const summaryBar = document.getElementById("ig-target-meta-summary");
            if (summaryBar) {
                let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + '</span>';
                if (validatedUser.fullName) {
                    summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + '</span>';
                }
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + ' followers</span>';
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + ' following</span>';
                summaryBar.innerHTML = summaryHtml;
            }

            const prevData = Storage.getTargetData(validatedUser.username) || {};

            // 2. Handle restricted private accounts
            const isRestricted = validatedUser.isPrivate && !validatedUser.followedByViewer;
            if (isRestricted) {
                UI.targetLog(`[Privacy Notice] @${validatedUser.username} is a private account not followed by you. Network extraction is restricted by Meta.`);
                UI.targetLog(`[Metrics] Recorded public counts: ${validatedUser.followerCount} followers, ${validatedUser.followingCount} following.`);

                const todayStr = Utils.now().split("T")[0];
                const history = Array.isArray(prevData.history) ? [...prevData.history] : [];
                const existHistIdx = history.findIndex((h) => h.date === todayStr);
                if (existHistIdx > -1) {
                    history[existHistIdx] = { date: todayStr, followers: validatedUser.followerCount, following: validatedUser.followingCount };
                } else {
                    history.push({ date: todayStr, followers: validatedUser.followerCount, following: validatedUser.followingCount });
                }

                const targetData = {
                    user: validatedUser,
                    username: validatedUser.username,
                    isRestricted: true,
                    followers: [],
                    following: [],
                    mutuals: [],
                    newFollowers: [],
                    lostFollowers: [],
                    history,
                    lastAuditAt: Utils.now()
                };

                Storage.saveTargetData(validatedUser.username, targetData);
                UI.renderTargetOverview(targetData);
                UI.renderTargetLists(targetData);
                UI.renderTargetTrackerMainView();
                UI.setTargetStatus("Completed (Restricted)");
                UI.targetLog(`[Audit Finished] Saved profile summary for @${validatedUser.username}.`);

                const overviewTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
                if (overviewTab) overviewTab.click();
                return;
            }

            // 3. Confirm network extraction for accessible public / mutual accounts
            const userConfirmed = await UI.confirmAction(
                "Target Network Audit",
                `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br><br>Network extraction will query their audience with safe anti-detection pacing. Proceed with network extraction?`,
                "Yes, Extract Network",
                true,
                Icons.target
            );

            if (!userConfirmed) {
                UI.targetLog("[INFO] Extraction skipped by user. Saved profile metrics.");
                const todayStr = Utils.now().split("T")[0];
                const history = Array.isArray(prevData.history) ? [...prevData.history] : [];
                const existHistIdx = history.findIndex((h) => h.date === todayStr);
                if (existHistIdx > -1) {
                    history[existHistIdx] = { date: todayStr, followers: validatedUser.followerCount, following: validatedUser.followingCount };
                } else {
                    history.push({ date: todayStr, followers: validatedUser.followerCount, following: validatedUser.followingCount });
                }
                const targetData = {
                    user: validatedUser,
                    username: validatedUser.username,
                    isRestricted: false,
                    followers: prevData.followers || [],
                    following: prevData.following || [],
                    mutuals: prevData.mutuals || [],
                    newFollowers: prevData.newFollowers || [],
                    lostFollowers: prevData.lostFollowers || [],
                    history,
                    lastAuditAt: Utils.now()
                };
                Storage.saveTargetData(validatedUser.username, targetData);
                UI.renderTargetOverview(targetData);
                UI.renderTargetLists(targetData);
                UI.renderTargetTrackerMainView();
                UI.setTargetStatus("Profile Saved");
                const overviewTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
                if (overviewTab) overviewTab.click();
                return;
            }

            // 4. Extract target network with anti-detection pacing
            UI.setTargetStatus("Extracting Network...");
            const network = await API.fetchTargetNetwork(
                validatedUser,
                { signal },
                (curr, total, label) => UI.setTargetProgress(curr, total, label),
                (msg) => UI.targetLog(msg)
            );

            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            UI.hideTargetProgress();
            UI.setTargetStatus("Calculating Diffs...");
            UI.targetLog("[Diffing] Calculating changes and mutual connections...");

            const currentFollowerNames = network.followers.map((u) => u.username);
            const currentFollowingNames = network.following.map((u) => u.username);
            const prevFollowerNames = (prevData.followers || []).map((u) => (typeof u === 'string' ? u : u.username));
            const prevFollowingNames = (prevData.following || []).map((u) => (typeof u === 'string' ? u : u.username));

            let newFollowersDetailed = [];
            let newMutualsDetailed = [];
            let lostFollowersDetailed = [];

            if (prevData && prevFollowerNames.length > 0) {
                // Calculate globally renamed users to prevent false unfollows/new follows in target tracker
                const allPrevUsersDetailed = [...(prevData.followers || []), ...(prevData.following || [])];
                const allCurrUsersDetailed = [...network.followers, ...network.following];
                const globalRenamed = Utils.detectRenamedMutuals(allPrevUsersDetailed, allCurrUsersDetailed);
                const globalRenamedOldSet = new Set(globalRenamed.map(r => r.oldUsername));
                const globalRenamedNewSet = new Set(globalRenamed.map(r => r.newUsername));

                const rawNewFollowersNames = Utils.diff(currentFollowerNames, prevFollowerNames);
                const newFollowersNames = rawNewFollowersNames.filter(u => !globalRenamedNewSet.has(u));

                const rawLostFollowersNames = Utils.diff(prevFollowerNames, currentFollowerNames);
                const lostFollowersNames = rawLostFollowersNames.filter(u => !globalRenamedOldSet.has(u));

                const currentFollowersMap = new Map();
                network.followers.forEach((u) => currentFollowersMap.set(u.username, u));

                const prevFollowersMap = new Map();
                (prevData.followers || []).forEach((u) => {
                    if (u?.username) prevFollowersMap.set(u.username, u);
                });

                newFollowersDetailed = newFollowersNames.map((name) => currentFollowersMap.get(name) || {
                    username: name,
                    url: `https://www.instagram.com/${name}/`
                });

                lostFollowersDetailed = lostFollowersNames.map((name) => prevFollowersMap.get(name) || {
                    username: name,
                    url: `https://www.instagram.com/${name}/`
                });

                                const prevMutualNames = (prevData.mutuals || []).map((u) => (typeof u === 'string' ? u : u.username));
                const currentMutualNames = network.mutuals.map(u => u.username);
                const rawNewMutualNames = Utils.diff(currentMutualNames, prevMutualNames);
                const newMutualNames = rawNewMutualNames.filter(u => !globalRenamedNewSet.has(u));

                const currentMutualsMap = new Map();
                network.mutuals.forEach((u) => currentMutualsMap.set(u.username, u));

                newMutualsDetailed = newMutualNames.map((name) => currentMutualsMap.get(name) || {
                    username: name,
                    url: `https://www.instagram.com/${name}/`
                });

                UI.targetLog(`[Diff Results] Gained: +${newFollowersDetailed.length} followers | Lost: -${lostFollowersDetailed.length} followers | New Mutuals: +${newMutualsDetailed.length}`);
            } else {
                UI.targetLog("[Diff Results] Initial baseline recorded for @" + validatedUser.username + ".");
            }

            // Cross-reference with viewer snapshot for shared mutuals
            const viewerSnapshot = Storage.load();
            if (viewerSnapshot && Array.isArray(viewerSnapshot.followers) && Array.isArray(viewerSnapshot.following)) {
                const viewerFollowers = new Set(viewerSnapshot.followers);
                const viewerFollowing = new Set(viewerSnapshot.following);
                network.mutuals.forEach((m) => {
                    m.isViewerMutual = viewerFollowers.has(m.username) && viewerFollowing.has(m.username);
                });
            }

            // Record History
            const todayStr = Utils.now().split("T")[0];
            const history = Array.isArray(prevData.history) ? [...prevData.history] : [];
            const existHistIdx = history.findIndex((h) => h.date === todayStr);
            const histEntry = {
                date: todayStr,
                followers: network.followers.length,
                following: network.following.length,
                mutuals: network.mutuals.length
            };
            if (existHistIdx > -1) {
                history[existHistIdx] = histEntry;
            } else {
                history.push(histEntry);
            }

            // Sync validatedUser metrics with true extracted network counts
            if (Array.isArray(network.followers) && network.followers.length > 0) {
                validatedUser.followerCount = Math.max(validatedUser.followerCount || 0, network.followers.length);
            }
            if (Array.isArray(network.following) && network.following.length > 0) {
                validatedUser.followingCount = Math.max(validatedUser.followingCount || 0, network.following.length);
            }

            const targetData = {
                user: validatedUser,
                username: validatedUser.username,
                isRestricted: false,
                followers: network.followers,
                following: network.following,
                mutuals: network.mutuals,
                newFollowers: newFollowersDetailed,
                lostFollowers: lostFollowersDetailed,
                newMutuals: newMutualsDetailed,
                history,
                lastAuditAt: Utils.now()
            };

            Storage.saveTargetData(validatedUser.username, targetData);

            // Update subpanel header summary bar with authoritative counts
            const finalSummaryBar = document.getElementById("ig-target-meta-summary");
            if (finalSummaryBar) {
                let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + '</span>';
                if (validatedUser.fullName) {
                    summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + '</span>';
                }
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + ' followers</span>';
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + ' following</span>';
                finalSummaryBar.innerHTML = summaryHtml;
            }

            UI.renderTargetOverview(targetData);
            UI.renderTargetLists(targetData);
            UI.renderTargetTrackerMainView();

            UI.targetLog(`[Audit Finished] Successfully audited @${validatedUser.username} (${network.followers.length} followers, ${network.following.length} following, ${network.mutuals.length} mutuals).`);
            UI.setTargetStatus("Audit Completed");

            const overviewTab = document.querySelector('#ig-target-tabs [data-target="ig-target-view-overview"]');
            if (overviewTab) overviewTab.click();

        } catch (err) {
            if (err.name === 'AbortError' || signal.aborted) {
                UI.targetLog("[INFO] Target audit cancelled by user.");
                UI.setTargetStatus("Cancelled");
            } else {
                Utils.logError("Error in runTargetAudit", err);
                UI.targetLog(`[ERROR] Target audit failed: ${err.message || 'Unknown error'}`);
                UI.setTargetStatus("Error");
            }
        } finally {
            UI.hideTargetProgress();
            UI.setTargetRunButtonState('idle');
            App.targetRunning = false;
            App.targetAbortController = null;
        }
    },
    
});

