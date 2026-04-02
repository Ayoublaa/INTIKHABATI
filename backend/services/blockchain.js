// ============================================================
//  services/blockchain.js  – Interaction avec le Smart Contract
//  Utilise ethers.js v6 pour appeler registerVoter() on-chain
// ============================================================
const { ethers } = require("ethers");

// ABI minimal du contrat CivicChain (seulement les fonctions utilisées ici)
const CONTRACT_ABI = [
  "function registerVoter(address _voterAddress, bytes32 _idHash) external",
  "function getVoterStatus(address _voter) external view returns (bool, bool, uint256)",
  "function isIdHashRegistered(bytes32 _idHash) external view returns (bool)",
  "function getResults() external view returns (uint256[] memory, string[] memory, uint256[] memory)",
  "function votingOpen() external view returns (bool)",
  "function totalVotes() external view returns (uint256)",
  "function totalRegistered() external view returns (uint256)",
  "function getElectionInfo() external view returns (string, string, bool, uint256, uint256, uint256, bool)",
  "function getTimeRemaining() external view returns (uint256)",
  "event VoterRegistered(address indexed walletAddress, bytes32 indexed idHash, uint256 timestamp)",
  "event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp)",
];

// Connexion au réseau Ethereum (Hardhat local ou Testnet Sepolia)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Wallet owner (celui qui a déployé le contrat = admin)
const ownerWallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);

// Instance du contrat avec droits d'écriture
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ownerWallet
);

/**
 * Enregistre un électeur sur le smart contract
 * @param {string} walletAddress  Adresse MetaMask de l'électeur
 * @param {string} idHash         Hash SHA-256 du CIN (format bytes32)
 * @returns {string}              Hash de la transaction Ethereum
 */
async function registerVoterOnChain(walletAddress, idHash) {
  try {
    // idHash est un digest SHA-256 hexadécimal (64 chars, sans 0x).
    // Solidity attend un bytes32, donc on préfixe simplement avec "0x".
    const bytes32Hash = idHash.startsWith("0x") ? idHash : `0x${idHash}`;
    if (bytes32Hash.length !== 66) {
      throw new Error("idHash invalide (bytes32 attendu)");
    }

    const tx = await contract.registerVoter(walletAddress, bytes32Hash);
    console.log(`⏳ Transaction envoyée : ${tx.hash}`);

    // Attendre la confirmation (1 bloc)
    const receipt = await tx.wait(1);
    console.log(`✅ Électeur enregistré on-chain. Bloc : ${receipt.blockNumber}`);

    return tx.hash;
  } catch (error) {
    // Décoder les erreurs du smart contract (require)
    if (error.reason) {
      throw new Error(`Smart contract : ${error.reason}`);
    }
    throw new Error(`Erreur blockchain : ${error.message}`);
  }
}

/**
 * Vérifie le statut d'un électeur sur la blockchain
 * @param {string} walletAddress
 * @returns {{ isRegistered: boolean, hasVoted: boolean, timestamp: number }}
 */
async function getVoterStatusOnChain(walletAddress) {
  const [isRegistered, hasVoted, timestamp] = await contract.getVoterStatus(walletAddress);
  return {
    isRegistered,
    hasVoted,
    timestamp: Number(timestamp),
  };
}

/**
 * Récupère les résultats complets de l'élection
 * @returns {{ id, name, voteCount }[]}
 */
async function getElectionResults() {
  const [ids, names, voteCounts] = await contract.getResults();
  return ids.map((id, i) => ({
    id: Number(id),
    name: names[i],
    voteCount: Number(voteCounts[i]),
  }));
}

/**
 * Retourne les stats générales du contrat
 */
async function getContractStats() {
  const [votingOpen, totalVotes, totalRegistered, electionInfo, timeRemaining] = await Promise.all([
    contract.votingOpen(),
    contract.totalVotes(),
    contract.totalRegistered(),
    contract.getElectionInfo(),
    contract.getTimeRemaining(),
  ]);
  const [name, category, , deadline, , , deadlinePassed] = electionInfo;
  return {
    votingOpen: deadlinePassed ? false : votingOpen,
    totalVotes: Number(totalVotes),
    totalRegistered: Number(totalRegistered),
    electionName: name,
    electionCategory: category,
    votingDeadline: Number(deadline),
    timeRemaining: Number(timeRemaining),
  };
}

async function getElectionInfo() {
  const [name, category, isOpen, deadline, registered, votes, deadlinePassed] = await contract.getElectionInfo();
  return {
    electionName: name,
    electionCategory: category,
    votingOpen: isOpen,
    votingDeadline: Number(deadline),
    totalRegistered: Number(registered),
    totalVotes: Number(votes),
    deadlinePassed,
  };
}

async function getVotesPerHour(fromBlock = 0) {
  const currentBlock = await provider.getBlockNumber();
  const logs = await contract.queryFilter(contract.filters.VoteCast(), fromBlock, currentBlock);
  const buckets = new Map();
  // Cache pour éviter des appels provider répétitifs
  const blockTimestampCache = new Map();
  for (const log of logs) {
    let ts = blockTimestampCache.get(log.blockNumber);
    if (ts === undefined) {
      const block = await provider.getBlock(log.blockNumber);
      ts = block ? Number(block.timestamp) : 0;
      blockTimestampCache.set(log.blockNumber, ts);
    }
    if (!ts) continue;
    const hourKey = Math.floor(ts / 3600) * 3600;
    buckets.set(hourKey, (buckets.get(hourKey) || 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, votes]) => ({ hour, votes }));
}

async function getVoteEvents(fromBlock = 0, toBlock = "latest") {
  const endBlock = toBlock === "latest" ? await provider.getBlockNumber() : Number(toBlock);
  const logs = await contract.queryFilter(contract.filters.VoteCast(), fromBlock, endBlock);
  const blockTimestampCache = new Map();

  const events = [];
  for (const log of logs) {
    const voter = log.args.voter;
    const candidateId = Number(log.args.candidateId);
    const blockNumber = log.blockNumber;
    const txHash = log.transactionHash;

    let ts = blockTimestampCache.get(blockNumber);
    if (ts === undefined) {
      const block = await provider.getBlock(blockNumber);
      ts = block ? Number(block.timestamp) : 0;
      blockTimestampCache.set(blockNumber, ts);
    }

    events.push({ voter, candidateId, blockNumber, txHash, timestamp: ts });
  }

  return events;
}

module.exports = {
  registerVoterOnChain,
  getVoterStatusOnChain,
  getElectionResults,
  getContractStats,
  getElectionInfo,
  getVotesPerHour,
  getVoteEvents,
};
