/**
 * ScreenSnap Options Page
 */

class OptionsPage {
  constructor() {
    this.form = document.getElementById('settingsForm');
    this.languageSelect = document.getElementById('languageSelect');
    this.languageSelectField = document.getElementById('languageSelectField');
    this.languageSelectTrigger = document.getElementById('languageSelectTrigger');
    this.languageSelectValue = document.getElementById('languageSelectValue');
    this.languageSelectMenu = document.getElementById('languageSelectMenu');
    this.languageOptions = Array.from(document.querySelectorAll('.select-option'));
    this.qualitySlider = document.getElementById('imageQuality');
    this.qualityValue = document.getElementById('qualityValue');
    this.qualityGroup = document.getElementById('qualityGroup');
    this.colorInput = document.getElementById('defaultColor');
    this.colorHex = document.getElementById('colorHex');
    this.autoPreview = document.getElementById('autoOpenPreview');
    this.toast = document.getElementById('toast');

    this.init();
  }

  async init() {
    // Load language setting
    const langResult = await chrome.storage.sync.get({ language: 'auto' });
    this.languageSelect.value = langResult.language;
    this.syncLanguageSelectUI();

    const settings = await loadSettings();
    this.applyToForm(settings);
    this.bindEvents();
  }

  applyToForm(settings) {
    // Save format
    const formatRadio = this.form.querySelector(`input[name="saveFormat"][value="${settings.saveFormat}"]`);
    if (formatRadio) formatRadio.checked = true;

    // Image quality
    const qVal = Math.round(settings.imageQuality * 100);
    this.qualitySlider.value = qVal;
    this.qualityValue.textContent = qVal + '%';
    this.toggleQualityVisibility(settings.saveFormat);

    // Default color
    this.colorInput.value = settings.defaultColor;
    this.colorHex.textContent = settings.defaultColor;

    // Default stroke width
    const strokeRadio = this.form.querySelector(`input[name="defaultStrokeWidth"][value="${settings.defaultStrokeWidth}"]`);
    if (strokeRadio) strokeRadio.checked = true;

    // Auto open preview
    this.autoPreview.checked = settings.autoOpenPreview;
  }

  bindEvents() {
    // Language change
    this.languageSelect.addEventListener('change', async () => {
      this.syncLanguageSelectUI();
      await chrome.storage.sync.set({ language: this.languageSelect.value });
      this.showToast();
      // Reload page to apply new language
      setTimeout(() => location.reload(), 800);
    });

    this.languageSelectTrigger.addEventListener('click', () => {
      this.toggleLanguageSelect();
    });

    this.languageSelectTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleLanguageSelect();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.isLanguageSelectOpen()) {
          this.openLanguageSelect();
        }
        this.focusLanguageOption(this.getLanguageOptionIndex(this.languageSelect.value));
      }

      if (e.key === 'Escape') {
        this.closeLanguageSelect();
      }
    });

    this.languageOptions.forEach((option, index) => {
      option.addEventListener('click', () => {
        this.selectLanguage(option.dataset.value);
      });

      option.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.focusLanguageOption((index + 1) % this.languageOptions.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusLanguageOption((index - 1 + this.languageOptions.length) % this.languageOptions.length);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeLanguageSelect();
          this.languageSelectTrigger.focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectLanguage(option.dataset.value);
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!this.languageSelectField.contains(e.target)) {
        this.closeLanguageSelect();
      }
    });

    // Format change
    this.form.querySelectorAll('input[name="saveFormat"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleQualityVisibility(e.target.value);
        this.save();
      });
    });

    // Quality slider
    this.qualitySlider.addEventListener('input', () => {
      this.qualityValue.textContent = this.qualitySlider.value + '%';
    });
    this.qualitySlider.addEventListener('change', () => this.save());

    // Color
    this.colorInput.addEventListener('input', () => {
      this.colorHex.textContent = this.colorInput.value;
    });
    this.colorInput.addEventListener('change', () => this.save());

    // Stroke width
    this.form.querySelectorAll('input[name="defaultStrokeWidth"]').forEach(radio => {
      radio.addEventListener('change', () => this.save());
    });

    // Auto preview
    this.autoPreview.addEventListener('change', () => this.save());
  }

  toggleQualityVisibility(format) {
    // PNG is lossless, quality slider not applicable
    this.qualityGroup.style.display = format === 'png' ? 'none' : 'block';
  }

  syncLanguageSelectUI() {
    const selectedOption = this.languageOptions.find(option => option.dataset.value === this.languageSelect.value);
    const selectedLabel = selectedOption ? selectedOption.textContent.trim() : this.languageSelect.options[this.languageSelect.selectedIndex]?.textContent?.trim();
    this.languageSelectValue.textContent = selectedLabel || '';
    this.languageOptions.forEach(option => {
      const isActive = option.dataset.value === this.languageSelect.value;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      option.tabIndex = isActive ? 0 : -1;
    });
  }

  isLanguageSelectOpen() {
    return this.languageSelectField.classList.contains('open');
  }

  openLanguageSelect() {
    this.languageSelectField.classList.add('open');
    this.languageSelectMenu.classList.remove('hidden');
    this.languageSelectTrigger.setAttribute('aria-expanded', 'true');
  }

  closeLanguageSelect() {
    this.languageSelectField.classList.remove('open');
    this.languageSelectMenu.classList.add('hidden');
    this.languageSelectTrigger.setAttribute('aria-expanded', 'false');
  }

  toggleLanguageSelect() {
    if (this.isLanguageSelectOpen()) {
      this.closeLanguageSelect();
      return;
    }

    this.openLanguageSelect();
  }

  getLanguageOptionIndex(value) {
    const index = this.languageOptions.findIndex(option => option.dataset.value === value);
    return index >= 0 ? index : 0;
  }

  focusLanguageOption(index) {
    const option = this.languageOptions[index];
    if (!option) return;
    option.focus();
  }

  selectLanguage(value) {
    if (this.languageSelect.value === value) {
      this.closeLanguageSelect();
      this.languageSelectTrigger.focus();
      return;
    }

    this.languageSelect.value = value;
    this.languageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    this.closeLanguageSelect();
    this.languageSelectTrigger.focus();
  }

  async save() {
    const format = this.form.querySelector('input[name="saveFormat"]:checked')?.value || 'png';
    const stroke = this.form.querySelector('input[name="defaultStrokeWidth"]:checked')?.value || '2';

    const settings = {
      saveFormat: format,
      imageQuality: parseInt(this.qualitySlider.value) / 100,
      defaultColor: this.colorInput.value,
      defaultStrokeWidth: parseInt(stroke),
      autoOpenPreview: this.autoPreview.checked
    };

    await saveSettings(settings);
    this.showToast();
  }

  showToast() {
    this.toast.classList.remove('hidden');
    this.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.classList.remove('show');
      setTimeout(() => this.toast.classList.add('hidden'), 300);
    }, 1500);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  applyI18n();
  new OptionsPage();
});
