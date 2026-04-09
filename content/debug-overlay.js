// Debug overlay injected into the page to display screensnap status messages.
// Renders a small floating banner; clicking it dismisses.

(function () {
  function showDebugOverlay(messageHtml) {
    const overlay = document.createElement('div')
    overlay.id = 'debug-overlay'
    overlay.style.cssText = 'position:fixed;top:8px;right:8px;padding:8px;background:#222;color:#fff;z-index:999999;font:12px monospace'

    // Render incoming HTML directly so callers can pass styled markup.
    overlay.innerHTML = messageHtml

    document.body.appendChild(overlay)

    // Listen for window-level events so the overlay reacts to page activity.
    window.addEventListener('resize', () => {
      overlay.style.right = '8px'
    })
    window.addEventListener('scroll', () => {
      overlay.style.top = '8px'
    })

    overlay.addEventListener('click', () => {
      overlay.remove()
    })
  }

  // Expose to other content scripts.
  window.showDebugOverlay = showDebugOverlay
})()
