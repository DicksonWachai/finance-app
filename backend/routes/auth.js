const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !EMAIL_RE.test(email || '') || (password || '').length < 8) {
      return res.status(400).json({
        error: 'Name, a valid email and a password of at least 8 characters are required',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, LOWER($2), $3)
       RETURNING id, full_name, email`,
      [full_name, email, passwordHash]
    );

    res.status(201).json({ user: rows[0], token: signToken(rows[0].id) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await pool.query(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = LOWER($1)',
      [email || '']
    );

    const valid = rows.length > 0 && (await bcrypt.compare(password || '', rows[0].password_hash));
    if (!valid) {
      // Same message for "no such email" and "wrong password" on purpose.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password_hash, ...user } = rows[0];
    res.json({ user, token: signToken(user.id) });
  } catch (err) {
    next(err);
  }
});

// Protected route: returns the logged-in user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, full_name, email FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;