/**
 * Warnlisten Plugin — Content Script
 * Displays an unobtrusive security badge on analyzed pages
 */

let statusBadge = null;

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStatus') {
    showStatusBadge(message.state);
  }
});

function showStatusBadge(state) {
  // Remove existing badge
  if (statusBadge) {
    statusBadge.remove();
    statusBadge = null;
  }

  // Don't show badge for safe/skipped/whitelisted/idle states
  if (state.status === 'safe' || state.status === 'skipped' || state.status === 'whitelisted' || state.status === 'idle') {
    return;
  }

  // Create badge for danger/warning/error/loading states
  statusBadge = document.createElement('div');
  statusBadge.id = 'warnlisten-badge';
  statusBadge.className = `warnlisten-badge warnlisten-${state.status}`;

  const threatCount = state.threats ? state.threats.length : 0;
  
  const loadingIcon = `
    <svg class="warnlisten-icon-loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
      <circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4"/>
    </svg>
  `;
  
  const cartIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  `;
  
  let label = '';
  let icon = cartIcon;

  let reklamationThreats = state.threats?.filter(t => t.type === 'REKLAMATION_CH');
  let ktippThreats = state.threats?.filter(t => t.type === 'KTIPP_WARNLISTE');
  let trustedstoreThreats = state.threats?.filter(t => t.type === 'TRUSTED_SHOPS_MISSING');
  let apiThreats = state.threats?.filter(t => t.type !== 'REKLAMATION_CH' && t.type !== 'KTIPP_WARNLISTE' && t.type !== 'TRUSTED_SHOPS_MISSING');

  if (reklamationThreats && reklamationThreats.length > 0) {
    label = (label && label.length > 0?label+'<br/>':'') + chrome.i18n.getMessage('bgComplaintsRek', [reklamationThreats.length.toString()]) || `${reklamationThreats.length} consumer complaint(s) found on reklamation.ch.`;
  }
  if (ktippThreats && ktippThreats.length > 0) {
    label = (label && label.length > 0?label+'<br/>':'') + chrome.i18n.getMessage('bgComplaintsKtipp', [ktippThreats.length.toString()]) || `${ktippThreats.length} Found on Ktipp-Warnliste.`;
  }
  if (trustedstoreThreats && trustedstoreThreats.length > 0) {
    label = (label && label.length > 0?label+'<br/>':'') + chrome.i18n.getMessage('bgComplaintsNotFoundTrustedShops', [trustedstoreThreats.length.toString()]) || `${trustedstoreThreats.length} Not found on Trustedshops.ch.`;
  }
  if (apiThreats && apiThreats.length > 0) {
    label = (label && label.length > 0?label+'<br/>':'') + chrome.i18n.getMessage('bgThreatsReport', [apiThreats.length.toString()]) || `${apiThreats.length} security threat(s) detected!.`;
  }

  if (!label) {
    return;
  }

  statusBadge.innerHTML = `
    <div class="warnlisten-badge-content">
      <span class="warnlisten-badge-icon">${icon}</span>
      <span class="warnlisten-badge-text">${label}</span>
      <button class="warnlisten-badge-close" title="Dismiss">&times;</button>
    </div>
  `;

  document.body.appendChild(statusBadge);

  // Animate in
  requestAnimationFrame(() => {
    statusBadge.classList.add('warnlisten-visible');
  });

  // Close button
  statusBadge.querySelector('.warnlisten-badge-close').addEventListener('click', (e) => {
    e.stopPropagation();
    statusBadge.classList.remove('warnlisten-visible');
    setTimeout(() => {
      statusBadge?.remove();
      statusBadge = null;
    }, 300);
  });

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (statusBadge) {
      statusBadge.classList.remove('warnlisten-visible');
      setTimeout(() => {
        statusBadge?.remove();
        statusBadge = null;
      }, 300);
    }
  }, 10000);
}
