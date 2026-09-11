# Instagram Follower Analyzer

A powerful and elegant Tampermonkey userscript that safely analyzes your Instagram followers and following lists. Powered by Instagram's native internal Friendships REST API (with automatic legacy GraphQL fallback), it detects users who do not follow you back, tracks follower changes over time, identifies account blocks and renames, displays enriched user profiles, and features an on-demand --Story Anomaly Detection ("Story Spy")-- module.

---

## ⚠️ Important Safety & Anti-Ban Notice

> [!WARNING]
> --REST API Sensitivity and Increased Execution Time--  
> Instagram's native internal REST API (`/api/v1/friendships/`) is subject to significantly stricter rate limits and automated behavioral monitoring than legacy GraphQL endpoints. Rapid or excessive automated requests to this API carry a heightened risk of --temporary account restrictions, action blocks, or verification challenges--.
>
> To safeguard your account:
>
> - --Paced Execution:-- The analyzer intentionally incorporates extended delays between request batches (`2000ms` base delay + randomized human jitter). As a result, --analyses will take longer to complete--, which is an intentional safety measure designed to simulate natural human browsing patterns and avoid raising alarms with Instagram's anti-bot systems.
> - --Recommended Frequency:-- We strongly recommend running a full analysis --no more than once every 1 to 2 hours--. Avoid running back-to-back analyses, especially on accounts with thousands of followers.
> - --On-Demand Story Checks:-- The Story Spy feature is strictly manual and executes independently per user — it is never executed automatically in bulk.
> - If you ever encounter an action restriction or verification prompt from Instagram, cease using the analyzer immediately and wait 24–48 hours before retrying.

---

## Key Features

- --Native Friendships REST API Engine:-- Uses Instagram's modern internal REST endpoints (`/api/v1/friendships/{userId}/followers|following/`) for accurate pagination and enriched profile metadata, with automatic fallback to legacy GraphQL query hashes if REST requests are blocked or empty.
- --Story Anomaly Detection ("Story Spy Module"):-- An on-demand tool next to each user in the Mutuals, Fans, and Not Following tabs to check if an account is hiding their stories or highlights from you:
  - --Public Accounts (100% Probability):-- Compares your authenticated session against an anonymous guest session (`credentials: "omit"`). If highlight canvas signatures (`<canvas height="84" width="84"...>`) or active story rings are detectable anonymously but missing from your logged-in view, a 100% hiding probability is confirmed.
  - --Private Accounts (75% Probability):-- Tracks highlight counts chronologically. If an account previously had visible highlights and suddenly drops to 0, an anomaly is flagged.
  - --Zero Emojis, Pure SVG:-- Built with clean SVG iconography (`Icons.spy`) and dedicated styling matching the dark/light interface.
- --Rich User Profile Rows:-- Displays user profile photo avatars (`profile_pic_url`), full names (`fullName`), verified account blue checkmarks (`✓`), and active story rings around avatars (`latestReelMedia > 0`).
- --Block Detection:-- Identifies users who have blocked your account by distinguishing likely blocks from deactivated profiles using authenticated and unauthenticated profile checks.
- --Advanced Analytics:-- Discover your "Fans" (users who follow you, but you do not follow back) and "Mutuals" (users you follow and who follow you) instantly.
- --Confirmed Username Change Detection (Mutuals):-- Detects mutual username changes by matching stable Instagram account IDs (`id` / `pk`) between snapshots, preventing rename events from being misclassified as deactivated or unfollowed accounts.
- --Renamed Accounts History:-- Includes a dedicated --Renamed-- tab that stores and displays username transitions with previous username, current username, and detection date.
- --Churn & Deactivation Tracking:-- Keeps a dated record of users who unfollow you while distinguishing real unfollows from accounts that became unavailable.
- --Visual Trend Indicators:-- The History tab uses SVG indicators to visualize daily follower and following growth or decline.
- --Anti-Rate-Limit Retry Logic:-- Implements exponential backoff to handle HTTP 429 responses safely and reduce request pressure.
- --Direct CSV Export:-- Download a `.csv` file containing usernames and profile URLs for non-followers, ready for Excel or Google Sheets.
- --Backup & Restore:-- Export all current analyzer data to a local JSON backup and import it later to recover history, lists, and persistent state if browser data is lost.
- --Whitelist System:-- Exclude selected users from non-followers results and CSV output; ignored users remain filtered in future scans.
- --Real-time Progress Tracking:-- Displays progress based on total count and processed records during extraction.
- --Modern UI Panel:-- Draggable panel with tabbed analytics, real-time logs, Light/Dark theme awareness, and persistent local state.
- --Keyboard Shortcuts:-- Press `F9` to toggle panel visibility and `F8` to reset panel position.

