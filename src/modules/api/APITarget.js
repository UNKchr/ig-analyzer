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
        let resolvedFromKnownSource = Boolean(resolvedId);

        if (cleanUserLower !== viewerName && viewerId && String(resolvedId) === String(viewerId)) {
            resolvedId = null;
            resolvedFromKnownSource = false;
        }

        if (!resolvedId && typeof Storage.findKnownUserByUsername === 'function') {
            const knownUser = Storage.findKnownUserByUsername(cleanUser);
            if (knownUser?.id && String(knownUser.id) !== "0" && (cleanUserLower === viewerName || String(knownUser.id) !== String(viewerId))) {
                resolvedId = String(knownUser.id);
                resolvedFromKnownSource = true;
            }
        }

        if (!resolvedId) {
            const existingTarget = Storage.getTargetData(cleanUser);
            if (existingTarget?.user?.id && (cleanUserLower === viewerName || String(existingTarget.user.id) !== String(viewerId))) {
                resolvedId = String(existingTarget.user.id);
                resolvedFromKnownSource = true;
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
            resolvedFromKnownSource = false;
        }

        // 2. If ID resolved, use reliable RelayModern GraphQL + REST Friendship Status
        if (resolvedId) {
            try {
                const profile = await API.fetchUserProfileHd(resolvedId, cleanUser, { ...options, forceRefresh: true });
                if (profile) {
                    const profileUsername = (profile.username || '').toLowerCase();
                    if (cleanUserLower !== viewerName && viewerId && String(profile.id) === String(viewerId)) {
                        return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                    }

                    const sameNumericId = Boolean(profile.id && String(profile.id) === String(resolvedId));
                    if (profileUsername && profileUsername !== cleanUserLower && !sameNumericId && !resolvedFromKnownSource) {
                        return { exists: false, notFound: true, error: `Account @${cleanUser} does not exist on Instagram.` };
                    }

                    const isRenamedTarget = Boolean(profileUsername && profileUsername !== cleanUserLower && (sameNumericId || resolvedFromKnownSource));
                    const isFollowingInSnapCurrent = isRenamedTarget && Array.isArray(snap?.following) && snap.following.some((u) => {
                        const name = typeof u === 'string' ? u : u?.username;
                        return name && name.toLowerCase() === profileUsername;
                    });
                    const isFollowerInSnapCurrent = isRenamedTarget && Array.isArray(snap?.followers) && snap.followers.some((u) => {
                        const name = typeof u === 'string' ? u : u?.username;
                        return name && name.toLowerCase() === profileUsername;
                    });

                    let isFollowing = isFollowingInSnap || isFollowingInSnapCurrent;
                    let isFollowedBy = isFollowerInSnap || isFollowerInSnapCurrent;
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
                        ...(isRenamedTarget ? { renamedFrom: cleanUser } : {}),
                        user: {
                            id: resolvedId,
                            username: profile.username || cleanUser,
                            ...(isRenamedTarget ? { previousUsername: cleanUser } : {}),
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

                // Profile page loaded: try to recover the numeric ID from SSR HTML and retry the reliable GraphQL profile query
                const idMatch = html.match(/\\?"profile_id\\?"\s*:\s*\\?"([1-9][0-9]{4,})\\?"/) ||
                                html.match(/\\?"target_id\\?"\s*:\s*\\?"([1-9][0-9]{4,})\\?"/) ||
                                html.match(new RegExp(`\\\\?"username\\\\?"\\s*:\\s*\\\\?"${cleanUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\\?"[\\s\\S]{0,400}?\\\\?"(?:id|pk)\\\\?"\\s*:\\s*\\\\?"([1-9][0-9]{4,})\\\\?"`, 'i'));
                const htmlId = idMatch?.[1] || null;
                if (htmlId && !options._htmlRetry && (cleanUserLower === viewerName || htmlId !== String(viewerId))) {
                    return API.validateTargetAccount(cleanUser, { ...options, userId: htmlId, _htmlRetry: true });
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
        }

        // Could not confirm either way: never claim the account doesn't exist without explicit 404 evidence
        return { exists: false, error: `Could not verify @${cleanUser} right now (Instagram did not return profile data). Please try again in a few minutes.` };
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

        const expectedFollowers = Number(targetUser.followerCount || 0);
        const expectedFollowing = Number(targetUser.followingCount || 0);

        log(`Extracting followers for @${targetUser.username} (expected: ~${expectedFollowers})...`);
        const followersRes = await API.extractCompleteUserList(
            targetUser.id,
            CONFIG.FOLLOWERS_HASH,
            "followers",
            options,
            expectedFollowers,
            {
                onProgress: (curr, total) => setProgress(curr, total, `Extracting target followers (${curr}${total > 0 ? '/' + total : ''})...`),
                onLog: (msg) => log(msg)
            }
        );
        const followers = followersRes.users;
        log(`Extracted ${followers.length} followers for @${targetUser.username}.`);
        if (expectedFollowers > 0 && followers.length < expectedFollowers && !followersRes.rateLimited) {
            if (followersRes.limitedByMeta || followersRes.isPartial) {
                log(`[Meta Notice] Instagram restricted full follower enumeration for @${targetUser.username} (${followers.length}/${expectedFollowers} accessible).`);
            } else {
                log(`[Info] Profile header counter: ${expectedFollowers} followers | Accessible accounts returned by list API: ${followers.length}.`);
            }
        }

        let followingRes;
        if (followersRes.rateLimited) {
            log(`[Anti-Ban Guard] Skipping 'following' extraction because rate limit (429) was detected during 'followers'.`);
            followingRes = {
                users: [],
                isPartial: true,
                rateLimited: true,
                limitedByMeta: false
            };
        } else {
            // Humanized cooldown pause simulating closing 'Followers' modal and opening 'Following' modal (3.5s - 5.0s)
            await Utils.sleep(3500 + Math.random() * 1500, options.signal);

            log(`Extracting following for @${targetUser.username} (expected: ~${expectedFollowing})...`);
            followingRes = await API.extractCompleteUserList(
                targetUser.id,
                CONFIG.FOLLOWING_HASH,
                "following",
                options,
                expectedFollowing,
                {
                    onProgress: (curr, total) => setProgress(curr, total, `Extracting target following (${curr}${total > 0 ? '/' + total : ''})...`),
                    onLog: (msg) => log(msg)
                }
            );
        }
        const following = followingRes.users;
        if (!followersRes.rateLimited) {
            log(`Extracted ${following.length} following for @${targetUser.username}.`);
        }
        if (expectedFollowing > 0 && following.length < expectedFollowing && !followingRes.rateLimited) {
            if (followingRes.limitedByMeta || followingRes.isPartial) {
                log(`[Meta Notice] Instagram restricted full following enumeration for @${targetUser.username} (${following.length}/${expectedFollowing} accessible).`);
            } else {
                log(`[Info] Profile header counter: ${expectedFollowing} following | Accessible accounts returned by list API: ${following.length}.`);
            }
        }

        const followerIds = new Set(followers.map((u) => u.id).filter(Boolean));
        const followerUsernamesLower = new Set(followers.map((u) => u.username.toLowerCase()));
        const mutuals = following.filter((u) =>
            (u.id && followerIds.has(u.id)) || followerUsernamesLower.has(u.username.toLowerCase())
        );
        log(`Computed ${mutuals.length} mutual connections for @${targetUser.username}.`);

        return {
            followers,
            following,
            mutuals,
            isRestricted: false,
            isPartialFollowers: Boolean(followersRes.isPartial),
            isPartialFollowing: Boolean(followingRes.isPartial),
            isRateLimitedFollowers: Boolean(followersRes.rateLimited),
            isRateLimitedFollowing: Boolean(followingRes.rateLimited)
        };
    }

});
