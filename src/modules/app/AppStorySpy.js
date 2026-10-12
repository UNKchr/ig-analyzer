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
            btnElement.innerHTML = `<span style="opacity:0.8; display:inline-flex; align-items:center; gap:4px;">${Icons.spy} Scanning...</span>`;
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

            let probability = 0;
            let reason = "";
            let anomalyBadge = "Normal";

            // 1. Check Server Gating (null latest_reel_media)
            if (status.isGated) {
                probability = 95;
                anomalyBadge = "Gated Access";
                reason = "Meta's API returned a restricted/gated state (<code>latest_reel_media: null</code>) for your account session. You are restricted or hidden from viewing this user's stories.";
            }
            // 2. Check Anonymous Guest Discrepancy for Public Accounts
            else if (!status.isPrivate && (status.anonHighlightsCount > 0 || status.anonHasStory) && (status.authHighlightsCount === 0 && !status.authHasStory)) {
                probability = 100;
                anomalyBadge = "Confirmed Hiding";
                reason = `Confirmed: Highlights (${status.anonHighlightsCount}) or active stories are publicly visible to anonymous guest visitors, but completely hidden from your logged-in account (0 highlights). This user is actively hiding stories from you.`;
            }
            // 3. Normal Visibility (Highlights or Stories visible right now)
            else if (status.authHighlightsCount > 0 || status.authHasStory) {
                probability = 0;
                anomalyBadge = "Normal Visibility";
                const visibleItems = [];
                if (status.authHighlightsCount > 0) visibleItems.push(`<b>${status.authHighlightsCount} highlight(s)</b>`);
                if (status.isBestieStory) visibleItems.push("a <b>Close Friends Story</b> (green ring)");
                else if (status.authHasStory) visibleItems.push("an <b>Active Story</b>");
                reason = `Normal visibility: Your account can see ${visibleItems.join(" and ")}. No story or highlight hiding detected.`;
            }
            // 4. Chronological Analysis (0 highlights & 0 stories currently visible)
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
            // 5. First scan with 0 highlights & 0 stories
            else {
                probability = 0;
                anomalyBadge = "Baseline Recorded";
                reason = `First scan baseline recorded: 0 highlights and no active stories currently visible. If this user posts stories or has highlights you should see, future scans will alert you immediately if discrepancies occur.`;
            }

            // Save new observation to storage
            Storage.addStoryObservation(cleanUser, {
                highlightsCount: status.authHighlightsCount,
                latestReelMedia: status.latestReelMedia,
                latestBestiesReelMedia: status.latestBestiesReelMedia,
                hasStory: status.authHasStory,
                isBestieStory: status.isBestieStory,
                isPrivate: status.isPrivate,
                highlightTitles: (status.authHighlights || []).map((h) => h.title)
            });

            // Refresh history for display in modal
            const updatedHistory = Storage.getStoryObservations(cleanUser);

            // Determine status styling
            let statusColor = '#10b981'; // Green
            let badgeBg = 'rgba(16, 185, 129, 0.14)';
            let badgeBorder = 'rgba(16, 185, 129, 0.3)';

            if (probability >= 75) {
                statusColor = '#ef4444'; // Red
                badgeBg = 'rgba(239, 68, 68, 0.14)';
                badgeBorder = 'rgba(239, 68, 68, 0.3)';
            } else if (probability > 0) {
                statusColor = '#f59e0b'; // Amber
                badgeBg = 'rgba(245, 158, 11, 0.14)';
                badgeBorder = 'rgba(245, 158, 11, 0.3)';
            }

            // Format story status text
            let storyStatusText = "None active";
            if (status.isGated) {
                storyStatusText = '<span style="color:#ef4444; font-weight:600;">Gated / Restricted</span>';
            } else if (status.isBestieStory) {
                storyStatusText = '<span style="color:#10b981; font-weight:600;">Close Friends Story (Active)</span>';
            } else if (status.authHasStory) {
                const nowSec = Math.floor(Date.now() / 1000);
                const ageSec = nowSec - (status.latestReelMedia || nowSec);
                const ageHours = Math.max(0, Math.floor(ageSec / 3600));
                const ageMins = Math.max(0, Math.floor((ageSec % 3600) / 60));
                const timeStr = ageHours > 0 ? `${ageHours}h ${ageMins}m ago` : `${ageMins}m ago`;
                storyStatusText = `<span style="color:#3b82f6; font-weight:600;">Active Story (Posted ~${timeStr})</span>`;
            }

            // Build history timeline HTML
            let historyHtml = '';
            if (updatedHistory.length > 1) {
                const recentScans = updatedHistory.slice(-4).reverse();
                historyHtml = `
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); text-align: left;">
                        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                            Scan History Timeline (${updatedHistory.length} recorded)
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${recentScans.map((obs, idx) => {
                                const isCurrent = idx === 0;
                                const dateStr = (obs.timestamp || '').split('T')[1]?.slice(0, 5) || 'Scan';
                                const hCount = obs.highlightsCount ?? obs.highlights ?? 0;
                                const hasS = obs.hasStory || (obs.latestReelMedia && obs.latestReelMedia > 0);
                                return `
                                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 5px 8px; border-radius: 6px; background: ${isCurrent ? 'rgba(255,255,255,0.05)' : 'transparent'}; border: 1px solid ${isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent'};">
                                        <span style="color: ${isCurrent ? '#f8fafc' : '#94a3b8'}; font-weight: ${isCurrent ? '600' : '400'};">
                                            ${isCurrent ? '● Current' : `○ ${dateStr}`}
                                        </span>
                                        <span style="color: #cbd5e1;">
                                            ${hCount} highlights · ${hasS ? 'Story Active' : 'No Story'}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            const targetType = status.isPrivate ? 'Private Account' : 'Public Account';
            const highlightsDetail = status.authHighlightsCount > 0 
                ? `<b style="color:#10b981;">${status.authHighlightsCount} visible</b>` 
                : '<span style="color:#94a3b8;">0 detected</span>';

            const resultHtml = `
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${badgeBg}; color: ${statusColor}; border: 1px solid ${badgeBorder}; margin-bottom: 10px;">
                        ${anomalyBadge}
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: ${statusColor}; letter-spacing: -1px; line-height: 1;">
                        ${probability}%
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        Story Hiding Probability
                    </div>
                </div>

                <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 10px; font-size: 12.5px; line-height: 1.5; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); text-align: left; margin-bottom: 14px;">
                    ${reason}
                </div>

                <div style="background: rgba(255, 255, 255, 0.03); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.06); font-size: 12px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Target Profile:</span>
                        <span style="color: #f8fafc; font-weight: 600;">@${safeUsername} (${targetType})</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #94a3b8;">Highlights (Tray):</span>
                        <span>${highlightsDetail}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; ${!status.isPrivate ? 'border-bottom: 1px solid rgba(255,255,255,0.05);' : ''}">
                        <span style="color: #94a3b8;">Active Story:</span>
                        <span>${storyStatusText}</span>
                    </div>
                    ${!status.isPrivate ? `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                        <span style="color: #94a3b8;">Guest Session (Anon):</span>
                        <span style="color: #cbd5e1;">${status.anonHighlightsCount} highlights</span>
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
