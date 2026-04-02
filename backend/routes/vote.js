// ============================================================
//  routes/vote.js  – Résultats & exports officiels
// ============================================================
const express = require("express");
const { getElectionResults, getContractStats } = require("../services/blockchain");
const { generalLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// ── GET /api/vote/results ────────────────────────────────────
router.get("/results", generalLimiter, async (req, res) => {
  try {
    const results = await getElectionResults();
    const total   = results.reduce((sum, c) => sum + c.voteCount, 0);
    const withPercent = results.map((c) => ({
      ...c,
      percentage: total > 0 ? ((c.voteCount / total) * 100).toFixed(2) : "0.00",
    }));
    withPercent.sort((a, b) => b.voteCount - a.voteCount);
    return res.json({ success: true, totalVotes: total, candidates: withPercent });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur lecture résultats" });
  }
});

// ── GET /api/vote/stats ──────────────────────────────────────
router.get("/stats", generalLimiter, async (req, res) => {
  try {
    const stats = await getContractStats();
    return res.json({ success: true, ...stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur lecture stats" });
  }
});

// ── GET /api/vote/export/csv ─────────────────────────────────
router.get("/export/csv", generalLimiter, async (req, res) => {
  try {
    const results = await getElectionResults();
    const stats   = await getContractStats();
    const total   = results.reduce((s, c) => s + c.voteCount, 0);
    const now     = new Date().toISOString();

    const lines = [
      `# INTIKHABATI - Rapport Officiel`,
      `# Election: ${stats.electionName || 'Presidentielle 2026'}`,
      `# Categorie: ${stats.electionCategory || 'N/A'}`,
      `# Date export: ${now}`,
      `# Total votes: ${total}`,
      `# Total inscrits: ${stats.totalRegistered}`,
      `# Participation: ${stats.totalRegistered > 0 ? ((total / stats.totalRegistered) * 100).toFixed(2) : 0}%`,
      ``,
      `rang,id,nom_candidat,votes,pourcentage`,
      ...results
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((r, i) => `${i + 1},${r.id},"${r.name}",${r.voteCount},${total > 0 ? ((r.voteCount / total) * 100).toFixed(2) : 0}%`),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=intikhabati-resultats-${Date.now()}.csv`);
    return res.send('\uFEFF' + lines.join('\n')); // BOM pour Excel
  } catch (err) {
    return res.status(500).json({ success: false, message: "Export CSV impossible" });
  }
});

// ── GET /api/vote/export/excel ───────────────────────────────
router.get("/export/excel", generalLimiter, async (req, res) => {
  try {
    const ExcelJS  = require("exceljs");
    const results  = await getElectionResults();
    const stats    = await getContractStats();
    const total    = results.reduce((s, c) => s + c.voteCount, 0);
    const sorted   = [...results].sort((a, b) => b.voteCount - a.voteCount);

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'INTIKHABATI';
    wb.created  = new Date();
    wb.modified = new Date();

    // ── Feuille 1 : Résultats ───────────────────────────────
    const ws1 = wb.addWorksheet('Résultats', {
      properties: { tabColor: { argb: '0066FF' } },
    });

    // Titre
    ws1.mergeCells('A1:F1');
    ws1.getCell('A1').value = 'INTIKHABATI — Rapport Officiel des Résultats';
    ws1.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: '00D4FF' } };
    ws1.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '030B14' } };
    ws1.getCell('A1').alignment = { horizontal: 'center' };

    // Infos élection
    const infos = [
      ['Élection', stats.electionName || 'Présidentielle 2026'],
      ['Catégorie', stats.electionCategory || 'N/A'],
      ['Statut', stats.votingOpen ? 'En cours' : 'Terminée'],
      ['Total votes', total],
      ['Total inscrits', stats.totalRegistered],
      ['Participation', stats.totalRegistered > 0 ? `${((total / stats.totalRegistered) * 100).toFixed(2)}%` : '0%'],
      ['Date export', new Date().toLocaleString('fr-FR')],
    ];

    infos.forEach(([label, val], i) => {
      const row = ws1.getRow(i + 2);
      row.getCell(1).value = label;
      row.getCell(1).font  = { bold: true, color: { argb: '4A7090' } };
      row.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0A1628' } };
      row.getCell(2).value = val;
      row.getCell(2).font  = { color: { argb: 'E8F4FF' } };
      row.getCell(2).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0A1628' } };
    });

    // En-têtes tableau
    const headerRow = ws1.getRow(11);
    ['Rang', 'ID', 'Nom Candidat', 'Votes', 'Pourcentage', 'Statut'].forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font  = { bold: true, color: { argb: '000000' } };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00D4FF' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });

    // Données
    sorted.forEach((c, i) => {
      const row     = ws1.getRow(i + 12);
      const pct     = total > 0 ? ((c.voteCount / total) * 100).toFixed(2) : '0.00';
      const isFirst = i === 0 && c.voteCount > 0;
      const bgColor = isFirst ? '0A2010' : i % 2 === 0 ? '0A1628' : '0D1F35';

      [i + 1, c.id, c.name, c.voteCount, `${pct}%`, isFirst ? '🏆 En tête' : ''].forEach((val, j) => {
        const cell = row.getCell(j + 1);
        cell.value = val;
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font  = {
          color: { argb: isFirst ? '00FF88' : 'E8F4FF' },
          bold: isFirst,
        };
        cell.alignment = { horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: '1A2A3A' } },
          bottom: { style: 'thin', color: { argb: '1A2A3A' } },
          left: { style: 'thin', color: { argb: '1A2A3A' } },
          right: { style: 'thin', color: { argb: '1A2A3A' } },
        };
      });
    });

    // Colonnes width
    ws1.columns = [
      { width: 8 }, { width: 8 }, { width: 30 },
      { width: 12 }, { width: 15 }, { width: 15 },
    ];

    // ── Feuille 2 : Statistiques ────────────────────────────
    const ws2 = wb.addWorksheet('Statistiques', {
      properties: { tabColor: { argb: '00FF88' } },
    });

    ws2.mergeCells('A1:D1');
    ws2.getCell('A1').value = 'Statistiques de participation';
    ws2.getCell('A1').font  = { size: 14, bold: true, color: { argb: '00FF88' } };
    ws2.getCell('A1').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: '030B14' } };

    const statsData = [
      ['Métrique', 'Valeur', 'Description'],
      ['Total inscrits', stats.totalRegistered, 'Électeurs enregistrés on-chain'],
      ['Total votes', total, 'Votes enregistrés on-chain'],
      ['Participation', `${stats.totalRegistered > 0 ? ((total / stats.totalRegistered) * 100).toFixed(2) : 0}%`, 'Taux de participation'],
      ['Candidats', sorted.length, 'Nombre de candidats'],
      ['Gagnant', sorted[0]?.name || 'N/A', 'Candidat en tête'],
      ['Votes gagnant', sorted[0]?.voteCount || 0, 'Votes du candidat en tête'],
    ];

    statsData.forEach((rowData, i) => {
      const row = ws2.getRow(i + 2);
      rowData.forEach((val, j) => {
        const cell = row.getCell(j + 1);
        cell.value = val;
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 0 ? '0D1F35' : i % 2 === 0 ? '0A1628' : '030B14' } };
        cell.font  = { bold: i === 0, color: { argb: i === 0 ? '00D4FF' : 'E8F4FF' } };
        cell.border = {
          top: { style: 'thin', color: { argb: '1A2A3A' } },
          bottom: { style: 'thin', color: { argb: '1A2A3A' } },
          left: { style: 'thin', color: { argb: '1A2A3A' } },
          right: { style: 'thin', color: { argb: '1A2A3A' } },
        };
      });
    });

    ws2.columns = [{ width: 20 }, { width: 15 }, { width: 40 }];

    // ── Envoi ───────────────────────────────────────────────
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=intikhabati-resultats-${Date.now()}.xlsx`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel:', err);
    return res.status(500).json({ success: false, message: "Export Excel impossible: " + err.message });
  }
});

// ── GET /api/vote/export/pdf ─────────────────────────────────
router.get("/export/pdf", generalLimiter, async (req, res) => {
  try {
    const PDFDocument = require("pdfkit");
    const results     = await getElectionResults();
    const stats       = await getContractStats();
    const total       = results.reduce((s, c) => s + c.voteCount, 0);
    const sorted      = [...results].sort((a, b) => b.voteCount - a.voteCount);
    const now         = new Date().toLocaleString('fr-FR');

    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'INTIKHABATI Rapport Officiel' } });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=intikhabati-rapport-${Date.now()}.pdf`);
    doc.pipe(res);

    const W = doc.page.width;

    // ── Fond sombre simulé avec rectangle ──────────────────
    doc.rect(0, 0, W, doc.page.height).fill('#030B14');

    // ── Bande top ──────────────────────────────────────────
    doc.rect(0, 0, W, 4).fill('#0066FF');
    doc.rect(0, 4, W, 2).fill('#00D4FF');

    // ── Titre ──────────────────────────────────────────────
    doc.fillColor('#00D4FF').font('Helvetica-Bold').fontSize(26)
       .text('INTIKHABATI', { align: 'center' });
    doc.fillColor('#FFB400').fontSize(14)
       .text('انتخاباتي', { align: 'center' });
    doc.fillColor('#4A7090').fontSize(9).font('Helvetica')
       .text('Rapport Officiel des Résultats — Blockchain Ethereum', { align: 'center' });

    doc.moveDown(0.5);
    doc.strokeColor('#00D4FF').lineWidth(0.5)
       .moveTo(40, doc.y).lineTo(W - 40, doc.y).stroke();
    doc.moveDown(0.5);

    // ── Infos élection ─────────────────────────────────────
    doc.rect(40, doc.y, W - 80, 60).fill('#0A1628');
    const infoY = doc.y + 8;

    const infos = [
      ['Élection', stats.electionName || 'Présidentielle 2026'],
      ['Catégorie', stats.electionCategory || 'N/A'],
      ['Statut', stats.votingOpen ? 'En cours' : 'Terminée'],
      ['Participation', `${stats.totalRegistered > 0 ? ((total / stats.totalRegistered) * 100).toFixed(1) : 0}%  (${total} / ${stats.totalRegistered} inscrits)`],
      ['Date export', now],
    ];

    infos.forEach(([label, val], i) => {
      const y = infoY + i * 10;
      doc.fillColor('#4A7090').font('Helvetica-Bold').fontSize(8).text(label, 52, y);
      doc.fillColor('#E8F4FF').font('Helvetica').fontSize(8).text(val, 160, y);
    });

    doc.y = infoY + 60;
    doc.moveDown(1);

    // ── Résultats ──────────────────────────────────────────
    doc.fillColor('#00D4FF').font('Helvetica-Bold').fontSize(12)
       .text('Résultats Détaillés', 40);
    doc.moveDown(0.4);

    // En-têtes
    const cols = [40, 70, 100, 350, 420, 480];
    const headers = ['Rang', 'ID', 'Candidat', 'Votes', '%', 'Statut'];
    doc.rect(40, doc.y, W - 80, 16).fill('#00D4FF');
    headers.forEach((h, i) => {
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8)
         .text(h, cols[i], doc.y - 12, { width: cols[i + 1] ? cols[i + 1] - cols[i] : 60 });
    });
    doc.moveDown(0.2);

    // Lignes
    sorted.forEach((c, i) => {
      const pct    = total > 0 ? ((c.voteCount / total) * 100).toFixed(1) : '0.0';
      const isFirst = i === 0 && c.voteCount > 0;
      const bg     = isFirst ? '#0A2010' : i % 2 === 0 ? '#0A1628' : '#0D1F35';
      const rowH   = 14;

      doc.rect(40, doc.y, W - 80, rowH).fill(bg);

      const textColor = isFirst ? '#00FF88' : '#E8F4FF';
      const rowY = doc.y + 4;

      [
        [cols[0], `${i + 1}`],
        [cols[1], `${c.id}`],
        [cols[2], c.name.length > 28 ? c.name.slice(0, 25) + '...' : c.name],
        [cols[3], `${c.voteCount}`],
        [cols[4], `${pct}%`],
        [cols[5], isFirst ? '🏆' : ''],
      ].forEach(([x, txt]) => {
        doc.fillColor(textColor).font(isFirst ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
           .text(String(txt), x, rowY, { lineBreak: false });
      });

      doc.y += rowH;
    });

    doc.moveDown(1);

    // ── Footer ─────────────────────────────────────────────
    doc.strokeColor('#00D4FF').lineWidth(0.3)
       .moveTo(40, doc.y).lineTo(W - 40, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fillColor('#2A4060').font('Helvetica').fontSize(7)
       .text(`Généré le ${now} · INTIKHABATI · انتخاباتي · "Don't trust, verify"`, { align: 'center' });

    // ── Bande bottom ───────────────────────────────────────
    doc.rect(0, doc.page.height - 4, W, 4).fill('#C1272D');

    doc.end();
  } catch (err) {
    console.error('Export PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Export PDF impossible: " + err.message });
    }
  }
});

module.exports = router;