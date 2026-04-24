// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  MinimalForwarder
 * @notice EIP-2771 meta-transaction forwarder — no OpenZeppelin dependency.
 *         Verifies an EIP-712 typed-data signature (ForwardRequest) and
 *         executes the call on behalf of the original signer, appending
 *         the signer's address to calldata (ERC-2771 convention).
 *
 * @dev    Compatible with CivicChain's ERC2771Context (embedded).
 *         The relayer (backend) calls execute() and pays the gas.
 */
contract MinimalForwarder {

    // =========================================================
    //  STRUCTS
    // =========================================================

    struct ForwardRequest {
        address from;   // original sender (voter)
        address to;     // target contract (CivicChain)
        uint256 value;  // ETH to forward (0 for voting)
        uint256 gas;    // gas limit for the inner call
        uint256 nonce;  // per-sender replay protection
        bytes   data;   // encoded function call
    }

    // =========================================================
    //  EIP-712 CONSTANTS
    // =========================================================

    bytes32 private constant _TYPE_HASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    bytes32 private immutable _DOMAIN_SEPARATOR;

    // =========================================================
    //  STATE
    // =========================================================

    mapping(address => uint256) private _nonces;

    // =========================================================
    //  CONSTRUCTOR
    // =========================================================

    constructor() {
        _DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            ),
            keccak256(bytes("MinimalForwarder")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    // =========================================================
    //  PUBLIC VIEW
    // =========================================================

    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    function domainSeparator() external view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    /**
     * @notice Off-chain verify before calling execute().
     */
    function verify(
        ForwardRequest calldata req,
        bytes          calldata signature
    ) public view returns (bool) {
        address signer = _recover(_hashTypedData(req), signature);
        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    // =========================================================
    //  EXECUTE
    // =========================================================

    /**
     * @notice Execute a meta-transaction on behalf of req.from.
     *         The relayer (msg.sender) pays the gas.
     *
     *         req.from is appended to calldata so that ERC2771Context
     *         can extract it with _msgSender().
     */
    function execute(
        ForwardRequest calldata req,
        bytes          calldata signature
    ) external payable returns (bool success, bytes memory returndata) {
        require(verify(req, signature), "MinimalForwarder: invalid signature");
        _nonces[req.from] += 1;

        // Append original sender (ERC-2771 spec: last 20 bytes = sender)
        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Gas safety: ensure we still have ≥ 1/63 of the requested gas
        if (!success) {
            // Bubble up the revert reason
            if (returndata.length > 0) {
                assembly {
                    let len := mload(returndata)
                    revert(add(returndata, 0x20), len)
                }
            }
            revert("MinimalForwarder: call reverted");
        }
    }

    // =========================================================
    //  INTERNAL HELPERS
    // =========================================================

    function _hashTypedData(ForwardRequest calldata req) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19\x01",
            _DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                _TYPE_HASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            ))
        ));
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "MinimalForwarder: invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8   v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "MinimalForwarder: invalid v");
        address recovered = ecrecover(hash, v, r, s);
        require(recovered != address(0), "MinimalForwarder: invalid sig");
        return recovered;
    }
}
