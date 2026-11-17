import { App } from './AppState.js';
import { CONFIG } from '../Config.js';
import { Utils } from '../Utils.js';
import { Storage } from '../Storage.js';
import { UI } from '../UI.js';
import { API } from '../API.js';
import { Icons } from '../../assets/Icons.js';

Object.assign(App, {
    runStorySpy: async (username, btnElement, targetUserId = null) => {
        const cleanUser = String(username || '').replace(/^@/, '').trim();
        const safeUsername = Utils.escapeHtml(cleanUser);
        let resolvedUserId = (targetUserId && String(targetUserId) !== "0" && String(targetUserId) !== "null")
            ? String(targetUserId)
            : (btnElement?.getAttribute("data-user-id") || null);

        if (btnElement) {
            if (btnElement.disabled) return;
            btnElement.disabled = true;
            btnElement.innerHTML = `<span class="ig-spy-btn-busy">${Icons.spy} Scanning...</span>`;
        }

        try {
            UI.log(`[Story Spy] Checking story & highlight visibility for @${cleanUser}...`);
            const status = await API.checkStoryStatus(cleanUser, resolvedUserId);

            if (!status) {
                await UI.confirmAction("Error", `Could not fetch data for @${safeUsername}. The profile might be unavailable or network connection failed.`, "Close", false);
                return;
            }

            // Retrieve previous observations from storage before saving current
            const history = Storage.getStoryObservations(cleanUser);
            const previous = history.length > 0 ? history[history.length - 1] : null;
            const trayAvailable = status.authHighlightsAvailable !== false;

            let probability = 0;
            let reason = "";
            let anomalyBadge = "Normal";

            // 1. Check Server Gating (null latest_reel_media)
            if (status.isGated) {
                probability = 95;
                anomalyBadge = "Gated Access";
                reason = "Meta's API returned a restricted/gated state (<code>latest_reel_media: null</code>) for your account session. You are restricted or hidden from viewing this user's stories.";
            }
            // 2. Check Anonymous Guest Discrepancy for Public Accounts (only when auth highlights tray actually succeeded)
            else if (trayAvailable && !status.isPrivate && (status.anonHighlightsCount > 0 || status.anonHasStory) && (status.authHighlightsCount === 0 && !status.authHasStory)) {
                probability = 100;
                anomalyBadge = "Confirmed Hiding";
                reason = `Confirmed: Highlights (${status.anonHighlightsCount}) or active stories are publicly visible to anonymous guest visitors, but completely hidden from your logged-in account (0 highlights). This user is actively hiding stories from you.`;
            }
            // 3. Normal Visibility (Highlights or Stories visible right now)
            else if ((trayAvailable && status.authHighlightsCount > 0) || status.authHasStory) {
                probability = 0;
                anomalyBadge = "Normal Visibility";
                const visibleItems = [];
                if (trayAvailable && status.authHighlightsCount > 0) visibleItems.push(`<b>${status.authHighlightsCount} highlight(s)</b>`);
                if (status.isBestieStory) visibleItems.push("a <b>Close Friends Story</b> (green ring)");
                else if (status.authHasStory) visibleItems.push("an <b>Active Story</b>");
                const trayNote = !trayAvailable ? " (Highlights tray temporarily rate-limited.)" : "";
                reason = `Normal visibility: Your account can see ${visibleItems.join(" and ")}. No story hiding detected.${trayNote}`;
            }
            // 4. Highlights Tray Failed / Rate-Limited (429) with 0 active stories — protect against false 90% alerts!
            else if (!trayAvailable) {
                const prevStory = Boolean(previous && (previous.hasStory || (previous.latestReelMedia && previous.latestReelMedia > 0)));
                const prevReelMedia = previous?.latestReelMedia ? Number(previous.latestReelMedia) : 0;
                const nowSeconds = Math.floor(Date.now() / 1000);
                const storyAgeSeconds = prevReelMedia > 0 ? (nowSeconds - prevReelMedia) : null;
                const isStoryUnexpired = storyAgeSeconds !== null && storyAgeSeconds >= 0 && storyAgeSeconds < 86400;

                if (prevStory && isStoryUnexpired) {
                    probability = 80;
                    anomalyBadge = "Story Vanished Early";
                    const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
                    reason = `<b>Anomaly Detected:</b> An active story posted ~${hoursAgo}h ago is no longer visible to your account (stories last 24h). Highlights tray could not be checked due to a temporary Instagram rate limit, so your previous highlight baseline was preserved.`;
                } else {
                    probability = 0;
                    anomalyBadge = "Tray Unavailable";
                    reason = "Instagram's Highlights Tray endpoint was temporarily rate-limited or unavailable during this check, and no active 24h story is currently posted. Your previous highlight baseline was preserved without triggering a false vanish alert.";
                }
            }
            // 5. Chronological Analysis (0 highlights & 0 stories currently visible, tray confirmed 0)
            else if (previous) {
                const prevHighlights = previous.highlightsCount || previous.highlights || 0;
                const prevStory = Boolean(previous.hasStory || (previous.latestReelMedia && previous.latestReelMedia > 0));
                const prevReelMedia = previous.latestReelMedia ? Number(previous.latestReelMedia) : 0;

                const nowSeconds = Math.floor(Date.now() / 1000);
                const storyAgeSeconds = prevReelMedia > 0 ? (nowSeconds - prevReelMedia) : null;
                const isStoryUnexpired = storyAgeSeconds !== null && storyAgeSeconds >= 0 && storyAgeSeconds < 86400;

                if (prevHighlights > 0 && prevStory && isStoryUnexpired) {
                    probability = 95;
                    anomalyBadge = "Critical Anomaly";
                    const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
                    reason = `<b>Critical Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b> and an active story posted ~${hoursAgo}h ago. In this scan, <b>both the highlights and the story vanished simultaneously</b> (0 highlights, 0 stories). When an Instagram user hides stories from you, Meta instantly strips both active stories and highlights from your account feed.`;
                } else if (prevHighlights > 0) {
                    probability = 90;
                    anomalyBadge = "Highlights Vanished";
                    const prevTitles = previous.highlightTitles?.length ? ` (e.g. <i>"${previous.highlightTitles.slice(0, 3).map((t) => Utils.escapeHtml(t)).join('", "')}"</i>)` : '';
                    reason = `<b>High Anomaly Detected:</b> In your previous scan, @${safeUsername} had <b>${prevHighlights} visible highlight(s)</b>${prevTitles}. In this scan, 0 highlights were returned. Highlights do not expire after 24 hours. Unless the user deleted or archived all their highlights, they have hidden their stories and highlights from you.`;
                } else if (prevStory && isStoryUnexpired) {
                    probability = 80;
                    anomalyBadge = "Story Vanished Early";
                    const hoursAgo = Math.max(1, Math.round(storyAgeSeconds / 3600));
                    reason = `<b>Anomaly Detected:</b> An active story posted ~${hoursAgo}h ago is no longer visible to your account (stories last 24h). The user either deleted the story manually or hid their stories from you.`;
                } else {
                    probability = 0;
                    anomalyBadge = "No Content";
                    reason = "No active stories or highlights currently detected for this account. Both previous and current scans show 0.";
                }
            }
            // 6. First scan with 0 highlights & 0 stories
            else {
                probability = 0;
                anomalyBadge = "Baseline Recorded";
                reason = `First scan baseline recorded: 0 highlights and no active stories currently visible. If this user posts stories or has highlights you should see, future scans will alert you immediately if discrepancies occur.`;
            }

            // Preserve previous verified highlight count if tray was unavailable (rate-limited) so baseline is never corrupted with 0
            const persistedHighlightsCount = trayAvailable
                ? status.authHighlightsCount
                : (previous ? (previous.highlightsCount ?? previous.highlights ?? 0) : 0);
            const persistedTitles = trayAvailable
                ? (status.authHighlights || []).map((h) => h.title)
                : (previous?.highlightTitles || []);

            Storage.addStoryObservation(cleanUser, {
                highlightsCount: persistedHighlightsCount,
                trayUnavailable: !trayAvailable,
                latestReelMedia: status.latestReelMedia,
                latestBestiesReelMedia: status.latestBestiesReelMedia,
                hasStory: status.authHasStory,
                isBestieStory: status.isBestieStory,
                isPrivate: status.isPrivate,
                highlightTitles: persistedTitles
            });

            // Refresh history for display in modal
            const updatedHistory = Storage.getStoryObservations(cleanUser);

            // Semantic state class (100% CSS custom properties for Dark & Light mode)
            let stateMod = 'is-safe';
            if (probability >= 75) {
                stateMod = 'is-danger';
            } else if (probability > 0 || !trayAvailable) {
                stateMod = 'is-warn';
            }

            // Format story status text
            let storyStatusHtml = '<span class="ig-spy-val-muted">None active</span>';
            if (status.isGated) {
                storyStatusHtml = '<span class="ig-spy-val-danger">Gated / Restricted</span>';
            } else if (status.isBestieStory) {
                storyStatusHtml = '<span class="ig-spy-val-success">Close Friends Story (Active)</span>';
            } else if (status.authHasStory) {
                const nowSec = Math.floor(Date.now() / 1000);
                const ageSec = nowSec - (status.latestReelMedia || nowSec);
                const ageHours = Math.max(0, Math.floor(ageSec / 3600));
                const ageMins = Math.max(0, Math.floor((ageSec % 3600) / 60));
                const timeStr = ageHours > 0 ? `${ageHours}h ${ageMins}m ago` : `${ageMins}m ago`;
                storyStatusHtml = `<span class="ig-spy-val-accent">Active Story (Posted ~${timeStr})</span>`;
            }

            // Build history timeline HTML using local wall-clock time and pure CSS indicator dots
            let historyHtml = '';
            if (updatedHistory.length > 1) {
                const recentScans = updatedHistory.slice(-4).reverse();
                historyHtml = `
                    <div class="ig-spy-timeline">
                        <div class="ig-spy-timeline-title">
                            Scan History Timeline (${updatedHistory.length} recorded)
                        </div>
                        <div class="ig-spy-timeline-list">
                            ${recentScans.map((obs, idx) => {
                                const isCurrent = idx === 0;
                                const localHm = Utils.localTimeStr(obs.timestamp || obs.epochMs).slice(0, 5) || 'Scan';
                                const hCount = obs.highlightsCount ?? obs.highlights ?? 0;
                                const hLabel = obs.trayUnavailable ? `${hCount} highlights (cached)` : `${hCount} highlights`;
                                const hasS = obs.hasStory || (obs.latestReelMedia && obs.latestReelMedia > 0);
                                return `
                                    <div class="ig-spy-timeline-row${isCurrent ? ' is-current' : ''}">
                                        <span class="ig-spy-timeline-when">
                                            <span class="ig-spy-dot${isCurrent ? ' is-current' : ''}"></span>
                                            ${isCurrent ? 'Current' : Utils.escapeHtml(localHm)}
                                        </span>
                                        <span class="ig-spy-timeline-summary">
                                            ${Utils.escapeHtml(hLabel)} · ${hasS ? 'Story Active' : 'No Story'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            const targetType = status.isPrivate ? 'Private Account' : 'Public Account';
            const highlightsDetail = !trayAvailable
                ? '<span class="ig-spy-val-warn">Unavailable (Rate Limit)</span>'
                : (status.authHighlightsCount > 0
                    ? `<b class="ig-spy-val-success">${status.authHighlightsCount} visible</b>`
                    : '<span class="ig-spy-val-muted">0 detected</span>');

            const guestDetail = status.anonHighlightsAvailable === false
                ? '<span class="ig-spy-val-muted">Unavailable</span>'
                : `<span class="ig-spy-meta-val">${status.anonHighlightsCount} highlights</span>`;

            const resultHtml = `
                <div class="ig-spy-hero">
                    <div class="ig-spy-badge ${stateMod}">
                        ${Utils.escapeHtml(anomalyBadge)}
                    </div>
                    <div class="ig-spy-prob ${stateMod}">
                        ${probability}%
                    </div>
                    <div class="ig-spy-prob-label">
                        Story Hiding Probability
                    </div>
                </div>

                <div class="ig-spy-reason-card">
                    ${reason}
                </div>

                <div class="ig-spy-meta-card">
                    <div class="ig-spy-meta-row">
                        <span class="ig-spy-meta-label">Target Profile:</span>
                        <span class="ig-spy-meta-val is-strong">@${safeUsername} (${targetType})</span>
                    </div>
                    <div class="ig-spy-meta-row">
                        <span class="ig-spy-meta-label">Highlights (Tray):</span>
                        <span>${highlightsDetail}</span>
                    </div>
                    <div class="ig-spy-meta-row${status.isPrivate ? ' is-last' : ''}">
                        <span class="ig-spy-meta-label">Active Story:</span>
                        <span>${storyStatusHtml}</span>
                    </div>
                    ${!status.isPrivate ? `
                    <div class="ig-spy-meta-row is-last">
                        <span class="ig-spy-meta-label">Guest Session (Anon):</span>
                        ${guestDetail}
                    </div>` : ''}
                </div>

                ${historyHtml}
            `;

            UI.log(`[Story Spy] @${cleanUser}: ${probability}% anomaly probability (${status.isPrivate ? 'Private' : 'Public'}).`);
            await UI.confirmAction(`Story Spy: @${safeUsername}`, resultHtml, "Close", false, Icons.spy);

        } catch (e) {
            Utils.logError("Error in runStorySpy", e);
            await UI.confirmAction("Error", "An unexpected error occurred while checking story visibility.", "Close", false);
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = `${Icons.spy} Check Story`;
            }
        }
    },

});
