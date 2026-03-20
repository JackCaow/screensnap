/**
 * ScreenSnap History Page
 * Displays captured screenshots in a grid with search, filter, and delete
 */

class ScreenSnapHistory {
  constructor() {
    this.grid = document.getElementById('grid');
    this.emptyState = document.getElementById('emptyState');
    this.statsText = document.getElementById('statsText');
    this.clearAllBtn = document.getElementById('clearAllBtn');
    this.searchInput = document.getElementById('searchInput');
    this.toastEl = document.getElementById('toast');
    this.toastTextEl = document.getElementById('toastText');

    this.screenshots = []; // full index
    this.filtered = [];    // after search + filter
    this.currentFilter = 'all';
    this.searchQuery = '';

    this.init();
  }

  t(key, ...subs) {
    return i18n(key, ...subs);
  }

  async init() {
    this.setupEvents();
    await this.loadIndex();
    this.applyFilter();
    this.render();
  }

  setupEvents() {
    // Debounced search
    let searchTimer;
    this.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.searchQuery = this.searchInput.value.trim().toLowerCase();
        this.applyFilter();
        this.render();
      }, 200);
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.applyFilter();
        this.render();
      });
    });

    // Clear all
    this.clearAllBtn.addEventListener('click', () => this.confirmClearAll());
  }

  async loadIndex() {
    const result = await chrome.storage.local.get('ss_index');
    this.screenshots = result.ss_index || [];

    // If no index exists, try to rebuild from raw keys
    if (this.screenshots.length === 0) {
      await this.rebuildIndex();
    }

    // Sort newest first
    this.screenshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  async rebuildIndex() {
    // Only fetch keys to check, not full data (avoids loading hundreds of MB)
    const all = await chrome.storage.local.get(null);
    const index = [];

    for (const key of Object.keys(all)) {
      if (key.startsWith('ss_') && key !== 'ss_index'
        && !key.endsWith('_annotations') && !key.endsWith('_thumb')) {
        const val = all[key];
        // Quick prefix check — only verify it looks like a data URL, don't load full blob
        if (typeof val !== 'string' || !(val.startsWith('data:image') || val.startsWith('data:video'))) continue;

        index.push({
          id: key,
          timestamp: this.extractTimestamp(key),
          url: '',
          title: '',
          type: 'visible',
          thumbnailId: key + '_thumb'
        });
      }
    }

    if (index.length > 0) {
      this.screenshots = index;
      await chrome.storage.local.set({ ss_index: index });
    }
  }

  extractTimestamp(id) {
    // id format: ss_1234567890_xxxxx
    const parts = id.split('_');
    if (parts.length >= 2) {
      const ts = parseInt(parts[1]);
      if (!isNaN(ts)) return ts;
    }
    return Date.now();
  }

  applyFilter() {
    let list = this.screenshots;

    if (this.currentFilter !== 'all') {
      list = list.filter(s => s.type === this.currentFilter);
    }

    if (this.searchQuery) {
      list = list.filter(s => {
        const title = (s.title || '').toLowerCase();
        const url = (s.url || '').toLowerCase();
        return title.includes(this.searchQuery) || url.includes(this.searchQuery);
      });
    }

    this.filtered = list;
  }

  async render() {
    // Stats
    this.statsText.textContent = this.t('history_statsCount', String(this.filtered.length), String(this.screenshots.length));

    // Clear all button
    if (this.screenshots.length > 0) {
      this.clearAllBtn.classList.remove('hidden');
    } else {
      this.clearAllBtn.classList.add('hidden');
    }

    // Empty state
    if (this.filtered.length === 0) {
      this.grid.classList.add('hidden');
      this.emptyState.classList.remove('hidden');
      return;
    }

    this.grid.classList.remove('hidden');
    this.emptyState.classList.add('hidden');

    // Build grid
    this.grid.innerHTML = '';

    for (const item of this.filtered) {
      const card = this.createCard(item);
      this.grid.appendChild(card);
    }

    // Batch-load all thumbnails in a single storage call
    await this.batchLoadThumbnails();
  }

  createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';

    const typeLabel = this.getTypeLabel(item.type);
    const dateStr = this.formatDate(item.timestamp);
    const sizeStr = item.width && item.height ? `${item.width}\u00D7${item.height}` : '';
    const title = item.title || item.url || this.t('history_untitled');

    // Build DOM safely (no innerHTML with user data)
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'card-thumb';

    const img = document.createElement('img');
    img.dataset.id = item.id;
    img.dataset.thumb = item.thumbnailId || '';
    img.alt = '';
    img.loading = 'lazy';
    thumbDiv.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'card-type-badge';
    badge.textContent = typeLabel;
    thumbDiv.appendChild(badge);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-action-btn delete-btn';
    deleteBtn.title = this.t('history_delete');
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    actionsDiv.appendChild(deleteBtn);
    thumbDiv.appendChild(actionsDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'card-info';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.title = title;
    titleDiv.textContent = title;
    infoDiv.appendChild(titleDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'card-meta';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = dateStr;
    const sizeSpan = document.createElement('span');
    sizeSpan.textContent = sizeStr;
    metaDiv.appendChild(dateSpan);
    metaDiv.appendChild(sizeSpan);
    infoDiv.appendChild(metaDiv);

    card.appendChild(thumbDiv);
    card.appendChild(infoDiv);

    // Click to open preview
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      chrome.tabs.create({
        url: chrome.runtime.getURL('preview/preview.html') + '?id=' + item.id
      });
    });

    // Delete via background message handler (single source of truth)
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.confirmDelete(item.id);
    });

    return card;
  }

  async batchLoadThumbnails() {
    // Collect all thumbnail keys needed, then fetch in one call
    const keysToFetch = [];
    const imgElements = [];

    this.grid.querySelectorAll('img[data-id]').forEach(img => {
      const thumbKey = img.dataset.thumb || img.dataset.id + '_thumb';
      keysToFetch.push(thumbKey, img.dataset.id);
      imgElements.push({ img, thumbKey, fullKey: img.dataset.id });
    });

    if (keysToFetch.length === 0) return;

    try {
      const result = await chrome.storage.local.get([...new Set(keysToFetch)]);

      for (const { img, thumbKey, fullKey } of imgElements) {
        const src = result[thumbKey] || result[fullKey];
        if (src) img.src = src;
      }
    } catch (e) {
      // Storage read failed — thumbnails simply won't load
    }
  }

  getTypeLabel(type) {
    const labels = {
      visible: this.t('history_typeVisible'),
      fullpage: this.t('history_typeFullpage'),
      region: this.t('history_typeRegion'),
      gif: this.t('history_typeGif'),
      video: this.t('history_typeVideo')
    };
    return labels[type] || type;
  }

  formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((today - target) / 86400000);

    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return this.t('history_today') + ' ' + time;
    if (diffDays === 1) return this.t('history_yesterday') + ' ' + time;
    if (diffDays < 7) return this.t('history_daysAgo', String(diffDays)) + ' ' + time;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
  }

  confirmDelete(id) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = this.t('history_deleteConfirmTitle');
    dialog.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = this.t('history_deleteConfirmDesc');
    dialog.appendChild(p);

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = this.t('preview_cancel');
    actions.appendChild(cancelBtn);

    const dangerBtn = document.createElement('button');
    dangerBtn.className = 'btn-danger';
    dangerBtn.textContent = this.t('history_delete');
    actions.appendChild(dangerBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    cancelBtn.addEventListener('click', () => overlay.remove());
    dangerBtn.addEventListener('click', async () => {
      overlay.remove();
      await this.deleteScreenshot(id);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  async deleteScreenshot(id) {
    // Try background service worker first, fall back to direct storage operation
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_SCREENSHOT',
        id
      });
      if (!response?.success) {
        // Background handler failed — try direct deletion as fallback
        await this.directDelete(id);
      }
    } catch (e) {
      // Service worker may be inactive — delete directly from storage
      try {
        await this.directDelete(id);
      } catch (err) {
        this.showToast(this.t('history_deleteFailed'), false);
        return;
      }
    }

    // Update local state after confirmed deletion
    this.screenshots = this.screenshots.filter(s => s.id !== id);
    this.applyFilter();
    this.render();
    this.showToast(this.t('history_deleted'));
  }

  async directDelete(id) {
    const result = await chrome.storage.local.get('ss_index');
    const index = (result.ss_index || []).filter(s => s.id !== id);
    await chrome.storage.local.set({ ss_index: index });
    await chrome.storage.local.remove([id, id + '_thumb', id + '_annotations']);
  }

  confirmClearAll() {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = this.t('history_clearAllTitle');
    dialog.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = this.t('history_clearAllDesc');
    dialog.appendChild(p);

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.textContent = this.t('preview_cancel');
    actions.appendChild(cancelBtn);

    const dangerBtn = document.createElement('button');
    dangerBtn.className = 'btn-danger';
    dangerBtn.textContent = this.t('history_clearAllConfirm');
    actions.appendChild(dangerBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);

    cancelBtn.addEventListener('click', () => overlay.remove());
    dangerBtn.addEventListener('click', async () => {
      overlay.remove();
      await this.clearAll();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  async clearAll() {
    const keysToRemove = [];
    for (const item of this.screenshots) {
      keysToRemove.push(item.id, item.id + '_thumb', item.id + '_annotations');
      if (item.thumbnailId && item.thumbnailId !== item.id + '_thumb') {
        keysToRemove.push(item.thumbnailId);
      }
    }
    keysToRemove.push('ss_index');

    await chrome.storage.local.remove(keysToRemove);
    this.screenshots = [];
    this.applyFilter();
    this.render();
    this.showToast(this.t('history_clearedAll'));
  }

  showToast(message, success = true) {
    this.toastEl.style.background = success ? 'var(--success)' : '#ef4444';
    this.toastTextEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    setTimeout(() => this.toastEl.classList.add('hidden'), 2500);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  applyI18n();
  new ScreenSnapHistory();
});
