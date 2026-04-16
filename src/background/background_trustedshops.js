/**
 * Check if the domain is a Trusted Shops certified shop
 */
export async function checkTrustedshops(urlString) {
  try {
    console.log("checkTrustedshops - urlString: " + urlString);
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    const searchUrl = `https://www.trustedshops.ch/shops?q=${encodeURIComponent(domain)}`;

    const response = await fetch(searchUrl);
    const text = await response.text();
    
    // Check if the response text contains a link to the shop's review page
    const isFound = text.includes(`trustedshops.ch/bewertung`);

    if (isFound) {
        const shopUrl = `https://www.trustedshops.ch/shops?q=${domain}`;
        return {
          threats: [],
          details: `✅ ` + (chrome.i18n.getMessage('bgDetailTS', [domain]) || `[TrustedShops] Certified shop "${domain}".`) + `\n` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + shopUrl
        };
    }
    return {
      threats: [{ type: 'TRUSTED_SHOPS_MISSING', description: chrome.i18n.getMessage('tsMissingDesc') || 'Not a Trusted Shops certified shop.' }], 
      details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailTSMissing', [domain]) || `[TrustedShops] Domain "${domain}" is not certified.`)
    };
  } catch (e) {
    console.error('checkTrustedshops error:', e);
    return {
      threats: [{
        type: 'SERVICE_ERROR',
        description: chrome.i18n.getMessage('threatDescError', ['Trusted Shops']) || 'Error getting Trusted Shops'
      }],
      details: ''
    };
  }
}
