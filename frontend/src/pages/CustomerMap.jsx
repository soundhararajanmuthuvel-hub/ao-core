import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
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
  DollarSign,
  Compass
} from 'lucide-react';
import '../styles/customermap.css';

// Haversine formula to compute distance between coordinates in Kilometers
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Map customer types to specific V3 colors and indicators
function getCustomerTypeColors(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('retail')) {
    return { bg: '#dcfce7', text: '#15803d', icon: '🟢', color: '#10b981' };
  } else if (t.includes('d2c') || t.includes('direct')) {
    return { bg: '#dbeafe', text: '#1d4ed8', icon: '🔵', color: '#3b82f6' };
  } else if (t.includes('white label') || t.includes('whitelabel')) {
    return { bg: '#f3e8ff', text: '#7e22ce', icon: '🟣', color: '#a855f7' };
  } else if (t.includes('organic')) {
    return { bg: '#ffedd5', text: '#c2410c', icon: '🟠', color: '#f97316' };
  }
  return { bg: '#f1f5f9', text: '#475569', icon: '⚪', color: '#64748b' };
}

export default function CustomerMap() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  
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
  const [radiusFilter, setRadiusFilter] = useState('ALL'); // ALL, 0.5, 1, 3, 5, 10
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }

  // Smart Details overlay state
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Quick Onboarding State
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ name: '', phone: '', customerType: 'Retail Shop' });
  const [onboarding, setOnboarding] = useState(false);

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

  // Get current user location for radius checks
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => console.log('Could not retrieve salesman location for beat matching:', err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // Load Customers and Today's Beat Route
  const loadData = async () => {
    try {
      setLoading(true);
      const [customersRes, routesRes] = await Promise.all([
        customersApi.list({ limit: 1000 }),
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

  // Filter Logic utilizing Haversine formulas and Search Matchers
  const filteredCustomers = useMemo(() => {
    let result = customers.map(c => {
      const dist = userLocation && c.latitude !== null && c.longitude !== null
        ? getDistance(userLocation.lat, userLocation.lng, Number(c.latitude), Number(c.longitude))
        : null;
      return { ...c, distance: dist };
    });

    result = result.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.businessName && c.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTier = selectedTiers[c.tier || 'RED'];
      const matchesTerritory = selectedTerritory === 'ALL' || c.territory === selectedTerritory;
      
      const matchesRadius = radiusFilter === 'ALL'
        ? true
        : c.distance !== null && c.distance <= parseFloat(radiusFilter);

      return matchesSearch && matchesTier && matchesTerritory && matchesRadius;
    });

    // Sort by distance (nearest first) if location is available
    if (userLocation) {
      result.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }
    
    return result;
  }, [customers, searchQuery, selectedTiers, selectedTerritory, radiusFilter, userLocation]);

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

    // Dynamic Multi-Provider Tile Configuration
    const mapProvider = settings?.mapProvider || 'osm';
    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let tileAttribution = '© OpenStreetMap contributors';
    
    if (mapProvider === 'google') {
      tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      tileAttribution = '© Google Maps';
    } else if (mapProvider === 'mapbox') {
      // Mapbox high-density OSM layer styling
      tileUrl = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
      tileAttribution = '© Mapbox / OSM Hot Tiles';
    } else if (mapProvider === 'here') {
      // Clean CartoDB Voyager styling
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      tileAttribution = '© HERE / CartoDB Voyager';
    }

    L.tileLayer(tileUrl, { attribution: tileAttribution }).addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

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
      const color = getCustomerTypeColors(c.customerType).color;
      const iconHtml = `
        <div style="
          background-color: ${color}; 
          width: 20px; 
          height: 20px; 
          border: 2.5px solid #ffffff; 
          border-radius: 50%; 
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 5px; height: 5px; background-color: #ffffff; border-radius: 50%;"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: iconHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([Number(c.latitude), Number(c.longitude)], { icon: customIcon });
      
      // Bind React state overlay updater on click instead of raw popups
      marker.on('click', () => {
        setSelectedCustomer(c);
      });
      
      markersGroupRef.current.addLayer(marker);
    });

    // Auto-pan to bounds if markers are mapped
    if (validCustomers.length > 0) {
      const bounds = L.latLngBounds(validCustomers.map(c => [Number(c.latitude), Number(c.longitude)]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [filteredCustomers]);

  // Center Map on a specific customer selection
  const handleSelectCustomer = (c) => {
    if (c.latitude !== null && c.longitude !== null && mapRef.current) {
      mapRef.current.setView([Number(c.latitude), Number(c.longitude)], 15);
      setSelectedCustomer(c);

      // On mobile, scroll to map smoothly
      if (window.innerWidth <= 768) {
        document.querySelector('.map-canvas-container').scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      showToast('This customer does not have valid coordinates saved.', 'error');
    }
  };

  // Quick Geocoded Onboarding
  const handleQuickOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardForm.name || !onboardForm.phone) {
      showToast('Please enter both name and contact number.', 'error');
      return;
    }

    setOnboarding(true);

    // Retrieve device GPS coordinates
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let resolvedAddress = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        // Query OSM Nominatim for reverse geocoding lookup
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
          const geoRes = await fetch(geoUrl, {
            headers: { 'Accept-Language': 'en' }
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.display_name) {
              resolvedAddress = geoData.display_name;
            }
          }
        } catch (err) {
          console.error('Address lookup failed:', err);
        }

        // POST onboarding payload to Backend
        try {
          const payload = {
            name: onboardForm.name,
            phone: onboardForm.phone,
            customerType: onboardForm.customerType,
            latitude: lat,
            longitude: lng,
            address: resolvedAddress,
            status: 'Active',
            salesmanId: user?.id
          };
          await customersApi.create(payload);
          showToast(`⚡ Onboarded ${onboardForm.name} successfully!`);
          setOnboardModalOpen(false);
          setOnboardForm({ name: '', phone: '', customerType: 'Retail Shop' });
          loadData(); // reload datasets
        } catch (err) {
          console.error('Onboard failed:', err);
          showToast(err.response?.data?.message || 'Quick onboarding failed.', 'error');
        } finally {
          setOnboarding(false);
        }
      },
      (error) => {
        console.error('Geolocation failed:', error);
        showToast('Could not acquire GPS position. Onboarding failed.', 'error');
        setOnboarding(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Generate Google Maps multi-stop URL for Today's Planned Visits
  const getGoogleMapsRouteUrl = () => {
    const validCoords = routeCustomers.filter(c => c.latitude !== null && c.longitude !== null);
    if (validCoords.length === 0) return '#';

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

      {/* Quick Customer Onboarding Modal */}
      {onboardModalOpen && (
        <div className="visit-dialog-overlay" style={{ zIndex: 2000 }}>
          <form onSubmit={handleQuickOnboardSubmit} className="visit-dialog" style={{ maxWidth: '400px' }}>
            <div className="visit-dialog-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                ⚡ Quick Onboard Account
              </h3>
              <button 
                type="button" 
                onClick={() => setOnboardModalOpen(false)} 
                className="close-dialog-btn"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="visit-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Shop / Account Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Wellness Organic Foods"
                  value={onboardForm.name} 
                  onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Contact Phone Number *</label>
                <input 
                  type="tel" 
                  placeholder="e.g. 9876543210"
                  value={onboardForm.phone} 
                  onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })} 
                  className="form-input" 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Account Category / Type</label>
                <select 
                  value={onboardForm.customerType} 
                  onChange={(e) => setOnboardForm({ ...onboardForm, customerType: e.target.value })} 
                  className="form-input"
                >
                  <option value="Retail Shop">Retail Shop</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Wholesaler">Wholesaler</option>
                  <option value="Organic Store">Organic Store</option>
                  <option value="Medical Shop">Medical Shop</option>
                </select>
              </div>
            </div>

            <div className="visit-dialog-footer">
              <button 
                type="button" 
                onClick={() => setOnboardModalOpen(false)} 
                className="dialog-btn cancel"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={onboarding} 
                className="dialog-btn save"
              >
                {onboarding ? 'Locating (GPS)...' : '⚡ Onboard Now'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Button (FAB) for Quick Customer Onboarding */}
      <button 
        type="button" 
        onClick={() => setOnboardModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '140px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--brand-primary, #5a2d0c)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          zIndex: 99,
          boxShadow: '0 8px 16px rgba(90, 45, 12, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem'
        }}
        title="Quick Onboard Customer"
      >
        ➕
      </button>

      {/* Smart Customer Card Details Overlay */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed',
          bottom: '75px', // Sit cleanly above standard bottom navigation
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.25rem',
          zIndex: 100,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontFamily: 'Inter, sans-serif'
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedCustomer.name}</h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selectedCustomer.businessName || 'No Shop Name'}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setSelectedCustomer(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          </div>

          {/* Details layout grids */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1rem', fontSize: '0.8rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Phone</span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedCustomer.phone || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Dues</span>
              <strong style={{ color: selectedCustomer.balance > 0 ? '#ef4444' : '#10b981' }}>
                ₹{Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Visited</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {selectedCustomer.lastVisitDate ? new Date(selectedCustomer.lastVisitDate).toLocaleDateString('en-IN') : 'N/A'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tier / Territory</span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedCustomer.tier || 'RED'} / {selectedCustomer.territory || 'N/A'}</strong>
            </div>
            {selectedCustomer.distance !== null && selectedCustomer.distance !== Infinity && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance from You</span>
                <strong style={{ color: 'var(--brand-primary)' }}>{selectedCustomer.distance.toFixed(2)} km away</strong>
              </div>
            )}
          </div>

          {/* Action Row 1: Calling & Navigation */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
            {selectedCustomer.phone && (
              <>
                <a href={`tel:${selectedCustomer.phone}`} className="mobile-action-btn phone" style={{ flex: 1, minHeight: '36px', fontSize: '0.75rem', padding: '0.35rem' }}>📞 Call</a>
                <a href={`https://wa.me/91${selectedCustomer.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="mobile-action-btn whatsapp" style={{ flex: 1, minHeight: '36px', fontSize: '0.75rem', padding: '0.35rem' }}>💬 WhatsApp</a>
              </>
            )}
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCustomer.latitude},${selectedCustomer.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mobile-action-btn navigate"
              style={{ flex: 1, minHeight: '36px', fontSize: '0.75rem', padding: '0.35rem' }}
            >
              🧭 Navigate
            </a>
          </div>

          {/* Action Row 2: Sales Triggers */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button 
              type="button" 
              className="mobile-action-btn primary" 
              style={{ flex: 1, minHeight: '36px', fontSize: '0.75rem', padding: '0.35rem' }}
              onClick={() => navigate(`/field-ordering?customerId=${selectedCustomer.id || selectedCustomer._id}`)}
            >
              🧾 New Order
            </button>
            <button 
              type="button" 
              className="mobile-action-btn secondary" 
              style={{ flex: 1, minHeight: '36px', fontSize: '0.75rem', padding: '0.35rem' }}
              onClick={() => {
                setVisitDialogCustomer(selectedCustomer);
                setSelectedCustomer(null);
              }}
            >
              💰 Collect Payment
            </button>
          </div>
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

              {/* Nearby Customers filter */}
              {userLocation && (
                <div className="filter-section">
                  <div className="filter-label">🧭 Nearby Distance Filter</div>
                  <select 
                    value={radiusFilter} 
                    onChange={(e) => setRadiusFilter(e.target.value)}
                    className="select-dropdown"
                  >
                    <option value="ALL">Show All Mapped</option>
                    <option value="0.5">Within 500 meters</option>
                    <option value="1">Within 1 Kilometer</option>
                    <option value="3">Within 3 Kilometers</option>
                    <option value="5">Within 5 Kilometers</option>
                    <option value="10">Within 10 Kilometers</option>
                  </select>
                </div>
              )}

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
                          {c.distance !== null && c.distance !== Infinity && (
                            <span className="meta-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                              🧭 {c.distance.toFixed(1)} km
                            </span>
                          )}
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
