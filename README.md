# Instagram Follower Analyzer

[![Userscript](https://img.shields.io/badge/Tampermonkey-Userscript-blue?logo=tampermonkey)](https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js)
[![Version](https://img.shields.io/badge/version-3.12.0-emerald.svg)](package.json)
[![License: Custom](https://img.shields.io/badge/License-CSAL--NC-amber.svg)](LICENSE)
[![Maintenance](https://img.shields.io/badge/maintained%3F-yes-brightgreen.svg)](https://github.com/UNKchr/ig-analyzer)

A sophisticated, privacy-first Tampermonkey userscript that deeply analyzes your Instagram followers and following lists. Built directly on top of Instagram's native internal Friendships REST API (with automatic legacy GraphQL fallback), it detects non-followers, tracks new audience gains, uncovers secret unfollowers, distinguishes account blocks from deactivations, maps mutual username changes, provides **Quick-Card 1080p profile inspection**, features an on-demand **Story Spy 2.0** anomaly detection module, and includes an independent **Target Tracker** subpanel for third-party audience audits.

---

## ⚠️ Important Safety & Anti-Ban Notice

> [!WARNING]
> **REST API Sensitivity and Paced Execution**  
> Instagram's internal REST API endpoints (`/api/v1/friendships/`) are subject to strict automated behavioral monitoring and rate limits. Rapid or excessive automated requests to this API carry a heightened risk of temporary account restrictions, action blocks, or verification challenges.
>
> To safeguard your account:
>
> - **Paced Execution & Human Jitter:** The analyzer intentionally incorporates extended delays between request batches (`2000ms` base delay + randomized human jitter). Scans take longer to complete by design to simulate natural human browsing patterns and avoid triggering Instagram's automated protection mechanisms.
> - **Recommended Frequency:** We strongly recommend running a full analysis **no more than once every 1 to 2 hours**. Avoid running back-to-back analyses, especially on accounts with thousands of followers.
> - **On-Demand Story Checks:** The Story Spy feature is strictly manual and executes independently per user — it is never executed automatically in bulk.
> - **Target Audience Audits:** When auditing external accounts with Target Tracker, always respect target audience sizes and allow safe pauses between scans.
> - If you ever encounter an action restriction or verification prompt from Instagram, cease using the analyzer immediately and wait 24–48 hours before retrying.

---

## 🌟 Key Features

### 🎯 Target Tracker & Deep Audit Child Subpanel (New in v3.12.0)
- **Independent Floating Subpanel (`#ig-target-subpanel`):** A secondary floating window operating with high z-index over the main panel, featuring draggable header positioning (`ig_target_position_v1`), native corner resizing (`resize: both`), and full window controls (minimize/expand, close, refresh).
- **Comprehensive Audience Navigation:** Tabbed navigation (*Overview*, *Mutuals*, *New Followers*, *Lost Followers*, *Followers*, *Following*, and *Logs*) with a fluid animated sliding indicator.
- **Third-Party Audience Audits:** Monitor any target public Instagram profile directly from the main panel search input or via the quick audit button (`.ig-btn-target-audit`) present on any user row.
- **Audience Dynamics & Shared Mutuals:** Identifies followers gained and lost between successive audits of target accounts and highlights connections you share in common (*Shared Mutuals*) with emerald badges.
- **Contextual CSV Export:** Export filtered data specific to the active tab in the target audit window.
- **Ethical Privacy Guards:** Automatically identifies private accounts you do not follow, logs public header counters safely, and avoids unauthorized list extractions.

> 💡 **Real-World Use Case — Social Auditing & Relationship Dynamics:**  
> Suppose you are in a relationship, or have a close friend or colleague who has recently seemed distant or acting unusual. You previously ran an initial baseline audit on their public profile with Target Tracker. Days later, their following count increases. Running another audit in Target Tracker immediately flags their **New Followers** and **New Following**, revealing a new mutual connection with a suspicious profile. From that exact row, you can inspect the new account's profile in HD, check their mutual friends, or even launch a child audit directly on that new account.  
> *Note:* The analyzer surfaces objective network deltas and factual connection changes — it does not draw personal conclusions or confirm infidelity on its own. Final interpretation and verification always rely on the human user and real-world evidence.

### 👥 Dedicated New Followers Center (New in v3.11.0)
- **Automatic Intake Tracking:** Automatically identifies new accounts gained since your previous scan and records them with detection timestamps in `Storage.addNewFollowersEntries`.
- **Relationship Badges:** Instantly identifies if a new follower is a **Mutual** (you follow them back) or a **Fan** (they follow you, but you don't follow back yet).
- **Full Card Integration:** Supports real-time search, filter chips, Quick-Card HD modal inspection, and Story Spy.

### 🛡️ Visual Whitelist Manager (New in v3.11.0)
- **Dedicated Whitelist Tab:** Review all ignored accounts in a single place with a real-time search filter.
- **Instant Restore Action:** Restore any whitelisted account back to the "Not Following" tab with a single click (`.btn-unwhitelist`) accompanied by a smooth slide-out animation.
- **Batch Clear:** Clear the entire whitelist safely with a confirmation modal dialog.

> 💡 **Real-World Use Case — Noise-Free Audits without Losing Creators & Brands:**  
> If you follow hundreds of accounts, many of them are likely news media, brands, meme channels, or celebrities (e.g., `@nasa`, `@cristiano`) that you intentionally follow without expecting a follow-back. By clicking **Ignore** on them in the "Not Following" view, they are instantly moved to your Whitelist tab. This keeps your active "Not Following" list 100% clean and focused strictly on personal acquaintances, classmates, or colleagues who failed to follow you back. If you ever want to re-include an account in your audits, simply open the Whitelist tab and click **Restore**.

### 📈 Net Growth Dynamics & KPI Summary Cards (New in v3.11.0)
- **Audience Balance Header:** 3-card metric grid (`.ig-history-kpi-grid`) positioned above the chronological scan history:
  - **Current Followers:** Total follower count with trending indicators (`trendingUp` / `trendingDown`).
  - **Current Following:** Total accounts you follow with delta changes.
  - **Audience Balance (Net Flow):** Real-time calculation showing `+X New / -Y Lost` with dynamic status coloring.

### 🔍 Quick-Card Profile Inspector & HD Avatar Viewer (New in v3.10.1)
- **1080p Avatar Inspection:** Click any user avatar or the inspection eye button (`.ig-btn-inspect-user`) to open a rich modal displaying full-resolution profile photos with a 1-click HD download button (`Utils.downloadImage`).
- **Live Relationship Status Pills:** Displays real-time pills for mutual friendship status (*Follows you / Does not follow you*, *Following / Not following*, and *Follow Request Pending*).
- **Profile Context:** Shows formatted follower/following/post counts, full biographical text with clickable links, business/creator tags (`Icons.briefcase` / `Icons.creator`), and mutual friends facepile counters.
- **Zero-Latency Cache:** Utilizes an in-memory profile cache for instantaneous subsequent views.

> 💡 **Real-World Use Case — Vetting Suspicious Follow Requests in 1080p:**  
> When you receive a follow request or direct message from an unfamiliar account with a tiny, unrecognizable avatar thumbnail, Instagram's web interface normally only shows a 150×150 compressed preview. With 1 click on Quick-Card Inspector, you can view their uncompressed 1080p profile picture, download it in full HD with one click, read their full bio with clickable links, view mutual friends facepiles, and verify your exact real-time relationship status pills (*Follows you*, *Following*, *Pending*) before deciding whether to accept.

### 🕵️ Story Spy 2.0 — Dual-Channel Anomaly Detection Engine (New in v3.10.1)
- **Relay Modern GraphQL & Highlights Tray:** Queries Meta's internal GraphQL endpoints (`PolarisProfilePageContentQuery`) and official Highlights Tray API (`/api/v1/highlights/{userId}/highlights_tray/`).
- **Precise Story State Tracking:** Accurately reads unix timestamps for active stories (`latest_reel_media`), Close Friends stories (`latest_besties_reel_media`), and server-gated access states (`null`).
- **24-Hour Decay Math & Vanished Stories:** Correlates active story timestamps against current time. If an unexpired story vanishes along with highlights, anomaly probability spikes to 95%.
- **Highlight Disappearance Alerts:** Because highlights do not expire naturally, a sudden drop from visible highlights (>0) to 0 flags an immediate high-probability alert (85–95%) that stories/highlights are being hidden from your account.
- **Interactive Multi-Factor Modal:** Explains detected anomalies with percentage confidence badges, live item counters, and a chronological scan history timeline.

> 💡 **Real-World Use Case & Critical Probabilistic Nuance — Checking Hidden Stories:**  
> When you want to know if someone is specifically hiding their stories or highlights from your account:
> - **Public Accounts (100% Deterministic Verification):** Story Spy compares your logged-in session against Meta's anonymous guest GraphQL tray. If an active story or highlight tray is visible to anonymous visitors but completely hidden from your authenticated profile, it is a 100% confirmed hide.
> - **Private Accounts (Heuristic Probability & 24h Decay):** Because private profiles cannot be fetched anonymously, Story Spy relies on longitudinal highlight logs and 24h decay math. If an active story vanishes prematurely or existing highlights suddenly drop to 0, an anomaly alert is raised (85–95% probability).
> - **Important Verification Note:** Results on private accounts should **never be treated as 100% absolute proof**. A user may have legitimately chosen to archive or delete all their highlights for everyone, or simply let their stories expire without targeting you specifically. If you have a trusted secondary account that also follows that private profile, you can check whether stories or highlights are visible there to cross-verify the finding.

### 🎓 Single Unified Guided Tour (v3.12.0)
- **TamperGuide Engine:** Integrated complete guided tour powered by `TamperGuide` explaining all features in a single smooth walkthrough.
- **Visual Order Progression:** Strictly follows the panel's tab sequence (Logs ➔ History ➔ Not Following ➔ Fans ➔ Mutuals ➔ Target Tracker ➔ New Followers ➔ Whitelist ➔ Unfollowers ➔ Deactivated ➔ Blocked ➔ Renamed ➔ Backup).
- **Single Beacon Guided Analysis:** A single interactive beacon on the **Run Analysis** button guides you to initiate a safe scan, automatically populating the live search bar, filter chips, Story Spy, Quick-Card Inspector, and Whitelist tools before explaining them.
- **Safe & Non-Intrusive Popovers:** All other actions (Export CSV, Reset Data, and the Backup tab) are explained with non-destructive, informative popovers with zero forced clicks or unexpected data exports.
- **Tampermonkey Menu Command:** Replay the complete tour at any time on-demand from the userscript menu (`IG Analyzer: Replay Tour`).

### ⚡ Search Bar & Interactive Category Filter Chips
- **Debounced Instant Search:** Filter any list in real-time by typing usernames or display names.
- **Category Filter Chips:** Instant toggle chips with live counters across result views: **All**, **Private**, **Public**, **Besties** (Close Friends), **With Story**, and **Verified**.

### 🔒 Core Analytics, Safety & Security
- **Native Friendships REST API:** Primary extraction using `/api/v1/friendships/` with automatic fallback to legacy GraphQL query hashes.
- **Block vs. Deactivation Disentanglement:** Accurately differentiates users who blocked you from deactivated profiles by comparing authenticated responses against anonymous guest checks (`credentials: "omit"`).
- **Confirmed Username Change Detection (Mutuals):** Matches persistent numeric account IDs (`id` / `pk`) across scans to track username renames without misclassifying accounts as unfollowed.
- **Client-Side Virtualized Pagination:** Smooth 50-user pagination with `← Prev` and `Next →` navigation, preventing DOM bloat and browser lag.
- **Multi-Account Storage Isolation:** Scopes all saved data by Instagram account ID (`${key}_${userId}`), ensuring zero cross-contamination when switching accounts in the same browser profile.
- **Anti-Formula Injection CSV Export:** Protects exported CSV files against spreadsheet formula injection (CWE-1236) and prepends a UTF-8 BOM (`\uFEFF`) for universal spreadsheet compatibility.
- **Robust Backup & Restore:** Encrypted/sanitized JSON export and import with strict key validation, prototype pollution defense, and smart account re-scoping.
- **Dark & Light Adaptive Theme:** Automatically synchronizes with Instagram's native theme.

> 💡 **Real-World Use Case — "Did They Block Me, Delete Their Profile, or Just Rename?":**  
> When a contact suddenly disappears from your feed and DM search, Instagram gives no explanation. The analyzer solves this ambiguity:
> - **Blocked:** The analyzer makes an anonymous guest request. If the account exists publicly to anonymous users but returns restricted errors or 404 to your logged-in session, it is categorized as **Blocked**.
> - **Deactivated:** If the account returns a 404 to both your logged-in account and anonymous guest sessions, it is categorized as **Deactivated**.
> - **Renamed:** If a mutual connection simply changed their handle (`@old_name ➔ @new_name`), the script matches their permanent numeric Instagram ID (`pk`), preventing false unfollower alarms.

---

## 📦 Installation

1. Install a userscript manager extension in your browser (**[Tampermonkey](https://www.tampermonkey.net/)** is strongly recommended).
2. Click the installation link below:
   👉 **[Install Instagram Follower Analyzer (v3.12.0)](https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/dist/instagram-follower-analyzer.user.js)**
3. Tampermonkey will prompt you to inspect and confirm the script. Click **Install** (or **Update**).

---

## 🚀 Usage Guide

1. Navigate to **[instagram.com](https://www.instagram.com/)** and ensure you are logged in.
2. The analyzer panel will appear on the right side of the screen:
   - **Press `F9`** to toggle panel visibility at any time.
   - **Press `F8`** to reset the panel to its default screen position.
3. Click **Run Analysis** to begin scanning your account:
   - Read the safety confirmation prompt and click **Yes, Continue**.
   - While the scan is running, the button converts to **Cancel Analysis**, allowing you to safely abort at any time via `AbortController`.
4. Monitor live progress in the **Logs** tab and observe the proportional percentage progress bar.
5. Once completed, explore your analysis through the tabs in order:
   - **Logs:** Real-time diagnostic feed showing background API requests, batch counts, and rate limit cooldowns.
   - **History:** Long-term follower growth trends, daily deltas, and Audience Balance KPI cards.
   - **Not Following:** Accounts you follow who do not follow you back. Use the **Live Search**, **Filter Chips**, **Story Spy**, **Quick-Card HD Inspector**, or click **Ignore** to whitelist anyone you wish to exempt.
   - **Fans:** Accounts that follow you, but you do not follow back.
   - **Mutuals:** Friends who follow each other, with active story status rings.
   - **Target Tracker:** Enter any public `@username` to audit their audience or view previously tracked target accounts.
   - **New Followers:** New accounts gained since your previous scan, marked as Mutual or Fan.
   - **Whitelist:** Review ignored accounts and click **Restore** to reinsert them into active results.
   - **Unfollowers:** History of accounts that unfollowed you over time.
   - **Deactivated:** Accounts that have temporarily or permanently deactivated.
   - **Blocked:** Accounts confirmed to have blocked your profile.
   - **Renamed:** Confirmed username changes among mutual accounts.
   - **Backup:** Click to export or import your analyzer database.
6. **Quick Profile Inspection:** Click on any user avatar or the eye icon to view full-resolution 1080p profile pictures, biographies, relationship pills, and mutual friends.
7. **Story Spy:** Click **Check Story** next to any user row to test whether their active stories or highlights are visible to you or hidden.
8. **Audience Audits:** Click the Target icon (`.ig-btn-target-audit`) next to any user to open the floating **Target Tracker Subpanel** and audit their network.
9. **Export CSV:** Click **Export CSV** to download a sanitized spreadsheet of the active view.
10. **Backup Data:** Click the **Backup** button in the tab bar to export or import your analyzer database.

---

## 🎯 Target Tracker Subpanel Behavior

- The Target Tracker window (`#ig-target-subpanel`) is an independent floating child window that opens on top of the main panel.
- Grab the header bar to drag the window anywhere on screen.
- Drag the bottom-right corner to resize the subpanel to your preferred dimensions.
- Use the window control buttons in the top right to **Minimize** to a compact floating pill, **Refresh** the current audit, or **Close** the subpanel.
- Subpanel position coordinates are saved independently in `ig_target_position_v1`.

---

## 🔒 Local Data Storage & Privacy

All analyzer data is stored strictly in your browser profile using Tampermonkey's local storage APIs (`GM_getValue`, `GM_setValue`). **No data is ever transmitted to external servers or third parties.**

Starting in v3.9.0+, data is automatically partitioned by your Instagram user ID (`${key}_${userId}`):

| Storage Key | Description |
|---|---|
| `ig_snapshot_v2_${userId}` | Latest full scan snapshot (followers, following, detailed user objects). |
| `ig_whitelist_v2_${userId}` | Whitelisted / ignored usernames. |
| `ig_history_v2_${userId}` | Historical daily follower and following counts with net dynamics. |
| `ig_churn_v3_${userId}` | Historical log of detected unfollow events with dates. |
| `ig_deactivated_v3_${userId}` | Log of accounts identified as deactivated or unavailable. |
| `ig_blocked_v1_${userId}` | Log of accounts confirmed to have blocked your profile. |
| `ig_renamed_v1_${userId}` | Log of confirmed username changes (old username, new username, user ID, date). |
| `ig_new_followers_v1_${userId}` | Log of new followers detected between scans with relationship status. |
| `ig_target_tracker_v1_${userId}` | Monitored target profiles, network snapshots, and audit dynamics. |
| `ig_story_observations_v1_${userId}` | Historical highlight and story observation logs for Story Spy anomaly analysis. |
| `ig_panel_position_v2` | Saved screen coordinates for the main analyzer panel. |
| `ig_target_position_v1` | Saved screen coordinates for the Target Tracker child subpanel. |
| `ig_tour_completed_v1` | Flag recording whether the initial onboarding tour has been viewed. |

---

## ☕ Support Development

If you find **Instagram Follower Analyzer** valuable, consider supporting continued maintenance and feature development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/UNKchr)

---

## 📄 License

Distributed under the **Custom Source-Available & Non-Commercial License (CSAL-NC)**.  
See the [LICENSE](LICENSE) file for complete terms and conditions.

- **Non-Commercial Use Only:** Commercial distribution, sale, or monetization is strictly prohibited.
- **Anti-Plagiarism Protection:** Republishing or releasing derivative clones requires a minimum of 70% newly authored, original code.
- **Mandatory Attribution:** Proper credit to the original author (`UNKchr`) and repository link must be maintained.
