# Warnlisten Plugin

A Chrome/Chromium/Brave browser extension that analyzes the current URL against warning lists, search databases, and heuristic criteria via REST API to ensure your browsing experience is secure.

## Features

- 🌍 **Multilingual Support** — Fully localized in English, French, German, and Italian. Automatically adapts to your browser language.
- 🔍 **Automatic & Manual Scanning** — Choose to scan every new page automatically or scan manually on demand via the popup.
- 🛡️ **reklamation.ch Integration** — Automatically checks for consumer complaints and displays the latest alerts with direct links.
- 🛒 **Ktipp-Warnliste Integration** — Proactively checks for entries on the Ktipp warning list by mirroring search form logic to detect flagged web shops directly.
- 🛡️ **Google Safe Browsing Integration** — Default support for Google Safe Browsing v4 API to identify known malware/phishing.
- 🔌 **Custom REST API Support** — Configure any REST API endpoint for URL threat checks.
- 🎯 **Advanced Heuristics** — Built-in pattern detection works without an API key (e.g., suspicious TLDs, unencrypted HTTP, URL obfuscation).
- 🏳️ **Whitelist Support** — Skip trusted domains and their subdomains from automated analyses to preserve resources.
- ⚡ **Real-time Badge Updates** — Color-coded popup badge shows the site's security status at a glance.
- 🔔 **In-page Warnings** — Visual alerts directly injected into dangerous pages.
- ⚙️ **Configurable** — Customize features independently through an extensive Settings panel.

## Heuristic Checks (No API Key Required)

Without an API key, the plugin performs local heuristic analysis along with public domain checks:
- **Consumer complaints** via reklamation.ch 
- **Ktipp-Warnliste entries** via ktipp.ch
- HTTP (unencrypted) connection detection
- IP-address-based URLs fallback checks
- Suspicious TLDs (.tk, .ml, .ga, .cf, .gq)
- Phishing keyword detection in subdomains
- Homograph attack detection (Cyrillic characters)
- URL obfuscation (excessive encoding)
- Unusually long URLs

### Load as Unpacked Extension (Developer Mode)

1. Open **Chrome/Brave** → `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `warnlistenPlugin` project folder
5. The extension icon appears in your toolbar. **Pin it** to the toolbar to access quick scanning and metrics.

### Configure Settings

1. Click the extension icon → **Settings**
2. Choose your preferred scanning mode (Auto/Manual)
3. Toggle which security services you want active (Google Safe Browsing, reklamation.ch, Ktipp-Warnliste)
4. Enter your API key if you plan on using Safe Browsing (local storage only)
5. Add domains to your whitelist (e.g. `youtube.com`)
6. Save settings

## Getting a Google Safe Browsing API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Safe Browsing API**
4. Create an API key under **APIs & Services → Credentials**
5. Paste the key in the plugin settings

## Project Structure

```
warnlistenPlugin/
├── manifest.json              # Chrome Extension Manifest V3
├── _locales/                  # i18n Translations (en, de, fr, it)
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

If using a custom generic API instead of Google Safe Browsing, the plugin sends a POST request with:

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
