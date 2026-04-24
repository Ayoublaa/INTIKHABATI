// History.js v2 — multi-election on-chain event log
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from '../config/contract';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function History() {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState('all');
  const [summary,   setSummary]   = useState(null);
  const [lastBlock, setLastBlock] = useState(null);

  const loadHistory = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      setLastBlock(currentBlock);

      // Fetch elections summary from backend
      try {
        const r = await axios.get(`${API}/elections`);
        const list = r.data.elections || [];
        setSummary({
          totalElections: list.length,
          open:           list.filter(e => Number(e.status) === 1).length,
          totalVotes:     list.reduce((s, e) => s + Number(e.totalVotes || 0), 0),
          totalReg:       list.reduce((s, e) => s + Number(e.totalRegistered || 0), 0),
        });
      } catch {}

      // v2 event filters
      const regFilter   = contract.filters.VoterRegistered();
      const voteFilter  = contract.filters.VoteCast();
      const delegFilter = contract.filters.VoteDelegated();
      const proxyFilter = contract.filters.VoteCastByProxy();

      const [regLogs, voteLogs, delegLogs, proxyLogs] = await Promise.all([
        contract.queryFilter(regFilter,   0, currentBlock).catch(() => []),
        contract.queryFilter(voteFilter,  0, currentBlock).catch(() => []),
        contract.queryFilter(delegFilter, 0, currentBlock).catch(() => []),
        contract.queryFilter(proxyFilter, 0, currentBlock).catch(() => []),
      ]);

      const allEvents = [];

      // Process registration events (v2: electionId, voter, idHash, timestamp)
      for (const log of regLogs) {
        allEvents.push({
          type:       'register',
          electionId: Number(log.args.electionId || 0),
          wallet:     log.args.voter,
          idHash:     log.args.idHash,
          block:      log.blockNumber,
          txHash:     log.transactionHash,
          timestamp:  Number(log.args.timestamp || 0),
        });
      }

      // Process vote events (v2: electionId, voter, candidateId, timestamp)
      for (const log of voteLogs) {
        allEvents.push({
          type:        'vote',
          electionId:  Number(log.args.electionId || 0),
          wallet:      log.args.voter,
          candidateId: Number(log.args.candidateId),
          block:       log.blockNumber,
          txHash:      log.transactionHash,
          timestamp:   Number(log.args.timestamp || 0),
        });
      }

      // Process delegation events (v2: electionId, from, to)
      for (const log of delegLogs) {
        allEvents.push({
          type:       'delegate',
          electionId: Number(log.args.electionId || 0),
          wallet:     log.args.from,
          to:         log.args.to,
          block:      log.blockNumber,
          txHash:     log.transactionHash,
          timestamp:  0,
        });
      }

      // Process proxy vote events (v2: electionId, voter, delegator)
      for (const log of proxyLogs) {
        allEvents.push({
          type:       'proxy',
          electionId: Number(log.args.electionId || 0),
          wallet:     log.args.voter,
          delegator:  log.args.delegator,
          block:      log.blockNumber,
          txHash:     log.transactionHash,
          timestamp:  0,
        });
      }

      allEvents.sort((a, b) => b.block - a.block);
      setEvents(allEvents);
      setError('');
    } catch (e) {
      console.error(e);
      setError('Impossible de lire la blockchain. Vérifiez que Hardhat node tourne.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    const t = setInterval(loadHistory, 15_000);
    return () => clearInterval(t);
  }, [loadHistory]);

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  function shortAddr(addr) {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  function shortHash(hash) {
    if (!hash) return '—';
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  const countByType = (type) => events.filter(e => e.type === type).length;

  const filterButtons = [
    { key: 'all',      label: '⬡ Tous',           color: 'var(--cyan)' },
    { key: 'register', label: '👤 Inscriptions',   color: '#a855f7' },
    { key: 'vote',     label: '🗳 Votes',           color: '#00ff88' },
    { key: 'delegate', label: '🤝 Délégations',    color: '#ffb400' },
    { key: 'proxy',    label: '📋 Proxy',           color: '#ff6b35' },
  ];

  return (
    <div style={{ padding: '90px 1rem 3rem', minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            Audit · Transparence · Multi-election
          </div>
          <h1 style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.8rem', margin: '0 0 0.3rem' }}>
            Historique <span style={{ color: 'var(--cyan)' }}>Blockchain</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0 }}>
            Événements lus directement depuis le smart contract · Bloc:{' '}
            <span style={{ color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>#{lastBlock}</span>
            {' '}·{' '}
            <Link to="/elections" style={{ color: 'var(--cyan)', fontSize: '0.75rem' }}>Voir les élections →</Link>
          </p>
        </div>

        {/* Summary KPIs from backend */}
        {summary && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
            gap: '1px', background: 'var(--border2)',
            border: '1px solid var(--border2)', borderRadius: 8,
            marginBottom: '1.5rem', overflow: 'hidden',
          }}>
            {[
              { label: 'Élections', val: summary.totalElections, color: 'var(--cyan)' },
              { label: 'Ouvertes',  val: summary.open,           color: '#00ff88' },
              { label: 'Inscrits',  val: summary.totalReg,       color: '#a855f7' },
              { label: 'Votes',     val: summary.totalVotes,     color: '#ffb400' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ padding: '1rem', background: 'var(--bg2)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.3rem', color }}>{val}</div>
                <div style={{ fontSize: '0.55rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* On-chain event stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: '1px', background: 'var(--border2)',
          border: '1px solid var(--border2)', borderRadius: 8,
          marginBottom: '1.5rem', overflow: 'hidden',
        }}>
          {[
            { label: 'Total événements', val: events.length,          color: 'var(--cyan)' },
            { label: 'Inscriptions',     val: countByType('register'), color: '#a855f7' },
            { label: 'Votes on-chain',   val: countByType('vote'),     color: '#00ff88' },
            { label: 'Délégations',      val: countByType('delegate'), color: '#ffb400' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ padding: '0.8rem', background: 'var(--bg)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.1rem', color }}>{val}</div>
              <div style={{ fontSize: '0.55rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 3 }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {filterButtons.map(({ key, label, color }) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: '6px 14px', borderRadius: 100, cursor: 'pointer',
              fontFamily: 'Syne', fontWeight: 700, fontSize: '0.7rem',
              letterSpacing: '0.05em', transition: 'all 0.2s',
              background: filter === key ? `${color}18` : 'var(--bg2)',
              border: `1px solid ${filter === key ? color : 'var(--border2)'}`,
              color: filter === key ? color : 'var(--muted)',
            }}>
              {label}
              {key !== 'all' && <span style={{ marginLeft: 5, opacity: 0.7 }}>({countByType(key)})</span>}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88',
              display: 'inline-block', boxShadow: '0 0 6px #00ff88' }} />
            Live · 15s
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⛓</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700 }}>Lecture de la blockchain...</div>
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)',
            borderRadius: 8, padding: '2rem', textAlign: 'center', color: '#ff6b6b',
          }}>
            ⚠ {error}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 8, padding: '3rem', textAlign: 'center', color: 'var(--muted)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📭</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700 }}>Aucun événement trouvé</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.map((ev, i) => (
              <EventRow key={i} ev={ev} shortAddr={shortAddr} shortHash={shortHash} formatTime={formatTime} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '2rem', padding: '1rem 1.25rem',
          background: 'rgba(0,212,255,0.03)', border: '1px solid var(--border2)',
          borderRadius: 8, fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.7,
        }}>
          🔍 Données lues <strong>directement depuis le smart contract</strong>.
          Chaque événement est <strong>immuable</strong> et vérifiable sur la page{' '}
          <Link to="/verify" style={{ color: 'var(--cyan)' }}>Vérifier</Link>.
        </div>

      </div>
    </div>
  );
}

