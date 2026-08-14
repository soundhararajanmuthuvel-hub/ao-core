import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import LoadingSpinner from '../components/LoadingSpinner';

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
    <Suspense fallback={<LoadingSpinner />}>
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
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
              <SalePrint />
            </RoleRoute>
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
        <Route index element={<Dashboard />} />

        {/* CRM Routes */}
        <Route
          path="crm"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
              <CrmDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="crm/leads"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <Leads />
            </RoleRoute>
          }
        />
        <Route
          path="crm/ai-lead-importer"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <AiLeadImporter />
            </RoleRoute>
          }
        />
        <Route
          path="crm/customer-map"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <CustomerMap />
            </RoleRoute>
          }
        />
        <Route
          path="crm/opportunities"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <Opportunities />
            </RoleRoute>
          }
        />
        <Route
          path="crm/followups"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <FollowUps />
            </RoleRoute>
          }
        />
        <Route
          path="crm/re-engagement"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <ReEngagement />
            </RoleRoute>
          }
        />
        <Route
          path="crm/whatsapp-logs"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
              <WhatsAppLogs />
            </RoleRoute>
          }
        />
        <Route
          path="crm/reviews"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
              <CustomerReviews />
            </RoleRoute>
          }
        />

        {/* Field Sales / SFA Routes */}
        <Route
          path="field-sales"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <FieldSalesDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="field-sales/analytics"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager']}>
              <FieldSalesAnalytics />
            </RoleRoute>
          }
        />
        
        <Route
          path="route-planner"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <RoutePlanner />
            </RoleRoute>
          }
        />
        <Route
          path="customer-visits"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <CustomerVisits />
            </RoleRoute>
          }
        />
        <Route
          path="mobile-catalog"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <MobileCatalog />
            </RoleRoute>
          }
        />
        <Route
          path="field-ordering"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <FieldOrdering />
            </RoleRoute>
          }
        />
        <Route
          path="delivery-tracking"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Delivery Staff', 'Dispatch Executive']}>
              <DeliveryTracking />
            </RoleRoute>
          }
        />
        
        {/* Simplified Consolidated Pages & Role-based Routing */}
        <Route
          path="products"
          element={
            <RoleRoute roles={['Super Admin', 'Store Keeper']}>
              <ProductsPage />
            </RoleRoute>
          }
        />
        <Route
          path="products/catalog-center"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <CatalogCenter />
            </RoleRoute>
          }
        />
        <Route
          path="manufacturing"
          element={
            <DesktopOnlyRoute>
              <RoleRoute roles={['Super Admin', 'Manufacturing Manager']}>
                <ManufacturingPage />
              </RoleRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="sales"
          element={
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
              <SalesPage />
            </RoleRoute>
          }
        />
        <Route
          path="quick-billing"
          element={
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive']}>
              <QuickBilling />
            </RoleRoute>
          }
        />

        <Route
          path="order-noting"
          element={
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Store Keeper']}>
              <OrderNoting />
            </RoleRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <RoleRoute roles={['Super Admin', 'Store Keeper', 'Manufacturing Manager']}>
              <InventoryPage />
            </RoleRoute>
          }
        />
        <Route
          path="returns"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Billing Executive']}>
              <ReturnRecoveryModule />
            </RoleRoute>
          }
        />
        <Route
          path="sales/returns"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Billing Executive', 'Sales Executive']}>
              <ReturnRecoveryModule />
            </RoleRoute>
          }
        />


        <Route
          path="customers"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Executive', 'Billing Executive', 'Sales Manager', 'Salesman']}>
              <CustomersPage />
            </RoleRoute>
          }
        />
        <Route
          path="sales-targets"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive']}>
              <SalesTargets />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <DesktopOnlyRoute>
              <RoleRoute roles={['Super Admin']}>
                <ReportsPage />
              </RoleRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="settings"
          element={
            <DesktopOnlyRoute>
              <RoleRoute roles={['Super Admin']}>
                <Settings />
              </RoleRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="settings/integrations-marketplace"
          element={
            <DesktopOnlyRoute>
              <RoleRoute roles={['Super Admin']}>
                <IntegrationsMarketplace />
              </RoleRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="settings/developer-center"
          element={
            <DesktopOnlyRoute>
              <RoleRoute roles={['Super Admin', 'admin']}>
                <DeveloperCenter />
              </RoleRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="website"
          element={
            <RoleRoute roles={['Super Admin', 'admin']}>
              <WebsiteManagement />
            </RoleRoute>
          }
        />
        <Route
          path="users"
          element={
            <RoleRoute roles={['Super Admin']}>
              <Users />
            </RoleRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper']}>
              <Suppliers />
            </RoleRoute>
          }
        />
        <Route
          path="ai-assistant"
          element={
            <RoleRoute roles={['Super Admin']}>
              <AIAssistant />
            </RoleRoute>
          }
        />

        {/* Detailed views / sub-routes */}
        <Route
          path="sales/:id"
          element={
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
              <SaleView />
            </RoleRoute>
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
