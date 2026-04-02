// ============================================================
//  services/emailService.js  – Notifications email INTIKHABATI
//  Dépendance : npm install nodemailer
// ============================================================
const nodemailer = require("nodemailer");

// ── Transporteur SMTP ────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Template de base ─────────────────────────────────────────
function wrapHTML(title, body) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <style>
    body  { background:#030b14; color:#e8f4ff; font-family:'Helvetica Neue',Arial,sans-serif; margin:0; padding:0; }
    .wrap { max-width:600px; margin:0 auto; padding:2rem; }
    .logo { text-align:center; margin-bottom:1.5rem; }
    .logo h1 { color:#00d4ff; font-size:1.8rem; margin:0; letter-spacing:.1em; }
    .logo .ar { color:#ffb400; font-size:1rem; direction:rtl; }
    .card { background:#0a1628; border:1px solid rgba(0,212,255,.15); border-radius:8px; padding:1.5rem; margin-bottom:1rem; }
    .label { font-size:.75rem; color:#4a7090; text-transform:uppercase; letter-spacing:.1em; margin-bottom:.25rem; }
    .val   { color:#e8f4ff; font-family:monospace; word-break:break-all; }
    .badge-green  { display:inline-block; background:rgba(0,255,136,.1); border:1px solid rgba(0,255,136,.3); color:#00ff88; padding:3px 12px; border-radius:100px; font-size:.75rem; }
    .badge-red    { display:inline-block; background:rgba(255,59,92,.1); border:1px solid rgba(255,59,92,.3); color:#ff3b5c; padding:3px 12px; border-radius:100px; font-size:.75rem; }
    .footer { text-align:center; font-size:.7rem; color:#2a4060; margin-top:2rem; padding-top:1rem; border-top:1px solid rgba(0,212,255,.08); }
    h2 { color:#00d4ff; margin-top:0; }
    a  { color:#00d4ff; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <h1>INTIKHABATI</h1>
    <div class="ar">انتخاباتي</div>
    <div style="font-size:.7rem;color:#4a7090;margin-top:.25rem;">Plateforme de Vote National Sécurisée — Blockchain Ethereum</div>
  </div>
  ${body}
  <div class="footer">
    INTIKHABATI · انتخاباتي · Blockchain Ethereum<br/>
    Ce message est automatique, ne pas répondre.<br/>
    <strong style="color:#4a7090">"Don't trust, verify"</strong>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
//  a) sendResultsEmail — envoyé à tous les électeurs à la clôture
// ============================================================
async function sendResultsEmail(voters, results) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const transporter = createTransporter();
  const winner = results.reduce((best, r) => r.voteCount > (best?.voteCount || 0) ? r : best, null);
  const totalVotes = results.reduce((s, r) => s + r.voteCount, 0);

  const resultsRows = results.map(r => `
    <div class="card" style="margin-bottom:.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:1rem;font-weight:700;">${r.name}</div>
          <div class="label">${r.voteCount} vote${r.voteCount > 1 ? 's' : ''}</div>
        </div>
        <div style="font-size:1.4rem;font-weight:800;color:#00d4ff;">${r.percentage}%</div>
      </div>
    </div>
  `).join('');

  for (const voter of voters) {
    if (!voter.email) continue;

    const txProof = voter.txHash
      ? `<div class="card">
          <div class="label">Votre preuve cryptographique</div>
          <div class="val" style="font-size:.75rem;">${voter.txHash}</div>
          <div style="margin-top:.5rem;">
            <a href="http://localhost:3000/verify" class="badge-green">🔍 Vérifier mon vote</a>
          </div>
        </div>`
      : '';

    const html = wrapHTML("Résultats officiels", `
      <h2>🗳 Résultats officiels de l'élection</h2>
      ${winner ? `<div class="card" style="border-color:rgba(0,255,136,.3)">
        <div class="label">Candidat en tête</div>
        <div style="font-size:1.2rem;font-weight:800;color:#00ff88;">★ ${winner.name}</div>
        <div class="label">${winner.voteCount} votes sur ${totalVotes} exprimés</div>
      </div>` : ''}
      <h3 style="color:#4a7090;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;">Tous les résultats</h3>
      ${resultsRows}
      ${txProof}
      <div class="card" style="background:rgba(0,212,255,.04);border-color:rgba(0,212,255,.1);">
        <div style="font-size:.8rem;color:#4a7090;line-height:1.7;">
          Ces résultats sont enregistrés de façon immuable sur la blockchain Ethereum.<br/>
          Vérifiez chaque vote individuellement sur <a href="http://localhost:3000/verify">localhost:3000/verify</a>
        </div>
      </div>
    `);

    try {
      await transporter.sendMail({
        from: `"INTIKHABATI 🇲🇦" <${process.env.EMAIL_USER}>`,
        to: voter.email,
        subject: "INTIKHABATI — Résultats officiels 🇲🇦",
        html,
      });
    } catch (e) {
      console.error(`❌ Email résultats failed for ${voter.email}:`, e.message);
    }
  }
}

// ============================================================
//  b) sendMilitaryAlert — envoyé à l'admin quand un militaire tente
// ============================================================
async function sendMilitaryAlert(wallet, cinHash, profession, city) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.ADMIN_EMAIL) return;

  const transporter = createTransporter();
  const timestamp = new Date().toLocaleString("fr-FR");

  const html = wrapHTML("Alerte Sécurité", `
    <div class="card" style="border-color:rgba(255,59,92,.4);">
      <div style="font-size:1.1rem;font-weight:800;color:#ff3b5c;margin-bottom:1rem;">
        🚨 Tentative d'inscription — Forces de sécurité
      </div>
      <div style="margin-bottom:.75rem;">
        <div class="label">Wallet</div>
        <div class="val">${wallet}</div>
      </div>
      <div style="margin-bottom:.75rem;">
        <div class="label">Hash CIN (SHA-256)</div>
        <div class="val">${cinHash}</div>
      </div>
      <div style="margin-bottom:.75rem;">
        <div class="label">Profession bloquée</div>
        <div class="val" style="color:#ff3b5c;">${profession}</div>
      </div>
      <div style="margin-bottom:.75rem;">
        <div class="label">Ville</div>
        <div class="val">${city}</div>
      </div>
      <div>
        <div class="label">Horodatage</div>
        <div class="val">${timestamp}</div>
      </div>
    </div>
    <div class="card" style="background:rgba(255,59,92,.05);border-color:rgba(255,59,92,.15);">
      <div style="font-size:.8rem;color:#ff3b5c;line-height:1.7;">
        ⚠ Cette tentative a été automatiquement bloquée et enregistrée dans la liste noire.<br/>
        Référence légale : Article 47 — Les membres des forces de sécurité ne sont pas autorisés à voter.
      </div>
    </div>
  `);

  try {
    await transporter.sendMail({
      from: `"INTIKHABATI Sécurité 🔒" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "🚨 ALERTE SÉCURITÉ — Tentative vote militaire",
      html,
    });
    console.log(`📧 Alerte militaire envoyée à ${process.env.ADMIN_EMAIL}`);
  } catch (e) {
    console.error("❌ Email alerte militaire failed:", e.message);
  }
}

// ============================================================
//  c) sendRegistrationConfirmation — envoyé à l'électeur après inscription
// ============================================================
async function sendRegistrationConfirmation(email, fullName, city, txHash) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !email) return;

  const transporter = createTransporter();

  const html = wrapHTML("Inscription confirmée", `
    <h2>✅ Votre inscription est confirmée</h2>
    <div class="card" style="border-color:rgba(0,255,136,.3);">
      <div style="margin-bottom:.75rem;">
        <div class="label">Électeur</div>
        <div style="font-size:1rem;font-weight:700;color:#00ff88;">${fullName}</div>
      </div>
      <div style="margin-bottom:.75rem;">
        <div class="label">Ville</div>
        <div class="val">${city}</div>
      </div>
      <div>
        <div class="label">Transaction d'inscription (on-chain)</div>
        <div class="val" style="font-size:.72rem;">${txHash}</div>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;color:#00d4ff;margin-bottom:.75rem;">📋 Instructions pour voter</div>
      <div style="font-size:.82rem;color:#4a7090;line-height:1.8;">
        1. Rendez-vous sur <a href="http://localhost:3000/vote">localhost:3000/vote</a><br/>
        2. Connectez votre wallet MetaMask<br/>
        3. Votre CIN est déjà enregistré — vous pouvez voter directement<br/>
        4. Votre vote est anonyme et immuable sur la blockchain<br/>
        5. Après votre vote, téléchargez votre reçu cryptographique sur <a href="http://localhost:3000/profile">localhost:3000/profile</a>
      </div>
    </div>
    <div class="card" style="background:rgba(0,212,255,.04);border-color:rgba(0,212,255,.08);">
      <div style="font-size:.75rem;color:#4a7090;line-height:1.6;">
        🔒 Votre CIN a été anonymisé par SHA-256 — jamais stocké en clair.<br/>
        ⛓ Ce vote est gravé définitivement sur la blockchain Ethereum.<br/>
        🔍 Vérifiez votre vote : <a href="http://localhost:3000/verify">localhost:3000/verify</a>
      </div>
    </div>
  `);

  try {
    await transporter.sendMail({
      from: `"INTIKHABATI 🇲🇦" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "✅ Inscription confirmée — INTIKHABATI",
      html,
    });
    console.log(`📧 Confirmation inscription envoyée à ${email}`);
  } catch (e) {
    console.error("❌ Email confirmation failed:", e.message);
  }
}

module.exports = {
  sendResultsEmail,
  sendMilitaryAlert,
  sendRegistrationConfirmation,
};
