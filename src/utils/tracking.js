export function getSafeTrackingUrl(value) {
  if (!value) return '';

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function buildTrackingLink({ trackingUrl, trackingNumber, carrierName }) {
  const safeUrl = getSafeTrackingUrl(trackingUrl);
  const number = String(trackingNumber || '').trim();

  if (!safeUrl || !number) {
    return { url: safeUrl, prefilled: false };
  }

  if (safeUrl.includes('{tracking_number}')) {
    return {
      url: safeUrl.replace('{tracking_number}', encodeURIComponent(number)),
      prefilled: true,
    };
  }

  const carrier = String(carrierName || '').toLowerCase();
  const host = new URL(safeUrl).hostname.toLowerCase();

  if (carrier.includes('ไปรษณีย์ไทย') || host.includes('thailandpost.co.th')) {
    const url = new URL('https://track.thailandpost.co.th/');
    url.searchParams.set('trackNumber', number);
    return { url: url.href, prefilled: true };
  }

  return { url: safeUrl, prefilled: false };
}

export async function copyTrackingNumber(value) {
  const number = String(value || '').trim();
  if (!number) return false;

  try {
    await navigator.clipboard.writeText(number);
    return true;
  } catch {
    return false;
  }
}
