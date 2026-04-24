// ============================================================
//  relay.js — EIP-2771 Meta-Transaction Relay
//  POST /api/relay        — execute a signed ForwardRequest
//  GET  /api/relay/nonce/:address — get current nonce
// ============================================================
const express        = require('express');
const { ethers }     = require('ethers');
const { adminLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// ── MinimalForwarder ABI (only what the relay needs) ────────
const FORWARDER_ABI = [
  "function getNonce(address from) external view returns (uint256)",
  "function verify((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) external view returns (bool)",
  "function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) external payable returns (bool success, bytes returndata)",
];

// ── Provider / relayer wallet ────────────────────────────────
function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
}

function getRelayer() {
  // RELAYER_PRIVATE_KEY can be set separately; falls back to OWNER_PRIVATE_KEY
  const pk = process.env.RELAYER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;
  if (!pk) throw new Error('No relayer private key configured (RELAYER_PRIVATE_KEY or OWNER_PRIVATE_KEY)');
  return new ethers.Wallet(pk, getProvider());
}

function getForwarder(signerOrProvider) {
  const addr = process.env.FORWARDER_ADDRESS;
  if (!addr) throw new Error('FORWARDER_ADDRESS not set in .env');
  return new ethers.Contract(addr, FORWARDER_ABI, signerOrProvider);
}

// ── GET /api/relay/nonce/:address ───────────────────────────
router.get('/nonce/:address', async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }
    const forwarder = getForwarder(getProvider());
    const nonce     = await forwarder.getNonce(address);
    res.json({ success: true, nonce: nonce.toString() });
  } catch (err) {
    console.error('Relay nonce error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/relay ─────────────────────────────────────────
// Body: { request: ForwardRequest, signature: "0x..." }
router.post('/', adminLimiter, async (req, res) => {
  try {
    const { request, signature } = req.body;

    // ── Validate input ───────────────────────────────────────
    if (!request || !signature) {
      return res.status(400).json({ success: false, message: 'Missing request or signature' });
    }

    const requiredFields = ['from', 'to', 'value', 'gas', 'nonce', 'data'];
    for (const f of requiredFields) {
      if (request[f] === undefined || request[f] === null) {
        return res.status(400).json({ success: false, message: `Missing field: ${f}` });
      }
    }

    if (!ethers.isAddress(request.from)) {
      return res.status(400).json({ success: false, message: 'Invalid from address' });
    }

    // Guard: target must be the CivicChain contract
    const allowed = (process.env.CONTRACT_ADDRESS || '').toLowerCase();
    if (request.to.toLowerCase() !== allowed) {
      return res.status(403).json({ success: false, message: 'Relay only allowed to CivicChain' });
    }

    // Normalise BigInt fields (JSON sends numbers/strings)
    const req2771 = {
      from:  request.from,
      to:    request.to,
      value: BigInt(request.value  ?? 0),
      gas:   BigInt(request.gas    ?? 300000),
      nonce: BigInt(request.nonce),
      data:  request.data,
    };

    const relayer   = getRelayer();
    const forwarder = getForwarder(relayer);

    // ── Off-chain signature check ────────────────────────────
    const valid = await forwarder.verify(req2771, signature);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Signature verification failed' });
    }

    console.log(`⚡ Relay: ${request.from.slice(0, 10)}... → CivicChain  nonce=${request.nonce}`);

    // ── Execute on-chain (relayer pays gas) ──────────────────
    const gasLimit = req2771.gas + 100000n;
    const tx       = await forwarder.execute(req2771, signature, { gasLimit });
    const receipt  = await tx.wait(1);

    console.log(`✅ Relay success: ${receipt.hash}`);

    res.json({
      success:     true,
      txHash:      receipt.hash,
      blockNumber: receipt.blockNumber,
    });

  } catch (err) {
    console.error('❌ Relay execute error:', err.message || err);

    // Extract Solidity revert reason if available
    const reason =
      err.reason          ||
      err.shortMessage    ||
      err.data?.message   ||
      err.message         ||
      'Unknown relay error';

    res.status(500).json({ success: false, message: reason });
  }
});

module.exports = router;
