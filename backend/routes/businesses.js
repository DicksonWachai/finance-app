const express = require('express');
const pool = require('../db');
const { authenticate, requireBusiness } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List the businesses I belong to
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, m.role
       FROM businesses b
       JOIN business_members m ON m.business_id = b.id
       WHERE m.user_id = $1
       ORDER BY b.created_at`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Create a business; the creator becomes its admin
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { business_name, address, tax_number, currency, tax_rate, industry } = req.body;
    if (!business_name) {
      return res.status(400).json({ error: 'business_name is required' });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO businesses (owner_id, business_name, address, tax_number, currency, tax_rate, industry)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'USD'), COALESCE($6, 0), $7)
       RETURNING *`,
      [req.user.id, business_name, address, tax_number, currency, tax_rate, industry]
    );
    await client.query(
      "INSERT INTO business_members (business_id, user_id, role) VALUES ($1, $2, 'admin')",
      [rows[0].id, req.user.id]
    );
    await client.query('COMMIT');

    res.status(201).json({ ...rows[0], role: 'admin' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Update (admins only)
router.put('/:businessId', requireBusiness(['admin']), async (req, res, next) => {
  try {
    const { business_name, address, tax_number, currency, tax_rate, industry } = req.body;
    const { rows } = await pool.query(
      `UPDATE businesses SET
         business_name = COALESCE($2, business_name),
         address       = COALESCE($3, address),
         tax_number    = COALESCE($4, tax_number),
         currency      = COALESCE($5, currency),
         tax_rate      = COALESCE($6, tax_rate),
         industry      = COALESCE($7, industry)
       WHERE id = $1
       RETURNING *`,
      [req.params.businessId, business_name, address, tax_number, currency, tax_rate, industry]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete (owner/admin only; removes all its data too)
router.delete('/:businessId', requireBusiness(['admin']), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM businesses WHERE id = $1 AND owner_id = $2', [
      req.params.businessId,
      req.user.id,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;