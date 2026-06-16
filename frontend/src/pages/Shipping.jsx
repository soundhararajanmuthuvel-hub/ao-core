import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { shippingApi, salesApi, courierApi } from '../api';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import '../styles/shipping.css';

const statuses = ['Pending', 'Packed', 'Dispatched', 'In Transit', 'Out For Delivery', 'Delivered', 'Returned', 'Cancelled'];

const COLORS = ['#ff9800', '#0369a1', '#4f46e5', '#3b82f6', '#ec4899', '#10b981', '#ef4444', '#6b7280'];

const formatPackSize = (weight) => {
  if (!weight) return 'N/A';
  const w = Number(weight);
  if (w >= 1) return `${w.toFixed(1)} Kg`;
  return `${Math.round(w * 1000)} g`;
};

const formatTotalWeight = (weight, qty) => {
  if (!weight) return 'N/A';
  const total = Number(weight) * Number(qty);
  if (total >= 1) return `${total.toFixed(2)} Kg`;
  return `${Math.round(total * 1000)} g`;
};

export default function Shipping() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shipments, setShipments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);

  // Pagination / Search
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Shipment Details
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals & Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    invoiceId: '',
    courierId: '',
    courier: 'Professional Couriers',
    trackingNumber: '',
    shippingAddress: '',
    expectedDeliveryDate: '',
    packageWeight: '',
    packageCount: 1,
    remarks: '',
  });

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: 'Pending',
    courierStatus: 'Pending',
    details: '',
    location: '',
  });

  // Courier Master Modals & Forms
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [courierEditId, setCourierEditId] = useState(null);
  const [courierForm, setCourierForm] = useState({
    name: '',
    phone: '',
    website: '',
    trackingUrlFormat: '',
  });

  // Communication Simulator
  const [simNotification, setSimNotification] = useState(null); // { method, message, recipient }
  const [isSimulating, setIsSimulating] = useState(false);
  const [slipSubTab, setSlipSubTab] = useState('packing');
  const location = useLocation();

  const loadCouriers = useCallback(async () => {
    try {
      const { data } = await courierApi.list();
      setCouriers(data.couriers || []);
    } catch {
      toast('Failed to load couriers list', 'error');
    }
  }, [toast]);

  const loadAnalytics = useCallback(async () => {
    try {
      const { data } = await shippingApi.getAnalytics();
      setAnalytics(data);
    } catch {
      toast('Failed to load shipping analytics', 'error');
    }
  }, [toast]);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shippingApi.list({
        page,
        search,
        status: statusFilter,
        limit: 10,
      });
      setShipments(data.shipments);
      setPages(data.pages);
    } catch {
      toast('Failed to load shipments list', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, toast]);

  const loadInvoices = useCallback(async () => {
    try {
      const { data } = await salesApi.list({ limit: 100 });
      setInvoices(data.sales || []);
      return data.sales || [];
    } catch {
      toast('Failed to load invoices list', 'error');
      return [];
    }
  }, [toast]);

  const loadShipmentDetail = async (id) => {
    setDetailLoading(true);
    try {
      const { data } = await shippingApi.get(id);
      setSelectedShipment(data.shipment);
    } catch {
      toast('Failed to retrieve shipment details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadAnalytics();
      loadShipments();
    } else if (activeTab === 'ledger') {
      loadShipments();
    } else if (activeTab === 'couriers') {
      loadCouriers();
    }
  }, [activeTab, loadShipments, loadAnalytics, loadCouriers]);

  useEffect(() => {
    loadCouriers();
    loadInvoices();
  }, [loadCouriers, loadInvoices]);

  useEffect(() => {
    // 1. Check if we should auto-select a shipment from localStorage
    const savedShipmentId = localStorage.getItem('select_shipment_id');
    if (savedShipmentId) {
      localStorage.removeItem('select_shipment_id');
      loadShipmentDetail(savedShipmentId);
      setActiveTab('details');
    }

    // 2. Check if we should auto-open Create Shipment modal for a specific invoice
    const params = new URLSearchParams(location.search);
    const invoiceIdParam = params.get('createForInvoice');
    if (invoiceIdParam) {
      loadInvoices().then((invs) => {
        const selectedInv = invs.find(inv => String(inv.id || inv._id) === invoiceIdParam);
        setCreateForm(prev => ({
          ...prev,
          invoiceId: invoiceIdParam,
          shippingAddress: selectedInv?.customer?.address || '',
        }));
        setShowCreateModal(true);
      });
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search, loadInvoices]);

  useEffect(() => {
    if (selectedShipment) {
      if (selectedShipment.trackingNumber) {
        setSlipSubTab('tracking');
      } else {
        setSlipSubTab('packing');
      }
    }
  }, [selectedShipment?.id, selectedShipment?.trackingNumber]);

  const handleCreate = async () => {
    if (!createForm.invoiceId) {
      return toast('Please select an invoice to ship', 'warning');
    }
    try {
      await shippingApi.create(createForm);
      toast('Shipment record created successfully', 'success');
      setShowCreateModal(false);
      setCreateForm({
        invoiceId: '',
        courierId: '',
        courier: 'Professional Couriers',
        trackingNumber: '',
        shippingAddress: '',
        expectedDeliveryDate: '',
        packageWeight: '',
        packageCount: 1,
        remarks: '',
      });
      loadShipments();
      loadAnalytics();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create shipment', 'error');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedShipment) return;
    try {
      const { data } = await shippingApi.updateStatus(selectedShipment.id, statusForm);
      toast(`Shipment status updated successfully`, 'success');
      setSelectedShipment(data.shipment);
      setShowStatusModal(false);
      setStatusForm({ status: 'Pending', courierStatus: 'Pending', details: '', location: '' });
      loadShipments();
      loadAnalytics();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // Timeline Step-by-Step Simulator
  const handleSimulateLogistics = async () => {
    if (!selectedShipment) return;
    
    const currentErpStatus = selectedShipment.status;
    const currentCourierStatus = selectedShipment.courierStatus || 'Pending';

    if (currentCourierStatus === 'Delivered') {
      return toast('Shipment is already delivered!', 'info');
    }
    if (currentErpStatus === 'Cancelled' || currentCourierStatus === 'Returned') {
      return toast('Cannot simulate updates for cancelled/returned packages.', 'warning');
    }

    if (['Pending', 'Packed'].includes(currentErpStatus)) {
      // Advance ERP Status: Pending -> Packed -> Dispatched
      let nextErpStatus = 'Packed';
      let details = 'Package sealed at AO Warehouse.';
      if (currentErpStatus === 'Packed') {
        nextErpStatus = 'Dispatched';
        details = 'Handed over to courier driver.';
      }
      try {
        const { data } = await shippingApi.updateStatus(selectedShipment.id, {
          status: nextErpStatus,
          details
        });
        toast(`Simulated: ERP status transitioned to ${nextErpStatus}`, 'success');
        setSelectedShipment(data.shipment);
        loadShipments();
        loadAnalytics();
      } catch (err) {
        toast(err.response?.data?.message || 'Logistics simulation failed', 'error');
      }
    } else {
      // ERP is Dispatched. Now advance Courier Status: Pending -> In Transit -> Out For Delivery -> Delivered
      let nextCourierStatus = 'In Transit';
      let details = 'Package arrived at Bengaluru Sort Facility.';
      let location = 'Bengaluru Sorting Center';

      if (currentCourierStatus === 'In Transit') {
        nextCourierStatus = 'Out For Delivery';
        details = 'Out for local delivery with courier associate.';
        location = 'Local Hub';
      } else if (currentCourierStatus === 'Out For Delivery') {
        nextCourierStatus = 'Delivered';
        details = 'Delivered and signed by consignee.';
        location = 'Destination';
      }

      try {
        const { data } = await shippingApi.updateStatus(selectedShipment.id, {
          courierStatus: nextCourierStatus,
          details,
          location
        });
        toast(`Simulated: Courier status transitioned to ${nextCourierStatus}`, 'success');
        setSelectedShipment(data.shipment);
        loadShipments();
        loadAnalytics();
      } catch (err) {
        toast(err.response?.data?.message || 'Logistics simulation failed', 'error');
      }
    }
  };

  // Auto Timeline step-by-step Simulator
  const handleAutoSimulate = async () => {
    if (!selectedShipment || isSimulating) return;
    setIsSimulating(true);
    
    let currentShipment = selectedShipment;
    
    // We will keep running simulation steps until it reaches Delivered
    while (currentShipment && currentShipment.courierStatus !== 'Delivered') {
      const currentErpStatus = currentShipment.status;
      const currentCourierStatus = currentShipment.courierStatus || 'Pending';
      
      if (currentCourierStatus === 'Delivered') break;
      if (currentErpStatus === 'Cancelled' || currentCourierStatus === 'Returned') {
        toast('Cannot auto-simulate cancelled or returned shipments.', 'warning');
        break;
      }
      
      let payload = {};
      if (['Pending', 'Packed'].includes(currentErpStatus)) {
        let nextErpStatus = 'Packed';
        let details = 'Package sealed at AO Warehouse.';
        if (currentErpStatus === 'Packed') {
          nextErpStatus = 'Dispatched';
          details = 'Handed over to courier driver.';
        }
        payload = { status: nextErpStatus, details };
      } else {
        let nextCourierStatus = 'In Transit';
        let details = 'Package arrived at Bengaluru Sort Facility.';
        let location = 'Bengaluru Sorting Center';

        if (currentCourierStatus === 'In Transit') {
          nextCourierStatus = 'Out For Delivery';
          details = 'Out for local delivery with courier associate.';
          location = 'Local Hub';
        } else if (currentCourierStatus === 'Out For Delivery') {
          nextCourierStatus = 'Delivered';
          details = 'Delivered and signed by consignee.';
          location = 'Destination';
        }
        payload = { courierStatus: nextCourierStatus, details, location };
      }

      try {
        const { data } = await shippingApi.updateStatus(currentShipment.id, payload);
        currentShipment = data.shipment;
        setSelectedShipment(data.shipment);
        loadShipments();
        loadAnalytics();
        
        // Wait 1.5 seconds between steps for nice visual pacing
        if (currentShipment.courierStatus !== 'Delivered') {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (err) {
        toast(err.response?.data?.message || 'Auto-simulation interrupted', 'error');
        break;
      }
    }
    toast('Auto-simulation completed successfully!', 'success');
    setIsSimulating(false);
  };

  const handleNotify = async (method) => {
    if (!selectedShipment) return;
    try {
      const { data } = await shippingApi.notify(selectedShipment.id, { method });
      setSimNotification({
        method,
        message: data.messageContent,
        recipient: data.recipient,
      });

      const customer = selectedShipment.invoice?.customer;
      const messageText = data.messageContent || '';

      if (method === 'whatsapp') {
        const rawPhone = customer?.phone || '';
        const formattedPhone = rawPhone.replace(/\D/g, '');
        let finalPhone = formattedPhone;
        if (formattedPhone.length === 10) {
          finalPhone = `91${formattedPhone}`;
        }
        const waUrl = finalPhone
          ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(messageText)}`
          : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
        toast('Opening WhatsApp window...', 'success');
      } else if (method === 'email') {
        const mailToUrl = `mailto:${customer?.email || ''}?subject=${encodeURIComponent(`Shipment Dispatch: ${selectedShipment.shipmentNumber}`)}&body=${encodeURIComponent(messageText)}`;
        window.open(mailToUrl, '_self');
        toast('Opening email composer...', 'success');
      } else if (method === 'sms') {
        const smsUrl = `sms:${customer?.phone || ''}?body=${encodeURIComponent(messageText)}`;
        window.open(smsUrl, '_self');
        toast('Opening SMS composer...', 'success');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Notification dispatch failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this shipment record?')) return;
    try {
      await shippingApi.remove(id);
      toast('Shipment deleted successfully', 'success');
      setSelectedShipment(null);
      loadShipments();
      loadAnalytics();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete shipment', 'error');
    }
  };

  // Courier Master CRUD operations
  const handleCourierSave = async () => {
    if (!courierForm.name) {
      return toast('Please enter courier name', 'warning');
    }
    try {
      if (courierEditId) {
        await courierApi.update(courierEditId, courierForm);
        toast('Courier partner details updated', 'success');
      } else {
        await courierApi.create(courierForm);
        toast('Courier partner registered successfully', 'success');
      }
      setShowCourierModal(false);
      setCourierForm({ name: '', phone: '', website: '', trackingUrlFormat: '' });
      setCourierEditId(null);
      loadCouriers();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const openCourierEdit = (c) => {
    setCourierForm({
      name: c.name,
      phone: c.phone || '',
      website: c.website || '',
      trackingUrlFormat: c.trackingUrlFormat || '',
    });
    setCourierEditId(c.id);
    setShowCourierModal(true);
  };

  const handleCourierDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this courier partner?')) return;
    try {
      await courierApi.remove(id);
      toast('Courier deactivated', 'success');
      loadCouriers();
    } catch (err) {
      toast(err.response?.data?.message || 'Deactivation failed', 'error');
    }
  };

  const selectShipment = (shipment) => {
    loadShipmentDetail(shipment.id);
    if (shipment.trackingNumber) {
      setSlipSubTab('tracking');
    } else {
      setSlipSubTab('packing');
    }
    setActiveTab('details');
  };

  const getTimelineClass = (statusIndex, currentStatus) => {
    const currentIndex = statuses.indexOf(currentStatus);
    if (statusIndex === currentIndex) return 'timeline-item active';
    if (statusIndex < currentIndex) return 'timeline-item completed';
    return 'timeline-item';
  };

  const getErpTimelineClass = (status, currentStatus) => {
    const erpOrder = ['Pending', 'Packed', 'Dispatched'];
    if (currentStatus === 'Cancelled') {
      return status === 'Cancelled' ? 'timeline-item active error' : 'timeline-item';
    }
    const isCourierTransit = ['In Transit', 'Out For Delivery', 'Delivered', 'Returned'].includes(selectedShipment?.courierStatus);
    const isInternalTransit = ['In Transit', 'Out For Delivery', 'Delivered', 'Returned'].includes(currentStatus);
    if (isCourierTransit || isInternalTransit) {
      return 'timeline-item completed';
    }
    const currentIndex = erpOrder.indexOf(currentStatus);
    const statusIndex = erpOrder.indexOf(status);
    if (statusIndex === currentIndex) return 'timeline-item active';
    if (statusIndex < currentIndex) return 'timeline-item completed';
    return 'timeline-item';
  };

  const getCourierTimelineClass = (status, currentStatus) => {
    const courierOrder = ['Pending', 'In Transit', 'Out For Delivery', 'Delivered'];
    if (currentStatus === 'Returned') {
      return status === 'Returned' ? 'timeline-item active error' : 'timeline-item completed';
    }
    const currentIndex = courierOrder.indexOf(currentStatus);
    const statusIndex = courierOrder.indexOf(status);
    if (statusIndex === currentIndex) return 'timeline-item active';
    if (statusIndex < currentIndex) return 'timeline-item completed';
    return 'timeline-item';
  };

  const handlePrint = () => {
    window.print();
  };

  // Mock document actions
  const handleMockDownload = () => {
    toast('Delivery Slip PDF downloaded successfully (Simulated)', 'success');
  };

  const handleMockEmail = () => {
    const customer = selectedShipment?.invoice?.customer;
    const trackingNum = selectedShipment?.trackingNumber || '';
    const origin = window.location.origin;
    const publicTrackLink = `${origin}/track/${trackingNum}`;
    const text = `Hello ${customer?.name || 'Customer'},\n\nHere is your Delivery Slip for Invoice ${selectedShipment?.invoice?.invoiceNumber || ''}.\n\nTrack your shipment live here:\n${publicTrackLink}\n\nThank you,\nAO Core ERP`;
    
    const mailToUrl = `mailto:${customer?.email || ''}?subject=${encodeURIComponent(`Delivery Slip: ${selectedShipment?.shipmentNumber || ''}`)}&body=${encodeURIComponent(text)}`;
    window.open(mailToUrl, '_self');
    toast(`Email composer opened for ${customer?.name || 'customer'}`, 'success');
  };

  const handleMockWhatsApp = () => {
    const customer = selectedShipment?.invoice?.customer;
    const phone = customer?.phone || '';
    const formattedPhone = phone.replace(/\D/g, '');
    let finalPhone = formattedPhone;
    if (formattedPhone.length === 10) {
      finalPhone = `91${formattedPhone}`;
    }
    const trackingNum = selectedShipment?.trackingNumber || '';
    const origin = window.location.origin;
    const publicTrackLink = `${origin}/track/${trackingNum}`;
    const text = `Hello ${customer?.name || 'Customer'},\n\nHere is your Delivery Slip for Invoice ${selectedShipment?.invoice?.invoiceNumber || ''}.\n\nTrack your shipment live here:\n${publicTrackLink}\n\nThank you,\nAO Core ERP`;
    
    const waUrl = finalPhone
      ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
    toast(`WhatsApp opened for ${customer?.name || 'customer'}`, 'success');
  };

  return (
    <div className="page shipping-container" style={{ '--primary-color': '#ff9800' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#ff9800' }}>📦</span> Shipping & Order Delivery
          </h1>
          <p className="page-subtitle">
            Generate courier delivery slips, manage tracking codes, inspect logistics timelines, and track dashboards.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }}
            onClick={() => setShowCreateModal(true)}
          >
            + New Shipment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rm-tabs-bar">
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('dashboard');
            setSimNotification(null);
          }}
        >
          📈 Dashboard Overview
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ledger');
            setSimNotification(null);
          }}
        >
          📋 Shipments Ledger
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'couriers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('couriers');
            setSimNotification(null);
          }}
        >
          🚚 Courier Master
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
          disabled={!selectedShipment}
        >
          👁️ Timeline Detail {selectedShipment && `(${selectedShipment.shipmentNumber})`}
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'slip' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('slip');
            setSimNotification(null);
          }}
          disabled={!selectedShipment}
        >
          📄 Delivery Slip
        </button>
      </div>

      {loading && (activeTab === 'ledger' || activeTab === 'dashboard') ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && analytics && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Stat Cards Grid */}
              <div className="rm-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #1f2937' }}>
                  <span className="rm-card-label">TOTAL SHIPMENTS</span>
                  <span className="rm-card-value">{analytics.cards.totalShipments}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #6b7280' }}>
                  <span className="rm-card-label">PENDING</span>
                  <span className="rm-card-value" style={{ color: '#6b7280' }}>{analytics.cards.pending}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #ff9800' }}>
                  <span className="rm-card-label">PACKED</span>
                  <span className="rm-card-value" style={{ color: '#ff9800' }}>{analytics.cards.packed}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #4f46e5' }}>
                  <span className="rm-card-label">DISPATCHED</span>
                  <span className="rm-card-value" style={{ color: '#4f46e5' }}>{analytics.cards.dispatched}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                  <span className="rm-card-label">IN TRANSIT</span>
                  <span className="rm-card-value" style={{ color: '#3b82f6' }}>{analytics.cards.inTransit}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <span className="rm-card-label">OUT FOR DELIVERY</span>
                  <span className="rm-card-value" style={{ color: '#f59e0b' }}>{analytics.cards.outForDelivery}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #10b981' }}>
                  <span className="rm-card-label">DELIVERED</span>
                  <span className="rm-card-value" style={{ color: '#10b981' }}>{analytics.cards.delivered}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <span className="rm-card-label">RETURNED</span>
                  <span className="rm-card-value" style={{ color: '#ef4444' }}>{analytics.cards.returned}</span>
                </div>
                <div className="rm-metric-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                  <span className="rm-card-label">DISPATCHES TODAY</span>
                  <span className="rm-card-value" style={{ color: '#06b6d4' }}>{analytics.cards.todaysDispatches}</span>
                </div>
              </div>

              {/* Charts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* Courier Volume */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>Shipment Volume by Courier</h3>
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.charts.courierChart}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="courier" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="total" name="Total Shipments" fill="#ff9800" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Average Delivery Days */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>Average Delivery Time (Days)</h3>
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.charts.avgDeliveryTimeChart}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="courier" />
                        <YAxis unit=" days" />
                        <Tooltip formatter={(value) => [`${value} days`, 'Avg Delivery Time']} />
                        <Bar dataKey="avgDays" name="Average Days" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Delivered vs Returned Pie Chart */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>Delivered vs Returned Ratio</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
                    <div style={{ width: '60%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.charts.deliveredVsReturnedChart.filter(s => s.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analytics.charts.deliveredVsReturnedChart.filter(s => s.value > 0).map((entry, index) => {
                              const colors = { Delivered: '#10b981', Returned: '#ef4444' };
                              return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#6b7280'} />;
                            })}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ width: '40%', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {analytics.charts.deliveredVsReturnedChart.map((entry) => {
                        const dotColors = { Delivered: '#10b981', Returned: '#ef4444' };
                        return (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dotColors[entry.name] || '#6b7280' }}></span>
                            <span>{entry.name}: <strong>{entry.value}</strong></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Delivery success rate gauge card */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 600 }}>DELIVERY SUCCESS RATE</span>
                  <div style={{ position: 'relative', width: '160px', height: '160px', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeDasharray={`${analytics.cards.successRate}, 100`}
                      />
                    </svg>
                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>
                        {analytics.cards.successRate}%
                      </span>
                      <span style={{ fontSize: '0.625rem', color: '#6b7280', fontWeight: 700 }}>SUCCESS</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '1rem 0 0 0' }}>
                    Ratio of delivered consignments against total resolved shipments.
                  </p>
                </div>

              </div>

              {/* Recent Dispatches table summary */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1f2937' }}>Recent Dispatched Shipments</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Shipment #</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Courier</th>
                        <th>Tracking Number</th>
                        <th>Expected Delivery</th>
                        <th>ERP Status</th>
                        <th>Courier Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments.slice(0, 5).map((s) => (
                        <tr key={s.id}>
                          <td>
                            <button
                              type="button"
                              className="btn-link"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff9800',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              onClick={() => selectShipment(s)}
                            >
                              {s.shipmentNumber}
                            </button>
                          </td>
                          <td>{s.invoice?.invoiceNumber || 'N/A'}</td>
                          <td>{s.invoice?.customer?.name || 'Walk-in'}</td>
                          <td>{s.courier}</td>
                          <td><code>{s.trackingNumber}</code></td>
                          <td>
                            {s.expectedDeliveryDate ? new Date(s.expectedDeliveryDate).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td>
                            <span className={`status-badge status-${s.status.toLowerCase().replace(/ /g, '')}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${(s.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`}>
                              {s.courierStatus || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="card">
              <div
                className="filters-bar"
                style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}
              >
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: '300px' }}
                  placeholder="Search shipment number or tracking..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <select
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shipment #</th>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Courier</th>
                      <th>Tracking Number</th>
                      <th>Weight / Count</th>
                      <th>Expected Delivery</th>
                      <th>ERP Status</th>
                      <th>Courier Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => {
                      const dateStr = s.expectedDeliveryDate
                        ? new Date(s.expectedDeliveryDate).toLocaleDateString('en-IN')
                        : 'N/A';
                      return (
                        <tr key={s.id}>
                          <td>
                            <button
                              type="button"
                              className="btn-link"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ff9800',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              onClick={() => selectShipment(s)}
                            >
                              {s.shipmentNumber}
                            </button>
                          </td>
                          <td>{s.invoice?.invoiceNumber || 'N/A'}</td>
                          <td>{s.invoice?.customer?.name || 'Walk-in'}</td>
                          <td>{s.courier}</td>
                          <td>
                            <code>{s.trackingNumber || 'N/A'}</code>
                          </td>
                          <td>
                            {s.packageWeight ? `${s.packageWeight} Kg` : 'N/A'} / {s.packageCount || 1} box
                          </td>
                          <td>{dateStr}</td>
                          <td>
                            <span className={`status-badge status-${s.status.toLowerCase().replace(/ /g, '')}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${(s.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`}>
                              {s.courierStatus || 'Pending'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => selectShipment(s)}
                            >
                              Track
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(s.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {shipments.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', color: '#9ca3af' }}>
                          No shipment records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} onPageChange={setPage} />
            </div>
          )}

          {/* Courier Master Tab */}
          {activeTab === 'couriers' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Active Courier Channels</h3>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }}
                  onClick={() => {
                    setCourierForm({ name: '', phone: '', website: '', trackingUrlFormat: '' });
                    setCourierEditId(null);
                    setShowCourierModal(true);
                  }}
                >
                  + Add Courier
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Courier Name</th>
                      <th>Contact Number</th>
                      <th>Website URL</th>
                      <th>Tracking URL Format</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couriers.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.phone || 'N/A'}</td>
                        <td>
                          {c.website ? (
                            <a href={c.website} target="_blank" rel="noreferrer" style={{ color: '#ff9800' }}>
                              {c.website}
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td><code>{c.trackingUrlFormat || 'N/A'}</code></td>
                        <td>
                          <span className={`rm-badge ${c.isActive ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openCourierEdit(c)}
                          >
                            Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCourierDelete(c.id)}
                            disabled={!c.isActive}
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {couriers.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>
                          No courier partners registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Details / Tracking Tab */}
          {activeTab === 'details' && selectedShipment && (
            <div className="shipping-layout with-sidebar">
              {detailLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <div className="card">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                        Timeline Logistics: {selectedShipment.shipmentNumber}
                      </h2>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#ff9800', color: '#ff9800' }}
                          onClick={handleSimulateLogistics}
                          disabled={isSimulating || ['Delivered', 'Cancelled', 'Returned'].includes(selectedShipment.status)}
                        >
                          ⚡ Simulate Step
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#10b981', color: '#10b981' }}
                          onClick={handleAutoSimulate}
                          disabled={isSimulating || ['Delivered', 'Cancelled', 'Returned'].includes(selectedShipment.courierStatus)}
                        >
                          {isSimulating ? '⏳ Simulating...' : '🚀 Auto-Simulate (Full Route)'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setStatusForm({
                              status: selectedShipment.status,
                              details: '',
                            });
                            setShowStatusModal(true);
                          }}
                        >
                          🔄 Set Status
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveTab('slip')}
                        >
                          📄 Delivery Slip
                        </button>
                      </div>
                    </div>

                    {/* Timeline Tracker */}
                    <div className="timeline-card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Left Side: Internal ERP Status Timeline */}
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                            ⚙️ Internal ERP Status
                          </h3>
                          <div className="timeline-tracker">
                            {['Pending', 'Packed', 'Dispatched', ...(selectedShipment.status === 'Cancelled' ? ['Cancelled'] : [])].map((status) => {
                              const matchedLog = Array.isArray(selectedShipment.trackingTimeline)
                                ? selectedShipment.trackingTimeline.find((log) => log.status === status)
                                : null;

                              return (
                                <div
                                  key={status}
                                  className={getErpTimelineClass(status, selectedShipment.status)}
                                >
                                  <div className="timeline-dot" style={{ backgroundColor: '#ff9800' }}></div>
                                  <div className="timeline-content">
                                    <span className="timeline-status" style={{ fontWeight: 600 }}>{status}</span>
                                    {matchedLog ? (
                                      <>
                                        <span className="timeline-date">
                                          {new Date(matchedLog.timestamp).toLocaleString('en-IN')}
                                        </span>
                                        <span className="timeline-desc">{matchedLog.details}</span>
                                      </>
                                    ) : (
                                      <span className="timeline-desc" style={{ color: '#9ca3af' }}>
                                        Awaiting ERP checkpoint
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Right Side: Live Courier Status Timeline */}
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                            🚚 Live Courier Status
                          </h3>
                          <div className="timeline-tracker">
                            {['Pending', 'In Transit', 'Out For Delivery', 'Delivered', ...(selectedShipment.courierStatus === 'Returned' ? ['Returned'] : [])].map((status) => {
                              const matchedLog = Array.isArray(selectedShipment.courierTimeline)
                                ? selectedShipment.courierTimeline.find((log) => 
                                    log.status === status || (status === 'Pending' && log.status === 'Booked')
                                  )
                                : null;

                              return (
                                <div
                                  key={status}
                                  className={getCourierTimelineClass(status, selectedShipment.courierStatus || 'Pending')}
                                >
                                  <div className="timeline-dot" style={{ backgroundColor: '#3b82f6' }}></div>
                                  <div className="timeline-content">
                                    <span className="timeline-status" style={{ fontWeight: 600 }}>{status}</span>
                                    {matchedLog ? (
                                      <>
                                        <span className="timeline-date">
                                          {new Date(matchedLog.timestamp).toLocaleString('en-IN')}
                                        </span>
                                        {matchedLog.location && (
                                          <span className="timeline-desc" style={{ fontWeight: 600, color: '#4b5563', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                                            Location: {matchedLog.location}
                                          </span>
                                        )}
                                        <span className="timeline-desc">{matchedLog.details}</span>
                                      </>
                                    ) : (
                                      <span className="timeline-desc" style={{ color: '#9ca3af' }}>
                                        Awaiting courier scan
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar notifications */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Notify Panel */}
                    <div className="card">
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        ✉️ Customer Dispatch
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
                        Notify customer with live tracking link and generated delivery slip attachments.
                      </p>

                      <div className="channel-buttons">
                        <button
                          type="button"
                          className="channel-btn whatsapp"
                          onClick={() => handleNotify('whatsapp')}
                        >
                          <span className="channel-btn-icon">💬</span>
                          <span>WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          className="channel-btn email"
                          onClick={() => handleNotify('email')}
                        >
                          <span className="channel-btn-icon">✉️</span>
                          <span>Email</span>
                        </button>
                        <button
                          type="button"
                          className="channel-btn sms"
                          onClick={() => handleNotify('sms')}
                        >
                          <span className="channel-btn-icon">📱</span>
                          <span>SMS</span>
                        </button>
                      </div>

                      {simNotification && (
                        <div>
                          <div
                            style={{
                              marginTop: '1.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#10b981',
                            }}
                          >
                            ✓ Sent simulated {simNotification.method.toUpperCase()} to{' '}
                            {simNotification.recipient}
                          </div>
                          <div className="sim-message-box">{simNotification.message}</div>
                        </div>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div className="card">
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        📦 Package Details
                      </h3>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>
                          <strong>Courier:</strong> {selectedShipment.courier}
                        </div>
                        <div>
                          <strong>Tracking Code:</strong>{' '}
                          <code>{selectedShipment.trackingNumber || 'N/A'}</code>
                        </div>
                        <div>
                          <strong>Weight (kg):</strong> {selectedShipment.packageWeight || '0.00'} Kg
                        </div>
                        <div>
                          <strong>Box Count:</strong> {selectedShipment.packageCount || 1}
                        </div>
                        <div>
                          <strong>Expected Delivery:</strong>{' '}
                          {selectedShipment.expectedDeliveryDate
                            ? new Date(selectedShipment.expectedDeliveryDate).toLocaleDateString('en-IN')
                            : 'N/A'}
                        </div>
                        <div>
                          <strong>Recipient:</strong> {selectedShipment.invoice?.customer?.name || 'Walk-in'}
                        </div>
                        <div>
                          <strong>Remarks:</strong> {selectedShipment.remarks || 'N/A'}
                        </div>
                        <div>
                          <strong>Shipping Address:</strong>
                          <p
                            style={{
                              color: '#6b7280',
                              fontSize: '0.8125rem',
                              marginTop: '0.25rem',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {selectedShipment.shippingAddress || 'No shipping address provided.'}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
          )}

          {/* Delivery Slip Tab */}
          {activeTab === 'slip' && selectedShipment && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveTab('details')}
                >
                  ← Back to Tracking
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleMockDownload}>
                    📥 Download PDF
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleMockEmail}>
                    ✉️ Email PDF
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleMockWhatsApp}>
                    💬 WhatsApp PDF
                  </button>
                  <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handlePrint}>
                    🖨️ Print Slip
                  </button>
                </div>
              </div>

              {/* Sub-tab Navigation (Only if tracking number exists) */}
              {selectedShipment.trackingNumber && (
                <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', overflowX: 'auto', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <button
                    key="packing"
                    type="button"
                    className={`rm-tab-btn ${slipSubTab === 'packing' ? 'active' : ''}`}
                    onClick={() => setSlipSubTab('packing')}
                    style={{
                      padding: '0.5rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: slipSubTab === 'packing' ? '#fff' : 'transparent',
                      color: slipSubTab === 'packing' ? '#ff9800' : '#64748b',
                      boxShadow: slipSubTab === 'packing' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    📦 Warehouse Packing Slip
                  </button>
                  <button
                    key="tracking"
                    type="button"
                    className={`rm-tab-btn ${slipSubTab === 'tracking' ? 'active' : ''}`}
                    onClick={() => setSlipSubTab('tracking')}
                    style={{
                      padding: '0.5rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: slipSubTab === 'tracking' ? '#fff' : 'transparent',
                      color: slipSubTab === 'tracking' ? '#ff9800' : '#64748b',
                      boxShadow: slipSubTab === 'tracking' ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    🚚 Shipment Tracking Slip
                  </button>
                </div>
              )}

              {/* Slip Layout Container */}
              <div className="delivery-slip-paper">
                {!selectedShipment.trackingNumber || slipSubTab === 'packing' ? (
                  /* --- WAREHOUSE PACKING SLIP --- */
                  <div>
                    <div className="slip-header" style={{ borderBottom: '2px solid #ff9800' }}>
                      <div className="slip-logo-title">
                        <span className="slip-logo" style={{ color: '#ff9800' }}>
                          {settings?.companyName ? settings.companyName : 'Amudhasurabiy Organics'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {settings?.address || '123 Wellness Way, Green Valley'}
                        </span>
                      </div>
                      <div className="slip-meta">
                        <span className="slip-title" style={{ color: '#ff9800' }}>Warehouse Packing Slip</span>
                        <span style={{ fontSize: '0.875rem' }}>
                          <strong>Slip #:</strong> {selectedShipment.shipmentNumber}
                        </span>
                        <span style={{ fontSize: '0.875rem' }}>
                          <strong>Invoice #:</strong> {selectedShipment.invoice?.invoiceNumber}
                        </span>
                      </div>
                    </div>

                    <div className="slip-addresses" style={{ marginBottom: '1.5rem' }}>
                      <div className="slip-address-block">
                        <h4>From</h4>
                        <p>
                          <strong>{settings?.companyName || 'Amudhasurabiy Organics'}</strong>
                          <br />
                          {settings?.address || '123 Wellness Way, Green Valley'}
                          <br />
                          GSTIN: {settings?.gstDetails || '29AAAAA1111A1Z1'}
                        </p>
                      </div>
                      <div className="slip-address-block">
                        <h4>Ship To</h4>
                        <p>
                          <strong>{selectedShipment.invoice?.customer?.name || 'Customer'}</strong>
                          <br />
                          {selectedShipment.invoice?.customer?.businessName && (
                            <>
                              {selectedShipment.invoice.customer.businessName}
                              <br />
                            </>
                          )}
                          {selectedShipment.shippingAddress || 'Walk-in Address'}
                          {selectedShipment.invoice?.customer?.phone && (
                            <>
                              <br />
                              Phone: {selectedShipment.invoice.customer.phone}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Orange Highlighted Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ border: '1px solid #ff9800', borderLeft: '4px solid #ff9800', padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fff8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#ff9800', fontWeight: 'bold' }}>PARCEL COUNT</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.packageCount || 1} Box(es)
                        </div>
                      </div>
                      <div style={{ border: '1px solid #ff9800', borderLeft: '4px solid #ff9800', padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fff8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#ff9800', fontWeight: 'bold' }}>PARCEL WEIGHT</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.packageWeight ? `${selectedShipment.packageWeight} Kg` : 'N/A'}
                        </div>
                      </div>
                      <div style={{ border: '1px solid #ff9800', borderLeft: '4px solid #ff9800', padding: '0.75rem', borderRadius: '6px', backgroundColor: '#fff8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#ff9800', fontWeight: 'bold' }}>DISPATCH DATE</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1f2937', marginTop: '0.125rem' }}>
                          {new Date(selectedShipment.shipmentDate || selectedShipment.createdAt).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Parcel Details Section */}
                    <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '1rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600' }}>Total Unique Items</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.invoice?.items?.length || 0} SKU(s)
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600' }}>Total Item Quantity</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.invoice?.items?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0} Unit(s)
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600' }}>Parcel Ident.</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937', marginTop: '0.125rem' }}>
                          Parcel 1 of {selectedShipment.packageCount || 1}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600' }}>Gross Weight</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.packageWeight ? `${selectedShipment.packageWeight} Kg` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: '600' }}>Shipping Zone</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1f2937', marginTop: '0.125rem' }}>
                          {selectedShipment.invoice?.customer?.state || 'Local Zone'}
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <table className="slip-table" style={{ marginBottom: '1.5rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '60px' }}>Item #</th>
                          <th>Product Description</th>
                          <th>Pack Size</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Total Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedShipment.invoice?.items?.map((item, idx) => (
                          <tr key={item.id}>
                            <td>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.name || item.product?.name}</div>
                              {item.product?.sku && <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>SKU: {item.product.sku}</div>}
                            </td>
                            <td>{formatPackSize(item.product?.weight)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(item.qty).toFixed(0)}</td>
                            <td style={{ textAlign: 'right' }}>{formatTotalWeight(item.product?.weight, item.qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedShipment.remarks && (
                      <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <strong>Remarks:</strong> {selectedShipment.remarks}
                      </div>
                    )}

                    {/* Interactive Checklist */}
                    <div className="slip-checklist" style={{ marginTop: '1.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                      <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                        📋 Warehouse Dispatch Checklist
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        {[
                          'Product Verified',
                          'Quantity Verified',
                          'Packed Correctly',
                          'Address Label Attached',
                          'Ready For Dispatch'
                        ].map((item) => (
                          <label key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', cursor: 'pointer' }}>
                            <input type="checkbox" style={{ width: '1.1rem', height: '1.1rem', accentColor: '#ff9800', cursor: 'pointer' }} />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Footer / Signature */}
                    <div className="slip-footer">
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0' }}>
                          Prepared By: <strong>{selectedShipment.createdBy?.name || 'AO Core Associate'}</strong>
                        </p>
                        <p style={{ margin: 0, fontSize: '0.6875rem' }}>
                          This is an internal warehouse dispatch check sheet. Not for customer invoice purposes.
                        </p>
                      </div>
                      <div style={{ textAlign: 'center', width: '200px' }}>
                        <div style={{ borderBottom: '1px solid #1f2937', height: '40px', marginBottom: '0.25rem' }}></div>
                        <span>Packer / Dispatcher Signature</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* --- SHIPMENT TRACKING SLIP --- */
                  <div>
                    <div className="slip-header" style={{ borderBottom: '2px solid #3b82f6' }}>
                      <div className="slip-logo-title">
                        <span className="slip-logo" style={{ color: '#3b82f6' }}>
                          {settings?.companyName ? settings.companyName : 'Amudhasurabiy Organics'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {settings?.address || '123 Wellness Way, Green Valley'}
                        </span>
                      </div>
                      <div className="slip-meta">
                        <span className="slip-title" style={{ color: '#3b82f6' }}>Shipment Tracking Slip</span>
                        <span style={{ fontSize: '0.875rem' }}>
                          <strong>Slip #:</strong> {selectedShipment.shipmentNumber}
                        </span>
                        <span style={{ fontSize: '0.875rem' }}>
                          <strong>Invoice #:</strong> {selectedShipment.invoice?.invoiceNumber}
                        </span>
                      </div>
                    </div>

                    <div className="slip-addresses" style={{ marginBottom: '1.5rem' }}>
                      <div className="slip-address-block">
                        <h4>From</h4>
                        <p>
                          <strong>{settings?.companyName || 'Amudhasurabiy Organics'}</strong>
                          <br />
                          {settings?.address || '123 Wellness Way, Green Valley'}
                          <br />
                          GSTIN: {settings?.gstDetails || '29AAAAA1111A1Z1'}
                        </p>
                      </div>
                      <div className="slip-address-block">
                        <h4>Ship To</h4>
                        <p>
                          <strong>{selectedShipment.invoice?.customer?.name || 'Customer'}</strong>
                          <br />
                          {selectedShipment.invoice?.customer?.businessName && (
                            <>
                              {selectedShipment.invoice.customer.businessName}
                              <br />
                            </>
                          )}
                          {selectedShipment.shippingAddress || 'Walk-in Address'}
                          {selectedShipment.invoice?.customer?.phone && (
                            <>
                              <br />
                              Phone: {selectedShipment.invoice.customer.phone}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Tracking details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginBottom: '2rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: 0, border: 'none', padding: 0 }}>Courier Service Partner</h4>
                          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1f2937', marginTop: '0.25rem' }}>{selectedShipment.courier}</div>
                        </div>
                        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: 0, border: 'none', padding: 0 }}>Tracking AWB Number</h4>
                          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ff9800', marginTop: '0.25rem', fontFamily: 'monospace' }}>{selectedShipment.trackingNumber || 'N/A'}</div>
                        </div>
                        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: 0, border: 'none', padding: 0 }}>Expected Delivery</h4>
                          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1f2937', marginTop: '0.25rem' }}>
                            {selectedShipment.expectedDeliveryDate ? new Date(selectedShipment.expectedDeliveryDate).toLocaleDateString('en-IN') : 'N/A'}
                          </div>
                        </div>
                        <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', margin: 0, border: 'none', padding: 0 }}>Shipment Status</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <span className={`status-badge status-${selectedShipment.status.toLowerCase().replace(/ /g, '')}`}>
                              ERP: {selectedShipment.status}
                            </span>
                            <span className={`status-badge status-${(selectedShipment.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`}>
                              Courier: {selectedShipment.courierStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', padding: '1.5rem', borderRadius: '12px', backgroundColor: '#f9fafb' }}>
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/track/${selectedShipment.trackingNumber}`)}`}
                          alt="Tracking QR Code"
                          style={{ width: '120px', height: '120px', marginBottom: '0.75rem', border: '4px solid white', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600', marginBottom: '0.5rem' }}>Scan to Track Live</span>
                        <a 
                          href={`${window.location.origin}/track/${selectedShipment.trackingNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 'bold', textDecoration: 'underline' }}
                        >
                          Open Tracking Link
                        </a>
                      </div>
                    </div>

                    <table className="slip-table" style={{ marginBottom: '2.5rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Item #</th>
                          <th>Product Description</th>
                          <th>SKU</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedShipment.invoice?.items?.map((item, idx) => (
                          <tr key={item.id}>
                            <td>{idx + 1}</td>
                            <td>{item.name || item.product?.name}</td>
                            <td>{item.product?.sku || 'N/A'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {selectedShipment.remarks && (
                      <div style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
                        <strong>Remarks:</strong> {selectedShipment.remarks}
                      </div>
                    )}

                    <div className="slip-footer">
                      <div>
                        <p style={{ margin: '0 0 0.25rem 0' }}>
                          Prepared By: {selectedShipment.createdBy?.name || 'AO Core Associate'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.6875rem' }}>
                          This is a computer-generated shipment tracking slip. Verified tracking status applies.
                        </p>
                      </div>
                      <div className="slip-signature">
                        <div className="slip-signature-line"></div>
                        <span>Authorized Signature</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal - Create Shipment */}
      {showCreateModal && (
        <Modal
          title="Register New Shipment"
          onClose={() => setShowCreateModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handleCreate}>
                Register Shipment
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Sales Invoice</label>
              <select
                className="form-control"
                value={createForm.invoiceId}
                onChange={(e) => {
                  const invId = e.target.value;
                  const selectedInv = invoices.find((inv) => String(inv.id) === invId);
                  setCreateForm({
                    ...createForm,
                    invoiceId: invId,
                    shippingAddress: selectedInv?.customer?.address || '',
                  });
                }}
              >
                <option value="">Select Invoice</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} - {inv.customer?.name || 'Walk-in'} (₹{Number(inv.grandTotal).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="rm-grid-form">
              <div className="form-group">
                <label>Courier Service</label>
                <select
                  className="form-control"
                  value={createForm.courierId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const match = couriers.find(c => String(c.id) === cid);
                    setCreateForm({
                      ...createForm,
                      courierId: cid,
                      courier: match ? match.name : 'Professional Couriers'
                    });
                  }}
                >
                  <option value="">Select Courier Partner</option>
                  {couriers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tracking Number (Blank to Auto-Generate)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. TRK981245"
                  value={createForm.trackingNumber}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, trackingNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="rm-grid-form">
              <div className="form-group">
                <label>Package Weight (Kg)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 15.30"
                  value={createForm.packageWeight}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, packageWeight: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Box Count / Packages Qty</label>
                <input
                  type="number"
                  className="form-control"
                  value={createForm.packageCount}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, packageCount: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label>Expected Delivery Date</label>
              <input
                type="date"
                className="form-control"
                value={createForm.expectedDeliveryDate}
                onChange={(e) =>
                  setCreateForm({ ...createForm, expectedDeliveryDate: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Shipping Address</label>
              <textarea
                className="form-control"
                rows="3"
                value={createForm.shippingAddress}
                onChange={(e) =>
                  setCreateForm({ ...createForm, shippingAddress: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label>Remarks / Shipment Notes</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="e.g. Fragile amber glass, handle with care"
                value={createForm.remarks}
                onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - Update Status */}
      {showStatusModal && (
        <Modal
          title="Update Shipment Status"
          onClose={() => setShowStatusModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handleUpdateStatus}>
                Update Status
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Internal ERP Status</label>
              <select
                className="form-control"
                value={statusForm.status}
                onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              >
                {['Pending', 'Packed', 'Dispatched', 'Cancelled'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Live Courier Status</label>
              <select
                className="form-control"
                value={statusForm.courierStatus}
                onChange={(e) => setStatusForm({ ...statusForm, courierStatus: e.target.value })}
              >
                {['Pending', 'In Transit', 'Out For Delivery', 'Delivered', 'Returned'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Location / City</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Bengaluru Sorting Center"
                value={statusForm.location || ''}
                onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Timeline Transition Details</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="e.g. Package arrived at sorting facility."
                value={statusForm.details}
                onChange={(e) => setStatusForm({ ...statusForm, details: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - Courier partner CRUD */}
      {showCourierModal && (
        <Modal
          title={courierEditId ? 'Edit Courier Partner' : 'Register Courier Partner'}
          onClose={() => setShowCourierModal(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCourierModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={handleCourierSave}>
                Save Courier
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Courier Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. DTDC Express"
                value={courierForm.name}
                onChange={(e) => setCourierForm({ ...courierForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 1800-209-3030"
                value={courierForm.phone}
                onChange={(e) => setCourierForm({ ...courierForm, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Website URL</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. https://www.dtdc.in/"
                value={courierForm.website}
                onChange={(e) => setCourierForm({ ...courierForm, website: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tracking URL Format</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. https://www.dtdc.in/track?awb=${trackingNumber}"
                value={courierForm.trackingUrlFormat}
                onChange={(e) => setCourierForm({ ...courierForm, trackingUrlFormat: e.target.value })}
              />
              <small style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Use <code>{"${trackingNumber}"}</code> placeholder where the tracking code should be injected.
              </small>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
