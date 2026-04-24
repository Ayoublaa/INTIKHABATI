const { expect }  = require("chai");
const { ethers }  = require("hardhat");

// ─── helpers ────────────────────────────────────────────────
const CATEGORY = { Presidential: 0, Legislative: 1, Municipal: 2, Regional: 3, Referendum: 4 };
// v3 status enum
const STATUS = { Upcoming: 0, Open: 1, Revealing: 2, Closed: 3 };

function idHash(cin) {
  return ethers.keccak256(ethers.toUtf8Bytes(cin));
}

async function deployFresh() {
  const [owner, v1, v2, v3, v4] = await ethers.getSigners();

  // Deploy MinimalForwarder first (EIP-2771)
  const ForwarderFactory = await ethers.getContractFactory("MinimalForwarder");
  const forwarder        = await ForwarderFactory.deploy();
  await forwarder.waitForDeployment();

  // CivicChain now takes trusted forwarder address in constructor
  const Factory  = await ethers.getContractFactory("CivicChain");
  const contract = await Factory.deploy(await forwarder.getAddress());
  await contract.waitForDeployment();

  return { contract, forwarder, owner, v1, v2, v3, v4 };
}

async function futureDeadline(secs = 3600) {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + secs;
}

// v3: createElection takes 5 params (added commitReveal bool)
async function readyElection(contract, owner, opts = {}) {
  const deadline = opts.deadline ?? await futureDeadline();
  const commitReveal = opts.commitReveal ?? false;
  await contract.connect(owner).createElection(
    opts.name ?? "Test Election",
    opts.category ?? CATEGORY.Presidential,
    deadline,
    opts.blank !== undefined ? opts.blank : true,
    commitReveal   // v3: 5th param
  );
  const eid = await contract.electionCount();
  await contract.connect(owner).addCandidate(eid, "Alice", "Party A");
  await contract.connect(owner).addCandidate(eid, "Bob",   "Party B");
  await contract.connect(owner).openElection(eid);
  return Number(eid);
}

