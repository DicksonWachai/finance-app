const pool = require('../db');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns an error message string, or null if the entry is valid
function validateEntry(body, categories) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'amount must be a positive number';
  }
  if (!categories.includes(body.category)) {
    return `category must be one of: ${categories.join(', ')}`;
  }
  if (body.date && !DATE_RE.test(body.date)) {
    return 'date must be in YYYY-MM-DD format';
  }
  return null;
}

// Makes sure a customer/supplier id really belongs to this business.
// (The table name is always a fixed string from our own code, never user input.)
async function belongsToBusiness(table, id, businessId) {
  if (!id) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return rows.length > 0;
}

module.exports = { validateEntry, belongsToBusiness, DATE_RE };