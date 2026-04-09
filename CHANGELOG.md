# Changelog

All notable changes to this project will be documented in this file.

## [3.6.0] - 2026-04-09

### Added

- **Confirmed Username Change Detection (Mutuals):** Implemented deterministic username change detection based on Instagram's stable user identifier (`node.id`) obtained from GraphQL responses.
- **New "Renamed" Tab:** Added a dedicated UI tab to display historical username changes detected among mutual connections.
- **Persistent Rename History:** Added a new storage key (`ig_renamed_v1`) and persistence flow for renamed-account events, including:
  - stable account id
  - previous username
  - current username
  - detection date
- **Detailed Snapshot Model:** Extended snapshot storage to keep both legacy username arrays and enriched user arrays:
  - `followersDetailed`
  - `followingDetailed`
  This enables robust account matching across username updates.

### Changed

- **Analysis Pipeline Migration to Detailed Users:** The core analysis now normalizes fetched users into `{ id, username }` records while preserving backward compatibility with previous snapshots.
- **Classification Safety Improvements:** Users detected as renamed are now excluded from deactivated/blocked/unfollower classification candidates to prevent false positives.
- **Tour Content Update:** Updated guided tour tab descriptions to include the new "Renamed" section.
- **Initial Panel Ergonomics:** Reduced default vertical panel height and improved viewport-fit behavior to avoid first-load overflow and preserve resize handle accessibility on shorter screens.

### Fixed

- **Critical Extraction Regression:** Fixed a logic error in `API.getAllUsers` that skipped valid users and returned zero followers/following.
- **Rename Detector Naming Consistency:** Corrected utility naming mismatch (`detectRenamedMutuals`) to ensure runtime invocation consistency.
- **Rename Entry Schema Consistency:** Ensured renamed records persist `newUsername` explicitly for accurate rendering and future-proof data handling.

### Compatibility

- **Backward Compatible Snapshot Reads:** Legacy snapshots containing only username arrays continue to load and are automatically normalized at runtime.
- **No Breaking UI/Theming Changes:** Existing visual style, tab behavior, and panel architecture remain intact.

## [3.5.0] - 2026-03-13

### Added

- **Block Detection Feature:** Implemented a new heuristic to accurately identify accounts that have blocked you. The script distinguishes between a deactivated profile and a block action by verifying the public availability of the user's profile via an unauthenticated request.
- **Blocked Accounts Interface:** Introduced a dedicated "Blocked" tab in the main panel to list and track users who have restricted your access to their profile.
- **Persistent Block Tracking:** Added a new storage configuration key (`ig_blocked_v1`) to securely save the history of detected block events across multiple sessions.
- **New UI Iconography:** Integrated a custom SVG icon representing blocked accounts, maintaining visual consistency with the application's design system.

## [3.4.0] - 2026-03-11

### Added

- **Panel Boundary Detection:** The draggable panel now automatically detects viewport edges and prevents the user from accidentally moving it out of reach. A minimum visible area is enforced on all sides of the screen.
- **Viewport Resize Handling:** When the browser window is resized, the panel position is automatically re-clamped to remain within the new viewport boundaries.
- **Position Reset Shortcut (F8):** Added a global keyboard shortcut (`F8`) to instantly reset the panel to its default position. This serves as a safety fallback if the panel ever becomes unreachable.
- **`resetPosition` method:** New method in the `UI` module to programmatically restore the panel to its default coordinates and clear the stored position.
- **`clampPosition` helper:** New method in the `UI` module that constrains arbitrary (x, y) coordinates to guarantee panel visibility within the viewport.
- **`MIN_VISIBLE_PX` constant:** New configuration constant in `Config.js` defining the minimum number of pixels that must remain visible when dragging the panel toward any viewport edge.
- **`DEFAULT_POSITION` constant:** New configuration constant in `Config.js` defining the default panel position values.

### Changed

- **`setupDrag`:** Updated to use `clampPosition` during every drag movement, preventing the panel from being dragged outside viewport boundaries.
- **`loadPosition`:** Updated to validate saved coordinates against the current viewport dimensions before applying them, preventing the panel from loading in an unreachable position after a window resize or resolution change.

## [3.1.0] - 2026-02-18

### Added

- **Active Safety (Safety Modal):** Implemented a warning modal before starting the analysis to alert the user about request limits and prevent temporary account restrictions.
- **Theme Awareness:** The panel now automatically detects if Instagram is in Light or Dark mode (via `MutationObserver`) and adapts its colors instantly without reloading the page.
- **Stylized Confirmation:** Reused the custom modal system for critical actions like "Reset Data", replacing native browser alerts with a UI-consistent design.

