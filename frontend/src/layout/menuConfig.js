import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Factory, 
  Wallet, 
  BarChart3, 
  Settings, 
  Users, 
  Sparkles, 
  Target, 
  MapPinned, 
  ClipboardList, 
  Truck,
  Key,
  Star,
  Gift,
  Tag,
  BarChart2,
  RotateCcw
} from 'lucide-react';


export const websiteMenuStructure = [
  {
    id: 'ws-api-key',
    type: 'link',
    to: '/website?tab=api-key',
    tabId: 'api-key',
    icon: Key,
    emoji: '🔑',
    label: 'API Key & Settings',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-orders',
    type: 'link',
    to: '/website?tab=orders',
    tabId: 'orders',
    icon: ShoppingCart,
    emoji: '🛒',
    label: 'Orders',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-customers',
    type: 'link',
    to: '/website?tab=customers',
    tabId: 'customers',
    icon: Users,
    emoji: '👥',
    label: 'Customers',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-reviews',
    type: 'link',
    to: '/website?tab=reviews',
    tabId: 'reviews',
    icon: Star,
    emoji: '⭐',
    label: 'Reviews & Testimonials',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-referrals',
    type: 'link',
    to: '/website?tab=referrals',
    tabId: 'referrals',
    icon: Gift,
    emoji: '🎁',
    label: 'Referrals',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-shipping',
    type: 'link',
    to: '/website?tab=shipping',
    tabId: 'shipping',
    icon: Tag,
    emoji: '🏷️',
    label: 'Shipping & Coupons',
    roles: ['Super Admin', 'admin']
  },
  {
    id: 'ws-analytics',
    type: 'link',
    to: '/website?tab=analytics',
    tabId: 'analytics',
    icon: BarChart2,
    emoji: '📊',
    label: 'CRM & Analytics',
    roles: ['Super Admin', 'admin']
  }
];

export const menuStructure = [
  {
    id: 'dashboard',
    type: 'link',
    to: '/',
    icon: LayoutDashboard,
    emoji: '🏠',
    label: 'Dashboard',
    end: true,
    roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Billing Executive', 'Store Keeper', 'Dispatch Executive', 'Sales Executive', 'Sales Manager', 'Salesman', 'Delivery Staff']
  },
  {
    id: 'ai-assistant',
    type: 'link',
    to: '/ai-assistant',
    icon: Sparkles,
    emoji: '🤖',
    label: 'AI Assistant',
    roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Billing Executive', 'Store Keeper', 'Sales Executive', 'Sales Manager', 'Salesman']
  },
  {
    id: 'crm',
    type: 'group',
    to: '/crm',
    icon: Users,
    emoji: '📊',
    label: 'CRM',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'],
    showOnMobileDrawer: true,
    children: [
      { to: '/crm/leads', label: 'Leads', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/ai-lead-importer', label: 'AI Lead Importer', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/customers', label: 'Customers', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/customer-map', label: 'Customer Map', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/followups', label: 'Follow Ups', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/re-engagement', label: 'Re-Engagement', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/whatsapp-logs', label: 'Communication Center', roles: ['Super Admin', 'admin', 'Sales Manager'] }
    ]
  },
  {
    id: 'visits',
    type: 'link',
    to: '/customer-visits',
    icon: MapPinned,
    emoji: '📍',
    label: 'Visits',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'],
    showOnMobileDrawer: true
  },
  {
    id: 'targets',
    type: 'link',
    to: '/sales-targets',
    icon: Target,
    emoji: '🎯',
    label: 'Targets',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'],
    showOnMobileDrawer: true
  },
  {
    id: 'orders',
    type: 'link',
    to: '/field-ordering',
    icon: ClipboardList,
    emoji: '🛒',
    label: 'Orders',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'],
    showOnMobileDrawer: true
  },
  {
    id: 'delivery',
    type: 'link',
    to: '/delivery-tracking',
    icon: Truck,
    emoji: '🚚',
    label: 'Delivery',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Delivery Staff', 'Dispatch Executive'],
    showOnMobileDrawer: true
  },
  {
    id: 'inventory',
    type: 'group',
    to: '/products',
    icon: Package,
    emoji: '📦',
    label: 'Inventory',
    roles: ['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Salesman', 'Sales Executive'],
    children: [
      { to: '/products', label: 'Products', roles: ['Super Admin', 'admin', 'Store Keeper'] },
      { to: '/products/catalog-center', label: 'Catalog Center', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/products?tab=raw-materials', label: 'Raw Materials', roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'] },
      { to: '/inventory', label: 'Stock', roles: ['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager'] },
      { to: '/suppliers', label: 'Suppliers', roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'] }
    ]
  },
  {
    id: 'sales',
    type: 'group',
    to: '/sales',
    icon: ShoppingCart,
    emoji: '🧾',
    label: 'Sales',
    roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Sales Manager', 'Salesman'],
    children: [
      { to: '/order-noting', label: 'Orders', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Store Keeper'] },
      { to: '/sales', label: 'Invoices', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Sales Manager', 'Salesman'] },
      { to: '/customers', label: 'Customers', roles: ['Super Admin', 'admin', 'Sales Executive', 'Billing Executive', 'Sales Manager', 'Salesman'] },
      { to: '/sales/returns', label: 'Returns', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Sales Manager', 'Dispatch Executive', 'Store Keeper'] }
    ]
  },

  {
    id: 'manufacturing',
    type: 'group',
    to: '/manufacturing',
    icon: Factory,
    emoji: '🏭',
    label: 'Production',
    roles: ['Super Admin', 'admin', 'Manufacturing Manager'],
    showOnMobileDrawer: true,
    children: [
      { to: '/manufacturing?tab=production', label: 'Production', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] },
      { to: '/manufacturing?tab=recipes', label: 'Recipes', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] },
      { to: '/manufacturing?tab=packing-conversion', label: 'Packing Conversion', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] }
    ]
  },
  {
    id: 'accounts',
    type: 'link',
    to: '/sales?tab=payments',
    icon: Wallet,
    emoji: '💰',
    label: 'Accounts',
    roles: ['Super Admin', 'admin', 'Billing Executive']
  },
  {
    id: 'reports',
    type: 'link',
    to: '/reports',
    icon: BarChart3,
    emoji: '📑',
    label: 'Reports',
    roles: ['Super Admin', 'admin', 'Sales Manager'],
    showOnMobileDrawer: true
  },
  {
    id: 'settings',
    type: 'group',
    to: '/settings',
    icon: Settings,
    emoji: '⚙️',
    label: 'Settings',
    roles: ['Super Admin', 'admin'],
    showOnMobileDrawer: true,
    children: [
      { to: '/settings', label: 'General Settings', roles: ['Super Admin', 'admin'] },
      { to: '/settings/integrations-marketplace', label: 'Integrations Marketplace', roles: ['Super Admin', 'admin'] },
      { to: '/settings/developer-center', label: 'Developer Center', roles: ['Super Admin', 'admin'] }
    ]
  },
  {
    id: 'users',
    type: 'link',
    to: '/users',
    icon: Users,
    emoji: '🔐',
    label: 'Users',
    roles: ['Super Admin', 'admin'],
    showOnMobileDrawer: true
  },
  {
    id: 'suppliers',
    type: 'link',
    to: '/suppliers',
    icon: Factory,
    emoji: '🚜',
    label: 'Suppliers',
    roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'],
    showOnMobileDrawer: true
  }
];
