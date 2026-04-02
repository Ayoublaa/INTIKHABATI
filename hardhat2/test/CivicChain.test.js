const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CivicChain", function () {

  let contract;
  let owner, voter1, voter2, voter3, stranger;

  const ID_HASH_1 = ethers.keccak256(ethers.toUtf8Bytes("AB123456"));
  const ID_HASH_2 = ethers.keccak256(ethers.toUtf8Bytes("CD789012"));
  const ID_HASH_3 = ethers.keccak256(ethers.toUtf8Bytes("EF345678"));

  beforeEach(async function () {
    [owner, voter1, voter2, voter3, stranger] = await ethers.getSigners();
    const CivicChain = await ethers.getContractFactory("CivicChain");
    contract = await CivicChain.deploy("Presidentielle 2026");
    await contract.waitForDeployment();
  });

  // =========================================================
  //  DEPLOIEMENT
  // =========================================================
  describe("Deploiement", function () {
    it("doit définir le bon owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
    it("doit démarrer avec le vote fermé", async function () {
      expect(await contract.votingOpen()).to.equal(false);
    });
    it("doit avoir le bon nom d'élection", async function () {
      expect(await contract.electionName()).to.equal("Presidentielle 2026");
    });
    it("doit démarrer avec 0 candidats", async function () {
      expect(await contract.candidateCount()).to.equal(0);
    });
    it("doit démarrer avec 0 votes", async function () {
      expect(await contract.totalVotes()).to.equal(0);
    });
  });

  // =========================================================
  //  CANDIDATS
  // =========================================================
  describe("Candidats", function () {
    it("doit permettre à l'owner d'ajouter un candidat", async function () {
      await contract.addCandidate("Candidat A");
      expect(await contract.candidateCount()).to.equal(1);
    });
    it("doit émettre l'event CandidateAdded", async function () {
      await expect(contract.addCandidate("Candidat A"))
        .to.emit(contract, "CandidateAdded").withArgs(1, "Candidat A");
    });
    it("doit refuser l'ajout de candidat par un non-owner", async function () {
      await expect(contract.connect(stranger).addCandidate("X"))
        .to.be.revertedWith("Acces refuse : vous n'etes pas admin");
    });
    it("doit refuser l'ajout de candidat quand le vote est ouvert", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVoting();
      await expect(contract.addCandidate("Candidat B"))
        .to.be.revertedWith("Le vote est encore ouvert");
    });
    it("doit retourner les bonnes infos d'un candidat", async function () {
      await contract.addCandidate("Ayoub Laafar");
      const [name, voteCount] = await contract.getCandidate(1);
      expect(name).to.equal("Ayoub Laafar");
      expect(voteCount).to.equal(0);
    });
    it("doit permettre d'ajouter plusieurs candidats", async function () {
      await contract.addCandidate("Candidat A");
      await contract.addCandidate("Candidat B");
      await contract.addCandidate("Candidat C");
      expect(await contract.candidateCount()).to.equal(3);
    });
  });

  // =========================================================
  //  GESTION DU VOTE
  // =========================================================
  describe("Gestion du vote", function () {
    it("doit ouvrir le vote si candidats existent", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVoting();
      expect(await contract.votingOpen()).to.equal(true);
    });
    it("doit émettre l'event VotingOpened", async function () {
      await contract.addCandidate("Candidat A");
      await expect(contract.openVoting()).to.emit(contract, "VotingOpened");
    });
    it("doit refuser d'ouvrir sans candidat", async function () {
      await expect(contract.openVoting())
        .to.be.revertedWith("Ajoutez au moins un candidat avant d'ouvrir");
    });
    it("doit fermer le vote", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVoting();
      await contract.closeVoting();
      expect(await contract.votingOpen()).to.equal(false);
    });
    it("doit émettre l'event VotingClosed", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVoting();
      await expect(contract.closeVoting()).to.emit(contract, "VotingClosed");
    });
    it("doit refuser l'ouverture par un non-owner", async function () {
      await contract.addCandidate("Candidat A");
      await expect(contract.connect(stranger).openVoting())
        .to.be.revertedWith("Acces refuse : vous n'etes pas admin");
    });
  });

  // =========================================================
  //  ENREGISTREMENT ÉLECTEURS
  // =========================================================
  describe("Enregistrement electeurs", function () {
    it("doit enregistrer un électeur", async function () {
      await contract.registerVoter(voter1.address, ID_HASH_1);
      const [isRegistered, hasVoted] = await contract.getVoterStatus(voter1.address);
      expect(isRegistered).to.equal(true);
      expect(hasVoted).to.equal(false);
    });
    it("doit émettre l'event VoterRegistered", async function () {
      const tx = await contract.registerVoter(voter1.address, ID_HASH_1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx).to.emit(contract, "VoterRegistered")
        .withArgs(voter1.address, ID_HASH_1, block.timestamp);
    });
    it("doit incrémenter totalRegistered", async function () {
      await contract.registerVoter(voter1.address, ID_HASH_1);
      expect(await contract.totalRegistered()).to.equal(1);
    });
    it("doit refuser l'enregistrement en double du même wallet", async function () {
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await expect(contract.registerVoter(voter1.address, ID_HASH_2))
        .to.be.revertedWith("Ce wallet est deja enregistre");
    });
    it("doit refuser le multi-wallet — même CIN deux wallets", async function () {
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await expect(contract.registerVoter(voter2.address, ID_HASH_1))
        .to.be.revertedWith("Cet ID est deja lie a un autre wallet : tentative multi-wallet detectee");
    });
    it("doit refuser l'enregistrement par un non-owner", async function () {
      await expect(contract.connect(stranger).registerVoter(voter1.address, ID_HASH_1))
        .to.be.revertedWith("Acces refuse : vous n'etes pas admin");
    });
    it("doit détecter si un hash CIN est déjà enregistré", async function () {
      expect(await contract.isIdHashRegistered(ID_HASH_1)).to.equal(false);
      await contract.registerVoter(voter1.address, ID_HASH_1);
      expect(await contract.isIdHashRegistered(ID_HASH_1)).to.equal(true);
    });
  });

  // =========================================================
  //  VOTE
  // =========================================================
  describe("Vote", function () {
    beforeEach(async function () {
      await contract.addCandidate("Candidat A");
      await contract.addCandidate("Candidat B");
      await contract.openVoting();
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.registerVoter(voter2.address, ID_HASH_2);
      await contract.registerVoter(voter3.address, ID_HASH_3);
    });

    it("doit permettre à un électeur inscrit de voter", async function () {
      await contract.connect(voter1).vote(1);
      const [, hasVoted] = await contract.getVoterStatus(voter1.address);
      expect(hasVoted).to.equal(true);
    });
    it("doit émettre l'event VoteCast", async function () {
      const tx = await contract.connect(voter1).vote(1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx).to.emit(contract, "VoteCast")
        .withArgs(voter1.address, 1, block.timestamp);
    });
    it("doit incrémenter le compteur du candidat", async function () {
      await contract.connect(voter1).vote(1);
      const [, voteCount] = await contract.getCandidate(1);
      expect(voteCount).to.equal(1);
    });
    it("doit incrémenter totalVotes", async function () {
      await contract.connect(voter1).vote(1);
      await contract.connect(voter2).vote(1);
      expect(await contract.totalVotes()).to.equal(2);
    });
    it("🔒 doit bloquer le DOUBLE VOTE", async function () {
      await contract.connect(voter1).vote(1);
      await expect(contract.connect(voter1).vote(1))
        .to.be.revertedWith("Vous avez deja vote : double vote interdit");
    });
    it("🔒 doit bloquer un non-inscrit", async function () {
      await expect(contract.connect(stranger).vote(1))
        .to.be.revertedWith("Vous n'etes pas inscrit comme electeur");
    });
    it("🔒 doit bloquer si le vote est fermé", async function () {
      await contract.closeVoting();
      await expect(contract.connect(voter1).vote(1))
        .to.be.revertedWith("Le vote est actuellement ferme");
    });
    it("🔒 doit refuser un candidat inexistant", async function () {
      await expect(contract.connect(voter1).vote(99))
        .to.be.revertedWith("Ce candidat n'existe pas");
    });
    it("doit compter correctement plusieurs votes", async function () {
      await contract.connect(voter1).vote(1);
      await contract.connect(voter2).vote(1);
      await contract.connect(voter3).vote(2);
      const [, count1] = await contract.getCandidate(1);
      const [, count2] = await contract.getCandidate(2);
      expect(count1).to.equal(2);
      expect(count2).to.equal(1);
    });
  });

  // =========================================================
  //  RÉSULTATS
  // =========================================================
  describe("Resultats", function () {
    it("doit retourner les résultats corrects", async function () {
      await contract.addCandidate("Candidat A");
      await contract.addCandidate("Candidat B");
      await contract.openVoting();
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.registerVoter(voter2.address, ID_HASH_2);
      await contract.connect(voter1).vote(1);
      await contract.connect(voter2).vote(2);
      const [ids, names, voteCounts] = await contract.getResults();
      expect(names[0]).to.equal("Candidat A");
      expect(voteCounts[0]).to.equal(1n);
      expect(names[1]).to.equal("Candidat B");
      expect(voteCounts[1]).to.equal(1n);
    });
    it("doit retourner 0 votes avant toute élection", async function () {
      await contract.addCandidate("Candidat A");
      const [, , voteCounts] = await contract.getResults();
      expect(voteCounts[0]).to.equal(0n);
    });
  });

  // =========================================================
  //  BUG 2 — ADMIN NE PEUT PAS VOTER
  // =========================================================
  describe("Admin ne peut pas voter", function () {
    it("🔒 doit refuser l'enregistrement de l'admin comme électeur", async function () {
      await expect(contract.registerVoter(owner.address, ID_HASH_1))
        .to.be.revertedWith("L'administrateur ne peut pas voter");
    });
  });

  // =========================================================
  //  FEATURE 3 — VOTE BLANC
  // =========================================================
  describe("Vote Blanc", function () {
    it("doit activer le vote blanc avec openVotingWithBlank", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVotingWithBlank(0, "Présidentielle");
      expect(await contract.blankVoteEnabled()).to.equal(true);
    });

    it("doit permettre à un électeur de voter blanc", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVotingWithBlank(0, "");
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.connect(voter1).vote(0);
      const [, hasVoted] = await contract.getVoterStatus(voter1.address);
      expect(hasVoted).to.equal(true);
    });

    it("doit incrémenter getBlankVotes après un vote blanc", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVotingWithBlank(0, "");
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.connect(voter1).vote(0);
      expect(await contract.getBlankVotes()).to.equal(1n);
    });

    it("doit incrémenter totalVotes pour un vote blanc", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVotingWithBlank(0, "");
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.connect(voter1).vote(0);
      expect(await contract.totalVotes()).to.equal(1n);
    });

    it("🔒 doit refuser vote blanc si non activé", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVoting();
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await expect(contract.connect(voter1).vote(0))
        .to.be.revertedWith("Le vote blanc n'est pas active");
    });

    it("doit ne PAS inclure vote blanc dans getResults", async function () {
      await contract.addCandidate("Candidat A");
      await contract.openVotingWithBlank(0, "");
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.registerVoter(voter2.address, ID_HASH_2);
      await contract.connect(voter1).vote(0);
      await contract.connect(voter2).vote(1);
      const [ids, names, voteCounts] = await contract.getResults();
      expect(ids.length).to.equal(1); // seul candidat 1
      expect(names[0]).to.equal("Candidat A");
      expect(voteCounts[0]).to.equal(1n);
    });
  });

  // =========================================================
  //  FEATURE 5 — DÉLÉGATION
  // =========================================================
  describe("Délégation de vote", function () {
    beforeEach(async function () {
      await contract.addCandidate("Candidat A");
      await contract.addCandidate("Candidat B");
      await contract.openVoting();
      await contract.registerVoter(voter1.address, ID_HASH_1);
      await contract.registerVoter(voter2.address, ID_HASH_2);
    });

    it("doit permettre à un électeur de déléguer son vote", async function () {
      await contract.connect(voter1).delegate(voter2.address);
      expect(await contract.hasDelegated(voter1.address)).to.equal(true);
      expect(await contract.delegations(voter1.address)).to.equal(voter2.address);
    });

    it("doit émettre l'event VoteDelegated", async function () {
      await expect(contract.connect(voter1).delegate(voter2.address))
        .to.emit(contract, "VoteDelegated")
        .withArgs(voter1.address, voter2.address);
    });

    it("doit permettre au délégué de voter pour le délégant", async function () {
      await contract.connect(voter1).delegate(voter2.address);
      await contract.connect(voter2).voteFor(voter1.address, 1);
      const [, hasVoted] = await contract.getVoterStatus(voter1.address);
      expect(hasVoted).to.equal(true);
    });

    it("doit émettre VoteCastByProxy lors d'un vote par délégation", async function () {
      await contract.connect(voter1).delegate(voter2.address);
      await expect(contract.connect(voter2).voteFor(voter1.address, 1))
        .to.emit(contract, "VoteCastByProxy")
        .withArgs(voter1.address, voter2.address);
    });

    it("🔒 doit refuser la délégation à soi-même", async function () {
      await expect(contract.connect(voter1).delegate(voter1.address))
        .to.be.revertedWith("Impossible de vous deleguer a vous-meme");
    });

    it("🔒 doit refuser de voter directement si on a délégué", async function () {
      await contract.connect(voter1).delegate(voter2.address);
      await expect(contract.connect(voter1).vote(1))
        .to.be.revertedWith("Vous avez delegue votre vote");
    });

    it("🔒 doit refuser la délégation si on a déjà voté", async function () {
      await contract.connect(voter1).vote(1);
      await expect(contract.connect(voter1).delegate(voter2.address))
        .to.be.revertedWith("Vous avez deja vote");
    });

    it("🔒 doit refuser voteFor sans délégation valide", async function () {
      // voter2 essaie de voter pour voter1 sans délégation
      await expect(contract.connect(voter2).voteFor(voter1.address, 1))
        .to.be.revertedWith("Vous n'avez pas de delegation de cet electeur");
    });
  });

});
