import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { salesApi, productsApi, customersApi, whatsappApi } from '../api';
import { downloadInvoicePdf, getInvoicePdfBlob } from '../utils/invoicePdf';
import { downloadInvoiceJpg, shareInvoiceWhatsApp } from '../utils/invoiceImage';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SaleView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const captureRef = useRef(null);
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState('');
  const { user } = useAuth();

  // Payment recording state
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState('upi');
  const [payRefNumber, setPayRefNumber] = useState('');

  // WhatsApp dispatch modal state
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waAttachPdf, setWaAttachPdf] = useState(true);
  const [waTemplate, setWaTemplate] = useState('invoice');
  const [waSending, setWaSending] = useState(false);

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
      if (waAttachPdf) {
        const pdfBlob = await getInvoicePdfBlob(sale, settings);
        const file = new File([pdfBlob], `${sale.invoiceNumber}.pdf`, { type: 'application/pdf' });
        
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('phone', waPhone);
        formData.append('message', waMessage);
        formData.append('customerId', sale.customerId || sale.customer?.id || '');
        formData.append('messageType', waTemplate === 'invoice' ? 'Invoice' : (waTemplate === 'reminder' ? 'Payment Reminder' : (waTemplate === 'tracking' ? 'Shipment' : 'Greeting')));

        await whatsappApi.sendPdf(formData);
        toast('✓ Invoice PDF sent successfully via WhatsApp!', 'success');
      } else {
        const payload = {
          phone: waPhone,
          message: waMessage,
          customerId: sale.customerId || sale.customer?.id || '',
          messageType: waTemplate === 'invoice' ? 'Invoice' : (waTemplate === 'reminder' ? 'Payment Reminder' : (waTemplate === 'tracking' ? 'Shipment' : 'Greeting'))
        };
        await whatsappApi.sendText(payload);
        toast('✓ Message sent successfully via WhatsApp!', 'success');
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

  const getEl = () => captureRef.current;

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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          Invoice {sale.invoiceNumber}
          {sale.is_historical_data && (
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#fffbeb',
              color: '#d97706',
              border: '1px solid #fef3c7',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              📊 Historical Data
            </span>
          )}
          <span style={getStatusBadgeStyle(sale.paymentStatus)}>{String(sale.paymentStatus).toLowerCase() === 'partial' ? 'PARTIALLY PAID' : String(sale.paymentStatus).toUpperCase()}</span>
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'admin') && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 650 }}
                onClick={startEdit}
              >
                ✏️ Edit Invoice
              </button>
              {sale.paymentStatus !== 'paid' && (
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 650 }}
                  onClick={() => setShowPaymentModal(true)}
                >
                  💳 Record Payment
                </button>
              )}
            </>
          )}
          {activeShipment ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#ff9800', borderColor: '#ff9800' }}
                onClick={() => {
                  localStorage.setItem('select_shipment_id', activeShipment.id);
                  navigate('/shipping');
                }}
              >
                Track Shipment
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: '#ff9800', borderColor: '#ff9800' }}
              onClick={() => navigate(`/shipping?createForInvoice=${id || sale.id}`)}
            >
              📦 Create Shipment
            </button>
          )}
          <Link to={`/sales/${id}/print`} className="btn btn-secondary">Print</Link>
          <button type="button" className="btn btn-secondary" onClick={() => downloadInvoicePdf(sale, settings)}>PDF</button>
          <button type="button" className="btn btn-secondary" onClick={handleJpg} disabled={!!busy}>
            {busy === 'jpg' ? '…' : 'Download JPG'}
          </button>
          <button type="button" className="btn btn-whatsapp" onClick={openWaModal} disabled={!!busy}>
            💬 Send WhatsApp
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#4b5563' }}>Billing Summary</h3>
          <p style={{ margin: '0 0 0.25rem 0' }}><strong>Customer:</strong> {sale.customer?.name} {sale.customer?.phone && `(${sale.customer.phone})`}</p>
          <p style={{ margin: '0 0 0.25rem 0' }}><strong>Date:</strong> {new Date(sale.date).toLocaleDateString()}</p>
          <p style={{ margin: '0 0 0.25rem 0' }}><strong>Total Amount:</strong> ₹{Number(sale.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p style={{ margin: '0 0 0.25rem 0' }}><strong>Already Paid:</strong> ₹{Number(sale.amountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p style={{ margin: '0 0 0.25rem 0' }}>
            <strong>Outstanding:</strong>{' '}
            <span style={{ color: Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0) > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
              ₹{Math.max(0, Number(sale.grandTotal || 0) - Number(sale.amountPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p style={{ margin: 0 }}><strong>Payment:</strong> <span style={{ textTransform: 'uppercase' }}>{sale.paymentMethod}</span> — <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{String(sale.paymentStatus).toLowerCase() === 'partial' ? 'PARTIALLY PAID' : String(sale.paymentStatus).toUpperCase()}</span></p>
        </div>

        {activeShipment && (
          <div className="card" style={{ margin: 0, borderLeft: '4px solid #ff9800' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ff9800' }}>Shipping & Delivery Details</h3>
            <p style={{ margin: '0 0 0.25rem 0' }}><strong>Shipment Number:</strong> {activeShipment.shipmentNumber}</p>
            <p style={{ margin: '0 0 0.25rem 0' }}><strong>Courier:</strong> {activeShipment.courier} | AWB: <code>{activeShipment.trackingNumber}</code></p>
            <p style={{ margin: 0 }}>
              <strong>Status:</strong>{' '}
              <span className={`status-badge status-${(activeShipment.courierStatus || 'Pending').toLowerCase().replace(/ /g, '')}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
                {activeShipment.courierStatus || 'Pending'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="invoice-capture-hidden" aria-hidden="true">
        <div ref={captureRef}>
          <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-capture-view" />
        </div>
      </div>

      <div className="card">
        <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-preview" />
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
                  <label style={{ fontWeight: 650 }}>Customer</label>
                  <select 
                    className="form-control" 
                    value={editCustomerId} 
                    onChange={(e) => setEditCustomerId(e.target.value)}
                  >
                    <option value="">Choose customer...</option>
                    {customers.map((c) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name} ({c.customerType})
                      </option>
                    ))}
                  </select>
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

      {/* Payment History Section */}
      {invoicePayments.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            📜 Payment History
          </h3>
          <div className="table-wrap">
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payment No</th>
                  <th>Method</th>
                  <th>Reference No</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoicePayments.map((p, idx) => (
                  <tr key={idx}>
                    <td>{new Date(p.date).toLocaleDateString()}</td>
                    <td><code>{p.paymentNumber}</code></td>
                    <td><span style={{ textTransform: 'uppercase', fontWeight: 650 }}>{p.paymentMethod}</span></td>
                    <td>{p.referenceNumber || 'N/A'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                      ₹{getInvoiceAllocatedAmount(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              background: '#f8fafc'
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
            <form onSubmit={handleSavePayment}>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                background: '#f8fafc'
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
              background: '#f8fafc'
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
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              background: '#f8fafc'
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
    </div>
  );
}
