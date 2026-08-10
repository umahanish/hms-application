const ROLE_HEADER = 'x-user-role';

export const ROLES = Object.freeze({
  FRONT_DESK: 'front-desk',
  BILLING_STAFF: 'billing-staff',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
});

/**
 * Lightweight RBAC: trusts a role asserted via the x-user-role header. This app has
 * no login/session system of its own -- the header is expected to be set by an
 * upstream identity layer (API gateway, reverse proxy, or a future login endpoint)
 * that has already authenticated the caller. It stops accidental/unauthenticated
 * access to sensitive routes, not a determined attacker who can set arbitrary
 * headers directly against this service -- see TASKS.md for the full-auth follow-up.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.get(ROLE_HEADER);
    if (!role) {
      return res.status(401).json({ message: `Missing ${ROLE_HEADER} header` });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: `Role '${role}' is not permitted to perform this action` });
    }
    return next();
  };
}

/**
 * Validates an inbound payment-gateway webhook via a shared secret rather than a
 * user role, since the caller is a machine, not a logged-in staff member.
 */
export function requireWebhookSecret(req, res, next) {
  const configured = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!configured) {
    return res.status(503).json({ message: 'Webhook is not configured' });
  }
  const provided = req.get('x-webhook-secret');
  if (provided !== configured) {
    return res.status(401).json({ message: 'Invalid webhook secret' });
  }
  return next();
}
