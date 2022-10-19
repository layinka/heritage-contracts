import { ethers } from "hardhat";
import { ArchaeologistFacet } from "../../typechain";
import { sign } from "../utils/helpers";
import { createSarcoFixture } from "./create-sarco-fixture";

/**
 * A fixture to set up the transfer of an archaeologist's R&R on a
 * sarcophagus to an unbonded archaeologist.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const finalizeTransferFixture = async () => {
  const {
    deployer,
    archaeologists,
    archaeologistFacet,
    viewStateFacet,
    sarcoId,
    arweaveTxIds,
    unbondedArchaeologists,
    diamond,
  } = await createSarcoFixture({ shares: 5, threshold: 3, addUnbondedArchs: 1 }, "Test Sarco");

  const newArchaeologist = unbondedArchaeologists[0];

  const oldArchaeologist = archaeologists[1].signer;
  const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxIds[1], "string");

  const oldArchaeologistFees = {
    diggingFee: archaeologists[1].diggingFee,
  };

  // Calculate the old arch's bond amount
  const bondAmount = oldArchaeologistFees.diggingFee;

  // Get the archaeologists cursed, free bond before transfer
  const oldArchaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
    oldArchaeologist.address
  );
  const oldArchaeologistFreeBondBefore = await viewStateFacet.getFreeBond(oldArchaeologist.address);

  const newArchaeologistCursedBondBefore = await viewStateFacet.getCursedBond(
    newArchaeologist.archAddress
  );
  const newArchaeologistFreeBondBefore = await viewStateFacet.getFreeBond(
    newArchaeologist.archAddress
  );

  // Actually have the new archaeologist finalize the transfer
  const tx = archaeologistFacet
    .connect(newArchaeologist.signer)
    .finalizeTransfer(sarcoId, arweaveTxIds[1], oldArchaeologistSignature);

  // Get the archaeologists cursed, free bond before transfer
  const oldArchaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
    oldArchaeologist.address
  );
  const oldArchaeologistFreeBondAfter = await viewStateFacet.getFreeBond(oldArchaeologist.address);
  const newArchaeologistCursedBondAfter = await viewStateFacet.getCursedBond(
    newArchaeologist.archAddress
  );
  const newArchaeologistFreeBondAfter = await viewStateFacet.getFreeBond(
    newArchaeologist.archAddress
  );

  return {
    tx,
    diamond,
    deployer,
    archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
    viewStateFacet,
    archaeologists,
    oldArchaeologist,
    newArchaeologist,
    sarcoId,
    arweaveTxIds,
    oldArchaeologistCursedBondBefore,
    oldArchaeologistCursedBondAfter,
    oldArchaeologistFreeBondBefore,
    oldArchaeologistFreeBondAfter,
    newArchaeologistCursedBondBefore,
    newArchaeologistCursedBondAfter,
    newArchaeologistFreeBondBefore,
    newArchaeologistFreeBondAfter,
    bondAmount,
  };
};
