import { useState, useEffect, useRef } from 'react';
import { sfaApi, usersApi } from '../api';
import { Map, Users, CheckSquare, Clock, MapPin, Navigation, RefreshCw, Send } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function FieldSalesDashboard() {
  const [liveData, setLiveData] = useState([]);
  const [salesmenList, setSalesmenList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Simulator state
  const [simSalesmanId, setSimSalesmanId] = useState('');
  const [simLat, setSimLat] = useState('11.0180');
  const [simLng, setSimLng] = useState('76.9640');
  const [simulating, setSimulating] = useState(false);

  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  const loadData = async () => {
    try {
      const [liveRes, usersRes] = await Promise.all([
        sfaApi.getLiveTracking(),
        usersApi.list({ limit: 100 })
      ]);
      setLiveData(liveRes.data || []);
      const activeSalesmen = (usersRes.data?.users || []).filter(u => u.role === 'Salesman' || u.role === 'Sales Executive');
      setSalesmenList(activeSalesmen);
      if (activeSalesmen.length > 0 && !simSalesmanId) {
        setSimSalesmanId(activeSalesmen[0].id);
      }
    } catch (err) {
      console.error('Error fetching SFA Live Dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll live data every 30 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    const map = L.map('live-salesman-map', { zoomControl: false }).setView([11.0180, 76.9640], 12);
    mapRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, []);

  // Update map markers when liveData changes
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    const points = [];

    liveData.forEach((item) => {
      if (!item.lastKnownLocation) return;
      const sLat = Number(item.lastKnownLocation.latitude);
      const sLng = Number(item.lastKnownLocation.longitude);
      points.push([sLat, sLng]);

      const salesmanIcon = L.divIcon({
        className: 'live-salesman-marker',
        html: `<div style="background: #3b82f6; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59,130,246,0.8); position: relative;">
                 <div style="position: absolute; top: -8px; left: -8px; width: 30px; height: 30px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 2s infinite; opacity: 0.5;"></div>
               </div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const popupContent = `
        <div style="font-family: Inter, sans-serif; font-size: 0.85rem; padding: 0.25rem; min-width: 180px;">
          <strong style="font-size: 0.95rem; display: block; margin-bottom: 0.25rem; color: #5a2d0c;">${item.salesman.name}</strong>
          <span style="color: #64748b; font-size: 0.75rem; display: block; margin-bottom: 0.5rem;">Role: ${item.salesman.role}</span>
          <div style="margin-bottom: 0.25rem;"><strong>Last Activity:</strong><br/>${item.lastActivity || 'None'}</div>
          <div style="margin-bottom: 0.25rem;"><strong>Current Customer:</strong><br/>${item.currentCustomer || 'Idle'}</div>
          <div style="margin-bottom: 0.25rem;"><strong>Visits Today:</strong> ${item.visitsToday || 0} check-ins</div>
          <div><strong>Distance Today:</strong> ${item.distanceCoveredToday || 0} KM</div>
        </div>
      `;

      L.marker([sLat, sLng], { icon: salesmanIcon })
        .bindPopup(popupContent)
        .addTo(markersGroupRef.current);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [liveData]);

  const handleSimulatePing = async (e) => {
    e.preventDefault();
    if (!simSalesmanId) return alert('Select a salesman to ping');
    try {
      setSimulating(true);
      await sfaApi.pingLocation({
        latitude: parseFloat(simLat),
        longitude: parseFloat(simLng)
      });
      alert('Location ping recorded successfully!');
      loadData();
    } catch (err) {
      alert('Error simulating GPS ping.');
    } finally {
      setSimulating(false);
    }
  };

  const totalActiveSalesmen = liveData.filter(s => s.lastKnownLocation).length;
  const totalVisits = liveData.reduce((sum, s) => sum + (s.visitsToday || 0), 0);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.3; }
          100% { transform: scale(0.5); opacity: 0.8; }
        }
        .leaflet-container {
          background-color: var(--bg-page) !important;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Field Sales Live Center</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Monitor salesman routing zones, GPS pings, visit checkpoints, and order compliance.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={16} /> Refresh Feeds
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="label">Salesmen in Field Today</div>
          <div className="value" style={{ color: 'var(--info)' }}>{totalActiveSalesmen} / {salesmenList.length}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="label">Cumulative Retail Visits</div>
          <div className="value success">{totalVisits} Check-ins</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }} className="form-row">
        {/* Live Map Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', position: 'relative', minHeight: '500px', flex: '1.2' }}>
          <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-active)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={14} color="var(--brand-primary)" /> GPS Salesman Beat Map
            </span>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div id="live-salesman-map" style={{ height: '100%', minHeight: '500px', width: '100%' }}></div>
          </div>
        </div>

        {/* Live List & Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1' }}>
          {/* Salesmen Tracking Feeds */}
          <div className="card" style={{ flex: 1, maxHeight: '350px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Salesman Status</h3>
            {loading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
              </div>
            ) : liveData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No salesmen in network.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {liveData.map(item => {
                  const locationDesc = item.lastKnownLocation 
                    ? `Lat: ${Number(item.lastKnownLocation.latitude).toFixed(4)}, Lng: ${Number(item.lastKnownLocation.longitude).toFixed(4)}`
                    : 'No GPS coordinates recorded';

                  return (
                    <div
                      key={item.salesman.id}
                      style={{
                        padding: '0.75rem',
                        background: 'var(--bg-page)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.lastKnownLocation ? '#10b981' : '#94a3b8' }}></span>
                          {item.salesman.name}
                        </div>
                        <span className="badge badge-success" style={{ background: 'var(--bg-card)', color: '#5a2d0c', fontWeight: 700, fontSize: '0.7rem' }}>
                          {item.visitsToday} Check-ins
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div style={{ gridColumn: 'span 2' }}>
                          <strong>Last Activity:</strong> {item.lastActivity || 'None'}
                        </div>
                        <div>
                          <strong>Current Customer:</strong> {item.currentCustomer || 'Idle'}
                        </div>
                        <div>
                          <strong>Distance:</strong> {item.distanceCoveredToday || 0} KM
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GPS Simulation Panel */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="var(--brand-primary)" /> GPS Location Simulator
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Test salesman tracking features by manually broadcasting coords for the logged-in sales session.</p>
            <form onSubmit={handleSimulatePing} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-row">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Simulate Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    required
                    value={simLat}
                    onChange={(e) => setSimLat(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Simulate Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control"
                    required
                    value={simLng}
                    onChange={(e) => setSimLng(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSimLat('11.0260'); setSimLng('76.9950'); }} // Peelamedu
                  >
                    Peelamedu Coords
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSimLat('11.0180'); setSimLng('76.9640'); }} // Gandhipuram
                  >
                    Gandhipuram Coords
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={simulating} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {simulating ? 'Broadcasting...' : 'Broadcast GPS Location'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
