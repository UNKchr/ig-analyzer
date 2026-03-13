import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { UI } from './UI.js';

export const API = {
    fetchWithRetry: async (url, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, { credentials: "include" });
                if (res.ok) return await res.json();
                if (res.status === 429) {
                    UI.log("Request limit (429). Retrying in " + backoff / 1e3 + "s... (Attempt " + (i + 1) + "/" + retries + ")");
                    await Utils.sleep(backoff);
                    backoff *= 2;
                } else {
                    throw new Error("HTTP " + res.status);
                }
            } catch (e) {
                if (i === retries - 1) throw e;
            }
        }
        throw new Error("Maximum retries achieved.");
    },
    
    getAllUsers: async (userId, hash, label) => {
        const users = [];
        let cursor = null;
        let hasNext = true;
        let totalCount = 0;
        
        while (hasNext) {
            const vars = encodeURIComponent(JSON.stringify({ id: userId, first: CONFIG.PAGE_SIZE, after: cursor }));
            const url = "https://www.instagram.com/graphql/query/?query_hash=" + hash + "&variables=" + vars;
            
            const json = await API.fetchWithRetry(url);
            const userNode = json?.data?.user;
            const edge = userNode?.edge_follow || userNode?.edge_followed_by;
            
            if (!edge || !Array.isArray(edge.edges)) throw new Error("Unexpected GraphQL structure. The API may have changed.");
            
            if (totalCount === 0 && edge.count) totalCount = edge.count;
            
            edge.edges.forEach((e) => {
                if (e?.node?.username) users.push(e.node.username);
            });
            
            hasNext = edge.page_info?.has_next_page === true;
            cursor = edge.page_info?.end_cursor || null;
            
            UI.setProgress(users.length, totalCount, "Extracting " + label + "...");
            
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500);
        }
        
        UI.log("Total " + label + ": " + users.length);
        return users;
    },

    checkBlockStatus: async (username) => {
        try {
            
            const res = await fetch(`https://www.instagram.com/${username}/`, { credentials: "omit" });
            if (res.status === 404) {
                return 'Deactivated';
            }
            return 'Blocked';
        } catch (e) {
            console.error(`Error checking status for ${username}:`, e);
            return 'Deactivated';
        }
    }
};