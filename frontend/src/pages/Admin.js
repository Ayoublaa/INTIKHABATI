// Admin.js v3 — multi-election admin panel (owner only)
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API   = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const OWNER = (process.env.REACT_APP_OWNER_ADDRESS || '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266').toLowerCase();

const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
const STATUS_LABELS   = ['Upcoming', 'Open', 'Revealing', 'Closed']; // v3: 4 statuts
const CATEGORY_ICONS  = ['🏛', '📜', '🏙', '🗺', '📋'];

// Zones géographiques prédéfinies (basées sur les CINs du seed)
const GEO_ZONES = [
  { label: '🌍 Nationale — tout le Maroc',          value: '',               cities: [],            regions: [] },
  { label: '🏙 Casablanca uniquement',               value: 'Casablanca',     cities: ['Casablanca'],regions: [] },
  { label: '🏛 Rabat uniquement',                    value: 'Rabat',          cities: ['Rabat'],     regions: [] },
  { label: '🕌 Marrakech uniquement',                value: 'Marrakech',      cities: ['Marrakech'], regions: [] },
  { label: '🏰 Fès uniquement',                      value: 'Fès',            cities: ['Fès'],       regions: [] },
  { label: '🌿 Meknès uniquement',                   value: 'Meknès',         cities: ['Meknès'],    regions: [] },
  { label: '🌊 Agadir uniquement',                   value: 'Agadir',         cities: ['Agadir'],    regions: [] },
  { label: '⛵ Tanger uniquement',                   value: 'Tanger',         cities: ['Tanger'],    regions: [] },
  { label: '🌅 Oujda uniquement',                    value: 'Oujda',          cities: ['Oujda'],     regions: [] },
  { label: '📍 Région Fès-Meknès (Fès + Meknès)',   value: 'r:Fès-Meknès',   cities: [],            regions: ['Fès-Meknès'] },
  { label: '📍 Région Marrakech-Safi',               value: 'r:Marrakech-Safi', cities: [],          regions: ['Marrakech-Safi'] },
  { label: '📍 Région Casablanca-Settat',            value: 'r:Casablanca-Settat', cities: [],       regions: ['Casablanca-Settat'] },
  { label: '📍 Région Souss-Massa (Agadir)',         value: 'r:Souss-Massa',  cities: [],            regions: ['Souss-Massa'] },
  // ── Quartiers (districts) — Marrakech ──
  { label: '🏘 Guéliz uniquement (Marrakech)',       value: 'd:Guéliz',       cities: ['Marrakech'],  regions: [], districts: ['Guéliz'] },
  { label: '🏘 Ménara uniquement (Marrakech)',       value: 'd:Ménara',       cities: ['Marrakech'],  regions: [], districts: ['Ménara'] },
  { label: '🏘 Médina uniquement (Marrakech)',       value: 'd:Médina-Mkch',  cities: ['Marrakech'],  regions: [], districts: ['Médina'] },
];

const card = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 14, padding: '1.5rem', marginBottom: '1.2rem',
};
const inputStyle = {
  padding: '0.7rem', borderRadius: 8, width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', border: '1px solid var(--border2)',
  color: 'var(--text)', fontSize: '0.9rem',
};
const btn = (color = 'var(--cyan)') => ({
  padding: '0.65rem 1.4rem', borderRadius: 8, border: 'none',
  background: color, color: color === 'var(--cyan)' ? '#000' : '#fff',
  fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
});

