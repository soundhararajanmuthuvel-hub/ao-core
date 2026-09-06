import { createContext, useContext, useState } from 'react';

const ModuleContext = createContext();

export function ModuleProvider({ children }) {
  const [activeModule] = useState('management');

  const switchModule = () => {};

  return (
    <ModuleContext.Provider value={{ activeModule: 'management', switchModule, isWebsite: false }}>
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
