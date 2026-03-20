/**
 * ScreenSnap Settings Utility
 * Shared settings loader with defaults. Used by background.js, preview.js, and options.js.
 */

const DEFAULT_SETTINGS = {
  saveFormat: 'png',          // 'png' | 'jpg' | 'webp'
  imageQuality: 0.92,         // 0.1 - 1.0 (for jpg/webp)
  defaultColor: '#ef4444',
  defaultStrokeWidth: 2,      // 2 | 4 | 6 | 8
  autoOpenPreview: true
};

/**
 * Load settings from chrome.storage.sync, merged with defaults.
 * @returns {Promise<object>}
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve(result);
    });
  });
}

/**
 * Save settings to chrome.storage.sync.
 * @param {object} settings - partial or full settings object
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}
