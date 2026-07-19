import { useState, useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';
import { useCompanyBrand } from './context/CompanyBrandContext';
import './Splash.css';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { logoUrl, companyName } = useCompanyBrand();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-logo-container animate-scale-up">
          <div className="splash-logo-outer">
            <div className="splash-logo-inner">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="splash-logo-img" />
              ) : (
                <span className="splash-logo-icon">⚜️</span>
              )}
            </div>
          </div>
          <h1 className="splash-brand-title">{companyName ? companyName.toUpperCase() : 'AO AURUM'}</h1>
          <p className="splash-brand-subtitle">MANAGE BLOVIT MALTS</p>
          <div className="splash-loader-bar">
            <div className="splash-loader-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  return <AppRoutes />;
}
