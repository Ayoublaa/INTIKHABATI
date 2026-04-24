// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ─────────────────────────────────────────────────────────────
//  ERC2771Context — embedded (no OpenZeppelin dependency)
//  Extracts the real sender from the last 20 bytes of calldata
//  when the call originates from the trusted forwarder.
// ─────────────────────────────────────────────────────────────
abstract contract ERC2771Context {

    address private immutable _trustedForwarder;

    constructor(address forwarderAddress) {
        _trustedForwarder = forwarderAddress;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == _trustedForwarder;
    }

    function trustedForwarder() external view returns (address) {
        return _trustedForwarder;
    }

    /**
     * @dev Returns the actual sender.
     *      If the call comes from the trusted forwarder, the real
     *      sender is appended as the last 20 bytes of calldata.
     */
    function _msgSender() internal view virtual returns (address sender) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            return msg.data[:msg.data.length - 20];
        }
        return msg.data;
    }
}


/**
 * @title  CivicChain v3  (EIP-2771 Gasless)
 * @notice Multi-election voting system — INTIKHABATI
 * @dev    v3 adds: Commit-Reveal privacy layer + Revealing phase
 *         v3.1 adds: EIP-2771 meta-transactions via MinimalForwarder
 *                    Voters sign EIP-712 typed data; relayer pays gas.
 */
