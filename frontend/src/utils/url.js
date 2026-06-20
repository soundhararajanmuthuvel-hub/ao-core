const rawApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';

export const API_ORIGIN = rawApiUrl.replace(/\/api$/, '');

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
  if (!settings) return '/favicon.png';
  if (settings.logo) {
    return resolveAssetUrl(settings.logo);
  }
  if (settings.logoUrl) {
    return resolveAssetUrl(settings.logoUrl);
  }
  return '/favicon.png';
};
