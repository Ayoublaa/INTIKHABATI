/**
 * Calculates a 0–100 risk score for a voter record.
 * Higher score = more suspicious activity.
 */
function calculateRiskScore(voter) {
  let score = 0;

  // Multiple distinct IPs — could indicate different physical locations
  const uniqueIPs = new Set(voter.ipAddresses || []);
  if (uniqueIPs.size > 3)  score += 20;
  if (uniqueIPs.size > 7)  score += 20;

  // Many registration attempts
  if ((voter.attemptCount || 1) > 3)  score += 15;
  if ((voter.attemptCount || 1) > 10) score += 25;

  // Registered in too many elections at once (unusual for a real voter)
  if ((voter.registeredElections || []).length > 8) score += 10;

  return Math.min(score, 100);
}

module.exports = { calculateRiskScore };
