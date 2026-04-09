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
                    throw new Error("HTTP " + res.status + " while requesting " + url);
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
            
            if (!edge || !Array.isArray(edge.edges)) throw new Error("Unexpected GraphQL structure while extracting " + label + ". The API shape may have changed.");
            
            if (totalCount === 0 && edge.count) totalCount = edge.count;
            
            edge.edges.forEach((e) => {
                const node = e?.node;
                const username = node?.username;

                // Fix: skip only invalid nodes without username
                if (!username) return;

                users.push({
                    id: node?.id ? String(node.id) : null,
                    username: String(username)
                });
            });
            
            hasNext = edge.page_info?.has_next_page === true;
            cursor = edge.page_info?.end_cursor || null;
            
            UI.setProgress(users.length, totalCount, "Extracting " + label + "...");
            
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500);
        }
        
        const withIdCount = users.filter((u) => !!u.id).length;
        UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");

        return users;
    },

    checkAccountStatus: async (username) => {
        try {
            
            const authRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
                headers: { "X-IG-App-ID": "936619743392459" },
                credentials: "include"
            });
            
            let authData = null;
            if (authRes.ok) {
                const json = await authRes.json();
                authData = json?.data?.user;
            }

            if (authData) {
                return 'Active'; 
            }

            const anonRes = await fetch(`https://www.instagram.com/${username}/`, { credentials: "omit" });
            const anonText = await anonRes.text();


            const loginRedirectPath = `login/?next=%2F${username}%2F`;
            
            const existsPublicly = anonText.includes(loginRedirectPath) || 
                                   anonText.includes(`"username":"${username}"`);

            const isErrorPage = anonText.includes("page_not_found") || 
                                anonText.includes("Sorry, this page isn't available.") || 
                                anonText.includes("Esta página no está disponible.");

            if (existsPublicly && !isErrorPage) {
                return 'Blocked'; 
            } else {
                return 'Deactivated'; 
            }
        } catch (e) {
            console.error(`Error verifying account status for "${username}". Defaulting to Active.`, e);
            return 'Active';
        }
    }
};