import { CONFIG } from './Config.js';
import { Utils } from './Utils.js';
import { UI } from './UI.js';
import { Storage } from './Storage.js';

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
                    if (options.silent || options.optional) {
                        throw new Error(`HTTP 429 on optional endpoint ${url}`);
                    }

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
                    const errText = await res.text().catch(() => "");
                    if (!options.silent) {
                        console.warn(`[IG Analyzer] Request to ${url} failed (HTTP ${res.status}):`, errText.slice(0, 300));
                    }
                    throw new Error(`HTTP ${res.status} while requesting ${url}: ${errText.slice(0, 100)}`);
                }
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) {
                    throw e;
                }
                if (options.silent || options.optional) {
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

    getUserInfo: async (userId, options = {}) => {
        if (!userId || userId === "0") return null;
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const opts = { ...options, optional: true, silent: true };

        // 1. Check window / unsafeWindow objects first (zero network cost)
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const rawUser = win._sharedData?.rawProfileUser || 
                            win.__initialData?.data?.user || 
                            win.__initialData?.pending?.viewer;
            if (rawUser) {
                const fCount = rawUser.edge_followed_by?.count ?? rawUser.follower_count;
                const fgCount = rawUser.edge_follow?.count ?? rawUser.following_count;
                if (typeof fCount === 'number' || typeof fgCount === 'number') {
                    return {
                        followerCount: Number(fCount || 0),
                        followingCount: Number(fgCount || 0),
                        username: rawUser.username || "",
                        fullName: rawUser.full_name || "",
                        profilePicUrl: rawUser.profile_pic_url || null
                    };
                }
            }
        } catch (e) {}

        // 2. Check DOM meta tags (zero network cost, highly reliable on profile pages)
        try {
            const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]')?.content || '';
            const match = metaDesc.match(/([0-9.,kKmM]+)\s+Followers.*?([0-9.,kKmM]+)\s+Following/i);
            if (match) {
                const parseCount = (str) => {
                    str = str.replace(/,/g, '').trim().toLowerCase();
                    if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
                    if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
                    return parseInt(str, 10) || 0;
                };
                const followerCount = parseCount(match[1]);
                const followingCount = parseCount(match[2]);
                if (followerCount > 0 || followingCount > 0) {
                    return {
                        followerCount,
                        followingCount,
                        username: Utils.getUsername() || "",
                        fullName: "",
                        profilePicUrl: null
                    };
                }
            }
        } catch (e) {}

        // 3. Official Web endpoint: /api/v1/users/web_profile_info/?username={username}
        try {
            const username = Utils.getUsername();
            if (username) {
                const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
                const json = await API.fetchWithRetry(url, opts, 1);
                const u = json?.data?.user;
                if (u) {
                    return {
                        followerCount: Number(u.edge_followed_by?.count ?? u.follower_count ?? 0),
                        followingCount: Number(u.edge_follow?.count ?? u.following_count ?? 0),
                        username: u.username || username,
                        fullName: u.full_name || "",
                        profilePicUrl: u.profile_pic_url || null
                    };
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            // Silent fail for optional metadata — progress bar will fall back to smooth indeterminate animation
        }

        return null;
    },

    getAllUsersViaGraphQL: async (userId, hash, label, options = {}, expectedTotal = 0) => {
        const users = [];
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

                if (!username) return;

                users.push({
                    id: node?.id ? String(node.id) : null,
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

    searchUserByUsername: async (username, options = {}) => {
        const cleanUser = String(username || '').replace(/^@+\s*/, '').trim().toLowerCase();
        if (!cleanUser) return null;

        const viewerId = Utils.getUserId() || "0";

        // 1. Native Instagram Web GraphQL Topsearch (PolarisSearchBoxRefetchableQuery)
        try {
            const url = "https://www.instagram.com/api/graphql";
            const dtsg = Utils.getDtsg();
            const jazoest = Utils.calculateJazoest(dtsg);
            const lsd = Utils.getLsd();

            const params = new URLSearchParams();
            params.append("av", viewerId);
            params.append("__d", "www");
            params.append("__user", "0");
            params.append("__a", "1");
            params.append("__req", "1");
            params.append("fb_api_caller_class", "RelayModern");
            params.append("fb_api_req_friendly_name", "PolarisSearchBoxRefetchableQuery");
            params.append("doc_id", "27706427925724183");
            params.append("server_timestamps", "true");

            const rankToken = `${Date.now()}|${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
            const sessionId = `${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 14)}`;

            params.append("variables", JSON.stringify({
                data: {
                    context: "blended",
                    include_reel: "true",
                    query: cleanUser,
                    rank_token: rankToken,
                    search_session_id: sessionId,
                    search_surface: "web_top_search"
                },
                hasQuery: true
            }));
            if (dtsg) params.append("fb_dtsg", dtsg);
            if (jazoest) params.append("jazoest", jazoest);
            if (lsd) params.append("lsd", lsd);

            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-FB-Friendly-Name": "PolarisSearchBoxRefetchableQuery"
            };
            if (lsd) headers["X-FB-LSD"] = lsd;

            const json = await API.fetchWithRetry(url, {
                method: "POST",
                headers,
                body: params.toString(),
                optional: true,
                silent: true,
                signal: options.signal
            }, 1);

            const connection = json?.data?.xdt_api__v1__fbsearch__topsearch_connection;
            if (connection && Array.isArray(connection.users)) {
                for (const item of connection.users) {
                    const u = item?.user;
                    if (u && (u.username || '').toLowerCase() === cleanUser) {
                        return {
                            id: String(u.pk || u.id),
                            username: u.username,
                            fullName: u.full_name || '',
                            isPrivate: Boolean(u.is_private),
                            isVerified: Boolean(u.is_verified),
                            profilePicUrl: u.hd_profile_pic_url_info?.url || u.profile_pic_url || null,
                            rawUser: u,
                            source: 'graphql_search'
                        };
                    }
                }
            }
        } catch (gqlErr) {
            if (gqlErr.name === 'AbortError' || options.signal?.aborted) throw gqlErr;
            console.warn(`[IG Analyzer] Native GraphQL topsearch failed for @${cleanUser}:`, gqlErr);
        }

        // 2. Fallback to REST topsearch endpoint
        try {
            const url = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(cleanUser)}&rank_token=0.5`;
            const json = await API.fetchWithRetry(url, {
                headers: {
                    "X-IG-App-ID": "936619743392459",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
                },
                optional: true,
                silent: true,
                signal: options.signal
            }, 1);

            const userList = json?.users || [];
            for (const item of userList) {
                const u = item?.user;
                if (u && (u.username || '').toLowerCase() === cleanUser) {
                    return {
                        id: String(u.pk || u.id),
                        username: u.username,
                        fullName: u.full_name || '',
                        isPrivate: Boolean(u.is_private),
                        isVerified: Boolean(u.is_verified),
                        profilePicUrl: u.profile_pic_url || null,
                        rawUser: u,
                        source: 'rest_search'
                    };
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            console.warn(`[IG Analyzer] REST topsearch fallback failed for @${cleanUser}:`, e);
        }

        return null;
    },

    resolveUserId: async (username, options = {}) => {
        const cleanUser = String(username || '').replace(/^@+\s*/, '').trim().toLowerCase();
        if (!cleanUser) return null;

        const viewerId = Utils.getUserId();
        const viewerName = (Utils.getUsername() || '').toLowerCase();

        // If explicitly auditing oneself, return viewer ID
        if (cleanUser === viewerName && viewerId) {
            return String(viewerId);
        }

        // 1. Check memory caches first (skip if ID matches viewer)
        for (const [id, user] of API.hdAvatarCache.entries()) {
            if ((user?.username || '').toLowerCase() === cleanUser && String(id) !== String(viewerId)) {
                return id;
            }
        }

        // 2. Check window / storage snapshots (followers and following)
        try {
            const pool = [
                ...(window.__igLastResults || []),
                ...(Storage.load()?.followers || []),
                ...(Storage.load()?.following || [])
            ];
            const match = pool.find((u) => {
                const name = typeof u === 'string' ? u : u?.username;
                return name && name.toLowerCase() === cleanUser && u?.id && String(u.id) !== String(viewerId);
            });
            if (match && match.id && String(match.id) !== "0") {
                return String(match.id);
            }
        } catch (e) {}

        // 3. Official search lookup (native GraphQL topsearch with REST fallback)
        const searched = await API.searchUserByUsername(cleanUser, options);
        if (searched && searched.id && String(searched.id) !== String(viewerId)) {
            if (searched.profilePicUrl) {
                API.hdAvatarCache.set(String(searched.id), {
                    id: String(searched.id),
                    username: searched.username,
                    fullName: searched.fullName,
                    hdUrl: searched.profilePicUrl,
                    isVerified: searched.isVerified,
                    isPrivate: searched.isPrivate,
                    isStub: true
                });
            }
            return String(searched.id);
        }

        return null;
    },

    checkStoryStatus: async (username, userId = null, options = {}) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) return null;

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        let targetId = (userId && String(userId) !== "0" && String(userId) !== "null" && String(userId) !== "undefined")
            ? String(userId).trim()
            : null;

        if (!targetId) {
            targetId = await API.resolveUserId(cleanUser, options);
        }

        if (!targetId) {
            console.warn(`[IG Analyzer] Story Spy: Could not resolve target ID for @${cleanUser}`);
            return null;
        }

        try {
            // 1. Authenticated Profile & Story State via Relay Modern GraphQL
            const profile = await API.fetchUserProfileHd(targetId, cleanUser, {
                forceRefresh: true,
                signal: options.signal
            });

            const isPrivate = profile ? Boolean(profile.isPrivate) : false;
            const latestReelMedia = profile?.latestReelMedia ?? 0;
            const latestBestiesReelMedia = profile?.latestBestiesReelMedia ?? 0;
            const isGated = profile?.latestReelMedia === null;
            const authHasStory = typeof latestReelMedia === 'number' && latestReelMedia > 0;
            const isBestieStory = typeof latestBestiesReelMedia === 'number' && latestBestiesReelMedia > 0;

            // 2. Query Highlights Tray (Authenticated)
            let authHighlights = [];
            let authHighlightsCount = 0;
            try {
                const trayJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
                    optional: true,
                    signal: options.signal
                }, 1);

                if (Array.isArray(trayJson?.tray)) {
                    authHighlights = trayJson.tray.map((item) => ({
                        id: item.id || '',
                        title: item.title || 'Untitled',
                        mediaCount: item.media_count || 0
                    }));
                    authHighlightsCount = authHighlights.length;
                }
            } catch (trayErr) {
                if (trayErr.name === 'AbortError' || options.signal?.aborted) throw trayErr;
                console.warn(`[IG Analyzer] Highlights tray query failed for @${cleanUser}:`, trayErr);
            }

            // 3. For Public Accounts: Query Anonymous / Guest Highlights Tray
            let anonHighlightsCount = 0;
            let anonHasStory = false;
            if (!isPrivate) {
                try {
                    const anonRes = await fetch(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
                        credentials: "omit",
                        headers: {
                            "X-IG-App-ID": "936619743392459",
                            "X-Requested-With": "XMLHttpRequest",
                            "Accept": "*/*"
                        },
                        signal: options.signal
                    });

                    if (anonRes.ok) {
                        const anonJson = await anonRes.json();
                        if (Array.isArray(anonJson?.tray)) {
                            anonHighlightsCount = anonJson.tray.length;
                        }
                    }
                } catch (anonErr) {
                    if (anonErr.name === 'AbortError' || options.signal?.aborted) throw anonErr;
                    // Optional guest check silent failure
                }
            }

            return {
                userId: targetId,
                username: cleanUser,
                fullName: profile?.fullName || '',
                profilePicUrl: profile?.hdUrl || null,
                isPrivate,
                isGated,
                authHighlightsCount,
                authHighlights,
                latestReelMedia,
                latestBestiesReelMedia,
                authHasStory,
                isBestieStory,
                anonHighlightsCount,
                anonHasStory,
                fetchedAt: Date.now()
            };
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            console.error(`[IG Analyzer] Error in checkStoryStatus for @${cleanUser}:`, e);
            return null;
        }
    },

    friendshipCache: new Map(),

    clearFriendshipCache: () => {
        API.friendshipCache.clear();
        API.hdAvatarCache.clear();
    },

    fetchFriendshipStatusesMany: async (userIds, options = {}) => {
        if (!Array.isArray(userIds) || userIds.length === 0) return {};

        const cleanIds = userIds
            .map((id) => (id !== null && id !== undefined ? String(id).trim() : ''))
            .filter((id) => id && id !== '0' && id !== 'null' && id !== 'undefined');

        if (cleanIds.length === 0) return {};

        const missingIds = cleanIds.filter((id) => !API.friendshipCache.has(id));

        if (missingIds.length > 0) {
            try {
                const url = "https://www.instagram.com/api/v1/friendships/show_many/";
                const dtsg = Utils.getDtsg();
                const jazoest = Utils.calculateJazoest(dtsg);

                const params = new URLSearchParams();
                params.append("user_ids", missingIds.join(","));
                if (dtsg) params.append("fb_dtsg", dtsg);
                if (jazoest) params.append("jazoest", jazoest);

                const json = await API.fetchWithRetry(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: params.toString(),
                    optional: true,
                    signal: options.signal
                }, 2);

                const statuses = json?.friendship_statuses;
                if (statuses && typeof statuses === 'object') {
                    Object.entries(statuses).forEach(([id, status]) => {
                        API.friendshipCache.set(String(id), {
                            following: Boolean(status?.following),
                            isBestie: Boolean(status?.is_bestie),
                            isPrivate: Boolean(status?.is_private),
                            isRestricted: Boolean(status?.is_restricted),
                            outgoingRequest: Boolean(status?.outgoing_request),
                            incomingRequest: Boolean(status?.incoming_request),
                            isFeedFavorite: Boolean(status?.is_feed_favorite)
                        });
                    });
                }

                // For any requested ID not returned by the API, cache a benign fallback
                missingIds.forEach((id) => {
                    if (!API.friendshipCache.has(id)) {
                        API.friendshipCache.set(id, {
                            following: false,
                            isBestie: false,
                            isPrivate: false,
                            isRestricted: false,
                            outgoingRequest: false,
                            incomingRequest: false,
                            isFeedFavorite: false
                        });
                    }
                });
            } catch (err) {
                if (err.name === 'AbortError' || options.signal?.aborted) throw err;
                console.warn("[IG Analyzer] Error fetching friendship statuses in batch:", err);
            }
        }

        const result = {};
        cleanIds.forEach((id) => {
            if (API.friendshipCache.has(id)) {
                result[id] = API.friendshipCache.get(id);
            }
        });
        return result;
    },

    hdAvatarCache: new Map(),

    clearHdAvatarCache: () => {
        API.hdAvatarCache.clear();
    },

    fetchUserProfileHd: async (userId, username, options = {}) => {
        if (!userId || String(userId) === "0") return null;
        const idStr = String(userId);
        const cleanUser = String(username || '').replace(/^@/, '').trim();

        if (!options.forceRefresh && API.hdAvatarCache.has(idStr)) {
            const cached = API.hdAvatarCache.get(idStr);
            if (cached && !cached.isStub && (cached.followerCount !== undefined && cached.followerCount !== null)) {
                return cached;
            }
        }

        try {
            const url = "https://www.instagram.com/api/graphql";
            const dtsg = Utils.getDtsg();
            const jazoest = Utils.calculateJazoest(dtsg);
            const lsd = Utils.getLsd();

            const viewerId = Utils.getUserId() || "0";
            const params = new URLSearchParams();
            params.append("av", viewerId);
            params.append("__d", "www");
            params.append("__user", "0");
            params.append("__a", "1");
            params.append("__req", "1");
            params.append("fb_api_caller_class", "RelayModern");
            params.append("fb_api_req_friendly_name", "PolarisProfilePageContentQuery");
            params.append("doc_id", "28036671149327607");
            params.append("server_timestamps", "true");
            params.append("variables", JSON.stringify({
                enable_integrity_filters: true,
                id: idStr,
                __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
                __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
                __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
                __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true,
                __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: false
            }));
            if (dtsg) params.append("fb_dtsg", dtsg);
            if (jazoest) params.append("jazoest", jazoest);
            if (lsd) params.append("lsd", lsd);

            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-FB-Friendly-Name": "PolarisProfilePageContentQuery"
            };
            if (lsd) headers["X-FB-LSD"] = lsd;

            let user = null;
            try {
                const json = await API.fetchWithRetry(url, {
                    method: "POST",
                    headers,
                    body: params.toString(),
                    optional: true,
                    signal: options.signal
                }, 1);
                user = json?.data?.user;
            } catch (graphqlErr) {
                if (graphqlErr.name === 'AbortError' || options.signal?.aborted) throw graphqlErr;
                console.warn(`[IG Analyzer] GraphQL profile fetch failed for @${cleanUser}:`, graphqlErr);
            }

            if (user) {
                const rawHdUrl = user?.hd_profile_pic_url_info?.url ||
                              user?.profile_pic_url_hd ||
                              user?.profile_pic_url ||
                              null;
                const hdUrl = Utils.sanitizeImageUrl(rawHdUrl);

                const latestReelMedia = typeof user?.latest_reel_media === 'number'
                    ? user.latest_reel_media
                    : (user?.latest_reel_media === null ? null : (user?.latest_reel_media ? Number(user.latest_reel_media) : 0));

                const latestBestiesReelMedia = typeof user?.latest_besties_reel_media === 'number'
                    ? user.latest_besties_reel_media
                    : (user?.latest_besties_reel_media ? Number(user.latest_besties_reel_media) : 0);

                const externalUrl = user?.external_url || user?.bio_links?.[0]?.url || null;
                const following = Boolean(user?.friendship_status?.following);
                const followedBy = Boolean(user?.friendship_status?.followed_by);
                const outgoingRequest = Boolean(user?.friendship_status?.outgoing_request);
                const incomingRequest = Boolean(user?.friendship_status?.incoming_request);
                const isRestricted = Boolean(user?.friendship_status?.is_restricted);
                const isBestie = Boolean(user?.friendship_status?.is_bestie);
                const mutualUsers = Array.isArray(user?.profile_context_links_with_user_ids)
                    ? user.profile_context_links_with_user_ids.map((l) => l?.username).filter(Boolean)
                    : [];
                const facepileUsers = Array.isArray(user?.profile_context_facepile_users)
                    ? user.profile_context_facepile_users.map((f) => ({
                        id: f.id,
                        profilePicUrl: Utils.sanitizeImageUrl(f.profile_pic_url)
                    }))
                    : [];

                const result = {
                    id: idStr,
                    username: user?.username || cleanUser || '',
                    fullName: user?.full_name || '',
                    hdUrl,
                    isBestie,
                    isPrivate: Boolean(user?.is_private),
                    isVerified: Boolean(user?.is_verified),
                    mutualsCount: typeof user?.mutual_followers_count === 'number' ? user.mutual_followers_count : null,
                    mutualUsers,
                    facepileUsers,
                    followerCount: typeof user?.follower_count === 'number'
                        ? user.follower_count
                        : (typeof user?.edge_followed_by?.count === 'number'
                            ? user.edge_followed_by.count
                            : (user?.follower_count ? Number(user.follower_count) : (user?.edge_followed_by?.count ? Number(user.edge_followed_by.count) : null))),
                    followingCount: typeof user?.following_count === 'number'
                        ? user.following_count
                        : (typeof user?.edge_follow?.count === 'number'
                            ? user.edge_follow.count
                            : (user?.following_count ? Number(user.following_count) : (user?.edge_follow?.count ? Number(user.edge_follow.count) : null))),
                    mediaCount: user?.media_count ?? null,
                    biography: user?.biography || '',
                    externalUrl,
                    following,
                    followedBy,
                    outgoingRequest,
                    incomingRequest,
                    isRestricted,
                    isBusiness: Boolean(user?.is_business || user?.is_business_account || user?.account_type === 2),
                    isCreator: Boolean(user?.account_type === 3),
                    isProfessional: Boolean(user?.is_professional_account),
                    category: user?.category || user?.category_name || null,
                    latestReelMedia,
                    latestBestiesReelMedia,
                    rawUser: user
                };

                API.hdAvatarCache.set(idStr, result);

                if (API.friendshipCache.has(idStr)) {
                    const st = API.friendshipCache.get(idStr);
                    if (result.isBestie) st.isBestie = true;
                    if (user.is_private !== undefined) st.isPrivate = result.isPrivate;
                    if (user.friendship_status?.following !== undefined) st.following = following;
                    if (user.friendship_status?.outgoing_request !== undefined) st.outgoingRequest = outgoingRequest;
                    if (user.friendship_status?.incoming_request !== undefined) st.incomingRequest = incomingRequest;
                    st.isBusiness = result.isBusiness;
                    st.isCreator = result.isCreator;
                } else {
                    API.friendshipCache.set(idStr, {
                        following,
                        isBestie,
                        isPrivate: result.isPrivate,
                        isRestricted,
                        outgoingRequest,
                        incomingRequest,
                        isFeedFavorite: false,
                        isBusiness: result.isBusiness,
                        isCreator: result.isCreator
                    });
                }

                return result;
            }
        } catch (err) {
            if (err.name === 'AbortError' || options.signal?.aborted) throw err;
            console.warn(`[IG Analyzer] Error fetching HD profile for @${username}:`, err);
        }

        return null;
    },

    validateTargetAccount: async (username, options = {}) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        if (!cleanUser) {
            return { exists: false, error: 'Please enter a valid Instagram username.' };
        }

        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const cleanUserLower = cleanUser.toLowerCase();
        const viewerId = Utils.getUserId();
        const viewerName = (Utils.getUsername() || '').toLowerCase();

        const snap = Storage.load();
        const isFollowingInSnap = Array.isArray(snap?.following) && snap.following.some((u) => {
            const name = typeof u === 'string' ? u : u?.username;
            return name && name.toLowerCase() === cleanUserLower;
        });
        const isFollowerInSnap = Array.isArray(snap?.followers) && snap.followers.some((u) => {
            const name = typeof u === 'string' ? u : u?.username;
            return name && name.toLowerCase() === cleanUserLower;
        });

        // 1. Resolve user ID
        let resolvedId = (options.userId && String(options.userId) !== "0" && String(options.userId) !== "null")
            ? String(options.userId).trim()
            : null;

        if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
            resolvedId = null;
        }

        if (!resolvedId && snap) {
            const findInSnap = (list) => Array.isArray(list) ? list.find((u) => {
                const name = typeof u === 'string' ? u : u?.username;
                return name && name.toLowerCase() === cleanUserLower && u?.id && String(u.id) !== String(viewerId);
            }) : null;
            const matchUser = findInSnap(snap.following) || findInSnap(snap.followers);
            if (matchUser && matchUser.id) {
                resolvedId = String(matchUser.id);
            }
        }

        if (!resolvedId) {
            const existingTarget = Storage.getTargetData(cleanUser);
            if (existingTarget?.user?.id && (cleanUserLower === viewerName || String(existingTarget.user.id) !== String(viewerId))) {
                resolvedId = String(existingTarget.user.id);
            }
        }

        if (!resolvedId) {
            try {
                resolvedId = await API.resolveUserId(cleanUser, options);
            } catch (rErr) {
                if (rErr.name === 'AbortError' || options.signal?.aborted) throw rErr;
                if (rErr.status === 404 || (rErr.message && rErr.message.includes("404"))) {
                    return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                }
            }
        }

        // Final viewer ID guard on resolvedId
        if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
            resolvedId = null;
        }

        // 2. If ID resolved, use reliable RelayModern GraphQL + REST Friendship Status
        if (resolvedId) {
            try {
                const profile = await API.fetchUserProfileHd(resolvedId, cleanUser, { ...options, forceRefresh: true });
                if (profile) {
                    const profileUsername = (profile.username || '').toLowerCase();
                    // STRICT CHECK: Ensure profile username matches target and is not viewer
                    if (profileUsername && profileUsername !== cleanUserLower) {
                        return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                    }
                    if (cleanUserLower !== viewerName && viewerId && String(profile.id) === String(viewerId)) {
                        return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                    }

                    let isFollowing = isFollowingInSnap;
                    let isFollowedBy = isFollowerInSnap;
                    let isPrivate = Boolean(profile.isPrivate);

                    // Fetch authoritative friendship status from official REST endpoint
                    try {
                        const friendshipRes = await API.fetchWithRetry(`https://www.instagram.com/api/v1/friendships/show/${resolvedId}/`, {
                            headers: {
                                "X-IG-App-ID": "936619743392459",
                                "X-Requested-With": "XMLHttpRequest",
                                "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
                            },
                            optional: true,
                            silent: true,
                            signal: options.signal
                        }, 1);

                        if (friendshipRes) {
                            if (friendshipRes.following !== undefined) isFollowing = Boolean(friendshipRes.following) || isFollowing;
                            if (friendshipRes.followed_by !== undefined) isFollowedBy = Boolean(friendshipRes.followed_by) || isFollowedBy;
                            if (friendshipRes.is_private !== undefined) isPrivate = Boolean(friendshipRes.is_private);
                        }
                    } catch (fErr) {
                        if (fErr.name === 'AbortError' || options.signal?.aborted) throw fErr;
                    }

                    return {
                        exists: true,
                        user: {
                            id: resolvedId,
                            username: profile.username || cleanUser,
                            fullName: profile.fullName || '',
                            isPrivate,
                            isVerified: Boolean(profile.isVerified),
                            followerCount: profile.followerCount || 0,
                            followingCount: profile.followingCount || 0,
                            mediaCount: profile.mediaCount || 0,
                            profilePicUrl: profile.hdUrl || null,
                            followedByViewer: isFollowing,
                            followsViewer: isFollowedBy,
                            requestedByViewer: Boolean(profile.outgoingRequest)
                        }
                    };
                }
            } catch (graphqlErr) {
                if (graphqlErr.name === 'AbortError' || options.signal?.aborted) throw graphqlErr;
            }
        }

        // 3. Fallback: web_profile_info
        try {
            const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`;
            const json = await API.fetchWithRetry(url, {
                headers: {
                    "X-IG-App-ID": "936619743392459",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-ASBD-ID": CONFIG.ASBD_ID || "359341"
                },
                optional: true,
                silent: true,
                signal: options.signal
            }, 1);

            const u = json?.data?.user;
            if (u && u.id) {
                const uName = (u.username || '').toLowerCase();
                if (uName !== cleanUserLower) {
                    return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                }
                if (cleanUserLower !== viewerName && viewerId && String(u.id) === String(viewerId)) {
                    return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                }

                const followedByViewer = u.followed_by_viewer !== undefined ? Boolean(u.followed_by_viewer) : isFollowingInSnap;
                const followsViewer = u.follows_viewer !== undefined ? Boolean(u.follows_viewer) : isFollowerInSnap;

                return {
                    exists: true,
                    user: {
                        id: String(u.id),
                        username: u.username || cleanUser,
                        fullName: u.full_name || '',
                        isPrivate: Boolean(u.is_private),
                        isVerified: Boolean(u.is_verified),
                        followerCount: u.edge_followed_by?.count || 0,
                        followingCount: u.edge_follow?.count || 0,
                        mediaCount: u.edge_owner_to_timeline_media?.count || 0,
                        profilePicUrl: u.profile_pic_url_hd || u.profile_pic_url || null,
                        followedByViewer,
                        followsViewer,
                        requestedByViewer: Boolean(u.requested_by_viewer)
                    }
                };
            }
        } catch (err) {
            if (err.name === 'AbortError' || options.signal?.aborted) throw err;
            if (err.message && err.message.includes("404")) {
                return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            if (err.message && err.message.includes("429")) {
                console.warn(`[IG Analyzer] web_profile_info returned 429 for @${cleanUser}, falling through to HTML verification.`);
            }
        }

        // 4. HTML fallback (with strict username check and viewer guard)
        try {
            const res = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
                credentials: "include",
                signal: options.signal
            });
            if (res.status === 404) {
                return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
            }
            if (res.status === 429) {
                return { exists: false, error: `Instagram rate limit (429) active. Please wait a moment before trying again.` };
            }
            if (res.ok) {
                const html = await res.text();
                const isNotFound = html.includes('Page Not Found') || 
                                   html.includes('Page not found') || 
                                   html.includes('Página no encontrada') ||
                                   html.includes("Sorry, this page isn't available") ||
                                   html.includes("Esta página no está disponible") ||
                                   html.includes('"entry_data":{"HttpErrorPage"');
                if (isNotFound) {
                    return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                }

                if (!html.includes(`/${cleanUser}/`) && !html.includes(`"${cleanUser}"`)) {
                    return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
        }

        return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
    },

    fetchTargetNetwork: async (targetUser, options = {}, progressCallback = null, logCallback = null) => {
        if (!targetUser || !targetUser.id) {
            throw new Error("Invalid target user data provided.");
        }

        const log = (msg) => {
            if (typeof logCallback === 'function') logCallback(msg);
        };
        const setProgress = (curr, total, label) => {
            if (typeof progressCallback === 'function') progressCallback(curr, total, label);
        };

        const isRestricted = targetUser.isPrivate && !targetUser.followedByViewer;
        if (isRestricted) {
            log(`[Privacy Notice] @${targetUser.username} is a private account you do not follow. Network lists are restricted by Meta.`);
            return {
                followers: [],
                following: [],
                mutuals: [],
                isRestricted: true
            };
        }

        log(`[Extraction] Beginning extraction for target account @${targetUser.username}...`);

        const extractList = async (label, expectedTotal) => {
            const users = [];
            let maxId = null;
            let hasNext = true;
            const endpoint = label === "following" ? "following" : "followers";

            while (hasNext) {
                if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

                let url = `https://www.instagram.com/api/v1/friendships/${targetUser.id}/${endpoint}/?count=50&search_surface=follow_list_page`;
                if (maxId) {
                    url += `&max_id=${encodeURIComponent(maxId)}`;
                }

                const json = await API.fetchWithRetry(url, options);
                const list = json?.users;

                if (!Array.isArray(list)) {
                    log(`[Warning] Received non-array response for ${label}.`);
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

                const total = expectedTotal > 0 ? expectedTotal : 0;
                setProgress(users.length, total, `Extracting target ${label} (${users.length}${total > 0 ? '/' + total : ''})...`);

                if (hasNext) {
                    await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 800, options.signal);
                }
            }

            return users;
        };

        log(`Extracting followers for @${targetUser.username} (expected: ~${targetUser.followerCount || 0})...`);
        const followers = await extractList("followers", targetUser.followerCount || 0);
        log(`Extracted ${followers.length} followers for @${targetUser.username}.`);

        await Utils.sleep(1000 + Math.random() * 500, options.signal);

        log(`Extracting following for @${targetUser.username} (expected: ~${targetUser.followingCount || 0})...`);
        const following = await extractList("following", targetUser.followingCount || 0);
        log(`Extracted ${following.length} following for @${targetUser.username}.`);

        const followerUsernames = new Set(followers.map((u) => u.username));
        const mutuals = following.filter((u) => followerUsernames.has(u.username));
        log(`Computed ${mutuals.length} mutual connections for @${targetUser.username}.`);

        return {
            followers,
            following,
            mutuals,
            isRestricted: false
        };
    }
};