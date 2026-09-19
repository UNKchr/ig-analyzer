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
            
            UI.log("Fetching 'Following'...");
            const followingDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following", { signal }); 
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            UI.log("Fetching 'Followers'...");
            const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers", { signal }); 
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
                        UI.setStatus(`Verifying account status (${i + 1}/${accountsToVerify.length}): @${username}`);
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
                unfollowers: Storage.getNominalList(CONFIG.CHURN_KEY),
                deactivated: Storage.getNominalList(CONFIG.DEACTIVATED_KEY),
                blocked: Storage.getNominalList(CONFIG.BLOCKED_KEY),
                renamed: Storage.getNominalList(CONFIG.RENAMED_KEY),
                history: Storage.getHistory()
            });
            
            UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
            UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
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

    runStorySpy: async (username, btnElement) => {
        const safeUsername = Utils.escapeHtml(username);
        if (btnElement) {
            if (btnElement.disabled) return;
            btnElement.disabled = true;
            btnElement.innerHTML = '<span style="opacity:0.7;">Scanning...</span>';
        }

        try {
            UI.log(`[Spy Module] Checking story visibility for @${safeUsername}...`);
            const status = await API.checkStoryStatus(username);
            
            if (!status) {
                await UI.confirmAction("Error", `Could not fetch data for @${safeUsername}. The profile might be unavailable or rate-limited.`, "Close", false);
                return;
            }

            let probability = 0;
            let reason = "";

            if (!status.isPrivate) {
                // Public Account Logic
                if ((status.anonHighlightsCount > 0 || status.anonHasStory) && 
                    (status.authHighlightsCount === 0 && !status.authHasStory)) {
                    probability = 100;
                    reason = "We detected highlights or stories anonymously (guest session), but <b>NONE</b> while logged in with your account. This user is actively hiding stories from you.";
                } else if (status.authHighlightsCount > 0 || status.authHasStory) {
                    probability = 0;
                    reason = "Highlights or active stories are visible to you normally. No anomaly detected.";
                } else {
                    probability = 0;
                    reason = "No active stories or highlights detected either logged in or anonymously. The user currently has no stories/highlights published.";
                }
            } else {
                // Private Account Logic (Chronological Tracking)
                Storage.addStoryObservation(username, { 
                    highlights: status.authHighlightsCount,
                    hasStory: status.authHasStory
                });

                const history = Storage.getStoryObservations(username);
                
                if (history.length > 1) {
                    const previous = history[history.length - 2];
                    const current = history[history.length - 1];

                    if (previous.highlights > 0 && current.highlights === 0) {
                        probability = 75;
                        reason = `On ${previous.timestamp.split('T')[0]} this private account had visible highlights. In this scan they show 0. They might have hidden you from stories, or deleted/archived their highlights.`;
                    } else if (current.highlights > 0 || current.hasStory) {
                        probability = 0;
                        reason = "Highlights or stories are visible to you normally. No anomaly detected.";
                    } else {
                        probability = 0;
                        reason = "No highlights currently detected. Need more chronological observation points to detect changes.";
                    }
                } else {
                    probability = 0;
                    reason = "First observation recorded for this private account. Future checks will compare against this baseline to detect if highlights vanish.";
                }
            }

            let statusColor = '#22c55e';
            if (probability >= 75) statusColor = '#ef4444';
            else if (probability > 0) statusColor = '#eab308';

            const targetType = status.isPrivate ? 'Private' : 'Public';
            let resultHtml = `
                <div style="text-align:center; margin-bottom: 14px;">
                    <div style="font-size: 26px; font-weight: bold; color: ${statusColor};">${probability}% Probability</div>
                    <div style="font-size: 13px; color: #8e8e8e; margin-top: 2px;">Story / Highlight Hiding Detected</div>
                </div>
                <div style="background: rgba(255,255,255,0.06); padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.4; border: 1px solid rgba(255,255,255,0.1);">
                    ${reason}
                </div>
                <div style="margin-top: 14px; font-size: 12px; color: #8e8e8e; line-height: 1.6; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                    <b>Target:</b> @${safeUsername} (${targetType})<br>
                    <b>Highlights (Logged In):</b> ${status.authHighlightsCount > 0 ? `Visible (${status.authHighlightsCount})` : 'None detected'}<br>
                    <b>Story (Logged In):</b> ${status.authHasStory ? 'Active Story' : 'None'}<br>
                    ${!status.isPrivate ? `<b>Highlights (Guest):</b> ${status.anonHighlightsCount > 0 ? `Visible (${status.anonHighlightsCount})` : 'None'}<br><b>Story (Guest):</b> ${status.anonHasStory ? 'Active Story' : 'None'}` : '<i>Guest check not applicable to private accounts.</i>'}
                </div>
            `;

            UI.log(`[Spy Module] @${safeUsername}: ${probability}% anomaly probability (${targetType}).`);
            await UI.confirmAction(`Story Spy: @${safeUsername}`, resultHtml, "Close", false, Icons.spy);

        } catch (e) {
            Utils.logError("Error in runStorySpy", e);
            await UI.confirmAction("Error", "An unexpected error occurred while running the spy check.", "Close", false);
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = `${Icons.spy} Check Story`;
            }
        }
    },
    
    bindEvents: () => {
        const btnRun = document.getElementById("ig-run");
        if (btnRun) btnRun.onclick = App.run;
        
        const btnExport = document.getElementById("ig-export-csv");
        if (btnExport) btnExport.onclick = () => {
            const resultsToExport = App.lastResults || window.__igLastResults;
            if (resultsToExport && resultsToExport.length > 0) {
                const dateStr = Utils.now().split("T")[0];
                Utils.exportCSV(resultsToExport, "ig_no_follow_back_" + dateStr + ".csv");
                UI.log("CSV Exported.");
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
                    UI.log("[INFO] Data reset.");
                    document.querySelectorAll(".ig-view-container").forEach((el) => {
                        if (el.id !== "ig-log") el.innerHTML = "";
                    });
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
                    if (!username) return;
                    await App.runStorySpy(username, btnSpy);
                    return;
                }

                // 2. Delegated Whitelist / Ignore Button
                const btnWl = e.target.closest(".btn-whitelist, .ig-btn-whitelist");
                if (btnWl) {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetUser = btnWl.getAttribute("data-user");
                    const containerId = btnWl.getAttribute("data-container");
                    if (!targetUser) return;
                    Storage.addToWhitelist(targetUser);
                    if (containerId && UI.paginationState[containerId]) {
                        UI.paginationState[containerId].users = UI.paginationState[containerId].users.filter((u) => u.username !== targetUser);
                        UI.renderResultsPage(containerId);
                    }
                    if (App.lastResults) {
                        App.lastResults = App.lastResults.filter((u) => u.username !== targetUser);
                    }
                    if (window.__igLastResults) {
                        window.__igLastResults = window.__igLastResults.filter((u) => u.username !== targetUser);
                        const exportBtn = document.getElementById("ig-export-csv");
                        if (exportBtn) exportBtn.disabled = window.__igLastResults.length === 0;
                    }
                    UI.log("[INFO] " + targetUser + " added to whitelist.");
                    return;
                }

                // 3. Delegated Pagination Controls
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
            });
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