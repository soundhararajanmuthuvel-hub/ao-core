import { useState, useEffect, useRef } from 'react';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveAssetUrl } from '../utils/url';
import { useCompanyBrand } from '../context/CompanyBrandContext';
import client from '../api/client';
import Modal from './Modal';
import { useToast } from '../context/ToastContext';

export default function PaymentReminderGenerator({ invoice, customer, settings, onClose }) {
  const { toast } = useToast();
  const { logoUrl: brandLogoUrl } = useCompanyBrand();
  const [template, setTemplate] = useState('gold'); // 'classic', 'gold', 'green', 'dark'
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Generating Reminder...');
  const [imgUrl, setImgUrl] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);
  const [qrBase64, setQrBase64] = useState(null);
  
  const templateRef = useRef(null);
  const isMobileViewport = window.innerWidth < 768;
  const [exportSize, setExportSize] = useState('1080x1350'); // '1080x1080', '1080x1350', '1080x1920'
  const isSquare = exportSize === '1080x1080';
  
  const getExportDimensions = () => {
    switch (exportSize) {
      case '1080x1080':
        return { width: 1080, height: 1080 };
      case '1080x1920':
        return { width: 1080, height: 1920 };
      case '1080x1350':
      default:
        return { width: 1080, height: 1350 };
    }
  };
  const { width: exportWidth, height: exportHeight } = getExportDimensions();

  // Constants
  const balance = Number(invoice?.grandTotal || 0) - Number(invoice?.amountPaid || 0);
  const invoiceDate = invoice?.date 
    ? new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const dueDate = invoice?.dueDate 
    ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : invoiceDate;

  // Calculate Overdue Days
  const getDaysOverdue = () => {
    if (!invoice?.dueDate) return 0;
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
      const response = await client.get(url, { responseType: 'blob' });
      const blob = response.data;
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
      const logoUrl = brandLogoUrl;
      const logoB64 = await getBase64Image(logoUrl);
      setLogoBase64(logoB64);

      // 2. QR Code (UPI Payment URL)
      const payeeName = settings?.payeeName || "AMUDHASURABIY ORGANICS";
      const upiId = settings?.upiId || "7010602115@iob";
      const qrData = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${balance}&cu=INR&tn=Invoice%20${invoice?.invoiceNumber || ''}`;
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
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
        scale: 1, // Fix memory, high-DPI scaling, and clipping issues on mobile viewports
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        logging: false,
        onclone: (clonedDoc) => {
          // Force cloned document and body layout width to the exact target size to prevent responsive scaling clipping!
          clonedDoc.documentElement.style.width = `${exportWidth}px`;
          clonedDoc.documentElement.style.height = `${exportHeight}px`;
          clonedDoc.body.style.width = `${exportWidth}px`;
          clonedDoc.body.style.height = `${exportHeight}px`;
          clonedDoc.body.style.minWidth = `${exportWidth}px`;
          clonedDoc.body.style.overflow = 'hidden';
          
          // Locate the cloned template element
          const clonedTemplate = clonedDoc.getElementById('payment-reminder-template');
          if (clonedTemplate) {
            clonedTemplate.style.width = `${exportWidth}px`;
            clonedTemplate.style.height = `${exportHeight}px`;
            clonedTemplate.style.position = 'static';
            clonedTemplate.style.transform = 'none';
          }
        }
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
  }, [template, exportSize, logoBase64, qrBase64]);

  // Download JPG
  const downloadJpg = () => {
    if (!imgUrl) return;
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `Reminder-${invoice?.invoiceNumber || 'Reminder'}.jpg`;
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
    doc.save(`Reminder-${invoice?.invoiceNumber || 'Reminder'}.pdf`);
    toast('Reminder PDF downloaded successfully', 'success');
  };

  // Send via WhatsApp or Share natively
  const handleWhatsAppOrShare = async () => {
    if (!imgUrl) return;

    // Try Web Share API first (highly optimized for mobile sharing of files)
    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        const file = new File([blob], `Reminder-${invoice?.invoiceNumber || 'Reminder'}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Payment Reminder - ${invoice?.invoiceNumber || ''}`,
            text: `Dear ${customer?.name || 'Customer'},\n\nKindly find the payment reminder attached.\n\nThank you,\nAmudhasurabiy Organics`
          });
          toast('Shared successfully', 'success');
          return;
        }
      } catch (err) {
        console.error('Native sharing failed, falling back to WhatsApp link:', err);
      }
    }

    // Fallback to standard WhatsApp wa.me redirect
    const textMsg = `Dear ${customer?.name || 'Customer'},\n\nKindly find the payment reminder attached.\n\nThank you,\nAmudhasurabiy Organics`;
    let rawPhone = customer?.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`;
    
    // On mobile, avoid triggering multiple actions (download + redirect) in one click handler
    // to prevent browser security popup blockers from stopping the redirect.
    if (!isMobileViewport) {
      downloadJpg();
    }

    window.open(whatsappUrl, '_blank');
    toast('WhatsApp link opened. Attach the downloaded image.', 'success');
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
      className="preview-modal"
      footer={
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '100%',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {/* Export Size Selector */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            flexWrap: isMobileViewport ? 'nowrap' : 'wrap',
            overflowX: isMobileViewport ? 'auto' : 'visible',
            paddingBottom: isMobileViewport ? '6px' : '0',
            WebkitOverflowScrolling: 'touch',
            justifyContent: isMobileViewport ? 'flex-start' : 'center',
            width: '100%'
          }}>
            {[
              { id: '1080x1080', label: 'Square (1080x1080)' },
              { id: '1080x1350', label: 'Portrait (1080x1350)' },
              { id: '1080x1920', label: 'Story (1080x1920)' }
            ].map((sz) => (
              <button
                key={sz.id}
                type="button"
                className={`btn btn-sm template-btn ${exportSize === sz.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setExportSize(sz.id)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              >
                {sz.label}
              </button>
            ))}
          </div>

          {/* Template Switches */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            flexWrap: isMobileViewport ? 'nowrap' : 'wrap',
            overflowX: isMobileViewport ? 'auto' : 'visible',
            paddingBottom: isMobileViewport ? '6px' : '0',
            WebkitOverflowScrolling: 'touch',
            justifyContent: isMobileViewport ? 'flex-start' : 'center',
            width: '100%'
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
                className={`btn btn-sm template-btn ${template === t.id ? 'btn-primary' : 'btn-secondary'}`}
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
            width: '100%',
            justifyContent: 'center',
            flexDirection: isMobileViewport ? 'column' : 'row',
            marginTop: '0.5rem'
          }}>
            <button type="button" className="btn btn-secondary" style={{ width: isMobileViewport ? '100%' : 'auto' }} onClick={onClose}>Cancel</button>
            <div style={{ display: 'flex', gap: '0.5rem', width: isMobileViewport ? '100%' : 'auto', flex: isMobileViewport ? 1 : 'none' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadJpg} disabled={loading}>JPG</button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={downloadPdf} disabled={loading}>PDF</button>
            </div>
            <button type="button" className="btn btn-whatsapp" style={{ width: isMobileViewport ? '100%' : 'auto' }} onClick={handleWhatsAppOrShare} disabled={loading}>
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
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: `${exportWidth}px`, 
          height: `${exportHeight}px`, 
          overflow: 'hidden', 
          zIndex: -9999, 
          opacity: 0, 
          pointerEvents: 'none' 
        }}>
          <div
            ref={templateRef}
            id="payment-reminder-template"
            style={{
              width: `${exportWidth}px`,
              height: `${exportHeight}px`,
              padding: exportSize === '1080x1920' ? '90px 75px' : '55px 65px',
              boxSizing: 'border-box',
              background: currentStyles.background,
              fontFamily: "'Outfit', 'Inter', sans-serif",
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            {exportSize === '1080x1920' ? (
              /* ==================================================== */
              /* STORY LAYOUT (9:16 - TALL PORTRAIT FOR STATUS/STORY)  */
              /* ==================================================== */
              <>
                {/* Header block */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
                  {/* Logo Container */}
                  <div style={{
                    width: '150px',
                    height: '150px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: currentStyles.logoBorder,
                    boxShadow: '0 4px 25px rgba(0, 0, 0, 0.15)',
                    boxSizing: 'border-box'
                  }}>
                    <img
                      src={logoBase64 || '/favicon.png'}
                      alt="Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '38px', 
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
                    padding: '10px 40px',
                    borderRadius: '30px',
                    fontSize: '22px',
                    fontWeight: 800,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    Payment Reminder
                  </div>
                </div>

                {/* Customer greeting */}
                <div style={{ color: '#ffffff', textAlign: 'center', padding: '0 20px' }}>
                  <p className="customer-name" style={{ margin: '0 0 15px 0', fontSize: '42px', fontWeight: 800, wordBreak: 'break-word', lineHeight: 1.3 }}>
                    Dear {customer?.name || 'Customer'},
                  </p>
                  <p style={{ margin: 0, color: '#cbd5e1', fontSize: '24px', lineHeight: 1.5 }}>
                    We hope you are doing well. This is a friendly reminder regarding the outstanding balance for the following invoice.
                  </p>
                </div>

                {/* Invoice card details (Mobile stack) */}
                <div className="amount-card" style={{
                  backgroundColor: currentStyles.cardBg,
                  backdropFilter: currentStyles.backdropFilter || 'none',
                  padding: '45px',
                  borderRadius: '24px',
                  border: currentStyles.borderStyle,
                  boxShadow: currentStyles.shadow,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '25px',
                  textAlign: 'center',
                  alignItems: 'center',
                  width: '880px',
                  margin: '0 auto'
                }}>
                  {/* Outstanding Amount Header & Large Text */}
                  <div style={{ width: '100%' }}>
                    <span style={{ fontSize: '20px', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Outstanding Amount</span>
                    <strong style={{ fontSize: '80px', color: '#ef4444', fontWeight: 900, letterSpacing: '-0.02em', display: 'block' }}>
                      ₹ {balance.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  {/* Overdue Days Badge */}
                  {daysOverdue > 0 && (
                    <div style={{
                      backgroundColor: '#fee2e2',
                      border: '3px solid #ef4444',
                      color: '#b91c1c',
                      padding: '12px 30px',
                      borderRadius: '50px',
                      fontSize: '22px',
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed rgba(0,0,0,0.05)', borderBottomColor: template === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '22px', color: currentStyles.lightTextColor, fontWeight: 700 }}>Invoice Number</span>
                      <strong style={{ fontSize: '24px', color: currentStyles.textColor, fontWeight: 800 }}>{invoice?.invoiceNumber || ''}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed rgba(0,0,0,0.05)', borderBottomColor: template === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: '22px', color: currentStyles.lightTextColor, fontWeight: 700 }}>Invoice Date</span>
                      <strong style={{ fontSize: '24px', color: currentStyles.textColor, fontWeight: 800 }}>{invoiceDate}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                      <span style={{ fontSize: '22px', color: currentStyles.lightTextColor, fontWeight: 700 }}>Due Date</span>
                      <strong style={{ fontSize: '24px', color: currentStyles.textColor, fontWeight: 800 }}>{dueDate}</strong>
                    </div>
                  </div>
                </div>

                {/* QR Pay Section (Centered) */}
                <div className="qr-section" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '15px', 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                  padding: '30px', 
                  borderRadius: '24px', 
                  border: '1px solid rgba(255,255,255,0.08)',
                  width: '880px',
                  margin: '0 auto',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ textAlign: 'center', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <strong style={{ fontSize: '26px', fontWeight: 800 }}>Scan to Pay via UPI</strong>
                    <span style={{ fontSize: '20px', color: '#cbd5e1', fontFamily: 'monospace' }}>{settings?.upiId || "7010602115@iob"}</span>
                  </div>
                  <div style={{
                    width: '180px',
                    height: '180px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '12px',
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
                  <span style={{ fontSize: '18px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Scan & Pay</span>
                </div>

                {/* Support message / Footer */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '15px', 
                  alignItems: 'center', 
                  borderTop: '2px solid rgba(255,255,255,0.1)',
                  paddingTop: '25px',
                  width: '100%'
                }}>
                  <p style={{ color: '#cbd5e1', fontSize: '22px', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                    Kindly arrange payment at your convenience. Ignore if already paid.
                  </p>
                  
                  {validFieldsCount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      color: currentStyles.footerText, 
                      fontSize: '20px',
                      alignItems: 'center',
                      textAlign: 'center'
                    }}>
                      <strong style={{ fontSize: '26px', color: '#ffffff', fontWeight: 800 }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </strong>
                      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '5px' }}>
                        {hasPhone && <span>📞 {settings?.phone}</span>}
                        {hasEmail && <span>✉️ {settings?.email}</span>}
                        {hasGst && <span>📋 GSTIN: {settings?.gstNumber || settings?.gstin}</span>}
                        {hasWebsite && <span>🌐 {settings?.website}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ==================================================== */
              /* SQUARE / PORTRAIT COMPACT GRID LAYOUT                */
              /* ==================================================== */
              <>
                {/* Header block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{
                      width: '100px',
                      height: '100px',
                      backgroundColor: '#ffffff',
                      borderRadius: '50%',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: currentStyles.logoBorder,
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                      boxSizing: 'border-box'
                    }}>
                      <img
                        src={logoBase64 || '/favicon.png'}
                        alt="Logo"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <h1 style={{ 
                      margin: 0, 
                      fontSize: '32px', 
                      fontWeight: 900, 
                      color: '#ffffff', 
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase'
                    }}>
                      {settings?.companyName || 'Amudhasurabiy Organics'}
                    </h1>
                  </div>

                  <div style={{
                    backgroundColor: currentStyles.accentColor,
                    color: '#ffffff',
                    padding: '8px 25px',
                    borderRadius: '30px',
                    fontSize: '18px',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    Payment Reminder
                  </div>
                </div>

                {/* Customer greeting */}
                <div style={{ color: '#ffffff', fontSize: '24px', lineHeight: 1.5 }}>
                  <p className="customer-name" style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: 800, wordBreak: 'break-word', textAlign: 'left' }}>
                    Dear {customer?.name || 'Customer'},
                  </p>
                  <p style={{ margin: 0, color: '#e2e8f0' }}>
                    We hope you are doing well. This is a friendly reminder regarding the outstanding balance for the following invoice.
                  </p>
                </div>

                {/* Invoice card details */}
                <div className="amount-card" style={{
                  backgroundColor: currentStyles.cardBg,
                  backdropFilter: currentStyles.backdropFilter || 'none',
                  padding: isSquare ? '25px' : '40px',
                  borderRadius: '24px',
                  border: currentStyles.borderStyle,
                  boxShadow: currentStyles.shadow,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  position: 'relative'
                }}>
                  {/* Header Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '20px' }}>
                    <div>
                      <span style={{ fontSize: '18px', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Invoice Number</span>
                      <strong style={{ fontSize: '24px', color: currentStyles.textColor, fontWeight: 800 }}>{invoice?.invoiceNumber || ''}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '18px', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Invoice Date</span>
                      <strong style={{ fontSize: '22px', color: currentStyles.textColor, fontWeight: 700 }}>{invoiceDate}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '18px', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Due Date</span>
                      <strong style={{ fontSize: '22px', color: currentStyles.textColor, fontWeight: 700 }}>{dueDate}</strong>
                    </div>
                  </div>

                  {/* Separator line */}
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', borderTopColor: template === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }}></div>

                  {/* Outstanding Amount Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '18px', color: currentStyles.lightTextColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>Outstanding Amount</span>
                      <strong style={{ fontSize: '56px', color: '#ef4444', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        ₹ {balance.toLocaleString('en-IN')}
                      </strong>
                    </div>

                    {/* Overdue Badge */}
                    {daysOverdue > 0 && (
                      <div style={{
                        backgroundColor: '#fee2e2',
                        border: '2px solid #ef4444',
                        color: '#b91c1c',
                        padding: '10px 24px',
                        borderRadius: '50px',
                        fontSize: '20px',
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
                <div style={{ color: '#cbd5e1', fontSize: '20px', lineHeight: 1.5, textAlign: 'center', margin: isSquare ? '5px 0' : '15px 0' }}>
                  Kindly arrange payment at your convenience. Ignore if already paid.
                </div>

                {/* Footer row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '2px solid rgba(255,255,255,0.1)',
                  paddingTop: '20px'
                }}>
                  {/* Left Column: Contact details */}
                  {validFieldsCount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      color: currentStyles.footerText, 
                      fontSize: '18px',
                      alignItems: 'flex-start',
                      textAlign: 'left'
                    }}>
                      <strong style={{ fontSize: '22px', color: '#ffffff', fontWeight: 800 }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </strong>
                      {hasPhone && <span>📞 Phone: {settings?.phone}</span>}
                      {hasEmail && <span>✉️ Email: {settings?.email}</span>}
                      {hasGst && <span>📋 GSTIN: {settings?.gstNumber || settings?.gstin}</span>}
                    </div>
                  )}

                  {/* Right Column: QR Pay Code */}
                  <div className="qr-section" style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '15px 25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', color: '#ffffff' }}>
                      <strong style={{ fontSize: '20px', fontWeight: 800 }}>Scan to Pay via UPI</strong>
                      <span style={{ fontSize: '16px', color: '#94a3b8', fontFamily: 'monospace' }}>{settings?.upiId || "7010602115@iob"}</span>
                    </div>
                    <div style={{
                      width: '120px',
                      height: '120px',
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
