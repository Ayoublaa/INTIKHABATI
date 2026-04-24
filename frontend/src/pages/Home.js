// Home.js v2 — multi-election landing page
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import StatusBadge    from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function Home() {
  const [lang,      setLang]      = useState('fr');
  const [elections, setElections] = useState([]);
  const [summary,   setSummary]   = useState({ open: 0, upcoming: 0, closed: 0, totalVotes: 0 });

  useEffect(() => {
    axios.get(`${API}/elections`)
      .then(r => {
        const list = r.data.elections || [];
        setElections(list);
        setSummary({
          open:       list.filter(e => Number(e.status) === 1).length,
          upcoming:   list.filter(e => Number(e.status) === 0).length,
          closed:     list.filter(e => Number(e.status) === 2).length,
          totalVotes: list.reduce((s, e) => s + Number(e.totalVotes || 0), 0),
        });
      })
      .catch(() => {});
  }, []);

  const openElections = elections.filter(e => Number(e.status) === 1).slice(0, 3);

  const features = [
    { icon: '⛓', title: 'Immuable',   desc: 'Chaque vote est gravé définitivement sur la blockchain Ethereum.' },
    { icon: '🔒', title: 'Anonyme',    desc: 'Votre CIN est hashé en SHA-256. Personne ne peut lier votre identité à votre vote.' },
    { icon: '🔍', title: 'Auditable',  desc: 'Tout le monde peut vérifier les résultats. Zéro autorité centrale.' },
    { icon: '🛡',  title: 'Anti-fraude', desc: 'Score de risque, rate limiting et smart contract sécurisé par élection.' },
  ];

  const CATEGORY_ICONS = {
    0: '🏛', 1: '📜', 2: '🏙', 3: '🗺', 4: '📋',
  };
  const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];

  return (
    <div style={{ paddingTop: 64, minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '88vh', textAlign: 'center',
        padding: '2rem', position: 'relative',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,102,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* Logos */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', marginBottom: '1rem' }}>
            <div style={{
              width: 110, height: 110, borderRadius: '50%',
              border: '2px solid rgba(255,180,0,0.3)',
              boxShadow: '0 0 40px rgba(255,180,0,0.2), 0 0 80px rgba(255,180,0,0.08)',
              overflow: 'hidden', background: 'var(--bg2)',
            }}>
              <img src="/maroc.jpg" alt="Armoiries du Maroc" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{
              width: 110, height: 110, borderRadius: 16,
              overflow: 'hidden', background: 'var(--bg2)',
              border: '2px solid rgba(0,212,255,0.25)',
              boxShadow: '0 0 40px rgba(0,212,255,0.18), 0 0 80px rgba(0,212,255,0.06)',
            }}>
              <img src="/logo.png" alt="INTIKHABATI" style={{ width: '85%', height: '85%', objectFit: 'contain', margin: '7.5%' }} />
            </div>
          </div>

          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 'clamp(2.8rem, 7vw, 5rem)',
            lineHeight: 1, marginBottom: '0.4rem',
            background: 'linear-gradient(135deg, var(--text) 0%, var(--accent) 60%, var(--accent2) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-2px',
          }}>
            INTIKHABATI
          </h1>
          <div style={{
            fontFamily: 'serif', fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            color: 'var(--accent)', opacity: 0.7, letterSpacing: '0.05em',
            direction: 'rtl', marginBottom: '0.75rem',
          }}>
            انتخاباتي
          </div>
          <div style={{ width: 60, height: 2, margin: '0 auto 1.5rem',
            background: 'linear-gradient(90deg, transparent, rgba(255,180,0,0.6), transparent)' }} />
        </div>

        {/* Live badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--border2)', border: '1px solid var(--border)',
          borderRadius: 100, padding: '6px 18px', marginBottom: '1.5rem',
          fontSize: '0.7rem', color: 'var(--accent)', letterSpacing: '0.12em',
          position: 'relative', zIndex: 1,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            display: 'inline-block', boxShadow: '0 0 8px var(--green)' }} />
          ETHEREUM TESTNET · LIVE
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: '1rem', color: 'var(--muted)', maxWidth: 460,
          lineHeight: 1.8, marginBottom: '2.5rem',
          fontFamily: 'Syne, sans-serif', position: 'relative', zIndex: 1,
        }}>
          {lang === 'ar'
            ? 'منصة تصويت وطنية آمنة ومتعددة الانتخابات.'
            : lang === 'en'
            ? 'Secure multi-election national voting platform.'
            : 'Plateforme de vote national sécurisée multi-élections.'}<br />
          <span style={{ color: 'var(--accent)', opacity: 0.6, fontSize: '0.85rem' }}>
            Blockchain · Sécurité · Démocratie
          </span>
        </p>

        {/* Language toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
          {['ar', 'fr', 'en'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '5px 14px', borderRadius: 100, cursor: 'pointer',
              background: lang === l ? 'var(--border)' : 'var(--border2)',
              border: `1px solid ${lang === l ? 'var(--accent)' : 'var(--border2)'}`,
              color: lang === l ? 'var(--accent)' : 'var(--muted)',
              fontFamily: 'Syne', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <Link to="/elections" style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            color: '#fff', textDecoration: 'none', padding: '14px 36px',
            borderRadius: 4, fontWeight: 700, fontSize: '0.9rem',
            letterSpacing: '0.08em', fontFamily: 'Syne, sans-serif',
            boxShadow: '0 0 30px rgba(0,212,255,0.25)', transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            → Voir les élections
          </Link>
          <Link to="/verify" style={{
            background: 'transparent', color: 'var(--accent)', textDecoration: 'none',
            padding: '14px 36px', borderRadius: 4, fontWeight: 700,
            fontSize: '0.9rem', letterSpacing: '0.08em',
            border: '1px solid var(--border)',
            fontFamily: 'Syne, sans-serif', transition: 'border-color 0.2s, background 0.2s',
          }}>
            Vérifier un vote
          </Link>
        </div>

        {/* KPI strip */}
        <div style={{
          display: 'flex', gap: '4rem', marginTop: '4rem',
          borderTop: '1px solid var(--border2)', paddingTop: '2rem',
          position: 'relative', zIndex: 1, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { label: 'Élections ouvertes',  val: summary.open,       color: '#00ff88' },
            { label: 'À venir',             val: summary.upcoming,   color: '#ffb400' },
            { label: 'Terminées',           val: summary.closed,     color: 'var(--muted)' },
            { label: 'Votes exprimés',      val: summary.totalVotes, color: 'var(--cyan)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'Syne', fontWeight: 800, fontSize: '2rem', color,
              }}>{val}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)',
                letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 4 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── OPEN ELECTIONS ───────────────────────────────── */}
      {openElections.length > 0 && (
        <section style={{ padding: '3rem 1.5rem', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'Syne', fontWeight: 700 }}>
              🗳 Élections en cours
            </h2>
            <Link to="/elections" style={{ color: 'var(--cyan)', fontSize: '0.82rem', textDecoration: 'none' }}>
              Voir toutes →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
            {openElections.map(e => {
              const catLabel = CATEGORY_LABELS[Number(e.category)] || '';
              const icon     = CATEGORY_ICONS[Number(e.category)] || '🗳';
              const deadline = Number(e.deadline || 0);
              const reg      = Number(e.totalRegistered || 0);
              const votes    = Number(e.totalVotes || 0);
              const turnout  = reg > 0 ? ((votes / reg) * 100).toFixed(1) : '0';
              return (
                <Link key={e.id} to={`/elections/${e.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--bg2)', border: '1px solid rgba(0,255,136,0.25)',
                    borderRadius: 14, padding: '1.2rem', cursor: 'pointer',
                    transition: 'transform 0.15s, border-color 0.15s',
                  }}
                    onMouseEnter={e2 => { e2.currentTarget.style.transform = 'translateY(-2px)'; e2.currentTarget.style.borderColor = 'rgba(0,255,136,0.5)'; }}
                    onMouseLeave={e2 => { e2.currentTarget.style.transform = 'none'; e2.currentTarget.style.borderColor = 'rgba(0,255,136,0.25)'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                      <StatusBadge status="Open" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem', color: 'var(--text)' }}>
                      {e.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.8rem' }}>
                      {catLabel}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)' }}>
                      <span>{votes} votes · {turnout}%</span>
                      {deadline > 0 && (
                        <span style={{ color: 'var(--cyan)' }}>
                          <CountdownTimer deadline={deadline} />
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1px', background: 'var(--border2)',
        borderTop: '1px solid var(--border2)', borderBottom: '1px solid var(--border2)',
      }}>
        {features.map((f, i) => (
          <div key={i} style={{ padding: '2.5rem 2rem', background: 'var(--bg)', transition: 'background 0.3s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>{f.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </section>

    </div>
  );
}
