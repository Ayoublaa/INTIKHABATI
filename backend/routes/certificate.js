// routes/certificate.js — v3: QR links to IPFS (if Pinata configured) or verify URL
const router   = require('express').Router();
const PDFDoc   = require('pdfkit');
const QRCode   = require('qrcode');
const { getReadContract } = require('../services/contractService');

const CATEGORY_LABELS = ['Presidential', 'Legislative', 'Municipal', 'Regional', 'Referendum'];
const STATUS_LABELS   = ['Upcoming', 'Open', 'Revealing', 'Closed'];
const FRONTEND_URL    = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── Upload election results JSON to Pinata IPFS ──────────────
async function pinToIPFS(electionId, electionName, candidates, totalVotes, blankVotes) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;

  const content = {
    platform:   'CivicChain — Intikhabati',
    electionId,
    electionName,
    timestamp:  new Date().toISOString(),
    totalVotes: Number(totalVotes),
    blankVotes: Number(blankVotes),
    results: candidates.map((c, i) => ({
      rank:      i + 1,
      name:      c.name,
      party:     c.party || '',
      voteCount: Number(c.voteCount),
      percentage: Number(totalVotes) > 0
        ? ((Number(c.voteCount) / Number(totalVotes)) * 100).toFixed(2)
        : '0.00',
    })),
  };

  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent:  content,
        pinataMetadata: { name: `civicchain-election-${electionId}-results` },
      }),
    });
    const data = await res.json();
    return data.IpfsHash || null;
  } catch {
    return null;
  }
}

// GET /api/certificate/:id
router.get('/:id', async (req, res) => {
  try {
    const id       = Number(req.params.id);
    const contract = getReadContract();

    const [election, [cands, blankVotes, totalVotes]] = await Promise.all([
      contract.getElection(id),
      contract.getElectionResults(id),
    ]);

    const eName   = election.name;
    const eCat    = CATEGORY_LABELS[Number(election.category)] || '';
    const eStatus = STATUS_LABELS[Number(election.status)] || '';
    const total   = Number(totalVotes);
    const blank   = Number(blankVotes);
    const reg     = Number(election.totalRegistered);

    // ── Block certificate if no votes cast ───────────────────
    if (total === 0) {
      return res.status(400).json({ success: false, message: 'Aucun vote — certificat indisponible' });
    }

    // ── Try to pin results to IPFS, fall back to verify URL ──
    const cid       = await pinToIPFS(id, eName, cands, total, blank);
    const verifyUrl = cid
      ? `https://ipfs.io/ipfs/${cid}`
      : `${FRONTEND_URL}/verify?election=${id}`;
    const qrLabel   = cid ? `IPFS: ${cid.slice(0, 20)}...` : 'Verify on blockchain';

    const qrBuffer  = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 180 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-election-${id}.pdf"`);
    if (cid) res.setHeader('X-IPFS-CID', cid);

    const doc = new PDFDoc({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header
    doc.rect(0, 0, 595, 100).fill('#0a1628');
    doc.fillColor('#00d4ff').fontSize(22).font('Helvetica-Bold')
       .text('INTIKHABATI', 0, 22, { align: 'center' });
    doc.fillColor('#aaaacc').fontSize(10).font('Helvetica')
       .text(`Official Election Certificate — Election #${id}`, 0, 52, { align: 'center' });
    doc.fillColor('#00d4ff').fontSize(9)
       .text(`Generated on ${new Date().toLocaleString()}`, 0, 72, { align: 'center' });

    doc.moveDown(4);

    // Election info
    doc.fillColor('#0a1628').fontSize(16).font('Helvetica-Bold').text(eName, { align: 'center' });
    doc.fillColor('#555').fontSize(10).font('Helvetica')
       .text(`${eCat} · Status: ${eStatus}`, { align: 'center' });

    // IPFS badge
    if (cid) {
      doc.moveDown(0.4);
      doc.fillColor('#7c3aed').fontSize(8).font('Helvetica-Bold')
         .text('✦ Résultats archivés sur IPFS — Immuables et vérifiables', { align: 'center' });
    }

    doc.moveDown(1.5);

    // KPI boxes
    const kpis = [
      { label: 'Registered', value: reg },
      { label: 'Votes Cast', value: total },
      { label: 'Blank Votes', value: blank },
      { label: 'Turnout', value: reg > 0 ? `${((total / reg) * 100).toFixed(1)}%` : 'N/A' },
    ];
    const boxW = 110, boxH = 55, startX = 50, y = doc.y;
    kpis.forEach((k, i) => {
      const x = startX + i * (boxW + 10);
      doc.rect(x, y, boxW, boxH).fill('#f0f4f8');
      doc.fillColor('#0066cc').fontSize(20).font('Helvetica-Bold')
         .text(String(k.value), x, y + 8, { width: boxW, align: 'center' });
      doc.fillColor('#666').fontSize(8).font('Helvetica')
         .text(k.label, x, y + 34, { width: boxW, align: 'center' });
    });

    doc.y = y + boxH + 20;
    doc.moveDown(1);

    // Results
    doc.fillColor('#0a1628').fontSize(12).font('Helvetica-Bold').text('Results by Candidate');
    doc.moveDown(0.5);
    cands.forEach((c, idx) => {
      const pct = total > 0 ? ((Number(c.voteCount) / total) * 100).toFixed(1) : '0.0';
      doc.fillColor('#333').fontSize(10).font('Helvetica')
         .text(`${idx + 1}. ${c.name}${c.party ? ' (' + c.party + ')' : ''} — ${c.voteCount} votes (${pct}%)`);
      const barW = (Number(c.voteCount) / (total || 1)) * 400;
      doc.rect(50, doc.y, barW, 6).fill('#00d4ff');
      doc.rect(50, doc.y, 400, 6).stroke('#e0e0e0');
      doc.moveDown(0.8);
    });

    doc.moveDown(1);

    // QR Code
    doc.fillColor('#0a1628').fontSize(10).font('Helvetica-Bold')
       .text(cid ? '⛓ Scan to verify on IPFS' : 'Scan to Verify on Blockchain', { align: 'center' });
    doc.fillColor('#888').fontSize(7).font('Helvetica')
       .text(qrLabel, { align: 'center' });
    doc.moveDown(0.3);
    doc.image(qrBuffer, (595 - 110) / 2, doc.y, { width: 110, height: 110 });
    doc.y += 120;
    doc.fillColor('#aaa').fontSize(7).font('Helvetica')
       .text(`Contract: ${process.env.CONTRACT_ADDRESS || 'N/A'}`, { align: 'center' });
    if (cid) {
      doc.fillColor('#7c3aed').fontSize(7).font('Helvetica')
         .text(`IPFS CID: ${cid}`, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
