import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';


let currentUserId = null;

const GLOBAL_UI_KEYS = new Set([
    CONFIG.POSITION_KEY,
    CONFIG.TARGET_SUBPANEL_POSITION_KEY,
    CONFIG.TOUR_KEY
]);

const ACCOUNT_SCOPED_KEYS = [
    CONFIG.STORAGE_KEY,
    CONFIG.WHITELIST_KEY,
    CONFIG.HISTORY_KEY,
    CONFIG.CHURN_KEY,
    CONFIG.DEACTIVATED_KEY,
    CONFIG.BLOCKED_KEY,
    CONFIG.RENAMED_KEY,
    CONFIG.NEW_FOLLOWERS_KEY,
    CONFIG.TARGET_TRACKER_KEY,
    CONFIG.STORY_ANOMALY_KEY,
    CONFIG.STORY_OBS_KEY
];

export const Storage = {
    setCurrentUserId: (id) => {
        if (id && String(id) !== "0") {
            currentUserId = String(id);
        } else if (id === null) {
            currentUserId = null;
        }
    },

    getCurrentUserId: () => {
        if (!currentUserId) {
            const detected = Utils.getUserId();
            if (detected && String(detected) !== "0") {
                currentUserId = String(detected);
            }
        }
        return currentUserId;
    },

    isGlobalUiKey: (baseKey) => GLOBAL_UI_KEYS.has(baseKey),

    getAccountScopedKeys: () => ACCOUNT_SCOPED_KEYS.slice(),

    getKey: (baseKey, userId = null) => {
        if (GLOBAL_UI_KEYS.has(baseKey)) return baseKey;
        const id = userId || Storage.getCurrentUserId();
        return id ? `${baseKey}_${id}` : baseKey;
    },

    getScopedValue: (baseKey, defaultValue = null, userId = null) => {
        if (GLOBAL_UI_KEYS.has(baseKey)) {
            return GM_getValue(baseKey, defaultValue);
        }

        const id = userId || Storage.getCurrentUserId();
        if (id) {
            const idStr = String(id);
            const scopedKey = `${baseKey}_${idStr}`;
            const val = GM_getValue(scopedKey, undefined);
            if (val !== undefined && val !== null) {
                return val;
            }

            // One-time legacy migration: migrate unscoped key to scoped key and extinguish orphan unscoped key
            const legacyVal = GM_getValue(baseKey, undefined);
            if (legacyVal !== undefined && legacyVal !== null) {
                const legacyOwner = (legacyVal && typeof legacyVal === 'object' && !Array.isArray(legacyVal) && legacyVal.ownerUserId)
                    ? String(legacyVal.ownerUserId)
                    : null;

                if (legacyOwner && legacyOwner !== idStr) {
                    try {
                        const rightfulKey = `${baseKey}_${legacyOwner}`;
                        const existingOwnerVal = GM_getValue(rightfulKey, undefined);
                        if (existingOwnerVal === undefined || existingOwnerVal === null) {
                            GM_setValue(rightfulKey, legacyVal);
                        }
                        if (typeof GM_deleteValue === 'function') {
                            GM_deleteValue(baseKey);
                        }
                    } catch (e) {
                        Utils.logError("Error isolating foreign legacy storage key", e);
                    }
                    return defaultValue;
                }

                let migratedVal = legacyVal;
                if (baseKey === CONFIG.STORAGE_KEY && legacyVal && typeof legacyVal === 'object' && !Array.isArray(legacyVal)) {
                    migratedVal = { ...legacyVal, ownerUserId: idStr };
                }

                try {
                    GM_setValue(scopedKey, migratedVal);
                    if (typeof GM_deleteValue === 'function') {
                        GM_deleteValue(baseKey);
                    }
                    Utils.log(`[Storage] Migrated legacy data for "${baseKey}" to "${scopedKey}" and removed unscoped copy.`);
                } catch (e) {
                    Utils.logError("Error migrating legacy storage key", e);
                }
                return migratedVal;
            }

            return defaultValue;
        }
        return GM_getValue(baseKey, defaultValue);
    },

    setScopedValue: (baseKey, value, userId = null) => {
        if (GLOBAL_UI_KEYS.has(baseKey)) {
            GM_setValue(baseKey, value);
            return;
        }
        const id = userId || Storage.getCurrentUserId();
        const key = id ? `${baseKey}_${id}` : baseKey;
        GM_setValue(key, value);
    },

    hasScopedValue: (baseKey, userId = null) => {
        if (GLOBAL_UI_KEYS.has(baseKey)) {
            const gVal = GM_getValue(baseKey, undefined);
            return gVal !== undefined && gVal !== null;
        }
        const id = userId || Storage.getCurrentUserId();
        if (id) {
            const idStr = String(id);
            const scopedVal = GM_getValue(`${baseKey}_${idStr}`, undefined);
            if (scopedVal !== undefined && scopedVal !== null) return true;

            const legacyVal = GM_getValue(baseKey, undefined);
            if (legacyVal === undefined || legacyVal === null) return false;
            if (legacyVal && typeof legacyVal === 'object' && !Array.isArray(legacyVal) && legacyVal.ownerUserId) {
                return String(legacyVal.ownerUserId) === idStr;
            }
            return true;
        }
        const legacyVal = GM_getValue(baseKey, undefined);
        return legacyVal !== undefined && legacyVal !== null;
    },

    normalizeItemDates: (rawList) => {
        if (!Array.isArray(rawList)) return { list: [], modified: false };
        const todayStr = Utils.localDateStr();
        let modified = false;
        const list = rawList.map((item) => {
            if (!item || typeof item !== 'object') return item;
            if (typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date > todayStr) {
                modified = true;
                return { ...item, date: todayStr };
            }
            return item;
        });
        return { list, modified };
    },

    /**
     * Normalizes history entries, auto-healing future UTC dates into local calendar dates
     * and merging duplicate same-day records chronologically while preserving start-of-day baselines.
     * @param {Array<object>} rawHistory
     * @returns {{ list: Array<object>, modified: boolean }}
     */
    normalizeHistoryRecords: (rawHistory) => {
        if (!Array.isArray(rawHistory) || rawHistory.length === 0) {
            return { list: [], modified: false };
        }

        const todayStr = Utils.localDateStr();
        let modified = false;
        const byDate = new Map();

        rawHistory.forEach((raw) => {
            if (!raw || typeof raw !== 'object') {
                modified = true;
                return;
            }
            let dStr = typeof raw.date === 'string' ? raw.date.trim() : '';
            if (!dStr) {
                dStr = raw.updatedAt ? Utils.localDateStr(raw.updatedAt) : todayStr;
                modified = true;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dStr) && dStr > todayStr) {
                // Auto-heal future UTC date generated by evening local scans prior to localDateStr fix
                const healedDate = raw.updatedAt ? Utils.localDateStr(raw.updatedAt) : todayStr;
                dStr = healedDate > todayStr ? todayStr : healedDate;
                modified = true;
            }

            const followers = Number(raw.followers ?? 0);
            const following = Number(raw.following ?? 0);
            const hasMutuals = raw.mutuals !== undefined && raw.mutuals !== null;
            const mutuals = hasMutuals ? Number(raw.mutuals) : undefined;

            if (!byDate.has(dStr)) {
                byDate.set(dStr, {
                    ...raw,
                    date: dStr,
                    followers,
                    following,
                    ...(hasMutuals ? { mutuals } : {})
                });
            } else {
                // Merge duplicate same-day record preserving opening baseline
                modified = true;
                const prev = byDate.get(dStr);
                const startFollowers = Number(prev.startFollowers ?? prev.followers ?? followers);
                const startFollowing = Number(prev.startFollowing ?? prev.following ?? following);
                const startMutuals = hasMutuals
                    ? Number(prev.startMutuals ?? prev.mutuals ?? mutuals)
                    : prev.startMutuals;

                byDate.set(dStr, {
                    ...prev,
                    ...raw,
                    date: dStr,
                    followers,
                    following,
                    ...(hasMutuals ? { mutuals, startMutuals } : {}),
                    startFollowers,
                    startFollowing,
                    prevScanFollowers: Number(raw.prevScanFollowers ?? prev.followers ?? startFollowers),
                    prevScanFollowing: Number(raw.prevScanFollowing ?? prev.following ?? startFollowing),
                    intradayDeltaFollowers: followers - startFollowers,
                    intradayDeltaFollowing: following - startFollowing,
                    scansCount: (Number(prev.scansCount) || 1) + (Number(raw.scansCount) || 1)
                });
            }
        });

        const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
        const originalDates = rawHistory.map((r) => r?.date || '');
        if (sortedDates.length !== originalDates.length || sortedDates.some((d, idx) => d !== originalDates[idx])) {
            modified = true;
        }

        const list = sortedDates.map((d, idx) => {
            const entry = byDate.get(d);
            const prevDay = idx > 0 ? byDate.get(sortedDates[idx - 1]) : null;
            const startFollowers = Number(entry.startFollowers ?? entry.followers ?? 0);
            const startFollowing = Number(entry.startFollowing ?? entry.following ?? 0);
            const intradayDeltaFollowers = Number(entry.followers ?? 0) - startFollowers;
            const intradayDeltaFollowing = Number(entry.following ?? 0) - startFollowing;
            const expectedDayDeltaF = prevDay
                ? (Number(entry.followers ?? 0) - Number(prevDay.followers ?? startFollowers))
                : intradayDeltaFollowers;
            const expectedDayDeltaIng = prevDay
                ? (Number(entry.following ?? 0) - Number(prevDay.following ?? startFollowing))
                : intradayDeltaFollowing;

            if (entry.dayDeltaFollowers === undefined || modified) {
                entry.dayDeltaFollowers = expectedDayDeltaF;
                entry.dayDeltaFollowing = expectedDayDeltaIng;
                entry.intradayDeltaFollowers = intradayDeltaFollowers;
                entry.intradayDeltaFollowing = intradayDeltaFollowing;
            }
            return entry;
        });

        return { list, modified };
    },

    /**
     * Upserts a daily metrics record into a history array using local calendar dates,
     * preserving start-of-day baselines and tracking intra-day / per-scan deltas.
     * @param {Array<object>} rawHistory
     * @param {object} metrics
     * @returns {Array<object>}
     */
    upsertHistoryRecord: (rawHistory, metrics = {}) => {
        const todayStr = metrics.dateStr ? Utils.localDateStr(metrics.dateStr) : Utils.localDateStr();
        const { list: hist } = Storage.normalizeHistoryRecords(rawHistory);

        const followers = Number(metrics.followers ?? 0);
        const following = Number(metrics.following ?? 0);
        const hasMutuals = metrics.mutuals !== undefined && metrics.mutuals !== null;
        const mutuals = hasMutuals ? Number(metrics.mutuals) : undefined;

        const existingIdx = hist.findIndex((h) => h.date === todayStr);

        if (existingIdx > -1) {
            const existing = hist[existingIdx];
            const prevDay = existingIdx > 0 ? hist[existingIdx - 1] : null;

            const startFollowers = Number(existing.startFollowers ?? existing.followers ?? followers);
            const startFollowing = Number(existing.startFollowing ?? existing.following ?? following);
            const startMutuals = hasMutuals
                ? Number(existing.startMutuals ?? existing.mutuals ?? mutuals)
                : existing.startMutuals;

            const prevScanFollowers = Number(existing.followers ?? followers);
            const prevScanFollowing = Number(existing.following ?? following);
            const prevScanMutuals = (hasMutuals && existing.mutuals !== undefined && existing.mutuals !== null)
                ? Number(existing.mutuals)
                : null;

            const lastDeltaFollowers = followers - prevScanFollowers;
            const lastDeltaFollowing = following - prevScanFollowing;
            const lastDeltaMutuals = (hasMutuals && prevScanMutuals !== null)
                ? (mutuals - prevScanMutuals)
                : 0;

            const intradayDeltaFollowers = followers - startFollowers;
            const intradayDeltaFollowing = following - startFollowing;

            const dayDeltaFollowers = prevDay
                ? (followers - Number(prevDay.followers ?? startFollowers))
                : intradayDeltaFollowers;
            const dayDeltaFollowing = prevDay
                ? (following - Number(prevDay.following ?? startFollowing))
                : intradayDeltaFollowing;

            let mergedSummary = existing.scanSummary || null;
            if (metrics.scanSummary && typeof metrics.scanSummary === 'object') {
                const prevSum = existing.scanSummary || {};
                mergedSummary = {
                    gained: (prevSum.gained || 0) + (metrics.scanSummary.gained || 0),
                    lost: (prevSum.lost || 0) + (metrics.scanSummary.lost || 0),
                    deactivated: (prevSum.deactivated || 0) + (metrics.scanSummary.deactivated || 0),
                    blocked: (prevSum.blocked || 0) + (metrics.scanSummary.blocked || 0),
                    renamed: (prevSum.renamed || 0) + (metrics.scanSummary.renamed || 0),
                    lastScanGained: metrics.scanSummary.gained || 0,
                    lastScanLost: metrics.scanSummary.lost || 0
                };
            }

            hist[existingIdx] = {
                ...existing,
                date: todayStr,
                followers,
                following,
                ...(hasMutuals ? { mutuals, startMutuals, prevScanMutuals, lastDeltaMutuals } : {}),
                ...(metrics.fans !== undefined ? { fans: Number(metrics.fans) } : {}),
                ...(metrics.notFollowingBack !== undefined ? { notFollowingBack: Number(metrics.notFollowingBack) } : {}),
                startFollowers,
                startFollowing,
                prevScanFollowers,
                prevScanFollowing,
                lastDeltaFollowers,
                lastDeltaFollowing,
                intradayDeltaFollowers,
                intradayDeltaFollowing,
                dayDeltaFollowers,
                dayDeltaFollowing,
                scansCount: (Number(existing.scansCount) || 1) + 1,
                ...(mergedSummary ? { scanSummary: mergedSummary } : {}),
                updatedAt: Utils.now()
            };
        } else {
            // Find the chronological predecessor strictly before todayStr
            const priorEntries = hist.filter((h) => String(h.date || '') < todayStr);
            const prevDay = priorEntries.length > 0 ? priorEntries[priorEntries.length - 1] : null;

            const prevScanFollowers = prevDay ? Number(prevDay.followers ?? followers) : null;
            const prevScanFollowing = prevDay ? Number(prevDay.following ?? following) : null;
            const prevScanMutuals = (hasMutuals && prevDay && prevDay.mutuals !== undefined && prevDay.mutuals !== null)
                ? Number(prevDay.mutuals)
                : null;

            const lastDeltaFollowers = prevScanFollowers !== null ? (followers - prevScanFollowers) : 0;
            const lastDeltaFollowing = prevScanFollowing !== null ? (following - prevScanFollowing) : 0;
            const lastDeltaMutuals = (hasMutuals && prevScanMutuals !== null) ? (mutuals - prevScanMutuals) : 0;

            let initialSummary = null;
            if (metrics.scanSummary && typeof metrics.scanSummary === 'object') {
                initialSummary = {
                    gained: metrics.scanSummary.gained || 0,
                    lost: metrics.scanSummary.lost || 0,
                    deactivated: metrics.scanSummary.deactivated || 0,
                    blocked: metrics.scanSummary.blocked || 0,
                    renamed: metrics.scanSummary.renamed || 0,
                    lastScanGained: metrics.scanSummary.gained || 0,
                    lastScanLost: metrics.scanSummary.lost || 0
                };
            }

            hist.push({
                date: todayStr,
                followers,
                following,
                ...(hasMutuals ? {
                    mutuals,
                    startMutuals: mutuals,
                    prevScanMutuals,
                    lastDeltaMutuals
                } : {}),
                ...(metrics.fans !== undefined ? { fans: Number(metrics.fans) } : {}),
                ...(metrics.notFollowingBack !== undefined ? { notFollowingBack: Number(metrics.notFollowingBack) } : {}),
                startFollowers: followers,
                startFollowing: following,
                prevScanFollowers,
                prevScanFollowing,
                lastDeltaFollowers,
                lastDeltaFollowing,
                intradayDeltaFollowers: 0,
                intradayDeltaFollowing: 0,
                dayDeltaFollowers: lastDeltaFollowers,
                dayDeltaFollowing: lastDeltaFollowing,
                scansCount: 1,
                ...(initialSummary ? { scanSummary: initialSummary } : {}),
                updatedAt: Utils.now()
            });

            hist.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        }

        return hist;
    },

    load: (userId = null) => {
        try {
            const snap = Storage.getScopedValue(CONFIG.STORAGE_KEY, null, userId);
            return snap && Array.isArray(snap.followers) ? snap : null;
        } catch (e) {
            Utils.logError("Error loading snapshot", e);
            return null;
        }
    },

    save: (data, userId = null) => {
        const id = userId || Storage.getCurrentUserId();
        const payload = (data && typeof data === 'object' && !Array.isArray(data) && id)
            ? { ...data, ownerUserId: String(id) }
            : data;
        Storage.setScopedValue(CONFIG.STORAGE_KEY, payload, id);
    },

    getWhitelist: (userId = null) => {
        const raw = Storage.getScopedValue(CONFIG.WHITELIST_KEY, [], userId);
        return Array.isArray(raw) ? raw : [];
    },

    addToWhitelist: (username, userId = null) => {
        const clean = String(username || '').replace(/^@+/, '').trim();
        if (!clean) return;
        const wl = Storage.getWhitelist(userId);
        const lower = clean.toLowerCase();
        if (!wl.some((u) => String(u || '').toLowerCase() === lower)) {
            wl.push(clean);
            Storage.setScopedValue(CONFIG.WHITELIST_KEY, wl, userId);
        }
    },

    removeFromWhitelist: (username, userId = null) => {
        const clean = String(username || '').replace(/^@+/, '').trim().toLowerCase();
        if (!clean) return;
        const wl = Storage.getWhitelist(userId);
        const filtered = wl.filter((u) => String(u || '').toLowerCase() !== clean);
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, filtered, userId);
    },

    clearWhitelist: (userId = null) => {
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },

    getNewFollowersList: (userId = null) => {
        const raw = Storage.getScopedValue(CONFIG.NEW_FOLLOWERS_KEY, [], userId);
        const { list, modified } = Storage.normalizeItemDates(raw);
        if (modified) {
            Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
        }
        return list;
    },

    addNewFollowersEntries: (entries, userId = null) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const list = Storage.getNewFollowersList(userId);
        const dateStr = Utils.localDateStr();

        entries.forEach((item) => {
            const rawName = typeof item === 'string' ? item : item?.username;
            const username = String(rawName || '').replace(/^@+/, '').trim();
            if (!username) return;

            const lowerName = username.toLowerCase();
            const itemId = (typeof item === 'object' && item?.id && String(item.id) !== "0") ? String(item.id) : null;

            const existingIdx = list.findIndex((x) => {
                if (itemId && x?.id && String(x.id) === itemId) return true;
                return String(x?.username || '').toLowerCase() === lowerName;
            });

            const entryObj = {
                id: itemId || (existingIdx > -1 ? list[existingIdx].id : null) || null,
                username,
                fullName: (typeof item === 'object' ? item.fullName : '') || (existingIdx > -1 ? list[existingIdx].fullName : '') || '',
                profilePicUrl: (typeof item === 'object' ? item.profilePicUrl : '') || (existingIdx > -1 ? list[existingIdx].profilePicUrl : '') || '',
                isVerified: typeof item === 'object' && item.isVerified !== undefined ? Boolean(item.isVerified) : Boolean(existingIdx > -1 && list[existingIdx].isVerified),
                isPrivate: typeof item === 'object' && item.isPrivate !== undefined ? Boolean(item.isPrivate) : Boolean(existingIdx > -1 && list[existingIdx].isPrivate),
                isBestie: typeof item === 'object' && item.isBestie !== undefined ? Boolean(item.isBestie) : Boolean(existingIdx > -1 && list[existingIdx].isBestie),
                followsBack: (typeof item === 'object' && item.followsBack !== undefined)
                    ? item.followsBack
                    : (existingIdx > -1 ? list[existingIdx].followsBack : null),
                date: (typeof item === 'object' && item.date) ? Utils.localDateStr(item.date) : dateStr
            };

            if (existingIdx > -1) {
                list.splice(existingIdx, 1);
            }
            list.push(entryObj);
        });

        Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
    },

    getHistory: (userId = null) => {
        const raw = Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
        const { list, modified } = Storage.normalizeHistoryRecords(raw);
        if (modified) {
            Storage.setScopedValue(CONFIG.HISTORY_KEY, list, userId);
        }
        return list;
    },

    addHistoryEntry: (followersCount, followingCount, userId = null, extraMetrics = {}) => {
        const raw = Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
        const updated = Storage.upsertHistoryRecord(raw, {
            ...extraMetrics,
            followers: followersCount,
            following: followingCount
        });
        Storage.setScopedValue(CONFIG.HISTORY_KEY, updated, userId);
        return updated;
    },

    getNominalList: (key, userId = null) => {
        const raw = Storage.getScopedValue(key, [], userId);
        const { list, modified } = Storage.normalizeItemDates(raw);
        if (modified) {
            Storage.setScopedValue(key, list, userId);
        }
        return list;
    },

    clearNominalList: (key, userId = null) => {
        if (!key) return;
        Storage.setScopedValue(key, [], userId);
    },

    /**
     * Adds or updates nominal state entries (Unfollowers, Deactivated, Blocked).
     * Accepts usernames or detailed user objects; updates date, metadata, and occurrence count on repeat events.
     */
    addNominalEntries: (key, entries, userId = null) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const list = Storage.getNominalList(key, userId);
        const dateStr = Utils.localDateStr();

        entries.forEach((item) => {
            const isObj = item && typeof item === 'object';
            const rawName = isObj ? item.username : item;
            const username = String(rawName || '').replace(/^@+/, '').trim();
            if (!username) return;

            const lowerName = username.toLowerCase();
            const itemId = (isObj && item.id && String(item.id) !== "0") ? String(item.id) : null;

            const existingIdx = list.findIndex((x) => {
                if (itemId && x?.id && String(x.id) === itemId) return true;
                return String(x?.username || '').toLowerCase() === lowerName;
            });

            const existing = existingIdx > -1 ? list[existingIdx] : null;
            const merged = {
                ...(existing || {}),
                id: itemId || existing?.id || null,
                username,
                fullName: (isObj && item.fullName) ? item.fullName : (existing?.fullName || ''),
                profilePicUrl: (isObj && item.profilePicUrl) ? item.profilePicUrl : (existing?.profilePicUrl || null),
                isVerified: (isObj && item.isVerified !== undefined) ? Boolean(item.isVerified) : Boolean(existing?.isVerified),
                isPrivate: (isObj && item.isPrivate !== undefined) ? Boolean(item.isPrivate) : Boolean(existing?.isPrivate),
                ...(isObj && item.previousUsername ? { previousUsername: item.previousUsername } : {}),
                occurrences: existing ? ((Number(existing.occurrences) || 1) + 1) : 1,
                date: (isObj && item.date) ? Utils.localDateStr(item.date) : dateStr
            };

            if (existingIdx > -1) {
                list.splice(existingIdx, 1);
            }
            list.push(merged);
        });

        Storage.setScopedValue(key, list, userId);
    },

    addRenamedEntries: (entries, userId = null) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const list = Storage.getNominalList(CONFIG.RENAMED_KEY, userId);
        const dateStr = Utils.localDateStr();

        entries.forEach((entry) => {
            if (!entry?.id || !entry?.oldUsername || !entry?.newUsername) return;
            const idStr = String(entry.id);

            const existsIdx = list.findIndex(
                (x) => String(x.id) === idStr && x.oldUsername === entry.oldUsername && x.newUsername === entry.newUsername
            );

            const record = {
                ...(existsIdx > -1 ? list[existsIdx] : {}),
                id: idStr,
                username: entry.newUsername,
                oldUsername: entry.oldUsername,
                newUsername: entry.newUsername,
                relationship: entry.relationship || (existsIdx > -1 ? list[existsIdx].relationship : null) || null,
                fullName: entry.fullName || (existsIdx > -1 ? list[existsIdx].fullName : '') || '',
                profilePicUrl: entry.profilePicUrl || (existsIdx > -1 ? list[existsIdx].profilePicUrl : null) || null,
                isVerified: entry.isVerified !== undefined ? Boolean(entry.isVerified) : Boolean(existsIdx > -1 && list[existsIdx].isVerified),
                isPrivate: entry.isPrivate !== undefined ? Boolean(entry.isPrivate) : Boolean(existsIdx > -1 && list[existsIdx].isPrivate),
                date: entry.date ? Utils.localDateStr(entry.date) : (existsIdx > -1 ? list[existsIdx].date : dateStr)
            };

            if (existsIdx > -1) {
                list[existsIdx] = record;
            } else {
                list.push(record);
            }
        });

        Storage.setScopedValue(CONFIG.RENAMED_KEY, list, userId);
    },

    /**
     * Reconciles all persisted audience state lists against current live followers/following and ID renames:
     * - Heals renamed usernames in Whitelist, Churn, and New Followers
     * - Removes reactivated accounts from DEACTIVATED_KEY (returning reactivatedFollowersLowerSet)
     * - Removes unblocked/active accounts from BLOCKED_KEY
     * - Removes re-followed accounts from CHURN_KEY
     * - Prunes inactive accounts from NEW_FOLLOWERS_KEY and dynamically updates followsBack (Mutual/Fan)
     */
    reconcileAudienceState: ({ followersDetailed = [], followingDetailed = [], allRenames = [] } = {}, userId = null) => {
        const followersByLower = new Map();
        const followersById = new Map();
        followersDetailed.forEach((u) => {
            if (!u?.username) return;
            followersByLower.set(u.username.toLowerCase(), u);
            if (u.id && String(u.id) !== "0") followersById.set(String(u.id), u);
        });

        const followingByLower = new Map();
        const followingById = new Map();
        followingDetailed.forEach((u) => {
            if (!u?.username) return;
            followingByLower.set(u.username.toLowerCase(), u);
            if (u.id && String(u.id) !== "0") followingById.set(String(u.id), u);
        });

        const renameByOldLower = new Map();
        const renameById = new Map();
        (allRenames || []).forEach((r) => {
            if (r?.oldUsername && r?.newUsername) {
                renameByOldLower.set(r.oldUsername.toLowerCase(), r);
            }
            if (r?.id && String(r.id) !== "0") {
                renameById.set(String(r.id), r);
            }
        });

        // 1. Heal Whitelist (@old -> @new) deduplicated case-insensitively
        const rawWhitelist = Storage.getWhitelist(userId);
        let wlChanged = false;
        const wlSeen = new Set();
        const healedWhitelist = [];
        rawWhitelist.forEach((rawName) => {
            const clean = String(rawName || '').replace(/^@+/, '').trim();
            if (!clean) {
                wlChanged = true;
                return;
            }
            const ren = renameByOldLower.get(clean.toLowerCase());
            const resolved = ren ? ren.newUsername : clean;
            if (resolved !== rawName) wlChanged = true;
            const lower = resolved.toLowerCase();
            if (!wlSeen.has(lower)) {
                wlSeen.add(lower);
                healedWhitelist.push(resolved);
            } else {
                wlChanged = true;
            }
        });
        if (wlChanged) {
            Storage.setScopedValue(CONFIG.WHITELIST_KEY, healedWhitelist, userId);
        }

        const resolveLiveAccount = (entry) => {
            const idStr = (entry?.id && String(entry.id) !== "0") ? String(entry.id) : null;
            const uLower = String(entry?.username || '').toLowerCase();
            const ren = (idStr && renameById.get(idStr)) || renameByOldLower.get(uLower) || null;
            const candidateLower = ren ? ren.newUsername.toLowerCase() : uLower;

            const inFollower = (idStr && followersById.get(idStr)) || followersByLower.get(candidateLower) || followersByLower.get(uLower) || null;
            const inFollowing = (idStr && followingById.get(idStr)) || followingByLower.get(candidateLower) || followingByLower.get(uLower) || null;
            return { inFollower, inFollowing, rename: ren };
        };

        // 2. Reconcile DEACTIVATED_KEY & identify reactivated followers
        const reactivatedFollowersLowerSet = new Set();
        const storedDeactivated = Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId);
        let deactivatedChanged = false;
        const nextDeactivated = [];
        storedDeactivated.forEach((entry) => {
            const { inFollower, inFollowing } = resolveLiveAccount(entry);
            if (inFollower || inFollowing) {
                deactivatedChanged = true;
                if (inFollower?.username) {
                    reactivatedFollowersLowerSet.add(inFollower.username.toLowerCase());
                }
            } else {
                nextDeactivated.push(entry);
            }
        });
        if (deactivatedChanged) {
            Storage.setScopedValue(CONFIG.DEACTIVATED_KEY, nextDeactivated, userId);
        }

        // 3. Reconcile BLOCKED_KEY (remove accounts now visible in followers or following)
        const storedBlocked = Storage.getNominalList(CONFIG.BLOCKED_KEY, userId);
        let blockedChanged = false;
        const nextBlocked = storedBlocked.filter((entry) => {
            const { inFollower, inFollowing } = resolveLiveAccount(entry);
            if (inFollower || inFollowing) {
                blockedChanged = true;
                return false;
            }
            return true;
        });
        if (blockedChanged) {
            Storage.setScopedValue(CONFIG.BLOCKED_KEY, nextBlocked, userId);
        }

        // 4. Reconcile CHURN_KEY (remove accounts that re-followed; heal username if still in following & renamed)
        const storedChurn = Storage.getNominalList(CONFIG.CHURN_KEY, userId);
        let churnChanged = false;
        const nextChurn = [];
        storedChurn.forEach((entry) => {
            const { inFollower, inFollowing, rename } = resolveLiveAccount(entry);
            if (inFollower) {
                churnChanged = true;
                return;
            }
            if (inFollowing && inFollowing.username !== entry.username) {
                churnChanged = true;
                nextChurn.push({
                    ...entry,
                    id: inFollowing.id || entry.id || null,
                    previousUsername: entry.previousUsername || entry.username,
                    username: inFollowing.username,
                    fullName: inFollowing.fullName || entry.fullName || '',
                    profilePicUrl: inFollowing.profilePicUrl || entry.profilePicUrl || null,
                    isVerified: Boolean(inFollowing.isVerified ?? entry.isVerified),
                    isPrivate: Boolean(inFollowing.isPrivate ?? entry.isPrivate)
                });
            } else if (rename && rename.newUsername !== entry.username) {
                churnChanged = true;
                nextChurn.push({
                    ...entry,
                    id: rename.id || entry.id || null,
                    previousUsername: entry.previousUsername || entry.username,
                    username: rename.newUsername
                });
            } else {
                nextChurn.push(entry);
            }
        });
        if (churnChanged) {
            Storage.setScopedValue(CONFIG.CHURN_KEY, nextChurn, userId);
        }

        // 5. Reconcile NEW_FOLLOWERS_KEY (prune unfollowers/deactivated/blocked, heal renames, live-sync followsBack)
        const storedNewFollowers = Storage.getNewFollowersList(userId);
        let nfChanged = false;
        const nfSeenLower = new Set();
        const nextNewFollowers = [];
        storedNewFollowers.forEach((entry) => {
            const { inFollower, inFollowing } = resolveLiveAccount(entry);
            if (!inFollower) {
                // No longer following the viewer -> prune from New Followers
                nfChanged = true;
                return;
            }
            const liveUsername = inFollower.username;
            const liveLower = liveUsername.toLowerCase();
            if (nfSeenLower.has(liveLower)) {
                nfChanged = true;
                return;
            }
            nfSeenLower.add(liveLower);

            const liveFollowsBack = Boolean(inFollowing);
            const liveId = inFollower.id || entry.id || null;
            const liveFullName = inFollower.fullName || inFollowing?.fullName || entry.fullName || '';
            const livePic = inFollower.profilePicUrl || inFollowing?.profilePicUrl || entry.profilePicUrl || '';
            const liveVerified = Boolean(inFollower.isVerified ?? entry.isVerified);
            const livePrivate = Boolean(inFollower.isPrivate ?? entry.isPrivate);
            const liveBestie = Boolean(inFollower.isBestie ?? inFollowing?.isBestie ?? entry.isBestie);

            if (
                entry.username !== liveUsername ||
                entry.id !== liveId ||
                entry.followsBack !== liveFollowsBack ||
                entry.fullName !== liveFullName ||
                entry.profilePicUrl !== livePic ||
                entry.isVerified !== liveVerified ||
                entry.isPrivate !== livePrivate ||
                entry.isBestie !== liveBestie
            ) {
                nfChanged = true;
            }

            nextNewFollowers.push({
                ...entry,
                id: liveId,
                username: liveUsername,
                fullName: liveFullName,
                profilePicUrl: livePic,
                isVerified: liveVerified,
                isPrivate: livePrivate,
                isBestie: liveBestie,
                followsBack: liveFollowsBack
            });
        });

        if (nfChanged) {
            Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, nextNewFollowers, userId);
        }

        return {
            whitelist: healedWhitelist,
            reactivatedFollowersLowerSet
        };
    },

    getStoryObservations: (username, userId = null) => {
        const clean = String(username || '').replace(/^@/, '').toLowerCase().trim();
        const raw = String(username || '').trim();
        const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
        return obs[clean] || obs[raw] || obs[`@${raw}`] || [];
    },

    addStoryObservation: (username, data, userId = null) => {
        const clean = String(username || '').replace(/^@/, '').toLowerCase().trim();
        const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
        if (!obs[clean]) obs[clean] = [];
        
        // Add current timestamp and epochMs
        data.timestamp = Utils.now();
        data.epochMs = Date.now();
        obs[clean].push(data);
        
        // Keep only last 10 observations to prevent bloat
        if (obs[clean].length > 10) {
            obs[clean].shift();
        }
        
        Storage.setScopedValue(CONFIG.STORY_OBS_KEY, obs, userId);
    },

    clearStoryObservations: (username, userId = null) => {
        const clean = String(username || '').replace(/^@/, '').toLowerCase().trim();
        const raw = String(username || '').trim();
        const obs = Storage.getScopedValue(CONFIG.STORY_OBS_KEY, {}, userId);
        let modified = false;
        [clean, raw, `@${raw}`].forEach((k) => {
            if (obs[k]) {
                delete obs[k];
                modified = true;
            }
        });
        if (modified) {
            Storage.setScopedValue(CONFIG.STORY_OBS_KEY, obs, userId);
        }
    },

    mergeTargetEntriesById: (olderEntry = {}, newerEntry = {}) => {
        const oldUser = olderEntry?.user || {};
        const newUser = newerEntry?.user || {};
        const oldHandle = String(oldUser.username || olderEntry?.username || '').replace(/^@+\s*/, '').trim();
        const newHandle = String(newUser.username || newerEntry?.username || oldHandle || '').replace(/^@+\s*/, '').trim();
        const newLower = newHandle.toLowerCase();

        const prevNames = Utils.unique([
            ...(Array.isArray(oldUser.previousUsernames) ? oldUser.previousUsernames : []),
            ...(oldUser.previousUsername ? [oldUser.previousUsername] : []),
            ...(Array.isArray(newUser.previousUsernames) ? newUser.previousUsernames : []),
            ...(newUser.previousUsername ? [newUser.previousUsername] : []),
            ...(oldHandle && oldHandle.toLowerCase() !== newLower ? [oldHandle] : [])
        ].map((n) => String(n || '').replace(/^@+\s*/, '').trim()).filter((n) => n && n.toLowerCase() !== newLower));

        const previousUsername = prevNames.length > 0 ? prevNames[prevNames.length - 1] : null;

        // 1. Chronologically merge history records (preserving intraday baseline on same-day merges)
        const oldHist = Storage.normalizeHistoryRecords(Array.isArray(olderEntry?.history) ? olderEntry.history : []).list;
        const newHist = Storage.normalizeHistoryRecords(Array.isArray(newerEntry?.history) ? newerEntry.history : []).list;
        const histByDate = new Map();

        oldHist.forEach((h) => {
            if (h?.date) histByDate.set(h.date, { ...h });
        });
        newHist.forEach((h) => {
            if (!h?.date) return;
            if (!histByDate.has(h.date)) {
                histByDate.set(h.date, { ...h });
            } else {
                const prev = histByDate.get(h.date);
                const startF = Number(prev.startFollowers ?? prev.followers ?? h.startFollowers ?? h.followers ?? 0);
                const startIng = Number(prev.startFollowing ?? prev.following ?? h.startFollowing ?? h.following ?? 0);
                const startMut = (prev.startMutuals !== undefined && prev.startMutuals !== null)
                    ? Number(prev.startMutuals)
                    : (prev.mutuals !== undefined && prev.mutuals !== null ? Number(prev.mutuals) : h.startMutuals);
                const currF = Number(h.followers ?? prev.followers ?? 0);
                const currIng = Number(h.following ?? prev.following ?? 0);
                const currMut = h.mutuals !== undefined && h.mutuals !== null ? Number(h.mutuals) : prev.mutuals;

                histByDate.set(h.date, {
                    ...prev,
                    ...h,
                    followers: currF,
                    following: currIng,
                    ...(currMut !== undefined && currMut !== null ? { mutuals: currMut } : {}),
                    startFollowers: startF,
                    startFollowing: startIng,
                    ...(startMut !== undefined && startMut !== null ? { startMutuals: startMut } : {}),
                    lastDeltaFollowers: currF - Number(prev.followers ?? startF),
                    lastDeltaFollowing: currIng - Number(prev.following ?? startIng),
                    scansCount: (Number(prev.scansCount) || 1) + (Number(h.scansCount) || 1),
                    updatedAt: h.updatedAt || prev.updatedAt || Utils.now()
                });
            }
        });

        const mergedHistory = Storage.normalizeHistoryRecords(Array.from(histByDate.values())).list;
        for (let i = 0; i < mergedHistory.length; i++) {
            const cur = mergedHistory[i];
            const prevDay = i > 0 ? mergedHistory[i - 1] : null;
            cur.dayDeltaFollowers = prevDay
                ? (cur.followers - prevDay.followers)
                : (cur.followers - Number(cur.startFollowers ?? cur.followers));
            cur.dayDeltaFollowing = prevDay
                ? (cur.following - prevDay.following)
                : (cur.following - Number(cur.startFollowing ?? cur.following));
        }

        // 2. Reconcile network lists & backfill diffs if newerEntry was recorded as a fresh baseline after a rename
        const oldFollowers = Utils.toDetailedUserArray(olderEntry?.followers || []);
        const oldFollowing = Utils.toDetailedUserArray(olderEntry?.following || []);
        const oldMutuals = Utils.toDetailedUserArray(olderEntry?.mutuals || []);

        const newFollowersList = Utils.toDetailedUserArray(newerEntry?.followers || []);
        const newFollowingList = Utils.toDetailedUserArray(newerEntry?.following || []);
        const newMutualsList = Utils.toDetailedUserArray(newerEntry?.mutuals || []);

        const hasNewNetwork = newFollowersList.length > 0 || newFollowingList.length > 0;
        const hasOldNetwork = oldFollowers.length > 0 || oldFollowing.length > 0;

        let newFollowersDiff = Utils.toDetailedUserArray(newerEntry?.newFollowers || []);
        let lostFollowersDiff = Utils.toDetailedUserArray(newerEntry?.lostFollowers || []);
        let newMutualsDiff = Utils.toDetailedUserArray(newerEntry?.newMutuals || []);
        let newFollowingDiff = Utils.toDetailedUserArray(newerEntry?.newFollowing || []);
        let lostFollowingDiff = Utils.toDetailedUserArray(newerEntry?.lostFollowing || []);
        let lastAuditDelta = newerEntry?.lastAuditDelta || olderEntry?.lastAuditDelta || null;

        const newerHadNoDiffs = newFollowersDiff.length === 0 && lostFollowersDiff.length === 0 && newMutualsDiff.length === 0;

        if (hasNewNetwork && hasOldNetwork && newerHadNoDiffs) {
            const auditDateStr = Utils.localDateStr(newerEntry?.lastAuditAt || newerEntry?.updatedAt || Utils.now());
            const followerRenames = Utils.detectRenamedUsers(oldFollowers, newFollowersList);
            const followingRenames = Utils.detectRenamedUsers(oldFollowing, newFollowingList);
            const mutualRenames = Utils.detectRenamedUsers(oldMutuals, newMutualsList);

            const fRenOld = new Set(followerRenames.map((r) => r.oldUsername.toLowerCase()));
            const fRenNew = new Set(followerRenames.map((r) => r.newUsername.toLowerCase()));
            const ingRenOld = new Set(followingRenames.map((r) => r.oldUsername.toLowerCase()));
            const ingRenNew = new Set(followingRenames.map((r) => r.newUsername.toLowerCase()));
            const mutRenNew = new Set(mutualRenames.map((r) => r.newUsername.toLowerCase()));

            const oldFByLower = new Map(oldFollowers.map((u) => [u.username.toLowerCase(), u]));
            const oldFIds = new Set(oldFollowers.map((u) => u.id ? String(u.id) : null).filter(Boolean));
            const newFByLower = new Map(newFollowersList.map((u) => [u.username.toLowerCase(), u]));
            const newFIds = new Set(newFollowersList.map((u) => u.id ? String(u.id) : null).filter(Boolean));

            const oldIngByLower = new Map(oldFollowing.map((u) => [u.username.toLowerCase(), u]));
            const oldIngIds = new Set(oldFollowing.map((u) => u.id ? String(u.id) : null).filter(Boolean));
            const newIngByLower = new Map(newFollowingList.map((u) => [u.username.toLowerCase(), u]));
            const newIngIds = new Set(newFollowingList.map((u) => u.id ? String(u.id) : null).filter(Boolean));

            const oldMutLower = new Set(oldMutuals.map((u) => u.username.toLowerCase()));
            const oldMutIds = new Set(oldMutuals.map((u) => u.id ? String(u.id) : null).filter(Boolean));

            const computedNewF = newFollowersList
                .filter((u) => {
                    const lower = u.username.toLowerCase();
                    if (u.id && oldFIds.has(String(u.id))) return false;
                    return !oldFByLower.has(lower) && !fRenNew.has(lower);
                })
                .map((u) => ({ ...u, date: auditDateStr }));

            const computedLostF = oldFollowers
                .filter((u) => {
                    const lower = u.username.toLowerCase();
                    if (u.id && newFIds.has(String(u.id))) return false;
                    return !newFByLower.has(lower) && !fRenOld.has(lower);
                })
                .map((u) => ({ ...u, date: auditDateStr }));

            const computedNewIng = newFollowingList
                .filter((u) => {
                    const lower = u.username.toLowerCase();
                    if (u.id && oldIngIds.has(String(u.id))) return false;
                    return !oldIngByLower.has(lower) && !ingRenNew.has(lower);
                })
                .map((u) => ({ ...u, date: auditDateStr }));

            const computedLostIng = oldFollowing
                .filter((u) => {
                    const lower = u.username.toLowerCase();
                    if (u.id && newIngIds.has(String(u.id))) return false;
                    return !newIngByLower.has(lower) && !ingRenOld.has(lower);
                })
                .map((u) => ({ ...u, date: auditDateStr }));

            const computedNewMut = newMutualsList
                .filter((u) => {
                    const lower = u.username.toLowerCase();
                    if (u.id && oldMutIds.has(String(u.id))) return false;
                    return !oldMutLower.has(lower) && !mutRenNew.has(lower);
                })
                .map((u) => ({ ...u, date: auditDateStr }));

            newFollowersDiff = Utils.toDetailedUserArray([...(olderEntry?.newFollowers || []).filter((u) => newFByLower.has(u.username.toLowerCase())), ...computedNewF]);
            lostFollowersDiff = Utils.toDetailedUserArray([...(olderEntry?.lostFollowers || []).filter((u) => !newFByLower.has(u.username.toLowerCase())), ...computedLostF]);
            newMutualsDiff = Utils.toDetailedUserArray([...(olderEntry?.newMutuals || []).filter((u) => newMutualsList.some((m) => m.username.toLowerCase() === u.username.toLowerCase())), ...computedNewMut]);
            newFollowingDiff = Utils.toDetailedUserArray([...(olderEntry?.newFollowing || []).filter((u) => newIngByLower.has(u.username.toLowerCase())), ...computedNewIng]);
            lostFollowingDiff = Utils.toDetailedUserArray([...(olderEntry?.lostFollowing || []).filter((u) => !newIngByLower.has(u.username.toLowerCase())), ...computedLostIng]);

            lastAuditDelta = {
                gainedFollowers: computedNewF.length,
                lostFollowers: computedLostF.length,
                gainedFollowing: computedNewIng.length,
                lostFollowing: computedLostIng.length,
                newMutuals: computedNewMut.length,
                renamed: followerRenames.length + followingRenames.length
            };
        } else if (!hasNewNetwork && hasOldNetwork) {
            newFollowersDiff = Utils.toDetailedUserArray(olderEntry?.newFollowers || []);
            lostFollowersDiff = Utils.toDetailedUserArray(olderEntry?.lostFollowers || []);
            newMutualsDiff = Utils.toDetailedUserArray(olderEntry?.newMutuals || []);
            newFollowingDiff = Utils.toDetailedUserArray(olderEntry?.newFollowing || []);
            lostFollowingDiff = Utils.toDetailedUserArray(olderEntry?.lostFollowing || []);
        }

        const mergedUser = {
            ...oldUser,
            ...newUser,
            id: String(newUser.id || oldUser.id || ''),
            username: newHandle,
            ...(previousUsername ? { previousUsername, previousUsernames: prevNames } : {})
        };

        return {
            ...olderEntry,
            ...newerEntry,
            user: mergedUser,
            username: newLower,
            followers: hasNewNetwork ? newFollowersList : oldFollowers,
            following: hasNewNetwork ? newFollowingList : oldFollowing,
            mutuals: hasNewNetwork ? newMutualsList : oldMutuals,
            newFollowers: newFollowersDiff,
            lostFollowers: lostFollowersDiff,
            newMutuals: newMutualsDiff,
            newFollowing: newFollowingDiff,
            lostFollowing: lostFollowingDiff,
            lastAuditDelta,
            history: mergedHistory,
            lastAuditAt: newerEntry?.lastAuditAt || olderEntry?.lastAuditAt || Utils.now(),
            updatedAt: newerEntry?.updatedAt || olderEntry?.updatedAt || Utils.now()
        };
    },

    getTargetTrackerMap: (userId = null) => {
        const map = Storage.getScopedValue(CONFIG.TARGET_TRACKER_KEY, {}, userId);
        const viewerId = Utils.getUserId();
        const viewerName = (Utils.getUsername() || '').toLowerCase();
        let modified = false;

        if (map && typeof map === 'object') {
            Object.keys(map).forEach((k) => {
                const item = map[k];
                if (k !== viewerName && viewerId && item?.user && String(item.user.id) === String(viewerId)) {
                    delete map[k];
                    modified = true;
                    return;
                }
                if (item && Array.isArray(item.history) && item.history.length > 0) {
                    const { list: healedHist, modified: histMod } = Storage.normalizeHistoryRecords(item.history);
                    if (histMod) {
                        item.history = healedHist;
                        modified = true;
                    }
                }
            });

            // Auto-reconcile & merge split target records that share the same immutable numeric Instagram ID
            const keysById = new Map();
            Object.keys(map).forEach((k) => {
                const item = map[k];
                const rawId = item?.user?.id;
                const idStr = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && String(rawId) !== '0' && String(rawId) !== 'null')
                    ? String(rawId).trim()
                    : null;
                if (!idStr) return;
                if (!keysById.has(idStr)) keysById.set(idStr, []);
                keysById.get(idStr).push(k);
            });

            keysById.forEach((groupKeys) => {
                if (groupKeys.length > 1) {
                    const sortedKeys = groupKeys.slice().sort((a, b) => {
                        const tA = new Date(map[a]?.lastAuditAt || map[a]?.updatedAt || 0).getTime() || 0;
                        const tB = new Date(map[b]?.lastAuditAt || map[b]?.updatedAt || 0).getTime() || 0;
                        return tA - tB;
                    });
                    let merged = map[sortedKeys[0]];
                    for (let i = 1; i < sortedKeys.length; i++) {
                        merged = Storage.mergeTargetEntriesById(merged, map[sortedKeys[i]]);
                    }
                    const canonicalKey = String(merged?.user?.username || merged?.username || sortedKeys[sortedKeys.length - 1])
                        .replace(/^@+\s*/, '')
                        .toLowerCase()
                        .trim();
                    sortedKeys.forEach((k) => delete map[k]);
                    map[canonicalKey] = {
                        ...merged,
                        username: canonicalKey
                    };
                    modified = true;
                } else if (groupKeys.length === 1) {
                    const k = groupKeys[0];
                    const item = map[k];
                    const liveUsername = String(item?.user?.username || '').replace(/^@+\s*/, '').trim();
                    const liveKey = liveUsername.toLowerCase();
                    if (liveKey && liveKey !== k) {
                        const prevNames = Utils.unique([
                            ...(Array.isArray(item.user?.previousUsernames) ? item.user.previousUsernames : []),
                            ...(item.user?.previousUsername ? [item.user.previousUsername] : []),
                            k
                        ].filter((n) => n && String(n).toLowerCase() !== liveKey));
                        delete map[k];
                        map[liveKey] = {
                            ...item,
                            username: liveKey,
                            user: {
                                ...item.user,
                                username: liveUsername,
                                ...(prevNames.length > 0 ? { previousUsername: prevNames[prevNames.length - 1], previousUsernames: prevNames } : {})
                            }
                        };
                        modified = true;
                    }
                }
            });

            if (modified) {
                Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
            }
        }

        return map;
    },

    getTargetData: (username, userId = null, targetId = null) => {
        let rawName = username;
        let resolvedTargetId = targetId;
        if (username && typeof username === 'object') {
            rawName = username.username || '';
            resolvedTargetId = resolvedTargetId || username.id || null;
        }
        const clean = String(rawName || '').replace(/^@+\s*/, '').toLowerCase().trim();
        const cleanId = (resolvedTargetId !== null && resolvedTargetId !== undefined && String(resolvedTargetId).trim() !== '' && String(resolvedTargetId) !== '0' && String(resolvedTargetId) !== 'null')
            ? String(resolvedTargetId).trim()
            : null;

        const map = Storage.getTargetTrackerMap(userId);
        if (clean && map[clean]) {
            return map[clean];
        }

        if (map && typeof map === 'object') {
            for (const entry of Object.values(map)) {
                if (!entry) continue;
                const entryId = entry?.user?.id ? String(entry.user.id).trim() : null;
                if (cleanId && entryId && entryId === cleanId) {
                    return entry;
                }
                if (clean) {
                    const prevSingle = String(entry?.user?.previousUsername || '').toLowerCase().trim();
                    const prevList = Array.isArray(entry?.user?.previousUsernames)
                        ? entry.user.previousUsernames.map((n) => String(n || '').toLowerCase().trim())
                        : [];
                    if (prevSingle === clean || prevList.includes(clean)) {
                        return entry;
                    }
                }
            }
        }

        return null;
    },

    saveTargetData: (username, data, userId = null) => {
        const clean = String(username || '').replace(/^@+\s*/, '').toLowerCase().trim();
        if (!clean) return;

        const viewerId = Utils.getUserId();
        const viewerName = (Utils.getUsername() || '').toLowerCase();
        if (clean !== viewerName && viewerId && data?.user && String(data.user.id) === String(viewerId)) {
            console.warn(`[IG Analyzer] Refusing to save target data for @${clean} because ID matches logged-in viewer.`);
            return;
        }

        const map = Storage.getTargetTrackerMap(userId);
        const incomingId = (data?.user?.id && String(data.user.id) !== '0' && String(data.user.id) !== 'null')
            ? String(data.user.id).trim()
            : null;

        let mergedPayload = {
            ...data,
            username: clean,
            updatedAt: Utils.now()
        };

        // If an entry with the same immutable user.id exists under an older username key, migrate & merge it
        if (incomingId) {
            Object.keys(map).forEach((existingKey) => {
                if (existingKey === clean) return;
                const existingEntry = map[existingKey];
                const existingId = existingEntry?.user?.id ? String(existingEntry.user.id).trim() : null;
                if (existingId && existingId === incomingId) {
                    mergedPayload = Storage.mergeTargetEntriesById(existingEntry, mergedPayload);
                    delete map[existingKey];
                }
            });
        }

        map[clean] = mergedPayload;

        // Cache Eviction: Keep only the 5 most recently audited targets to prevent QuotaExceededError
        const keys = Object.keys(map);
        if (keys.length > 5) {
            keys.sort((a, b) => new Date(map[b].updatedAt).getTime() - new Date(map[a].updatedAt).getTime());
            const keysToRemove = keys.slice(5);
            keysToRemove.forEach(k => delete map[k]);
        }

        Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
    },

    removeTargetData: (username, userId = null, targetId = null) => {
        const clean = String(username || '').replace(/^@+\s*/, '').toLowerCase().trim();
        const cleanId = (targetId && String(targetId) !== '0' && String(targetId) !== 'null') ? String(targetId).trim() : null;
        const map = Storage.getTargetTrackerMap(userId);
        let modified = false;
        if (clean && map[clean]) {
            delete map[clean];
            modified = true;
        }
        if (cleanId && map && typeof map === 'object') {
            Object.keys(map).forEach((k) => {
                if (String(map[k]?.user?.id || '') === cleanId) {
                    delete map[k];
                    modified = true;
                }
            });
        }
        if (modified) {
            Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
        }
    },

    deleteTargetData: (username, userId = null, targetId = null) => {
        return Storage.removeTargetData(username, userId, targetId);
    },

    syncFreshUserData: (freshUsersArray, userId = null) => {
        if (!Array.isArray(freshUsersArray) || freshUsersArray.length === 0) return;
        const freshMap = new Map();
        freshUsersArray.forEach((u) => {
            const username = typeof u === 'string' ? u : u?.username;
            if (username) {
                freshMap.set(String(username).toLowerCase(), u);
            }
        });

        // 1. Sync NEW_FOLLOWERS_KEY
        const newFollowers = Storage.getNewFollowersList(userId);
        let newFollowersChanged = false;
        if (Array.isArray(newFollowers) && newFollowers.length > 0) {
            newFollowers.forEach((entry) => {
                const cleanUser = String(entry.username || '').toLowerCase();
                const fresh = freshMap.get(cleanUser);
                if (fresh) {
                    if (fresh.profilePicUrl && fresh.profilePicUrl !== entry.profilePicUrl) {
                        entry.profilePicUrl = fresh.profilePicUrl;
                        newFollowersChanged = true;
                    }
                    if (fresh.fullName && fresh.fullName !== entry.fullName) {
                        entry.fullName = fresh.fullName;
                        newFollowersChanged = true;
                    }
                    if (fresh.isVerified !== undefined && entry.isVerified !== Boolean(fresh.isVerified)) {
                        entry.isVerified = Boolean(fresh.isVerified);
                        newFollowersChanged = true;
                    }
                    if (fresh.isPrivate !== undefined && entry.isPrivate !== Boolean(fresh.isPrivate)) {
                        entry.isPrivate = Boolean(fresh.isPrivate);
                        newFollowersChanged = true;
                    }
                    if (fresh.isBestie !== undefined && entry.isBestie !== Boolean(fresh.isBestie)) {
                        entry.isBestie = Boolean(fresh.isBestie);
                        newFollowersChanged = true;
                    }
                    if (fresh.followsBack !== undefined && entry.followsBack !== fresh.followsBack) {
                        entry.followsBack = fresh.followsBack;
                        newFollowersChanged = true;
                    }
                }
            });
            if (newFollowersChanged) {
                Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, newFollowers, userId);
            }
        }

        // 2. Sync stored snapshot
        const snap = Storage.load(userId);
        if (snap) {
            let snapChanged = false;
            const syncList = (list) => {
                if (!Array.isArray(list)) return;
                list.forEach((item) => {
                    const uName = typeof item === 'string' ? item : item?.username;
                    if (!uName) return;
                    const fresh = freshMap.get(String(uName).toLowerCase());
                    if (fresh && typeof item === 'object') {
                        if (fresh.profilePicUrl && fresh.profilePicUrl !== item.profilePicUrl) {
                            item.profilePicUrl = fresh.profilePicUrl;
                            snapChanged = true;
                        }
                        if (fresh.fullName && fresh.fullName !== item.fullName) {
                            item.fullName = fresh.fullName;
                            snapChanged = true;
                        }
                    }
                });
            };

            syncList(snap.followersDetailed);
            syncList(snap.followingDetailed);
            syncList(snap.mutualsDetailed);
            syncList(snap.fansDetailed);
            syncList(snap.notFollowingBackDetailed);
            syncList(snap.newFollowersDetailed);

            if (snapChanged) {
                Storage.save(snap, userId);
            }
        }
    },

    updateUserProfile: (username, updates = {}, userId = null) => {
        if (!username || typeof updates !== 'object') return;
        const cleanUser = String(username).replace(/^@+/, '').toLowerCase().trim();
        if (!cleanUser) return;

        // 1. Update in NEW_FOLLOWERS_KEY
        const newFollowers = Storage.getNewFollowersList(userId);
        let nfChanged = false;
        if (Array.isArray(newFollowers)) {
            const entry = newFollowers.find((x) => String(x.username || '').toLowerCase() === cleanUser);
            if (entry) {
                Object.assign(entry, updates);
                nfChanged = true;
            }
            if (nfChanged) {
                Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, newFollowers, userId);
            }
        }

        // 2. Update in stored snapshot
        const snap = Storage.load(userId);
        if (snap) {
            let snapChanged = false;
            const updateInList = (list) => {
                if (!Array.isArray(list)) return;
                const match = list.find((x) => typeof x === 'object' && String(x.username || '').toLowerCase() === cleanUser);
                if (match) {
                    Object.assign(match, updates);
                    snapChanged = true;
                }
            };
            updateInList(snap.followersDetailed);
            updateInList(snap.followingDetailed);
            updateInList(snap.mutualsDetailed);
            updateInList(snap.fansDetailed);
            updateInList(snap.notFollowingBackDetailed);
            updateInList(snap.newFollowersDetailed);
            if (snapChanged) {
                Storage.save(snap, userId);
            }
        }

        // 3. Update in target tracker if present
        const targetMap = Storage.getTargetTrackerMap(userId);
        if (targetMap && typeof targetMap === 'object') {
            let targetChanged = false;
            Object.values(targetMap).forEach((tData) => {
                if (!tData) return;
                if (String(tData.username || '').toLowerCase() === cleanUser && tData.user) {
                    Object.assign(tData.user, updates);
                    targetChanged = true;
                }
                const updateInTargetList = (tList) => {
                    if (!Array.isArray(tList)) return;
                    const match = tList.find((x) => typeof x === 'object' && String(x.username || '').toLowerCase() === cleanUser);
                    if (match) {
                        Object.assign(match, updates);
                        targetChanged = true;
                    }
                };
                updateInTargetList(tData.followers);
                updateInTargetList(tData.following);
                updateInTargetList(tData.mutuals);
                updateInTargetList(tData.newFollowers);
                updateInTargetList(tData.newMutuals);
            });
            if (targetChanged) {
                Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, targetMap, userId);
            }
        }
        // 4. Update in nominal & renamed lists (Unfollowers, Deactivated, Blocked, Renamed)
        [CONFIG.CHURN_KEY, CONFIG.DEACTIVATED_KEY, CONFIG.BLOCKED_KEY, CONFIG.RENAMED_KEY].forEach((listKey) => {
            const list = Storage.getNominalList(listKey, userId);
            if (!Array.isArray(list) || list.length === 0) return;
            let listChanged = false;
            list.forEach((entry) => {
                if (!entry || typeof entry !== 'object') return;
                const entryName = String(entry.newUsername || entry.username || '').toLowerCase();
                if (entryName === cleanUser) {
                    Object.assign(entry, updates);
                    listChanged = true;
                }
            });
            if (listChanged) {
                Storage.setScopedValue(listKey, list, userId);
            }
        });
    },

    /**
     * Searches all detailed snapshots, nominal lists, renamed records, and target tracker caches
     * to resolve a known user object (including numeric Instagram ID) locally with zero network cost.
     * @param {string} username
     * @param {string | null} [userId=null]
     * @returns {object | null}
     */
    findKnownUserByUsername: (username, userId = null) => {
        const cleanUser = String(username || '').replace(/^@+\s*/, '').trim().toLowerCase();
        if (!cleanUser) return null;

        let bestMatch = null;
        const consider = (candidate) => {
            if (!candidate || typeof candidate !== 'object') return false;
            const cName = String(candidate.newUsername || candidate.username || '').toLowerCase();
            const cOld = String(candidate.oldUsername || candidate.previousUsername || '').toLowerCase();
            if (cName !== cleanUser && cOld !== cleanUser) return false;

            const normalized = {
                ...candidate,
                username: candidate.newUsername || candidate.username || cleanUser
            };
            if (!bestMatch) {
                bestMatch = normalized;
            } else {
                bestMatch = {
                    ...bestMatch,
                    ...normalized,
                    id: normalized.id && String(normalized.id) !== '0' ? String(normalized.id) : bestMatch.id,
                    fullName: normalized.fullName || bestMatch.fullName || '',
                    profilePicUrl: normalized.profilePicUrl || bestMatch.profilePicUrl || null
                };
            }
            return Boolean(bestMatch?.id && String(bestMatch.id) !== '0');
        };

        try {
            const activeId = Storage.getCurrentUserId();
            if ((!userId || String(userId) === String(activeId)) && typeof window !== 'undefined' && Array.isArray(window.__igLastResults)) {
                for (const item of window.__igLastResults) {
                    if (consider(item)) return bestMatch;
                }
            }
        } catch (e) {}

        const snap = Storage.load(userId);
        if (snap && typeof snap === 'object') {
            const detailedPools = [
                snap.followersDetailed,
                snap.followingDetailed,
                snap.mutualsDetailed,
                snap.fansDetailed,
                snap.notFollowingBackDetailed,
                snap.newFollowersDetailed
            ];
            for (const pool of detailedPools) {
                if (!Array.isArray(pool)) continue;
                for (const item of pool) {
                    if (consider(item)) return bestMatch;
                }
            }
        }

        const nominalPools = [
            Storage.getNewFollowersList(userId),
            Storage.getNominalList(CONFIG.CHURN_KEY, userId),
            Storage.getNominalList(CONFIG.DEACTIVATED_KEY, userId),
            Storage.getNominalList(CONFIG.BLOCKED_KEY, userId),
            Storage.getNominalList(CONFIG.RENAMED_KEY, userId)
        ];
        for (const pool of nominalPools) {
            if (!Array.isArray(pool)) continue;
            for (const item of pool) {
                if (consider(item)) return bestMatch;
            }
        }

        const targetMap = Storage.getTargetTrackerMap(userId);
        if (targetMap && typeof targetMap === 'object') {
            for (const tData of Object.values(targetMap)) {
                if (!tData) continue;
                if (tData.user && consider(tData.user)) return bestMatch;
                const tPools = [tData.followers, tData.following, tData.mutuals, tData.newFollowers, tData.lostFollowers];
                for (const pool of tPools) {
                    if (!Array.isArray(pool)) continue;
                    for (const item of pool) {
                        if (consider(item)) return bestMatch;
                    }
                }
            }
        }

        return bestMatch;
    },

    resetAll: (userId = null) => {
        const id = userId || Storage.getCurrentUserId();
        ACCOUNT_SCOPED_KEYS.forEach((k) => {
            if (id) {
                GM_deleteValue(`${k}_${id}`);
            }
            const legacyVal = GM_getValue(k, undefined);
            if (legacyVal !== undefined && legacyVal !== null) {
                const legacyOwner = (legacyVal && typeof legacyVal === 'object' && !Array.isArray(legacyVal) && legacyVal.ownerUserId)
                    ? String(legacyVal.ownerUserId)
                    : null;
                if (!legacyOwner || !id || legacyOwner === String(id)) {
                    GM_deleteValue(k);
                }
            }
        });
    }
};