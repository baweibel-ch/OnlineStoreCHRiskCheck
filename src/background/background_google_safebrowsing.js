/**
 * Call the warning list REST API to check a URL.
 * Supports Google Safe Browsing v4 format and generic REST API formats.
 */
export async function callWarningApi(url, config) {
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

export function buildRequestBody(url, config) {
  if (config.apiUrl.includes('safebrowsing.googleapis.com')) {
    return {
      client: {
        clientId: 'warnlisten-plugin',
        clientVersion: '1.0.4.1'
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

export function parseApiResponse(data, config) {
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
 * Heuristic check for demo mode (no API key configured).
 * Checks domain patterns, HTTPS usage, etc.
 */
export function performHeuristicCheck(urlString) {
  console.log("performHeuristicCheck - urlString: ", urlString)
  const threats = [];
  const details = [];

  try {
    const url = new URL(urlString);

    // Check HTTPS
    if (url.protocol === 'http:') {
      threats.push({ type: 'INSECURE_CONNECTION', description: chrome.i18n.getMessage('heurInsecureConnDesc') || 'This site uses unencrypted HTTP.' });
      details.push('⚠️ ' + (chrome.i18n.getMessage('heurInsecureConnDet') || 'No HTTPS — data is transmitted unencrypted.'));
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, desc: chrome.i18n.getMessage('heurSuspPatternDesc1') || 'IP address used instead of domain name' },
      { pattern: /-{3,}/, desc: chrome.i18n.getMessage('heurSuspPatternDesc2') || 'Excessive hyphens in domain' },
      { pattern: /\.(tk|ml|ga|cf|gq)$/i, desc: chrome.i18n.getMessage('heurSuspPatternDesc3') || 'Known free/suspicious TLD' },
      { pattern: /(login|signin|verify|secure|account|update|confirm).*\./i, desc: chrome.i18n.getMessage('heurSuspPatternDesc4') || 'Potential phishing keywords in subdomain' },
      { pattern: /[а-яА-Я]/, desc: chrome.i18n.getMessage('heurSuspPatternDesc5') || 'Cyrillic characters in URL (possible homograph attack)' }
    ];

    for (const sp of suspiciousPatterns) {
      if (sp.pattern.test(url.hostname)) {
        threats.push({ type: 'SUSPICIOUS_PATTERN', description: sp.desc });
        details.push(`⚠️ ${sp.desc}`);
      }
    }

    // Check for extremely long URLs
    if (urlString.length > 2000) {
      threats.push({ type: 'SUSPICIOUS_URL_LENGTH', description: chrome.i18n.getMessage('heurURLengthDesc') || 'Unusually long URL' });
      details.push('⚠️ ' + (chrome.i18n.getMessage('heurURLengthDet') || 'Unusually long URL detected.'));
    }

    // Check for encoded characters obfuscation
    const encodedCount = (urlString.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    if (encodedCount > 10) {
      threats.push({ type: 'URL_OBFUSCATION', description: chrome.i18n.getMessage('heurURLObfDesc') || 'Heavy URL encoding detected' });
      details.push('⚠️ ' + (chrome.i18n.getMessage('heurURLObfDet') || 'Excessive URL encoding — possible obfuscation.'));
    }

    if (threats.length === 0) {
      details.push('✅ ' + (chrome.i18n.getMessage('heurSafeDet1') || 'No suspicious patterns detected (heuristic mode).'));
      details.push('ℹ️ ' + (chrome.i18n.getMessage('heurSafeDet2') || 'Configure an API key in settings for full threat database analysis.'));
    }

  } catch (e) {
    threats.push({ type: 'INVALID_URL', description: chrome.i18n.getMessage('heurInvalidURLError') || 'Could not parse URL' });
    details.push('❌ ' + (chrome.i18n.getMessage('heurInvalidURLDet') || 'Invalid URL format.'));
  }

  return { threats, details: details.join('\n') };
}
