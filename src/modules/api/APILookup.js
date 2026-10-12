import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';
import { Storage } from '../Storage.js';

Object.assign(API, {
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

});
