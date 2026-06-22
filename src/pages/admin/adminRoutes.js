const ADMIN_ROUTES = new Set([
  '/admin',
  '/admin/dashboard',
  '/admin/orders',
  '/admin/transactions',
  '/admin/products',
  '/admin/users',
  '/admin/analytics',
]);

export function isAdminRoute(route) {
  return ADMIN_ROUTES.has(route);
}