// ============================================================
//  SUITE 1 — DEPLOYMENT
// ============================================================
describe("CivicChain v3 — Deployment", function () {
  it("sets the owner correctly", async function () {
    const { contract, owner } = await deployFresh();
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("starts with 0 elections", async function () {
    const { contract } = await deployFresh();
    expect(await contract.electionCount()).to.equal(0n);
  });
});

// ============================================================
//  SUITE 2 — ELECTION LIFECYCLE
// ============================================================
describe("CivicChain v3 — Election lifecycle", function () {
  it("creates an election in Upcoming status (status=0)", async function () {
    const { contract, owner } = await deployFresh();
    const deadline = await futureDeadline();
    await contract.connect(owner).createElection("Presidentielle 2026", CATEGORY.Presidential, deadline, true, false);
    const eid = await contract.electionCount();
    const e   = await contract.getElection(eid);
    expect(e.name).to.equal("Presidentielle 2026");
    expect(Number(e.status)).to.equal(STATUS.Upcoming);
    expect(Number(e.category)).to.equal(CATEGORY.Presidential);
    expect(e.blankVoteEnabled).to.be.true;
    expect(e.isCommitReveal).to.be.false;
  });

  it("createElection with commitReveal=true sets isCommitReveal flag", async function () {
    const { contract, owner } = await deployFresh();
    await contract.connect(owner).createElection("CR Election", CATEGORY.Municipal, await futureDeadline(), true, true);
    const eid = await contract.electionCount();
    const e   = await contract.getElection(eid);
    expect(e.isCommitReveal).to.be.true;
  });

  it("reverts createElection if name is empty", async function () {
    const { contract, owner } = await deployFresh();
    await expect(
      contract.connect(owner).createElection("", CATEGORY.Municipal, await futureDeadline(), true, false)
    ).to.be.revertedWith("Name required");
  });

  it("reverts createElection if deadline is in the past", async function () {
    const { contract, owner } = await deployFresh();
    const past = Math.floor(Date.now() / 1000) - 100;
    await expect(
      contract.connect(owner).createElection("Bad", CATEGORY.Municipal, past, true, false)
    ).to.be.revertedWith("Deadline must be future");
  });

  it("non-owner cannot create election", async function () {
    const { contract, v1 } = await deployFresh();
    await expect(
      contract.connect(v1).createElection("Hack", CATEGORY.Municipal, await futureDeadline(), false, false)
    ).to.be.revertedWith("Access denied: not admin");
  });

  it("adds candidates and opens election (status=1)", async function () {
    const { contract, owner } = await deployFresh();
    await contract.connect(owner).createElection("Leg 2026", CATEGORY.Legislative, await futureDeadline(), true, false);
    const eid = await contract.electionCount();
    await contract.connect(owner).addCandidate(eid, "Alice", "Party A");
    await contract.connect(owner).addCandidate(eid, "Bob",   "Party B");
    const cands = await contract.getCandidates(eid);
    expect(cands.length).to.equal(2);
    expect(cands[0].name).to.equal("Alice");
    await contract.connect(owner).openElection(eid);
    const e = await contract.getElection(eid);
    expect(Number(e.status)).to.equal(STATUS.Open);
  });

  it("reverts addCandidate when election is not Upcoming", async function () {
    const { contract, owner } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await expect(
      contract.connect(owner).addCandidate(eid, "Charlie", "")
    ).to.be.revertedWith("Must be Upcoming");
  });

  it("reverts duplicate candidate name", async function () {
    const { contract, owner } = await deployFresh();
    await contract.connect(owner).createElection("E", CATEGORY.Municipal, await futureDeadline(), false, false);
    const eid = await contract.electionCount();
    await contract.connect(owner).addCandidate(eid, "Alice", "A");
    await expect(
      contract.connect(owner).addCandidate(eid, "Alice", "B")
    ).to.be.revertedWith("Name exists");
  });

  it("reverts openElection if no candidates", async function () {
    const { contract, owner } = await deployFresh();
    await contract.connect(owner).createElection("Empty", CATEGORY.Municipal, await futureDeadline(), false, false);
    const eid = await contract.electionCount();
    await expect(contract.connect(owner).openElection(eid))
      .to.be.revertedWith("Add candidates first");
  });

  it("v3: closeElection sets status=3 (Closed)", async function () {
    const { contract, owner } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).closeElection(eid);
    const e = await contract.getElection(eid);
    expect(Number(e.status)).to.equal(STATUS.Closed); // v3: Closed = 3
  });

  it("reverts closeElection if already closed", async function () {
    const { contract, owner } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).closeElection(eid);
    await expect(contract.connect(owner).closeElection(eid))
      .to.be.revertedWith("Not closeable");
  });

  it("triggerAutoClose works after deadline", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const deadline = await futureDeadline(10);
    await contract.connect(owner).createElection("AutoClose", CATEGORY.Referendum, deadline, false, false);
    const eid = await contract.electionCount();
    await contract.connect(owner).addCandidate(eid, "Yes", "");
    await contract.connect(owner).openElection(eid);
    await ethers.provider.send("evm_increaseTime", [20]);
    await ethers.provider.send("evm_mine", []);
    await contract.connect(v1).triggerAutoClose(eid);
    const e = await contract.getElection(eid);
    expect(Number(e.status)).to.equal(STATUS.Closed);
  });

  it("multiple elections are independent", async function () {
    const { contract, owner } = await deployFresh();
    await contract.connect(owner).createElection("E1", CATEGORY.Presidential, await futureDeadline(), true,  false);
    await contract.connect(owner).createElection("E2", CATEGORY.Municipal,    await futureDeadline(), false, true);
    const e1 = await contract.getElection(1n);
    const e2 = await contract.getElection(2n);
    expect(e1.name).to.equal("E1");
    expect(e2.name).to.equal("E2");
    expect(e1.isCommitReveal).to.be.false;
    expect(e2.isCommitReveal).to.be.true;
  });
});