contract CivicChain is ERC2771Context {

    // =========================================================
    //  SECTION 1 : ENUMS
    // =========================================================

    enum ElectionStatus {
        Upcoming,   // 0 — created, not open
        Open,       // 1 — voting open (direct) OR commit phase
        Revealing,  // 2 — reveal phase (commit-reveal elections only)
        Closed      // 3 — results final
    }

    enum ElectionCategory {
        Presidential, // 0
        Legislative,  // 1
        Municipal,    // 2
        Regional,     // 3
        Referendum    // 4
    }


    // =========================================================
    //  SECTION 2 : STRUCTS
    // =========================================================

    struct Candidate {
        uint256 id;
        string  name;
        string  party;
        uint256 voteCount;
        bool    exists;
    }

    struct Election {
        uint256          id;
        string           name;
        ElectionCategory category;
        ElectionStatus   status;
        uint256          deadline;
        uint256          createdAt;
        uint256          totalVotes;
        uint256          totalRegistered;
        bool             blankVoteEnabled;
        uint256          candidateCount;
        bool             isCommitReveal;   // v3: commit-reveal flag
    }

    struct VoterInElection {
        bool    isRegistered;
        bool    hasVoted;
        bool    hasDelegated;
        address delegatedTo;
        bytes32 idHash;
        uint256 voteTimestamp;
    }


    // =========================================================
    //  SECTION 3 : STATE VARIABLES
    // =========================================================

    address public owner;
    uint256 public electionCount;

    mapping(uint256 => Election)                                    public elections;
    mapping(uint256 => mapping(uint256 => Candidate))               public candidates;
    mapping(uint256 => mapping(address => VoterInElection))         public voters;
    mapping(uint256 => mapping(bytes32 => address))                 public idHashToWallet;
    mapping(address => uint256[])                                   public voterElections;

    // ── v3: Commit-Reveal ─────────────────────────────────────
    // commitment = keccak256(abi.encodePacked(candidateId, secret))
    mapping(uint256 => mapping(address => bytes32)) public voteCommitments;
    mapping(uint256 => mapping(address => bool))    public hasCommitted;
    mapping(uint256 => mapping(address => bool))    public hasRevealed;


    // =========================================================
    //  SECTION 4 : EVENTS
    // =========================================================

    event ElectionCreated(uint256 indexed electionId, string name, uint8 category, uint256 deadline);
    event ElectionOpened(uint256 indexed electionId, uint256 timestamp);
    event ElectionClosed(uint256 indexed electionId, uint256 timestamp);
    event RevealPhaseStarted(uint256 indexed electionId, uint256 timestamp);

    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name, string party);

    event VoterRegistered(uint256 indexed electionId, address indexed voter, bytes32 indexed idHash);

    event VoteCast(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId, uint256 timestamp);
    event VoteCommitted(uint256 indexed electionId, address indexed voter);
    event VoteRevealed(uint256 indexed electionId, address indexed voter, uint256 indexed candidateId);

    event VoteDelegated(uint256 indexed electionId, address indexed from, address indexed to);
    event VoteCastByProxy(uint256 indexed electionId, address indexed delegator, address indexed proxy, uint256 candidateId);


    // =========================================================
    //  SECTION 5 : MODIFIERS
    // =========================================================

    // Admin functions use raw msg.sender (admin never calls through forwarder)
    modifier onlyOwner() {
        require(msg.sender == owner, "Access denied: not admin");
        _;
    }

    modifier electionExists(uint256 _eid) {
        require(_eid > 0 && _eid <= electionCount, "Election does not exist");
        _;
    }

    // Auto-close if deadline passed; then require Open status
    modifier electionOpen(uint256 _eid) {
        Election storage e = elections[_eid];
        if (
            e.deadline > 0 &&
            block.timestamp > e.deadline &&
            (e.status == ElectionStatus.Open || e.status == ElectionStatus.Revealing)
        ) {
            e.status = ElectionStatus.Closed;
            emit ElectionClosed(_eid, block.timestamp);
        }
        require(e.status == ElectionStatus.Open, "Election is not open");
        _;
    }

    modifier electionUpcoming(uint256 _eid) {
        require(elections[_eid].status == ElectionStatus.Upcoming, "Must be Upcoming");
        _;
    }

    // ── EIP-2771: use _msgSender() so meta-tx voters are recognised ──
    modifier onlyRegistered(uint256 _eid) {
        require(voters[_eid][_msgSender()].isRegistered, "Not registered for this election");
        _;
    }


    // =========================================================
    //  SECTION 6 : CONSTRUCTOR
    // =========================================================

    /**
     * @param forwarderAddress  Address of MinimalForwarder deployed alongside.
     *                          Pass address(0) to disable meta-transactions.
     */
    constructor(address forwarderAddress) ERC2771Context(forwarderAddress) {
        owner         = msg.sender;
        electionCount = 0;
    }

    /**
     * @notice Hand control of the contract to a new owner — e.g. the
     *         MultiSigWallet. Once transferred, previous deployer keys
     *         lose all admin access.
     * @dev    Kept as a plain onlyOwner call (no two-step) because this
     *         is only used once, during deployment, by a trusted script.
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }


    // =========================================================
    //  SECTION 7 : ELECTION LIFECYCLE
    //  (admin-only — always called directly, not via forwarder)
    // =========================================================

    /**
     * @notice Create a new election.
     * @param _commitReveal  If true, voters must commit then reveal (privacy mode)
     */
    function createElection(
        string   memory  _name,
        ElectionCategory _category,
        uint256          _deadline,
        bool             _enableBlank,
        bool             _commitReveal
    ) external onlyOwner returns (uint256 newId) {
        require(bytes(_name).length > 0, "Name required");
        require(_deadline == 0 || _deadline > block.timestamp, "Deadline must be future");

        electionCount++;
        newId = electionCount;

        elections[newId] = Election({
            id:               newId,
            name:             _name,
            category:         _category,
            status:           ElectionStatus.Upcoming,
            deadline:         _deadline,
            createdAt:        block.timestamp,
            totalVotes:       0,
            totalRegistered:  0,
            blankVoteEnabled: _enableBlank,
            candidateCount:   0,
            isCommitReveal:   _commitReveal
        });

        if (_enableBlank) {
            candidates[newId][0] = Candidate({ id: 0, name: "Vote Blanc", party: "", voteCount: 0, exists: true });
        }

        emit ElectionCreated(newId, _name, uint8(_category), _deadline);
    }

    function addCandidate(uint256 _eid, string memory _name, string memory _party)
        external onlyOwner electionExists(_eid) electionUpcoming(_eid)
    {
        require(bytes(_name).length > 0, "Name required");
        Election storage e = elections[_eid];
        for (uint256 i = 1; i <= e.candidateCount; i++) {
            require(keccak256(bytes(candidates[_eid][i].name)) != keccak256(bytes(_name)), "Name exists");
        }
        e.candidateCount++;
        candidates[_eid][e.candidateCount] = Candidate({
            id: e.candidateCount, name: _name, party: _party, voteCount: 0, exists: true
        });
        emit CandidateAdded(_eid, e.candidateCount, _name, _party);
    }

    function openElection(uint256 _eid) external onlyOwner electionExists(_eid) electionUpcoming(_eid) {
        Election storage e = elections[_eid];
        require(e.candidateCount > 0, "Add candidates first");
        require(e.deadline == 0 || e.deadline > block.timestamp, "Deadline passed");
        e.status = ElectionStatus.Open;
        emit ElectionOpened(_eid, block.timestamp);
    }

    /**
     * @notice Move a commit-reveal election to reveal phase.
     */
    function startRevealPhase(uint256 _eid) external onlyOwner electionExists(_eid) {
        Election storage e = elections[_eid];
        require(e.status == ElectionStatus.Open, "Must be Open");
        require(e.isCommitReveal, "Not a commit-reveal election");
        e.status = ElectionStatus.Revealing;
        emit RevealPhaseStarted(_eid, block.timestamp);
    }

    function closeElection(uint256 _eid) external onlyOwner electionExists(_eid) {
        ElectionStatus s = elections[_eid].status;
        require(s == ElectionStatus.Open || s == ElectionStatus.Revealing, "Not closeable");
        elections[_eid].status = ElectionStatus.Closed;
        emit ElectionClosed(_eid, block.timestamp);
    }

    function triggerAutoClose(uint256 _eid) external electionExists(_eid) {
        Election storage e = elections[_eid];
        require(e.status == ElectionStatus.Open || e.status == ElectionStatus.Revealing, "Not open");
        require(e.deadline > 0,               "No deadline");
        require(block.timestamp > e.deadline, "Deadline not reached");
        e.status = ElectionStatus.Closed;
        emit ElectionClosed(_eid, block.timestamp);
    }


    // =========================================================
    //  SECTION 8 : VOTER REGISTRATION
    //  (called by backend relayer with OWNER_PRIVATE_KEY — direct, no EIP-2771)
    // =========================================================

    function registerVoter(uint256 _eid, address _voter, bytes32 _idHash)
        external onlyOwner electionExists(_eid)
    {
        require(_voter != owner, "Admin cannot vote");
        require(elections[_eid].status != ElectionStatus.Closed, "Election closed");
        require(!voters[_eid][_voter].isRegistered, "Already registered");
        require(idHashToWallet[_eid][_idHash] == address(0), "ID linked to another wallet");

        voters[_eid][_voter] = VoterInElection({
            isRegistered:  true,
            hasVoted:      false,
            hasDelegated:  false,
            delegatedTo:   address(0),
            idHash:        _idHash,
            voteTimestamp: 0
        });

        idHashToWallet[_eid][_idHash] = _voter;
        elections[_eid].totalRegistered++;
        voterElections[_voter].push(_eid);

        emit VoterRegistered(_eid, _voter, _idHash);
    }


    // =========================================================
    //  SECTION 9 : DIRECT VOTING
    //  ── EIP-2771: _msgSender() used throughout ──
    // =========================================================

    function vote(uint256 _eid, uint256 _candidateId)
        external electionExists(_eid) electionOpen(_eid) onlyRegistered(_eid)
    {
        require(!elections[_eid].isCommitReveal, "Use commitVote for this election");
        address sender = _msgSender();
        VoterInElection storage v = voters[_eid][sender];
        require(!v.hasVoted,     "Already voted");
        require(!v.hasDelegated, "Vote delegated");

        _applyVote(_eid, sender, _candidateId);
        emit VoteCast(_eid, sender, _candidateId, block.timestamp);
    }


    // =========================================================
    //  SECTION 10 : COMMIT-REVEAL VOTING (v3)
    //  ── EIP-2771: _msgSender() used throughout ──
    // =========================================================

    /**
     * @notice COMMIT phase — store encrypted vote.
     * @param _commitment  keccak256(abi.encodePacked(candidateId, secret))
     */
    function commitVote(uint256 _eid, bytes32 _commitment)
        external electionExists(_eid) electionOpen(_eid) onlyRegistered(_eid)
    {
        require(elections[_eid].isCommitReveal,    "Not a commit-reveal election");
        require(_commitment != bytes32(0),          "Invalid commitment");
        address sender = _msgSender();
        require(!hasCommitted[_eid][sender],        "Already committed");
        VoterInElection storage v = voters[_eid][sender];
        require(!v.hasDelegated,                    "Vote was delegated");

        voteCommitments[_eid][sender] = _commitment;
        hasCommitted[_eid][sender]    = true;

        emit VoteCommitted(_eid, sender);
    }

    /**
     * @notice REVEAL phase — prove commitment and count vote.
     * @param _candidateId  Candidate voted for (0 = blank)
     * @param _secret       Random bytes32 used in commitment
     */
    function revealVote(uint256 _eid, uint256 _candidateId, bytes32 _secret)
        external electionExists(_eid) onlyRegistered(_eid)
    {
        Election storage e = elections[_eid];
        // Auto-close if deadline passed
        if (e.deadline > 0 && block.timestamp > e.deadline && e.status == ElectionStatus.Revealing) {
            e.status = ElectionStatus.Closed;
            emit ElectionClosed(_eid, block.timestamp);
        }
        require(e.status == ElectionStatus.Revealing, "Not in reveal phase");
        address sender = _msgSender();
        require(hasCommitted[_eid][sender],  "No commitment found");
        require(!hasRevealed[_eid][sender],  "Already revealed");

        // Verify commitment matches
        bytes32 expected = keccak256(abi.encodePacked(_candidateId, _secret));
        require(expected == voteCommitments[_eid][sender], "Commitment mismatch");

        hasRevealed[_eid][sender] = true;
        _applyVote(_eid, sender, _candidateId);

        emit VoteCast(_eid, sender, _candidateId, block.timestamp);
        emit VoteRevealed(_eid, sender, _candidateId);
    }

    // Internal: count vote
    function _applyVote(uint256 _eid, address _voter, uint256 _candidateId) internal {
        if (_candidateId == 0) {
            require(elections[_eid].blankVoteEnabled, "Blank vote not enabled");
        } else {
            require(candidates[_eid][_candidateId].exists, "Candidate does not exist");
        }
        VoterInElection storage v = voters[_eid][_voter];
        v.hasVoted      = true;
        v.voteTimestamp = block.timestamp;
        candidates[_eid][_candidateId].voteCount++;
        elections[_eid].totalVotes++;
    }


    // =========================================================
    //  SECTION 11 : DELEGATION
    //  ── EIP-2771: _msgSender() used throughout ──
    // =========================================================

    function delegate(uint256 _eid, address _to)
        external electionExists(_eid) electionOpen(_eid) onlyRegistered(_eid)
    {
        require(!elections[_eid].isCommitReveal, "Delegation not allowed in commit-reveal elections");
        address sender = _msgSender();
        VoterInElection storage senderVoter = voters[_eid][sender];
        VoterInElection storage target      = voters[_eid][_to];
        require(!senderVoter.hasVoted,     "Already voted");
        require(!senderVoter.hasDelegated, "Already delegated");
        require(_to != sender,             "Self-delegation");
        require(target.isRegistered,       "Delegate not registered");
        require(!target.hasDelegated,      "No chain delegation");

        senderVoter.hasDelegated = true;
        senderVoter.delegatedTo  = _to;
        emit VoteDelegated(_eid, sender, _to);
    }

    function voteFor(uint256 _eid, address _delegator, uint256 _candidateId)
        external electionExists(_eid) electionOpen(_eid) onlyRegistered(_eid)
    {
        address proxy = _msgSender();
        VoterInElection storage dv = voters[_eid][_delegator];
        require(dv.delegatedTo == proxy, "Not your delegator");
        require(!dv.hasVoted,            "Delegator already voted");

        _applyVote(_eid, _delegator, _candidateId);
        emit VoteCast(_eid, _delegator, _candidateId, block.timestamp);
        emit VoteCastByProxy(_eid, _delegator, proxy, _candidateId);
    }


    // =========================================================
    //  SECTION 12 : VIEW FUNCTIONS
    // =========================================================

    function getElection(uint256 _eid) external view electionExists(_eid) returns (Election memory) {
        return elections[_eid];
    }

    function getAllElections() external view returns (Election[] memory) {
        Election[] memory all = new Election[](electionCount);
        for (uint256 i = 1; i <= electionCount; i++) all[i - 1] = elections[i];
        return all;
    }

    function getCandidates(uint256 _eid) external view electionExists(_eid) returns (Candidate[] memory) {
        uint256 count = elections[_eid].candidateCount;
        Candidate[] memory result = new Candidate[](count);
        for (uint256 i = 1; i <= count; i++) result[i - 1] = candidates[_eid][i];
        return result;
    }

    function getElectionResults(uint256 _eid)
        external view electionExists(_eid)
        returns (Candidate[] memory regularCandidates, uint256 blankVotes, uint256 totalVotes)
    {
        Election storage e = elections[_eid];
        regularCandidates = new Candidate[](e.candidateCount);
        for (uint256 i = 1; i <= e.candidateCount; i++) regularCandidates[i - 1] = candidates[_eid][i];
        blankVotes = e.blankVoteEnabled ? candidates[_eid][0].voteCount : 0;
        totalVotes = e.totalVotes;
    }

    function getVoterStatus(uint256 _eid, address _voter) external view returns (VoterInElection memory) {
        return voters[_eid][_voter];
    }

    function getVoterElections(address _voter) external view returns (uint256[] memory) {
        return voterElections[_voter];
    }

    function isIdRegisteredInElection(uint256 _eid, bytes32 _idHash) external view returns (bool) {
        return idHashToWallet[_eid][_idHash] != address(0);
    }

    function getTimeRemaining(uint256 _eid) external view electionExists(_eid) returns (uint256) {
        Election storage e = elections[_eid];
        if (e.deadline == 0 || block.timestamp >= e.deadline) return 0;
        return e.deadline - block.timestamp;
    }

    function getCommitRevealStatus(uint256 _eid, address _voter)
        external view
        returns (bool committed, bool revealed, bytes32 commitment)
    {
        committed  = hasCommitted[_eid][_voter];
        revealed   = hasRevealed[_eid][_voter];
        commitment = voteCommitments[_eid][_voter];
    }
}
