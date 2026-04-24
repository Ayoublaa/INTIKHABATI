/**
 * nonceStore.js — MongoDB-backed one-time nonce store
 * Survives backend restarts (previously in-memory only).
 * TTL: 300 seconds (handled by MongoDB TTL index on Nonce model).
 */
const crypto = require('crypto');
const Nonce  = require('../models/Nonce');

/**
 * Generate and persist a nonce for a wallet.
 * Overwrites any existing nonce for the same wallet (upsert).
 * @param {string} wallet  — 0x... (any case)
 * @returns {Promise<{ nonce: string, message: string }>}
 */
async function createNonce(wallet) {
  const nonce   = crypto.randomBytes(16).toString('hex');
  const message = `INTIKHABATI-VERIFY-${nonce}`;
  await Nonce.findOneAndUpdate(
    { wallet: wallet.toLowerCase() },
    { nonce, createdAt: new Date() },
    { upsert: true, new: true }
  );
  return { nonce, message };
}

/**
 * Verify and consume a nonce (one-time use).
 * Deletes the document if valid — expired docs are already gone via TTL.
 * @returns {Promise<boolean>}
 */
async function consumeNonce(wallet, nonce) {
  const deleted = await Nonce.findOneAndDelete({
    wallet: wallet.toLowerCase(),
    nonce,
  });
  return !!deleted;
}

module.exports = { createNonce, consumeNonce };
