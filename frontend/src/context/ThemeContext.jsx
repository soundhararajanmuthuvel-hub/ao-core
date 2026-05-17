import { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { settings } = useSettings();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return false;
  });

  useEffect(() => {
    if (settings && localStorage.getItem('darkMode') === null) {
      setDarkMode(settings.defaultDarkMode || false);
    }
  }, [settings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((d) => !d);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
