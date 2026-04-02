// ============================================================
//  CivicChain – server.js  (Point d'entrée principal)
// ============================================================
require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const morgan   = require("morgan");
const mongoose = require("mongoose");
const helmet   = require("helmet");

const phantomRoutes     = require("./routes/phantom");
const voteRoutes        = require("./routes/vote");
const adminRoutes       = require("./routes/admin");
const electionsRoutes   = require("./routes/elections");
const securityRoutes    = require("./routes/security");
const certificateRoutes = require("./routes/certificate");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Sécurité HTTP headers (helmet) ──────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // permet les assets cross-origin
}));

// ── CORS : seulement le frontend autorisé ───────────────────
app.use(cors({
  origin:  ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Middlewares globaux ──────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Limite la taille des requêtes
app.use(morgan("dev"));                   // Logs des requêtes HTTP

// ── Connexion MongoDB ────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connecté"))
  .catch((err) => {
    console.error("❌ Erreur MongoDB :", err.message);
    process.exit(1);
  });

// ── Routes ───────────────────────────────────────────────────
app.use("/api/phantom",     phantomRoutes);
app.use("/api/vote",        voteRoutes);
app.use("/api/admin",       adminRoutes);
app.use("/api/elections",   electionsRoutes);
app.use("/api/security",    securityRoutes);
app.use("/api/certificate", certificateRoutes);

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:    "OK",
    project:   "INTIKHABATI",
    secured:   true,
    timestamp: new Date().toISOString(),
  });
});

// ── Route inconnue ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route introuvable" });
});

// ── Gestion des erreurs globales ──────────────────────────────
app.use((err, req, res, next) => {
  console.error("💥 Erreur serveur :", err.message);
  res.status(500).json({ success: false, message: "Erreur interne du serveur" });
});

// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 INTIKHABATI API démarrée sur http://localhost:${PORT}`);
  console.log(`🛡  Helmet actif — Headers HTTP sécurisés`);
  console.log(`🔒 CORS actif   — Seulement localhost:3000 autorisé`);
});