// ============================================================
//  SUITE 3 — VOTER REGISTRATION
// ============================================================
describe("CivicChain v3 — Voter registration", function () {
  it("registers a voter for a specific election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("ID001"));
    const s = await contract.getVoterStatus(eid, v1.address);
    expect(s.isRegistered).to.be.true;
    expect(s.hasVoted).to.be.false;
  });

  it("voterElections tracks which elections a wallet joined", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid1 = await readyElection(contract, owner, { name: "E1" });
    const eid2 = await readyElection(contract, owner, { name: "E2" });
    await contract.connect(owner).registerVoter(eid1, v1.address, idHash("CIN1_E1"));
    await contract.connect(owner).registerVoter(eid2, v1.address, idHash("CIN1_E2"));
    const eids = await contract.getVoterElections(v1.address);
    expect(eids.length).to.equal(2);
  });

  it("reverts if admin tries to register as voter", async function () {
    const { contract, owner } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await expect(
      contract.connect(owner).registerVoter(eid, owner.address, idHash("ADM"))
    ).to.be.revertedWith("Admin cannot vote");
  });

  it("reverts duplicate wallet in same election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("ID001"));
    await expect(
      contract.connect(owner).registerVoter(eid, v1.address, idHash("ID002"))
    ).to.be.revertedWith("Already registered");
  });

  it("reverts duplicate idHash in same election", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("ID001"));
    await expect(
      contract.connect(owner).registerVoter(eid, v2.address, idHash("ID001"))
    ).to.be.revertedWith("ID linked to another wallet");
  });

  it("same wallet can register in two different elections", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid1 = await readyElection(contract, owner, { name: "E1" });
    const eid2 = await readyElection(contract, owner, { name: "E2" });
    await contract.connect(owner).registerVoter(eid1, v1.address, idHash("SAME_CIN_E1"));
    await contract.connect(owner).registerVoter(eid2, v1.address, idHash("SAME_CIN_E2"));
    const s1 = await contract.getVoterStatus(eid1, v1.address);
    const s2 = await contract.getVoterStatus(eid2, v1.address);
    expect(s1.isRegistered).to.be.true;
    expect(s2.isRegistered).to.be.true;
  });

  it("reverts registering for a closed election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).closeElection(eid);
    await expect(
      contract.connect(owner).registerVoter(eid, v1.address, idHash("ID_LATE"))
    ).to.be.revertedWith("Election closed");
  });
});

// ============================================================
//  SUITE 4 — DIRECT VOTING
// ============================================================
describe("CivicChain v3 — Direct voting", function () {
  it("registered voter can vote for a candidate", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).vote(eid, 1);
    const s = await contract.getVoterStatus(eid, v1.address);
    expect(s.hasVoted).to.be.true;
    const e = await contract.getElection(eid);
    expect(Number(e.totalVotes)).to.equal(1);
  });

  it("reverts double vote in same election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).vote(eid, 1);
    await expect(contract.connect(v1).vote(eid, 2))
      .to.be.revertedWith("Already voted");
  });

  it("unregistered voter cannot vote", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await expect(contract.connect(v1).vote(eid, 1))
      .to.be.revertedWith("Not registered for this election");
  });

  it("reverts vote with invalid candidateId", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await expect(contract.connect(v1).vote(eid, 99))
      .to.be.revertedWith("Candidate does not exist");
  });

  it("blank vote works when enabled", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner, { blank: true });
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).vote(eid, 0);
    const [, blankVotes] = await contract.getElectionResults(eid);
    expect(Number(blankVotes)).to.equal(1);
  });

  it("blank vote reverts when disabled", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner, { blank: false });
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await expect(contract.connect(v1).vote(eid, 0))
      .to.be.revertedWith("Blank vote not enabled");
  });

  it("getElectionResults returns correct vote counts", async function () {
    const { contract, owner, v1, v2, v3 } = await deployFresh();
    const eid = await readyElection(contract, owner, { blank: true });
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("H1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("H2"));
    await contract.connect(owner).registerVoter(eid, v3.address, idHash("H3"));
    await contract.connect(v1).vote(eid, 1);
    await contract.connect(v2).vote(eid, 1);
    await contract.connect(v3).vote(eid, 0); // blank
    const [cands, blank, total] = await contract.getElectionResults(eid);
    expect(Number(cands[0].voteCount)).to.equal(2);
    expect(Number(cands[1].voteCount)).to.equal(0);
    expect(Number(blank)).to.equal(1);
    expect(Number(total)).to.equal(3);
  });

  it("vote() reverts on commit-reveal election — must use commitVote", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner, { commitReveal: true });
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await expect(contract.connect(v1).vote(eid, 1))
      .to.be.revertedWith("Use commitVote for this election");
  });
});

