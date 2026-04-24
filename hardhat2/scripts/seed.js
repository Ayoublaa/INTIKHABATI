// ============================================================
//  seed.js v3 — Demo elections including a commit-reveal one
//  Usage: npx hardhat run scripts/seed.js --network localhost
//
//  ⚠  CivicChain is now owned by the 2-of-3 MultiSigWallet.
//     Every onlyOwner call (createElection, addCandidate,
//     openElection, registerVoter) must be submit+confirm'd
//     via the multisig. The helper `callAsOwner` below does
//     that automatically using hardhat signers #0 and #1.
// ============================================================
const hre    = require("hardhat");
const { ethers } = hre;

async function fromNow(secs) {
  const block = await ethers.provider.getBlock("latest");
  return Number(block.timestamp) + secs;
}

async function main() {
  const [owner, voter1, voter2, voter3] = await ethers.getSigners();
  console.log("🌱 Seeding CivicChain v3 demo data...");
  console.log("   Owner  :", owner.address);

  const fs   = require("fs");
  const path = require("path");
  const envPath = path.join(__dirname, "../../backend/.env");

  function readEnvKey(key) {
    if (process.env[key]) return process.env[key];
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match   = content.match(new RegExp(`^${key}=(.+)$`, "m"));
      if (match) return match[1].trim();
    }
    return null;
  }

  const contractAddress = readEnvKey("CONTRACT_ADDRESS");
  const multisigAddress = readEnvKey("MULTISIG_ADDRESS");
  if (!contractAddress) {
    console.error("❌  CONTRACT_ADDRESS not found. Run deploy.js first.");
    process.exit(1);
  }
  console.log("   Contract:", contractAddress);
  console.log("   MultiSig:", multisigAddress || "(none — direct owner mode)", "\n");

  const CivicChain = await ethers.getContractFactory("CivicChain");
  const contract   = CivicChain.attach(contractAddress);
  const iface      = CivicChain.interface;

  // ── MultiSig wiring ────────────────────────────────────────
  const MULTISIG_ABI = [
    "function submitTransaction(address destination, uint256 value, bytes data) external returns (uint256 txId)",
    "function confirmTransaction(uint256 txId) external",
    "function getTransaction(uint256 txId) external view returns (address destination, uint256 value, bytes data, bool executed, uint256 confirmations)",
    "event Submission(uint256 indexed txId, address indexed proposer, address destination, uint256 value, bytes data)",
  ];

  // signers[0] proposes, signers[1] confirms → 2-of-3 reached, auto-executes.
  const allSigners = await ethers.getSigners();
  const [msOwner0, msOwner1] = allSigners;

  const multisigAsOwner0 = multisigAddress
    ? new ethers.Contract(multisigAddress, MULTISIG_ABI, msOwner0)
    : null;
  const multisigAsOwner1 = multisigAddress
    ? new ethers.Contract(multisigAddress, MULTISIG_ABI, msOwner1)
    : null;

  /**
   * Route a CivicChain onlyOwner call through the MultiSigWallet.
   * Falls back to a direct call if no multisig is configured.
   */
  async function callAsOwner(methodName, args) {
    if (!multisigAsOwner0) {
      const tx = await contract[methodName](...args);
      await tx.wait();
      return;
    }
    const data = iface.encodeFunctionData(methodName, args);

    // 1. Propose
    const txSubmit  = await multisigAsOwner0.submitTransaction(contractAddress, 0n, data);
    const rctSubmit = await txSubmit.wait();

    // Decode the Submission event to find the txId
    let txId = null;
    const msIface = new ethers.Interface(MULTISIG_ABI);
    for (const log of rctSubmit.logs) {
      try {
        const parsed = msIface.parseLog(log);
        if (parsed && parsed.name === "Submission") {
          txId = parsed.args.txId;
          break;
        }
      } catch { /* ignore non-multisig logs */ }
    }
    if (txId === null) throw new Error("Submission event not found");

    // 2. Confirm (auto-executes at threshold=2)
    const txConfirm = await multisigAsOwner1.confirmTransaction(txId);
    await txConfirm.wait();
  }

  async function addCandidate(eid, name, party) {
    await callAsOwner("addCandidate", [eid, name, party]);
    console.log(`     + ${name} (${party || 'Indépendant'})`);
  }

  // v3 createElection: (name, category, deadline, enableBlank, commitReveal)

  // ── Election 1: Presidential — Direct vote, 2 days ───────
  console.log("1️⃣  Élection Présidentielle (vote direct)...");
  {
    const deadline = await fromNow(2 * 24 * 3600);
    await callAsOwner("createElection", [
      "Élection Présidentielle 2026", 0, deadline, true, false,
    ]);
    console.log(`   Created #1 — deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    await addCandidate(1, "Amir Benali",   "Parti de la Justice");
    await addCandidate(1, "Sara El Fassi", "Alliance Progressiste");
    await addCandidate(1, "Khalid Mourad", "Front National");
    await addCandidate(1, "Nadia Tahiri",  "Parti Vert");
    await callAsOwner("openElection", [1]);
    console.log("   ✅ OPEN\n");
  }

  // ── Election 2: Legislative — Direct vote, 30 min ────────
  console.log("2️⃣  Élections Législatives (vote direct)...");
  {
    const deadline = await fromNow(30 * 60);
    await callAsOwner("createElection", [
      "Élections Législatives — Casablanca", 1, deadline, true, false,
    ]);
    console.log(`   Created #2 — deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    await addCandidate(2, "Hassan Ouali",   "Union Socialiste");
    await addCandidate(2, "Fatima Zahra",   "Parti Constitutionnel");
    await addCandidate(2, "Younes Bargach", "Mouvement Populaire");
    await callAsOwner("openElection", [2]);
    console.log("   ✅ OPEN\n");
  }

  // ── Election 3: Municipal — Upcoming (not opened) ─────────
  console.log("3️⃣  Élections Municipales (upcoming)...");
  {
    const deadline = await fromNow(7 * 24 * 3600);
    await callAsOwner("createElection", [
      "Élections Municipales — Marrakech", 2, deadline, false, false,
    ]);
    console.log(`   Created #3 — deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    await addCandidate(3, "Rachid Anouar",  "Liste Citoyenne");
    await addCandidate(3, "Khadija Slaoui", "Parti du Progrès");
    console.log("   ⏳ UPCOMING (pas encore ouvert)\n");
  }

  // ── Election 4: Referendum — Direct, avec votes démo ─────
  console.log("4️⃣  Référendum (votes démo)...");
  {
    const deadline = await fromNow(60 * 60);
    await callAsOwner("createElection", [
      "Référendum: Adoption de la Constitution v2", 4, deadline, false, false,
    ]);
    console.log(`   Created #4`);
    await addCandidate(4, "OUI — Pour l'adoption", "");
    await addCandidate(4, "NON — Contre",          "");
    await callAsOwner("openElection", [4]);
    console.log("   ✅ OPEN");

    const crypto = require("crypto");
    for (let i = 0; i < 3; i++) {
      const v     = [voter1, voter2, voter3][i];
      const cin   = `DEMO${String(i + 1).padStart(6, "0")}`;
      const hash  = "0x" + crypto.createHash("sha256").update(cin).digest("hex");
      try {
        // registerVoter is onlyOwner → via multisig
        await callAsOwner("registerVoter", [4, v.address, hash]);
        // vote is NOT onlyOwner → voter signs directly
        const candId = i === 1 ? 2 : 1; // voter2 → NON, others → OUI
        await (await contract.connect(v).vote(4, candId)).wait();
        console.log(`   🗳  voter${i + 1} → candidat #${candId}`);
      } catch (e) {
        console.warn(`   ⚠  voter${i + 1}: ${e.reason || e.message}`);
      }
    }
    console.log();
  }

  // ── Election 5: Commit-Reveal — Regional ─────────────────
  console.log("5️⃣  Élection Régionale — Commit-Reveal (mode privé)...");
  {
    const deadline = await fromNow(3 * 24 * 3600); // 3 days
    await callAsOwner("createElection", [
      "Élection Régionale — Souss-Massa", 3, deadline, false, true, // commitReveal=true
    ]);
    console.log(`   Created #5 — COMMIT-REVEAL mode`);
    await addCandidate(5, "Mohamed Ait Ali",   "Parti Authenticité");
    await addCandidate(5, "Siham Benkirane",   "Union Nationale");
    await addCandidate(5, "Driss Oujdi",       "Liste Citoyenne");
    await callAsOwner("openElection", [5]);
    console.log("   ✅ OPEN (commit phase) — les votes sont chiffrés\n");
  }

  // ── Summary ───────────────────────────────────────────────
  console.log("━".repeat(50));
  const STATUS = ["Upcoming", "Open", "Revealing", "Closed"];
  const all    = await contract.getAllElections();
  console.log("✅  Seed complet !\n");
  for (const e of all) {
    const mode = e.isCommitReveal ? " [🔒 Commit-Reveal]" : "";
    console.log(`   #${e.id} [${STATUS[Number(e.status)]}]${mode} "${e.name}" — ${e.totalVotes} votes`);
  }

  console.log("\n📋  CINs de test (seed MongoDB séparé):");
  console.log("   AB123456 → wallet 0x70997970...  (Ahmed Benali)");
  console.log("   CD789012 → wallet 0x3C44cddd...  (Fatima Zahra)");
  console.log("   ZM111111 → 🚫 Militaire (bloqué Article 47)");

  console.log("\n🚀  Lancer l'app:");
  console.log("   cd backend  && npm run dev");
  console.log("   cd frontend && npm start");
}

main().catch(err => { console.error(err); process.exit(1); });
