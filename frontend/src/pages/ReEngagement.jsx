import { useState, useEffect, useRef } from 'react';
import { crmApi } from '../api';
import { useToast } from '../context/ToastContext';
import { 
  Bell, 
  MessageSquare, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Users, 
  UserCheck, 
  Clock, 
  AlertCircle, 
  ChevronDown, 
  Plus, 
  Search,
  CheckCircle,
  FileText,
  Phone,
  MapPin
} from 'lucide-react';

export default function ReEngagement() {
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [aiInsights, setAiInsights] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('All'); // All, At Risk, Re-Engagement Needed, Inactive
  const [activeTab, setActiveTab] = useState('owner-dashboard'); // owner-dashboard, all-reengagement, visit-reminders
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  // Inline scheduler state
  const [schedulingCustId, setSchedulingCustId] = useState(null);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('Scheduled re-engagement visit.');

  // Dropdown states for WhatsApp templates
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  const customerListRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, custRes, aiRes] = await Promise.all([
        crmApi.getReEngagementDashboard(),
        crmApi.getReEngagementCustomers(),
        crmApi.getReEngagementAiInsights()
      ]);
      setDashboardData(dashRes.data);
      setCustomers(custRes.data.customers || []);
      setAiInsights(aiRes.data.insights || '');
    } catch (err) {
      console.error('Error fetching re-engagement data:', err);
      toast('Failed to load re-engagement control hub details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleCreateAutoTasks = async () => {
    try {
      setActionLoading(true);
      const res = await crmApi.triggerAutoFollowUps();
      toast(res.data.message || 'Follow-up tasks created successfully!', 'success');
      loadData();
    } catch (err) {
      console.error('Failed to create auto follow-up tasks:', err);
      toast('Failed to trigger automatic task generation.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleInline = async (customerId) => {
    if (!newFollowUpDate) {
      toast('Please select a follow-up date.', 'error');
      return;
    }
    try {
      setActionLoading(true);
      await crmApi.createFollowUp({
        customerId,
        followUpDate: newFollowUpDate,
        notes: newFollowUpNotes,
        type: 'Call Customer',
        status: 'Pending'
      });
      toast('Follow-up task scheduled successfully!', 'success');
      setSchedulingCustId(null);
      setNewFollowUpDate('');
      loadData();
    } catch (err) {
      console.error('Failed to schedule follow-up:', err);
      toast('Failed to schedule re-engagement task.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWhatsAppSend = (customer, templateType) => {
    let text = '';
    const customerName = customer.name;
    
    if (templateType === 'greeting') {
      text = `Hello ${customerName},\n\nHope you are doing well.\n\nWe noticed it has been some time since your last order.\n\nWe have fresh stock available.\n\nPlease let us know your requirement.\n\nThank you.`;
    } else if (templateType === 'offer') {
      text = `Hello ${customerName},\n\nWe have special offers available on:\n• ABC Malt\n• Beetroot Malt\n\nContact us for today's dealer pricing.\n\nThank you,\nAmudhasurabiy Organics`;
    } else if (templateType === 'reminder') {
      const formattedDate = customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString('en-IN') : 'N/A';
      const followUpDate = customer.pendingFollowUp ? new Date(customer.pendingFollowUp.followUpDate).toLocaleDateString('en-IN') : 'soon';
      text = `Hello ${customerName},\n\nHope you are doing well.\n\nThis is a friendly reminder regarding our scheduled visit/call. Here are your account details:\n- Last Order Date: ${formattedDate}\n- Last Purchase Value: ₹${customer.lastPurchaseValue}\n- Outstanding Amount: ₹${customer.balance}\n- Assigned Follow-Up Date: ${followUpDate}\n\nWe look forward to serve you again.\n\nThank you,\nAmudhasurabiy Organics`;
    }
    
    let cleanPhone = customer.phone ? customer.phone.replace(/\D/g, '') : '';
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // default to India prefix
    }

    if (!cleanPhone) {
      toast('Mobile number is missing or invalid for this customer.', 'error');
      return;
    }
    
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    setActiveDropdown(null);
  };

  const scrollToCustomerList = () => {
    if (customerListRef.current) {
      customerListRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Filter inactive customers
  const filteredCustomers = customers.filter(c => {
    // Re-engagement dashboard displays inactive customers (days inactive > 30)
    if (c.daysSinceLastOrder <= 30 && activeTab === 'all-reengagement') return false; 
    
    // Visit reminders shows customers not ordered for 30+ days
    if (activeTab === 'visit-reminders' && c.daysSinceLastOrder <= 30) return false;

    if (healthFilter !== 'All' && c.healthStatus !== healthFilter) return false;

    if (search) {
      const searchLower = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(searchLower) ||
        c.businessName.toLowerCase().includes(searchLower) ||
        c.territory.toLowerCase().includes(searchLower) ||
        c.customerCode.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const counts = dashboardData?.counts || { thirtyPlus: 0, sixtyPlus: 0, ninetyPlus: 0 };
  const recoveryReport = dashboardData?.recoveryReport || { recoveredCount: 0, stillInactiveCount: 0, revenueRecovered: 0, topRecovered: [] };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
            Customer Re-Engagement Control Hub
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Track dormant customer tiers, trigger follow-ups, and recover retail revenues automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
          >
            Refresh Data
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleCreateAutoTasks}
            disabled={actionLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, backgroundColor: 'var(--brand-primary)', border: 'none' }}
          >
            <Plus size={16} /> Auto-Create Follow-Ups
          </button>
        </div>
      </div>

      {/* Main Widgets Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* CRM Dashboard Widget: Customers Not Ordered */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--danger)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Bell size={20} color="var(--danger)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>🔔 Customers Not Ordered</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--warning)' }}>⚠️ 30+ Days Inactive (At Risk)</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--warning)' }}>{counts.thirtyPlus} Customers</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f97316' }}>🟠 60+ Days Inactive (Re-Engagement Needed)</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f97316' }}>{counts.sixtyPlus} Customers</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)' }}>🚨 90+ Days Inactive (Inactive)</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--danger)' }}>{counts.ninetyPlus} Customers</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={scrollToCustomerList}
              style={{ flex: 1, padding: '0.5rem', fontWeight: 700 }}
            >
              View Customers
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleCreateAutoTasks}
              disabled={actionLoading}
              style={{ flex: 1, padding: '0.5rem', fontWeight: 700, backgroundColor: 'var(--brand-primary)', border: 'none' }}
            >
              Create Follow-Ups
            </button>
          </div>
        </div>

        {/* Customer Recovery Report */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', borderLeft: '4px solid var(--success)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={20} color="var(--success)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>📈 Customer Recovery Report</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-page)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{recoveryReport.recoveredCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Recovered This Month</div>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-page)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{recoveryReport.stillInactiveCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Still Inactive</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.15)', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>Revenue Recovered:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <DollarSign size={16} /> {Number(recoveryReport.revenueRecovered).toLocaleString('en-IN')}
            </span>
          </div>

          {recoveryReport.topRecovered && recoveryReport.topRecovered.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Top Recovered Customers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {recoveryReport.topRecovered.map((c, i) => (
                  <div key={c.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{Number(c.revenue).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Suggestions / Daily Insights */}
        <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', borderLeft: '4px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={20} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>💡 AI Suggestions (Daily Insights)</h3>
          </div>

          <div style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.04)', border: '1px solid rgba(139, 92, 246, 0.1)', overflowY: 'auto', maxHeight: '180px' }}>
            {aiInsights ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {aiInsights.split('\n').map((line, idx) => (
                  <div key={idx} style={{ marginBottom: '0.4rem', fontWeight: line.startsWith('•') ? 500 : 400 }}>
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
                AI Suggestions generated successfully.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tabs list and filters section */}
      <div ref={customerListRef} className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Section Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => { setActiveTab('owner-dashboard'); setHealthFilter('All'); }}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'owner-dashboard' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              color: activeTab === 'owner-dashboard' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
              marginRight: '1rem'
            }}
          >
            <TrendingUp size={16} style={{ marginRight: '0.4rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Owner Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('all-reengagement'); setHealthFilter('All'); }}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'all-reengagement' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              color: activeTab === 'all-reengagement' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s',
              marginRight: '1rem'
            }}
          >
            <Users size={16} style={{ marginRight: '0.4rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Customer Health list
          </button>
          <button
            onClick={() => { setActiveTab('visit-reminders'); setHealthFilter('All'); }}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'visit-reminders' ? '3px solid var(--brand-primary)' : '3px solid transparent',
              color: activeTab === 'visit-reminders' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={16} style={{ marginRight: '0.4rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Visit Reminders (30+ Days Inactive)
          </button>
        </div>

        {/* OWNER DASHBOARD TAB */}
        {activeTab === 'owner-dashboard' && (
          <div>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderLeft: '4px solid var(--warning)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inactive 30+ Days</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{counts.thirtyPlus} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Customers</span></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Attention Required</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.15)', borderLeft: '4px solid #f97316' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inactive 60+ Days</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>{counts.sixtyPlus} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Customers</span></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Recovery Needed</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderLeft: '4px solid var(--danger)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue At Risk</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)', marginTop: '0.5rem' }}>₹{Number(dashboardData?.revenueAtRisk || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Potential Lost Revenue</div>
              </div>
              <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.15)', borderLeft: '4px solid var(--success)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recovered This Month</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.5rem' }}>{recoveryReport.recoveredCount} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Customers</span></div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, marginTop: '0.25rem' }}>₹{Number(recoveryReport.revenueRecovered).toLocaleString('en-IN')} Saved</div>
              </div>
            </div>

            {/* Opportunities and Recovered tables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
              {/* Top Recovery Opportunities */}
              <div className="card" style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>🔥 Top Recovery Opportunities</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--bg-page)' }}>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Shop</th>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Inactive</th>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Last Order Value</th>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!dashboardData?.topRecoveryOpportunities || dashboardData.topRecoveryOpportunities.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recovery opportunities at present.</td>
                        </tr>
                      ) : (
                        dashboardData.topRecoveryOpportunities.slice(0, 5).map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>
                              <div>{o.name}</div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{o.businessName}</span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', color: 'var(--danger)', fontWeight: 600 }}>{o.daysSinceLastOrder} days ago</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>₹{o.lastPurchaseValue.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: o.healthColor === 'yellow' ? 'var(--warning)' : (o.healthColor === 'orange' ? '#f97316' : 'var(--danger)'),
                                background: o.healthColor === 'yellow' ? 'rgba(245, 158, 11, 0.08)' : (o.healthColor === 'orange' ? 'rgba(249, 115, 22, 0.08)' : 'rgba(239, 68, 68, 0.08)')
                              }}>{o.healthStatus}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recovered Customers list */}
              <div className="card" style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>🎉 Recovered Customers This Month</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--bg-page)' }}>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>Customer / Business</th>
                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, textAlign: 'right' }}>Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!recoveryReport.topRecovered || recoveryReport.topRecovered.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No customers recovered yet this month. Keep pushing!</td>
                        </tr>
                      ) : (
                        recoveryReport.topRecovered.map(rc => (
                          <tr key={rc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700 }}>
                              <div>{rc.name}</div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{rc.businessName}</span>
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--success)', textAlign: 'right' }}>₹{Number(rc.revenue).toLocaleString('en-IN')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER HEALTH LIST TAB */}
        {activeTab === 'all-reengagement' && (
          <div>
            {/* Filters and Search toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search name, shop, territory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: '2.25rem', width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {['All', 'Attention Required', 'Recovery Needed', 'Inactive'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setHealthFilter(filter)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: healthFilter === filter ? 'rgba(90, 45, 12, 0.08)' : 'transparent',
                        color: healthFilter === filter ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        borderColor: healthFilter === filter ? 'var(--brand-primary)' : 'var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {filter === 'All' ? 'All Inactive' : filter}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Showing {filteredCustomers.length} dormant customers
              </div>
            </div>

            {/* Customer Data Table */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Code</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Customer Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Territory / Salesman</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Last Order Date</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Health Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Outstanding</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Last Purchase Value</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Assigned Follow-Up</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 700, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No customer records matched the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const healthColor = c.healthColor === 'green' ? 'var(--success)' : (c.healthColor === 'yellow' ? 'var(--warning)' : (c.healthColor === 'orange' ? '#f97316' : 'var(--danger)'));
                      const healthBg = c.healthColor === 'green' ? 'rgba(34, 197, 94, 0.08)' : (c.healthColor === 'yellow' ? 'rgba(245, 158, 11, 0.08)' : (c.healthColor === 'orange' ? 'rgba(249, 115, 22, 0.08)' : 'rgba(239, 68, 68, 0.08)'));
                      
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', background: expandedCustomerId === c.id ? '#fcfbfa' : 'none', transition: 'background 0.15s' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{c.customerCode}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div 
                              style={{ fontWeight: 700, color: 'var(--brand-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setExpandedCustomerId(expandedCustomerId === c.id ? null : c.id)}
                            >
                              {c.name} <Sparkles size={12} color="#8b5cf6" />
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.businessName}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600 }}>{c.territory || 'No Territory'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salesman: {c.salesmanName}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600 }}>{new Date(c.lastOrderDate).toLocaleDateString('en-IN')}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700 }}>{c.daysSinceLastOrder} days ago</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ 
                              display: 'inline-block',
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '12px', 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              color: healthColor, 
                              background: healthBg 
                            }}>
                              {c.healthStatus}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: c.balance > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                            ₹{c.balance.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                            ₹{c.lastPurchaseValue.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {c.pendingFollowUp ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 700 }}>
                                <Calendar size={14} />
                                <span>{new Date(c.pendingFollowUp.followUpDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            ) : (
                              <div>
                                {schedulingCustId === c.id ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <input
                                      type="date"
                                      className="form-control"
                                      value={newFollowUpDate}
                                      onChange={(e) => setNewFollowUpDate(e.target.value)}
                                      style={{ fontSize: '0.75rem', padding: '2px 4px', height: '26px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                      <button 
                                        className="btn btn-primary btn-xs" 
                                        onClick={() => handleScheduleInline(c.id)}
                                        disabled={actionLoading}
                                        style={{ fontSize: '0.7rem', padding: '2px 4px' }}
                                      >
                                        Save
                                      </button>
                                      <button 
                                        className="btn btn-secondary btn-xs" 
                                        onClick={() => setSchedulingCustId(null)}
                                        style={{ fontSize: '0.7rem', padding: '2px 4px' }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => {
                                      setSchedulingCustId(c.id);
                                      const tomorrow = new Date();
                                      tomorrow.setDate(tomorrow.getDate() + 1);
                                      setNewFollowUpDate(tomorrow.toISOString().split('T')[0]);
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem' }}
                                  >
                                    <Plus size={12} /> Schedule
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => setExpandedCustomerId(expandedCustomerId === c.id ? null : c.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700, backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.2)' }}
                              >
                                <Sparkles size={12} /> Actions
                              </button>
                              
                              <div style={{ position: 'relative', display: 'inline-block' }} ref={activeDropdown === c.id ? dropdownRef : null}>
                                <button
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => setActiveDropdown(activeDropdown === c.id ? null : c.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                                >
                                  <MessageSquare size={13} /> Message <ChevronDown size={12} />
                                </button>
                                
                                {activeDropdown === c.id && (
                                  <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    zIndex: 1000,
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    minWidth: '200px',
                                    padding: '0.25rem 0',
                                    marginTop: '4px',
                                    textAlign: 'left'
                                  }}>
                                    <button
                                      onClick={() => handleWhatsAppSend(c, 'greeting')}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.5rem 1rem',
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = 'var(--bg-page)'}
                                      onMouseLeave={(e) => e.target.style.background = 'none'}
                                    >
                                      💬 Re-Engagement Greeting
                                    </button>
                                    <button
                                      onClick={() => handleWhatsAppSend(c, 'offer')}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.5rem 1rem',
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = 'var(--bg-page)'}
                                      onMouseLeave={(e) => e.target.style.background = 'none'}
                                    >
                                      🏷️ Special Offer Message
                                    </button>
                                    <button
                                      onClick={() => handleWhatsAppSend(c, 'reminder')}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.5rem 1rem',
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.target.style.background = 'var(--bg-page)'}
                                      onMouseLeave={(e) => e.target.style.background = 'none'}
                                    >
                                      📅 Send Visit Reminder
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }).reduce((acc, row, index, array) => {
                      // We interleave standard rows and collapsible rows inside the loop
                      const c = filteredCustomers[index];
                      acc.push(row);
                      if (expandedCustomerId === c.id) {
                        acc.push(
                          <tr key={`expanded-${c.id}`} style={{ background: '#faf9f6' }}>
                            <td colSpan={9} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '300px', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px dashed #8b5cf6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 800 }}><Sparkles size={16} /> AI RECOVERY SUGGESTIONS</h4>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                                    <strong>Customer:</strong> {c.name}<br/>
                                    <strong>Last Order:</strong> {c.daysSinceLastOrder} Days Ago<br/>
                                    <strong>Last Order Value:</strong> ₹{c.lastPurchaseValue.toLocaleString('en-IN')}<br/>
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', margin: '0.75rem 0 0.5rem 0', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>Suggested Actions:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {c.suggestedActions?.map((act, idx) => (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓</span> {act.action}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ flex: 1, minWidth: '300px', padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px dashed var(--brand-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 800 }}>🔍 SMART CUSTOMER RECOVERY</h4>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {c.smartSuggestions && c.smartSuggestions.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {c.smartSuggestions.map((sug, idx) => (
                                          <div key={idx} style={{ background: 'rgba(90, 45, 12, 0.04)', padding: '0.6rem 0.8rem', borderRadius: '8px', borderLeft: '4px solid var(--brand-primary)', fontWeight: 700, color: 'var(--brand-primary)' }}>
                                            "{sug}"
                                          </div>
                                        ))}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Based on actual purchase history: {c.purchasedProducts?.filter(p => p.toLowerCase().includes('malt')).join(', ') || 'ABC Malt'}</div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No malt history matched.</div>
                                        <div style={{ background: 'var(--bg-page)', padding: '0.6rem 0.8rem', borderRadius: '8px', borderLeft: '4px solid var(--text-muted)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                          "Offer general dealer pricing & catalog discount"
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Purchase history: {c.purchasedProducts?.slice(0, 3).join(', ') || 'No previous orders found.'}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return acc;
                    }, [])
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISIT REMINDERS TAB */}
        {activeTab === 'visit-reminders' && (
          <div>
            {/* visit reminder cards grid layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {filteredCustomers.length === 0 ? (
                <div style={{ colSpan: 'all', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                  No visit reminders at present. All customer schedules are active.
                </div>
              ) : (
                filteredCustomers.map(c => {
                  let priorityText = c.recoveryPriority || 'Follow Up Required';
                  let priorityLabel = c.priorityLevel || 'High';
                  let priorityColor = 'var(--warning)';
                  let priorityBg = 'rgba(245, 158, 11, 0.08)';
                  if (priorityLabel === 'High') { priorityColor = '#f97316'; priorityBg = 'rgba(249, 115, 22, 0.08)'; }
                  if (priorityLabel === 'Urgent') { priorityColor = 'var(--danger)'; priorityBg = 'rgba(239, 68, 68, 0.08)'; }
                  if (priorityLabel === 'Critical') { priorityColor = 'var(--danger)'; priorityBg = 'rgba(239, 68, 68, 0.12)'; }

                  return (
                    <div 
                      key={c.id} 
                      className="card" 
                      style={{ 
                        padding: '1.25rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border)', 
                        background: '#fff', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                        transition: 'transform 0.2s',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div>
                        {/* Title header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🔔 Visit {c.name}
                          </h4>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: priorityColor,
                            background: priorityBg
                          }}>{priorityLabel} Priority</span>
                        </div>

                        {/* Customer details details */}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div><strong>Shop:</strong> {c.businessName}</div>
                          <div><strong>Last Order:</strong> <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{c.daysSinceLastOrder} Days Ago</span></div>
                          <div><strong>Potential Recovery:</strong> <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>₹{c.lastPurchaseValue.toLocaleString('en-IN')}</span></div>
                          <div><strong>Territory:</strong> {c.territory || 'No Territory'}</div>
                        </div>

                        {/* Scheduler actions */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginBottom: '1rem' }}>
                          {c.pendingFollowUp ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontWeight: 700, fontSize: '0.8rem' }}>
                              <Calendar size={14} />
                              <span>Scheduled: {new Date(c.pendingFollowUp.followUpDate).toLocaleDateString('en-IN')}</span>
                            </div>
                          ) : (
                            <div>
                              {schedulingCustId === c.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <input
                                    type="date"
                                    className="form-control"
                                    value={newFollowUpDate}
                                    onChange={(e) => setNewFollowUpDate(e.target.value)}
                                    style={{ fontSize: '0.8rem', padding: '4px 6px', height: '32px', borderRadius: '6px' }}
                                  />
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      className="btn btn-primary btn-xs" 
                                      onClick={() => handleScheduleInline(c.id)}
                                      disabled={actionLoading}
                                      style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                                    >
                                      Save Visit
                                    </button>
                                    <button 
                                      className="btn btn-secondary btn-xs" 
                                      onClick={() => setSchedulingCustId(null)}
                                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => {
                                    setSchedulingCustId(c.id);
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    setNewFollowUpDate(tomorrow.toISOString().split('T')[0]);
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 10px', width: '100%', justifyContent: 'center' }}
                                >
                                  <Plus size={13} /> Schedule Recovery Visit
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card buttons footer */}
                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                        <a 
                          href={c.phone ? `tel:${c.phone}` : '#'}
                          className="btn btn-secondary btn-xs"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.75rem', textDecoration: 'none', pointerEvents: c.phone ? 'auto' : 'none', opacity: c.phone ? 1 : 0.5 }}
                        >
                          <Phone size={12} /> Call
                        </a>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => handleWhatsAppSend(c, 'greeting')}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.75rem', backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }}
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