### Changed

- **Style Architecture:** Complete CSS refactoring. Removed JS style injection (`GM_addStyle`) and migrated to a dedicated `main.css` file with CSS variables (`:root`) for easier maintenance and theming.
- **UI Contrast:** Visual improvements to borders and button hover states to ensure optimal visibility on both light and dark backgrounds.
- **API Robustness (Hotfix):** Fixed the critical `Graph API structure changed` error. Implemented dynamic mapping to correctly handle Instagram node name variations (`edge_follow` vs `edge_followed_by`).
- **Code Cleanup:** Removed experimental REST API detection functions (Ghost/Deactivated) to prioritize the stability and safety of the GraphQL-based analysis.

## [3.0.0] - 2026-02-17

### Added

- **Advanced Metrics:** Added calculations to identify "Fans" (users who follow you, but you don't follow back) and "Mutuals" (users who follow each other).
- **Churn Tracking:** Implemented a nominal tracking system that permanently saves the exact usernames and dates of people who unfollow you.
- **Deactivated Account Detection:** The script now differentiates between a real unfollow and an account that has been deleted or suspended by Instagram.
- **Visual Trend Indicators:** Added pure SVG-based arrows (up, down, neutral) to the History tab to visually indicate follower and following growth or decline.
- **Expanded Interface:** Added dedicated tabs for "Fans", "Mutuals", "Unfollowers", and "Deactivated" accounts.

### Changed

- **UI Overhaul:** Modernized the panel design with a glassmorphism effect, refined colors, styled scrollbars, and improved spacing for a cleaner user experience.
- **Storage Management:** Added new persistent storage keys (`ig_churn_v3`, `ig_deactivated_v3`) to support nominal tracking across executions.

## [2.1.0] - 2026-02-14

### Added

- **Metrics History:** Introduced a new "History" tab that tracks and displays your followers and following counts over time, saving daily snapshots locally.
- **Whitelist System:** Added an "Ignore" button next to each user in the results list. Ignored users are automatically hidden from the UI, excluded from the CSV export, and will not appear in future analysis.

### Changed

- **Storage Management:** Expanded the `Storage` module to handle new keys for history and whitelist data. Modified the reset function to `resetAll` to wipe all stored data simultaneously.
- **UI Enhancements:** Updated the tabbed interface to accommodate the new History view and injected action buttons directly into the generated user rows.

## [2.0.0] - 2026-02-14

### Added

- **Anti-Ban Retry Logic:** Implemented an exponential backoff system to automatically handle Instagram's HTTP 429 (Rate Limit) errors safely, preventing script crashes and reducing account block risks.
- **CSV Export:** Replaced the raw JSON export with a direct `.csv` file download, making it easier for users to view and filter results in Excel or Google Sheets.
- **Progress Bar & Real-time Tracking:** Added a visual progress bar and percentage calculation to the UI by fetching the total followers/following count on the initial GraphQL request.
- **Results Tab:** Introduced a tabbed interface in the panel to switch between "Logs" and "Results", rendering the list of non-followers directly in the UI with clickable profile links.

### Changed

- **Code Architecture:** Completely refactored the codebase using the Separation of Concerns (SoC) principle. The script is now divided into modular objects (`Utils`, `Storage`, `UI`, `API`, and `App`) inside an IIFE for better maintainability and scalability.
- **String Handling:** Switched from large template literals to standard string concatenation and array `.join('\n')` for HTML injection to prevent syntax highlighting bugs in the Tampermonkey editor.

### Fixed

- **RegEx Editor Bug:** Replaced the regular expression used for cookie extraction (`ds_user_id`) with a robust `.split()` method to fix syntax parser breakage in user script managers.

### Removed

- Dead code: Removed the unused `computeDereivedData` function.

## [1.3.3] - 2026-02-13

### New Features

- **Keyboard Shortcut (F9):** Added a global shortcut to quickly show/hide the analyzer panel. Includes safety checks to prevent accidental triggers while typing in inputs or textareas.

### Bug Fixes

- Code style and formatting issues, including ESLint `no-multi-spaces` warnings.

## [1.2.9] - 2026-02-13

### Features

- Draggable UI panel
- Snapshot comparison between executions

### Fixed

- GraphQL pagination issues
- Improved error handling and logging
