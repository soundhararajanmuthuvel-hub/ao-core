import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../layout/AppLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import ProductsPage from '../pages/ProductsPage';
import SalesPage from '../pages/SalesPage';
import SaleView from '../pages/SaleView';
import SalePrint from '../pages/SalePrint';
import CustomersPage from '../pages/CustomersPage';
import Users from '../pages/Users';
import Settings from '../pages/Settings';
import InventoryPage from '../pages/InventoryPage';
import ReportsPage from '../pages/ReportsPage';
import Suppliers from '../pages/Suppliers';
import AIAssistant from '../pages/AIAssistant';
import PublicTracking from '../pages/PublicTracking';
import ManufacturingPage from '../pages/ManufacturingPage';
import OrderNoting from '../pages/OrderNoting';
import RoutePlanner from '../pages/RoutePlanner';
import CustomerVisits from '../pages/CustomerVisits';
import MobileCatalog from '../pages/MobileCatalog';
import FieldOrdering from '../pages/FieldOrdering';
import DeliveryTracking from '../pages/DeliveryTracking';
import ReviewPortal from '../pages/ReviewPortal';
import IntegrationsMarketplace from '../pages/IntegrationsMarketplace';
import DeveloperCenter from '../pages/DeveloperCenter';

// CRM Pages
import CrmDashboard from '../pages/CrmDashboard';
import Leads from '../pages/Leads';
import AiLeadImporter from '../pages/AiLeadImporter';
import Opportunities from '../pages/Opportunities';
import FollowUps from '../pages/FollowUps';
import CustomerReviews from '../pages/CustomerReviews';
import CustomerMap from '../pages/CustomerMap';
import ReEngagement from '../pages/ReEngagement';
import WhatsAppLogs from '../pages/WhatsAppLogs';

// SFA Pages
import FieldSalesDashboard from '../pages/FieldSalesDashboard';
import FieldSalesAnalytics from '../pages/FieldSalesAnalytics';

import CatalogCenter from '../pages/CatalogCenter';
import PublicCatalog from '../pages/PublicCatalog';

export default function AppRoutes() {
  return (
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
            <RoleRoute roles={['Super Admin', 'Manufacturing Manager']}>
              <ManufacturingPage />
            </RoleRoute>
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
          path="customers"
          element={
            <RoleRoute roles={['Super Admin', 'admin', 'Sales Executive', 'Billing Executive', 'Sales Manager', 'Salesman']}>
              <CustomersPage />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute roles={['Super Admin']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="settings"
          element={
            <RoleRoute roles={['Super Admin']}>
              <Settings />
            </RoleRoute>
          }
        />
        <Route
          path="settings/integrations-marketplace"
          element={
            <RoleRoute roles={['Super Admin']}>
              <IntegrationsMarketplace />
            </RoleRoute>
          }
        />
        <Route
          path="settings/developer-center"
          element={
            <RoleRoute roles={['Super Admin', 'admin']}>
              <DeveloperCenter />
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
  );
}
