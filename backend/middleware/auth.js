const jwt = require('jsonwebtoken');
const pool = require('../db');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Confirms the user belongs to the business and (optionally) has an allowed role.
// The business id comes from the X-Business-Id header or the :businessId URL param.
function requireBusiness(allowedRoles) {
  return async (req, res, next) => {
    const businessId = req.headers['x-business-id'] || req.params.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'X-Business-Id header is required' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT role FROM business_members WHERE business_id = $1 AND user_id = $2',
        [businessId, req.user.id]
      );
      if (!rows.length) {
        return res.status(403).json({ error: 'No access to this business' });
      }
      if (allowedRoles && !allowedRoles.includes(rows[0].role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      req.business = { id: businessId, role: rows[0].role };
      next();
    } catch (err) {
      if (err.code === '22P02') return res.status(400).json({ error: 'Invalid business id' });
      next(err);
    }
  };
}

module.exports = { authenticate, requireBusiness };