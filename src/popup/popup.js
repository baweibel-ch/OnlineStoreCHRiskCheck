/**
 * Warnlisten Plugin — Popup Controller
 * Manages the popup UI and communicates with the background service worker
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerText = chrome.i18n.getMessage(el.getAttribute('data-i18n')) || el.innerText;
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Display URL
  const urlText = document.getElementById('urlText');
  urlText.textContent = tab.url || 'Unknown';

  // Highlight protocol in URL
  highlightUrl(tab.url);

  // Get current status from background
  chrome.runtime.sendMessage({ action: 'getConfig' }, (config) => {
    chrome.runtime.sendMessage({ action: 'getStatus', tabId: tab.id }, (state) => {
      const domain = new URL(tab.url).hostname.replace(/^www\./i, '');
      const isWhitelisted = config.whitelist && config.whitelist.some(w => {
        const trimmed = w.trim().toLowerCase().replace(/^www\./i, '');
        return domain === trimmed || domain.endsWith('.' + trimmed);
      });

      if (state && state.status !== 'unknown') {
        if (state.status === 'idle' && isWhitelisted) {
          state.isWhitelisted = true;
        }
        renderState(state);
      } else if (config.checkAutomatically !== false) {
        // Trigger fresh analysis if automatic scanning is enabled
        triggerScan(tab);
      } else {
        // Just show idle state if manual scan is selected
        renderState({ status: 'idle', url: tab.url, isWhitelisted });
      }
    });
  });

  // Button handlers
  document.getElementById('btnRescan').addEventListener('click', () => triggerScan(tab));
  document.getElementById('btnSettings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Whitelist buttons
  const btnAddWhitelist = document.getElementById('btnAddWhitelist');
  const btnRemoveWhitelist = document.getElementById('btnRemoveWhitelist');

  const updateWhitelistButtons = async () => {
    const config = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getConfig' }, resolve);
    });
    
    const domain = new URL(tab.url).hostname.replace(/^www\./i, '');
    const isWhitelisted = config.whitelist && config.whitelist.some(w => {
      const trimmed = w.trim().toLowerCase().replace(/^www\./i, '');
      return domain === trimmed || domain.endsWith('.' + trimmed);
    });

    if (isWhitelisted) {
      btnAddWhitelist.style.display = 'none';
      btnRemoveWhitelist.style.display = 'flex';
    } else {
      btnAddWhitelist.style.display = 'flex';
      btnRemoveWhitelist.style.display = 'none';
    }
  };

  btnAddWhitelist.addEventListener('click', () => {
    const domain = new URL(tab.url).hostname.replace(/^www\./i, '');
    chrome.runtime.sendMessage({ action: 'addToWhitelist', domain }, () => {
      updateWhitelistButtons();
      triggerScan(tab);
    });
  });

  btnRemoveWhitelist.addEventListener('click', () => {
    const domain = new URL(tab.url).hostname.replace(/^www\./i, '');
    chrome.runtime.sendMessage({ action: 'removeFromWhitelist', domain }, () => {
      updateWhitelistButtons();
      triggerScan(tab);
    });
  });

  // Initial check for whitelist status
  if (tab.url && !tab.url.startsWith('chrome')) {
    updateWhitelistButtons();
  }
}

function triggerScan(tab) {
  renderState({ status: 'loading', url: tab.url });

  chrome.runtime.sendMessage(
    { action: 'analyzeUrl', url: tab.url, tabId: tab.id, force: true },
    (result) => {
      if (result) {
        renderState(result);
      }
    }
  );
}

function renderState(state) {
  const card = document.getElementById('statusCard');
  const icon = document.getElementById('statusIcon');
  const label = document.getElementById('statusLabel');
  const detail = document.getElementById('statusDetail');
  const threatsSection = document.getElementById('threatsSection');
  const threatsList = document.getElementById('threatsList');
  const detailsSectionApi = document.getElementById('detailsSectionApi');
  const detailsContentApi = document.getElementById('detailsContentApi');
  const detailsSectionReklamation = document.getElementById('detailsSectionReklamation');
  const detailsContentReklamation = document.getElementById('detailsContentReklamation');
  const detailsSectionKtipp = document.getElementById('detailsSectionKtipp');
  const detailsContentKtipp = document.getElementById('detailsContentKtipp');
  const detailsSection = document.getElementById('detailsSection');
  const detailsContent = document.getElementById('detailsContent');
  const checkTime = document.getElementById('checkTime');

  // Reset classes
  card.className = 'status-card';

  switch (state.status) {
    case 'safe':
      card.classList.add('safe');
      icon.innerHTML = getSafeIcon();
      label.textContent = chrome.i18n.getMessage('statusSafe') || 'Safe';
      detail.textContent = state.message || chrome.i18n.getMessage('statusSafeDetail') || 'No threats detected.';
      break;

    case 'danger':
      card.classList.add('danger');
      icon.innerHTML = getDangerIcon();
      label.textContent = chrome.i18n.getMessage('statusDanger') || 'Danger!';
      detail.textContent = state.message || chrome.i18n.getMessage('statusDangerDetail') || 'Threats detected!';
      break;

    case 'warning':
      card.classList.add('warning');
      icon.innerHTML = getWarningIcon();
      const isKtipp = state.threats?.some(t => t.type === 'KTIPP_WARNLISTE');
      const isReklamation = state.threats?.some(t => t.type === 'REKLAMATION_CH');
      
      if (isKtipp && isReklamation) {
        label.textContent = chrome.i18n.getMessage('statusWarning') || 'Warning!';
      } else if (isKtipp) {
        label.textContent = chrome.i18n.getMessage('ktippLabel') || 'Ktipp-Warnliste';
      } else {
        label.textContent = chrome.i18n.getMessage('reklamationLabel') || 'Reklamation';
      }
      detail.textContent = state.message || chrome.i18n.getMessage('statusComplaintsDetail') || 'Complaints found!';
      break;

    case 'loading':
      card.classList.add('loading');
      icon.innerHTML = getLoadingIcon();
      label.textContent = chrome.i18n.getMessage('statusAnalyzing') || 'Analyzing…';
      detail.textContent = chrome.i18n.getMessage('statusAnalyzingDetail') || 'Checking URL against threat databases';
      break;

    case 'error':
      card.classList.add('error');
      icon.innerHTML = getErrorIcon();
      label.textContent = chrome.i18n.getMessage('statusError') || 'Error';
      detail.textContent = state.message || chrome.i18n.getMessage('statusErrorDetail') || 'Analysis failed.';
      break;

    case 'whitelisted':
      card.classList.add('safe');
      icon.innerHTML = getSafeIcon();
      label.textContent = chrome.i18n.getMessage('statusWhitelisted') || 'Whitelisted';
      detail.textContent = state.message || chrome.i18n.getMessage('statusWhitelistedDetail') || 'Domain is whitelisted.';
      break;

    case 'skipped':
      icon.innerHTML = getSkippedIcon();
      label.textContent = chrome.i18n.getMessage('statusSkipped') || 'Skipped';
      detail.textContent = state.message || chrome.i18n.getMessage('statusSkippedDetail') || 'Internal page — not analyzed.';
      break;
    
    case 'idle':
      icon.innerHTML = getIdleIcon();
      label.textContent = chrome.i18n.getMessage('statusReady') || 'Ready';
      detail.textContent = state.isWhitelisted 
        ? (chrome.i18n.getMessage('statusReadyDetailWhitelist') || 'Click "Scan" to analyze (Whitelisted).')
        : (chrome.i18n.getMessage('statusReadyDetail') || 'Click "Scan" to analyze this page.');
      break;

    default:
      icon.innerHTML = getLoadingIcon();
      label.textContent = chrome.i18n.getMessage('statusUnknown') || 'Unknown';
      detail.textContent = chrome.i18n.getMessage('statusUnknownDetail') || 'Status unavailable.';
  }

  // Render threats
  if (state.threats && state.threats.length > 0) {
    threatsSection.style.display = 'block';
    threatsList.innerHTML = '';
    state.threats.forEach((threat, i) => {
      const item = document.createElement('div');
      const isWarning = threat.type === 'INSECURE_CONNECTION' || threat.type === 'SUSPICIOUS_URL_LENGTH';
      item.className = `threat-item ${isWarning ? 'warning' : ''}`;
      item.style.animationDelay = `${i * 0.08}s`;
      item.innerHTML = `
        <span class="threat-icon">${isWarning ? '⚠️' : '🛑'}</span>
        <div class="threat-info">
          <span class="threat-type">${formatThreatType(threat.type)}</span>
          <span class="threat-desc">${threat.description || ''}</span>
        </div>
      `;
      threatsList.appendChild(item);
    });
  } else {
    threatsSection.style.display = 'none';
  }

  // Render details
  if (state.detailsApi) {
    detailsSectionApi.style.display = 'block';
    detailsContentApi.innerHTML = linkify(state.detailsApi);
  } else {
    detailsSectionApi.style.display = 'none';
  }

  if (state.detailsReklamation) {
    detailsSectionReklamation.style.display = 'block';
    detailsContentReklamation.innerHTML = linkify(state.detailsReklamation);
  } else {
    detailsSectionReklamation.style.display = 'none';
  }

  if (state.detailsKtipp) {
    detailsSectionKtipp.style.display = 'block';
    detailsContentKtipp.innerHTML = linkify(state.detailsKtipp);
  } else {
    detailsSectionKtipp.style.display = 'none';
  }

  if (state.details) {
    detailsSection.style.display = 'block';
    detailsContent.innerHTML = linkify(state.details);
  } else {
    detailsSection.style.display = 'none';
  }

  // Timestamp
  if (state.checkedAt) {
    const date = new Date(state.checkedAt);
    checkTime.textContent = `Checked: ${date.toLocaleTimeString()}`;
  }
}

function linkify(text) {
  if (!text) return '';
  
  // Identify blocks that should remain as HTML 
  // - <article> blocks for Ktipp
  // - <a>...<h4>...</h4></a> blocks for Reklamation
  const htmlBlockRegex = /(<article[\s\S]*?<\/article>|<a[^>]+href="https:\/\/www\.reklamation\.ch\/complaint\.php\?id=\d+"[^>]*><h4>[\s\S]*?<\/h4><\/a>)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = htmlBlockRegex.exec(text)) !== null) {
    // Process text before the match
    const beforeMatch = text.substring(lastIndex, match.index);
    if (beforeMatch) {
      parts.push(processRegularText(beforeMatch));
    }
    // Push the HTML match as-is
    parts.push(match[0]);
    lastIndex = htmlBlockRegex.lastIndex;
  }

  // Process remaining text
  const remaining = text.substring(lastIndex);
  if (remaining) {
    parts.push(processRegularText(remaining));
  }

  return parts.join('');
}

function processRegularText(text) {
  const urlRegex = /(https?:\/\/[^\s\n]+)/g;
  return text.split(urlRegex).map(part => {
    if (part.match(urlRegex)) {
      const escapedUrl = escapeHtml(part);
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    }
    return escapeHtml(part);
  }).join('');
}

function highlightUrl(urlStr) {
  if (!urlStr) return;
  const urlText = document.getElementById('urlText');
  try {
    const url = new URL(urlStr);
    const protocol = url.protocol + '//';
    const rest = urlStr.substring(protocol.length);
    urlText.innerHTML = `<span style="color: ${url.protocol === 'https:' ? 'var(--color-safe)' : 'var(--color-danger)'}">${protocol}</span>${escapeHtml(rest)}`;
  } catch (e) {
    urlText.textContent = urlStr;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatThreatType(type) {
  if (!type) return 'Unknown';
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// --- SVG Icons ---
function getSafeIcon() {
  return `
    <div class="pulse-ring" style="color: var(--color-safe)"></div>
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-safe)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  `;
}

function getDangerIcon() {
  return `
    <div class="pulse-ring" style="color: var(--color-danger)"></div>
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `;
}

function getWarningIcon() {
  return `
    <div class="pulse-ring" style="color: var(--color-warning)"></div>
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  `;
}

function getLoadingIcon() {
  return `
    <div class="pulse-ring" style="color: var(--accent-primary)"></div>
    <svg class="icon-loading" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" style="width:28px;height:28px;position:relative;z-index:2">
      <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/>
    </svg>
  `;
}

function getErrorIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  `;
}

function getSkippedIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  `;
}

function getIdleIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;position:relative;z-index:2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  `;
}
