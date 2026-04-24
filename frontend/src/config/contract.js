// ============================================================
//  config/contract.js  — CivicChain v3 (commit-reveal + signature)
// ============================================================

export const CONTRACT_ADDRESS =
  process.env.REACT_APP_CONTRACT_ADDRESS ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CONTRACT_ABI = [
  // ── Election management ───────────────────────────────────
  // v3: createElection takes a 5th bool (commitReveal)
  "function createElection(string,uint8,uint256,bool,bool) external returns (uint256)",
  "function addCandidate(uint256,string,string) external",
  "function openElection(uint256) external",
  "function startRevealPhase(uint256) external",
  "function closeElection(uint256) external",
  "function triggerAutoClose(uint256) external",

  // ── Voter actions ─────────────────────────────────────────
  "function registerVoter(uint256,address,bytes32) external",
  "function vote(uint256,uint256) external",
  "function delegate(uint256,address) external",
  "function voteFor(uint256,address,uint256) external",

  // ── v3: Commit-Reveal ─────────────────────────────────────
  "function commitVote(uint256,bytes32) external",
  "function revealVote(uint256,uint256,bytes32) external",

  // ── View: elections ───────────────────────────────────────
  "function electionCount() external view returns (uint256)",
  "function getElection(uint256) external view returns (tuple(uint256 id,string name,uint8 category,uint8 status,uint256 deadline,uint256 createdAt,uint256 totalVotes,uint256 totalRegistered,bool blankVoteEnabled,uint256 candidateCount,bool isCommitReveal))",
  "function getAllElections() external view returns (tuple(uint256 id,string name,uint8 category,uint8 status,uint256 deadline,uint256 createdAt,uint256 totalVotes,uint256 totalRegistered,bool blankVoteEnabled,uint256 candidateCount,bool isCommitReveal)[])",
  "function getCandidates(uint256) external view returns (tuple(uint256 id,string name,string party,uint256 voteCount,bool exists)[])",
  "function getElectionResults(uint256) external view returns (tuple(uint256 id,string name,string party,uint256 voteCount,bool exists)[],uint256,uint256)",
  "function getTimeRemaining(uint256) external view returns (uint256)",

  // ── View: voters ──────────────────────────────────────────
  "function getVoterStatus(uint256,address) external view returns (tuple(bool isRegistered,bool hasVoted,bool hasDelegated,address delegatedTo,bytes32 idHash,uint256 voteTimestamp))",
  "function getVoterElections(address) external view returns (uint256[])",
  "function isIdRegisteredInElection(uint256,bytes32) external view returns (bool)",
  "function getCommitRevealStatus(uint256,address) external view returns (bool committed,bool revealed,bytes32 commitment)",

  // ── v3 Events ─────────────────────────────────────────────
  "event ElectionCreated(uint256 indexed electionId, string name, uint8 category, uint256 deadline)",
  "event ElectionOpened(uint256 indexed electionId, uint256 timestamp)",
  "event ElectionClosed(uint256 indexed electionId, uint256 timestamp)",
  "event RevealPhaseStarted(uint256 indexed electionId, uint256 timestamp)",
  "event VoterRegistered(uint256 indexed electionId, address indexed voter, bytes32 indexed idHash)",
  "event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId, uint256 timestamp)",
  "event VoteCommitted(uint256 indexed electionId, address indexed voter)",
  "event VoteRevealed(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId)",
  "event VoteDelegated(uint256 indexed electionId, address indexed from, address indexed to)",
  "event VoteCastByProxy(uint256 indexed electionId, address indexed delegator, address indexed proxy, uint256 candidateId)",
  "event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string party)",
];

export const RPC_URL = "http://127.0.0.1:8545";
