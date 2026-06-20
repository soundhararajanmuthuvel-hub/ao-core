import { useState, useEffect, useRef } from 'react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

export default function PaymentReminderGenerator({ invoice, customer, settings, onClose }) {
  const { toast } = useToast();
  const [template, setTemplate] = useState('gold'); // 'classic', 'gold', 'green', 'dark'
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Generating Reminder...');
  const [imgUrl, setImgUrl] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [qrBase64, setQrBase64] = useState(null);
  
  const templateRef = useRef(null);
  const isMobileViewport = window.innerWidth < 768;

  // Constants
  const balance = Number(invoice.grandTotal || 0) - Number(invoice.amountPaid || 0);
  const invoiceDate = new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDate = invoice.dueDate 
    ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : invoiceDate;

  // Calculate Overdue Days
  const getDaysOverdue = () => {
    if (!invoice.dueDate) return 0;
    const due = new Date(invoice.dueDate);
    due.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = today - due;
    return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
  };
  const daysOverdue = getDaysOverdue();

  // Contact details validation and formatting helpers
  const isValidValue = (val) => {
    if (val === null || val === undefined) return false;
    const s = String(val).trim();
    if (s === '' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'na' || s === '-') return false;
    return true;
  };

  const hasPhone = isValidValue(settings?.phone);
  const hasEmail = isValidValue(settings?.email);
  const hasGst = isValidValue(settings?.gstNumber) || isValidValue(settings?.gstin);
  const hasWebsite = isValidValue(settings?.website);
  const validFieldsCount = [hasPhone, hasEmail, hasGst, hasWebsite].filter(Boolean).length;

  // Loading text cycling effect
  useEffect(() => {
    if (!loading) return;
    const texts = [
      "Generating Reminder...",
      "Preparing branded payment image...",
      "Almost Ready..."
    ];
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % texts.length;
      setLoadingText(texts[idx]);
    }, 900);
    return () => clearInterval(timer);
  }, [loading]);

  // Convert image URL to Base64 to bypass CORS in html2canvas
  const getBase64Image = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error('Failed to convert image to base64:', url, err);
      return url; // fallback to original
    }
  };

  // Preload and convert assets to base64
  useEffect(() => {
    const preloadAssets = async () => {
      // 1. Logo
      const logoUrl = getActiveLogoUrl(settings);
      const logoB64 = await getBase64Image(logoUrl);
      setLogoBase64(logoB64);

      // 2. QR Code (UPI Payment URL)
      const payeeName = settings?.payeeName || "AMUDHASURABIY ORGANICS";
      const upiId = settings?.upiId || "7010602115@iob";
      const qrData = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${balance}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`;
      const qrB64 = await getBase64Image(qrApiUrl);
      setQrBase64(qrB64);
    };
    
    preloadAssets();
  }, [invoice, customer, settings, balance]);

  // Capture offscreen HTML template and convert to Image URL
  const generateImage = async () => {
    if (!logoBase64 || !qrBase64) return;
    setLoading(true);
    // Let DOM update and render base64 images
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const canvas = await html2canvas(templateRef.current, {
        useCORS: true,
        allowTaint: false,
        width: 1080,
        height: 1350,
        scale: isMobileViewport ? 1 : 2, // Avoid rendering desktop dimensions on mobile
        logging: false
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setImgUrl(dataUrl);
      setLoading(false);
    } catch (err) {
      console.error('Image capture failed:', err);
      toast('Failed to capture reminder image', 'error');
      setLoading(false);
    }
  };

  // Re-generate image when template or assets change
  useEffect(() => {
    if (logoBase64 && qrBase64) {
      generateImage();
    }
  }, [template, logoBase64, qrBase64]);

  // Download JPG
  const downloadJpg = () => {
    if (!imgUrl) return;
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `Reminder-${invoice.invoiceNumber}.jpg`;
    link.click();
    toast('Branded payment reminder JPG downloaded', 'success');
  };

  // Download PDF
  const downloadPdf = () => {
    if (!imgUrl) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [1080, 1350]
    });
    doc.addImage(imgUrl, 'JPEG', 0, 0, 1080, 1350);
    doc.save(`Reminder-${invoice.invoiceNumber}.pdf`);
    toast('Reminder PDF downloaded successfully', 'success');
  };

  // Send via WhatsApp
  const sendWhatsApp = () => {
    // 1. Download JPG first so they can paste it
    downloadJpg();

    // 2. Open WhatsApp reminder text
    const textMsg = `Dear ${customer.name},\n\nKindly find the payment reminder attached.\n\nThank you,\nAmudhasurabiy Organics`;
    let rawPhone = customer.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`;
    window.open(whatsappUrl, '_blank');
    toast('WhatsApp reminder link opened in new tab. Attach the downloaded image.', 'success');
  };

  // Styles configuration based on template choice
  const getTemplateStyles = () => {
    switch (template) {
      case 'classic':
        return {
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          cardBg: '#ffffff',
          textColor: '#1e293b',
          lightTextColor: '#64748b',
          accentColor: '#3b82f6',
          titleColor: '#1e293b',
          badgeBg: '#eff6ff',
          badgeText: '#1e40af',
          footerText: '#94a3b8',
          borderStyle: '1px solid #e2e8f0',
          shadow: '0 4px 20px rgba(0,0,0,0.08)',
          logoBorder: '2px solid rgba(15, 23, 42, 0.1)'
        };
      case 'green':
        return {
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          cardBg: '#ffffff',
          textColor: '#064e3b',
          lightTextColor: '#64748b',
          accentColor: '#10b981',
          titleColor: '#064e3b',
          badgeBg: '#ecfdf5',
          badgeText: '#047857',
          footerText: '#a7f3d0',
          borderStyle: '1px solid #ccfbf1',
          shadow: '0 4px 25px rgba(4, 120, 87, 0.08)',
          logoBorder: '2px solid rgba(6, 78, 59, 0.15)'
        };
      case 'dark':
        return {
          background: 'linear-gradient(135deg, #090d16 0%, #020408 100%)',
          cardBg: 'rgba(30, 41, 59, 0.55)',
          backdropFilter: 'blur(12px)',
          textColor: '#f8fafc',
          lightTextColor: '#94a3b8',
          accentColor: '#f59e0b',
          titleColor: '#f59e0b',
          badgeBg: 'rgba(245, 158, 11, 0.12)',
          badgeText: '#fbbf24',
          footerText: '#cbd5e1',
          borderStyle: '1px solid rgba(255, 255, 255, 0.08)',
          shadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(245, 158, 11, 0.05)',
          logoBorder: '2px solid rgba(245, 158, 11, 0.3)'
        };
      case 'gold':
      default:
        return {
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          cardBg: '#ffffff',
          textColor: '#1f2937',
          lightTextColor: '#4b5563',
          accentColor: '#d97706', // gold
          titleColor: '#d97706',
          badgeBg: '#fef3c7',
          badgeText: '#b45309',
          footerText: '#cbd5e1',
          borderStyle: '2px solid #d97706',
          shadow: '0 10px 30px rgba(0, 0, 0, 0.2), 0 0 20px rgba(217, 119, 6, 0.1)',
          logoBorder: '2px solid rgba(217, 119, 6, 0.35)'
        };
    }
  };

  const currentStyles = getTemplateStyles();

  return (
    <Modal
      title="Branded Reminder Preview"
      onClose={onClose}
      className={isMobileViewport ? "preview-modal" : "modal-lg"}
      footer={
        <div style={{
          display: 'flex',
          flexDirection: isMobileViewport ? 'column' : 'row',
          justifyContent: 'space-between',
          width: '100%',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {/* Template Switches */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: isMobileViewport ? '100%' : 'auto'
          }}>
            {[
              { id: 'classic', label: isMobileViewport ? 'Classic' : 'Classic Corporate' },
              { id: 'gold', label: isMobileViewport ? 'Gold' : 'Premium Gold' },
              { id: 'green', label: isMobileViewport ? 'Green' : 'Organic Green' },
              { id: 'dark', label: isMobileViewport ? 'Dark' : 'Luxury Dark' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn btn-sm ${template === t.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTemplate(t.id)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          
          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            width: isMobileViewport ? '100%' : 'auto',
            justifyContent: 'center',
            flexDirection: isMobileViewport ? 'column' : 'row'
          }}>
            <button type="button" className="btn btn-secondary" style={{ width: isMobileViewport ? '100%' : 'auto' }} onClick={onClose}>Cancel</button>
            <div style={{ display: 'flex', gap: '0.5rem', width: isMobileViewport ? '100%' : 'auto', flex: isMobileViewport ? 1 : 'none' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadJpg} disabled={loading}>JPG</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadPdf} disabled={loading}>PDF</button>
            </div>
            <button type="button" className="btn btn-whatsapp" style={{ width: isMobileViewport ? '100%' : 'auto' }} onClick={sendWhatsApp} disabled={loading}>
              💬 Send WhatsApp
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', minHeight: '450px', justifyContent: 'center', position: 'relative' }}>
        
        {/* Loading overlay overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                borderRadius: '12px'
              }}
            >
              {/* Spinning White Logo Badges */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '90px',
                  height: '90px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(245, 158, 11, 0.35)',
                  boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
                  marginBottom: '1.5rem'
                }}
              >
                <img
                  src={logoBase64 || '/favicon.png'}
                  alt="Loading..."
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </motion.div>
              
              <h4 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                {loadingText}
              </h4>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Amudhasurabiy Organics reminder generator
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Image Preview viewport */}
        {imgUrl && (
          <div style={{ 
            width: '100%', 
            maxWidth: '400px', 
            borderRadius: '16px', 
            overflow: 'hidden', 
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35), 0 0 30px rgba(245,158,11,0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#000'
          }}>
            <img src={imgUrl} alt="Reminder Preview" style={{ width: '100%', display: 'block', height: 'auto' }} />
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* OFF-SCREEN DOM CONTAINER USED BY HTML2CANVAS */}
        {/* Render at exact 1080 x 1350 pixels for crisp output */}
        {/* ---------------------------------------------------- */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1080px', height: '1350px', overflow: 'hidden' }}>
          <div
            ref={templateRef}
            style={{
              width: '1080px',
              height: '1350px',
              padding: '65px 75px',
              boxSizing: 'border-box',
              background: currentStyles.background,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            {isMobileViewport ? (
              /* ==================================================== */
              /* MOBILE LAYOUT (SINGLE COLUMN RESPONSIVE TEMPLATE)    */
              /* ==================================================== */
              <>
                {/* Header block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                  {/* Dedicated Logo circle container badge */}
                  <div style={{
                    width: '120px',
                    height: '120px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: currentStyles.logoBorder,
                    boxShadow: '0 4px 25px rgba(0, 0, 0, 0.15)',
                    boxSizing: 'border-box',
                    margin: '0 auto'
                  }}>
                    <img
                      src={logoBase64 || '/favicon.png'}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '2.5rem', 
                    fontWeight: 900, 
                    color: '#ffffff', 
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}>
                    {settings?.companyName || 'Amudhasurabiy Organics'}
                  </h1>
                  
                  <div style={{
                    display: 'inline-block',
                    backgroundColor: currentStyles.accentColor,
                    color: '#ffffff',
                    padding: '0.45rem 2rem',
                    borderRadius: '30px',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    Payment Reminder
                  </div>
                </div>

                {/* Customer greeting */}
                <div style={{ color: '#ffffff', fontSize: '1.5rem', lineHeight: 1.5, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.85rem', fontWeight: 800 }}>Dear {customer.name},</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>
                    We hope you are doing well. This is a friendly reminder regarding the outstanding balance for the following invoice.
                  </p>
                </div>

                {/* Invoice card details (Mobile stack) */}
                <div style={{
                  backgroundColor: currentStyles.cardBg,
                  backdropFilter: currentStyles.backdropFilter || 'none',
                  padding: '2.25rem',
                  borderRadius: '24px',
                  border: currentStyles.borderStyle,
                  boxShadow: currentStyles.shadow,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  textAlign: 'center',
                  alignItems: 'center'
                }}>
                  {/* Outstanding Amount Header & Large Text */}
                  <div style={{ width: '100%' }}>
                    <span style={{ fontSize: '1.1rem', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Outstanding Amount</span>
                    <strong style={{ fontSize: '3.85rem', color: '#ef4444', fontWeight: 900, letterSpacing: '-0.02em', display: 'block' }}>
                      ₹ {balance.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  {/* Overdue Days Badge */}
                  {daysOverdue > 0 && (
                    <div style={{
                      backgroundColor: '#fee2e2',
                      border: '2px solid #ef4444',
                      color: '#b91c1c',
                      padding: '0.65rem 1.5rem',
                      borderRadius: '50px',
                      fontSize: '1.1rem',
                      fontWeight: 900,
                      letterSpacing: '0.05em',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                      textTransform: 'uppercase',
                      display: 'inline-block'
                    }}>
                      Overdue by {daysOverdue} Days
                    </div>
                  )}

                  {/* Separator line */}
                  <div style={{ width: '100%', borderTop: '1px solid rgba(0,0,0,0.08)', borderTopColor: template === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }}></div>

                  {/* Invoice details cards stacked vertically */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed rgba(0,0,0,0.05)', borderBottomColor: template === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '1.05rem', color: currentStyles.lightTextColor, fontWeight: 700 }}>Invoice Number</span>
                      <strong style={{ fontSize: '1.15rem', color: currentStyles.textColor, fontWeight: 800 }}>{invoice.invoiceNumber}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed rgba(0,0,0,0.05)', borderBottomColor: template === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '1.05rem', color: currentStyles.lightTextColor, fontWeight: 700 }}>Invoice Date</span>
                      <strong style={{ fontSize: '1.15rem', color: currentStyles.textColor, fontWeight: 800 }}>{invoiceDate}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                      <span style={{ fontSize: '1.05rem', color: currentStyles.lightTextColor, fontWeight: 700 }}>Due Date</span>
                      <strong style={{ fontSize: '1.15rem', color: currentStyles.textColor, fontWeight: 800 }}>{dueDate}</strong>
                    </div>
                  </div>
                </div>

                {/* QR Pay Section (Centered) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1.5rem', 
                  borderRadius: '24px', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ textAlign: 'center', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <strong style={{ fontSize: '1.35rem', fontWeight: 800 }}>Scan to Pay via UPI</strong>
                    <span style={{ fontSize: '1rem', color: '#cbd5e1', fontFamily: 'monospace' }}>{settings?.upiId || "7010602115@iob"}</span>
                  </div>
                  <div style={{
                    width: '140px',
                    height: '140px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                  }}>
                    <img
                      src={qrBase64 || ''}
                      alt="QR Pay Link"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.95rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Scan & Pay</span>
                </div>

                {/* Support message / Footer */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem', 
                  alignItems: 'center', 
                  borderTop: '2px solid rgba(255,255,255,0.1)',
                  paddingTop: '1.5rem',
                  width: '100%'
                }}>
                  <p style={{ color: '#cbd5e1', fontSize: '1.15rem', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                    Kindly arrange payment at your convenience. Ignore if already paid.
                  </p>
                  
                  {validFieldsCount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.5rem', 
                      color: currentStyles.footerText, 
                      fontSize: '1.15rem',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}>
                      <strong style={{ fontSize: '1.45rem', color: '#ffffff', fontWeight: 800 }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </strong>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.25rem' }}>
                        {hasPhone && <span>📞 {settings.phone}</span>}
                        {hasEmail && <span>✉️ {settings.email}</span>}
                        {hasGst && <span>📋 GSTIN: {settings.gstNumber || settings.gstin}</span>}
                        {hasWebsite && <span>🌐 {settings.website}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ==================================================== */
              /* DESKTOP LAYOUT (MULTI COLUMN CLASSIC TEMPLATE)       */
              /* ==================================================== */
              <>
                {/* Header block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  {/* Dedicated Logo circle container badge */}
                  <div style={{
                    width: '130px',
                    height: '130px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: currentStyles.logoBorder,
                    boxShadow: '0 4px 25px rgba(0, 0, 0, 0.15)',
                    boxSizing: 'border-box',
                    marginBottom: '1.25rem'
                  }}>
                    <img
                      src={logoBase64 || '/favicon.png'}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '2.45rem', 
                    fontWeight: 900, 
                    color: '#ffffff', 
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                  }}>
                    {settings?.companyName || 'Amudhasurabiy Organics'}
                  </h1>
                  
                  <div style={{
                    display: 'inline-block',
                    marginTop: '0.65rem',
                    backgroundColor: currentStyles.accentColor,
                    color: '#ffffff',
                    padding: '0.35rem 1.75rem',
                    borderRadius: '30px',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    Payment Reminder
                  </div>
                </div>

                {/* Customer greeting */}
                <div style={{ color: '#ffffff', fontSize: '1.45rem', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 800 }}>Dear {customer.name},</p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>
                    We hope you are doing well. This is a friendly reminder regarding the outstanding balance for the following invoice.
                  </p>
                </div>

                {/* Invoice card details */}
                <div style={{
                  backgroundColor: currentStyles.cardBg,
                  backdropFilter: currentStyles.backdropFilter || 'none',
                  padding: '2.5rem',
                  borderRadius: '24px',
                  border: currentStyles.borderStyle,
                  boxShadow: currentStyles.shadow,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  position: 'relative'
                }}>
                  {/* Header Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.95rem', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Invoice Number</span>
                      <strong style={{ fontSize: '1.5rem', color: currentStyles.textColor, fontWeight: 800 }}>{invoice.invoiceNumber}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.95rem', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Invoice Date</span>
                      <strong style={{ fontSize: '1.35rem', color: currentStyles.textColor, fontWeight: 700 }}>{invoiceDate}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.95rem', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>Due Date</span>
                      <strong style={{ fontSize: '1.35rem', color: currentStyles.textColor, fontWeight: 700 }}>{dueDate}</strong>
                    </div>
                  </div>

                  {/* Separator line */}
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', borderTopColor: template === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }}></div>

                  {/* Outstanding Amount Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '1.1rem', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>Outstanding Amount</span>
                      <strong style={{ fontSize: '3.65rem', color: '#ef4444', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        ₹ {balance.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    {/* Overdue Badge */}
                    {daysOverdue > 0 && (
                      <div style={{
                        backgroundColor: '#fee2e2',
                        border: '2px solid #ef4444',
                        color: '#b91c1c',
                        padding: '0.85rem 1.75rem',
                        borderRadius: '50px',
                        fontSize: '1.15rem',
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                        textTransform: 'uppercase',
                        textAlign: 'center'
                      }}>
                        Overdue by {daysOverdue} Days
                      </div>
                    )}
                  </div>
                </div>

                {/* Support Message */}
                <div style={{ color: '#e2e8f0', fontSize: '1.25rem', lineHeight: 1.6, textAlign: 'center', margin: '0.5rem 0' }}>
                  We kindly request you to arrange payment at your earliest convenience.<br/>
                  If payment has already been made, please ignore this reminder. Thank you for your support.
                </div>

                {/* Footer row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '2px solid rgba(255,255,255,0.1)',
                  paddingTop: '2rem'
                }}>
                  {/* Left Column: Contact details */}
                  {validFieldsCount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.65rem', 
                      color: currentStyles.footerText, 
                      fontSize: '1.15rem',
                      alignItems: (hasPhone && validFieldsCount === 1) ? 'center' : 'flex-start',
                      textAlign: (hasPhone && validFieldsCount === 1) ? 'center' : 'left'
                    }}>
                      <strong style={{ fontSize: '1.5rem', color: '#ffffff', fontWeight: 800 }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </strong>
                      {hasPhone && <span>📞 Phone: {settings.phone}</span>}
                      {hasEmail && <span>✉️ Email: {settings.email}</span>}
                      {hasGst && <span>📋 GSTIN: {settings.gstNumber || settings.gstin}</span>}
                      {hasWebsite && <span>🌐 Website: {settings.website}</span>}
                    </div>
                  )}

                  {/* Right Column: QR Pay Code */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '1.25rem 1.75rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', textAlign: 'right', color: '#ffffff' }}>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 800 }}>Scan to Pay via UPI</strong>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: 'monospace' }}>{settings?.upiId || "7010602115@iob"}</span>
                    </div>
                    <div style={{
                      width: '125px',
                      height: '125px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                      justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                    }}>
                      <img
                        src={qrBase64 || ''}
                        alt="QR Pay Link"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
