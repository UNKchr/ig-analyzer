# Changelog

All notable changes to this project will be documented in this file.

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
