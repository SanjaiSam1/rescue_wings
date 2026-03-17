export const ROLE_HOME_ROUTES = {
  admin: '/admin',
  volunteer: '/volunteer',
  citizen: '/dashboard',
};

export function getHomeRouteByRole(role) {
  return ROLE_HOME_ROUTES[role] || '/dashboard';
}
