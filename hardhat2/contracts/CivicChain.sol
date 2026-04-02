// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CivicChain {

    // =========================================================
    //  SECTION 1 : VARIABLES D'ÉTAT
    // =========================================================

    address public owner;
    bool    public votingOpen;
    string  public electionName;
    uint256 public totalRegistered;
    uint256 public totalVotes;

    uint256 public votingDeadline;     // timestamp UNIX de fin
    string  public electionCategory;  // ex: "Présidentielle"
    bool    public blankVoteEnabled;   // vote blanc activé


    // =========================================================
    //  SECTION 2 : STRUCTURES
    // =========================================================

    struct Voter {
        bool    isRegistered;
        bool    hasVoted;
        bytes32 idHash;
        uint256 voteTimestamp;
    }

    struct Candidate {
        uint256 id;
        string  name;
        uint256 voteCount;
        bool    exists;
    }


    // =========================================================
    //  SECTION 3 : MAPPINGS
    // =========================================================

    mapping(address => Voter)    public voters;
    mapping(uint256 => Candidate) public candidates;
    mapping(bytes32 => address)  public idHashToWallet;
    uint256 public candidateCount;

    // ── Délégation ───────────────────────────────────────────
    mapping(address => address) public delegations;  // délégant → délégué
    mapping(address => bool)    public hasDelegated; // délégant a délégué


    // =========================================================
    //  SECTION 4 : EVENTS
    // =========================================================

    event VoterRegistered(address indexed walletAddress, bytes32 indexed idHash, uint256 timestamp);
    event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp);
    event VotingOpened(uint256 timestamp, uint256 deadline, string category);
    event VotingClosed(uint256 timestamp);
    event CandidateAdded(uint256 id, string name);
    event VoteDelegated(address indexed from, address indexed to);
    event VoteCastByProxy(address indexed voter, address indexed delegator);


    // =========================================================
    //  SECTION 5 : MODIFICATEURS
    // =========================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Acces refuse : vous n'etes pas admin");
        _;
    }

    modifier whenVotingOpen() {
        if (votingOpen && votingDeadline > 0 && block.timestamp > votingDeadline) {
            votingOpen = false;
            emit VotingClosed(block.timestamp);
        }
        require(votingOpen, "Le vote est actuellement ferme");
        _;
    }

    modifier whenVotingClosed() {
        require(!votingOpen, "Le vote est encore ouvert");
        _;
    }

    modifier onlyRegistered() {
        require(voters[msg.sender].isRegistered, "Vous n'etes pas inscrit comme electeur");
        _;
    }


    // =========================================================
    //  SECTION 6 : CONSTRUCTEUR
    // =========================================================

    constructor(string memory _electionName) {
        owner            = msg.sender;
        electionName     = _electionName;
        votingOpen       = false;
        votingDeadline   = 0;
        electionCategory = "";
        blankVoteEnabled = false;
    }


    // =========================================================
    //  SECTION 7 : FONCTIONS ADMIN
    // =========================================================

    function addCandidate(string memory _name)
        external onlyOwner whenVotingClosed
    {
        candidateCount++;
        candidates[candidateCount] = Candidate({
            id: candidateCount, name: _name, voteCount: 0, exists: true
        });
        emit CandidateAdded(candidateCount, _name);
    }

    /**
     * @notice Ouvre le vote avec deadline + catégorie
     */
    function openVoting(uint256 _deadline, string memory _category)
        external onlyOwner whenVotingClosed
    {
        _openVoting(_deadline, _category, false);
    }

    /**
     * @notice Compatibilité rétroactive — ouvre sans deadline ni catégorie
     */
    function openVoting() external onlyOwner whenVotingClosed {
        _openVoting(0, "", false);
    }

    /**
     * @notice Ouvre le vote EN ACTIVANT le vote blanc (candidateId = 0)
     */
    function openVotingWithBlank(uint256 _deadline, string memory _category)
        external onlyOwner whenVotingClosed
    {
        _openVoting(_deadline, _category, true);
    }

    function _openVoting(
        uint256 _deadline,
        string memory _category,
        bool _enableBlank
    ) internal {
        require(candidateCount > 0, "Ajoutez au moins un candidat avant d'ouvrir");
        require(
            _deadline == 0 || _deadline > block.timestamp,
            "La deadline doit etre dans le futur"
        );

        votingOpen       = true;
        votingDeadline   = _deadline;
        electionCategory = _category;
        blankVoteEnabled = _enableBlank;

        if (_enableBlank) {
            candidates[0] = Candidate({
                id: 0, name: "Vote Blanc", voteCount: 0, exists: true
            });
        }

        emit VotingOpened(block.timestamp, _deadline, _category);
    }

    function closeVoting() external onlyOwner {
        require(votingOpen, "Le vote est deja ferme");
        votingOpen = false;
        emit VotingClosed(block.timestamp);
    }

    /**
     * @notice Ferme automatiquement si deadline dépassée (peut être appelé par n'importe qui)
     */
    function checkAndCloseVoting() external {
        require(votingOpen, "Le vote est deja ferme");
        require(votingDeadline > 0, "Pas de deadline definie");
        require(block.timestamp > votingDeadline, "La deadline n'est pas encore atteinte");
        votingOpen = false;
        emit VotingClosed(block.timestamp);
    }


    // =========================================================
    //  SECTION 8 : ENREGISTREMENT ÉLECTEUR
    // =========================================================

    function registerVoter(address _voterAddress, bytes32 _idHash)
        external onlyOwner
    {
        require(
            _voterAddress != owner,
            "L'administrateur ne peut pas voter"
        );
        require(!voters[_voterAddress].isRegistered, "Ce wallet est deja enregistre");
        require(
            idHashToWallet[_idHash] == address(0),
            "Cet ID est deja lie a un autre wallet : tentative multi-wallet detectee"
        );

        voters[_voterAddress] = Voter({
            isRegistered: true, hasVoted: false,
            idHash: _idHash, voteTimestamp: 0
        });
        idHashToWallet[_idHash] = _voterAddress;
        totalRegistered++;

        emit VoterRegistered(_voterAddress, _idHash, block.timestamp);
    }


    // =========================================================
    //  SECTION 9 : VOTE
    // =========================================================

    function vote(uint256 _candidateId)
        external whenVotingOpen onlyRegistered
    {
        Voter storage sender = voters[msg.sender];
        require(!sender.hasVoted, "Vous avez deja vote : double vote interdit");
        require(!hasDelegated[msg.sender], "Vous avez delegue votre vote");

        if (_candidateId == 0) {
            require(blankVoteEnabled, "Le vote blanc n'est pas active");
        } else {
            require(candidates[_candidateId].exists, "Ce candidat n'existe pas");
        }

        sender.hasVoted      = true;
        sender.voteTimestamp = block.timestamp;
        candidates[_candidateId].voteCount++;
        totalVotes++;

        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }


    // =========================================================
    //  SECTION 10 : DÉLÉGATION
    // =========================================================

    /**
     * @notice Délègue son droit de vote à un autre électeur inscrit
     * @param _to Adresse du délégué
     */
    function delegate(address _to) external {
        require(voters[msg.sender].isRegistered, "Vous n'etes pas inscrit comme electeur");
        require(voters[_to].isRegistered, "Le delegataire n'est pas inscrit");
        require(!voters[msg.sender].hasVoted, "Vous avez deja vote");
        require(!hasDelegated[msg.sender], "Vous avez deja delegue votre vote");
        require(_to != msg.sender, "Impossible de vous deleguer a vous-meme");

        hasDelegated[msg.sender] = true;
        delegations[msg.sender]  = _to;

        emit VoteDelegated(msg.sender, _to);
    }

    /**
     * @notice Vote pour un délégant (le délégué appelle cette fonction)
     * @param _delegator Adresse du délégant
     * @param _candidateId ID du candidat
     */
    function voteFor(address _delegator, uint256 _candidateId)
        external whenVotingOpen
    {
        require(voters[msg.sender].isRegistered, "Vous n'etes pas inscrit comme electeur");
        require(
            delegations[_delegator] == msg.sender,
            "Vous n'avez pas de delegation de cet electeur"
        );
        require(!voters[_delegator].hasVoted, "Cet electeur a deja vote");

        if (_candidateId == 0) {
            require(blankVoteEnabled, "Le vote blanc n'est pas active");
        } else {
            require(candidates[_candidateId].exists, "Ce candidat n'existe pas");
        }

        voters[_delegator].hasVoted      = true;
        voters[_delegator].voteTimestamp = block.timestamp;
        candidates[_candidateId].voteCount++;
        totalVotes++;

        emit VoteCast(_delegator, _candidateId, block.timestamp);
        emit VoteCastByProxy(_delegator, msg.sender);
    }


    // =========================================================
    //  SECTION 11 : GETTERS
    // =========================================================

    /**
     * @notice Résultats hors vote blanc (IDs 1..candidateCount)
     */
    function getResults()
        external view
        returns (uint256[] memory ids, string[] memory names, uint256[] memory voteCounts)
    {
        ids        = new uint256[](candidateCount);
        names      = new string[](candidateCount);
        voteCounts = new uint256[](candidateCount);

        for (uint256 i = 1; i <= candidateCount; i++) {
            ids[i-1]        = candidates[i].id;
            names[i-1]      = candidates[i].name;
            voteCounts[i-1] = candidates[i].voteCount;
        }
    }

    /**
     * @notice Nombre de votes blancs (0 si désactivé)
     */
    function getBlankVotes() external view returns (uint256) {
        return blankVoteEnabled ? candidates[0].voteCount : 0;
    }

    function getVoterStatus(address _voter)
        external view
        returns (bool isRegistered, bool hasVoted, uint256 timestamp)
    {
        Voter memory v = voters[_voter];
        return (v.isRegistered, v.hasVoted, v.voteTimestamp);
    }

    function getCandidate(uint256 _candidateId)
        external view
        returns (string memory name, uint256 voteCount)
    {
        require(candidates[_candidateId].exists, "Candidat introuvable");
        return (candidates[_candidateId].name, candidates[_candidateId].voteCount);
    }

    function isIdHashRegistered(bytes32 _idHash)
        external view returns (bool)
    {
        return idHashToWallet[_idHash] != address(0);
    }

    function getElectionInfo()
        external view
        returns (
            string memory name,
            string memory category,
            bool isOpen,
            uint256 deadline,
            uint256 registered,
            uint256 votes,
            bool deadlinePassed
        )
    {
        return (
            electionName,
            electionCategory,
            votingOpen,
            votingDeadline,
            totalRegistered,
            totalVotes,
            votingDeadline > 0 && block.timestamp > votingDeadline
        );
    }

    function getTimeRemaining() external view returns (uint256) {
        if (votingDeadline == 0) return 0;
        if (block.timestamp >= votingDeadline) return 0;
        return votingDeadline - block.timestamp;
    }
}
