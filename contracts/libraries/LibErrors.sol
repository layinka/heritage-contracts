// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

/**
 * @title A collection of Errors
 * @notice This library defines all of the Errors that the Sarcophagus system
 * uses.
 */
library LibErrors {
    error ArchaeologistAlreadyUnwrapped(address archaeologist);

    error ArchaeologistListNotUnique(address[] archaeologists);

    error ArchaeologistNotOnSarcophagus(address archaeologist);

    error ArweaveArchaeologistNotInList();

    error ArweaveTxIdEmpty();

    error IncorrectNumberOfArchaeologistSignatures(uint256 signaturesLength);

    error MinShardsGreaterThanArchaeologists(uint8 minShards);

    error MinShardsZero();

    error MaxResurrectionIntervalIsZero();

    error NewResurrectionTimeInPast(uint256 newResurrectionTime);

    error NewResurrectionTimeTooLarge(uint256 newResurrectionTime);

    error NoArchaeologistsProvided();

    error NotEnoughCursedBond(uint256 cursedBond, uint256 amount);

    error NotEnoughFreeBond(uint256 freeBond, uint256 amount);

    error NotEnoughReward(uint256 reward, uint256 amount);

    error ResurrectionTimeInPast(uint256 resurrectionTime);

    error SarcophagusAlreadyExists(bytes32 sarcoId);

    error SarcophagusAlreadyFinalized(bytes32 sarcoId);

    error SarcophagusNotFinalized(bytes32 sarcoId);

    error SarcophagusDoesNotExist(bytes32 sarcoId);

    error SenderNotEmbalmer(address sender, address embalmer);

    error SignatureFromWrongAccount(
        address hopefulAddress,
        address actualAddress
    );

    error SignatureListNotUnique();

    error SignerNotArchaeologistOnSarcophagus(bytes32 sarcoId, address signer);

    // Used when an attempt is made to accuse or rewrap after the resurrection time has already passed (so it's actually time to unwrap it)
    error SarcophagusIsUnwrappable();

    // Used when an attempt is made to clean a sarcophagus that has not exceeded its resurrection window
    error SarcophagusNotCleanable();

    // Used when accusing with not enough, or invalid, unencrypted shard(s)
    error NotEnoughProof();

    error TooEarlyToUnwrap(uint256 resurrectionTime, uint256 currentTime);

    error TooLateToUnwrap(
        uint256 resurrectionTime,
        uint256 resurrectionWindow,
        uint256 currentTime
    );

    error UnencryptedShardHashMismatch(
        bytes unencryptedShard,
        bytes32 doubleHashedShard
    );
}
