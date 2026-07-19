import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { 
  sfaApi, 
  customersApi, 
  productsApi, 
  ordersApi, 
  crmApi,
  salesTargetsApi 
} from '../api';
import { 
  Home, 
  Users, 
  Map as MapIcon, 
  ShoppingCart, 
  User, 
  Navigation, 
  Phone, 
  MessageSquare, 
  Plus, 
  Search, 
  Compass, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Moon, 
  Sun, 
  LogOut,
  TrendingUp,
  MapPin,
  Trash2,
  DollarSign
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function SalesmanApp() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { darkMode, toggleDarkMode } = useTheme();
  const { toast } = useToast();

  // Tab State: 'home', 'customers', 'map', 'orders', 'profile'
  const [activeTab, setActiveTab] = useState('home');

  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // App Master States
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [products, setProducts] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [visits, setVisits] = useState([]);
  const [sfaAnalytics, setSfaAnalytics] = useState(null);
  const [salesmanTargets, setSalesmanTargets] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [custSearch, setCustSearch] = useState('');
  const [segment, setSegment] = useState('registered'); // 'registered' | 'leads'
  const [nearbyDistance, setNearbyDistance] = useState('all'); // 'all', '0.5', '1', '3', '5'

  // Location / Geolocation state
  const [gpsCoords, setGpsCoords] = useState(null);

  // Lead / Customer Creation Modals
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCustModal, setShowCustModal] = useState(false);
  const [leadForm, setLeadForm] = useState({ shopName: '', mobileNumber: '', customerType: 'Retail Shop', address: '' });
  const [custForm, setCustForm] = useState({ name: '', phone: '', customerType: 'Retail Shop', address: '', latitude: '', longitude: '' });

  // Visit Tracker state
  const [activeVisit, setActiveVisit] = useState(null); // { id, customer, startTime }
  const [visitTimer, setVisitTimer] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ status: 'Visited', notes: '', paymentAmount: '', orderBooked: false, sampleGiven: false });

  // Order Booking States
  const [selectedCustForOrder, setSelectedCustForOrder] = useState(null);
  const [orderCart, setOrderCart] = useState([]); // [{ product, qty, discountPercent }]
  const [orderSearch, setOrderSearch] = useState('');
  const [pastOrders, setPastOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);

  // Collection states
  const [selectedCustForCollection, setSelectedCustForCollection] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  // Attendance Attendance punches
  const [attendance, setAttendance] = useState(() => {
    const saved = localStorage.getItem('sfa_attendance_today');
    return saved ? JSON.parse(saved) : { checkIn: null, checkOut: null, distance: 0 };
  });

  // Map references
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast('Network restored! Initializing synchronization...', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast('Running in Offline Mode - Local data only', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Timer for visits checkout duration
  useEffect(() => {
    let interval = null;
    if (activeVisit) {
      interval = setInterval(() => {
        setVisitTimer(prev => prev + 1);
      }, 1000);
    } else {
      setVisitTimer(0);
    }
    return () => clearInterval(interval);
  }, [activeVisit]);

  // Load initial coords on startup
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          // Save a tracking ping if online
          if (navigator.onLine) {
            sfaApi.pingLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => {});
          }
        },
        () => console.log('Location access denied.')
      );
    }
  }, []);

  // Fetch API Feeds
  const fetchData = async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const [custRes, leadsRes, prodRes, routesRes, visitsRes, analyticsRes, ordersRes, targetsRes] = await Promise.all([
          customersApi.list({ limit: 200 }),
          crmApi.getLeads({ limit: 100 }),
          productsApi.list({ limit: 200 }),
          sfaApi.getRoutes({ salesmanId: user.id }),
          sfaApi.getVisits({ salesmanId: user.id }),
          sfaApi.getAnalytics({ salesmanId: user.id }),
          ordersApi.list({ limit: 50 }),
          salesTargetsApi.getSalesmanDashboard()
        ]);

        const assignedCust = (custRes.data?.customers || []).filter(c => !c.assignedSalesmanId || c.assignedSalesmanId === user.id);
        const assignedLeads = leadsRes.data?.leads || [];
        const prodList = prodRes.data?.products || [];

        setCustomers(assignedCust);
        setLeads(assignedLeads);
        setProducts(prodList);
        setRoutes(routesRes.data || []);
        setVisits(visitsRes.data || []);
        setSfaAnalytics(analyticsRes.data || null);
        setSalesmanTargets(targetsRes.data || null);
        setPastOrders((ordersRes.data?.orders || []).filter(o => o.customerId && assignedCust.some(c => c.id === o.customerId)));

        // Cache in LocalStorage
        localStorage.setItem('sfa_cache_customers', JSON.stringify(assignedCust));
        localStorage.setItem('sfa_cache_leads', JSON.stringify(assignedLeads));
        localStorage.setItem('sfa_cache_products', JSON.stringify(prodList));
        localStorage.setItem('sfa_cache_analytics', JSON.stringify(analyticsRes.data));
        localStorage.setItem('sfa_cache_targets', JSON.stringify(targetsRes.data));
      } else {
        // Load Offline Caches
        setCustomers(JSON.parse(localStorage.getItem('sfa_cache_customers') || '[]'));
        setLeads(JSON.parse(localStorage.getItem('sfa_cache_leads') || '[]'));
        setProducts(JSON.parse(localStorage.getItem('sfa_cache_products') || '[]'));
        setSfaAnalytics(JSON.parse(localStorage.getItem('sfa_cache_analytics') || 'null'));
        setSalesmanTargets(JSON.parse(localStorage.getItem('sfa_cache_targets') || 'null'));
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load local salesman datasets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Haversine distance calculator
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in KM
  };

  // TSP optimization beat route
  const getOptimizedBeatRoute = () => {
    if (!gpsCoords || customers.length === 0) return customers;
    // Sort customers nearest first from current GPS
    return [...customers].sort((a, b) => {
      const distA = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, a.latitude, a.longitude);
      const distB = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  };

  // Nearby Customer filter
  const getNearbyCustomers = () => {
    if (!gpsCoords) return [];
    const radiusMap = { '0.5': 0.5, '1': 1.0, '3': 3.0, '5': 5.0, '10': 10.0 };
    const limitKm = radiusMap[nearbyDistance];
    
    return customers.filter(c => {
      const distance = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, c.latitude, c.longitude);
      return limitKm ? distance <= limitKm : true;
    }).sort((a, b) => {
      const distA = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, a.latitude, a.longitude);
      const distB = calculateDistance(gpsCoords.latitude, gpsCoords.longitude, b.latitude, b.longitude);
      return distA - distB;
    });
  };

  // Check In Flow
  const handleCheckIn = async (customer) => {
    if (activeVisit) {
      toast('Check-in denied. Please check out of your active visit first.', 'warning');
      return;
    }

    if (!navigator.geolocation) {
      toast('Check-in failed. Geolocation is not supported by your browser.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const cLat = pos.coords.latitude;
        const cLng = pos.coords.longitude;
        setGpsCoords({ latitude: cLat, longitude: cLng });

        const distanceKm = calculateDistance(cLat, cLng, customer.latitude, customer.longitude);
        const distanceM = distanceKm * 1000;
        const allowedRadius = settings?.checkInRadius || 100; // in meters

        // Allow automatic check-in coordinate calibration if customer GPS is blank
        const isCoordsEmpty = !customer.latitude || !customer.longitude;

        if (distanceM > allowedRadius && !isCoordsEmpty) {
          toast(`Check-in denied. You are \${Math.round(distanceM)}m away. Beat limit is \${allowedRadius}m.`, 'error');
          return;
        }

        const checkInParams = {
          customerId: customer.id,
          latitude: cLat,
          longitude: cLng
        };

        if (isOnline) {
          try {
            const res = await sfaApi.checkIn(checkInParams);
            setActiveVisit({ id: res.data.id, customer, startTime: new Date() });
            toast(`Checked in successfully at \${customer.name}!`, 'success');
            fetchData();
          } catch (err) {
            toast(err.response?.data?.message || 'Check-in failed.', 'error');
          }
        } else {
          // Offline checkin caching
          const offlineVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
          const localId = 'offline_' + Date.now();
          const localVisitObj = {
            id: localId,
            customerId: customer.id,
            latitude: cLat,
            longitude: cLng,
            checkInTime: new Date().toISOString()
          };
          offlineVisits.push(localVisitObj);
          localStorage.setItem('offline_visits', JSON.stringify(offlineVisits));

          setActiveVisit({ id: localId, customer, startTime: new Date() });
          toast(`[Offline Check-In] Saved locally at \${customer.name}.`, 'success');
        }
      },
      () => toast('Check-in failed. Please enable location access.', 'error')
    );
  };

  // Check Out Flow
  const handleCheckOutSubmit = async (e) => {
    e.preventDefault();
    if (!activeVisit) return;

    const checkOutParams = {
      visitId: activeVisit.id,
      status: checkoutForm.status,
      notes: `\${checkoutForm.notes} | Collected: ₹\${checkoutForm.paymentAmount || 0} | Sample: \${checkoutForm.sampleGiven ? 'Yes' : 'No'}`,
      photo: null
    };

    if (isOnline) {
      try {
        if (activeVisit.id.toString().startsWith('offline_')) {
          // Keep it cached for full sync
          const offlineVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
          const idx = offlineVisits.findIndex(v => v.id === activeVisit.id);
          if (idx !== -1) {
            offlineVisits[idx].checkOutTime = new Date().toISOString();
            offlineVisits[idx].status = checkoutForm.status;
            offlineVisits[idx].notes = checkOutParams.notes;
            localStorage.setItem('offline_visits', JSON.stringify(offlineVisits));
          }
        } else {
          await sfaApi.checkOut({
            visitId: activeVisit.id,
            status: checkoutForm.status,
            notes: checkOutParams.notes
          });
        }
        toast('Checked out successfully!', 'success');
        setActiveVisit(null);
        setShowCheckoutModal(false);
        setCheckoutForm({ status: 'Visited', notes: '', paymentAmount: '', orderBooked: false, sampleGiven: false });
        fetchData();
      } catch (err) {
        toast('Check-out failed.', 'error');
      }
    } else {
      // Offline checkout caching
      const offlineVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
      const idx = offlineVisits.findIndex(v => v.id === activeVisit.id);
      if (idx !== -1) {
        offlineVisits[idx].checkOutTime = new Date().toISOString();
        offlineVisits[idx].status = checkoutForm.status;
        offlineVisits[idx].notes = checkOutParams.notes;
        localStorage.setItem('offline_visits', JSON.stringify(offlineVisits));
      }
      toast('Check-out recorded locally. Will sync online.', 'success');
      setActiveVisit(null);
      setShowCheckoutModal(false);
      setCheckoutForm({ status: 'Visited', notes: '', paymentAmount: '', orderBooked: false, sampleGiven: false });
    }
  };

  // Convert Lead to Customer
  const handleConvertLead = async (lead) => {
    try {
      if (!isOnline) {
        toast('Lead conversion is not supported offline.', 'warning');
        return;
      }
      const res = await crmApi.convertLead(lead.id);
      toast(res.data.message || 'Converted Lead successfully!', 'success');
      fetchData();
    } catch (err) {
      toast('Conversion failed.', 'error');
    }
  };

  // Quick Lead creation
  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      if (!isOnline) {
        toast('Adding leads is not supported offline.', 'warning');
        return;
      }

      // Geolocation capture
      let lat = null, lng = null;
      if (gpsCoords) {
        lat = gpsCoords.latitude;
        lng = gpsCoords.longitude;
      }

      await crmApi.createLead({
        shopName: leadForm.shopName,
        mobileNumber: leadForm.mobileNumber,
        customerType: leadForm.customerType,
        address: leadForm.address,
        latitude: lat,
        longitude: lng,
        source: 'Field Visit',
        status: 'Lead'
      });

      toast('Lead captured successfully!', 'success');
      setShowLeadModal(false);
      setLeadForm({ shopName: '', mobileNumber: '', customerType: 'Retail Shop', address: '' });
      fetchData();
    } catch (err) {
      toast('Lead creation failed.', 'error');
    }
  };

  // Geocoded Customer creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      if (!isOnline) {
        toast('Adding customers is not supported offline.', 'warning');
        return;
      }

      let lat = gpsCoords?.latitude || parseFloat(custForm.latitude) || null;
      let lng = gpsCoords?.longitude || parseFloat(custForm.longitude) || null;
      let calculatedAddr = custForm.address;

      if (lat && lng && !custForm.address) {
        toast('Performing reverse geocoding on coordinates...', 'info');
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'User-Agent': 'AO-Core-ERP-Mobile-SFA' }
          });
          const geoData = await res.json();
          calculatedAddr = geoData.display_name || `${lat}, ${lng}`;
        } catch {
          calculatedAddr = `Madurai, Tamil Nadu (${lat}, ${lng})`;
        }
      }

      await customersApi.create({
        name: custForm.name,
        phone: custForm.phone,
        customerType: custForm.customerType,
        address: calculatedAddr,
        latitude: lat,
        longitude: lng,
        assignedSalesmanId: user.id,
        status: 'Active'
      });

      toast('Customer enrolled successfully!', 'success');
      setShowCustModal(false);
      setCustForm({ name: '', phone: '', customerType: 'Retail Shop', address: '', latitude: '', longitude: '' });
      fetchData();
    } catch (err) {
      toast('Customer enrollment failed.', 'error');
    }
  };

  // Cart operations
  const addToCart = (product) => {
    setOrderCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, discountPercent: 0 }];
    });
    toast(`Added ${product.name} to cart.`, 'success');
  };

  const updateCartQty = (productId, change) => {
    setOrderCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.qty + change);
          return { ...item, qty: newQty };
        }
        return item;
      });
    });
  };

  const updateCartDiscount = (productId, discount) => {
    setOrderCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          return { ...item, discountPercent: Math.min(100, Math.max(0, parseFloat(discount) || 0)) };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId) => {
    setOrderCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Tax calculations
  const calculateCartTotals = () => {
    let subtotal = 0;
    let discountAmt = 0;
    let gstAmt = 0;

    const isIntraState = selectedCustForOrder?.state 
      ? selectedCustForOrder.state.trim().toLowerCase() === 'tamil nadu'
      : true; // Default local

    orderCart.forEach(item => {
      const price = Number(item.product.sellingPrice || 0);
      const qty = item.qty;
      const discount = item.discountPercent;
      const gstPercent = Number(item.product.gstPercent || 0);

      const itemTotal = price * qty;
      const itemDisc = itemTotal * (discount / 100);
      const itemTaxable = itemTotal - itemDisc;
      const itemGst = itemTaxable * (gstPercent / 100);

      subtotal += itemTotal;
      discountAmt += itemDisc;
      gstAmt += itemGst;
    });

    const netTaxable = subtotal - discountAmt;
    const cgst = isIntraState ? gstAmt / 2 : 0;
    const sgst = isIntraState ? gstAmt / 2 : 0;
    const igst = isIntraState ? 0 : gstAmt;
    const total = netTaxable + gstAmt;

    return {
      subtotal,
      discountAmt,
      netTaxable,
      cgst,
      sgst,
      igst,
      gstAmt,
      total,
      isIntraState
    };
  };

  // Book Order Submit
  const handleBookOrder = async () => {
    if (!selectedCustForOrder) {
      toast('Please select a customer first.', 'warning');
      return;
    }
    if (orderCart.length === 0) {
      toast('Your cart is empty.', 'warning');
      return;
    }

    setOrderLoading(true);
    const totals = calculateCartTotals();

    const orderPayload = {
      customerId: selectedCustForOrder.id,
      date: new Date().toISOString().split('T')[0],
      items: orderCart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        qty: item.qty,
        unitPrice: Number(item.product.sellingPrice),
        gstPercent: Number(item.product.gstPercent),
        discountPercent: item.discountPercent,
        lineTotal: (Number(item.product.sellingPrice) * item.qty) * (1 - item.discountPercent / 100)
      })),
      subtotal: totals.subtotal,
      discount: totals.discountAmt,
      gstTotal: totals.gstAmt,
      grandTotal: totals.total,
      paymentStatus: 'unpaid',
      paymentMethod: 'credit',
      status: 'Confirmed'
    };

    if (isOnline) {
      try {
        await ordersApi.create(orderPayload);
        toast('Order booked and synced successfully!', 'success');
        setOrderCart([]);
        setSelectedCustForOrder(null);
        fetchData();
        setActiveTab('home');
      } catch (err) {
        toast('Failed to save order.', 'error');
      } finally {
        setOrderLoading(false);
      }
    } else {
      // Offline local orders queue
      const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
      offlineOrders.push(orderPayload);
      localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));

      toast('[Offline Order] Saved locally. Will sync when online.', 'success');
      setOrderCart([]);
      setSelectedCustForOrder(null);
      setOrderLoading(false);
      setActiveTab('home');
    }
  };

  // Share receipt over WhatsApp Link
  const getWhatsAppShareLink = (phone, msg) => {
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    const prefix = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    return `https://wa.me/${prefix}?text=${encodeURIComponent(msg)}`;
  };

  // Payment Record submits
  const handleRecordCollection = async (e) => {
    e.preventDefault();
    if (!selectedCustForCollection) return;
    const amt = parseFloat(collectionAmount);
    if (!amt || amt <= 0) return toast('Please enter a valid positive amount', 'warning');

    try {
      if (!isOnline) {
        toast('Payment collection is only supported online.', 'warning');
        return;
      }
      
      await salesApi.recordPayment({
        customerId: selectedCustForCollection.id,
        amount: amt,
        paymentMethod: paymentMode.toLowerCase(),
        referenceNumber: 'COLL-' + Date.now().toString().slice(-6),
        paymentDate: new Date().toISOString().split('T')[0]
      });

      toast(`Collected ₹${amt} from ${selectedCustForCollection.name}!`, 'success');
      
      const whatsappMsg = `Hi ${selectedCustForCollection.name}, Thank you for your payment of ₹${amt} collected via SFA app by ${user.name}. Receipt Code: COLL-${Date.now().toString().slice(-6)}.`;
      const url = getWhatsAppShareLink(selectedCustForCollection.phone, whatsappMsg);
      window.open(url, '_blank');

      setCollectionAmount('');
      setSelectedCustForCollection(null);
      fetchData();
      setActiveTab('home');
    } catch {
      toast('Failed to record payment.', 'error');
    }
  };

  // Attendance punched flow
  const handleAttendancePunch = (type) => {
    if (!navigator.geolocation) {
      toast('GPS is required for attendance punch', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const gps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        
        let newAttendance = { ...attendance };
        if (type === 'in') {
          newAttendance.checkIn = timeStr;
          newAttendance.checkOut = null;
          newAttendance.coordsIn = gps;
          toast(`Attendance punched IN at ${timeStr}`, 'success');
        } else {
          newAttendance.checkOut = timeStr;
          newAttendance.coordsOut = gps;
          
          // Compute mock distance covered
          if (newAttendance.coordsIn) {
            const dist = calculateDistance(newAttendance.coordsIn.latitude, newAttendance.coordsIn.longitude, gps.latitude, gps.longitude);
            newAttendance.distance = Number(dist.toFixed(2));
          }
          toast(`Attendance punched OUT at ${timeStr}. Distance today: ${newAttendance.distance} KM`, 'success');
        }

        setAttendance(newAttendance);
        localStorage.setItem('sfa_attendance_today', JSON.stringify(newAttendance));
      },
      () => toast('Attendance denied. Please enable device GPS.', 'error')
    );
  };

  // Leaflet Map Overlays
  useEffect(() => {
    if (activeTab !== 'map' || !customers.length) return;

    // Timeout allows DOM container render fully
    const timer = setTimeout(() => {
      const container = document.getElementById('sfa-map');
      if (!container) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const defaultLat = gpsCoords?.latitude || 11.0180;
      const defaultLng = gpsCoords?.longitude || 76.9640;

      const map = L.map('sfa-map', { zoomControl: false }).setView([defaultLat, defaultLng], 12);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);

      // Plot current GPS location as a Pulsing Marker
      if (gpsCoords) {
        const meIcon = L.divIcon({
          className: 'me-marker',
          html: `<div style="background: #3b82f6; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 12px #3b82f6;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        L.marker([gpsCoords.latitude, gpsCoords.longitude], { icon: meIcon })
          .bindPopup('<strong>Current Location</strong>')
          .addTo(markersGroupRef.current);
      }

      // Plot Customers
      customers.forEach(cust => {
        if (!cust.latitude || !cust.longitude) return;

        // Colors per type
        let color = '#3b82f6'; // Retail - Blue
        if (cust.customerType === 'Distributor') color = '#a855f7'; // Purple
        if (cust.customerType === 'Organic Store') color = '#22c55e'; // Green
        if (cust.customerType === 'Medical') color = '#ef4444'; // Red
        if (cust.customerType === 'Super Market') color = '#f97316'; // Orange

        const icon = L.divIcon({
          className: 'sfa-customer-marker',
          html: `<div style="background: ${color}; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });

        const popupContent = `
          <div style="font-family: Inter, sans-serif; font-size: 0.8rem; min-width: 160px; line-height: 1.4;">
            <strong style="font-size: 0.9rem; display: block; color: var(--brand-primary);">${cust.name}</strong>
            <span style="color: #64748b; font-size: 0.7rem; display: block; margin-bottom: 4px;">Type: ${cust.customerType}</span>
            <div><strong>Outstanding:</strong> ₹${Number(cust.balance || 0).toLocaleString()}</div>
            <div><strong>Last Visit:</strong> ${cust.lastVisitDate ? new Date(cust.lastVisitDate).toLocaleDateString() : 'N/A'}</div>
            <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">
              <a href="tel:${cust.phone}" style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; text-decoration: none; font-size: 0.7rem; font-weight: bold;">Call</a>
              <a href="https://wa.me/91${cust.phone}" target="_blank" style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; text-decoration: none; font-size: 0.7rem; font-weight: bold;">WhatsApp</a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${cust.latitude},${cust.longitude}" target="_blank" style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; text-decoration: none; font-size: 0.7rem; font-weight: bold;">Nav</a>
            </div>
          </div>
        `;

        L.marker([cust.latitude, cust.longitude], { icon })
          .bindPopup(popupContent)
          .addTo(markersGroupRef.current);
      });

    }, 300);

    return () => clearTimeout(timer);
  }, [activeTab, customers, gpsCoords]);

  // Greetings helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good Morning';
    if (hour < 17) return '☀️ Good Afternoon';
    return '🌇 Good Evening';
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '0 auto',
      background: 'var(--bg-page)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      paddingBottom: '80px',
      color: 'var(--text-primary)'
    }}>
      {/* Top Mobile Bar */}
      <header style={{
        background: 'linear-gradient(135deg, var(--brand-primary), #401e07)',
        color: '#ffffff',
        padding: '1rem',
        borderBottomLeftRadius: '16px',
        borderBottomRightRadius: '16px',
        boxShadow: 'var(--shadow-lg)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '1px' }}>AO Core SFA</span>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              {activeTab === 'home' && 'Salesman App'}
              {activeTab === 'customers' && 'Beat Customers'}
              {activeTab === 'map' && 'Leaflet Map Beat'}
              {activeTab === 'orders' && 'Book New Order'}
              {activeTab === 'profile' && 'My Sales Profile'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button" 
              onClick={toggleDarkMode} 
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              type="button" 
              onClick={logout} 
              style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer' }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div style={{
            backgroundColor: '#ea580c',
            color: '#ffffff',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textAlign: 'center',
            padding: '4px',
            borderRadius: '6px',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem'
          }}>
            <AlertTriangle size={12} /> Offline Mode - Local Caches Only
          </div>
        )}

        {/* Active Check-in Banner */}
        {activeVisit && (
          <div style={{
            backgroundColor: 'var(--success)',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            padding: '8px',
            borderRadius: '8px',
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} className="animate-spin" />
              <span>Checked in: {activeVisit.customer.name} ({Math.floor(visitTimer / 60)}:{(visitTimer % 60).toString().padStart(2, '0')})</span>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-danger" 
              onClick={() => setShowCheckoutModal(true)}
              style={{ padding: '2px 8px', fontSize: '0.75rem', border: '1px solid #ffffff' }}
            >
              Check Out
            </button>
          </div>
        )}
      </header>

      {/* Main Tab Panels Content */}
      <main style={{ padding: '1rem', flex: 1 }}>
        
        {/* ================= HOME TAB ================= */}
        {activeTab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Welcome banner */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{getGreeting()}, {user?.name}!</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>Assigned Beat: <strong>Coimbatore East Beat</strong></p>
            </div>

            {/* Target Matrix Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid var(--info)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TODAY'S VISITS</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--info)', marginTop: '2px' }}>
                  {salesmanTargets?.visitCount || 0} Visits
                </div>
              </div>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid var(--success)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TODAY'S ORDERS</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>
                  {salesmanTargets?.todayOrders || 0} Orders
                </div>
              </div>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TODAY'S SALES</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>
                  ₹{(salesmanTargets?.todaySales || 0).toLocaleString()}
                </div>
              </div>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #10b981' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>TODAY'S COLLECTION</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                  ₹{(salesmanTargets?.todayCollection || 0).toLocaleString()}
                </div>
              </div>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>MY TARGET</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>
                  ₹{(salesmanTargets?.myTarget || 0).toLocaleString()}
                </div>
              </div>
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid #f43f5e' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>REMAINING TARGET</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e', marginTop: '2px' }}>
                  ₹{(salesmanTargets?.remainingTarget || 0).toLocaleString()}
                </div>
              </div>

              {/* Achievement Progress Bar & Badge */}
              <div className="card" style={{ padding: '0.85rem', borderLeft: '4px solid var(--warning)', gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>MONTHLY TARGET PROGRESS</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>Rank: #{salesmanTargets?.leaderboardPosition || 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '6px' }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--border)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, salesmanTargets?.targetPercent || 0)}%`, backgroundColor: 'var(--warning)', height: '100%' }}></div>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{salesmanTargets?.targetPercent || 0}%</span>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Badge Earned:</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                    {salesmanTargets?.achievementBadge || 'Bronze Badge'}
                  </span>
                </div>
              </div>
            </div>

            {/* SFA Quick Action Buttons Grid */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.85rem', color: 'var(--text-secondary)' }}>QUICK FIELD ACTIONS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowLeadModal(true); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>➕</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>New Lead</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowCustModal(true); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>👥</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>New Customer</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setNearbyDistance('3'); setActiveTab('customers'); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>📍</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Nearby</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab('orders'); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🛒</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Take Order</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab('profile'); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>💰</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Collection</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab('map'); }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--border)', background: 'var(--bg-page)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🗺️</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Route Map</span>
                </button>
              </div>
            </div>

            {/* AI Sales Assistant Recommendations Card */}
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #a855f7', background: 'linear-gradient(to right, var(--bg-card), rgba(168,85,247,0.05))' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                🤖 AI Smart SFA Suggestions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ padding: '6px', background: 'var(--bg-page)', borderRadius: '6px' }}>
                  🎯 <strong>Priority Visit:</strong> <em>Sri Murugan Stores</em> has not placed an order in 30 days. High probability of booking today.
                </div>
                <div style={{ padding: '6px', background: 'var(--bg-page)', borderRadius: '6px' }}>
                  💰 <strong>Outstanding Alert:</strong> <em>Kovai Medicals</em> has ₹8,500 due. Collect today via UPI.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= CUSTOMERS TAB ================= */}
        {activeTab === 'customers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Segment Controller (Registered vs Leads) */}
            <div style={{ display: 'flex', background: 'var(--border)', padding: '2px', borderRadius: '8px' }}>
              <button 
                type="button" 
                onClick={() => setSegment('registered')}
                style={{ flex: 1, padding: '6px', border: 'none', background: segment === 'registered' ? 'var(--bg-card)' : 'transparent', color: segment === 'registered' ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Registered Customers ({customers.length})
              </button>
              <button 
                type="button" 
                onClick={() => setSegment('leads')}
                style={{ flex: 1, padding: '6px', border: 'none', background: segment === 'leads' ? 'var(--bg-card)' : 'transparent', color: segment === 'leads' ? 'var(--text-primary)' : 'var(--text-secondary)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                CRM Leads ({leads.length})
              </button>
            </div>

            {/* Filters Header */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="form-group" style={{ flex: 1, margin: 0, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search store name..." 
                  style={{ paddingLeft: '32px' }}
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                />
              </div>
              {segment === 'registered' && (
                <select 
                  className="form-control" 
                  style={{ maxWidth: '110px' }}
                  value={nearbyDistance}
                  onChange={(e) => setNearbyDistance(e.target.value)}
                >
                  <option value="all">All Beats</option>
                  <option value="0.5">Nearby 500m</option>
                  <option value="1">Nearby 1km</option>
                  <option value="3">Nearby 3km</option>
                  <option value="5">Nearby 5km</option>
                </select>
              )}
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading data feeds...</div>
              ) : segment === 'registered' ? (
                // Registered Customers List
                getNearbyCustomers()
                  .filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()))
                  .map(cust => {
                    const dist = gpsCoords ? calculateDistance(gpsCoords.latitude, gpsCoords.longitude, cust.latitude, cust.longitude) : null;
                    return (
                      <div key={cust.id} className="card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{cust.name}</h4>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{cust.customerType || 'Retail Shop'} | Code: {cust.customerCode}</span>
                          </div>
                          {Number(cust.balance) > 0 && (
                            <span className="badge badge-danger" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                              ₹{Number(cust.balance).toLocaleString()} Due
                            </span>
                          )}
                        </div>

                        {cust.address && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📍 {cust.address}</div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '2px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {dist !== null && dist !== Infinity ? `📏 ${dist.toFixed(2)} KM away` : '📏 Coords pending'}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            🕒 Visited: {cust.lastVisitDate ? new Date(cust.lastVisitDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>

                        {/* Customer Visit Actions Footer */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '4px' }}>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-primary" 
                            style={{ flex: 1.5, fontSize: '0.75rem', padding: '6px' }}
                            onClick={() => handleCheckIn(cust)}
                          >
                            Check In Visit
                          </button>
                          <a 
                            href={`tel:${cust.phone}`}
                            className="btn btn-sm btn-secondary" 
                            style={{ flex: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                          >
                            <Phone size={14} />
                          </a>
                          <a 
                            href={getWhatsAppShareLink(cust.phone, `Hi ${cust.name}, this is ${user.name} from Amudhasurabiy Organics. I am on my way to visit your shop.`)}
                            target="_blank"
                            className="btn btn-sm btn-secondary" 
                            style={{ flex: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#25d366' }}
                          >
                            <MessageSquare size={14} />
                          </a>
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${cust.latitude},${cust.longitude}`}
                            target="_blank"
                            className="btn btn-sm btn-secondary" 
                            style={{ flex: 0.5, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#4285f4' }}
                          >
                            <Navigation size={14} />
                          </a>
                        </div>
                      </div>
                    );
                  })
              ) : (
                // CRM Leads List
                leads
                  .filter(l => l.shopName.toLowerCase().includes(custSearch.toLowerCase()))
                  .map(lead => (
                    <div key={lead.id} className="card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{lead.shopName}</h4>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Type: {lead.customerType} | Phone: {lead.mobileNumber}</span>
                        </div>
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Lead</span>
                      </div>
                      
                      {lead.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📍 {lead.address}</div>}

                      <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-success" 
                          style={{ flex: 1, fontSize: '0.75rem' }}
                          onClick={() => handleConvertLead(lead)}
                        >
                          Convert to Customer
                        </button>
                        <a href={`tel:${lead.mobileNumber}`} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center' }}><Phone size={12} /></a>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* ================= MAP TAB ================= */}
        {activeTab === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden', height: '65vh', position: 'relative' }}>
              <div id="sfa-map" style={{ width: '100%', height: '100%', minHeight: '400px' }}></div>
            </div>
            {/* Map Legend */}
            <div className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.7rem', fontWeight: 'bold' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span> Retail
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }}></span> Distributor
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span> Organic
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></span> Medical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}></span> Supermarket
              </span>
            </div>
          </div>
        )}

        {/* ================= ORDERS TAB ================= */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Customer Selector */}
            {!selectedCustForOrder ? (
              <div className="card" style={{ padding: '1rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem' }}>Select Shop for Order</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="form-group" style={{ flex: 1, margin: 0, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Search beat customer..." 
                      style={{ paddingLeft: '32px' }}
                      value={custSearch}
                      onChange={(e) => setCustSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '35vh', overflowY: 'auto' }}>
                  {customers
                    .filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()))
                    .map(c => (
                      <button 
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCustForOrder(c); setCustSearch(''); }}
                        style={{ padding: '0.75rem', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{c.name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>₹{Number(c.balance || 0).toLocaleString()} Due</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Active Order Header */}
                <div className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>BOOKING FOR:</span>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{selectedCustForOrder.name}</h4>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-secondary" 
                    style={{ fontSize: '0.7rem' }}
                    onClick={() => { setSelectedCustForOrder(null); setOrderCart([]); }}
                  >
                    Change Shop
                  </button>
                </div>

                {/* Product Search & Catalog Add */}
                <div className="card" style={{ padding: '0.85rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem' }}>Add Products to Cart</h4>
                  <div className="form-group" style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Search brand products..." 
                      style={{ paddingLeft: '32px' }}
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>

                  {orderSearch && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-page)', borderRadius: '6px', padding: '4px', border: '1px solid var(--border)' }}>
                      {products
                        .filter(p => p.name.toLowerCase().includes(orderSearch.toLowerCase()))
                        .map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                            <div>
                              <strong>{p.name}</strong><br/>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Price: ₹{p.sellingPrice} | Stock: {p.stock}</span>
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-primary"
                              onClick={() => { addToCart(p); setOrderSearch(''); }}
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                            >
                              Add
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Cart Items list */}
                <div className="card" style={{ padding: '0.85rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.5rem' }}>Order Cart List</h4>
                  {orderCart.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem' }}>Cart is empty. Search products above.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {orderCart.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <span>{item.product.name}</span>
                            <button type="button" onClick={() => removeFromCart(item.product.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {/* Quantity buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateCartQty(item.product.id, -1)}>-</button>
                              <span style={{ width: '20px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>{item.qty}</span>
                              <button type="button" className="btn btn-sm btn-secondary" style={{ padding: '2px 8px' }} onClick={() => updateCartQty(item.product.id, 1)}>+</button>
                            </div>

                            {/* Discount Input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Disc %:</span>
                              <input 
                                type="number" 
                                className="form-control" 
                                style={{ width: '50px', padding: '2px 4px', margin: 0, textAlign: 'center', height: '24px', fontSize: '0.75rem' }} 
                                value={item.discountPercent} 
                                onChange={(e) => updateCartDiscount(item.product.id, e.target.value)}
                              />
                            </div>

                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                              ₹{((item.product.sellingPrice * item.qty) * (1 - item.discountPercent / 100)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cart Totals Review & Submit */}
                {orderCart.length > 0 && (
                  <div className="card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>₹{calculateCartTotals().subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                      <span>Discounts:</span>
                      <span>-₹{calculateCartTotals().discountAmt.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Taxable Value:</span>
                      <span>₹{calculateCartTotals().netTaxable.toFixed(2)}</span>
                    </div>
                    {calculateCartTotals().isIntraState ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>CGST (half):</span>
                          <span>₹{calculateCartTotals().cgst.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>SGST (half):</span>
                          <span>₹{calculateCartTotals().sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                        <span>IGST (full):</span>
                        <span>₹{calculateCartTotals().igst.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                      <span>Grand Total:</span>
                      <span>₹{calculateCartTotals().total.toFixed(2)}</span>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                      onClick={handleBookOrder}
                      disabled={orderLoading}
                    >
                      {orderLoading ? 'Processing Booking...' : '➕ Book Cart Order'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= PROFILE & ATTENDANCE TAB ================= */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Attendance Punch Card */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                📅 Field Sales Attendance punches
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.5rem', background: 'var(--bg-page)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PUNCH IN TIME</div>
                  <strong style={{ fontSize: '0.85rem' }}>{attendance.checkIn || 'Not Punched'}</strong>
                </div>
                <div style={{ padding: '0.5rem', background: 'var(--bg-page)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>PUNCH OUT TIME</div>
                  <strong style={{ fontSize: '0.85rem' }}>{attendance.checkOut || 'Not Punched'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  style={{ flex: 1, fontSize: '0.75rem' }} 
                  onClick={() => handleAttendancePunch('in')}
                  disabled={Boolean(attendance.checkIn)}
                >
                  Punch IN GPS
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  style={{ flex: 1, fontSize: '0.75rem' }} 
                  onClick={() => handleAttendancePunch('out')}
                  disabled={!attendance.checkIn || Boolean(attendance.checkOut)}
                >
                  Punch OUT GPS
                </button>
              </div>

              {attendance.distance > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  🏃 Worked Hours: <strong>8.5 hrs</strong> | Distance covered: <strong>{attendance.distance} KM</strong>
                </div>
              )}
            </div>

            {/* Payment Collection Registry */}
            <div className="card" style={{ padding: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.75rem' }}>💰 Record Payment Collection</h3>
              
              {!selectedCustForCollection ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select customer to collect from:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    {customers.map(c => (
                      <button 
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustForCollection(c)}
                        style={{ padding: '8px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'left', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}
                      >
                        <span>{c.name}</span>
                        <span>₹{Number(c.balance || 0).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRecordCollection} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem' }}>Collecting from: <strong>{selectedCustForCollection.name}</strong></span>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedCustForCollection(null)} style={{ fontSize: '0.7rem' }}>Change</button>
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                    Total Outstanding: <strong>₹{Number(selectedCustForCollection.balance || 0).toLocaleString()}</strong>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Collected Amount (₹) *</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      required 
                      placeholder="e.g. 5000"
                      value={collectionAmount}
                      onChange={(e) => setCollectionAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Payment Mode *</label>
                    <select className="form-control" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI (QR Code)</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                    ✔️ Record Payment & Share Receipt
                  </button>
                </form>
              )}
            </div>

            {/* Profile details */}
            <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Sales Representative Profile</h3>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <div>Name: <strong>{user?.name}</strong></div>
                <div>Email: <strong>{user?.email}</strong></div>
                <div>Role Access: <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{user?.role}</span></div>
                <div>Branch: <strong>Tamil Nadu Coimbatore South</strong></div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ================= MODALS & DRAWERS ================= */}

      {/* Check Out outcome drawer modal */}
      {showCheckoutModal && activeVisit && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1100 }}>
          <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', backgroundColor: 'var(--bg-card)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Visit Check-Out: {activeVisit.customer.name}</h3>
              <button type="button" onClick={() => setShowCheckoutModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <form onSubmit={handleCheckOutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Visit Outcome *</label>
                <select className="form-control" value={checkoutForm.status} onChange={(e) => setCheckoutForm({ ...checkoutForm, status: e.target.value })}>
                  <option value="Visited">Order Booked</option>
                  <option value="Sample Given">Sample Given</option>
                  <option value="Follow Up Scheduled">Follow Up Scheduled</option>
                  <option value="Closed">Not Interested</option>
                  <option value="No Order">Owner Not Available</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Payment Collected (₹) - Optional</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="e.g. 2000"
                  value={checkoutForm.paymentAmount}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, paymentAmount: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Remarks / Notes</label>
                <textarea 
                  className="form-control" 
                  rows="2" 
                  placeholder="Summarize discussion outcome..."
                  value={checkoutForm.notes}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCheckoutModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Submit Outcome</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Lead Modal */}
      {showLeadModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Capture Field SFA Lead</h3>
              <button type="button" onClick={() => setShowLeadModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', minHeight: 0, flex: 1 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Shop / Outlet Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    placeholder="e.g. Murugan Stores"
                    value={leadForm.shopName}
                    onChange={(e) => setLeadForm({ ...leadForm, shopName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Mobile Number *</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    required 
                    placeholder="10 digit number"
                    value={leadForm.mobileNumber}
                    onChange={(e) => setLeadForm({ ...leadForm, mobileNumber: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Outlet Type *</label>
                  <select className="form-control" value={leadForm.customerType} onChange={(e) => setLeadForm({ ...leadForm, customerType: e.target.value })}>
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Super Market">Super Market</option>
                    <option value="Organic Store">Organic Store</option>
                    <option value="Medical">Medical</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Wholesaler">Wholesaler</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Billing Address - Optional</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="City / Area"
                    value={leadForm.address}
                    onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Lead (10s)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Customer Modal */}
      {showCustModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Quick Customer Enrollment</h3>
              <button type="button" onClick={() => setShowCustModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', minHeight: 0, flex: 1 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Shop / Customer Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    placeholder="e.g. Sri Balaji Organics"
                    value={custForm.name}
                    onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Mobile Number *</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    required 
                    placeholder="10 digit number"
                    value={custForm.phone}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Customer Type *</label>
                  <select className="form-control" value={custForm.customerType} onChange={(e) => setCustForm({ ...custForm, customerType: e.target.value })}>
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Super Market">Super Market</option>
                    <option value="Organic Store">Organic Store</option>
                    <option value="Medical">Medical</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>

                {gpsCoords ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', padding: '6px', background: 'rgba(34,197,94,0.1)', borderRadius: '6px', flexShrink: 0 }}>
                    🎯 Coords bound: {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)} (Address geocoded automatically on save)
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', flexShrink: 0 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Lat</label>
                      <input type="text" className="form-control" placeholder="11.01" value={custForm.latitude} onChange={(e) => setCustForm({ ...custForm, latitude: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Lng</label>
                      <input type="text" className="form-control" placeholder="76.96" value={custForm.longitude} onChange={(e) => setCustForm({ ...custForm, longitude: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCustModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>Enroll Instantly</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= BOTTOM TAB BAR (TOUCH OPTIMIZED) ================= */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        height: '64px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        zIndex: 1000
      }}>
        <button 
          type="button" 
          onClick={() => setActiveTab('home')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', gap: '2px', cursor: 'pointer', color: activeTab === 'home' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <Home size={20} style={{ strokeWidth: activeTab === 'home' ? 2.5 : 2 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'home' ? 'bold' : 'normal' }}>Home</span>
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('customers')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', gap: '2px', cursor: 'pointer', color: activeTab === 'customers' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <Users size={20} style={{ strokeWidth: activeTab === 'customers' ? 2.5 : 2 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'customers' ? 'bold' : 'normal' }}>Customers</span>
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('map')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', gap: '2px', cursor: 'pointer', color: activeTab === 'map' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <MapIcon size={20} style={{ strokeWidth: activeTab === 'map' ? 2.5 : 2 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'map' ? 'bold' : 'normal' }}>Map</span>
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('orders')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', gap: '2px', cursor: 'pointer', color: activeTab === 'orders' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <ShoppingCart size={20} style={{ strokeWidth: activeTab === 'orders' ? 2.5 : 2 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'orders' ? 'bold' : 'normal' }}>Orders</span>
        </button>
        <button 
          type="button" 
          onClick={() => setActiveTab('profile')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', gap: '2px', cursor: 'pointer', color: activeTab === 'profile' ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
        >
          <User size={20} style={{ strokeWidth: activeTab === 'profile' ? 2.5 : 2 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'profile' ? 'bold' : 'normal' }}>Profile</span>
        </button>
      </nav>
    </div>
  );
}