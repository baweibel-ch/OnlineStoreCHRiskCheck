# Warnlisten Plugin

A Chrome/Chromium/Brave browser extension that analyzes the current URL against warning lists via REST API.

## Features

- 🔍 **Automatic URL Analysis** — Scans every page you visit against threat databases
- 🛡️ **Google Safe Browsing Integration** — Default support for Google Safe Browsing v4 API
- 🔌 **Custom REST API Support** — Configure any REST API endpoint for URL checks
- 🎯 **Heuristic Mode** — Built-in pattern detection works without an API key
- 🛡️ **reklamation.ch Integration** — Automatically checks for consumer complaints
- 🛡️ **Ktipp-Warnliste Integration** — Checks for entries on the Ktipp warning list
- ⚡ **Real-time Badge Updates** — Color-coded badge shows status at a glance
- 🔔 **In-page Warnings** — Visual alerts for dangerous pages
- ⚙️ **Configurable** — API endpoint, API key, auto-scan, and notification settings

## Heuristic Checks (No API Key Required)

Without an API key, the plugin performs local heuristic analysis:
- HTTP (unencrypted) connection detection
- IP-address-based URLs
- Suspicious TLDs (.tk, .ml, .ga, .cf, .gq)
- Phishing keyword detection in subdomains
- Homograph attack detection (Cyrillic characters)
- URL obfuscation (excessive encoding)
- Unusually long URLs
- **Consumer complaints** via reklamation.ch (checks for negative feedback)
- **Ktipp-Warnliste** via ktipp.ch (checks for entries on the official warning list)
- HTTP (unencrypted) connection detection (Heuristic)

### Load as Unpacked Extension (Developer Mode)

1. Open **Chrome/Brave** → `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `warnlistenPlugin` project folder
5. The extension icon appears in your toolbar. **Pin it** to the toolbar by clicking the puzzle icon (🧩) and then selecting **An Symbolleiste anpinnen** (or the pin icon) next to "Warnlisten Plugin".

### Configure API Key (Optional)

1. Click the extension icon → **Settings**
2. Enter your API endpoint (default: Google Safe Browsing)
3. Enter your API key
4. Save settings

## Getting a Google Safe Browsing API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Safe Browsing API**
4. Create an API key under **APIs & Services → Credentials**
5. Paste the key in the plugin settings

## Project Structure

```
warnlistenPlugin/
├── manifest.json              # Chrome Extension Manifest V3
├── src/
│   ├── background/
│   │   └── background.js      # Service worker — API calls & URL analysis
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.css          # Popup styles
│   │   └── popup.js           # Popup controller
│   ├── content/
│   │   ├── content.js         # In-page warning badge
│   │   └── content.css        # Badge styles
│   ├── options/
│   │   ├── options.html       # Settings page
│   │   ├── options.css        # Settings styles
│   │   └── options.js         # Settings controller
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── .idea/                     # IntelliJ project files
└── README.md
```

## Custom REST API Format

If using a custom API, the plugin sends a POST request with:

```json
{
  "url": "https://example.com/page"
}
```

Expected response format:

```json
{
  "threats": [
    { "type": "MALWARE", "description": "Malware detected" }
  ],
  "details": "Additional analysis information"
}
```

## Development

Open the project in IntelliJ IDEA:
1. **File → Open** → select the `warnlistenPlugin` directory
2. IntelliJ will recognize it as a web project
3. Edit files and reload the extension in `chrome://extensions/`

## Browser Compatibility

| Browser   | Supported |
|-----------|-----------|
| Chrome    | ✅        |
| Chromium  | ✅        |
| Brave     | ✅        |
| Edge      | ✅        |

## License

MIT