function EventRow({ ev, shortAddr, shortHash, formatTime }) {
  const [hovered, setHovered] = useState(false);

  const config = {
    register: { icon: '👤', color: '#a855f7',  label: 'Inscription',  badge: 'REGISTER' },
    vote:     { icon: '🗳',  color: '#00ff88',  label: null,           badge: 'VOTE'     },
    delegate: { icon: '🤝', color: '#ffb400',  label: null,           badge: 'DELEGATE' },
    proxy:    { icon: '📋', color: '#ff6b35',  label: null,           badge: 'PROXY'    },
  }[ev.type] || { icon: '⬡', color: 'var(--cyan)', label: ev.type, badge: ev.type.toUpperCase() };

  function getLabel() {
    if (ev.type === 'vote')     return ev.candidateId === 0 ? '🤍 Vote Blanc' : `Vote · Candidat #${ev.candidateId}`;
    if (ev.type === 'delegate') return `Délégation → ${shortAddr(ev.to)}`;
    if (ev.type === 'proxy')    return `Vote proxy pour ${shortAddr(ev.delegator)}`;
    return config.label || ev.type;
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid', gridTemplateColumns: '32px 1fr auto',
        gap: '1rem', alignItems: 'center',
        padding: '0.85rem 1rem',
        background: hovered ? 'var(--bg2)' : 'var(--bg)',
        border: '1px solid var(--border2)',
        borderRadius: 6, transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: `${config.color}18`, border: `1px solid ${config.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem', flexShrink: 0,
      }}>
        {config.icon}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.82rem', color: config.color }}>
            {getLabel()}
          </span>
          <span style={{
            fontSize: '0.55rem', padding: '2px 7px', borderRadius: 100,
            background: `${config.color}18`, border: `1px solid ${config.color}33`, color: config.color,
          }}>
            {config.badge}
          </span>
          {ev.electionId > 0 && (
            <Link to={`/elections/${ev.electionId}`} style={{
              fontSize: '0.6rem', color: 'var(--cyan)', textDecoration: 'none',
              padding: '2px 6px', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 100,
            }}>
              Élection #{ev.electionId}
            </Link>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'JetBrains Mono', flexWrap: 'wrap' }}>
          <span title={ev.wallet}>👛 {shortAddr(ev.wallet)}</span>
          {ev.to        && <span title={ev.to}>→ {shortAddr(ev.to)}</span>}
          {ev.delegator && <span title={ev.delegator}>via {shortAddr(ev.delegator)}</span>}
          <span title={ev.txHash}>TX {shortHash(ev.txHash)}</span>
          <span>Bloc #{ev.block}</span>
        </div>
      </div>

      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right', fontFamily: 'JetBrains Mono', flexShrink: 0 }}>
        {ev.timestamp ? formatTime(ev.timestamp) : `Bloc #${ev.block}`}
      </div>
    </div>
  );
}
