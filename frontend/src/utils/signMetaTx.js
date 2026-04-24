// ============================================================
//  signMetaTx.js — EIP-2771 / EIP-712 Gasless Voting Helper
//  Used by Vote.js to relay transactions without ETH in wallet.
//
//  Flow:
//    1. Fetch nonce from /api/relay/nonce/:address
//    2. ABI-encode the function call (vote / commitVote / etc.)
//    3. Build a ForwardRequest struct
//    4. Sign it with EIP-712 typed data via MetaMask (no gas!)
//    5. POST { request, signature } to /api/relay
//    6. Backend (relayer) executes on-chain and returns txHash
// ============================================================

import { ethers } from 'ethers';
import axios       from 'axios';

const API              = process.env.REACT_APP_API_URL      || 'http://localhost:3001/api';
const FORWARDER_ADDRESS = process.env.REACT_APP_FORWARDER_ADDRESS;
const CONTRACT_ADDRESS  = process.env.REACT_APP_CONTRACT_ADDRESS;

// ── ABI fragment used only for calldata encoding ────────────
const IFACE = new ethers.Interface([
  'function vote(uint256 electionId, uint256 candidateId) external',
  'function commitVote(uint256 electionId, bytes32 commitment) external',
  'function revealVote(uint256 electionId, uint256 candidateId, bytes32 secret) external',
  'function delegate(uint256 electionId, address to) external',
  'function voteFor(uint256 electionId, address delegator, uint256 candidateId) external',
]);

// ── EIP-712 types ────────────────────────────────────────────
const TYPES = {
  ForwardRequest: [
    { name: 'from',  type: 'address' },
    { name: 'to',    type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas',   type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data',  type: 'bytes'   },
  ],
};

/**
 * Sign a CivicChain function call with EIP-712 and POST it to the relay.
 *
 * @param {ethers.Signer} signer       — MetaMask signer (already connected)
 * @param {string}        fnName       — 'vote' | 'commitVote' | 'revealVote' | 'delegate'
 * @param {Array}         args         — function arguments matching the ABI above
 * @param {number}        [gasLimit]   — override gas limit (default 350_000)
 * @returns {Promise<string>}          — on-chain transaction hash
 */
export async function signAndRelay(signer, fnName, args, gasLimit = 350_000) {
  if (!FORWARDER_ADDRESS) {
    throw new Error('REACT_APP_FORWARDER_ADDRESS is not set. Did you run deploy.js?');
  }
  if (!CONTRACT_ADDRESS) {
    throw new Error('REACT_APP_CONTRACT_ADDRESS is not set. Did you run deploy.js?');
  }

  const signerAddress = await signer.getAddress();
  const network       = await signer.provider.getNetwork();
  const chainId       = Number(network.chainId);

  // 1. Get nonce from relay backend
  const nonceRes = await axios.get(`${API}/relay/nonce/${signerAddress}`);
  if (!nonceRes.data.success) {
    throw new Error('Could not fetch relay nonce: ' + nonceRes.data.message);
  }
  const nonce = Number(nonceRes.data.nonce);

  // 2. Encode the function calldata
  const data = IFACE.encodeFunctionData(fnName, args);

  // 3. Build ForwardRequest
  const request = {
    from:  signerAddress,
    to:    CONTRACT_ADDRESS,
    value: 0,
    gas:   gasLimit,
    nonce: nonce,
    data:  data,
  };

  // 4. EIP-712 domain
  const domain = {
    name:              'MinimalForwarder',
    version:           '1',
    chainId:           chainId,
    verifyingContract: FORWARDER_ADDRESS,
  };

  // 5. Sign with MetaMask — no gas fee for the user!
  //    ethers v6 uses signer.signTypedData() (was _signTypedData in v5)
  const signature = await signer.signTypedData(domain, TYPES, request);

  console.log(`⚡ Relay: ${fnName}(${args.join(', ')})  nonce=${nonce}`);

  // 6. Send to relay backend
  const relayRes = await axios.post(`${API}/relay`, { request, signature });
  if (!relayRes.data.success) {
    throw new Error(relayRes.data.message || 'Relay failed');
  }

  console.log('✅ Relay txHash:', relayRes.data.txHash);
  return relayRes.data.txHash;
}
