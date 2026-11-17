import { App } from './AppState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { UI } from '../UI.js';
import { API } from '../API.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(App, {
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

            // Humanized pause simulating closing 'Following' modal and opening 'Followers' modal (1.8s - 2.8s)
            await Utils.sleep(1800 + Math.random() * 1000, signal);

            UI.log("Fetching 'Followers'...");
            const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers", { signal }, expectedFollowers); 
            if (signal.aborted) throw new DOMException("Aborted", "AbortError"); 

            
            const followingDetailed = Utils.toDetailedUserArray(followingDetailedRaw);
            const followersDetailed = Utils.toDetailedUserArray(followersDetailedRaw);
            const following = followingDetailed.map((u) => u.username);
            const followers = followersDetailed.map((u) => u.username);

            const currFollowingLowerSet = new Set(following.map((u) => u.toLowerCase()));
            const currFollowersLowerSet = new Set(followers.map((u) => u.toLowerCase()));

            const allUsersByLower = new Map();
            [...followingDetailed, ...followersDetailed].forEach((u) => {
                if (!u?.username) return;
                const key = u.username.toLowerCase();
                const existing = allUsersByLower.get(key);
                if (!existing) {
                    allUsersByLower.set(key, u);
                } else {
                    allUsersByLower.set(key, {
                        ...existing,
                        ...u,
                        id: u.id || existing.id || null,
                        fullName: u.fullName || existing.fullName || '',
                        profilePicUrl: u.profilePicUrl || existing.profilePicUrl || null
                    });
                }
            });

            UI.hideProgress();
            UI.setStatus("Calculating Metrics...");

            const prev = Storage.load();
            let prevFollowersDetailed = [];
            let prevFollowingDetailed = [];
            let followerRenames = [];
            let followingRenames = [];
            let allRenames = [];

            if (prev) {
                prevFollowersDetailed = Utils.toDetailedUserArray(
                    Array.isArray(prev.followersDetailed) ? prev.followersDetailed : (prev.followers || [])
                );
                prevFollowingDetailed = Utils.toDetailedUserArray(
                    Array.isArray(prev.followingDetailed) ? prev.followingDetailed : (prev.following || [])
                );

                // Detect username changes independently per list so Rename + Unfollow & Rename + FollowBack are never masked
                followerRenames = Utils.detectRenamedUsers(prevFollowersDetailed, followersDetailed);
                followingRenames = Utils.detectRenamedUsers(prevFollowingDetailed, followingDetailed);

                const renameMapById = new Map();
                followerRenames.forEach((r) => {
                    const isMutualNow = currFollowingLowerSet.has(r.newUsername.toLowerCase());
                    renameMapById.set(String(r.id), {
                        ...r,
                        relationship: isMutualNow ? 'mutual' : 'fan'
                    });
                });
                followingRenames.forEach((r) => {
                    const idStr = String(r.id);
                    if (renameMapById.has(idStr)) {
                        renameMapById.get(idStr).relationship = 'mutual';
                    } else {
                        const isMutualNow = currFollowersLowerSet.has(r.newUsername.toLowerCase());
                        renameMapById.set(idStr, {
                            ...r,
                            relationship: isMutualNow ? 'mutual' : 'following'
                        });
                    }
                });
                allRenames = Array.from(renameMapById.values());
            }

            // Reconcile persisted lists & heal Whitelist BEFORE computing filteredNotFollowing
            const { whitelist, reactivatedFollowersLowerSet } = Storage.reconcileAudienceState({
                followersDetailed,
                followingDetailed,
                allRenames
            });

            const whitelistLowerSet = new Set(whitelist.map((u) => String(u || '').toLowerCase()));
            const notFollowingBackUsernames = following.filter((u) => !currFollowersLowerSet.has(u.toLowerCase()));
            const filteredNotFollowing = notFollowingBackUsernames.filter((u) => !whitelistLowerSet.has(u.toLowerCase()));
            const fansUsernames = followers.filter((u) => !currFollowingLowerSet.has(u.toLowerCase()));
            const mutualsUsernames = followers.filter((u) => currFollowingLowerSet.has(u.toLowerCase()));

            const mapToDetailed = (arr) => arr.map((u) => {
                const userObj = allUsersByLower.get(String(u || '').toLowerCase()) || {};
                const canonicalName = userObj.username || u;
                return {
                    ...userObj,
                    username: canonicalName,
                    url: `https://www.instagram.com/${encodeURIComponent(canonicalName)}/`
                };
            });

            const notFollowingBackDetailed = mapToDetailed(filteredNotFollowing);
            const fansDetailed = mapToDetailed(fansUsernames);
            const mutualsDetailed = mapToDetailed(mutualsUsernames);

            UI.log("Not Following Back (filtered): " + notFollowingBackDetailed.length);
            UI.log("Fans: " + fansDetailed.length);
            UI.log("Mutuals: " + mutualsDetailed.length);

            const todayLocalStr = Utils.localDateStr();
            const scanSummary = {
                gained: 0,
                lost: 0,
                deactivated: 0,
                blocked: 0,
                renamed: allRenames.length
            };

            if (prev) {
                const prevFollowers = prevFollowersDetailed.map((u) => u.username);
                const prevFollowing = prevFollowingDetailed.map((u) => u.username);
                const prevFollowersLowerSet = new Set(prevFollowers.map((u) => u.toLowerCase()));
                const prevFollowingLowerSet = new Set(prevFollowing.map((u) => u.toLowerCase()));

                const prevUsersByLower = new Map();
                [...prevFollowingDetailed, ...prevFollowersDetailed].forEach((u) => {
                    if (u?.username) prevUsersByLower.set(u.username.toLowerCase(), u);
                });

                if (allRenames.length > 0) {
                    Storage.addRenamedEntries(allRenames);
                    UI.log("Detected " + allRenames.length + " confirmed username change(s).");
                }

                if (reactivatedFollowersLowerSet.size > 0) {
                    UI.log("Restored " + reactivatedFollowersLowerSet.size + " reactivated account(s) from Deactivated.");
                }

                // New Followers: exclude accounts that merely renamed inside followers OR reactivated from Deactivated
                const followerRenamedNewLowerSet = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
                const rawNewFollowers = followers.filter((u) => !prevFollowersLowerSet.has(u.toLowerCase()));
                const newFollowers = rawNewFollowers.filter((u) => {
                    const lower = u.toLowerCase();
                    return !followerRenamedNewLowerSet.has(lower) && !reactivatedFollowersLowerSet.has(lower);
                });

                UI.log("New followers since last run: " + newFollowers.length);
                const newFollowersDetailed = mapToDetailed(newFollowers).map((u) => ({
                    ...u,
                    followsBack: currFollowingLowerSet.has(u.username.toLowerCase()),
                    date: todayLocalStr
                }));
                if (newFollowersDetailed.length > 0) {
                    Storage.addNewFollowersEntries(newFollowersDetailed);
                }
                scanSummary.gained = newFollowersDetailed.length;

                // Lost Followers: exclude ONLY accounts that renamed while staying in followers (catching Rename + Unfollow!)
                const followerRenamedOldLowerSet = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
                const followingRenamedOldLowerSet = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
                const followingRenamedByOldLower = new Map(followingRenames.map((r) => [r.oldUsername.toLowerCase(), r]));

                const rawLostFollowers = prevFollowers.filter((u) => !currFollowersLowerSet.has(u.toLowerCase()));
                const lostFollowers = rawLostFollowers.filter((u) => !followerRenamedOldLowerSet.has(u.toLowerCase()));

                const rawLostFollowing = prevFollowing.filter((u) => !currFollowingLowerSet.has(u.toLowerCase()));
                const lostFollowing = rawLostFollowing.filter((u) => !followingRenamedOldLowerSet.has(u.toLowerCase()));
                const lostFollowingLowerSet = new Set(lostFollowing.map((u) => u.toLowerCase()));

                const missingUsers = lostFollowers.filter((u) => lostFollowingLowerSet.has(u.toLowerCase()));
                const missingLowerSet = new Set(missingUsers.map((u) => u.toLowerCase()));

                const buildLostEntry = (rawHandle) => {
                    const lower = String(rawHandle || '').toLowerCase();
                    const ren = followingRenamedByOldLower.get(lower);
                    if (ren) {
                        // Mutual renamed @old -> @new AND unfollowed viewer (still in viewer's following)
                        const liveProfile = allUsersByLower.get(ren.newUsername.toLowerCase());
                        return {
                            id: ren.id || liveProfile?.id || null,
                            username: ren.newUsername,
                            previousUsername: ren.oldUsername,
                            fullName: liveProfile?.fullName || ren.fullName || '',
                            profilePicUrl: liveProfile?.profilePicUrl || ren.profilePicUrl || null,
                            isVerified: Boolean(liveProfile?.isVerified ?? ren.isVerified),
                            isPrivate: Boolean(liveProfile?.isPrivate ?? ren.isPrivate),
                            date: todayLocalStr
                        };
                    }
                    const liveOrPrev = allUsersByLower.get(lower) || prevUsersByLower.get(lower) || {};
                    return {
                        id: liveOrPrev.id || null,
                        username: liveOrPrev.username || rawHandle,
                        fullName: liveOrPrev.fullName || '',
                        profilePicUrl: liveOrPrev.profilePicUrl || null,
                        isVerified: Boolean(liveOrPrev.isVerified),
                        isPrivate: Boolean(liveOrPrev.isPrivate),
                        date: todayLocalStr
                    };
                };

                const newDeactivated = [];
                const newBlocked = [];
                const newUnfollowers = [];

                // Ordinary unfollowers: lost followers who didn't vanish from both lists simultaneously
                const ordinaryUnfollowers = lostFollowers.filter((u) => !missingLowerSet.has(u.toLowerCase()));
                if (ordinaryUnfollowers.length > 0) {
                    newUnfollowers.push(...ordinaryUnfollowers);
                }

                // Only anomalous missing accounts (vanished from both following & followers) are candidates for checkAccountStatus
                const maxVerify = CONFIG.MAX_AUTO_VERIFY_ACCOUNTS || 5;
                const accountsToVerify = missingUsers.slice(0, maxVerify);
                const unverifiedMissing = missingUsers.slice(maxVerify);

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
                            const uLower = username.toLowerCase();
                            if (currentBlocked.some((b) => String(b.username || '').toLowerCase() === uLower)) {
                                currentBlocked = currentBlocked.filter((b) => String(b.username || '').toLowerCase() !== uLower);
                                Storage.setScopedValue(CONFIG.BLOCKED_KEY, currentBlocked);
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
                    Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers.map(buildLostEntry));
                }

                if (newDeactivated.length > 0) {
                    UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
                    Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated.map(buildLostEntry));
                }

                if (newBlocked.length > 0) {
                    UI.log("Identified " + newBlocked.length + " account(s) that blocked you.");
                    Storage.addNominalEntries(CONFIG.BLOCKED_KEY, newBlocked.map(buildLostEntry));
                }

                scanSummary.lost = newUnfollowers.length;
                scanSummary.deactivated = newDeactivated.length;
                scanSummary.blocked = newBlocked.length;
            } else {
                UI.log("First run: Initial state established.");
            }

            // Record daily & intra-day history AFTER full reconciliation so summary and KPIs reflect post-scan state
            Storage.addHistoryEntry(followers.length, following.length, null, {
                mutuals: mutualsDetailed.length,
                fans: fansDetailed.length,
                notFollowingBack: notFollowingBackDetailed.length,
                scanSummary
            });

            Storage.syncFreshUserData([...followingDetailed, ...followersDetailed]);

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

            UI.renderHistory(Storage.getHistory());
            UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
            UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
            UI.renderNewFollowers(Storage.getNewFollowersList());
            UI.renderWhitelist(Storage.getWhitelist());
            UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
            UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
            UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
            UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
            
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

});
