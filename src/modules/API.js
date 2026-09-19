import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { UI } from './UI.js';

export const API = {
    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
        if (typeof options === "number") {
            retries = options;
            options = {};
        }

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        const csrf = Utils.getCsrfToken();
        const defaultHeaders = {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
            "Accept": "*/*",
            ...(csrf ? { "X-CSRFToken": csrf } : {})
        };

        const fetchOptions = {
            credentials: "include",
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        let rateLimitCount = 0;
        const maxRateLimitRetries = 2; // Strict safety limit for 429

        for (let i = 0; i < retries; i++) {
            if (options.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }
            try {
                const res = await fetch(url, fetchOptions);
                if (res.ok) return await res.json();

                if (res.status === 429) {
                    rateLimitCount++;
                    const retryAfterHeader = res.headers ? res.headers.get("Retry-After") : null;
                    const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
                    const waitMs = (retrySeconds && !isNaN(retrySeconds) && retrySeconds > 0) 
                        ? retrySeconds * 1000 
                        : (CONFIG.COOLDOWN_429_MS || 60000);

                    if (rateLimitCount >= maxRateLimitRetries) {
                        UI.log(`[Rate Limit] HTTP 429 persistent. Aborting to safeguard your account.`);
                        throw new Error("Instagram rate limit (429) persistent. Please wait at least 30-60 minutes before retrying.");
                    }

                    UI.setStatus(`Rate limit (429). Cooling down ${Math.round(waitMs / 1000)}s...`);
                    UI.log(`[Safety Cooldown] HTTP 429 detected. Pausing for ${Math.round(waitMs / 1000)}s before retry ${rateLimitCount}/${maxRateLimitRetries}...`);
                    await Utils.sleep(waitMs, options.signal);
                    continue;
                } else {
                    throw new Error("HTTP " + res.status + " while requesting " + url);
                }
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) {
                    throw e;
                }
                if (e.message && e.message.includes("rate limit (429) persistent")) {
                    throw e;
                }
                if (i === retries - 1) throw e;
                // Add delay + jitter on catch before retrying to prevent hammering server on network error
                await Utils.sleep(1500 * (i + 1) + Math.random() * 500, options.signal);
            }
        }
        throw new Error("Maximum retries achieved.");
    },

    getAllUsersViaGraphQL: async (userId, hash, label, options = {}) => {
        const users = [];
        let cursor = null;
        let hasNext = true;
        let totalCount = 0;
        
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
            
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500, options.signal);
        }
        
        return users;
    },

    getAllUsersViaFriendships: async (userId, label, options = {}) => {
        const users = [];
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
            if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800, options.signal);
        }

        return users;
    },
    
    getAllUsers: async (userId, hash, label, options = {}) => {
        let users = [];
        let friendshipsSuccess = false;

        // Primary method: Instagram's official modern friendships REST API
        try {
            users = await API.getAllUsersViaFriendships(userId, label, options);
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
                users = await API.getAllUsersViaGraphQL(userId, hash, label, options);
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) throw e;
                Utils.logError(`GraphQL fallback failed for ${label}`, e);
            }
        }
        
        const withIdCount = users.filter((u) => !!u.id).length;
        UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");

        return users;
    },

    checkAccountStatus: async (username, options = {}) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) return 'Active';

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        try {
            // 1. Check Authenticated Profile HTML directly (immune to API rate limits)
            let authIsErrorPage = false;
            let authProfileFound = false;
            let authStatus = 0;

            try {
                const authHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
                    credentials: "include",
                    signal: options.signal
                });

                authStatus = authHtmlRes.status;

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
                if (err.name === 'AbortError' || options.signal?.aborted) throw err;
                console.warn(`[IG Analyzer] Error in auth HTML for ${cleanUser}:`, err);
            }

            // If the authenticated request was NOT explicitly a 404 or error page, default to Active!
            if (!authIsErrorPage && authStatus !== 404) {
                return 'Active';
            }

            // 2. Authenticated session explicitly received 404 / Error Page.
            // Check Anonymous (Guest) view to distinguish Blocked vs Deactivated.
            await Utils.sleep(800, options.signal);

            try {
                const anonRes = await fetch(`https://www.instagram.com/${cleanUser}/`, {
                    credentials: "omit",
                    signal: options.signal
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
                if (err.name === 'AbortError' || options.signal?.aborted) throw err;
                console.warn(`[IG Analyzer] Error in anon check for ${cleanUser}:`, err);
                return 'Active';
            }

        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            console.error(`Error verifying account status for "${username}". Defaulting to Active.`, e);
            return 'Active';
        }
    },

    checkStoryStatus: async (username, options = {}) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) return null;

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        try {
            // 1. Authenticated HTML (Canvas + SSR Embedded JSON)
            let authHtml = "";
            let authHasStoryCanvas = false;
            let authHasHighlightsCanvas = false;
            let authHighlightsCount = 0;
            let authHasStory = false;
            let isPrivate = false;
            let authHtmlSuccess = false;

            try {
                const authHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, { 
                    credentials: "include",
                    signal: options.signal
                });

                if (authHtmlRes.ok) {
                    authHtml = await authHtmlRes.text();
                    authHtmlSuccess = true;

                    authHasStoryCanvas = authHtml.includes('height="115" width="115"') || 
                                         authHtml.includes('x1upo8f9 xpdipgo x87ps6o');
                    authHasHighlightsCanvas = authHtml.includes('height="84" width="84"') || 
                                              authHtml.includes('height: 67px') || 
                                              authHtml.includes('left: -5.5px');

                    // Support both unescaped and escaped JSON in script tags
                    const authHighlightMatch = authHtml.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/);
                    if (authHighlightMatch) {
                        authHighlightsCount = parseInt(authHighlightMatch[1], 10);
                    }
                    const authStoryMatch = authHtml.match(/\\?"latest_reel_media\\?"\s*:\s*([1-9][0-9]*)/);
                    if (authStoryMatch) {
                        authHasStory = true;
                    }
                    if (authHtml.includes('"is_private":true') || authHtml.includes('\\"is_private\\":true') || /\\?"is_private\\?"\s*:\s*true/.test(authHtml)) {
                        isPrivate = true;
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError' || options.signal?.aborted) throw err;
                console.warn("[IG Analyzer] Error fetching auth profile HTML:", err);
            }

            if (!authHtmlSuccess) {
                return null;
            }

            if (authHasStoryCanvas) authHasStory = true;
            if (authHasHighlightsCanvas && authHighlightsCount === 0) authHighlightsCount = 1;

            let anonHighlightsCount = 0;
            let anonHasStory = false;
            let anonHasHighlightsCanvas = false;

            // 2. For public accounts, perform Anonymous Guest Check via Public HTML
            if (!isPrivate) {
                await Utils.sleep(300, options.signal);
                try {
                    const anonHtmlRes = await fetch(`https://www.instagram.com/${cleanUser}/`, { 
                        credentials: "omit",
                        signal: options.signal
                    });
                    if (anonHtmlRes.ok) {
                        const anonHtml = await anonHtmlRes.text();

                        anonHasStory = anonHtml.includes('height="115" width="115"') || 
                                       anonHtml.includes('x1upo8f9 xpdipgo x87ps6o');
                        anonHasHighlightsCanvas = anonHtml.includes('height="84" width="84"') || 
                                                  anonHtml.includes('height: 67px') || 
                                                  anonHtml.includes('left: -5.5px');

                        const anonHighlightMatch = anonHtml.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/);
                        if (anonHighlightMatch) {
                            anonHighlightsCount = parseInt(anonHighlightMatch[1], 10);
                        }
                        const anonStoryMatch = anonHtml.match(/\\?"latest_reel_media\\?"\s*:\s*([1-9][0-9]*)/);
                        if (anonStoryMatch) {
                            anonHasStory = true;
                        }
                    }
                } catch (e) {
                    if (e.name === 'AbortError' || options.signal?.aborted) throw e;
                    console.warn("[IG Analyzer] Anon HTML fetch failed for", cleanUser, e);
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
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            console.error(`Error checking story status for "${username}"`, e);
            return null;
        }
    }
};