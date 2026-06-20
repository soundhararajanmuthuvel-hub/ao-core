import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { crmApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  FileText, 
  Sparkles, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Upload, 
  RefreshCw, 
  Edit2, 
  AlertTriangle,
  Grid,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import '../styles/aileadimporter.css';

const CATEGORIES = [
  'Organic Store',
  'Supermarket',
  'Medical Shop',
  'Nattu Marundhu Kadai',
  'Millet Store',
  'Dry Fruit Shop',
  'General Retail Store'
];

export default function AiLeadImporter() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Textarea input
  const [text, setText] = useState('');

  // Loading states
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [importing, setImporting] = useState(false);

  // Analysis result states
  const [analyzedLeads, setAnalyzedLeads] = useState([]);
  const [summary, setSummary] = useState(null);

  // Filter and display states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'NEW' | 'DUPLICATE' | 'INVALID'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // Selection state
  const [selectedIndices, setSelectedIndices] = useState([]);

  // Inline editing state
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({
    shopName: '',
    mobileNumber: '',
    address: '',
    city: '',
    category: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Clear everything
  const handleClear = () => {
    setText('');
    setAnalyzedLeads([]);
    setSummary(null);
    setSelectedIndices([]);
    setEditingIdx(null);
  };

  // Handle client/server upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const originalName = file.name.toLowerCase();
    
    if (originalName.endsWith('.xlsx')) {
      // XLSX must be sent to the backend for extraction
      const formData = new FormData();
      formData.append('file', file);
      setLoadingText('Extracting cells from Excel spreadsheet...');
      setAnalyzing(true);
      
      crmApi.extractText(formData)
        .then(res => {
          setText(prev => (prev ? prev.trim() + '\n' : '') + res.data.text);
          toast('Excel rows successfully converted to text area!', 'success');
        })
        .catch(err => {
          console.error(err);
          toast(err.response?.data?.message || 'Failed to parse Excel spreadsheet', 'error');
        })
        .finally(() => {
          setAnalyzing(false);
          setLoadingText('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        });
    } else if (originalName.endsWith('.csv') || originalName.endsWith('.txt')) {
      // Read CSV / TXT directly in the browser
      const reader = new FileReader();
      reader.onload = (evt) => {
        setText(prev => (prev ? prev.trim() + '\n' : '') + evt.target.result);
        toast('File text successfully appended!', 'success');
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      toast('Unsupported file type. Please upload .txt, .csv, or .xlsx', 'warning');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Call AI parser
  const handleAnalyzeLeads = async () => {
    if (!text || !text.trim()) {
      toast('Please paste shop details or upload a file first.', 'warning');
      return;
    }

    setAnalyzing(true);
    setLoadingText('Consulting Gemini 2.5 Flash...');
    
    try {
      const res = await crmApi.analyzeLeadsText({ text });
      if (res.data.success) {
        setAnalyzedLeads(res.data.leads || []);
        setSummary(res.data.summary);
        
        // Auto-select valid new leads by default
        const validIndices = [];
        (res.data.leads || []).forEach((lead, idx) => {
          if (!lead.isInvalid && !lead.isDuplicate) {
            validIndices.push(idx);
          }
        });
        setSelectedIndices(validIndices);
        toast('AI Analysis and Duplicate checks completed!', 'success');
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'AI failed to analyze leads. Try again.', 'error');
    } finally {
      setAnalyzing(false);
      setLoadingText('');
    }
  };

  // Filter Logic
  const getFilteredLeads = () => {
    return analyzedLeads.map((l, index) => ({ ...l, originalIndex: index })).filter(lead => {
      const matchesSearch = 
        lead.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.mobileNumber.includes(searchQuery) ||
        (lead.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.city || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'NEW') matchesStatus = lead.statusText === 'New Lead';
      else if (statusFilter === 'DUPLICATE') matchesStatus = lead.statusText === 'Duplicate Lead';
      else if (statusFilter === 'CUSTOMER') matchesStatus = lead.statusText === 'Existing Customer';
      else if (statusFilter === 'INCOMPLETE') matchesStatus = !lead.isInvalid && (!lead.address || !lead.city);
      else if (statusFilter === 'INVALID') matchesStatus = lead.isInvalid;

      let matchesCategory = true;
      if (categoryFilter !== 'ALL') matchesCategory = lead.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  };

  const filteredLeads = getFilteredLeads();

  // Pagination details
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter]);

  // Bulk selection checkboxes
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all in current filtered view that are valid/not invalid
      const toSelect = filteredLeads
        .filter(l => !l.isInvalid)
        .map(l => l.originalIndex);
      
      setSelectedIndices(prev => {
        const set = new Set([...prev, ...toSelect]);
        return Array.from(set);
      });
    } else {
      // Unselect all in current filtered view
      const filteredIndices = filteredLeads.map(l => l.originalIndex);
      setSelectedIndices(prev => prev.filter(idx => !filteredIndices.includes(idx)));
    }
  };

  const handleSelectRow = (idx) => {
    setSelectedIndices(prev => {
      if (prev.includes(idx)) {
        return prev.filter(i => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  // Inline editing
  const startEdit = (idx, lead) => {
    setEditingIdx(idx);
    setEditForm({
      shopName: lead.shopName,
      mobileNumber: lead.mobileNumber,
      address: lead.address || '',
      city: lead.city || '',
      category: lead.category
    });
  };

  const saveEdit = (originalIndex) => {
    if (!editForm.shopName.trim() || !editForm.mobileNumber.trim()) {
      toast('Shop Name and Mobile Number are required', 'warning');
      return;
    }

    setAnalyzedLeads(prev => {
      const copy = [...prev];
      const editedLead = {
        ...copy[originalIndex],
        shopName: editForm.shopName.trim(),
        mobileNumber: editForm.mobileNumber.trim().replace(/\D/g, ''),
        address: editForm.address.trim(),
        city: editForm.city.trim(),
        category: editForm.category,
        isInvalid: false,
        statusText: 'New Lead',
        reason: ''
      };

      if (editedLead.mobileNumber.length < 9) {
        editedLead.isInvalid = true;
        editedLead.statusText = 'Invalid';
        editedLead.reason = 'Mobile number too short';
      }

      // Re-calculate confidence score on save
      let confidenceVal = 70;
      if (editedLead.address) confidenceVal += 15;
      if (editedLead.city) confidenceVal += 10;
      if (editedLead.category !== 'General Retail Store') confidenceVal += 5;
      editedLead.confidenceScore = `${confidenceVal}% Match`;

      copy[originalIndex] = editedLead;
      return copy;
    });

    setEditingIdx(null);
    toast('Lead row updated locally.', 'success');
  };

  // Delete row
  const deleteRow = (originalIndex) => {
    setAnalyzedLeads(prev => prev.filter((_, i) => i !== originalIndex));
    setSelectedIndices(prev => prev.filter(i => i !== originalIndex).map(i => i > originalIndex ? i - 1 : i));
    toast('Lead removed from preview table.', 'success');
  };

  // Import Selected Leads
  const handleImportLeads = async () => {
    if (selectedIndices.length === 0) {
      toast('Please select at least one valid lead to import.', 'warning');
      return;
    }

    const leadsToImport = selectedIndices.map(idx => analyzedLeads[idx]);
    
    // Safety check
    const hasInvalid = leadsToImport.some(l => l.isInvalid);
    if (hasInvalid) {
      toast('Cannot import invalid records. Deselect or edit them first.', 'error');
      return;
    }

    setImporting(true);
    try {
      const res = await crmApi.importLeadsList({ leads: leadsToImport });
      if (res.data.success) {
        toast(`Successfully imported ${res.data.leadsCount} leads into CRM!`, 'success');
        // Clear and redirect to CRM Leads page
        handleClear();
        navigate('/crm/leads');
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Import execution failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="ai-lead-importer-page">
      
      {/* Top Banner Card */}
      <div className="importer-intro-card">
        <h2>📥 AI Lead Importer</h2>
        <p>
          Paste list summaries from WhatsApp, directories, or upload CSV/XLSX. Our Gemini 2.5 Flash intelligence will structure it into clean CRM leads and flag duplicates automatically.
        </p>
      </div>

      {/* Inputs Section */}
      <div className="importer-workspace">
        <div>
          <div className="workspace-label">Pasted Lead Content (Text listings)</div>
          <textarea
            className="importer-textarea"
            placeholder={`Example format to paste:\nMurugan Organic Store - Madurai - 9876543210\nGreen Health Foods, Anna Nagar, Chennai (Phone: 9840012345)\nABC Supermarket - 9898989898`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={analyzing}
          />
        </div>

        <div className="importer-buttons-bar">
          <div className="buttons-left">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden-file-input"
              accept=".txt,.csv,.xlsx"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="importer-btn secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              <Upload size={16} /> Upload File (.TXT, .CSV, .XLSX)
            </button>
            <button
              type="button"
              className="importer-btn danger"
              onClick={handleClear}
              disabled={analyzing || (!text && analyzedLeads.length === 0)}
            >
              Clear
            </button>
          </div>

          <div className="buttons-right">
            <button
              type="button"
              className="importer-btn primary"
              onClick={handleAnalyzeLeads}
              disabled={analyzing || !text.trim()}
            >
              <Sparkles size={16} /> ✨ Analyze Leads
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Loader */}
      {analyzing && (
        <div className="importer-loader-container">
          <LoadingSpinner />
          <div className="loader-message">{loadingText}</div>
          <div className="loader-submessage">Gemini is parsing and matching records. Please wait...</div>
        </div>
      )}

      {/* Results Workspace */}
      {!analyzing && analyzedLeads.length > 0 && (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="results-summary-grid">
              <div className="summary-card total">
                <div className="summary-icon-box">
                  <Grid size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-val">{summary.total}</span>
                  <span className="summary-label">Total Extracted</span>
                </div>
              </div>

              <div className="summary-card valid">
                <div className="summary-icon-box">
                  <Check size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-val">{summary.valid}</span>
                  <span className="summary-label">Valid Leads</span>
                </div>
              </div>

              <div className="summary-card duplicate">
                <div className="summary-icon-box">
                  <AlertTriangle size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-val">{summary.duplicates}</span>
                  <span className="summary-label">Duplicate Leads</span>
                </div>
              </div>

              <div className="summary-card incomplete" style={{ borderLeftColor: 'var(--brand-primary)' }}>
                <div className="summary-icon-box" style={{ background: 'rgba(90, 45, 12, 0.1)', color: 'var(--brand-primary)' }}>
                  <AlertCircle size={20} />
                </div>
                <div className="summary-info">
                  <span className="summary-val">{summary.incomplete || 0}</span>
                  <span className="summary-label">Incomplete Leads</span>
                </div>
              </div>
            </div>
          )}

          {/* Results table panel */}
          <div className="results-panel">
            <div className="panel-header-controls">
              <div className="panel-search-filter">
                {/* Search Bar */}
                <div className="panel-search-box">
                  <Search size={14} className="panel-search-icon" />
                  <input
                    type="text"
                    placeholder="Search preview results..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="panel-search-input"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="panel-select-filter"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New Leads</option>
                  <option value="DUPLICATE">Duplicate Leads</option>
                  <option value="CUSTOMER">Existing Customers</option>
                  <option value="INCOMPLETE">Incomplete Leads</option>
                  <option value="INVALID">Invalid Records</option>
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="panel-select-filter"
                >
                  <option value="ALL">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="panel-actions-right">
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Showing {filteredLeads.length} parsed results
                </span>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={
                          filteredLeads.length > 0 && 
                          filteredLeads.filter(l => !l.isInvalid).every(l => selectedIndices.includes(l.originalIndex))
                        }
                      />
                    </th>
                    <th>Shop Name</th>
                    <th>Mobile</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Match</th>
                    <th>Status</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => {
                    const isEditing = editingIdx === lead.originalIndex;
                    
                    let statusBadgeClass = 'new';
                    let statusLabel = lead.statusText || 'New Lead';
                    if (lead.isInvalid) {
                      statusBadgeClass = 'invalid';
                      statusLabel = 'Invalid';
                    } else if (lead.statusText === 'Duplicate Lead') {
                      statusBadgeClass = 'duplicate';
                      statusLabel = 'Duplicate Lead';
                    } else if (lead.statusText === 'Existing Customer') {
                      statusBadgeClass = 'customer';
                      statusLabel = 'Existing Customer';
                    }

                    return (
                      <tr 
                        key={lead.originalIndex}
                        className={lead.isInvalid ? 'row-invalid' : lead.isDuplicate ? 'row-duplicate' : ''}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            disabled={lead.isInvalid}
                            checked={selectedIndices.includes(lead.originalIndex)}
                            onChange={() => handleSelectRow(lead.originalIndex)}
                          />
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.shopName}
                              onChange={(e) => setEditForm(prev => ({ ...prev, shopName: e.target.value }))}
                              className="table-input"
                            />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{lead.shopName || '—'}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.mobileNumber}
                              onChange={(e) => setEditForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                              className="table-input"
                            />
                          ) : (
                            lead.mobileNumber || '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.address}
                              onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                              className="table-input"
                            />
                          ) : (
                            lead.address || '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.city}
                              onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                              className="table-input"
                            />
                          ) : (
                            lead.city || '—'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                              className="table-input"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            lead.category || 'General Retail Store'
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--brand-primary)' }}>
                          {lead.confidenceScore || '70% Match'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className={`badge-status ${statusBadgeClass}`}>{statusLabel}</span>
                            {lead.reason && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lead.reason}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="row-actions-flex">
                            {isEditing ? (
                              <>
                                <button 
                                  type="button" 
                                  onClick={() => saveEdit(lead.originalIndex)}
                                  className="row-action-btn save"
                                  title="Save Row"
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => setEditingIdx(null)}
                                  className="row-action-btn cancel"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  type="button" 
                                  onClick={() => startEdit(lead.originalIndex, lead)}
                                  className="row-action-btn edit"
                                  title="Edit Lead"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => deleteRow(lead.originalIndex)}
                                  className="row-action-btn delete"
                                  title="Delete Lead"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No leads match the filter selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="table-pagination">
                <span>
                  Showing page {currentPage} of {totalPages}
                </span>
                <div className="pagination-btn-group">
                  <button 
                    type="button" 
                    className="pagination-page-btn" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`pagination-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button 
                    type="button" 
                    className="pagination-page-btn" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Import Execution Bar */}
          <div className="importer-footer-action">
            <div className="footer-action-stats">
              Selected <strong>{selectedIndices.length}</strong> new leads to import into CRM database
            </div>
            <button
              type="button"
              className="import-execute-btn"
              disabled={selectedIndices.length === 0 || importing}
              onClick={handleImportLeads}
            >
              {importing ? 'Importing Leads...' : `🚀 Import Selected Leads (${selectedIndices.length})`}
            </button>
          </div>
        </>
      )}

    </div>
  );
}
