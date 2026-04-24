const { ethers } = require('ethers');

// v3 ABI — CivicChain with commit-reveal + 4-status enum
const ABI = [
  // ── Election lifecycle ──────────────────────────────────────
  // v3: 5th param = commitReveal bool
  "function createElection(string,uint8,uint256,bool,bool) external returns (uint256)",
  "function addCandidate(uint256,string,string) external",
  "function openElection(uint256) external",
  "function startRevealPhase(uint256) external",
  "function closeElection(uint256) external",
  "function triggerAutoClose(uint256) external",

  // ── Registration ────────────────────────────────────────────
  "function registerVoter(uint256,address,bytes32) external",

  // ── Voting ──────────────────────────────────────────────────
  "function vote(uint256,uint256) external",
  "function delegate(uint256,address) external",
  "function voteFor(uint256,address,uint256) external",

  // ── v3: Commit-Reveal ────────────────────────────────────────
  "function commitVote(uint256,bytes32) external",
  "function revealVote(uint256,uint256,bytes32) external",

  // ── Ownership ────────────────────────────────────────────────
  "function transferOwnership(address) external",

  // ── Views ───────────────────────────────────────────────────
  "function electionCount() external view returns (uint256)",
  "function owner() external view returns (address)",
  // v3: Election tuple includes isCommitReveal
  "function getElection(uint256) external view returns (tuple(uint256 id,string name,uint8 category,uint8 status,uint256 deadline,uint256 createdAt,uint256 totalVotes,uint256 totalRegistered,bool blankVoteEnabled,uint256 candidateCount,bool isCommitReveal))",
  "function getAllElections() external view returns (tuple(uint256 id,string name,uint8 category,uint8 status,uint256 deadline,uint256 createdAt,uint256 totalVotes,uint256 totalRegistered,bool blankVoteEnabled,uint256 candidateCount,bool isCommitReveal)[])",
  "function getCandidates(uint256) external view returns (tuple(uint256 id,string name,string party,uint256 voteCount,bool exists)[])",
  "function getElectionResults(uint256) external view returns (tuple(uint256 id,string name,string party,uint256 voteCount,bool exists)[],uint256,uint256)",
  "function getVoterStatus(uint256,address) external view returns (tuple(bool isRegistered,bool hasVoted,bool hasDelegated,address delegatedTo,bytes32 idHash,uint256 voteTimestamp))",
  "function getVoterElections(address) external view returns (uint256[])",
  "function isIdRegisteredInElection(uint256,bytes32) external view returns (bool)",
  "function getTimeRemaining(uint256) external view returns (uint256)",
  "function getCommitRevealStatus(uint256,address) external view returns (bool committed,bool revealed,bytes32 commitment)",

  // ── Events ──────────────────────────────────────────────────
  "event ElectionCreated(uint256 indexed electionId,string name,uint8 category,uint256 deadline)",
  "event ElectionOpened(uint256 indexed electionId,uint256 timestamp)",
  "event ElectionClosed(uint256 indexed electionId,uint256 timestamp)",
  "event RevealPhaseStarted(uint256 indexed electionId,uint256 timestamp)",
  "event VoteCast(uint256 indexed electionId,address indexed voter,uint256 indexed candidateId,uint256 timestamp)",
  "event VoteCommitted(uint256 indexed electionId,address indexed voter)",
  "event VoteRevealed(uint256 indexed electionId,address indexed voter,uint256 indexed candidateId)",
  "event VoterRegistered(uint256 indexed electionId,address indexed voter,bytes32 indexed idHash)",
  "event VoteDelegated(uint256 indexed electionId,address indexed from,address indexed to)",
  "event VoteCastByProxy(uint256 indexed electionId,address indexed delegator,address indexed proxy,uint256 candidateId)",
  "event CandidateAdded(uint256 indexed electionId,uint256 indexed candidateId,string name,string party)",
];

const IFACE = new ethers.Interface(ABI);

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
}

function getReadContract() {
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, getProvider());
}


// =========================================================
//  Write contract
//  -----------------------------------------------------------
//  Before: single OWNER_PRIVATE_KEY signer.
//  After : if MULTISIG_ADDRESS is configured, every onlyOwner
//          call is routed through the 2-of-3 MultiSigWallet
//          (see services/multisigService.js). Callers keep the
//          familiar `await writeContract.methodName(...args)`
//          ergonomics — the proxy below transparently performs
//          submit → confirm → execute under the hood.
//
//          If MULTISIG_ADDRESS is absent, we fall back to the
//          legacy single-signer mode for local scripts.
// =========================================================

function getDirectWriteContract() {
  const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, getProvider());
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, signer);
}

function getWriteContract() {
  if (!process.env.MULTISIG_ADDRESS) {
    return getDirectWriteContract();
  }

  // Lazy require so the multisig module is only loaded when needed.
  const { callAsOwner } = require('./multisigService');

  return new Proxy({}, {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined;

      // Expose a raw interface so controllers that need it still work.
      if (prop === 'interface') return IFACE;
      if (prop === 'target')    return process.env.CONTRACT_ADDRESS;
      if (prop === 'address')   return process.env.CONTRACT_ADDRESS;

      // Any method name is treated as a CivicChain function call and
      // routed through the MultiSigWallet.
      return async (...args) => {
        const data = IFACE.encodeFunctionData(prop, args);
        const { txId, proposeHash, confirmHash, receipt } = await callAsOwner(
          process.env.CONTRACT_ADDRESS,
          data,
        );
        // Return an object that mimics an ethers TransactionResponse
        // enough for existing code paths (hash, wait).
        //
        // Crucially, `wait()` returns the receipt of the multisig
        // transaction that auto-executed — its `.logs` array contains
        // BOTH the MultiSig events AND the inner CivicChain events
        // (ElectionCreated, VoterRegistered, …). Controllers that
        // parse logs to find e.g. the new election id keep working.
        return {
          hash:       confirmHash,
          proposeHash,
          txId:       Number(txId),
          multisig:   true,
          wait: async () => {
            // `receipt` already has .logs from the JSON-RPC call.
            // Inject helpful extras without breaking existing shape.
            return Object.assign({}, receipt, {
              status:       receipt?.status ?? 1,
              hash:         confirmHash,
              multisigTxId: Number(txId),
              logs:         receipt?.logs ?? [],
            });
          },
        };
      };
    },
  });
}

// ── MinimalForwarder ABI ─────────────────────────────────────
const FORWARDER_ABI = [
  "function getNonce(address from) external view returns (uint256)",
  "function domainSeparator() external view returns (bytes32)",
  "function verify((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) external view returns (bool)",
  "function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) external payable returns (bool success, bytes returndata)",
];

function getForwarderContract() {
  const addr = process.env.FORWARDER_ADDRESS;
  if (!addr) throw new Error('FORWARDER_ADDRESS not set in .env');
  return new ethers.Contract(addr, FORWARDER_ABI, getProvider());
}

function getForwarderWrite() {
  const addr = process.env.FORWARDER_ADDRESS;
  if (!addr) throw new Error('FORWARDER_ADDRESS not set in .env');
  const pk   = process.env.RELAYER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;
  const signer = new ethers.Wallet(pk, getProvider());
  return new ethers.Contract(addr, FORWARDER_ABI, signer);
}

module.exports = {
  ABI,
  IFACE,
  getProvider,
  getReadContract,
  getWriteContract,
  getDirectWriteContract,
  getForwarderContract,
  getForwarderWrite,
};
