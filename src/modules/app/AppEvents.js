import { App } from './AppState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { UI } from '../UI.js';
import { API } from '../API.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(App, {
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

            subpanel.addEventListener("click", async (e) => {
                // 1. Delegated Avatar & Inspect Button Click (Quick-Card Modal)
                const inspectTrigger = e.target.closest(".ig-user-avatar-trigger, .btn-inspect-user, .ig-btn-inspect-user");
                if (inspectTrigger) {
                    e.preventDefault();
                    e.stopPropagation();
                    const userId = inspectTrigger.getAttribute("data-user-id");
                    const username = inspectTrigger.getAttribute("data-username");
                    const containerId = inspectTrigger.getAttribute("data-container");

                    let userObj = null;
                    if (containerId && UI.targetPaginationState[containerId]?.rawUsers) {
                        userObj = UI.targetPaginationState[containerId].rawUsers.find(
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

                // 2. Delegated Target Subpanel Pagination Controls
                const btnPrev = e.target.closest(".ig-target-page-prev");
                if (btnPrev && !btnPrev.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cId = btnPrev.getAttribute("data-container");
                    if (cId) UI.changeTargetPage(cId, -1);
                    return;
                }

                const btnNext = e.target.closest(".ig-target-page-next");
                if (btnNext && !btnNext.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    const cId = btnNext.getAttribute("data-container");
                    if (cId) UI.changeTargetPage(cId, 1);
                    return;
                }
            });
        }

        window.addEventListener("keydown", (e) => {
            if (e.key === "F9") {
                e.preventDefault();
                e.stopPropagation();
                UI.togglePanel();
                return;
            }
            if (e.key === "F8") {
                const tag = document.activeElement?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
                e.preventDefault();
                e.stopPropagation();
                UI.resetPosition();
                return;
            }
        }, true);
    }

});
