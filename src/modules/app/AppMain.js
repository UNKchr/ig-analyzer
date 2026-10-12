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

                // Calculate globally renamed users to prevent false unfollows/new follows
                const allPrevUsersDetailed = [...prevFollowersDetailed, ...prevFollowingDetailed];
                const allCurrUsersDetailed = [...followersDetailed, ...followingDetailed];
                const globalRenamed = Utils.detectRenamedMutuals(allPrevUsersDetailed, allCurrUsersDetailed);
                const globalRenamedOldSet = new Set(globalRenamed.map(r => r.oldUsername));
                const globalRenamedNewSet = new Set(globalRenamed.map(r => r.newUsername));
                
                // Auto-heal the whitelist if any whitelisted users changed their username
                if (globalRenamed.length > 0) {
                    let wl = Storage.getWhitelist();
                    let wlChanged = false;
                    globalRenamed.forEach(r => {
                        const idx = wl.indexOf(r.oldUsername);
                        if (idx !== -1) {
                            wl[idx] = r.newUsername;
                            wlChanged = true;
                        }
                    });
                    if (wlChanged) {
                        Storage.setScopedValue(CONFIG.WHITELIST_KEY, wl);
                    }
                }

                const rawNewFollowers = Utils.diff(followers, prevFollowers);
                const newFollowers = rawNewFollowers.filter(u => !globalRenamedNewSet.has(u));

                UI.log("New followers since last run: " + newFollowers.length);
                const newFollowersDetailed = mapToDetailed(newFollowers).map((u) => ({
                    ...u,
                    followsBack: following.includes(u.username),
                    date: Utils.now().split("T")[0]
                }));
                if (newFollowersDetailed.length > 0) {
                    Storage.addNewFollowersEntries(newFollowersDetailed);
                }
                
                const rawLostFollowers = Utils.diff(prevFollowers, followers);
                const lostFollowers = rawLostFollowers.filter(u => !globalRenamedOldSet.has(u));

                const rawLostFollowing = Utils.diff(prevFollowing, following);
                const lostFollowing = rawLostFollowing.filter(u => !globalRenamedOldSet.has(u));

                const missingUsers = Utils.intersection(lostFollowers, lostFollowing);

                
                const prevMutualsDetailed = Utils.intersectionById(prevFollowersDetailed, prevFollowingDetailed); 
                const currMutualsDetailed = Utils.intersectionById(followersDetailed, followingDetailed); 
                const renamedEntries = Utils.detectRenamedMutuals(prevMutualsDetailed, currMutualsDetailed); 

                if (renamedEntries.length > 0) {
                    Storage.addRenamedEntries(renamedEntries); 
                    UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
                    UI.log("Detected " + renamedEntries.length + " confirmed username change(s) in mutuals."); 
                }

                const newDeactivated = [];
                const newBlocked = [];
                const newUnfollowers = [];

                // Ordinary unfollowers: lost followers who didn't vanish from both lists simultaneously
                const ordinaryUnfollowers = lostFollowers.filter((u) => !missingUsers.includes(u));
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

});
