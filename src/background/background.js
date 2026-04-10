/**
 * Warnlisten Plugin - Background Service Worker
 * Handles URL analysis via REST API calls
 */

// --- Configuration Defaults ---
const DEFAULT_CONFIG = {
  apiUrl: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
  apiKey: '',
  checkAutomatically: true,
  notificationsEnabled: true,
  enableSafeBrowsing: true,
  enableReklamation: true,
  enableKtipp: true,
  whitelist: ['newtab', 'reklamation.ch', 'sunrise.ch', 'ktipp.ch', 'startpage.com']
};

// --- State ---
const tabStates = new Map();

// --- Initialize ---
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get('config');
  if (!stored.config) {
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
});

// --- Tab Navigation & Removal Listeners ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
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
          {status: 'whitelisted', url: tab.url, message: `Domain "${domain}" is whitelisted.`}
          :{status: 'idle', url: tab.url, message: 'Ready to scan.'};
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
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) {
    const state = { status: 'skipped', url, message: 'Internal browser page — skipped.' };
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
      message: `Domain "${domain}" is whitelisted.` 
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
  const loadingState = { status: 'loading', url, message: 'Analyzing…' };
  tabStates.set(tabId, loadingState);
  updateBadge(tabId, loadingState);
  try {
    const [apiResult, reklamationResult, ktippResult] = await Promise.all([
      config.enableSafeBrowsing && !cachedStateUrl ? callWarningApi(url, config) : Promise.resolve({ threats: cachedStateUrl.threats ? cachedStateUrl.threats.filter(s => s.type !== 'REKLAMATION_CH' && s.type !== 'KTIPP_WARNLISTE') : [], details: cachedStateUrl.detailsContentApi ? cachedStateUrl.detailsContentApi : '' }),
      config.enableReklamation && !cachedStateDomain ? checkReklamation(url) : Promise.resolve({ threats: cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'REKLAMATION_CH') : [], details: cachedStateDomain.detailsReklamation ? cachedStateDomain.detailsReklamation: '' }),
      config.enableKtipp && !cachedStateDomain ? checkKtipp(url) : Promise.resolve({ threats: cachedStateDomain.threats ? cachedStateDomain.threats.filter(s => s.type === 'KTIPP_WARNLISTE') : [], details: cachedStateDomain.detailsKtipp ? cachedStateDomain.detailsKtipp : '' })
    ]);

    const hasSecurityThreats = apiResult.threats.length > 0;
    const hasReklamation = reklamationResult.threats.length > 0;
    const hasKtipp = ktippResult.threats.length > 0;

    const combinedThreats = [...apiResult.threats, ...reklamationResult.threats, ...ktippResult.threats];

    let status = 'safe';
    let message = '✅ No threats detected.';
    if (hasSecurityThreats) {
      status = 'danger';
      message = `⚠️ ${apiResult.threats.length} security threat(s) detected!`;
    }
    if (hasReklamation || hasKtipp) {
      status = !hasSecurityThreats ? 'warning' : status;
      if (hasReklamation && hasKtipp) {
        message = (hasSecurityThreats ? message + '\n\n' : '') + '🔍 Complaints found on reklamation.ch & Ktipp-Warnliste.';
      } else if (hasReklamation) {
        const count = reklamationResult.threats[0].count || 0;
        message = (hasSecurityThreats ? message + '\n\n' : '') + `🔍 ${count} consumer complaint(s) found on reklamation.ch.`;
      } else {
        message = (hasSecurityThreats ? message + '\n\n' : '') + '🔍 Found on Ktipp-Warnliste.';
      }
    }
    const state = {
      status: status,
      url: url,
      threats: combinedThreats,
      detailsApi: apiResult.details,
      detailsReklamation: reklamationResult.details,
      detailsKtipp: ktippResult.details,
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
      message: `Analysis failed: ${error.message}`,
      checkedAt: new Date().toISOString()
    };
    tabStates.set(tabId, state);
    updateBadge(tabId, state);
    return state;
  }
}

/**
 * Call the warning list REST API to check a URL.
 * Supports Google Safe Browsing v4 format and generic REST API formats.
 */
async function callWarningApi(url, config) {
  console.log("callWarningApi - url: ", url);
  if (!config.apiKey) {
    // Demo mode: perform basic heuristic checks
    return performHeuristicCheck(url);
  }
  const apiEndpoint = config.apiUrl.includes('safebrowsing.googleapis.com')
    ? `${config.apiUrl}?key=${config.apiKey}`
    : config.apiUrl;

  const body = buildRequestBody(url, config);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiUrl.includes('safebrowsing.googleapis.com') ? {} : { 'Authorization': `Bearer ${config.apiKey}` })
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseApiResponse(data, config);
}

