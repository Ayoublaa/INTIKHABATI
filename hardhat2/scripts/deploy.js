const hre = require("hardhat");

async function main() {
  console.log("Déploiement de CivicChain...");

  const CivicChain = await hre.ethers.getContractFactory("CivicChain");
  const contract = await CivicChain.deploy("Presidentielle 2026");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ CivicChain déployé à l'adresse :", address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});