import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API   = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const OWNER = (process.env.REACT_APP_OWNER_ADDRESS || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266').toLowerCase();

export default function Navbar() {
  const { pathname } = useLocation();

  const [block,     setBlock]     = useState(Math.floor(Math.random() * 9_999_999));
  const [scrolled,  setScrolled]  = useState(false);
  const [openCount, setOpenCount] = useState(0);

  // ── Wallet + role ─────────────────────────────────────────
  const [wallet,  setWallet]  = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    async function detectWallet() {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts[0]) {
          setWallet(accounts[0]);
          setIsOwner(accounts[0].toLowerCase() === OWNER);
        }
      } catch {}
    }
    detectWallet();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', accounts => {
        if (accounts[0]) {
          setWallet(accounts[0]);
          setIsOwner(accounts[0].toLowerCase() === OWNER);
        } else {
          setWallet(null);
          setIsOwner(false);
        }
      });
    }
  }, []);

  // ── Theme ────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('civicchain_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('civicchain_theme', theme);
  }, [theme]);

  // ── Simulated block counter ──────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setBlock(b => b + 1), 3000);
    return () => clearInterval(t);
  }, []);

  // ── Scroll shadow ────────────────────────────────────────
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── Open-election count pill ─────────────────────────────
  useEffect(() => {
    const load = () =>
      axios.get(`${API}/elections`, { params: { status: 1 } })
        .then(r => setOpenCount((r.data.elections || []).length))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const isDark = theme === 'dark';
  const navBg  = scrolled
    ? (isDark ? 'rgba(3,11,20,0.97)' : 'rgba(245,248,255,0.97)')
    : (isDark ? 'rgba(3,11,20,0.85)' : 'rgba(245,248,255,0.85)');

  // ── Nav links ────────────────────────────────────────────
  const publicLinks = [
    ['/',          'Accueil'],
    ['/elections', 'Élections'],
    ['/profile',   'Profil'],
    ['/verify',    'Vérifier'],
    ['/history',   'Historique'],
  ];
  const adminLinks = [
    ['/admin', 'Admin'],
  ];
  const links = isOwner ? [...publicLinks, ...adminLinks] : publicLinks;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.5rem', height: 64,
      background: navBg,
      backdropFilter: 'blur(24px)',
      borderBottom: isDark ? '1px solid rgba(0,212,255,0.08)' : '1px solid rgba(0,80,160,0.15)',
      boxShadow:    isDark ? 'none' : '0 2px 16px rgba(0,50,120,0.08)',
      transition: 'background 0.3s',
      gap: '0.75rem',
    }}>

      {/* ── Logo ── */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          border: '1.5px solid rgba(0,180,0,0.4)',
          boxShadow: '0 0 14px rgba(0,180,0,0.2)',
          background: 'var(--bg)',
        }}>
          <img src="/logo.png" alt="INTIKHABATI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em',
            background: isDark
              ? 'linear-gradient(135deg, #ffffff, #00d4ff)'
              : 'linear-gradient(135deg, #1a2a3a, #0066cc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>INTIKHABATI</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'serif', direction: 'rtl', marginTop: 1 }}>
            انتخاباتي
          </span>
        </div>
      </Link>

      {/* ── Links ── */}
      <ul style={{
        display: 'flex', gap: '1.1rem', listStyle: 'none', margin: 0, padding: 0,
        flexShrink: 1, minWidth: 0, overflow: 'hidden',
      }}>
        {links.map(([path, label]) => {
          const isAdmin  = ['/admin'].includes(path);
          const isActive = pathname === path || (path !== '/' && pathname.startsWith(path));
          return (
            <li key={path}>
              <Link to={path} style={{
                color:          isActive ? 'var(--accent)' : isAdmin ? '#a855f7' : 'var(--muted)',
                textDecoration: 'none', fontSize: '0.68rem',
                letterSpacing:  '0.08em', textTransform: 'uppercase',
                fontWeight:     isActive ? 700 : 500,
                borderBottom:   isActive
                  ? `1px solid ${isAdmin ? '#a855f7' : 'var(--accent)'}`
                  : '1px solid transparent',
                paddingBottom: 2, transition: 'color 0.2s',
                whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {label}
                {/* Live count badge on Elections link */}
                {path === '/elections' && openCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.4)',
                    fontSize: '0.55rem', color: '#00ff88', fontWeight: 700,
                    lineHeight: 1,
                  }}>{openCount}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ── Right side ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>

        {/* Block counter */}
        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: '0.62rem', color: 'var(--muted2)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: 'var(--border)' }}>⬡</span>
          #{block.toLocaleString()}
        </div>

        {/* Admin badge */}
        {isOwner && wallet && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 100,
            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)',
            fontSize: '0.6rem', fontFamily: 'JetBrains Mono', color: '#a855f7',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
            ADMIN · {wallet.slice(0, 6)}...{wallet.slice(-4)}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,60,140,0.08)',
            border:     isDark ? '1px solid rgba(0,212,255,0.18)' : '1px solid rgba(0,80,160,0.25)',
            borderRadius: 100, padding: '5px 10px 5px 7px',
            cursor: 'pointer', transition: 'all 0.25s', flexShrink: 0,
          }}>
          <span style={{ fontSize: '0.8rem', lineHeight: 1, userSelect: 'none' }}>
            {isDark ? '🌙' : '☀️'}
          </span>
          <div style={{
            position: 'relative', width: 34, height: 18, borderRadius: 999,
            background: isDark
              ? 'linear-gradient(90deg, rgba(0,212,255,0.15), rgba(0,212,255,0.3))'
              : 'linear-gradient(90deg, rgba(255,180,0,0.3), rgba(255,120,0,0.4))',
            transition: 'background 0.3s', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, left: isDark ? 2 : 16,
              width: 14, height: 14, borderRadius: '50%',
              background: isDark ? 'var(--accent)' : '#fff',
              boxShadow:  isDark ? '0 0 8px rgba(0,212,255,0.8)' : '0 1px 4px rgba(0,50,100,0.35)',
              transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
          <span style={{
            fontSize: '0.6rem', fontFamily: 'Syne, sans-serif', fontWeight: 700,
            letterSpacing: '0.06em', color: isDark ? 'var(--accent)' : '#0055cc', userSelect: 'none',
          }}>
            {isDark ? 'DARK' : 'LIGHT'}
          </span>
        </button>

      </div>
    </nav>
  );
}
