const hre  = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const signers = await hre.ethers.getSigners();
  const [deployer, owner1, owner2] = signers;
  console.log("Deployer:", deployer.address);
  console.log("Balance :", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // ── 1. Deploy MinimalForwarder ─────────────────────────────
  console.log("\n📡 Deploying MinimalForwarder...");
  const ForwarderFactory = await hre.ethers.getContractFactory("MinimalForwarder");
  const forwarder        = await ForwarderFactory.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("✅ MinimalForwarder deployed at:", forwarderAddress);

  // ── 2. Deploy CivicChain (EIP-2771 enabled) ────────────────
  console.log("\n📡 Deploying CivicChain v3 (EIP-2771)...");
  const CivicFactory  = await hre.ethers.getContractFactory("CivicChain");
  const civicContract = await CivicFactory.deploy(forwarderAddress);
  await civicContract.waitForDeployment();
  const contractAddress = await civicContract.getAddress();
  console.log("✅ CivicChain v3 deployed at:    ", contractAddress);
  console.log("   Trusted forwarder:            ", await civicContract.trustedForwarder());

  // ── 3. Deploy 2-of-3 MultiSigWallet ────────────────────────
  console.log("\n📡 Deploying MultiSigWallet (2-of-3)...");
  const multisigOwners = [deployer.address, owner1.address, owner2.address];
  const required       = 2;
  const MultiSigFactory = await hre.ethers.getContractFactory("MultiSigWallet");
  const multisig        = await MultiSigFactory.deploy(multisigOwners, required);
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();
  console.log("✅ MultiSigWallet deployed at:   ", multisigAddress);
  console.log("   Owners  :", multisigOwners);
  console.log("   Required:", required, "of", multisigOwners.length);

  // ── 4. Transfer CivicChain ownership to the MultiSig ───────
  console.log("\n🔐 Transferring CivicChain ownership to MultiSig...");
  const tx = await civicContract.transferOwnership(multisigAddress);
  await tx.wait(1);
  const newOwner = await civicContract.owner();
  console.log("✅ CivicChain.owner() =", newOwner);
  if (newOwner.toLowerCase() !== multisigAddress.toLowerCase()) {
    throw new Error("Ownership transfer failed!");
  }

  // ── 5. Update .env files automatically ────────────────────
  const envBackend  = path.join(__dirname, "../../backend/.env");
  const envFrontend = path.join(__dirname, "../../frontend/.env");

  function updateEnv(filePath, key, value) {
    let content = "";
    if (fs.existsSync(filePath)) content = fs.readFileSync(filePath, "utf8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(filePath, content.trim() + "\n");
    console.log(`   Updated ${key} in ${path.basename(filePath)}`);
  }

  // Default Hardhat account private keys (PUBLIC test keys — safe for local dev only).
  const HARDHAT_PKS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  ];

  console.log("\n📝 Updating .env files...");
  updateEnv(envBackend,  "CONTRACT_ADDRESS",             contractAddress);
  updateEnv(envBackend,  "FORWARDER_ADDRESS",            forwarderAddress);
  updateEnv(envBackend,  "MULTISIG_ADDRESS",             multisigAddress);
  updateEnv(envBackend,  "MULTISIG_OWNER_0",             multisigOwners[0]);
  updateEnv(envBackend,  "MULTISIG_OWNER_1",             multisigOwners[1]);
  updateEnv(envBackend,  "MULTISIG_OWNER_2",             multisigOwners[2]);
  updateEnv(envBackend,  "MULTISIG_OWNER_0_PK",          HARDHAT_PKS[0]);
  updateEnv(envBackend,  "MULTISIG_OWNER_1_PK",          HARDHAT_PKS[1]);
  updateEnv(envBackend,  "MULTISIG_OWNER_2_PK",          HARDHAT_PKS[2]);
  updateEnv(envFrontend, "REACT_APP_CONTRACT_ADDRESS",   contractAddress);
  updateEnv(envFrontend, "REACT_APP_FORWARDER_ADDRESS",  forwarderAddress);
  updateEnv(envFrontend, "REACT_APP_MULTISIG_ADDRESS",   multisigAddress);

  console.log("\n🚀 Deployment complete!");
  console.log("   MinimalForwarder :", forwarderAddress);
  console.log("   CivicChain v3    :", contractAddress);
  console.log("   MultiSigWallet   :", multisigAddress);
  console.log("\n⚠  CivicChain is now owned by the MultiSig.");
  console.log("   All admin actions must be co-signed by ≥2 owners.");
  console.log("   Backend (multisigService.js) holds the three owner keys");
  console.log("   and co-signs automatically — supply them as:");
  console.log("     MULTISIG_OWNER_0_PK, MULTISIG_OWNER_1_PK, MULTISIG_OWNER_2_PK");
  console.log("\nNext steps:");
  console.log("  1. Add private keys (PK env vars) to backend/.env");
  console.log("  2. npx hardhat run scripts/seed.js --network localhost");
  console.log("  3. cd backend && npm run dev");
  console.log("  4. cd frontend && npm start");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
