import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { salesApi, productsApi, customersApi, whatsappApi } from '../api';
import { downloadInvoicePdf, getInvoicePdfBlob } from '../utils/invoicePdf';
import { downloadInvoiceJpg, shareInvoiceWhatsApp } from '../utils/invoiceImage';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import CustomerPicker from '../components/CustomerPicker';

export default function SaleView() {

  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const captureRef = useRef(null);
  const exportRef = useRef(null);
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState('');
  const { user } = useAuth();

  // Redesign States
  const [zoom, setZoom] = useState(90);
  const [fitMode, setFitMode] = useState('page');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scale zoom for mobile devices to prevent layout shift
  useEffect(() => {
    if (settings) {
      const screenWidth = window.innerWidth;
      if (screenWidth < 768) {
        const pad = 24; // responsive preview wrapper padding
        const availableWidth = screenWidth - pad;
        const paperSize = settings.paperSize || 'A4';
        const sheetWidth = paperSize === 'A5' ? 559 : 794; // A5 (148mm) vs A4 (210mm) pixel-based width
        const calculatedZoom = Math.floor((availableWidth / sheetWidth) * 100);
        setZoom(Math.max(25, Math.min(90, calculatedZoom)));
      }
    }
  }, [settings]);

  // Payment recording state
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('upi');
  const [payRefNumber, setPayRefNumber] = useState('');

  // Payment edit state
  const [editingPayment, setEditingPayment] = useState(null);
  const [payEditAmount, setPayEditAmount] = useState(0);
  const [payEditDate, setPayEditDate] = useState('');
  const [payEditMethod, setPayEditMethod] = useState('upi');
  const [payEditRefNumber, setPayEditRefNumber] = useState('');

  // WhatsApp dispatch modal state
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waAttachPdf, setWaAttachPdf] = useState(true);
  const [waTemplate, setWaTemplate] = useState('invoice');
  const [waSending, setWaSending] = useState(false);
  const [showWaSuccessModal, setShowWaSuccessModal] = useState(false);
  const [waSuccessData, setWaSuccessData] = useState(null);

  const openWaModal = () => {
    if (sale) {
      const defaultPhone = sale.customer?.phone || '';
      setWaPhone(defaultPhone);
      const customerName = sale.customer?.name || 'Customer';
      const invoiceNumber = sale.invoiceNumber;
      const amount = Number(sale.grandTotal).toLocaleString('en-IN');
      const company = settings?.companyName || 'Amudhasurabiy Organics';
      const defaultMsg = `Dear ${customerName},\n\nPlease find attached invoice *${invoiceNumber}* for amount *₹${amount}*.\n\nThank you for your business!\n${company}`;
      setWaMessage(defaultMsg);
      setWaTemplate('invoice');
      setWaAttachPdf(true);
      setWaModalOpen(true);
    }
  };

  const handleTemplateChange = (tmpl) => {
    setWaTemplate(tmpl);
    if (!sale) return;
    const customerName = sale.customer?.name || 'Customer';
    const invoiceNumber = sale.invoiceNumber;
    const amount = Number(sale.grandTotal).toLocaleString('en-IN');
    const dueDate = sale.dueDate ? new Date(sale.dueDate).toLocaleDateString('en-IN') : '';
    const company = settings?.companyName || 'Amudhasurabiy Organics';
    const activeShip = sale.shipments && sale.shipments.length > 0 ? sale.shipments[0] : null;
    const courier = activeShip?.courier || 'our delivery partner';
    const awb = activeShip?.trackingNumber || 'N/A';
    const trackingUrl = activeShip?.trackingNumber ? `${window.location.origin}/track/${activeShip.trackingNumber}` : `${window.location.origin}/track`;

    let msg = '';
    if (tmpl === 'invoice') {
      msg = `Dear ${customerName},\n\nPlease find attached invoice *${invoiceNumber}* for amount *₹${amount}*.\n\nThank you for your business!\n${company}`;
    } else if (tmpl === 'reminder') {
      msg = `Dear ${customerName},\n\nThis is a friendly reminder that invoice *${invoiceNumber}* of amount *₹${amount}* was due on *${dueDate}*.\n\nPlease process the payment at your earliest convenience.\n\nThank you!\n${company}`;
    } else if (tmpl === 'tracking') {
      msg = `Dear ${customerName},\n\nYour order against invoice *${invoiceNumber}* has been shipped via *${courier}* with Tracking/AWB *${awb}*.\n\nYou can track your shipment here: ${trackingUrl}\n\nThank you!\n${company}`;
    } else if (tmpl === 'greeting') {
      msg = `Dear ${customerName},\n\nWarm greetings from *${company}*! We wish you a prosperous day ahead.\n\nThank you for being our valued partner!`;
    }
    setWaMessage(msg);
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone) {
      toast('Recipient phone number is required', 'error');
      return;
    }
    setWaSending(true);
    try {
      let response;
      if (waAttachPdf) {
        const pdfBlob = await getInvoicePdfBlob(sale, settings);
        const file = new File([pdfBlob], `${sale.invoiceNumber}.pdf`, { type: 'application/pdf' });
        
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('phone', waPhone);
        formData.append('message', waMessage);
        formData.append('customerId', sale.customerId || sale.customer?.id || '');
        formData.append('messageType', waTemplate === 'invoice' ? 'Invoice' : (waTemplate === 'reminder' ? 'Payment Reminder' : (waTemplate === 'tracking' ? 'Shipment' : 'Greeting')));
        formData.append('invoiceId', sale.id);

        const res = await whatsappApi.sendPdf(formData);
        response = res.data;
        toast('✓ Invoice PDF sent successfully via WhatsApp!', 'success');
      } else {
        const payload = {
          phone: waPhone,
          message: waMessage,
          customerId: sale.customerId || sale.customer?.id || '',
          messageType: waTemplate === 'invoice' ? 'Invoice' : (waTemplate === 'reminder' ? 'Payment Reminder' : (waTemplate === 'tracking' ? 'Shipment' : 'Greeting')),
          invoiceId: sale.id
        };
        const res = await whatsappApi.sendText(payload);
        response = res.data;
        toast('✓ Message sent successfully via WhatsApp!', 'success');
      }
      
      if (response && response.data) {
        setWaSuccessData(response.data);
        setShowWaSuccessModal(true);
      }
      setWaModalOpen(false);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to dispatch WhatsApp message', 'error');
    } finally {
      setWaSending(false);
    }
  };

  // Edit Form state
  const [isEditing, setIsEditing] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [editPaymentStatus, setEditPaymentStatus] = useState('paid');
  const [editAmountPaid, setEditAmountPaid] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editGstBillingMode, setEditGstBillingMode] = useState('exclusive');
  const [editShippingCharge, setEditShippingCharge] = useState(0);
  const [editPackingCharge, setEditPackingCharge] = useState(0);
  const [editHandlingCharge, setEditHandlingCharge] = useState(0);
  const [editCourierCharge, setEditCourierCharge] = useState(0);
  const [editOtherCharge, setEditOtherCharge] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editCart, setEditCart] = useState([]);

  // Load payment history helper
  const loadPaymentHistory = (customerId) => {
    if (!customerId) return;
    salesApi.listPayments({ customerId }).then(({ data }) => {
      setPayments(data || []);
    }).catch(err => console.error('Error loading payments:', err));
  };

  useEffect(() => {
    salesApi.get(id).then(({ data }) => { 
      setSale(data.sale); 
      setSettings(data.settings); 
      if (data.sale?.customerId || data.sale?.customer?.id) {
        loadPaymentHistory(data.sale.customerId || data.sale.customer?.id);
      }
    });
  }, [id]);

  // Sync Record Payment pre-filled values
  useEffect(() => {
    if (showPaymentModal && sale) {
      const outstanding = Math.max(0, Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0));
      setPayAmount(outstanding);
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayMethod('upi');
      setPayRefNumber('');
    }
  }, [showPaymentModal, sale]);

  // Computed allocations for the current invoice
  const invoicePayments = useMemo(() => {
    if (!sale || !payments.length) return [];
    return payments.filter(p => {
      let allocs = [];
      if (typeof p.allocations === 'string') {
        try { allocs = JSON.parse(p.allocations); } catch (e) {}
      } else if (Array.isArray(p.allocations)) {
        allocs = p.allocations;
      }
      return allocs.some(alloc => String(alloc.invoiceId) === String(sale.id || id));
    });
  }, [payments, sale, id]);

  const getInvoiceAllocatedAmount = (payment) => {
    let allocs = [];
    if (typeof payment.allocations === 'string') {
      try { allocs = JSON.parse(payment.allocations); } catch (e) {}
    } else if (Array.isArray(payment.allocations)) {
      allocs = payment.allocations;
    }
    const matched = allocs.find(alloc => String(alloc.invoiceId) === String(sale.id || id));
    return matched ? Number(matched.amount || 0) : Number(payment.amount || 0);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (payAmount <= 0) {
      toast('Payment amount must be greater than zero', 'error');
      return;
    }
    const outstanding = Math.max(0, Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0));
    if (payAmount > outstanding) {
      if (!window.confirm(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${outstanding}). Continue?`)) {
        return;
      }
    }

    setBusy('saving-payment');
    try {
      await salesApi.recordPayment({
        customerId: sale.customerId || sale.customer?.id,
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        referenceNumber: payRefNumber || null,
        paymentDate: payDate,
        allocations: [
          { invoiceId: sale.id || id, amount: parseFloat(payAmount) }
        ]
      });

      toast('Payment recorded successfully', 'success');
      setShowPaymentModal(false);

      // Reload sale details and payment history
      const { data } = await salesApi.get(id);
      setSale(data.sale);
      setSettings(data.settings);
      if (data.sale?.customerId || data.sale?.customer?.id) {
        loadPaymentHistory(data.sale.customerId || data.sale.customer?.id);
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to record payment', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleStartEditPayment = (payment) => {
    setEditingPayment(payment);
    setPayEditAmount(getInvoiceAllocatedAmount(payment));
    setPayEditDate(new Date(payment.date).toISOString().split('T')[0]);
    setPayEditMethod(payment.paymentMethod || 'upi');
    setPayEditRefNumber(payment.referenceNumber || '');
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (payEditAmount <= 0) {
      toast('Payment amount must be greater than zero', 'error');
      return;
    }

    setBusy('saving-payment');
    try {
      // Find the specific allocation for this invoice to update its amount
      let allocs = [];
      if (typeof editingPayment.allocations === 'string') {
        try { allocs = JSON.parse(editingPayment.allocations); } catch (e) {}
      } else if (Array.isArray(editingPayment.allocations)) {
        allocs = editingPayment.allocations;
      }
      
      const newAllocs = allocs.map(alloc => {
        if (String(alloc.invoiceId) === String(sale.id || id)) {
          return { ...alloc, amount: parseFloat(payEditAmount) };
        }
        return alloc;
      });

      await salesApi.updatePayment(editingPayment.id, {
        amount: parseFloat(payEditAmount),
        paymentMethod: payEditMethod,
        referenceNumber: payEditRefNumber || null,
        paymentDate: payEditDate,
        allocations: newAllocs
      });

      toast('Payment updated successfully', 'success');
      setEditingPayment(null);

      // Reload sale details and payment history
      const { data } = await salesApi.get(id);
      setSale(data.sale);
      setSettings(data.settings);
      if (data.sale?.customerId || data.sale?.customer?.id) {
        loadPaymentHistory(data.sale.customerId || data.sale.customer?.id);
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to update payment', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to cancel this payment? This action cannot be undone.')) {
      return;
    }

    setBusy('deleting-payment');
    try {
      await salesApi.deletePayment(paymentId);
      toast('Payment cancelled successfully', 'success');

      // Reload sale details and payment history
      const { data } = await salesApi.get(id);
      setSale(data.sale);
      setSettings(data.settings);
      if (data.sale?.customerId || data.sale?.customer?.id) {
        loadPaymentHistory(data.sale.customerId || data.sale.customer?.id);
      }
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to delete payment', 'error');
    } finally {
      setBusy('');
    }
  };

  // Calculations helper for frontend edit form
  const computedValues = useMemo(() => {
    if (!isEditing) return null;
    
    // 1. GST Mode
    const custObj = customers.find(c => String(c.id || c._id) === String(editCustomerId));
    let activeGstMode = editGstBillingMode;
    if (activeGstMode === 'default' && custObj) {
      if (custObj.customerType === 'White Label') activeGstMode = 'exclusive';
      else if (custObj.customerType === 'D2C Customer') activeGstMode = 'inclusive';
      else if (custObj.customerType === 'Export Customer') activeGstMode = 'no_gst';
      else activeGstMode = settings?.defaultGstMode || 'exclusive';
    }

    // 2. Subtotal & GST
    let subtotal = 0;
    let gstTotal = 0;
    editCart.forEach((item) => {
      const qty = Number(item.qty || 0);
      const basePrice = Number(item.unitPrice || 0);
      const price = basePrice;
      const gst = Number(item.gstPercent || 0);

      if (activeGstMode === 'inclusive') {
        const lineTotal = qty * price;
        const taxable = lineTotal / (1 + gst / 100);
        subtotal += taxable;
        gstTotal += (lineTotal - taxable);
      } else if (activeGstMode === 'no_gst') {
        subtotal += qty * price;
        gstTotal += 0;
      } else { // exclusive
        const taxable = qty * price;
        subtotal += taxable;
        gstTotal += (taxable * gst) / 100;
      }
    });

    const totalCharges = Number(editShippingCharge) + Number(editPackingCharge) + Number(editHandlingCharge) + Number(editCourierCharge) + Number(editOtherCharge);
    const grandTotalBeforeRound = subtotal + gstTotal + totalCharges - Number(editDiscount);
    const grandTotal = Math.max(0, Math.round(grandTotalBeforeRound));
    const roundOff = Number((grandTotal - grandTotalBeforeRound).toFixed(2));

    return {
      subtotal,
      gstTotal,
      grandTotal,
      roundOff,
      totalCharges,
      activeGstMode
    };
  }, [
    isEditing,
    editCart,
    editCustomerId,
    editGstBillingMode,
    editDiscount,
    editShippingCharge,
    editPackingCharge,
    editHandlingCharge,
    editCourierCharge,
    editOtherCharge,
    customers,
    settings
  ]);

  const startEdit = async () => {
    // Check lock conditions first
    const activeShip = sale?.shipments && sale.shipments.length > 0 ? sale.shipments[0] : null;
    if (activeShip?.status === 'Delivered' || activeShip?.courierStatus === 'Delivered' || sale.status === 'Delivered' || sale.status === 'Archived') {
      alert("This invoice is locked because delivery has already been completed.");
      return;
    }

    // Check payment protection
    const pStatus = String(sale.paymentStatus).toLowerCase();
    if (pStatus === 'paid' || pStatus === 'partial' || Number(sale.amountPaid) > 0) {
      if (!window.confirm("This invoice has payment records attached. Editing may affect outstanding calculations. Do you want to continue?")) {
        return;
      }
    }

    setBusy('loading-edit');
    try {
      const [pRes, cRes] = await Promise.all([
        productsApi.list({ limit: 200 }),
        customersApi.list({ limit: 200 })
      ]);
      setProducts(pRes.data?.products || []);
      setCustomers(cRes.data?.customers || []);
      
      // Initialize edit state variables
      setEditCustomerId(sale.customerId || sale.customer?.id || '');
      setEditDate(sale.date ? sale.date.split('T')[0] : '');
      setEditDueDate(sale.dueDate ? sale.dueDate.split('T')[0] : '');
      setEditPaymentMethod(sale.paymentMethod || 'cash');
      setEditPaymentStatus(sale.paymentStatus || 'paid');
      setEditAmountPaid(sale.amountPaid || 0);
      setEditDiscount(sale.discount || 0);
      setEditGstBillingMode(sale.gstBillingMode || 'exclusive');
      setEditShippingCharge(sale.shippingCharge || 0);
      setEditPackingCharge(sale.packingCharge || 0);
      setEditHandlingCharge(sale.handlingCharge || 0);
      setEditCourierCharge(sale.courierCharge || 0);
      setEditOtherCharge(sale.otherCharge || 0);
      setEditNotes(sale.notes || '');
      
          // Initialize cart with sale items
      const initialCart = (sale.items || []).map(item => ({
        product: item.productId || (typeof item.product === 'object' ? item.product?.id || item.product?._id : item.product),
        name: item.name,
        qty: item.qty,
        freeQty: item.freeQty || 0,
        unitPrice: item.unitPrice,
        gstPercent: item.gstPercent,
        stock: item.product?.stock !== undefined ? item.product.stock : 9999,
        weight: item.product?.weight || 0.200,
        schemeApplied: item.schemeApplied || 'None'
      }));
      setEditCart(initialCart);

      setIsEditing(true);
    } catch (err) {
      console.error(err);
      toast('Failed to load customers or products list', 'error');
    } finally {
      setBusy('');
    }
  };

  const addToEditCart = (productId) => {
    const p = products.find((x) => String(x.id || x._id) === String(productId));
    if (!p) return;
    const existing = editCart.find((c) => c.product === (p.id || p._id));
    
    // Look up customer special price
    const selectedCustomer = customers.find(c => String(c.id || c._id) === String(editCustomerId));
    const specialPricing = selectedCustomer ? (selectedCustomer.specialPricing || {}) : {};
    const override = specialPricing[p.id] || specialPricing[p.sku] || null;
    
    let basePrice = p.sellingPrice;
    let itemDiscountPercent = 0;
    let schemeApplied = 'None';
    
    if (override) {
      if (typeof override === 'object') {
        if (override.price !== undefined && override.price !== null && override.price !== '') {
          basePrice = Number(override.price);
        }
        if (override.discount !== undefined && override.discount !== null && override.discount !== '') {
          itemDiscountPercent = Number(override.discount);
        }
        if (override.scheme !== undefined && override.scheme !== null && override.scheme !== '') {
          schemeApplied = override.scheme;
        }
      } else if (typeof override === 'number') {
        basePrice = override;
      }
    }

    if (existing) {
      const newQty = existing.qty + 1;
      let newFreeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        newFreeQty = Math.floor(newQty / buyQty) * getQty;
      }
      setEditCart(editCart.map((c) => c.product === (p.id || p._id) ? { ...c, qty: newQty, freeQty: newFreeQty } : c));
    } else {
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(1 / buyQty) * getQty;
      }

      setEditCart([
        ...editCart,
        {
          product: p.id || p._id,
          name: p.name,
          qty: 1,
          unitPrice: basePrice,
          gstPercent: p.gstPercent,
          stock: p.stock,
          weight: p.weight || 0.200,
          schemeApplied: schemeApplied,
          freeQty: freeQty,
        },
      ]);
    }
  };

  const updateEditQty = (productId, qty) => {
    if (qty < 1) { setEditCart(editCart.filter((c) => c.product !== productId)); return; }
    setEditCart(editCart.map((c) => {
      if (c.product !== productId) return c;
      const updated = { ...c, qty };
      
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = (c.schemeApplied || 'None').match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(qty / buyQty) * getQty;
      }
      updated.freeQty = freeQty;
      return updated;
    }));
  };

  const updateEditCartItem = (productId, field, value) => {
    setEditCart(editCart.map((c) => {
      if (c.product !== productId) return c;
      const updated = { ...c, [field]: value };
      
      if (field === 'schemeApplied') {
        const qty = Number(c.qty || 0);
        let freeQty = 0;
        const schemeRegex = /^(\d+)\+(\d+)$/;
        const matchScheme = value.match(schemeRegex);
        if (matchScheme) {
          const buyQty = Number(matchScheme[1]);
          const getQty = Number(matchScheme[2]);
          freeQty = Math.floor(qty / buyQty) * getQty;
        }
        updated.freeQty = freeQty;
      }
      return updated;
    }));
  };

  const handleSaveEdit = async () => {
    if (!editCustomerId || !editCart.length) {
      toast('Select customer and add at least one item', 'error');
      return;
    }
    
    setBusy('saving');
    try {
      const payload = {
        customer: editCustomerId,
        date: editDate,
        dueDate: editDueDate,
        paymentMethod: editPaymentMethod,
        paymentStatus: editPaymentStatus,
        amountPaid: editPaymentStatus === 'paid' ? computedValues.grandTotal : editAmountPaid,
        gstBillingMode: computedValues.activeGstMode,
        discount: editDiscount,
        shippingCharge: editShippingCharge,
        packingCharge: editPackingCharge,
        handlingCharge: editHandlingCharge,
        courierCharge: editCourierCharge,
        otherCharge: editOtherCharge,
        notes: editNotes,
        items: editCart.map(i => ({
          product: i.product,
          qty: i.qty,
          freeQty: i.freeQty,
          unitPrice: i.unitPrice,
          gstPercent: i.gstPercent,
          schemeApplied: i.schemeApplied || 'None'
        }))
      };

      await salesApi.update(id, payload);
      toast('Invoice updated successfully', 'success');
      setIsEditing(false);
      
      // Reload page data
      const { data } = await salesApi.get(id);
      setSale(data.sale);
      setSettings(data.settings);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to update invoice', 'error');
    } finally {
      setBusy('');
    }
  };

  const getEl = () => exportRef.current || captureRef.current;

  const handleJpg = async () => {
    setBusy('jpg');
    try {
      await downloadInvoiceJpg(getEl(), `${sale.invoiceNumber}.jpg`);
      toast('Invoice JPG downloaded', 'success');
    } catch {
      toast('Failed to create JPG', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleDownloadPng = async () => {
    setBusy('png');
    try {
      const el = getEl();
      if (!el) {
        toast('Invoice element not found', 'error');
        return;
      }
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${sale.invoiceNumber}.png`;
          a.click();
          URL.revokeObjectURL(url);
          toast('Invoice PNG downloaded', 'success');
        } else {
          toast('Failed to create PNG blob', 'error');
        }
      }, 'image/png', 1.0);
    } catch (err) {
      toast('Failed to create PNG: ' + err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleSharePdf = async () => {
    setBusy('share-pdf');
    try {
      const pdfBlob = await getInvoicePdfBlob(sale, settings);
      const file = new File([pdfBlob], `${sale.invoiceNumber}.pdf`, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${sale.invoiceNumber}`,
          text: `Please find attached invoice ${sale.invoiceNumber} from ${settings?.companyName || 'Amudhasurabiy Organics'}.`,
        });
        toast('PDF shared successfully', 'success');
      } else {
        await downloadInvoicePdf(sale, settings);
        toast('Device does not support direct sharing. PDF downloaded.', 'info');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast('Failed to share PDF: ' + err.message, 'error');
      }
    } finally {
      setBusy('');
    }
  };

  const handleEmailPdf = async () => {
    setBusy('email-pdf');
    try {
      await downloadInvoicePdf(sale, settings);
      const customerEmail = sale.customer?.email || '';
      const subject = encodeURIComponent(`Invoice ${sale.invoiceNumber} from ${settings?.companyName || 'Amudhasurabiy Organics'}`);
      const body = encodeURIComponent(`Dear ${sale.customer?.name || 'Customer'},\n\nPlease find attached your invoice ${sale.invoiceNumber} for amount Rs. ${Number(sale.grandTotal).toFixed(2)}.\n\nThank you for your business!\n\nBest Regards,\n${settings?.companyName || 'Amudhasurabiy Organics'}`);
      window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, '_self');
      toast('Opened email client. Please attach the downloaded PDF file.', 'success');
    } catch (err) {
      toast('Failed to trigger email: ' + err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleWhatsApp = async () => {
    if (!sale.customer?.phone) {
      toast('Customer has no phone number — add phone in Customers', 'warning');
    }
    setBusy('wa');
    try {
      const result = await shareInvoiceWhatsApp(sale, settings, getEl());
      if (result.method === 'whatsapp') {
        toast('JPG downloaded — WhatsApp opened. Attach the image to send.', 'success');
      } else if (result.method === 'share') {
        toast('Shared via device', 'success');
      }
    } catch {
      toast('WhatsApp share failed', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!sale) return <LoadingSpinner />;

  const activeShipment = sale.shipments && sale.shipments.length > 0 ? sale.shipments[0] : null;

  const getStatusBadgeStyle = (status) => {
    const s = String(status || 'unpaid').toLowerCase();
    let bg = '#fee2e2';
    let color = '#991b1b';
    let border = '1px solid #fecaca';
    
    if (s === 'paid') {
      bg = '#dcfce7';
      color = '#166534';
      border = '1px solid #bbf7d0';
    } else if (s === 'partial' || s === 'partially paid') {
      bg = '#ffedd5';
      color = '#9a3412';
      border = '1px solid #fed7aa';
    } else if (s === 'overdue') {
      bg = '#fde8e8';
      color = '#9b1c1c';
      border = '1px solid #f8b4b4';
    }
    
    return {
      backgroundColor: bg,
      color: color,
      border: border,
      fontSize: '0.75rem',
      fontWeight: 800,
      padding: '0.2rem 0.6rem',
      borderRadius: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginLeft: '0.75rem',
      display: 'inline-block',
      verticalAlign: 'middle'
    };
  };

  const actionBarContent = (
    <div className="mobile-sticky-action-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', alignItems: 'center' }}>
      <div className="btn-group" style={{ display: 'flex', gap: '0.25rem', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
        {user && ['Super Admin', 'Admin', 'admin', 'Billing Executive', 'Sales Executive'].includes(user.role) && (
          <>
            <button 
              type="button" 
              className="btn btn-sm btn-secondary" 
              onClick={startEdit} 
              disabled={!!busy}
              style={{ border: 'none', background: 'transparent', fontWeight: 650, color: '#475569' }}
            >
              {busy === 'loading-edit' ? '⏳ Loading...' : '✏️ Edit'}
            </button>
            {sale && sale.paymentStatus !== 'paid' && (
              <button type="button" className="btn btn-sm btn-success" onClick={() => setShowPaymentModal(true)} style={{ border: 'none', background: 'transparent', fontWeight: 650, color: '#10b981' }}>
                💳 Record Payment
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-warning"
              onClick={() => {
                const firstItem = sale.items && sale.items.length > 0 ? sale.items[0] : {};
                const invNo = sale.invoiceNumber || sale.id;
                const custName = sale.customer?.name || '';
                const prodName = firstItem.productName || firstItem.product?.name || 'ABC Malt 500g Pouch';
                const bNo = firstItem.batchNumber || 'ABC240715';
                const q = firstItem.quantity || 10;
                const p = firstItem.price || firstItem.unitPrice || 250;
                navigate(`/sales/returns?createForInvoice=${invNo}&customer=${encodeURIComponent(custName)}&productName=${encodeURIComponent(prodName)}&batchNumber=${encodeURIComponent(bNo)}&qty=${q}&price=${p}`);
              }}
              style={{ border: 'none', background: 'transparent', fontWeight: 650, color: '#ef4444' }}
            >
              ↩️ Return
            </button>
          </>
        )}

        {activeShipment ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ border: 'none', background: 'transparent', fontWeight: 650, color: '#ff9800' }}
            onClick={() => {
              localStorage.setItem('select_shipment_id', activeShipment.id);
              navigate('/shipping');
            }}
          >
            📦 Track
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ border: 'none', background: 'transparent', fontWeight: 650, color: '#ff9800' }}
            onClick={() => navigate(`/shipping?createForInvoice=${id || sale.id}`)}
          >
            📦 Create Shipment
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
        <Link to={`/sales/${id}/print`} className="btn btn-secondary btn-sm">🖨️ Print</Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadInvoicePdf(sale, settings)} disabled={!!busy}>📥 PDF</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadPng} disabled={!!busy}>🖼️ PNG</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleSharePdf} disabled={!!busy}>📤 Share</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleEmailPdf} disabled={!!busy}>✉️ Email</button>
        <button type="button" className="btn btn-whatsapp btn-sm" onClick={openWaModal} disabled={!!busy}>💬 WhatsApp</button>
      </div>
    </div>
  );

  return (
    <div className="page">
      {/* Hidden container for PDF/PNG/WhatsApp captures (always at 100% zoom to prevent html2canvas layout bugs on mobile) */}
      {sale && settings && (
        <div 
          style={{ 
            position: 'absolute', 
            left: '-9999px', 
            top: '-9999px',
            overflow: 'hidden',
            width: settings.paperSize === 'A5' ? '559px' : '794px' // force standard dimensions
          }}
        >
          <div ref={exportRef} style={{ backgroundColor: '#ffffff', zoom: 1 }}>
            <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-export" />
          </div>
        </div>
      )}
      {/* 1. Top Header Dashboard */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #5A2D0C' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Invoice {sale.invoiceNumber}</span>
              <span style={getStatusBadgeStyle(sale.paymentStatus)}>{String(sale.paymentStatus).toLowerCase() === 'partial' ? 'PARTIALLY PAID' : String(sale.paymentStatus).toUpperCase()}</span>
              {sale.is_historical_data && (
                <span style={{
                  fontSize: '0.7rem',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  border: '1px solid #fef3c7',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 700
                }}>
                  📊 Historical Data
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#475569' }}>
              <span><strong>Customer:</strong> {sale.customer?.name || 'Walk-in Customer'}</span>
              <span><strong>Date:</strong> {new Date(sale.date).toLocaleDateString('en-IN')}</span>
              <span><strong>Total:</strong> ₹{Number(sale.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>
                <strong>Outstanding:</strong>{' '}
                <span style={{ color: Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                  ₹{Math.max(0, Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          </div>

          {/* Grouped Action Toolbar (Sticky on Mobile via Portal to bypass container transformations) */}
          {isMobile ? createPortal(actionBarContent, document.body) : actionBarContent}
        </div>
      </div>

      {/* 2. Main 2-Column ERP Content Layout */}
      <div className="invoice-view-layout">
        
        {/* LEFT COLUMN: Zoomable Preview Frame (70%) */}
        <div className="invoice-view-left">
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Zoom Widget Controls Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              padding: '0.6rem 1rem',
              borderBottom: '1px solid #e2e8f0',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>📄 Invoice Document Preview</span>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setZoom(z => Math.max(20, z - 10))} style={{ padding: '0.2rem 0.5rem', height: '24px', display: 'flex', alignItems: 'center' }}>−</button>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '40px', textAlign: 'center' }}>{zoom}%</span>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setZoom(z => Math.min(150, z + 10))} style={{ padding: '0.2rem 0.5rem', height: '24px', display: 'flex', alignItems: 'center' }}>+</button>
                
                <div style={{ width: '1px', height: '16px', backgroundColor: '#cbd5e1', margin: '0 0.25rem' }}></div>
                
                <button type="button" className={`btn btn-sm ${fitMode === 'width' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFitMode('width'); setZoom(100); }} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', height: '24px', display: 'flex', alignItems: 'center' }}>Fit Width</button>
                <button type="button" className={`btn btn-sm ${fitMode === 'page' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setFitMode('page'); setZoom(90); }} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', height: '24px', display: 'flex', alignItems: 'center' }}>Fit Page</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsFullscreen(!isFullscreen)} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', height: '24px', display: 'flex', alignItems: 'center' }}>
                  {isFullscreen ? 'Exit Full' : 'Fullscreen 🖥️'}
                </button>
              </div>
            </div>

            {/* Preview Sheet Area */}
            <div 
              className="invoice-preview-area"
              style={{
                backgroundColor: '#cbd5e1',
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxHeight: isFullscreen ? 'calc(100vh - 50px)' : '680px',
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                width: isFullscreen ? '100vw' : '100%',
                height: isFullscreen ? '100vh' : 'auto',
                zIndex: isFullscreen ? 99999 : 'auto',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
              }}
            >
              {isFullscreen && (
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setIsFullscreen(false)}
                  style={{ position: 'absolute', top: '1rem', right: '1.5rem', zIndex: 100000 }}
                >
                  ✕ Close Fullscreen
                </button>
              )}

              <div 
                ref={captureRef}
                className="invoice-paper-mockup"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 15px 35px rgba(15, 23, 42, 0.15), 0 5px 15px rgba(0, 0, 0, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid #94a3b8',
                  width: 'fit-content',
                  zoom: zoom / 100,
                  maxWidth: '100%'
                }}
              >
                <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-preview" />
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Billing Summary Dashboard (30%) */}
        <div className="invoice-view-right" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Metadata Card */}
          <div className="card" style={{ margin: 0, padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              📊 Billing Summary
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Customer:</span>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{sale.customer?.name || 'Walk-in Customer'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Invoice Date:</span>
                <span style={{ fontWeight: 600 }}>{new Date(sale.date).toLocaleDateString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Payment Status:</span>
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', color: sale.paymentStatus === 'paid' ? '#16a34a' : '#dc2626' }}>
                  {sale.paymentStatus}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Paid Amount:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{Number(sale.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Outstanding:</span>
                <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                  ₹{Math.max(0, Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>GST Amount:</span>
                <span style={{ fontWeight: 'bold' }}>₹{Number(sale.gstTotal || sale.totalGST || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Salesperson:</span>
                <span>{sale.salesman?.name || sale.salesperson || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f1f5f9', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Shipment Status:</span>
                <span>
                  {activeShipment ? (
                    <span className={`status-badge status-${(activeShipment.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
                      {activeShipment.courierStatus || 'Pending'}
                    </span>
                  ) : (
                    'Not Shipped'
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Last Updated:</span>
                <span style={{ fontSize: '0.75rem' }}>{new Date(sale.updatedAt || sale.date).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="card" style={{ margin: 0, padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              ⚡ Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {user && ['Super Admin', 'Admin', 'admin', 'Billing Executive', 'Sales Executive'].includes(user.role) && sale.paymentStatus !== 'paid' && (
                <button type="button" className="btn btn-success btn-sm w-100" onClick={() => setShowPaymentModal(true)} style={{ fontWeight: 650 }}>
                  💳 Record Payment
                </button>
              )}
              {!activeShipment && (
                <button type="button" className="btn btn-secondary btn-sm w-100" onClick={() => navigate(`/shipping?createForInvoice=${id || sale.id}`)}>
                  📦 Create Shipment
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm w-100" onClick={openWaModal}>
                💬 Send WhatsApp Notification
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Bottom Tab Panel */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: '1.5rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
          {[
            { id: 'activity', label: 'Activity Timeline' },
            { id: 'payments', label: `Payments (${invoicePayments.length})` },
            { id: 'shipment', label: 'Shipment Details' },
            { id: 'whatsapp', label: 'WhatsApp History' },
            { id: 'audit', label: 'Audit Logs' },
            { id: 'notes', label: 'Internal Notes' },
            { id: 'attachments', label: 'Attachments' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '0.65rem 0.25rem',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === t.id ? '3px solid #5A2D0C' : '3px solid transparent',
                color: activeTab === t.id ? '#5A2D0C' : '#64748b',
                fontWeight: activeTab === t.id ? 800 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                whiteSpace: 'nowrap'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ minHeight: '150px' }}>
          {activeTab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '4px' }}></div>
                  <div style={{ width: '2px', flex: 1, backgroundColor: '#cbd5e1', margin: '4px 0' }}></div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Invoice Generated</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(sale.createdAt || sale.date).toLocaleString('en-IN')}</div>
                  <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Initial invoice generation for {sale.invoiceNumber} recorded under salesperson.</p>
                </div>
              </div>

              {sale.updatedAt && sale.updatedAt !== sale.createdAt && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2563eb', marginTop: '4px' }}></div>
                    {invoicePayments.length > 0 && <div style={{ width: '2px', flex: 1, backgroundColor: '#cbd5e1', margin: '4px 0' }}></div>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Invoice Recalculated / Updated</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(sale.updatedAt).toLocaleString('en-IN')}</div>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.2rem 0 0 0' }}>Billing details, cart products, or logistics settings were updated.</p>
                  </div>
                </div>
              )}

              {invoicePayments.map((p, idx) => (
                <div style={{ display: 'flex', gap: '1rem' }} key={idx}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '4px' }}></div>
                    {idx < invoicePayments.length - 1 && <div style={{ width: '2px', flex: 1, backgroundColor: '#cbd5e1', margin: '4px 0' }}></div>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Payment Allocated (Ref: {p.paymentNumber})</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(p.date).toLocaleString('en-IN')}</div>
                    <p style={{ fontSize: '0.8rem', color: '#16a34a', margin: '0.2rem 0 0 0', fontWeight: 'bold' }}>
                      Amount Received: ₹{getInvoiceAllocatedAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })} via {p.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {invoicePayments.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Payment No</th>
                        <th>Method</th>
                        <th>Reference No</th>
                        <th style={{ textAlign: 'right' }}>Amount Paid</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicePayments.map((p, idx) => (
                        <tr key={idx}>
                          <td>{new Date(p.date).toLocaleDateString('en-IN')}</td>
                          <td><code>{p.paymentNumber}</code></td>
                          <td><span style={{ textTransform: 'uppercase', fontWeight: 650 }}>{p.paymentMethod}</span></td>
                          <td>{p.referenceNumber || 'N/A'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                            ₹{getInvoiceAllocatedAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button 
                                type="button" 
                                onClick={() => handleStartEditPayment(p)} 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '0.2rem 0.4rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
                                title="Edit Payment"
                              >
                                ✏️
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDeletePayment(p.id)} 
                                className="btn btn-danger btn-sm" 
                                style={{ padding: '0.2rem 0.4rem', minWidth: 'auto', border: 'none', background: 'transparent' }}
                                title="Cancel Payment"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No payment allocations found for this invoice.
                </div>
              )}
            </div>
          )}

          {activeTab === 'shipment' && (
            <div>
              {activeShipment ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                  <div>
                    <p><strong>Shipment ID:</strong> {activeShipment.shipmentNumber}</p>
                    <p><strong>Courier:</strong> {activeShipment.courier}</p>
                    <p><strong>Tracking / AWB Number:</strong> <code>{activeShipment.trackingNumber}</code></p>
                  </div>
                  <div>
                    <p><strong>Status:</strong>{' '}
                      <span className={`status-badge status-${(activeShipment.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`}>
                        {activeShipment.courierStatus || 'Pending'}
                      </span>
                    </p>
                    <p><strong>Shipping Notes:</strong> {activeShipment.notes || 'None'}</p>
                    {activeShipment.trackingNumber && (
                      <a href={`${window.location.origin}/track/${activeShipment.trackingNumber}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-block', marginTop: '0.25rem' }}>
                        🔗 Launch Public Tracker
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.5rem 0' }}>No shipments have been dispatched for this invoice.</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/shipping?createForInvoice=${id || sale.id}`)}>
                    📦 Create Shipment Now
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div style={{ fontSize: '0.85rem' }}>
              <p style={{ color: '#64748b', marginBottom: '0.75rem' }}>History of notifications sent via CRM WhatsApp API for this sale:</p>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                  <strong>Type</strong>
                  <strong>Recipient</strong>
                  <strong>Status</strong>
                </div>
                {sale.whatsappLogs && sale.whatsappLogs.length > 0 ? (
                  sale.whatsappLogs.map((log, idx) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }} key={idx}>
                      <span>{log.messageType || 'Invoice'}</span>
                      <span>+{log.phone}</span>
                      <span style={{ color: '#16a34a', fontWeight: 'bold' }}>Dispatched</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                    No dispatch history recorded. Use the "Send WhatsApp" action above.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>User</th>
                    <th>Date</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>CREATION</strong></td>
                    <td>{user?.name || 'Staff'}</td>
                    <td>{new Date(sale.createdAt || sale.date).toLocaleString('en-IN')}</td>
                    <td>Invoice {sale.invoiceNumber} initialized with total amount ₹{Number(sale.grandTotal || 0).toFixed(2)}.</td>
                  </tr>
                  {sale.updatedAt && sale.updatedAt !== sale.createdAt && (
                    <tr>
                      <td><strong>UPDATE</strong></td>
                      <td>{user?.name || 'Staff'}</td>
                      <td>{new Date(sale.updatedAt).toLocaleString('en-IN')}</td>
                      <td>Invoice quantities, charges or totals recalculated.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={{ fontSize: '0.85rem' }}>
              <p><strong>Staff Internal Notes:</strong></p>
              <div style={{ border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '8px', backgroundColor: '#fffdf9', whiteSpace: 'pre-wrap', minHeight: '80px', color: '#475569' }}>
                {sale.notes || 'No internal notes captured for this invoice. Use Edit Invoice to write notes.'}
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div style={{ fontSize: '0.85rem' }}>
              <p style={{ color: '#64748b' }}>Upload files, receipts, or delivery slips related to this invoice:</p>
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📁</span>
                <span>Drag & drop files or click to upload</span>
                <input type="file" style={{ display: 'none' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '90vh',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                ✏️ Edit Invoice {sale.invoiceNumber}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Customer and General Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 650, display: 'block', marginBottom: '0.35rem' }}>Customer *</label>
                  <CustomerPicker
                    mode="dropdown"
                    selectedCustomer={customers.find(c => String(c.id || c._id) === String(editCustomerId))}
                    onSelectCustomer={(c) => setEditCustomerId(c ? (c.id || c._id) : '')}
                    placeholder="Type 2+ chars to search customer by Name, Store, Code, Phone, GST, City..."
                  />
                </div>

                
                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>Invoice Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={editDate} 
                    onChange={(e) => setEditDate(e.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>Due Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={editDueDate} 
                    onChange={(e) => setEditDueDate(e.target.value)} 
                  />
                </div>
              </div>

              {/* Payment and GST settings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>Payment Method</label>
                  <select 
                    className="form-control" 
                    value={editPaymentMethod} 
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                  >
                    {['cash', 'card', 'upi', 'bank', 'credit'].map((m) => (
                      <option key={m} value={m}>{m.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>Payment Status</label>
                  <select 
                    className="form-control" 
                    value={editPaymentStatus} 
                    onChange={(e) => setEditPaymentStatus(e.target.value)}
                  >
                    {['paid', 'partial', 'pending'].map((s) => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650 }}>GST Mode</label>
                  <select 
                    className="form-control" 
                    value={editGstBillingMode} 
                    onChange={(e) => setEditGstBillingMode(e.target.value)}
                  >
                    <option value="default">Auto (Use customer type rules)</option>
                    <option value="exclusive">GST Exclusive (Add tax)</option>
                    <option value="inclusive">GST Inclusive (Extract tax)</option>
                    <option value="no_gst">No GST / Zero Tax</option>
                  </select>
                </div>
              </div>

              {/* Cart Selection & Items Table */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', marginBottom: '0.75rem' }}>
                  📦 Invoice Items & Cart
                </h3>
                
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 650 }}>Add Product to Cart</label>
                  <select 
                    className="form-control" 
                    onChange={(e) => { 
                      if (e.target.value) {
                        addToEditCart(e.target.value); 
                        e.target.value = ''; 
                      }
                    }}
                  >
                    <option value="">Choose item to add...</option>
                    {products.filter(p => !p.productType || ['manufactured', 'repacking', 'trading'].includes(p.productType)).map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.name} (Stock: {p.stock}) — ₹{p.sellingPrice}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="table-wrap">
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ width: '100px' }}>Qty</th>
                        <th style={{ width: '110px' }}>Scheme</th>
                        <th style={{ width: '80px' }}>Free Qty</th>
                        <th>Rate (₹)</th>
                        <th>GST%</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editCart.map((item, idx) => {
                        const qty = Number(item.qty || 0);
                        const rate = Number(item.unitPrice || 0);
                        const gst = Number(item.gstPercent || 0);
                        let lineTotal = 0;

                        if (computedValues?.activeGstMode === 'inclusive') {
                          lineTotal = qty * rate;
                        } else if (computedValues?.activeGstMode === 'no_gst') {
                          lineTotal = qty * rate;
                        } else {
                          lineTotal = qty * rate * (1 + gst / 100);
                        }

                        return (
                          <tr key={idx}>
                            <td><strong>{item.name}</strong></td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control form-control-sm" 
                                style={{ width: '70px' }} 
                                value={item.qty} 
                                min={1} 
                                onChange={(e) => updateEditQty(item.product, Number(e.target.value))} 
                              />
                            </td>
                            <td>
                              <select
                                className="form-control form-control-sm"
                                value={item.schemeApplied || 'None'}
                                onChange={(e) => updateEditCartItem(item.product, 'schemeApplied', e.target.value)}
                              >
                                <option value="None">None</option>
                                <option value="10+1">10+1</option>
                                <option value="20+2">20+2</option>
                                <option value="50+5">50+5</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ width: '60px' }}
                                min={0}
                                value={item.freeQty || 0}
                                onChange={(e) => updateEditCartItem(item.product, 'freeQty', Number(e.target.value))}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control form-control-sm" 
                                style={{ width: '80px' }} 
                                value={item.unitPrice} 
                                onChange={(e) => updateEditCartItem(item.product, 'unitPrice', Number(e.target.value))} 
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="form-control form-control-sm" 
                                style={{ width: '60px' }} 
                                value={item.gstPercent} 
                                onChange={(e) => updateEditCartItem(item.product, 'gstPercent', Number(e.target.value))} 
                              />
                            </td>
                            <td><strong>₹{lineTotal.toFixed(2)}</strong></td>
                            <td>
                              <button 
                                type="button" 
                                className="btn btn-danger btn-sm" 
                                onClick={() => updateEditQty(item.product, 0)}
                                style={{ padding: '0.15rem 0.4rem' }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {editCart.length === 0 && (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                            Cart is empty. Select a finished product above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charges and Totals */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                
                {/* Logistics Charges */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', margin: '0 0 0.75rem 0' }}>
                    🚚 Logistics & Other Charges
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8rem' }}>Shipping Charge (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editShippingCharge} 
                        onChange={(e) => setEditShippingCharge(Number(e.target.value))} 
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8rem' }}>Packing Charge (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editPackingCharge} 
                        onChange={(e) => setEditPackingCharge(Number(e.target.value))} 
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8rem' }}>Handling Charge (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editHandlingCharge} 
                        onChange={(e) => setEditHandlingCharge(Number(e.target.value))} 
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.8rem' }}>Courier Charge (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editCourierCharge} 
                        onChange={(e) => setEditCourierCharge(Number(e.target.value))} 
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '0.8rem' }}>Other Charge (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editOtherCharge} 
                        onChange={(e) => setEditOtherCharge(Number(e.target.value))} 
                      />
                    </div>
                  </div>

                  {editPaymentStatus !== 'paid' && (
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem' }}>Amount Paid (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editAmountPaid} 
                        onChange={(e) => setEditAmountPaid(Number(e.target.value))} 
                      />
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>Invoice Notes</label>
                    <textarea 
                      className="form-control" 
                      rows={2} 
                      value={editNotes} 
                      onChange={(e) => setEditNotes(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Totals Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', height: 'fit-content' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', margin: '0 0 0.5rem 0' }}>
                    💰 Calculation Summary
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Taxable Subtotal:</span>
                    <span>₹{computedValues?.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>GST Total:</span>
                    <span>₹{computedValues?.gstTotal.toFixed(2)}</span>
                  </div>
                  {computedValues?.totalCharges > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#2563eb' }}>
                      <span>Logistics Charges:</span>
                      <span>+₹{computedValues.totalCharges.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>Discount (₹):</span>
                    <input 
                      type="number" 
                      className="form-control form-control-sm" 
                      style={{ width: '80px', height: '26px', padding: '2px 6px', textAlign: 'right' }} 
                      value={editDiscount} 
                      onChange={(e) => setEditDiscount(Number(e.target.value))} 
                    />
                  </div>
                  {computedValues?.roundOff !== 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                      <span>Round Off:</span>
                      <span>{computedValues.roundOff > 0 ? `+₹${computedValues.roundOff}` : `-₹${Math.abs(computedValues.roundOff)}`}</span>
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '1.15rem', 
                    fontWeight: 800, 
                    borderTop: '2px solid #e2e8f0', 
                    paddingTop: '0.5rem', 
                    marginTop: '0.5rem', 
                    color: '#0f172a' 
                  }}>
                    <span>Grand Total:</span>
                    <span>₹{computedValues?.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: '#f8fafc'
            }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setIsEditing(false)}
                disabled={busy === 'saving'}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveEdit}
                disabled={busy === 'saving'}
                style={{ minWidth: '120px' }}
              >
                {busy === 'saving' ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}



      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                💳 Record Payment
              </h2>
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', minHeight: 0, flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', color: '#475569', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                  <div><strong>Invoice:</strong> {sale.invoiceNumber}</div>
                  <div><strong>Customer:</strong> {sale.customer?.name}</div>
                  <div><strong>Total Amount:</strong> ₹{Number(sale.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  <div><strong>Already Paid:</strong> ₹{Number(sale.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    value={payAmount} 
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={payDate} 
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Method</label>
                  <select 
                    className="form-control" 
                    value={payMethod} 
                    onChange={(e) => setPayMethod(e.target.value)}
                    required
                  >
                    <option value="cash">CASH</option>
                    <option value="upi">UPI / GPAY / PHONEPE</option>
                    <option value="bank">BANK TRANSFER</option>
                    <option value="card">CREDIT/DEBIT CARD</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Reference / Transaction No</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Optional reference number"
                    value={payRefNumber} 
                    onChange={(e) => setPayRefNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                background: '#f8fafc',
                flexShrink: 0
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowPaymentModal(false)}
                  disabled={busy === 'saving-payment'}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff', minWidth: '120px', fontWeight: 650 }}
                  disabled={busy === 'saving-payment'}
                >
                  {busy === 'saving-payment' ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {editingPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                ✏️ Edit Payment ({editingPayment.paymentNumber})
              </h2>
              <button 
                type="button" 
                onClick={() => setEditingPayment(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleUpdatePayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', minHeight: 0, flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', color: '#475569', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
                  <div><strong>Invoice:</strong> {sale.invoiceNumber}</div>
                  <div><strong>Customer:</strong> {sale.customer?.name}</div>
                  <div><strong>Total Amount:</strong> ₹{Number(sale.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-control" 
                    value={payEditAmount} 
                    onChange={(e) => setPayEditAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={payEditDate} 
                    onChange={(e) => setPayEditDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Payment Method</label>
                  <select 
                    className="form-control" 
                    value={payEditMethod} 
                    onChange={(e) => setPayEditMethod(e.target.value)}
                    required
                  >
                    <option value="cash">CASH</option>
                    <option value="upi">UPI / GPAY / PHONEPE</option>
                    <option value="bank">BANK TRANSFER</option>
                    <option value="card">CREDIT/DEBIT CARD</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Reference / Transaction No</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Optional reference number"
                    value={payEditRefNumber} 
                    onChange={(e) => setPayEditRefNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                background: '#f8fafc',
                flexShrink: 0
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingPayment(null)}
                  disabled={busy === 'saving-payment'}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff', minWidth: '120px', fontWeight: 650 }}
                  disabled={busy === 'saving-payment'}
                >
                  {busy === 'saving-payment' ? 'Updating...' : 'Update Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Dispatch Modal */}
      {waModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                💬 Send WhatsApp Notification
              </h2>
              <button 
                type="button" 
                onClick={() => setWaModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', minHeight: 0, flex: 1 }}>
              <div className="form-group">
                <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Recipient Phone Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={waPhone} 
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. +919876543210"
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Message Template</label>
                <select 
                  className="form-control" 
                  value={waTemplate} 
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="invoice">Invoice Template</option>
                  <option value="reminder">Payment Reminder Template</option>
                  <option value="tracking">Shipment Tracking Template</option>
                  <option value="greeting">Greetings Template</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Message Text</label>
                <textarea 
                  className="form-control" 
                  rows="5"
                  value={waMessage} 
                  onChange={(e) => setWaMessage(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="waAttachPdf" 
                  checked={waAttachPdf} 
                  onChange={(e) => setWaAttachPdf(e.target.checked)}
                />
                <label htmlFor="waAttachPdf" style={{ fontSize: '0.85rem', fontWeight: 650, cursor: 'pointer', margin: 0 }}>
                  Attach Invoice PDF document
                </label>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setWaModalOpen(false)}
                disabled={waSending}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-success" 
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff', minWidth: '120px', fontWeight: 650 }}
                onClick={handleSendWhatsApp}
                disabled={waSending}
              >
                {waSending ? 'Sending...' : 'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* WhatsApp Dispatch Success Modal */}
      {showWaSuccessModal && waSuccessData && (
        <Modal
          title="🎉 WhatsApp Sent Successfully"
          onClose={() => setShowWaSuccessModal(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowWaSuccessModal(false)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
            >
              Okay
            </button>
          }
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '0.5rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
            }}>
              <span style={{ fontSize: '2.5rem' }}>📱</span>
              <div>
                <h4 style={{ margin: 0, color: '#065f46', fontWeight: 700, fontSize: '1.1rem' }}>Message Dispatched</h4>
                <p style={{ margin: '0.25rem 0 0 0', color: '#047857', fontSize: '0.85rem' }}>
                  The message has been successfully routed via the CRM WhatsApp gateway.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '0.75rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Customer Name:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>{waSuccessData.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Phone Number:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>+{waSuccessData.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Message Type:</span>
                <span style={{ 
                  color: '#2563eb', 
                  fontSize: '0.8rem', 
                  fontWeight: 700,
                  backgroundColor: '#eff6ff',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe'
                }}>{waSuccessData.messageType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Timestamp:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>
                  {new Date(waSuccessData.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Reference ID:</span>
                <span style={{ 
                  color: '#475569', 
                  fontSize: '0.8rem', 
                  fontFamily: 'monospace',
                  backgroundColor: '#f1f5f9',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0'
                }}>{waSuccessData.referenceId}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
