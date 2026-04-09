import { CONFIG } from './Config.js';

/**
 * First-time user tour for IG Analyzer.
 * TamperGuide is loaded via @require (global variable: window.tamperGuide).
 * We do NOT import it — it's not an npm package.
 */

const TOUR_SEEN_KEY = 'ig_tour_completed_v1';

/**
 * Safely retrieves the tamperGuide function from the global scope.
 * Returns null if not available (e.g., @require failed to load).
 * @returns {Function|null}
 */
function getTamperGuide() {
    // @require injects it into the global scope
    if (typeof window !== 'undefined' && typeof window.tamperGuide === 'function') {
        return window.tamperGuide;
    }
    // Fallback: check globalThis (some sandbox modes)
    if (typeof globalThis !== 'undefined' && typeof globalThis.tamperGuide === 'function') {
        return globalThis.tamperGuide;
    }
    return null;
}

/**
 * Builds the step definitions for the first-time tour.
 * Each step targets a real element in the IG Analyzer panel.
 * 
 * @returns {Array<Object>} Array of TamperGuide step objects
 */
function buildSteps() {
    return [
        {
            popover: {
                title: 'Welcome to IG Analyzer!',
                description:
                    'This quick tour will walk you through all the features of the panel. ' +
                    'It only takes a moment — let\'s get started!',
            },
        },
        {
            element: '#ig-header',
            popover: {
                title: 'Draggable Header',
                description:
                    'Grab this area to drag the panel anywhere on screen. ' +
                    'Your position is saved automatically between sessions.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            element: '#ig-status',
            popover: {
                title: 'Status Indicator',
                description:
                    'Shows the current state of the analyzer: ' +
                    '<b>Inactive</b>, <b>Analyzing...</b>, <b>Completed</b>, or <b>Error</b>.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            element: '#ig-run',
            popover: {
                title: 'Run Analysis',
                description:
                    'Click here to start scanning your followers and following lists. ' +
                    'The process uses Instagram\'s API with built-in rate limiting to keep your account safe.<br><br>' +
                    '<b>Tip:</b> Run it only once per hour to avoid restrictions.',
                side: 'bottom',
                align: 'start',
            },
        },
        {
            element: '#ig-export-csv',
            popover: {
                title: 'Export CSV',
                description:
                    'After an analysis completes, this button lets you download a <b>.csv</b> file ' +
                    'with all users who don\'t follow you back. Ready for Excel or Google Sheets.',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            element: '#ig-reset',
            popover: {
                title: 'Reset Data',
                description:
                    'Wipes all local data: history, snapshots, whitelists, and logs. ' +
                    'A confirmation dialog will appear before anything is deleted.',
                side: 'bottom',
                align: 'end',
            },
        },
        {
            element: '#ig-tabs',
            popover: {
                title: 'Navigation Tabs',
                description:
                    'Switch between different views using these tabs:<br>' +
                    '• <b>Logs</b> — Real-time execution log<br>' +
                    '• <b>History</b> — Follower/following trends over time<br>' +
                    '• <b>Not Following</b> — Users who don\'t follow you back<br>' +
                    '• <b>Fans</b> — Users who follow you but you don\'t follow<br>' +
                    '• <b>Mutuals</b> — Users you both follow each other<br>' +
                    '• <b>Unfollowers</b> — Users who recently unfollowed you<br>' +
                    '• <b>Deactivated</b> — Accounts that were deactivated or suspended<br>' + 
                    '• <b>Blocked</b> — Accounts that have blocked you<br>' +
                    '• <b>Renamed</b> — Mutuals that changed their usernames',
                side: 'bottom',
                align: 'center',
            },
        },
        {
            element: '#ig-log',
            popover: {
                title: 'Logs View',
                description:
                    'All actions and API requests are logged here in real time. ' +
                    'Useful for monitoring progress and debugging issues.',
                side: 'top',
                align: 'center',
            },
        },
        {
            popover: {
                title: 'You\'re all set!',
                description:
                    'That\'s everything you need to know. Press <b>F9</b> anytime to toggle the panel visibility.<br><br>' +
                    'Click <b>"Done"</b> to close this tour and start analyzing!',
            },
        },
    ];
}

/**
 * Checks if the tour has already been completed.
 * @returns {boolean}
 */
export function isTourCompleted() {
    return GM_getValue(TOUR_SEEN_KEY, false) === true;
}

/**
 * Marks the tour as completed so it won't show again.
 */
function markTourCompleted() {
    GM_setValue(TOUR_SEEN_KEY, true);
}

/**
 * Resets the tour flag so it will show again on next load.
 */
export function resetTour() {
    GM_deleteValue(TOUR_SEEN_KEY);
    console.log('[IG Analyzer] Tour reset. It will show on next page load.');
}

/**
 * Starts the first-time user tour.
 * 
 * @param {Object} [options={}] - Override options
 * @param {boolean} [options.force=false] - Force the tour even if already completed
 * @returns {Object|null} The TamperGuide driver instance, or null if skipped
 */
/**
 * Starts the first-time user tour.
 * Temporarily disables the F9 toggle to prevent hiding the panel mid-tour.
 * 
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Object|null}
 */
export function startTour(options = {}) {
    const { force = false } = options;

    const tg = getTamperGuide();
    if (!tg) {
        console.warn(
            '[IG Analyzer] TamperGuide library not found in global scope. ' +
            'Make sure it is loaded via @require in the userscript header.'
        );
        return null;
    }

    if (!document.getElementById('ig-analyzer-panel')) {
        console.warn('[IG Analyzer] Panel not found in DOM. Cannot start tour.');
        return null;
    }

    if (!force && isTourCompleted()) {
        if (CONFIG.DEBUG) console.log('[IG Analyzer] Tour already completed. Skipping.');
        return null;
    }

    // Temporarily block F9 from hiding the panel during the tour
    const blockF9 = (e) => {
        if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };
    document.addEventListener('keydown', blockF9, true);

    // Make sure the panel is visible before starting
    const panel = document.getElementById('ig-analyzer-panel');
    if (panel) {
        panel.style.display = 'flex';
    }

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
        smoothScroll: false,   // Panel elements are fixed — no scroll needed
        popoverOffset: 12,
        steps: buildSteps(),

        onDestroyed: () => {
            // Re-enable F9 toggle
            document.removeEventListener('keydown', blockF9, true);
            markTourCompleted();
            console.log('[IG Analyzer] Tour completed and saved.');
        },

        onDestroyStarted: (element, step, opts) => {
            if (opts.driver.isLastStep()) return;

            const skip = confirm(
                'Skip the tour?\n\n' +
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