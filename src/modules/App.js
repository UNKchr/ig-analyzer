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
            const following = await API.getAllUsers(userId, CONFIG.FOLLOWING_HASH, "following");
            
            UI.log("Fetching 'Followers'...");
            const followers = await API.getAllUsers(userId, CONFIG.FOLLOWERS_HASH, "followers");
            
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
                const newFollowers = Utils.diff(followers, prev.followers);
                UI.log("New followers since last run: " + newFollowers.length);
                
                const lostFollowers = Utils.diff(prev.followers, followers);
                const lostFollowing = Utils.diff(prev.following, following);
                const newDeactivated = Utils.intersection(lostFollowers, lostFollowing);
                const newUnfollowers = Utils.diff(lostFollowers, newDeactivated);
                
                if (newUnfollowers.length > 0) {
                    UI.log("Identified " + newUnfollowers.length + " new unfollower(s)!");
                    Storage.addNominalEntries(CONFIG.CHURN_KEY, newUnfollowers);
                }
                
                if (newDeactivated.length > 0) {
                    UI.log("Identified " + newDeactivated.length + " deactivated account(s).");
                    Storage.addNominalEntries(CONFIG.DEACTIVATED_KEY, newDeactivated);
                }
            } else {
                UI.log("First run: Initial state established.");
            }
            
            Storage.save({ version: 3, lastRun: Utils.now(), followers, following });
            
            UI.renderResults(notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults(fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
            UI.renderResults(mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
            UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY), "ig-view-unfollowers", "Recent Unfollowers");
            UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY), "ig-view-deactivated", "Deactivated Accounts");
            
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
            // Hacemos la función async para poder usar await
            btnReset.onclick = async () => {
                // --- LLAMADA AL MODAL: Reset Data ---
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
        });
    }
};