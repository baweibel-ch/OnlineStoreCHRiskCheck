/**
 * Check for UID on uid.admin.ch
 */
export async function checkUid(urlString) {
  console.log("checkUid - urlString: ", urlString);
  try {
    const url = new URL(urlString);
    const domain = url.hostname.replace(/^www\./i, '');
    
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:uidwse="http://www.uid.admin.ch/xmlns/uid-wse" xmlns:uidwse5="http://www.uid.admin.ch/xmlns/uid-wse/5">
   <soap:Body>
      <uidwse:Search>
         <uidwse:searchParameters>
            <uidwse5:uidEntitySearchParameters>
               <uidwse5:organisationName>${domain}</uidwse5:organisationName>
            </uidwse5:uidEntitySearchParameters>
         </uidwse:searchParameters>
      </uidwse:Search>
   </soap:Body>
</soap:Envelope>`;

    const response = await fetch('https://www.uid-wse.admin.ch/V5.0/PublicServices.svc', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Accept': 'text/xml',
        'SOAPAction': '"http://www.uid.admin.ch/xmlns/uid-wse/IPublicServices/Search"'
      },
      body: soapEnvelope
    });

    if (!response.ok) {
      console.error(`HTTP Fehler: ${response.status}`);
      return { threats: [], details: '' };
    }

    const data = await response.text();

    const uidRegex = /<uidOrganisationId[^>]*>(\d+)<\/uidOrganisationId>/i;
    const uidMatch = data.match(uidRegex);

    if (!uidMatch) {
      return {
        threats: [{
          type: 'ADMINCH_UID',
          description: chrome.i18n.getMessage('threatDescUidMissing', [domain]) || `No active UID record found for ${domain}`,
          count: 1
        }],
        details: `⚠️ ` + (chrome.i18n.getMessage('bgDetailUidMissing', [domain]) || `[uid.admin.ch] No active UID record found for "${domain}".`)
      };
    }

    const uid = uidMatch[1];
    let formattedUid = uid;
    if (uid.length === 9) {
      formattedUid = `CHE-${uid.substring(0,3)}.${uid.substring(3,6)}.${uid.substring(6)}`;
    }

    const orgNameMatch = data.match(/<organisationName[^>]*>([^<]+)<\/organisationName>/);
    const streetMatch = data.match(/<street[^>]*>([^<]+)<\/street>/);
    const houseMatch = data.match(/<houseNumber[^>]*>([^<]+)<\/houseNumber>/);
    const zipMatch = data.match(/<swissZipCode[^>]*>([^<]+)<\/swissZipCode>/);
    const townMatch = data.match(/<town[^>]*>([^<]+)<\/town>/);

    const orgName = orgNameMatch ? orgNameMatch[1] : '';
    const street = streetMatch ? streetMatch[1] : '';
    const house = houseMatch ? houseMatch[1] : '';
    const zip = zipMatch ? zipMatch[1] : '';
    const town = townMatch ? townMatch[1] : '';

    let addressParts = [];
    if (street) addressParts.push(street + (house ? ' ' + house : ''));
    if (zip || town) addressParts.push((zip ? zip + ' ' : '') + town);
    const fullAddress = addressParts.join(', ');

    const link = `https://www.uid.admin.ch/Detail.aspx?uid_id=${formattedUid}`;
    return {
      threats: [],
      details: `✅ ` + (chrome.i18n.getMessage('bgDetailUidOk', [domain]) || `[uid.admin.ch] Active UID found for "${domain}".`) + ` ` +
               `${formattedUid} - ${orgName}` +
               (fullAddress ? ` - ${fullAddress}` : '') +
               `` + (chrome.i18n.getMessage('bgDetailMoreInfo') || 'More info:') + ` ${link}`
    };
  } catch (e) {
    console.error('checkUid error:', e);
    return {
      threats: [{
        type: 'SERVICE_ERROR',
        description: chrome.i18n.getMessage('threatDescError', ['uid.admin.ch']) || 'Error getting uid.admin.ch'
      }],
      details: ''
    };
  }
}
