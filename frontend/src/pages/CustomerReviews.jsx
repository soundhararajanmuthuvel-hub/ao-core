import { useState, useEffect } from 'react';
import { crmApi, salesApi } from '../api';
import { Star, MessageSquare, Plus, Check, Send, AlertCircle, ShoppingCart } from 'lucide-react';

export default function CustomerReviews() {
  const [reviewsData, setReviewsData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteResponse, setInviteResponse] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [revRes, salesRes] = await Promise.all([
        crmApi.getReviews(),
        salesApi.list({ limit: 100 })
      ]);
      setReviewsData(revRes.data);
      // Filter invoices that are delivered or completed to request reviews
      setInvoices(salesRes.data?.sales || []);
      if (salesRes.data?.sales?.length > 0) {
        setSelectedInvoiceId(salesRes.data.sales[0].id);
      }
    } catch (err) {
      console.error('Error loading reviews metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceId) return alert('Please select an invoice.');
    try {
      const res = await crmApi.sendReviewLink({ invoiceId: parseInt(selectedInvoiceId) });
      setInviteResponse(res.data);
      setInviteModalOpen(true);
      // Refresh list to show pending review
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating review link');
    }
  };

  const handleOpenWhatsapp = () => {
    if (inviteResponse?.whatsappUrl) {
      window.open(inviteResponse.whatsappUrl, '_blank');
      setInviteModalOpen(false);
      setInviteResponse(null);
    }
  };

  const renderStars = (rating) => {
    return (
      <div style={{ display: 'flex', gap: '0.15rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            fill={i < Math.round(rating) ? '#f59e0b' : 'none'}
            color={i < Math.round(rating) ? '#f59e0b' : 'var(--text-muted)'}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  const {
    averageOverallRating = 5.0,
    totalReviewsSubmitted = 0,
    reviews = []
  } = reviewsData || {};

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Customer Reviews & NPS</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Monitor client feedback, product quality ratings, delivery response, and salesman behaviors.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.5fr', gap: '1.5rem' }} className="form-row">
        {/* LEFT COLUMN: SATISFACTION SUMMARY & INVITE GENERATOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* NPS Score Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Average Satisfaction Rating</span>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--brand-primary)', margin: '0.5rem 0' }}>{averageOverallRating}</div>
            <div style={{ marginBottom: '1rem' }}>{renderStars(averageOverallRating)}</div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Based on {totalReviewsSubmitted} completed customer surveys</span>
          </div>

          {/* Invitation Link Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="var(--brand-primary)" /> Generate Feedback Invite
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>Select an invoice to generate a unique token link. Sends a formatted template invite via WhatsApp.</p>
            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Select Invoice / Customer</label>
                <select
                  className="form-control"
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                >
                  <option value="" disabled>— Select Invoice —</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customer?.name} (₹{inv.grandTotal?.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <Plus size={16} /> Generate Review Link
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: REVIEWS FEED */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={18} color="var(--brand-primary)" /> Customer Feedback Feed
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
            {reviews.length === 0 ? (
              <div className="empty-state" style={{ margin: 'auto' }}>
                <MessageSquare size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <h3>No surveys completed yet</h3>
                <p style={{ fontSize: '0.85rem' }}>Send invite links using the form to collect product, delivery, and sales executive ratings.</p>
              </div>
            ) : (
              reviews.map((rev) => {
                const subDate = new Date(rev.createdAt);
                return (
                  <div key={rev.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 700 }}>{rev.customer?.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Invoice {rev.invoice?.invoiceNumber} • {subDate.toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {renderStars(rev.overallRating)}
                        <span className="badge badge-success" style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                          Status: {rev.status}
                        </span>
                      </div>
                    </div>

                    {rev.status === 'Submitted' ? (
                      <div>
                        {/* Breakdowns */}
                        <div style={{ display: 'flex', gap: '1.5rem', margin: '0.6rem 0', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            Product Quality: <strong>{rev.productRating}/5</strong>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            Delivery Speed: <strong>{rev.deliveryRating}/5</strong>
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            Salesman Behaviour: <strong>{rev.salesmanRating}/5</strong>
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--bg-page)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                          "{rev.comment || 'No written comment recorded.'}"
                        </p>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Waiting for customer rating form submission...
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* WHATSAPP INVITE MODAL */}
      {inviteModalOpen && inviteResponse && (
        <div className="modal-overlay" onClick={() => setInviteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 800 }}>WhatsApp Invitation Link</h3>
              <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setInviteModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.2)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#166534' }}>
                <Check size={18} /> Unique feedback token successfully created!
              </div>

              <div className="form-group">
                <label>Message Content Preview</label>
                <textarea
                  className="form-control"
                  readOnly
                  rows="6"
                  style={{ background: 'var(--bg-page)', fontSize: '0.8rem', resize: 'none' }}
                  value={inviteResponse.messageText}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setInviteModalOpen(false)}>Close</button>
              <button type="button" className="btn btn-whatsapp" onClick={handleOpenWhatsapp} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Send size={14} /> Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
