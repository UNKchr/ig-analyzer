import { UI } from './UI.js';
import { App } from './App.js';
import {
    startTour,
    resetTour
} from './Tour.js';

// No import for tamperGuide — it's loaded via @require into window.tamperGuide

UI.init();

window.App = App;

App.bindEvents();

// Start the first-time tour after the DOM is fully rendered, only if panel is visible
setTimeout(() => {
    const panel = document.getElementById("ig-analyzer-panel");
    if (panel && panel.style.display !== "none") {
        startTour();
    }
}, 800);

// Tampermonkey menu command for on-demand tour
if (typeof GM_registerMenuCommand === 'function') {
    const ensurePanelOpen = () => {
        const panel = document.getElementById("ig-analyzer-panel");
        if (panel && panel.style.display === "none") {
            UI.togglePanel();
        }
    };

    GM_registerMenuCommand('IG Analyzer: Replay Tour', () => {
        ensurePanelOpen();
        resetTour();
        startTour({ force: true });
    });
}

UI.log("IG Analyzer loaded. Press F9 to toggle panel, F8 to reset position.");