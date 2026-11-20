import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

const normalizeUserId = (rawId) => {
    if (rawId === null || rawId === undefined) return null;
    const str = String(rawId).trim();
    if (!str || str === '0' || str === 'null' || str === 'undefined') return null;
    return str;
};

let cumulativeBurstPages = 0;
let lastBurstPageTimestamp = 0;

const recordBurstPageAndGetCount = () => {
    const now = Date.now();
    if (lastBurstPageTimestamp > 0 && (now - lastBurstPageTimestamp) > 30000) {
        cumulativeBurstPages = 0;
    }
    cumulativeBurstPages++;
    lastBurstPageTimestamp = now;
    return cumulativeBurstPages;
};

const sleepPaginationDelay = async (burstPageCount, signal) => {
    const baseDelay = (CONFIG.FRIENDSHIPS_RATE_LIMIT_MS || CONFIG.BASE_RATE_LIMIT_MS || 1400) + Math.random() * 750;
    const breatherEvery = CONFIG.BREATHER_EVERY_PAGES || 8;
    const extraBreather = (burstPageCount > 0 && burstPageCount % breatherEvery === 0)
        ? ((CONFIG.BREATHER_PAUSE_MS || 3200) + Math.random() * 1000)
        : 0;
    await Utils.sleep(baseDelay + extraBreather, signal);
};

