const rateLimit = require('express-rate-limit');

// Strict: voter registration (5 per 15min per IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please wait 15 minutes.' },
});

// Admin actions (300 per 15min per IP)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Admin rate limit exceeded.' },
});

// Public read endpoints (120 per min per IP)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'Too many requests.' },
});

// Aliases for legacy routes (phantom.js, vote.js)
const phantomLimiter  = registerLimiter;
const generalLimiter  = publicLimiter;
const voteLimiter     = registerLimiter;

module.exports = {
  registerLimiter, adminLimiter, publicLimiter,
  // legacy aliases
  phantomLimiter, generalLimiter, voteLimiter,
};
