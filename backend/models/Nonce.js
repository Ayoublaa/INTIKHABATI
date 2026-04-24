const mongoose = require('mongoose');

/**
 * Nonce — persisted one-time tokens for wallet signature verification.
 * TTL index: MongoDB automatically deletes documents after 300 seconds (5 min).
 */
const NonceSchema = new mongoose.Schema({
  wallet: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    index:     true,
  },
  nonce: {
    type:     String,
    required: true,
  },
  createdAt: {
    type:    Date,
    default: Date.now,
    expires: 300,   // TTL: 5 minutes (matches in-memory store behaviour)
  },
});

module.exports = mongoose.model('Nonce', NonceSchema);
