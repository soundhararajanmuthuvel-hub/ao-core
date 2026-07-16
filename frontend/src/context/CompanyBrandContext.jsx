import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSettings } from './SettingsContext';
import client from '../api/client';

const CompanyBrandContext = createContext(null);

export function CompanyBrandProvider({ children }) {
  const { settings } = useSettings();
  const [brand, setBrand] = useState({
    companyName: 'Amudhasurabiy Organics',
    logoUrl: '/assets/default-company-logo.png',
    favicon: '/favicon.png',
    themeColor: '#5A2D0C',
    website: '',
    email: '',
    phone: '',
    address: '',
  });

  const refreshBrand = useCallback(async () => {
    try {
      const { data } = await client.get('/company/brand');
      
      let resolvedLogo = '/assets/default-company-logo.png';
      if (data.logo) {
        resolvedLogo = data.logo;
        if (!resolvedLogo.startsWith('http') && !resolvedLogo.startsWith('data:') && !resolvedLogo.startsWith('blob:')) {
          const origin = client.defaults.baseURL ? client.defaults.baseURL.replace(/\/api$/, '') : window.location.origin;
          resolvedLogo = `${origin}${resolvedLogo.startsWith('/') ? '' : '/'}${resolvedLogo}`;
        }
      }

      const brandData = {
        companyName: data.companyName || 'Amudhasurabiy Organics',
        logoUrl: resolvedLogo,
        favicon: data.favicon || '/favicon.png',
        themeColor: data.themeColor || '#5A2D0C',
        website: data.website || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
      };

      setBrand(brandData);

      // Save to localStorage cache for instant load
      localStorage.setItem('cached_brand_data', JSON.stringify(brandData));

      // Attempt to load and cache logo in service worker CacheStorage if available
      if (resolvedLogo && 'caches' in window) {
        try {
          const cache = await caches.open('ao-core-brand-cache');
          await cache.add(resolvedLogo);
        } catch (e) {
          console.warn('[Branding] SW caching omitted for logo:', e.message);
        }
      }
    } catch (err) {
      console.error('[CompanyBrand] Failed to refresh brand data:', err);
    }
  }, []);

  // Sync state with settings updates and localStorage
  useEffect(() => {
    const cached = localStorage.getItem('cached_brand_data');
    let hasCache = false;
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setBrand({
          companyName: data.companyName || 'Amudhasurabiy Organics',
          logoUrl: data.logoUrl || '/assets/default-company-logo.png',
          favicon: data.favicon || '/favicon.png',
          themeColor: data.themeColor || '#5A2D0C',
          website: data.website || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
        });
        hasCache = true;
      } catch (e) {
        console.error('[CompanyBrand] Failed to load cached brand:', e);
      }
    }

    if (!hasCache) {
      refreshBrand();
    }
  }, [refreshBrand]);

  return (
    <CompanyBrandContext.Provider value={{ ...brand, refreshBrand }}>
      {children}
    </CompanyBrandContext.Provider>
  );
}

export const useCompanyBrand = () => useContext(CompanyBrandContext);
