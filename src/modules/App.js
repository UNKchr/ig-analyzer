import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { Storage } from './Storage.js';
import { UI } from './UI.js';
import { API } from './API.js';

export const App = {
    run: async () => {
        const btnRun = document.getElementById("ig-run");
        if (btnRun) btnRun.disabled = true;

        const userConfirmed = await UI.confirmAction(
            "Safety Precaution", 
            "Excessive use of automation tools may result in temporary account restrictions.<br><br>It is recommended to run this analysis <b>only once per hour</b>.",
            "Yes, Continue"
        );

        if (!userConfirmed) {
            UI.log("Analysis cancelled by user.");
            console.log("Analysis cancelled by user.");
            if (btnRun) btnRun.disabled = false;
            return; 
        }

        UI.setStatus("Analyzing...");
        UI.log("Starting deep analysis...");
        const logTab = document.querySelector('[data-target="ig-log"]');
        if (logTab) logTab.click();
        
        try {
            const userId = Utils.getUserId();
            if (!userId) throw new Error("User ID could not be obtained. Are you logged in?");
            
            UI.log("Fetching 'Following'...");
            const followingDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following"); 
            UI.log("Fetching 'Followers'...");
            const followersDetailedRaw = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers"); 

            
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
            
            const mapToDetailed = (arr) => arr.map((u) => ({ username: u, url: "https://www.instagram.com/" + u + "/" }));
            
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
                const accountsToVerify = Utils.unique([...filteredLostFollowers, ...filteredMissingUsers]); 

                if (accountsToVerify.length > 0) {
                    UI.setStatus("Verifying lost accounts...");
                    for (const username of accountsToVerify) {
                        const status = await API.checkAccountStatus(username);

                        if (status === 'Deactivated') {
                            newDeactivated.push(username);
                        } else if (status === 'Blocked') {
                            newBlocked.push(username);
                        } else if (status === 'Active') {
                            if (filteredLostFollowers.includes(username)) { // Change
                                newUnfollowers.push(username);
                            }
                        } else {
                            
                            Utils.logError(
                                `Unexpected status "${status}" from checkAccountStatus for user "${username}"`,
                                null
                            );
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
            } else {
                UI.log("First run: Initial state established.");
            }
            
            Storage.save({
                version: 4, 
                lastRun: Utils.now(),
                followers, 
                following, 
                followersDetailed, 
                followingDetailed 
            });
            
            UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
            UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
            UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
            UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
            UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY), "ig-view-blocked", "Blocked Accounts");
            UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY), "ig-view-renamed", "Username Changes"); 
            
            window.__igLastResults = notFollowingBackDetailed;
            UI.setStatus("Completed");
            UI.log("[OK] Analysis completed successfully.");
            
        } catch (e) {
            UI.setStatus("Error");
            UI.hideProgress();
            Utils.logError("Failed analysis", e);
        } finally {
            if (btnRun) btnRun.disabled = false;
        }
    },
    
    bindEvents: () => {
        const btnRun = document.getElementById("ig-run");
        if (btnRun) btnRun.onclick = App.run;
        
        const btnExport = document.getElementById("ig-export-csv");
        if (btnExport) btnExport.onclick = () => {
            if (window.__igLastResults) {
                const dateStr = Utils.now().split("T")[0];
                Utils.exportCSV(window.__igLastResults, "ig_no_follow_back_" + dateStr + ".csv");
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
        
        document.addEventListener("keydown", (e) => {
            const tag = document.activeElement.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement.isContentEditable) return;
            if (e.key === "F9") UI.togglePanel();
            if (e.key === "F8") UI.resetPosition();
        });
    }
};