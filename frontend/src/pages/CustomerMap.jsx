import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { customersApi, sfaApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Plus, 
  X, 
  Calendar, 
  AlertCircle, 
  Check, 
  TrendingUp, 
  Phone,
  DollarSign
} from 'lucide-react';
import '../styles/customermap.css';

export default function CustomerMap() {
  const { user } = useAuth();
  
  // Data State
  const [customers, setCustomers] = useState([]);
  const [todayRoute, setTodayRoute] = useState(null);
  const [routeCustomers, setRouteCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTiers, setSelectedTiers] = useState({ GREEN: true, YELLOW: true, RED: true });
  const [selectedTerritory, setSelectedTerritory] = useState('ALL');
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'route'

  // Visit Dialog State
  const [visitDialogCustomer, setVisitDialogCustomer] = useState(null);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Map Refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Load Customers and Today's Beat Route
  const loadData = async () => {
    try {
      setLoading(true);
      const [customersRes, routesRes] = await Promise.all([
        customersApi.list({ limit: 500 }),
        sfaApi.getRoutes({ date: new Date().toISOString().split('T')[0] })
      ]);

      const allCustomers = customersRes.data.customers || [];
      setCustomers(allCustomers);

      // Resolve today's route for logged-in user
      if (user && routesRes.data) {
        const myRoute = routesRes.data.find(r => r.salesmanId === user.id || r.salesman?.id === user.id);
        if (myRoute) {
          setTodayRoute(myRoute);
          const seqMap = {};
          myRoute.customerSequence.forEach((id, idx) => {
            seqMap[id] = idx;
          });
          const sortedRouteCusts = allCustomers
            .filter(c => myRoute.customerSequence.includes(c.id))
            .sort((a, b) => seqMap[a.id] - seqMap[b.id]);
          setRouteCustomers(sortedRouteCusts);
        } else {
          setTodayRoute(null);
          setRouteCustomers([]);
        }
      }
    } catch (err) {
      console.error('Error loading map data:', err);
      showToast('Error loading customer mapping data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Extract territories dynamically from customer list
  const territories = ['ALL', ...new Set(customers.map(c => c.territory).filter(Boolean))];

  // Helper to show temporary feedback notifications
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter Logic
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.businessName && c.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTier = selectedTiers[c.tier || 'RED'];
    const matchesTerritory = selectedTerritory === 'ALL' || c.territory === selectedTerritory;
    return matchesSearch && matchesTier && matchesTerritory;
  });

  // Calculate Average Coordinates for Map Center
  const getMapCenter = () => {
    const validCoords = filteredCustomers.filter(c => c.latitude !== null && c.longitude !== null);
    if (validCoords.length > 0) {
      const sumLat = validCoords.reduce((sum, c) => sum + Number(c.latitude), 0);
      const sumLng = validCoords.reduce((sum, c) => sum + Number(c.longitude), 0);
      return [sumLat / validCoords.length, sumLng / validCoords.length];
    }
    return [11.0168, 76.9558]; // Default Coimbatore coordinates
  };

  // Leaflet Map Initialization and Marker Rendering
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    // Center map initially
    const center = getMapCenter();
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 12);
    mapRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);

    // Dynamic Leaflet popup event mapping for Custom Add Visit actions
    map.on('popupopen', (e) => {
      const container = e.popup._container;
      const visitBtn = container.querySelector('.popup-visit-btn');
      if (visitBtn) {
        visitBtn.onclick = () => {
          const customerId = visitBtn.getAttribute('data-customer-id');
          const matchedCust = customers.find(c => c.id === Number(customerId));
          if (matchedCust) {
            setVisitDialogCustomer(matchedCust);
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
  }, [loading]);

  // Update Markers when filters change
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    const validCustomers = filteredCustomers.filter(c => c.latitude !== null && c.longitude !== null);

    validCustomers.forEach(c => {
      const color = c.tier === 'GREEN' ? '#10b981' : c.tier === 'YELLOW' ? '#f59e0b' : '#ef4444';
      const iconHtml = `
        <div style="
          background-color: ${color}; 
          width: 18px; 
          height: 18px; 
          border: 2px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 6px; height: 6px; background-color: #ffffff; border-radius: 50%;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: iconHtml,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const formattedDate = c.lastOrderDate 
        ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'N/A';

      const outstandingFormatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
      }).format(c.balance || 0);

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-title">${c.name}</div>
          <div class="popup-shop">${c.businessName || 'No Shop Name'}</div>
          
          <table class="popup-details-table">
            <tr>
              <td class="label">Mobile</td>
              <td class="val">${c.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Outstanding</td>
              <td class="val" style="color: ${c.balance > 0 ? '#ef4444' : '#0f172a'};">${outstandingFormatted}</td>
            </tr>
            <tr>
              <td class="label">Last Order</td>
              <td class="val">${formattedDate}</td>
            </tr>
          </table>

          <div class="popup-actions">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="popup-btn nav">
              <span style="font-size: 11px;">✈</span> Navigate
            </a>
            <button class="popup-btn visit popup-visit-btn" data-customer-id="${c.id}">
              Add Visit
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon: customIcon })
        .bindPopup(popupHtml);
      
      markersGroupRef.current.addLayer(marker);
    });

    // Auto-pan / Auto-zoom to fit markers if list is filtered and markers exist
    if (validCustomers.length > 0) {
      const bounds = L.latLngBounds(validCustomers.map(c => [Number(c.latitude), Number(c.longitude)]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [filteredCustomers]);

  // Center Map on a specific customer selection
  const handleSelectCustomer = (c) => {
    if (c.latitude !== null && c.longitude !== null && mapRef.current) {
      mapRef.current.setView([Number(c.latitude), Number(c.longitude)], 15);
      
      // Find matching marker in group to trigger popup
      markersGroupRef.current.eachLayer(layer => {
        if (layer.getLatLng().lat === Number(c.latitude) && layer.getLatLng().lng === Number(c.longitude)) {
          layer.openPopup();
        }
      });

      // On mobile, scroll to map
      if (window.innerWidth <= 768) {
        document.querySelector('.map-canvas-container').scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      showToast('This customer does not have valid coordinates saved.', 'error');
    }
  };

  // Generate Google Maps multi-stop URL for Today's Planned Visits
  const getGoogleMapsRouteUrl = () => {
    const validCoords = routeCustomers.filter(c => c.latitude !== null && c.longitude !== null);
    if (validCoords.length === 0) return '#';

    // Start coordinates (Coimbatore base/warehouse or first customer)
    const origin = `${validCoords[0].latitude},${validCoords[0].longitude}`;
    const destination = `${validCoords[validCoords.length - 1].latitude},${validCoords[validCoords.length - 1].longitude}`;
    
    let waypoints = '';
    if (validCoords.length > 2) {
      waypoints = validCoords.slice(1, -1).map(c => `${c.latitude},${c.longitude}`).join('%7C');
    }

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    return url;
  };

  // Submit Manual Visit check-in
  const handleSaveVisit = async (e) => {
    e.preventDefault();
    if (!visitDialogCustomer) return;

    setSubmittingVisit(true);
    try {
      await sfaApi.logManualVisit({
        customerId: visitDialogCustomer.id,
        visitDate: new Date(visitDate),
        notes: visitNotes
      });
      
      showToast(`Manual visit recorded successfully for ${visitDialogCustomer.name}!`);
      setVisitDialogCustomer(null);
      setVisitNotes('');
      // Reload customers list to show latest check-in
      loadData();
    } catch (err) {
      console.error('Failed to log manual visit:', err);
      showToast('Failed to save manual visit log.', 'error');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const toggleTierFilter = (tier) => {
    setSelectedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="customer-map-page">
      
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Manual Visit Dialog Modal Overlay */}
      {visitDialogCustomer && (
        <div className="visit-dialog-overlay">
          <form onSubmit={handleSaveVisit} className="visit-dialog">
            <div className="visit-dialog-header">
              <h3>Log Visit: {visitDialogCustomer.name}</h3>
              <button 
                type="button" 
                onClick={() => setVisitDialogCustomer(null)} 
                className="close-dialog-btn"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="visit-dialog-body">
              <div className="form-group">
                <label>Visit Date</label>
                <input 
                  type="date" 
                  value={visitDate} 
                  onChange={(e) => setVisitDate(e.target.value)} 
                  className="form-input" 
                  required
                />
              </div>

              <div className="form-group">
                <label>Visit Check-in Notes</label>
                <textarea 
                  placeholder="Record customer comments, next actions, outstanding collection progress..." 
                  value={visitNotes} 
                  onChange={(e) => setVisitNotes(e.target.value)} 
                  className="form-textarea"
                  required
                />
              </div>
            </div>

            <div className="visit-dialog-footer">
              <button 
                type="button" 
                onClick={() => setVisitDialogCustomer(null)} 
                className="dialog-btn cancel"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submittingVisit} 
                className="dialog-btn save"
              >
                {submittingVisit ? 'Saving...' : 'Record Visit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Side Control and Details Panel */}
      <div className="map-sidebar">
        
        <div className="sidebar-header">
          <h2>
            <MapPin size={22} /> Customer Map
          </h2>
        </div>

        <div className="sidebar-tabs">
          <button 
            onClick={() => setActiveTab('customers')} 
            className={`sidebar-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          >
            Customers ({filteredCustomers.length})
          </button>
          <button 
            onClick={() => setActiveTab('route')} 
            className={`sidebar-tab-btn ${activeTab === 'route' ? 'active' : ''}`}
          >
            Today's Beat ({routeCustomers.length})
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'customers' ? (
            <>
              {/* Search Control */}
              <div className="search-box">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search customer / shop name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Credit Tier Filters */}
              <div className="filter-section">
                <div className="filter-label">Credit Tier</div>
                <div className="tier-pills">
                  <button 
                    type="button"
                    onClick={() => toggleTierFilter('GREEN')}
                    className={`tier-pill-btn green ${selectedTiers.GREEN ? 'active' : ''}`}
                  >
                    <span className="tier-indicator green"></span> Green
                  </button>
                  <button 
                    type="button"
                    onClick={() => toggleTierFilter('YELLOW')}
                    className={`tier-pill-btn yellow ${selectedTiers.YELLOW ? 'active' : ''}`}
                  >
                    <span className="tier-indicator yellow"></span> Yellow
                  </button>
                  <button 
                    type="button"
                    onClick={() => toggleTierFilter('RED')}
                    className={`tier-pill-btn red ${selectedTiers.RED ? 'active' : ''}`}
                  >
                    <span className="tier-indicator red"></span> Red
                  </button>
                </div>
              </div>

              {/* Territory Groups Filter */}
              <div className="filter-section">
                <div className="filter-label">Territory Group</div>
                <select 
                  value={selectedTerritory} 
                  onChange={(e) => setSelectedTerritory(e.target.value)}
                  className="select-dropdown"
                >
                  {territories.map(t => (
                    <option key={t} value={t}>
                      {t === 'ALL' ? 'All Territories' : t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Customer Listings */}
              <div className="customer-list">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => handleSelectCustomer(c)} 
                      className="customer-list-item"
                    >
                      <div className="customer-info-main">
                        <span className="customer-name-label">{c.name}</span>
                        <span className="customer-shop-label">{c.businessName || 'No Shop Name'}</span>
                        <div className="customer-meta-badge-row">
                          <span className={`meta-badge tier-${c.tier || 'RED'}`}>{c.tier || 'RED'}</span>
                          {c.territory && <span className="meta-badge" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>{c.territory}</span>}
                        </div>
                      </div>
                      <div className="customer-list-right">
                        <span className={`customer-due-amount ${(c.balance || 0) > 0 ? 'due-positive' : 'due-zero'}`}>
                          ₹{Number(c.balance || 0).toLocaleString('en-IN')}
                        </span>
                        {c.lastVisitDate && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            Visited: {new Date(c.lastVisitDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-route-msg">No customers match search criteria.</div>
                )}
              </div>
            </>
          ) : (
            /* Route Tab Layout */
            <div className="planned-route-container">
              {todayRoute && routeCustomers.length > 0 ? (
                <>
                  <div className="route-actions-header">
                    <a 
                      href={getGoogleMapsRouteUrl()} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="open-gmaps-btn"
                    >
                      <Navigation size={16} /> Open Route in Google Maps
                    </a>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <div className="route-meta-stat">
                        <Calendar size={14} /> Today's Planned Visits
                      </div>
                      <div className="route-meta-stat" style={{ fontWeight: 600 }}>
                        {routeCustomers.length} Stops
                      </div>
                    </div>
                  </div>

                  <div className="route-list">
                    {routeCustomers.map((c, index) => (
                      <div 
                        key={c.id} 
                        onClick={() => handleSelectCustomer(c)} 
                        className="route-step-item"
                      >
                        <div className="route-step-marker">
                          <span className="route-step-index">{index + 1}</span>
                        </div>
                        
                        <div className="route-step-header">
                          <span className="route-step-name">{c.name}</span>
                          <span className={`meta-badge tier-${c.tier || 'RED'}`}>{c.tier || 'RED'}</span>
                        </div>

                        <span className="route-step-shop">{c.businessName || 'No Shop Name'}</span>
                        <span className="route-step-address">{c.address || 'No Address Registered'}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="no-route-msg">
                  <AlertCircle size={32} style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }} />
                  <div>No beat planner route scheduled for today.</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Create route entries in the Route Planner.</div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Leaflet Map Drawing Canvas */}
      <div className="map-canvas-container">
        <div ref={mapContainerRef} />
      </div>

    </div>
  );
}
