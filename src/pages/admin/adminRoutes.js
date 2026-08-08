const ADMIN_ROUTES = new Set([
  '/admin',
  '/admin/dashboard',
  '/admin/orders',
  '/admin/transactions',
  '/admin/products',
  '/admin/categories',
  '/admin/shipping-carriers',
  '/admin/news',
  '/admin/users',
  '/admin/analytics',
]);

export function isAdminRoute(route) {
  return ADMIN_ROUTES.has(route);
}
