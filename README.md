# LinkedIn Company Filter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](manifest.json)
[![Release](https://img.shields.io/github/v/release/fabianimv/linkedin-company-filter)](https://github.com/fabianimv/linkedin-company-filter/releases)

A lightweight **Manifest V3** Chrome extension that lets you hide LinkedIn feed posts, job listings, and people suggestions associated with specific companies, plus a safe **Connections Helper** to highlight and isolate matching contacts for manual cleanup.

## Features

- **Feed Filter**: Automatically hides posts, reposts, and suggested updates mentioning any blocked company.
- **Job Listings Filter**: Hides job cards from blocked companies in LinkedIn Jobs search results.
- **People & Suggestions Filter**: Hides matching profiles in people search results and *"People you may know"* cards.
- **Connections Cleanup Helper**: On `linkedin.com/mynetwork/invite-connect/connections/`, highlights matching connections with a badge and adds a **"Show only matching"** toggle so you can review and remove them manually without risking automated rate-limits.
- **Configurable Popup**: Add/remove any company name, toggle individual scopes, enable/disable whole-word matching, and track how many items were hidden on the current page and all-time.
- **100% Local & Private**: Runs purely in your browser using `chrome.storage.local` and DOM filtering. Zero external requests, zero tracking, no automated account actions.

## Installation (Chrome / Brave / Edge)

1. Download the latest release `.zip` from [Releases](https://github.com/fabianimv/linkedin-company-filter/releases) and extract it, **or** clone this repository:
   ```bash
   git clone https://github.com/fabianimv/linkedin-company-filter.git
   ```
2. Open `chrome://extensions` in your browser.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `linkedin-company-filter` folder.
5. Open [linkedin.com](https://www.linkedin.com) and click the extension icon in your toolbar to customize your company list.

## Project Structure

```text
linkedin-company-filter/
├── manifest.json       # Manifest V3 configuration
├── icons/              # Extension icons (16, 48, 128 px)
└── src/
    ├── content.js      # SPA-aware DOM observer & company matcher
    ├── styles.css      # Hiding rules, connection badges & toolbar
    ├── popup.html      # Extension popup markup
    ├── popup.css       # Dark-mode popup styling
    └── popup.js        # Settings & live page stats logic
```

## Disclaimer

This extension only modifies how LinkedIn pages are displayed locally in your browser. It is not affiliated with, endorsed by, or connected to LinkedIn Corporation.

## License

[MIT](LICENSE)
