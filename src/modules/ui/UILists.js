import { UI } from './UIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { API } from '../API.js';
import { createBackupUI } from '../Backup.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(UI, {
    renderResultsPage: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const { rawUsers, users, title, isExportable, pageSize, searchQuery, filterType } = state;
        const safeTitle = Utils.escapeHtml(title);
        const totalRaw = (rawUsers || []).length;
        const totalFiltered = (users || []).length;

        // If rawUsers has nothing at all, show initial empty state
        if (totalRaw === 0) {
            container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No data available yet.</div>';
            if (isExportable) {
                const exportBtn = document.getElementById("ig-export-csv");
                if (exportBtn) exportBtn.disabled = true;
            }
            return;
        }

        const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        state.page = Math.max(1, Math.min(state.page, totalPages));
        const page = state.page;
        const startIndex = (page - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        let headerEl = container.querySelector('.ig-view-header');
        let toolbarEl = container.querySelector('.ig-filter-toolbar');
        let listEl = container.querySelector('.ig-view-list');
        let paginationEl = container.querySelector('.ig-view-pagination');

        const badgeCountText = totalFiltered !== totalRaw ? `${totalFiltered} / ${totalRaw}` : `${totalRaw}`;

        if (!toolbarEl) {
            // First time render: Build complete skeleton
            const counts = UI.getFilterCounts(rawUsers, searchQuery);
            let chipsHtml = '';
            UI.CHIPS_DEF.forEach((chip) => {
                const isActive = (filterType || 'all') === chip.id;
                const iconHtml = chip.icon ? `<span class="ig-chip-icon">${chip.icon}</span>` : '';
                chipsHtml += `<button type="button" class="ig-filter-chip${isActive ? ' is-active' : ''}" data-filter="${chip.id}">` +
                    iconHtml +
                    `<span class="ig-chip-label">${chip.label}</span>` +
                    `<span class="ig-chip-count">${counts[chip.id] || 0}</span>` +
                    `</button>`;
            });

            const clearStyle = searchQuery ? 'display: inline-flex;' : 'display: none;';
            const skeletonHtml = [
                '<div class="ig-view-header">',
                '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>',
                '</div>',
                '<div class="ig-filter-toolbar">',
                '  <div class="ig-search-box">',
                '    <span class="ig-search-icon">' + Icons.search + '</span>',
                '    <input type="text" class="ig-search-input" placeholder="Search by @username or full name..." value="' + Utils.escapeHtml(searchQuery || '') + '" autocomplete="off" spellcheck="false" />',
                '    <button type="button" class="ig-search-clear" title="Clear search" style="' + clearStyle + '">' + Icons.clear + '</button>',
                '  </div>',
                '  <div class="ig-filter-chips">' + chipsHtml + '</div>',
                '</div>',
                '<div class="ig-view-list"></div>',
                '<div class="ig-view-pagination"></div>'
            ].join('\n');

            container.innerHTML = skeletonHtml;

            headerEl = container.querySelector('.ig-view-header');
            toolbarEl = container.querySelector('.ig-filter-toolbar');
            listEl = container.querySelector('.ig-view-list');
            paginationEl = container.querySelector('.ig-view-pagination');

            // Bind search input events
            const searchInput = toolbarEl.querySelector('.ig-search-input');
            const clearBtn = toolbarEl.querySelector('.ig-search-clear');
            let searchTimeout = null;

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const val = e.target.value;
                    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        state.searchQuery = val;
                        UI.applyFilters(containerId);
                    }, 120);
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                        searchInput.value = '';
                        if (clearBtn) clearBtn.style.display = 'none';
                        state.searchQuery = '';
                        UI.applyFilters(containerId);
                    }
                });
            }

            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    state.searchQuery = '';
                    searchInput.focus();
                    UI.applyFilters(containerId);
                });
            }

            // Bind filter chips
            const chipsBar = toolbarEl.querySelector('.ig-filter-chips');
            if (chipsBar) {
                chipsBar.addEventListener('click', (e) => {
                    const chipBtn = e.target.closest('.ig-filter-chip');
                    if (!chipBtn) return;
                    e.preventDefault();
                    const targetFilter = chipBtn.getAttribute('data-filter');
                    if (!targetFilter) return;

                    if (state.filterType === targetFilter && targetFilter !== 'all') {
                        state.filterType = 'all';
                    } else {
                        state.filterType = targetFilter;
                    }
                    UI.applyFilters(containerId);
                });
            }
        } else {
            // Already mounted: update header badge and chips without touching input focus
            if (headerEl) {
                headerEl.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>';
            }
            UI.updateFilterChips(containerId);
            const clearBtn = toolbarEl.querySelector('.ig-search-clear');
            if (clearBtn) {
                clearBtn.style.display = state.searchQuery ? 'inline-flex' : 'none';
            }
            const searchInput = toolbarEl.querySelector('.ig-search-input');
            if (searchInput && document.activeElement !== searchInput && searchInput.value !== (state.searchQuery || '')) {
                searchInput.value = state.searchQuery || '';
            }
        }

        // Render rows in listEl
        let rowsHtml = '';
        if (totalFiltered === 0) {
            rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No users match your search or filter criteria.</div>';
        } else {
            pageUsers.forEach((u, index) => {
                const globalIndex = startIndex + index;
                const uniqueId = containerId + "-row-" + globalIndex;
                const safeUsername = Utils.escapeHtml(u.username || '');
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';
                const safeUrl = Utils.sanitizeUrl(u.username, u.url);
                const safeFullName = u.fullName ? Utils.escapeHtml(u.fullName) : '';
                const isVerified = Boolean(u.isVerified);
                const hasStory = Boolean(u.latestReelMedia && u.latestReelMedia > 0);
                const isBestieStory = hasStory && Boolean(u.isBestie);
                const safeAvatarUrl = Utils.sanitizeImageUrl(u.profilePicUrl);

                let avatarStyle = '';
                if (isBestieStory) {
                    avatarStyle += ' outline: 2px solid #22c55e; outline-offset: 1px;';
                } else if (hasStory) {
                    avatarStyle += ' outline: 2px solid #e1306c; outline-offset: 1px;';
                }

                const avatarClass = 'ig-user-avatar ig-avatar-monogram' + (isBestieStory ? ' has-bestie-ring' : '');
                const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || '') + '" data-username="' + safeUsername + '" style="' + avatarStyle + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${Utils.escapeHtml(u.id || '')}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                const badgesHtml = UI.renderUserBadgesHtml(u);

                rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '">';
                rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
                rowsHtml += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                rowsHtml += '<div style="display:flex; align-items:center; min-width:0; flex-wrap:wrap;">';
                rowsHtml += '<span class="ig-username">' + safeUsername + '</span>';
                if (isVerified) {
                    rowsHtml += '<span title="Verified" style="display:inline-flex; align-items:center;">' + Icons.verified + '</span>';
                }
                rowsHtml += '<span class="ig-user-badges" id="' + uniqueId + '-badges">' + badgesHtml + '</span>';
                rowsHtml += '</div>';
                if (safeFullName) {
                    rowsHtml += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                }
                rowsHtml += '</div></div>';
                rowsHtml += '<div class="ig-user-actions">';
                if (containerId === "ig-view-notfollowing") {
                    rowsHtml += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
                }
                rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || '') + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers") {
                    rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                    rowsHtml += '<button class="ig-btn-spy-story btn-spy-story" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '">' + Icons.spy + ' Check Story</button>';
                }
                rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                rowsHtml += '</div></div>';
            });
        }
        if (listEl) {
            listEl.innerHTML = rowsHtml;
            UI.loadAvatarsProgressively(listEl);
        }

        // Render pagination in paginationEl
        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml += '<div class="ig-pagination">';
            paginationHtml += '<button class="ig-page-btn ig-page-prev" data-container="' + containerId + '"' + (page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>';
            paginationHtml += '<span class="ig-page-info">Page ' + page + ' of ' + totalPages + ' (' + totalFiltered + ' users)</span>';
            paginationHtml += '<button class="ig-page-btn ig-page-next" data-container="' + containerId + '"' + (page >= totalPages ? ' disabled' : '') + '>Next &rarr;</button>';
            paginationHtml += '</div>';
        }
        if (paginationEl) paginationEl.innerHTML = paginationHtml;

        if (isExportable) {
            const exportBtn = document.getElementById("ig-export-csv");
            if (exportBtn) exportBtn.disabled = totalFiltered === 0 && totalRaw === 0;
        }

        // Enrich visible page with batch friendship statuses (show_many)
        const userIdsToFetch = pageUsers
            .map((u) => u.id)
            .filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");

        if (userIdsToFetch.length > 0 && typeof API.fetchFriendshipStatusesMany === 'function') {
            API.fetchFriendshipStatusesMany(userIdsToFetch)
                .then((statusMap) => {
                    const currentState = UI.paginationState[containerId];
                    if (!currentState || currentState.page !== page) return;

                    pageUsers.forEach((u, index) => {
                        if (!u.id) return;
                        const status = statusMap[u.id];
                        if (!status) return;

                        let stateChanged = false;
                        if (u.isPrivate !== status.isPrivate) {
                            u.isPrivate = status.isPrivate;
                            stateChanged = true;
                        }
                        if (u.isBestie !== status.isBestie) {
                            u.isBestie = status.isBestie;
                            stateChanged = true;
                        }
                        if (u.outgoingRequest !== status.outgoingRequest) {
                            u.outgoingRequest = status.outgoingRequest;
                            stateChanged = true;
                        }

                        if (stateChanged) {
                            const rowId = containerId + "-row-" + (startIndex + index);
                            const badgeContainer = document.getElementById(rowId + "-badges");
                            if (badgeContainer) {
                                badgeContainer.innerHTML = UI.renderUserBadgesHtml(u);
                            }
                            if (status.isBestie && u.latestReelMedia > 0) {
                                const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
                                if (avatarEl) {
                                    avatarEl.classList.add("has-bestie-ring");
                                    avatarEl.style.outlineColor = "#22c55e";
                                }
                            }
                        }
                    });

                    UI.updateFilterChips(containerId);
                })
                .catch((err) => {
                    console.warn("[IG Analyzer] Error updating friendship statuses batch:", err);
                });
        }
    },

    renderUserBadgesHtml: (u) => {
        let badges = '';
        if (u?.isPrivate) {
            badges += '<span class="ig-badge-pill ig-badge-private" title="Private Account">' + Icons.lock + '</span>';
        }
        if (u?.isBestie) {
            badges += '<span class="ig-badge-pill ig-badge-bestie" title="Close Friends">' + Icons.star + ' Bestie</span>';
        }
        if (u?.outgoingRequest) {
            badges += '<span class="ig-badge-pill ig-badge-pending" title="Follow Request Pending">' + Icons.clock + ' Pending</span>';
        }
        if (u?.isBusiness) {
            badges += '<span class="ig-badge-pill ig-badge-business" title="' + (u.category ? Utils.escapeHtml(u.category) : 'Business Account') + '">' + Icons.briefcase + ' Business</span>';
        } else if (u?.isCreator) {
            badges += '<span class="ig-badge-pill ig-badge-creator" title="' + (u.category ? Utils.escapeHtml(u.category) : 'Content Creator') + '">' + Icons.creator + ' Creator</span>';
        }
        if (u?.followsBack === true) {
            badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + ' Mutual</span>';
        } else if (u?.followsBack === false) {
            badges += '<span class="ig-badge-pill ig-badge-fan" title="You do not follow them back">' + Icons.fans + ' Fan</span>';
        }
        if (u?.date) {
            badges += '<span class="ig-badge-pill ig-badge-date" title="First detected on ' + Utils.escapeHtml(u.date) + '">' + Icons.clock + ' ' + Utils.escapeHtml(u.date) + '</span>';
        }
        return badges;
    },

    renderResults: (users, title, containerId, isExportable = false) => {
        const safeUsers = Utils.toDetailedUserArray(users);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = "";
        }
        UI.paginationState[containerId] = {
            rawUsers: safeUsers,
            users: safeUsers,
            title,
            containerId,
            isExportable,
            page: 1,
            pageSize: 50,
            searchQuery: '',
            filterType: 'all'
        };
        UI.renderResultsPage(containerId);
    },

    renderNewFollowers: (users, containerId = "ig-view-newfollowers") => {
        const safeUsers = Array.isArray(users) ? users : [];
        UI.renderResults(safeUsers, "New Followers", containerId, true);
    },

    renderWhitelist: (whitelistUsers, containerId = "ig-view-whitelist") => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rawList = Array.isArray(whitelistUsers) ? whitelistUsers : [];
        const safeTitle = "Ignored Accounts (Whitelist)";
        const total = rawList.length;

        if (total === 0) {
            container.innerHTML = '<div class="ig-view-header">' +
                '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '</div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.shieldCheck + '</span>No ignored accounts in whitelist.</div>';
            return;
        }

        const query = (UI.whitelistSearchQuery || '').trim().toLowerCase();
        const filteredList = query 
            ? rawList.filter((u) => String(u || '').toLowerCase().includes(query))
            : rawList;

        const badgeText = filteredList.length !== total ? `${filteredList.length} / ${total}` : `${total}`;

        let html = [
            '<div class="ig-view-header" style="display:flex; justify-content:space-between; align-items:center;">',
            '  <div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + badgeText + '</span></div>',
            '  <button type="button" class="ig-btn-clear-whitelist btn-clear-whitelist" title="Clear all ignored accounts">' + Icons.trash + ' Clear All</button>',
            '</div>',
            '<div class="ig-filter-toolbar">',
            '  <div class="ig-search-box">',
            '    <span class="ig-search-icon">' + Icons.search + '</span>',
            '    <input type="text" class="ig-search-input ig-whitelist-search-input" placeholder="Search ignored accounts..." value="' + Utils.escapeHtml(UI.whitelistSearchQuery || '') + '" autocomplete="off" spellcheck="false" />',
            '    <button type="button" class="ig-search-clear ig-whitelist-search-clear" title="Clear search" style="' + (UI.whitelistSearchQuery ? 'display:inline-flex;' : 'display:none;') + '">' + Icons.clear + '</button>',
            '  </div>',
            '</div>',
            '<div class="ig-view-list">'
        ].join('\n');

        if (filteredList.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No accounts match your search.</div>';
        } else {
            const snapshot = Storage.load();
            const knownUsersMap = new Map();
            if (snapshot) {
                const candidates = [
                    ...(snapshot.followingDetailed || []),
                    ...(snapshot.followersDetailed || []),
                    ...(snapshot.notFollowingBackDetailed || [])
                ];
                candidates.forEach((u) => {
                    if (u?.username && !knownUsersMap.has(u.username)) {
                        knownUsersMap.set(u.username, u);
                    }
                });
            }

            filteredList.slice().reverse().forEach((username, idx) => {
                const safeUsername = Utils.escapeHtml(username);
                const safeUrl = Utils.sanitizeUrl(username);
                const known = knownUsersMap.get(username);
                const safeFullName = known?.fullName ? Utils.escapeHtml(known.fullName) : '';
                const safeAvatarUrl = known?.profilePicUrl ? Utils.sanitizeImageUrl(known.profilePicUrl) : null;
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';

                const avatarClass = 'ig-user-avatar ig-avatar-monogram';
                const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || '') + '" data-username="' + safeUsername + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                html += '<div class="ig-user-row" id="wl-row-' + idx + '" data-user="' + safeUsername + '">';
                html += '<div class="ig-user-info">' + avatarTriggerHtml;
                html += '<div style="display:flex; flex-direction:column; margin-left:8px; line-height:1.2; min-width:0;">';
                html += '<span class="ig-username">' + safeUsername + '</span>';
                if (safeFullName) {
                    html += '<span style="font-size:11px; color:#8e8e8e; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">' + safeFullName + '</span>';
                }
                html += '</div></div>';
                html += '<div class="ig-user-actions">';
                html += '<button class="ig-btn-unwhitelist btn-unwhitelist" data-user="' + safeUsername + '" title="Restore to Not Following">' + Icons.restore + ' Restore</button>';
                html += '<button class="ig-btn-inspect-user btn-inspect-user" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                html += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                html += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                html += '</div></div>';
            });
        }

        html += '</div>';
        container.innerHTML = html;
        UI.loadAvatarsProgressively(container);

        // Bind search input events
        const searchInput = container.querySelector('.ig-whitelist-search-input');
        const clearBtn = container.querySelector('.ig-whitelist-search-clear');
        let searchTimeout = null;

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    UI.whitelistSearchQuery = val;
                    UI.renderWhitelist(whitelistUsers, containerId);
                }, 120);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && searchInput.value) {
                    e.preventDefault();
                    searchInput.value = '';
                    UI.whitelistSearchQuery = '';
                    UI.renderWhitelist(whitelistUsers, containerId);
                }
            });
        }

        if (clearBtn && searchInput) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchInput.value = '';
                UI.whitelistSearchQuery = '';
                UI.renderWhitelist(whitelistUsers, containerId);
            });
        }
    },
    
    renderNominalList: (list, containerId, title) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const safeTitle = Utils.escapeHtml(title);
        const safeList = Array.isArray(list) ? list : [];
        let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + safeList.length + "</span></div>";
        
        if (safeList.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No historical records yet.</div>';
        } else {
            html += '<table class="ig-table"><thead><tr><th>Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
            safeList.slice().reverse().forEach((item) => {
                const safeUsername = Utils.escapeHtml(item.username || '');
                const safeDate = Utils.escapeHtml(item.date || '');
                const profileUrl = Utils.sanitizeUrl(item.username);

                html += "<tr>";
                html += "<td><span class='ig-table-user'>" + safeUsername + "</span></td>";
                html += "<td><span class='ig-table-date'>" + safeDate + "</span></td>";
                html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + '</a></td>';
                html += "</tr>";
            });
            html += "</tbody></table>";
        }
        container.innerHTML = html;
    },

    renderRenamedList: (list, containerId, title) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const safeList = Array.isArray(list) ? list : [];
        const safeTitle = Utils.escapeHtml(title);
        let html = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">' + safeList.length + "</span></div>";

        if (safeList.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>No username changes detected yet.</div>';
        } else {
            html += '<table class="ig-table"><thead><tr><th>Previous Username</th><th>Current Username</th><th>Detected</th><th>Profile</th></tr></thead><tbody>';
            safeList.slice().reverse().forEach((item) => {
                const oldUsername = item.oldUsername || "-";
                const newUsername = item.newUsername || item.username || "-";

                const safeOldUser = Utils.escapeHtml(oldUsername);
                const safeNewUser = Utils.escapeHtml(newUsername);
                const safeDate = Utils.escapeHtml(item.date || "-");
                const profileUrl = newUsername !== "-" ? Utils.sanitizeUrl(newUsername) : "#";

                html += "<tr>";
                html += "<td><span class='ig-table-user'>" + safeOldUser + "</span></td>";
                html += "<td><span class='ig-table-user'>" + safeNewUser + "</span></td>";
                html += "<td><span class='ig-table-date'>" + safeDate + "</span></td>";
                html += '<td><a href="' + profileUrl + '" target="_blank" rel="noopener noreferrer" class="ig-table-link">View ' + Icons.link + '</a></td>';
                html += "</tr>";
            });
            html += "</tbody></table>";
        }

        container.innerHTML = html;
    },
    
    renderHistory: (historyData) => {
        const container = document.getElementById("ig-view-history");
        if (!container) return;
        let html = '<div class="ig-section-title">Metrics History</div>';
        if (!historyData || historyData.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + '</span>No historical data available.</div>';
            container.innerHTML = html;
            return;
        }

        const reversedHistory = historyData.slice().reverse();
        const latest = reversedHistory[0];
        const prev = reversedHistory.length > 1 ? reversedHistory[1] : null;

        const currentFollowers = latest ? Utils.formatNumber(latest.followers) : '-';
        const currentFollowing = latest ? Utils.formatNumber(latest.following) : '-';

        let followerDiffText = 'First record';
        let followerDiffClass = 'is-neutral';
        let followerDiffIcon = Icons.neutral;

        let followingDiffText = 'First record';
        let followingDiffClass = 'is-neutral';
        let followingDiffIcon = Icons.neutral;

        if (prev) {
            const fDiff = latest.followers - prev.followers;
            if (fDiff > 0) {
                followerDiffText = '+' + fDiff + ' vs previous';
                followerDiffClass = 'is-positive';
                followerDiffIcon = Icons.trendingUp;
            } else if (fDiff < 0) {
                followerDiffText = fDiff + ' vs previous';
                followerDiffClass = 'is-negative';
                followerDiffIcon = Icons.trendingDown;
            } else {
                followerDiffText = 'No change vs previous';
            }

            const ingDiff = latest.following - prev.following;
            if (ingDiff > 0) {
                followingDiffText = '+' + ingDiff + ' vs previous';
                followingDiffClass = 'is-positive';
                followingDiffIcon = Icons.trendingUp;
            } else if (ingDiff < 0) {
                followingDiffText = ingDiff + ' vs previous';
                followingDiffClass = 'is-negative';
                followingDiffIcon = Icons.trendingDown;
            } else {
                followingDiffText = 'No change vs previous';
            }
        }

        const churnCount = Storage.getNominalList(CONFIG.CHURN_KEY).length;
        const newCount = Storage.getNewFollowersList().length;
        const netFlow = newCount - churnCount;
        const netFlowSign = netFlow > 0 ? '+' : '';
        const netFlowClass = netFlow > 0 ? 'is-positive' : (netFlow < 0 ? 'is-negative' : 'is-neutral');

        html += [
            '<div class="ig-history-kpi-grid">',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Followers</div>',
            '    <div class="ig-kpi-value">' + currentFollowers + '</div>',
            '    <div class="ig-kpi-sub ' + followerDiffClass + '">' + followerDiffIcon + ' <span>' + followerDiffText + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Following</div>',
            '    <div class="ig-kpi-value">' + currentFollowing + '</div>',
            '    <div class="ig-kpi-sub ' + followingDiffClass + '">' + followingDiffIcon + ' <span>' + followingDiffText + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Audience Balance</div>',
            '    <div class="ig-kpi-value ' + netFlowClass + '">' + netFlowSign + netFlow + '</div>',
            '    <div class="ig-kpi-sub"><span style="color:#22c55e; font-weight:600;">+' + newCount + '</span> new / <span style="color:#ef4444; font-weight:600;">-' + churnCount + '</span> lost</div>',
            '  </div>',
            '</div>'
        ].join('\n');

        html += '<table class="ig-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th></tr></thead><tbody>';
        reversedHistory.forEach((h, index) => {
            let followerIcon = Icons.neutral;
            let followingIcon = Icons.neutral;
            if (index < reversedHistory.length - 1) {
                const prevDay = reversedHistory[index + 1];
                if (h.followers > prevDay.followers) followerIcon = Icons.up;
                else if (h.followers < prevDay.followers) followerIcon = Icons.down;
                if (h.following > prevDay.following) followingIcon = Icons.up;
                else if (h.following < prevDay.following) followingIcon = Icons.down;
            }
            const safeDate = Utils.escapeHtml(h.date || '');
            const safeFollowers = Utils.escapeHtml(String(h.followers ?? ''));
            const safeFollowing = Utils.escapeHtml(String(h.following ?? ''));

            html += "<tr><td><span class='ig-table-date'>" + safeDate + "</span></td><td><span class='ig-metric-value'>" + safeFollowers + " " + followerIcon + "</span></td><td><span class='ig-metric-value'>" + safeFollowing + " " + followingIcon + "</span></td></tr>";
        });
        html += "</tbody></table>";
        container.innerHTML = html;
    },
    
    getFilterCounts: (rawUsers, searchQuery = '') => {
        const query = (searchQuery || '').trim().toLowerCase().replace(/^@+/, '');
        const baseList = query
            ? (rawUsers || []).filter((u) => {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                return uName.includes(query) || fName.includes(query);
            })
            : (rawUsers || []);

        return {
            all: baseList.length,
            private: baseList.filter((u) => Boolean(u.isPrivate)).length,
            public: baseList.filter((u) => u.isPrivate === false).length,
            besties: baseList.filter((u) => Boolean(u.isBestie)).length,
            pending: baseList.filter((u) => Boolean(u.outgoingRequest)).length,
            story: baseList.filter((u) => Boolean(u.latestReelMedia && u.latestReelMedia > 0)).length,
            verified: baseList.filter((u) => Boolean(u.isVerified)).length
        };
    },

    applyFilters: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state) return;

        const query = (state.searchQuery || '').trim().toLowerCase().replace(/^@+/, '');
        const filter = state.filterType || 'all';

        state.users = (state.rawUsers || []).filter((u) => {
            if (query) {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                if (!uName.includes(query) && !fName.includes(query)) {
                    return false;
                }
            }

            if (filter === 'private') return Boolean(u.isPrivate);
            if (filter === 'public') return u.isPrivate === false;
            if (filter === 'besties') return Boolean(u.isBestie);
            if (filter === 'pending') return Boolean(u.outgoingRequest);
            if (filter === 'story') return Boolean(u.latestReelMedia && u.latestReelMedia > 0);
            if (filter === 'verified') return Boolean(u.isVerified);

            return true;
        });

        state.page = 1;
        UI.renderResultsPage(containerId);
    },

    updateFilterChips: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        const chipsBar = container.querySelector('.ig-filter-chips');
        if (!chipsBar) return;

        const counts = UI.getFilterCounts(state.rawUsers, state.searchQuery);
        const chips = chipsBar.querySelectorAll('.ig-filter-chip');
        chips.forEach((chip) => {
            const filterId = chip.getAttribute('data-filter');
            if (filterId && counts[filterId] !== undefined) {
                const countEl = chip.querySelector('.ig-chip-count');
                if (countEl) countEl.textContent = counts[filterId];
            }
            if (filterId === state.filterType) {
                chip.classList.add('is-active');
            } else {
                chip.classList.remove('is-active');
            }
        });

        const headerBadge = container.querySelector('.ig-section-title .ig-badge');
        if (headerBadge) {
            const total = (state.rawUsers || []).length;
            const filtered = (state.users || []).length;
            headerBadge.textContent = filtered !== total ? `${filtered} / ${total}` : `${total}`;
        }
    },

    removeUserFromResults: (containerId, targetUsername) => {
        const state = UI.paginationState[containerId];
        if (!state) return;
        if (Array.isArray(state.rawUsers)) {
            state.rawUsers = state.rawUsers.filter((u) => u.username !== targetUsername);
        }
        if (Array.isArray(state.users)) {
            state.users = state.users.filter((u) => u.username !== targetUsername);
        }
        UI.renderResultsPage(containerId);
    },

    getActiveViewUsers: () => {
        const activeTab = document.querySelector('#ig-tabs .ig-tab-btn.active');
        if (!activeTab) return null;
        const targetId = activeTab.getAttribute('data-target');
        if (!targetId || !UI.paginationState[targetId]) return null;
        return UI.paginationState[targetId].users || null;
    },

    changePage: (containerId, delta) => {
        const state = UI.paginationState[containerId];
        if (!state) return;
        const totalPages = Math.max(1, Math.ceil(state.users.length / state.pageSize));
        const newPage = state.page + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            state.page = newPage;
            UI.renderResultsPage(containerId);
        }
    },

    renderPersistedSnapshot: (snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return;

        if (Array.isArray(snapshot.notFollowingBackDetailed)) {
            UI.renderResults(snapshot.notFollowingBackDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            window.__igLastResults = snapshot.notFollowingBackDetailed;
        }

        if (Array.isArray(snapshot.fansDetailed)) {
            UI.renderResults(snapshot.fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", false);
        }

        if (Array.isArray(snapshot.mutualsDetailed)) {
            UI.renderResults(snapshot.mutualsDetailed, "Mutual Connections", "ig-view-mutuals", false);
        }

        if (Array.isArray(snapshot.newFollowersDetailed) && snapshot.newFollowersDetailed.length > 0) {
            UI.renderNewFollowers(snapshot.newFollowersDetailed);
        } else {
            UI.renderNewFollowers(Storage.getNewFollowersList());
        }

        UI.renderWhitelist(Array.isArray(snapshot.whitelist) ? snapshot.whitelist : Storage.getWhitelist());

        if (Array.isArray(snapshot.unfollowers)) {
            UI.renderNominalList(snapshot.unfollowers, "ig-view-unfollowers", "Recent Unfollowers");
        }

        if (Array.isArray(snapshot.deactivated)) {
            UI.renderNominalList(snapshot.deactivated, "ig-view-deactivated", "Deactivated Accounts");
        }

        if (Array.isArray(snapshot.blocked)) {
            UI.renderNominalList(snapshot.blocked, "ig-view-blocked", "Blocked Accounts");
        }

        if (Array.isArray(snapshot.renamed)) {
            UI.renderRenamedList(snapshot.renamed, "ig-view-renamed", "Username Changes");
        }

        if (Array.isArray(snapshot.history)) {
            UI.renderHistory(snapshot.history);
        }
    },

    loadAvatarsProgressively: (containerEl, delayMs = 35) => {
        if (!containerEl) return;

        // If inside a tab view that is currently hidden, defer loading until the tab becomes active
        const parentView = containerEl.closest('.ig-view');
        if (parentView && !parentView.classList.contains('active')) {
            return;
        }

        const scopeEl = containerEl.classList.contains('ig-view-list')
            ? containerEl
            : (containerEl.querySelector('.ig-view-list') || containerEl);

        scopeEl._avatarQueueToken = (scopeEl._avatarQueueToken || 0) + 1;
        const currentToken = scopeEl._avatarQueueToken;

        const monograms = scopeEl.querySelectorAll('.ig-avatar-monogram[data-avatar-url]');
        const items = Array.from(monograms).filter((el) => {
            const url = el.getAttribute('data-avatar-url');
            return url && !el.classList.contains('is-loaded') && !Utils.isCdnUrlExpired(url);
        });

        items.forEach((el, index) => {
            setTimeout(() => {
                if (scopeEl._avatarQueueToken !== currentToken || !el.isConnected || el.classList.contains('is-loaded')) return;
                const url = el.getAttribute('data-avatar-url');
                if (!url || Utils.isCdnUrlExpired(url)) return;

                const img = new Image();
                img.onload = () => {
                    if (!el.isConnected || el.classList.contains('is-loaded')) return;
                    el.classList.add('is-loaded');

                    const imgTag = document.createElement('img');
                    imgTag.className = 'ig-avatar-img-loaded';
                    imgTag.src = url;
                    imgTag.alt = '';
                    imgTag.loading = 'lazy';

                    el.innerHTML = '';
                    el.appendChild(imgTag);
                };
                img.onerror = () => {
                    // Safe fallback: leave monogram with initial intact. Never show broken icon.
                };
                img.src = url;
            }, index * delayMs);
        });
    },

    updateUserAvatarInDom: (username, newAvatarUrl) => {
        if (!username || !newAvatarUrl) return;
        const cleanUser = String(username).replace(/^@+/, '').toLowerCase().trim();
        const safeUrl = Utils.sanitizeImageUrl(newAvatarUrl);
        if (!safeUrl) return;

        const triggers = document.querySelectorAll('.ig-user-avatar-trigger, .ig-target-card-avatar, .ig-target-overview-avatar-wrap');
        triggers.forEach((trigger) => {
            const trigUser = (trigger.getAttribute('data-username') || '').toLowerCase();
            const parentRow = trigger.closest('.ig-user-row, .ig-target-card');
            const rowUser = (parentRow?.getAttribute('data-user') || parentRow?.getAttribute('data-username') || '').toLowerCase();

            if (trigUser === cleanUser || rowUser === cleanUser) {
                const monogram = trigger.classList.contains('ig-avatar-monogram')
                    ? trigger
                    : trigger.querySelector('.ig-avatar-monogram');
                if (!monogram) return;

                monogram.setAttribute('data-avatar-url', safeUrl);
                const img = new Image();
                img.onload = () => {
                    if (!monogram.isConnected) return;
                    monogram.classList.add('is-loaded');
                    const imgTag = document.createElement('img');
                    imgTag.className = 'ig-avatar-img-loaded';
                    imgTag.src = safeUrl;
                    imgTag.alt = '';
                    imgTag.loading = 'lazy';
                    monogram.innerHTML = '';
                    monogram.appendChild(imgTag);
                };
                img.src = safeUrl;
            }
        });
    }
});
