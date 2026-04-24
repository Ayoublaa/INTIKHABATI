import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
const STATUS_LABELS   = ['Upcoming', 'Open', 'Revealing', 'Closed']; // v3: 4 statuts

function fmt(e) {
  return {
    ...e,
    id:              Number(e.id),
    categoryLabel:   CATEGORY_LABELS[Number(e.category)] || 'Unknown',
    statusLabel:     STATUS_LABELS[Number(e.status)]     || 'Unknown',
    deadline:        Number(e.deadline),
    createdAt:       Number(e.createdAt),
    totalVotes:      Number(e.totalVotes),
    totalRegistered: Number(e.totalRegistered),
    candidateCount:  Number(e.candidateCount),
    isCommitReveal:  Boolean(e.isCommitReveal), // v3
  };
}

export function useElections(filter = {}) {
  const [elections, setElections] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const fetch = useCallback(async () => {
    try {
      const params = {};
      if (filter.status)   params.status   = filter.status;
      if (filter.category !== undefined) params.category = filter.category;
      const res = await axios.get(`${API}/elections`, { params });
      setElections((res.data.elections || []).map(fmt));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter.status, filter.category]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { elections, loading, error, refetch: fetch };
}

export function useElection(id) {
  const [election,   setElection]   = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const fetch = useCallback(async () => {
    if (!id) return;
    try {
      const [eRes, cRes, sRes] = await Promise.all([
        axios.get(`${API}/elections/${id}`),
        axios.get(`${API}/elections/${id}/candidates`),
        axios.get(`${API}/elections/${id}/stats`),
      ]);
      setElection(fmt(eRes.data.election));
      setCandidates(cRes.data.candidates || []);
      setStats(sRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 15_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { election, candidates, stats, loading, error, refetch: fetch };
}
