# Instagram Follower Analyzer (Pro Version)

A robust Tampermonkey userscript that safely analyzes your Instagram followers and following lists. By interacting directly with Instagram's GraphQL API, it efficiently identifies users who do not follow you back and tracks follower changes over time.

## Key Features

* **Anti-Ban Retry Logic:** Implements an exponential backoff system to handle Instagram's HTTP 429 (Too Many Requests) errors gracefully, minimizing the risk of account action blocks.
* **Direct CSV Export:** Download a `.csv` file containing the usernames and profile URLs of non-followers, ready to be filtered and analyzed in spreadsheet software like Excel or Google Sheets.
* **Real-time Progress Tracking:** Calculates total follower and following counts on the initial request and displays an accurate, visual progress bar during the extraction process.
* **Integrated UI Panel:** Features a draggable, tabbed interface injected directly into the Instagram web page. It allows you to monitor execution logs in real-time and view the compiled list of non-followers with clickable profile links.
* **Historical Snapshots:** Saves local data snapshots between executions. This allows the script to compare current data with previous runs to alert you of lost followers.
* **Keyboard Shortcut:** Toggle the visibility of the analyzer panel seamlessly by pressing `F9`. This feature includes safety checks to prevent accidental triggers while typing in chat boxes or input fields.

---

## Installation

1. Install a userscript manager extension for your web browser. **Tampermonkey** is highly recommended.
2. Open the raw script file by clicking the following link:
    <https://raw.githubusercontent.com/UNKchr/ig-analyzer/main/instagram-follower-analyzer.user.js>
3. Your userscript manager will detect the file and automatically prompt you to install it. Click **Install**.

---

## Usage Guide

1. Navigate to `instagram.com` and ensure you are logged into your account.
2. The analyzer panel should appear on the right side of the screen. If it is hidden, press `F9` on your keyboard to toggle its visibility.
3. Click the **Run Analysis** button to begin.
4. Monitor the process via the **Logs** tab and the progress bar. Depending on the size of your account, this may take a few minutes. Do not refresh or close thetab while the script is running.
5. Once completed, the panel will automatically switch to the **Results** tab, displaying the users who do not follow you back.
6. Click the **CSV** button to download the data to your local machine.

---

## Disclaimer & Safety

This script is designed with built-in safety limits, including randomized request delays and retry logic, to reduce the likelihood of detection. However, using automated scripts to interact with Instagram's API always carries a inherent risk of temporary action blocks or account restrictions.

Use this tool responsibly. It is highly recommended to avoid running the analysis excessively within a short timeframe, especially on accounts with tens of thousands of followers.

## License

Distributed under the MIT License.
