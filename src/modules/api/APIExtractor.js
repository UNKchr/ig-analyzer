import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

Object.assign(API, {
    mergeExtractedUsers: (primaryList = [], secondaryList = []) => {
        const merged = [];
        const indexById = new Map();
        const indexByLower = new Map();

        const upsert = (rawUser) => {
            if (!rawUser || typeof rawUser !== 'object') return;
            const username = rawUser.username ? String(rawUser.username).trim() : '';
            if (!username) return;

            const rawId = rawUser.id ?? rawUser.pk_id ?? rawUser.strong_id__ ?? rawUser.pk ?? null;
            const id = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && String(rawId) !== '0' && String(rawId) !== 'null' && String(rawId) !== 'undefined')
                ? String(rawId).trim()
                : null;
            const lower = username.toLowerCase();

            const existingIdx = (id && indexById.has(id))
                ? indexById.get(id)
                : (indexByLower.has(lower) ? indexByLower.get(lower) : -1);

            if (existingIdx !== -1 && existingIdx !== undefined) {
                const existing = merged[existingIdx];
                if (!existing.id && id) {
                    existing.id = id;
                    indexById.set(id, existingIdx);
                }
                if (!existing.fullName && rawUser.fullName) existing.fullName = rawUser.fullName;
                if (!existing.profilePicUrl && rawUser.profilePicUrl) existing.profilePicUrl = rawUser.profilePicUrl;
                if (!existing.isPrivate && rawUser.isPrivate) existing.isPrivate = true;
                if (!existing.isVerified && rawUser.isVerified) existing.isVerified = true;
                if (!existing.latestReelMedia && rawUser.latestReelMedia) existing.latestReelMedia = rawUser.latestReelMedia;
                return;
            }

            const entry = {
                id,
                username,
                fullName: rawUser.fullName || rawUser.full_name || "",
                isPrivate: Boolean(rawUser.isPrivate ?? rawUser.is_private),
                isVerified: Boolean(rawUser.isVerified ?? rawUser.is_verified),
                profilePicUrl: rawUser.profilePicUrl || rawUser.profile_pic_url || null,
                latestReelMedia: rawUser.latestReelMedia ?? rawUser.latest_reel_media ?? 0
            };

            const nextIdx = merged.length;
            merged.push(entry);
            if (id) indexById.set(id, nextIdx);
            indexByLower.set(lower, nextIdx);
        };

        (Array.isArray(primaryList) ? primaryList : []).forEach(upsert);
        (Array.isArray(secondaryList) ? secondaryList : []).forEach(upsert);

        return merged;
    },

    getAllUsersViaGraphQL: async (userId, hash, label, options = {}, expectedTotal = 0, callbacks = null) => {
        const candidateHashes = [
            hash,
            ...(label === "following" && CONFIG.FOLLOWING_ALT_HASH && CONFIG.FOLLOWING_ALT_HASH !== hash
                ? [CONFIG.FOLLOWING_ALT_HASH]
                : [])
        ].filter(Boolean);

        if (candidateHashes.length === 0) return [];

        const reportProgress = typeof callbacks?.onProgress === 'function'
            ? callbacks.onProgress
            : (curr, total, msg) => UI.setProgress(curr, total, msg);

        let lastErr = null;

        for (const activeHash of candidateHashes) {
            const users = [];
            const seenIds = new Set();
            const seenUsernames = new Set();
            const seenCursors = new Set();
            let cursor = null;
            let hasNext = true;
            let totalCount = expectedTotal || 0;
            let structureValid = true;

            try {
                while (hasNext) {
                    if (options.signal?.aborted) {
                        throw new DOMException("Aborted", "AbortError");
                    }

                    const vars = encodeURIComponent(JSON.stringify({
                        id: String(userId),
                        first: options.pageSize || CONFIG.PAGE_SIZE || 50,
                        after: cursor
                    }));
                    const url = "https://www.instagram.com/graphql/query/?query_hash=" + activeHash + "&variables=" + vars;

                    const json = await API.fetchWithRetry(url, options);
                    const userNode = json?.data?.user;
                    const edge = label === "following"
                        ? (userNode?.edge_follow || userNode?.edge_followed_by)
                        : (userNode?.edge_followed_by || userNode?.edge_follow);

                    if (!edge || !Array.isArray(edge.edges)) {
                        structureValid = false;
                        break;
                    }

                    if (totalCount === 0 && edge.count) totalCount = edge.count;

                    edge.edges.forEach((e) => {
                        const node = e?.node;
                        const username = node?.username ? String(node.username).trim() : '';
                        if (!username) return;

                        const rawId = node?.id ?? node?.pk_id ?? node?.pk ?? null;
                        const id = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && String(rawId) !== '0')
                            ? String(rawId).trim()
                            : null;
                        const lower = username.toLowerCase();

                        if ((id && seenIds.has(id)) || seenUsernames.has(lower)) return;
                        if (id) seenIds.add(id);
                        seenUsernames.add(lower);

                        users.push({
                            id,
                            username,
                            fullName: node?.full_name || "",
                            isPrivate: Boolean(node?.is_private),
                            isVerified: Boolean(node?.is_verified),
                            profilePicUrl: node?.profile_pic_url || null,
                            latestReelMedia: node?.reel?.latest_reel_media || 0
                        });
                    });

                    const nextCursor = (edge.page_info?.has_next_page === true && edge.page_info?.end_cursor)
                        ? String(edge.page_info.end_cursor)
                        : null;

                    if (nextCursor && seenCursors.has(nextCursor)) {
                        hasNext = false;
                    } else {
                        if (nextCursor) seenCursors.add(nextCursor);
                        cursor = nextCursor;
                        hasNext = Boolean(nextCursor);
                    }

                    const total = totalCount > 0 ? totalCount : 0;
                    const progressLabel = total > 0
                        ? `Extracting ${label}... (${users.length}/${total})`
                        : `Extracting ${label}... (${users.length})`;

                    reportProgress(users.length, total, progressLabel);

                    if (hasNext) await Utils.sleep(CONFIG.BASE_RATE_LIMIT_MS + Math.random() * 500, options.signal);
                }

                if (structureValid) {
                    if (users.length > 0 && !callbacks?.suppressFinalProgress) {
                        reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
                    }
                    return users;
                }
            } catch (err) {
                if (err.name === 'AbortError' || options.signal?.aborted) throw err;
                if (users.length > 0) {
                    Object.defineProperty(err, 'partialUsers', { value: users, enumerable: false, configurable: true });
                }
                lastErr = err;
            }
        }

        if (lastErr) throw lastErr;
        if (!options.silent) {
            console.warn(`[IG Analyzer] Unexpected GraphQL structure for ${label}.`);
        }
        return [];
    },

    getAllUsersViaFriendships: async (userId, label, options = {}, expectedTotal = 0, callbacks = null) => {
        const users = [];
        const seenIds = new Set();
        const seenUsernames = new Set();
        const seenCursors = new Set();
        let maxId = null;
        let hasNext = true;
        let limitedByMeta = false;
        let pagesFetched = 0;
        let rawItemsCount = 0;
        let duplicateItemsCount = 0;
        const endpoint = label === "following" ? "following" : "followers";
        const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : (CONFIG.FRIENDSHIPS_PAGE_SIZE || 12);
        const searchSurface = options.searchSurface ? String(options.searchSurface) : null;
        const rankToken = options.useRankToken ? (options.rankToken || Utils.generateUuid()) : null;

        const reportProgress = typeof callbacks?.onProgress === 'function'
            ? callbacks.onProgress
            : (curr, total, msg) => UI.setProgress(curr, total, msg);

        try {
            while (hasNext) {
                if (options.signal?.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }

                const params = new URLSearchParams();
                params.set("count", String(pageSize));
                if (searchSurface) {
                    params.set("search_surface", String(searchSurface));
                }
                if (rankToken) {
                    params.set("rank_token", String(rankToken));
                }
                if (maxId !== null) {
                    params.set("max_id", String(maxId));
                }

                const url = `https://www.instagram.com/api/v1/friendships/${userId}/${endpoint}/?${params.toString()}`;
                const json = await API.fetchWithRetry(url, { ...options, abortOnRateLimit: true });
                pagesFetched++;

                if (json?.should_limit_list_of_followers || json?.should_limit_list_of_followings) {
                    limitedByMeta = true;
                }

                const list = json?.users;
                if (!Array.isArray(list)) {
                    if (!options.silent) {
                        console.warn(`[IG Analyzer] Friendships API returned non-array for ${label}:`, json);
                    }
                    if (pagesFetched === 1) {
                        throw new Error(`Friendships API returned invalid users payload for ${label}`);
                    }
                    break;
                }

                rawItemsCount += list.length;

                list.forEach((u) => {
                    const username = u?.username ? String(u.username).trim() : '';
                    if (!username) return;

                    const rawId = u?.pk_id ?? u?.strong_id__ ?? u?.pk ?? u?.id ?? null;
                    const id = (rawId !== null && rawId !== undefined && String(rawId).trim() !== '' && String(rawId) !== '0')
                        ? String(rawId).trim()
                        : null;
                    const lower = username.toLowerCase();

                    if ((id && seenIds.has(id)) || seenUsernames.has(lower)) {
                        duplicateItemsCount++;
                        return;
                    }
                    if (id) seenIds.add(id);
                    seenUsernames.add(lower);

                    users.push({
                        id,
                        username,
                        fullName: u?.full_name || "",
                        isPrivate: Boolean(u?.is_private),
                        isVerified: Boolean(u?.is_verified),
                        profilePicUrl: u?.profile_pic_url || null,
                        latestReelMedia: u?.latest_reel_media || 0
                    });
                });

                const rawNext = json?.next_max_id;
                const nextCursor = (rawNext !== undefined && rawNext !== null && String(rawNext) !== "")
                    ? String(rawNext)
                    : null;

                if (nextCursor && seenCursors.has(nextCursor)) {
                    console.warn(`[IG Analyzer] Duplicate pagination cursor detected for ${label}, stopping loop.`);
                    hasNext = false;
                } else {
                    if (nextCursor) seenCursors.add(nextCursor);
                    maxId = nextCursor;
                    hasNext = Boolean(nextCursor);
                }

                const total = expectedTotal > 0 ? expectedTotal : 0;
                const progressLabel = total > 0
                    ? `Extracting ${label}... (${users.length}/${total})`
                    : `Extracting ${label}... (${users.length})`;

                reportProgress(users.length, total, progressLabel);
                if (hasNext) {
                    const baseDelay = (CONFIG.FRIENDSHIPS_RATE_LIMIT_MS || CONFIG.BASE_RATE_LIMIT_MS || 1250) + Math.random() * 650;
                    const breatherEvery = CONFIG.BREATHER_EVERY_PAGES || 10;
                    const extraBreather = (pagesFetched > 0 && pagesFetched % breatherEvery === 0)
                        ? ((CONFIG.BREATHER_PAUSE_MS || 2500) + Math.random() * 800)
                        : 0;
                    await Utils.sleep(baseDelay + extraBreather, options.signal);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError' || options.signal?.aborted) throw err;
            if (users.length > 0) {
                Object.defineProperty(err, 'partialUsers', { value: users, enumerable: false, configurable: true });
            }
            throw err;
        }

        if (users.length > 0 && !callbacks?.suppressFinalProgress) {
            reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
        }

        Object.defineProperty(users, '_meta', {
            value: { limitedByMeta, pagesFetched, rawItemsCount, duplicateItemsCount },
            enumerable: false,
            configurable: true
        });

        return users;
    },

    extractCompleteUserList: async (userId, hash, label, options = {}, expectedTotal = 0, callbacks = null) => {
        const logMsg = typeof callbacks?.onLog === 'function'
            ? callbacks.onLog
            : (msg) => UI.log(msg);
        const reportProgress = typeof callbacks?.onProgress === 'function'
            ? callbacks.onProgress
            : (curr, total, msg) => UI.setProgress(curr, total, msg);

        let users = [];
        let friendshipsSuccess = false;
        let limitedByMeta = false;
        let rateLimited = false;

        // 1. Single Native Pass: Official Instagram Web modal endpoint (?count=12 without search_surface)
        try {
            const res = await API.getAllUsersViaFriendships(
                userId,
                label,
                {
                    ...options,
                    pageSize: CONFIG.FRIENDSHIPS_PAGE_SIZE || 12,
                    searchSurface: null,
                    useRankToken: false,
                    abortOnRateLimit: true
                },
                expectedTotal,
                {
                    onProgress: reportProgress,
                    suppressFinalProgress: true
                }
            );
            users = res;
            limitedByMeta = Boolean(res?._meta?.limitedByMeta);
            friendshipsSuccess = true;
        } catch (e) {
            if (e.name === 'AbortError' || options.signal?.aborted) throw e;
            users = Array.isArray(e.partialUsers) ? e.partialUsers : [];
            friendshipsSuccess = false;
            if (e.isRateLimited) {
                rateLimited = true;
                logMsg(`[Anti-Ban Guard] Instagram rate limit (429) detected on '${label}' (${users.length} collected). Halting extraction immediately to protect your account.`);
            } else {
                console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e?.message || e);
            }
        }

        // 2. Fallback GraphQL ONLY if REST failed (non-429) or was severely truncated (<65%) without Meta flag.
        // Never runs after normal completion (prevents 1-4 deactivated accounts from triggering extra passes & rate limits).
        const isSeverelyTruncated = expectedTotal >= 20 && users.length < expectedTotal * 0.65 && !limitedByMeta;
        const shouldRunGraphQL = Boolean(hash) &&
            !rateLimited &&
            (!friendshipsSuccess || isSeverelyTruncated);

        if (shouldRunGraphQL) {
            if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

            if (!friendshipsSuccess) {
                logMsg(`Friendships API interrupted for '${label}' (${users.length} partial). Completing via GraphQL...`);
            }

            const beforeGqlCount = users.length;
            try {
                if (friendshipsSuccess && users.length > 0) {
                    await Utils.sleep(800 + Math.random() * 300, options.signal);
                }
                const gqlUsers = await API.getAllUsersViaGraphQL(
                    userId,
                    hash,
                    label,
                    friendshipsSuccess
                        ? { ...options, optional: true, silent: true, abortOnRateLimit: true }
                        : { ...options, abortOnRateLimit: true },
                    expectedTotal,
                    {
                        onProgress: (curr, total, msg) => {
                            const mergedEstimate = Math.max(users.length, curr);
                            reportProgress(mergedEstimate, total, msg);
                        },
                        suppressFinalProgress: true
                    }
                );
                if (Array.isArray(gqlUsers) && gqlUsers.length > 0) {
                    users = API.mergeExtractedUsers(users, gqlUsers);
                }
            } catch (gqlErr) {
                if (gqlErr.name === 'AbortError' || options.signal?.aborted) throw gqlErr;
                if (Array.isArray(gqlErr.partialUsers) && gqlErr.partialUsers.length > 0) {
                    users = API.mergeExtractedUsers(users, gqlErr.partialUsers);
                }
                if (gqlErr.isRateLimited) {
                    rateLimited = true;
                } else if (!friendshipsSuccess) {
                    Utils.logError(`GraphQL fallback failed for ${label}`, gqlErr);
                }
            }

            if (friendshipsSuccess && users.length > beforeGqlCount) {
                logMsg(`[Reconciled] Recovered +${users.length - beforeGqlCount} '${label}' account(s) via GraphQL.`);
            }
        }

        if (users.length > 0) {
            reportProgress(users.length, users.length, `Extracted ${label} (${users.length})`);
        }

        const isPartial = Boolean(
            rateLimited ||
            limitedByMeta ||
            (expectedTotal >= 20 && users.length < expectedTotal * 0.85)
        );

        return {
            users,
            friendshipsSuccess,
            limitedByMeta,
            isPartial,
            rateLimited
        };
    },

    getAllUsers: async (userId, hash, label, options = {}, expectedTotal = 0) => {
        const result = await API.extractCompleteUserList(userId, hash, label, options, expectedTotal);
        const users = result.users;

        const withIdCount = users.filter((u) => !!u.id).length;
        UI.log("Total " + label + ": " + users.length + " (with IDs: " + withIdCount + ")");

        if (expectedTotal > 0 && users.length < expectedTotal) {
            UI.log(`[Info] Profile header counter: ${expectedTotal} ${label} | Accessible accounts returned by list API: ${users.length}.`);
        }

        return users;
    },
});