function buildRequestBody(url, config) {
  if (config.apiUrl.includes('safebrowsing.googleapis.com')) {
    return {
      client: {
        clientId: 'warnlisten-plugin',
        clientVersion: '1.0.0'
      },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: url }]
      }
    };
  }

  // Generic format
  return { url: url };
}

function parseApiResponse(data, config) {
  if (config.apiUrl.includes('safebrowsing.googleapis.com')) {
    const matches = data.matches || [];
    return {
      threats: matches.map(m => ({
        type: m.threatType,
        platform: m.platformType,
        url: m.threat?.url
      })),
      details: matches.length > 0
        ? `Found: ${matches.map(m => m.threatType).join(', ')}`
        : 'No threats found in Google Safe Browsing database.'
    };
  }

  // Generic response parsing
  const threats = data.threats || data.warnings || data.results || [];
  return {
    threats: Array.isArray(threats) ? threats : [],
    details: data.message || data.details || JSON.stringify(data)
  };
}

/**
 * Check for complaints on reklamation.ch
 */
async function checkReklamation(urlString) {
  console.log("checkReklamation - urlString: ", urlString);
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    const searchUrl = `https://www.reklamation.ch/complaint.php?search=true&keyword=${encodeURIComponent(domain)}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      return {threats: [], details: ''};
    }

    const text = await response.text();
    const resultMatch = text.match(/(\d+)\s+Resultate\s+gefunden/i);
    const count = resultMatch ? parseInt(resultMatch[1], 10) : 0;

    if (count > 0) {
      // Extract individual complaint links
      const complaintLinks = [];
      const linkRegex = /complaint\.php\?id=(\d+)/g;
      let match;
      while ((match = linkRegex.exec(text)) !== null && complaintLinks.length < 5) {
        const fullLink = `https://www.reklamation.ch/complaint.php?id=${match[1]}`;
        if (!complaintLinks.includes(fullLink)) {
          complaintLinks.push(fullLink);
        }
      }

      let linksDetail = '';
      if (complaintLinks.length > 0) {
        linksDetail = '\nLatest complaints:\n' + complaintLinks.map(l => `- ${l}`).join('\n');
      }

      return {
        threats: [{
          type: 'REKLAMATION_CH',
          description: `Found ${count} complaint(s) on reklamation.ch`,
          count: count
        }],
        details: `⚠️ [reklamation.ch] Found ${count} complaints for "${domain}".\nMore info: ${searchUrl}${linksDetail}`
      };
    }
    return { threats: [], details: '' };
  } catch (e) {
    return { threats: [], details: '' };
  }
}

/**
 * Check for warnings on ktipp.ch
 */
