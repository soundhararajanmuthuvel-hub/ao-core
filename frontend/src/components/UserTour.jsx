import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TOUR_STEPS_DEFINITION = [
  {
    id: 'dashboard',
    selectorId: 'tour-dashboard',
    title: 'Business Overview',
    description: "View today's sales, inventory status, production updates, pending deliveries, collections, and key business metrics from a single dashboard."
  },
  {
    id: 'crm',
    selectorId: 'tour-crm',
    title: 'CRM & Lead Management',
    description: 'Manage leads, customers, follow-ups, reviews, and customer relationships.',
    features: [
      'Lead Finder',
      'Lead Management',
      'Customer Database',
      'Customer Reviews'
    ]
  },
  {
    id: 'fieldsales',
    selectorId: 'tour-fieldsales',
    title: 'Field Sales Management',
    description: 'Manage salesman visits, route planning, GPS check-ins, field orders, and delivery tracking.',
    features: [
      'Route Planner',
      'Customer Visits',
      'Product Catalog',
      'Field Orders',
      'Delivery Tracking'
    ]
  },
  {
    id: 'inventory',
    selectorId: 'tour-inventory',
    title: 'Inventory Management',
    description: 'Track products, raw materials, stock levels, stock movements, and low-stock alerts.'
  },
  {
    id: 'sales',
    selectorId: 'tour-sales',
    title: 'Sales & Billing',
    description: 'Create quotations, sales orders, invoices, and manage customer billing.'
  },
  {
    id: 'manufacturing',
    selectorId: 'tour-manufacturing',
    title: 'Production Management',
    description: 'Manage raw material consumption, production batches, finished goods, and manufacturing workflows.'
  },
  {
    id: 'accounts',
    selectorId: 'tour-accounts',
    title: 'Financial Management',
    description: 'Track receivables, payables, ledgers, collections, and business finances.'
  },
  {
    id: 'reports',
    selectorId: 'tour-reports',
    title: 'Business Reports',
    description: 'Generate sales reports, inventory reports, GST reports, production reports, and analytics.'
  },
  {
    id: 'settings',
    selectorId: 'tour-settings',
    title: 'System Configuration',
    description: 'Configure company settings, taxes, pricing rules, notifications, and ERP preferences.'
  },
  {
    id: 'users',
    selectorId: 'tour-users',
    title: 'User Management',
    description: 'Create users, assign roles, manage permissions, and control access.'
  }
];

