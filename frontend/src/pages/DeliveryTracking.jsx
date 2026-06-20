import { useState, useEffect } from 'react';
import { shippingApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const primaryColor = '#5a2d0c';

export default function DeliveryTracking() {
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [activeTab, setActiveTab] = useState('Pending'); // Pending, Dispatched, Delivered

  useEffect(() => {
    const loadShipments = async () => {
      try {
        const res = await shippingApi.list({ limit: 100 });
        setShipments(res.data.shipments || []);
      } catch (err) {
        console.error('Error fetching shipments for delivery tracker:', err);
      } finally {
        setLoading(false);
      }
    };
    loadShipments();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await shippingApi.updateStatus(id, {
        status,
        remarks: `Updated by delivery staff to: ${status}`,
        trackingTimelineDetails: `Location updated in transit. Status: ${status}`
      });
      alert(`Shipment status updated to ${status} successfully! 🟢`);
      
      // Reload shipments list
      const res = await shippingApi.list({ limit: 100 });
      setShipments(res.data.shipments || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update shipment status.');
    }
  };

  const handleSendWhatsAppUpdate = (shipment) => {
    let phoneNum = shipment.invoice?.customer?.phone || '';
    let cleanPhone = phoneNum.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
    if (!cleanPhone) {
      alert('No customer phone number available.');
      return;
    }

    const trackingLink = `${window.location.origin}/track/${shipment.trackingNumber || shipment.shipmentNumber}`;
    const msg = `Dear ${shipment.invoice?.customer?.name || 'Customer'},\n\nYour delivery ${shipment.shipmentNumber} is out for delivery with vehicle: ${shipment.vehicleNumber || 'Staff'}.\nExpected arrival: 3:00 PM today.\n\nTrack here: ${trackingLink}\n\nAmudhasurabiy Organics`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  if (loading) return <LoadingSpinner />;

  // Filter shipments based on driver assignment & status
  // For demo/billing purposes, if none are assigned specifically, list general ones
  const filteredShipments = shipments.filter(s => {
    if (activeTab === 'Pending') {
      return s.status === 'Pending' || s.status === 'Packed';
    } else if (activeTab === 'Dispatched') {
      return s.status === 'Dispatched' || s.status === 'In Transit' || s.status === 'Out For Delivery';
    } else {
      return s.status === 'Delivered' || s.status === 'Cancelled' || s.status === 'Returned';
    }
  });

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🚚 SFA Delivery Intelligence & Tracking</h1>
        <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Assign delivery channels, monitor expected arrival windows, and record completed drops.</p>
      </div>

      {/* Driver Console Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'Pending', label: '📦 Warehouse Packing queue' },
          { key: 'Dispatched', label: '🚚 Active Dispatches' },
          { key: 'Delivered', label: '✅ Completed drops' }
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === tab.key ? primaryColor : '#64748b',
              borderBottom: activeTab === tab.key ? `3px solid ${primaryColor}` : '3px solid transparent',
              marginBottom: '-10px',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left List: Shipment Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredShipments.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              No shipments found in this category.
            </div>
          ) : (
            filteredShipments.map(s => (
              <div 
                key={s.id} 
                className="card" 
                style={{ 
                  padding: '1.25rem', 
                  backgroundColor: '#fff', 
                  borderRadius: '12px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'monospace', color: primaryColor }}>{s.shipmentNumber}</span>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{s.status}</span>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '0.25rem' }}>
                    Customer: <strong>{s.invoice?.customer?.name || 'Retailer'}</strong>
                    {s.invoice?.customer?.customerCode && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        marginLeft: '0.35rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {s.invoice.customer.customerCode}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>Weight: {s.packageWeight || 1.5} kg</span>
                    <span>•</span>
                    <span>Zone: {s.invoice?.customer?.territory || 'Default'}</span>
                  </div>
                </div>

                {/* Routing / Expected details */}
                <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>Assigned Route: <strong>{s.deliveryRoute || 'Route Route A'}</strong></div>
                  <div>Vehicle: <strong>{s.vehicleNumber || 'TN-38-AX-4820'}</strong></div>
                  <div>Commitment: <strong style={{ color: primaryColor }}>{s.deliveryCommitment || 'Same Day'}</strong></div>
                </div>

                {/* Tracking trigger buttons based on status */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {s.status === 'Pending' && (
                    <button 
                      type="button" 
                      onClick={() => handleUpdateStatus(s.id, 'Packed')}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', fontWeight: 'bold' }}
                    >
                      📦 Mark Packed
                    </button>
                  )}
                  {s.status === 'Packed' && (
                    <button 
                      type="button" 
                      onClick={() => handleUpdateStatus(s.id, 'Dispatched')}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 'bold' }}
                    >
                      🚚 Mark Dispatched
                    </button>
                  )}
                  {['Dispatched', 'In Transit'].includes(s.status) && (
                    <button 
                      type="button" 
                      onClick={() => handleUpdateStatus(s.id, 'Out For Delivery')}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem', borderColor: '#10b981', color: '#10b981', fontWeight: 'bold' }}
                    >
                      🛵 Out For Delivery
                    </button>
                  )}
                  {s.status === 'Out For Delivery' && (
                    <>
                      <button 
                        type="button" 
                        onClick={() => handleSendWhatsAppUpdate(s)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, fontSize: '0.75rem', color: '#2563eb', borderColor: '#2563eb', fontWeight: 'bold' }}
                      >
                        💬 Notify Client
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleUpdateStatus(s.id, 'Delivered')}
                        className="btn btn-success btn-sm"
                        style={{ flex: 1, fontSize: '0.75rem', fontWeight: 'bold' }}
                      >
                        ✅ Completed drops
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Map & Route details */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>📍 Active Driver Route Map</h2>
          
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Today's Delivery Sequence Summary</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
              Ensure delivery orders are completed sequentially. Cutoff validations are calculated automatically on order receipt.
            </p>
          </div>

          {/* Simple Vector Map for Deliveries */}
          <div style={{ width: '100%', height: '260px', backgroundColor: '#0f172a', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
            {/* Simulation of a driver map */}
            <svg width="100%" height="100%">
              {/* Path */}
              <path d="M 50 200 Q 150 50, 250 200 T 450 100" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="6,6" />
              
              {/* Pins */}
              <circle cx="50" cy="200" r="8" fill="#10b981" stroke="#fff" strokeWidth="2" />
              <text x="65" y="205" fill="#fff" fontSize="10">AO Warehouse</text>

              <circle cx="200" cy="120" r="8" fill={primaryColor} stroke="#fff" strokeWidth="2" />
              <text x="215" y="125" fill="#fff" fontSize="10">Stop 1 (Pending)</text>

              <circle cx="380" cy="150" r="8" fill={primaryColor} stroke="#fff" strokeWidth="2" />
              <text x="395" y="155" fill="#fff" fontSize="10">Stop 2 (Out For Delivery)</text>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
