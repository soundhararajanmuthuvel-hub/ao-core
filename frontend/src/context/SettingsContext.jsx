import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsApi } from '../api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await settingsApi.get();
      setSettings(data.settings);
      if (data.settings?.brandColor) {
        document.documentElement.style.setProperty('--brand-primary', data.settings.brandColor);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (payload) => {
    const { data } = await settingsApi.update(payload);
    setSettings(data.settings);
    if (data.settings?.brandColor) {
      document.documentElement.style.setProperty('--brand-primary', data.settings.brandColor);
    }
    return data.settings;
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, loadSettings, updateSettings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
