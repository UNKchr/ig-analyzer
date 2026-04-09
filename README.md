# Instagram Follower Analyzer

A robust Tampermonkey userscript that safely analyzes your Instagram followers and following lists. By interacting directly with Instagram's GraphQL API, it identifies users who do not follow you back, tracks follower changes over time, and now includes robust mutual username-change detection based on stable account IDs.

## Key Features

* **Block Detection:** Identifies users who have blocked your account by distinguishing likely blocks from deactivated profiles using authenticated and unauthenticated profile checks.
* **Advanced Analytics:** Discover your "Fans" (users who follow you, but you do not follow back) and "Mutuals" (users you follow and who follow you) instantly.
* **Confirmed Username Change Detection (Mutuals):** Detects mutual username changes by matching stable Instagram account IDs (`id`) between snapshots, preventing rename events from being misclassified as deactivated or unfollowed accounts.
* **Renamed Accounts History:** Includes a dedicated **Renamed** tab that stores and displays username transitions with previous username, current username, and detection date.
* **Churn & Deactivation Tracking:** Keeps a dated record of users who unfollow you while distinguishing real unfollows from accounts that became unavailable.
* **Visual Trend Indicators:** The History tab uses SVG indicators to visualize daily follower and following growth or decline.
* **Anti-Rate-Limit Retry Logic:** Implements exponential backoff to handle HTTP 429 responses more safely and reduce request pressure.
* **Direct CSV Export:** Download a `.csv` file containing usernames and profile URLs for non-followers, ready for Excel or Google Sheets.
* **Whitelist System:** Exclude selected users from non-followers results and CSV output; ignored users remain filtered in future scans.
* **Real-time Progress Tracking:** Displays progress based on total count and processed records during extraction.
* **Modern UI Panel:** Draggable panel with tabbed analytics, real-time logs, and persistent local state.
* **Historical Snapshots:** Stores local snapshots and compares runs to detect changes over time.
* **Keyboard Shortcuts:** Press `F9` to toggle panel visibility and `F8` to reset panel position.

---

## Installation

1. Install a userscript manager extension for your browser. **Tampermonkey** is recommended.
2. Open the raw script URL:
   <https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js>
3. Your userscript manager should detect the script automatically. Click **Install**.

---

## Usage Guide

1. Open `instagram.com` and make sure you are logged in.
2. The analyzer panel appears on the right side.  
   * If hidden, press `F9` to toggle visibility.
   * If unreachable, press `F8` to reset its default position.
3. Click **Run Analysis**.
4. Monitor progress in **Logs** and with the progress bar. Do not refresh or close the tab during processing.
5. Once completed, review tabs: **Not Following**, **Fans**, **Mutuals**, **Unfollowers**, **Deactivated**, **Blocked**, and **Renamed**.
6. Open **Renamed** to review confirmed username changes detected among mutual connections.
7. In **Not Following**, click **Ignore** to add users to your whitelist.
8. Click **Export CSV** to download filtered non-followers data.
9. Use **History** to inspect follower/following trends across runs.

---

## Detection Accuracy Notes

The analyzer uses a layered identity model for better classification accuracy:

1. **Primary identity key:** Stable Instagram account ID (`id`) from GraphQL nodes.
2. **Display identity:** Current `username`.
3. **Snapshot comparison:** Username-change detection compares records with the same `id` across runs.

This design significantly reduces false positives where a renamed mutual account might otherwise appear as deactivated, blocked, or unfollowed.

### Data Model and Compatibility

The script now stores both:

* Legacy arrays:
  * `followers`
  * `following`
* Enriched arrays:
  * `followersDetailed`
  * `followingDetailed`

Older snapshots remain supported. Username-only historical data is normalized at runtime for backward compatibility.

---

## UI and Panel Behavior

* The panel is draggable and position is persisted.
* Panel position is clamped to keep it reachable within viewport bounds.
* Default vertical sizing has been adjusted to reduce first-load overflow risk on shorter screens.
* The panel remains resizable by user control.

---

## Local Data Stored

The script stores data using Tampermonkey storage APIs (`GM_getValue`, `GM_setValue`) only on your browser profile.

Typical keys include:

* `ig_snapshot_v2`
* `ig_whitelist_v2`
* `ig_history_v2`
* `ig_churn_v3`
* `ig_deactivated_v3`
* `ig_blocked_v1`
* `ig_renamed_v1`
* `ig_panel_position_v2`
* `ig_tour_completed_v1`

Use the **Reset** button to clear persisted analyzer data.

---

## Disclaimer and Safety

This tool includes delays and retry logic intended to reduce operational risk; however, any automation against Instagram endpoints carries potential risk of temporary restrictions or action blocks.

Use responsibly. Avoid excessive repeated runs, especially on large accounts.

---

## License

Distributed under the MIT License.
