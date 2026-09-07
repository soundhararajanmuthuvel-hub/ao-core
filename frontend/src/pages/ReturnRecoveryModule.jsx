import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  RotateCcw,
  Package,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  DollarSign,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ChevronRight,
  Clock,
  CheckSquare,
  AlertOctagon,
  ShieldAlert,
  Factory,
  BarChart2,
  Settings,
  FileSpreadsheet,
  Inbox,
  X,
  Eye,
  RefreshCw,
  Calendar,
  Layers
} from 'lucide-react';
import { returnsApi, productsApi, salesApi } from '../api';

export default function ReturnRecoveryModule() {
  const location = useLocation();

  // Navigation & View Mode: 'simple' (Default Business Returns) vs 'advanced' (Factory QC, Repack, Recalls)
  const [viewMode, setViewMode] = useState('simple');
  const [advancedTab, setAdvancedTab] = useState('qc');

  // Loading and Error States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', message: '' }

  // Returns Data
  const [returnsList, setReturnsList] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState({
    returnRequests: 0,
    toReceive: 0,
    toRefund: 0,
    completed: 0
  });

  // Advanced Operations Data
  const [repackOrders, setRepackOrders] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [nearExpiryItems, setNearExpiryItems] = useState([]);
  const [productsCatalog, setProductsCatalog] = useState([]);

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');

  // MODAL STATES
  // 1. + New Return Wizard
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [orderQuery, setOrderQuery] = useState('');
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [orderSearchResults, setOrderSearchResults] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnItems, setReturnItems] = useState([]); // [{ productId, productName, soldQty, returnQty, unitPrice, batchNumber }]
  const [returnReason, setReturnReason] = useState('Damaged Product');
  const [returnReasonNotes, setReturnReasonNotes] = useState('');
  const [actionType, setActionType] = useState('Refund'); // 'Refund' | 'Replacement'
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState('Original Payment Method');
  const [replacementProductId, setReplacementProductId] = useState('');
  const [replacementQuantity, setReplacementQuantity] = useState(1);
  const [returnNotes, setReturnNotes] = useState('');

  // 2. Mark Received Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [itemToReceive, setItemToReceive] = useState(null);
  const [receiveCondition, setReceiveCondition] = useState('Good');
  const [warehouseLocation, setWarehouseLocation] = useState('Main Warehouse');
  const [receiveNotes, setReceiveNotes] = useState('');

  // 3. Process Refund Modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [itemToRefund, setItemToRefund] = useState(null);
  const [processRefundAmount, setProcessRefundAmount] = useState(0);
  const [processRefundMethod, setProcessRefundMethod] = useState('Original Payment Method');
  const [refundRefNumber, setRefundRefNumber] = useState('');
  const [processRefundNotes, setProcessRefundNotes] = useState('');

  // 4. Process Replacement Modal
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [itemToReplace, setItemToReplace] = useState(null);
  const [processReplacementProdId, setProcessReplacementProdId] = useState('');
  const [processReplacementQty, setProcessReplacementQty] = useState(1);
  const [replacementTracking, setReplacementTracking] = useState('');
  const [processReplacementNotes, setProcessReplacementNotes] = useState('');

  // 5. Return Details & Timeline Modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [viewReturn, setViewReturn] = useState(null);

  // Initial Data Fetching
  const loadReturnsData = async () => {
    setLoading(true);
    try {
      const [listRes, metricsRes, prodRes] = await Promise.allSettled([
        returnsApi.list({ limit: 100 }),
        returnsApi.getDashboardMetrics(),
        productsApi.list({ limit: 150 })
      ]);

      if (listRes.status === 'fulfilled' && listRes.value?.data) {
        const raw = listRes.value.data;
        setReturnsList(raw.data || raw.returns || (Array.isArray(raw) ? raw : []));
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value?.data) {
        const d = metricsRes.value.data;
        const summary = d.summary || d.metrics || {};
        setSummaryMetrics({
          returnRequests: summary.returnRequests ?? summary.pendingQc ?? 0,
          toReceive: summary.toReceive ?? 0,
          toRefund: summary.toRefund ?? 0,
          completed: summary.completed ?? 0
        });
      }

      if (prodRes.status === 'fulfilled' && prodRes.value?.data) {
        const prods = prodRes.value.data.products || prodRes.value.data || [];
        setProductsCatalog(Array.isArray(prods) ? prods : []);
      }
    } catch (err) {
      console.error('Error loading returns data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturnsData();
  }, []);

  // Handle URL prefill (e.g. from Sales/Invoices page: ?createForInvoice=INV-2026-0001)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invNo = params.get('createForInvoice') || params.get('invoiceNo') || params.get('invoiceNumber');
    if (invNo) {
      handleOpenCreateModal();
      setOrderQuery(invNo);
      triggerOrderSearch(invNo);
    }
  }, [location.search]);

  // Temporary feedback toast banner
  const triggerFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Open Create Modal & reset state
  const handleOpenCreateModal = () => {
    setCreateStep(1);
    setSelectedOrder(null);
    setReturnItems([]);
    setOrderQuery('');
    setOrderSearchResults([]);
    setReturnReason('Damaged Product');
    setReturnReasonNotes('');
    setActionType('Refund');
    setRefundAmount(0);
    setRefundMethod('Original Payment Method');
    setReplacementProductId('');
    setReplacementQuantity(1);
    setReturnNotes('');
    setShowCreateModal(true);
  };

  // Search orders / invoices
  const triggerOrderSearch = async (query) => {
    const q = (query !== undefined ? query : orderQuery).trim();
    if (!q || q.length < 2) return;
    setIsSearchingOrders(true);
    try {
      const res = await returnsApi.orderSearch(q);
      const orders = res.data?.data || res.data?.orders || [];
      setOrderSearchResults(orders);
    } catch (err) {
      console.error('Order search error:', err);
      triggerFeedback('error', 'Failed to search orders. Please try again.');
    } finally {
      setIsSearchingOrders(false);
    }
  };

  // Select an order from search results
  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    // Initialize items with returnQty = 0
    const items = (order.items || []).map(it => ({
      productId: it.productId,
      productName: it.productName || it.name,
      soldQty: Number(it.soldQty || 1),
      returnQty: 1, // Default 1 for convenience
      unitPrice: Number(it.unitPrice || 0),
      batchNumber: it.batchNumber || ''
    }));
    setReturnItems(items);
    // Auto calculate initial refund amount
    const initialRefund = items.reduce((sum, it) => sum + (it.unitPrice * it.returnQty), 0);
    setRefundAmount(initialRefund);
    if (items.length > 0) {
      setReplacementProductId(items[0].productId);
    }
    setCreateStep(2);
  };

  // Stepper handlers for returnQty (ensuring returnQty <= soldQty)
  const handleQtyChange = (index, delta) => {
    setReturnItems(prev => {
      const copy = [...prev];
      const current = copy[index];
      const nextQty = Math.max(0, Math.min(current.soldQty, current.returnQty + delta));
      copy[index] = { ...current, returnQty: nextQty };

      // Update refund amount based on return items
      const newTotal = copy.reduce((sum, it) => sum + (it.unitPrice * it.returnQty), 0);
      setRefundAmount(newTotal);
      return copy;
    });
  };

  // Submit Create Return
  const handleCreateReturnSubmit = async () => {
    const itemsToReturn = returnItems.filter(it => it.returnQty > 0);
    if (itemsToReturn.length === 0) {
      alert('Please select at least one item with a return quantity greater than 0.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        invoiceId: selectedOrder.invoiceId,
        invoiceNumber: selectedOrder.invoiceNumber,
        customerName: selectedOrder.customer?.name,
        customerId: selectedOrder.customer?.id,
        customerType: selectedOrder.customer?.customerType || 'Retail Shop',
        returnType: actionType,
        returnReason: returnReason === 'Other' && returnReasonNotes ? `Other: ${returnReasonNotes}` : returnReason,
        refundAmount: actionType === 'Refund' ? Number(refundAmount) : 0,
        refundMethod: actionType === 'Refund' ? refundMethod : null,
        replacementProductId: actionType === 'Replacement' ? replacementProductId : null,
        replacementQuantity: actionType === 'Replacement' ? Number(replacementQuantity) : 0,
        notes: returnNotes,
        items: itemsToReturn.map(it => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.returnQty,
          unitPrice: it.unitPrice,
          batchNumber: it.batchNumber
        }))
      };

      const res = await returnsApi.create(payload);
      if (res.data?.success) {
        setShowCreateModal(false);
        triggerFeedback('success', `Return ${res.data.returnRequest?.rmaNumber || res.data.data?.rmaNumber || ''} created successfully.`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error creating return:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to create return request.');
    } finally {
      setActionLoading(false);
    }
  };

  // APPROVE Return
  const handleApprove = async (ret) => {
    if (!window.confirm(`Approve return ${ret.rmaNumber} for ${ret.customerName || 'Customer'}?`)) return;
    setActionLoading(true);
    try {
      const res = await returnsApi.approve(ret.id);
      if (res.data?.success) {
        triggerFeedback('success', `Return ${ret.rmaNumber} approved successfully.`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error approving return:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to approve return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (ret) => {
    setItemToReceive(ret);
    setReceiveCondition('Good');
    setWarehouseLocation('Main Warehouse');
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  // Submit Receive
  const handleConfirmReceive = async () => {
    if (!itemToReceive) return;
    setActionLoading(true);
    try {
      const res = await returnsApi.receive(itemToReceive.id, {
        condition: receiveCondition,
        notes: receiveNotes,
        warehouseLocation
      });
      if (res.data?.success) {
        setShowReceiveModal(false);
        triggerFeedback('success', `Return ${itemToReceive.rmaNumber} marked as received (${receiveCondition} condition).`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error receiving return:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to receive return.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Process Refund Modal
  const handleOpenRefund = (ret) => {
    setItemToRefund(ret);
    setProcessRefundAmount(ret.refundAmount || ret.totalValue || 0);
    setProcessRefundMethod(ret.refundMethod || 'Original Payment Method');
    setRefundRefNumber('');
    setProcessRefundNotes('');
    setShowRefundModal(true);
  };

  // Submit Refund
  const handleConfirmRefund = async () => {
    if (!itemToRefund) return;
    setActionLoading(true);
    try {
      const res = await returnsApi.processRefund(itemToRefund.id, {
        refundAmount: Number(processRefundAmount),
        refundMethod: processRefundMethod,
        referenceNumber: refundRefNumber,
        notes: processRefundNotes
      });
      if (res.data?.success) {
        setShowRefundModal(false);
        triggerFeedback('success', `Refund of ₹${Number(processRefundAmount).toLocaleString('en-IN')} processed successfully for ${itemToRefund.rmaNumber}.`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error processing refund:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to process refund.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Process Replacement Modal
  const handleOpenReplacement = (ret) => {
    setItemToReplace(ret);
    setProcessReplacementProdId(ret.replacementProductId || (ret.items && ret.items[0]?.productId) || '');
    setProcessReplacementQty(ret.replacementQuantity || (ret.items && ret.items[0]?.quantity) || 1);
    setReplacementTracking('');
    setProcessReplacementNotes('');
    setShowReplacementModal(true);
  };

  // Submit Replacement
  const handleConfirmReplacement = async () => {
    if (!itemToReplace) return;
    setActionLoading(true);
    try {
      const res = await returnsApi.processReplacement(itemToReplace.id, {
        replacementProductId: processReplacementProdId,
        replacementQuantity: Number(processReplacementQty),
        dispatchTracking: replacementTracking,
        notes: processReplacementNotes
      });
      if (res.data?.success) {
        setShowReplacementModal(false);
        triggerFeedback('success', `Replacement processed for ${itemToReplace.rmaNumber}.`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error processing replacement:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to process replacement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Return
  const handleCancelReturn = async (ret) => {
    const reason = window.prompt(`Are you sure you want to cancel ${ret.rmaNumber}? Please enter cancellation reason:`);
    if (reason === null) return; // User pressed Cancel
    setActionLoading(true);
    try {
      const res = await returnsApi.cancel(ret.id, { reason: reason || 'Cancelled by user' });
      if (res.data?.success) {
        triggerFeedback('success', `Return ${ret.rmaNumber} cancelled.`);
        loadReturnsData();
      }
    } catch (err) {
      console.error('Error cancelling return:', err);
      triggerFeedback('error', err.response?.data?.message || 'Failed to cancel return.');
    } finally {
      setActionLoading(false);
    }
  };

  // View Details Modal
  const handleOpenDetails = (ret) => {
    setViewReturn(ret);
    setShowDetailsModal(true);
  };

  // Filtered Returns List
  const filteredReturns = returnsList.filter(item => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      (item.rmaNumber && item.rmaNumber.toLowerCase().includes(q)) ||
      (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      (item.customer?.name && item.customer.name.toLowerCase().includes(q)) ||
      (item.items && item.items.some(it => (it.productName || it.product?.name || '').toLowerCase().includes(q)));

    const itemStatus = item.status || 'Requested';
    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Requested') {
        matchesStatus = itemStatus === 'Requested' || itemStatus === 'Pending QC' || itemStatus === 'QC Pending';
      } else if (statusFilter === 'Approved') {
        matchesStatus = itemStatus === 'Approved' || itemStatus === 'In Transit' || itemStatus === 'Pending Receive';
      } else if (statusFilter === 'Received') {
        matchesStatus = itemStatus === 'Received';
      } else if (statusFilter === 'Refund Pending') {
        matchesStatus = itemStatus === 'Refund Pending' || itemStatus === 'Replacement Pending';
      } else if (statusFilter === 'Completed') {
        matchesStatus = itemStatus === 'Completed' || itemStatus === 'Refunded' || itemStatus === 'Replaced' || itemStatus === 'Closed';
      } else if (statusFilter === 'Cancelled') {
        matchesStatus = itemStatus === 'Cancelled' || itemStatus === 'Rejected';
      } else {
        matchesStatus = itemStatus.toLowerCase() === statusFilter.toLowerCase();
      }
    }

    let matchesDate = true;
    if (dateFilter !== 'All' && item.createdAt) {
      const itemDate = new Date(item.createdAt);
      const now = new Date();
      if (dateFilter === 'Today') {
        matchesDate = itemDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'This Week') {
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        matchesDate = diffDays <= 7;
      } else if (dateFilter === 'This Month') {
        matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Helper for Status Badge Styling
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('request') || s.includes('pending qc') || s.includes('qc pending')) {
      return { label: 'Requested', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
    }
    if (s.includes('approved') || s.includes('in transit')) {
      return { label: 'Approved', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
    }
    if (s === 'received') {
      return { label: 'Received', bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
    }
    if (s.includes('refund pending') || s.includes('replacement pending')) {
      return { label: s.includes('replacement') ? 'Replacement Pending' : 'Refund Pending', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    }
    if (s.includes('complet') || s.includes('refunded') || s.includes('replaced') || s.includes('closed')) {
      return { label: 'Completed', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
    }
    if (s.includes('cancel') || s.includes('reject')) {
      return { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
    }
    return { label: status || 'Requested', bg: '#f8fafc', color: '#334155', border: '#e2e8f0' };
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh' }}>
      
      {/* TOAST FEEDBACK NOTIFICATION */}
      {feedback && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#065f46' : '#991b1b',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {feedback.message}
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '1.25rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#3f1d07',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <RotateCcw size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Returns
                </h1>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                  AO Core V5.5
                </span>
              </div>
              <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Manage customer product returns
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle: Returns vs Advanced */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setViewMode('simple')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: viewMode === 'simple' ? 800 : 600,
                  backgroundColor: viewMode === 'simple' ? '#ffffff' : 'transparent',
                  color: viewMode === 'simple' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'simple' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Returns
              </button>
              <button
                onClick={() => setViewMode('advanced')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: viewMode === 'advanced' ? 800 : 600,
                  backgroundColor: viewMode === 'advanced' ? '#ffffff' : 'transparent',
                  color: viewMode === 'advanced' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'advanced' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Advanced Operations
              </button>
            </div>

            <button
              onClick={loadReturnsData}
              title="Refresh Data"
              style={{
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>

            {/* Prominent + NEW RETURN Button */}
            <button
              id="btn-new-return"
              onClick={handleOpenCreateModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                backgroundColor: '#3f1d07',
                color: '#ffffff',
                fontSize: '0.825rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(63, 29, 7, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={16} /> + NEW RETURN
            </button>
          </div>

        </div>
      </div>

      {/* VIEW MODE 1: SIMPLE RETURNS MANAGEMENT (PRIMARY) */}
      {viewMode === 'simple' && (
        <>
          {/* 4 SIMPLE SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            
            {/* Card 1: RETURN REQUESTS */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'Requested' ? 'All' : 'Requested')}
              style={{
                backgroundColor: '#ffffff',
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                border: statusFilter === 'Requested' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Return Requests
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <RotateCcw size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? '...' : summaryMetrics.returnRequests}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Awaiting review & approval
              </div>
            </div>

            {/* Card 2: TO RECEIVE */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved')}
              style={{
                backgroundColor: '#ffffff',
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                border: statusFilter === 'Approved' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  To Receive
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                  <Truck size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? '...' : summaryMetrics.toReceive}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Approved returns awaiting items
              </div>
            </div>

            {/* Card 3: TO REFUND / REPLACE */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'Refund Pending' ? 'All' : 'Refund Pending')}
              style={{
                backgroundColor: '#ffffff',
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                border: statusFilter === 'Refund Pending' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  To Refund
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                  <DollarSign size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? '...' : summaryMetrics.toRefund}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Received, pending payment/dispatch
              </div>
            </div>

            {/* Card 4: COMPLETED */}
            <div
              onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
              style={{
                backgroundColor: '#ffffff',
                padding: '1.15rem 1.25rem',
                borderRadius: '12px',
                border: statusFilter === 'Completed' ? '2px solid #10b981' : '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Completed
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? '...' : summaryMetrics.completed}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                Fully refunded or replaced
              </div>
            </div>

          </div>

          {/* SEARCH & FILTERS BAR */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search Return #, Order #, Customer, Product..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem',
                    outline: 'none',
                    backgroundColor: '#f8fafc'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Requested">Requested</option>
                <option value="Approved">Approved</option>
                <option value="Received">Received</option>
                <option value="Refund Pending">Refund Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginLeft: '0.5rem' }}>Date:</span>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  backgroundColor: '#ffffff',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
              </select>
            </div>
          </div>

          {/* RETURNS TABLE */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            overflow: 'hidden'
          }}>
            {filteredReturns.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      borderBottom: '1px solid #e2e8f0',
                      textTransform: 'uppercase',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em'
                    }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Return #</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Order / Invoice #</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Customer</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Product & Qty</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Reason</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Amount</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.map(item => {
                      const badge = getStatusBadge(item.status);
                      const rawStatus = (item.status || 'Requested').toLowerCase();
                      const isRequested = rawStatus === 'requested' || rawStatus.includes('qc');
                      const isApproved = rawStatus === 'approved' || rawStatus.includes('transit') || rawStatus === 'pending receive';
                      const isReceived = rawStatus === 'received';
                      const isRefundPending = rawStatus === 'refund pending';
                      const isReplacementPending = rawStatus === 'replacement pending';
                      const isFinal = rawStatus === 'completed' || rawStatus === 'refunded' || rawStatus === 'replaced' || rawStatus === 'cancelled' || rawStatus === 'rejected' || rawStatus === 'closed';

                      const firstItem = item.items && item.items.length > 0 ? item.items[0] : null;
                      const prodName = firstItem?.product?.name || firstItem?.productName || 'Returned Product';
                      const prodQty = item.totalQty || firstItem?.quantity || 1;
                      const itemCount = item.items && item.items.length > 1 ? ` (+${item.items.length - 1} more)` : '';
                      const customerName = item.customer?.name || item.customerName || 'Customer';
                      const invNo = item.invoice?.invoiceNumber || item.invoiceNumber || 'N/A';
                      const actionTypeLabel = item.returnType === 'Replacement' ? 'Replacement' : 'Refund';

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* RETURN # */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <button
                              onClick={() => handleOpenDetails(item)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                color: '#3f1d07',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              {item.rmaNumber}
                            </button>
                          </td>

                          {/* INVOICE # */}
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                            {invNo}
                          </td>

                          {/* CUSTOMER */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{customerName}</div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{item.customerType || 'Retail Shop'}</div>
                          </td>

                          {/* PRODUCT & QTY */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {prodName}{itemCount}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              Return Qty: <strong style={{ color: '#0f172a' }}>{prodQty} unit{prodQty > 1 ? 's' : ''}</strong>
                            </div>
                          </td>

                          {/* REASON */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                              {item.returnReason || 'Damaged Product'}
                            </span>
                          </td>

                          {/* TYPE */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: actionTypeLabel === 'Replacement' ? '#eff6ff' : '#f0fdf4',
                              color: actionTypeLabel === 'Replacement' ? '#1d4ed8' : '#15803d',
                              border: actionTypeLabel === 'Replacement' ? '1px solid #bfdbfe' : '1px solid #bbf7d0'
                            }}>
                              {actionTypeLabel}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              display: 'inline-block'
                            }}>
                              {badge.label}
                            </span>
                          </td>

                          {/* AMOUNT */}
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            ₹{Number(item.refundAmount || item.totalValue || 0).toLocaleString('en-IN')}
                          </td>

                          {/* DATE */}
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(item.createdAt).toLocaleDateString('en-IN')}
                          </td>

                          {/* CONTEXT-AWARE ACTIONS */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
                              
                              {/* If REQUESTED: [Approve] and [Cancel] */}
                              {isRequested && (
                                <>
                                  <button
                                    onClick={() => handleApprove(item)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#fef3c7',
                                      color: '#b45309',
                                      border: '1px solid #fde68a',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleCancelReturn(item)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: '0.35rem 0.6rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#ffffff',
                                      color: '#94a3b8',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {/* If APPROVED: [Mark Received] and [Cancel] */}
                              {isApproved && (
                                <>
                                  <button
                                    onClick={() => handleOpenReceive(item)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#3f1d07',
                                      color: '#ffffff',
                                      border: 'none',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Mark Received
                                  </button>
                                  <button
                                    onClick={() => handleCancelReturn(item)}
                                    disabled={actionLoading}
                                    style={{
                                      padding: '0.35rem 0.6rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#ffffff',
                                      color: '#94a3b8',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {/* If RECEIVED: [Process Refund] or [Process Replacement] */}
                              {isReceived && (
                                <>
                                  {actionTypeLabel === 'Replacement' ? (
                                    <button
                                      onClick={() => handleOpenReplacement(item)}
                                      disabled={actionLoading}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        backgroundColor: '#1d4ed8',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Process Replacement
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenRefund(item)}
                                      disabled={actionLoading}
                                      style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        backgroundColor: '#047857',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Process Refund
                                    </button>
                                  )}
                                </>
                              )}

                              {/* If REFUND PENDING: [Mark Refunded] */}
                              {isRefundPending && (
                                <button
                                  onClick={() => handleOpenRefund(item)}
                                  disabled={actionLoading}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#047857',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Mark Refunded
                                </button>
                              )}

                              {/* If REPLACEMENT PENDING: [Mark Replaced] */}
                              {isReplacementPending && (
                                <button
                                  onClick={() => handleOpenReplacement(item)}
                                  disabled={actionLoading}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#1d4ed8',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Mark Replaced
                                </button>
                              )}

                              {/* Completed or Cancelled or generic view */}
                              {(isFinal || (!isRequested && !isApproved && !isReceived && !isRefundPending && !isReplacementPending)) && (
                                <button
                                  onClick={() => handleOpenDetails(item)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#ffffff',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                >
                                  <Eye size={13} /> View
                                </button>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                <Inbox size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  No Returns Found
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
                  {searchTerm || statusFilter !== 'All'
                    ? 'No return records match your search or status filter.'
                    : 'There are currently no customer returns recorded in the system.'}
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#3f1d07',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  + Create First Return
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW MODE 2: ADVANCED OPERATIONS (QC, REPACK, RECALLS, NCR) */}
      {viewMode === 'advanced' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Advanced Tab Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '0.4rem 0.5rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            gap: '0.25rem',
            overflowX: 'auto'
          }}>
            {[
              { id: 'qc', label: 'QC Inspection', icon: CheckSquare },
              { id: 'repack', label: 'Repack Orders', icon: Factory },
              { id: 'recalls', label: 'Batch Recalls', icon: AlertOctagon },
              { id: 'ncr', label: 'Manufacturing NCR', icon: ShieldAlert },
              { id: 'expiry', label: 'Near Expiry Engine', icon: Clock },
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = advancedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAdvancedTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.55rem 0.95rem',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#3f1d07' : '#64748b',
                    backgroundColor: isActive ? '#fef3c7' : 'transparent',
                    border: isActive ? '1px solid #fde68a' : '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <TabIcon size={14} style={{ color: isActive ? '#b45309' : '#94a3b8' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            {advancedTab === 'qc' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Quality Control (QC) Inspection Queue
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
                  Returns awaiting warehouse physical inspection and testing before restocking or salvage.
                </p>
                {returnsList.filter(r => r.status === 'Requested' || r.status === 'Approved').length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {returnsList.filter(r => r.status === 'Requested' || r.status === 'Approved').map(ret => (
                      <div key={ret.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 800, color: '#3f1d07' }}>{ret.rmaNumber}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>{ret.status}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{ret.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Reason: {ret.returnReason}</div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleOpenReceive(ret)}
                            style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                          >
                            Perform QC & Receive
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No items currently pending QC inspection.</p>
                )}
              </div>
            )}

            {advancedTab === 'repack' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Repacking Work Orders
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Goods recovered from returns requiring label replacement or repacking into sellable units.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>0 active repacking work orders in progress.</p>
              </div>
            )}

            {advancedTab === 'recalls' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Batch Recall Safety Center
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Emergency containment and recall tracking for manufacturing quality incidents.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No active manufacturing batch recalls.</p>
              </div>
            )}

            {advancedTab === 'ncr' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Non-Conformance Reports (NCR) & CAPA
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Root-cause investigations and corrective actions for recurring return causes.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>0 open non-conformance reports.</p>
              </div>
            )}

            {advancedTab === 'expiry' && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  Near-Expiry Prevention Engine
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Proactive shelf-life monitoring to transfer stock to high-velocity stores before expiration.
                </p>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All active warehouse batches are within healthy shelf-life parameters.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: + NEW RETURN MULTI-STEP WIZARD                                    */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: '#3f1d07',
              color: '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#fde68a' }}>
                  Create Customer Return
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '0.2rem' }}>
                  Step {createStep} of 4: {
                    createStep === 1 ? 'Search & Select Order' :
                    createStep === 2 ? 'Select Items & Quantities' :
                    createStep === 3 ? 'Return Reason' : 'Action (Refund / Replacement)'
                  }
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#fde68a', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Stepper Bar */}
            <div style={{ display: 'flex', backgroundColor: '#2b1405', padding: '0.35rem 1.5rem', gap: '0.4rem' }}>
              {[1, 2, 3, 4].map(st => (
                <div
                  key={st}
                  style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: createStep >= st ? '#f59e0b' : 'rgba(255,255,255,0.2)'
                  }}
                />
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1 }}>

              {/* STEP 1: ORDER SEARCH */}
              {createStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Search Original Order / Invoice
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                        <input
                          id="input-order-search"
                          type="text"
                          placeholder="Search Invoice #, Customer Name, or Mobile..."
                          value={orderQuery}
                          onChange={e => setOrderQuery(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') triggerOrderSearch(); }}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem'
                          }}
                        />
                      </div>
                      <button
                        onClick={() => triggerOrderSearch()}
                        disabled={isSearchingOrders}
                        style={{
                          padding: '0.55rem 1.1rem',
                          borderRadius: '8px',
                          backgroundColor: '#3f1d07',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {isSearchingOrders ? 'Searching...' : 'Find Order'}
                      </button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {orderSearchResults.length > 0 && (
                    <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      {orderSearchResults.map(order => (
                        <div
                          key={order.invoiceId}
                          onClick={() => handleSelectOrder(order)}
                          style={{
                            padding: '0.85rem 1rem',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#3f1d07', fontFamily: 'monospace' }}>
                              {order.invoiceNumber}
                            </div>
                            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                              {order.customer?.name}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {new Date(order.date).toLocaleDateString('en-IN')} • {order.items?.length || 0} line item(s)
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: '#047857', fontSize: '0.9rem' }}>
                              ₹{Number(order.totalAmount || 0).toLocaleString('en-IN')}
                            </div>
                            <span style={{ fontSize: '0.725rem', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                              Select <ChevronRight size={13} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {orderSearchResults.length === 0 && !isSearchingOrders && orderQuery.length >= 2 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                        No orders found matching "{orderQuery}". Check the invoice number or customer name.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: SELECT ITEMS & RETURN QUANTITY */}
              {createStep === 2 && selectedOrder && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Order Selected:</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      {selectedOrder.invoiceNumber} — {selectedOrder.customer?.name}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                      Select Items and Return Quantity (Max = Sold Quantity):
                    </label>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      {returnItems.map((item, idx) => (
                        <div
                          key={item.productId || idx}
                          style={{
                            padding: '0.85rem 1rem',
                            borderBottom: idx < returnItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: item.returnQty > 0 ? '#f0fdf4' : '#ffffff'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                              {item.productName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Sold Qty: <strong>{item.soldQty}</strong> • Rate: ₹{item.unitPrice}
                            </div>
                          </div>

                          {/* Stepper: [-] [qty] [+] */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(idx, -1)}
                              disabled={item.returnQty <= 0}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: item.returnQty <= 0 ? '#cbd5e1' : '#0f172a',
                                fontWeight: 800,
                                cursor: item.returnQty <= 0 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                              {item.returnQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(idx, 1)}
                              disabled={item.returnQty >= item.soldQty}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: item.returnQty >= item.soldQty ? '#cbd5e1' : '#0f172a',
                                fontWeight: 800,
                                cursor: item.returnQty >= item.soldQty ? 'not-allowed' : 'pointer'
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: RETURN REASON */}
              {createStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Reason for Return *
                    </label>
                    <select
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="Damaged Product">Damaged Product</option>
                      <option value="Wrong Product Delivered">Wrong Product Delivered</option>
                      <option value="Expired Product">Expired Product</option>
                      <option value="Product Not Needed">Product Not Needed</option>
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Customer Changed Mind">Customer Changed Mind</option>
                      <option value="Other">Other (Please Specify)</option>
                    </select>
                  </div>

                  {returnReason === 'Other' && (
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                        Specific Reason Details *
                      </label>
                      <input
                        type="text"
                        placeholder="Describe the reason for return..."
                        value={returnReasonNotes}
                        onChange={e => setReturnReasonNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.55rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.825rem'
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Additional Notes / Remarks (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Customer feedback, delivery partner notes, or batch conditions..."
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.825rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: ACTION (REFUND VS REPLACEMENT) */}
              {createStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Radio Choice */}
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                      Choose Resolution Action:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div
                        onClick={() => setActionType('Refund')}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          border: actionType === 'Refund' ? '2px solid #059669' : '1px solid #cbd5e1',
                          backgroundColor: actionType === 'Refund' ? '#ecfdf5' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <DollarSign size={18} style={{ color: actionType === 'Refund' ? '#059669' : '#64748b' }} />
                          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Issue Refund</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                          Credit original payment method, bank transfer, cash, or balance.
                        </div>
                      </div>

                      <div
                        onClick={() => setActionType('Replacement')}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          border: actionType === 'Replacement' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: actionType === 'Replacement' ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Package size={18} style={{ color: actionType === 'Replacement' ? '#2563eb' : '#64748b' }} />
                          <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Replacement Item</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                          Dispatch fresh product replacement to customer.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Refund Form Details */}
                  {actionType === 'Refund' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Refund Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={e => setRefundAmount(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#047857'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Refund Method
                        </label>
                        <select
                          value={refundMethod}
                          onChange={e => setRefundMethod(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.825rem'
                          }}
                        >
                          <option value="Original Payment Method">Original Payment Method</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                          <option value="UPI">UPI / GPay / PhonePe</option>
                          <option value="Customer Balance / Credit Note">Store Credit / Customer Balance</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Replacement Form Details */}
                  {actionType === 'Replacement' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Replacement Product
                        </label>
                        <select
                          value={replacementProductId}
                          onChange={e => setReplacementProductId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.825rem'
                          }}
                        >
                          {productsCatalog.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Replacement Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={replacementQuantity}
                          onChange={e => setReplacementQuantity(Number(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            fontWeight: 700
                          }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              {createStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep(prev => prev - 1)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}

              {createStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (createStep === 1 && !selectedOrder) {
                      alert('Please search and select an order first.');
                      return;
                    }
                    if (createStep === 2) {
                      const totalSelected = returnItems.reduce((sum, it) => sum + it.returnQty, 0);
                      if (totalSelected === 0) {
                        alert('Please choose at least 1 item with return quantity > 0.');
                        return;
                      }
                    }
                    setCreateStep(prev => prev + 1);
                  }}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: '#3f1d07',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-submit-return"
                  onClick={handleCreateReturnSubmit}
                  disabled={actionLoading}
                  style={{
                    padding: '0.55rem 1.4rem',
                    borderRadius: '8px',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Creating Return...' : 'Create Return'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MARK RECEIVED CONFIRMATION                                        */}
      {/* ========================================================================= */}
      {showReceiveModal && itemToReceive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.15rem 1.5rem',
              backgroundColor: '#3f1d07',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fde68a' }}>
                  Mark Item as Received
                </h3>
                <div style={{ fontSize: '0.725rem', color: '#d1d5db', marginTop: '0.15rem' }}>
                  {itemToReceive.rmaNumber} • {itemToReceive.customerName}
                </div>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                style={{ background: 'none', border: 'none', color: '#fde68a', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Condition Dropdown */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Condition of Received Item *
                </label>
                <select
                  value={receiveCondition}
                  onChange={e => setReceiveCondition(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  <option value="Good">Good Condition (Restock into sellable inventory)</option>
                  <option value="Damaged">Damaged (Do not restock - log to Stock Loss)</option>
                  <option value="Expired">Expired (Do not restock - log to Stock Loss)</option>
                  <option value="Not Resalable">Not Resalable (Do not restock - log to Stock Loss)</option>
                </select>
                <div style={{ fontSize: '0.725rem', color: receiveCondition === 'Good' ? '#047857' : '#b45309', marginTop: '0.35rem', fontWeight: 600 }}>
                  {receiveCondition === 'Good'
                    ? '✓ Product stock will automatically be incremented atomically upon receipt.'
                    : '⚠ Product stock will NOT be added to inventory; item will be logged under Stock Loss.'}
                </div>
              </div>

              {/* Warehouse Location */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Receiving Location / Warehouse
                </label>
                <input
                  type="text"
                  value={warehouseLocation}
                  onChange={e => setWarehouseLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              {/* Inspection Notes */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Inspection / Receiving Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Seals verified, package condition, visual checks..."
                  value={receiveNotes}
                  onChange={e => setReceiveNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

            </div>

            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={actionLoading}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  backgroundColor: '#3f1d07',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Confirm Receipt'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PROCESS REFUND CONFIRMATION                                       */}
      {/* ========================================================================= */}
      {showRefundModal && itemToRefund && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.15rem 1.5rem',
              backgroundColor: '#065f46',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Process Customer Refund
                </h3>
                <div style={{ fontSize: '0.725rem', color: '#a7f3d0', marginTop: '0.15rem' }}>
                  {itemToRefund.rmaNumber} • {itemToRefund.customerName}
                </div>
              </div>
              <button
                onClick={() => setShowRefundModal(false)}
                style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  value={processRefundAmount}
                  onChange={e => setProcessRefundAmount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#047857'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Refund Method
                </label>
                <select
                  value={processRefundMethod}
                  onChange={e => setProcessRefundMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                >
                  <option value="Original Payment Method">Original Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Customer Balance / Credit Note">Store Credit / Customer Balance</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Reference / Transaction # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-2026-998822 or Bank Ref"
                  value={refundRefNumber}
                  onChange={e => setRefundRefNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Refund Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional confirmation note for the customer..."
                  value={processRefundNotes}
                  onChange={e => setProcessRefundNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={actionLoading}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PROCESS REPLACEMENT CONFIRMATION                                  */}
      {/* ========================================================================= */}
      {showReplacementModal && itemToReplace && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1.15rem 1.5rem',
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Process Product Replacement
                </h3>
                <div style={{ fontSize: '0.725rem', color: '#bfdbfe', marginTop: '0.15rem' }}>
                  {itemToReplace.rmaNumber} • {itemToReplace.customerName}
                </div>
              </div>
              <button
                onClick={() => setShowReplacementModal(false)}
                style={{ background: 'none', border: 'none', color: '#bfdbfe', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Replacement Product *
                </label>
                <select
                  value={processReplacementProdId}
                  onChange={e => setProcessReplacementProdId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                >
                  {productsCatalog.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Replacement Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  value={processReplacementQty}
                  onChange={e => setProcessReplacementQty(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Dispatch Courier / Tracking Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ST Courier / Hand Delivery / AirWay Bill"
                  value={replacementTracking}
                  onChange={e => setReplacementTracking(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Delivery or packing remarks..."
                  value={processReplacementNotes}
                  onChange={e => setProcessReplacementNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setShowReplacementModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplacement}
                disabled={actionLoading}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  backgroundColor: '#1e3a8a',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Processing...' : 'Confirm Replacement'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: RETURN DETAILS & STATUS TIMELINE                                  */}
      {/* ========================================================================= */}
      {showDetailsModal && viewReturn && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: '#3f1d07',
              color: '#ffffff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fde68a' }}>
                  Return Details: {viewReturn.rmaNumber}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '0.2rem' }}>
                  Order #{viewReturn.invoiceNumber || viewReturn.invoice?.invoiceNumber || 'N/A'} • {new Date(viewReturn.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{ background: 'none', border: 'none', color: '#fde68a', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* TIMELINE VIEW */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                  Lifecycle Progress
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {[
                    { label: 'Requested', done: true, date: viewReturn.createdAt },
                    { label: 'Approved', done: viewReturn.status !== 'Requested', date: null },
                    { label: 'Received', done: viewReturn.receivedAt || ['Received', 'Refund Pending', 'Replacement Pending', 'Completed'].includes(viewReturn.status), date: viewReturn.receivedAt },
                    { label: viewReturn.returnType === 'Replacement' ? 'Replaced' : 'Refunded', done: viewReturn.status === 'Completed', date: viewReturn.refundedAt || viewReturn.completedAt },
                    { label: 'Completed', done: viewReturn.status === 'Completed', date: viewReturn.completedAt }
                  ].map((step, idx, arr) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1 }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: step.done ? '#059669' : '#e2e8f0',
                        color: step.done ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 800
                      }}>
                        {step.done ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: step.done ? 800 : 500, color: step.done ? '#0f172a' : '#94a3b8', marginTop: '0.3rem', textAlign: 'center' }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OVERVIEW DETAILS GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>CUSTOMER</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    {viewReturn.customerName || viewReturn.customer?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Type: {viewReturn.customerType || 'Retail Shop'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>STATUS & ACTION</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#3f1d07', marginTop: '0.2rem' }}>
                    {viewReturn.status} • {viewReturn.returnType || 'Refund'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700 }}>
                    Value: ₹{Number(viewReturn.refundAmount || viewReturn.totalValue || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>RETURN REASON</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', marginTop: '0.2rem' }}>
                    {viewReturn.returnReason || 'Damaged Product'}
                  </div>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>INVENTORY STATUS</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: viewReturn.stockUpdated ? '#047857' : '#b45309', marginTop: '0.2rem' }}>
                    {viewReturn.stockUpdated
                      ? `Stock Adjusted (${viewReturn.productCondition || 'Good'})`
                      : 'Stock Not Adjusted Yet'}
                  </div>
                </div>
              </div>

              {/* RETURN ITEMS TABLE */}
              {viewReturn.items && viewReturn.items.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Returned Line Items
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Product</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewReturn.items.map((it, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                              {it.productName || it.product?.name}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 700 }}>
                              {it.quantity}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                              ₹{it.unitPrice}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>
                              ₹{Number(it.quantity * it.unitPrice).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* REMARKS / AUDIT LOGS */}
              {viewReturn.qcRemarks && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    History & Remarks
                  </div>
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.78rem',
                    color: '#334155',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                  }}>
                    {viewReturn.qcRemarks}
                  </div>
                </div>
              )}

            </div>

            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: '6px',
                  backgroundColor: '#3f1d07',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
