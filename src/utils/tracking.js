const TRACKING_PROVIDERS = [
  {
    key: 'thailand-post',
    name: 'ไปรษณีย์ไทย (Thailand Post)',
    url: 'https://track.thailandpost.co.th/',
    aliases: [
      'ไปรษณีย์ไทย',
      'ไปรษณีย์ไทย (Thailand Post)',
      'Thailand Post',
      'ThailandPost',
    ],
  },
  {
    key: 'kex',
    name: 'KEX Express (Kerry)',
    url: 'https://th.kex-express.com/th/track-parcel',
    aliases: [
      'KEX',
      'KEX Express',
      'KEX Express (Kerry)',
      'Kerry',
      'Kerry Express',
      'เคอรี่',
      'เคอรี่ เอ็กซ์เพรส',
    ],
  },
  {
    key: 'flash',
    name: 'Flash Express',
    url: 'https://www.flashexpress.co.th/fle/tracking',
    aliases: [
      'Flash',
      'Flash Express',
      'แฟลช',
      'แฟลช เอ็กซ์เพรส',
      'แฟลชเอ็กซ์เพรส',
    ],
  },
  {
    key: 'j-and-t',
    name: 'J&T Express',
    url: 'https://www.jtexpress.co.th/service/track',
    aliases: [
      'J&T',
      'J&T Express',
      'J & T',
      'J & T Express',
      'J and T',
      'J and T Express',
      'เจแอนด์ที',
      'เจแอนด์ที เอ็กซ์เพรส',
    ],
  },
  {
    key: 'best',
    name: 'BEST Express',
    url: 'https://www.best-inc.co.th/',
    aliases: [
      'BEST',
      'BEST Express',
      'BEST Inc',
      'เบสท์',
      'เบสท์ เอ็กซ์เพรส',
    ],
  },
  {
    key: 'scg',
    name: 'SCG Express',
    url: 'https://www.scgexpress.co.th/tracking/',
    aliases: [
      'SCG',
      'SCG Express',
      'เอสซีจี',
      'เอสซีจี เอ็กซ์เพรส',
    ],
  },
]

const ALLOWED_TRACKING_URLS = new Set(
  TRACKING_PROVIDERS.map((provider) => provider.url),
)

function normalizeProviderName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const PROVIDER_BY_ALIAS = new Map(
  TRACKING_PROVIDERS.flatMap((provider) => (
    provider.aliases.map((alias) => [normalizeProviderName(alias), provider])
  )),
)

export function resolveTrackingProvider(providerName) {
  const normalizedInput = String(providerName ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
  const provider = PROVIDER_BY_ALIAS.get(normalizeProviderName(normalizedInput))

  if (!provider) {
    return {
      key: 'generic',
      name: normalizedInput || 'บริษัทขนส่ง',
      url: '',
      known: false,
    }
  }

  return {
    key: provider.key,
    name: provider.name,
    url: provider.url,
    known: true,
  }
}

export function getSafeTrackingUrl(value) {
  let candidate

  try {
    candidate = String(value ?? '').trim()
  } catch {
    return ''
  }

  if (!ALLOWED_TRACKING_URLS.has(candidate)) return ''

  try {
    const url = new URL(candidate)
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.search
      || url.hash
      || url.href !== candidate
    ) {
      return ''
    }

    return candidate
  } catch {
    return ''
  }
}

export function buildTrackingLink({ trackingUrl, carrierName } = {}) {
  const provider = resolveTrackingProvider(carrierName)

  return {
    url: provider.known ? provider.url : getSafeTrackingUrl(trackingUrl),
    prefilled: false,
  }
}

export async function copyTrackingNumber(value) {
  let number

  try {
    number = String(value ?? '').trim()
  } catch {
    return false
  }

  if (
    !number
    || typeof navigator === 'undefined'
    || !navigator.clipboard
    || typeof navigator.clipboard.writeText !== 'function'
  ) {
    return false
  }

  try {
    await navigator.clipboard.writeText(number)
    return true
  } catch {
    return false
  }
}