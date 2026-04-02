const rateLimit = require("express-rate-limit");

// Pour les tests : 50 tentatives par minute
const phantomLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de tentatives. Réessayez dans 1 minute.",
    retryAfter: "1 minute",
  },
  handler: (req, res, next, options) => {
    console.warn(`⚠️  Rate limit – IP: ${req.ip} – Route: ${req.path}`);
    res.status(429).json(options.message);
  },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Trop de requêtes. Réessayez plus tard.",
  },
});

module.exports = { phantomLimiter, generalLimiter };