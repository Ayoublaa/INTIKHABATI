const { getReadContract, getWriteContract } = require('../services/contractService');
const ElectionCache    = require('../models/ElectionCache');
const ActivityLog      = require('../models/ActivityLog');
const ElectionMeta     = require('../models/ElectionMeta');

const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
// v3: Closed is now index 3 (Upcoming=0, Open=1, Revealing=2, Closed=3)
const STATUS_LABELS   = ['Upcoming', 'Open', 'Revealing', 'Closed'];

function formatElection(e) {
  return {
    id:               Number(e.id),
    name:             e.name,
    category:         Number(e.category),
    categoryLabel:    CATEGORY_LABELS[Number(e.category)] || 'Unknown',
    status:           Number(e.status),
    statusLabel:      STATUS_LABELS[Number(e.status)] || 'Unknown',
    deadline:         Number(e.deadline),
    createdAt:        Number(e.createdAt),
    totalVotes:       Number(e.totalVotes),
    totalRegistered:  Number(e.totalRegistered),
    blankVoteEnabled: e.blankVoteEnabled,
    candidateCount:   Number(e.candidateCount),
    isCommitReveal:   e.isCommitReveal,  // v3
  };
}

// helper — attach geo restrictions from MongoDB to formatted elections
async function attachGeo(elections) {
  const metas = await ElectionMeta.find({ electionId: { $in: elections.map(e => e.id) } }).lean();
  const map   = {};
  metas.forEach(m => { map[m.electionId] = m; });
  return elections.map(e => ({
    ...e,
    geo: map[e.id]
      ? { allowedRegions: map[e.id].allowedRegions, allowedCities: map[e.id].allowedCities, allowedDistricts: map[e.id].allowedDistricts }
      : { allowedRegions: [], allowedCities: [], allowedDistricts: [] },
  }));
}

