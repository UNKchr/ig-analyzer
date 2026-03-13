# Instagram Follower Analyzer

A robust Tampermonkey userscript that safely analyzes your Instagram followers and following lists. By interacting directly with Instagram's GraphQL API, it efficiently identifies users who do not follow you back, tracks follower changes over time, and provides advanced metrics like mutuals and deactivated accounts.

## Key Features

* **Block Detection:** Uniquely identifies users who have blocked your account. It distinguishes true blocks from deactivated profiles by intelligently verifying the public availability of their account locally and safely.
* **Advanced Analytics:** Discover your "Fans" (users who follow you, but you don't follow back) and "Mutual connections" instantly.
* **Churn & Deactivation Tracking:** Keeps a permanent, dated record of users who unfollow you, while intelligently distinguishing between real unfollows and deactivated or suspended accounts.
* **Visual Trend Indicators:** The History tab features precise SVG icons to help you visualize your account's growth or decline day by day.
* **Anti-Ban Retry Logic:** Implements an exponential backoff system to handle Instagram's HTTP 429 (Too Many Requests) errors gracefully, minimizing the risk of account action blocks.
* **Direct CSV Export:** Download a `.csv` file containing the usernames and profile URLs of non-followers, ready to be filtered and analyzed in spreadsheet software like Excel or Google Sheets.
* **Whitelist System:** Easily exclude specific users (like celebrities or close friends) from your non-followers list. Ignored users are saved locally and automatically filtered out of future scans and CSV exports.
* **Real-time Progress Tracking:** Calculates total follower and following counts on the initial request and displays an accurate, visual progress bar during the extraction process.
* **Modern UI Panel:** Features a draggable, modernized glassmorphism interface injected directly into the web page. It includes expanded tabs to monitor execution logs and view compiled lists for all advanced metrics.
* **Historical Snapshots:** Saves local data snapshots between executions. This allows the script to compare current data with previous runs to alert you of changes.
* **Keyboard Shortcut:** Toggle the visibility of the analyzer panel seamlessly by pressing `F9`. Press `F8` to reset the panel to its default position if it ever becomes unreachable. Both shortcuts include safety checks to prevent accidental triggers while typing in chat boxes or input fields.

---

## Installation

1. Install a userscript manager extension for your web browser. **Tampermonkey** is highly recommended.
2. Open the raw script file by clicking the following link:
    <https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js>
3. Your userscript manager will detect the file and automatically prompt you to install it. Click **Install**.

---

## Usage Guide

1. Navigate to `instagram.com` and ensure you are logged into your account.
2. The analyzer panel should appear on the right side of the screen. If it is hidden, press `F9` on your keyboard to toggle its visibility. If the panel is stuck in an unreachable position, press `F8` to reset it to its default location.
3. Click the **Run** button to begin.
4. Monitor the process via the **Logs** tab and the progress bar. Depending on the size of your account, this may take a few minutes. Do not refresh or close the tab while the script is running.
5. Once completed, you can navigate through the new tabs (**Not Following**, **Fans**, **Mutuals**, **Unfollowers**, **Deactivated**, and **Blocked**) to view your customized analytics.
6. In the **Not Following** tab, you can click **Ignore** next to any user to add them to your whitelist.
7. Click the **Export CSV** button to download the filtered non-followers data to your local machine.
8. Check the **History** tab at any time to view your past counts with visual growth indicators.

---

## Disclaimer & Safety

This script is designed with built-in safety limits, including randomized request delays and retry logic, to reduce the likelihood of detection. However, using automated scripts to interact with Instagram's API always carries a inherent risk of temporary action blocks or account restrictions.

Use this tool responsibly. It is highly recommended to avoid running the analysis excessively within a short timeframe, especially on accounts with tens of thousands of followers.

## License

Distributed under the MIT License.
