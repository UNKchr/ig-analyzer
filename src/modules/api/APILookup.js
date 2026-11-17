import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';
import { Storage } from '../Storage.js';

Object.assign(API, {
    getUserInfo: async (userId, options = {}) => {
        if (!userId || String(userId) === "0") return null;
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const targetIdStr = String(userId).trim();
        const opts = { ...options, optional: true, silent: true };
        const viewerUsername = Utils.getUsername() || Storage.load(targetIdStr)?.ownerUsername || "";

        // 1. Check window / unsafeWindow objects ONLY when ID strictly matches target userId
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const candidates = [
                win.__initialData?.pending?.viewer,
                win.__initialData?.data?.viewer,
                win._sharedData?.config?.viewer,
                win._sharedData?.rawProfileUser,
                win.__initialData?.data?.user
            ];
            for (const cand of candidates) {
                if (!cand || typeof cand !== 'object') continue;
                const candId = String(cand.id || cand.pk || '').trim();
                if (candId !== targetIdStr) continue;
                const fCount = cand.edge_followed_by?.count ?? cand.follower_count;
                const fgCount = cand.edge_follow?.count ?? cand.following_count;
                if (typeof fCount === 'number' || typeof fgCount === 'number') {
                    return {
                        followerCount: Number(fCount || 0),
                        followingCount: Number(fgCount || 0),
                        username: cand.username || viewerUsername,
                        fullName: cand.full_name || "",
                        profilePicUrl: cand.profile_pic_url || null
                    };
                }
            }
        } catch (e) {}

        // 2. Check DOM meta tags ONLY when the current route actually belongs to the viewer's own profile
        try {
            const currentSlug = typeof window !== 'undefined'
                ? String(window.location?.pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase()
                : '';
            if (viewerUsername && currentSlug && currentSlug === viewerUsername.toLowerCase()) {
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
                            username: viewerUsername,
                            fullName: "",
                            profilePicUrl: null
                        };
                    }
                }
            }
        } catch (e) {}

        // 3. Official Web endpoint: /api/v1/users/web_profile_info/?username={viewerUsername}
        try {
            if (viewerUsername) {
                const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(viewerUsername)}`;
                const json = await API.fetchWithRetry(url, opts, 1);
                const u = json?.data?.user;
                if (u && (!u.id || String(u.id) === targetIdStr)) {
                    return {
                        followerCount: Number(u.edge_followed_by?.count ?? u.follower_count ?? 0),
                        followingCount: Number(u.edge_follow?.count ?? u.following_count ?? 0),
                        username: u.username || viewerUsername,
                        fullName: u.full_name || "",
                        profilePicUrl: u.profile_pic_url || null
                    };
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
        }

        // 4. Direct ID GraphQL fallback (works on feed, reels, or foreign profiles even without viewerUsername)
        try {
            if (typeof API.fetchUserProfileHd === 'function') {
                const hd = await API.fetchUserProfileHd(targetIdStr, viewerUsername, opts);
                if (hd && (typeof hd.followerCount === 'number' || typeof hd.followingCount === 'number')) {
                    return {
                        followerCount: Number(hd.followerCount ?? 0),
                        followingCount: Number(hd.followingCount ?? 0),
                        username: hd.username || viewerUsername,
                        fullName: hd.fullName || "",
                        profilePicUrl: hd.hdUrl || null
                    };
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
        }

        return null;
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
            const searchDocId = "27706427925724183";
            params.append("fb_api_caller_class", "RelayModern");
            params.append("fb_api_req_friendly_name", "PolarisSearchBoxRefetchableQuery");
            params.append("doc_id", searchDocId);
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

        // 2. Check all local detailed snapshots, nominal lists, renamed records, and target caches (zero network cost)
        try {
            if (typeof Storage.findKnownUserByUsername === 'function') {
                const known = Storage.findKnownUserByUsername(cleanUser);
                if (known?.id && String(known.id) !== "0" && (cleanUser === viewerName || String(known.id) !== String(viewerId))) {
                    return String(known.id);
                }
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

    fetchHighlightsTray: async (targetId, cleanUser, profile = null, options = {}) => {
        const normalizeItems = (items) => {
            if (!Array.isArray(items)) return [];
            return items
                .map((entry) => {
                    const node = entry?.node && typeof entry.node === 'object' ? entry.node : entry;
                    if (!node || typeof node !== 'object') return null;
                    return {
                        id: String(node.id || node.pk || ''),
                        title: String(node.title || 'Untitled'),
                        mediaCount: Number(node.media_count ?? node.mediaCount ?? node.edge_highlight_media?.count ?? 0)
                    };
                })
                .filter(Boolean);
        };

        const rawUser = profile?.rawUser || null;
        if (Array.isArray(rawUser?.edge_highlight_reels?.edges)) {
            const highlights = normalizeItems(rawUser.edge_highlight_reels.edges);
            const count = typeof rawUser.highlight_reel_count === 'number'
                ? Math.max(highlights.length, rawUser.highlight_reel_count)
                : highlights.length;
            return { available: true, count, highlights, source: 'profile_raw' };
        }

        // Tier 1: Native Instagram Web RelayModern GraphQL (PolarisProfileStoryHighlightsTrayContentQuery)
        const relayDocId = Utils.getRelayDocId("PolarisProfileStoryHighlightsTrayContentQuery", null);
        if (relayDocId) {
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
            params.append("fb_api_req_friendly_name", "PolarisProfileStoryHighlightsTrayContentQuery");
            params.append("doc_id", relayDocId);
            params.append("server_timestamps", "true");
            params.append("variables", JSON.stringify({ user_id: String(targetId) }));
            if (dtsg) params.append("fb_dtsg", dtsg);
            if (jazoest) params.append("jazoest", jazoest);
            if (lsd) params.append("lsd", lsd);

            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-FB-Friendly-Name": "PolarisProfileStoryHighlightsTrayContentQuery"
            };
            if (lsd) headers["X-FB-LSD"] = lsd;

            const relayEndpoints = [
                "https://www.instagram.com/graphql/query",
                "https://www.instagram.com/api/graphql"
            ];

            for (const relayUrl of relayEndpoints) {
                try {
                    const relayJson = await API.fetchWithRetry(relayUrl, {
                        method: "POST",
                        headers,
                        body: params.toString(),
                        optional: true,
                        silent: true,
                        signal: options.signal
                    }, 1);

                    const rawEdges = relayJson?.data?.highlights_tray?.edges
                        ?? relayJson?.data?.xdt_api__v1__highlights__highlights_tray?.tray
                        ?? relayJson?.data?.user?.edge_highlight_reels?.edges;

                    if (Array.isArray(rawEdges)) {
                        const highlights = normalizeItems(rawEdges);
                        return {
                            available: true,
                            count: highlights.length,
                            highlights,
                            source: 'relay_graphql'
                        };
                    }
                } catch (relayErr) {
                    if (relayErr.name === 'AbortError' || options.signal?.aborted) throw relayErr;
                }
            }
        }

        // Tier 2: Instagram Web GraphQL query_hash (edge_highlight_reels)
        const highlightsHash = CONFIG.HIGHLIGHTS_HASH || "d4d88dc1500312af6f937f7b804c68c3";
        try {
            const vars = encodeURIComponent(JSON.stringify({
                user_id: String(targetId),
                include_chaining: false,
                include_reel: true,
                include_suggested_users: false,
                include_logged_out_extras: false,
                include_highlight_reels: true,
                include_live_status: false
            }));
            const gqlJson = await API.fetchWithRetry(`https://www.instagram.com/graphql/query/?query_hash=${highlightsHash}&variables=${vars}`, {
                optional: true,
                silent: true,
                signal: options.signal
            }, 1);

            const edges = gqlJson?.data?.user?.edge_highlight_reels?.edges;
            if (Array.isArray(edges)) {
                const highlights = normalizeItems(edges);
                return {
                    available: true,
                    count: highlights.length,
                    highlights,
                    source: 'graphql_hash'
                };
            }
        } catch (gqlErr) {
            if (gqlErr.name === 'AbortError' || options.signal?.aborted) throw gqlErr;
        }

        // Tier 3: Legacy REST highlights_tray (quietly handled when Web returns SPA HTML shell)
        try {
            const trayJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/highlights/${targetId}/highlights_tray/`, {
                optional: true,
                silent: true,
                signal: options.signal
            }, 1);

            if (Array.isArray(trayJson?.tray)) {
                const highlights = normalizeItems(trayJson.tray);
                return {
                    available: true,
                    count: highlights.length,
                    highlights,
                    source: 'rest_tray'
                };
            }
        } catch (trayErr) {
            if (trayErr.name === 'AbortError' || options.signal?.aborted) throw trayErr;
        }

        // Tier 4: Profile highlight_reel_count from Relay profile or web_profile_info
        if (typeof rawUser?.highlight_reel_count === 'number') {
            return {
                available: true,
                count: Number(rawUser.highlight_reel_count),
                highlights: [],
                source: 'profile_count'
            };
        }

        if (cleanUser) {
            try {
                const webJson = await API.fetchWithRetry(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`, {
                    optional: true,
                    silent: true,
                    signal: options.signal
                }, 1);

                const webUser = webJson?.data?.user;
                if (Array.isArray(webUser?.edge_highlight_reels?.edges)) {
                    const highlights = normalizeItems(webUser.edge_highlight_reels.edges);
                    const count = typeof webUser.highlight_reel_count === 'number'
                        ? Math.max(highlights.length, webUser.highlight_reel_count)
                        : highlights.length;
                    return { available: true, count, highlights, source: 'web_profile_info' };
                }
                if (typeof webUser?.highlight_reel_count === 'number') {
                    return {
                        available: true,
                        count: Number(webUser.highlight_reel_count),
                        highlights: [],
                        source: 'web_profile_count'
                    };
                }
            } catch (webErr) {
                if (webErr.name === 'AbortError' || options.signal?.aborted) throw webErr;
            }

            // Tier 5: Authenticated profile SSR HTML fallback (immune to REST/GraphQL deprecations)
            try {
                const htmlRes = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
                    credentials: "include",
                    signal: options.signal
                });
                if (htmlRes.ok && typeof htmlRes.text === 'function') {
                    const html = await htmlRes.text();
                    const countMatch = html.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/) ||
                                       html.match(/\\?"edge_highlight_reels\\?"\s*:\s*\{\s*\\?"count\\?"\s*:\s*([0-9]+)/);
                    if (countMatch && countMatch[1] !== undefined) {
                        return {
                            available: true,
                            count: parseInt(countMatch[1], 10) || 0,
                            highlights: [],
                            source: 'auth_html'
                        };
                    }
                }
            } catch (htmlErr) {
                if (htmlErr.name === 'AbortError' || options.signal?.aborted) throw htmlErr;
            }
        }

        return {
            available: false,
            count: 0,
            highlights: [],
            source: 'unavailable'
        };
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

            // 2. Query Highlights Tray (Multi-tier authenticated resolution)
            const trayResult = await API.fetchHighlightsTray(targetId, cleanUser, profile, options);
            const authHighlightsAvailable = Boolean(trayResult?.available);
            const authHighlights = Array.isArray(trayResult?.highlights) ? trayResult.highlights : [];
            const authHighlightsCount = Number(trayResult?.count || 0);

            // 3. For Public Accounts: Query Anonymous / Guest Visibility Safely (without HTML JSON parse errors)
            let anonHighlightsCount = 0;
            let anonHighlightsAvailable = false;
            let anonHasStory = false;
            if (!isPrivate) {
                const parseSafeAnonJson = async (res) => {
                    if (!res || !res.ok) return null;
                    const ct = (res.headers && typeof res.headers.get === 'function')
                        ? (res.headers.get('content-type') || '')
                        : '';
                    if (ct && ct.toLowerCase().includes('text/html')) {
                        if (typeof res.text === 'function') await res.text().catch(() => '');
                        return null;
                    }
                    try {
                        return await res.json();
                    } catch (err) {
                        return null;
                    }
                };

                try {
                    const anonWebRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(cleanUser)}`, {
                        credentials: "omit",
                        headers: {
                            "X-IG-App-ID": "936619743392459",
                            "X-Requested-With": "XMLHttpRequest",
                            "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
                            "Accept": "application/json, text/plain, */*"
                        },
                        signal: options.signal
                    });
                    const anonWebJson = await parseSafeAnonJson(anonWebRes);
                    const anonUser = anonWebJson?.data?.user;
                    if (anonUser) {
                        if (typeof anonUser.highlight_reel_count === 'number') {
                            anonHighlightsAvailable = true;
                            anonHighlightsCount = anonUser.highlight_reel_count;
                        } else if (Array.isArray(anonUser.edge_highlight_reels?.edges)) {
                            anonHighlightsAvailable = true;
                            anonHighlightsCount = anonUser.edge_highlight_reels.edges.length;
                        }
                        if (typeof anonUser.latest_reel_media === 'number' && anonUser.latest_reel_media > 0) {
                            anonHasStory = true;
                        }
                    }
                } catch (anonWebErr) {
                    if (anonWebErr.name === 'AbortError' || options.signal?.aborted) throw anonWebErr;
                }

                if (!anonHighlightsAvailable) {
                    try {
                        const anonHtmlRes = await fetch(`https://www.instagram.com/${encodeURIComponent(cleanUser)}/`, {
                            credentials: "omit",
                            signal: options.signal
                        });
                        if (anonHtmlRes.ok && typeof anonHtmlRes.text === 'function') {
                            const anonHtml = await anonHtmlRes.text();
                            const hMatch = anonHtml.match(/\\?"highlight_reel_count\\?"\s*:\s*([0-9]+)/);
                            if (hMatch && hMatch[1] !== undefined) {
                                anonHighlightsAvailable = true;
                                anonHighlightsCount = parseInt(hMatch[1], 10) || 0;
                            }
                            const sMatch = anonHtml.match(/\\?"latest_reel_media\\?"\s*:\s*([1-9][0-9]*)/);
                            if (sMatch) {
                                anonHasStory = true;
                            }
                        }
                    } catch (anonHtmlErr) {
                        if (anonHtmlErr.name === 'AbortError' || options.signal?.aborted) throw anonHtmlErr;
                    }
                }
            }

            return {
                userId: targetId,
                username: cleanUser,
                fullName: profile?.fullName || '',
                profilePicUrl: profile?.hdUrl || null,
                isPrivate,
                isGated,
                authHighlightsAvailable,
                authHighlightsCount,
                authHighlights,
                latestReelMedia,
                latestBestiesReelMedia,
                authHasStory,
                isBestieStory,
                anonHighlightsAvailable,
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

});