// GET /api/elections
exports.getAll = async (req, res) => {
  try {
    const contract = getReadContract();
    const raw      = await contract.getAllElections();
    let elections  = raw.map(formatElection);

    const statusFilter = req.query.status?.toLowerCase();
    if (statusFilter) {
      elections = elections.filter(e => e.statusLabel.toLowerCase() === statusFilter);
    }
    if (req.query.category !== undefined) {
      elections = elections.filter(e => e.category === Number(req.query.category));
    }
    elections = await attachGeo(elections);
    res.json({ success: true, elections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/elections/:id
exports.getOne = async (req, res) => {
  try {
    const id  = Number(req.params.id);
    const [raw, meta] = await Promise.all([
      getReadContract().getElection(id),
      ElectionMeta.findOne({ electionId: id }).lean(),
    ]);
    const election = formatElection(raw);
    election.geo = meta
      ? { allowedRegions: meta.allowedRegions, allowedCities: meta.allowedCities, allowedDistricts: meta.allowedDistricts }
      : { allowedRegions: [], allowedCities: [], allowedDistricts: [] };
    res.json({ success: true, election });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

// GET /api/elections/:id/candidates
exports.getCandidates = async (req, res) => {
  try {
    const id  = Number(req.params.id);
    const raw = await getReadContract().getCandidates(id);
    res.json({
      success:    true,
      candidates: raw.map(c => ({
        id:        Number(c.id),
        name:      c.name,
        party:     c.party,
        voteCount: Number(c.voteCount),
      })),
    });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

// GET /api/elections/:id/results
exports.getResults = async (req, res) => {
  try {
    const id       = Number(req.params.id);
    const contract = getReadContract();

    const ElectionSettings = require('../models/ElectionSettings');
    const settings         = await ElectionSettings.findOne();
    const visibility       = settings?.resultsVisibility || 'after_close';

    const election    = await contract.getElection(id);
    const statusLabel = STATUS_LABELS[Number(election.status)];

    // Results hidden during commit phase (Open) if visibility = after_close
    // But available during Revealing and Closed phases
    if (visibility === 'after_close' && statusLabel !== 'Closed' && statusLabel !== 'Revealing') {
      return res.json({
        success: true, restricted: true,
        message: 'Results will be published once the election closes.',
        election: formatElection(election),
        candidates: [], blankVotes: 0, totalVotes: 0,
      });
    }

    const [cands, blankVotes, totalVotes] = await contract.getElectionResults(id);
    const total = Number(totalVotes);

    res.json({
      success:    true,
      restricted: false,
      election:   formatElection(election),
      candidates: cands.map(c => ({
        id:         Number(c.id),
        name:       c.name,
        party:      c.party,
        voteCount:  Number(c.voteCount),
        percentage: total > 0 ? ((Number(c.voteCount) / total) * 100).toFixed(2) : '0.00',
      })),
      blankVotes: Number(blankVotes),
      totalVotes: total,
      turnout: Number(election.totalRegistered) > 0
        ? ((total / Number(election.totalRegistered)) * 100).toFixed(2) : '0.00',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/elections/:id/stats
exports.getStats = async (req, res) => {
  try {
    const id        = Number(req.params.id);
    const contract  = getReadContract();
    const election  = await contract.getElection(id);
    const remaining = await contract.getTimeRemaining(id);
    const nowWall   = Math.floor(Date.now() / 1000);
    const deadline  = Number(election.deadline);
    const realClosed = deadline > 0 && nowWall >= deadline;
    const status    = Number(election.status);

    res.json({
      success:       true,
      election:      formatElection(election),
      timeRemaining: realClosed ? 0 : Number(remaining),
      votingOpen:    (status === 1 || status === 2) && !realClosed, // Open or Revealing
      isRevealing:   status === 2,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections
exports.createElection = async (req, res) => {
  const { name, category, deadline, enableBlank, commitReveal } = req.body;
  try {
    const contract = getWriteContract();
    // v3: pass commitReveal as 5th arg
    const tx = await contract.createElection(
      name,
      Number(category),
      Number(deadline),
      enableBlank !== false,
      commitReveal === true
    );
    const receipt = await tx.wait(1);

    let newId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'ElectionCreated') { newId = Number(parsed.args[0]); break; }
      } catch {}
    }

    await ActivityLog.create({ type: 'ELECTION_CREATE', detail: `Created: ${name}`, severity: 'info' });
    res.json({ success: true, electionId: newId, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections/:id/candidate
exports.addCandidate = async (req, res) => {
  const id = Number(req.params.id);
  const { name, party } = req.body;
  try {
    const tx = await getWriteContract().addCandidate(id, name, party || '');
    await tx.wait(1);
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections/:id/open
exports.openElection = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const tx = await getWriteContract().openElection(id);
    await tx.wait(1);
    await ActivityLog.create({ type: 'ELECTION_OPEN', electionId: id, severity: 'info' });
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections/:id/reveal  — v3: start reveal phase
exports.startRevealPhase = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const tx = await getWriteContract().startRevealPhase(id);
    await tx.wait(1);
    await ActivityLog.create({
      type: 'ELECTION_OPEN', electionId: id,
      detail: 'Moved to reveal phase', severity: 'info',
    });
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections/:id/close
exports.closeElection = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const contract = getWriteContract();
    const tx = await contract.closeElection(id);
    await tx.wait(1);
    await ActivityLog.create({ type: 'ELECTION_CLOSE', electionId: id, severity: 'info' });

    // Archive to MongoDB
    const [cands, blankVotes, totalVotes] = await contract.getElectionResults(id);
    const election = await contract.getElection(id);
    const total    = Number(totalVotes);
    await ElectionCache.findOneAndUpdate(
      { electionId: id },
      {
        electionId:      id,
        name:            election.name,
        category:        CATEGORY_LABELS[Number(election.category)],
        status:          'Closed',
        closedAt:        new Date(),
        totalVotes:      total,
        totalRegistered: Number(election.totalRegistered),
        turnoutPct:      Number(election.totalRegistered) > 0
          ? Number(((total / Number(election.totalRegistered)) * 100).toFixed(2)) : 0,
        blankVotes:      Number(blankVotes),
        results: cands.map(c => ({
          id:         Number(c.id),
          name:       c.name,
          party:      c.party,
          voteCount:  Number(c.voteCount),
          percentage: total > 0 ? ((Number(c.voteCount) / total) * 100).toFixed(2) : '0.00',
        })),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/elections/history
exports.getHistory = async (req, res) => {
  try {
    const history = await ElectionCache.find().sort({ closedAt: -1 }).lean();
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/elections/:id/geo — set geographic restrictions
exports.setElectionGeo = async (req, res) => {
  const id = Number(req.params.id);
  const {
    allowedRegions   = [],
    allowedCities    = [],
    allowedDistricts = [],
  } = req.body;
  try {
    await ElectionMeta.findOneAndUpdate(
      { electionId: id },
      { allowedRegions, allowedCities, allowedDistricts },
      { upsert: true, new: true }
    );
    const label = allowedCities.length
      ? `Zone: ${allowedCities.join(', ')}`
      : allowedRegions.length
        ? `Région: ${allowedRegions.join(', ')}`
        : 'Nationale (aucune restriction)';
    await ActivityLog.create({
      type: 'ELECTION_CREATE', electionId: id,
      detail: `Geo restrictions updated — ${label}`, severity: 'info',
    });
    res.json({ success: true, message: label });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const raw      = await getReadContract().getAllElections();
    const elections = raw.map(formatElection);
    res.json({
      success: true,
      stats: {
        total:           elections.length,
        open:            elections.filter(e => e.statusLabel === 'Open').length,
        revealing:       elections.filter(e => e.statusLabel === 'Revealing').length,
        upcoming:        elections.filter(e => e.statusLabel === 'Upcoming').length,
        closed:          elections.filter(e => e.statusLabel === 'Closed').length,
        totalVotes:      elections.reduce((s, e) => s + e.totalVotes, 0),
        totalRegistered: elections.reduce((s, e) => s + e.totalRegistered, 0),
      },
      elections,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
