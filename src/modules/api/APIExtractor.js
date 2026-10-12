import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

Object.assign(API, {
    getAllUsersViaGraphQL: async (userId, hash, label, options = {}, expectedTotal = 0) => {
        const users = [];
        const seenIds = new Set();
        let cursor = null;
        let hasNext = true;
        let totalCount = expectedTotal || 0;
        
        while (hasNext) {
            if (options.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            const vars = encodeURIComponent(JSON.stringify({ id: userId, first: CONFIG.PAGE_SIZE, after: cursor }));
            const url = "https://www.instagram.com/graphql/query/?query_hash=" + hash + "&variables=" + vars;
            
            const json = await API.fetchWithRetry(url, options);
            const userNode = json?.data?.user;
            const edge = userNode?.edge_follow || userNode?.edge_followed_by;
            
            if (!edge || !Array.isArray(edge.edges)) {
                console.warn(`[IG Analyzer] Unexpected GraphQL structure for ${label}:`, json);
                return [];
            }
            
            if (totalCount === 0 && edge.count) totalCount = edge.count;
            
            edge.edges.forEach((e) => {
                const node = e?.node;
                const username = node?.username;
                const id = node?.id ? String(node.id) : null;

                if (!username || !id) return;
                if (seenIds.has(id)) return;
                seenIds.add(id);

                users.push({
                    id: id,
                    username: String(username)
                });
            });
            
            hasNext = edge.page_info?.has_next_page === true;
            cursor = edge.page_info?.end_cursor || null;
            
            const total = totalCount > 0 ? totalCount : 0;
            const progressLabel = total > 0 
                ? `Extracting ${label}... (${users.length}/${total})`
                : `Extracting ${label}... (${users.length})`;

            UI.setProgress(users.length, total, progressLabel);
            
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500, options.signal);
        }

        if (users.length > 0) {
            UI.setProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
        }
        
        return users;
    },

    getAllUsersViaFriendships: async (userId, label, options = {}, expectedTotal = 0) => {
        const users = [];
        const seenIds = new Set();
        let maxId = null;
        let hasNext = true;
        const endpoint = label === "following" ? "following" : "followers";

        while (hasNext) {
            if (options.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            let url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpoint}/?count=50&search_surface=follow_list_page`;
            if (maxId) {
                url += `&max_id=${encodeURIComponent(maxId)}`;
            }

            const json = await API.fetchWithRetry(url, options);
            const list = json?.users;

            if (!Array.isArray(list)) {
                console.warn(`[IG Analyzer] Friendships API returned non-array for ${label}:`, json);
                break;
            }

            list.forEach((u) => {
                const username = u?.username;
                const id = u?.pk ? String(u.pk) : (u?.id ? String(u.id) : null);
                if (!username || !id) return;
                
                if (seenIds.has(id)) return;
                seenIds.add(id);

                users.push({
                    id: id,
                    username: String(username),
                    fullName: u?.full_name || "",
                    isPrivate: Boolean(u?.is_private),
                    isVerified: Boolean(u?.is_verified),
                    profilePicUrl: u?.profile_pic_url || null,
                    latestReelMedia: u?.latest_reel_media || 0
                });
            });

            maxId = json?.next_max_id || null;
            hasNext = Boolean(maxId);

            const total = expectedTotal > 0 ? expectedTotal : 0;
            const progressLabel = total > 0 
                ? `Extracting ${label}... (${users.length}/${total})`
                : `Extracting ${label}... (${users.length})`;

            UI.setProgress(users.length, total, progressLabel);
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800, options.signal);
        }

        if (users.length > 0) {
            UI.setProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
        }

        return users;
    },
    
    getAllUsers: async (userId, hash, label, options = {}, expectedTotal = 0) => {
        let users = [];
        let friendshipsSuccess = false;

        // Primary method: Instagram's official modern friendships REST API
        try {
            users = await API.getAllUsersViaFriendships(userId, label, options, expectedTotal);
            friendshipsSuccess = true;
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e);
            users = [];
            friendshipsSuccess = false;
        }

        // Secondary fallback: Legacy GraphQL query_hash ONLY if friendships errored (not if legitimately 0 users)
        if (!friendshipsSuccess && hash) {
            if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
            UI.log(`Friendships API failed for '${label}'. Falling back to legacy GraphQL...`);
            try {
                users = await API.getAllUsersViaGraphQL(userId, hash, label, options, expectedTotal);
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) throw e;
                Utils.logError(`GraphQL fallback failed for ${label}`, e);
            }
        }
        
        const withIdCount = users.filter((u) => !!u.id).length;
        UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");

        return users;
    },

});