// ============================================================
//  SUITE 5 — COMMIT-REVEAL VOTING (v3)
// ============================================================
describe("CivicChain v3 — Commit-Reveal voting", function () {
  async function readyCRElection(contract, owner, opts = {}) {
    return readyElection(contract, owner, { ...opts, commitReveal: true });
  }

  function makeCommitment(candidateId, secret) {
    return ethers.keccak256(
      ethers.solidityPacked(['uint256', 'bytes32'], [BigInt(candidateId), secret])
    );
  }

  it("voter can commit a vote", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    const [committed] = await contract.getCommitRevealStatus(eid, v1.address);
    expect(committed).to.be.true;
  });

  it("voter cannot commit twice", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await expect(contract.connect(v1).commitVote(eid, commit))
      .to.be.revertedWith("Already committed");
  });

  it("cannot reveal before startRevealPhase", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await expect(contract.connect(v1).revealVote(eid, 1, secret))
      .to.be.revertedWith("Not in reveal phase");
  });

  it("full commit-reveal flow works correctly", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid     = await readyCRElection(contract, owner);
    const secret1 = ethers.hexlify(ethers.randomBytes(32));
    const secret2 = ethers.hexlify(ethers.randomBytes(32));
    const commit1 = makeCommitment(1, secret1); // v1 votes Alice (id=1)
    const commit2 = makeCommitment(2, secret2); // v2 votes Bob   (id=2)

    await contract.connect(owner).registerVoter(eid, v1.address, idHash("CR1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("CR2"));

    // Phase 1 — Commit
    await contract.connect(v1).commitVote(eid, commit1);
    await contract.connect(v2).commitVote(eid, commit2);

    // Start reveal phase
    await contract.connect(owner).startRevealPhase(eid);
    const e = await contract.getElection(eid);
    expect(Number(e.status)).to.equal(STATUS.Revealing);

    // Phase 2 — Reveal
    await contract.connect(v1).revealVote(eid, 1, secret1);
    await contract.connect(v2).revealVote(eid, 2, secret2);

    const [cands, , total] = await contract.getElectionResults(eid);
    expect(Number(total)).to.equal(2);
    expect(Number(cands[0].voteCount)).to.equal(1); // Alice
    expect(Number(cands[1].voteCount)).to.equal(1); // Bob
  });

  it("reveal with wrong secret is rejected", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid        = await readyCRElection(contract, owner);
    const secret     = ethers.hexlify(ethers.randomBytes(32));
    const wrongSecret= ethers.hexlify(ethers.randomBytes(32));
    const commit     = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await contract.connect(owner).startRevealPhase(eid);
    await expect(contract.connect(v1).revealVote(eid, 1, wrongSecret))
      .to.be.revertedWith("Commitment mismatch");
  });

  it("reveal with wrong candidate is rejected", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret); // committed for candidate 1
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await contract.connect(owner).startRevealPhase(eid);
    await expect(contract.connect(v1).revealVote(eid, 2, secret)) // wrong candidate
      .to.be.revertedWith("Commitment mismatch");
  });

  it("cannot reveal twice", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await contract.connect(owner).startRevealPhase(eid);
    await contract.connect(v1).revealVote(eid, 1, secret);
    await expect(contract.connect(v1).revealVote(eid, 1, secret))
      .to.be.revertedWith("Already revealed");
  });

  it("can close election from Revealing phase", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyCRElection(contract, owner);
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = makeCommitment(1, secret);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    await contract.connect(v1).commitVote(eid, commit);
    await contract.connect(owner).startRevealPhase(eid);
    await contract.connect(owner).closeElection(eid);
    const e = await contract.getElection(eid);
    expect(Number(e.status)).to.equal(STATUS.Closed);
  });
});

