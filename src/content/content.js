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

  // Don't show badge for safe/skipped/loading states
  if (state.status === 'safe' || state.status === 'skipped' || state.status === 'loading') {
    return;
  }

  // Create badge for danger/warning states
  statusBadge = document.createElement('div');
  statusBadge.id = 'warnlisten-badge';
  statusBadge.className = `warnlisten-badge warnlisten-${state.status}`;

  const threatCount = state.threats ? state.threats.length : 0;
  
  const cartIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  `;
  
  let label = '';

  if (state.status === 'danger') {
    label = `${threatCount} security issue${threatCount !== 1 ? 's' : ''} detected`;
  } else if (state.status === 'warning') {
    // Look for reklamation or ktipp count in threats
    const reklamationThreat = state.threats?.find(t => t.type === 'REKLAMATION_CH');
    const ktippThreat = state.threats?.find(t => t.type === 'KTIPP_WARNLISTE');
    
    if (reklamationThreat && ktippThreat) {
      label = 'Found on Ktipp & Reklamation';
    } else if (ktippThreat) {
      label = 'Ktipp-Warnliste: Entry found';
    } else {
      const count = reklamationThreat?.count || threatCount;
      label = `Reklamation: ${count} complaint${count !== 1 ? 's' : ''} found`;
    }
  } else {
    label = 'Analysis error';
  }

  statusBadge.innerHTML = `
    <div class="warnlisten-badge-content">
      <span class="warnlisten-badge-icon">${cartIcon}</span>
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

  // Click to open popup
  statusBadge.querySelector('.warnlisten-badge-content').addEventListener('click', () => {
    // Opening popup programmatically is not supported, but we can show more info
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
