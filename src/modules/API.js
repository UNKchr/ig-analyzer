import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { UI } from './UI.js';

export const API = {
    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
        if (typeof options === "number") {
            retries = options;
            options = {};
        }

        const defaultHeaders = {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "*/*"
        };

        const fetchOptions = {
            credentials: "include",
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, fetchOptions);
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

    getAllUsersViaGraphQL: async (userId, hash, label) => {
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
            
            if (!edge || !Array.isArray(edge.edges)) {
                console.warn(`[IG Analyzer] Unexpected GraphQL structure for ${label}:`, json);
                return [];
            }
            
            if (totalCount === 0 && edge.count) totalCount = edge.count;
            
            edge.edges.forEach((e) => {
                const node = e?.node;
                const username = node?.username;

                if (!username) return;

                users.push({
                    id: node?.id ? String(node.id) : null,
                    username: String(username)
                });
            });
            
            hasNext = edge.page_info?.has_next_page === true;
            cursor = edge.page_info?.end_cursor || null;
            
            if (totalCount > 0) {
                UI.setProgress(users.length, totalCount, "Extracting " + label + " (GraphQL)...");
            }
            
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500);
        }
        
        return users;
    },

    getAllUsersViaFriendships: async (userId, label) => {
        const users = [];
        let maxId = null;
        let hasNext = true;
        const endpoint = label === "following" ? "following" : "followers";

        while (hasNext) {
            let url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpoint}/?count=50&search_surface=follow_list_page`;
            if (maxId) {
                url += `&max_id=${encodeURIComponent(maxId)}`;
            }

            const json = await API.fetchWithRetry(url);
            const list = json?.users;

            if (!Array.isArray(list)) {
                console.warn(`[IG Analyzer] Friendships API returned non-array for ${label}:`, json);
                break;
            }

            list.forEach((u) => {
                const username = u?.username;
                if (!username) return;
                users.push({
                    id: u?.pk ? String(u.pk) : (u?.id ? String(u.id) : null),
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

            UI.setProgress(users.length, 0, `Extracting ${label}... (${users.length})`);
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800);
        }

        return users;
    },
    
    getAllUsers: async (userId, hash, label) => {
        let users = [];

        // Primary method: Instagram's official modern friendships REST API
        try {
            users = await API.getAllUsersViaFriendships(userId, label);
        } catch (e) {
            console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e);
            users = [];
        }

        // Secondary fallback: Legacy GraphQL query_hash (in case friendships is blocked)
        if (users.length === 0 && hash) {
            UI.log(`Friendships returned 0 for '${label}'. Falling back to legacy GraphQL...`);
            try {
                users = await API.getAllUsersViaGraphQL(userId, hash, label);
            } catch (e) {
                Utils.logError(`GraphQL fallback failed for ${label}`, e);
            }
        }
        
        const withIdCount = users.filter((u) => !!u.id).length;
        UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");

        return users;
    },

    checkAccountStatus: async (username) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) return 'Active';

        try {
            // 1. Check Authenticated Web Profile Info API
            let authStatus = 0;

            try {
                const authRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`, {
                    headers: {
                        "X-IG-App-ID": "936619743392459",
                        "X-Requested-With": "XMLHttpRequest",
                        "Accept": "*/*"
                    },
                    credentials: "include"
                });

                authStatus = authRes.status;

                if (authRes.ok) {
                    const json = await authRes.json();
                    const authData = json?.data?.user;
                    if (authData?.username) {
                        return 'Active'; // Definitely active and not blocked!
                    }
                } else if (authStatus === 429) {
                    console.warn(`[IG Analyzer] Rate limit (429) checking account status for ${cleanUser}. Defaulting to Active.`);
                    return 'Active'; // Rate limited, never assume blocked!
                }
            } catch (err) {
                console.warn(`[IG Analyzer] Error in auth web_profile_info for ${cleanUser}:`, err);
            }

            // 2. Fallback: Check Authenticated Profile HTML
            let authIsErrorPage = false;
            let authProfileFound = false;

            try {
                const authHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
                    credentials: "include"
                });

                if (authHtmlRes.status === 429) {
                    return 'Active';
                }

                if (authHtmlRes.ok) {
                    const authHtml = await authHtmlRes.text();
                    authIsErrorPage = authHtml.includes("Sorry, this page isn't available.") || 
                                      authHtml.includes("Esta página no está disponible.") || 
                                      authHtml.includes("page_not_found");

                    authProfileFound = authHtml.includes(`"username":"${cleanUser}"`) || 
                                       authHtml.includes(`/${cleanUser}/`) ||
                                       authHtml.includes('"is_private":');

                    // If authenticated HTML is not an error page and profile content exists, they did NOT block you!
                    if (authProfileFound && !authIsErrorPage) {
                        return 'Active';
                    }
                } else if (authHtmlRes.status === 404) {
                    authIsErrorPage = true;
                }
            } catch (err) {
                console.warn(`[IG Analyzer] Error in auth HTML for ${cleanUser}:`, err);
            }

            // If the authenticated request was NOT explicitly a 404 or error page, default to Active!
            if (!authIsErrorPage && authStatus !== 404) {
                return 'Active';
            }

            // 3. Authenticated session explicitly received 404 / Error Page.
            // Check Anonymous (Guest) view to distinguish Blocked vs Deactivated.
            await Utils.sleep(800);

            try {
                const anonRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
                    credentials: "omit"
                });

                if (anonRes.status === 429) {
                    return 'Active';
                }

                const anonHtml = await anonRes.text();

                const anonIsErrorPage = anonRes.status === 404 ||
                                        anonHtml.includes("page_not_found") || 
                                        anonHtml.includes("Sorry, this page isn't available.") || 
                                        anonHtml.includes("Esta página no está disponible.");

                const loginRedirectPath = `login/?next=%2F${cleanUser}%2F`;
                const anonExistsPublicly = anonHtml.includes(loginRedirectPath) || 
                                           anonHtml.includes(`"username":"${cleanUser}"`) ||
                                           anonHtml.includes(`/${cleanUser}/`);

                // A user has BLOCKED you ONLY IF:
                // They are inaccessible to your authenticated session (404 / error page),
                // BUT they are accessible publicly / anonymously and NOT an error page.
                if (anonExistsPublicly && !anonIsErrorPage) {
                    return 'Blocked';
                } else {
                    return 'Deactivated';
                }
            } catch (err) {
                console.warn(`[IG Analyzer] Error in anon check for ${cleanUser}:`, err);
                return 'Active';
            }

        } catch (e) {
            console.error(`Error verifying account status for "${username}". Defaulting to Active.`, e);
            return 'Active';
        }
    },

    checkStoryStatus: async (username) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) return null;

        try {
            // 1. Authenticated HTML (Canvas + SSR State)
            let authHtml = "";
            let authHasStoryCanvas = false;
            let authHasHighlightsCanvas = false;
            let authHighlightsCount = 0;
            let authHasStory = false;
            let isPrivate = false;

            try {
                const authHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, { credentials: "include" });
                if (authHtmlRes.ok) {
                    authHtml = await authHtmlRes.text();
                    authHasStoryCanvas = authHtml.includes('height="115" width="115"') || 
                                         authHtml.includes('x1upo8f9 xpdipgo x87ps6o');
                    authHasHighlightsCanvas = authHtml.includes('height="84" width="84"') || 
                                              authHtml.includes('height: 67px') || 
                                              authHtml.includes('left: -5.5px');

                    const authHighlightMatch = authHtml.match(/"highlight_reel_count"\s*:\s*([0-9]+)/);
                    if (authHighlightMatch) {
                        authHighlightsCount = parseInt(authHighlightMatch[1], 10);
                    }
                    const authStoryMatch = authHtml.match(/"latest_reel_media"\s*:\s*([1-9][0-9]*)/);
                    if (authStoryMatch) {
                        authHasStory = true;
                    }
                    if (authHtml.includes('"is_private":true')) {
                        isPrivate = true;
                    }
                }
            } catch (err) {
                console.warn("[IG Analyzer] Error fetching auth profile HTML:", err);
            }

            // 2. Authenticated REST API (Web Profile Info)
            try {
                const authRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`, {
                    headers: {
                        "X-IG-App-ID": "936619743392459",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    credentials: "include"
                });
                
                if (authRes.ok) {
                    const json = await authRes.json();
                    const authData = json?.data?.user;
                    if (authData) {
                        if (typeof authData.is_private === 'boolean') {
                            isPrivate = authData.is_private;
                        }
                        if (typeof authData.highlight_reel_count === 'number') {
                            authHighlightsCount = Math.max(authHighlightsCount, authData.highlight_reel_count);
                        }
                        if (authData.latest_reel_media && authData.latest_reel_media > 0) {
                            authHasStory = true;
                        }
                    }
                }
            } catch (err) {
                console.warn("[IG Analyzer] Error fetching auth web_profile_info:", err);
            }

            if (authHasStoryCanvas) authHasStory = true;
            if (authHasHighlightsCanvas && authHighlightsCount === 0) authHighlightsCount = 1;

            let anonHighlightsCount = 0;
            let anonHasStory = false;
            let anonHasHighlightsCanvas = false;

            // 3. For public accounts, perform Anonymous Guest Check
            if (!isPrivate) {
                try {
                    const anonHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, { credentials: "omit" });
                    if (anonHtmlRes.ok) {
                        const anonHtml = await anonHtmlRes.text();

                        anonHasStory = anonHtml.includes('height="115" width="115"') || 
                                       anonHtml.includes('x1upo8f9 xpdipgo x87ps6o');
                        anonHasHighlightsCanvas = anonHtml.includes('height="84" width="84"') || 
                                                  anonHtml.includes('height: 67px') || 
                                                  anonHtml.includes('left: -5.5px');

                        const anonHighlightMatch = anonHtml.match(/"highlight_reel_count"\s*:\s*([0-9]+)/);
                        if (anonHighlightMatch) {
                            anonHighlightsCount = parseInt(anonHighlightMatch[1], 10);
                        }
                        const anonStoryMatch = anonHtml.match(/"latest_reel_media"\s*:\s*([1-9][0-9]*)/);
                        if (anonStoryMatch) {
                            anonHasStory = true;
                        }
                    }
                } catch (e) {
                    console.warn("[IG Analyzer] Anon HTML fetch failed for", cleanUser, e);
                }

                // Also try Anonymous REST API
                try {
                    const anonRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`, {
                        headers: {
                            "X-IG-App-ID": "936619743392459",
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        credentials: "omit"
                    });
                    
                    if (anonRes.ok) {
                        const anonJson = await anonRes.json();
                        const anonData = anonJson?.data?.user;
                        if (anonData) {
                            if (typeof anonData.highlight_reel_count === 'number') {
                                anonHighlightsCount = Math.max(anonHighlightsCount, anonData.highlight_reel_count);
                            }
                            if (anonData.latest_reel_media && anonData.latest_reel_media > 0) {
                                anonHasStory = true;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("[IG Analyzer] Anon API fetch failed for", cleanUser, e);
                }

                if (anonHasHighlightsCanvas && anonHighlightsCount === 0) {
                    anonHighlightsCount = 1;
                }
            }

            return {
                username: cleanUser,
                isPrivate,
                authHighlightsCount,
                anonHighlightsCount,
                anonHasStory,
                authHasStory
            };

        } catch (e) {
            console.error(`Error checking story status for "${username}"`, e);
            return null;
        }
    }
};