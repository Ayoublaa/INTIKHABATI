// ============================================================
//  seed.js  – Reset COMPLET + Peuple la base MongoDB
//  Commande : node seed.js
//  FEATURE 1 : Wallets pré-assignés par CIN
//  FEATURE 2 : CINs militaires (liste noire)
// ============================================================
require("dotenv").config();
const mongoose = require("mongoose");
const FakeID   = require("./models/FakeID");

let Voter, Blacklist;
try { Voter = require("./models/Voter"); } catch(e) {}
try { Blacklist = require("./models/Blacklist"); } catch(e) {}

// ── Hardhat test accounts (accounts[1] → accounts[8]) ────────
// accounts[0] = 0xf39Fd6e51... (owner/admin — ne peut pas voter)
// ── Régions administratives du Maroc ─────────────────────────
// Chaque citoyen a : city + district (quartier) + region (région admin)
const fakeCINs = [
  {
    cin:           "AB123456",
    fullName:      "Ahmed Benali",
    birthDate:     new Date("1985-03-15"),
    city:          "Casablanca",
    district:      "Maarif",
    region:        "Casablanca-Settat",
    profession:    "Ingénieur",
    email:         "ahmed.benali@example.ma",
    walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    isValid:       true,
  },
  {
    cin:           "CD789012",
    fullName:      "Fatima Zahra",
    birthDate:     new Date("1990-07-22"),
    city:          "Rabat",
    district:      "Agdal",
    region:        "Rabat-Salé-Kénitra",
    profession:    "Médecin",
    email:         "fatima.zahra@example.ma",
    walletAddress: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    isValid:       true,
  },
  {
    cin:           "EF345678",
    fullName:      "Youssef El Amri",
    birthDate:     new Date("1978-11-08"),
    city:          "Marrakech",
    district:      "Guéliz",
    region:        "Marrakech-Safi",
    profession:    "Enseignant",
    email:         "youssef.elamri@example.ma",
    walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    isValid:       true,
  },
  {
    cin:           "GH901234",
    fullName:      "Khadija Moussaoui",
    birthDate:     new Date("1995-01-30"),
    city:          "Fès",
    district:      "Médina",
    region:        "Fès-Meknès",
    profession:    "Avocate",
    email:         "khadija.moussaoui@example.ma",
    walletAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    isValid:       true,
  },
  {
    cin:           "IJ567890",
    fullName:      "Omar Tazi",
    birthDate:     new Date("1982-09-14"),
    city:          "Meknès",
    district:      "Hamria",
    region:        "Fès-Meknès",
    profession:    "Comptable",
    email:         "omar.tazi@example.ma",
    walletAddress: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
    isValid:       true,
  },
  {
    cin:           "KL234567",
    fullName:      "Nadia Idrissi",
    birthDate:     new Date("1993-04-25"),
    city:          "Agadir",
    district:      "Talborjt",
    region:        "Souss-Massa",
    profession:    "Architecte",
    email:         "nadia.idrissi@example.ma",
    walletAddress: "0x976ea74026e726554db657fa54763abd0c3a0aa9",
    isValid:       true,
  },
  {
    cin:           "MN890123",
    fullName:      "Hassan Boulahia",
    birthDate:     new Date("1970-12-03"),
    city:          "Tanger",
    district:      "Beni Makada",
    region:        "Tanger-Tétouan-Al Hoceïma",
    profession:    "Commerçant",
    email:         "hassan.boulahia@example.ma",
    walletAddress: "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
    isValid:       true,
  },
  {
    cin:           "OP456789",
    fullName:      "Samira Chaoui",
    birthDate:     new Date("1988-06-17"),
    city:          "Oujda",
    district:      "Al Qods",
    region:        "Oriental",
    profession:    "Pharmacienne",
    email:         "samira.chaoui@example.ma",
    walletAddress: "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f",
    isValid:       true,
  },

  // ── Marrakech — quartiers différents (pour test géo par district) ──
  {
    cin:           "MK100001",
    fullName:      "Karim Mansouri",
    birthDate:     new Date("1991-06-10"),
    city:          "Marrakech",
    district:      "Ménara",
    region:        "Marrakech-Safi",
    profession:    "Artisan",
    email:         "karim.mansouri@example.ma",
    walletAddress: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    isValid:       true,
  },
  {
    cin:           "MK100002",
    fullName:      "Salma Ouazzani",
    birthDate:     new Date("1994-03-22"),
    city:          "Marrakech",
    district:      "Médina",
    region:        "Marrakech-Safi",
    profession:    "Commerçante",
    email:         "salma.ouazzani@example.ma",
    walletAddress: "0xbcd4042de499d14e55001ccbb24a551f3b954096",
    isValid:       true,
  },

  // ── CINs militaires (Article 47 — bloqués) ────────────────
  {
    cin:           "ZM111111",
    fullName:      "Mohammed Alami",
    birthDate:     new Date("1980-05-20"),
    city:          "Rabat",
    district:      "Hassan",
    region:        "Rabat-Salé-Kénitra",
    profession:    "Militaire",
    email:         null,
    walletAddress: null,
    isValid:       true,
  },
  {
    cin:           "ZM222222",
    fullName:      "Youssef Bennani",
    birthDate:     new Date("1975-09-12"),
    city:          "Fès",
    district:      "Médina",
    region:        "Fès-Meknès",
    profession:    "Gendarmerie",
    email:         null,
    walletAddress: null,
    isValid:       true,
  },
  {
    cin:           "ZM333333",
    fullName:      "Omar Tazi",
    birthDate:     new Date("1983-03-07"),
    city:          "Casablanca",
    district:      "Ain Sebaa",
    region:        "Casablanca-Settat",
    profession:    "Police Nationale",
    email:         null,
    walletAddress: null,
    isValid:       true,
  },

  // ── CIN expiré pour les tests ─────────────────────────────
  {
    cin:           "ZZ999999",
    fullName:      "CIN Expiré Test",
    birthDate:     new Date("1960-01-01"),
    city:          "Test",
    district:      null,
    region:        null,
    profession:    "Inconnue",
    email:         null,
    walletAddress: null,
    isValid:       false,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB connecté");

  console.log("\n🔄 Reset de la base en cours...");

  if (Voter) {
    await Voter.deleteMany({});
    console.log("  🗑  Électeurs supprimés");
  }

  if (Blacklist) {
    await Blacklist.deleteMany({});
    console.log("  🗑  Blacklist effacée");
  }

  await FakeID.deleteMany({});
  console.log("  🗑  CINs supprimés");

  await FakeID.insertMany(fakeCINs);
  console.log(`\n🌱 ${fakeCINs.length} CINs insérés dans la base Phantom ID`);

  console.log("\n✅ CINs valides pour tester (avec wallet assigné) :");
  fakeCINs.filter(c => c.isValid && c.walletAddress).forEach(c =>
    console.log(`  → ${c.cin}  (${c.fullName} — ${c.district}, ${c.city}, ${c.region})  wallet: ${c.walletAddress}`)
  );

  console.log("\n🪖 CINs militaires bloqués (Article 47) :");
  fakeCINs.filter(c => ["Militaire","Gendarmerie","Police Nationale","Forces Armées Royales","Protection Civile"].includes(c.profession)).forEach(c =>
    console.log(`  🚫 ${c.cin}  (${c.fullName} — ${c.profession} — ${c.city})`)
  );

  console.log("\n🚀 Base prête — vous pouvez lancer le backend !\n");
  await mongoose.disconnect();
}

seed().catch(console.error);
