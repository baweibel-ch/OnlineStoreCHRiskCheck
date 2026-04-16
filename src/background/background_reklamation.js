/**
 * Check for complaints on reklamation.ch
 */
export async function checkReklamation(urlString) {
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
      // Extract individual complaint links with titles
      const complaintLinks = [];
      const entryRegex = /<a href="(complaint\.php\?id=\d+)">[\s\S]*?<h4>([\s\S]*?)<\/h4>/gi;
      let match;
      
      while ((match = entryRegex.exec(text)) !== null && complaintLinks.length < 5) {
        const relativeLink = match[1];
        const title = match[2].trim().replace(/<[^>]*>?/gm, ''); // Remove any nested tags
        const fullLink = `https://www.reklamation.ch/${relativeLink}`;
        
        if (!complaintLinks.some(c => c.link === fullLink)) {
          complaintLinks.push({ link: fullLink, title: title });
        }
      }

      let linksDetail = '';
      if (complaintLinks.length > 0) {
        linksDetail = '\n' + (chrome.i18n.getMessage('bgDetailRekLatest') || 'Latest complaints:') + '\n' + complaintLinks.map(c => `<a href="${c.link}" target="_blank" rel="noopener noreferrer"><h4>${c.title}</h4></a>`).join('\n');
      }

      return {
        threats: [{
          type: 'REKLAMATION_CH',
          description: chrome.i18n.getMessage('threatDescReklamation', [count.toString()]) || `Found ${count} complaint(s) on reklamation.ch`,
          count: count
        }],
        details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailRek', [count.toString(), domain]) || `[reklamation.ch] Found ${count} complaints for "${domain}".`) + `\n` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + ` ${searchUrl}${linksDetail}`
      };
    }
    return {
      threats: [],
      details: `✅ ` + (chrome.i18n.getMessage('bgDetailRekOkNotFound', [domain]) || `[reklamation.ch] No complaints found for "${domain}".`)
    };
  } catch (e) {
    console.error('checkReklamation error:', e);
    return {
      threats: [{
        type: 'SERVICE_ERROR',
        description: chrome.i18n.getMessage('threatDescError', ['reklamation.ch']) || 'Error getting reklamation.ch'
      }],
      details: ''
    };
  }
}
