export function isCustomerUser(user) {
  return user?.role === 'customer' || user?.role === 'user';
}
