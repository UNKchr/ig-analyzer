import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

Object.assign(API, {
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

});
