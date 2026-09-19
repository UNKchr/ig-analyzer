# Changelog

All notable changes to this project will be documented in this file.

## [3.9.0] - 2026-09-19

### Added

- **On-Demand Analysis Cancellation:**
  - The "Run Analysis" button dynamically converts into a "Cancel Analysis" button while a scan is running.
  - Powered by `AbortController`, cancellation halts network pagination, profile verifications, and background delays instantly, cleanly restoring the UI and analyzer state to idle.
- **Client-Side Results Pagination (Performance & DOM Optimization):**
  - Implemented pagination (50 items per page) for user lists in all result tabs (Not Following, Fans, Mutuals).
  - Added interactive `← Prev` and `Next →` navigation controls with page counters, completely eliminating DOM bloat and browser UI freezes when inspecting accounts with thousands of followers.
- **Multi-Account Storage Scoping & Isolation:**
  - Storage keys are now dynamically isolated by Instagram account ID (`${baseKey}_${userId}`), preventing data cross-contamination when managing multiple accounts in the same browser profile.
  - Features transparent, automatic backward migration of legacy unscoped data upon first read.
- **Authorized Backup Key Whitelisting:**
  - Added strict key validation (`isAuthorizedBackupKey`) during backup imports, ensuring only authorized analyzer keys with valid numeric account ID suffixes can be imported, preventing arbitrary storage key injection.
- **Unified Event Delegation:**
  - Replaced repetitive per-element click listeners with a single, performant delegated click listener on `#ig-analyzer-panel` for all user row actions (Story Spy, Whitelist/Ignore, and Pagination).

### Security

- **CSV Formula Injection Mitigation (CWE-1236):**
  - Fully sanitized CSV export generation in `Utils.exportCSV`: prepends a single quote (`'`) to any cell value starting with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), escapes internal quotes, and wraps fields in double quotes per RFC 4180.
  - Added UTF-8 Byte Order Mark (`\uFEFF`) to guarantee accurate character encoding across Microsoft Excel, LibreOffice Calc, and Google Sheets.
- **Strict XSS & Protocol Sanitization:**
  - Hardened `Utils.sanitizeUrl` to block malicious URI schemes (`javascript:`, `data:`, `vbscript:`).
  - Introduced `Utils.sanitizeImageUrl` to validate HTTPS protocols and proper URI formatting before inserting avatar URLs into `<img>` tags.
  - Applied comprehensive HTML entity escaping (`Utils.escapeHtml`) across all user-supplied data in modal alerts, logs, and user rows.

### Fixed

- **HTTP 429 Eradication in Story Spy & Account Status:**
  - Completely eliminated all calls to Meta's restricted REST endpoint (`/api/v1/users/web_profile_info/?username=...`) across `checkStoryStatus`, `checkAccountStatus`, and `getUserIdAsync`.
  - Both Story Spy and Account Status modules now extract data directly from official Server-Side Rendered (SSR) HTML and canvas element signatures (`latest_reel_media`, `highlight_reel_count`, `is_private`), eliminating red HTTP 429 warnings in browser DevTools and speeding up analysis.
- **Analysis Freeze & Unhandled Exception Recovery:**
  - Restored `Utils.now()` and `CONFIG` imports in `Utils.js`.
  - Wrapped `UI.log()` in defensive `try/catch` and enclosed the entire `App.run()` execution flow within `try/catch/finally` to guarantee that UI states, buttons, and flags always recover cleanly.
- **Tour Visibility on Closed Panel:**
  - Fixed tour auto-start to only trigger when the analyzer panel is visible.
  - Updated the Tampermonkey menu command (`GM_registerMenuCommand`) to automatically open the panel if closed before replaying the tour.

## [3.8.2] - 2026-09-10

### Added

- **Multilingual Userscript Metadata (Localization):**
  - Added localized `@name` and `@description` userscript tags to expand global visibility and accessibility across script repositories (Greasyfork, Sleazyfork, OpenUserJS) and browser userscript managers.
  - Supported locales:
    - Spanish (`es`, `es-419`): *"Analizador de seguidores de Instagram"* / *"Analiza seguidores y seguidos de Instagram, detecta quién no te sigue de vuelta, anomalías en historias y exporta datos."*
    - Portuguese (`pt`, `pt-BR`, `pt-PT`): *"Analisador de seguidores do Instagram"* / *"Analise seguidores e quem não te segue de volta no Instagram, detecte anomalias em stories e exporte dados."*
  - Configured seamlessly through Vite's `LocaleType` structure in `vite.config.js`.

## [3.8.1] - 2026-09-10

### Fixed

- **False-Positive "Blocked" Classifications:** Resolved an issue where accounts that simply unfollowed you and removed you from their followers (soft-block or manual follower removal) were being misdiagnosed as having blocked you:
  - Added required `X-Requested-With: XMLHttpRequest` and `Accept: */*` headers to `web_profile_info` requests to prevent HTTP 400 rejection.
  - Handled HTTP 429 (Rate Limit) explicitly to guarantee that rate-limited responses are never interpreted as a block.
  - Implemented dual-stage authenticated verification with HTML profile fallback (`https://www.instagram.com/${cleanUser}/`) to ensure that accessible public and private profiles are recognized as Active.
  - Enforced that an account is only flagged as `Blocked` if the authenticated session receives a confirmed 404 or "Page Not Found" error while the anonymous guest session confirms the account exists.
  - Added safe pagination delays (`BASE_RATE_LIMIT_MS`) between each lost account verification to prevent rate limits.
  - Added automatic healing to clear previously misclassified accounts from the Blocked list when they are confirmed Active or present in following/followers.
