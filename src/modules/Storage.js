import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';


let currentUserId = null;

export const Storage = {
    setCurrentUserId: (id) => {
        if (id && String(id) !== "0") {
            currentUserId = String(id);
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

    getKey: (baseKey, userId = null) => {
        const id = userId || Storage.getCurrentUserId();
        return id ? `${baseKey}_${id}` : baseKey;
    },

    getScopedValue: (baseKey, defaultValue = null, userId = null) => {
        const id = userId || Storage.getCurrentUserId();
        if (id) {
            const scopedKey = `${baseKey}_${id}`;
            const val = GM_getValue(scopedKey, undefined);
            if (val !== undefined && val !== null) {
                return val;
            }
            // Transparent backward migration: if legacy unscoped key exists, migrate it
            const legacyVal = GM_getValue(baseKey, undefined);
            if (legacyVal !== undefined && legacyVal !== null) {
                try {
                    GM_setValue(scopedKey, legacyVal);
                    Utils.log(`[Storage] Migrated legacy data for "${baseKey}" to account key "${scopedKey}".`);
                } catch (e) {
                    Utils.logError("Error migrating legacy storage key", e);
                }
                return legacyVal;
            }
        }
        return GM_getValue(baseKey, defaultValue);
    },

    setScopedValue: (baseKey, value, userId = null) => {
        const id = userId || Storage.getCurrentUserId();
        const key = id ? `${baseKey}_${id}` : baseKey;
        GM_setValue(key, value);
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
        Storage.setScopedValue(CONFIG.STORAGE_KEY, data, userId);
    },

    getWhitelist: (userId = null) => {
        return Storage.getScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },

    addToWhitelist: (username, userId = null) => {
        const wl = Storage.getWhitelist(userId);
        if (!wl.includes(username)) {
            wl.push(username);
            Storage.setScopedValue(CONFIG.WHITELIST_KEY, wl, userId);
        }
    },

    removeFromWhitelist: (username, userId = null) => {
        const wl = Storage.getWhitelist(userId);
        const filtered = wl.filter((u) => u !== username);
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, filtered, userId);
    },

    clearWhitelist: (userId = null) => {
        Storage.setScopedValue(CONFIG.WHITELIST_KEY, [], userId);
    },

    getNewFollowersList: (userId = null) => {
        return Storage.getScopedValue(CONFIG.NEW_FOLLOWERS_KEY, [], userId);
    },

    addNewFollowersEntries: (entries, userId = null) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const list = Storage.getNewFollowersList(userId);
        const dateStr = Utils.now().split("T")[0];

        entries.forEach((item) => {
            const username = typeof item === 'string' ? item : item.username;
            if (!username) return;

            const existingIdx = list.findIndex((x) => x.username === username);
            const entryObj = {
                id: item.id || null,
                username: username,
                fullName: item.fullName || '',
                profilePicUrl: item.profilePicUrl || '',
                isVerified: Boolean(item.isVerified),
                isPrivate: Boolean(item.isPrivate),
                isBestie: Boolean(item.isBestie),
                followsBack: item.followsBack !== undefined ? item.followsBack : null,
                date: dateStr
            };

            if (existingIdx > -1) {
                list[existingIdx] = { ...list[existingIdx], ...entryObj };
            } else {
                list.push(entryObj);
            }
        });

        Storage.setScopedValue(CONFIG.NEW_FOLLOWERS_KEY, list, userId);
    },

    getHistory: (userId = null) => {
        return Storage.getScopedValue(CONFIG.HISTORY_KEY, [], userId);
    },

    addHistoryEntry: (followersCount, followingCount, userId = null) => {
        const hist = Storage.getHistory(userId);
        const dateStr = Utils.now().split("T")[0];
        const existingIdx = hist.findIndex((h) => h.date === dateStr);
        if (existingIdx > -1) {
            hist[existingIdx] = { date: dateStr, followers: followersCount, following: followingCount };
        } else {
            hist.push({ date: dateStr, followers: followersCount, following: followingCount });
        }
        Storage.setScopedValue(CONFIG.HISTORY_KEY, hist, userId);
    },

    getNominalList: (key, userId = null) => {
        return Storage.getScopedValue(key, [], userId);
    },

    addNominalEntries: (key, usernames, userId = null) => {
        if (!usernames || usernames.length === 0) return;
        const list = Storage.getNominalList(key, userId);
        const dateStr = Utils.now().split("T")[0];
        usernames.forEach((u) => {
            if (!list.find((x) => x.username === u)) {
                list.push({ username: u, date: dateStr });
            }
        });
        Storage.setScopedValue(key, list, userId);
    },

    addRenamedEntries: (entries, userId = null) => {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const list = Storage.getNominalList(CONFIG.RENAMED_KEY, userId);
        const dateStr = Utils.now().split("T")[0];

        entries.forEach((entry) => {
            if (!entry?.id || !entry?.oldUsername || !entry?.newUsername) return;

            const exists = list.find((x) => x.id === entry.id && x.newUsername === entry.newUsername);

            if (!exists) {
                list.push({
                    id: entry.id,
                    username: entry.newUsername,
                    oldUsername: entry.oldUsername,
                    newUsername: entry.newUsername,
                    date: dateStr
                });
            }
        });

        Storage.setScopedValue(CONFIG.RENAMED_KEY, list, userId);
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
                }
            });
            if (modified) {
                Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
            }
        }

        return map;
    },

    getTargetData: (username, userId = null) => {
        const clean = String(username || '').replace(/^@+\s*/, '').toLowerCase().trim();
        const map = Storage.getTargetTrackerMap(userId);
        return map[clean] || null;
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
        map[clean] = {
            ...data,
            username: clean,
            updatedAt: Utils.now()
        };
        Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
    },

    removeTargetData: (username, userId = null) => {
        const clean = String(username || '').replace(/^@+\s*/, '').toLowerCase().trim();
        const map = Storage.getTargetTrackerMap(userId);
        if (map[clean]) {
            delete map[clean];
            Storage.setScopedValue(CONFIG.TARGET_TRACKER_KEY, map, userId);
        }
    },

    resetAll: (userId = null) => {
        const keys = [
            CONFIG.STORAGE_KEY,
            CONFIG.WHITELIST_KEY,
            CONFIG.HISTORY_KEY,
            CONFIG.CHURN_KEY,
            CONFIG.DEACTIVATED_KEY,
            CONFIG.BLOCKED_KEY,
            CONFIG.RENAMED_KEY,
            CONFIG.NEW_FOLLOWERS_KEY,
            CONFIG.TARGET_TRACKER_KEY,
            CONFIG.STORY_OBS_KEY
        ];

        keys.forEach((k) => {
            const id = userId || Storage.getCurrentUserId();
            if (id) {
                GM_deleteValue(`${k}_${id}`);
            }
            GM_deleteValue(k);
        });
    }
};