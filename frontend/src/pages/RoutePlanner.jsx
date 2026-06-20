import { useState, useEffect } from 'react';
import { sfaApi, customersApi, usersApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const primaryColor = '#5a2d0c';

export default function RoutePlanner() {
  const [loading, setLoading] = useState(true);
  const [salesmen, setSalesmen] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedSalesman, setSelectedSalesman] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [routeName, setRouteName] = useState('Daily Beat Plan');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  
  // Optimized sequence state
  const [sequence, setSequence] = useState([]);
  const [routeStats, setRouteStats] = useState({ distance: 0, travelTime: 0, duration: 0 });
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, custsRes] = await Promise.all([
          usersApi.list({ limit: 100 }),
          customersApi.list({ limit: 100 })
        ]);
        
        const salesmanUsers = (usersRes.data.users || []).filter(
          u => u.role === 'Salesman' || u.role === 'Sales Executive' || u.role === 'Super Admin'
        );
        setSalesmen(salesmanUsers);
        
        // Filter out customers with invalid coordinates for mapping demo, or keep all
        const allCusts = custsRes.data.customers || [];
        setCustomers(allCusts);

        if (salesmanUsers.length > 0) {
          setSelectedSalesman(salesmanUsers[0].id);
        }
      } catch (err) {
        console.error('Error fetching route planner data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleCustomer = (id) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleOptimizeRoute = async () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select at least one customer to plan the beat.');
      return;
    }
    setOptimizing(true);
    try {
      // Find starting point (first customer's location or default Coimbatore coords)
      const firstCust = customers.find(c => c.id === selectedCustomerIds[0]);
      const startLat = firstCust?.latitude ? Number(firstCust.latitude) : 11.0168;
      const startLng = firstCust?.longitude ? Number(firstCust.longitude) : 76.9558;

      const res = await sfaApi.optimizeRoute({
        customerIds: selectedCustomerIds,
        startLat,
        startLng
      });

      setSequence(res.data.sequence);
      setRouteStats({
        distance: res.data.totalDistance,
        travelTime: res.data.estimatedTravelTime,
        duration: res.data.totalDuration
      });
      
      // Update selected ids in optimized sequence order
      setSelectedCustomerIds(res.data.sequence);
    } catch (err) {
      alert(err.response?.data?.message || 'Route optimization failed.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleSaveRoute = async () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select customers and optimize the route before saving.');
      return;
    }
    try {
      await sfaApi.createRoute({
        name: routeName,
        salesmanId: selectedSalesman,
        date: selectedDate,
        customerSequence: selectedCustomerIds,
        totalDistance: routeStats.distance,
        totalDuration: routeStats.duration
      });
      alert('Beat Route Plan created and synced successfully! 🎉');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save route plan.');
    }
  };

  if (loading) return <LoadingSpinner />;

  // Coordinate scaling helper for custom map view
  const mapWidth = 600;
  const mapHeight = 350;
  const mappedCustomers = customers.filter(c => c.latitude && c.longitude);
  
  let minLat = 11.0, maxLat = 11.1, minLng = 76.9, maxLng = 77.0;
  if (mappedCustomers.length > 0) {
    const lats = mappedCustomers.map(c => Number(c.latitude));
    const lngs = mappedCustomers.map(c => Number(c.longitude));
    minLat = Math.min(...lats) - 0.01;
    maxLat = Math.max(...lats) + 0.01;
    minLng = Math.min(...lngs) - 0.01;
    maxLng = Math.max(...lngs) + 0.01;
  }

  const getXY = (lat, lng) => {
    const x = ((Number(lng) - minLng) / (maxLng - minLng)) * (mapWidth - 80) + 40;
    const y = mapHeight - (((Number(lat) - minLat) / (maxLat - minLat)) * (mapHeight - 80) + 40);
    return { x, y };
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🗺️ SFA Route Planner & Daily Beat Planner</h1>
        <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Construct optimal routing sequences and delegate field beats to your sales force.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Side: Beat Configuration & List */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🛠️ Beat Planner Setup</h2>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Route Name</label>
            <input 
              type="text" 
              value={routeName} 
              onChange={e => setRouteName(e.target.value)} 
              className="form-control" 
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Assigned Salesman</label>
              <select 
                value={selectedSalesman} 
                onChange={e => setSelectedSalesman(e.target.value)} 
                className="form-control" 
                style={{ width: '100%' }}
              >
                {salesmen.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Beat Date</label>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                className="form-control" 
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>Select Customers for Route</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem' }}>
              {customers.map(c => {
                const hasCoords = c.latitude && c.longitude;
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.25rem', borderBottom: '1px solid #f1f5f9' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedCustomerIds.includes(c.id)} 
                        onChange={() => handleToggleCustomer(c.id)} 
                      />
                      <div>
                        <strong>{c.name}</strong> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({c.territory || 'Unassigned'})</span>
                      </div>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: hasCoords ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {hasCoords ? '📍 Mapped' : '⚠️ No Coordinates'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={handleOptimizeRoute} 
              className="btn btn-secondary" 
              disabled={optimizing} 
              style={{ flex: 1, fontWeight: 700 }}
            >
              {optimizing ? 'Calculating Route...' : '⚡ Optimize Sequence (TSP)'}
            </button>
            <button 
              type="button" 
              onClick={handleSaveRoute} 
              className="btn btn-primary" 
              style={{ flex: 1, backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 700 }}
            >
              💾 Save Beat Plan
            </button>
          </div>
        </div>

        {/* Right Side: Map & Route details */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🗺️ Live Beat Plan Sequencing</h2>

          {selectedCustomerIds.length > 0 ? (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center', flex: '1' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Distance</span>
                <strong style={{ fontSize: '1.25rem', color: primaryColor }}>{routeStats.distance} km</strong>
              </div>
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center', flex: '1' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Est. Travel Time</span>
                <strong style={{ fontSize: '1.25rem', color: primaryColor }}>{routeStats.travelTime} mins</strong>
              </div>
              <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center', flex: '1' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Duration in Field</span>
                <strong style={{ fontSize: '1.25rem', color: primaryColor }}>{routeStats.duration} mins</strong>
              </div>
            </div>
          ) : null}

          {/* Interactive SVG Plotting Map */}
          <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <svg width={mapWidth} height={mapHeight} style={{ display: 'block', margin: 'auto' }}>
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Render optimized path line */}
              {selectedCustomerIds.length > 1 && (() => {
                let pathD = '';
                selectedCustomerIds.forEach((cId, idx) => {
                  const cust = customers.find(c => c.id === cId);
                  if (cust && cust.latitude && cust.longitude) {
                    const { x, y } = getXY(cust.latitude, cust.longitude);
                    if (idx === 0) pathD = `M ${x} ${y}`;
                    else pathD += ` L ${x} ${y}`;
                  }
                });
                return (
                  <path 
                    d={pathD} 
                    fill="none" 
                    stroke={primaryColor} 
                    strokeWidth="3" 
                    strokeDasharray="5,5" 
                    style={{ filter: 'drop-shadow(0px 0px 4px rgba(245,158,11,0.5))' }}
                  />
                );
              })()}

              {/* Pins for customer coordinates */}
              {customers.map(c => {
                if (!c.latitude || !c.longitude) return null;
                const { x, y } = getXY(c.latitude, c.longitude);
                const isSelected = selectedCustomerIds.includes(c.id);
                const sequenceIdx = selectedCustomerIds.indexOf(c.id);
                
                // Tier badge colors
                let badgeColor = '#ef4444'; // Red
                if (c.tier === 'GREEN') badgeColor = '#10b981';
                else if (c.tier === 'YELLOW') badgeColor = '#fbbf24';

                return (
                  <g key={c.id} style={{ cursor: 'pointer' }}>
                    {/* Pulsing ring for selected route nodes */}
                    {isSelected && (
                      <circle cx={x} cy={y} r="14" fill="none" stroke={badgeColor} strokeWidth="2" opacity="0.4">
                        <animate attributeName="r" values="8;18;8" dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    
                    <circle 
                      cx={x} 
                      cy={y} 
                      r={isSelected ? '8' : '5'} 
                      fill={badgeColor} 
                      stroke="#fff" 
                      strokeWidth="2" 
                    />
                    
                    {/* Text tag */}
                    <text 
                      x={x + 10} 
                      y={y + 4} 
                      fill="#e2e8f0" 
                      fontSize="9" 
                      fontWeight="bold"
                      style={{ textShadow: '1px 1px 2px #000' }}
                    >
                      {isSelected ? `${sequenceIdx + 1}. ${c.name}` : c.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sequence Listing */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>📋 Route Sequence Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {selectedCustomerIds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>No beat plan sequence generated. Select customers and click optimize.</div>
              ) : (
                selectedCustomerIds.map((cId, idx) => {
                  const cust = customers.find(c => c.id === cId);
                  if (!cust) return null;
                  return (
                    <div key={cId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: primaryColor, color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong>{cust.name}</strong> <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({cust.businessName || 'Retail Retailer'})</span>
                      </div>
                      <span className={`badge ${cust.tier === 'GREEN' ? 'badge-success' : cust.tier === 'YELLOW' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase' }}>
                        {cust.tier} Tier
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
