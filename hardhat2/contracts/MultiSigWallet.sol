// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  MultiSigWallet
 * @notice Simulated Gnosis-Safe — 2-of-3 threshold wallet for CivicChain.
 *         Replaces the single OWNER_PRIVATE_KEY: any privileged call on
 *         CivicChain (create/open/reveal/addCandidate/registerVoter …) must
 *         now be approved by at least 2 of the 3 configured owners before
 *         it can be executed on-chain.
 *
 *         Flow:   submitTransaction → confirmTransaction (x required-1)
 *                 → executeTransaction.
 */
contract MultiSigWallet {

    // =========================================================
    //  STATE
    // =========================================================

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;

    struct Transaction {
        address destination;
        uint256 value;
        bytes   data;
        bool    executed;
        uint256 confirmations;
    }

    Transaction[] public transactions;

    // txId => owner => confirmed?
    mapping(uint256 => mapping(address => bool)) public confirmed;


    // =========================================================
    //  EVENTS
    // =========================================================

    event Submission   (uint256 indexed txId, address indexed proposer, address destination, uint256 value, bytes data);
    event Confirmation (uint256 indexed txId, address indexed owner);
    event Revocation   (uint256 indexed txId, address indexed owner);
    event Execution    (uint256 indexed txId, address indexed executor, bool success);
    event Deposit      (address indexed sender, uint256 amount);


    // =========================================================
    //  MODIFIERS
    // =========================================================

    modifier onlyOwner() {
        require(isOwner[msg.sender], "MultiSig: not an owner");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "MultiSig: tx not found");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "MultiSig: already executed");
        _;
    }

    modifier notConfirmed(uint256 txId) {
        require(!confirmed[txId][msg.sender], "MultiSig: already confirmed");
        _;
    }


    // =========================================================
    //  CONSTRUCTOR
    // =========================================================

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "MultiSig: owners required");
        require(_required > 0 && _required <= _owners.length, "MultiSig: bad threshold");

        for (uint256 i = 0; i < _owners.length; i++) {
            address o = _owners[i];
            require(o != address(0), "MultiSig: zero owner");
            require(!isOwner[o],      "MultiSig: duplicate owner");
            isOwner[o] = true;
            owners.push(o);
        }
        required = _required;
    }


    // =========================================================
    //  CORE — submit / confirm / execute / revoke
    // =========================================================

    /// @notice Any owner proposes a transaction. Does NOT auto-confirm.
    function submitTransaction(address destination, uint256 value, bytes calldata data)
        external
        onlyOwner
        returns (uint256 txId)
    {
        txId = transactions.length;
        transactions.push(Transaction({
            destination:   destination,
            value:         value,
            data:          data,
            executed:      false,
            confirmations: 0
        }));
        emit Submission(txId, msg.sender, destination, value, data);
    }

    /// @notice Owner adds their approval. Auto-executes when threshold reached.
    function confirmTransaction(uint256 txId)
        external
        onlyOwner
        txExists(txId)
        notExecuted(txId)
        notConfirmed(txId)
    {
        confirmed[txId][msg.sender] = true;
        transactions[txId].confirmations += 1;
        emit Confirmation(txId, msg.sender);

        if (transactions[txId].confirmations >= required) {
            _execute(txId);
        }
    }

    /// @notice Explicit execution (useful if auto-exec reverted earlier).
    function executeTransaction(uint256 txId)
        external
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        require(transactions[txId].confirmations >= required, "MultiSig: not enough confirmations");
        _execute(txId);
    }

    /// @notice Owner withdraws a previously-given confirmation (pre-execution only).
    function revokeConfirmation(uint256 txId)
        external
        onlyOwner
        txExists(txId)
        notExecuted(txId)
    {
        require(confirmed[txId][msg.sender], "MultiSig: not confirmed by you");
        confirmed[txId][msg.sender] = false;
        transactions[txId].confirmations -= 1;
        emit Revocation(txId, msg.sender);
    }

    function _execute(uint256 txId) internal {
        Transaction storage t = transactions[txId];
        t.executed = true;
        (bool ok, ) = t.destination.call{value: t.value}(t.data);
        emit Execution(txId, msg.sender, ok);
        require(ok, "MultiSig: underlying call reverted");
    }


    // =========================================================
    //  VIEWS
    // =========================================================

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function transactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 txId)
        external
        view
        txExists(txId)
        returns (address destination, uint256 value, bytes memory data, bool executed, uint256 confirmations)
    {
        Transaction storage t = transactions[txId];
        return (t.destination, t.value, t.data, t.executed, t.confirmations);
    }

    function isConfirmed(uint256 txId, address owner) external view returns (bool) {
        return confirmed[txId][owner];
    }


    // =========================================================
    //  RECEIVE — so the multisig can hold ETH if ever needed
    // =========================================================
    receive() external payable {
        if (msg.value > 0) emit Deposit(msg.sender, msg.value);
    }
}
