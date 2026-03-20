/**
 * ScreenSnap Popup Script
 * Handles user interactions and communicates with background service worker
 */

class ScreenSnapPopup {
  constructor() {
    this.captureRegionBtn = document.getElementById('captureRegion');
    this.captureVisibleBtn = document.getElementById('captureVisible');
    this.captureFullPageBtn = document.getElementById('captureFullPage');
    this.statusEl = document.getElementById('status');
    this.statusTextEl = document.getElementById('statusText');
    this.progressBarEl = document.getElementById('progressBar');
    this.progressFillEl = document.getElementById('progressFill');
    this.errorEl = document.getElementById('error');
    this.errorTextEl = document.getElementById('errorText');

    this.isCapturing = false;
    this.init();
  }

  init() {
    this.captureRegionBtn.addEventListener('click', () => this.captureRegion());
    this.captureVisibleBtn.addEventListener('click', () => this.captureVisible());
    this.captureFullPageBtn.addEventListener('click', () => this.captureFullPage());

    document.getElementById('openSettings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('openHistory').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'CAPTURE_PROGRESS') {
        this.updateProgress(message.progress);
      }
    });
  }

  t(key, ...subs) {
    return chrome.i18n.getMessage(key, subs) || key;
  }

  setLoading(loading, text) {
    this.isCapturing = loading;
    this.captureRegionBtn.disabled = loading;
    this.captureVisibleBtn.disabled = loading;
    this.captureFullPageBtn.disabled = loading;

    if (loading) {
      this.statusEl.classList.remove('hidden');
      this.statusTextEl.textContent = text || this.t('popup_capturing');
      this.errorEl.classList.add('hidden');
    } else {
      this.statusEl.classList.add('hidden');
      this.progressBarEl.classList.add('hidden');
      this.progressFillEl.style.width = '0%';
    }
  }

  showProgress(show) {
    if (show) {
      this.progressBarEl.classList.remove('hidden');
    } else {
      this.progressBarEl.classList.add('hidden');
    }
  }

  updateProgress(progress) {
    this.progressFillEl.style.width = `${progress}%`;
    this.statusTextEl.textContent = this.t('popup_capturingProgress', String(Math.round(progress)));
  }

  showError(message) {
    this.errorEl.classList.remove('hidden');
    this.errorTextEl.textContent = message;
  }

  async captureRegion() {
    if (this.isCapturing) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_REGION_SELECT'
      });

      if (!response.success) {
        this.showError(response.error || this.t('popup_startRegionFailed'));
        return;
      }

      window.close();
    } catch (error) {
      this.showError(error.message || this.t('popup_startRegionFailed'));
    }
  }

  async captureVisible() {
    if (this.isCapturing) return;

    try {
      this.setLoading(true, this.t('popup_capturingScreen'));

      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE'
      });

      this.setLoading(false);

      if (response.success) {
        await this.saveAndOpenPreview(response.dataUrl, 'visible');
      } else {
        this.showError(response.error || this.t('popup_captureFailed'));
      }
    } catch (error) {
      this.setLoading(false);
      this.showError(error.message || this.t('popup_captureFailed'));
    }
  }

  async captureFullPage() {
    if (this.isCapturing) return;

    try {
      this.setLoading(true, this.t('popup_preparingFullpage'));
      this.showProgress(true);

      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_FULL_PAGE'
      });

      this.setLoading(false);

      if (response.success) {
        await this.saveAndOpenPreview(response.dataUrl, 'fullpage');
      } else {
        this.showError(response.error || this.t('popup_fullpageFailed'));
      }
    } catch (error) {
      this.setLoading(false);
      this.showError(error.message || this.t('popup_fullpageFailed'));
    }
  }

  async saveAndOpenPreview(dataUrl, captureType) {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_AND_OPEN_PREVIEW',
        dataUrl,
        captureType
      });
    } catch (error) {
      console.error('Save error:', error);
      this.showError(this.t('popup_storageFailed'));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  new ScreenSnapPopup();
});
