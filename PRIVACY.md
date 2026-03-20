# Privacy Policy — ScreenSnap

**Last updated: 2026-03-20**

## Summary

ScreenSnap is a screenshot and annotation tool that runs entirely in your browser. **We do not collect, transmit, or store any personal data on external servers.**

## Data Handling

### What ScreenSnap accesses
- **Active tab content**: Only when you explicitly trigger a screenshot (via popup, keyboard shortcut, or context menu). Used solely to capture the visible page.
- **Local storage** (`chrome.storage.local`): Stores your screenshots, thumbnails, annotation data, and history index locally on your device.
- **Synced storage** (`chrome.storage.sync`): Stores your preferences (save format, default color, stroke width) so they sync across your Chrome devices via your Google account.

### What ScreenSnap does NOT do
- Does not collect analytics or telemetry
- Does not transmit screenshots or any data to external servers
- Does not track browsing history or behavior
- Does not inject ads
- Does not use cookies
- Does not access data from pages you haven't explicitly screenshotted

## Permissions Explained

| Permission | Why it's needed |
|------------|----------------|
| `activeTab` | Capture the visible tab when you trigger a screenshot |
| `scripting` | Inject content scripts for region selection and full-page scroll capture |
| `storage` | Save screenshots, history, and user preferences locally |
| `unlimitedStorage` | Store full-resolution screenshots without hitting storage limits |
| `downloads` | Save screenshots to your local disk when you click "Save" |
| `contextMenus` | Add right-click menu items for quick capture |
| `<all_urls>` | Capture screenshots on any webpage you visit |

## Data Retention

- Screenshots are stored locally and auto-cleaned when exceeding 50 entries (oldest removed first)
- You can manually delete any or all screenshots from the History page
- Uninstalling the extension removes all stored data

## Third-Party Services

ScreenSnap does not use any third-party services, APIs, or SDKs.

## Open Source

ScreenSnap is open-source under the MIT License. You can inspect the full source code at:
https://github.com/JackCaow/screensnap

## Contact

If you have questions about this privacy policy, please open an issue on GitHub:
https://github.com/JackCaow/screensnap/issues