---

## Installation

1. Install a userscript manager extension for your browser. --Tampermonkey-- is recommended.
2. Open the raw script URL:
   <https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js>
3. Your userscript manager should detect the script automatically. Click --Install-- (or --Update--).

---

## Usage Guide

1. Open `instagram.com` and make sure you are logged in.
2. The analyzer panel appears on the right side.  
   - If hidden, press `F9` to toggle visibility.
   - If unreachable, press `F8` to reset its default position.
3. Click --Run Analysis--.
4. A safety reminder will confirm your intent. Click --Yes, Continue--.
5. Monitor progress in --Logs-- and with the progress bar. Do not refresh or close the tab during processing.
6. Once completed, review tabs: --Not Following--, --Fans--, --Mutuals--, --Unfollowers--, --Deactivated--, --Blocked--, and --Renamed--.
7. Click --`Check Story`-- next to any user in --Mutuals--, --Fans--, or --Not Following-- to perform a targeted story visibility check.
8. In --Not Following--, click --Ignore-- to add users to your whitelist.
9. Click --Export CSV-- to download filtered non-followers data.
10. Use --History-- to inspect follower/following trends across runs.
11. Open --Backup-- to export a complete JSON snapshot of the analyzer state or import one later to restore it after data loss.

---

## Detection Accuracy Notes

The analyzer uses a layered identity model for better classification accuracy:

1. --Primary identity key:-- Stable Instagram account ID (`id`) from GraphQL nodes.
2. --Display identity:-- Current `username`.
3. --Snapshot comparison:-- Username-change detection compares records with the same `id` across runs.

This design significantly reduces false positives where a renamed mutual account might otherwise appear as deactivated, blocked, or unfollowed.

### Data Model and Compatibility

The script now stores both:

- Legacy arrays:
  - `followers`
  - `following`
- Enriched arrays:
  - `followersDetailed`
  - `followingDetailed`

Older snapshots remain supported. Username-only historical data is normalized at runtime for backward compatibility.

---

## UI and Panel Behavior

- The panel is draggable and position is persisted.
- Panel position is clamped to keep it reachable within viewport bounds.
- Default vertical sizing has been adjusted to reduce first-load overflow risk on shorter screens.
- The panel remains resizable by user control.

---

## Local Data Stored

All data is stored locally on your browser profile using Tampermonkey's private storage APIs (`GM_getValue`, `GM_setValue`). No data is ever transmitted to third-party servers.

Stored keys:

- `ig_snapshot_v2`: Latest complete scan snapshot (followers, following, detailed records).
- `ig_whitelist_v2`: Ignored / whitelisted usernames.
- `ig_history_v2`: Daily follower and following counts for historical trend tracking.
- `ig_churn_v3`: Log of detected unfollow events with timestamps.
- `ig_deactivated_v3`: Log of accounts identified as deactivated or unavailable.
- `ig_blocked_v1`: Log of accounts detected as having blocked your profile.
- `ig_renamed_v1`: Log of confirmed username changes (old vs new usernames).
- `ig_story_observations_v1`: Historical highlight count observations for private accounts.
- `ig_panel_position_v2`: Saved screen coordinates of the draggable panel.
- `ig_tour_completed_v1`: Flag recording if the interactive tour has been completed.

The --Backup-- tool exports all current analyzer storage entries into a single JSON file with metadata, and the same file can be imported later to restore the saved state into the browser.

Use the --Reset-- button to clear persisted analyzer data.

---

## Disclaimer and Safe Usage

This tool includes deliberate request delays, randomized human-like jitter, and exponential backoff retry logic intended to minimize operational risk. However, any automated interaction with Instagram's web endpoints carries an inherent risk of temporary action blocks, verification challenges, or restrictions.

- --Never run scans continuously or repeatedly within short timeframes.--
- --Limit full analyses to once every 1 to 2 hours.--
- --If Instagram presents an action block or checkpoint, stop usage immediately and wait 24 to 48 hours.--

Use responsibly and at your own discretion.

---

## License

Distributed under the MIT License.
