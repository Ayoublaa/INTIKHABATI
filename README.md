# CivicChain — Intikhabati 🗳

> Système de vote électronique décentralisé sur Ethereum  
> DApp hybride — Smart Contract + Backend sécurisé + Interface React

---

## Lancement rapide

> **Ordre obligatoire : T1 → T2 → T3 → T4**

### Terminal 1 — Blockchain locale
```bash
cd hardhat2
npx hardhat node
```

### Terminal 2 — Déploiement + Seed blockchain
```bash
cd hardhat2
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js --network localhost
```

### Terminal 3 — Backend
```bash
cd backend
node seed.js        # peuple MongoDB (CINs + régions)
npm run dev         # port 3001
```

### Terminal 4 — Frontend
```bash
cd frontend
npm start           # port 3000
```

### Tests smart contract
```bash
cd hardhat2
npx hardhat test
```

---

## Stack

| Couche | Tech |
|---|---|
| Smart contract | Solidity 0.8 + Hardhat |
| Backend | Node.js + Express + MongoDB |
| Frontend | React.js + ethers.js + MetaMask |
| Email | Nodemailer + Gmail SMTP |
| PDF | PDFKit + QRCode |
| IPFS | Pinata API (optionnel) |

---

## Fonctionnalités

- **Multi-élections** — présidentielle, législative, municipale, régionale, référendum
- **Vote direct** — inscription CIN + MetaMask + vote on-chain
- **Vote délégué** — délégation à un autre électeur inscrit
- **Commit-Reveal** — votes chiffrés pendant la phase de vote, révélés ensuite
- **Signature EIP-191** — anti-usurpation, nonce one-time via MetaMask
- **Blocage militaire (Article 47)** — professions bloquées avec email d'alerte admin
- **Éligibilité géographique** — restriction par région / ville / quartier
- **Certificat PDF** — généré à la clôture avec QR code (IPFS si configuré)
- **Score de risque** — détection de fraude multi-IP / multi-CIN
- **Dashboard admin** — statistiques live depuis la blockchain

---

## Comptes de test (Hardhat)

> MetaMask → Réseau : `http://127.0.0.1:8545` | Chain ID : `31337`

| Compte | CIN | Quartier | Ville | Région |
|---|---|---|---|---|
| `0xf39Fd6...` | — | — | — | **Owner/Admin** |
| `0x709979...` | AB123456 | Maarif | Casablanca | Casablanca-Settat |
| `0x3c44cd...` | CD789012 | Agdal | Rabat | Rabat-Salé-Kénitra |
| `0x90f79b...` | EF345678 | **Guéliz** | Marrakech | Marrakech-Safi |
| `0x15d34a...` | GH901234 | Médina | Fès | Fès-Meknès |
| `0x996550...` | IJ567890 | Hamria | Meknès | Fès-Meknès |
| `0x976ea7...` | KL234567 | Talborjt | Agadir | Souss-Massa |
| `0x14dc79...` | MN890123 | Beni Makada | Tanger | Tanger-Tétouan-Al Hoceïma |
| `0x23618e...` | OP456789 | Al Qods | Oujda | Oriental |
| `0xa0ee7a...` | MK100001 | **Ménara** | Marrakech | Marrakech-Safi |
| `0xbcd404...` | MK100002 | **Médina** | Marrakech | Marrakech-Safi |

### CINs bloqués (Article 47)
| CIN | Profession |
|---|---|
| ZM111111 | Militaire |
| ZM222222 | Gendarmerie |
| ZM333333 | Police Nationale |
| ZZ999999 | CIN expiré |

---

## Variables d'environnement

```env
# backend/.env
MONGO_URI=mongodb://localhost:27017/civicchain
OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RPC_URL=http://127.0.0.1:8545
PORT=3001
EMAIL_USER=...
EMAIL_PASS=...
ADMIN_EMAIL=...
PINATA_JWT=          # optionnel — IPFS
```

---

## Scénario de test — Restriction géographique Guéliz

1. Admin → créer élection **"Municipale Guéliz"** → Zone : **Guéliz uniquement (Marrakech)**
2. Admin → ouvrir l'élection

| CIN | Wallet | Résultat |
|---|---|---|
| EF345678 — Guéliz | `0x90f79b...` | ✅ Peut voter |
| MK100001 — Ménara | `0xa0ee7a...` | ❌ Bloqué |
| MK100002 — Médina | `0xbcd404...` | ❌ Bloqué |
| AB123456 — Casablanca | `0x709979...` | ❌ Bloqué |

---

## Architecture

```
Frontend (React) ──axios──▶ Backend (Node/Express) ──ethers.js──▶ Hardhat (EVM)
                                      │
                                   MongoDB
                          (FakeID, Voter, ElectionMeta,
                           Blacklist, ActivityLog, ElectionCache)
```

---

## Tests

```
CivicChain v3 — 8 suites, ~45 tests

Suite 1 — Deployment          (2 tests)
Suite 2 — Election lifecycle  (9 tests)
Suite 3 — Voter registration  (6 tests)
Suite 4 — Direct voting       (7 tests)
Suite 5 — Commit-Reveal       (7 tests)  ← v3
Suite 6 — Delegation          (6 tests)
Suite 7 — Security            (7 tests)
Suite 8 — View functions      (4 tests)
```