Object.assign(API, {
    mergeExtractedUsers: (primaryList = [], secondaryList = []) => {
        const merged = [];
        const indexById = new Map();
        const indexByLower = new Map();

        const upsert = (rawUser) => {
            if (!rawUser || typeof rawUser !== 'object') return;
            const username = rawUser.username ? String(rawUser.username).trim() : '';
            if (!username) return;

            const id = normalizeUserId(rawUser.id ?? rawUser.pk_id ?? rawUser.strong_id__ ?? rawUser.pk ?? null);
            const lower = username.toLowerCase();

            const rawPriv = rawUser.isPrivate !== undefined ? rawUser.isPrivate : rawUser.is_private;
            const hasExplicitPrivate = typeof rawUser.isPrivateKnown === 'boolean'
                ? rawUser.isPrivateKnown
                : typeof rawPriv === 'boolean';
            const isBestie = Boolean(rawUser.isBestie ?? rawUser.is_bestie ?? rawUser.friendship_status?.is_bestie);
            const outgoingRequest = Boolean(rawUser.outgoingRequest ?? rawUser.outgoing_request ?? rawUser.friendship_status?.outgoing_request);
            const profilePicUrl = rawUser.hd_profile_pic_url_info?.url || rawUser.profilePicUrl || rawUser.profile_pic_url || null;
            const latestReelMedia = Number(rawUser.latestReelMedia ?? rawUser.latest_reel_media ?? rawUser.reel?.latest_reel_media ?? 0) || 0;
            const fullName = rawUser.fullName || rawUser.full_name || "";
            const isVerified = Boolean(rawUser.isVerified ?? rawUser.is_verified);

            const existingIdx = (id && indexById.has(id))
                ? indexById.get(id)
                : (indexByLower.has(lower) ? indexByLower.get(lower) : -1);

            if (existingIdx !== -1 && existingIdx !== undefined) {
                const existing = merged[existingIdx];
                if (!existing.id && id) {
                    existing.id = id;
                    indexById.set(id, existingIdx);
                }
                if (!existing.fullName && fullName) existing.fullName = fullName;
                if (!existing.profilePicUrl && profilePicUrl) existing.profilePicUrl = profilePicUrl;
                if ((!existing.isPrivateKnown || existing.isPrivate === null || existing.isPrivate === undefined) && hasExplicitPrivate) {
                    existing.isPrivate = Boolean(rawPriv);
                    existing.isPrivateKnown = true;
                } else if (existing.isPrivate === false && rawPriv === true) {
                    existing.isPrivate = true;
                    existing.isPrivateKnown = true;
                }
                if (!existing.isVerified && isVerified) existing.isVerified = true;
                if (!existing.isBestie && isBestie) existing.isBestie = true;
                if (!existing.outgoingRequest && outgoingRequest) existing.outgoingRequest = true;
                if (latestReelMedia > (existing.latestReelMedia || 0)) existing.latestReelMedia = latestReelMedia;
                return;
            }

            const entry = {
                id,
                username,
                fullName,
                isPrivate: hasExplicitPrivate ? Boolean(rawPriv) : null,
                isPrivateKnown: hasExplicitPrivate,
                isVerified,
                profilePicUrl,
                latestReelMedia,
                isBestie,
                outgoingRequest
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
        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        const isNumericDocId = (val) => typeof val === 'string' && /^[0-9]{10,25}$/.test(val.trim());
        const defaultFollowDocId = CONFIG.RELAY_DOC_IDS?.FOLLOW_LIST_QUERY || "40819242737691319";
        const hashStr = String(hash || '').trim();
        const activeDocId = isNumericDocId(hashStr)
            ? hashStr
            : await Utils.resolveRelayDocIdAsync(
                "usePolarisGetFollowListQuery",
                defaultFollowDocId,
                "PolarisFollowListModal.next.react"
            );

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        const users = [];
        const seenIds = new Set();
        const seenUsernames = new Set();
        const seenCursors = new Set();
        let cursor = null;
        let hasNext = true;
        let totalCount = expectedTotal || 0;
        let limitedByMeta = false;
        let pagesFetched = 0;
        let rawItemsCount = 0;
        let duplicateItemsCount = 0;

        const isFollowerList = label !== "following";
        const pageSize = Number(options.pageSize) > 0
            ? Number(options.pageSize)
            : (CONFIG.GRAPHQL_FOLLOW_LIST_PAGE_SIZE || 20);
        const viewerId = Utils.getUserId() || "0";
        const dtsg = Utils.getDtsg();
        const jazoest = Utils.calculateJazoest(dtsg);
        const lsd = Utils.getLsd();

        const endpoints = [
            "https://www.instagram.com/graphql/query",
            "https://www.instagram.com/api/graphql"
        ];
        let endpointIdx = 0;

        const reportProgress = typeof callbacks?.onProgress === 'function'
            ? callbacks.onProgress
            : (curr, total, msg) => UI.setProgress(curr, total, msg);

        try {
            while (hasNext) {
                if (options.signal?.aborted) {
                    throw new DOMException("Aborted", "AbortError");
                }

                const params = new URLSearchParams();
                params.append("av", viewerId);
                params.append("__d", "www");
                params.append("__user", "0");
                params.append("__a", "1");
                params.append("__req", String(pagesFetched + 1));
                params.append("fb_api_caller_class", "RelayModern");
                params.append("fb_api_req_friendly_name", "usePolarisGetFollowListQuery");
                params.append("doc_id", activeDocId);
                params.append("server_timestamps", "true");
                params.append("variables", JSON.stringify({
                    after: cursor,
                    before: null,
                    first: pageSize,
                    isFollowerList,
                    last: null,
                    query: "",
                    userID: String(userId)
                }));
                if (dtsg) params.append("fb_dtsg", dtsg);
                if (jazoest) params.append("jazoest", jazoest);
                if (lsd) params.append("lsd", lsd);

                const headers = {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-FB-Friendly-Name": "usePolarisGetFollowListQuery",
                    ...(lsd ? { "X-FB-LSD": lsd } : {}),
                    ...(options.headers || {})
                };

                let json;
                let activeConn;
                try {
                    json = await API.fetchWithRetry(endpoints[endpointIdx], {
                        ...options,
                        method: "POST",
                        headers,
                        body: params.toString(),
                        abortOnRateLimit: true
                    });

                    const conn = label === "following"
                        ? (json?.data?.xdt_api__v1__friendships__following__connection || json?.data?.xdt_api__v1__friendships__followers__connection)
                        : (json?.data?.xdt_api__v1__friendships__followers__connection || json?.data?.xdt_api__v1__friendships__following__connection);
                    const legacyUserNode = json?.data?.user;
                    const legacyEdge = label === "following"
                        ? (legacyUserNode?.edge_follow || legacyUserNode?.edge_followed_by)
                        : (legacyUserNode?.edge_followed_by || legacyUserNode?.edge_follow);
                    activeConn = (conn && Array.isArray(conn.edges))
                        ? conn
                        : ((legacyEdge && Array.isArray(legacyEdge.edges)) ? legacyEdge : null);

                    if (!activeConn) {
                        const gqlErrMsg = Array.isArray(json?.errors) && json.errors[0]?.message
                            ? ` (${json.errors[0].message})`
                            : '';
                        if (!options.silent) {
                            console.warn(`[IG Analyzer] GraphQL Relay returned invalid ${label} connection:`, json);
                        }
                        if (pagesFetched === 0) {
                            throw new Error(`GraphQL Relay returned invalid ${label} payload${gqlErrMsg}`);
                        }
                        break;
                    }
                } catch (reqErr) {
                    if (reqErr.name === 'AbortError' || options.signal?.aborted || reqErr.isRateLimited) {
                        throw reqErr;
                    }
                    if (pagesFetched === 0 && endpointIdx + 1 < endpoints.length) {
                        endpointIdx++;
                        continue;
                    }
                    throw reqErr;
                }

                pagesFetched++;
                const burstPages = recordBurstPageAndGetCount();

                if (activeConn.should_limit_list_of_followers || activeConn.should_limit_list_of_followings) {
                    limitedByMeta = true;
                }
                if (totalCount === 0 && activeConn.count) {
                    totalCount = Number(activeConn.count) || 0;
                }

                rawItemsCount += activeConn.edges.length;

                activeConn.edges.forEach((e) => {
                    const node = e?.node || e;
                    const username = node?.username ? String(node.username).trim() : '';
                    if (!username) return;

                    const id = normalizeUserId(node?.pk ?? node?.id ?? node?.pk_id ?? node?.strong_id__ ?? null);
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
                        fullName: node?.full_name || "",
                        isPrivate: typeof node?.is_private === 'boolean' ? node.is_private : null,
                        isVerified: Boolean(node?.is_verified),
                        profilePicUrl: node?.hd_profile_pic_url_info?.url || node?.profile_pic_url || null,
                        latestReelMedia: Number(node?.latest_reel_media ?? node?.reel?.latest_reel_media ?? 0) || 0,
                        isBestie: Boolean(node?.friendship_status?.is_bestie ?? node?.is_bestie),
                        outgoingRequest: Boolean(node?.friendship_status?.outgoing_request ?? node?.outgoing_request)
                    });
                });

                const nextCursor = (activeConn.page_info?.has_next_page === true && activeConn.page_info?.end_cursor)
                    ? String(activeConn.page_info.end_cursor)
                    : null;

                if (nextCursor && seenCursors.has(nextCursor)) {
                    console.warn(`[IG Analyzer] Duplicate GraphQL pagination cursor detected for ${label}, stopping loop.`);
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

                if (hasNext) {
                    await sleepPaginationDelay(burstPages, options.signal);
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
            value: { limitedByMeta, pagesFetched, rawItemsCount, duplicateItemsCount, engine: 'graphql' },
            enumerable: false,
            configurable: true
        });

        return users;
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
                const burstPages = recordBurstPageAndGetCount();

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

                    const id = normalizeUserId(u?.pk_id ?? u?.strong_id__ ?? u?.pk ?? u?.id ?? null);
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
                        latestReelMedia: u?.latest_reel_media || 0,
                        isBestie: Boolean(u?.friendship_status?.is_bestie ?? u?.is_bestie),
                        outgoingRequest: Boolean(u?.friendship_status?.outgoing_request ?? u?.outgoing_request)
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
                    await sleepPaginationDelay(burstPages, options.signal);
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
            value: { limitedByMeta, pagesFetched, rawItemsCount, duplicateItemsCount, engine: 'rest' },
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

        const rawEngine = String(options.engine || CONFIG.DEFAULT_EXTRACTION_ENGINE || "hybrid").toLowerCase();
        const engine = (rawEngine === "graphql" || rawEngine === "rest" || rawEngine === "hybrid") ? rawEngine : "hybrid";

        let users = [];
        let friendshipsSuccess = false;
        let graphqlSuccess = false;
        let limitedByMeta = false;
        let rateLimited = false;

        const runRest = async (isFallback = false) => {
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
                        onProgress: (curr, total, msg) => {
                            reportProgress(Math.max(users.length, curr), total, msg);
                        },
                        suppressFinalProgress: true
                    }
                );
                users = users.length > 0 ? API.mergeExtractedUsers(users, res) : res;
                limitedByMeta = limitedByMeta || Boolean(res?._meta?.limitedByMeta);
                friendshipsSuccess = true;
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) throw e;
                const partial = Array.isArray(e.partialUsers) ? e.partialUsers : [];
                if (partial.length > 0) {
                    users = users.length > 0 ? API.mergeExtractedUsers(users, partial) : partial;
                }
                friendshipsSuccess = false;
                if (e.isRateLimited) {
                    rateLimited = true;
                    logMsg(`[Anti-Ban Guard] Instagram rate limit (429) detected on '${label}' (${users.length} collected). Halting extraction immediately to protect your account.`);
                } else if (isFallback) {
                    Utils.logError(`REST fallback failed for ${label}`, e);
                } else {
                    console.warn(`[IG Analyzer] Friendships API error for ${label}:`, e?.message || e);
                }
            }
        };

        const runGraphQL = async (gqlOptions = {}, isReconciliation = false) => {
            try {
                const res = await API.getAllUsersViaGraphQL(
                    userId,
                    hash,
                    label,
                    {
                        pageSize: options.pageSize || CONFIG.GRAPHQL_FOLLOW_LIST_PAGE_SIZE || 20,
                        ...options,
                        ...gqlOptions,
                        abortOnRateLimit: true
                    },
                    expectedTotal,
                    {
                        onProgress: (curr, total, msg) => {
                            reportProgress(Math.max(users.length, curr), total, msg);
                        },
                        suppressFinalProgress: true
                    }
                );
                users = users.length > 0 ? API.mergeExtractedUsers(users, res) : res;
                limitedByMeta = limitedByMeta || Boolean(res?._meta?.limitedByMeta);
                graphqlSuccess = true;
            } catch (gqlErr) {
                if (gqlErr.name === 'AbortError' || options.signal?.aborted) throw gqlErr;
                const partial = Array.isArray(gqlErr.partialUsers) ? gqlErr.partialUsers : [];
                if (partial.length > 0) {
                    users = users.length > 0 ? API.mergeExtractedUsers(users, partial) : partial;
                }
                graphqlSuccess = false;
                if (gqlErr.isRateLimited) {
                    rateLimited = true;
                    logMsg(`[Anti-Ban Guard] Instagram rate limit (429) detected on '${label}' (${users.length} collected). Halting extraction immediately to protect your account.`);
                } else if (!isReconciliation) {
                    Utils.logError(`GraphQL Relay error for ${label}`, gqlErr);
                } else {
                    console.warn(`[IG Analyzer] GraphQL Relay reconciliation failed for ${label}:`, gqlErr?.message || gqlErr);
                }
            }
        };

        if (engine === "graphql") {
            await runGraphQL({ optional: false, silent: false }, false);

            if (!graphqlSuccess && !rateLimited) {
                if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
                logMsg(`GraphQL Relay interrupted for '${label}' (${users.length} partial). Falling back to REST Friendships API...`);
                if (users.length > 0) {
                    await Utils.sleep(800 + Math.random() * 400, options.signal);
                }
                await runRest(true);
            }
        } else {
            await runRest(false);

            const reconcileThreshold = Number(CONFIG.HYBRID_RECONCILE_THRESHOLD) || 0.92;
            const minMissingUsers = Number(CONFIG.HYBRID_MIN_MISSING_USERS) || 6;
            const missingCount = expectedTotal > 0 ? Math.max(0, expectedTotal - users.length) : 0;
            const needsHybridReconcile = engine === "hybrid" &&
                friendshipsSuccess &&
                !limitedByMeta &&
                expectedTotal >= 15 &&
                users.length < expectedTotal * reconcileThreshold &&
                missingCount >= minMissingUsers;

            const shouldRunGraphQL = !rateLimited && (!friendshipsSuccess || needsHybridReconcile);

            if (shouldRunGraphQL) {
                if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");

                if (!friendshipsSuccess) {
                    logMsg(`Friendships API interrupted for '${label}' (${users.length} partial). Completing via GraphQL Relay...`);
                }

                const beforeGqlCount = users.length;
                if (friendshipsSuccess && users.length > 0) {
                    await Utils.sleep(1200 + Math.random() * 600, options.signal);
                }

                await runGraphQL(
                    friendshipsSuccess ? { optional: true, silent: true } : {},
                    friendshipsSuccess
                );

                if (friendshipsSuccess && users.length > beforeGqlCount) {
                    logMsg(`[Reconciled] Recovered +${users.length - beforeGqlCount} '${label}' account(s) via GraphQL Relay.`);
                }
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
            graphqlSuccess,
            engineUsed: engine,
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
