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

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'CAPTURE_PROGRESS') {
        this.updateProgress(message.progress);
      }
    });
  }

  setLoading(loading, text = '正在截图...') {
    this.isCapturing = loading;
    this.captureRegionBtn.disabled = loading;
    this.captureVisibleBtn.disabled = loading;
    this.captureFullPageBtn.disabled = loading;

    if (loading) {
      this.statusEl.classList.remove('hidden');
      this.statusTextEl.textContent = text;
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
    this.statusTextEl.textContent = `正在截图... ${Math.round(progress)}%`;
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
        this.showError(response.error || '启动区域选择失败');
        return;
      }

      window.close();
    } catch (error) {
      this.showError(error.message || '启动区域选择失败');
    }
  }

  async captureVisible() {
    if (this.isCapturing) return;

    try {
      this.setLoading(true, '正在截取当前屏幕...');

      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE'
      });

      this.setLoading(false);

      if (response.success) {
        this.openPreview(response.dataUrl);
      } else {
        this.showError(response.error || '截图失败');
      }
    } catch (error) {
      this.setLoading(false);
      this.showError(error.message || '截图失败');
    }
  }

  async captureFullPage() {
    if (this.isCapturing) return;

    try {
      this.setLoading(true, '正在准备长截屏...');
      this.showProgress(true);

      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_FULL_PAGE'
      });

      this.setLoading(false);

      if (response.success) {
        this.openPreview(response.dataUrl);
      } else {
        this.showError(response.error || '长截屏失败');
      }
    } catch (error) {
      this.setLoading(false);
      this.showError(error.message || '长截屏失败');
    }
  }

  openPreview(dataUrl) {
    const id = 'ss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    chrome.storage.local.set({ [id]: dataUrl }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        this.showError('截图数据过大，存储失败');
        return;
      }
      chrome.tabs.create({
        url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ScreenSnapPopup();
});
