import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';


export const Storage = {
    load: () => {
        try {
            const snap = GM_getValue(CONFIG.STORAGE_KEY, null);
            return snap && Array.isArray(snap.followers) ? snap : null;
        } catch (e) {
            Utils.logError("Error loading snapshot", e);
            return null;
        }
    },
    save: (data) => GM_setValue(CONFIG.STORAGE_KEY, data),
    getWhitelist: () => GM_getValue(CONFIG.WHITELIST_KEY, []),
    addToWhitelist: (username) => {
        const wl = Storage.getWhitelist();
        if (!wl.includes(username)) {
            wl.push(username);
            GM_setValue(CONFIG.WHITELIST_KEY, wl);
        }
    },
    getHistory: () => GM_getValue(CONFIG.HISTORY_KEY, []),
    addHistoryEntry: (followersCount, followingCount) => {
        const hist = Storage.getHistory();
        const dateStr = Utils.now().split("T")[0];
        const existingIdx = hist.findIndex((h) => h.date === dateStr);
        if (existingIdx > -1) {
            hist[existingIdx] = { date: dateStr, followers: followersCount, following: followingCount };
        } else {
            hist.push({ date: dateStr, followers: followersCount, following: followingCount });
        }
        GM_setValue(CONFIG.HISTORY_KEY, hist);
    },
    getNominalList: (key) => GM_getValue(key, []),
    addNominalEntries: (key, usernames) => {
        if (!usernames || usernames.length === 0) return;
        const list = Storage.getNominalList(key);
        const dateStr = Utils.now().split("T")[0];
        usernames.forEach((u) => {
            if (!list.find((x) => x.username === u)) {
                list.push({ username: u, date: dateStr });
            }
        });
        GM_setValue(key, list);
    },
    resetAll: () => {
        GM_deleteValue(CONFIG.STORAGE_KEY);
        GM_deleteValue(CONFIG.WHITELIST_KEY);
        GM_deleteValue(CONFIG.HISTORY_KEY);
        GM_deleteValue(CONFIG.CHURN_KEY);
        GM_deleteValue(CONFIG.DEACTIVATED_KEY);
    }
};