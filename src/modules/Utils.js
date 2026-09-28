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
        if (customUrl) {
            try {
                const parsed = new URL(customUrl, window.location.origin);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    return Utils.escapeHtml(parsed.href);
                }
            } catch (e) {
                Utils.logError('Error parsing custom URL', e);
            }
        }
        const safeUser = encodeURIComponent(username || '');
        return `https://www.instagram.com/${safeUser}/`;
    },

    sanitizeImageUrl: (url) => {
        if (!url || typeof url !== 'string') return null;
        try {
            // Strip corrupted HTML entities (&amp;) to prevent breaking Meta CDN HMAC signature
            const clean = url.replace(/&amp;/g, '&').trim();
            const parsed = new URL(clean, window.location.origin);
            if (parsed.protocol === 'https:') {
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

    getUserId: () => {
        // 1. Check document.cookie (strictly non-zero)
        const matchCookie = document.cookie.match(/(?:^|;\s*)ds_user_id=([1-9][0-9]*)/);
        if (matchCookie && matchCookie[1] && matchCookie[1] !== "0") {
            return matchCookie[1];
        }

        // 2. Check window / unsafeWindow objects
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const viewerId = win._sharedData?.config?.viewerId || 
                             win.__initialData?.pending?.viewer?.id || 
                             win.__initialData?.data?.viewer?.id ||
                             win._sharedData?.rawProfileUser?.id;
            if (viewerId && String(viewerId) !== "0" && /^[1-9][0-9]*$/.test(String(viewerId))) {
                return String(viewerId);
            }
            const lsId = win.localStorage?.getItem('ds_user_id') || win.sessionStorage?.getItem('ds_user_id');
            if (lsId && String(lsId) !== "0" && /^[1-9][0-9]*$/.test(String(lsId))) {
                return String(lsId);
            }
        } catch (e) {
        }

        // 3. Search script tags for real, non-zero IDs
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

        // 4. Meta tag (owner_user_id)
        try {
            const metaTag = document.querySelector('meta[property="instapp:owner_user_id"]');
            if (metaTag && metaTag.content && metaTag.content !== "0" && /^[1-9][0-9]*$/.test(metaTag.content)) {
                return metaTag.content;
            }
        } catch (e) {
        }

        return null;
    },

    getUsername: () => {
        // 1. Check window / unsafeWindow objects
        try {
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const u = win._sharedData?.config?.viewer?.username || 
                      win.__initialData?.data?.viewer?.username || 
                      win.__initialData?.pending?.viewer?.username ||
                      win._sharedData?.rawProfileUser?.username;
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

    toDetailedUserArray: (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
        .map((u) => {
            if (typeof u === "string") return { id: null, username: u };
            if (u && typeof u.username === "string") {
                return { 
                    id: u.id ? String(u.id) : null, 
                    username: String(u.username),
                    fullName: u.fullName || u.full_name || "",
                    isPrivate: Boolean(u.isPrivate ?? u.is_private),
                    isVerified: Boolean(u.isVerified ?? u.is_verified),
                    profilePicUrl: u.profilePicUrl || u.profile_pic_url || null,
                    latestReelMedia: u.latestReelMedia ?? u.latest_reel_media ?? 0
                };
            }
            return null;
        })
        .filter(Boolean);
    },

    mapById: (arr) => {
        const map = new Map();
        (arr || []).forEach((u) => {
            if (u?.id) map.set(String(u.id), u);
        });
        return map;
    },

    intersectionById: (a, b) => {
        const bIDs = new Set((b || []).map((x) => x?.id).filter(Boolean));
        return (a || []).filter((x) => x?.id && bIDs.has(x.id));
    },

    detectRenamedMutuals: (prevMutuals, currentMutuals) => {
        const prevById = Utils.mapById(prevMutuals);
        const currById = Utils.mapById(currentMutuals);

        const changes = [];
        prevById.forEach((prevUser, id) => {
            const currUser = currById.get(id);
            if (!currUser) return;
            if (prevUser.username !== currUser.username) {
                changes.push({ 
                    id,
                    oldUsername: prevUser.username,
                    newUsername: currUser.username,
                 });
            }
        });
        return changes;
    },

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

        const header = ['Username', 'Profile URL'].map(sanitizeCell).join(',');
        const rows = data.map((u) => [u.username, u.url].map(sanitizeCell).join(','));
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

    formatDate: (isoOrTimestamp) => {
        if (!isoOrTimestamp) return '-';
        try {
            const d = new Date(isoOrTimestamp);
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