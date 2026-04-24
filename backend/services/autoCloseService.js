// ============================================================
//  autoCloseService.js
//  Polls ALL open elections every 15s.
//  Closes any whose real-world deadline has passed.
// ============================================================
const { getReadContract, getWriteContract, getProvider } = require('./contractService');
const ElectionCache = require('../models/ElectionCache');
const ActivityLog   = require('../models/ActivityLog');

const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
const POLL_INTERVAL   = 15_000; // 15 seconds

async function checkAndCloseExpired() {
  try {
    const contract = getReadContract();
    let elections;
    try {
      elections = await contract.getAllElections();
    } catch {
      return; // Contract not deployed yet — skip
    }

    const nowWall = Math.floor(Date.now() / 1000);

    for (const e of elections) {
      const id       = Number(e.id);
      const status   = Number(e.status);   // 1 = Open
      const deadline = Number(e.deadline);

      // Only process Open elections with an expired deadline
      if (status !== 1 || deadline === 0 || nowWall < deadline) continue;

      console.log(`⏰ [AUTO-CLOSE] Election #${id} "${e.name}" — deadline passed, closing...`);

      try {
        // In Hardhat dev mode: advance blockchain time to match wall clock
        if (process.env.NODE_ENV !== 'production') {
          const remaining = Number(await contract.getTimeRemaining(id));
          if (remaining > 0) {
            const provider = getProvider();
            await provider.send('evm_increaseTime', [remaining + 2]);
            await provider.send('evm_mine', []);
          }
        }

        const writeContract = getWriteContract();
        const tx = await writeContract.closeElection(id);
        await tx.wait(1);

        console.log(`✅ [AUTO-CLOSE] Election #${id} closed. TX: ${tx.hash}`);

        // Archive results to MongoDB
        const [cands, blankVotes, totalVotes] = await contract.getElectionResults(id);
        const total = Number(totalVotes);
        const blank = Number(blankVotes);
        const reg   = Number(e.totalRegistered);

        await ElectionCache.findOneAndUpdate(
          { electionId: id },
          {
            electionId:      id,
            name:            e.name,
            category:        CATEGORY_LABELS[Number(e.category)] || '',
            status:          'Closed',
            closedAt:        new Date(),
            totalVotes:      total,
            totalRegistered: reg,
            turnoutPct:      reg > 0 ? Number(((total / reg) * 100).toFixed(2)) : 0,
            blankVotes:      blank,
            results:         cands.map(c => ({
              id:         Number(c.id),
              name:       c.name,
              party:      c.party,
              voteCount:  Number(c.voteCount),
              percentage: total > 0 ? ((Number(c.voteCount) / total) * 100).toFixed(2) : '0.00',
            })),
          },
          { upsert: true, new: true }
        );

        await ActivityLog.create({
          type: 'ELECTION_CLOSE', electionId: id,
          detail: `Auto-closed at deadline`, severity: 'info',
        });

      } catch (closeErr) {
        // 'Election is not open' means it was already closed (race condition) — ignore
        if (!closeErr.message?.includes('not open')) {
          console.error(`❌ [AUTO-CLOSE] Error closing election #${id}:`, closeErr.message);
        }
      }
    }
  } catch (outerErr) {
    console.error('[AUTO-CLOSE] Poll error:', outerErr.message);
  }
}

function startAutoClose() {
  console.log(`🔄 Auto-close service started (interval: ${POLL_INTERVAL / 1000}s)`);
  setInterval(checkAndCloseExpired, POLL_INTERVAL);
  // Also run immediately on startup
  setTimeout(checkAndCloseExpired, 2000);
}

module.exports = { startAutoClose };
