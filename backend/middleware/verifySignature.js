/**
 * verifySignature.js
 * Middleware that verifies an EIP-191 personal_sign signature.
 * Protects POST /api/voters/register from wallet impersonation.
 *
 * Expects req.body: { walletAddress, signature, nonce }
 * The signed message must be: "INTIKHABATI-VERIFY-<nonce>"
 */
const { ethers }        = require('ethers');
const { consumeNonce }  = require('../utils/nonceStore');

module.exports = async function verifySignature(req, res, next) {
  const { walletAddress, signature, nonce } = req.body;

  if (!signature || !nonce) {
    return res.status(400).json({
      success: false,
      message: 'Signature and nonce are required. Please re-connect your wallet.',
    });
  }

  // Verify nonce is valid and not expired (also consumes it)
  let valid;
  try {
    valid = await consumeNonce(walletAddress, nonce);
  } catch {
    return res.status(500).json({ success: false, message: 'Nonce verification error.' });
  }

  if (!valid) {
    return res.status(401).json({
      success: false,
      message: 'Nonce expired or already used. Please refresh and try again.',
    });
  }

  // Recover signer address from signature
  const message = `INTIKHABATI-VERIFY-${nonce}`;
  try {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Signature mismatch — wallet authentication failed.',
      });
    }
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid signature format.',
    });
  }
};
