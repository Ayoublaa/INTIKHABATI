/**
 * multisigService.js
 * ─────────────────────────────────────────────────────────────
 * Simulated Gnosis-Safe co-signing client for CivicChain.
 *
 * The backend holds all three owner keys (MULTISIG_OWNER_0_PK …
 * MULTISIG_OWNER_2_PK). Whenever an owner-gated call must run on
 * CivicChain, `callAsOwner(target, data)` performs the full
 * submit → confirm → execute cycle with two distinct signers,
 * so the 2-of-3 threshold is reached in a single request.
 *
 * The core helper exported here is `callAsOwner`. Higher-level
 * wrappers (`proposeTransaction`, `confirmTransaction`,
 * `executeIfReady`) are also exposed for ad-hoc admin tooling.
 * ─────────────────────────────────────────────────────────────
 */
const { ethers } = require('ethers');

// ── MultiSigWallet ABI (subset used by the backend) ──────────
const MULTISIG_ABI = [
  "function submitTransaction(address destination, uint256 value, bytes data) external returns (uint256 txId)",
  "function confirmTransaction(uint256 txId) external",
  "function executeTransaction(uint256 txId) external",
  "function transactionCount() external view returns (uint256)",
  "function required() external view returns (uint256)",
  "function isOwner(address) external view returns (bool)",
  "function isConfirmed(uint256 txId, address owner) external view returns (bool)",
  "function getTransaction(uint256 txId) external view returns (address destination, uint256 value, bytes data, bool executed, uint256 confirmations)",
  "event Submission(uint256 indexed txId, address indexed proposer, address destination, uint256 value, bytes data)",
  "event Confirmation(uint256 indexed txId, address indexed owner)",
  "event Execution(uint256 indexed txId, address indexed executor, bool success)",
];

// ── Provider / signer helpers ────────────────────────────────
function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
}

function getMultisigAddress() {
  const addr = process.env.MULTISIG_ADDRESS;
  if (!addr) throw new Error('MULTISIG_ADDRESS not set in .env');
  return addr;
}

/**
 * Returns a MultiSigWallet contract connected to owner #i.
 * Throws if the key is missing. Index must be 0, 1 or 2.
 */
function getMultisigAsOwner(ownerIndex) {
  const pkVar = `MULTISIG_OWNER_${ownerIndex}_PK`;
  const pk    = process.env[pkVar];
  if (!pk) throw new Error(`${pkVar} not set in .env`);
  const signer = new ethers.Wallet(pk, getProvider());
  return {
    contract: new ethers.Contract(getMultisigAddress(), MULTISIG_ABI, signer),
    signer,
  };
}

/** Read-only multisig view contract (no signer). */
function getMultisigRead() {
  return new ethers.Contract(getMultisigAddress(), MULTISIG_ABI, getProvider());
}


// =========================================================
//  LOW-LEVEL — submit / confirm / execute
// =========================================================

/**
 * Propose a transaction. Defaults to owner #0 as proposer.
 * @returns {Promise<{ txId: bigint, hash: string }>}
 */
async function proposeTransaction(target, data, { value = 0n, ownerIndex = 0 } = {}) {
  const { contract } = getMultisigAsOwner(ownerIndex);
  const tx  = await contract.submitTransaction(target, value, data);
  const rct = await tx.wait(1);

  // Pull the Submission event to get the tx id
  const iface = new ethers.Interface(MULTISIG_ABI);
  let txId = null;
  for (const log of rct.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'Submission') {
        txId = parsed.args.txId;
        break;
      }
    } catch { /* not a multisig log */ }
  }
  if (txId === null) throw new Error('Submission event not found');
  return { txId, hash: tx.hash };
}

/**
 * Confirm a pending tx as owner #ownerIndex.
 * Auto-executes once threshold is reached (see MultiSigWallet.confirmTransaction).
 */
async function confirmTransaction(txId, ownerIndex) {
  const { contract } = getMultisigAsOwner(ownerIndex);
  const tx  = await contract.confirmTransaction(txId);
  const rct = await tx.wait(1);
  return { hash: tx.hash, receipt: rct };
}

/** Manual execute (if auto-exec was skipped / reverted). */
async function executeIfReady(txId, ownerIndex = 0) {
  const { contract } = getMultisigAsOwner(ownerIndex);
  const tx  = await contract.executeTransaction(txId);
  const rct = await tx.wait(1);
  return { hash: tx.hash, receipt: rct };
}


// =========================================================
//  HIGH-LEVEL — one-shot owner call
// =========================================================

/**
 * Submit + confirm + (auto-)execute a single privileged call in one go.
 * Owner #0 proposes, owner #1 confirms — this alone clears the 2-of-3
 * threshold, and `MultiSigWallet.confirmTransaction` auto-executes.
 *
 * @param {string} target  CivicChain contract address
 * @param {string} data    ABI-encoded calldata (function selector + args)
 * @param {bigint} [value] Native-token amount to forward (default 0n)
 * @returns {Promise<{ txId: bigint, proposeHash: string, confirmHash: string }>}
 */
async function callAsOwner(target, data, value = 0n) {
  // ── Pre-flight: simulate the underlying CivicChain call AS IF it came
  //    from the multisig. If it's going to revert, surface the real reason
  //    NOW instead of paying 3 multisig gas fees only to hit
  //    "MultiSig: underlying call reverted" with no clue why.
  try {
    await getProvider().call({
      from: getMultisigAddress(),
      to:   target,
      data,
      value,
    });
  } catch (err) {
    // Extract the revert reason string from the RPC error payload.
    const reason =
         err.reason
      || err.shortMessage
      || err.info?.error?.data?.message
      || err.data?.message
      || err.message
      || 'unknown revert';
    const wrapped = new Error(`CivicChain call would revert: ${reason}`);
    wrapped.original = err;
    throw wrapped;
  }

  // Flow for a 2-of-3 wallet:
  //   owner 0 → submitTransaction            (confirmations = 0)
  //   owner 0 → confirmTransaction           (confirmations = 1)
  //   owner 1 → confirmTransaction           (confirmations = 2 → AUTO-EXEC)
  //
  // submitTransaction does NOT auto-confirm, so the proposer must
  // confirm too, otherwise we'd only have 1 confirmation total.
  const { txId, hash: proposeHash } = await proposeTransaction(target, data, { value, ownerIndex: 0 });
  await confirmTransaction(txId, 0);
  const second = await confirmTransaction(txId, 1);
  let execReceipt = second.receipt;        // this is the tx that auto-executed
  const confirmHash = second.hash;

  // Sanity check: ensure the transaction really executed
  const read = getMultisigRead();
  const [ , , , executed ] = await read.getTransaction(txId);
  if (!executed) {
    // Threshold might be > 2 in unusual deployments — escalate to owner #2
    const third = await confirmTransaction(txId, 2);
    execReceipt = third.receipt;
    // If STILL not executed (required > 3), try manual execute as last resort
    const [ , , , executedAfter ] = await read.getTransaction(txId);
    if (!executedAfter) {
      const manual = await executeIfReady(txId, 0);
      execReceipt = manual.receipt;
    }
  }
  return { txId, proposeHash, confirmHash, receipt: execReceipt };
}


module.exports = {
  MULTISIG_ABI,
  getMultisigAddress,
  getMultisigRead,
  getMultisigAsOwner,
  proposeTransaction,
  confirmTransaction,
  executeIfReady,
  callAsOwner,
};
