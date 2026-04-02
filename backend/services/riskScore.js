// ============================================================
//  services/riskScore.js  – Calcul du score de risque
//  Plus le score est élevé, plus la tentative est suspecte.
// ============================================================

/**
 * Calcule un score de risque entre 0 et 100
 * @param {Object} params
 * @param {number} params.attemptCount     - Nombre de tentatives avec ce CIN
 * @param {boolean} params.cinAlreadyUsed  - Ce CIN a déjà voté ?
 * @param {string[]} params.ipAddresses    - IPs depuis lesquelles ce CIN a été tenté
 * @param {string} params.currentIp        - IP actuelle de la requête
 * @param {boolean} params.walletAlreadyUsed - Ce wallet est déjà dans la DB ?
 * @returns {{ score: number, reasons: string[] }}
 */
function calculateRiskScore({
  attemptCount = 1,
  cinAlreadyUsed = false,
  ipAddresses = [],
  currentIp = "",
  walletAlreadyUsed = false,
}) {
  let score = 0;
  const reasons = [];

  // ── Règle 1 : CIN déjà utilisé pour voter ──────────────────
  if (cinAlreadyUsed) {
    score += 60;
    reasons.push("CIN déjà utilisé pour un vote précédent");
  }

  // ── Règle 2 : Wallet déjà enregistré avec un autre CIN ─────
  if (walletAlreadyUsed) {
    score += 50;
    reasons.push("Wallet déjà enregistré avec un autre CIN (multi-wallet détecté)");
  }

  // ── Règle 3 : Multiples tentatives avec ce même CIN ─────────
  if (attemptCount >= 3) {
    score += 20;
    reasons.push(`${attemptCount} tentatives détectées avec ce CIN`);
  } else if (attemptCount === 2) {
    score += 10;
    reasons.push("2ème tentative avec ce CIN");
  }

  // ── Règle 4 : Plusieurs IPs différentes pour ce même CIN ────
  const uniqueIps = new Set([...ipAddresses, currentIp]);
  if (uniqueIps.size >= 3) {
    score += 25;
    reasons.push(`${uniqueIps.size} adresses IP différentes pour ce CIN`);
  } else if (uniqueIps.size === 2) {
    score += 10;
    reasons.push("2 adresses IP différentes détectées pour ce CIN");
  }

  // ── Plafonnement à 100 ───────────────────────────────────────
  score = Math.min(score, 100);

  return { score, reasons };
}

/**
 * Détermine si une tentative doit être bloquée
 * Seuil : score >= 50 → BLOQUÉ
 */
function isHighRisk(score) {
  return score >= 50;
}

module.exports = { calculateRiskScore, isHighRisk };
