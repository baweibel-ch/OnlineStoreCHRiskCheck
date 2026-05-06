/**
 * Check for warnings on ktipp.ch
 */
export async function checkKtipp(urlString, timeout = 30000) {
  console.log("checkKtipp - urlString: ", urlString);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    const internetshopsUrl = 'https://www.ktipp.ch/service/warnlisten/detail/warnliste/internetshops';

    // Step 1: Fetch the internetshops page to get the form with its action URL and hidden fields
    const initialResponse = await fetch(internetshopsUrl, { signal: controller.signal });
    if (!initialResponse.ok) {
      clearTimeout(id);
      return { threats: [], details: '' };
    }

    const html = await initialResponse.text();

    // Step 2: Extract the form with id='frmWarnlisteFilter' and extract its action parameters
    const formTagRegex = /<form[^>]+id="frmWarnlisteFilter"[^>]*>/i;
    const formTagMatch = html.match(formTagRegex);
    if (!formTagMatch) {
      clearTimeout(id);
      return { threats: [], details: '' };
    }

    // Extract the action URL from the form tag
    const actionMatch = formTagMatch[0].match(/action="([^"]+)"/i);
    if (!actionMatch) {
      clearTimeout(id);
      return { threats: [], details: '' };
    }

    // Resolve the action URL (it may be relative) and decode HTML entities
    let actionUrl = actionMatch[1].replace(/&amp;/g, '&');
    if (actionUrl.startsWith('/')) {
      actionUrl = 'https://www.ktipp.ch' + actionUrl;
    }

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
        'Origin': 'https://www.ktipp.ch'
      },
      signal: controller.signal
    });


    if (!response.ok) {
      clearTimeout(id);
      return { threats: [], details: '' };
    }

    const text = await response.text();

    clearTimeout(id);

    if (text.includes('Keine Einträge gefunden')) {
      return {
        threats: [],
        details: `✅ ` + (chrome.i18n.getMessage('bgDetailKtippOkNotFound', [domain]) || `[Ktipp/Saldo-Warnliste] No warnings found for "${domain}".`)
      };
    }

    // Check if the response contains the domain (case-insensitive)
    // Check if response text contains div with id="warnlisteContent"  and <article><h3> with domain
    const hasWarnlisteContent = text.includes('id="warnlisteContent"');
    const articleH3Regex = new RegExp(`<article[^>]*>\\s*<h3[^>]*>\\s*[^<]*${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<\\/h3>[\\s\\S]*?<\\/article>`, 'i');
    const articleMatch = text.match(articleH3Regex);

    if (hasWarnlisteContent && articleMatch) {
      const articleHtml = articleMatch[0];
      return {
        threats: [{
          type: 'KTIPP_WARNLISTE',
          description: chrome.i18n.getMessage('threatDescKtipp') || `Found on Ktipp/Saldo-Warnliste`,
          count: 1
        }],
        details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailKtipp', [domain]) || `[Ktipp/Saldo-Warnliste] Found entry for "${domain}".`) + `\n` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + ` ${internetshopsUrl}\n\n${articleHtml}`
      };
    }
    return {
      threats: [],
      details: `✅ ` + (chrome.i18n.getMessage('bgDetailKtipp', [domain]) || `[Ktipp/Saldo-Warnliste] No warnings found for "${domain}".`)
    };
  } catch (e) {
    clearTimeout(id);
    console.error('checkKtipp error:', e);
    if (e.name === 'AbortError') {
      return {
        threats: [{
          type: 'SERVICE_ERROR',
          description: chrome.i18n.getMessage('fetchTimeoutError', ['K-Tipp/Saldo']) || 'Timeout during query on K-Tipp/Saldo'
        }],
        details: ''
      };
    }
    return {
      threats: [{
        type: 'SERVICE_ERROR',
        description: chrome.i18n.getMessage('threatDescError', ['K-Tipp/Saldo']) || 'Error getting K-Tipp/Saldo'
      }],
      details: ''
    };
  }
}
