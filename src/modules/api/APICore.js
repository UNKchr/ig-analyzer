import { API } from './APIState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { UI } from '../UI.js';

Object.assign(API, {
    fetchWithRetry: async (url, options = {}, retries = CONFIG.MAX_RETRIES, backoff = 3e3) => {
        if (typeof options === "number") {
            retries = options;
            options = {};
        }

        if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
        }

        const csrf = Utils.getCsrfToken();
        const defaultHeaders = {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "X-ASBD-ID": CONFIG.ASBD_ID || "359341",
            "Accept": "*/*",
            ...(csrf ? { "X-CSRFToken": csrf } : {})
        };

        const fetchOptions = {
            credentials: "include",
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        let rateLimitCount = 0;
        const maxRateLimitRetries = 2; // Strict safety limit for 429

        for (let i = 0; i < retries; i++) {
            if (options.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }
            try {
                const res = await fetch(url, fetchOptions);
                if (res.ok) return await res.json();

                if (res.status === 429) {
                    if (options.silent || options.optional) {
                        throw new Error(`HTTP 429 on optional endpoint ${url}`);
                    }

                    rateLimitCount++;
                    const retryAfterHeader = res.headers ? res.headers.get("Retry-After") : null;
                    const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
                    const waitMs = (retrySeconds && !isNaN(retrySeconds) && retrySeconds > 0) 
                        ? retrySeconds * 1000 
                        : (CONFIG.COOLDOWN_429_MS || 60000);

                    if (rateLimitCount >= maxRateLimitRetries) {
                        UI.log(`[Rate Limit] HTTP 429 persistent. Aborting to safeguard your account.`);
                        throw new Error("Instagram rate limit (429) persistent. Please wait at least 30-60 minutes before retrying.");
                    }

                    UI.setStatus(`Rate limit (429). Cooling down ${Math.round(waitMs / 1000)}s...`);
                    UI.log(`[Safety Cooldown] HTTP 429 detected. Pausing for ${Math.round(waitMs / 1000)}s before retry ${rateLimitCount}/${maxRateLimitRetries}...`);
                    await Utils.sleep(waitMs, options.signal);
                    continue;
                } else {
                    const errText = await res.text().catch(() => "");
                    if (!options.silent) {
                        console.warn(`[IG Analyzer] Request to ${url} failed (HTTP ${res.status}):`, errText.slice(0, 300));
                    }
                    throw new Error(`HTTP ${res.status} while requesting ${url}: ${errText.slice(0, 100)}`);
                }
            } catch (e) {
                if (e.name === 'AbortError' || options.signal?.aborted) {
                    throw e;
                }
                if (options.silent || options.optional) {
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
