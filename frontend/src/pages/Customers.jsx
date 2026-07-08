import { useEffect, useState, useCallback } from 'react';
import { customersApi, productsApi, ordersApi, sfaApi, crmApi, aiApi, whatsappApi, catalogApi } from '../api';
import { Brain } from 'lucide-react';
import AIInsightsModal from '../components/AIInsightsModal';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentReminderGenerator from '../components/PaymentReminderGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const emptyCustomer = {
  name: '',
  businessName: '',
  customerType: 'Retail Shop',
  contactPerson: '',
  phone: '',
  email: '',
  gstNumber: '',
  address: '',
  state: '',
  pincode: '',
  creditLimit: 0,
  balance: 0,
  paymentTerms: 'COD',
  paymentCycle: 'Bill to Bill',
  creditDays: 0,
  averagePaymentDays: 0,
  lastPaymentDate: null,
  billToBillEnabled: true,
  invoiceOutstandingCount: 0,
  status: 'Active',
  brandName: '',
  labelDesignRef: '',
  packagingType: '',
  moq: 0,
  manufacturingNotes: '',
  storeCategory: 'B',
  loyaltyPoints: 0,
  gstBillingMode: 'default',
  specialPricing: {},
};

const customerTypes = [
  'Retail Shop',
  'Distributor',
  'Super Stockist',
  'D2C Customer',
  'Organic Store',
  'White Label',
  'Wholesaler',
  'Super Market',
  'Pharmacy',
  'Export Customer',
];

const segmentFilters = [
  { value: 'all', label: 'All Customers' },
  { value: 'Retail Shop', label: 'Retail Shops' },
  { value: 'Distributor', label: 'Distributors' },
  { value: 'Super Stockist', label: 'Super Stockists' },
  { value: 'D2C Customer', label: 'D2C Customers' },
  { value: 'Organic Store', label: 'Organic Stores' },
  { value: 'White Label', label: 'White Label Customers' },
  { value: 'Archived', label: 'Archived Customers' },
];

// Map customer types to specific V3 colors and indicators
const getCustomerTypeColors = (type) => {
  const t = String(type || '').toLowerCase();
  if (t.includes('retail')) {
    return { bg: '#dcfce7', text: '#15803d', icon: '🟢', color: '#10b981' };
  } else if (t.includes('d2c') || t.includes('direct')) {
    return { bg: '#dbeafe', text: '#1d4ed8', icon: '🔵', color: '#3b82f6' };
  } else if (t.includes('white label') || t.includes('whitelabel')) {
    return { bg: '#f3e8ff', text: '#7e22ce', icon: '🟣', color: '#a855f7' };
  } else if (t.includes('organic')) {
    return { bg: '#ffedd5', text: '#c2410c', icon: '🟠', color: '#f97316' };
  }
  return { bg: '#f1f5f9', text: '#475569', icon: '⚪', color: '#64748b' };
};

