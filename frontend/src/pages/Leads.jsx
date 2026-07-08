import { useState, useEffect } from 'react';
import { crmApi, usersApi, aiApi } from '../api';
import { Plus, Search, Filter, Phone, Mail, MapPin, CheckSquare, FileText, UserPlus, Trash, Edit, RefreshCw, Brain } from 'lucide-react';
import AIInsightsModal from '../components/AIInsightsModal';

const LEAD_CATEGORIES = [
  'Organic Store',
  'Nattu Marundhu Kadai',
  'Health Food Store',
  'Ayurvedic Shop',
  'Millet Store',
  'Dry Fruit Shop',
  'Supermarket',
  'Mini Supermarket',
  'Department Store',
  'Provision Store',
  'General Retail Store',
  'Medical Shop',
  'Baby Store',
  'Nutrition Store',
  'Wellness Store',
  'Wholesale Dealer',
  'Distributor',
  'Organic Farm'
];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // AI Insights State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  
  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState('');

  // Selected Lead Drawer
  const [selectedLead, setSelectedLead] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  // Lead Form State
  const [formData, setFormData] = useState({
    shopName: '',
    category: 'Organic Store',
    ownerName: '',
    mobileNumber: '',
    address: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    latitude: '',
    longitude: '',
    website: '',
    source: 'Google Business',
    status: 'New',
    assignedSalesmanId: ''
  });

  // Follow-up Scheduler Form
  const [followUpForm, setFollowUpForm] = useState({
    followUpDate: '',
    type: 'Call Customer',
    notes: ''
  });

  // Notes Form
  const [noteText, setNoteText] = useState('');

  // Load Data
  const loadLeads = async () => {
    try {
      setLoading(true);
      const params = {
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        assignedSalesmanId: salesmanFilter || undefined
      };
      const res = await crmApi.getLeads(params);
      setLeads(res.data);

      // Load all leads to compute dashboard statistics cards
      const allRes = await crmApi.getLeads({});
      setAllLeads(allRes.data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, categoryFilter, salesmanFilter]);

  useEffect(() => {
    const loadSalesmen = async () => {
      try {
        const res = await usersApi.list({ limit: 100 });
        setSalesmen(res.data?.users || []);
      } catch (err) {
        console.error('Error fetching salesmen:', err);
      }
    };
    loadSalesmen();
  }, []);

  // Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLeads();
  };

  // Create Lead
  const handleAddLead = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...formData };
      if (dataToSubmit.latitude) dataToSubmit.latitude = parseFloat(dataToSubmit.latitude);
      if (dataToSubmit.longitude) dataToSubmit.longitude = parseFloat(dataToSubmit.longitude);
      if (!dataToSubmit.assignedSalesmanId) delete dataToSubmit.assignedSalesmanId;

      await crmApi.createLead(dataToSubmit);
      setAddModalOpen(false);
      resetForm();
      loadLeads();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating lead');
    }
  };

  // Update Lead
  const handleEditLead = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...formData };
      if (dataToSubmit.latitude) dataToSubmit.latitude = parseFloat(dataToSubmit.latitude);
      if (dataToSubmit.longitude) dataToSubmit.longitude = parseFloat(dataToSubmit.longitude);
      
      await crmApi.updateLead(selectedLead.id, dataToSubmit);
      setEditModalOpen(false);
      loadLeads();
      // Reload detail view
      const detailRes = await crmApi.getLead(selectedLead.id);
      setSelectedLead(detailRes.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating lead');
    }
  };

  // Convert Lead
  const handleConvertLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to convert this Lead into a Customer Master? This will auto-assign IDs based on territory GPS and migrate note/visit logs.')) return;
    try {
      const res = await crmApi.convertLead(leadId);
      alert(res.data.message || 'Converted successfully!');
      setDetailOpen(false);
      loadLeads();
    } catch (err) {
      alert(err.response?.data?.message || 'Error converting lead');
    }
  };

  // Delete Lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await crmApi.deleteLead(leadId);
      setDetailOpen(false);
      loadLeads();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting lead');
    }
  };

  // Add Follow Up
  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpForm.followUpDate) return alert('Please enter follow-up date.');
    try {
      await crmApi.createFollowUp({
        leadId: selectedLead.id,
        followUpDate: followUpForm.followUpDate,
        type: followUpForm.type,
        notes: followUpForm.notes,
        status: 'Pending'
      });
      alert('Follow-up scheduled!');
      setFollowUpForm({ followUpDate: '', type: 'Call Customer', notes: '' });
      // Refresh details
      const detailRes = await crmApi.getLead(selectedLead.id);
      setSelectedLead(detailRes.data);
    } catch (err) {
      alert('Failed to schedule follow-up');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      shopName: '',
      category: 'Organic Store',
      ownerName: '',
      mobileNumber: '',
      address: '',
      city: '',
      state: 'Tamil Nadu',
      pincode: '',
      latitude: '',
      longitude: '',
      website: '',
      source: 'Google Business',
      status: 'New',
      assignedSalesmanId: ''
    });
  };

  const openEditModal = (lead) => {
    setFormData({
      shopName: lead.shopName || '',
      category: lead.category || 'Organic Store',
      ownerName: lead.ownerName || '',
      mobileNumber: lead.mobileNumber || '',
      address: lead.address || '',
      city: lead.city || '',
      state: lead.state || 'Tamil Nadu',
      pincode: lead.pincode || '',
      latitude: lead.latitude || '',
      longitude: lead.longitude || '',
      website: lead.website || '',
      source: lead.source || 'Google Business',
      status: lead.status || 'New',
      assignedSalesmanId: lead.assignedSalesmanId || ''
    });
    setEditModalOpen(true);
  };

  const selectLeadForDetails = async (lead) => {
    try {
      const res = await crmApi.getLead(lead.id);
      setSelectedLead(res.data);
      setDetailOpen(true);
    } catch (err) {
      alert('Could not retrieve lead details');
    }
  };

  const handleAnalyzeLeads = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsights('');
    try {
      const res = await aiApi.analyzeLeads();
      setAiInsights(res.data.reply);
    } catch (err) {
      setAiInsights('Failed to generate lead analysis. Please verify your backend API connection and Gemini credentials.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>CRM Leads</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Manage contacts, check-ins, followups, and conversion flow.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => { resetForm(); setAddModalOpen(true); }}>
            <Plus size={18} /> New Lead
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Leads Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #3b82f6', margin: 0 }}>
          <div style={{ fontSize: '1.75rem' }}>📊</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{allLeads.length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Leads</div>
          </div>
        </div>

        {/* Organic Stores Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #22c55e', margin: 0 }}>
          <div style={{ fontSize: '1.75rem' }}>🌱</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{allLeads.filter(l => l.category === 'Organic Store').length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Organic Stores</div>
          </div>
        </div>

        {/* Supermarkets Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #eab308', margin: 0 }}>
          <div style={{ fontSize: '1.75rem' }}>🛒</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{allLeads.filter(l => l.category === 'Supermarket').length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Supermarkets</div>
          </div>
        </div>

        {/* Medical Shops Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #ec4899', margin: 0 }}>
          <div style={{ fontSize: '1.75rem' }}>💊</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{allLeads.filter(l => l.category === 'Medical Shop').length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Medical Shops</div>
          </div>
        </div>

        {/* Converted Customers Card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: '5px solid #a855f7', margin: 0 }}>
          <div style={{ fontSize: '1.75rem' }}>👤</div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{allLeads.filter(l => l.status === 'Customer').length}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Converted Customers</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <form onSubmit={handleSearchSubmit} className="filters-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search Shop, Owner, or City..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Visited">Visited</option>
            <option value="Interested">Interested</option>
            <option value="Customer">Converted Customer</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
          >
            <option value="">All Categories</option>
            {LEAD_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            value={salesmanFilter} 
            onChange={(e) => setSalesmanFilter(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
          >
            <option value="">All Salesmen</option>
            {salesmen.filter(u => u.role === 'Salesman').map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-secondary">
            Apply Filters
          </button>
        </form>
      </div>

      {/* Grid / Table list */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : leads.length === 0 ? (
        <div className="card empty-state">
          <h3>No Leads Found</h3>
          <p>Create a new lead manually or use the Lead Finder to search local stores.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-table-container card table-wrap" style={{ padding: 0 }}>
            <table className="data-table customers-table">
              <thead>
                <tr>
                  <th>Shop Name</th>
                  <th>Category</th>
                  <th>Mobile</th>
                  <th>City</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  let badgeColor = 'badge-warning';
                  if (lead.status === 'New') badgeColor = 'badge-warning';
                  if (lead.status === 'Contacted') badgeColor = 'badge-info';
                  if (lead.status === 'Visited') badgeColor = 'badge-info';
                  if (lead.status === 'Interested') badgeColor = 'badge-success';
                  if (lead.status === 'Customer') badgeColor = 'badge-success';
                  if (lead.status === 'Rejected') badgeColor = 'badge-danger';

                  return (
                    <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => selectLeadForDetails(lead)}>
                      <td style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{lead.shopName}</td>
                      <td>{lead.category}</td>
                      <td>{lead.mobileNumber || '—'}</td>
                      <td>{lead.city || '—'}</td>
                      <td>
                        <span className={`badge ${badgeColor}`}>{lead.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-outline-primary btn-sm" onClick={() => selectLeadForDetails(lead)} title="View Details" style={{ marginRight: '0.25rem' }}>
                          <FileText size={14} /> View
                        </button>
                        <button className="btn btn-icon btn-sm" onClick={() => openEditModal(lead)} title="Edit Lead" style={{ marginRight: '0.25rem' }}>
                          <Edit size={14} /> Edit
                        </button>
                        {lead.status !== 'Customer' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleConvertLead(lead.id)} title="Convert to Customer" style={{ marginRight: '0.25rem' }}>
                            <UserPlus size={14} /> Convert
                          </button>
                        )}
                        <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteLead(lead.id)} title="Delete Lead">
                          <Trash size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-card-list" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
            {leads.map((lead) => {
              let badgeColor = 'badge-warning';
              if (lead.status === 'New') badgeColor = 'badge-warning';
              if (lead.status === 'Contacted') badgeColor = 'badge-info';
              if (lead.status === 'Visited') badgeColor = 'badge-info';
              if (lead.status === 'Interested') badgeColor = 'badge-success';
              if (lead.status === 'Customer') badgeColor = 'badge-success';
              if (lead.status === 'Rejected') badgeColor = 'badge-danger';

              // Clean phone for calls / WhatsApp
              const cleanPhone = lead.mobileNumber ? lead.mobileNumber.replace(/\D/g, '') : '';
              const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;

              return (
                <div key={lead.id} className="mobile-card" onClick={() => selectLeadForDetails(lead)}>
                  <div className="mobile-card-header">
                    <div>
                      <strong className="mobile-card-title">{lead.shopName}</strong>
                      <div className="mobile-card-subtitle">{lead.category}</div>
                    </div>
                    <span className={`badge ${badgeColor}`}>{lead.status}</span>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Mobile</span>
                      <span className="mobile-card-value">{lead.mobileNumber || '—'}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">City</span>
                      <span className="mobile-card-value">{lead.city || '—'}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Source</span>
                      <span className="mobile-card-value">{lead.source || '—'}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Salesman</span>
                      <span className="mobile-card-value">{lead.assignedSalesman?.name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                    {cleanPhone && (
                      <>
                        <a href={`tel:${cleanPhone}`} className="mobile-action-btn phone">📞 Call</a>
                        <a href={`https://wa.me/${waPhone}?text=Hello%20${encodeURIComponent(lead.shopName)}`} target="_blank" rel="noreferrer" className="mobile-action-btn whatsapp">💬 WA</a>
                      </>
                    )}
                    {lead.status !== 'Customer' && (
                      <button type="button" className="mobile-action-btn primary" onClick={() => handleConvertLead(lead.id)}>👤 Convert</button>
                    )}
                    <button type="button" className="mobile-action-btn secondary" onClick={() => openEditModal(lead)}>✏️ Edit</button>
                    <button type="button" className="mobile-action-btn" style={{ borderColor: '#f87171', color: '#ef4444' }} onClick={() => handleDeleteLead(lead.id)}>🗑️ Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* DETAIL DRAWER / SLIDE-OUT PANEL */}
      {detailOpen && selectedLead && (
        <div className="modal-overlay" onClick={() => setDetailOpen(false)}>
          <div className="modal" style={{ maxWidth: '640px', height: '100vh', maxHeight: '100vh', margin: 0, position: 'fixed', right: 0, top: 0, bottom: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 800 }}>{selectedLead.shopName}</h3>
                <span className="badge badge-success" style={{ marginTop: '0.25rem' }}>{selectedLead.status}</span>
              </div>
              <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setDetailOpen(false)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Segment</span>
                  <strong style={{ fontSize: '0.9rem' }}>{selectedLead.category}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Owner</span>
                  <strong style={{ fontSize: '0.9rem' }}>{selectedLead.ownerName || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Mobile</span>
                  <strong style={{ fontSize: '0.9rem' }}><Phone size={12} /> {selectedLead.mobileNumber || '—'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Salesman</span>
                  <strong style={{ fontSize: '0.9rem' }}>{selectedLead.salesman?.name || 'Unassigned'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>Address</span>
                  <strong style={{ fontSize: '0.85rem' }}><MapPin size={12} /> {selectedLead.address || '—'}, {selectedLead.city}, {selectedLead.pincode}</strong>
                </div>
              </div>

              {/* Quick Conversion CTA */}
              {selectedLead.status !== 'Customer' && (
                <div className="card" style={{ background: 'rgba(90, 45, 12, 0.05)', border: '1px solid rgba(90, 45, 12, 0.2)', marginBottom: '1.5rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, color: 'var(--brand-primary)' }}>Convert to Customer</h4>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Instantly assign territory coordinates & generate customer ID.</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => handleConvertLead(selectedLead.id)}>
                    Convert Now
                  </button>
                </div>
              )}

              {/* Follow-up Scheduler Form */}
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                  <CheckSquare size={16} /> Schedule Next Follow-up
                </h4>
                <form onSubmit={handleAddFollowUp} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Date & Time</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={followUpForm.followUpDate}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, followUpDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Type</label>
                      <select
                        className="form-control"
                        value={followUpForm.type}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                      >
                        <option value="Call Customer">Call Customer</option>
                        <option value="Visit Customer">Visit Customer</option>
                        <option value="Send Catalog">Send Catalog</option>
                        <option value="Send Offer">Send Offer</option>
                        <option value="Send Sample">Send Sample</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Task Note</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Discuss repack deal values..."
                      value={followUpForm.notes}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
                    Schedule
                  </button>
                </form>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(selectedLead)} style={{ flex: 1 }}>
                  Edit Details
                </button>
                <button className="btn btn-outline-danger btn-sm" onClick={() => handleDeleteLead(selectedLead.id)} style={{ flex: 1 }}>
                  Delete Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 800 }}>Create New Lead</h3>
              <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddLead}>
              <div className="modal-body" style={{ maxHeight: '70vh' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Shop/Business Name *</label>
                    <input type="text" className="form-control" required value={formData.shopName} onChange={(e) => setFormData({ ...formData, shopName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input type="text" className="form-control" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mobile Number *</label>
                    <input type="tel" className="form-control" required value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select className="form-control" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                      {LEAD_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Full Address *</label>
                  <input type="text" className="form-control" required value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input type="text" className="form-control" required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input type="text" className="form-control" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude (Optional GPS)</label>
                    <input type="number" step="any" className="form-control" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Longitude (Optional GPS)</label>
                    <input type="number" step="any" className="form-control" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned Salesman (Override)</label>
                    <select className="form-control" value={formData.assignedSalesmanId} onChange={(e) => setFormData({ ...formData, assignedSalesmanId: e.target.value })}>
                      <option value="">Auto Resolve Nearest</option>
                      {salesmen.filter(u => u.role === 'Salesman').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Lead Source</label>
                    <select className="form-control" value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })}>
                      <option value="Google Business">Google Business</option>
                      <option value="Justdial">Justdial</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="IndiaMART">IndiaMART</option>
                      <option value="Flyers/Local">Flyers/Local</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 800 }}>Edit Lead</h3>
              <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setEditModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleEditLead}>
              <div className="modal-body" style={{ maxHeight: '70vh' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Shop/Business Name *</label>
                    <input type="text" className="form-control" required value={formData.shopName} onChange={(e) => setFormData({ ...formData, shopName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input type="text" className="form-control" value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mobile Number *</label>
                    <input type="tel" className="form-control" required value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select className="form-control" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                      {LEAD_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Full Address *</label>
                  <input type="text" className="form-control" required value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input type="text" className="form-control" required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input type="text" className="form-control" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude (Optional GPS)</label>
                    <input type="number" step="any" className="form-control" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Longitude (Optional GPS)</label>
                    <input type="number" step="any" className="form-control" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned Salesman</label>
                    <select className="form-control" value={formData.assignedSalesmanId} onChange={(e) => setFormData({ ...formData, assignedSalesmanId: e.target.value })}>
                      <option value="">Auto Resolve Nearest</option>
                      {salesmen.filter(u => u.role === 'Salesman').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Lead Status</label>
                    <select className="form-control" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Visited">Visited</option>
                      <option value="Interested">Interested</option>
                      <option value="Customer" disabled>Converted Customer (Use Convert Action)</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