// ============================================================
//  SUITE 6 — DELEGATION
// ============================================================
describe("CivicChain v3 — Delegation", function () {
  it("voter can delegate to another registered voter", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("D1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("D2"));
    await contract.connect(v1).delegate(eid, v2.address);
    const s = await contract.getVoterStatus(eid, v1.address);
    expect(s.hasDelegated).to.be.true;
    expect(s.delegatedTo).to.equal(v2.address);
  });

  it("delegate can vote for delegator", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("D1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("D2"));
    await contract.connect(v1).delegate(eid, v2.address);
    await contract.connect(v2).voteFor(eid, v1.address, 1);
    const s = await contract.getVoterStatus(eid, v1.address);
    expect(s.hasVoted).to.be.true;
    const e = await contract.getElection(eid);
    expect(Number(e.totalVotes)).to.equal(1);
  });

  it("delegated voter cannot vote directly", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("D1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("D2"));
    await contract.connect(v1).delegate(eid, v2.address);
    await expect(contract.connect(v1).vote(eid, 1))
      .to.be.revertedWith("Vote delegated");
  });

  it("reverts self-delegation", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("D1"));
    await expect(contract.connect(v1).delegate(eid, v1.address))
      .to.be.revertedWith("Self-delegation");
  });

  it("reverts chain delegation", async function () {
    const { contract, owner, v1, v2, v3 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("D1"));
    await contract.connect(owner).registerVoter(eid, v2.address, idHash("D2"));
    await contract.connect(owner).registerVoter(eid, v3.address, idHash("D3"));
    await contract.connect(v2).delegate(eid, v3.address);
    await expect(contract.connect(v1).delegate(eid, v2.address))
      .to.be.revertedWith("No chain delegation");
  });

  it("delegation is per-election — no cross-election bleed", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid1 = await readyElection(contract, owner, { name: "E1" });
    const eid2 = await readyElection(contract, owner, { name: "E2" });
    await contract.connect(owner).registerVoter(eid1, v1.address, idHash("E1_V1"));
    await contract.connect(owner).registerVoter(eid1, v2.address, idHash("E1_V2"));
    await contract.connect(owner).registerVoter(eid2, v1.address, idHash("E2_V1"));
    await contract.connect(owner).registerVoter(eid2, v2.address, idHash("E2_V2"));
    await contract.connect(v1).delegate(eid1, v2.address);
    await contract.connect(v1).vote(eid2, 1);
    const s2 = await contract.getVoterStatus(eid2, v1.address);
    expect(s2.hasVoted).to.be.true;
    expect(s2.hasDelegated).to.be.false;
  });
});