export default function Customers() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState('all');
  
  // AI Customer Intelligence State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  
  // Selected Customer detail states
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [salesHistory, setSalesHistory] = useState([]);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // CRM Notes, Follow-ups, and Reminders state
  const [notesHistory, setNotesHistory] = useState([]);
  const [followupsHistory, setFollowupsHistory] = useState([]);
  const [remindersHistory, setRemindersHistory] = useState([]);
  const [customerVisitsHistory, setCustomerVisitsHistory] = useState([]);
  const [customerReviewsHistory, setCustomerReviewsHistory] = useState([]);
  
  // CRM text inputs
  const [newCrmNoteText, setNewCrmNoteText] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('');

  // Confirmation modally dialog states
  const [dependencyModalData, setDependencyModalData] = useState(null); // { counts, outstanding, customerId }
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false); // customerId or false
  const [whatsappErrorModal, setWhatsappErrorModal] = useState(null);
  const [reminderModalInvoice, setReminderModalInvoice] = useState(null);
  
  // Modal states for creating/editing customers
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [form, setForm] = useState(emptyCustomer);
  const [allProducts, setAllProducts] = useState([]);
  
  // Dynamic metrics computed locally
  const [segmentCounts, setSegmentCounts] = useState({});

  // Mobile list drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Customer WhatsApp Reminder Modal states
  const [remModalOpen, setRemModalOpen] = useState(false);
  const [remPhone, setRemPhone] = useState('');
  const [remDocType, setRemDocType] = useState('statement');
  const [remMessage, setRemMessage] = useState('');
  const [remSending, setRemSending] = useState(false);
  const [showWaSuccessModal, setShowWaSuccessModal] = useState(false);
  const [waSuccessData, setWaSuccessData] = useState(null);

  const openCustomerReminderModal = () => {
    if (selectedCustomer) {
      setRemPhone(selectedCustomer.phone || '');
      setRemDocType('statement');
      const company = settings?.companyName || 'Amudhasurabiy Organics';
      const balance = Number(selectedCustomer.balance || 0).toLocaleString('en-IN');
      const defaultMsg = `Dear ${selectedCustomer.name},\n\nPlease find attached your Outstanding Statement copy. Your total outstanding due is *₹${balance}*.\n\nKindly process the payment at your earliest convenience.\n\nThank you!\n${company}`;
      setRemMessage(defaultMsg);
      setRemModalOpen(true);
    }
  };

  const handleRemDocTypeChange = (type) => {
    setRemDocType(type);
    if (!selectedCustomer) return;
    const company = settings?.companyName || 'Amudhasurabiy Organics';
    let msg = '';
    if (type === 'statement') {
      const balance = Number(selectedCustomer.balance || 0).toLocaleString('en-IN');
      msg = `Dear ${selectedCustomer.name},\n\nPlease find attached your Outstanding Statement copy. Your total outstanding due is *₹${balance}*.\n\nKindly process the payment at your earliest convenience.\n\nThank you!\n${company}`;
    } else {
      msg = `Dear ${selectedCustomer.name},\n\nPlease find attached your Running Account Ledger Statement copy up to today.\n\nThank you for your business!\n${company}`;
    }
    setRemMessage(msg);
  };

  // Product Catalog sharing states
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogPhone, setCatalogPhone] = useState('');
  const [catalogFormat, setCatalogFormat] = useState('pdf');
  const [catalogPricingType, setCatalogPricingType] = useState('retail');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [catalogProductId, setCatalogProductId] = useState('');
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [catalogSending, setCatalogSending] = useState(false);

  const openCustomerCatalogModal = () => {
    if (selectedCustomer) {
      setCatalogPhone(selectedCustomer.phone || '');
      setCatalogFormat('pdf');
      setCatalogPricingType('retail');
      setCatalogCategory('All');
      setCatalogProductId('');
      setCatalogModalOpen(true);
      productsApi.categories().then(({ data }) => {
        setCatalogCategories(data.categories || []);
      }).catch(e => console.error(e));
    }
  };

  const handleSendCatalogWhatsApp = async () => {
    if (!catalogPhone) {
      toast('Phone number is required', 'warning');
      return;
    }
    setCatalogSending(true);
    try {
      const payload = {
        phone: catalogPhone,
        customerId: selectedCustomer.id || selectedCustomer._id,
        pricingType: catalogPricingType,
        category: catalogCategory,
        format: catalogFormat,
        productId: catalogFormat === 'image' ? catalogProductId : undefined
      };
      const { data } = await catalogApi.shareWhatsApp(payload);
      toast('Catalog dispatched successfully via WhatsApp!', 'success');
      if (data && data.data) {
        setWaSuccessData(data.data);
        setShowWaSuccessModal(true);
      }
      setCatalogModalOpen(false);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to send catalog via WhatsApp', 'error');
    } finally {
      setCatalogSending(false);
    }
  };

  const getReminderStatementBlob = () => {
    if (!selectedCustomer) return null;
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'normal');
    
    doc.setFontSize(22);
    doc.setTextColor(249, 115, 22); // orange-500 (#f97316)
    doc.text(settings?.companyName || 'Amudhasurabiy Organics', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // gray-500
    doc.text(`GSTIN: ${settings?.gstNumber || 'N/A'}`, 14, 31);
    doc.text(`Phone: ${settings?.phone || 'N/A'}  |  Email: ${settings?.email || 'N/A'}`, 14, 36);
    doc.text(`Address: ${settings?.address || 'N/A'}`, 14, 41);

    doc.setDrawColor(226, 232, 240); // border gray
    doc.setLineWidth(0.5);
    doc.line(14, 45, 196, 45);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT REMINDER STATEMENT', 14, 55);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer Name: ${selectedCustomer.name}`, 14, 65);
    doc.text(`Business Name: ${selectedCustomer.businessName || 'N/A'}`, 14, 70);
    doc.text(`Contact Phone: ${selectedCustomer.phone || 'N/A'}`, 14, 75);
    doc.text(`Email Address: ${selectedCustomer.email || 'N/A'}`, 14, 80);

    doc.setFont('helvetica', 'bold');
    doc.text(`Total Outstanding: Rs. ${Number(selectedCustomer.balance).toLocaleString('en-IN')}`, 120, 65);
    doc.setFont('helvetica', 'normal');
    doc.text(`Reminders Shared: ${selectedCustomer.remindersSent || 0}`, 120, 70);
    
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const reminderMsg = `Dear ${selectedCustomer.name},\nThis is a friendly reminder regarding your outstanding balance of Rs. ${Number(selectedCustomer.balance).toLocaleString('en-IN')} with Amudhasurabiy Organics. We kindly request you to clear the pending invoice balance at your earliest convenience. Thank you for your continued partnership.`;
    const splitMsg = doc.splitTextToSize(reminderMsg, 182);
    doc.text(splitMsg, 14, 90);

    const pendingBills = salesHistory.filter(i => i.paymentStatus !== 'paid' && i.status !== 'Cancelled');
    const tableData = pendingBills.map(item => {
      const balance = Number(item.grandTotal) - Number(item.amountPaid);
      const due = item.dueDate ? new Date(item.dueDate) : new Date(item.date);
      const diffTime = new Date() - due;
      const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
      
      return [
        item.invoiceNumber,
        new Date(item.date).toLocaleDateString(),
        new Date(due).toLocaleDateString(),
        daysOverdue > 0 ? `${daysOverdue} Days` : 'Not due',
        `Rs. ${Number(item.grandTotal).toLocaleString('en-IN')}`,
        `Rs. ${balance.toLocaleString('en-IN')}`
      ];
    });

    doc.autoTable({
      startY: 110,
      head: [['Invoice No', 'Invoice Date', 'Due Date', 'Overdue Age', 'Total Amount', 'Outstanding']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] }, // Orange-500
      styles: { fontSize: 9 }
    });

    const finalY = doc.previousAutoTable.finalY + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Thank you for your support!', 14, finalY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(249, 115, 22);
    doc.text('Amudhasurabiy Organics', 14, finalY + 5);

    return doc.output('blob');
  };

  const getLedgerBlob = () => {
    if (!selectedCustomer) return null;
    const ledger = buildLedger();
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(settings?.companyName || 'Amudhasurabiy Organics', 14, 20);
    doc.setFontSize(10);
    doc.text('Customer Ledger Account Statement', 14, 26);
    
    doc.setFontSize(12);
    doc.text(`Customer Name: ${selectedCustomer.name}`, 14, 36);
    doc.text(`Business Name: ${selectedCustomer.businessName || 'N/A'}`, 14, 42);
    doc.text(`Outstanding Balance: Rs. ${Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}`, 14, 48);

    const tableData = ledger.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.reference,
      item.description,
      item.debit > 0 ? `Rs. ${item.debit.toFixed(2)}` : '',
      item.credit > 0 ? `Rs. ${item.credit.toFixed(2)}` : '',
      `Rs. ${item.balance.toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 56,
      head: [['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: '#ff9800' }
    });

    return doc.output('blob');
  };

  const handleSendReminderWhatsApp = async () => {
    if (!remPhone) {
      toast('Recipient phone number is required', 'error');
      return;
    }
    setRemSending(true);
    try {
      const pdfBlob = remDocType === 'statement' ? getReminderStatementBlob() : getLedgerBlob();
      const filename = remDocType === 'statement' 
        ? `Statement_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`
        : `Ledger_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
      
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('phone', remPhone);
      formData.append('message', remMessage);
      formData.append('customerId', selectedCustomer.id || selectedCustomer._id);
      formData.append('messageType', 'Outstanding Recovery');

      const { data } = await whatsappApi.sendPdf(formData);
      
      await customersApi.createReminder(selectedCustomer.id || selectedCustomer._id, {
        channel: 'WhatsApp PDF',
        invoiceNumber: remDocType === 'statement' ? 'STATEMENT' : 'LEDGER',
        amount: Number(selectedCustomer.balance)
      });

      toast(`✓ ${remDocType === 'statement' ? 'Statement' : 'Ledger'} sent successfully via WhatsApp!`, 'success');
      if (data && data.data) {
        setWaSuccessData(data.data);
        setShowWaSuccessModal(true);
      }
      setRemModalOpen(false);
      loadCustomer360Details(selectedCustomerId);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to dispatch WhatsApp reminder', 'error');
    } finally {
      setRemSending(false);
    }
  };

  useEffect(() => {
    productsApi.list({ limit: 1000 }).then(res => {
      setAllProducts(res.data.products || []);
    }).catch(err => console.error(err));
  }, []);

  const handleCustomerIntelligence = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsights('');
    try {
      const res = await aiApi.customerIntelligence();
      setAiInsights(res.data.reply);
    } catch (err) {
      setAiInsights('Failed to generate customer intelligence audit. Please verify your backend API connection and Gemini credentials.');
    } finally {
      setAiLoading(false);
    }
  };

  // Main load customer lists
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = {
        page,
        search,
        limit: 200,
      };

      if (activeSegment === 'Archived') {
        queryParams.status = 'Archived';
      } else if (activeSegment !== 'all') {
        queryParams.type = activeSegment;
      }

      // Fetch matching customers for left pane
      const { data } = await customersApi.list(queryParams);
      setCustomers(data.customers);
      setPages(data.pages);

      // Fetch segment counts using a quick aggregate scan
      const counts = { all: data.total || data.customers.length };
      segmentFilters.forEach(f => {
        if (f.value === 'Archived') {
          counts[f.value] = data.customers.filter(c => c.status === 'Archived').length;
        } else if (f.value !== 'all') {
          counts[f.value] = data.customers.filter(c => c.customerType === f.value && c.status !== 'Archived').length;
        }
      });
      setSegmentCounts(counts);

      // Auto-select first customer if none is selected
      if (data.customers.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data.customers[0].id || data.customers[0]._id);
      }
    } catch {
      toast('Failed to load customers list', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, activeSegment, toast, selectedCustomerId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Load 360 detailed logs for selected customer
  const loadCustomer360Details = useCallback(async (cId) => {
    setLoadingDetails(true);
    try {
      const customerRes = await customersApi.get(cId);
      setSelectedCustomer(customerRes.data.customer);

      const [salesRes, paymentsRes, ordersRes, notesRes, followupsRes, remindersRes, visitsRes, reviewsRes] = await Promise.all([
        customersApi.sales(cId),
        customersApi.payments(cId),
        ordersApi.list({ customerId: cId, limit: 150 }),
        customersApi.getNotes(cId),
        customersApi.getFollowUps(cId),
        customersApi.getReminders(cId),
        sfaApi.getVisits({ customerId: cId }),
        crmApi.getReviews()
      ]);

      setSalesHistory(salesRes.data.sales || []);
      setPaymentsHistory(paymentsRes.data.payments || []);
      setOrdersHistory(ordersRes.data.orders || []);
      setNotesHistory(notesRes.data.notes || []);
      setFollowupsHistory(followupsRes.data.followUps || []);
      setRemindersHistory(remindersRes.data.reminders || []);
      setCustomerVisitsHistory(visitsRes.data || []);
      setCustomerReviewsHistory(reviewsRes.data?.reviews?.filter(r => r.customerId === cId) || []);
    } catch (err) {
      console.error('Failed to load CRM details', err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomer360Details(selectedCustomerId);
    }
  }, [selectedCustomerId, loadCustomer360Details]);

  // Form cycle changes
  const handlePaymentCycleChange = (cycle) => {
    let days = 0;
    let billToBill = true;
    if (cycle === 'Cash & Carry' || cycle === 'Advance Payment') {
      billToBill = false;
    } else if (cycle === '7 Days Credit') days = 7;
    else if (cycle === '15 Days Credit') days = 15;
    else if (cycle === '30 Days Credit') days = 30;
    else if (cycle === '45 Days Credit') days = 45;
    
    setForm(prev => ({
      ...prev,
      paymentCycle: cycle,
      creditDays: days,
      billToBillEnabled: billToBill
    }));
  };

  const openFormModal = (c = null) => {
    setForm(c ? { ...emptyCustomer, ...c } : emptyCustomer);
    setModal(c ? 'edit' : 'create');
  };

  const handleEditCustomerFromWaModal = () => {
    setForm(selectedCustomer);
    setModal('edit');
    setWhatsappErrorModal(null);
  };

  const saveCustomerProfile = async () => {
    try {
      const cid = form.id || form._id;
      if (modal === 'edit') {
        await customersApi.update(cid, form);
      } else {
        await customersApi.create(form);
      }
      toast('Customer profile saved successfully', 'success');
      setModal(null);
      loadCustomers();
      if (cid === selectedCustomerId) {
        loadCustomer360Details(cid);
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const getOutstandingColor = (amt) => {
    const val = Number(amt || 0);
    if (val === 0) return '#10b981'; // Green
    if (val <= 5000) return '#f97316'; // Orange
    if (val <= 25000) return '#ef4444'; // Red
    return '#991b1b'; // Dark Red
  };

  const deleteCustomerProfile = async (id) => {
    try {
      const { data } = await customersApi.dependencies(id);
      if (data.hasDependencies) {
        setDependencyModalData({
          counts: data.counts,
          outstanding: data.outstanding,
          customerId: id
        });
      } else {
        if (!confirm('Are you sure you want to permanently delete this customer from ERP? This cannot be undone.')) return;
        await customersApi.remove(id);
        toast('Customer deleted successfully', 'success');
        setSelectedCustomerId(null);
        setSelectedCustomer(null);
        loadCustomers();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to verify dependencies', 'error');
    }
  };

  const handleArchiveCustomer = (id) => {
    setShowArchiveConfirm(id);
  };

  const submitArchiveCustomer = async () => {
    const id = showArchiveConfirm;
    if (!id) return;
    try {
      await customersApi.archive(id);
      toast('Customer archived successfully', 'success');
      setShowArchiveConfirm(false);
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
      loadCustomers();
    } catch {
      toast('Failed to archive customer', 'error');
    }
  };

  const handleRestoreCustomer = async (id) => {
    try {
      await customersApi.restore(id);
      toast('Customer restored successfully', 'success');
      loadCustomers();
      if (id === selectedCustomerId) {
        loadCustomer360Details(id);
      }
    } catch {
      toast('Failed to restore customer', 'error');
    }
  };

  // Payment Reminders text trigger
  const handleTriggerFollowUp = async (template, inv) => {
    if (!selectedCustomer) {
      setWhatsappErrorModal({
        title: 'Cannot Send Reminder',
        reason: 'Customer record does not exist.',
        canEdit: false
      });
      return;
    }
    let rawPhone = selectedCustomer.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      setWhatsappErrorModal({
        title: 'Cannot Send Reminder',
        reason: 'Customer does not have a valid mobile number.',
        canEdit: true
      });
      return;
    }
    if (!inv) {
      setWhatsappErrorModal({
        title: 'Cannot Send Reminder',
        reason: 'Invoice does not exist.',
        canEdit: false
      });
      return;
    }
    const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
    if (balance <= 0) {
      setWhatsappErrorModal({
        title: 'Cannot Send Reminder',
        reason: 'Reason: No unpaid invoices available.',
        canEdit: false
      });
      return;
    }

    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const invoiceDate = new Date(inv.date).toLocaleDateString();
    
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
    const diffTime = new Date() - due;
    const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;

    let msg = '';
    if (template === 'Template 1') {
      msg = `Dear ${selectedCustomer.name},\n\nGreetings from Amudhasurabiy Organics.\n\nThis is a friendly reminder regarding Invoice #${inv.invoiceNumber} dated ${invoiceDate}.\n\nOutstanding Amount:\n₹${balance.toLocaleString('en-IN')}\n\nWe kindly request you to arrange the payment at your earliest convenience.\n\nIf payment has already been made, please ignore this message.\n\nThank you for your continued support.\n\nWarm Regards,\nAccounts Department\nAmudhasurabiy Organics`;
    } else if (template === 'Template 2') {
      msg = `Dear ${selectedCustomer.name},\n\nHope you are doing well.\n\nOur records indicate an outstanding balance of ₹${balance.toLocaleString('en-IN')} against Invoice #${inv.invoiceNumber}.\n\nKindly arrange payment whenever convenient.\n\nWe value your business relationship and appreciate your cooperation.\n\nThank you.\n\nAmudhasurabiy Organics`;
    } else if (template === 'Template 3') {
      msg = `Dear ${selectedCustomer.name},\n\nHope everything is well.\n\nThis is a gentle reminder that Invoice #${inv.invoiceNumber} for ₹${balance.toLocaleString('en-IN')} is currently overdue by ${daysOverdue} days.\n\nWe kindly request your support in settling the outstanding balance.\n\nPlease contact us if any clarification is required.\n\nThank you.\n\nAmudhasurabiy Organics`;
    }

    try {
      // Log sent reminder to history
      await customersApi.createReminder(selectedCustomer.id || selectedCustomer._id, {
        channel: 'WhatsApp',
        invoiceNumber: inv.invoiceNumber,
        amount: balance
      });
      loadCustomer360Details(selectedCustomerId);
    } catch (e) {
      console.error('Failed to log reminder history', e);
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
    toast('WhatsApp reminder shared successfully', 'success');
  };

  const handleSendPDFReminder = async (inv) => {
    if (!selectedCustomer) return;
    try {
      const doc = new jsPDF();
      
      // Page styling & layout
      doc.setFont('helvetica', 'normal');
      
      // Title Block
      doc.setFontSize(22);
      doc.setTextColor(249, 115, 22); // orange-500 (#f97316)
      doc.text(settings?.companyName || 'Amudhasurabiy Organics', 14, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // gray-500
      doc.text(`GSTIN: ${settings?.gstNumber || 'N/A'}`, 14, 31);
      doc.text(`Phone: ${settings?.phone || 'N/A'}  |  Email: ${settings?.email || 'N/A'}`, 14, 36);
      doc.text(`Address: ${settings?.address || 'N/A'}`, 14, 41);

      // Divider Line
      doc.setDrawColor(226, 232, 240); // border gray
      doc.setLineWidth(0.5);
      doc.line(14, 45, 196, 45);

      // Document Title
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT REMINDER STATEMENT', 14, 55);

      // Customer Details (Left Box)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Customer Name: ${selectedCustomer.name}`, 14, 65);
      doc.text(`Business Name: ${selectedCustomer.businessName || 'N/A'}`, 14, 70);
      doc.text(`Contact Phone: ${selectedCustomer.phone || 'N/A'}`, 14, 75);
      doc.text(`Email Address: ${selectedCustomer.email || 'N/A'}`, 14, 80);

      // Summary Box (Right box)
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Outstanding: Rs. ${Number(selectedCustomer.balance).toLocaleString('en-IN')}`, 120, 65);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reminders Shared: ${selectedCustomer.remindersSent || 0}`, 120, 70);
      
      // Message
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const reminderMsg = `Dear ${selectedCustomer.name},\nThis is a friendly reminder regarding your outstanding balance of Rs. ${Number(selectedCustomer.balance).toLocaleString('en-IN')} with Amudhasurabiy Organics. We kindly request you to clear the pending invoice balance at your earliest convenience. Thank you for your continued partnership.`;
      const splitMsg = doc.splitTextToSize(reminderMsg, 182);
      doc.text(splitMsg, 14, 90);

      // Outstanding Invoices Table
      const pendingBills = salesHistory.filter(i => i.paymentStatus !== 'paid' && i.status !== 'Cancelled');
      const tableData = pendingBills.map(item => {
        const balance = Number(item.grandTotal) - Number(item.amountPaid);
        const due = item.dueDate ? new Date(item.dueDate) : new Date(item.date);
        const diffTime = new Date() - due;
        const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
        
        return [
          item.invoiceNumber,
          new Date(item.date).toLocaleDateString(),
          new Date(due).toLocaleDateString(),
          daysOverdue > 0 ? `${daysOverdue} Days` : 'Not due',
          `Rs. ${Number(item.grandTotal).toLocaleString('en-IN')}`,
          `Rs. ${balance.toLocaleString('en-IN')}`
        ];
      });

      doc.autoTable({
        startY: 110,
        head: [['Invoice No', 'Invoice Date', 'Due Date', 'Overdue Age', 'Total Amount', 'Outstanding']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] }, // Orange-500
        styles: { fontSize: 9 }
      });

      // Footer
      const finalY = doc.previousAutoTable.finalY + 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Thank you for your support!', 14, finalY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(249, 115, 22);
      doc.text('Amudhasurabiy Organics', 14, finalY + 5);

      // Save history & trigger download
      await customersApi.createReminder(selectedCustomer.id || selectedCustomer._id, {
        channel: 'PDF',
        invoiceNumber: inv?.invoiceNumber || 'STATEMENT',
        amount: Number(selectedCustomer.balance)
      });
      loadCustomer360Details(selectedCustomerId);

      doc.save(`Reminder_Statement_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`);
      toast('Payment Reminder PDF generated and downloaded', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF Reminder', 'error');
    }
  };

  const handleSendJPGReminder = async (inv) => {
    if (!selectedCustomer) return;
    if (!inv) {
      toast('No outstanding invoice selected to generate image reminder.', 'warning');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');

      // 1. Draw premium white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1080, 1080);

      // Draw premium gradient header line
      const grad = ctx.createLinearGradient(0, 0, 1080, 0);
      grad.addColorStop(0, '#f97316'); // orange-500
      grad.addColorStop(1, '#ea580c'); // orange-600
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 30);

      // Draw modern border card layout
      ctx.strokeStyle = '#fddfbb'; // light orange border
      ctx.lineWidth = 12;
      ctx.strokeRect(40, 70, 1000, 940);

      // Draw card drop-shadow styled rounded rectangle inner box
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 15;
      
      const drawRoundedRect = (cContext, x, y, width, height, radius, fill = false, stroke = false) => {
        cContext.beginPath();
        cContext.moveTo(x + radius, y);
        cContext.lineTo(x + width - radius, y);
        cContext.quadraticCurveTo(x + width, y, x + width, y + radius);
        cContext.lineTo(x + width, y + height - radius);
        cContext.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        cContext.lineTo(x + radius, y + height);
        cContext.quadraticCurveTo(x, y + height, x, y + height - radius);
        cContext.lineTo(x, y + radius);
        cContext.quadraticCurveTo(x, y, x + radius, y);
        cContext.closePath();
        if (fill) cContext.fill();
        if (stroke) cContext.stroke();
      };
      
      drawRoundedRect(ctx, 80, 110, 920, 860, 24, true, false);
      ctx.shadowColor = 'transparent'; // reset shadow

      // Draw company branding details
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(settings?.companyName || 'Amudhasurabiy Organics', 540, 210);

      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 22px sans-serif';
      ctx.fillText(`GSTIN: ${settings?.gstNumber || 'N/A'}  •  Phone: ${settings?.phone || 'N/A'}`, 540, 255);
      ctx.fillText(`Email: ${settings?.email || 'N/A'}`, 540, 290);

      // Separator Line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(140, 325);
      ctx.lineTo(940, 325);
      ctx.stroke();

      // Reminder Title
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('OUTSTANDING PAYMENT REMINDER', 540, 385);

      // Customer Block Info Box
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 140, 430, 800, 160, 16, true, true);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Dear ${selectedCustomer.name},`, 180, 480);
      
      ctx.fillStyle = '#475569';
      ctx.font = 'normal 22px sans-serif';
      ctx.fillText(selectedCustomer.businessName ? `Company: ${selectedCustomer.businessName}` : `Phone: ${selectedCustomer.phone || 'N/A'}`, 180, 520);
      ctx.fillText('We kindly request you to settle the outstanding amount detailed below.', 180, 555);

      // Outstanding Details card inside Card
      ctx.fillStyle = '#fff7ed'; // orange accent box
      ctx.strokeStyle = '#ffedd5';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 140, 620, 800, 240, 20, true, true);

      // Left Column details
      ctx.fillStyle = '#c2410c'; // orange-700
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Invoice Number:', 180, 680);
      ctx.fillText('Invoice Date:', 180, 730);
      ctx.fillText('Payment Due Date:', 180, 785);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`#${inv.invoiceNumber}`, 420, 680);
      ctx.fillText(new Date(inv.date).toLocaleDateString(), 420, 730);
      
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
      ctx.fillText(new Date(due).toLocaleDateString(), 420, 785);

      // Right Column large outstanding figure
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('OUTSTANDING DUE', 900, 680);

      const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
      ctx.fillStyle = '#ea580c'; // orange-600
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(`₹${balance.toLocaleString('en-IN')}`, 900, 755);

      // Overdue alert banner if applicable
      const diffTime = new Date() - due;
      const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
      if (daysOverdue > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${daysOverdue} DAYS OVERDUE`, 900, 810);
      }

      // Footer brand details
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Thank you for your support', 540, 915);
      
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('Amudhasurabiy Organics', 540, 955);

      // Save to ReminderHistory & trigger canvas download
      await customersApi.createReminder(selectedCustomer.id || selectedCustomer._id, {
        channel: 'JPG',
        invoiceNumber: inv.invoiceNumber,
        amount: balance
      });
      loadCustomer360Details(selectedCustomerId);

      const triggerDownload = () => {
        const url = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.download = `Payment_Reminder_${inv.invoiceNumber}.jpg`;
        link.href = url;
        link.click();
        toast('Reminder JPG generated and downloaded successfully', 'success');
      };

      // Try loading company logo to render inside canvas, fallback to text if cross-origin blocks
      if (settings?.logo || settings?.logoUrl) {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(540, 100, 50, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(logo, 490, 50, 100, 100);
          ctx.restore();
          triggerDownload();
        };
        logo.onerror = () => {
          // Fallback to text initials if load fails
          ctx.fillStyle = '#f97316';
          ctx.font = 'bold 48px sans-serif';
          ctx.fillText('🌿', 540, 100);
          triggerDownload();
        };
        logo.src = getActiveLogoUrl(settings);
      } else {
        triggerDownload();
      }
    } catch (err) {
      console.error(err);
      toast('Failed to generate image reminder card', 'error');
    }
  };

  // Timeline computation builder
  const buildTimeline = () => {
    if (!selectedCustomer) return [];
    const events = [];

    events.push({
      date: new Date(selectedCustomer.createdAt),
      title: 'Customer Created',
      icon: '👤',
      details: `Account created for ${selectedCustomer.name} (${selectedCustomer.customerType})`,
      user: 'System'
    });

    ordersHistory.forEach(ord => {
      events.push({
        date: new Date(ord.orderDate || ord.createdAt),
        title: 'Order Added',
        icon: '📦',
        details: `Order ${ord.orderNumber} placed for ₹${Number(ord.totalAmount).toLocaleString('en-IN')}`,
        user: ord.createdBy?.name || 'Sales Desk'
      });
      if (ord.status === 'Packed') {
        events.push({
          date: new Date(ord.updatedAt || ord.orderDate),
          title: 'Order Packed',
          icon: '📦',
          details: `Order ${ord.orderNumber} packed and prepared for shipping`,
          user: 'Store Keeper'
        });
      }
    });

    salesHistory.forEach(inv => {
      const type = inv.type || 'invoice';
      let title = 'Invoice Generated';
      let icon = '📄';
      let details = `Invoice ${inv.invoiceNumber} issued for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;

      if (type === 'credit_note') {
        title = 'Credit Note Issued';
        icon = '🪙';
        details = `Credit Note ${inv.invoiceNumber} issued for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      } else if (type === 'quote') {
        title = 'Quote Generated';
        icon = '📝';
        details = `Quote ${inv.invoiceNumber} created for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      } else if (type === 'sales_receipt') {
        title = 'Sales Receipt Issued';
        icon = '🧾';
        details = `Sales Receipt ${inv.invoiceNumber} processed for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      } else if (type === 'refund') {
        title = 'Refund Processed';
        icon = '💸';
        details = `Refund ${inv.invoiceNumber} issued for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      } else if (type === 'recurring_invoice') {
        title = 'Recurring Profile Configured';
        icon = '🔄';
        details = `Recurring Profile ${inv.invoiceNumber} created for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      } else if (type === 'expense') {
        title = 'Expense Registered';
        icon = '📉';
        details = `Expense ${inv.invoiceNumber} registered for ₹${Number(inv.grandTotal).toLocaleString('en-IN')}`;
      }

      events.push({
        date: new Date(inv.date || inv.createdAt),
        title,
        icon,
        details,
        user: inv.createdBy?.name || 'Billing Executive'
      });

      if (type === 'invoice') {
        if (inv.status === 'Shipped') {
          events.push({
            date: new Date(inv.updatedAt || inv.date),
            title: 'Order Dispatched',
            icon: '🚚',
            details: `Invoice ${inv.invoiceNumber} dispatched. tracking code added.`,
            user: 'Dispatch Executive'
          });
        } else if (inv.status === 'Delivered') {
          events.push({
            date: new Date(inv.updatedAt || inv.date),
            title: 'Order Delivered',
            icon: '✅',
            details: `Invoice ${inv.invoiceNumber} marked delivered by carrier.`,
            user: 'Courier Auto'
          });
        }
      }
    });

    paymentsHistory.forEach(pay => {
      events.push({
        date: new Date(pay.date || pay.createdAt),
        title: 'Payment Received',
        icon: '💳',
        details: `Recorded ₹${Number(pay.amount).toLocaleString('en-IN')} via ${pay.paymentMethod.toUpperCase()} (Ref: ${pay.referenceNumber || 'N/A'})`,
        user: 'Billing Executive'
      });
    });

    remindersHistory.forEach(rem => {
      events.push({
        date: new Date(rem.dateSent),
        title: `Reminder Sent (${rem.channel})`,
        icon: rem.channel === 'WhatsApp' ? '💬' : rem.channel === 'PDF' ? '📄' : rem.channel === 'JPG' ? '🖼️' : '✉️',
        details: `Payment reminder shared via ${rem.channel} for invoice #${rem.invoiceNumber || 'STATEMENT'} (Amount: ₹${Number(rem.amount || 0).toLocaleString()})`,
        user: rem.createdBy?.name || 'System'
      });
    });

    notesHistory.forEach(note => {
      events.push({
        date: new Date(note.createdAt),
        title: 'CRM Note Added',
        icon: '📝',
        details: note.note,
        user: note.createdBy?.name || 'System'
      });
    });

    followupsHistory.forEach(fup => {
      events.push({
        date: new Date(fup.followUpDate),
        title: `Follow-up Scheduled (${fup.status})`,
        icon: '📅',
        details: fup.notes || 'No details',
        user: fup.createdBy?.name || 'System'
      });
    });

    if (remindersHistory.length === 0 && selectedCustomer.remindersSent > 0) {
      events.push({
        date: new Date(selectedCustomer.updatedAt),
        title: 'Reminder Sent',
        icon: '💬',
        details: `Payment reminder shared with customer. Current count: ${selectedCustomer.remindersSent}`,
        user: 'Auto System'
      });
    }

    return events.sort((a, b) => b.date - a.date);
  };

  // Ledger calculation builder
  const buildLedger = () => {
    const ledgerItems = [];
    salesHistory.forEach(inv => {
      if (inv.status !== 'Cancelled') {
        const type = inv.type || 'invoice';
        if (type === 'invoice') {
          ledgerItems.push({
            date: new Date(inv.date || inv.createdAt),
            reference: inv.invoiceNumber,
            description: `Sales Invoice ${inv.invoiceNumber}`,
            debit: Number(inv.grandTotal),
            credit: 0,
          });
        } else if (type === 'credit_note') {
          ledgerItems.push({
            date: new Date(inv.date || inv.createdAt),
            reference: inv.invoiceNumber,
            description: `Credit Note ${inv.invoiceNumber}`,
            debit: 0,
            credit: Number(inv.grandTotal),
          });
        } else if (type === 'sales_receipt') {
          ledgerItems.push({
            date: new Date(inv.date || inv.createdAt),
            reference: inv.invoiceNumber,
            description: `Sales Receipt ${inv.invoiceNumber}`,
            debit: Number(inv.grandTotal),
            credit: 0,
          });
          ledgerItems.push({
            date: new Date(inv.date || inv.createdAt),
            reference: inv.invoiceNumber + "-PAY",
            description: `Sales Receipt Payment ${inv.invoiceNumber}`,
            debit: 0,
            credit: Number(inv.grandTotal),
          });
        } else if (type === 'refund') {
          ledgerItems.push({
            date: new Date(inv.date || inv.createdAt),
            reference: inv.invoiceNumber,
            description: `Refund Issued ${inv.invoiceNumber}`,
            debit: Number(inv.grandTotal),
            credit: 0,
          });
        }
      }
    });

    paymentsHistory.forEach(pay => {
      ledgerItems.push({
        date: new Date(pay.date || pay.createdAt),
        reference: pay.paymentNumber,
        description: `Payment Received (Ref: ${pay.referenceNumber || 'N/A'})`,
        debit: 0,
        credit: Number(pay.amount),
      });
    });

    ledgerItems.sort((a, b) => a.date - b.date);
    let bal = 0;
    const mapped = ledgerItems.map(item => {
      bal = Number((bal + item.debit - item.credit).toFixed(2));
      return { ...item, balance: bal };
    });
    return mapped.reverse();
  };

  // Exports
  const exportLedgerToPDF = () => {
    if (!selectedCustomer) return;
    const ledger = buildLedger();
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Amudhasurabiy Organics', 14, 20);
    doc.setFontSize(10);
    doc.text('Customer Ledger Account Statement', 14, 26);
    
    doc.setFontSize(12);
    doc.text(`Customer Name: ${selectedCustomer.name}`, 14, 36);
    doc.text(`Business Name: ${selectedCustomer.businessName || 'N/A'}`, 14, 42);
    doc.text(`Outstanding Balance: Rs. ${Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}`, 14, 48);

    const tableData = ledger.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.reference,
      item.description,
      item.debit > 0 ? `Rs. ${item.debit.toFixed(2)}` : '',
      item.credit > 0 ? `Rs. ${item.credit.toFixed(2)}` : '',
      `Rs. ${item.balance.toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 56,
      head: [['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: '#ff9800' }
    });

    doc.save(`Ledger_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`);
    toast('Ledger PDF statement downloaded', 'success');
  };

  const exportLedgerToExcel = () => {
    if (!selectedCustomer) return;
    const ledger = buildLedger();
    let csv = "Customer Ledger Statement - Amudhasurabiy Organics\n";
    csv += `Customer: ${selectedCustomer.name}\n`;
    csv += `Business: ${selectedCustomer.businessName || ''}\n\n`;
    csv += "Date,Reference,Description,Debit,Credit,Running Balance\n";

    ledger.forEach(item => {
      csv += `${new Date(item.date).toLocaleDateString()},${item.reference},"${item.description}",${item.debit || ''},${item.credit || ''},${item.balance}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Ledger_${selectedCustomer.name.replace(/\s+/g, '_')}.csv`;
    link.click();
    toast('Ledger CSV statement downloaded', 'success');
  };



  // WhatsApp helper generators
  const openWhatsAppLink = (type, data = null) => {
    let rawPhone = selectedCustomer.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    let text = '';
    if (type === 'general') {
      text = `Hello ${selectedCustomer.name}, greetings from Amudhasurabiy Organics.`;
    } else if (type === 'outstanding') {
      text = `Dear ${selectedCustomer.name}, your total outstanding balance with Amudhasurabiy Organics is ₹${Number(selectedCustomer.balance).toLocaleString('en-IN')}. Please find statement copy enclosed.`;
    } else if (type === 'offer') {
      text = `Hello ${selectedCustomer.name}! We have launched special festival pricing on Nendram Banana Malt this week. Order now for exclusive benefits.`;
    } else if (type === 'dispatch' && data) {
      text = `Dear ${selectedCustomer.name}, your order has been packed and dispatched. Shipment tracking code: ${data.trackingNumber || 'AWB-xx'} (${data.courier || 'Logistics'}).`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // CRM Intelligence scans
  const getCrmAlerts = () => {
    if (!selectedCustomer) return [];
    const alerts = [];

    const totalRevenue = salesHistory.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
    const outstanding = Number(selectedCustomer.balance || 0);

    if (totalRevenue > 100000) {
      alerts.push({ type: 'success', text: `🏆 Customer lifetime revenue crossed ₹${totalRevenue.toLocaleString('en-IN')}.` });
    }

    if (outstanding > 15000) {
      alerts.push({ type: 'danger', text: `⚠️ Outstanding increased by ₹${outstanding.toLocaleString('en-IN')}. Action required.` });
    }

    const sortedInvoices = [...salesHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sortedInvoices.length > 0) {
      const lastOrder = new Date(sortedInvoices[0].date);
      const diffDays = Math.floor((new Date() - lastOrder) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        alerts.push({ type: 'warning', text: `⏳ Customer has not ordered for ${diffDays} days.` });
      }
    }

    // Check top product
    const prodCounts = {};
    salesHistory.forEach(inv => {
      inv.items?.forEach(it => {
        prodCounts[it.name] = (prodCounts[it.name] || 0) + Number(it.qty || 0);
      });
    });
    const topProd = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0];
    if (topProd) {
      alerts.push({ type: 'info', text: `🔥 Top product purchased: ${topProd[0]} (${topProd[1]} Qty).` });
    }

    if (ordersHistory.length > 3 && sortedInvoices.length > 0) {
      alerts.push({ type: 'info', text: `📈 Likely reorder required this week based on buying cycle.` });
    }

    return alerts;
  };

  // Rendering Right Panel Detail Tabs content
  const renderDetailTabContent = () => {
    if (loadingDetails || !selectedCustomer) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem' }}>
          {/* Skeleton Loaders */}
          <div className="skeleton" style={{ height: '80px', width: '100%', borderRadius: '10px', backgroundColor: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="skeleton" style={{ height: '60px', borderRadius: '8px', backgroundColor: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
            <div className="skeleton" style={{ height: '60px', borderRadius: '8px', backgroundColor: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
            <div className="skeleton" style={{ height: '60px', borderRadius: '8px', backgroundColor: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div className="skeleton" style={{ height: '140px', width: '100%', borderRadius: '10px', backgroundColor: '#f1f5f9', animation: 'pulse 1.5s infinite' }} />
        </div>
      );
    }

    switch (detailTab) {
      case 'overview':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Smart Alerts & Quick Profile Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🤖 CRM Smart Intelligence Alerts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {getCrmAlerts().map((al, idx) => (
                    <div key={idx} style={{
                      padding: '0.6rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 650,
                      backgroundColor: al.type === 'danger' ? '#fef2f2' : al.type === 'warning' ? '#fff7ed' : al.type === 'success' ? '#f0fdf4' : '#f0f9ff',
                      color: al.type === 'danger' ? '#b91c1c' : al.type === 'warning' ? '#c2410c' : al.type === 'success' ? '#16a34a' : '#0284c7',
                      borderLeft: `4px solid ${al.type === 'danger' ? '#ef4444' : al.type === 'warning' ? '#f97316' : al.type === 'success' ? '#22c55e' : '#3b82f6'}`
                    }}>
                      {al.text}
                    </div>
                  ))}
                  {getCrmAlerts().length === 0 && (
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>No pending alerts for this client profile.</p>
                  )}
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#b45309' }}>📍 Territory & Route Assignment</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#78350f' }}>Territory Name:</span>
                    <strong>{selectedCustomer.territory || 'Unassigned'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#78350f' }}>Route Zone / ID Prefix:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{selectedCustomer.routeZone || 'N/A'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#78350f' }}>Assigned Salesman:</span>
                    <strong>{selectedCustomer.salesman?.name || 'Auto Assigned'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#78350f' }}>GPS Coordinates:</span>
                    <strong style={{ fontSize: '0.75rem' }}>
                      {selectedCustomer.latitude && selectedCustomer.longitude 
                        ? `${Number(selectedCustomer.latitude).toFixed(4)}, ${Number(selectedCustomer.longitude).toFixed(4)}`
                        : 'Not Mapped'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>💳 Credit Profiling & Cycle</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Payment Cycle:</span>
                    <strong>{selectedCustomer.paymentCycle || 'Bill to Bill'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Credit Limit:</span>
                    <strong>₹{Number(selectedCustomer.creditLimit).toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Credit Terms (Legacy):</span>
                    <strong>{selectedCustomer.paymentTerms || 'COD'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Avg Delay Days:</span>
                    <strong style={{ color: selectedCustomer.averagePaymentDays > selectedCustomer.creditDays ? '#ef4444' : '#10b981' }}>
                      {selectedCustomer.averagePaymentDays || 0} Days
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Outstanding Bills:</span>
                    <strong>{selectedCustomer.invoiceOutstandingCount || 0} bills</strong>
                  </div>
                </div>
              </div>
              
              <div className="card" style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#166534' }}>📊 CRM Overview</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', opacity: 0.8 }}>Total Invoices:</span>
                    <strong>{salesHistory.filter(i => !i.type || i.type === 'invoice').length} Invoices</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', opacity: 0.8 }}>Paid Amount:</span>
                    <strong style={{ color: '#15803d' }}>
                      ₹{paymentsHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', opacity: 0.8 }}>Outstanding Amount:</span>
                    <strong style={{ color: '#b91c1c' }}>
                      ₹{salesHistory.filter(i => (!i.type || i.type === 'invoice') && i.status !== 'Cancelled').reduce((sum, i) => sum + Math.max(0, Number(i.grandTotal) - Number(i.amountPaid || 0)), 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', opacity: 0.8 }}>Last Payment Date:</span>
                    <strong>
                      {paymentsHistory.length > 0 
                        ? new Date(paymentsHistory[0].date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                        : 'No payments recorded'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', opacity: 0.8 }}>Credit Days:</span>
                    <strong>{selectedCustomer.creditDays || 0} Days</strong>
                  </div>
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #bbf7d0', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-success btn-sm btn-block"
                      style={{ width: '100%', fontWeight: 700, backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                      onClick={openCustomerReminderModal}
                    >
                      💬 Send WhatsApp Reminder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'transactions':
        const invoicesList = salesHistory.filter(inv => !inv.type || inv.type === 'invoice');
        const creditNotesList = salesHistory.filter(inv => inv.type === 'credit_note');
        const salesReceiptsList = salesHistory.filter(inv => inv.type === 'sales_receipt');
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Sales Invoices */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>📄 Sales Invoices</h4>
              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {invoicesList.map(inv => (
                      <tr key={inv.id || inv._id}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{new Date(inv.date).toLocaleDateString()}</td>
                        <td>₹{Number(inv.grandTotal).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${inv.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                            {inv.paymentStatus.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <a href={`/sales/${inv.id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>View</a>{' '}
                          <a href={`/sales/${inv.id}/print`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>Print</a>
                        </td>
                      </tr>
                    ))}
                    {invoicesList.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No Invoices registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments Received */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>💳 Payments History</h4>
              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Payment No</th><th>Date</th><th>Mode</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {paymentsHistory.map(pay => (
                      <tr key={pay.id || pay._id}>
                        <td><strong>{pay.paymentNumber}</strong></td>
                        <td>{new Date(pay.date).toLocaleDateString()}</td>
                        <td><span className="badge badge-secondary">{pay.paymentMethod.toUpperCase()}</span></td>
                        <td><strong>₹{Number(pay.amount).toLocaleString()}</strong></td>
                        <td><span className="badge badge-success">{pay.status || 'Success'}</span></td>
                      </tr>
                    ))}
                    {paymentsHistory.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No payment records registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Credit Notes */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🪙 Credit Notes</h4>
              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Credit Note No</th><th>Date</th><th>Amount</th><th>Allocated</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {creditNotesList.map(inv => (
                      <tr key={inv.id || inv._id}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{new Date(inv.date).toLocaleDateString()}</td>
                        <td>₹{Number(inv.grandTotal).toLocaleString()}</td>
                        <td>₹{Number(inv.amountPaid || 0).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${inv.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                            {inv.paymentStatus.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {creditNotesList.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No Credit Notes registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sales Receipts */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🧾 Sales Receipts</h4>
              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Receipt No</th><th>Date</th><th>Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {salesReceiptsList.map(inv => (
                      <tr key={inv.id || inv._id}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{new Date(inv.date).toLocaleDateString()}</td>
                        <td>₹{Number(inv.grandTotal).toLocaleString()}</td>
                        <td>
                          <span className="badge badge-success">PAID</span>
                        </td>
                      </tr>
                    ))}
                    {salesReceiptsList.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>No Sales Receipts registered</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        );

      case 'ledger':
        const ledger = buildLedger();
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🧾 running Account Ledger</h4>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={exportLedgerToPDF}>PDF</button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={exportLedgerToExcel}>Excel</button>
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr><th>Date</th><th>Reference</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Bal</th></tr>
                </thead>
                <tbody>
                  {ledger.map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.date).toLocaleDateString()}</td>
                      <td title={item.description}><strong>{item.reference}</strong></td>
                      <td style={{ color: item.debit > 0 ? '#ef4444' : '', fontWeight: item.debit > 0 ? 600 : 400 }}>
                        {item.debit > 0 ? `₹${item.debit.toLocaleString()}` : '-'}
                      </td>
                      <td style={{ color: item.credit > 0 ? '#10b981' : '', fontWeight: item.credit > 0 ? 600 : 400 }}>
                        {item.credit > 0 ? `₹${item.credit.toLocaleString()}` : '-'}
                      </td>
                      <td><strong>₹{item.balance.toLocaleString()}</strong></td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No ledger statements created yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case 'outstanding':
        const pendingBills = salesHistory.filter(i => i.paymentStatus !== 'paid' && i.status !== 'Cancelled');
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>💳 Bill-to-Bill Outstanding</h4>
            <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr><th>Bill No</th><th>Due Date</th><th>Age</th><th>Amount</th><th>Pending</th></tr>
                </thead>
                <tbody>
                  {pendingBills.map(inv => {
                    const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
                    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    due.setHours(0,0,0,0);
                    const diffTime = today - due;
                    const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
                    
                    return (
                      <tr key={inv.id || inv._id}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{new Date(due).toLocaleDateString()}</td>
                        <td style={{ color: daysOverdue > 0 ? '#ef4444' : '', fontWeight: 700 }}>
                          {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Not due'}
                        </td>
                        <td>₹{Number(inv.grandTotal).toLocaleString()}</td>
                        <td><strong style={{ color: '#ef4444' }}>₹{balance.toLocaleString()}</strong></td>
                      </tr>
                    );
                  })}
                  {pendingBills.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold', padding: '1.5rem' }}>All bills cleared! Outstanding balance is ₹0.00. 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case 'followup':
        const outstandingBills = salesHistory.filter(i => i.paymentStatus !== 'paid' && i.status !== 'Cancelled');
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* WhatsApp reminders table */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>💬 Dues Follow-ups Reminders</h4>
              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th>Invoice No</th><th>Outstanding</th><th>Age</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {outstandingBills.map(inv => {
                      const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
                      const age = Math.floor((new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={inv.id || inv._id}>
                          <td><strong>{inv.invoiceNumber}</strong></td>
                          <td><strong style={{ color: '#ef4444' }}>₹{balance.toLocaleString()}</strong></td>
                          <td>{age} Days</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.75rem', marginRight: '4px', border: '1px solid #2563eb', color: '#2563eb' }}
                              onClick={() => handleTriggerFollowUp('Template 1', inv)}
                            >
                              💬 WhatsApp Text
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.75rem', marginRight: '4px', border: '1px solid #ff9800', color: '#ff9800' }}
                              onClick={() => setReminderModalInvoice(inv)}
                            >
                              🖼️ Reminder Image
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.35rem', fontSize: '0.75rem', border: '1px solid #ef4444', color: '#ef4444' }}
                              onClick={() => setReminderModalInvoice(inv)}
                            >
                              📄 Reminder PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {outstandingBills.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: '#10b981', padding: '1.5rem' }}>No bills pending action.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note taking box */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>📝 Add CRM Note</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Type a log note for this client..."
                  value={newCrmNoteText}
                  onChange={(e) => setNewCrmNoteText(e.target.value)}
                  style={{ fontSize: '0.8rem', borderRadius: '6px' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!newCrmNoteText.trim()) return;
                    try {
                      await customersApi.createNote(selectedCustomer.id || selectedCustomer._id, { note: newCrmNoteText });
                      setNewCrmNoteText('');
                      toast('Note saved successfully', 'success');
                      loadCustomer360Details(selectedCustomerId);
                    } catch (e) {
                      toast('Failed to save note', 'error');
                    }
                  }}
                  style={{ alignSelf: 'stretch', padding: '0 1rem', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Save Note
                </button>
              </div>

              {notesHistory.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Recent Notes</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                    {notesHistory.map(n => (
                      <div key={n.id || n._id} style={{ padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '0.25rem' }}>
                          <strong>{n.createdBy?.name || 'System'}</strong>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#0f172a' }}>{n.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Follow-up box */}
            <div className="card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>📅 Schedule Call / Meeting</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={newFollowUpDate}
                    onChange={(e) => setNewFollowUpDate(e.target.value)}
                    style={{ fontSize: '0.8rem', width: '220px' }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Description (e.g. Call to discuss invoice #1003)"
                    value={newFollowUpNotes}
                    onChange={(e) => setNewFollowUpNotes(e.target.value)}
                    style={{ fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!newFollowUpDate) return toast('Please select date & time', 'warning');
                      try {
                        await customersApi.createFollowUp(selectedCustomer.id || selectedCustomer._id, {
                          followUpDate: newFollowUpDate,
                          notes: newFollowUpNotes
                        });
                        setNewFollowUpDate('');
                        setNewFollowUpNotes('');
                        toast('Follow-up scheduled successfully', 'success');
                        loadCustomer360Details(selectedCustomerId);
                      } catch (e) {
                        toast('Failed to schedule follow-up', 'error');
                      }
                    }}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {followupsHistory.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.75rem', color: '#64748b' }}>Scheduled tasks checklist</h5>
                  <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr><th>Done</th><th>Due Date</th><th>Details</th><th>Assigned</th></tr>
                      </thead>
                      <tbody>
                        {followupsHistory.map(f => (
                          <tr key={f.id || f._id} style={{ opacity: f.status === 'Completed' ? 0.6 : 1 }}>
                            <td style={{ width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={f.status === 'Completed'}
                                onChange={async (e) => {
                                  try {
                                    await customersApi.updateFollowUp(selectedCustomer.id || selectedCustomer._id, f.id || f._id, {
                                      status: e.target.checked ? 'Completed' : 'Pending'
                                    });
                                    loadCustomer360Details(selectedCustomerId);
                                    toast(`Follow-up marked ${e.target.checked ? 'Completed' : 'Pending'}`, 'success');
                                  } catch (err) {
                                    toast('Failed to update task', 'error');
                                  }
                                }}
                              />
                            </td>
                            <td><strong>{new Date(f.followUpDate).toLocaleString()}</strong></td>
                            <td style={{ textDecoration: f.status === 'Completed' ? 'line-through' : 'none' }}>
                              {f.notes || 'No description'}
                            </td>
                            <td>{f.createdBy?.name || 'System'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        );

      case 'visits':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>📍 Salesman Check-in Visits</h4>
            <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr><th>Date</th><th>Salesman</th><th>Check In</th><th>Check Out</th><th>Duration</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {customerVisitsHistory.map((visit) => (
                    <tr key={visit.id}>
                      <td>{new Date(visit.checkInTime).toLocaleDateString()}</td>
                      <td><strong>{visit.salesman?.name || 'Unassigned'}</strong></td>
                      <td>{new Date(visit.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{visit.checkOutTime ? new Date(visit.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td>{visit.duration ? `${visit.duration} mins` : 'Active'}</td>
                      <td>
                        <span className={`badge ${visit.status === 'Visited' ? 'badge-success' : 'badge-warning'}`}>
                          {visit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {customerVisitsHistory.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8' }}>No visit check-ins recorded for this customer.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case 'reviews':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>⭐ Customer Survey Reviews</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
              {customerReviewsHistory.map((rev) => (
                <div key={rev.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                    <span>Survey on Invoice {rev.invoice?.invoiceNumber}</span>
                    <span style={{ color: 'var(--warning)' }}>★ {rev.overallRating || 0}/5</span>
                  </div>
                  {rev.status === 'Submitted' ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      <div>Product Quality: {rev.productRating}/5 | Delivery Speed: {rev.deliveryRating}/5 | Salesman: {rev.salesmanRating}/5</div>
                      <p style={{ margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>"{rev.comment || rev.reviewText || 'No comment'}"</p>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Waiting for submission</div>
                  )}
                </div>
              ))}
              {customerReviewsHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>No reviews submitted yet.</div>
              )}
            </div>
          </motion.div>
        );

      case 'special_pricing':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🏷️ Price overrides</h4>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => openFormModal(selectedCustomer)}>Update Pricing</button>
            </div>
            
            <div className="table-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr><th>Product</th><th>List Price</th><th>Custom Price</th><th>Discount</th></tr>
                </thead>
                <tbody>
                  {Object.entries(selectedCustomer.specialPricing || {}).map(([prodId, details]) => {
                    const product = allProducts.find(p => String(p.id) === String(prodId) || String(p.sku) === String(prodId));
                    if (!product) return null;
                    const defaultPrice = Number(product.price || product.salePrice || 0);
                    const custPrice = details.price !== undefined ? Number(details.price) : defaultPrice;
                    const discount = details.discount !== undefined ? Number(details.discount) : 0;
                    
                    return (
                      <tr key={prodId}>
                        <td><strong>{product.name}</strong> ({product.sku})</td>
                        <td>₹{defaultPrice.toFixed(2)}</td>
                        <td style={{ color: '#22c55e', fontWeight: 700 }}>₹{custPrice.toFixed(2)}</td>
                        <td>{discount > 0 ? `${discount}%` : '0%'}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(selectedCustomer.specialPricing || {}).length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>No custom price lists configured. Default applies.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        );

      case 'whatsapp':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '0.85rem', color: '#334155' }}>🔌 WhatsApp Hub</h4>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Select a quick trigger below to launch prefilled text:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => openWhatsAppLink('general')}>
                💬 greetings
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => openWhatsAppLink('outstanding')}>
                📋 Outstanding Statement
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => openWhatsAppLink('offer')}>
                🔥 special offer
              </button>
              {salesHistory.slice(0, 1).map(inv => (
                <button key={inv.id || inv._id} type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.5rem', fontSize: '0.75rem' }} onClick={() => openWhatsAppLink('dispatch', inv)}>
                  🚚 dispatch confirm
                </button>
              ))}
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page" style={{ padding: '1.25rem', fontFamily: 'Inter, sans-serif', maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* Mobile Drawer Overlay */}
      <div 
        className={`crm-overlay ${mobileDrawerOpen ? 'show' : ''}`} 
        onClick={() => setMobileDrawerOpen(false)}
      />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>💼 Customer Relationship CRM</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Perform CRM Intelligence scans, check timeline feeds, and record allocations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => openFormModal()} style={{ padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
            + Add Customer
          </button>
        </div>
      </div>

      {/* Mobile Toggle Button */}
      <div className="crm-mobile-toggle">
        <button 
          type="button" 
          className="btn btn-secondary btn-block" 
          style={{ width: '100%', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}
          onClick={() => setMobileDrawerOpen(true)}
        >
          👥 View Accounts Directory ({customers.length})
        </button>
      </div>

      {/* 3-Column CRM Grid */}
      <div className="crm-container">
        
        {/* Column 1 - Directory Pane (25%) */}
        <div className={`crm-col-dir ${mobileDrawerOpen ? 'open' : ''}`}>
          {/* Search Customer */}
          <div className="crm-dir-search">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search customers..." 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ borderRadius: '6px', fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
            />
          </div>

          {/* Segment Filters Horizontal Row */}
          <div style={{ 
            display: 'flex', 
            gap: '0.4rem', 
            padding: '0.5rem', 
            overflowX: 'auto', 
            borderBottom: '1px solid var(--border)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {segmentFilters.map(filter => {
              const isActive = activeSegment === filter.value;
              const count = segmentCounts[filter.value] || 0;
              return (
                <button 
                  key={filter.value} 
                  type="button" 
                  onClick={() => { setActiveSegment(filter.value); setPage(1); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--brand-primary)' : 'var(--border)',
                    backgroundColor: isActive ? 'var(--brand-primary)' : '#f8fafc',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: isActive ? 700 : 600,
                    transition: 'all 0.1s'
                  }}
                >
                  <span>{filter.label.replace(' Customers', '').replace(' Shops', '').replace(' Stores', '')}</span>
                  <span style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    padding: '1px 4px',
                    borderRadius: '8px',
                    fontSize: '0.6rem'
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Customer list results independently scrollable */}
          <div className="crm-dir-list" style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
            ) : customers.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>No accounts matched filters.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {customers.map((c) => {
                  const isSelected = selectedCustomerId === (c.id || c._id);
                  const outstandingAmt = Number(c.balance || 0);
                  
                  // Status Dot Indicator
                  let statusDotColor = '#10b981'; // Active
                  let statusLabel = 'Active';
                  if (c.status === 'Inactive') {
                    statusDotColor = '#eab308'; // Inactive
                    statusLabel = 'Inactive';
                  } else if (c.status === 'Archived') {
                    statusDotColor = '#64748b'; // Slate gray
                    statusLabel = 'Archived';
                  } else {
                    statusDotColor = getOutstandingColor(outstandingAmt);
                    statusLabel = outstandingAmt > 0 ? 'Dues Pending' : 'Active';
                  }

                  // Initials for avatar circle
                  const initials = c.name
                    ? c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'C';

                  const lastOrd = c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : 'No orders';
                  const typeColors = getCustomerTypeColors(c.customerType);

                  return (
                    <div 
                      key={c.id || c._id} 
                      onClick={() => {
                        setSelectedCustomerId(c.id || c._id);
                        setMobileDrawerOpen(false); // Auto close drawer on mobile selection
                      }}
                      className={`crm-row-item ${isSelected ? 'active' : ''}`}
                    >
                      <div className="crm-avatar" style={{ backgroundColor: typeColors.bg, color: typeColors.text, borderColor: typeColors.color }}>{initials}</div>
                      <div className="crm-row-details">
                        <div className="crm-row-title-row">
                          <span className="crm-row-name" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            {c.name}
                            {c.customerCode && (
                              <span style={{
                                fontSize: '0.6rem',
                                fontFamily: 'monospace',
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                padding: '0.05rem 0.2rem',
                                borderRadius: '3px',
                                marginLeft: '0.35rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                              }}>
                                {c.customerCode}
                              </span>
                            )}
                          </span>
                          <span 
                            title={statusLabel}
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: statusDotColor,
                              display: 'inline-block',
                              flexShrink: 0
                            }}
                          />
                        </div>
                        <div className="crm-row-meta">
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                            {c.businessName || 'No Company'}
                          </span>
                          <span 
                            className={`crm-row-bal ${outstandingAmt > 0 ? 'has-dues' : 'no-dues'}`} 
                            style={{ 
                              fontSize: '0.75rem', 
                              color: getOutstandingColor(outstandingAmt),
                              fontWeight: outstandingAmt > 0 ? 'bold' : 'normal'
                            }}
                          >
                            {outstandingAmt > 0 ? `₹${outstandingAmt.toLocaleString()}` : 'Cleared'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                          <span>{c.customerType}</span>
                          <span>Last: {lastOrd}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Directory Footer Pagination */}
          <div style={{ padding: '0.4rem', borderTop: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
            <Pagination page={page} pages={pages} onPageChange={setPage} />
          </div>
        </div>

        {/* Column 2 - Customer Profile (35%) */}
        <div className="crm-col-prof">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div
                key={selectedCustomer.id || selectedCustomer._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                {/* Profile header card */}
                <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--brand-primary)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    {(() => {
                      const typeColors = getCustomerTypeColors(selectedCustomer.customerType);
                      return (
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          background: typeColors.bg,
                          color: typeColors.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          border: `2px solid ${typeColors.color}`
                        }}>
                          {selectedCustomer.name ? selectedCustomer.name[0].toUpperCase() : 'C'}
                        </div>
                      );
                    })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {selectedCustomer.name}
                        {selectedCustomer.customerCode && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontFamily: 'monospace',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #ffedd5',
                            padding: '0.05rem 0.25rem',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                            {selectedCustomer.customerCode}
                          </span>
                        )}
                      </h2>
                      <p style={{ margin: '0.1rem 0 0 0', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                        🏢 {selectedCustomer.businessName || 'No Company'}
                      </p>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>{selectedCustomer.customerType}</span>
                        <span style={{
                          backgroundColor: selectedCustomer.status === 'Active' ? '#dcfce7' : '#fef9c3',
                          color: selectedCustomer.status === 'Active' ? '#166534' : '#854d0e',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          fontSize: '0.6rem',
                          fontWeight: 750
                        }}>
                          {selectedCustomer.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={() => openFormModal(selectedCustomer)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={() => {
                        if (!selectedCustomer.phone) return toast('Phone number is missing', 'warning');
                        window.location.href = `tel:${selectedCustomer.phone}`;
                      }}
                    >
                      📞 Call Customer
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={() => openWhatsAppLink('general')}
                    >
                      💬 WhatsApp Customer
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={openCustomerCatalogModal}
                    >
                      📖 Send Catalog
                    </button>
                    
                    {(() => {
                      const pending = salesHistory.filter(i => i.paymentStatus !== 'paid' && i.status !== 'Cancelled');
                      const activeInvoice = pending[0];
                      return (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                            onClick={() => {
                              if (!activeInvoice) return toast('No pending bills found', 'info');
                              setDetailTab('followup');
                              toast('Select Template 1, 2, or 3 in the Follow-up tab to send text reminders', 'info');
                            }}
                          >
                            💬 Send Reminder
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                            onClick={() => {
                              if (!activeInvoice) return toast('No outstanding invoice found to generate image reminder.', 'warning');
                              handleSendJPGReminder(activeInvoice);
                            }}
                          >
                            🖼️ Send Reminder JPG
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                            onClick={() => {
                              if (pending.length === 0) return toast('No outstanding invoices found.', 'warning');
                              handleSendPDFReminder(activeInvoice);
                            }}
                          >
                            📄 Send Reminder PDF
                          </button>
                        </>
                      );
                    })()}

                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={() => setDetailTab('ledger')}
                    >
                      📖 View Ledger
                    </button>
                    <a 
                      href={`/sales?tab=payments&customerId=${selectedCustomer.id || selectedCustomer._id}`}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700, textDecoration: 'none' }}
                    >
                      💳 Record Payment
                    </a>
                    {selectedCustomer.status === 'Archived' ? (
                      <button 
                        type="button" 
                        className="btn btn-success btn-sm" 
                        style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                        onClick={() => handleRestoreCustomer(selectedCustomer.id || selectedCustomer._id)}
                      >
                        🔄 Restore Customer
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn btn-warning btn-sm" 
                        style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                        onClick={() => handleArchiveCustomer(selectedCustomer.id || selectedCustomer._id)}
                      >
                        📥 Archive Customer
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="btn btn-danger btn-sm" 
                      style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontWeight: 700 }}
                      onClick={() => deleteCustomerProfile(selectedCustomer.id || selectedCustomer._id)}
                    >
                      🗑️ Delete Customer
                    </button>
                  </div>
                </div>

                {/* Info Fields Detail Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="card" style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📞 Contact Details</h4>
                    <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                      <div style={{ marginBottom: '0.15rem' }}><strong>Person:</strong> {selectedCustomer.contactPerson || '-'}</div>
                      <div style={{ marginBottom: '0.15rem' }}><strong>Phone:</strong> {selectedCustomer.phone || '-'}</div>
                      <div><strong>Email:</strong> <span style={{ wordBreak: 'break-all' }}>{selectedCustomer.email || '-'}</span></div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏢 Tax & Compliance</h4>
                    <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                      <div style={{ marginBottom: '0.15rem' }}><strong>GSTIN:</strong> {selectedCustomer.gstNumber || 'N/A'}</div>
                      <div style={{ marginBottom: '0.15rem' }}><strong>Pincode:</strong> {selectedCustomer.pincode || '-'}</div>
                      <div><strong>State:</strong> {selectedCustomer.state || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Address Box */}
                <div className="card" style={{ padding: '0.65rem' }}>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Billing Address</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#334155', lineHeight: 1.3 }}>
                    {selectedCustomer.address || 'No address configured for billing.'}
                  </p>
                </div>

                {/* Navigation Detail Tabs */}
                <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', gap: '0.2rem', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                  {[
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'transactions', label: '🧾 Transactions' },
                    { id: 'ledger', label: '📖 Ledger' },
                    { id: 'outstanding', label: '💳 Outstanding' },
                    { id: 'followup', label: '💬 Follow-up' },
                    { id: 'visits', label: '📍 Visits' },
                    { id: 'reviews', label: '⭐ Reviews' },
                    { id: 'special_pricing', label: '🏷️ Price overrides' },
                    { id: 'whatsapp', label: '🔌 WhatsApp' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id)}
                      style={{
                        padding: '0.4rem 0.65rem',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                        borderBottom: detailTab === t.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                        color: detailTab === t.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Detail Tab Contents */}
                <div style={{ flex: 1, minHeight: '250px' }}>
                  {renderDetailTabContent()}
                </div>
              </motion.div>
            ) : (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Select a Customer Profile</h3>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Choose a business from the left pane directory list to view account details, transactions, and outstanding ledgers.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Column 3 - Customer Analytics & Timeline (40%) */}
        <div className="crm-col-anal">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div
                key={`anal-${selectedCustomer.id || selectedCustomer._id}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                {/* KPI metrics Grid */}
                <div className="card" style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' }}>
                    📈 Performance KPIs
                  </h4>
                  
                  {/* Grid of widgets */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block' }}>TOTAL ORDERS</span>
                      <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{ordersHistory.length}</strong>
                    </div>
                    <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block' }}>TOTAL REVENUE</span>
                      <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>
                        ₹{salesHistory.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', borderLeft: `3px solid ${getOutstandingColor(selectedCustomer.balance)}` }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block' }}>OUTSTANDING DUES</span>
                      <strong style={{ fontSize: '1.1rem', color: getOutstandingColor(selectedCustomer.balance) }}>
                        ₹{Number(selectedCustomer.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                    <div style={{ padding: '0.6rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #8b5cf6' }}>
                      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, display: 'block' }}>AVERAGE VALUE (AOV)</span>
                      <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                        ₹{(() => {
                          const rev = salesHistory.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
                          const total = ordersHistory.length;
                          return total > 0 ? Math.round(rev / total).toLocaleString() : '0';
                        })()}
                      </strong>
                    </div>
                  </div>

                  {/* Buying Frequency Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ padding: '0.5rem 0.6rem', background: '#fffbeb', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.6rem', color: '#b45309', fontWeight: 700 }}>DAYS SINCE LAST ORDER</span>
                      <strong style={{ fontSize: '0.95rem', color: '#b45309', marginTop: '2px' }}>
                        {(() => {
                          const sortedSales = [...salesHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                          if (sortedSales.length === 0) return 'N/A';
                          const diff = new Date() - new Date(sortedSales[0].date);
                          return `${Math.floor(diff / (1000 * 60 * 60 * 24))} Days`;
                        })()}
                      </strong>
                    </div>
                    <div style={{ padding: '0.5rem 0.6rem', background: '#f5f3ff', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.6rem', color: '#6d28d9', fontWeight: 700 }}>TOP ORDERED PRODUCT</span>
                      <span style={{ fontSize: '0.75rem', color: '#6d28d9', fontWeight: 700, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={
                        (() => {
                          const prodCounts = {};
                          salesHistory.forEach(inv => {
                            inv.items?.forEach(it => {
                              prodCounts[it.name] = (prodCounts[it.name] || 0) + Number(it.qty || 0);
                            });
                          });
                          const top = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0];
                          return top ? `${top[0]} (${top[1]})` : 'N/A';
                        })()
                      }>
                        {(() => {
                          const prodCounts = {};
                          salesHistory.forEach(inv => {
                            inv.items?.forEach(it => {
                              prodCounts[it.name] = (prodCounts[it.name] || 0) + Number(it.qty || 0);
                            });
                          });
                          const top = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0];
                          return top ? `${top[0]} (${top[1]})` : 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div className="card" style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' }}>
                    📊 Monthly Purchasing Trend
                  </h4>
                  
                  {(() => {
                    const monthlyRevenue = {};
                    salesHistory.forEach(inv => {
                      if (inv.status !== 'Cancelled') {
                        const m = new Date(inv.date).toLocaleString('default', { month: 'short', year: '2-digit' });
                        monthlyRevenue[m] = (monthlyRevenue[m] || 0) + Number(inv.grandTotal || 0);
                      }
                    });
                    const trendData = Object.entries(monthlyRevenue).map(([name, val]) => ({ name, Revenue: val })).reverse();
                    
                    if (trendData.length === 0) {
                      return <p style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '0.5rem' }}>No purchase trend data available.</p>;
                    }

                    return (
                      <ResponsiveContainer width="100%" height={140}>
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                          <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} contentStyle={{ borderRadius: '6px', fontSize: '10px' }} />
                          <Area type="monotone" dataKey="Revenue" stroke="var(--brand-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                {/* Chronological Timeline feed */}
                <div className="card" style={{ padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' }}>
                    📌 Audit Timeline Activity
                  </h4>
                  
                  <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {(() => {
                      const timelineEvents = buildTimeline();
                      if (timelineEvents.length === 0) {
                        return <p style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '0.5rem' }}>No activities recorded.</p>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid #e2e8f0', marginLeft: '0.4rem', marginTop: '0.25rem' }}>
                          {timelineEvents.slice(0, 10).map((ev, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                              <span style={{
                                position: 'absolute',
                                left: '-23px',
                                top: '0px',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                padding: '1px',
                                fontSize: '0.75rem',
                                border: '1px solid #e2e8f0',
                                width: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {ev.icon}
                              </span>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  <strong style={{ fontSize: '0.75rem', color: '#1e293b' }}>{ev.title}</strong>
                                  <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                                    {new Date(ev.date).toLocaleDateString()}
                                  </span>
                                </div>
                                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.25 }}>{ev.details}</p>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--brand-primary)', display: 'inline-block', marginTop: '0.1rem' }}>
                                  👤 {ev.user}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Analytics Dashboard</h3>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Select an account directory entry to render trade Intelligence metrics, revenue trends, and timeline flows.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Customer profile modal */}
      {modal && (
        <Modal
          title={modal === 'edit' ? 'Update CRM Customer Account' : 'Add New CRM Customer Account'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveCustomerProfile}>Save Details</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {form.customerCode ? (
              <div style={{ backgroundColor: '#fffbeb', padding: '0.65rem', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '0.8rem' }}>
                <strong style={{ color: '#b45309', fontFamily: 'monospace', fontSize: '0.9rem' }}>Unique Customer ID: {form.customerCode}</strong>
                <div style={{ color: '#78350f', marginTop: '0.15rem' }}>
                  Zone: {form.territory || 'N/A'} ({form.routeZone || 'N/A'}) | Salesman: {form.salesman?.name || 'Field Salesman'}
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#f0fdf4', padding: '0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.8rem', color: '#166534' }}>
                ℹ️ Unique Customer ID, Territory, and Salesman will be automatically allocated on save based on address geocoding or selected Territory.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Customer Name *</label>
                <input className="form-control" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Business Name</label>
                <input className="form-control" value={form.businessName || ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Customer Type</label>
                <select className="form-control" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                  {customerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Territory (Auto Detect / Override)</label>
                <select className="form-control" value={form.territory || ''} onChange={(e) => setForm({ ...form, territory: e.target.value })}>
                  <option value="">-- Auto-Detect --</option>
                  <option value="Madurai North">Madurai North</option>
                  <option value="Madurai South">Madurai South</option>
                  <option value="Trichy Central">Trichy Central</option>
                  <option value="Chennai Central">Chennai Central</option>
                  <option value="Coimbatore East">Coimbatore East</option>
                  <option value="Kumbakonam Central">Kumbakonam Central</option>
                  <option value="Perambalur Central">Perambalur Central</option>
                  <option value="Thirunelveli Central">Thirunelveli Central</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0.5rem 0 0 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.25rem' }}>Contact & Address</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Contact Person</label>
                <input className="form-control" value={form.contactPerson || ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input className="form-control" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input className="form-control" value={form.gstNumber || ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Billing Address</label>
                <input className="form-control" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input className="form-control" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input className="form-control" value={form.pincode || ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0.5rem 0 0 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.25rem' }}>Financial Dues parameters</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Credit Limit (Rs.)</label>
                <input type="number" className="form-control" value={form.creditLimit || 0} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Payment Cycle</label>
                <select className="form-control" value={form.paymentCycle || 'Bill to Bill'} onChange={(e) => handlePaymentCycleChange(e.target.value)}>
                  <option value="Cash & Carry">Cash & Carry</option>
                  <option value="Advance Payment">Advance Payment</option>
                  <option value="Bill to Bill">Bill to Bill</option>
                  <option value="7 Days Credit">7 Days Credit</option>
                  <option value="15 Days Credit">15 Days Credit</option>
                  <option value="30 Days Credit">30 Days Credit</option>
                  <option value="45 Days Credit">45 Days Credit</option>
                  <option value="Custom Credit">Custom Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label>Credit Days</label>
                <input type="number" className="form-control" value={form.creditDays || 0} onChange={(e) => setForm({ ...form, creditDays: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Custom pricing override block */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0.5rem 0 0 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.25rem' }}>🏷️ Customized Products Price Matrices</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Product</label>
                <select className="form-control" id="form-override-product" defaultValue="">
                  <option value="">-- Choose Product --</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Price Override (₹)</label>
                <input type="number" className="form-control" id="form-override-price" placeholder="e.g. 150" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Discount Override (%)</label>
                <input type="number" className="form-control" id="form-override-discount" placeholder="e.g. 5" />
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const pEl = document.getElementById('form-override-product');
                  const prEl = document.getElementById('form-override-price');
                  const discEl = document.getElementById('form-override-discount');
                  if (!pEl || !pEl.value) return alert('Select product first');

                  const updated = { ...(form.specialPricing || {}) };
                  updated[pEl.value] = {
                    price: prEl && prEl.value ? Number(prEl.value) : undefined,
                    discount: discEl && discEl.value ? Number(discEl.value) : undefined,
                    scheme: 'None'
                  };
                  setForm({ ...form, specialPricing: updated });
                  pEl.value = '';
                  if (prEl) prEl.value = '';
                  if (discEl) discEl.value = '';
                }}
              >
                Apply
              </button>
            </div>

            {/* Price list grid */}
            <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr><th>Product</th><th>Custom Price</th><th>Custom Discount</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {Object.entries(form.specialPricing || {}).map(([prodId, details]) => {
                    const prod = allProducts.find(p => String(p.id) === String(prodId));
                    if (!prod) return null;
                    return (
                      <tr key={prodId}>
                        <td>{prod.name}</td>
                        <td>{details.price ? `₹${details.price}` : '-'}</td>
                        <td>{details.discount ? `${details.discount}%` : '-'}</td>
                        <td>
                          <button 
                            type="button" 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '0rem 0.25rem', fontSize: '0.7rem' }}
                            onClick={() => {
                              const updated = { ...(form.specialPricing || {}) };
                              delete updated[prodId];
                              setForm({ ...form, specialPricing: updated });
                            }}
                          >
                            Del
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </Modal>
      )}

      {/* Dependency Modal */}
      {dependencyModalData && (
        <Modal
          title="Cannot Delete Active Customer Account"
          onClose={() => setDependencyModalData(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDependencyModalData(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const id = dependencyModalData.customerId;
                  setDependencyModalData(null);
                  handleArchiveCustomer(id);
                }}
              >
                Archive Customer
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
              Never permanently delete active customers. This customer is linked to existing records:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>📄 <strong>Invoices:</strong> {dependencyModalData.counts.invoices}</div>
              <div>📦 <strong>Orders:</strong> {dependencyModalData.counts.orders}</div>
              <div>💳 <strong>Payments:</strong> {dependencyModalData.counts.payments}</div>
              <div>🚚 <strong>Shipments:</strong> {dependencyModalData.counts.shipments}</div>
              <div>📝 <strong>CRM Notes:</strong> {dependencyModalData.counts.notes}</div>
              <div>💬 <strong>Follow Ups:</strong> {dependencyModalData.counts.followUps}</div>
            </div>
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #ef4444', fontSize: '0.9rem', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Total Outstanding balance:</strong>
              <strong style={{ fontSize: '1.05rem' }}>₹{dependencyModalData.outstanding.toLocaleString('en-IN')}</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              Archiving will remove this customer from active operations (such as sales billing, order capturing, and directories) but preserves all transactional history for financial audit and compliance reports.
            </p>
          </div>
        </Modal>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <Modal
          title="Archive Customer?"
          onClose={() => setShowArchiveConfirm(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowArchiveConfirm(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={submitArchiveCustomer}>Archive</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
            <p style={{ fontWeight: 650, color: '#334155', fontSize: '0.95rem' }}>
              Are you sure you want to archive this customer?
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              This customer will be removed from active operations (sales dropdowns, new invoices, and order noting directories), but all historical transactions will remain available.
            </p>
          </div>
        </Modal>
      )}

      {/* WhatsApp Pre-flight Validation Error Modal */}
      {whatsappErrorModal && (
        <Modal
          title={whatsappErrorModal.title}
          onClose={() => setWhatsappErrorModal(null)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setWhatsappErrorModal(null)}>Close</button>
              {whatsappErrorModal.canEdit && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEditCustomerFromWaModal}
                >
                  Edit Customer
                </button>
              )}
            </div>
          }
        >
          <div style={{ padding: '0.5rem' }}>
            <p style={{ fontWeight: 650, color: '#ef4444', fontSize: '0.95rem' }}>
              {whatsappErrorModal.reason}
            </p>
          </div>
        </Modal>
      )}

      {/* Branded Reminder Generator Modal */}
      {reminderModalInvoice && (
        <PaymentReminderGenerator
          invoice={reminderModalInvoice}
          customer={selectedCustomer}
          settings={settings}
          onClose={() => setReminderModalInvoice(null)}
        />
      )}

      {/* WhatsApp Statement/Ledger Reminder Modal */}
      {remModalOpen && (
        <Modal
          title="💬 Send Account Reminder Statement"
          onClose={() => setRemModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setRemModalOpen(false)} disabled={remSending}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-success" 
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff', minWidth: '120px', fontWeight: 650 }}
                onClick={handleSendReminderWhatsApp} 
                disabled={remSending}
              >
                {remSending ? 'Sending...' : 'Send WhatsApp'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Recipient Phone Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={remPhone} 
                onChange={(e) => setRemPhone(e.target.value)}
                placeholder="e.g. +919876543210"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Attachment Document Type</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="radio" 
                    name="remDocType" 
                    value="statement" 
                    checked={remDocType === 'statement'} 
                    onChange={() => handleRemDocTypeChange('statement')} 
                  />
                  <span>Outstanding Statement PDF</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="radio" 
                    name="remDocType" 
                    value="ledger" 
                    checked={remDocType === 'ledger'} 
                    onChange={() => handleRemDocTypeChange('ledger')} 
                  />
                  <span>Running Account Ledger PDF</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>WhatsApp Message Text</label>
              <textarea 
                className="form-control" 
                rows="5"
                value={remMessage} 
                onChange={(e) => setRemMessage(e.target.value)}
                required
              />
            </div>
          </div>
        </Modal>
      )}

      {/* WhatsApp Product Catalog Modal */}
      {catalogModalOpen && (
        <Modal
          title="📖 Share Product Catalog via WhatsApp"
          onClose={() => setCatalogModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCatalogModalOpen(false)} disabled={catalogSending}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSendCatalogWhatsApp} 
                disabled={catalogSending}
              >
                {catalogSending ? 'Sending...' : 'Send Catalog'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Recipient Phone Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={catalogPhone} 
                onChange={(e) => setCatalogPhone(e.target.value)}
                placeholder="e.g. 917010602115"
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Catalog Format</label>
              <select 
                className="form-control" 
                value={catalogFormat} 
                onChange={(e) => setCatalogFormat(e.target.value)}
              >
                <option value="pdf">Full PDF Catalog Document</option>
                <option value="image">Single Product Image Poster Link</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Pricing Tier</label>
              <select 
                className="form-control" 
                value={catalogPricingType} 
                onChange={(e) => setCatalogPricingType(e.target.value)}
              >
                <option value="retail">Retail Pricing</option>
                <option value="distributor">Distributor Pricing</option>
                <option value="super_stockist">Stockist Pricing</option>
                <option value="hide">Hide Prices</option>
              </select>
            </div>

            {catalogFormat === 'pdf' ? (
              <div className="form-group">
                <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Product Category Filter</label>
                <select 
                  className="form-control" 
                  value={catalogCategory} 
                  onChange={(e) => setCatalogCategory(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {catalogCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label style={{ fontWeight: 650, fontSize: '0.85rem' }}>Select Product *</label>
                <select 
                  className="form-control" 
                  value={catalogProductId} 
                  onChange={(e) => setCatalogProductId(e.target.value)}
                  required
                >
                  <option value="">-- Select Product --</option>
                  {allProducts.filter(p => !p.isArchived).map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Modal>
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
