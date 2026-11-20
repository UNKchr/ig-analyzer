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

        const {
            rawUsers,
            users,
            title,
            isExportable,
            pageSize,
            searchQuery,
            filterType,
            listVariant = 'standard',
            clearNominalKey = null,
            emptyMessage = 'No data available yet.'
        } = state;
        const safeTitle = Utils.escapeHtml(title);
        const totalRaw = (rawUsers || []).length;
        const totalFiltered = (users || []).length;

        // If rawUsers has nothing at all, show initial empty state
        if (totalRaw === 0) {
            container.innerHTML = '<div class="ig-section-title">' + safeTitle + ' <span class="ig-badge">0</span></div>' +
                '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.mailbox + '</span>' + Utils.escapeHtml(emptyMessage) + '</div>';
            if (isExportable && typeof UI.syncMainExportButton === 'function') {
                UI.syncMainExportButton();
            } else if (isExportable) {
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
        const clearNominalBtnHtml = clearNominalKey
            ? `<button type="button" class="ig-btn-clear-nominal" data-clear-key="${Utils.escapeHtml(clearNominalKey)}" data-container="${Utils.escapeHtml(containerId)}" data-title="${safeTitle}" title="Clear ${safeTitle}">${Icons.trash} Clear</button>`
            : '';
        const headerInnerHtml = '<div class="ig-section-title" style="margin-bottom:0;">' + safeTitle + ' <span class="ig-badge">' + badgeCountText + '</span></div>' + clearNominalBtnHtml;

        const chipsDef = listVariant === 'nominal'
            ? (UI.NOMINAL_CHIPS_DEF || UI.CHIPS_DEF)
            : (listVariant === 'renamed' ? (UI.RENAMED_CHIPS_DEF || UI.CHIPS_DEF) : UI.CHIPS_DEF);

        const searchPlaceholder = listVariant === 'renamed'
            ? 'Search by @old, @current or full name...'
            : (listVariant === 'nominal' ? 'Search by @username, previous @handle or name...' : 'Search by @username or full name...');

        if (!toolbarEl) {
            // First time render: Build complete skeleton
            const counts = UI.getFilterCounts(rawUsers, searchQuery, listVariant);
            let chipsHtml = '';
            chipsDef.forEach((chip) => {
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
                '<div class="ig-view-header ig-view-header-row">' + headerInnerHtml + '</div>',
                '<div class="ig-filter-toolbar">',
                '  <div class="ig-search-box">',
                '    <span class="ig-search-icon">' + Icons.search + '</span>',
                '    <input type="text" class="ig-search-input" placeholder="' + searchPlaceholder + '" value="' + Utils.escapeHtml(searchQuery || '') + '" autocomplete="off" spellcheck="false" />',
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
                        const currentState = UI.paginationState[containerId];
                        if (!currentState) return;
                        currentState.searchQuery = val;
                        UI.applyFilters(containerId);
                    }, 120);
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                        const currentState = UI.paginationState[containerId];
                        if (!currentState) return;
                        searchInput.value = '';
                        if (clearBtn) clearBtn.style.display = 'none';
                        currentState.searchQuery = '';
                        UI.applyFilters(containerId);
                    }
                });
            }

            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    const currentState = UI.paginationState[containerId];
                    if (!currentState) return;
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    currentState.searchQuery = '';
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

                    const currentState = UI.paginationState[containerId];
                    if (!currentState) return;
                    if (currentState.filterType === targetFilter && targetFilter !== 'all') {
                        currentState.filterType = 'all';
                    } else {
                        currentState.filterType = targetFilter;
                    }
                    UI.applyFilters(containerId);
                });
            }
        } else {
            // Already mounted: update header badge and chips without touching input focus
            if (headerEl) {
                headerEl.className = 'ig-view-header ig-view-header-row';
                headerEl.innerHTML = headerInnerHtml;
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

                const badgesHtml = UI.renderUserBadgesHtml(u, { variant: listVariant });

                let identityHtml = '<span class="ig-username">' + safeUsername + '</span>';
                if (listVariant === 'renamed') {
                    const safeOld = Utils.escapeHtml(u.oldUsername || '-');
                    const safeNew = Utils.escapeHtml(u.newUsername || u.username || '-');
                    identityHtml = `<span class="ig-rename-flow"><span class="ig-rename-old" title="Previous handle: @${safeOld}">@${safeOld}</span><span class="ig-rename-arrow">${Icons.arrowRight}</span><span class="ig-rename-new" title="Current handle: @${safeNew}">@${safeNew}</span></span>`;
                }

                rowsHtml += '<div class="ig-user-row" id="' + uniqueId + '" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '">';
                rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
                rowsHtml += '<div class="ig-user-text-col">';
                rowsHtml += '<div class="ig-user-title-line">';
                rowsHtml += identityHtml;
                if (isVerified) {
                    rowsHtml += '<span title="Verified" style="display:inline-flex; align-items:center;">' + Icons.verified + '</span>';
                }
                rowsHtml += '<span class="ig-user-badges" id="' + uniqueId + '-badges">' + badgesHtml + '</span>';
                rowsHtml += '</div>';
                if (safeFullName) {
                    rowsHtml += '<span class="ig-user-fullname">' + safeFullName + '</span>';
                }
                rowsHtml += '</div></div>';
                rowsHtml += '<div class="ig-user-actions">';
                if (containerId === "ig-view-notfollowing") {
                    rowsHtml += '<button class="ig-btn-whitelist btn-whitelist" data-user="' + safeUsername + '" data-container="' + containerId + '">Ignore</button>';
                }
                rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + Utils.escapeHtml(u.id || '') + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                if (
                    containerId === "ig-view-mutuals" ||
                    containerId === "ig-view-fans" ||
                    containerId === "ig-view-notfollowing" ||
                    containerId === "ig-view-newfollowers" ||
                    containerId === "ig-view-unfollowers" ||
                    containerId === "ig-view-renamed"
                ) {
                    rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + Utils.escapeHtml(u.id || '') + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                }
                if (containerId === "ig-view-mutuals" || containerId === "ig-view-fans" || containerId === "ig-view-notfollowing" || containerId === "ig-view-newfollowers") {
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

        if (isExportable && typeof UI.syncMainExportButton === 'function') {
            UI.syncMainExportButton();
        } else if (isExportable) {
            const exportBtn = document.getElementById("ig-export-csv");
            if (exportBtn) exportBtn.disabled = totalFiltered === 0 && totalRaw === 0;
        }

        if (typeof UI.hydrateVisibleMainPageFriendships === 'function') {
            UI.hydrateVisibleMainPageFriendships(containerId);
        }

        if (typeof UI.syncMainExportButton === 'function') {
            UI.syncMainExportButton();
        }
    },

    hydrateVisibleMainPageFriendships: (containerId) => {
        const state = UI.paginationState[containerId];
        if (!state || (state.listVariant || 'standard') !== 'standard') return;
        const container = document.getElementById(containerId);
        if (!container || !container.classList.contains('active')) return;

        const pageSize = state.pageSize || 50;
        const page = state.page || 1;
        const startIndex = (page - 1) * pageSize;
        const pageUsers = (state.users || []).slice(startIndex, startIndex + pageSize);

        const userIdsToFetch = pageUsers
            .map((u) => u.id)
            .filter((id) => id && id !== "0" && id !== "null" && id !== "undefined");

        if (userIdsToFetch.length === 0 || typeof API.fetchFriendshipStatusesMany !== 'function') return;

        API.fetchFriendshipStatusesMany(userIdsToFetch)
            .then((statusMap) => {
                const currentState = UI.paginationState[containerId];
                if (!currentState || currentState.page !== page) return;

                const updatedUsers = [];
                const updatedById = new Map();

                pageUsers.forEach((u, index) => {
                    if (!u.id) return;
                    const status = statusMap[u.id];
                    if (!status) return;

                    let rowDomChanged = false;
                    let metaChanged = false;

                    if (!u.isPrivateKnown) {
                        u.isPrivateKnown = true;
                        metaChanged = true;
                    }
                    if (u.isPrivate !== status.isPrivate) {
                        u.isPrivate = status.isPrivate;
                        rowDomChanged = true;
                        metaChanged = true;
                    }
                    if (u.isBestie !== status.isBestie) {
                        u.isBestie = status.isBestie;
                        rowDomChanged = true;
                        metaChanged = true;
                    }
                    if (u.outgoingRequest !== status.outgoingRequest) {
                        u.outgoingRequest = status.outgoingRequest;
                        rowDomChanged = true;
                        metaChanged = true;
                    }

                    if (rowDomChanged) {
                        const rowId = containerId + "-row-" + (startIndex + index);
                        const badgeContainer = document.getElementById(rowId + "-badges");
                        if (badgeContainer) {
                            badgeContainer.innerHTML = UI.renderUserBadgesHtml(u, { variant: currentState.listVariant || 'standard' });
                        }
                        if (status.isBestie && u.latestReelMedia > 0) {
                            const avatarEl = document.querySelector("#" + rowId + " .ig-user-avatar");
                            if (avatarEl) {
                                avatarEl.classList.add("has-bestie-ring");
                                avatarEl.style.outlineColor = "#22c55e";
                            }
                        }
                    }

                    if (metaChanged) {
                        updatedUsers.push(u);
                        updatedById.set(String(u.id), status);
                    }
                });

                if (updatedById.size > 0) {
                    Object.entries(UI.paginationState).forEach(([tabContainerId, tabState]) => {
                        if (!tabState || !Array.isArray(tabState.rawUsers)) return;
                        let tabChanged = false;
                        tabState.rawUsers.forEach((item) => {
                            if (!item?.id || !updatedById.has(String(item.id))) return;
                            const st = updatedById.get(String(item.id));
                            if (item.isPrivate !== st.isPrivate || !item.isPrivateKnown || item.isBestie !== st.isBestie || item.outgoingRequest !== st.outgoingRequest) {
                                item.isPrivate = st.isPrivate;
                                item.isPrivateKnown = true;
                                item.isBestie = st.isBestie;
                                item.outgoingRequest = st.outgoingRequest;
                                tabChanged = true;
                            }
                        });
                        if (tabChanged) {
                            UI.updateFilterChips(tabContainerId);
                        }
                    });

                    UI.updateFilterChips(containerId);

                    if (typeof Storage.syncFreshUserData === 'function') {
                        Storage.syncFreshUserData(updatedUsers);
                    }
                }
            })
            .catch((err) => {
                console.warn("[IG Analyzer] Error updating friendship statuses batch:", err);
            });
    },

    renderUserBadgesHtml: (u, options = {}) => {
        const variant = options.variant || 'standard';
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

        if (variant === 'renamed') {
            if (u?.relationship === 'mutual') {
                badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + ' Mutual</span>';
            } else if (u?.relationship === 'fan') {
                badges += '<span class="ig-badge-pill ig-badge-fan" title="Follower (Fan)">' + Icons.fans + ' Fan</span>';
            } else if (u?.relationship === 'following') {
                badges += '<span class="ig-badge-pill ig-badge-following" title="Account you follow">' + Icons.user + ' Following</span>';
            }
        } else {
            if (u?.followsBack === true) {
                badges += '<span class="ig-badge-pill ig-badge-mutual" title="Mutual Follower">' + Icons.mutuals + ' Mutual</span>';
            } else if (u?.followsBack === false) {
                badges += '<span class="ig-badge-pill ig-badge-fan" title="You do not follow them back">' + Icons.fans + ' Fan</span>';
            }
            if (Number(u?.occurrences) > 1) {
                badges += '<span class="ig-badge-pill ig-badge-repeat" title="Detected ' + Number(u.occurrences) + ' times">' + Icons.repeat + ' ' + Number(u.occurrences) + 'x</span>';
            }
            if (u?.previousUsername) {
                const safePrev = Utils.escapeHtml(u.previousUsername);
                badges += '<span class="ig-badge-pill ig-badge-prev-user" title="Previously @' + safePrev + '">' + Icons.renamed + ' was @' + safePrev + '</span>';
            }
        }

        if (u?.date) {
            badges += '<span class="ig-badge-pill ig-badge-date" title="Detected on ' + Utils.escapeHtml(u.date) + '">' + Icons.clock + ' ' + Utils.escapeHtml(u.date) + '</span>';
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
            listVariant: 'standard',
            clearNominalKey: null,
            emptyMessage: 'No data available yet.',
            page: 1,
            pageSize: 50,
            searchQuery: '',
            filterType: 'all'
        };
        UI.renderResultsPage(containerId);
        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts();
        }
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
            if (typeof UI.updateMainTabCounts === 'function') {
                UI.updateMainTabCounts();
            }
            if (typeof UI.syncMainExportButton === 'function') {
                UI.syncMainExportButton();
            }
            return;
        }

        const query = (UI.whitelistSearchQuery || '').trim().toLowerCase();
        const filteredList = query
            ? rawList.filter((u) => String(u || '').toLowerCase().includes(query))
            : rawList;

        const badgeText = filteredList.length !== total ? `${filteredList.length} / ${total}` : `${total}`;

        let rowsHtml = '';
        if (filteredList.length === 0) {
            rowsHtml = '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.search + '</span>No accounts match your search.</div>';
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
                    if (u?.username && !knownUsersMap.has(u.username.toLowerCase())) {
                        knownUsersMap.set(u.username.toLowerCase(), u);
                    }
                });
            }

            filteredList.slice().reverse().forEach((username, idx) => {
                const safeUsername = Utils.escapeHtml(username);
                const safeUrl = Utils.sanitizeUrl(username);
                const lower = String(username || '').toLowerCase();
                const known = knownUsersMap.get(lower) || (typeof Storage.findKnownUserByUsername === 'function' ? Storage.findKnownUserByUsername(username) : null);
                const safeUserId = Utils.escapeHtml(known?.id || '');
                const safeFullName = known?.fullName ? Utils.escapeHtml(known.fullName) : '';
                const safeAvatarUrl = known?.profilePicUrl ? Utils.sanitizeImageUrl(known.profilePicUrl) : null;
                const safeInitial = safeUsername ? safeUsername.charAt(0).toUpperCase() : '?';

                const hasStory = Boolean(known?.latestReelMedia && known.latestReelMedia > 0);
                const avatarClass = 'ig-user-avatar ig-avatar-monogram' + (hasStory ? (known?.isBestie ? ' has-bestie-ring' : ' has-story-ring') : '');
                const avatarHtml = '<div class="' + avatarClass + '" data-avatar-url="' + (safeAvatarUrl || '') + '" data-username="' + safeUsername + '"><span class="ig-monogram-letter">' + safeInitial + '</span></div>';

                const avatarTriggerHtml = `<span class="ig-user-avatar-trigger" data-user-id="${safeUserId}" data-username="${safeUsername}" data-container="${containerId}" title="Click to view HD Photo (1080p)">${avatarHtml}</span>`;

                rowsHtml += '<div class="ig-user-row" id="wl-row-' + idx + '" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '">';
                rowsHtml += '<div class="ig-user-info">' + avatarTriggerHtml;
                rowsHtml += '<div class="ig-user-text-col">';
                rowsHtml += '<span class="ig-username">' + safeUsername + '</span>';
                if (safeFullName) {
                    rowsHtml += '<span class="ig-user-fullname">' + safeFullName + '</span>';
                }
                rowsHtml += '</div></div>';
                rowsHtml += '<div class="ig-user-actions">';
                rowsHtml += '<button class="ig-btn-unwhitelist btn-unwhitelist" data-user="' + safeUsername + '" title="Restore to Not Following">' + Icons.restore + ' Restore</button>';
                rowsHtml += '<button class="ig-btn-inspect-user btn-inspect-user" data-user-id="' + safeUserId + '" data-username="' + safeUsername + '" data-container="' + containerId + '" title="Inspect Profile & HD Photo">' + Icons.inspect + ' Inspect</button>';
                rowsHtml += '<button class="ig-btn-target-audit btn-target-audit" data-user="' + safeUsername + '" data-user-id="' + safeUserId + '" title="Audit Account Network in Subpanel">' + Icons.target + ' Audit</button>';
                rowsHtml += '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="ig-view-link">View ' + Icons.link + '</a>';
                rowsHtml += '</div></div>';
            });
        }

        const existingSearchInput = container.querySelector('.ig-whitelist-search-input');
        const existingListEl = container.querySelector('.ig-view-list');

        if (existingSearchInput && existingListEl) {
            const badgeEl = container.querySelector('.ig-section-title .ig-badge');
            if (badgeEl) badgeEl.textContent = badgeText;
            const clearBtn = container.querySelector('.ig-whitelist-search-clear');
            if (clearBtn) clearBtn.style.display = UI.whitelistSearchQuery ? 'inline-flex' : 'none';
            if (document.activeElement !== existingSearchInput && existingSearchInput.value !== (UI.whitelistSearchQuery || '')) {
                existingSearchInput.value = UI.whitelistSearchQuery || '';
            }
            existingListEl.innerHTML = rowsHtml;
            UI.loadAvatarsProgressively(existingListEl);
        } else {
            container.innerHTML = [
                '<div class="ig-view-header-row">',
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
                '<div class="ig-view-list">' + rowsHtml + '</div>'
            ].join('\n');

            UI.loadAvatarsProgressively(container);

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
                        UI.renderWhitelist(Storage.getWhitelist(), containerId);
                    }, 120);
                });
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && searchInput.value) {
                        e.preventDefault();
                        e.stopPropagation();
                        searchInput.value = '';
                        UI.whitelistSearchQuery = '';
                        UI.renderWhitelist(Storage.getWhitelist(), containerId);
                    }
                });
            }

            if (clearBtn && searchInput) {
                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    searchInput.value = '';
                    UI.whitelistSearchQuery = '';
                    UI.renderWhitelist(Storage.getWhitelist(), containerId);
                    searchInput.focus();
                });
            }
        }

        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts();
        }
        if (typeof UI.syncMainExportButton === 'function') {
            UI.syncMainExportButton();
        }
    },

    /**
     * Cross-hydrates nominal & renamed records against the persisted audience snapshot
     * so legacy entries ({ username, date }) gain avatars, full names, and relationship badges.
     */
    enrichNominalItems: (rawList, { variant = 'nominal', userId = null } = {}) => {
        if (!Array.isArray(rawList) || rawList.length === 0) return [];

        const snapshot = Storage.load(userId);
        const knownById = new Map();
        const knownByLower = new Map();
        const followersLowerSet = new Set();
        const followingLowerSet = new Set();

        if (snapshot && typeof snapshot === 'object') {
            (snapshot.followers || []).forEach((u) => {
                const name = typeof u === 'string' ? u : u?.username;
                if (name) followersLowerSet.add(String(name).toLowerCase());
            });
            (snapshot.following || []).forEach((u) => {
                const name = typeof u === 'string' ? u : u?.username;
                if (name) followingLowerSet.add(String(name).toLowerCase());
            });

            [
                ...(snapshot.mutualsDetailed || []),
                ...(snapshot.followersDetailed || []),
                ...(snapshot.followingDetailed || []),
                ...(snapshot.fansDetailed || []),
                ...(snapshot.notFollowingBackDetailed || [])
            ].forEach((u) => {
                if (!u || typeof u !== 'object') return;
                if (u.id && String(u.id) !== '0' && !knownById.has(String(u.id))) {
                    knownById.set(String(u.id), u);
                }
                if (u.username && !knownByLower.has(u.username.toLowerCase())) {
                    knownByLower.set(u.username.toLowerCase(), u);
                }
            });
        }

        const reversed = rawList.slice().reverse();
        const result = [];
        const seenKeys = new Set();

        for (const item of reversed) {
            if (!item) continue;
            const isObj = typeof item === 'object';

            if (variant === 'renamed') {
                const oldUsername = String(isObj ? (item.oldUsername || '') : '').replace(/^@+/, '').trim();
                const newUsername = String(isObj ? (item.newUsername || item.username || '') : item).replace(/^@+/, '').trim();
                if (!oldUsername && !newUsername) continue;

                const idStr = (isObj && item.id && String(item.id) !== '0') ? String(item.id) : null;
                const known = (idStr && knownById.get(idStr)) ||
                    (newUsername && knownByLower.get(newUsername.toLowerCase())) ||
                    (oldUsername && knownByLower.get(oldUsername.toLowerCase())) ||
                    null;

                const liveUsername = newUsername || known?.username || oldUsername;
                const dedupKey = `${idStr || liveUsername.toLowerCase()}:${oldUsername.toLowerCase()}->${newUsername.toLowerCase()}`;
                if (seenKeys.has(dedupKey)) continue;
                seenKeys.add(dedupKey);

                const lowerLive = liveUsername.toLowerCase();
                let relationship = isObj ? (item.relationship || null) : null;
                if (!relationship) {
                    const inF = followersLowerSet.has(lowerLive);
                    const inIng = followingLowerSet.has(lowerLive);
                    if (inF && inIng) relationship = 'mutual';
                    else if (inF) relationship = 'fan';
                    else if (inIng) relationship = 'following';
                }

                result.push({
                    id: idStr || (known?.id ? String(known.id) : null),
                    username: liveUsername,
                    oldUsername: oldUsername || '-',
                    newUsername: newUsername || liveUsername,
                    relationship,
                    fullName: (isObj ? item.fullName : '') || known?.fullName || '',
                    profilePicUrl: Utils.sanitizeImageUrl((isObj ? item.profilePicUrl : null) || known?.profilePicUrl || null),
                    isVerified: Boolean((isObj ? item.isVerified : undefined) ?? known?.isVerified),
                    isPrivate: Boolean((isObj ? item.isPrivate : undefined) ?? known?.isPrivate),
                    date: (isObj && item.date) ? String(item.date) : '',
                    url: `https://www.instagram.com/${encodeURIComponent(liveUsername)}/`
                });
            } else {
                const rawName = isObj ? (item.username || item.newUsername || '') : item;
                const cleanName = String(rawName || '').replace(/^@+/, '').trim();
                if (!cleanName) continue;

                const idStr = (isObj && item.id && String(item.id) !== '0') ? String(item.id) : null;
                const dedupKey = idStr ? `id:${idStr}` : `u:${cleanName.toLowerCase()}`;
                if (seenKeys.has(dedupKey)) continue;
                seenKeys.add(dedupKey);

                const known = (idStr && knownById.get(idStr)) ||
                    knownByLower.get(cleanName.toLowerCase()) ||
                    (isObj && item.previousUsername ? knownByLower.get(String(item.previousUsername).toLowerCase()) : null) ||
                    null;

                result.push({
                    id: idStr || (known?.id ? String(known.id) : null),
                    username: cleanName,
                    fullName: (isObj ? item.fullName : '') || known?.fullName || '',
                    profilePicUrl: Utils.sanitizeImageUrl((isObj ? item.profilePicUrl : null) || known?.profilePicUrl || null),
                    isVerified: Boolean((isObj ? item.isVerified : undefined) ?? known?.isVerified),
                    isPrivate: Boolean((isObj ? item.isPrivate : undefined) ?? known?.isPrivate),
                    previousUsername: (isObj && item.previousUsername) ? String(item.previousUsername) : null,
                    occurrences: Math.max(1, Number(isObj ? item.occurrences : 1) || 1),
                    date: (isObj && item.date) ? String(item.date) : '',
                    url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
                });
            }
        }

        return result;
    },

    renderNominalList: (list, containerId, title, options = {}) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const keyByContainer = {
            'ig-view-unfollowers': CONFIG.CHURN_KEY,
            'ig-view-deactivated': CONFIG.DEACTIVATED_KEY,
            'ig-view-blocked': CONFIG.BLOCKED_KEY
        };
        const clearNominalKey = options.storageKey || keyByContainer[containerId] || null;
        const enriched = UI.enrichNominalItems(list, { variant: 'nominal', userId: options.userId || null });

        container.innerHTML = '';
        UI.paginationState[containerId] = {
            rawUsers: enriched,
            users: enriched,
            title,
            containerId,
            isExportable: true,
            listVariant: 'nominal',
            clearNominalKey,
            emptyMessage: 'No historical records yet.',
            page: 1,
            pageSize: 50,
            searchQuery: '',
            filterType: 'all'
        };
        UI.renderResultsPage(containerId);
        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts(options.userId || null);
        }
    },

    renderRenamedList: (list, containerId, title, options = {}) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const clearNominalKey = options.storageKey || CONFIG.RENAMED_KEY;
        const enriched = UI.enrichNominalItems(list, { variant: 'renamed', userId: options.userId || null });

        container.innerHTML = '';
        UI.paginationState[containerId] = {
            rawUsers: enriched,
            users: enriched,
            title,
            containerId,
            isExportable: true,
            listVariant: 'renamed',
            clearNominalKey,
            emptyMessage: 'No username changes detected yet.',
            page: 1,
            pageSize: 50,
            searchQuery: '',
            filterType: 'all'
        };
        UI.renderResultsPage(containerId);
        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts(options.userId || null);
        }
    },
    
    renderHistory: (historyData, userId = null) => {
        const container = document.getElementById("ig-view-history");
        if (!container) return;
        let html = '<div class="ig-section-title">Metrics History</div>';
        if (!Array.isArray(historyData) || historyData.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + '</span>No historical data available.</div>';
            container.innerHTML = html;
            if (typeof UI.updateMainTabCounts === 'function') UI.updateMainTabCounts(userId);
            return;
        }

        const safeHistory = Storage.normalizeHistoryRecords(historyData).list;
        if (safeHistory.length === 0) {
            html += '<div class="ig-empty-msg"><span class="ig-empty-icon">' + Icons.metrics + '</span>No historical data available.</div>';
            container.innerHTML = html;
            if (typeof UI.updateMainTabCounts === 'function') UI.updateMainTabCounts(userId);
            return;
        }

        const oldest = safeHistory[0];
        const reversedHistory = safeHistory.slice().reverse();
        const latest = reversedHistory[0];
        const prev = reversedHistory.length > 1 ? reversedHistory[1] : null;

        const currentFollowers = latest ? Utils.formatNumber(latest.followers) : '-';
        const currentFollowing = latest ? Utils.formatNumber(latest.following) : '-';
        const exactFollowersTitle = latest ? `${Utils.formatExactNumber(latest.followers)} followers` : '';
        const exactFollowingTitle = latest ? `${Utils.formatExactNumber(latest.following)} following` : '';

        const fMeta = UI.buildKpiDelta(
            latest.followers,
            prev ? prev.followers : null,
            latest.startFollowers,
            latest.lastDeltaFollowers,
            latest.scansCount
        );
        const ingMeta = UI.buildKpiDelta(
            latest.following,
            prev ? prev.following : null,
            latest.startFollowing,
            latest.lastDeltaFollowing,
            latest.scansCount
        );

        // True Audience Balance: net growth against historical opening baseline
        const baselineFollowers = Number(oldest.startFollowers ?? oldest.followers ?? latest.followers ?? 0);
        const netFlow = Number(latest.followers ?? 0) - baselineFollowers;
        const netFlowSign = netFlow > 0 ? '+' : '';
        const netFlowClass = netFlow > 0 ? 'is-positive' : (netFlow < 0 ? 'is-negative' : 'is-neutral');

        // Reconciled active breakdown across New Followers and all loss categories
        const newCount = Storage.getNewFollowersList(userId).length;
        const churnCount = Storage.getNominalList(CONFIG.CHURN_KEY, userId).length;
        const deactivatedCount = Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId).length;
        const blockedCount = Storage.getNominalList(CONFIG.BLOCKED_KEY, userId).length;
        const totalLostCount = churnCount + deactivatedCount + blockedCount;
        const lossBreakdownTitle = `Unfollowers: ${churnCount} · Deactivated: ${deactivatedCount} · Blocked: ${blockedCount}`;

        html += [
            '<div class="ig-history-kpi-grid">',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Followers</div>',
            '    <div class="ig-kpi-value" title="' + Utils.escapeHtml(exactFollowersTitle) + '">' + currentFollowers + '</div>',
            '    <div class="ig-kpi-sub ' + fMeta.cls + '">' + fMeta.icon + ' <span>' + Utils.escapeHtml(fMeta.text) + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Following</div>',
            '    <div class="ig-kpi-value" title="' + Utils.escapeHtml(exactFollowingTitle) + '">' + currentFollowing + '</div>',
            '    <div class="ig-kpi-sub ' + ingMeta.cls + '">' + ingMeta.icon + ' <span>' + Utils.escapeHtml(ingMeta.text) + '</span></div>',
            '  </div>',
            '  <div class="ig-kpi-card">',
            '    <div class="ig-kpi-label">Audience Balance</div>',
            '    <div class="ig-kpi-value ' + netFlowClass + '" title="Net vs opening baseline (' + Utils.formatExactNumber(baselineFollowers) + ')">' + netFlowSign + netFlow.toLocaleString() + '</div>',
            '    <div class="ig-kpi-sub ig-kpi-sub-split">',
            '      <button type="button" class="ig-kpi-jump-btn is-positive" data-main-tab="ig-view-newfollowers" title="Open New Followers">+' + newCount + ' new</button>',
            '      <span class="ig-kpi-sep">/</span>',
            '      <button type="button" class="ig-kpi-jump-btn is-negative" data-main-tab="ig-view-unfollowers" title="' + Utils.escapeHtml(lossBreakdownTitle) + '">-' + totalLostCount + ' lost</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');

        // Interactive SVG Trend Chart mount
        html += '<div class="ig-trend-chart-mount">' + UI.renderTrendChartCard(safeHistory, { scope: 'main' }) + '</div>';

        // Audience Composition & Reciprocity card (from live snapshot or latest history)
        const snap = Storage.load(userId);
        const compFollowers = snap?.followers?.length ?? Number(latest.followers ?? 0);
        const compFollowing = snap?.following?.length ?? Number(latest.following ?? 0);
        const compMutuals = snap?.mutualsDetailed?.length ?? (latest.mutuals !== undefined ? Number(latest.mutuals) : null);
        const compFans = snap?.fansDetailed?.length ?? (latest.fans !== undefined ? Number(latest.fans) : null);
        const compNotBack = snap ? Math.max(0, compFollowing - (compMutuals ?? 0)) : (latest.notFollowingBack !== undefined ? Number(latest.notFollowingBack) : null);

        if (compMutuals !== null && (compFollowers > 0 || compFollowing > 0)) {
            html += UI.renderAudienceCompositionCard({
                followers: compFollowers,
                following: compFollowing,
                mutuals: compMutuals,
                fans: compFans,
                notFollowingBack: compNotBack,
                mode: 'main'
            });
        }

        html += '<div class="ig-section-title" style="margin-top: 14px;">Daily Log <span class="ig-badge">' + safeHistory.length + '</span></div>';
        html += '<div class="ig-table-scroll-region" tabindex="0" role="region" aria-label="Historical metrics table">';
        html += '<table class="ig-table ig-history-table"><thead><tr><th>Date</th><th>Followers</th><th>Following</th><th>Mutuals</th></tr></thead><tbody>';
        reversedHistory.forEach((h, index) => {
            const isBaselineRow = index === reversedHistory.length - 1;
            const prevDay = !isBaselineRow ? reversedHistory[index + 1] : null;
            const scans = Number(h.scansCount) || 1;

            const dayDiffF = prevDay ? (Number(h.followers ?? 0) - Number(prevDay.followers ?? 0)) : 0;
            const intraF = Number(h.followers ?? 0) - Number(h.startFollowers ?? h.followers ?? 0);
            const fDeltaHtml = UI.formatDeltaPillHtml(dayDiffF, {
                intradayDelta: intraF,
                scansCount: scans,
                isBaselineRow
            });

            const dayDiffIng = prevDay ? (Number(h.following ?? 0) - Number(prevDay.following ?? 0)) : 0;
            const intraIng = Number(h.following ?? 0) - Number(h.startFollowing ?? h.following ?? 0);
            const ingDeltaHtml = UI.formatDeltaPillHtml(dayDiffIng, {
                intradayDelta: intraIng,
                scansCount: scans,
                isBaselineRow
            });

            let mutCellHtml = '<span class="ig-metric-muted">—</span>';
            if (h.mutuals !== undefined && h.mutuals !== null && !Number.isNaN(Number(h.mutuals))) {
                const hasPrevMut = prevDay && prevDay.mutuals !== undefined && prevDay.mutuals !== null;
                const dayDiffMut = hasPrevMut ? (Number(h.mutuals) - Number(prevDay.mutuals)) : 0;
                const intraMut = Number(h.mutuals) - Number(h.startMutuals ?? h.mutuals);
                const mutDeltaHtml = UI.formatDeltaPillHtml(dayDiffMut, {
                    intradayDelta: intraMut,
                    scansCount: scans,
                    isBaselineRow: !hasPrevMut
                });
                mutCellHtml = '<span class="ig-metric-value">' + Utils.formatExactNumber(h.mutuals) + ' ' + mutDeltaHtml + '</span>';
            }

            const safeDate = Utils.escapeHtml(h.date || '');
            const scansBadge = scans > 1 ? `<span class="ig-scans-pill" title="${scans} scans recorded on ${safeDate}">${scans}x</span>` : '';

            html += '<tr>' +
                '<th scope="row"><span class="ig-table-date">' + safeDate + '</span>' + scansBadge + '</th>' +
                '<td><span class="ig-metric-value">' + Utils.formatExactNumber(h.followers) + ' ' + fDeltaHtml + '</span></td>' +
                '<td><span class="ig-metric-value">' + Utils.formatExactNumber(h.following) + ' ' + ingDeltaHtml + '</span></td>' +
                '<td>' + mutCellHtml + '</td>' +
                '</tr>';
        });
        html += "</tbody></table></div>";
        container.innerHTML = html;

        const chartMount = container.querySelector('.ig-trend-chart-mount');
        if (chartMount && typeof UI.bindChartInteractions === 'function') {
            UI.bindChartInteractions(chartMount, { historyList: safeHistory, scope: 'main' });
        }

        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts(userId);
        }
    },
    
    getFilterCounts: (rawUsers, searchQuery = '', listVariant = 'standard') => {
        const query = (searchQuery || '').trim().toLowerCase().replace(/^@+/, '');
        const baseList = query
            ? (rawUsers || []).filter((u) => {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                const oldName = (u?.oldUsername || '').toLowerCase();
                const prevName = (u?.previousUsername || '').toLowerCase();
                return uName.includes(query) || fName.includes(query) || oldName.includes(query) || prevName.includes(query);
            })
            : (rawUsers || []);

        if (listVariant === 'nominal') {
            return {
                all: baseList.length,
                repeat: baseList.filter((u) => Number(u.occurrences) > 1).length,
                renamed: baseList.filter((u) => Boolean(u.previousUsername)).length,
                private: baseList.filter((u) => Boolean(u.isPrivate)).length,
                verified: baseList.filter((u) => Boolean(u.isVerified)).length
            };
        }

        if (listVariant === 'renamed') {
            return {
                all: baseList.length,
                mutual: baseList.filter((u) => u.relationship === 'mutual').length,
                fan: baseList.filter((u) => u.relationship === 'fan').length,
                following: baseList.filter((u) => u.relationship === 'following').length,
                verified: baseList.filter((u) => Boolean(u.isVerified)).length
            };
        }

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
        const variant = state.listVariant || 'standard';

        state.users = (state.rawUsers || []).filter((u) => {
            if (query) {
                const uName = (u?.username || '').toLowerCase();
                const fName = (u?.fullName || '').toLowerCase();
                const oldName = (u?.oldUsername || '').toLowerCase();
                const prevName = (u?.previousUsername || '').toLowerCase();
                if (!uName.includes(query) && !fName.includes(query) && !oldName.includes(query) && !prevName.includes(query)) {
                    return false;
                }
            }

            if (variant === 'nominal') {
                if (filter === 'repeat') return Number(u.occurrences) > 1;
                if (filter === 'renamed') return Boolean(u.previousUsername);
                if (filter === 'private') return Boolean(u.isPrivate);
                if (filter === 'verified') return Boolean(u.isVerified);
                return true;
            }

            if (variant === 'renamed') {
                if (filter === 'mutual') return u.relationship === 'mutual';
                if (filter === 'fan') return u.relationship === 'fan';
                if (filter === 'following') return u.relationship === 'following';
                if (filter === 'verified') return Boolean(u.isVerified);
                return true;
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

        const counts = UI.getFilterCounts(state.rawUsers, state.searchQuery, state.listVariant || 'standard');
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
        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts();
        }
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

    renderPersistedSnapshot: (snapshot, userId = null) => {
        if (!snapshot || typeof snapshot !== 'object') {
            if (typeof window !== 'undefined') window.__igLastResults = [];
            UI.renderResults([], "Not Following You Back", "ig-view-notfollowing", true);
            UI.renderResults([], "Fans (They follow you, you don't)", "ig-view-fans", true);
            UI.renderResults([], "Mutual Connections", "ig-view-mutuals", true);
            if (typeof UI.updateMainTabCounts === 'function') {
                UI.updateMainTabCounts(userId);
            }
            if (typeof UI.syncMainExportButton === 'function') {
                UI.syncMainExportButton();
            }
            return;
        }

        // One-time fallback migration ONLY when a live scoped key has never been initialized (e.g. legacy flat snapshot)
        const migrateMissingKeyFromSnapshot = (baseKey, snapVal, renderFn) => {
            if (!Storage.hasScopedValue(baseKey, userId) && Array.isArray(snapVal) && snapVal.length > 0) {
                Storage.setScopedValue(baseKey, snapVal, userId);
                if (typeof renderFn === 'function') renderFn();
            }
        };

        migrateMissingKeyFromSnapshot(CONFIG.WHITELIST_KEY, snapshot.whitelist, () => {
            UI.renderWhitelist(Storage.getWhitelist(userId));
        });
        migrateMissingKeyFromSnapshot(CONFIG.NEW_FOLLOWERS_KEY, snapshot.newFollowersDetailed, () => {
            UI.renderNewFollowers(Storage.getNewFollowersList(userId));
        });
        migrateMissingKeyFromSnapshot(CONFIG.CHURN_KEY, snapshot.unfollowers, () => {
            UI.renderNominalList(Storage.getNominalList(CONFIG.CHURN_KEY, userId), "ig-view-unfollowers", "Recent Unfollowers", { userId });
        });
        migrateMissingKeyFromSnapshot(CONFIG.DEACTIVATED_KEY, snapshot.deactivated, () => {
            UI.renderNominalList(Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId), "ig-view-deactivated", "Deactivated Accounts", { userId });
        });
        migrateMissingKeyFromSnapshot(CONFIG.BLOCKED_KEY, snapshot.blocked, () => {
            UI.renderNominalList(Storage.getNominalList(CONFIG.BLOCKED_KEY, userId), "ig-view-blocked", "Blocked Accounts", { userId });
        });
        migrateMissingKeyFromSnapshot(CONFIG.RENAMED_KEY, snapshot.renamed, () => {
            UI.renderRenamedList(Storage.getNominalList(CONFIG.RENAMED_KEY, userId), "ig-view-renamed", "Username Changes", { userId });
        });
        migrateMissingKeyFromSnapshot(CONFIG.HISTORY_KEY, snapshot.history, () => {
            UI.renderHistory(Storage.getHistory(userId), userId);
        });

        // Dynamically recompute "Not Following You Back" against the LIVE whitelist so Ignore/Restore/Clear never revert on reload
        const liveWhitelist = Storage.getWhitelist(userId);
        const wlLowerSet = new Set(liveWhitelist.map((u) => String(u || '').toLowerCase()));

        if (Array.isArray(snapshot.following) && Array.isArray(snapshot.followers)) {
            const followersLowerSet = new Set(snapshot.followers.map((u) => {
                const name = typeof u === 'string' ? u : u?.username;
                return String(name || '').toLowerCase();
            }));

            const knownByLower = new Map();
            [
                ...(snapshot.followingDetailed || []),
                ...(snapshot.notFollowingBackDetailed || []),
                ...(snapshot.followersDetailed || [])
            ].forEach((u) => {
                if (u && typeof u === 'object' && u.username) {
                    const lower = u.username.toLowerCase();
                    if (!knownByLower.has(lower)) knownByLower.set(lower, u);
                }
            });

            const liveNotFollowingDetailed = [];
            const seenLower = new Set();
            snapshot.following.forEach((rawItem) => {
                const rawName = typeof rawItem === 'string' ? rawItem : rawItem?.username;
                const cleanName = String(rawName || '').replace(/^@+/, '').trim();
                if (!cleanName) return;
                const lower = cleanName.toLowerCase();
                if (seenLower.has(lower) || followersLowerSet.has(lower) || wlLowerSet.has(lower)) return;
                seenLower.add(lower);

                const detail = knownByLower.get(lower) || (typeof rawItem === 'object' ? rawItem : {});
                const canonicalName = detail.username || cleanName;
                liveNotFollowingDetailed.push({
                    ...detail,
                    username: canonicalName,
                    url: `https://www.instagram.com/${encodeURIComponent(canonicalName)}/`
                });
            });

            UI.renderResults(liveNotFollowingDetailed, "Not Following You Back", "ig-view-notfollowing", true);
            window.__igLastResults = liveNotFollowingDetailed;
        } else if (Array.isArray(snapshot.notFollowingBackDetailed)) {
            const filtered = snapshot.notFollowingBackDetailed.filter(
                (u) => !wlLowerSet.has(String(u?.username || '').toLowerCase())
            );
            UI.renderResults(filtered, "Not Following You Back", "ig-view-notfollowing", true);
            window.__igLastResults = filtered;
        }

        if (Array.isArray(snapshot.fansDetailed)) {
            UI.renderResults(snapshot.fansDetailed, "Fans (They follow you, you don't)", "ig-view-fans", true);
        }

        if (Array.isArray(snapshot.mutualsDetailed)) {
            UI.renderResults(snapshot.mutualsDetailed, "Mutual Connections", "ig-view-mutuals", true);
        }

        if (typeof UI.updateMainTabCounts === 'function') {
            UI.updateMainTabCounts(userId);
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