async function checkKtipp(urlString) {
  console.log("checkKtipp - urlString: ", urlString);
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    const internetshopsUrl = 'https://www.ktipp.ch/service/warnlisten/detail/warnliste/internetshops';

    // Step 1: Fetch the internetshops page to get the form with its action URL and hidden fields
    const initialResponse = await fetch(internetshopsUrl);
    if (!initialResponse.ok) {
      return { threats: [], details: '' };
    }

    const html = await initialResponse.text();

    // Step 2: Extract the form with id='frmWarnlisteFilter' and extract its action parameters
    const formTagRegex = /<form[^>]+id="frmWarnlisteFilter"[^>]*>/i;
    const formTagMatch = html.match(formTagRegex);
    if (!formTagMatch) {
      return { threats: [], details: '' };
    }

    // Extract the action URL from the form tag
    const actionMatch = formTagMatch[0].match(/action="([^"]+)"/i);
    if (!actionMatch) {
      return { threats: [], details: '' };
    }

    // Resolve the action URL (it may be relative) and decode HTML entities
    let actionUrl = actionMatch[1].replace(/&amp;/g, '&');
    if (actionUrl.startsWith('/')) {
      actionUrl = 'https://www.ktipp.ch' + actionUrl;
    }

    const fullActionUrl = new URL(actionUrl);
    const formData = new URLSearchParams();
    const formAction = actionUrl;

    // Step 2.1: Extract the form body content for form id='frmWarnlisteFilter' to get hidden fields
    const formBodyRegex = /<form[^>]+id="frmWarnlisteFilter"[^>]*>([\s\S]*?)<\/form>/i;
    const formBodyMatch = html.match(formBodyRegex);
    if (formBodyMatch) {
      const formContent = formBodyMatch[1];
      // Extract all hidden input fields (TYPO3 needs __referrer, __trustedProperties, etc.)
      const inputRegex = /<input[^>]*type="hidden"[^>]*>/gi;
      let inputMatch;
      while ((inputMatch = inputRegex.exec(formContent)) !== null) {
        const tag = inputMatch[0];
        const nameMatch = tag.match(/name="([^"]+)"/);
        const valueMatch = tag.match(/value="([^"]*)"/);
        if (nameMatch) {
          // Decode HTML entities in values if necessary
          const val = (valueMatch ? valueMatch[1] : '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          formData.set(nameMatch[1], val);
        }
      }
    }

    // Add/Override specific parameters required: searchtext and warnlisteID
    formData.set('tx_updkonsuminfo_konsuminfofe[frmWarnlisteFilter][searchtext]', domain);
    formData.set('tx_updkonsuminfo_konsuminfofe[frmWarnlisteFilter][warnlisteID]', '11');
    // The browser logs also show a top-level warnlisteID=11
    formData.set('tx_updkonsuminfo_konsuminfofe[warnlisteID]', '11');


    // Step 3: Submit the form to the action base URL (mimics browser form submission)
    const response = await fetch(formAction, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': internetshopsUrl,
        'Origin': 'https://www.ktipp.ch'
      }
    });


    if (!response.ok) {
      return { threats: [], details: '' };
    }

    const text = await response.text();

    if (text.includes('Keine Einträge gefunden')) {
      return { threats: [], details: '' };
    }

    // Check if the response contains the domain (case-insensitive)
    // Check if response text contains div with id="warnlisteContent"  and <article><h3> with domain
    const hasWarnlisteContent = text.includes('id="warnlisteContent"');
    const articleH3Regex = new RegExp(`<article[^>]*>\\s*<h3[^>]*>\\s*[^<]*${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<\\/h3>[\\s\\S]*?<\\/article>`, 'i');
    const articleMatch = text.match(articleH3Regex);

    if (hasWarnlisteContent && articleMatch) {
      const articleHtml = articleMatch[0];
      const searchLink = formAction.includes('?') 
        ? `${formAction}&${formData.toString()}` 
        : `${formAction}?${formData.toString()}`;
        
      return {
        threats: [{
          type: 'KTIPP_WARNLISTE',
          description: `Found on Ktipp-Warnliste`,
          count: 1
        }],
        details: `⚠️ [Ktipp-Warnliste] Found entry for "${domain}".\nMore info: ${internetshopsUrl}\n\n${articleHtml}`
      };
    }

    return { threats: [], details: '' };
  } catch (e) {
    return { threats: [], details: '' };
  }
}

/**
 * Heuristic check for demo mode (no API key configured).
 * Checks domain patterns, HTTPS usage, etc.
 */
function performHeuristicCheck(urlString) {
  const threats = [];
  const details = [];

  try {
    const url = new URL(urlString);

    // Check HTTPS
    if (url.protocol === 'http:') {
      threats.push({ type: 'INSECURE_CONNECTION', description: 'This site uses unencrypted HTTP.' });
      details.push('⚠️ No HTTPS — data is transmitted unencrypted.');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, desc: 'IP address used instead of domain name' },
      { pattern: /-{3,}/, desc: 'Excessive hyphens in domain' },
      { pattern: /\.(tk|ml|ga|cf|gq)$/i, desc: 'Known free/suspicious TLD' },
      { pattern: /(login|signin|verify|secure|account|update|confirm).*\./i, desc: 'Potential phishing keywords in subdomain' },
      { pattern: /[а-яА-Я]/, desc: 'Cyrillic characters in URL (possible homograph attack)' }
    ];

    for (const sp of suspiciousPatterns) {
      if (sp.pattern.test(url.hostname)) {
        threats.push({ type: 'SUSPICIOUS_PATTERN', description: sp.desc });
        details.push(`⚠️ ${sp.desc}`);
      }
    }

    // Check for extremely long URLs
    if (urlString.length > 2000) {
      threats.push({ type: 'SUSPICIOUS_URL_LENGTH', description: 'Unusually long URL' });
      details.push('⚠️ Unusually long URL detected.');
    }

    // Check for encoded characters obfuscation
    const encodedCount = (urlString.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    if (encodedCount > 10) {
      threats.push({ type: 'URL_OBFUSCATION', description: 'Heavy URL encoding detected' });
      details.push('⚠️ Excessive URL encoding — possible obfuscation.');
    }

    if (threats.length === 0) {
      details.push('✅ No suspicious patterns detected (heuristic mode).');
      details.push('ℹ️ Configure an API key in settings for full threat database analysis.');
    }

  } catch (e) {
    threats.push({ type: 'INVALID_URL', description: 'Could not parse URL' });
    details.push('❌ Invalid URL format.');
  }

  return { threats, details: details.join('\n') };
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
    skipped: { text: '', color: '#6B7280', textColor: '#FFFFFF' },
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
async function getConfig() {
  const stored = await chrome.storage.sync.get('config');
  return { ...DEFAULT_CONFIG, ...stored.config };
}
