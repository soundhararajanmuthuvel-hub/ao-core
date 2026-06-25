const getRawApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL?.trim();
  const isProductionHost = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';

  if (isProductionHost) {
    // In production hosts, NEVER connect to localhost/127.0.0.1
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/$/, '');
    }
    // Default to relative path in production for proxied/same-origin setups
    return '';
  } else {
    // In local development, use VITE_API_URL or default to localhost:5000
    return envUrl || 'http://localhost:5000';
  }
};

const rawApiUrl = getRawApiUrl();

export const API_ORIGIN = rawApiUrl ? rawApiUrl.replace(/\/api$/, '') : '';

export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.endsWith('/api')
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : '/api';

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return '';

  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  if (
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('//') ||
    assetPath.startsWith('data:') ||
    assetPath.startsWith('blob:')
  ) {
    return assetPath;
  }

  if (API_ORIGIN && normalizedPath.startsWith('/uploads')) {
    return `${API_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
};

export const getActiveLogoUrl = (settings) => {
  return `${API_BASE_URL}/assets/company-logo`;
};
