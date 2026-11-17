import { CONFIG } from './Config.js';

export const Utils = {
    sleep: (ms, signal = null) => new Promise((resolve, reject) => {
        if (signal?.aborted) {
            return reject(new DOMException("Aborted", "AbortError"));
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = setTimeout(() => {
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        if (signal) {
            signal.addEventListener("abort", onAbort, { once: true });
        }
    }),
    now: () => (new Date()).toISOString(),

    /**
     * Returns a location-agnostic calendar date string (YYYY-MM-DD) in the viewer's local time zone.
     * Uses Temporal.PlainDate / Temporal.Now when available and falls back to local Date calendar fields.
     * @param {Date | string | number | null} [dateInput=null]
     * @returns {string}
     */
    localDateStr: (dateInput = null) => {
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
            return dateInput.trim();
        }
        try {
            if (dateInput === null || dateInput === undefined) {
                if (typeof globalThis.Temporal !== 'undefined' && typeof globalThis.Temporal.Now?.plainDateISO === 'function') {
                    return globalThis.Temporal.Now.plainDateISO().toString();
                }
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }

            const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
            if (Number.isNaN(d.getTime())) {
                return Utils.localDateStr(null);
            }

            if (typeof globalThis.Temporal !== 'undefined' && typeof globalThis.Temporal.Instant?.fromEpochMilliseconds === 'function') {
                const tz = globalThis.Temporal.Now.timeZoneId();
                return globalThis.Temporal.Instant.fromEpochMilliseconds(d.getTime())
                    .toZonedDateTimeISO(tz)
                    .toPlainDate()
                    .toString();
            }

            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch (e) {
            const fallback = new Date();
            return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, '0')}-${String(fallback.getDate()).padStart(2, '0')}`;
        }
    },

    /**
     * Returns wall-clock local time formatted as HH:MM:SS.
     * @param {Date | string | number | null} [dateInput=null]
     * @returns {string}
     */
    localTimeStr: (dateInput = null) => {
        try {
            if ((dateInput === null || dateInput === undefined) && typeof globalThis.Temporal !== 'undefined' && typeof globalThis.Temporal.Now?.plainTimeISO === 'function') {
                const pt = globalThis.Temporal.Now.plainTimeISO();
                return `${String(pt.hour).padStart(2, '0')}:${String(pt.minute).padStart(2, '0')}:${String(pt.second).padStart(2, '0')}`;
            }
            const d = (dateInput === null || dateInput === undefined)
                ? new Date()
                : (dateInput instanceof Date ? dateInput : new Date(dateInput));
            if (Number.isNaN(d.getTime())) return '';
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        } catch (e) {
            return '';
        }
    },

    log: (msg) => console.log(`[IG Analyzer] ${msg}`),
    logError: (msg, err) => console.error(`[IG Analyzer Error] ${msg}`, err),

    escapeHtml: (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    sanitizeUrl: (username, customUrl) => {
        const cleanUser = String(username || '').replace(/^@+/, '').trim();
        if (cleanUser) {
            return `https://www.instagram.com/${encodeURIComponent(cleanUser)}/`;
        }
        if (customUrl) {
            try {
                const parsed = new URL(customUrl, window.location.origin);
                if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('instagram.com')) {
                    return Utils.escapeHtml(parsed.href);
                }
            } catch (e) {
                Utils.logError('Error parsing custom URL', e);
            }
        }
        return 'https://www.instagram.com/';
    },

    isCdnUrlExpired: (url) => {
        if (!url || typeof url !== 'string') return true;
        try {
            const clean = url.replace(/&amp;/g, '&');
            const parsed = new URL(clean, window.location.origin);
            const oeHex = parsed.searchParams.get('oe');
            if (oeHex) {
                const expSec = parseInt(oeHex, 16);
                if (!isNaN(expSec) && expSec > 0) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    return expSec <= nowSec;
                }
            }
        } catch (e) {}
        return false;
    },

    sanitizeImageUrl: (url) => {
        if (!url || typeof url !== 'string') return null;
        try {
            // Strip corrupted HTML entities (&amp;) to prevent breaking Meta CDN HMAC signature
            const clean = url.replace(/&amp;/g, '&').trim();
            if (Utils.isCdnUrlExpired(clean)) {
                return null;
            }
            const parsed = new URL(clean, window.location.origin);
            if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
                return parsed.href;
            }
        } catch (e) {
            Utils.logError('Error parsing image URL', e);
        }
        return null;
    },

    getCsrfToken: () => {
        const match = document.cookie.match(/(?:^|;\s*)csrftoken=([a-zA-Z0-9_-]+)/);
        return match ? match[1] : '';
    },

    getDtsg: () => {
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            if (win.DTSGInitialData?.token) return win.DTSGInitialData.token;
            if (win.DTSGInitData?.token) return win.DTSGInitData.token;
            if (typeof win.require === 'function') {
                const mod = win.require('DTSGInitialData') || win.require('DTSGInitData');
                if (mod?.token) return mod.token;
            }
        } catch (e) {}

        try {
            const inputEl = document.querySelector('input[name="fb_dtsg"]');
            if (inputEl?.value) return inputEl.value;
        } catch (e) {}

        try {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const text = script.textContent || '';
                if (!text) continue;
                const match = text.match(/"DTSGInitialData",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
                              text.match(/\["DTSGInitData",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
                              text.match(/["']token["']\s*:\s*["'](NAf[a-zA-Z0-9_\-:]+)["']/) ||
                              text.match(/name=["']fb_dtsg["']\s+value=["']([^"']+)["']/) ||
                              text.match(/"fb_dtsg"\s*:\s*"([^"]+)"/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        } catch (e) {}

        return '';
    },

    calculateJazoest: (dtsg) => {
        if (!dtsg || typeof dtsg !== 'string') return '';
        let sum = 0;
        for (let i = 0; i < dtsg.length; i++) {
            sum += dtsg.charCodeAt(i);
        }
        return '2' + sum;
    },

    getLsd: () => {
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            if (win._LSD?.token) return win._LSD.token;
            if (win.LSD?.token) return win.LSD.token;
            if (typeof win.require === 'function') {
                const mod = win.require('LSD');
                if (mod?.token) return mod.token;
            }
        } catch (e) {}

        try {
            const inputEl = document.querySelector('input[name="lsd"]');
            if (inputEl?.value) return inputEl.value;
        } catch (e) {}

        try {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const text = script.textContent || '';
                if (!text) continue;
                const match = text.match(/"LSD",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
                              text.match(/["']lsd["']\s*:\s*["']([^"']+)["']/) ||
                              text.match(/name=["']lsd["']\s+value=["']([^"']+)["']/);
                if (match && match[1]) {
                    return match[1];
                }
            }
        } catch (e) {}

        return '';
    },

    generateUuid: () => {
        try {
            if (typeof globalThis.crypto?.randomUUID === 'function') {
                return globalThis.crypto.randomUUID();
            }
        } catch (e) {}
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.floor(Math.random() * 16);
            const v = c === 'x' ? r : ((r & 0x3) | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Dynamically resolves the active numeric Relay GraphQL doc_id for a given Polaris operation
     * directly from Instagram's live module loader (`unsafeWindow.require`) or inline bundles,
     * falling back safely when running offline or in test harnesses.
     * @param {string} operationName
     * @param {string | null} [fallbackDocId=null]
     * @returns {string | null}
     */
    getRelayDocId: (operationName, fallbackDocId = null) => {
        if (!operationName || typeof operationName !== 'string') return fallbackDocId;
        const isNumericDocId = (val) => val !== null && val !== undefined && /^[0-9]{10,25}$/.test(String(val).trim());

        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            if (typeof win?.require === 'function') {
                const candidateModules = [
                    `${operationName}_instagramRelayOperation`,
                    `${operationName}$Parameters`,
                    operationName
                ];
                for (const modName of candidateModules) {
                    try {
                        const mod = win.require(modName);
                        if (isNumericDocId(mod)) return String(mod).trim();
                        if (isNumericDocId(mod?.default)) return String(mod.default).trim();
                        if (isNumericDocId(mod?.params?.id)) return String(mod.params.id).trim();
                        if (isNumericDocId(mod?.default?.params?.id)) return String(mod.default.params.id).trim();
                        if (isNumericDocId(mod?.id)) return String(mod.id).trim();
                    } catch (innerErr) {
                        // Module may not be loaded in current chunk; continue checking candidates
                    }
                }
            }
        } catch (e) {}

        try {
            const scripts = document.querySelectorAll('script:not([src])');
            const escapedOp = operationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const opRegex = new RegExp(
                `(?:"${escapedOp}_instagramRelayOperation"[^"0-9]{1,80}"([0-9]{10,25})")|(?:"name"\\s*:\\s*"${escapedOp}"[\\s\\S]{1,160}?"id"\\s*:\\s*"([0-9]{10,25})")`
            );
            for (const script of scripts) {
                const text = script.textContent || '';
                if (!text || !text.includes(operationName)) continue;
                const match = text.match(opRegex);
                const resolved = match?.[1] || match?.[2] || null;
                if (isNumericDocId(resolved)) {
                    return String(resolved).trim();
                }
            }
        } catch (e) {}

        return fallbackDocId;
    },

    getUserId: () => {
        // 1. Check document.cookie (strictly non-zero)
        const matchCookie = document.cookie.match(/(?:^|;\s*)ds_user_id=([1-9][0-9]*)/);
        if (matchCookie && matchCookie[1] && matchCookie[1] !== "0") {
            return matchCookie[1];
        }

        // 2. Check window / unsafeWindow viewer objects (never rawProfileUser, which belongs to visited profiles)
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const viewerId = win._sharedData?.config?.viewerId || 
                             win._sharedData?.config?.viewer?.id ||
                             win.__initialData?.pending?.viewer?.id || 
                             win.__initialData?.data?.viewer?.id;
            if (viewerId && String(viewerId) !== "0" && /^[1-9][0-9]*$/.test(String(viewerId))) {
                return String(viewerId);
            }
            const lsId = win.localStorage?.getItem('ds_user_id') || win.sessionStorage?.getItem('ds_user_id');
            if (lsId && String(lsId) !== "0" && /^[1-9][0-9]*$/.test(String(lsId))) {
                return String(lsId);
            }
        } catch (e) {
        }

        // 3. Search script tags for real, non-zero viewer IDs
        try {
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const text = script.textContent || '';
                if (!text) continue;

                // Priority A: viewer object id
                const viewerObj = text.match(/"viewer"\s*:\s*\{\s*"id"\s*:\s*"([1-9][0-9]*)"/);
                if (viewerObj && viewerObj[1] && viewerObj[1] !== "0") return viewerObj[1];

                // Priority B: viewerId or ds_user_id (strictly non-zero)
                const vIdMatch = text.match(/"(?:viewerId|ds_user_id)"\s*:\s*"([1-9][0-9]*)"/);
                if (vIdMatch && vIdMatch[1] && vIdMatch[1] !== "0") return vIdMatch[1];

                // Priority C: USER_ID or actorID (strictly non-zero)
                const userMatch = text.match(/"(?:USER_ID|actorID)"\s*:\s*"([1-9][0-9]*)"/);
                if (userMatch && userMatch[1] && userMatch[1] !== "0") return userMatch[1];
            }
        } catch (e) {
        }

        return null;
    },

    getUsername: () => {
        // 1. Check window / unsafeWindow viewer objects (never rawProfileUser)
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const u = win._sharedData?.config?.viewer?.username || 
                      win.__initialData?.data?.viewer?.username || 
                      win.__initialData?.pending?.viewer?.username;
            if (u && typeof u === 'string') return u.trim();
        } catch (e) {}

        // 2. Check profile link in navigation
        try {
            const navLink = document.querySelector('nav a[href^="/"][role="link"], a[href^="/"][aria-label*="Profile" i], a[href^="/"][aria-label*="Perfil" i]');
            if (navLink) {
                const href = navLink.getAttribute('href') || '';
                const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
                if (match) {
                    const candidate = match[1];
                    const systemRoutes = ['explore', 'reels', 'direct', 'stories', 'your_activity', 'settings', 'accounts', 'developer', 'about', 'p', 'reel'];
                    if (!systemRoutes.includes(candidate.toLowerCase())) {
                        return candidate;
                    }
                }
            }
        } catch (e) {}

        return null;
    },

    getUserIdAsync: async (signal = null) => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        // First try synchronous resolution
        const syncId = Utils.getUserId();
        if (syncId && syncId !== "0") {
            return syncId;
        }

        const csrf = Utils.getCsrfToken();
        const baseHeaders = { 
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
            ...(csrf ? { "X-CSRFToken": csrf } : {})
        };

        // Fallback A: Fetch account edit form data to get the active username safely (1 official request)
        try {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const res = await fetch("https://www.instagram.com/api/v1/accounts/edit/web_form_data/", {
                headers: baseHeaders,
                credentials: "include",
                signal
            });
            if (res.ok) {
                const data = await res.json();
                const username = data?.form_data?.username;
                if (username) {
                    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
                    const profileRes = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
                        credentials: "include",
                        signal
                    });
                    if (profileRes.ok) {
                        const html = await profileRes.text();
                        const idMatch = html.match(/"id"\s*:\s*"([1-9][0-9]*)"/) || 
                                        html.match(/"user_id"\s*:\s*"([1-9][0-9]*)"/) || 
                                        html.match(/"pk"\s*:\s*"([1-9][0-9]*)"/);
                        if (idMatch && idMatch[1] && idMatch[1] !== "0") return idMatch[1];
                    }
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || signal?.aborted) throw e;
            Utils.logError("Async user ID detection fallback A failed", e);
        }

        // Fallback B: Look specifically for the user's own profile link in the navigation menu (at most 1 target check)
        try {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const navLink = document.querySelector('nav a[href^="/"][role="link"], a[href^="/"][aria-label*="Profile" i], a[href^="/"][aria-label*="Perfil" i]');
            if (navLink) {
                const href = navLink.getAttribute('href') || '';
                const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
                if (match) {
                    const candidate = match[1];
                    const systemRoutes = ['explore', 'reels', 'direct', 'stories', 'your_activity', 'settings', 'accounts', 'developer', 'about', 'p', 'reel'];
                    if (!systemRoutes.includes(candidate.toLowerCase())) {
                        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
                        const profileRes = await fetch(`https://www.instagram.com/${encodeURIComponent(candidate)}/`, {
                            credentials: "include",
                            signal
                        });
                        if (profileRes.ok) {
                            const html = await profileRes.text();
                            const idMatch = html.match(/"id"\s*:\s*"([1-9][0-9]*)"/) || 
                                            html.match(/"user_id"\s*:\s*"([1-9][0-9]*)"/) || 
                                            html.match(/"pk"\s*:\s*"([1-9][0-9]*)"/);
                            if (idMatch && idMatch[1] && idMatch[1] !== "0") return idMatch[1];
                        }
                    }
                }
            }
        } catch (e) {
            if (e.name === 'AbortError' || signal?.aborted) throw e;
            Utils.logError("Async user ID detection fallback B failed", e);
        }

        return null;
    },
    diff: (a, b) => {
        const setB = new Set(b);
        return a.filter(x => !setB.has(x));
    },
    intersection: (a, b) => {
        const setB = new Set(b);
        return a.filter(x => setB.has(x));
    },
    unique: (arr) => [...new Set(arr)],

    /**
     * Normalizes and deduplicates an array of user strings or objects while preserving enriched badges/metadata.
     * @param {Array<string | object>} arr
     * @returns {Array<object>}
     */
    toDetailedUserArray: (arr) => {
        if (!Array.isArray(arr)) return [];
        const seenIds = new Set();
        const seenUsernames = new Set();
        const result = [];

        for (const u of arr) {
            let normalized = null;
            if (typeof u === "string") {
                const cleanName = String(u).replace(/^@+/, '').trim();
                if (cleanName) {
                    normalized = {
                        id: null,
                        username: cleanName,
                        fullName: "",
                        isPrivate: false,
                        isVerified: false,
                        profilePicUrl: null,
                        latestReelMedia: 0,
                        isBestie: false,
                        outgoingRequest: false,
                        url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
                    };
                }
            } else if (u && typeof u === "object") {
                const rawName = u.username || u.name || '';
                const cleanName = String(rawName).replace(/^@+/, '').trim();
                if (cleanName) {
                    const pic = Utils.sanitizeImageUrl(u.profilePicUrl || u.profile_pic_url || null);
                    const idStr = (u.id && String(u.id) !== "0" && String(u.id) !== "null" && String(u.id) !== "undefined")
                        ? String(u.id)
                        : null;
                    normalized = {
                        id: idStr,
                        username: cleanName,
                        fullName: u.fullName || u.full_name || "",
                        isPrivate: Boolean(u.isPrivate ?? u.is_private),
                        isVerified: Boolean(u.isVerified ?? u.is_verified),
                        profilePicUrl: pic,
                        latestReelMedia: u.latestReelMedia ?? u.latest_reel_media ?? 0,
                        isBestie: Boolean(u.isBestie ?? u.is_bestie),
                        outgoingRequest: Boolean(u.outgoingRequest ?? u.outgoing_request),
                        url: `https://www.instagram.com/${encodeURIComponent(cleanName)}/`
                    };
                    if (u.followsBack !== undefined && u.followsBack !== null) {
                        normalized.followsBack = Boolean(u.followsBack);
                    }
                    if (u.date) {
                        normalized.date = String(u.date);
                    }
                    if (u.isBusiness !== undefined) {
                        normalized.isBusiness = Boolean(u.isBusiness);
                    }
                    if (u.isCreator !== undefined) {
                        normalized.isCreator = Boolean(u.isCreator);
                    }
                    if (u.category) {
                        normalized.category = String(u.category);
                    }
                    if (u.isViewerMutual !== undefined) {
                        normalized.isViewerMutual = Boolean(u.isViewerMutual);
                    }
                    if (u.previousUsername) {
                        normalized.previousUsername = String(u.previousUsername);
                    }
                    if (u.occurrences !== undefined && u.occurrences !== null) {
                        normalized.occurrences = Number(u.occurrences) || 1;
                    }
                }
            }

            if (!normalized) continue;

            const lowerName = normalized.username.toLowerCase();
            if ((normalized.id && seenIds.has(normalized.id)) || seenUsernames.has(lowerName)) {
                continue;
            }
            if (normalized.id) seenIds.add(normalized.id);
            seenUsernames.add(lowerName);
            result.push(normalized);
        }

        return result;
    },

    deduplicateUsers: (arr) => Utils.toDetailedUserArray(arr),

    mapById: (arr) => {
        const map = new Map();
        (arr || []).forEach((u) => {
            if (u?.id && String(u.id) !== "0") map.set(String(u.id), u);
        });
        return map;
    },

    intersectionById: (a, b) => {
        const bIDs = new Set((b || []).map((x) => x?.id ? String(x.id) : null).filter(Boolean));
        return (a || []).filter((x) => x?.id && bIDs.has(String(x.id)));
    },

    /**
     * Detects accounts that kept the same immutable Instagram numeric ID while changing their @username.
     * @param {Array<object>} prevUsers
     * @param {Array<object>} currentUsers
     * @returns {Array<object>}
     */
    detectRenamedUsers: (prevUsers, currentUsers) => {
        const prevById = Utils.mapById(prevUsers);
        const currById = Utils.mapById(currentUsers);

        const changes = [];
        prevById.forEach((prevUser, id) => {
            const currUser = currById.get(id);
            if (!currUser || !prevUser?.username || !currUser?.username) return;
            if (prevUser.username !== currUser.username) {
                changes.push({
                    id: String(id),
                    oldUsername: prevUser.username,
                    newUsername: currUser.username,
                    fullName: currUser.fullName || prevUser.fullName || "",
                    profilePicUrl: currUser.profilePicUrl || prevUser.profilePicUrl || null,
                    isVerified: Boolean(currUser.isVerified ?? prevUser.isVerified),
                    isPrivate: Boolean(currUser.isPrivate ?? prevUser.isPrivate)
                });
            }
        });
        return changes;
    },

    detectRenamedMutuals: (prevMutuals, currentMutuals) => Utils.detectRenamedUsers(prevMutuals, currentMutuals),

    exportCSV: (data, filename) => {
        if (!data || !data.length) return;

        const sanitizeCell = (val) => {
            let text = String(val ?? '');
            // Mitigate CSV Formula Injection (CWE-1236)
            if (/^[=+\-@\t\r]/.test(text)) {
                text = "'" + text;
            }
            // RFC 4180: Escape quotes and wrap in quotes
            return `"${text.replace(/"/g, '""')}"`;
        };

        const hasRenamedCols = data.some((u) => u && typeof u === 'object' && (u.oldUsername || u.newUsername));
        const hasPrevUserCol = !hasRenamedCols && data.some((u) => u && typeof u === 'object' && u.previousUsername);
        const hasOccurrencesCol = !hasRenamedCols && data.some((u) => u && typeof u === 'object' && Number(u.occurrences) > 1);
        const hasDateCol = data.some((u) => u && typeof u === 'object' && u.date);

        let headerCols = ['Username'];
        if (hasRenamedCols) {
            headerCols = ['Previous Username', 'Current Username', 'Relationship'];
        } else {
            if (hasPrevUserCol) headerCols.push('Previous Username');
            if (hasOccurrencesCol) headerCols.push('Occurrences');
        }
        if (hasDateCol) headerCols.push('Detected Date');
        headerCols.push('Profile URL');

        const header = headerCols.map(sanitizeCell).join(',');
        const rows = data.map((u) => {
            const isObj = u && typeof u === 'object';
            const uName = typeof u === 'string' ? u : (u?.newUsername || u?.username || '');
            const profileUrl = (isObj && u?.url) ? u.url : Utils.sanitizeUrl(uName);
            let cols = [uName];

            if (hasRenamedCols) {
                cols = [
                    isObj ? (u.oldUsername || '') : '',
                    uName,
                    isObj ? (u.relationship || '') : ''
                ];
            } else {
                if (hasPrevUserCol) cols.push(isObj ? (u.previousUsername || '') : '');
                if (hasOccurrencesCol) cols.push(isObj ? String(Number(u.occurrences) || 1) : '1');
            }
            if (hasDateCol) cols.push(isObj ? (u.date || '') : '');
            cols.push(profileUrl);

            return cols.map(sanitizeCell).join(',');
        });
        // Include UTF-8 BOM (\uFEFF) for universal spreadsheet compatibility
        const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    exportHistoryCSV: (historyList, filename) => {
        if (!Array.isArray(historyList) || historyList.length === 0) return;

        const sanitizeCell = (val) => {
            let text = String(val ?? '');
            if (/^[=+\-@\t\r]/.test(text)) {
                text = "'" + text;
            }
            return `"${text.replace(/"/g, '""')}"`;
        };

        const headerCols = [
            'Date',
            'Followers',
            'Start Followers',
            'Day Delta Followers',
            'Intraday Delta Followers',
            'Following',
            'Day Delta Following',
            'Mutuals',
            'Scans Count'
        ];

        const header = headerCols.map(sanitizeCell).join(',');
        const rows = historyList.map((entry) => {
            const followers = Number(entry?.followers ?? 0);
            const startFollowers = Number(entry?.startFollowers ?? followers);
            const dayDeltaFollowers = Number(entry?.dayDeltaFollowers ?? entry?.lastDeltaFollowers ?? 0);
            const intradayDeltaFollowers = Number(entry?.intradayDeltaFollowers ?? (followers - startFollowers));
            const following = Number(entry?.following ?? 0);
            const dayDeltaFollowing = Number(entry?.dayDeltaFollowing ?? entry?.lastDeltaFollowing ?? 0);
            const mutuals = (entry?.mutuals !== undefined && entry?.mutuals !== null) ? Number(entry.mutuals) : '';
            const scansCount = Number(entry?.scansCount || 1);

            return [
                entry?.date || '',
                followers,
                startFollowers,
                dayDeltaFollowers,
                intradayDeltaFollowers,
                following,
                dayDeltaFollowing,
                mutuals,
                scansCount
            ].map(sanitizeCell).join(',');
        });

        const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename || `ig_history_${Utils.localDateStr()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    downloadImage: async (url, filename) => {
        if (!url) return;
        const cleanUrl = String(url).replace(/&amp;/g, '&').trim();
        const safeFilename = filename || 'instagram_profile_hd.jpg';

        if (typeof GM_download === 'function') {
            try {
                GM_download({
                    url: cleanUrl,
                    name: safeFilename,
                    saveAs: false,
                    onerror: () => {
                        Utils.downloadImageFallback(cleanUrl, safeFilename);
                    }
                });
                return;
            } catch (e) {
                console.warn('[IG Analyzer] GM_download failed, fallback to blob:', e);
            }
        }

        await Utils.downloadImageFallback(cleanUrl, safeFilename);
    },

    downloadImageFallback: async (url, filename) => {
        try {
            const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
            console.warn('[IG Analyzer] Blob download failed, opening in new tab:', err);
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    },

    formatNumber: (num) => {
        if (num === null || num === undefined || isNaN(num)) return '-';
        const n = Number(num);
        if (n >= 1000000) {
            return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (n >= 10000) {
            return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return n.toLocaleString();
    },

    formatExactNumber: (num) => {
        if (num === null || num === undefined || num === '' || isNaN(Number(num))) return '—';
        return Number(num).toLocaleString();
    },

    formatDate: (isoOrTimestamp) => {
        if (!isoOrTimestamp) return '-';
        try {
            const raw = String(isoOrTimestamp).trim();
            // Prevent UTC-midnight date shift for location-agnostic calendar strings (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                if (typeof globalThis.Temporal !== 'undefined' && typeof globalThis.Temporal.PlainDate?.from === 'function') {
                    return globalThis.Temporal.PlainDate.from(raw).toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
                const [y, m, day] = raw.split('-').map(Number);
                const localDay = new Date(y, m - 1, day);
                return localDay.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }

            const d = isoOrTimestamp instanceof Date ? isoOrTimestamp : new Date(isoOrTimestamp);
            if (isNaN(d.getTime())) return String(isoOrTimestamp);
            return d.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(isoOrTimestamp);
        }
    }
};