/**
 * OnlineStore CH risk-check - Background Service Worker
 * Handles URL analysis via REST API calls, and "normal" httpClient calls for those who don't have rest-apis
 */
/*
 * Copyright (C) 2026  [Bernhard Weibel]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { checkReklamation } from './background_reklamation.js';
import { checkKtipp } from './background_ktipp.js';
import { checkTrustedshops } from './background_trustedshops.js';
import { callWarningApi } from './background_google_safebrowsing.js';
import { checkUid } from './background_adminch_uid.js';
import { checkTrustpilot } from './background_trustpilot.js';

// --- Configuration Defaults ---
const DEFAULT_CONFIG = {
  apiUrl: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
  apiKey: '',
  checkAutomatically: false,
  notificationsEnabled: true,
  enableSafeBrowsing: false,
  enableReklamation: true,
  enableKtipp: true,
  enableTrustedshops: true,
  enableTrustpilot: true,
  enableAdminchUid: true,
  theme: 'light',
  whitelist: ['reklamation.ch', 'ktipp.ch', 'saldo.ch', 'startpage.com']
};

// --- State ---
const tabStates = new Map();

// --- Initialize ---
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('config');
  if (!stored.config) {
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
  await setupRefererRules();
});

// --- Referer Rule Setup for Manifest V3 ---
async function setupRefererRules() {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'OnlineStoreCHRiskCheck' }
        ]
      },
      condition: {
        urlFilter: '*://*.reklamation.ch/*',
        resourceTypes: ['xmlhttprequest']
      }
    },
    {
      id: 2,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'OnlineStoreCHRiskCheck' }
        ]
      },
      condition: {
        urlFilter: '*://*.ktipp.ch/*',
        resourceTypes: ['xmlhttprequest']
      }
    },
    {
      id: 3,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'OnlineStoreCHRiskCheck' }
        ]
      },
      condition: {
        urlFilter: '*://*.trustedshops.ch/*',
        resourceTypes: ['xmlhttprequest']
      }
    },
    {
      id: 4,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'OnlineStoreCHRiskCheck' }
        ]
      },
      condition: {
        urlFilter: '*://safebrowsing.googleapis.com/*',
        resourceTypes: ['xmlhttprequest']
      }
    },
    {
      id: 5,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Referer', operation: 'set', value: 'OnlineStoreCHRiskCheck' }
        ]
      },
      condition: {
        urlFilter: '*://*.trustpilot.com/*',
        resourceTypes: ['xmlhttprequest']
      }
    }
  ];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules
  });
}

// --- Tab Navigation & Removal Listeners ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (isSkippedUrl(tab.url)) {
      const state = { status: 'skipped', url: tab.url, message: chrome.i18n.getMessage('bgSkippedPage') || 'No web address / localhost / IP — skipped.' };
      tabStates.set(tabId, state);
      updateBadge(tabId, state);
      chrome.tabs.sendMessage(tabId, { action: 'updateStatus', state: state }).catch(() => {});
      return;
    }

    const config = await getConfig();
    const urlObj = new URL(tab.url);
    const domain = urlObj.hostname.toLowerCase();

    // Check if we already have a result for this domain in ANY tab
    let cachedStateDomain = null;
    for (const [id, state] of tabStates.entries()) {
      if (state.url) {
        try {
          const cachedUrlObj = new URL(state.url);
          if (cachedUrlObj.hostname.toLowerCase() === domain && state.status !== 'loading' && state.status !== 'idle') {
            cachedStateDomain = { ...state, url: tab.url }; // Use current URL but cached results
            break;
          }
        } catch (e) { /* ignore invalid URLs */ }
      }
    }
    let cachedStateUrl = null;
    for (const [id, state] of tabStates.entries()) {
      if (state.url === tab.url && state.status !== 'loading' && state.status !== 'idle') {
        cachedStateUrl = { ...state, url: tab.url }; // Use current URL but cached results
        break;
      }
    }

    if (config.checkAutomatically) {
      if (cachedStateDomain && cachedStateUrl) {
        tabStates.set(tabId, cachedStateDomain);
        updateBadge(tabId, cachedStateDomain);
        chrome.tabs.sendMessage(tabId, { action: 'updateStatus', state: cachedStateDomain }).catch(() => {});
      } else {
        await analyzeUrl(tabId, tab.url, cachedStateDomain && cachedStateDomain.status !== 'whitelisted', cachedStateDomain, cachedStateUrl);
      }
    } else {
      // Manual mode - set to idle state if no cached result for this domain
      const currentState = tabStates.get(tabId);
      if (cachedStateDomain) {
        // wenn wir aber manuell für domain checked haben, dann checken wir forced damit für url geprüft wird
        if (!(cachedStateDomain.status === 'whitelisted' || cachedStateDomain.status === 'idle')) {
          await analyzeUrl(tabId, tab.url, true, cachedStateDomain, cachedStateUrl);
        } else {
          tabStates.set(tabId, cachedStateDomain);
          updateBadge(tabId, cachedStateDomain);
          chrome.tabs.sendMessage(tabId, {action: 'updateStatus', state: cachedStateDomain}).catch(() => {
          });
        }
      } else if (!currentState || currentState.url !== tab.url) {
        const isWhitelisted = config.whitelist && config.whitelist.some(w => {
          const trimmed = w.trim().toLowerCase().replace(/^www\./i, '');
          if (!trimmed) return false;

          const currentDomain = domain.replace(/^www\./i, '');
          return currentDomain === trimmed || currentDomain.endsWith('.' + trimmed);
        });
        const state= isWhitelisted?
          {status: 'whitelisted', url: tab.url, message: chrome.i18n.getMessage('bgWhitelistedMsg', [domain]) || `Domain "${domain}" is whitelisted.`}
          :{status: 'idle', url: tab.url, message: chrome.i18n.getMessage('statusReady') || 'Ready to scan.'};
          tabStates.set(tabId, state);
          updateBadge(tabId, state);
        // Broadcast to content script
        chrome.tabs.sendMessage(tabId, {action: 'updateStatus', state: state}).catch(() => {
        });
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

// --- Message Handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeUrl') {
    handleAnalyzeRequest(message.url, message.tabId, message.force)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ status: 'error', message: err.message }));
    return true; // async response
  }

  if (message.action === 'getStatus') {
    const state = tabStates.get(message.tabId) || { status: 'unknown' };
    sendResponse(state);
    return true;
  }

  if (message.action === 'getConfig') {
    getConfig().then(config => sendResponse(config));
    return true;
  }

  if (message.action === 'saveConfig') {
    chrome.storage.sync.set({ config: message.config })
      .then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === 'addToWhitelist') {
    getConfig().then(config => {
      if (!config.whitelist.includes(message.domain)) {
        config.whitelist.push(message.domain);
        chrome.storage.sync.set({ config }).then(() => sendResponse({ success: true }));
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.action === 'removeFromWhitelist') {
    getConfig().then(config => {
      config.whitelist = config.whitelist.filter(d => d !== message.domain);
      chrome.storage.sync.set({ config }).then(() => sendResponse({ success: true }));
    });
    return true;
  }
});

// --- Core Analysis ---
async function handleAnalyzeRequest(url, tabId, force = false) {
  const result = await analyzeUrl(tabId, url, force, null, null);
  return result;
}

async function analyzeUrl(tabId, url, force = false, cachedStateDomain, cachedStateUrl) {
  if (isSkippedUrl(url)) {
    const state = { status: 'skipped', url, message: chrome.i18n.getMessage('bgSkippedPage') || 'No web address / localhost / IP — skipped.' };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);
    return state;
  }

  const config = await getConfig();
  const urlObj = new URL(url);
  const domain = urlObj.hostname.toLowerCase();

  // Check whitelist (skipped if force is true)
  const isWhitelisted = !force && config.whitelist && config.whitelist.some(w => {
    const trimmed = w.trim().toLowerCase().replace(/^www\./i, '');
    if (!trimmed) return false;
    
    const currentDomain = domain.replace(/^www\./i, '');
    return currentDomain === trimmed || currentDomain.endsWith('.' + trimmed);
  });

  if (isWhitelisted) {
    const state = { 
      status: 'whitelisted', 
      url, 
      message: chrome.i18n.getMessage('bgWhitelistedMsg', [domain]) || `Domain "${domain}" is whitelisted.` 
    };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);

    // Notify content script
    try {
      chrome.tabs.sendMessage(tabId, {
        action: 'updateStatus',
        state: state
      });
    } catch (e) {
      // Content script not loaded yet, ignore
    }

    return state;
  }

  // Set loading state
  const loadingState = { status: 'loading', url, message: chrome.i18n.getMessage('statusAnalyzing') || 'Analyzing…' };
  tabStates.set(tabId, loadingState);
  updateBadge(tabId, loadingState);
  try {
    const [apiResult, reklamationResult, ktippResult, trustedshopsResult, uidResult, trustpilotResult] = await Promise.all([
      config.enableSafeBrowsing && !cachedStateUrl ? callWarningApi(url, config) : Promise.resolve({ threats: cachedStateUrl && cachedStateUrl.threats ? cachedStateUrl.threats.filter(s => s.type !== 'REKLAMATION_CH' && s.type !== 'KTIPP_WARNLISTE' && s.type !== 'TRUSTED_SHOPS_MISSING' && s.type !== 'ADMINCH_UID' && s.type !== 'TRUSTPILOT_MISSING') : [], details: cachedStateUrl && cachedStateUrl.detailsContentApi ? cachedStateUrl.detailsContentApi : '' }),
      config.enableReklamation && !cachedStateDomain ? checkReklamation(url) : Promise.resolve({ threats: cachedStateDomain && cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'REKLAMATION_CH') : [], details: cachedStateDomain && cachedStateDomain.detailsReklamation ? cachedStateDomain.detailsReklamation: '' }),
      config.enableKtipp && !cachedStateDomain ? checkKtipp(url) : Promise.resolve({ threats: cachedStateDomain && cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'KTIPP_WARNLISTE') : [], details: cachedStateDomain && cachedStateDomain.detailsKtipp ? cachedStateDomain.detailsKtipp : '' }),
      config.enableTrustedshops && !cachedStateDomain ? checkTrustedshops(url) : Promise.resolve({ threats: cachedStateDomain && cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'TRUSTED_SHOPS_MISSING') : [], details: cachedStateDomain && cachedStateDomain.detailsTrustedshops ? cachedStateDomain.detailsTrustedshops : '' }),
      config.enableAdminchUid && !cachedStateDomain ? checkUid(url) : Promise.resolve({ threats: cachedStateDomain && cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'ADMINCH_UID') : [], details: cachedStateDomain && cachedStateDomain.detailsAdminchUid ? cachedStateDomain.detailsAdminchUid : '' }),
      config.enableTrustpilot && !cachedStateDomain ? checkTrustpilot(url) : Promise.resolve({ threats: cachedStateDomain && cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'TRUSTPILOT_MISSING') : [], details: cachedStateDomain && cachedStateDomain.detailsTrustpilot ? cachedStateDomain.detailsTrustpilot : '' })
    ]);
    const hasSecurityThreats = apiResult && apiResult.threats && apiResult.threats.length > 0;
    const hasReklamation = reklamationResult && reklamationResult.threats && reklamationResult.threats.length > 0;
    const hasKtipp = ktippResult && ktippResult.threats && ktippResult.threats.length > 0;
    const hasTrustedShops = trustedshopsResult && trustedshopsResult.threats && trustedshopsResult.threats.length > 0;
    const hasUidMissing = uidResult && uidResult.threats && uidResult.threats.length > 0;
    const hasTrustpilot = trustpilotResult && trustpilotResult.threats && trustpilotResult.threats.length > 0;

    const combinedThreats = [...apiResult.threats, ...reklamationResult.threats, ...ktippResult.threats, ...trustedshopsResult.threats, ...uidResult.threats, ...trustpilotResult.threats];

    let status = 'safe';
    let message = null;
    let statusNotSafe = false;
    if (hasSecurityThreats) {
      status = 'danger';
      statusNotSafe = true;
      message = '⚠️ ' + (chrome.i18n.getMessage('bgThreatsReport', [apiResult.threats.length.toString()]) || `${apiResult.threats.length} security threat(s) detected!`);
    }
    if (hasReklamation) {
      status = statusNotSafe?status:'warning';
      statusNotSafe = true;
      const count = reklamationResult.threats.length || 0;
      message = (message ? message + '\n\n' : '') + '🔍 ' + (chrome.i18n.getMessage('bgComplaintsRek', [count.toString()]) || `${count} consumer complaint(s) found on reklamation.ch.`);
    }
    if (hasKtipp) {
      status = statusNotSafe?status:'warning';
      statusNotSafe = true;
      const count = ktippResult.threats.length || 0;
      message = (message ? message + '\n\n' : '') + '🔍 ' + (chrome.i18n.getMessage('bgComplaintsKtipp', [count.toString()]) || `${count} Found on Ktipp-Warnliste.`);
    }
    if (hasTrustedShops) {
      status = statusNotSafe?status:'warning';
      statusNotSafe = true;
      const count = trustedshopsResult.threats.length || 0;
      message = (message ? message + '\n\n' : '') + '🔍 ' + (chrome.i18n.getMessage('bgComplaintsNotFoundTrustedShops', [count.toString()]) || `Not found on Trustedshops.ch.`);
    }
    if (hasTrustpilot) {
      status = statusNotSafe?status:'warning';
      statusNotSafe = true;
      message = (message ? message + '\n\n' : '') + '🔍 ' + (chrome.i18n.getMessage('bgComplaintsNotFoundTrustpilot') || `Not found on Trustpilot.`);
    }
    if (hasUidMissing) {
      status = statusNotSafe?status:'warning';
      statusNotSafe = true;
      message = (message ? message + '\n\n' : '') + '🔍 ' + (chrome.i18n.getMessage('bgComplaintsUidMissing') || `Missing active UID on admin.ch.`);
    }

    const state = {
      status: status,
      url: url,
      threats: combinedThreats,
      detailsApi: apiResult.details,
      detailsReklamation: reklamationResult.details,
      detailsKtipp: ktippResult.details,
      detailsTrustedshops: trustedshopsResult.details,
      detailsTrustpilot: trustpilotResult.details,
      detailsAdminchUid: uidResult.details,
      checkedAt: new Date().toISOString(),
      message: message
    };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);

    // Notify content script
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'updateStatus',
        state: state
      });
    } catch (e) {
      // Content script not loaded yet, ignore
    }

    return state;
  } catch (error) {
    const state = {
      status: 'error',
      url: url,
      message: chrome.i18n.getMessage('bgErrorMsg', [error.message]) || `Analysis failed: ${error.message}`,
      checkedAt: new Date().toISOString()
    };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);
    return state;
  }
}

