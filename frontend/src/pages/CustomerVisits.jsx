import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sfaApi, customersApi, crmApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const primaryColor = '#5a2d0c';

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CustomerVisits() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [radiusLimit, setRadiusLimit] = useState(100); // default 100 meters
  
  // Target type toggle
  const [visitTargetType, setVisitTargetType] = useState('customer'); // 'customer' | 'lead'
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'beat'

  // Visit session state
  const [activeVisit, setActiveVisit] = useState(null);
  const [visitStatus, setVisitStatus] = useState('Visited');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitPhoto, setVisitPhoto] = useState('');
  
  // Visit history list
  const [visitsHistory, setVisitsHistory] = useState([]);

  // OSRM & fallback routing state
  const [routeInfo, setRouteInfo] = useState({ distance: null, duration: null });
  const [routeGeom, setRouteGeom] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Beat plan route state
  const [todayRoute, setTodayRoute] = useState(null);
  const [beatCustomers, setBeatCustomers] = useState([]);

  // Leaflet references
  const mapRef = useRef(null);
  const salesmanMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  const beatMapRef = useRef(null);
  const beatGroupRef = useRef(null);

  const fetchOSRMRoute = async (startLat, startLng, destLat, destLng) => {
    setRouteLoading(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        setRouteInfo({
          distance: (route.distance / 1000).toFixed(1), // km
          duration: Math.round(route.duration / 60) // minutes
        });
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]); // [lat, lng]
        setRouteGeom(coords);
      } else {
        throw new Error('No route');
      }
    } catch (err) {
      console.warn('OSRM routing failed, using fallback direct line.', err);
      const dist = haversineDistance(startLat, startLng, destLat, destLng);
      const dur = Math.round((dist / 30) * 60); // estimate at 30km/h
      setRouteInfo({
        distance: dist.toFixed(1),
        duration: dur > 0 ? dur : 1
      });
      setRouteGeom([[startLat, startLng], [destLat, destLng]]);
    } finally {
      setRouteLoading(false);
    }
  };

  const loadVisits = async () => {
    try {
      setLoading(true);
      const [custRes, visitsRes] = await Promise.all([
        customersApi.list({ limit: 100 }),
        sfaApi.getVisits()
      ]);
      
      const allCusts = custRes.data.customers || [];
      setCustomers(allCusts);
      
      const history = visitsRes.data || [];
      setVisitsHistory(history);
      
      // Auto-select first customer
      if (allCusts.length > 0) {
        setSelectedCustomerId(allCusts[0].id);
      }

      // Check if there is an active check-in session that wasn't closed
      const active = history.find(v => !v.checkOutTime);
      if (active) {
        setActiveVisit(active);
        if (active.customerId) {
          setVisitTargetType('customer');
          setSelectedCustomerId(active.customerId);
        } else if (active.leadId) {
          setVisitTargetType('lead');
          setSelectedLeadId(active.leadId);
        }
      }

      if (user?.id) {
        try {
          const leadsRes = await crmApi.getLeads({ assignedSalesmanId: user.id });
          const leads = leadsRes.data || [];
          setAssignedLeads(leads);
          if (leads.length > 0 && !active) {
            setSelectedLeadId(leads[0].id);
          }
        } catch (leadErr) {
          console.error('Error fetching leads:', leadErr);
        }
      }

      // Check if there is a beat plan sequence for today
      const todayStr = new Date().toISOString().split('T')[0];
      const routeRes = await sfaApi.getRoutes({ date: todayStr });
      if (user && routeRes.data) {
        const myRoute = routeRes.data.find(r => r.salesmanId === user.id || r.salesman?.id === user.id);
        if (myRoute) {
          setTodayRoute(myRoute);
          const seqMap = {};
          myRoute.customerSequence.forEach((cId, idx) => {
            seqMap[cId] = idx;
          });
          const sortedBeatCusts = allCusts
            .filter(c => myRoute.customerSequence.includes(c.id))
            .sort((a, b) => seqMap[a.id] - seqMap[b.id]);
          setBeatCustomers(sortedBeatCusts);
        }
      }
      
      // Locate user location
      handleGetLocation();
    } catch (err) {
      console.error('Error fetching visits data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, []);

  useEffect(() => {
    if (user?.id) {
      crmApi.getLeads({ assignedSalesmanId: user.id })
        .then(res => {
          const leads = res.data || [];
          setAssignedLeads(leads);
          if (leads.length > 0 && !activeVisit) {
            setSelectedLeadId(leads[0].id);
          }
        })
        .catch(err => console.error("Error loading leads in hook:", err));
    }
  }, [user]);

  // Poll location every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          },
          (err) => console.warn('Interval location update failed', err),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Initialize and clean up Check-In Terminal Map (Tab 1)
  useEffect(() => {
    if (activeTab !== 'terminal' || !userLocation) return;

    const map = L.map('terminal-map', { zoomControl: false }).setView([userLocation.lat, userLocation.lng], 14);
    mapRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const salesmanIcon = L.divIcon({
      className: 'salesman-marker-icon',
      html: `<div style="background: #3b82f6; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59,130,246,0.8); position: relative;">
               <div style="position: absolute; top: -8px; left: -8px; width: 30px; height: 30px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 2s infinite; opacity: 0.5;"></div>
             </div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    salesmanMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: salesmanIcon }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        salesmanMarkerRef.current = null;
        customerMarkerRef.current = null;
        routeLineRef.current = null;
      }
    };
  }, [activeTab, userLocation === null]);

  // Update Check-In Map markers and polyline when customer changes or userLocation moves
  const activeCustomer = visitTargetType === 'customer'
    ? customers.find(c => c.id === selectedCustomerId)
    : null;
  const activeLead = visitTargetType === 'lead'
    ? assignedLeads.find(l => l.id === selectedLeadId)
    : null;
  const activeTarget = activeCustomer || activeLead;

  useEffect(() => {
    if (activeTab !== 'terminal' || !mapRef.current || !userLocation) return;

    if (salesmanMarkerRef.current) {
      salesmanMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }

    if (activeTarget && activeTarget.latitude && activeTarget.longitude) {
      const custLat = Number(activeTarget.latitude);
      const custLng = Number(activeTarget.longitude);

      const markerColor = visitTargetType === 'customer' ? '#ef4444' : '#f97316';
      const customerIcon = L.divIcon({
        className: 'customer-marker-icon',
        html: `<div style="background: ${markerColor}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([custLat, custLng]);
      } else {
        customerMarkerRef.current = L.marker([custLat, custLng], { icon: customerIcon }).addTo(mapRef.current);
      }

      fetchOSRMRoute(userLocation.lat, userLocation.lng, custLat, custLng);

      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [custLat, custLng]
      ]);
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    } else {
      if (customerMarkerRef.current) {
        mapRef.current.removeLayer(customerMarkerRef.current);
        customerMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        mapRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      setRouteInfo({ distance: null, duration: null });
      setRouteGeom(null);
      mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
    }
  }, [activeTab, userLocation, selectedCustomerId, selectedLeadId, visitTargetType]);

  // Handle route line drawing
  useEffect(() => {
    if (activeTab !== 'terminal' || !mapRef.current) return;

    if (routeLineRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (routeGeom && routeGeom.length > 0) {
      routeLineRef.current = L.polyline(routeGeom, {
        color: primaryColor,
        weight: 4,
        opacity: 0.8,
        dashArray: '1, 5'
      }).addTo(mapRef.current);
    }
  }, [activeTab, routeGeom]);

  // Initialize and clean up Beat Map (Tab 2)
  useEffect(() => {
    if (activeTab !== 'beat' || !userLocation) return;

    const map = L.map('beat-map', { zoomControl: false }).setView([userLocation.lat, userLocation.lng], 13);
    beatMapRef.current = map;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    beatGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (beatMapRef.current) {
        beatMapRef.current.remove();
        beatMapRef.current = null;
        beatGroupRef.current = null;
      }
    };
  }, [activeTab, userLocation === null]);

  // Draw markers and sequence routes on Beat Map (Tab 2)
  useEffect(() => {
    if (activeTab !== 'beat' || !beatMapRef.current || !beatGroupRef.current || !userLocation) return;

    beatGroupRef.current.clearLayers();

    const salesmanIcon = L.divIcon({
      className: 'salesman-marker-icon',
      html: `<div style="background: #3b82f6; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59,130,246,0.8); position: relative;">
               <div style="position: absolute; top: -8px; left: -8px; width: 30px; height: 30px; border: 2px solid #3b82f6; border-radius: 50%; animation: pulse 2s infinite; opacity: 0.5;"></div>
             </div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    L.marker([userLocation.lat, userLocation.lng], { icon: salesmanIcon })
      .bindPopup("Your Current Location")
      .addTo(beatGroupRef.current);

    const pathCoords = [];
    const pointsToFit = [[userLocation.lat, userLocation.lng]];
    const visitedCustomerIds = visitsHistory.map(v => v.customerId);

    beatCustomers.forEach((cust, idx) => {
      if (!cust.latitude || !cust.longitude) return;
      const cLat = Number(cust.latitude);
      const cLng = Number(cust.longitude);
      pathCoords.push([cLat, cLng]);
      pointsToFit.push([cLat, cLng]);

      const isCurrent = cust.id === selectedCustomerId;
      const isVisited = visitedCustomerIds.includes(cust.id);
      
      let markerColor = '#f59e0b'; // Planned: Yellow
      let statusDesc = 'Planned';
      if (isVisited) {
        markerColor = '#10b981'; // Visited: Green
        statusDesc = 'Visited Today';
      }
      if (isCurrent) {
        markerColor = '#3b82f6'; // Selected: Blue
      }

      const custIcon = L.divIcon({
        className: 'beat-customer-marker',
        html: `<div style="background: ${markerColor}; width: 18px; height: 18px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 8px; font-weight: bold;">
                 ${idx + 1}
               </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      L.marker([cLat, cLng], { icon: custIcon })
        .bindPopup(`<strong>${idx + 1}. ${cust.name}</strong><br/>Status: ${statusDesc}`)
        .addTo(beatGroupRef.current);
    });

    if (pathCoords.length > 1) {
      L.polyline(pathCoords, {
        color: primaryColor,
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5'
      }).addTo(beatGroupRef.current);
    }

    if (pointsToFit.length > 1) {
      const bounds = L.latLngBounds(pointsToFit);
      beatMapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
      beatMapRef.current.setView([userLocation.lat, userLocation.lng], 13);
    }
  }, [activeTab, beatCustomers, visitsHistory, userLocation, selectedCustomerId]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation failed, mock location used.', err);
        setUserLocation({ lat: 11.0168, lng: 76.9558 });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCheckIn = async () => {
    const targetId = visitTargetType === 'customer' ? selectedCustomerId : selectedLeadId;
    if (!targetId) {
      alert(`Please select a ${visitTargetType} for check-in.`);
      return;
    }
    if (!userLocation) {
      alert('Please acquire GPS location details first.');
      return;
    }

    try {
      if (!navigator.onLine) {
        const localVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
        const mockVisit = {
          id: 'offline_' + Date.now(),
          customerId: visitTargetType === 'customer' ? targetId : null,
          leadId: visitTargetType === 'lead' ? targetId : null,
          salesmanId: user?.id || 'local',
          checkInTime: new Date(),
          checkOutTime: null,
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          status: 'Visited',
          offline: true
        };
        localVisits.push(mockVisit);
        localStorage.setItem('offline_visits', JSON.stringify(localVisits));
        setActiveVisit(mockVisit);
        alert('Offline Check-In registered locally. Data will automatically sync when internet resumes. 📡');
        return;
      }

      const checkInParams = {
        latitude: userLocation.lat,
        longitude: userLocation.lng
      };
      if (visitTargetType === 'customer') {
        checkInParams.customerId = targetId;
      } else {
        checkInParams.leadId = targetId;
      }

      const res = await sfaApi.checkIn(checkInParams);
      setActiveVisit(res.data);
      alert('Check-In Successful! Geofenced radius validation passed. 🟢');
    } catch (err) {
      alert(err.response?.data?.message || 'Check-in failed due to geofencing radius constraint.');
    }
  };

  const handleConvertLead = async () => {
    const targetId = activeVisit ? activeVisit.leadId : selectedLeadId;
    if (!targetId) return;

    if (!confirm('Are you sure you want to convert this Lead to a Customer account?')) return;

    try {
      setLoading(true);
      const res = await crmApi.convertLead(targetId);
      alert(res.data?.message || 'Lead converted successfully!');
      
      // Reload both customers and leads
      await loadVisits();
      
      // Switch view mode back to customer and select the converted customer
      if (res.data?.customer) {
        setVisitTargetType('customer');
        setSelectedCustomerId(res.data.customer.id);
        if (activeVisit) {
          setActiveVisit(prev => ({
            ...prev,
            customerId: res.data.customer.id,
            leadId: null
          }));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to convert lead.');
    } finally {
      setLoading(false);
    }
  };

  const getActiveVisitTargetName = () => {
    if (!activeVisit) return '';
    if (activeVisit.customerId) {
      return customers.find(c => c.id === activeVisit.customerId)?.name || 'Store';
    } else if (activeVisit.leadId) {
      return assignedLeads.find(l => l.id === activeVisit.leadId)?.shopName || 'Lead Store';
    }
    return 'Store';
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVisitPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!navigator.onLine) {
        const localVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
        const idx = localVisits.findIndex(v => v.id === activeVisit.id);
        if (idx !== -1) {
          localVisits[idx].checkOutTime = new Date();
          localVisits[idx].status = visitStatus;
          localVisits[idx].notes = visitNotes;
          localVisits[idx].photo = visitPhoto;
          localVisits[idx].duration = 15;
          localStorage.setItem('offline_visits', JSON.stringify(localVisits));
        }
        setActiveVisit(null);
        setVisitNotes('');
        setVisitPhoto('');
        alert('Offline Check-Out registered. Synced items will upload when connection is back.');
        return;
      }

      await sfaApi.checkOut({
        visitId: activeVisit.id,
        status: visitStatus,
        notes: visitNotes,
        photo: visitPhoto
      });

      const visitsRes = await sfaApi.getVisits();
      setVisitsHistory(visitsRes.data || []);
      
      setActiveVisit(null);
      setVisitNotes('');
      setVisitPhoto('');
      alert('Check-Out successful. Visit log saved successfully! 💾');
    } catch (err) {
      alert(err.response?.data?.message || 'Check-out failed.');
    }
  };

  const centerOnMyLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
    }
  };

  const openExternalNavigation = () => {
    if (userLocation && activeTarget && activeTarget.latitude && activeTarget.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${activeTarget.latitude},${activeTarget.longitude}`;
      window.open(url, '_blank');
    } else {
      alert('Coordinates are not fully set to construct navigation links.');
    }
  };

  if (loading) return <LoadingSpinner />;

  // Distance evaluation
  let calculatedDistance = null;
  if (userLocation && activeTarget && activeTarget.latitude && activeTarget.longitude) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(Number(activeTarget.latitude) - userLocation.lat);
    const dLon = toRad(Number(activeTarget.longitude) - userLocation.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(userLocation.lat)) * Math.cos(toRad(Number(activeTarget.latitude))) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    calculatedDistance = Math.round(R * c * 1000); // meters
  }

  // Calculate geofence status
  let isWithinGeofence = false;
  let statusText = 'Outside Geofence';
  let statusColor = '#ef4444'; // red

  if (!activeTarget || !activeTarget.latitude) {
    isWithinGeofence = true; // allow mapping on check-in
    statusText = 'Location Not Mapped';
    statusColor = '#f59e0b'; // amber
  } else if (calculatedDistance !== null && calculatedDistance <= radiusLimit) {
    isWithinGeofence = true;
    statusText = 'Within Geofence';
    statusColor = '#10b981'; // green
  }

  // Beat Stats
  const visitedCount = beatCustomers.filter(c => visitsHistory.some(v => v.customerId === c.id)).length;
  const totalCount = beatCustomers.length;
  const remainingCount = totalCount - visitedCount;
  const completionRate = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
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

      {/* Header & Tabs */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🚗 Customer Visit Manager</h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Salesman geofenced terminal for retailer visits, check-ins, and field logging.</p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-active)', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              backgroundColor: activeTab === 'terminal' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'terminal' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'terminal' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            📍 Check-In Terminal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('beat')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              backgroundColor: activeTab === 'beat' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'beat' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'beat' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            🗺️ Daily Beat Map
          </button>
        </div>
      </div>

      {activeTab === 'terminal' ? (
        // TAB 1: CHECK-IN TERMINAL
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Map and HUD Stats Card */}
          <div className="card" style={{ padding: '1rem', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            
            {/* Map Canvas */}
            <div style={{ height: window.innerWidth <= 768 ? '350px' : '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
              {userLocation ? (
                <div id="terminal-map" style={{ height: '100%', width: '100%' }}></div>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
                  📡 Acquiring GPS Location feeds...
                </div>
              )}

              {/* Floating Overlays */}
              {userLocation && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1000 }}>
                  <button 
                    type="button" 
                    onClick={centerOnMyLocation} 
                    title="Center on My Location"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '1.1rem' }}
                  >
                    📍
                  </button>
                  <button 
                    type="button" 
                    onClick={openExternalNavigation} 
                    title="Open driving navigation route"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '1.1rem' }}
                  >
                    🧭
                  </button>
                  <button 
                    type="button" 
                    onClick={handleGetLocation} 
                    disabled={locating}
                    title="Refresh Location"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: locating ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: '1.1rem' }}
                  >
                    🔄
                  </button>
                </div>
              )}
            </div>

            {/* OSRM Route HUD Stats overlay */}
            {activeTarget && (
              <div style={{
                marginTop: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-page)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Current Distance</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {routeInfo.distance !== null ? `${routeInfo.distance} KM` : (calculatedDistance !== null ? `${(calculatedDistance/1000).toFixed(2)} KM` : 'Calculating...')}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Estimated Arrival</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {routeInfo.duration !== null ? `${routeInfo.duration} Minutes` : 'Calculating...'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Geofence Status</span>
                  <strong style={{ fontSize: '1.1rem', color: statusColor }}>
                    {statusText}
                  </strong>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Visit Panel */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📍 Field Check-In Geofence</h2>

              {/* Visit Target Type Toggle */}
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-active)', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  type="button"
                  disabled={!!activeVisit}
                  onClick={() => setVisitTargetType('customer')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.75rem',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: activeVisit ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    backgroundColor: visitTargetType === 'customer' ? 'var(--bg-card)' : 'transparent',
                    color: visitTargetType === 'customer' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: visitTargetType === 'customer' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s ease',
                    opacity: activeVisit && visitTargetType !== 'customer' ? 0.5 : 1
                  }}
                >
                  👥 Active Beat Customers
                </button>
                <button
                  type="button"
                  disabled={!!activeVisit}
                  onClick={() => setVisitTargetType('lead')}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.75rem',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: activeVisit ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    backgroundColor: visitTargetType === 'lead' ? 'var(--bg-card)' : 'transparent',
                    color: visitTargetType === 'lead' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: visitTargetType === 'lead' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s ease',
                    opacity: activeVisit && visitTargetType !== 'lead' ? 0.5 : 1
                  }}
                >
                  🎯 My Assigned Leads
                </button>
              </div>

              {!activeVisit ? (
                // Check-In Mode
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {visitTargetType === 'customer' ? (
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Select Customer to Visit</label>
                      <select 
                        value={selectedCustomerId} 
                        onChange={e => setSelectedCustomerId(e.target.value)} 
                        className="form-control" 
                        style={{ width: '100%', height: '40px' }}
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.businessName || 'Retailer'})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Select Lead to Visit</label>
                      <select 
                        value={selectedLeadId} 
                        onChange={e => setSelectedLeadId(e.target.value)} 
                        className="form-control" 
                        style={{ width: '100%', height: '40px' }}
                      >
                        {assignedLeads.length === 0 ? (
                          <option value="">No assigned leads found</option>
                        ) : (
                          assignedLeads.map(l => (
                            <option key={l.id} value={l.id}>{l.shopName} ({l.category || 'Lead'})</option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={handleCheckIn} 
                      className="btn btn-primary" 
                      disabled={!isWithinGeofence || (visitTargetType === 'lead' && assignedLeads.length === 0)}
                      style={{ 
                        flex: 2, 
                        backgroundColor: (!isWithinGeofence || (visitTargetType === 'lead' && assignedLeads.length === 0)) ? '#94a3b8' : primaryColor, 
                        borderColor: (!isWithinGeofence || (visitTargetType === 'lead' && assignedLeads.length === 0)) ? '#94a3b8' : primaryColor, 
                        color: '#fff',
                        fontWeight: 700,
                        cursor: (!isWithinGeofence || (visitTargetType === 'lead' && assignedLeads.length === 0)) ? 'not-allowed' : 'pointer',
                        opacity: (!isWithinGeofence || (visitTargetType === 'lead' && assignedLeads.length === 0)) ? 0.75 : 1
                      }}
                    >
                      🟢 Check-In Visit
                    </button>
                    {visitTargetType === 'lead' && (
                      <button 
                        type="button" 
                        onClick={handleConvertLead} 
                        className="btn btn-secondary" 
                        disabled={assignedLeads.length === 0}
                        style={{ 
                          flex: 1, 
                          borderColor: '#10b981', 
                          color: '#10b981', 
                          fontWeight: 700,
                          cursor: assignedLeads.length === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        🤝 Convert
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Check-Out Form
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem' }}>
                    🟢 Checked in with {visitTargetType === 'customer' ? 'customer' : 'lead'}: <strong>{getActiveVisitTargetName()}</strong><br />
                    Arrival Time: {new Date(activeVisit.checkInTime).toLocaleTimeString()}
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Visit Status Outcome</label>
                    <select 
                      value={visitStatus} 
                      onChange={e => setVisitStatus(e.target.value)} 
                      className="form-control" 
                      style={{ width: '100%', height: '40px' }}
                    >
                      <option value="Visited">Visited Only</option>
                      <option value="Order Taken">Order Taken</option>
                      <option value="No Order">No Order</option>
                      <option value="Closed Shop">Closed Shop</option>
                      <option value="Follow-Up Required">Follow-Up Required</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Add Visit Notes</label>
                    <textarea 
                      rows="3" 
                      value={visitNotes} 
                      onChange={e => setVisitNotes(e.target.value)} 
                      placeholder="Notes about shop visit, shelf stock status, payment collected, etc." 
                      className="form-control" 
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Take Field Photo</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handlePhotoCapture} 
                      style={{ display: 'block', fontSize: '0.8rem' }}
                    />
                    {visitPhoto && (
                      <div style={{ marginTop: '0.5rem', width: '100px', height: '100px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                        <img src={visitPhoto} alt="Visit snap" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {activeVisit.leadId && (
                      <button 
                        type="button" 
                        onClick={handleConvertLead} 
                        className="btn btn-secondary" 
                        style={{ flex: 1, borderColor: '#10b981', color: '#10b981', fontWeight: 700, minWidth: '120px' }}
                      >
                        🤝 Convert to Cust.
                      </button>
                    )}
                    <button 
                      type="button" 
                      disabled={!activeVisit.customerId}
                      onClick={() => navigate(`/field-ordering?customerId=${activeVisit.customerId}`)} 
                      className="btn btn-secondary" 
                      style={{ 
                        flex: 1, 
                        borderColor: '#10b981', 
                        color: '#10b981', 
                        fontWeight: 700,
                        minWidth: '120px',
                        cursor: !activeVisit.customerId ? 'not-allowed' : 'pointer',
                        opacity: !activeVisit.customerId ? 0.5 : 1
                      }}
                      title={!activeVisit.customerId ? "Convert to customer first to place order" : ""}
                    >
                      🛒 Place Order
                    </button>
                    <button 
                      type="button" 
                      onClick={handleCheckOut} 
                      className="btn btn-danger" 
                      style={{ flex: 1, fontWeight: 700, minWidth: '120px' }}
                    >
                      🔴 Check-Out Visit
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Visit Log/History */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📋 Field Visit Log</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto' }}>
                {visitsHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No visits registered today.</div>
                ) : (
                  visitsHistory.map(v => (
                    <div key={v.id} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{v.customer?.name || v.lead?.shopName || 'Retailer'}</strong>
                        <span 
                          style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold', 
                            padding: '0.1rem 0.4rem', 
                            borderRadius: '4px',
                            backgroundColor: v.status === 'Order Taken' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-active)',
                            color: v.status === 'Order Taken' ? '#10b981' : 'var(--text-primary)'
                          }}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Salesman: {v.salesman?.name} | Checked-in: {new Date(v.checkInTime).toLocaleTimeString()}
                      </div>
                      {v.duration > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Duration: {v.duration} mins | GPS: {Number(v.latitude).toFixed(4)}, {Number(v.longitude).toFixed(4)}
                        </div>
                      )}
                      {v.notes && (
                        <div style={{ marginTop: '0.4rem', padding: '0.4rem', backgroundColor: 'var(--bg-active)', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          &ldquo;{v.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // TAB 2: DAILY BEAT MAP & ROUTE VIEW
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Map Section */}
          <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📍 Beat Route Tracker</h2>
            <div style={{ height: '400px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              {userLocation ? (
                <div id="beat-map" style={{ height: '100%', width: '100%' }}></div>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
                  📡 Acquiring location feeds...
                </div>
              )}
            </div>
          </div>

          {/* Route Info */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>📊 Beat Progress Summary</h2>

            {todayRoute ? (
              <>
                {/* Stats */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-page)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Beat Distance</span>
                    <strong style={{ fontSize: '1.1rem', color: primaryColor }}>{todayRoute.totalDistance || 0} KM</strong>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-page)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Completion Rate</span>
                    <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{completionRate}%</strong>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-page)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Remaining</span>
                    <strong style={{ fontSize: '1.1rem', color: '#ef4444' }}>{remainingCount} shops</strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                    <span>Progress: {visitedCount} of {totalCount} Visited</span>
                    <span>{completionRate}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-active)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${completionRate}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.4s ease' }}></div>
                  </div>
                </div>

                {/* Sequence list */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Beat Sequence Order</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                    {beatCustomers.map((cust, idx) => {
                      const visited = visitsHistory.some(v => v.customerId === cust.id);
                      return (
                        <div key={cust.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: visited ? '#10b981' : primaryColor, color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            {idx + 1}
                          </span>
                          <div style={{ flex: 1, color: 'var(--text-primary)' }}>
                            <strong>{cust.name}</strong> <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({cust.businessName || 'Retailer'})</span>
                          </div>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 600, 
                              color: visited ? '#10b981' : '#f59e0b',
                              backgroundColor: visited ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {visited ? 'Visited ✓' : 'Planned'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                🗺️ No beat plan route scheduled for you today.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
