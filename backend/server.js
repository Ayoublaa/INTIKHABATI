// ============================================================
//  INTIKHABATI v2 — server.js
// ============================================================
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const mongoose = require('mongoose');
const helmet   = require('helmet');

const electionRoutes = require('./routes/elections');
const voterRoutes    = require('./routes/voters');
const adminRoutes    = require('./routes/admin');
const certRoutes     = require('./routes/certificate');
const relayRoutes    = require('./routes/relay');

// Legacy routes kept for backward compatibility during transition
const phantomRoutes  = require('./routes/phantom');
const voteRoutes     = require('./routes/vote');

const { startAutoClose } = require('./services/autoCloseService');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security headers ─────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin:         ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet'],
  credentials:    true,
}));

// ── Global middleware ────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

// ── MongoDB ──────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    // Start auto-close polling after DB is ready
    startAutoClose();
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ── Routes v2 ────────────────────────────────────────────────
app.use('/api/elections',   electionRoutes);
app.use('/api/voters',      voterRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/certificate', certRoutes);
app.use('/api/relay',       relayRoutes);   // EIP-2771 meta-tx relay

// ── Legacy routes (keep during transition) ───────────────────
app.use('/api/phantom',     phantomRoutes);
app.use('/api/vote',        voteRoutes);

// ── Health ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:    'OK',
    version:   '2.0.0',
    project:   'INTIKHABATI',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 INTIKHABATI v2 API → http://localhost:${PORT}`);
  console.log(`🛡  Helmet active — HTTP security headers enabled`);
  console.log(`🔒 CORS active    — localhost:3000 only`);
});
