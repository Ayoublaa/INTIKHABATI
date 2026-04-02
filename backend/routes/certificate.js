// ============================================================
//  routes/certificate.js  – Certificat PDF officiel
//  GET /api/certificate  → génère un PDF avec QR code blockchain
// ============================================================
const express = require('express');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { ethers } = require('ethers');

const router = express.Router();

const CONTRACT_ABI = [
  "function getResults() external view returns (uint256[] memory, string[] memory, uint256[] memory)",
  "function getBlankVotes() external view returns (uint256)",
  "function votingOpen() external view returns (bool)",
  "function totalVotes() external view returns (uint256)",
  "function totalRegistered() external view returns (uint256)",
  "function getElectionInfo() external view returns (string, string, bool, uint256, uint256, uint256, bool)",
];

function getContract() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// GET /api/certificate
router.get('/', async (req, res) => {
  try {
    const contract = getContract();

    // Lire les données depuis la blockchain
    const [
      resultsData,
      blankVotes,
      isOpen,
      electionInfo,
    ] = await Promise.all([
      contract.getResults(),
      contract.getBlankVotes(),
      contract.votingOpen(),
      contract.getElectionInfo(),
    ]);

    const [ids, names, counts] = resultsData;
    const [electionName, electionCategory, , deadline, totalRegistered, totalVotes] = electionInfo;

    const totalV   = Number(totalVotes);
    const totalR   = Number(totalRegistered);
    const blankN   = Number(blankVotes);
    const now      = new Date();
    const dateStr  = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr  = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const deadlineStr = Number(deadline) > 0
      ? new Date(Number(deadline) * 1000).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    const candidates = ids.map((id, i) => ({
      id:         Number(id),
      name:       names[i],
      voteCount:  Number(counts[i]),
      percentage: totalV > 0 ? ((Number(counts[i]) / totalV) * 100).toFixed(2) : '0.00',
    })).sort((a, b) => b.voteCount - a.voteCount);

    const participation = totalR > 0 ? ((totalV / totalR) * 100).toFixed(2) : '0.00';

    // QR code → adresse du smart contract (vérification blockchain)
    const qrUrl  = `${process.env.RPC_URL || 'http://127.0.0.1:8545'}`;
    const qrData = `INTIKHABATI CERTIFICAT\nContrat: ${process.env.CONTRACT_ADDRESS}\nElection: ${electionName}\nDate: ${dateStr}\nTotal votes: ${totalV}`;
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 160,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // ── Générer le PDF ────────────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title: `Certificat Officiel — ${electionName}`,
        Author: 'INTIKHABATI — Plateforme de Vote Blockchain',
        Subject: 'Résultats certifiés élection',
        Keywords: 'blockchain, vote, certificat, Maroc',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificat-${(electionName || 'election').replace(/\s+/g, '_')}.pdf"`);
    doc.pipe(res);

    const W = 595 - 120; // largeur utile
    const CYAN   = '#0066cc';
    const DARK   = '#0a1628';
    const GRAY   = '#4a5568';
    const LIGHT  = '#f7fafc';
    const GREEN  = '#1a7a4a';
    const GOLD   = '#b8860b';

    // ── Fond en-tête ─────────────────────────────────────────
    doc.rect(0, 0, 595, 130).fill(DARK);

    // Titre principal
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#00d4ff')
       .text('INTIKHABATI', 60, 30, { align: 'left' });
    doc.font('Helvetica').fontSize(9).fillColor('#aaaacc')
       .text('انتخاباتي  —  Plateforme de Vote Blockchain', 60, 56);

    // Type d'élection badge
    doc.roundedRect(60, 72, 180, 22, 4).fill('rgba(0,100,200,0.4)');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#00d4ff')
       .text(`${electionCategory || 'ÉLECTION'} NATIONALE 2026`, 68, 78);

    // Date + heure (coin droit)
    doc.font('Helvetica').fontSize(8).fillColor('#888aaa')
       .text(`Certifié le ${dateStr}`, 60, 102, { align: 'right', width: W })
       .text(`à ${timeStr}`, 60, 113, { align: 'right', width: W });

    // ── Titre certificat ─────────────────────────────────────
    doc.moveDown(0);
    doc.y = 148;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(DARK)
       .text('CERTIFICAT OFFICIEL DES RÉSULTATS', 60, 148, { align: 'center', width: W });

    doc.font('Helvetica').fontSize(11).fillColor(GRAY)
       .text(electionName || 'Élection Nationale', 60, 172, { align: 'center', width: W });

    // Ligne décorative
    doc.moveTo(60, 195).lineTo(535, 195).lineWidth(1.5).stroke(CYAN);

    // ── Résumé KPIs ───────────────────────────────────────────
    const kpiY = 210;
    const kpiW = 118;
    const kpis = [
      { label: 'Inscrits',       val: totalR.toString(),      color: CYAN  },
      { label: 'Votes exprimés', val: totalV.toString(),      color: GREEN },
      { label: 'Participation',  val: `${participation}%`,    color: GOLD  },
      { label: 'Votes blancs',   val: blankN.toString(),      color: GRAY  },
    ];
    kpis.forEach((k, i) => {
      const x = 60 + i * (kpiW + 10);
      doc.rect(x, kpiY, kpiW, 54).fill(LIGHT).stroke('#e2e8f0');
      doc.font('Helvetica-Bold').fontSize(18).fillColor(k.color)
         .text(k.val, x, kpiY + 8, { width: kpiW, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(k.label.toUpperCase(), x, kpiY + 34, { width: kpiW, align: 'center' });
    });

    // ── Résultats candidats ───────────────────────────────────
    let y = kpiY + 76;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK).text('RÉSULTATS PAR CANDIDAT', 60, y);
    doc.moveTo(60, y + 16).lineTo(535, y + 16).lineWidth(0.5).stroke('#cbd5e0');
    y += 24;

    candidates.forEach((c, i) => {
      const isWinner = i === 0 && c.voteCount > 0;
      const rowBg    = isWinner ? '#f0fff8' : (i % 2 === 0 ? LIGHT : '#ffffff');

      doc.rect(60, y, W, 36).fill(rowBg).stroke(isWinner ? '#9ae6b4' : '#e2e8f0');

      // Rang
      doc.font('Helvetica-Bold').fontSize(10).fillColor(isWinner ? GREEN : GRAY)
         .text(`#${i + 1}`, 68, y + 11);

      // Nom
      doc.font(isWinner ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(DARK)
         .text(c.name, 90, y + 11, { width: 200 });

      // Barre de progression
      const barW = 160;
      const barX = 295;
      const barH = 8;
      const fill  = Math.max(1, (c.voteCount / Math.max(1, totalV)) * barW);
      doc.rect(barX, y + 14, barW, barH).fill('#e2e8f0');
      doc.rect(barX, y + 14, fill, barH).fill(isWinner ? GREEN : CYAN);

      // % + votes
      doc.font('Helvetica-Bold').fontSize(10).fillColor(isWinner ? GREEN : DARK)
         .text(`${c.percentage}%`, 465, y + 11, { width: 50, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor(GRAY)
         .text(`${c.voteCount} votes`, 465, y + 23, { width: 50, align: 'right' });

      if (isWinner) {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(GREEN)
           .text('EN TÊTE', 68, y + 24);
      }

      y += 40;
    });

    // Votes blancs ligne séparée
    if (blankN > 0) {
      doc.rect(60, y, W, 30).fill('#f8f8f8').stroke('#e2e8f0');
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
         .text('∅  Vote Blanc (abstention constitutionnelle)', 90, y + 9)
         .text(`${blankN} votes`, 465, y + 9, { width: 50, align: 'right' });
      y += 34;
    }

    y += 16;

    // ── Vérification blockchain ───────────────────────────────
    doc.moveTo(60, y).lineTo(535, y).lineWidth(1).stroke('#e2e8f0');
    y += 14;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('VÉRIFICATION BLOCKCHAIN', 60, y);
    y += 18;

    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
       .text(`Adresse du smart contract : `, 60, y)
       .font('Helvetica-Bold').fillColor(CYAN)
       .text(process.env.CONTRACT_ADDRESS || 'N/A', 60, y + 12, { width: 340 });
    y += 30;

    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
       .text(`Réseau : Ethereum Hardhat Local  |  Clôture : ${deadlineStr}`, 60, y);
    y += 12;

    doc.font('Helvetica').fontSize(7).fillColor(GRAY)
       .text('Statut du vote : ', 60, y, { continued: true })
       .font('Helvetica-Bold').fillColor(isOpen ? '#e53e3e' : GREEN)
       .text(isOpen ? 'OUVERT' : 'CLÔTURÉ ET CERTIFIÉ');
    y += 18;

    // QR Code
    doc.image(qrBuffer, 415, y - 58, { width: 100, height: 100 });
    doc.font('Helvetica').fontSize(7).fillColor(GRAY)
       .text('Scanner pour vérifier', 415, y + 44, { width: 100, align: 'center' });

    // ── Pied de page ─────────────────────────────────────────
    const footerY = 755;
    doc.moveTo(60, footerY).lineTo(535, footerY).lineWidth(0.5).stroke('#cbd5e0');
    doc.font('Helvetica').fontSize(7).fillColor(GRAY)
       .text(
         'Ce certificat est généré automatiquement par la plateforme INTIKHABATI. ' +
         'Les résultats sont lus directement depuis le smart contract Ethereum et sont immuables.',
         60, footerY + 6, { width: W, align: 'center' }
       );
    doc.font('Helvetica-Bold').fontSize(7).fillColor(CYAN)
       .text('INTIKHABATI · انتخاباتي · Blockchain Electoral System · Maroc 2026', 60, footerY + 18, { width: W, align: 'center' });

    doc.end();

  } catch (err) {
    console.error('PDF error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Erreur génération certificat: ' + err.message });
    }
  }
});

module.exports = router;
