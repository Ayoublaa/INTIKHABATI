// api.js v2 — centralized API service
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API  = axios.create({ baseURL: BASE });

// ── Legacy (kept for backward compat with old pages) ──────
export async function verifyAndRegister(cin, walletAddress) {
  const { data } = await API.post('/voters/register', { cin, walletAddress, electionId: 1 });
  return data;
}

export async function getWalletStatus(wallet) {
  const { data } = await API.get(`/voters/verify/${wallet}`);
  return data;
}

// ── Elections ─────────────────────────────────────────────
export async function fetchElections(params = {}) {
  const { data } = await API.get('/elections', { params });
  return data;
}

export async function fetchElection(id) {
  const { data } = await API.get(`/elections/${id}`);
  return data.election;
}

export async function fetchResults(id) {
  if (id) {
    const { data } = await API.get(`/elections/${id}/results`);
    return data;
  }
  // Legacy: return results for all elections
  const elections = await fetchElections({ status: 2 });
  return elections;
}

// ── Stats / Dashboard ─────────────────────────────────────
export async function fetchStats() {
  // Return aggregated stats across all elections
  try {
    const { data } = await API.get('/admin/dashboard', {
      headers: { 'x-wallet': '0x0000000000000000000000000000000000000000' },
    });
    return data;
  } catch {
    // Fallback: build stats from elections list
    const electionsData = await fetchElections();
    const list = electionsData.elections || [];
    return {
      totalElections: list.length,
      openElections:  list.filter(e => Number(e.status) === 1).length,
      totalVotes:     list.reduce((s, e) => s + Number(e.totalVotes || 0), 0),
      totalRegistered: list.reduce((s, e) => s + Number(e.totalRegistered || 0), 0),
    };
  }
}

// ── Security ──────────────────────────────────────────────
export async function fetchSecurityMetrics(walletHeader) {
  const headers = walletHeader ? { 'x-wallet': walletHeader } : {};
  const { data } = await API.get('/admin/security/metrics', { headers });
  return data;
}

// ── Voters ───────────────────────────────────────────────
export async function registerVoter(electionId, cin, walletAddress) {
  const { data } = await API.post('/voters/register', { electionId, cin, walletAddress });
  return data;
}

export async function getVoterStatus(electionId, wallet) {
  const { data } = await API.get('/voters/status', { params: { electionId, wallet } });
  return data;
}
