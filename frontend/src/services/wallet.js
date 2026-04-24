import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../config/contract';

// ── Provider lecture seule (sans MetaMask) ─────────────────
function getReadProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

// ── Contrat en lecture seule OU avec signer ─────────────────
export function getContract(signer) {
  const signerOrProvider = signer || getReadProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ── Connexion MetaMask ──────────────────────────────────────
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask n'est pas installé. Installez-le sur metamask.io");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer  = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

// ── Voter ───────────────────────────────────────────────────
export async function castVote(signer, candidateId) {
  const contract = getContract(signer);
  const tx = await contract.vote(candidateId);
  await tx.wait(1);
  return tx.hash;
}

// ── Déléguer son vote ───────────────────────────────────────
export async function delegate(signer, toAddress) {
  const contract = getContract(signer);
  const tx = await contract.delegate(toAddress);
  await tx.wait(1);
  return tx.hash;
}

// ── Voter par proxy (pour un délégateur) ───────────────────
export async function voteFor(signer, delegatorAddress, candidateId) {
  const contract = getContract(signer);
  const tx = await contract.voteFor(delegatorAddress, candidateId);
  await tx.wait(1);
  return tx.hash;
}

// ── Statut électeur ─────────────────────────────────────────
export async function getVoterStatus(provider, walletAddress) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  const [isRegistered, hasVoted, timestamp] = await contract.getVoterStatus(walletAddress);
  return { isRegistered, hasVoted, timestamp: Number(timestamp) };
}

// ── Résultats ───────────────────────────────────────────────
export async function getResults(provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider || getReadProvider());
  const [ids, names, voteCounts] = await contract.getResults();
  const total = voteCounts.reduce((s, v) => s + Number(v), 0);
  return ids.map((id, i) => ({
    id:         Number(id),
    name:       names[i],
    voteCount:  Number(voteCounts[i]),
    percentage: total > 0 ? ((Number(voteCounts[i]) / total) * 100).toFixed(1) : "0.0",
  }));
}

// ── Votes blancs ────────────────────────────────────────────
export async function getBlankVotes(provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider || getReadProvider());
  try {
    const count = await contract.getBlankVotes();
    return Number(count);
  } catch(e) {
    return 0;
  }
}

// ── Vote blanc activé ? ─────────────────────────────────────
export async function isBlankVoteEnabled(provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider || getReadProvider());
  try {
    return await contract.blankVoteEnabled();
  } catch(e) {
    return false;
  }
}

// ── Info élection ────────────────────────────────────────────
export async function getElectionInfo(provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider || getReadProvider());
  const [name, category, isOpen, deadline, registered, votes, blankEnabled] = await contract.getElectionInfo();
  const remaining = await contract.getTimeRemaining();
  return {
    name,
    category,
    isOpen,
    deadline:        Number(deadline),
    totalRegistered: Number(registered),
    totalVotes:      Number(votes),
    timeRemaining:   Number(remaining),
    blankEnabled,
  };
}

// ── Statut wallet complet (inscription + vote + délégation) ──
export async function getWalletStatus(provider, walletAddress) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider || getReadProvider());
  const [isRegistered, hasVoted, timestamp] = await contract.getVoterStatus(walletAddress);
  let hasDelegated = false;
  let delegatedTo  = null;
  try {
    hasDelegated = await contract.hasDelegated(walletAddress);
    if (hasDelegated) delegatedTo = await contract.delegations(walletAddress);
  } catch(e) {}
  return {
    isRegistered,
    hasVoted,
    timestamp:   Number(timestamp),
    hasDelegated,
    delegatedTo,
  };
}
