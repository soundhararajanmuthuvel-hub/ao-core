import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import ScopeRoute from './ScopeRoute';
import { useAuth } from '../context/AuthContext';
import GlobalLoader from '../components/GlobalLoader';

function DesktopOnlyRoute({ children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="page" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖥️</div>
        <h2 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Desktop Screen Recommended</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
          This advanced administrative layout is optimized for desktop computers. Please access it from a larger screen.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => window.history.back()}>
          Go Back
        </button>
      </div>
    );
  }

  return children;
}

function IndexRoute() {
  const { user } = useAuth();
  const activeScope = user?.activeScope || localStorage.getItem('ao_active_scope') || 'management_billing';
  if (activeScope === 'website_admin') {
    return <Navigate to="/website" replace />;
  }
  return (
    <ScopeRoute scope="management_billing">
      <Dashboard />
    </ScopeRoute>
  );
}

import AppLayout from '../layout/AppLayout';

// Lazy Loaded Pages
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const SaleView = lazy(() => import('../pages/SaleView'));
const SalePrint = lazy(() => import('../pages/SalePrint'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const Users = lazy(() => import('../pages/Users'));
const Settings = lazy(() => import('../pages/Settings'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const Suppliers = lazy(() => import('../pages/Suppliers'));
const AIAssistant = lazy(() => import('../pages/AIAssistant'));
const PublicTracking = lazy(() => import('../pages/PublicTracking'));
const ManufacturingPage = lazy(() => import('../pages/ManufacturingPage'));
const OrderNoting = lazy(() => import('../pages/OrderNoting'));
const RoutePlanner = lazy(() => import('../pages/RoutePlanner'));
const CustomerVisits = lazy(() => import('../pages/CustomerVisits'));
const MobileCatalog = lazy(() => import('../pages/MobileCatalog'));
const FieldOrdering = lazy(() => import('../pages/FieldOrdering'));
const DeliveryTracking = lazy(() => import('../pages/DeliveryTracking'));
const ReviewPortal = lazy(() => import('../pages/ReviewPortal'));
const IntegrationsMarketplace = lazy(() => import('../pages/IntegrationsMarketplace'));
const DeveloperCenter = lazy(() => import('../pages/DeveloperCenter'));
const WebsiteManagement = lazy(() => import('../pages/WebsiteManagement'));
const ReturnRecoveryModule = lazy(() => import('../pages/ReturnRecoveryModule'));
const QuickBilling = lazy(() => import('../pages/QuickBilling'));

// CRM Pages
const CrmDashboard = lazy(() => import('../pages/CrmDashboard'));
const Leads = lazy(() => import('../pages/Leads'));
const AiLeadImporter = lazy(() => import('../pages/AiLeadImporter'));
const Opportunities = lazy(() => import('../pages/Opportunities'));
const FollowUps = lazy(() => import('../pages/FollowUps'));
const CustomerReviews = lazy(() => import('../pages/CustomerReviews'));
const CustomerMap = lazy(() => import('../pages/CustomerMap'));
const ReEngagement = lazy(() => import('../pages/ReEngagement'));
const WhatsAppLogs = lazy(() => import('../pages/WhatsAppLogs'));
const SalesTargets = lazy(() => import('../pages/SalesTargets'));

// SFA Pages
const FieldSalesDashboard = lazy(() => import('../pages/FieldSalesDashboard'));
const FieldSalesAnalytics = lazy(() => import('../pages/FieldSalesAnalytics'));

const CatalogCenter = lazy(() => import('../pages/CatalogCenter'));
const PublicCatalog = lazy(() => import('../pages/PublicCatalog'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<GlobalLoader message="Loading..." />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/catalog" element={<PublicCatalog />} />
        <Route path="/track/:trackingNumber" element={<PublicTracking />} />
        <Route path="/track" element={<PublicTracking />} />
        <Route path="/reviews/portal/:token" element={<ReviewPortal />} />
        
        <Route
          path="/sales/:id/print"
          element={
            <ProtectedRoute>
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
                  <SalePrint />
                </RoleRoute>
              </ScopeRoute>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<IndexRoute />} />

          {/* CRM Routes (Management & Billing) */}
          <Route
            path="crm"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
                  <CrmDashboard />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/leads"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <Leads />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/ai-lead-importer"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <AiLeadImporter />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/customer-map"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <CustomerMap />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/opportunities"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <Opportunities />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/followups"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <FollowUps />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/re-engagement"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <ReEngagement />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/whatsapp-logs"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
                  <WhatsAppLogs />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="crm/reviews"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
                  <CustomerReviews />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          {/* Field Sales / SFA Routes (Management & Billing) */}
          <Route
            path="field-sales"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <FieldSalesDashboard />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="field-sales/analytics"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
                  <FieldSalesAnalytics />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          
          <Route
            path="route-planner"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <RoutePlanner />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="customer-visits"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <CustomerVisits />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="mobile-catalog"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <MobileCatalog />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="field-ordering"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <FieldOrdering />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="delivery-tracking"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Delivery Staff', 'Dispatch Executive']}>
                  <DeliveryTracking />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          
          {/* Core ERP Pages (Management & Billing) */}
          <Route
            path="products"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Store Keeper']}>
                  <ProductsPage />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="products/catalog-center"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <CatalogCenter />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="manufacturing"
            element={
              <ScopeRoute scope="management_billing">
                <DesktopOnlyRoute>
                  <RoleRoute roles={['Super Admin', 'Manufacturing Manager']}>
                    <ManufacturingPage />
                  </RoleRoute>
                </DesktopOnlyRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="sales"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
                  <SalesPage />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="quick-billing"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive']}>
                  <QuickBilling />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          <Route
            path="order-noting"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Store Keeper']}>
                  <OrderNoting />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="inventory"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Store Keeper', 'Manufacturing Manager']}>
                  <InventoryPage />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="returns"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Billing Executive']}>
                  <ReturnRecoveryModule />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="sales/returns"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Billing Executive', 'Sales Executive']}>
                  <ReturnRecoveryModule />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          <Route
            path="customers"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Executive', 'Billing Executive', 'Sales Manager', 'Salesman']}>
                  <CustomersPage />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="sales-targets"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
                  <SalesTargets />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ScopeRoute scope="management_billing">
                <DesktopOnlyRoute>
                  <RoleRoute roles={['Super Admin']}>
                    <ReportsPage />
                  </RoleRoute>
                </DesktopOnlyRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ScopeRoute scope="management_billing">
                <DesktopOnlyRoute>
                  <RoleRoute roles={['Super Admin']}>
                    <Settings />
                  </RoleRoute>
                </DesktopOnlyRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="settings/integrations-marketplace"
            element={
              <ScopeRoute scope="management_billing">
                <DesktopOnlyRoute>
                  <RoleRoute roles={['Super Admin']}>
                    <IntegrationsMarketplace />
                  </RoleRoute>
                </DesktopOnlyRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="settings/developer-center"
            element={
              <ScopeRoute scope="management_billing">
                <DesktopOnlyRoute>
                  <RoleRoute roles={['Super Admin', 'admin']}>
                    <DeveloperCenter />
                  </RoleRoute>
                </DesktopOnlyRoute>
              </ScopeRoute>
            }
          />

          {/* Website / Storefront Admin Route */}
          <Route
            path="website"
            element={
              <ScopeRoute scope="website_admin">
                <RoleRoute roles={['Super Admin', 'admin', 'Website Admin']}>
                  <WebsiteManagement />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          {/* Users & Suppliers & AI (Management & Billing) */}
          <Route
            path="users"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin']}>
                  <Users />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="suppliers"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper']}>
                  <Suppliers />
                </RoleRoute>
              </ScopeRoute>
            }
          />
          <Route
            path="ai-assistant"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin']}>
                  <AIAssistant />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          {/* Detailed views / sub-routes */}
          <Route
            path="sales/:id"
            element={
              <ScopeRoute scope="management_billing">
                <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
                  <SaleView />
                </RoleRoute>
              </ScopeRoute>
            }
          />

          {/* Redirects for backward compatibility */}
          <Route path="sales/create" element={<Navigate to="/sales?tab=new" replace />} />
          <Route path="sales/new" element={<Navigate to="/sales?tab=new" replace />} />
          <Route path="repack" element={<Navigate to="/manufacturing?tab=repacking" replace />} />
          <Route path="raw-materials" element={<Navigate to="/products?tab=raw-materials" replace />} />
          <Route path="packaging-materials" element={<Navigate to="/products?tab=packaging-materials" replace />} />
          <Route path="shipping" element={<Navigate to="/sales?tab=shipping" replace />} />
          <Route path="white-label" element={<Navigate to="/customers?tab=white-label" replace />} />
          <Route path="organic-stores" element={<Navigate to="/customers?tab=organic-stores" replace />} />
          <Route path="retail-shops" element={<Navigate to="/customers?tab=retail-shops" replace />} />
          <Route path="d2c-customers" element={<Navigate to="/customers?tab=d2c-customers" replace />} />
          <Route path="customer-analytics" element={<Navigate to="/customers?tab=analytics" replace />} />
          <Route path="ai-analytics" element={<Navigate to="/dashboard" replace />} />

        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
