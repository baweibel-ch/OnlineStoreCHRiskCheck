/**
 * Warnlisten Plugin — Options Controller
 */

document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerText = chrome.i18n.getMessage(el.getAttribute('data-i18n')) || el.innerText;
  });

  const config = await getConfig();

  document.getElementById('apiUrl').value = config.apiUrl || '';
  document.getElementById('apiKey').value = config.apiKey || '';
  
  const isAuto = config.checkAutomatically !== false;
  document.getElementById('scanModeAuto').checked = isAuto;
  document.getElementById('scanModeManual').checked = !isAuto;

  document.getElementById('notificationsEnabled').checked = config.notificationsEnabled !== false;
  document.getElementById('enableSafeBrowsing').checked = config.enableSafeBrowsing !== false;
  document.getElementById('enableReklamation').checked = config.enableReklamation !== false;
  document.getElementById('enableKtipp').checked = config.enableKtipp !== false;
  document.getElementById('whitelist').value = (config.whitelist || []).join('\n');

  // Save handler
  document.getElementById('btnSave').addEventListener('click', saveSettings);

  // Toggle API key visibility
  document.getElementById('toggleKeyVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

async function saveSettings() {
  const config = {
    apiUrl: document.getElementById('apiUrl').value.trim() ||
      'https://safebrowsing.googleapis.com/v4/threatMatches:find',
    apiKey: document.getElementById('apiKey').value.trim(),
    checkAutomatically: document.getElementById('scanModeAuto').checked,
    notificationsEnabled: document.getElementById('notificationsEnabled').checked,
    enableSafeBrowsing: document.getElementById('enableSafeBrowsing').checked,
    enableReklamation: document.getElementById('enableReklamation').checked,
    enableKtipp: document.getElementById('enableKtipp').checked,
    whitelist: document.getElementById('whitelist').value.split('\n')
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
