const crypto = require('crypto');

/**
 * SHA-256 of a CIN string — normalised to uppercase, trimmed.
 * Returns a 0x-prefixed hex string suitable for bytes32 on-chain.
 */
function hashCIN(cin) {
  return '0x' + crypto
    .createHash('sha256')
    .update(cin.trim().toUpperCase())
    .digest('hex');
}

module.exports = { hashCIN };