function AdminWall({ onConnect }) {
  return (
    <div style={{ padding: '90px 1.5rem', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ ...card, borderColor: '#6b46c1', background: '#0d0720', padding: '2.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡</div>
        <h2 style={{ color: '#a855f7', marginTop: 0 }}>Admin Access Required</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
          This panel is restricted to the contract owner.<br />
          Connect the owner wallet to continue.
        </p>
        <button onClick={onConnect} style={{ ...btn(), background: '#6b46c1', color: '#fff', width: '100%', padding: '0.85rem' }}>
          🔗 Connect MetaMask
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();

  const [wallet,   setWallet]   = useState('');
  const [isOwner,  setIsOwner]  = useState(false);
  const [authLoad, setAuthLoad] = useState(true);
  const [elections,setElections]= useState([]);
  const [stats,    setStats]    = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');

  // Create election form
  const [newName,        setNewName]        = useState('');
  const [newCategory,    setNewCategory]    = useState(0);
  const [newDeadline,    setNewDeadline]    = useState('');
  const [newBlank,       setNewBlank]       = useState(true);
  const [newCommitReveal,setNewCommitReveal]= useState(false); // v3
  const [newGeoZone,    setNewGeoZone]    = useState('');     // geo restriction

  // Add candidate form
  const [selElection, setSelElection] = useState('');
  const [candName,    setCandName]    = useState('');
  const [candParty,   setCandParty]   = useState('');

  // Geo restriction form
  const [geoElection,   setGeoElection]   = useState(null); // electionId being edited
  const [geoRegions,    setGeoRegions]    = useState('');
  const [geoCities,     setGeoCities]     = useState('');
  const [geoDistricts,  setGeoDistricts]  = useState('');

  // Risk-score reset form
  const [riskWallet, setRiskWallet] = useState('');

  // ── Auth ──────────────────────────────────────────────────
  const checkOwner = useCallback((accounts) => {
    const addr = (accounts?.[0] || '').toLowerCase();
    setWallet(addr);
    setIsOwner(addr === OWNER);
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.ethereum) { setAuthLoad(false); return; }
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      checkOwner(accounts);
      setAuthLoad(false);
      window.ethereum.on('accountsChanged', checkOwner);
    })();
    return () => window.ethereum?.removeListener?.('accountsChanged', checkOwner);
  }, [checkOwner]);

  const handleConnect = async () => {
    if (!window.ethereum) return alert('Please install MetaMask');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    checkOwner(accounts);
  };

  // ── Load data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!isOwner) return;
    try {
      const headers = { 'x-wallet': wallet };
      const [eRes, dRes, sRes] = await Promise.all([
        axios.get(`${API}/elections`),
        axios.get(`${API}/admin/dashboard`,  { headers }),
        axios.get(`${API}/admin/settings`,   { headers }),
      ]);
      setElections(eRes.data.elections || []);
      setStats(dRes.data.stats);
      setSettings(sRes.data.settings);
    } catch {}
  }, [isOwner, wallet]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 20_000);
    return () => clearInterval(t);
  }, [loadData]);

  const adminHeaders = useMemo(() => ({ 'x-wallet': wallet }), [wallet]);
  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 4000); }

  // ── Actions ───────────────────────────────────────────────
  const createElection = async () => {
    if (!newName.trim()) return flash('⚠ Election name required');
    const deadline = newDeadline ? Math.floor(new Date(newDeadline).getTime() / 1000) : 0;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/elections`, {
        name:         newName.trim(),
        category:     Number(newCategory),
        deadline,
        enableBlank:  newBlank,
        commitReveal: newCommitReveal, // v3
      }, { headers: adminHeaders });
      if (res.data.success) {
        const newId = res.data.electionId;
        // Auto-save geo restriction if selected
        if (newGeoZone) {
          const zone = GEO_ZONES.find(z => z.value === newGeoZone);
          if (zone) {
            await axios.post(`${API}/admin/elections/${newId}/geo`, {
              allowedRegions:   zone.regions,
              allowedCities:    zone.cities,
              allowedDistricts: zone.districts || [],
            }, { headers: adminHeaders });
          }
        }
        const geoLabel = newGeoZone ? ` — ${GEO_ZONES.find(z=>z.value===newGeoZone)?.label || newGeoZone}` : ' — Nationale';
        flash(`✅ Election créée ! ID: ${newId}${newCommitReveal ? ' [🔒]' : ''}${geoLabel}`);
        setNewName(''); setNewDeadline(''); setNewCommitReveal(false); setNewGeoZone('');
        loadData();
      } else flash(`❌ ${res.data.message}`);
    } catch (err) {
      flash(`❌ ${err.response?.data?.message || err.message}`);
    } finally { setLoading(false); }
  };

  const addCandidate = async () => {
    if (!selElection) return flash('⚠ Select an election');
    if (!candName.trim()) return flash('⚠ Candidate name required');
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/admin/elections/${selElection}/candidate`,
        { name: candName.trim(), party: candParty.trim() },
        { headers: adminHeaders }
      );
      if (res.data.success) {
        flash(`✅ Candidat "${candName}" ajouté`);
        setCandName(''); setCandParty('');
        loadData();
      } else flash(`❌ ${res.data.message}`);
    } catch (err) {
      flash(`❌ ${err.response?.data?.message || err.message}`);
    } finally { setLoading(false); }
  };

  const openElection = async (id) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/elections/${id}/open`, {}, { headers: adminHeaders });
      if (res.data.success) { flash(`✅ Election #${id} ouverte`); loadData(); }
      else flash(`❌ ${res.data.message}`);
    } catch (err) { flash(`❌ ${err.response?.data?.message || err.message}`); }
    finally { setLoading(false); }
  };

  // v3: start reveal phase for commit-reveal elections
  const startReveal = async (id) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/elections/${id}/reveal`, {}, { headers: adminHeaders });
      if (res.data.success) { flash(`✅ Phase de révélation démarrée pour #${id}`); loadData(); }
      else flash(`❌ ${res.data.message}`);
    } catch (err) { flash(`❌ ${err.response?.data?.message || err.message}`); }
    finally { setLoading(false); }
  };

  // Manual closing was removed — elections close automatically
  // via backend/services/autoCloseService.js when the deadline passes.

  const openGeoForm = (e) => {
    setGeoElection(e.id);
    setGeoRegions(  (e.geo?.allowedRegions  || []).join(', '));
    setGeoCities(   (e.geo?.allowedCities   || []).join(', '));
    setGeoDistricts((e.geo?.allowedDistricts|| []).join(', '));
  };

  const saveGeo = async (id) => {
    const parse = s => s.split(',').map(x => x.trim()).filter(Boolean);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin/elections/${id}/geo`, {
        allowedRegions:   parse(geoRegions),
        allowedCities:    parse(geoCities),
        allowedDistricts: parse(geoDistricts),
      }, { headers: adminHeaders });
      if (res.data.success) {
        flash(`✅ Zone sauvegardée — ${res.data.message}`);
        setGeoElection(null);
        loadData();
      } else flash(`❌ ${res.data.message}`);
    } catch (err) {
      flash(`❌ ${err.response?.data?.message || err.message}`);
    } finally { setLoading(false); }
  };

  const saveSettings = async (visibility) => {
    try {
      await axios.post(`${API}/admin/settings`, { resultsVisibility: visibility }, { headers: adminHeaders });
      setSettings(s => ({ ...s, resultsVisibility: visibility }));
      flash('✅ Paramètres sauvegardés');
    } catch {}
  };

  const resetRisk = async () => {
    if (!riskWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return flash('⚠ Adresse wallet invalide');
    }
    try {
      const res = await axios.post(`${API}/admin/reset-risk/${riskWallet}`, {}, { headers: adminHeaders });
      if (res.data.success) {
        flash(`✅ Score de risque réinitialisé — ${riskWallet.slice(0, 10)}...${riskWallet.slice(-6)}`);
        setRiskWallet('');
      } else flash(`❌ ${res.data.message}`);
    } catch (err) {
      flash(`❌ ${err.response?.data?.message || err.message}`);
    }
  };

  if (authLoad) return (
    <div style={{ padding: '90px 1rem', textAlign: 'center', color: 'var(--muted)' }}>
      Vérification du wallet...
    </div>
  );
  if (!isOwner) return <AdminWall onConnect={handleConnect} />;

  const statusColor = {
    Upcoming:  '#ffb400',
    Open:      '#00ff88',
    Revealing: '#a855f7',
    Closed:    '#ff6b6b',
  };

  return (
    <div style={{ padding: '90px 1.5rem 3rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.3rem' }}>⚙ Admin Panel</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
        Wallet: {wallet.slice(0, 10)}...{wallet.slice(-6)}
      </p>

      {/* Flash */}
      {msg && (
        <div style={{
          ...card, padding: '0.8rem 1.2rem',
          borderColor: msg.startsWith('✅') ? '#00ff8844' : '#ff6b6b44',
          color: msg.startsWith('✅') ? '#00ff88' : '#ff6b6b',
          marginBottom: '1rem',
        }}>
          {msg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total',       value: stats.total,           color: 'var(--cyan)' },
            { label: 'Open',        value: stats.open,            color: '#00ff88' },
            { label: 'Revealing',   value: stats.revealing || 0,  color: '#a855f7' },
            { label: 'Upcoming',    value: stats.upcoming,        color: '#ffb400' },
            { label: 'Closed',      value: stats.closed,          color: '#ff6b6b' },
            { label: 'Votes',       value: stats.totalVotes,      color: 'var(--cyan)' },
            { label: 'Inscrits',    value: stats.totalRegistered, color: '#a855f7' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 12, padding: '0.8rem 1.1rem',
              textAlign: 'center', flex: '1', minWidth: 80,
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.4rem', color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>

        {/* ── Create election ─────────────────────────────── */}
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>➕ Créer une élection</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <input style={inputStyle} placeholder="Nom de l'élection"
              value={newName} onChange={e => setNewName(e.target.value)} />
            <select style={inputStyle} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
              {CATEGORY_LABELS.map((l, i) => (
                <option key={i} value={i}>{CATEGORY_ICONS[i]} {l}</option>
              ))}
            </select>
            <input style={inputStyle} type="datetime-local"
              value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
              title="Laisser vide pour clôture manuelle" />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={newBlank} onChange={e => setNewBlank(e.target.checked)} />
              Autoriser le vote blanc
            </label>
            {/* Zone géographique */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>
                📍 Zone géographique
              </div>
              <select style={inputStyle} value={newGeoZone} onChange={e => setNewGeoZone(e.target.value)}>
                {GEO_ZONES.map(z => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </div>

            {/* v3: commit-reveal toggle */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.88rem', cursor: 'pointer',
              color: newCommitReveal ? '#a855f7' : 'var(--muted)',
            }}>
              <input type="checkbox" checked={newCommitReveal} onChange={e => setNewCommitReveal(e.target.checked)} />
              🔒 Mode Commit-Reveal (votes chiffrés)
            </label>
            {newCommitReveal && (
              <div style={{
                background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.75rem', color: '#a855f7',
              }}>
                Les votes seront chiffrés pendant la phase de vote. Vous devrez lancer la phase de révélation manuellement.
              </div>
            )}
            <button onClick={createElection} disabled={loading} style={btn()}>
              {loading ? 'Création...' : 'Créer l\'élection'}
            </button>
          </div>
        </div>

        {/* ── Add candidate ───────────────────────────────── */}
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>👤 Ajouter un candidat</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <select style={inputStyle} value={selElection} onChange={e => setSelElection(e.target.value)}>
              <option value="">— Choisir une élection —</option>
              {elections
                .filter(e => Number(e.status) === 0)
                .map(e => (
                  <option key={e.id} value={e.id}>
                    #{e.id} {e.name} {e.isCommitReveal ? '[🔒]' : ''}
                  </option>
                ))}
            </select>
            <input style={inputStyle} placeholder="Nom complet du candidat"
              value={candName} onChange={e => setCandName(e.target.value)} />
            <input style={inputStyle} placeholder="Parti / affiliation (optionnel)"
              value={candParty} onChange={e => setCandParty(e.target.value)} />
            <button onClick={addCandidate} disabled={loading} style={btn('#0066cc')}>
              {loading ? 'Ajout...' : 'Ajouter le candidat'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Elections list ────────────────────────────────── */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>🗳 Toutes les élections</h3>
        {elections.length === 0 ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>Aucune élection. Créez-en une ci-dessus.</p>
        ) : (
          elections.map(e => {
            const statusIdx = Number(e.status);
            const status    = STATUS_LABELS[statusIdx] || 'Unknown';
            const color     = statusColor[status] || '#888';
            return (
              <div key={e.id} style={{ padding: '0.9rem 0', borderBottom: '1px solid var(--border2)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: '0.7rem',
                }}>
                <div>
                  {/* Status badge */}
                  <span style={{
                    background: color + '22', color, border: `1px solid ${color}`,
                    borderRadius: 20, padding: '2px 10px', fontSize: '0.7rem',
                    fontWeight: 700, marginRight: '0.5rem',
                  }}>
                    {status}
                  </span>
                  {/* Commit-reveal badge */}
                  {e.isCommitReveal && (
                    <span style={{
                      background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                      border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: 20, padding: '2px 8px', fontSize: '0.68rem',
                      fontWeight: 700, marginRight: '0.5rem',
                    }}>
                      🔒 C-R
                    </span>
                  )}
                  <span style={{ fontWeight: 600 }}>#{e.id} {e.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    {CATEGORY_LABELS[Number(e.category)]} · {Number(e.candidateCount)} candidats · {Number(e.totalVotes)} votes
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* View button */}
                  <button onClick={() => navigate(`/elections/${e.id}`)}
                    style={{ ...btn('var(--bg)'), border: '1px solid var(--border2)', color: 'var(--text)' }}>
                    Voir
                  </button>

                  {/* Upcoming → Open */}
                  {statusIdx === 0 && (
                    <button onClick={() => openElection(e.id)} disabled={loading} style={btn('#00aa55')}>
                      Ouvrir
                    </button>
                  )}

                  {/* Open → Reveal (commit-reveal only) */}
                  {statusIdx === 1 && e.isCommitReveal && (
                    <button onClick={() => startReveal(e.id)} disabled={loading}
                      style={btn('#a855f7')}>
                      🕵️ Révéler
                    </button>
                  )}

                  {/* Closing is automatic — no manual button. */}

                  {/* Closed → Results */}
                  {statusIdx === 3 && (
                    <button onClick={() => navigate(`/elections/${e.id}/results`)} style={btn('#b8860b')}>
                      Résultats
                    </button>
                  )}

                  {/* Geo restriction button (non-closed only) */}
                  {statusIdx < 3 && (
                    <button onClick={() => geoElection === e.id ? setGeoElection(null) : openGeoForm(e)}
                      style={{ ...btn('var(--bg)'), border: '1px solid #0ea5e9', color: '#0ea5e9' }}>
                      📍 Zone
                    </button>
                  )}
                </div>
                </div>

                {/* Geo restriction inline form */}
              {geoElection === e.id && (
                <div style={{
                  background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: 10, padding: '1rem', marginTop: '0.7rem',
                }}>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#0ea5e9', fontWeight: 700 }}>
                    📍 Zone géographique — laisser vide = élection nationale
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3 }}>Régions (séparées par virgule)</div>
                      <input style={{ ...inputStyle, fontSize: '0.8rem' }}
                        placeholder="ex: Marrakech-Safi, Souss-Massa"
                        value={geoRegions} onChange={ev => setGeoRegions(ev.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3 }}>Villes</div>
                      <input style={{ ...inputStyle, fontSize: '0.8rem' }}
                        placeholder="ex: Marrakech, Agadir"
                        value={geoCities} onChange={ev => setGeoCities(ev.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 3 }}>Quartiers</div>
                      <input style={{ ...inputStyle, fontSize: '0.8rem' }}
                        placeholder="ex: Guéliz, Ménara"
                        value={geoDistricts} onChange={ev => setGeoDistricts(ev.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => saveGeo(e.id)} disabled={loading}
                      style={{ ...btn('#0ea5e9'), fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                      💾 Sauvegarder
                    </button>
                    <button onClick={() => setGeoElection(null)}
                      style={{ ...btn('var(--bg)'), border: '1px solid var(--border2)', color: 'var(--muted)', fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                      Annuler
                    </button>
                    {(e.geo?.allowedCities?.length > 0 || e.geo?.allowedRegions?.length > 0) && (
                      <span style={{ fontSize: '0.75rem', color: '#0ea5e9', alignSelf: 'center' }}>
                        Actuellement : {[...(e.geo.allowedCities || []), ...(e.geo.allowedRegions || [])].join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Results visibility ─────────────────────────────── */}
      {settings && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>👁 Visibilité des résultats</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Quand les électeurs peuvent-ils voir les résultats ?
          </p>
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
            {[
              { value: 'after_close',     label: '🔒 Après clôture uniquement' },
              { value: 'public',          label: '🌐 Toujours public (live)' },
              { value: 'registered_only', label: '🔐 Électeurs inscrits uniquement' },
            ].map(opt => (
              <button key={opt.value} onClick={() => saveSettings(opt.value)}
                style={{
                  padding: '0.6rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
                  background: settings.resultsVisibility === opt.value ? '#0066cc22' : 'var(--bg)',
                  color: settings.resultsVisibility === opt.value ? 'var(--cyan)' : 'var(--muted)',
                  border: `1px solid ${settings.resultsVisibility === opt.value ? 'var(--cyan)' : 'var(--border2)'}`,
                  fontWeight: settings.resultsVisibility === opt.value ? 700 : 400,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Security: Reset risk score ──────────────────────── */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>🛡 Réinitialiser le score de risque</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Remet le score de risque d'un wallet à 0 (en cas de faux positif).
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 300 }}
            placeholder="0x... (adresse du wallet)"
            value={riskWallet}
            onChange={e => setRiskWallet(e.target.value)}
          />
          <button onClick={resetRisk} style={btn('#0ea5e9')}>
            Réinitialiser le score
          </button>
        </div>
      </div>
    </div>
  );
}
