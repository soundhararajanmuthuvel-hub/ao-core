import { useState } from 'react';
import { crmApi } from '../api';
import { Map, Search, Import, Check, AlertCircle, Navigation, Info, ExternalLink } from 'lucide-react';

export default function LeadFinder() {
  const [category, setCategory] = useState('Organic Stores');
  const [city, setCity] = useState('Madurai');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [importingId, setImportingId] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const res = await crmApi.findLeads({ category, city });
      setResults(res.data);
      setSelectedShop(res.data[0] || null);
    } catch (err) {
      console.error('Error finding leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (shop) => {
    try {
      setImportingId(shop.shopName);
      await crmApi.createLead({
        shopName: shop.shopName,
        category: shop.category,
        ownerName: shop.ownerName,
        mobileNumber: shop.mobileNumber,
        address: shop.address,
        city: shop.city,
        state: shop.state,
        pincode: shop.pincode,
        latitude: shop.latitude,
        longitude: shop.longitude,
        website: shop.website,
        source: shop.source,
        status: 'New'
      });
      // Refresh results to update imported state
      const res = await crmApi.findLeads({ category, city });
      setResults(res.data);
      const updated = res.data.find(r => r.shopName === shop.shopName);
      if (updated) setSelectedShop(updated);
      alert(`${shop.shopName} successfully imported into CRM Leads!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error importing lead');
    } finally {
      setImportingId(null);
    }
  };

  // Build grid positions for mock map pins based on latitude/longitude bounds
  const getMapCoordinates = (lat, lng) => {
    // Madurai bounds: lat ~9.90 to 9.94, lng ~78.10 to 78.13
    // Map bounds to percentage values (0 - 100)
    let minLat = 9.90, maxLat = 9.94;
    let minLng = 78.10, maxLng = 78.13;
    
    if (city === 'Trichy') {
      minLat = 10.78; maxLat = 10.88;
      minLng = 78.67; maxLng = 78.71;
    } else if (city === 'Chennai') {
      minLat = 13.00; maxLat = 13.05;
      minLng = 80.22; maxLng = 80.27;
    } else if (city === 'Coimbatore') {
      minLat = 11.00; maxLat = 11.04;
      minLng = 76.94; maxLng = 77.01;
    }

    const latPercent = ((lat - minLat) / (maxLat - minLat)) * 80 + 10;
    const lngPercent = ((lng - minLng) / (maxLng - minLng)) * 80 + 10;
    return { top: `${100 - latPercent}%`, left: `${lngPercent}%` };
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>CRM Lead Finder</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Search external Tamil Nadu business registers to import new prospects with a single click.</p>
      </div>

      {/* Control panel */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label style={{ fontWeight: 600 }}>Business Category</label>
            <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Organic Stores">Organic Stores</option>
              <option value="Millet Stores">Millet Stores</option>
              <option value="Ayurvedic Shops">Ayurvedic Shops</option>
              <option value="Supermarkets">Supermarkets</option>
              <option value="Nattu Marundhu Kadai">Nattu Marundhu Kadai</option>
              <option value="Dry Fruit Shops">Dry Fruit Shops</option>
              <option value="Health Food Stores">Health Food Stores</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label style={{ fontWeight: 600 }}>Target City (Tamil Nadu)</label>
            <select className="form-control" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="Madurai">Madurai</option>
              <option value="Trichy">Trichy</option>
              <option value="Chennai">Chennai</option>
              <option value="Coimbatore">Coimbatore</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Search size={16} /> Scan Retail Registry
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', minHeight: '520px' }} className="form-row">
        {/* Interactive Grid Map */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: '#090d16', border: '1px solid #1e293b', position: 'relative' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #1e293b', background: '#0b1329', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={14} color="#f59e0b" /> Radar Scan Coverage: {city}, TN
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Interactive Grid Coordinate Nodes</span>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundImage: 'radial-gradient(rgba(245, 158, 11, 0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            {/* Compass rose or city watermark */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, fontSize: '6rem', fontWeight: 900, color: '#fff', pointerEvents: 'none', letterSpacing: '5px' }}>
              {city.toUpperCase()}
            </div>

            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: 'rgba(9, 13, 22, 0.6)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div className="spinner" style={{ borderTopColor: '#f59e0b' }}></div>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Scanning satellite directories...</span>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', padding: '2rem', textAlign: 'center' }}>
                <Map size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                <h4>No Retail Records Found</h4>
                <p style={{ fontSize: '0.8rem', maxWidth: '300px' }}>Select a segment and click Scan to locate stores in your target territory.</p>
              </div>
            ) : (
              results.map((shop) => {
                const pos = getMapCoordinates(shop.latitude, shop.longitude);
                const isSelected = selectedShop && selectedShop.shopName === shop.shopName;
                
                return (
                  <button
                    key={shop.shopName}
                    type="button"
                    onClick={() => setSelectedShop(shop)}
                    style={{
                      position: 'absolute',
                      top: pos.top,
                      left: pos.left,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isSelected ? 30 : 20,
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Glowing pulse ring if selected */}
                    {isSelected && (
                      <div className="pulse-ring" style={{
                        position: 'absolute',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: '2px solid #f59e0b',
                        boxShadow: '0 0 10px #f59e0b',
                        top: '-10px',
                        left: '-10px',
                        animation: 'spin 1.5s infinite linear'
                      }}></div>
                    )}
                    <div style={{
                      width: isSelected ? '14px' : '10px',
                      height: isSelected ? '14px' : '10px',
                      borderRadius: '50%',
                      background: shop.isImported ? '#10b981' : '#f59e0b',
                      boxShadow: shop.isImported ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
                      border: '2px solid #090d16',
                      transition: 'all 0.2s'
                    }} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Search Results Details Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Results List */}
          <div className="card" style={{ flex: 1, maxHeight: '300px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>Retail Directory Matches</h3>
            {results.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No results loaded.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.map((shop) => {
                  const isSelected = selectedShop && selectedShop.shopName === shop.shopName;
                  return (
                    <div
                      key={shop.shopName}
                      onClick={() => setSelectedShop(shop)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        background: isSelected ? 'rgba(90, 45, 12, 0.08)' : 'var(--bg-page)',
                        border: isSelected ? '1px solid rgba(90, 45, 12, 0.2)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>{shop.shopName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{shop.address.split(',')[0]}</div>
                      </div>
                      {shop.isImported ? (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                          <Check size={10} /> Imported
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Found</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Shop detail & Import button */}
          {selectedShop ? (
            <div className="card" style={{ flex: 1, borderTop: '4px solid var(--brand-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 800 }}>{selectedShop.shopName}</h3>
                  <span className="badge badge-success" style={{ marginTop: '0.25rem', background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>{selectedShop.category}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Owner / Manager</span>
                  <strong>{selectedShop.ownerName || 'Unknown'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Mobile Number</span>
                  <strong>{selectedShop.mobileNumber || '—'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Registry Source</span>
                  <strong>{selectedShop.source}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Website URL</span>
                  <strong>
                    {selectedShop.website ? (
                      <a href={`http://${selectedShop.website}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--brand-primary)', textDecoration: 'none' }}>
                        {selectedShop.website} <ExternalLink size={12} />
                      </a>
                    ) : '—'}
                  </strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Full Address</span>
                  <strong>{selectedShop.address}, {selectedShop.city}, {selectedShop.pincode}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {selectedShop.isImported ? (
                  <button className="btn btn-secondary" disabled style={{ width: '100%', cursor: 'not-allowed', color: 'var(--text-muted)' }}>
                    <Check size={16} /> Lead Already Imported
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleImport(selectedShop)}
                    disabled={importingId === selectedShop.shopName}
                    style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                  >
                    {importingId === selectedShop.shopName ? (
                      <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    ) : (
                      <>
                        <Import size={16} /> Import Retailer to Lead Database
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Select a node on the radar coordinate map or results list to preview store profile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
