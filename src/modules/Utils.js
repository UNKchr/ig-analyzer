import { CONFIG } from './Config.js';

export const Utils =  {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => (new Date()).toISOString(),
    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),

    escapeHtml: (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    sanitizeUrl: (username, customUrl) => {
        if (customUrl) {
            try {
                const parsed = new URL(customUrl, window.location.origin);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    return Utils.escapeHtml(parsed.href);
                }
            } catch (e) {
                Utils.logError('Error parsing custom URL', e);
            }
        }
        const safeUser = encodeURIComponent(username || '');
        return `https://www.instagram.com/${safeUser}/`;
    },

    getUserId: () => {
        
        const matchCookie = document.cookie.match(/ds_user_id=([^;]+)/);
        if (matchCookie && matchCookie[1]) {
            return matchCookie[1];
        }

        
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            
            if (win._sharedData?.config?.viewerId) {
                return String(win._sharedData.config.viewerId);
            }
            if (win.__initialData?.pending?.viewer?.id) {
                return String(win.__initialData.pending.viewer.id);
            }
            if (win._sharedData?.rawProfileUser?.id) {
                return String(win._sharedData.rawProfileUser.id);
            }
        } catch (e) {
            
        }

        
        try {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const text = script.textContent || '';
                const viewerMatch = text.match(/"viewerId":"(\d+)"/) || 
                                    text.match(/"actorID":"(\d+)"/) || 
                                    text.match(/"ds_user_id":"(\d+)"/) ||
                                    text.match(/"USER_ID":"(\d+)"/);
                if (viewerMatch && viewerMatch[1]) {
                    return viewerMatch[1];
                }
            }
        } catch (e) {
        }

        try {
            const metaTag = document.querySelector('meta[property="instapp:owner_user_id"]');
            if (metaTag && metaTag.content) {
                return metaTag.content;
            }
        } catch (e) {
        }

        return null;
    },
    diff: (a, b) => {
        const setB = new Set(b);
        return a.filter(x => !setB.has(x));
    },
    intersection: (a, b) => {
        const setB = new Set(b);
        return a.filter(x => setB.has(x));
    },
    unique: (arr) => [...new Set(arr)],

    toDetailedUserArray: (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
        .map((u) => {
            if (typeof u === "string") return {  id: null, username: u };
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
        const bIDs = new Set((b || []).map((x) => x?.id).filter(Boolean));
        return (a || []).filter((x) => x?.id && bIDs.has(x.id));
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