// --- Badge Updates ---
function updateBadge(tabId, state) {
  const badges = {
    safe: { text: '✓', color: '#10B981', textColor: '#FFFFFF' },
    danger: { text: '!', color: '#EF4444', textColor: '#FFFFFF' },
    warning: { text: '!', color: '#F59E0B', textColor: '#FFFFFF' },
    loading: { text: '…', color: '#6366F1', textColor: '#FFFFFF' },
    error: { text: '✕', color: '#F59E0B', textColor: '#FFFFFF' },
    whitelisted: { text: '✓', color: '#FFFFFF', textColor: '#1F2937' },
    idle: { text: '?', color: '#FFFFFF', textColor: '#1F2937' },
    skipped: { text: '-', color: '#6B7280', textColor: '#FFFFFF' },
    unknown: { text: '?', color: '#6B7280', textColor: '#FFFFFF' }
  };

  const badge = badges[state.status] || badges.unknown;
  chrome.action.setBadgeText({ text: badge.text, tabId });
  chrome.action.setBadgeBackgroundColor({ color: badge.color, tabId });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: badge.textColor, tabId });
  }
}

// --- Helpers ---
function isSkippedUrl(url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return true;
  }
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain) || domain.startsWith('[');
    if (domain === 'localhost' || isIp) {
      return true;
    }
  } catch (e) {
    return true;
  }
  return false;
}

async function getConfig() {
  const stored = await chrome.storage.sync.get('config');
  return { ...DEFAULT_CONFIG, ...stored.config };
}