export default function UserTour() {
  const { user, updateTourCompleted } = useAuth();
  const navigate = useNavigate();
  
  const [stepIndex, setStepIndex] = useState(-1); // -1 = Welcome Screen, >= visibleSteps.length = Final Screen
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [targetRect, setTargetRect] = useState(null);
  const [cardSize, setCardSize] = useState({ width: 380, height: 260 });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  const cardRef = useRef(null);

  // Initialize visible steps based on DOM presence (roles filtering)
  useEffect(() => {
    // Small delay to make sure DOM is painted and we can verify selectors
    const timer = setTimeout(() => {
      const filtered = TOUR_STEPS_DEFINITION.filter(step => {
        const el = document.getElementById(step.selectorId);
        return el !== null;
      });
      setVisibleSteps(filtered);
    }, 100);
    return () => clearTimeout(timer);
  }, [user]);

  // Track window resizing for mobile layout mode
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Measure card dimensions whenever step changes to accurately offset position
  useEffect(() => {
    if (cardRef.current) {
      setCardSize({
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight
      });
    }
  }, [stepIndex, visibleSteps]);

  const activeStep = useMemo(() => {
    if (stepIndex >= 0 && stepIndex < visibleSteps.length) {
      return visibleSteps[stepIndex];
    }
    return null;
  }, [stepIndex, visibleSteps]);

  // Open sidebar during active tour steps (on mobile or desktop)
  useEffect(() => {
    if (activeStep) {
      // Force sidebar to open on mobile, and expand/uncollapse on desktop
      window.dispatchEvent(new CustomEvent('tour-set-sidebar', { 
        detail: { open: true, collapsed: false } 
      }));
    } else {
      // Close sidebar overlays on welcome/final screens
      window.dispatchEvent(new CustomEvent('tour-set-sidebar', { 
        detail: { open: false } 
      }));
    }
  }, [activeStep]);

  // Coordinates tracking & scroll management loop
  useEffect(() => {
    if (!activeStep) {
      setTargetRect(null);
      return;
    }

    const updateCoordinates = () => {
      const el = document.getElementById(activeStep.selectorId);
      if (el) {
        const rect = el.getBoundingClientRect();
        // If element is offscreen or hidden, don't show spotlight or clamp values
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
        }
      }
    };

    // Scroll active element into view on mount or step transition
    const el = document.getElementById(activeStep.selectorId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Set interval to continuously adjust spotlight coordinates (catches transitions, scrolling, etc.)
    updateCoordinates();
    const interval = setInterval(updateCoordinates, 150);

    // Event listeners for scroll and resize
    window.addEventListener('scroll', updateCoordinates, { capture: true, passive: true });
    window.addEventListener('resize', updateCoordinates, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', updateCoordinates, { capture: true });
      window.removeEventListener('resize', updateCoordinates);
    };
  }, [activeStep]);

  // End and complete tour handler
  const handleCompleteTour = async (goToDashboard = false) => {
    await updateTourCompleted(true);
    if (goToDashboard) {
      navigate('/');
    }
  };

  // Skip tour entirely
  const handleSkipTour = async () => {
    if (confirm("Are you sure you want to skip the onboarding tour?")) {
      await updateTourCompleted(true);
    }
  };

  // Navigations
  const handleNext = () => {
    setStepIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    setStepIndex(prev => Math.max(-1, prev - 1));
  };

  const handleStart = () => {
    if (visibleSteps.length > 0) {
      setStepIndex(0);
    } else {
      // If no steps are visible for this role, skip to final screen
      setStepIndex(0);
    }
  };

  // Spotlight coordinates with padding
  const spotlightStyle = useMemo(() => {
    if (!targetRect) return { display: 'none' };
    const pad = 6;
    return {
      left: `${targetRect.x - pad}px`,
      top: `${targetRect.y - pad}px`,
      width: `${targetRect.width + pad * 2}px`,
      height: `${targetRect.height + pad * 2}px`
    };
  }, [targetRect]);

  // Floating card styling based on spotlight position
  const cardStyle = useMemo(() => {
    if (isMobile) {
      return {}; // Handled by responsive tour.css style rules
    }
    
    if (activeStep && targetRect) {
      const left = targetRect.x + targetRect.width + 16;
      // Clamp vertical bounds to keep card fully inside window viewport
      const top = Math.max(
        16, 
        Math.min(window.innerHeight - cardSize.height - 16, targetRect.y + (targetRect.height / 2) - (cardSize.height / 2))
      );
      
      return {
        left: `${left}px`,
        top: `${top}px`,
        position: 'fixed'
      };
    }
    
    // Centered Welcome and Final screens
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      position: 'fixed'
    };
  }, [activeStep, targetRect, cardSize, isMobile]);

  // Welcome Screen
  if (stepIndex === -1) {
    return (
      <div className="tour-overlay-container">
        <div className="tour-svg-backdrop" style={{ backgroundColor: 'rgba(2, 6, 23, 0.75)' }} />
        <div className="tour-card centered" ref={cardRef} style={cardStyle}>
          <div className="tour-welcome-icon">👋</div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 className="tour-card-title" style={{ justifyContent: 'center', fontSize: '1.4rem' }}>
              Welcome to AO ERP
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Manage your business from inventory to sales, manufacturing, CRM, field sales, accounts, and reports—all in one place.
            </p>
          </div>
          <div className="tour-card-footer" style={{ borderTop: 'none', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="tour-btn tour-btn-secondary" onClick={handleSkipTour} style={{ minWidth: '120px' }}>
              Skip Tour
            </button>
            <button type="button" className="tour-btn tour-btn-primary" onClick={handleStart} style={{ minWidth: '150px' }}>
              Start Tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Final Screen
  if (stepIndex >= visibleSteps.length) {
    return (
      <div className="tour-overlay-container">
        <div className="tour-svg-backdrop" style={{ backgroundColor: 'rgba(2, 6, 23, 0.75)' }} />
        <div className="tour-card centered" ref={cardRef} style={cardStyle}>
          <div className="tour-welcome-icon">🎉</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 className="tour-card-title" style={{ justifyContent: 'center', fontSize: '1.4rem' }}>
              AO ERP Setup Complete
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              You're ready to start managing your business.
            </p>
            
            <div style={{ marginTop: '0.5rem' }}>
              <span className="tour-features-title">Recommended Next Steps:</span>
              <ul className="tour-next-steps-list">
                <li className="tour-step-item">1. Add Products</li>
                <li className="tour-step-item">2. Add Customers</li>
                <li className="tour-step-item">3. Configure Company Settings</li>
                <li className="tour-step-item">4. Create First Order</li>
                <li className="tour-step-item">5. Review Dashboard</li>
              </ul>
            </div>
          </div>
          <div className="tour-card-footer" style={{ justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="tour-btn tour-btn-secondary" onClick={() => handleCompleteTour(true)}>
              Go To Dashboard
            </button>
            <button type="button" className="tour-btn tour-btn-primary" onClick={() => handleCompleteTour(false)}>
              Start Using AO ERP
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active step renderer
  const step = visibleSteps[stepIndex];
  return (
    <div className="tour-overlay-container">
      {/* Background Overlay cutout spotlight */}
      <div className="tour-svg-backdrop" style={{ backgroundColor: 'transparent' }} />
      <div className="tour-spotlight-pulse" style={spotlightStyle} />

      <div className="tour-card" ref={cardRef} style={cardStyle}>
        <div className="tour-card-header">
          <h3 className="tour-card-title">
            {step.title}
          </h3>
          <button type="button" className="tour-close-btn" onClick={handleSkipTour} title="Skip Tour">
            ✕
          </button>
        </div>
        
        <div className="tour-card-body">
          <p style={{ margin: 0 }}>{step.description}</p>
          
          {step.features && step.features.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span className="tour-features-title">Features:</span>
              <ul className="tour-features-list">
                {step.features.map((feat, idx) => (
                  <li key={idx} className="tour-feature-item">
                    <span className="tour-feature-dot">•</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="tour-card-footer">
          <button type="button" className="tour-btn-link" onClick={handleSkipTour}>
            Skip Tour
          </button>
          
          <div className="tour-actions-group">
            <span className="tour-progress" style={{ alignSelf: 'center', marginRight: '0.75rem' }}>
              Step {stepIndex + 1} of {visibleSteps.length}
            </span>
            {stepIndex > 0 && (
              <button type="button" className="tour-btn tour-btn-secondary" onClick={handlePrev}>
                ← Prev
              </button>
            )}
            <button type="button" className="tour-btn tour-btn-primary" onClick={handleNext}>
              {stepIndex === visibleSteps.length - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
