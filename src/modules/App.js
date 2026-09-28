import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { UI } from './UI.js';
import { API } from './API.js';
import { Icons } from '../assets/Icons.js';

export const App = {
    isRunning: false,
    abortController: null,
    lastResults: null,

    abort: () => {
        if (App.isRunning && App.abortController) {
            UI.setStatus("Cancelling...");
            UI.setRunButtonState('cancelling');
            try {
                UI.log("[INFO] Analysis cancellation requested by user...");
            } catch (err) {
                console.log("[INFO] Analysis cancellation requested by user...");
            }
            App.abortController.abort();
        }
    },

    run: async () => {
        if (App.isRunning) {
            App.abort();
            return;
        }

        const userConfirmed = await UI.confirmAction(
            "Safety Precaution", 
            "Excessive use of automation tools may result in temporary account restrictions.<br><br>It is recommended to run this analysis <b>only once per hour</b>.",
            "Yes, Continue"
        );

        if (!userConfirmed) {
            UI.log("Analysis cancelled by user.");
            console.log("Analysis cancelled by user.");
            return; 
        }

        App.isRunning = true;
        App.abortController = new AbortController();
        const signal = App.abortController.signal;

        UI.setRunButtonState('running');
        UI.setStatus("Analyzing...");

        try {
            UI.log("Starting deep analysis...");
            const logTab = document.querySelector('[data-target="ig-log"]');
            if (logTab) logTab.click();

            const userId = await Utils.getUserIdAsync(signal);
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");
            if (!userId || userId === "0") throw new Error("User ID could not be obtained. Are you logged in?");
            Storage.setCurrentUserId(userId);
            UI.log("User ID detected: " + userId);
            
            // Retrieve user profile counts for accurate progressive tracking
            let userInfo = null;
            try {
                userInfo = await API.getUserInfo(userId, { signal });
                if (userInfo) {
                    const infoStr = `@${userInfo.username || userId} (${userInfo.followerCount} followers, ${userInfo.followingCount} following)`;
                    UI.log("Target profile: " + infoStr);
                }
            } catch (e) {
                if (signal.aborted) throw e;
                console.warn("[IG Analyzer] Could not fetch user profile info:", e);
            }

            const expectedFollowing = userInfo?.followingCount || 0;
            const expectedFollowers = userInfo?.followerCount || 0;

            UI.log("Fetching 'Following'...");
            const followingDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following", { signal }, expectedFollowing); 
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            UI.log("Fetching 'Followers'...");
            const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers", { signal }, expectedFollowers); 
            if (signal.aborted) throw new DOMException("Aborted", "AbortError"); 

            
            const followingDetailed = Utils.toDetailedUserArray(followingDetailedRaw); 
            const followersDetailed = Utils.toDetailedUserArray(followersDetailedRaw); 
            const following = followingDetailed.map((u) => u.username); 
            const followers = followersDetailed.map((u) => u.username); 
            
            UI.hideProgress();
            UI.setStatus("Calculating Metrics...");
            
            Storage.addHistoryEntry(followers.length, following.length);
            UI.renderHistory(Storage.getHistory());
            
            const notFollowingBackUsernames = Utils.diff(following, followers);
            const fansUsernames = Utils.diff(followers, following);
            const mutualsUsernames = Utils.intersection(followers, following);
            
            const whitelist = Storage.getWhitelist();
            const filteredNotFollowing = notFollowingBackUsernames.filter((u) => !whitelist.includes(u));
            
            const allUsersMap = new Map();
            [...followingDetailed, ...followersDetailed].forEach((u) => {
                if (u?.username) allUsersMap.set(u.username, u);
            });

            const mapToDetailed = (arr) => arr.map((u) => {
                const userObj = allUsersMap.get(u) || {};
                return {
                    ...userObj,
                    username: u,
                    url: "https://www.instagram.com/" + u + "/"
                };
            });
            
            const notFollowingBackDetailed = mapToDetailed(filteredNotFollowing);
            const fansDetailed = mapToDetailed(fansUsernames);
            const mutualsDetailed = mapToDetailed(mutualsUsernames);
            
            UI.log("Not Following Back (filtered): " + notFollowingBackDetailed.length);
            UI.log("Fans: " + fansDetailed.length);
            UI.log("Mutuals: " + mutualsDetailed.length);
            
            const prev = Storage.load();
            if (prev) {
                
                const prevFollowersDetailed = Utils.toDetailedUserArray(
                    Array.isArray(prev.followersDetailed) ? prev.followersDetailed : (prev.followers || [])
                ); 
                const prevFollowingDetailed = Utils.toDetailedUserArray(
                    Array.isArray(prev.followingDetailed) ? prev.followingDetailed : (prev.following || [])
                ); 

                const prevFollowers = prevFollowersDetailed.map((u) => u.username); 
                const prevFollowing = prevFollowingDetailed.map((u) => u.username); 

                const newFollowers = Utils.diff(followers, prevFollowers);
                UI.log("New followers since last run: " + newFollowers.length);
                const newFollowersDetailed = mapToDetailed(newFollowers).map((u) => ({
                    ...u,
                    followsBack: following.includes(u.username),
                    date: Utils.now().split("T")[0]
                }));
                if (newFollowersDetailed.length > 0) {
                    Storage.addNewFollowersEntries(newFollowersDetailed);
                }
                
                const lostFollowers = Utils.diff(prevFollowers, followers);
                const lostFollowing = Utils.diff(prevFollowing, following);
                const missingUsers = Utils.intersection(lostFollowers, lostFollowing);

                
                const prevMutualsDetailed = Utils.intersectionById(prevFollowersDetailed, prevFollowingDetailed); 
                const currMutualsDetailed = Utils.intersectionById(followersDetailed, followingDetailed); 
                const renamedEntries = Utils.detectRenamedMutuals(prevMutualsDetailed, currMutualsDetailed); 
                const renamedOldUsernameSet = new Set(renamedEntries.map((r) => r.oldUsername)); 

                if (renamedEntries.length > 0) {
                    Storage.addRenamedEntries(renamedEntries); 
                    UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
                    UI.log("Detected " + renamedEntries.length + " confirmed username change(s) in mutuals."); 
                }

                const newDeactivated = [];
                const newBlocked = [];
                const newUnfollowers = [];

                const filteredLostFollowers = lostFollowers.filter((u) => !renamedOldUsernameSet.has(u)); 
                const filteredMissingUsers = missingUsers.filter((u) => !renamedOldUsernameSet.has(u)); 

                // Ordinary unfollowers: lost followers who didn't vanish from both lists simultaneously
                const ordinaryUnfollowers = filteredLostFollowers.filter((u) => !filteredMissingUsers.includes(u));
                if (ordinaryUnfollowers.length > 0) {
                    newUnfollowers.push(...ordinaryUnfollowers);
                }

                // Only anomalous missing accounts (vanished from both following & followers) are candidates for checkAccountStatus
                const maxVerify = CONFIG.MAX_AUTO_VERIFY_ACCOUNTS || 5;
                const accountsToVerify = filteredMissingUsers.slice(0, maxVerify);
                const unverifiedMissing = filteredMissingUsers.slice(maxVerify);

                // Any remaining missing accounts beyond the safe limit are safely classified as unfollowers to prevent API flood
                if (unverifiedMissing.length > 0) {
                    newUnfollowers.push(...unverifiedMissing);
                }

                if (accountsToVerify.length > 0) {
                    UI.setStatus(`Verifying ${accountsToVerify.length} suspicious account(s)...`);
                    for (let i = 0; i < accountsToVerify.length; i++) {
                        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
                        const username = accountsToVerify[i];
                        UI.setProgress(i + 1, accountsToVerify.length, `Verifying status (${i + 1}/${accountsToVerify.length}): @${username}`);
                        const status = await API.checkAccountStatus(username, { signal });

                        if (status === 'Deactivated') {
                            newDeactivated.push(username);
                        } else if (status === 'Blocked') {
                            newBlocked.push(username);
                        } else if (status === 'Active') {
                            newUnfollowers.push(username);
                            // Auto-heal: If an account was previously misclassified as Blocked, remove it!
                            let currentBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY);
                            if (currentBlocked.some((b) => b.username === username)) {
                                currentBlocked = currentBlocked.filter((b) => b.username !== username);
                                Storage.setScopedValue(CONFIG.BLOCKED_KEY, currentBlocked);
                                UI.renderNominalList(currentBlocked, "ig-view-blocked", "Blocked Accounts");
                            }
                        } else {
                            Utils.logError(
                                `Unexpected status "${status}" from checkAccountStatus for user "${username}"`,
                                null
                            );
                            newUnfollowers.push(username);
                        }

                        if (i < accountsToVerify.length - 1) {
                            await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS, signal);
                        }
                    }
                    UI.hideProgress();
                }    
    
                if (newUnfollowers.length > 0) {
                    UI.log("Identified " + newUnfollowers.length + " new unfollower(s).");
                    Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers);
                }
                
                if (newDeactivated.length > 0) {
                    UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
                    Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated);
                }

                if (newBlocked.length > 0) {
                    UI.log("Identified " + newBlocked.length + " account(s) that blocked you.");
                    Storage.addNominalEntries(CONFIG.BLOCKED_KEY, newBlocked);
                }

                // Auto-cleanup: remove any account from BLOCKED_KEY if currently present in following or followers
                const activeHandles = new Set([...following, ...followers]);
                let storedBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY);
                const cleanedBlocked = storedBlocked.filter((b) => !activeHandles.has(b.username));
                if (cleanedBlocked.length !== storedBlocked.length) {
                    Storage.setScopedValue(CONFIG.BLOCKED_KEY, cleanedBlocked);
                    UI.renderNominalList(cleanedBlocked, "ig-view-blocked", "Blocked Accounts");
                }
            } else {
                UI.log("First run: Initial state established.");
            }
            
            Storage.save({
                version: 4, 
                lastRun: Utils.now(),
                followers, 
                following, 
                followersDetailed, 
                followingDetailed,
                notFollowingBackDetailed,
                fansDetailed,
                mutualsDetailed,
                newFollowersDetailed: Storage.getNewFollowersList(),
                whitelist: Storage.getWhitelist(),
                unfollowers: Storage.getNominalList(CONFIG.CHURN_KEY),
                deactivated: Storage.getNominalList(CONFIG.DEACTIVATED_KEY),
                blocked: Storage.getNominalList(CONFIG.BLOCKED_KEY),
                renamed: Storage.getNominalList(CONFIG.RENAMED_KEY),
                history: Storage.getHistory()
            });
            
            UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
            UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
            UI.renderNewFollowers(Storage.getNewFollowersList());
            UI.renderWhitelist(Storage.getWhitelist());
            UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
            UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
            UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
            UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
            UI.renderPersistedSnapshot(Storage.load());
            
            App.lastResults = notFollowingBackDetailed;
            window.__igLastResults = notFollowingBackDetailed;
            UI.setStatus("Completed");
            UI.log("[OK] Analysis completed successfully.");
            
        } catch (e) {
            UI.hideProgress();
            if (e.name === 'AbortError' || signal?.aborted) {
                UI.setStatus("Cancelled");
                UI.log("[INFO] Analysis cancelled by user.");
            } else {
                UI.setStatus("Error");
                UI.log("[ERROR] Analysis failed: " + (e.message || String(e)));
                Utils.logError("Failed analysis", e);
            }
        } finally {
            App.isRunning = false;
            App.abortController = null;
            UI.setRunButtonState('idle');
        }
    },

    runStorySpy: async (username, btnElement, targetUserId = null) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        const safeUsername = Utils.escapeHtml(cleanUser);
        let resolvedUserId = (targetUserId && String(targetUserId) !== "0" && String(targetUserId) !== "null")
            ? String(targetUserId)
            : (btnElement?.getAttribute("data-user-id") || null);

        if (btnElement) {
            if (btnElement.disabled) return;
            btnElement.disabled = true;
            btnElement.innerHTML = `<span style="opacity:0.8; display:inline-flex; align-items:center; gap:4px;">${Icons.spy} Scanning...</span>`;
        }

        try {
            UI.log(`[Story Spy] Checking story & highlight visibility for @${cleanUser}...`);
            const status = await API.checkStoryStatus(cleanUser, resolvedUserId);

            if (!status) {
                await UI.confirmAction("Error", `Could not fetch data for @${safeUsername}. The profile might be unavailable or network connection failed.`, "Close", false);
                return;
            }

            // Retrieve previous observations from storage before saving current
            const history = Storage.getStoryObservations(cleanUser);
            const previous = history.length > 0 ? history[history.length - 1] : null;

            let probability = 0;
            let reason = "";
            let anomalyBadge = "Normal";

            // 1. Check Server Gating (null latest_reel_media)
            if (status.isGated) {
                probability = 95;
                anomalyBadge = "Gated Access";
                reason = "Meta's API returned a restricted/gated state (<code>latest_reel_media: null</code>) for your account session. You are restricted or hidden from viewing this user's stories.";
            }
            // 2. Check Anonymous Guest Discrepancy for Public Accounts
            else if (!status.isPrivate && (status.anonHighlightsCount > 0 || status.anonHasStory) && (status.authHighlightsCount === 0 && !status.authHasStory)) {
                probability = 100;
                anomalyBadge = "Confirmed Hiding";
                reason = `Confirmed: Highlights (${status.anonHighlightsCount}) or active stories are publicly visible to anonymous guest visitors, but completely hidden from your logged-in account (0 highlights). This user is actively hiding stories from you.`;
            }
            // 3. Normal Visibility (Highlights or Stories visible right now)
            else if (status.authHighlightsCount > 0 || status.authHasStory) {
                probability = 0;
                anomalyBadge = "Normal Visibility";
                const visibleItems = [];
                if (status.authHighlightsCount > 0) visibleItems.push(`<b>${status.authHighlightsCount} highlight(s)</b>`);
                if (status.isBestieStory) visibleItems.push("a <b>Close Friends Story</b> (green ring)");
                else if (status.authHasStory) visibleItems.push("an <b>Active Story</b>");
                reason = `Normal visibility: Your account can see ${visibleItems.join(" and ")}. No story or highlight hiding detected.`;
            }
            // 4. Chronological Analysis (0 highlights & 0 stories currently visible)
            else if (previous) {
                const prevHighlights = previous.highlightsCount || previous.highlights || 0;
                const prevStory = Boolean(previous.hasStory || (previous.latestReelMedia && previous.latestReelMedia > 0));
                const prevReelMedia = previous.latestReelMedia ? Number(previous.latestReelMedia) : 0;

                const nowSeconds = Math.floor(Date.now() / 1000);
                const storyAgeSeconds = prevReelMedia > 0 ? (nowSeconds - prevReelMedia) : null;
                const isStoryUnexpired = storyAgeSeconds !== null && storyAgeSeconds >= 0 && storyAgeSeconds < 86400;

                if (prevHighlights > 0 && prevStory && isStoryUnexpired) {
                    probability = 95;
                    anomalyBadge = "Critical Anomaly";
                    const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
                    reason = `<b>Critical Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b> and an active story posted ~${hoursAgo}h ago. In this scan, <b>both the highlights and the story vanished simultaneously</b> (0 highlights, 0 stories). When an Instagram user hides stories from you, Meta instantly strips both active stories and highlights from your account feed.`;
                } else if (prevHighlights > 0) {
                    probability = 90;
                    anomalyBadge = "Highlights Vanished";
                    const prevTitles = previous.highlightTitles?.length ? ` (e.g. <i>"${previous.highlightTitles.slice(0, 3).map((t) => Utils.escapeHtml(t)).join('", "')}"</i>)` : '';
                    reason = `<b>High Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b>${prevTitles}. In this scan, 0 highlights were returned. Highlights do not expire after 24 hours. Unless the user deleted or archived all their highlights, they have hidden their stories and highlights from you.`;
                } else if (prevStory && isStoryUnexpired) {
                    probability = 80;
                    anomalyBadge = "Story Vanished Early";
                    const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
                    reason = `<b>Anomaly Detected:</b> An active story posted ~${hoursAgo}h ago is no longer visible to your account (stories last 24h). The user either deleted the story manually or hid their stories from you.`;
                } else {
                    probability = 0;
                    anomalyBadge = "No Content";
                    reason = "No active stories or highlights currently detected for this account. Both previous and current scans show 0.";
                }
            }
            // 5. First scan with 0 highlights & 0 stories
            else {
                probability = 0;
                anomalyBadge = "Baseline Recorded";
                reason = `First scan baseline recorded: 0 highlights and no active stories currently visible. If this user posts stories or has highlights you should see, future scans will alert you immediately if discrepancies occur.`;
            }

            // Save new observation to storage
            Storage.addStoryObservation(cleanUser, {
                highlightsCount: status.authHighlightsCount,
                latestReelMedia: status.latestReelMedia,
                latestBestiesReelMedia: status.latestBestiesReelMedia,
                hasStory: status.authHasStory,
                isBestieStory: status.isBestieStory,
                isPrivate: status.isPrivate,
                highlightTitles: (status.authHighlights || []).map((h) => h.title)
            });

            // Refresh history for display in modal
            const updatedHistory = Storage.getStoryObservations(cleanUser);

            // Determine status styling
            let statusColor = '#10b981'; // Green
            let badgeBg = 'rgba(16, 185, 129, 0.14)';
            let badgeBorder = 'rgba(16, 185, 129, 0.3)';

            if (probability >= 75) {
                statusColor = '#ef4444'; // Red
                badgeBg = 'rgba(239, 68, 68, 0.14)';
                badgeBorder = 'rgba(239, 68, 68, 0.3)';
            } else if (probability > 0) {
                statusColor = '#f59e0b'; // Amber
                badgeBg = 'rgba(245, 158, 11, 0.14)';
                badgeBorder = 'rgba(245, 158, 11, 0.3)';
            }

            // Format story status text
            let storyStatusText = "None active";
            if (status.isGated) {
                storyStatusText = '<span style="color:#ef4444; font-weight:600;">Gated / Restricted</span>';
            } else if (status.isBestieStory) {
                storyStatusText = '<span style="color:#10b981; font-weight:600;">Close Friends Story (Active)</span>';
            } else if (status.authHasStory) {
                const nowSec = Math.floor(Date.now() / 1000);
                const ageSec = nowSec - (status.latestReelMedia || nowSec);
                const ageHours = Math.max(0, Math.floor(ageSec / 3600));
                const ageMins = Math.max(0, Math.floor((ageSec % 3600) / 60));
                const timeStr = ageHours > 0 ? `${ageHours}h ${ageMins}m ago` : `${ageMins}m ago`;
                storyStatusText = `<span style="color:#3b82f6; font-weight:600;">Active Story (Posted ~${timeStr})</span>`;
            }

            // Build history timeline HTML
            let historyHtml = '';
            if (updatedHistory.length > 1) {
                const recentScans = updatedHistory.slice(-4).reverse();
                historyHtml = `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); text-align: left;">
                        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                            Scan History Timeline (${updatedHistory.length} recorded)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${recentScans.map((obs, idx) => {
                                const isCurrent = idx === 0;
                                const dateStr = (obs.timestamp || '').split('T')[1]?.slice(0, 5) || 'Scan';
                                const hCount = obs.highlightsCount ?? obs.highlights ?? 0;
                                const hasS = obs.hasStory || (obs.latestReelMedia && obs.latestReelMedia > 0);
                                return `
                                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 5px 8px; border-radius: 6px; background: ${isCurrent ? 'rgba(255,255,255,0.05)' : 'transparent'}; border: 1px solid ${isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent'};">
                                        <span style="color: ${isCurrent ? '#f8fafc' : '#94a3b8'}; font-weight: ${isCurrent ? '600' : '400'};">
                                            ${isCurrent ? '● Current' : `○ ${dateStr}`}
                                        </span>
                                        <span style="color: #cbd5e1;">
                                            ${hCount} highlights · ${hasS ? 'Story Active' : 'No Story'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            const targetType = status.isPrivate ? 'Private Account' : 'Public Account';
            const highlightsDetail = status.authHighlightsCount > 0 
                ? `<b style="color:#10b981;">${status.authHighlightsCount} visible</b>` 
                : '<span style="color:#94a3b8;">0 detected</span>';

            const resultHtml = `
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${badgeBg}; color: ${statusColor}; border: 1px solid ${badgeBorder}; margin-bottom: 10px;">
                        ${anomalyBadge}
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: ${statusColor}; letter-spacing: -1px; line-height: 1;">
                        ${probability}%
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        Story Hiding Probability
                    </div>
                </div>

                <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); text-align: left; margin-bottom: 14px;">
                    ${reason}
                </div>

                <div style="background: rgba(255, 255, 255, 0.03); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Target Profile:</span>
                        <span style="color: #f8fafc; font-weight: 600;">@${safeUsername} (${targetType})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Highlights (Tray):</span>
                        <span>${highlightsDetail}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; ${!status.isPrivate ? 'border-bottom: 1px solid rgba(255,255,255,0.05);' : ''}">
                        <span style="color: #94a3b8;">Active Story:</span>
                        <span>${storyStatusText}</span>
                    </div>
                    ${!status.isPrivate ? `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                        <span style="color: #94a3b8;">Guest Session (Anon):</span>
                        <span style="color: #cbd5e1;">${status.anonHighlightsCount} highlights</span>
                    </div>` : ''}
                </div>

                ${historyHtml}
            `;

            UI.log(`[Story Spy] @${cleanUser}: ${probability}% anomaly probability (${status.isPrivate ? 'Private' : 'Public'}).`);
            await UI.confirmAction(`Story Spy: @${safeUsername}`, resultHtml, "Close", false, Icons.spy);

        } catch (e) {
            Utils.logError("Error in runStorySpy", e);
            await UI.confirmAction("Error", "An unexpected error occurred while checking story visibility.", "Close", false);
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = `${Icons.spy} Check Story`;
            }
        }
    },

    targetRunning: false,
    targetAbortController: null,

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
            let lostFollowersDetailed = [];

            if (prevData && prevFollowerNames.length > 0) {
                const newFollowersNames = Utils.diff(currentFollowerNames, prevFollowerNames);
                const lostFollowersNames = Utils.diff(prevFollowerNames, currentFollowerNames);

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

                UI.targetLog(`[Diff Results] Gained: +${newFollowersDetailed.length} followers | Lost: -${lostFollowersDetailed.length} followers.`);
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
    
    bindEvents: () => {
        const btnRun = document.getElementById("ig-run");
        if (btnRun) btnRun.onclick = App.run;
        
        const btnExport = document.getElementById("ig-export-csv");
        if (btnExport) btnExport.onclick = () => {
            const activeUsers = (typeof UI.getActiveViewUsers === 'function') ? UI.getActiveViewUsers() : null;
            const resultsToExport = (activeUsers && activeUsers.length > 0)
                ? activeUsers
                : (App.lastResults || window.__igLastResults);

            if (resultsToExport && resultsToExport.length > 0) {
                const dateStr = Utils.now().split("T")[0];
                Utils.exportCSV(resultsToExport, "ig_analysis_" + dateStr + ".csv");
                UI.log("CSV Exported (" + resultsToExport.length + " accounts).");
            }
        };
        
        const btnReset = document.getElementById("ig-reset");
        if (btnReset) {
            btnReset.onclick = async () => {
                const confirmed = await UI.confirmAction(
                    "Delete All Data", 
                    "This action will wipe all your history, logs, and whitelists.<br><br>Are you sure you want to proceed?",
                    "Yes, Delete"
                );

                if (confirmed) {
                    Storage.resetAll();
                    if (typeof API.clearFriendshipCache === 'function') {
                        API.clearFriendshipCache();
                    }
                    UI.log("[INFO] Data reset.");
                    const mainPanel = document.getElementById("ig-analyzer-panel");
                    if (mainPanel) {
                        mainPanel.querySelectorAll(".ig-view-container").forEach((el) => {
                            if (el.id !== "ig-log") el.innerHTML = "";
                        });
                    }
                    if (btnExport) btnExport.disabled = true;
                }
            };
        }
        
        // Single unified delegated click listener for panel actions
        const panel = document.getElementById("ig-analyzer-panel");
        if (panel) {
            panel.addEventListener("click", async (e) => {
                // 1. Delegated Story Spy Button
                const btnSpy = e.target.closest(".btn-spy-story, .ig-btn-spy-story");
                if (btnSpy) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btnSpy.disabled) return;
                    const username = btnSpy.getAttribute("data-user");
                    const userId = btnSpy.getAttribute("data-user-id");
                    if (!username) return;
                    await App.runStorySpy(username, btnSpy, userId);
                    return;
                }

                // 2. Delegated Avatar & Inspect Button Click (Quick-Card Modal)
                const inspectTrigger = e.target.closest(".ig-user-avatar-trigger, .btn-inspect-user, .ig-btn-inspect-user");
                if (inspectTrigger) {
                    e.preventDefault();
                    e.stopPropagation();
                    const userId = inspectTrigger.getAttribute("data-user-id");
                    const username = inspectTrigger.getAttribute("data-username");
                    const containerId = inspectTrigger.getAttribute("data-container");

                    let userObj = null;
                    if (containerId && UI.paginationState[containerId]?.rawUsers) {
                        userObj = UI.paginationState[containerId].rawUsers.find(
                            (u) => (userId && String(u.id) === String(userId)) || u.username === username
                        );
                    }
                    if (!userObj) {
                        userObj = { id: userId, username };
                    }
                    if (containerId) {
                        userObj.containerId = containerId;
                    }
                    UI.openHdPhotoModal(userObj);
                    return;
                }

                // 3. Delegated Whitelist / Ignore Button
                const btnWl = e.target.closest(".btn-whitelist, .ig-btn-whitelist");
                if (btnWl) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btnWl.disabled) return;
                    const targetUser = btnWl.getAttribute("data-user");
                    const containerId = btnWl.getAttribute("data-container");
                    if (!targetUser) return;

                    btnWl.disabled = true;
                    Storage.addToWhitelist(targetUser);
                    UI.log("[INFO] " + targetUser + " added to whitelist.");
                    UI.renderWhitelist(Storage.getWhitelist());

                    if (App.lastResults) {
                        App.lastResults = App.lastResults.filter((u) => u.username !== targetUser);
                    }
                    if (window.__igLastResults) {
                        window.__igLastResults = window.__igLastResults.filter((u) => u.username !== targetUser);
                        const exportBtn = document.getElementById("ig-export-csv");
                        if (exportBtn) exportBtn.disabled = window.__igLastResults.length === 0;
                    }

                    const row = btnWl.closest(".ig-user-row");
                    if (row) {
                        row.classList.add("ig-row-slide-out");
                        setTimeout(() => {
                            if (containerId && typeof UI.removeUserFromResults === 'function') {
                                UI.removeUserFromResults(containerId, targetUser);
                            } else if (containerId && UI.paginationState[containerId]) {
                                UI.paginationState[containerId].users = UI.paginationState[containerId].users.filter((u) => u.username !== targetUser);
                                UI.renderResultsPage(containerId);
                            }
                        }, 280);
                    } else if (containerId && typeof UI.removeUserFromResults === 'function') {
                        UI.removeUserFromResults(containerId, targetUser);
                    } else if (containerId && UI.paginationState[containerId]) {
                        UI.paginationState[containerId].users = UI.paginationState[containerId].users.filter((u) => u.username !== targetUser);
                        UI.renderResultsPage(containerId);
                    }
                    return;
                }

                // 4. Delegated Restore from Whitelist Button
                const btnUnwl = e.target.closest(".btn-unwhitelist, .ig-btn-unwhitelist");
                if (btnUnwl) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (btnUnwl.disabled) return;
                    const targetUser = btnUnwl.getAttribute("data-user");
                    if (!targetUser) return;

                    btnUnwl.disabled = true;
                    Storage.removeFromWhitelist(targetUser);
                    UI.log("[INFO] @" + targetUser + " restored from whitelist.");

                    const row = btnUnwl.closest(".ig-user-row");
                    if (row) {
                        row.classList.add("ig-row-slide-out");
                        setTimeout(() => {
                            UI.renderWhitelist(Storage.getWhitelist());
                        }, 280);
                    } else {
                        UI.renderWhitelist(Storage.getWhitelist());
                    }

                    // Restore immediately into "Not Following You Back" list if applicable
                    const snapshot = Storage.load();
                    if (snapshot && Array.isArray(snapshot.following) && Array.isArray(snapshot.followers)) {
                        if (snapshot.following.includes(targetUser) && !snapshot.followers.includes(targetUser)) {
                            const notFollowingState = UI.paginationState["ig-view-notfollowing"];
                            if (notFollowingState && Array.isArray(notFollowingState.rawUsers)) {
                                if (!notFollowingState.rawUsers.some((u) => u.username === targetUser)) {
                                    const knownObj = (snapshot.followingDetailed || []).find((u) => u.username === targetUser) || {
                                        username: targetUser,
                                        url: "https://www.instagram.com/" + targetUser + "/"
                                    };
                                    notFollowingState.rawUsers.unshift(knownObj);
                                    UI.applyFilters("ig-view-notfollowing");
                                    if (App.lastResults) App.lastResults.unshift(knownObj);
                                    if (window.__igLastResults) window.__igLastResults.unshift(knownObj);
                                }
                            }
                        }
                    }
                    return;
                }

                // 5. Delegated Clear Whitelist Button
                const btnClearWl = e.target.closest(".btn-clear-whitelist, .ig-btn-clear-whitelist");
                if (btnClearWl) {
                    e.preventDefault();
                    e.stopPropagation();
                    const confirmed = await UI.confirmAction(
                        "Clear Whitelist",
                        "Are you sure you want to remove all accounts from the whitelist?<br><br>They will be monitored again in future scans.",
                        "Yes, Clear All"
                    );
                    if (confirmed) {
                        Storage.clearWhitelist();
                        UI.log("[INFO] Whitelist cleared.");
                        UI.renderWhitelist([]);
                        const snap = Storage.load();
                        if (snap && Array.isArray(snap.following) && Array.isArray(snap.followers)) {
                            const following = snap.following;
                            const followers = snap.followers;
                            const notFollowingBackUsernames = Utils.diff(following, followers);
                            const allUsersMap = new Map();
                            [...(snap.followingDetailed || []), ...(snap.followersDetailed || [])].forEach((u) => {
                                if (u?.username) allUsersMap.set(u.username, u);
                            });
                            const restored = notFollowingBackUsernames.map((u) => ({
                                ...(allUsersMap.get(u) || {}),
                                username: u,
                                url: "https://www.instagram.com/" + u + "/"
                            }));
                            UI.renderResults(restored, "Not Following You Back", "ig-view-notfollowing", true);
                            App.lastResults = restored;
                            window.__igLastResults = restored;
                        }
                    }
                    return;
                }

                // 6. Delegated Target Audit Button (.btn-target-audit, .ig-btn-target-audit)
                const btnTargetAudit = e.target.closest(".btn-target-audit, .ig-btn-target-audit");
                if (btnTargetAudit) {
                    e.preventDefault();
                    e.stopPropagation();
                    const username = btnTargetAudit.getAttribute("data-user");
                    const userId = btnTargetAudit.getAttribute("data-user-id");
                    if (username) {
                        App.openTargetAudit(username, userId, false);
                    }
                    return;
                }

                // 7. Delegated Target Card Open Button
                const btnCardOpen = e.target.closest(".btn-target-card-open");
                if (btnCardOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    const username = btnCardOpen.getAttribute("data-username");
                    if (username) App.openTargetAudit(username, null, false);
                    return;
                }

                // 8. Delegated Target Card Refresh Button
                const btnCardRefresh = e.target.closest(".btn-target-card-refresh");
                if (btnCardRefresh) {
                    e.preventDefault();
                    e.stopPropagation();
                    const username = btnCardRefresh.getAttribute("data-username");
                    if (username) App.openTargetAudit(username, null, true);
                    return;
                }

                // 9. Delegated Target Card Delete Button
                const btnCardDelete = e.target.closest(".btn-target-card-delete");
                if (btnCardDelete) {
                    e.preventDefault();
                    e.stopPropagation();
                    const username = btnCardDelete.getAttribute("data-username");
                    if (username) {
                        const confirmed = await UI.confirmAction(
                            "Remove Monitored Target",
                            `Are you sure you want to stop tracking <b>@${Utils.escapeHtml(username)}</b>?<br><br>Their audit history will be deleted.`,
                            "Yes, Remove",
                            true,
                            Icons.trash
                        );
                        if (confirmed) {
                            Storage.removeTargetData(username);
                            UI.renderTargetTrackerMainView();
                            UI.log(`[INFO] @${username} removed from monitored targets.`);
                        }
                    }
                    return;
                }

                // 10. Delegated Pagination Controls
                const btnPrev = e.target.closest(".ig-page-prev");
                if (btnPrev && !btnPrev.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cId = btnPrev.getAttribute("data-container");
                    if (cId) UI.changePage(cId, -1);
                    return;
                }

                const btnNext = e.target.closest(".ig-page-next");
                if (btnNext && !btnNext.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cId = btnNext.getAttribute("data-container");
                    if (cId) UI.changePage(cId, 1);
                    return;
                }

                // 11. Delegated Target Tracker Search Button
                const btnTargetSearch = e.target.closest("#ig-btn-target-search, .btn-target-search");
                if (btnTargetSearch) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTargetSearch();
                    return;
                }

                // 12. Delegated Target Card Click (open subpanel)
                const targetCard = e.target.closest(".ig-target-card");
                if (targetCard && !e.target.closest(".btn-target-card-delete, .btn-target-card-refresh, .btn-target-card-open, a, button")) {
                    e.preventDefault();
                    e.stopPropagation();
                    const username = targetCard.getAttribute("data-username");
                    if (username) App.openTargetAudit(username, null, false);
                    return;
                }
            });

            panel.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && e.target && e.target.id === "ig-target-search-input") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTargetSearch();
                }
            });

            panel.addEventListener("input", (e) => {
                if (e.target && e.target.id === "ig-target-search-input") {
                    const fb = document.getElementById("ig-target-search-feedback");
                    if (fb && fb.style.display !== 'none') {
                        fb.style.display = 'none';
                    }
                }
            });
        }

        // Target Tracker search form in main panel
        const handleTargetSearch = () => {
            const input = document.getElementById("ig-target-search-input");
            const fb = document.getElementById("ig-target-search-feedback");
            const rawVal = input ? input.value : '';
            const cleanUser = String(rawVal || '').replace(/^@+\s*/, '').trim().replace(/\s+/g, '');

            if (!cleanUser) {
                if (fb) {
                    fb.style.display = 'block';
                    fb.className = 'ig-target-feedback is-error';
                    fb.textContent = 'Please enter an Instagram username.';
                }
                if (input) input.focus();
                return;
            }

            if (!/^[a-zA-Z0-9._]+$/.test(cleanUser)) {
                if (fb) {
                    fb.style.display = 'block';
                    fb.className = 'ig-target-feedback is-error';
                    fb.textContent = `Invalid username format for "@${cleanUser}". Usernames can only contain letters, numbers, periods, and underscores.`;
                }
                if (input) input.focus();
                return;
            }

            if (fb) {
                fb.style.display = 'none';
                fb.textContent = '';
            }

            App.openTargetAudit(cleanUser, null, true);
        };
        App.handleTargetSearch = handleTargetSearch;

        // Subpanel controls and event delegation
        const subpanel = document.getElementById("ig-target-subpanel");
        if (subpanel) {
            const btnTargetRun = subpanel.querySelector("#ig-target-run");
            if (btnTargetRun) {
                btnTargetRun.onclick = () => {
                    if (App.targetRunning) {
                        App.abortTargetAudit();
                    } else if (UI.currentTargetUser) {
                        App.runTargetAudit(UI.currentTargetUser, true);
                    }
                };
            }

            const btnTargetExport = subpanel.querySelector("#ig-target-export-csv");
            if (btnTargetExport) {
                btnTargetExport.onclick = () => {
                    const listToExport = UI.getTargetActiveList();
                    if (listToExport && listToExport.length > 0) {
                        const targetName = UI.currentTargetUser?.username || 'target';
                        const activeTab = subpanel.querySelector('#ig-target-tabs .ig-tab-btn.active');
                        const tabLabel = activeTab ? activeTab.innerText.trim().toLowerCase().replace(/\s+/g, '_') : 'list';
                        const dateStr = Utils.now().split("T")[0];
                        Utils.exportCSV(listToExport, `@${targetName}_${tabLabel}_${dateStr}.csv`);
                        UI.targetLog(`CSV Exported (${listToExport.length} accounts).`);
                    }
                };
            }
        }

        document.addEventListener("keydown", (e) => {
            const tag = document.activeElement.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;
            if (e.key === "F9") UI.togglePanel();
            if (e.key === "F8") UI.resetPosition();
        });
    }
};

window.App = App;