/**
 * ScreenSnap Options Page
 */

class OptionsPage {
  constructor() {
    this.form = document.getElementById('settingsForm');
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

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  new OptionsPage();
});