// ============================================================
//  SUITE 7 — SECURITY
// ============================================================
describe("CivicChain v3 — Security", function () {
  it("non-owner cannot open election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    await contract.connect(owner).createElection("S", CATEGORY.Municipal, await futureDeadline(), false, false);
    const eid = await contract.electionCount();
    await contract.connect(owner).addCandidate(eid, "A", "");
    await expect(contract.connect(v1).openElection(eid))
      .to.be.revertedWith("Access denied: not admin");
  });

  it("non-owner cannot close election", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await expect(contract.connect(v1).closeElection(eid))
      .to.be.revertedWith("Access denied: not admin");
  });

  it("non-owner cannot register voter", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    await expect(
      contract.connect(v1).registerVoter(eid, v2.address, idHash("X"))
    ).to.be.revertedWith("Access denied: not admin");
  });

  it("electionExists: reverts for id 0", async function () {
    const { contract } = await deployFresh();
    await expect(contract.getElection(0)).to.be.revertedWith("Election does not exist");
  });

  it("electionExists: reverts for id beyond count", async function () {
    const { contract } = await deployFresh();
    await expect(contract.getElection(999)).to.be.revertedWith("Election does not exist");
  });

  it("vote rejected after deadline (auto-close via modifier)", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const deadline = await futureDeadline(5);
    await contract.connect(owner).createElection("Short", CATEGORY.Referendum, deadline, false, false);
    const eid = await contract.electionCount();
    await contract.connect(owner).addCandidate(eid, "X", "");
    await contract.connect(owner).openElection(eid);
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("VX"));
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await expect(contract.connect(v1).vote(eid, 1))
      .to.be.revertedWith("Election is not open");
  });

  it("idHash uniqueness prevents same ID across wallets in same election", async function () {
    const { contract, owner, v1, v2 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    const sharedHash = idHash("SAME_CIN");
    await contract.connect(owner).registerVoter(eid, v1.address, sharedHash);
    await expect(
      contract.connect(owner).registerVoter(eid, v2.address, sharedHash)
    ).to.be.revertedWith("ID linked to another wallet");
  });

  it("non-owner cannot call startRevealPhase", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner, { commitReveal: true });
    await expect(contract.connect(v1).startRevealPhase(eid))
      .to.be.revertedWith("Access denied: not admin");
  });
});

// ============================================================
//  SUITE 8 — VIEW FUNCTIONS
// ============================================================
describe("CivicChain v3 — View functions", function () {
  it("getAllElections returns all elections", async function () {
    const { contract, owner } = await deployFresh();
    await readyElection(contract, owner, { name: "E1" });
    await readyElection(contract, owner, { name: "E2" });
    await readyElection(contract, owner, { name: "E3" });
    const all = await contract.getAllElections();
    expect(all.length).to.equal(3);
    expect(all[0].name).to.equal("E1");
    expect(all[2].name).to.equal("E3");
  });

  it("getTimeRemaining returns 0 after deadline", async function () {
    const { contract, owner } = await deployFresh();
    const eid = await readyElection(contract, owner, { deadline: await futureDeadline(5) });
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    const remaining = await contract.getTimeRemaining(eid);
    expect(Number(remaining)).to.equal(0);
  });

  it("getCommitRevealStatus returns correct state", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid    = await readyElection(contract, owner, { commitReveal: true });
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const commit = ethers.keccak256(
      ethers.solidityPacked(['uint256','bytes32'], [1n, secret])
    );
    await contract.connect(owner).registerVoter(eid, v1.address, idHash("V1"));
    let [committed, revealed] = await contract.getCommitRevealStatus(eid, v1.address);
    expect(committed).to.be.false;
    expect(revealed).to.be.false;
    await contract.connect(v1).commitVote(eid, commit);
    [committed, revealed] = await contract.getCommitRevealStatus(eid, v1.address);
    expect(committed).to.be.true;
    expect(revealed).to.be.false;
    await contract.connect(owner).startRevealPhase(eid);
    await contract.connect(v1).revealVote(eid, 1, secret);
    [committed, revealed] = await contract.getCommitRevealStatus(eid, v1.address);
    expect(committed).to.be.true;
    expect(revealed).to.be.true;
  });

  it("isIdRegisteredInElection returns correct values", async function () {
    const { contract, owner, v1 } = await deployFresh();
    const eid = await readyElection(contract, owner);
    const h = idHash("UNIQUE_ID");
    expect(await contract.isIdRegisteredInElection(eid, h)).to.be.false;
    await contract.connect(owner).registerVoter(eid, v1.address, h);
    expect(await contract.isIdRegisteredInElection(eid, h)).to.be.true;
  });
});
