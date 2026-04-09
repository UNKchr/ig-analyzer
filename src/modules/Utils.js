import { CONFIG } from './Config.js';

export const Utils = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => (new Date()).toISOString(),
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),
    getUserId: () => {
        const c = document.cookie.split("; ").find((x) => x.startsWith("ds_user_id="));
        return c ? c.split("=")[1] : null;
    },
    diff: (a, b) => {
        const setB = new Set(b);
        return a.filter((x) => !setB.has(x));
    },
    intersection: (a, b) => {
        const setB = new Set(b);
        return a.filter((x) => setB.has(x));
    },
    unique: (arr) => [...new Set(arr)],

    toDetailedUserArray: (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .map((u) => {
                if (typeof u === "string") return { id: null, username: u };
                if (u && typeof u.username === "string") {
                    return { id: u.id ? String(u.id) : null, username: String(u.username) };
                }
                return null;
            })
            .filter(Boolean);
    },

    mapById: (arr) => {
        const map = new Map();
        (arr || []).forEach((u) => {
            if (u?.id) map.set(String(u.id), u);
        });
        return map;
    },

    intersectionById: (a, b) => {
        const bIds = new Set((b || []).map((x) => x?.id).filter(Boolean));
        return (a || []).filter((x) => x?.id && bIds.has(x.id));
    },

    detectRenamedMutuals: (prevMutuals, currentMutuals) => {
        const prevById = Utils.mapById(prevMutuals);
        const currById = Utils.mapById(currentMutuals);

        const changes = [];
        prevById.forEach((prevUser, id) => {
            const currUser = currById.get(id);
            if (!currUser) return;
            if (prevUser.username !== currUser.username) {
                changes.push({ 
                    id,
                    oldUsername: prevUser.username,
                    newUsername: currUser.username,
                 });
            }
        });
        return changes;
    },

    exportCSV: (data, filename) => {
        if (!data || !data.length) return;
        const csvContent = "Username,Profile URL\n" + data.map((u) => u.username + "," + u.url).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};