- **CSS Safari Compatibility & Vendor Prefix Order:** Corrected all 5 Edge Tools / webhint diagnostics in `main.css`:
  - Added `-webkit-user-select: none;` before `user-select: none;` in `#ig-header` and `.btn-spy-story` for Safari/iOS compatibility.
  - Reordered `-webkit-backdrop-filter` before `backdrop-filter` in `#ig-analyzer-panel`, `.ig-backup-overlay`, and `.ig-modal-overlay`.

## [3.8.0] - 2026-09-10

### Added

- **Story Anomaly Detection ("Story Spy Module"):**
  - Added an independent, manual per-user check (`[SVG] Check Story`) available in Mutuals, Fans, and Not Following lists.
  - Multi-source story and highlights detection analyzing profile canvas element signatures (`<canvas height="84" width="84">` for highlights, `<canvas height="115" width="115">` for active stories), initial SSR state script regex (`"highlight_reel_count"` and `"latest_reel_media"`), and REST API endpoints.
  - **Public Accounts Detection:** Performs an anonymous guest check (`credentials: "omit"`) to compare against authenticated visibility. If highlights or stories are detectable anonymously but missing in authenticated session, a 100% hiding probability is confirmed.
  - **Private Accounts Chronological Baseline:** Tracks highlight availability over time (`ig_story_observations_v1`), calculating a 75% probability if previously visible highlights abruptly disappear to 0.
  - Interactive alert modal displaying hiding probability, diagnostic rationale, account details, and a dedicated spy SVG icon with clean dark/light theme integration (strict SVG, no emojis).
- **Rich User Profile Rows:**
  - Added user profile photo avatars (`profile_pic_url`) with fallback to initial letter badge.
  - Added full names (`fullName`) under usernames in list views.
  - Added verified account blue checkmarks (`isVerified`).
  - Added active story ring visual indicator around avatars when a user has a recent story (`latestReelMedia > 0`).
- **Icons & UI Enhancements:**
  - Added custom `Icons.spy` SVG icon.
  - Styled `.btn-spy-story` with smooth hover states, purple spy accent, and loading indicators (`Scanning...`).

### Changed

- **Core Extraction Engine Migration (Native Friendships REST API):**
  - Migrated the primary follower and following extraction pipeline from Instagram's legacy GraphQL query hashes (`edge_follow` / `edge_followed_by`) to Instagram's official REST API (`/api/v1/friendships/${userId}/${endpoint}/?count=50&search_surface=follow_list_page`).
  - Implemented automatic fallback to legacy GraphQL query hashes if the REST API endpoint is blocked or returns an empty payload.
  - Normalized user entities to capture `pk` / `id`, `username`, `fullName`, `isPrivate`, `isVerified`, `profilePicUrl`, and `latestReelMedia`.
- **Deliberate Pacing & Rate-Limit Hardening:**
  - Native REST endpoints are subject to stricter rate limits and behavioral scrutiny by Instagram compared to legacy GraphQL.
  - Increased base pagination delay (`BASE_RATE_LIMIT_MS`) from 1500ms to 2000ms with expanded random jitter (+0-800ms) to simulate human pacing, reduce automated traffic signatures, and avoid account restrictions.

### Security & Safety

- **Rate-Limit & Account Restriction Advisory:**
  - Instagram's native REST endpoints are significantly more sensitive to automation patterns than older GraphQL endpoints.
  - To mitigate risk of temporary account blocks, challenges, or restrictions, extraction pacing is intentionally slower.
  - Users are advised to run scans at reasonable intervals (no more than once per hour) and avoid rapid repeated scans.

### Fixed

- **Story Spy Event Bubbling:** Resolved event target bubbling where clicking child `<svg>` or `<path>` elements of `.btn-spy-story` caused `e.target.getAttribute('data-user')` to return `null`. Implemented centralized event delegation with `e.target.closest('.btn-spy-story')`.
- **Module Bundling Scope:** Corrected global `window.App` exposure in Vite's IIFE output so UI actions can reliably call `App.runStorySpy`.
- **Action Modal UX:** Improved `confirmAction` to support custom icons (`customIcon`) and hide the redundant cancel button on notification/alert modals (`showCancel = false`).

## [3.7.0] - 2026-08-11

### Added

- **Backup & Restore Feature:** Added a dedicated Backup tab that exports all current analyzer storage into a local JSON file and restores it later if browser data is lost.
- **Backup Metadata Validation:** The backup format now includes script metadata, schema version, timestamp, and stored key count to improve import safety and compatibility checks.
- **Backup UI Integration:** Added a new panel action with a custom SVG icon and dedicated popup for export/import actions.

### Changed

- **Userscript Metadata Update:** Updated the release metadata to `3.7.0` and refreshed the script description to include backup and restore capabilities.
- **Documentation Refresh:** Updated the README to describe the new backup workflow and recovery behavior.

## [3.6.1] - 2026-08-08

### Security

- **Vulnerability Patch:** Addressed and resolved a security vulnerability to ensure safe data handling and script execution.

### Fixed

- **Minor Bug Fixes:** Resolved minor UI rendering edge cases and unexpected runtime exceptions.

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
