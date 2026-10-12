import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';
import { Storage } from '../Storage.js';

Object.assign(API, {
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

});
