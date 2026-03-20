/**
 * ScreenSnap Content Script
 * Handles page scrolling and dimension calculations for full page capture
 */

(() => {
  if (window.__screenSnapInjected) return;
  window.__screenSnapInjected = true;

  let originalScrollPosition = 0;
  let originalOverflow = '';
  let originalScrollBehavior = '';
  let hiddenElements = [];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_PAGE_INFO':
        sendResponse(getPageInfo());
        break;

      case 'PREPARE_CAPTURE':
        prepareCapture();
        sendResponse({ success: true });
        break;

      case 'HIDE_FIXED':
        hideFixedElements();
        sendResponse({ success: true });
        break;

      case 'SCROLL_TO':
        scrollTo(message.position);
        sendResponse({ success: true });
        break;

      case 'GET_ACTUAL_SCROLL':
        sendResponse({
          scrollY: window.scrollY,
          scrollHeight: getScrollHeight()
        });
        break;

      case 'RESTORE_CAPTURE':
        restoreCapture();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  });

  function getScrollHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
  }

  function getPageInfo() {
    return {
      scrollHeight: getScrollHeight(),
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  function prepareCapture() {
    originalScrollPosition = window.scrollY;
    originalOverflow = document.documentElement.style.overflow;
    originalScrollBehavior = document.documentElement.style.scrollBehavior;

    document.documentElement.style.scrollBehavior = 'auto';
    // Fixed elements hidden separately via HIDE_FIXED after first capture
  }

  function scrollTo(position) {
    window.scrollTo(0, position);
  }

  function restoreCapture() {
    window.scrollTo(0, originalScrollPosition);
    document.documentElement.style.overflow = originalOverflow;
    document.documentElement.style.scrollBehavior = originalScrollBehavior;

    showFixedElements();
  }

  function hideFixedElements() {
    hiddenElements = [];

    // Walk ALL elements and check computed style — this is the only reliable
    // way to find fixed/sticky elements set via CSS classes (e.g. Google Search).
    // Performance: read phase (getComputedStyle) is batched before write phase
    // to avoid triggering repeated layout recalculations.
    const allElements = document.getElementsByTagName('*');
    const toHide = [];

    // Phase 1: Read — collect all fixed/sticky elements (no DOM writes yet)
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const cs = window.getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'sticky') {
        toHide.push(el);
      }
    }

    // Phase 2: Write — use opacity:0 instead of visibility:hidden.
    // visibility:hidden can be overridden by child elements setting
    // visibility:visible (Google Search does this). opacity applies to
    // the entire compositing layer and children cannot override it.
    for (const el of toHide) {
      hiddenElements.push({ el, original: el.style.cssText });
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }
  }

  function showFixedElements() {
    for (const { el, original } of hiddenElements) {
      el.style.cssText = original;
    }
    hiddenElements = [];
  }
})();
