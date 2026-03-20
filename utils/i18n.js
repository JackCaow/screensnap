/**
 * ScreenSnap i18n Helper
 * Supports runtime language switching by loading locale JSON files directly.
 * Falls back to chrome.i18n.getMessage when no override is active.
 */

let _i18nMessages = null; // cached messages for the override locale
let _i18nFallback = null; // fallback messages loaded from default locale
let _i18nFallbackLoading = false;
let _i18nReady = false;

/**
 * Eagerly load fallback messages from the default locale (zh_CN).
 * This ensures translations work even when chrome.i18n.getMessage fails.
 */
function _loadFallbackMessages() {
  _i18nFallbackLoading = true;
  const url = chrome.runtime.getURL('_locales/zh_CN/messages.json');
  fetch(url).then(r => r.json()).then(data => {
    _i18nFallback = data;
  }).catch(() => {});
}

/**
 * Initialize i18n: load override locale if set, otherwise use chrome.i18n default.
 */
async function initI18n() {
  const result = await chrome.storage.sync.get({ language: 'auto' });
  const lang = result.language;

  if (lang && lang !== 'auto') {
    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      const resp = await fetch(url);
      _i18nMessages = await resp.json();
    } catch (e) {
      _i18nMessages = null;
    }
  } else {
    _i18nMessages = null;
  }
  // Pre-load fallback messages for robustness
  if (!_i18nFallback && !_i18nFallbackLoading) {
    _loadFallbackMessages();
  }
  _i18nReady = true;
}

/**
 * Get a translated message. Uses override locale if loaded, otherwise chrome.i18n.
 */
function i18n(key, ...subs) {
  // Try override locale first
  if (_i18nMessages && _i18nMessages[key]) {
    let msg = _i18nMessages[key].message || key;
    if (subs.length > 0 && _i18nMessages[key].placeholders) {
      const ph = _i18nMessages[key].placeholders;
      for (const [name, def] of Object.entries(ph)) {
        const idx = parseInt(def.content.replace('$', '')) - 1;
        if (idx >= 0 && idx < subs.length) {
          msg = msg.replace(new RegExp('\\$' + name + '\\$', 'gi'), subs[idx]);
        }
      }
    }
    return msg;
  }
  // Try chrome.i18n API (works for default_locale keys)
  const chromeMsg = chrome.i18n.getMessage(key, subs);
  if (chromeMsg) return chromeMsg;
  // Fallback: try loading default locale messages if not already loaded
  if (!_i18nMessages && !_i18nFallbackLoading) {
    _loadFallbackMessages();
  }
  if (_i18nFallback && _i18nFallback[key]) {
    let msg = _i18nFallback[key].message || key;
    if (subs.length > 0 && _i18nFallback[key].placeholders) {
      const ph = _i18nFallback[key].placeholders;
      for (const [name, def] of Object.entries(ph)) {
        const idx = parseInt(def.content.replace('$', '')) - 1;
        if (idx >= 0 && idx < subs.length) {
          msg = msg.replace(new RegExp('\\$' + name + '\\$', 'gi'), subs[idx]);
        }
      }
    }
    return msg;
  }
  return key;
}

/**
 * Apply translations to DOM elements using data-i18n attributes.
 */
function applyI18n() {
  // data-i18n → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = i18n(el.dataset.i18n);
    if (msg && msg !== el.dataset.i18n) el.textContent = msg;
  });

  // data-i18n-title → title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = i18n(el.dataset.i18nTitle);
    if (msg && msg !== el.dataset.i18nTitle) el.title = msg;
  });

  // data-i18n-placeholder → placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = i18n(el.dataset.i18nPlaceholder);
    if (msg && msg !== el.dataset.i18nPlaceholder) el.placeholder = msg;
  });

  // data-i18n-tooltip → data-tooltip attribute
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const msg = i18n(el.dataset.i18nTooltip);
    if (msg && msg !== el.dataset.i18nTooltip) el.dataset.tooltip = msg;
  });
}
