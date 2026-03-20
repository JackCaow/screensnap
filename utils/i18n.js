/**
 * ScreenSnap i18n Helper
 * Applies translations to DOM elements using data-i18n attributes.
 * Include this script before the page's own script, then call applyI18n().
 */

function applyI18n() {
  // data-i18n → textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });

  // data-i18n-title → title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });

  // data-i18n-placeholder → placeholder attribute
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (msg) el.placeholder = msg;
  });

  // data-i18n-tooltip → data-tooltip attribute
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const msg = chrome.i18n.getMessage(el.dataset.i18nTooltip);
    if (msg) el.dataset.tooltip = msg;
  });
}
