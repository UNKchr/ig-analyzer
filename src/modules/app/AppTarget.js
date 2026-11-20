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

        const stored = Storage.getTargetData(cleanUser, null, userId);
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
            const prevData = Storage.getTargetData(validatedUser.username, null, validatedUser.id)
                || Storage.getTargetData(cleanUser, null, targetUserObj?.id)
                || {};

            const prevTargetHandle = String(
                valRes.renamedFrom ||
                prevData?.user?.username ||
                prevData?.username ||
                ''
            ).replace(/^@+\s*/, '').trim();
            const isTargetRenamed = Boolean(
                prevTargetHandle &&
                prevTargetHandle.toLowerCase() !== String(validatedUser.username || '').toLowerCase()
            );

            const collectedPrevNames = Utils.unique([
                ...(Array.isArray(prevData?.user?.previousUsernames) ? prevData.user.previousUsernames : []),
                ...(prevData?.user?.previousUsername ? [prevData.user.previousUsername] : []),
                ...(validatedUser.previousUsername ? [validatedUser.previousUsername] : []),
                ...(isTargetRenamed ? [prevTargetHandle] : [])
            ].map((n) => String(n || '').replace(/^@+\s*/, '').trim()).filter((n) => n && n.toLowerCase() !== String(validatedUser.username || '').toLowerCase()));

            if (collectedPrevNames.length > 0) {
                validatedUser.previousUsername = collectedPrevNames[collectedPrevNames.length - 1];
                validatedUser.previousUsernames = collectedPrevNames;
            }

            if (isTargetRenamed) {
                UI.targetLog(`[Target Renamed] @${prevTargetHandle} changed username to @${validatedUser.username} (ID: ${validatedUser.id}). Continuing existing audit history.`);
                if ((validatedUser.followedByViewer || validatedUser.followsViewer) && typeof Storage.addRenamedEntries === 'function') {
                    const rel = (validatedUser.followedByViewer && validatedUser.followsViewer)
                        ? 'mutual'
                        : (validatedUser.followsViewer ? 'fan' : 'following');
                    Storage.addRenamedEntries([{
                        id: String(validatedUser.id),
                        oldUsername: prevTargetHandle,
                        newUsername: validatedUser.username,
                        relationship: rel,
                        fullName: validatedUser.fullName || '',
                        profilePicUrl: validatedUser.profilePicUrl || null,
                        isVerified: Boolean(validatedUser.isVerified),
                        isPrivate: Boolean(validatedUser.isPrivate)
                    }]);
                }
            }

            UI.currentTargetUser = validatedUser;

            const titleEl = document.getElementById("ig-target-header-title");
            if (titleEl) {
                titleEl.innerHTML = '@' + Utils.escapeHtml(validatedUser.username) + (validatedUser.isVerified ? ' ' + Icons.verified : '');
            }

            const summaryBar = document.getElementById("ig-target-meta-summary");
            if (summaryBar) {
                let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + '</span>';
                if (validatedUser.previousUsername) {
                    summaryHtml += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + Utils.escapeHtml(validatedUser.previousUsername) + '">Formerly @' + Utils.escapeHtml(validatedUser.previousUsername) + '</span>';
                }
                if (validatedUser.fullName) {
                    summaryHtml += '<span class="ig-target-meta-name">' + Utils.escapeHtml(validatedUser.fullName) + '</span>';
                }
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followerCount) + ' followers</span>';
                summaryHtml += '<span class="ig-target-meta-pill">' + Utils.formatNumber(validatedUser.followingCount) + ' following</span>';
                summaryBar.innerHTML = summaryHtml;
            }

            // 2. Handle restricted private accounts
            const isRestricted = validatedUser.isPrivate && !validatedUser.followedByViewer;
            if (isRestricted) {
                UI.targetLog(`[Privacy Notice] @${validatedUser.username} is a private account not followed by you. Network extraction is restricted by Meta.`);
                UI.targetLog(`[Metrics] Recorded public counts: ${validatedUser.followerCount} followers, ${validatedUser.followingCount} following.`);

                const history = Storage.upsertHistoryRecord(prevData.history || [], {
                    followers: validatedUser.followerCount || 0,
                    following: validatedUser.followingCount || 0
                });

                const targetData = {
                    user: validatedUser,
                    username: validatedUser.username,
                    isRestricted: true,
                    followers: [],
                    following: [],
                    mutuals: [],
                    newFollowers: [],
                    lostFollowers: [],
                    newMutuals: [],
                    newFollowing: [],
                    lostFollowing: [],
                    lastAuditDelta: null,
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
            const confirmRes = typeof UI.confirmExtractionModal === 'function'
                ? await UI.confirmExtractionModal({
                    title: "Target Network Audit",
                    message: `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br>Select an extraction engine below to query their audience with safe anti-detection pacing:`,
                    confirmBtnText: "Yes, Extract Network",
                    customIcon: Icons.target
                })
                : {
                    confirmed: await UI.confirmAction(
                        "Target Network Audit",
                        `Account <b>@${Utils.escapeHtml(validatedUser.username)}</b> found with <b>${Utils.formatNumber(validatedUser.followerCount)}</b> followers and <b>${Utils.formatNumber(validatedUser.followingCount)}</b> following.<br><br>Network extraction will query their audience with safe anti-detection pacing. Proceed with network extraction?`,
                        "Yes, Extract Network",
                        true,
                        Icons.target
                    ),
                    engine: Storage.getExtractionEngine()
                };

            if (!confirmRes || !confirmRes.confirmed) {
                UI.targetLog("[INFO] Extraction skipped by user. Saved profile metrics.");
                const hasExtractedBaseline = (Array.isArray(prevData.followers) && prevData.followers.length > 0) ||
                    (Array.isArray(prevData.following) && prevData.following.length > 0);

                // Do not overwrite extracted network history with approximate profile header counts
                const history = hasExtractedBaseline
                    ? Storage.normalizeHistoryRecords(prevData.history || []).list
                    : Storage.upsertHistoryRecord(prevData.history || [], {
                        followers: validatedUser.followerCount || 0,
                        following: validatedUser.followingCount || 0
                    });

                const targetData = {
                    user: validatedUser,
                    username: validatedUser.username,
                    isRestricted: false,
                    followers: prevData.followers || [],
                    following: prevData.following || [],
                    mutuals: prevData.mutuals || [],
                    newFollowers: prevData.newFollowers || [],
                    lostFollowers: prevData.lostFollowers || [],
                    newMutuals: prevData.newMutuals || [],
                    newFollowing: prevData.newFollowing || [],
                    lostFollowing: prevData.lostFollowing || [],
                    lastAuditDelta: prevData.lastAuditDelta || null,
                    history,
                    lastAuditAt: prevData.lastAuditAt || Utils.now()
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
            const selectedEngine = confirmRes.engine || Storage.getExtractionEngine();
            const engineLabel = typeof UI.getEngineDisplayName === 'function'
                ? UI.getEngineDisplayName(selectedEngine)
                : selectedEngine;
            UI.targetLog(`[Engine] Selected extraction mode: ${engineLabel}`);
            UI.setTargetStatus("Extracting Network...");
            const network = await API.fetchTargetNetwork(
                validatedUser,
                { signal, engine: selectedEngine },
                (curr, total, label) => UI.setTargetProgress(curr, total, label),
                (msg) => UI.targetLog(msg)
            );

            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            UI.hideTargetProgress();
            UI.setTargetStatus("Calculating Diffs...");
            UI.targetLog("[Diffing] Calculating changes and mutual connections...");

            const prevFollowersDetailed = Utils.toDetailedUserArray(prevData.followers || []);
            const prevFollowingDetailed = Utils.toDetailedUserArray(prevData.following || []);
            const prevMutualsDetailed = Utils.toDetailedUserArray(prevData.mutuals || []);

            let currFollowers = Storage.hydrateUsersFromMemory(network.followers || [], prevFollowersDetailed, {
                friendshipCache: API.friendshipCache,
                prevScanAt: prevData.lastAuditAt
            });
            let currFollowing = Storage.hydrateUsersFromMemory(network.following || [], prevFollowingDetailed, {
                friendshipCache: API.friendshipCache,
                prevScanAt: prevData.lastAuditAt
            });

            // Cross-reference with viewer snapshot for shared mutuals BEFORE building derived lists
            const viewerSnapshot = Storage.load();
            const tagSharedViewerMutuals = (list) => {
                if (!viewerSnapshot || !Array.isArray(viewerSnapshot.followers) || !Array.isArray(viewerSnapshot.following)) return;
                const viewerFollowersLower = new Set(viewerSnapshot.followers.map((u) => String(u || '').toLowerCase()));
                const viewerFollowingLower = new Set(viewerSnapshot.following.map((u) => String(u || '').toLowerCase()));
                list.forEach((u) => {
                    const lower = String(u.username || '').toLowerCase();
                    u.isViewerMutual = viewerFollowersLower.has(lower) && viewerFollowingLower.has(lower);
                });
            };
            tagSharedViewerMutuals(currFollowers);
            tagSharedViewerMutuals(currFollowing);

            let currFollowersByLower = new Map(currFollowers.map((u) => [u.username.toLowerCase(), u]));
            let currFollowersById = new Map(currFollowers.filter((u) => u.id).map((u) => [String(u.id), u]));
            let currFollowingByLower = new Map(currFollowing.map((u) => [u.username.toLowerCase(), u]));

            const computeMutualsList = (followingList, fById, fByLower) => {
                return followingList
                    .filter((u) => (u.id && fById.has(String(u.id))) || fByLower.has(u.username.toLowerCase()))
                    .map((u) => {
                        const matchF = (u.id && fById.get(String(u.id))) || fByLower.get(u.username.toLowerCase());
                        if (!matchF) return u;
                        return {
                            ...matchF,
                            ...u,
                            id: u.id || matchF.id || null,
                            fullName: u.fullName || matchF.fullName || '',
                            profilePicUrl: u.profilePicUrl || matchF.profilePicUrl || null,
                            isPrivate: u.isPrivateKnown ? u.isPrivate : matchF.isPrivate,
                            isPrivateKnown: Boolean(u.isPrivateKnown || matchF.isPrivateKnown),
                            isBestie: Boolean(u.isBestie || matchF.isBestie),
                            outgoingRequest: Boolean(u.outgoingRequest || matchF.outgoingRequest),
                            latestReelMedia: Math.max(Number(u.latestReelMedia || 0), Number(matchF.latestReelMedia || 0))
                        };
                    });
            };

            let currMutuals = computeMutualsList(currFollowing, currFollowersById, currFollowersByLower);
            let currMutualsByLower = new Map(currMutuals.map((u) => [u.username.toLowerCase(), u]));

            const hasPreviousNetwork = prevFollowersDetailed.length > 0 || prevFollowingDetailed.length > 0;
            const todayLocalStr = Utils.localDateStr();
            const MAX_TRACKED_DIFF_ITEMS = 500;

            let newFollowersDetailed = [];
            let lostFollowersDetailed = [];
            let newMutualsDetailed = [];
            let newFollowingDetailed = [];
            let lostFollowingDetailed = [];
            let lastAuditDelta = {
                gainedFollowers: 0,
                lostFollowers: 0,
                gainedFollowing: 0,
                lostFollowing: 0,
                newMutuals: 0,
                renamed: 0
            };

            if (hasPreviousNetwork) {
                // Independent per-list rename detection so Rename + Unfollow & Rename + New Mutual are caught accurately
                const followerRenames = Utils.detectRenamedUsers(prevFollowersDetailed, currFollowers);
                const followingRenames = Utils.detectRenamedUsers(prevFollowingDetailed, currFollowing);
                const mutualRenames = Utils.detectRenamedUsers(prevMutualsDetailed, currMutuals);

                const renameByOldLower = new Map();
                [...followerRenames, ...followingRenames].forEach((r) => {
                    if (r?.oldUsername && r?.newUsername) {
                        renameByOldLower.set(r.oldUsername.toLowerCase(), r);
                    }
                });

                const followerRenamedOldLower = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
                const followerRenamedNewLower = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
                const followingRenamedOldLower = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
                const followingRenamedNewLower = new Set(followingRenames.map((r) => r.newUsername.toLowerCase()));
                const followingRenamedByOldLower = new Map(followingRenames.map((r) => [r.oldUsername.toLowerCase(), r]));
                const mutualRenamedNewLower = new Set(mutualRenames.map((r) => r.newUsername.toLowerCase()));

                const prevFollowersByLower = new Map(prevFollowersDetailed.map((u) => [u.username.toLowerCase(), u]));
                const prevFollowerIdsSet = new Set(prevFollowersDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));
                const prevFollowingByLower = new Map(prevFollowingDetailed.map((u) => [u.username.toLowerCase(), u]));
                const prevFollowingIdsSet = new Set(prevFollowingDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));
                const prevMutualsLowerSet = new Set(prevMutualsDetailed.map((u) => u.username.toLowerCase()));
                const prevMutualIdsSet = new Set(prevMutualsDetailed.map((u) => u.id ? String(u.id) : null).filter(Boolean));

                // 1. Scan-level diffs
                let scanNewFollowers = currFollowers
                    .filter((u) => {
                        const lower = u.username.toLowerCase();
                        if (u.id && prevFollowerIdsSet.has(String(u.id))) return false;
                        return !prevFollowersByLower.has(lower) && !followerRenamedNewLower.has(lower);
                    })
                    .map((u) => ({ ...u, date: todayLocalStr }));

                const prevHeaderFollowers = Number(prevData?.user?.headerFollowerCount || prevData?.user?.followerCount || 0);
                const currHeaderFollowers = Number(validatedUser.followerCount || 0);
                const prevHeaderFollowing = Number(prevData?.user?.headerFollowingCount || prevData?.user?.followingCount || 0);
                const currHeaderFollowing = Number(validatedUser.followingCount || 0);

                const followersTruncatedGuard = Boolean(network.isPartialFollowers && prevFollowersDetailed.length > currFollowers.length);
                const followingTruncatedGuard = Boolean(network.isPartialFollowing && prevFollowingDetailed.length > currFollowing.length);

                // Smart Cumulative Network Memory:
                // When the authoritative profile counter did NOT decrease (currHeader >= prevHeader),
                // but Instagram's pagination returned fewer accounts than the authoritative header counter,
                // merge previously known accounts up to currHeader so audits never regress (e.g. 224 -> 204 followers or 58 -> 50 mutuals)
                // and never emit false Lost Followers due to API boundary jitter.
                const followersCumulativeGuard = Boolean(
                    !followersTruncatedGuard &&
                    currHeaderFollowers > 0 &&
                    currFollowers.length < currHeaderFollowers &&
                    prevFollowersDetailed.length > 0 &&
                    (prevHeaderFollowers === 0 || currHeaderFollowers >= prevHeaderFollowers)
                );
                const followingCumulativeGuard = Boolean(
                    !followingTruncatedGuard &&
                    currHeaderFollowing > 0 &&
                    currFollowing.length < currHeaderFollowing &&
                    prevFollowingDetailed.length > 0 &&
                    (prevHeaderFollowing === 0 || currHeaderFollowing >= prevHeaderFollowing)
                );

                if (followersTruncatedGuard || followersCumulativeGuard) {
                    const beforeLen = currFollowers.length;
                    const unrenamedPrevFollowers = prevFollowersDetailed.filter((u) => !followerRenamedOldLower.has(u.username.toLowerCase()));
                    let mergedFollowers = Utils.toDetailedUserArray(API.mergeExtractedUsers(currFollowers, unrenamedPrevFollowers));
                    if (followersCumulativeGuard && currHeaderFollowers > 0 && mergedFollowers.length > currHeaderFollowers) {
                        mergedFollowers = mergedFollowers.slice(0, currHeaderFollowers);
                    }
                    currFollowers = mergedFollowers;
                    tagSharedViewerMutuals(currFollowers);
                    currFollowersByLower = new Map(currFollowers.map((u) => [u.username.toLowerCase(), u]));
                    currFollowersById = new Map(currFollowers.filter((u) => u.id).map((u) => [String(u.id), u]));

                    if (network.isRateLimitedFollowers) {
                        UI.targetLog(`[Anti-Ban Guard] Rate limit active on 'followers'. Preserved ${currFollowers.length} known followers from audit memory & suppressed false Lost Followers.`);
                    } else if (followersTruncatedGuard) {
                        UI.targetLog(`[Safety Guard] Meta returned a partial followers subset (${beforeLen}/${validatedUser.followerCount}). Preserving baseline & suppressing false Lost Followers alerts.`);
                    } else if (currFollowers.length > beforeLen) {
                        UI.targetLog(`[Cumulative Memory] Reconciled +${currFollowers.length - beforeLen} previously discovered follower(s) (${currFollowers.length}/${validatedUser.followerCount} total).`);
                    }
                }
                if (followingTruncatedGuard || followingCumulativeGuard) {
                    const beforeLen = currFollowing.length;
                    const unrenamedPrevFollowing = prevFollowingDetailed.filter((u) => !followingRenamedOldLower.has(u.username.toLowerCase()));
                    let mergedFollowing = Utils.toDetailedUserArray(API.mergeExtractedUsers(currFollowing, unrenamedPrevFollowing));
                    if (followingCumulativeGuard && currHeaderFollowing > 0 && mergedFollowing.length > currHeaderFollowing) {
                        mergedFollowing = mergedFollowing.slice(0, currHeaderFollowing);
                    }
                    currFollowing = mergedFollowing;
                    tagSharedViewerMutuals(currFollowing);
                    currFollowingByLower = new Map(currFollowing.map((u) => [u.username.toLowerCase(), u]));

                    if (network.isRateLimitedFollowing) {
                        UI.targetLog(`[Anti-Ban Guard] Rate limit active on 'following'. Preserved ${currFollowing.length} known following from audit memory & suppressed false Lost Following.`);
                    } else if (followingTruncatedGuard) {
                        UI.targetLog(`[Safety Guard] Meta returned a partial following subset (${beforeLen}/${validatedUser.followingCount}). Preserving baseline & suppressing false Lost Following calculations.`);
                    } else if (currFollowing.length > beforeLen) {
                        UI.targetLog(`[Cumulative Memory] Reconciled +${currFollowing.length - beforeLen} previously discovered following account(s) (${currFollowing.length}/${validatedUser.followingCount} total).`);
                    }
                }
                if (followersTruncatedGuard || followingTruncatedGuard || followersCumulativeGuard || followingCumulativeGuard) {
                    currMutuals = computeMutualsList(currFollowing, currFollowersById, currFollowersByLower);
                    currMutualsByLower = new Map(currMutuals.map((u) => [u.username.toLowerCase(), u]));
                }

                const currFollowerIdsSet = new Set(currFollowers.map((u) => u.id ? String(u.id) : null).filter(Boolean));
                const currFollowingIdsSet = new Set(currFollowing.map((u) => u.id ? String(u.id) : null).filter(Boolean));

                const scanLostFollowers = (followersTruncatedGuard || followersCumulativeGuard) ? [] : prevFollowersDetailed
                    .filter((u) => {
                        const lower = u.username.toLowerCase();
                        if (u.id && currFollowerIdsSet.has(String(u.id))) return false;
                        return !currFollowersByLower.has(lower) && !followerRenamedOldLower.has(lower);
                    })
                    .map((u) => {
                        const lower = u.username.toLowerCase();
                        const ren = followingRenamedByOldLower.get(lower);
                        if (ren) {
                            const liveInFollowing = currFollowingByLower.get(ren.newUsername.toLowerCase());
                            return {
                                ...(liveInFollowing || u),
                                id: ren.id || u.id || null,
                                username: ren.newUsername,
                                previousUsername: ren.oldUsername,
                                url: `https://www.instagram.com/${encodeURIComponent(ren.newUsername)}/`,
                                date: todayLocalStr
                            };
                        }
                        const liveInFollowing = currFollowingByLower.get(lower);
                        return {
                            ...(liveInFollowing || u),
                            date: todayLocalStr
                        };
                    });

                let scanNewFollowing = currFollowing
                    .filter((u) => {
                        const lower = u.username.toLowerCase();
                        if (u.id && prevFollowingIdsSet.has(String(u.id))) return false;
                        return !prevFollowingByLower.has(lower) && !followingRenamedNewLower.has(lower);
                    })
                    .map((u) => ({ ...u, date: todayLocalStr }));

                const scanLostFollowing = (followingTruncatedGuard || followingCumulativeGuard) ? [] : prevFollowingDetailed
                    .filter((u) => {
                        const lower = u.username.toLowerCase();
                        if (u.id && currFollowingIdsSet.has(String(u.id))) return false;
                        return !currFollowingByLower.has(lower) && !followingRenamedOldLower.has(lower);
                    })
                    .map((u) => {
                        const lower = u.username.toLowerCase();
                        const liveInFollowers = currFollowersByLower.get(lower);
                        return {
                            ...(liveInFollowers || u),
                            date: todayLocalStr
                        };
                    });

                // Cross-engine conservation guard (prevents false New Followers/Following when jumping from partial REST to complete GraphQL)
                let reconciledFollowerLowers = new Set();
                let reconciledFollowingLowers = new Set();

                const prevExtractedF = Number(prevData?.user?.extractedFollowersCount) || prevFollowersDetailed.length;
                const prevMissingFollowers = (prevHeaderFollowers > 0 && prevFollowersDetailed.length > 0)
                    ? Math.max(0, prevHeaderFollowers - Math.min(prevFollowersDetailed.length, prevExtractedF))
                    : 0;
                const maxPossibleRealNewF = (prevHeaderFollowers > 0 && currHeaderFollowers > 0)
                    ? (Math.max(0, currHeaderFollowers - prevHeaderFollowers) + scanLostFollowers.length)
                    : scanNewFollowers.length;

                if (prevMissingFollowers >= 4 && scanNewFollowers.length > maxPossibleRealNewF) {
                    const reconciledFollowers = scanNewFollowers.slice(maxPossibleRealNewF);
                    scanNewFollowers = scanNewFollowers.slice(0, maxPossibleRealNewF);
                    reconciledFollowerLowers = new Set(reconciledFollowers.map((u) => u.username.toLowerCase()));
                    if (reconciledFollowers.length > 0) {
                        UI.targetLog(`[Baseline Reconciled] Absorbed +${reconciledFollowers.length} previously unindexed follower(s) into @${validatedUser.username}'s baseline (suppressed false 'New Followers').`);
                    }
                }

                const prevExtractedIng = Number(prevData?.user?.extractedFollowingCount) || prevFollowingDetailed.length;
                const prevMissingFollowing = (prevHeaderFollowing > 0 && prevFollowingDetailed.length > 0)
                    ? Math.max(0, prevHeaderFollowing - Math.min(prevFollowingDetailed.length, prevExtractedIng))
                    : 0;
                const maxPossibleRealNewIng = (prevHeaderFollowing > 0 && currHeaderFollowing > 0)
                    ? (Math.max(0, currHeaderFollowing - prevHeaderFollowing) + scanLostFollowing.length)
                    : scanNewFollowing.length;

                if (prevMissingFollowing >= 4 && scanNewFollowing.length > maxPossibleRealNewIng) {
                    const reconciledFollowing = scanNewFollowing.slice(maxPossibleRealNewIng);
                    scanNewFollowing = scanNewFollowing.slice(0, maxPossibleRealNewIng);
                    reconciledFollowingLowers = new Set(reconciledFollowing.map((u) => u.username.toLowerCase()));
                    if (reconciledFollowing.length > 0) {
                        UI.targetLog(`[Baseline Reconciled] Absorbed +${reconciledFollowing.length} previously unindexed following account(s) into @${validatedUser.username}'s baseline.`);
                    }
                }

                const scanNewFollowersLowers = new Set(scanNewFollowers.map((u) => u.username.toLowerCase()));
                const scanNewFollowingLowers = new Set(scanNewFollowing.map((u) => u.username.toLowerCase()));

                const scanNewMutuals = currMutuals
                    .filter((u) => {
                        const lower = u.username.toLowerCase();
                        if (u.id && prevMutualIdsSet.has(String(u.id))) return false;
                        if (prevMutualsLowerSet.has(lower) || mutualRenamedNewLower.has(lower)) return false;
                        if (reconciledFollowerLowers.has(lower) && !scanNewFollowingLowers.has(lower)) return false;
                        if (reconciledFollowingLowers.has(lower) && !scanNewFollowersLowers.has(lower)) return false;
                        return true;
                    })
                    .map((u) => ({ ...u, date: todayLocalStr }));

                lastAuditDelta = {
                    gainedFollowers: scanNewFollowers.length,
                    lostFollowers: scanLostFollowers.length,
                    gainedFollowing: scanNewFollowing.length,
                    lostFollowing: scanLostFollowing.length,
                    newMutuals: scanNewMutuals.length,
                    renamed: renameByOldLower.size
                };

                // 2. Reconcile & preserve historical target diffs so same-day re-audits never wipe prior gains/losses
                const mergeActiveGains = (prevGains, scanGains, activeLookupMap) => {
                    const mergedByLower = new Map();
                    Utils.toDetailedUserArray(prevGains || []).forEach((item) => {
                        const ren = renameByOldLower.get(item.username.toLowerCase());
                        const targetLower = (ren ? ren.newUsername : item.username).toLowerCase();
                        const live = activeLookupMap.get(targetLower);
                        if (!live) return; // Prune if no longer active in target's current list
                        mergedByLower.set(targetLower, {
                            ...item,
                            ...live,
                            isPrivate: live.isPrivateKnown ? live.isPrivate : Boolean(item.isPrivate),
                            isPrivateKnown: Boolean(live.isPrivateKnown || item.isPrivateKnown),
                            date: item.date ? Utils.localDateStr(item.date) : todayLocalStr
                        });
                    });
                    scanGains.forEach((item) => {
                        const lower = item.username.toLowerCase();
                        if (mergedByLower.has(lower)) mergedByLower.delete(lower);
                        mergedByLower.set(lower, item);
                    });
                    const arr = Utils.toDetailedUserArray(Array.from(mergedByLower.values()));
                    return arr.length > MAX_TRACKED_DIFF_ITEMS ? arr.slice(arr.length - MAX_TRACKED_DIFF_ITEMS) : arr;
                };

                const mergeActiveLosses = (prevLosses, scanLosses, activeLookupMap, secondaryLookupMap) => {
                    const mergedByLower = new Map();
                    Utils.toDetailedUserArray(prevLosses || []).forEach((item) => {
                        const ren = renameByOldLower.get(item.username.toLowerCase());
                        const resolvedName = ren ? ren.newUsername : item.username;
                        const targetLower = resolvedName.toLowerCase();
                        if (activeLookupMap.has(targetLower)) return; // Re-followed -> remove from lost list!
                        if (item.id && Array.from(activeLookupMap.values()).some((u) => u.id && String(u.id) === String(item.id))) return;
                        const secondaryLive = secondaryLookupMap ? secondaryLookupMap.get(targetLower) : null;
                        mergedByLower.set(targetLower, {
                            ...item,
                            ...(secondaryLive || {}),
                            username: resolvedName,
                            url: `https://www.instagram.com/${encodeURIComponent(resolvedName)}/`,
                            date: item.date ? Utils.localDateStr(item.date) : todayLocalStr
                        });
                    });
                    scanLosses.forEach((item) => {
                        const lower = item.username.toLowerCase();
                        if (mergedByLower.has(lower)) mergedByLower.delete(lower);
                        mergedByLower.set(lower, item);
                    });
                    const arr = Utils.toDetailedUserArray(Array.from(mergedByLower.values()));
                    return arr.length > MAX_TRACKED_DIFF_ITEMS ? arr.slice(arr.length - MAX_TRACKED_DIFF_ITEMS) : arr;
                };

                newFollowersDetailed = mergeActiveGains(prevData.newFollowers, scanNewFollowers, currFollowersByLower);
                lostFollowersDetailed = mergeActiveLosses(prevData.lostFollowers, scanLostFollowers, currFollowersByLower, currFollowingByLower);
                newMutualsDetailed = mergeActiveGains(prevData.newMutuals, scanNewMutuals, currMutualsByLower);
                newFollowingDetailed = mergeActiveGains(prevData.newFollowing, scanNewFollowing, currFollowingByLower);
                lostFollowingDetailed = mergeActiveLosses(prevData.lostFollowing, scanLostFollowing, currFollowingByLower, currFollowersByLower);

                const formatPreviewList = (arr, limit = 5) => {
                    const names = (arr || []).slice(0, limit).map((u) => `@${u.username}`);
                    const extra = (arr || []).length - names.length;
                    return extra > 0 ? `${names.join(', ')} (+${extra} more)` : names.join(', ');
                };

                if (renameByOldLower.size > 0) {
                    const renamePairs = Array.from(renameByOldLower.values())
                        .slice(0, 5)
                        .map((r) => `@${r.oldUsername} -> @${r.newUsername}`);
                    const extraRenames = renameByOldLower.size - renamePairs.length;
                    UI.targetLog(`[Network Renames] Detected ${renameByOldLower.size} username change(s) in @${validatedUser.username}'s network: ${renamePairs.join(', ')}${extraRenames > 0 ? ` (+${extraRenames} more)` : ''}.`);
                }
                if (scanNewMutuals.length > 0) {
                    UI.targetLog(`[New Mutuals] Detected +${scanNewMutuals.length} new mutual connection(s) for @${validatedUser.username}: ${formatPreviewList(scanNewMutuals)} (added to 'New Mutuals' tab).`);
                }
                if (scanNewFollowers.length > 0) {
                    UI.targetLog(`[New Followers] Detected +${scanNewFollowers.length} new follower(s): ${formatPreviewList(scanNewFollowers)}.`);
                }
                if (scanLostFollowers.length > 0) {
                    UI.targetLog(`[Lost Followers] Detected -${scanLostFollowers.length} lost follower(s): ${formatPreviewList(scanLostFollowers)}.`);
                }

                UI.targetLog(`[Diff Results] This scan: +${scanNewFollowers.length} followers, -${scanLostFollowers.length} lost, +${scanNewMutuals.length} new mutuals | Active tracked: +${newFollowersDetailed.length} followers / -${lostFollowersDetailed.length} lost / +${newMutualsDetailed.length} new mutuals`);
            } else {
                UI.targetLog("[Diff Results] Initial baseline recorded for @" + validatedUser.username + ".");
            }

            // Preserve authoritative profile counts (never downgrade official header counts below extracted list length)
            const authoritativeFollowersCount = Math.max(Number(validatedUser.followerCount) || 0, currFollowers.length);
            const authoritativeFollowingCount = Math.max(Number(validatedUser.followingCount) || 0, currFollowing.length);
            validatedUser.headerFollowerCount = Number(validatedUser.followerCount) || authoritativeFollowersCount;
            validatedUser.headerFollowingCount = Number(validatedUser.followingCount) || authoritativeFollowingCount;
            validatedUser.followerCount = authoritativeFollowersCount;
            validatedUser.followingCount = authoritativeFollowingCount;
            validatedUser.extractedFollowersCount = currFollowers.length;
            validatedUser.extractedFollowingCount = currFollowing.length;

            // Record History with local calendar date & intra-day baseline using authoritative counts
            const history = Storage.upsertHistoryRecord(prevData.history || [], {
                followers: authoritativeFollowersCount,
                following: authoritativeFollowingCount,
                mutuals: currMutuals.length,
                scanSummary: {
                    gained: lastAuditDelta.gainedFollowers,
                    lost: lastAuditDelta.lostFollowers,
                    deactivated: 0,
                    blocked: 0,
                    renamed: lastAuditDelta.renamed
                }
            });

            const targetData = {
                user: validatedUser,
                username: validatedUser.username,
                isRestricted: false,
                followers: currFollowers,
                following: currFollowing,
                mutuals: currMutuals,
                newFollowers: newFollowersDetailed,
                lostFollowers: lostFollowersDetailed,
                newMutuals: newMutualsDetailed,
                newFollowing: newFollowingDetailed,
                lostFollowing: lostFollowingDetailed,
                lastAuditDelta,
                history,
                lastAuditAt: Utils.now()
            };

            Storage.syncFreshUserData([...currFollowers, ...currFollowing]);
            Storage.saveTargetData(validatedUser.username, targetData);

            // Update subpanel header summary bar with authoritative counts
            const finalSummaryBar = document.getElementById("ig-target-meta-summary");
            if (finalSummaryBar) {
                let summaryHtml = '<span class="ig-target-meta-user">@' + Utils.escapeHtml(validatedUser.username) + '</span>';
                if (validatedUser.previousUsername) {
                    summaryHtml += '<span class="ig-badge-pill ig-badge-formerly" title="Previously @' + Utils.escapeHtml(validatedUser.previousUsername) + '">Formerly @' + Utils.escapeHtml(validatedUser.previousUsername) + '</span>';
                }
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

            UI.targetLog(`[Audit Finished] Successfully audited @${validatedUser.username} (${authoritativeFollowersCount} followers, ${authoritativeFollowingCount} following, ${currMutuals.length} mutuals).`);
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

