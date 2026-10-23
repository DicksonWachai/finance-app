require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const rateLimit = require('express-rate-limit');

app.use(
  '/api/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }),
  require('./routes/auth')
);

// Catch-all error handler (keep this near the bottom, above app.listen)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.get('/', (req, res) => {
  res.send('Finance API Running');
});

const pool = require('./db');

app.get('/health/db', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    res.json({ database: 'connected', time: rows[0].now });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ database: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});