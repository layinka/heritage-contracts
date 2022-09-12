// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../libraries/LibTypes.sol";
import {LibErrors} from "../libraries/LibErrors.sol";
import {LibBonds} from "../libraries/LibBonds.sol";
import {LibRewards} from "../libraries/LibRewards.sol";
import {LibUtils} from "../libraries/LibUtils.sol";
import {AppStorage} from "../storage/LibAppStorage.sol";

contract EmbalmerFacet {
    // IMPORTANT: AppStorage must be the first state variable in the facet.
    AppStorage internal s;

    event CreateSarcophagus(
        bytes32 indexed sarcoId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address embalmer,
        address recipient,
        address[] cursedArchaeologists,
        uint256 totalFees,
        string[] arweaveTxIds
    );

    event RewrapSarcophagus(bytes32 indexed sarcoId, uint256 resurrectionTime);

    event BurySarcophagus(bytes32 indexed sarcoId);

    // Archaeologist's addresses are added to this mapping per sarcophagus to
    // verify that the same archaeologist signature is not used more than once.
    mapping(bytes32 => mapping(address => bool)) private verifiedArchaeologists;

    /// @notice Embalmer creates the sarcophagus.
    ///
    /// The purpose of initializeSarcophagus is to:
    ///   - Lock up payment for the selected archaeologists (digging fees)
    ///   - Store the arweave TX IDs pertaining to the encrypted file payload
    ///   -    and the encrypted shards
    ///   - Verify the selected archaeologists have signed off on their
    ///   -    unencrypted double hash and the arweave TX ID pertaining
    ///   -    to the encrypted hashes
    ///   - Store the selected archaeologists' addresses, digging fees and
    ///   -    unencrypted double hashes
    ///   - Curse each participating archaeologist
    ///   - Create the sarcophagus object
    ///
    ///
    /// @param sarcoId the identifier of the sarcophagus
    /// @param sarcophagus an object that contains the sarcophagus data
    /// @param selectedArchaeologists the archaeologists the embalmer has selected to curse
    /// @param arweaveTxIds the tx ids where arweave data is stored
    /// @return The index of the new sarcophagus
    function createSarcophagus(
        bytes32 sarcoId,
        LibTypes.SarcophagusMemory memory sarcophagus,
        LibTypes.SelectedArchaeologistData[] memory selectedArchaeologists,
        string[] memory arweaveTxIds
    ) external returns (uint256) {
        // Confirm that this exact sarcophagus does not already exist
        if (
            s.sarcophagi[sarcoId].state !=
            LibTypes.SarcophagusState.DoesNotExist
        ) {
            revert LibErrors.SarcophagusAlreadyExists(sarcoId);
        }

        // Confirm that the resurrection time is in the future
        if (sarcophagus.resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                sarcophagus.resurrectionTime
            );
        }

        // Validate exactly 2 arweave TX IDs have been provided
        if (arweaveTxIds.length != 2) {
            revert LibErrors.ArweaveTxIdsInvalid();
        }

        // Confirm that archaeologists are provided
        if (selectedArchaeologists.length == 0) {
            revert LibErrors.NoArchaeologistsProvided();
        }

        // Confirm that minShards is greater than 0
        if (sarcophagus.minShards == 0) {
            revert LibErrors.MinShardsZero();
        }

        // Confirm that minShards is less than the number of archaeologists
        if (sarcophagus.minShards > selectedArchaeologists.length) {
            revert LibErrors.MinShardsGreaterThanArchaeologists(
                sarcophagus.minShards
            );
        }

        // Initialize a list of archaeologist addresses to be passed in to the
        // sarcophagus object
        address[] memory cursedArchaeologists = new address[](
            selectedArchaeologists.length
        );

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedArchaeologists.length; i++) {
            LibTypes.SelectedArchaeologistData memory arch = selectedArchaeologists[i];
            LibUtils.revertIfArchProfileDoesNotExist(arch.archAddress);

            // Confirm that the archaeologist list is unique. This is done by
            // checking that the archaeologist does not already exist from
            // previous iterations in this loop.
            if (LibUtils.archaeologistExistsOnSarc(sarcoId, arch.archAddress)) {
                revert LibErrors.ArchaeologistListNotUnique(
                    cursedArchaeologists
                );
            }

            // Validate archaeologist profile value minimums are met
            revertIfDiggingFeeTooLow(arch.diggingFee, arch.archAddress);
            totalDiggingFees += arch.diggingFee;

            revertIfResurrectionTimeTooFarInFuture(sarcophagus.resurrectionTime, arch.archAddress);

            // Validate the archaeologist has signed off on their shard data:
            // hashed shard, arweaveTxId[1] (encrypted shard on arweave)
            LibUtils.verifyArchaeologistSignature(
                arch.unencryptedShardDoubleHash,
                arweaveTxIds[1],
                archaeologistSignatures[i].v,
                archaeologistSignatures[i].r,
                archaeologistSignatures[i].s,
                arch.archAddress
            );

            LibTypes.ArchaeologistStorage memory archaeologistStorage = LibTypes
                .ArchaeologistStorage({
                    diggingFee: arch.diggingFee,
                    diggingFeesPaid: 0,
                    doubleHashedShard: arch.unencryptedShardDoubleHash,
                    unencryptedShard: "",
                    curseTokenId: 0
                });

            // Map the double-hashed shared to this archaeologist's address for easier referencing on accuse
            s.doubleHashedShardArchaeologists[doubleHashedShard] = arch
                .archAddress;

            // Save the necessary archaeologist data to the sarcophagus
            s.sarcophagusArchaeologists[sarcoId][
                arch.archAddress
            ] = archaeologistStorage;

            // Add the sarcophagus identifier to archaeologist's list of sarcophagi
            s.archaeologistSarcophagi[arch.archAddress].push(sarcoId);

            // Move free bond to cursed bond on archaeologist
            LibBonds.curseArchaeologist(sarcoId, archaeologist);

            // Add the archaeologist address to the list of addresses to be
            // passed in to the sarcophagus object
            cursedArchaeologists[i] = arch.archAddress;
        }

        // Create the sarcophagus object and store it in AppStorage
        s.sarcophagi[sarcoId] = LibTypes.Sarcophagus({
            name: sarcophagus.name,
            state: LibTypes.SarcophagusState.Exists,
            canBeTransferred: sarcophagus.canBeTransferred,
            minShards: sarcophagus.minShards,
            resurrectionTime: sarcophagus.resurrectionTime,
            resurrectionWindow: LibUtils.getGracePeriod(
                sarcophagus.resurrectionTime
            ),
            arweaveTxIds: arweaveTxIds,
            embalmer: msg.sender,
            recipientAddress: sarcophagus.recipient,
            archaeologists: cursedArchaeologists
        });

        // Add the identifier to the necessary data structures
        s.sarcophagusIdentifiers.push(sarcoId);
        s.embalmerSarcophagi[msg.sender].push(sarcoId);
        s.recipientSarcophagi[sarcophagus.recipient].push(sarcoId);

        // Transfer the total fees amount in sarco token from the embalmer to this contract
        // TODO -- add protocol fees to the total fees
        s.sarcoToken.transferFrom(msg.sender, address(this), totalDiggingFees);

        // Emit the event
        emit CreateSarcophagus(
            sarcoId,
            sarcophagus.name,
            sarcophagus.canBeTransferred,
            sarcophagus.resurrectionTime,
            msg.sender,
            sarcophagus.recipient,
            cursedArchaeologists,
            totalDiggingFees,
            arweaveTxIds
        );

        // Return the index of the sarcophagus
        return s.sarcophagusIdentifiers.length - 1;
    }

    /// @notice The embalmer may extend the life of the sarcophagus as long as
    /// the resurrection time has not passed yet.
    /// @dev The embalmer sets a new resurrection time sometime in the future.
    /// @param sarcoId the identifier of the sarcophagus
    /// @param resurrectionTime the new resurrection time
    function rewrapSarcophagus(bytes32 sarcoId, uint256 resurrectionTime)
        external
    {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the current resurrection time is in the future, and thus rewrappable
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.SarcophagusIsUnwrappable();
        }

        // Confirm that the new resurrection time is in the future
        if (resurrectionTime <= block.timestamp) {
            revert LibErrors.NewResurrectionTimeInPast(resurrectionTime);
        }

        // For each archaeologist on the sarcophagus, transfer their digging fee allocations to them
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        uint256 diggingFeeSum = 0;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Get the archaeolgist's fee data
            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the archaeologist's digging fee allocation to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );

            // Add to the total of digging fees paid
            archaeologistData.diggingFeesPaid += archaeologistData.diggingFee;

            // Add to the total of digging fees paid on the nft attributes
            s.curses.updateAttribute(
                archaeologistData.curseTokenId,
                abi.encodePacked("Digging Fees Paid"),
                abi.encodePacked(
                    Strings.toString(archaeologistData.diggingFeesPaid)
                )
            );

            // Add the archaeologist's digging fee to the sum
            diggingFeeSum += archaeologistData.diggingFee;

            // Update the resurrection time on the archaeologist's nft
            s.curses.updateAttribute(
                archaeologistData.curseTokenId,
                abi.encodePacked("Resurrection Time"),
                abi.encodePacked(Strings.toString(resurrectionTime))
            );

            // Update the archaeologist's data in storage
            s.sarcophagusArchaeologists[sarcoId][
                bondedArchaeologists[i]
            ] = archaeologistData;
        }

        uint256 protocolFee = LibUtils.calculateProtocolFee();

        // Add the protocol fee to the total protocol fees in storage
        s.totalProtocolFees += protocolFee;

        // Set resurrection time to infinity
        s.sarcophagi[sarcoId].resurrectionTime = resurrectionTime;

        // Transfer the new digging fees from the embalmer to the sarcophagus contract.
        // Archaeologists may withdraw their due from their respective reward pools
        s.sarcoToken.transferFrom(
            msg.sender,
            address(this),
            diggingFeeSum + protocolFee
        );

        // Emit an event
        emit RewrapSarcophagus(sarcoId, resurrectionTime);
    }

    /// @notice Permanently closes the sarcophagus, giving it no opportunity to
    /// be resurrected.
    /// This may only be done after finalizeSarcophagus and before the
    /// resurrection time has passed.
    /// @dev Extends the resurrection time into infinity so that that unwrap
    /// will never be successful.
    /// @param sarcoId the identifier of the sarcophagus
    function burySarcophagus(bytes32 sarcoId) external {
        // Confirm that the sarcophagus exists
        if (s.sarcophagi[sarcoId].state != LibTypes.SarcophagusState.Exists) {
            revert LibErrors.SarcophagusDoesNotExist(sarcoId);
        }

        // Confirm that the sender is the embalmer
        if (s.sarcophagi[sarcoId].embalmer != msg.sender) {
            revert LibErrors.SenderNotEmbalmer(
                msg.sender,
                s.sarcophagi[sarcoId].embalmer
            );
        }

        // Confirm that the current resurrection time is in the future
        if (s.sarcophagi[sarcoId].resurrectionTime <= block.timestamp) {
            revert LibErrors.ResurrectionTimeInPast(
                s.sarcophagi[sarcoId].resurrectionTime
            );
        }

        // Set resurrection time to infinity
        s.sarcophagi[sarcoId].resurrectionTime = 2**256 - 1;

        // Set sarcophagus state to done
        s.sarcophagi[sarcoId].state = LibTypes.SarcophagusState.Done;

        // For each archaeologist on the sarcophagus,
        // 1. Unlock their cursed bond
        // 2. Transfer digging fees to the archaeologist.
        address[] memory bondedArchaeologists = s
            .sarcophagi[sarcoId]
            .archaeologists;

        for (uint256 i = 0; i < bondedArchaeologists.length; i++) {
            // Unlock the archaeologist's cursed bond
            LibBonds.freeArchaeologist(sarcoId, bondedArchaeologists[i]);

            LibTypes.ArchaeologistStorage memory archaeologistData = LibUtils
                .getArchaeologist(sarcoId, bondedArchaeologists[i]);

            // Transfer the digging fees to the archaeologist's reward pool
            LibRewards.increaseRewardPool(
                bondedArchaeologists[i],
                archaeologistData.diggingFee
            );
        }

        // Emit an event
        emit BurySarcophagus(sarcoId);
    }
}
