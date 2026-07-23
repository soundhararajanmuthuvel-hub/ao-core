import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ModuleContext = createContext();

export function ModuleProvider({ children }) {
  const location = useLocation();
  const [activeModule, setActiveModuleState] = useState(() => {
    return localStorage.getItem('active_erp_module') || 'management';
  });

  const switchModule = (moduleName) => {
    setActiveModuleState(moduleName);
    localStorage.setItem('active_erp_module', moduleName);
  };

  // Sync active module when route changes
  useEffect(() => {
    if (location.pathname.startsWith('/website')) {
      if (activeModule !== 'website') {
        setActiveModuleState('website');
        localStorage.setItem('active_erp_module', 'website');
      }
    }
  }, [location.pathname]);

  return (
    <ModuleContext.Provider value={{ activeModule, switchModule, isWebsite: activeModule === 'website' }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
}
