import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

// Clear any legacy persistent sessionStorage lockout on startup
try {
    if (typeof sessionStorage !== "undefined" && sessionStorage) {
        sessionStorage.removeItem(CONFIG.RATE_LIMIT_STATE_KEY || "ig_rate_limit_buckets_v1");
    }
} catch (_e) {}

Object.assign(API, {
    getRateLimitBucket: (urlOrBucket = "") => {
        const raw = String(urlOrBucket || "");
        if (!raw) return "general";
        if (
            raw === "global" ||
            raw === "friendships:followers" ||
            raw === "friendships:following" ||
            raw === "graphql" ||
            raw === "web_profile_info" ||
            raw === "general"
        ) {
            return raw;
        }
        if (raw.includes("/api/v1/friendships/")) {
            if (raw.includes("/followers")) return "friendships:followers";
            if (raw.includes("/following")) return "friendships:following";
            return "friendships:other";
        }
        if (raw.includes("/graphql/query") || raw.includes("/api/graphql")) {
            return "graphql";
        }
        if (raw.includes("/users/web_profile_info")) {
            return "web_profile_info";
        }
        return "general";
    },

    tripRateLimit: (urlOrBucket, cooldownMs = CONFIG.RATE_LIMIT_CIRCUIT_MS || 300000, isGlobal = false) => {
        if (!(API.rateLimitBuckets instanceof Map)) {
            API.rateLimitBuckets = new Map();
        }
        const bucket = API.getRateLimitBucket(urlOrBucket);
        const duration = Math.max(1000, Number(cooldownMs) || (CONFIG.RATE_LIMIT_CIRCUIT_MS || 300000));
        const until = Date.now() + duration;
        API.rateLimitBuckets.set(bucket, until);
        if (isGlobal) {
            API.rateLimitBuckets.set("global", until);
        }
        return { bucket, until, remainingMs: duration };
    },

    getRateLimitRemainingMs: (urlOrBucket = "global") => {
        if (!(API.rateLimitBuckets instanceof Map)) {
            API.rateLimitBuckets = new Map();
            return 0;
        }
        const now = Date.now();
        const bucket = API.getRateLimitBucket(urlOrBucket);
        const globalUntil = API.rateLimitBuckets.get("global") || 0;
        const bucketUntil = API.rateLimitBuckets.get(bucket) || 0;

        if (globalUntil > 0 && globalUntil <= now) {
            API.rateLimitBuckets.delete("global");
        }
        if (bucketUntil > 0 && bucketUntil <= now) {
            API.rateLimitBuckets.delete(bucket);
        }

        const effectiveUntil = Math.max(
            globalUntil > now ? globalUntil : 0,
            bucketUntil > now ? bucketUntil : 0
        );
        return effectiveUntil > now ? (effectiveUntil - now) : 0;
    },

    isRateLimited: (urlOrBucket = "global") => {
        return API.getRateLimitRemainingMs(urlOrBucket) > 0;
    },

    clearRateLimits: (urlOrBucket = null) => {
        if (!(API.rateLimitBuckets instanceof Map)) {
            API.rateLimitBuckets = new Map();
        }
        if (urlOrBucket) {
            const bucket = API.getRateLimitBucket(urlOrBucket);
            API.rateLimitBuckets.delete(bucket);
        } else {
            API.rateLimitBuckets.clear();
        }
    },

    isSoftRateLimitPayload: (json) => {
        if (!json || typeof json !== "object") return false;
        if (json.spam === true || json.feedback_required === true) return true;
        const msg = String(json.message || json.error_title || "").toLowerCase();
        if (
            msg.includes("wait a few minutes") ||
            msg.includes("please wait") ||
            msg.includes("rate limit") ||
            msg.includes("try again later")
        ) {
            return true;
        }
        return false;
    },

    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
        if (typeof options === "number") {
            retries = options;
            options = {};
        }

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        if (options.respectCircuitBreaker && API.isRateLimited(url)) {
            const remSec = Math.ceil(API.getRateLimitRemainingMs(url) / 1000);
            const bucket = API.getRateLimitBucket(url);
            const cbErr = new Error(`Instagram rate limit (429) active on ${bucket} (${remSec}s cooldown remaining). Request blocked to safeguard your account.`);
            Object.defineProperty(cbErr, 'isRateLimited', { value: true, enumerable: false, configurable: true });
            throw cbErr;
        }

        const csrf = Utils.getCsrfToken();
        const defaultHeaders = {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
            "Accept": "*/*",
            ...(csrf ? { "X-CSRFToken": csrf } : {})
        };

        // Pass ONLY standard RequestInit fields to window.fetch
        const fetchOptions = {
            credentials: options.credentials || "include",
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };
        if (options.method) fetchOptions.method = options.method;
        if (options.body !== undefined) fetchOptions.body = options.body;
        if (options.signal) fetchOptions.signal = options.signal;
        if (options.mode) fetchOptions.mode = options.mode;
        if (options.cache) fetchOptions.cache = options.cache;
        if (options.redirect) fetchOptions.redirect = options.redirect;
        if (options.referrer) fetchOptions.referrer = options.referrer;
        if (options.referrerPolicy) fetchOptions.referrerPolicy = options.referrerPolicy;

        let rateLimitCount = 0;
        const maxRateLimitRetries = 2; // Strict safety limit for 429

        for (let i = 0; i < retries; i++) {
            if (options.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }
            try {
                const res = await fetch(url, fetchOptions);
                if (res.ok) {
                    const contentType = (res.headers && typeof res.headers.get === "function")
                        ? (res.headers.get("content-type") || "")
                        : "";
                    if (contentType && contentType.toLowerCase().includes("text/html")) {
                        if (typeof res.text === "function") {
                            await res.text().catch(() => "");
                        }
                        const htmlErr = new Error(`Non-JSON HTML response received from ${url}`);
                        Object.defineProperty(htmlErr, 'isNonJson', { value: true, enumerable: false, configurable: true });
                        throw htmlErr;
                    }
                    let json;
                    try {
                        json = await res.json();
                    } catch (parseErr) {
                        const nonJsonErr = new Error(`Expected JSON from ${url}, but received non-JSON payload (${parseErr?.message || 'parse error'}).`);
                        Object.defineProperty(nonJsonErr, 'isNonJson', { value: true, enumerable: false, configurable: true });
                        throw nonJsonErr;
                    }

                    if (API.isSoftRateLimitPayload(json)) {
                        const isGlobalBlock = Boolean(json.feedback_required || json.spam);
                        API.tripRateLimit(url, CONFIG.RATE_LIMIT_CIRCUIT_MS || 300000, isGlobalBlock);
                        const softErr = new Error(`Instagram rate limit (429) / action block detected: ${json.message || 'feedback_required'}`);
                        Object.defineProperty(softErr, 'isRateLimited', { value: true, enumerable: false, configurable: true });
                        throw softErr;
                    }

                    return json;
                }

                if (res.status === 429) {
                    const retryAfterHeader = res.headers ? res.headers.get("Retry-After") : null;
                    const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
                    const waitMs = (retrySeconds && !isNaN(retrySeconds) && retrySeconds > 0) 
                        ? retrySeconds * 1000 
                        : (CONFIG.COOLDOWN_429_MS || 60000);
                    const circuitMs = Math.max(waitMs, CONFIG.RATE_LIMIT_CIRCUIT_MS || 300000);

                    if (options.abortOnRateLimit || options.silent || options.optional) {
                        if (options.tripCircuitOn429 !== false) {
                            API.tripRateLimit(url, circuitMs, false);
                        }
                        const optErr = new Error(`Instagram rate limit (429) on ${url}`);
                        Object.defineProperty(optErr, 'isRateLimited', { value: true, enumerable: false, configurable: true });
                        throw optErr;
                    }

                    rateLimitCount++;
                    if (rateLimitCount >= maxRateLimitRetries) {
                        API.tripRateLimit(url, circuitMs, false);
                        UI.log(`[Rate Limit] HTTP 429 persistent. Aborting to safeguard your account.`);
                        const persistErr = new Error("Instagram rate limit (429) persistent. Please wait at least 30-60 minutes before retrying.");
                        Object.defineProperty(persistErr, 'isRateLimited', { value: true, enumerable: false, configurable: true });
                        throw persistErr;
                    }

                    UI.setStatus(`Rate limit (429). Cooling down ${Math.round(waitMs / 1000)}s...`);
                    UI.log(`[Safety Cooldown] HTTP 429 detected. Pausing for ${Math.round(waitMs / 1000)}s before retry ${rateLimitCount}/${maxRateLimitRetries}...`);
                    await Utils.sleep(waitMs, options.signal);
                    continue;
                } else {
                    const errText = await res.text().catch(() => "");
                    const lowerErr = errText.toLowerCase();
                    if (
                        lowerErr.includes("wait a few minutes") ||
                        lowerErr.includes("feedback_required") ||
                        lowerErr.includes('"spam":true')
                    ) {
                        API.tripRateLimit(url, CONFIG.RATE_LIMIT_CIRCUIT_MS || 300000, lowerErr.includes("feedback_required"));
                        const blockErr = new Error(`Instagram rate limit (429) / action guard on ${url}: ${errText.slice(0, 120)}`);
                        Object.defineProperty(blockErr, 'isRateLimited', { value: true, enumerable: false, configurable: true });
                        throw blockErr;
                    }
                    if (!options.silent) {
                        console.warn(`[IG Analyzer] Request to ${url} failed (HTTP ${res.status}):`, errText.slice(0, 300));
                    }
                    throw new Error(`HTTP ${res.status} while requesting ${url}: ${errText.slice(0, 100)}`);
                }
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) {
                    throw e;
                }
                if (e.isRateLimited || options.silent || options.optional || e.isNonJson) {
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

});
