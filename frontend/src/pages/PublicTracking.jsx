import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../utils/url';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/shipping.css';

const erpStatuses = ['Pending', 'Packed', 'Dispatched'];
const courierStatusColors = {
  Pending: { bg: '#f3f4f6', text: '#374151', label: 'Pending' },
  'In Transit': { bg: '#eff6ff', text: '#1d4ed8', label: 'In Transit' },
  'Out For Delivery': { bg: '#fff7ed', text: '#c2410c', label: 'Out For Delivery' },
  Delivered: { bg: '#ecfdf5', text: '#047857', label: 'Delivered' },
  Returned: { bg: '#fef2f2', text: '#b91c1c', label: 'Returned' }
};

export default function PublicTracking() {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  
  const [searchCode, setSearchCode] = useState(trackingNumber || '');
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupTracking = async (code, isPoll = false) => {
    if (!code) return;
    if (!isPoll) setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_BASE_URL}/shipping/public/track/${code}`);
      setShipment(data.shipment);
    } catch (err) {
      if (!isPoll) {
        setShipment(null);
        setError(err.response?.data?.message || 'Invalid tracking number. Please verify and try again.');
      }
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    if (!trackingNumber) return;

    // Initial load
    lookupTracking(trackingNumber, false);

    // Live auto-polling every 3 seconds while shipment is not Delivered
    const interval = setInterval(() => {
      // Don't poll if already loading, or if shipment is already Delivered / Cancelled
      if (shipment && (shipment.courierStatus === 'Delivered' || shipment.status === 'Cancelled' || shipment.status === 'Returned')) {
        clearInterval(interval);
        return;
      }
      lookupTracking(trackingNumber, true);
    }, 3000);

    return () => clearInterval(interval);
  }, [trackingNumber, shipment?.courierStatus, shipment?.status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchCode.trim()) {
      navigate(`/track/${searchCode.trim()}`);
    }
  };

  const getErpTimelineClass = (statusIndex, currentStatus) => {
    const isCourierTransit = ['In Transit', 'Out For Delivery', 'Delivered', 'Returned'].includes(shipment?.courierStatus);
    const isInternalTransit = ['In Transit', 'Out For Delivery', 'Delivered', 'Returned'].includes(currentStatus);
    
    if (isCourierTransit || isInternalTransit) {
      return 'timeline-item completed';
    }
    
    const currentIndex = erpStatuses.indexOf(currentStatus);
    if (statusIndex === currentIndex) return 'timeline-item active';
    if (statusIndex < currentIndex) return 'timeline-item completed';
    return 'timeline-item';
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  const formatTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="public-tracking-viewport" style={{ 
      backgroundColor: '#f8fafc', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      fontFamily: 'Inter, sans-serif' 
    }}>
      {/* Header Bar */}
      <header className="public-track-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ 
            fontSize: '1.5rem', 
            fontWeight: 800, 
            color: '#ff9800', 
            letterSpacing: '0.03em' 
          }}>
            AO CORE ERP
          </span>
          <span style={{ 
            backgroundColor: '#fff7ed', 
            border: '1px solid #ffedd5', 
            color: '#c2410c', 
            padding: '0.2rem 0.6rem', 
            borderRadius: '6px', 
            fontSize: '0.75rem', 
            fontWeight: 600 
          }}>
            Logistics Center
          </span>
        </div>
        <span className="portal-title" style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>Customer Tracking Portal</span>
      </header>

      {/* Main Container */}
      <main style={{ 
        flex: 1, 
        width: '100%', 
        maxWidth: '780px', 
        margin: '2rem auto', 
        padding: '0 1.25rem', 
        boxSizing: 'border-box' 
      }}>
        {/* Search Panel */}
        <div className="card" style={{ 
          backgroundColor: '#fff', 
          borderRadius: '16px', 
          padding: '1.75rem', 
          boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)', 
          border: '1px solid #f1f5f9',
          marginBottom: '2rem' 
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Track Your Shipment
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0' }}>
            Enter your tracking code or AWB number below to get live delivery progress reports.
          </p>
          <form onSubmit={handleSearchSubmit} className="public-track-search-form">
            <input
              type="text"
              placeholder="e.g. KMU3903521"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              required
            />
            <button
              type="submit"
              style={{
                backgroundColor: '#ff9800',
                color: '#fff',
                padding: '0.75rem 1.75rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(255, 152, 0, 0.2)'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#e68900'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#ff9800'}
            >
              Track Order
            </button>
          </form>
        </div>

        {loading && <LoadingSpinner />}

        {error && (
          <div className="card" style={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fee2e2', 
            borderRadius: '12px', 
            padding: '1.25rem 1.75rem', 
            color: '#991b1b', 
            fontSize: '0.9rem',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Shipment Details Panel */}
        {!loading && shipment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Section 1: Order Information */}
            <div className="card" style={{ 
              backgroundColor: '#fff', 
              borderRadius: '16px', 
              padding: '1.75rem', 
              boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f1f5f9'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📋 Order & Consignment Information
              </h3>
              <div className="public-track-grid-info">
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Invoice Number</div>
                  <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{shipment.invoice?.invoiceNumber || 'N/A'}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Shipment Number</div>
                  <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{shipment.shipmentNumber}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Customer Name</div>
                  <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{shipment.invoice?.customer?.name || 'Walk-in'}</strong>
                </div>
                {shipment.trackingNumber && (
                  <>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Courier Partner</div>
                      <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{shipment.courier}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Tracking Number</div>
                      <strong style={{ color: '#ff9800', fontSize: '1rem', fontFamily: 'monospace' }}>{shipment.trackingNumber}</strong>
                    </div>
                  </>
                )}
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Shipment Date</div>
                  <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{formatDate(shipment.shipmentDate)}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Expected Delivery Date</div>
                  <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{formatDate(shipment.expectedDeliveryDate)}</strong>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Destination Address</div>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem', display: 'block', whiteSpace: 'pre-wrap' }}>
                    {shipment.shippingAddress || 'N/A'}
                  </strong>
                </div>

                {shipment.invoice?.status === 'Waiting For Stock' ? (
                  <>
                    <div>
                      <div style={{ color: '#c2410c', fontWeight: 600, marginBottom: '0.25rem' }}>ERP Internal Status</div>
                      <strong style={{ color: '#c2410c', fontSize: '0.95rem' }}>⚠️ Waiting For Stock</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Expected Dispatch Date</div>
                      <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{formatDate(shipment.invoice?.expectedDispatchDate)}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Fulfillment Commitment</div>
                      <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{shipment.invoice?.commitment || 'Within 3 Days'}</strong>
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>ERP Internal Status</div>
                    <strong style={{ color: '#16a34a', fontSize: '1rem' }}>✓ {shipment.invoice?.status || 'Confirmed'}</strong>
                  </div>
                )}
              </div>

              {shipment.invoice?.items && shipment.invoice.items.length > 0 && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem' }}>Items in this Order</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                          <th style={{ padding: '0.5rem 0.25rem', fontWeight: 600 }}>Product Name</th>
                          <th style={{ padding: '0.5rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Ordered Qty</th>
                          <th style={{ padding: '0.5rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Dispatched</th>
                          <th style={{ padding: '0.5rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Pending (Backorder)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shipment.invoice.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                            <td style={{ padding: '0.6rem 0.25rem', fontWeight: 500 }}>{item.product?.name || item.name}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>{Number(item.qty).toFixed(0)} {item.product?.unit || ''}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{Number(item.dispatchedQty || 0).toFixed(0)}</td>
                            <td style={{ padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                              {Number(item.pendingQty || 0) > 0 ? (
                                <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                  {Number(item.pendingQty).toFixed(0)}
                                </span>
                              ) : (
                                <span style={{ color: '#64748b' }}>0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: ERP Shipment Workflow (Internal Shipment Status) */}
            <div className="card" style={{ 
              backgroundColor: '#fff', 
              borderRadius: '16px', 
              padding: '1.75rem', 
              boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
              border: '1px solid #f1f5f9'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.5rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                ⚙️ Internal Shipment Status (ERP Workflow)
              </h3>
              
              <div className="timeline-tracker" style={{ padding: '0.5rem 0' }}>
                {erpStatuses.map((status, index) => {
                  const matchedLog = Array.isArray(shipment.trackingTimeline)
                    ? shipment.trackingTimeline.find((log) => log.status === status)
                    : null;

                  return (
                    <div
                      key={status}
                      className={getErpTimelineClass(index, shipment.status)}
                    >
                      <div className="timeline-dot" style={{ backgroundColor: '#ff9800' }}></div>
                      <div className="timeline-content">
                        <span className="timeline-status" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{status}</span>
                        {matchedLog ? (
                          <>
                            <span className="timeline-date" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>
                              {new Date(matchedLog.timestamp).toLocaleString('en-IN')}
                            </span>
                            <span className="timeline-desc" style={{ fontSize: '0.825rem', marginTop: '0.25rem', color: '#475569' }}>
                              {matchedLog.details}
                            </span>
                          </>
                        ) : (
                          <span className="timeline-desc" style={{ color: '#94a3b8', fontSize: '0.825rem' }}>
                            Pending warehouse verification
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Live Courier Status & Track Live Button */}
            {shipment.trackingNumber && (() => {
              const statusConfig = courierStatusColors[shipment.courierStatus || 'Pending'] || { bg: '#f3f4f6', text: '#374151', label: shipment.courierStatus };
              return (
                <div className="card" style={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '16px', 
                  padding: '1.75rem', 
                  boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #f1f5f9',
                  borderLeft: `6px solid ${statusConfig.text}`,
                  marginBottom: '2rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#0f172a' }}>
                        🌐 Live Courier Tracking
                      </h3>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Partner: <strong>{shipment.courier}</strong> | AWB: <strong style={{ color: '#0f172a' }}>{shipment.trackingNumber}</strong>
                      </span>
                    </div>
                    <span style={{
                      backgroundColor: statusConfig.bg,
                      color: statusConfig.text,
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      border: `1px solid ${statusConfig.text}20`
                    }}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="public-track-grid-courier">
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Last Known Location</div>
                      <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{shipment.lastKnownLocation || 'Origin Facility'}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Current Status</div>
                      <strong style={{ color: statusConfig.text, fontSize: '1rem' }}>{shipment.courierStatus || 'Pending'}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Delivery / Update Date</div>
                      <strong style={{ color: '#0f172a', fontSize: '1rem' }}>
                        {shipment.courierStatus === 'Delivered' 
                          ? formatDate(shipment.courierDeliveredDate) 
                          : formatDate(shipment.updatedAt)}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.open(`https://trackcourier.io/track-and-trace/professional-courier/${shipment.trackingNumber}`, '_blank')}
                    style={{
                      width: '100%',
                      backgroundColor: statusConfig.text,
                      color: '#fff',
                      padding: '0.875rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                      transition: 'filter 0.2s',
                      marginTop: '1rem'
                    }}
                    onMouseOver={(e) => e.target.style.filter = 'brightness(90%)'}
                    onMouseOut={(e) => e.target.style.filter = 'none'}
                  >
                    🚀 Track Live Courier Page
                  </button>
                </div>
              );
            })()}

            {/* Section 4: Courier Tracking History (Hops Timeline Card) */}
            {shipment.trackingNumber && (
              <div className="card" style={{ 
                backgroundColor: '#fff', 
                borderRadius: '16px', 
                padding: '1.75rem', 
                boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.05)',
                border: '1px solid #f1f5f9'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.5rem 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                  📍 Courier Transit History (AWB Milestone Log)
                </h3>

                {Array.isArray(shipment.courierTimeline) && shipment.courierTimeline.length > 0 ? (
                  <div className="timeline-tracker" style={{ padding: '0.5rem 0' }}>
                    {shipment.courierTimeline.map((hop, index) => (
                      <div
                        key={index}
                        className="timeline-item completed"
                      >
                        <div className="timeline-dot" style={{ backgroundColor: '#ff9800' }}></div>
                        <div className="timeline-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                            <span className="timeline-status" style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>
                              {hop.status}
                            </span>
                            <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', padding: '0.1rem 0.5rem', borderRadius: '4px', color: '#64748b', fontWeight: 600 }}>
                              {hop.courier || shipment.courier}
                            </span>
                          </div>
                          <span className="timeline-date" style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', margin: '0.25rem 0' }}>
                            {formatDate(hop.timestamp)} at {formatTime(hop.timestamp)}
                          </span>
                          <div style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
                            Location: <strong style={{ color: '#1e293b' }}>{hop.location}</strong>
                          </div>
                          {hop.details && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.125rem', fontStyle: 'italic' }}>
                              {hop.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    Awaiting first scanning milestone at origin courier dispatch terminal.
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        backgroundColor: '#fff', 
        borderTop: '1px solid #e2e8f0', 
        padding: '1.5rem', 
        textAlign: 'center', 
        fontSize: '0.8125rem', 
        color: '#64748b',
        boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.03)'
      }}>
        © 2026 AO Core Organic Products. All rights reserved. Powered by AO Core Logistics.
      </footer>
    </div>
  );
}
