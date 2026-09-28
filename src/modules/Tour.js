import { CONFIG } from './Config.js';
import { Storage } from './Storage.js';

/**
 * Single Unified Guided Tour for IG Analyzer.
 * Powered by TamperGuide (loaded via @require into window.tamperGuide).
 */

const TOUR_SEEN_KEY = 'ig_tour_completed_v1';

/**
 * Safely retrieves the tamperGuide factory from the global scope.
 * @returns {Function|null}
 */
function getTamperGuide() {
    if (typeof window !== 'undefined' && typeof window.tamperGuide === 'function') {
        return window.tamperGuide;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.tamperGuide === 'function') {
        return globalThis.tamperGuide;
    }
    return null;
}

/**
 * Builds steps for the Single Unified IG Analyzer Tour (v3.12.0).
 * Prompts the user to run an analysis so that results, filters, and row tools are populated in DOM.
 * @returns {Array<Object>}
 */
function buildUnifiedSteps() {
    return [
        {
            id: 'welcome',
            popover: {
                title: 'Welcome to IG Analyzer!',
                description:
                    'Welcome to version 3.12.0! This complete guided tour walks you through every feature of ' +
                    'your Instagram Follower Analyzer. Safe, private, and enriched with deep audience analytics.<br><br>' +
                    'Let\'s get started!',
            },
        },
        {
            id: 'header',
            element: '#ig-header',
            popover: {
                title: 'Header & Window Controls',
                description:
                    'Drag this bar to position the panel anywhere on screen — your coordinates and custom dimensions are saved automatically.<br><br>' +
                    '• <b>&minus; Button:</b> Minimizes the panel into a compact bar while browsing.<br>' +
                    '• <b>&times; Button:</b> Closes the panel.<br>' +
                    '• <b>Shortcuts:</b> Press <b>F9</b> to toggle visibility and <b>F8</b> to reset to the default 717&times;560 size.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'status',
            element: '#ig-status',
            popover: {
                title: 'Status & Progress Tracking',
                description:
                    'Displays real-time analyzer state (<b>Inactive</b>, <b>Analyzing...</b>, <b>Completed</b>, or <b>Error</b>).<br><br>' +
                    'During an analysis, the progress bar tracks proportional progress against your actual follower and following counts, ' +
                    'with smooth indeterminate animation fallback when totals cannot be predetermined.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            id: 'run-analysis',
            element: '#ig-run',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            stageRadius: 'auto',
            ariaLabel: 'Click Run Analysis to start scanning',
            beacon: {
                shape: 'adaptive',
                color: '#3b82f6',
                text: {
                    content: 'Click to Run Analysis',
                    theme: 'accent',
                    position: 'bottom',
                    icon: '🚀',
                },
                dismissOnClick: true,
            },
            advanceOn: { event: 'click', selector: '#ig-run' },
        },
        {
            id: 'analysis-progress',
            element: '#ig-run',
            popover: {
                title: 'Running Deep Analysis...',
                description:
                    'Confirm the safety prompt to start scanning your account.<br><br>' +
                    'The analyzer scans followers and following lists with safe anti-detection delays (2000ms + jitter).<br><br>' +
                    'Once the status badge shows <b>Completed</b>, click <b>Next &rarr;</b> below to explore your populated results, filters, and tools!',
                side: 'bottom',
                align: 'start',
            },
        },
        {
            id: 'export-csv',
            element: '#ig-export-csv',
            popover: {
                title: 'Export Sanitized CSV',
                description:
                    'Download a spreadsheet of your results at any time. ' +
                    'Sanitized against CSV Formula Injection (CWE-1236) and encoded with UTF-8 BOM for perfect compatibility with Excel, LibreOffice, and Google Sheets.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'reset-data',
            element: '#ig-reset',
            popover: {
                title: 'Reset & Data Isolation',
                description:
                    'Wipes all local data with a safety confirmation prompt.<br><br>' +
                    'All analyzer data stays strictly in your browser and is partitioned by your Instagram account ID (<code>${key}_${userId}</code>), ' +
                    'ensuring zero cross-contamination when switching accounts in the same browser profile.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            id: 'tabs-navigation',
            element: '#ig-tabs',
            popover: {
                title: 'Navigation & Analytics Tabs',
                description:
                    'Switch between specialized analytics views. You can scroll horizontally through tabs using your mouse wheel or touchpad swipe.<br><br>' +
                    'Let\'s take a look at each of the main views and populated tools!',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-logs',
            element: '#ig-tabs [data-target="ig-log"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-log"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Activity & Network Logs',
                description:
                    'Real-time diagnostic feed displaying background Instagram API queries, pagination batches, GraphQL requests, and rate limit cooldowns. This tab is active during analysis so you can monitor progress in real time.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-history',
            element: '#ig-tabs [data-target="ig-view-history"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-history"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Audience Balance & History',
                description:
                    'Inspect your long-term audience evolution. Features the <b>Audience Balance KPI grid</b> (Current Followers, Following, and Net Flow: <b>+X New / -Y Lost</b> with trend badges) alongside daily historical snapshots.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-notfollowing',
            element: '#ig-tabs [data-target="ig-view-notfollowing"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-notfollowing"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Not Following You Back',
                description:
                    'Lists accounts you follow who do not follow you back. Uses client-side 50-user pagination (<b>&larr; Prev</b> and <b>Next &rarr;</b>) for lag-free scrolling.<br><br>' +
                    'Let\'s explore the powerful interactive tools available on each result!',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'feature-search',
            element: '#ig-view-notfollowing .ig-search-box, #ig-view-notfollowing .ig-search-input, .ig-search-box',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            beforeStep: async () => {
                const view = document.getElementById('ig-view-notfollowing');
                if (view) view.scrollTop = 0;
                const el = document.querySelector('#ig-view-notfollowing .ig-search-box, .ig-search-box');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                await new Promise((r) => setTimeout(r, 150));
            },
            popover: {
                title: 'Live Instant Search',
                description:
                    'Filter accounts instantly in real time by typing any part of a username (<code>@username</code>) or full display name, featuring debounced searching and a 1-click clear button.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'feature-chips',
            element: '#ig-view-notfollowing .ig-filter-chips, .ig-filter-chips',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            beforeStep: async () => {
                const view = document.getElementById('ig-view-notfollowing');
                if (view) view.scrollTop = 0;
                const el = document.querySelector('#ig-view-notfollowing .ig-filter-chips, .ig-filter-chips');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                await new Promise((r) => setTimeout(r, 150));
            },
            popover: {
                title: 'Category Filter Chips',
                description:
                    'Quickly toggle category filters with live count badges: <b>All</b>, <b>Private</b>, <b>Public</b>, <b>Besties (Close Friends)</b>, <b>With Story</b>, and <b>Verified</b>.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'feature-story-spy',
            element: '#ig-view-notfollowing .ig-user-row:first-child .btn-spy-story, #ig-view-notfollowing .btn-spy-story, .btn-spy-story',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            beforeStep: async () => {
                const btn = document.querySelector('#ig-view-notfollowing .ig-user-row:first-child .btn-spy-story, #ig-view-notfollowing .btn-spy-story, .btn-spy-story');
                if (btn) {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise((r) => setTimeout(r, 150));
                }
            },
            popover: {
                title: 'Story Spy 2.0 (Story Anomaly Detection)',
                description:
                    'Click <b>Check Story</b> next to any user row to run an on-demand visibility test.<br><br>' +
                    'Compares Meta\'s GraphQL & Highlights Tray against anonymous guest sessions to detect if someone is hiding stories from your account with 24-hour decay window math.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            id: 'feature-profile-inspector',
            element: '#ig-view-notfollowing .ig-user-row:first-child .btn-inspect-user, #ig-view-notfollowing .btn-inspect-user, .btn-inspect-user',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            beforeStep: async () => {
                const btn = document.querySelector('#ig-view-notfollowing .ig-user-row:first-child .btn-inspect-user, #ig-view-notfollowing .btn-inspect-user, .btn-inspect-user');
                if (btn) {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise((r) => setTimeout(r, 150));
                }
            },
            popover: {
                title: 'Quick-Card 1080p Profile Inspector',
                description:
                    'Click the <b>Inspect</b> button (or any avatar) to open the HD Quick-Card modal:<br>' +
                    '• Full-resolution 1080p profile picture with a <b>1-click HD Download</b> button.<br>' +
                    '• Complete bio with clickable links, mutual friends facepile counters, and live relationship status pills (<i>Follows you</i>, <i>Following</i>, <i>Pending</i>).',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            id: 'feature-whitelist-action',
            element: '#ig-view-notfollowing .ig-user-row:first-child .btn-whitelist, #ig-view-notfollowing .btn-whitelist, .btn-whitelist',
            stagePadding: { top: 4, bottom: 4, left: 6, right: 6 },
            beforeStep: async () => {
                const btn = document.querySelector('#ig-view-notfollowing .ig-user-row:first-child .btn-whitelist, #ig-view-notfollowing .btn-whitelist, .btn-whitelist');
                if (btn) {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise((r) => setTimeout(r, 150));
                }
            },
            popover: {
                title: 'Ignore / Whitelist Action',
                description:
                    'Click <b>Ignore</b> on accounts you follow intentionally without expecting a follow-back (celebrities, news channels, brands).<br><br>' +
                    'This moves them to the Whitelist tab so they don\'t clutter your non-follower audits.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            id: 'tab-fans',
            element: '#ig-tabs [data-target="ig-view-fans"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-fans"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Fans (Followers You Don\'t Follow Back)',
                description:
                    'Displays accounts that follow you, but you don\'t follow back. Inspect their profiles in 1080p HD, check story visibility, or audit their follower network.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-mutuals',
            element: '#ig-tabs [data-target="ig-view-mutuals"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-mutuals"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Mutual Connections',
                description:
                    'Friends and connections who follow each other. User rows display live story status rings (gradient for standard stories, neon green for Close Friends / Besties).',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-targettracker',
            element: '#ig-tabs [data-target="ig-view-targettracker"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-targettracker"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Target Tracker & Network Audits',
                description:
                    'Audit any public Instagram account! Enter any <code>@username</code> to inspect their audience, discover shared mutual connections, and track net follower gains or losses over time in a draggable, resizable child subpanel.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-newfollowers',
            element: '#ig-tabs [data-target="ig-view-newfollowers"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-newfollowers"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'New Followers Center',
                description:
                    'Automatically identifies accounts gained since your previous scan, with detection timestamps and relationship badges: <b>Mutual</b> (if you follow back) or <b>Fan</b> (if you don\'t follow back yet).',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-whitelist',
            element: '#ig-tabs [data-target="ig-view-whitelist"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-whitelist"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Visual Whitelist Manager',
                description:
                    'Review all ignored accounts with instant real-time search. Click <b>Restore</b> on any row to return them to the active Not Following list with a smooth animation, or clear the whitelist in batch.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-unfollowers',
            element: '#ig-tabs [data-target="ig-view-unfollowers"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-unfollowers"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Unfollowers Log',
                description:
                    'Chronological dated log of accounts that stopped following you since your previous scan.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-deactivated',
            element: '#ig-tabs [data-target="ig-view-deactivated"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-deactivated"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Deactivated Accounts',
                description:
                    'Accurately distinguishes genuine deactivated Instagram accounts from users who blocked you, safely verified using anonymous guest profile checks.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-blocked',
            element: '#ig-tabs [data-target="ig-view-blocked"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-blocked"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Blocked Accounts',
                description:
                    'Identifies accounts that have blocked your profile. Confirmed when a profile remains publicly accessible to anonymous guest sessions but returns restricted errors to your logged-in account.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-renamed',
            element: '#ig-tabs [data-target="ig-view-renamed"]',
            beforeStep: async () => {
                const tab = document.querySelector('#ig-tabs [data-target="ig-view-renamed"]');
                if (tab) {
                    tab.click();
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Username Changes (Renamed)',
                description:
                    'Tracks mutual account <code>@username</code> changes by matching persistent numeric Instagram IDs, ensuring you never mistake a rename for an unfollow.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'tab-backup',
            element: '#ig-tab-backup',
            beforeStep: async () => {
                const tab = document.getElementById('ig-tab-backup');
                if (tab) {
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    await new Promise((r) => setTimeout(r, 200));
                }
            },
            popover: {
                title: 'Backup & Restore Database',
                description:
                    'Safely export your entire analyzer database (snapshots, history, whitelists, and audits) to a local JSON file, or restore a previous backup at any time. Multi-account scoped and protected against prototype pollution and data loss.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            id: 'outro',
            popover: {
                title: 'You\'re All Set!',
                description:
                    'You\'re now ready to use IG Analyzer! Press <b>F9</b> anytime to toggle panel visibility, or <b>F8</b> to reset position.<br><br>' +
                    'You can replay this complete tour at any time from your Tampermonkey extension menu.',
            },
        },
    ];
}

/**
 * Base execution engine for running the unified tour.
 * @param {Array<Object>} steps - Steps configuration
 * @param {Object} [options={}] - Execution options
 * @returns {Object|null} TamperGuide instance
 */
function runGuide(steps, options = {}) {
    const tg = getTamperGuide();
    if (!tg) {
        console.warn(
            '[IG Analyzer] TamperGuide library not found in global scope. ' +
            'Make sure it is loaded via @require in the userscript header.'
        );
        return null;
    }

    const panel = document.getElementById('ig-analyzer-panel');
    if (!panel) {
        console.warn('[IG Analyzer] Panel not found in DOM. Cannot start tour.');
        return null;
    }

    // Ensure the panel is visible before starting
    panel.style.display = 'flex';

    // Temporarily block F9 from hiding the panel during the tour
    const blockF9 = (e) => {
        if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };
    document.addEventListener('keydown', blockF9, true);

    const guide = tg({
        animate: true,
        overlayColor: '#000',
        overlayOpacity: 0.65,
        stagePadding: 6,
        stageRadius: 10,
        allowClose: true,
        allowKeyboardControl: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next &rarr;',
        prevBtnText: '&larr; Back',
        doneBtnText: 'Done &#10003;',
        smoothScroll: true,
        scrollIntoViewOptions: { behavior: 'smooth', block: 'nearest', inline: 'nearest' },
        popoverOffset: 12,
        steps,

        onDestroyed: () => {
            document.removeEventListener('keydown', blockF9, true);
            markTourCompleted();
            if (typeof options.onDestroyed === 'function') {
                options.onDestroyed();
            }
        },

        onDestroyStarted: (element, step, opts) => {
            if (opts.driver.isLastStep()) return;

            const skip = confirm(
                'Exit this guide?\n\n' +
                'You can restart it anytime from the Tampermonkey menu.'
            );

            if (skip) {
                opts.driver.destroy();
            }

            return false;
        },
    });

    guide.drive();
    return guide;
}

/**
 * Checks if the unified tour has already been completed.
 * @returns {boolean}
 */
export function isTourCompleted() {
    return GM_getValue(TOUR_SEEN_KEY, false) === true;
}

/**
 * Marks the unified tour as completed.
 */
export function markTourCompleted() {
    GM_setValue(TOUR_SEEN_KEY, true);
}

/**
 * Resets the tour completion flag.
 */
export function resetTour() {
    GM_deleteValue(TOUR_SEEN_KEY);
    console.log('[IG Analyzer] Unified tour reset. It will show on next page load.');
}

/**
 * Starts the single unified tour covering all features.
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Object|null}
 */
export function startTour(options = {}) {
    const { force = false } = options;

    if (!force && isTourCompleted()) {
        if (CONFIG.DEBUG) console.log('[IG Analyzer] Tour already completed. Skipping.');
        return null;
    }

    return runGuide(buildUnifiedSteps(), {
        onDestroyed: () => {
            markTourCompleted();
            console.log('[IG Analyzer] Unified tour completed and saved.');
        },
    });
}