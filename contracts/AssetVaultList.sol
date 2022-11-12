// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// import "@openzeppelin/contracts/utils/Strings.sol";
import "./libraries/LibTypes.sol";
import {LibErrors} from "./libraries/LibErrors.sol";
import {LibBonds} from "./libraries/LibBonds.sol";
import {LibUtils} from "./libraries/LibUtils.sol";

import "./HeritageAssetWillVault.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract AssetVaultList {
    
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    
    Counters.Counter vaultCounter;
    mapping(bytes32 => address) assetVaults;

    address[] public _signatoryProfileAddresses;
    mapping(address => LibTypes.SignatoryProfile) _signatoryProfiles;
    uint public _signatoriesCount;

    IERC20 _heritageToken;
    

    event DepositFreeBond(address indexed signatory, uint256 depositedBond);

    event RegisterSignatory(
        address indexed signatory,
        string peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    );

    event CreateVault(
        bytes32 indexed vaultId,
        string name,
        bool canBeTransferred,
        uint256 resurrectionTime,
        address vaultOwner,
        address recipient,
        address[] cursedSignatories,
        uint256 totalDiggingFees,
        uint256 createVaultProtocolFees,
        string[] arweaveTxIds
    );

    event AssetVaultCreated(
        bytes32 indexed vaultId,
        string name,
        address owner,
        address vaultAddress,        
        address[] signatories,
        uint256 totalDiggingFees,
        uint256 createVaultProtocolFees
    );


    constructor (IERC20 heritageToken){
        _heritageToken=heritageToken;
    }


    // Signatory's addresses are added to this mapping per vault to
    // verify that the same signatory signature is not used more than once.
    // mapping(bytes32 => mapping(address => bool)) private verifiedSignatories;

    


    // function toBytes(uint256 x) pure internal returns (bytes32 b) {
    //     b = new bytes(32);
    //     assembly { mstore(add(b, 32), x) }
    // }



    /// @notice Vault Owner creates the vault.
    ///
    /// The purpose of createVault is to:
    ///   - Lock up payment for the selected signatories (digging fees)
    ///   - Store the arweave TX IDs pertaining to the encrypted file payload
    ///   -    and the encrypted shards
    ///   - Verify the selected signatories have signed off on the
    ///         double hash of their key share,
    ///         arweave tx id storing key shares,
    ///         and maximumRewrapInterval to be used for lifetime of the sarcophagus
    ///   - Store the selected signatories' addresses, digging fees and
    ///   -     unencrypted double hashes
    ///   - Curse each participating signatory
    ///   - Create the sarcophagus object
    ///
    /// @param vaultData an object that contains the Vault data
    /// @param selectedSignatories the signatories the vaultOwner has selected to curse
    /// @return The index of the new Vault
    function createAssetVault(        
        LibTypes.CreateVaultData memory vaultData,
        LibTypes.SelectedSignatoryData[] memory selectedSignatories
    ) external returns (bytes32) {
        
        vaultCounter.increment(); 
        bytes32 vaultId =  bytes32(vaultCounter.current()); 

      

        // // Confirm that the resurrection time is in the future
        // if (vaultData.resurrectionTime <= block.timestamp) {
        //     revert LibErrors.ResurrectionTimeInPast(
        //         vaultData.resurrectionTime
        //     );
        // }

        

        // Confirm that signatories are provided
        if (selectedSignatories.length == 0) {
            revert LibErrors.NoSignatoriesProvided();
        }

        

        // Initialize a list of signatory addresses to be passed in to the
        // vaultData object
        address[] memory signatories = new address[](
            selectedSignatories.length
        );

        uint256 totalDiggingFees = 0;

        for (uint256 i = 0; i < selectedSignatories.length; i++) {
            LibTypes.SelectedSignatoryData memory signer = selectedSignatories[i];
                        
            totalDiggingFees += signer.diggingFee;

            LibTypes.SignatoryStorage memory signatoryStorage = LibTypes
                .SignatoryStorage({
                    diggingFee: signer.diggingFee,
                    diggingFeesPaid: 0,
                    unencryptedShardDoubleHash: bytes32(0),
                    unencryptedShard: new bytes(0)
                });

            
            

            // Add the signatory address to the list of addresses to be
            // passed in to the vaultData object
            signatories[i] = signer.signatoryAddress;
        }

        // Create the vaultData object and store it in AppStorage
        assetVaults[vaultId] = address(new HeritageAssetWillVault(msg.sender, vaultId,vaultData.name,vaultData.beneficiaries, signatories) );
        
        //  LibTypes.Vault({
        //     name: vaultData.name,
        //     state: LibTypes.SarcophagusState.Exists,
            
        //     resurrectionTime: vaultData.resurrectionTime,
            
        //     owner: msg.sender,
        //     beneficiaries: vaultData.beneficiaries,
        //     signatories: signatories
        // });

        // Add the identifier to the necessary data structures
        
        // s.vaultOwnerAssetVaults[msg.sender].push(vaultId);
        // for (uint256 i = 0; i < vaultData.beneficiaries.length; i++) {
        //     s.recipientAssetVaults[vaultData.beneficiaries[i].beneficiaryAddress].push(vaultId);
        // }
        
        // s.vaultOwnerVaults[msg.sender].push(vaultId);
        // s.recipientVaults[vaultData.recipient].push(vaultId);

        // Transfer the total fees amount + protocol fees in Heritage token from the owner to this contract
        uint256 protocolFees = LibUtils.calculateProtocolFees(totalDiggingFees);

        // Add the create vaultData protocol fee to the total protocol fees in storage
        // s.totalProtocolFees += protocolFees;

        _heritageToken.safeTransferFrom(
            msg.sender,
            address(this),
            totalDiggingFees + protocolFees
        );

        // Emit the event
        emit AssetVaultCreated(
            vaultId,
            vaultData.name,            
            msg.sender,
            assetVaults[vaultId],
            signatories,
            totalDiggingFees,
            protocolFees
        );

        // emit CreateVault(
        //     vaultId,
        //     vaultData.name,
        //     vaultData.canBeTransferred,
        //     vaultData.resurrectionTime,
        //     msg.sender,
        //     vaultData.recipient,
        //     cursedSignatories,
        //     totalDiggingFees,
        //     protocolFees,
        //     arweaveTxIds
        // );

        // Return the index of the vaultData
        return vaultId;
    }


    /// @notice Registers the signatory profile
    /// @param peerId The libp2p identifier for the signatory
    /// @param minimumDiggingFee The signatory's minimum amount to accept for a digging fee
    /// @param maximumRewrapInterval The longest interval of time from a rewrap time the arch will accept
    /// for a resurrection
    /// @param freeBond How much bond the signatory wants to deposit during the register call (if any)
    function registerSignatory(
        string memory peerId,
        uint256 minimumDiggingFee,
        uint256 maximumRewrapInterval,
        uint256 freeBond
    ) external {
        // verify that the signatory does not already exist
        if (_signatoryProfiles[msg.sender].exists) {
            revert ("Signatory Exists");
        }
        

        // create a new signatory
        LibTypes.SignatoryProfile memory newSignatory = LibTypes
            .SignatoryProfile({
                exists: true,
                peerId: peerId,
                minimumDiggingFee: minimumDiggingFee,
                maximumRewrapInterval: maximumRewrapInterval,
                freeBond: freeBond,
                cursedBond: 0
            });

        // transfer HERITAGE tokens from the signatory to this contract, to be
        // used as their free bond. can be 0.
        if (freeBond > 0) {
            _heritageToken.transferFrom(msg.sender, address(this), freeBond);
        }

        // save the new signatory into relevant data structures
        _signatoryProfiles[msg.sender] = newSignatory;
        _signatoryProfileAddresses.push(msg.sender);

        _signatoriesCount++;

        emit RegisterSignatory(
            msg.sender,
            newSignatory.peerId,
            newSignatory.minimumDiggingFee,
            newSignatory.maximumRewrapInterval,
            newSignatory.freeBond
        );
    }


    function getSignatoryProfile(address signatory)
        external
        view
        returns (LibTypes.SignatoryProfile memory)
    {
        return _signatoryProfiles[signatory];
    }

    /// @notice Return the list of registereed signatory addresses.
    /// @return addresses of registered signatories
    function getSignatoryProfileAddresses()
        external
        view
        returns (address[] memory)
    {
        return _signatoryProfileAddresses;
    }

    function getAssetVault(bytes32 vaultId)
        external
        view
        returns (address)
    {
        return assetVaults[vaultId];
    }

}
