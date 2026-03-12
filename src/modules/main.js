import { UI } from './UI.js';
import { App } from './App.js';
import { startTour, resetTour } from './Tour.js';

// No import for tamperGuide — it's loaded via @require into window.tamperGuide

UI.init();

App.bindEvents();

// Start the first-time tour after the DOM is fully rendered
setTimeout(() => {
    startTour();
}, 800);

// Tampermonkey menu command to replay the tour on demand
if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Replay IG Analyzer Tour', () => {
        resetTour();
        startTour({ force: true });
    });
}

console.log("IG Analyzer loaded. Press F9 to toggle panel, F8 to reset position.");