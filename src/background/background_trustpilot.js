/**
 * Check if the domain is on Trustpilot
 */
export async function checkTrustpilot(urlString, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    console.log("checkTrustpilot - urlString: " + urlString);
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    const searchUrl = `https://ch.trustpilot.com/search?query=${encodeURIComponent(domain)}`;

    const response = await fetch(searchUrl, { signal: controller.signal });
    
    if (response.status === 403) {
      clearTimeout(id);
      return {
        threats: [{
          type: 'SERVICE_ERROR',
          description: chrome.i18n.getMessage('tp403Error') || 'Access denied (403) on Trustpilot'
        }],
        details: '⚠️ ' + (chrome.i18n.getMessage('tp403Detail') || 'Trustpilot access denied (403). Possible rate limiting or blocking.')
      };
    }

    if (!response.ok) {
      clearTimeout(id);
      return { threats: [], details: '' };
    }

    const text = await response.text();
    clearTimeout(id);
    
    const isReviewPage = response.url.includes('/review/');
    const reviewLinkMatch = text.match(new RegExp(`href="/review/${domain.replace(/\./g, '\\.')}"`, 'i'));

    if (reviewLinkMatch || isReviewPage) {
        let score = "?";
        let count = "?";

        if (isReviewPage) {
            const scoreMatch = text.match(/class="[^"]*styles_trustScore__[^"]*">([\d\.]+)<\/p>/);
            if (scoreMatch) score = scoreMatch[1];
            
            const ratingClassMatch = text.match(/class="[^"]*styles_reviewsAndRating__[^"]*"[^>]*>([\s\S]*?)<\/span>/);
            if (ratingClassMatch) {
                const innerText = ratingClassMatch[1].replace(/<[^>]+>|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                const numMatch = innerText.match(/([0-9’',.]+)/);
                if (numMatch) count = numMatch[1];
            }
        } else {
            const scoreMatch = text.match(/TrustScore (\d[\.,]\d)/i);
            if (scoreMatch) {
                score = scoreMatch[1];
            }

            const countMatch = text.match(/([0-9’',.]+)\s+(Bewertungen|Reviews|Avis|recensioni)/i);
            if (countMatch) {
                count = countMatch[1];
            }
        }

        const parsedScore = parseFloat(score);
        const parsedCount = parseInt(count.replace(/[^0-9]/g, ''), 10);
        
        if ((isNaN(parsedScore) || parsedScore === 0) && (isNaN(parsedCount) || parsedCount === 0)) {
            return {
              threats: [{ type: 'TRUSTPILOT_MISSING', description: chrome.i18n.getMessage('tpMissingDesc') || 'Not found on Trustpilot.' }], 
              details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailTPMissing', [domain]) || `[Trustpilot] Domain "${domain}" is not rated.`)
            };
        }

        const shopUrl = `https://ch.trustpilot.com/review/${domain}`;
        
        if (parsedScore < 2.0 && !isNaN(parsedScore)) {
          return {
            threats: [{
              type: 'TRUSTPILOT_LOW_RATING',
              description: chrome.i18n.getMessage('tpLowRatingDesc', [score]) || `Low Trustpilot rating: ${score}`,
              score: parsedScore
            }],
            details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailTPLow', [domain, score, count]) || `[Trustpilot] "${domain}" has a low score of ${score} (${count} reviews).`) + `\n` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + shopUrl
          };
        }

        return {
          threats: [],
          details: `✅ ` + (chrome.i18n.getMessage('bgDetailTP', [domain, score, count]) || `[Trustpilot] "${domain}": Score ${score}, ${count} reviews.`) + `\n` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + shopUrl
        };
    }
    return {
      threats: [{ type: 'TRUSTPILOT_MISSING', description: chrome.i18n.getMessage('tpMissingDesc') || 'Not found on Trustpilot.' }], 
      details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailTPMissing', [domain]) || `[Trustpilot] Domain "${domain}" is not rated.`)
    };
  } catch (e) {
    clearTimeout(id);
    console.error('checkTrustpilot error:', e);
    if (e.name === 'AbortError') {
      return {
        threats: [{
          type: 'SERVICE_ERROR',
          description: chrome.i18n.getMessage('fetchTimeoutError', ['Trustpilot']) || 'Timeout during query on Trustpilot'
        }],
        details: ''
      };
    }
    return {
      threats: [{
        type: 'SERVICE_ERROR',
        description: chrome.i18n.getMessage('threatDescError', ['Trustpilot']) || 'Error getting Trustpilot'
      }],
      details: ''
    };
  }
}
