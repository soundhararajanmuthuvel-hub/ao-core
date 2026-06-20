import { useState, useEffect, useRef } from 'react';
import { crmApi, usersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Map as MapIcon, 
  Search, 
  Plus, 
  UserPlus, 
  Navigation, 
  Info, 
  Check, 
  Layers, 
  MapPin, 
  Smartphone,
  CheckSquare,
  Square
} from 'lucide-react';

const SUPPORTED_CATEGORIES = [
  'Organic Stores',
  'Supermarkets',
  'Department Stores',
  'Nattu Marundhu Kadai',
  'Health Food Stores',
  'Ayurvedic Shops',
  'Millet Stores',
  'Dry Fruit Shops',
  'Organic Farms'
];

export default function LeadFinder() {
  const { toast } = useToast();
  
  // Search parameters
  const [city, setCity] = useState('Madurai');
  const [district, setDistrict] = useState('Madurai');
  const [state, setState] = useState('Tamil Nadu');
  const [radius, setRadius] = useState(10);
  const [selectedCategories, setSelectedCategories] = useState(SUPPORTED_CATEGORIES);
  
  // API Results & States
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [importingId, setImportingId] = useState(null);
  const [isFallback, setIsFallback] = useState(false);
  const [salesmen, setSalesmen] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' or 'list'

  // Modals state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetShop, setAssignTargetShop] = useState(null);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  
  // Manual Lead Form State
  const [manualForm, setManualForm] = useState({
    shopName: '',
    category: 'Organic Stores',
    ownerName: '',
    mobileNumber: '',
    address: '',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pincode: '',
    latitude: '',
    longitude: ''
  });

  // Map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Fetch salesmen for manual assignment option
  useEffect(() => {
    usersApi.list({ role: 'Salesman' }).then(res => {
      // Also fetch Sales Executive if needed, or filter all Sales roles
      setSalesmen(res.data.users || []);
    }).catch(err => {
      console.error('Error fetching salesmen:', err);
    });
  }, []);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Centered in Tamil Nadu initially
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([9.9252, 78.1198], 12);
    mapRef.current = map;
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Event listener for clicks on custom button in Leaflet popup
    map.on('popupopen', (e) => {
      const container = e.popup._container;
      const btn = container.querySelector('.popup-import-btn');
      if (btn) {
        btn.onclick = () => {
          const shopIndex = btn.getAttribute('data-index');
          const shop = results[shopIndex];
          if (shop) {
            handleImport(shop);
            map.closePopup();
          }
        };
      }
    });
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, [results]); // Recreate or redraw markers when results array changes

  // Update map coordinates and draw markers
  const updateMapMarkers = (centerCoords, searchResults) => {
    if (!mapRef.current || !markersGroupRef.current) return;

    // Clear old layers
    markersGroupRef.current.clearLayers();

    // Center map on searched location
    if (centerCoords && centerCoords.latitude && centerCoords.longitude) {
      mapRef.current.setView([centerCoords.latitude, centerCoords.longitude], 12);
    }

    if (!searchResults || searchResults.length === 0) return;

    searchResults.forEach((shop, index) => {
      const markerColor = getMarkerColor(shop.category);
      const markerHtml = `
        <div style="
          background-color: ${markerColor}; 
          width: 14px; 
          height: 14px; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          position: relative;
        ">
          ${shop.isImported ? `
            <div style="
              position: absolute; 
              top: -6px; 
              right: -6px; 
              background: #10b981; 
              color: white; 
              font-size: 6px; 
              font-weight: bold; 
              width: 10px; 
              height: 10px; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              border: 1px solid white;
            ">✓</div>` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-lead-pin',
        html: markerHtml,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const popupHtml = `
        <div style="font-family: Inter, sans-serif; font-size: 0.85rem; min-width: 200px;">
          <strong style="font-size: 0.95rem; color: #5a2d0c; display: block; margin-bottom: 0.25rem;">${shop.shopName}</strong>
          <span style="display: block; color: #64748b; font-size: 0.75rem; margin-bottom: 0.5rem; font-weight: 600;">${shop.category}</span>
          <div style="margin-bottom: 0.4rem; color: #334155;">${shop.address}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.75rem;">Distance: ${shop.distanceFromCenter} KM</div>
          ${shop.isImported ? `
            <div style="background-color: #ecfdf5; color: #10b981; padding: 0.35rem; border-radius: 4px; text-align: center; font-weight: 700; border: 1px solid #a7f3d0;">
              ✓ Lead Created (${shop.leadStatus})
            </div>
          ` : `
            <button 
              type="button" 
              class="popup-import-btn" 
              data-index="${index}"
              style="
                width: 100%; 
                background-color: #5a2d0c; 
                color: #ffffff; 
                border: none; 
                padding: 0.4rem; 
                border-radius: 4px; 
                font-weight: 700; 
                cursor: pointer;
                text-align: center;
              "
            >
              ➕ Create Lead
            </button>
          `}
        </div>
      `;

      const marker = L.marker([shop.latitude, shop.longitude], { icon: customIcon })
        .bindPopup(popupHtml)
        .addTo(markersGroupRef.current);

      // Save reference to marker
      shop._marker = marker;
    });
  };

  const getMarkerColor = (category) => {
    switch (category) {
      case 'Organic Stores':
      case 'Organic Farms':
        return '#10b981'; // Green
      case 'Health Food Stores':
        return '#eab308'; // Yellow
      case 'Supermarkets':
      case 'Department Stores':
        return '#ef4444'; // Red
      case 'Ayurvedic Shops':
      case 'Nattu Marundhu Kadai':
        return '#3b82f6'; // Blue
      default:
        return '#5a2d0c'; // Neutral brand
    }
  };

  // Perform OSM query scan
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (selectedCategories.length === 0) {
      toast('Please select at least one business category to scan', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const res = await crmApi.findLeads({
        city,
        district,
        state,
        radius,
        categories: selectedCategories.join(',')
      });
      
      const payload = res.data;
      setResults(payload.results || []);
      setIsFallback(payload.isFallback || false);
      setSelectedShop(payload.results?.[0] || null);
      
      // Update interactive markers on the map
      updateMapMarkers(payload.center, payload.results);
      
      if (payload.results?.length > 0) {
        toast(`Found ${payload.results.length} leads in the scanning area!`, 'success');
      } else {
        toast('No retail records discovered in this boundary.', 'warning');
      }
    } catch (err) {
      console.error('Scan failed:', err);
      toast('Lead Finder Scan failed. Using localized fallbacks.', 'error');
      // Set empty results or rely on fallback triggers
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Pan to map marker
  const handleFocusOnMap = (shop) => {
    if (mapRef.current && shop.latitude && shop.longitude) {
      mapRef.current.setView([shop.latitude, shop.longitude], 14);
      if (shop._marker) {
        shop._marker.openPopup();
      }
      if (isMobile) {
        setMobileTab('map');
      }
    }
  };

  // Dynamic CRM lead creation from OSM profiles
  const handleImport = async (shop, targetSalesmanId = null) => {
    try {
      setImportingId(shop.shopName);
      
      const res = await crmApi.createLead({
        shopName: shop.shopName,
        category: shop.category,
        ownerName: shop.ownerName || '',
        mobileNumber: shop.mobileNumber || '',
        address: shop.address,
        city: shop.city || city,
        state: shop.state || state,
        pincode: shop.pincode || '',
        latitude: shop.latitude,
        longitude: shop.longitude,
        website: shop.website || '',
        source: shop.source || 'OpenStreetMap',
        assignedSalesmanId: targetSalesmanId, // Pass manual selection if provided
        status: targetSalesmanId ? 'Assigned' : 'New'
      });

      // Update local state results status without doing a full API scan
      setResults(prev => prev.map(item => {
        if (item.shopName === shop.shopName) {
          return {
            ...item,
            isImported: true,
            leadId: res.data.id,
            leadStatus: res.data.status
          };
        }
        return item;
      }));

      // Re-trigger marker updates to redraw with checklist overlays
      setTimeout(() => {
        const center = mapRef.current ? {
          latitude: mapRef.current.getCenter().lat,
          longitude: mapRef.current.getCenter().lng
        } : null;
        updateMapMarkers(center, results.map(item => {
          if (item.shopName === shop.shopName) {
            return { ...item, isImported: true, leadStatus: res.data.status };
          }
          return item;
        }));
      }, 100);

      toast(`Successfully imported "${shop.shopName}" into Leads database!`, 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Error creating CRM lead', 'error');
    } finally {
      setImportingId(null);
    }
  };

  // Open manual assignment popup
  const handleOpenAssign = (shop) => {
    setAssignTargetShop(shop);
    setSelectedSalesmanId(salesmen[0]?.id || '');
    setAssignModalOpen(true);
  };

  // Submit manual salesman assignment & lead creation
  const handleAssignSalesman = async () => {
    if (!selectedSalesmanId) {
      toast('Please select a salesman to assign', 'error');
      return;
    }
    setAssignModalOpen(false);
    await handleImport(assignTargetShop, selectedSalesmanId);
  };

  // Category checkbox handlers
  const handleCategoryToggle = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(SUPPORTED_CATEGORIES);
  };

  const handleDeselectAllCategories = () => {
    setSelectedCategories([]);
  };

  // Handle Manual Lead Ingestion Form
  const handleManualFormSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.shopName || !manualForm.address) {
      toast('Shop Name and Address are required', 'error');
      return;
    }

    try {
      setLoading(true);
      await crmApi.createLead({
        ...manualForm,
        source: 'Manual Ingestion',
        status: 'New'
      });
      setManualModalOpen(false);
      toast(`Successfully registered lead "${manualForm.shopName}"`, 'success');
      
      // Clean form
      setManualForm({
        shopName: '',
        category: 'Organic Stores',
        ownerName: '',
        mobileNumber: '',
        address: '',
        city: city,
        state: state,
        pincode: '',
        latitude: '',
        longitude: ''
      });

      // Refresh list if desired or add to current list
      handleSearch();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create lead', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
            🔍 Smart Lead Finder
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Query OpenStreetMap directories to instantly locate retail prospects, and import them with auto-assigned territories.
          </p>
        </div>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => setManualModalOpen(true)}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#5a2d0c', borderColor: '#5a2d0c' }}
        >
          <Plus size={16} /> Create Lead Manually
        </button>
      </div>

      {/* Control panel / Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Location row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>City</label>
              <input type="text" className="form-control" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Madurai" required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>District</label>
              <input type="text" className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Madurai" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>State</label>
              <input type="text" className="form-control" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Tamil Nadu" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>Radius Coverage</label>
              <select className="form-control" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                <option value={5}>5 KM</option>
                <option value={10}>10 KM</option>
                <option value={25}>25 KM</option>
                <option value={50}>50 KM</option>
              </select>
            </div>
          </div>

          {/* Category checklist */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={14} /> Supported Retail Categories
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAllCategories} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Select All</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAllCategories} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>Clear All</button>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {SUPPORTED_CATEGORIES.map(cat => {
                const isChecked = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryToggle(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isChecked ? 'rgba(90, 45, 12, 0.3)' : 'var(--border)',
                      backgroundColor: isChecked ? 'rgba(90, 45, 12, 0.05)' : 'transparent',
                      color: isChecked ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      fontWeight: isChecked ? 700 : 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isChecked ? <CheckSquare size={14} color="var(--brand-primary)" /> : <Square size={14} />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Trigger */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#5a2d0c', borderColor: '#5a2d0c', padding: '0.6rem 2rem', fontWeight: 700 }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  Scanning OSM Directories...
                </>
              ) : (
                <>
                  <Search size={18} /> Find Leads
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Tab Swapper */}
      {isMobile && (
        <div style={{ display: 'flex', marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <button 
            type="button" 
            style={{ flex: 1, padding: '0.75rem', border: 'none', background: mobileTab === 'map' ? 'rgba(90, 45, 12, 0.1)' : '#fff', color: mobileTab === 'map' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 700 }}
            onClick={() => setMobileTab('map')}
          >
            📍 Radar Map View
          </button>
          <button 
            type="button" 
            style={{ flex: 1, padding: '0.75rem', border: 'none', background: mobileTab === 'list' ? 'rgba(90, 45, 12, 0.1)' : '#fff', color: mobileTab === 'list' ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 700 }}
            onClick={() => setMobileTab('list')}
          >
            📋 Directory List ({results.length})
          </button>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div 
        style={{ 
          display: isMobile ? 'block' : 'grid', 
          gridTemplateColumns: '1.3fr 1fr', 
          gap: '1.5rem', 
          minHeight: '550px' 
        }} 
      >
        {/* Radar Map container */}
        <div 
          className="card" 
          style={{ 
            display: (isMobile && mobileTab !== 'map') ? 'none' : 'flex', 
            flexDirection: 'column', 
            padding: 0, 
            overflow: 'hidden', 
            border: '1px solid var(--border)', 
            position: 'relative',
            height: isMobile ? '400px' : 'auto'
          }}
        >
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-page)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={14} color="var(--brand-primary)" /> Radar Coverage Map: {city}
            </span>
            {isFallback && (
              <span style={{ fontSize: '0.75rem', background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid #ffedd5' }}>
                ⚠️ API Offline / Offline Fallback Mode
              </span>
            )}
          </div>

          <div ref={mapContainerRef} style={{ flex: 1, width: '100%', height: '100%', zIndex: 1 }} />
        </div>

        {/* Directory Panel & Empty States */}
        <div 
          style={{ 
            display: (isMobile && mobileTab !== 'list') ? 'none' : 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem' 
          }}
        >
          {/* Results list card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', maxHeight: isMobile ? '500px' : '400px', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem 0', color: 'var(--text-primary)' }}>
              Retail Directory Matches ({results.length})
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
              {results.length === 0 ? (
                <div style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', gap: '0.5rem' }}>
                  <Info size={24} style={{ opacity: 0.5 }} />
                  <span style={{ fontSize: '0.85rem' }}>
                    {loading ? 'Scanning databases...' : 'No retail records found in this area.'}
                  </span>
                  {!loading && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setManualModalOpen(true)} style={{ marginTop: '0.5rem' }}>
                      ➕ Create Lead Manually
                    </button>
                  )}
                </div>
              ) : (
                results.map((shop) => {
                  const isSelected = selectedShop && selectedShop.shopName === shop.shopName;
                  return (
                    <div
                      key={shop.shopName}
                      onClick={() => setSelectedShop(shop)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(90, 45, 12, 0.06)' : 'var(--bg-page)',
                        border: isSelected ? '1px solid rgba(90, 45, 12, 0.25)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shop.shopName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📍 {shop.address}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFocusOnMap(shop);
                          }}
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                          title="Focus Pin"
                        >
                          <MapPin size={10} /> Map
                        </button>
                        
                        {shop.isImported ? (
                          <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 8px', borderRadius: '12px', fontWeight: 800, border: '1px solid #a7f3d0' }}>
                            <Check size={10} /> {shop.leadStatus || 'Imported'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImport(shop);
                              }}
                              disabled={importingId === shop.shopName}
                              style={{ padding: '3px 8px', fontSize: '0.75rem', backgroundColor: '#5a2d0c', borderColor: '#5a2d0c' }}
                            >
                              ➕ Import
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssign(shop);
                              }}
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            >
                              👤 Assign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Retailer detailed profile preview card */}
          {selectedShop ? (
            <div className="card" style={{ borderTop: '4px solid var(--brand-primary)', backgroundColor: '#fff', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem' }}>{selectedShop.shopName}</h3>
                  <span className="badge badge-success" style={{ marginTop: '0.25rem', background: 'rgba(90, 45, 12, 0.08)', color: 'var(--brand-primary)' }}>
                    {selectedShop.category}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Distance: {selectedShop.distanceFromCenter} KM
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Owner / Operator</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedShop.ownerName || 'Unknown'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Contact Phone</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedShop.mobileNumber || '—'}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Registry Directory Source</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedShop.source}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Website URL</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedShop.website ? (
                      <a href={selectedShop.website.startsWith('http') ? selectedShop.website : `http://${selectedShop.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>
                        {selectedShop.website}
                      </a>
                    ) : '—'}
                  </strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>GPS Position Nodes</span>
                  <code style={{ background: 'var(--bg-page)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    Lat: {selectedShop.latitude}, Lng: {selectedShop.longitude}
                  </code>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontWeight: 600 }}>Physical Address</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {selectedShop.address}, {selectedShop.city}, {selectedShop.pincode || ''}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {selectedShop.isImported ? (
                  <button className="btn btn-secondary" disabled style={{ width: '100%', cursor: 'not-allowed', color: 'var(--text-muted)' }}>
                    <Check size={16} /> Lead Already Created ({selectedShop.leadStatus})
                  </button>
                ) : (
                  <div style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleImport(selectedShop)}
                      disabled={importingId === selectedShop.shopName}
                      style={{ flex: 2, display: 'flex', gap: '0.5rem', justifyContent: 'center', backgroundColor: '#5a2d0c', borderColor: '#5a2d0c' }}
                    >
                      {importingId === selectedShop.shopName ? (
                        <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                      ) : (
                        <>Create CRM Lead</>
                      )}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenAssign(selectedShop)}
                      style={{ flex: 1, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                    >
                      👤 Assign Salesman
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '12px', padding: '2rem' }}>
              <Info size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.7 }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Select a coordinate pin on the radar map or results list to preview the retail shop profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Lead Manually */}
      {manualModalOpen && (
        <Modal 
          title="➕ Ingest Retailer Lead Manually" 
          onClose={() => setManualModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setManualModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleManualFormSubmit} style={{ backgroundColor: '#5a2d0c', borderColor: '#5a2d0c' }}>Save Lead</button>
            </>
          }
        >
          <form onSubmit={handleManualFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1fr' }} className="form-row">
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Shop Name *</label>
                <input 
                  className="form-control" 
                  value={manualForm.shopName} 
                  onChange={(e) => setManualForm({ ...manualForm, shopName: e.target.value })} 
                  placeholder="e.g. Balaji Organic Stores" 
                  required 
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Retail Category</label>
                <select 
                  className="form-control" 
                  value={manualForm.category} 
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                >
                  {SUPPORTED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1fr' }} className="form-row">
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Owner / Manager Name</label>
                <input 
                  className="form-control" 
                  value={manualForm.ownerName} 
                  onChange={(e) => setManualForm({ ...manualForm, ownerName: e.target.value })} 
                  placeholder="e.g. Ramesh Babu" 
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Mobile Number</label>
                <input 
                  className="form-control" 
                  value={manualForm.mobileNumber} 
                  onChange={(e) => setManualForm({ ...manualForm, mobileNumber: e.target.value })} 
                  placeholder="e.g. 9876543210" 
                />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>Physical Address *</label>
              <textarea 
                className="form-control" 
                rows="2"
                value={manualForm.address} 
                onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })} 
                placeholder="Door number, street name, suburb area..." 
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }} className="form-row">
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>City</label>
                <input 
                  className="form-control" 
                  value={manualForm.city} 
                  onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>State</label>
                <input 
                  className="form-control" 
                  value={manualForm.state} 
                  onChange={(e) => setManualForm({ ...manualForm, state: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Pincode</label>
                <input 
                  className="form-control" 
                  value={manualForm.pincode} 
                  onChange={(e) => setManualForm({ ...manualForm, pincode: e.target.value })} 
                  placeholder="e.g. 625020"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1fr' }} className="form-row">
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Latitude (GPS)</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  className="form-control" 
                  value={manualForm.latitude} 
                  onChange={(e) => setManualForm({ ...manualForm, latitude: e.target.value })} 
                  placeholder="Optional (will geocode)" 
                />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Longitude (GPS)</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  className="form-control" 
                  value={manualForm.longitude} 
                  onChange={(e) => setManualForm({ ...manualForm, longitude: e.target.value })} 
                  placeholder="Optional (will geocode)" 
                />
              </div>
            </div>
            <small style={{ color: 'var(--text-secondary)' }}>
              💡 If GPS Coordinates are left blank, territory service will geocode the address automatically.
            </small>
          </form>
        </Modal>
      )}

      {/* Modal: Manual Salesman Assignment */}
      {assignModalOpen && (
        <Modal
          title="👤 Assign Salesman to Lead"
          onClose={() => setAssignModalOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setAssignModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAssignSalesman} style={{ backgroundColor: '#5a2d0c', borderColor: '#5a2d0c' }}>Confirm Assignment</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Select a field salesman to allocate responsibility for <strong>{assignTargetShop?.shopName}</strong>. 
              The lead status will update to <strong>Assigned</strong>.
            </p>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'block' }}>Choose Field Salesman</label>
              <select 
                className="form-control"
                value={selectedSalesmanId}
                onChange={(e) => setSelectedSalesmanId(e.target.value)}
              >
                {salesmen.length === 0 ? (
                  <option value="">No salesmen registered in system</option>
                ) : (
                  salesmen.map(s => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name} ({s.email})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
