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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/track/:trackingNumber" element={<PublicTracking />} />
      <Route path="/track" element={<PublicTracking />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        
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
            <RoleRoute roles={['Super Admin', 'Sales Executive', 'Billing Executive']}>
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
        <Route
          path="sales/:id/print"
          element={
            <RoleRoute roles={['Super Admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive']}>
              <SalePrint />
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
