/**
 * OnlineStore CH risk-check — Options Controller
 */

document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    let msg = chrome.i18n.getMessage(el.getAttribute('data-i18n')) || el.innerText;
    if (msg.includes('__VERSION__')) {
      msg = msg.replace('__VERSION__', chrome.runtime.getManifest().version);
    }
    el.innerText = msg;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = chrome.i18n.getMessage(el.getAttribute('data-i18n-placeholder')) || el.placeholder;
  });

  const config = await getConfig();

  if (document.getElementById('apiUrl')) document.getElementById('apiUrl').value = config.apiUrl || '';
  if (document.getElementById('apiKey')) document.getElementById('apiKey').value = config.apiKey || '';
  
  const isAuto = config.checkAutomatically !== false;
  if (document.getElementById('scanModeAuto')) document.getElementById('scanModeAuto').checked = isAuto;
  if (document.getElementById('scanModeManual')) document.getElementById('scanModeManual').checked = !isAuto;

  const theme = config.theme || 'dark';
  if (document.getElementById('themeLight')) document.getElementById('themeLight').checked = theme === 'light';
  if (document.getElementById('themeDark')) document.getElementById('themeDark').checked = theme === 'dark';
  applyTheme(theme);

  if (document.getElementById('notificationsEnabled')) document.getElementById('notificationsEnabled').checked = config.notificationsEnabled !== false;
  if (document.getElementById('enableSafeBrowsing')) document.getElementById('enableSafeBrowsing').checked = config.enableSafeBrowsing !== false;
  if (document.getElementById('enableReklamation')) document.getElementById('enableReklamation').checked = config.enableReklamation !== false;
  if (document.getElementById('enableKtipp')) document.getElementById('enableKtipp').checked = config.enableKtipp !== false;
  if (document.getElementById('enableTrustedshops')) document.getElementById('enableTrustedshops').checked = config.enableTrustedshops !== false;
  if (document.getElementById('enableTrustpilot')) document.getElementById('enableTrustpilot').checked = config.enableTrustpilot !== false;
  if (document.getElementById('enableAdminchUid')) document.getElementById('enableAdminchUid').checked = config.enableAdminchUid !== false;

  // Disable enableAdminchUid for Firefox Android
  const isFirefoxAndroid = navigator.userAgent.toLowerCase().includes('android') && navigator.userAgent.toLowerCase().includes('firefox');
  if (isFirefoxAndroid) {
    const adminchUidCheckbox = document.getElementById('enableAdminchUid');
    if (adminchUidCheckbox) {
      adminchUidCheckbox.checked = false;
      adminchUidCheckbox.disabled = true;
      const hintEl = adminchUidCheckbox.closest('.toggle-group').querySelector('.setting-hint');
      if (hintEl) {
        const notSupportedMsg = chrome.i18n.getMessage('notSupportedFirefoxAndroid') || 'Not supported for Firefox-Android';
        hintEl.appendChild(document.createElement('br'));
        const noteSpan = document.createElement('span');
        noteSpan.style.color = '#ffaa00';
        noteSpan.style.fontSize = '0.9em';
        noteSpan.style.marginTop = '4px';
        noteSpan.style.display = 'inline-block';
        noteSpan.textContent = notSupportedMsg;
        hintEl.appendChild(noteSpan);
      }
    }
  }

  if (document.getElementById('whitelist')) document.getElementById('whitelist').value = (config.whitelist || []).join('\n');
  if (document.getElementById('fetchTimeout')) document.getElementById('fetchTimeout').value = config.fetchTimeout || 30000;

  // Save handler
  document.getElementById('btnSave').addEventListener('click', saveSettings);

  // Toggle API key visibility
  document.getElementById('toggleKeyVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Set API Key Help Link URL
  const lang = chrome.i18n.getUILanguage().split('-')[0] || 'en';
  document.getElementById('apiKeyHelpLink').href = `https://developers.google.com/safe-browsing/v4/get-started?hl=${lang}`;

  // Theme change preview
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      applyTheme(e.target.value);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

async function saveSettings() {
  const config = {
    apiUrl: document.getElementById('apiUrl')?.value?.trim() ||
      'https://safebrowsing.googleapis.com/v4/threatMatches:find',
    apiKey: document.getElementById('apiKey')?.value?.trim() || '',
    checkAutomatically: document.getElementById('scanModeAuto')?.checked ?? true,
    notificationsEnabled: document.getElementById('notificationsEnabled')?.checked ?? true,
    enableSafeBrowsing: document.getElementById('enableSafeBrowsing')?.checked ?? false,
    enableReklamation: document.getElementById('enableReklamation')?.checked ?? true,
    enableKtipp: document.getElementById('enableKtipp')?.checked ?? true,
    enableTrustedshops: document.getElementById('enableTrustedshops')?.checked ?? true,
    enableTrustpilot: document.getElementById('enableTrustpilot')?.checked ?? true,
    enableAdminchUid: document.getElementById('enableAdminchUid')?.checked ?? true,
    theme: document.querySelector('input[name="theme"]:checked')?.value || 'dark',
    fetchTimeout: parseInt(document.getElementById('fetchTimeout')?.value || '30000', 10),
    whitelist: (document.getElementById('whitelist')?.value || '').split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  };

  chrome.runtime.sendMessage(
    { action: 'saveConfig', config },
    (response) => {
      const status = document.getElementById('saveStatus');
      status.textContent = chrome.i18n.getMessage('saveStatusSuccess') || '✓ Saved!';
      status.classList.add('visible');
      setTimeout(() => status.classList.remove('visible'), 2500);
    }
  );
}

async function getConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, (config) => {
      resolve(config || {});
    });
  });
}
