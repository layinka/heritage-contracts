import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { hexlify } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { archeologistsFixture } from "../fixtures/archaeologists-fixture";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { finalizeTransferFixture } from "../fixtures/finalize-transfer-fixture";
import { calculateCursedBond, sign } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: ArchaeologistFacet", () => {
  describe("depositFreeBond()", () => {
    context("Successful deposit", () => {
      it("should deposit free bond to the contract", async () => {
        const { archaeologists, archaeologistFacet, viewStateFacet, sarcoToken } =
          await archeologistsFixture(1);

        const archaeologist = archaeologists[0];

        const archaeologistSarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        await archaeologistFacet.connect(archaeologist.signer).depositFreeBond(BigNumber.from(100));

        const freeBond = await viewStateFacet.getFreeBond(archaeologist.archAddress);
        expect(freeBond.toString()).to.equal("100");

        const archaeologistSarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        expect(archaeologistSarcoBalanceAfter.add(BigNumber.from(100)).toString()).to.equal(
          archaeologistSarcoBalanceBefore.toString()
        );

        const contractSarcBalance = await sarcoToken.balanceOf(archaeologistFacet.address);
        expect(contractSarcBalance.toString()).to.equal("100");
      });

      it("should emit an event DepositFreeBond()", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        const tx = archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        await expect(tx)
          .emit(archaeologistFacet, "DepositFreeBond")
          .withArgs(contextArchaeologist.archAddress, 100);
      });
    });

    context("Failed Deposit", () => {
      it("should revert if amount is negative", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

        // Try to deposit a negative amount
        await expect(
          archaeologistFacet.connect(archaeologists[0].signer).depositFreeBond(BigNumber.from(-1))
        ).to.be.reverted;
      });
    });
  });

  describe("withdrawFreeBond()", () => {
    context("Successful withdrawal", () => {
      it("should withdraw free bond from the contract", async () => {
        const { archaeologists, archaeologistFacet, viewStateFacet, sarcoToken } =
          await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        const archBalanceBefore = await sarcoToken.balanceOf(contextArchaeologist.archAddress);

        // Put some free bond on the contract so we can withdraw it
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        // Withdraw free bond
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .withdrawFreeBond(BigNumber.from(100));

        const freeBond = await viewStateFacet.getFreeBond(contextArchaeologist.archAddress);
        expect(freeBond.toString()).to.equal("0");

        const archBalanceAfter = await sarcoToken.balanceOf(contextArchaeologist.archAddress);

        expect(archBalanceAfter.toString()).to.equal(archBalanceBefore.toString());

        const contractSarcBalance = await sarcoToken.balanceOf(archaeologistFacet.address);
        expect(contractSarcBalance.toString()).to.equal("0");
      });

      it("should emit an event when the free bond is withdrawn", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        // Put some free bond on the contract so we can withdraw it
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        const tx = archaeologistFacet
          .connect(contextArchaeologist.signer)
          .withdrawFreeBond(BigNumber.from(100));

        await expect(tx)
          .to.emit(archaeologistFacet, "WithdrawFreeBond")
          .withArgs(contextArchaeologist.archAddress, 100);
      });

      it("should emit a transfer event when the sarco token is transfered", async () => {
        const { archaeologists, archaeologistFacet, sarcoToken } = await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        // Put some free bond on the contract so we can withdraw it
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        // Withdraw free bond
        const tx = await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .withdrawFreeBond(BigNumber.from(100));
        await expect(tx).emit(sarcoToken, "Transfer");
      });
    });

    context("Failed withdrawals", () => {
      it("should revert if amount is negative", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        // Put some free bond on the contract so we can withdraw it
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        // Try to withdraw a negative amount
        await expect(archaeologistFacet.withdrawFreeBond(BigNumber.from(-1))).to.be.reverted;
      });

      it("should revert on attempt to withdraw more than free bond", async () => {
        const { archaeologists, archaeologistFacet } = await archeologistsFixture(1);

        const contextArchaeologist = archaeologists[0];

        // Put some free bond on the contract so we can withdraw it
        await archaeologistFacet
          .connect(contextArchaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        // Try to withdraw with a non-archaeologist address
        await expect(archaeologistFacet.withdrawFreeBond(BigNumber.from(101))).to.be.revertedWith(
          "NotEnoughFreeBond"
        );
      });
    });
  });

  describe("unwrapSarcophagus()", () => {
    const shares = 5;
    const threshold = 2;

    context("Successful unwrap", () => {
      it("should store the unencrypted shard on the contract", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Check that the unencrypted shard is stored on the contract
        const archaeologist = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologists[0].archAddress
        );

        expect(archaeologist.unencryptedShard).to.equal(
          hexlify(archaeologists[0].unencryptedShard)
        );
      });

      it("should free up the archaeologist's cursed bond", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Get the cursed bond amount of the first archaeologist before initialize
        const cursedBondAmountBefore = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Get the cursed bond amount of the first archaeologist after unwrapping
        const cursedBondAmountAfter = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        // Check that the cursed bond amount has been freed up.
        expect(cursedBondAmountBefore).to.equal(
          calculateCursedBond(archaeologists[0].diggingFee, archaeologists[0].bounty)
        );
        expect(cursedBondAmountAfter).to.equal(0);
      });

      it("should add this sarcophagus to the archaeologist's successful sarcophagi", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        const isSuccessfulSarcophagus = await viewStateFacet.getArchaeologistSuccessOnSarcophagus(
          archaeologists[0].archAddress,
          sarcoId
        );

        expect(isSuccessfulSarcophagus).to.be.true;
      });

      it("should transfer the digging fee and bounty to the archaeologist's reward pool without transferring tokens", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, sarcoToken, viewStateFacet } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Calculate the digging fee and bounty for the first archaeologist
        const totalFees = archaeologists[0].diggingFee.add(archaeologists[0].bounty);

        // Get the sarco balance of the first archaeologist before unwrap
        const sarcoBalanceBefore = await sarcoToken.balanceOf(archaeologists[0].archAddress);
        const archRewardsBefore = await viewStateFacet.getAvailableRewards(
          archaeologists[0].archAddress
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Get the sarco balance of the first archaeologist after unwrap
        const sarcoBalanceAfter = await sarcoToken.balanceOf(archaeologists[0].archAddress);
        const archRewardsAfter = await viewStateFacet.getAvailableRewards(
          archaeologists[0].archAddress
        );

        // Check that the difference between the before and after rewards is
        // equal to the total fees, and actual token balance is unchanged
        expect(sarcoBalanceAfter.toString()).to.equal(sarcoBalanceBefore.toString());
        expect(archRewardsAfter.toString()).to.equal(archRewardsBefore.add(totalFees).toString());
      });

      it("should emit UnwrapSarcophagus()", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        await expect(tx).emit(archaeologistFacet, "UnwrapSarcophagus");
      });
    });

    context("Failed unwrap", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { archaeologists, archaeologistFacet } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(falseIdentifier, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sender is not an archaeologist on this sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, recipient } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(recipient)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("ArchaeologistNotOnSarcophagus");
      });

      it("should revert if unwrap is called before the resurrection time has passed", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("TooEarlyToUnwrap");
      });

      it("should revert if unwrap is called after the resurrection window has expired", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 2 weeks in the future
        await time.increase(time.duration.weeks(2));

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("TooLateToUnwrap");
      });

      it("should revert if this archaeologist has already unwrapped this sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        (
          await archaeologistFacet
            .connect(archaeologists[0].signer)
            .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard)
        ).wait();

        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("ArchaeologistAlreadyUnwrapped");
      });

      it("should revert if the hash of the unencrypted shard does not match the hashed shard stored on the sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, Buffer.from("somethingElse"));
        const tx2 = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[1].unencryptedShard);

        await expect(tx).to.be.revertedWith("UnencryptedShardHashMismatch");
        await expect(tx2).to.be.revertedWith("UnencryptedShardHashMismatch");
      });

      it("should revert if the sarcophagus is not finalized", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } = await createSarcoFixture(
          { shares, threshold, skipFinalize: true },
          "Test Sarco"
        );

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increase(time.duration.weeks(1) + 1);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .unwrapSarcophagus(sarcoId, archaeologists[0].unencryptedShard);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });
    });
  });

  describe("finalizeTransfer()", () => {
    const shares = 5;
    const threshold = 2;

    context("Successful transfer", () => {
      it("should update the list of archaeologists on a sarcophagus", async () => {
        const { oldArchaeologist, newArchaeologist, sarcoId, viewStateFacet } =
          await finalizeTransferFixture();

        const archaeologistAddresses = (await viewStateFacet.getSarcophagus(sarcoId))
          .archaeologists;

        expect(archaeologistAddresses).to.have.lengthOf(shares);
        expect(archaeologistAddresses).to.contain(newArchaeologist.archAddress);
        expect(archaeologistAddresses).to.not.contain(oldArchaeologist.address);
      });

      it("should update the data in the sarcophagusArchaeologists mapping", async () => {
        const { oldArchaeologist, newArchaeologist, sarcoId, viewStateFacet } =
          await finalizeTransferFixture();

        // Check that new archaeologist has some legitimate data
        const newArchaeologistData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          newArchaeologist.archAddress
        );

        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);
        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);
        expect(newArchaeologistData.doubleHashedShard).to.not.equal(ethers.constants.HashZero);

        // Check that the old archaeologist's values are reset to default values
        const oldArchaeologistData = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          oldArchaeologist.address
        );

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);

        expect(oldArchaeologistData.doubleHashedShard).to.equal(ethers.constants.HashZero);
        expect(oldArchaeologistData.diggingFee).to.equal("0");
        expect(oldArchaeologistData.bounty).to.equal("0");
      });

      it("should add the arweave transaction id to the list of arweaveTxIds on the sarcophagus", async () => {
        const { arweaveTxId, sarcoId, viewStateFacet } = await finalizeTransferFixture();

        const arweaveTxIds = (await viewStateFacet.getSarcophagus(sarcoId)).arweaveTxIds;

        expect(arweaveTxIds).to.have.lengthOf(2);
        expect(arweaveTxIds).to.contain(arweaveTxId);
      });

      it("should free the old archaeologists bond", async () => {
        const {
          bondAmount,
          oldArchaeologistFreeBondBefore,
          oldArchaeologistFreeBondAfter,
          oldArchaeologistCursedBondBefore,
          oldArchaeologistCursedBondAfter,
        } = await finalizeTransferFixture();

        // Check that the difference betwwen the old and new cursed bonds is equal to
        // the bond amount
        expect(oldArchaeologistCursedBondBefore.sub(oldArchaeologistCursedBondAfter)).to.equal(
          bondAmount.toString()
        );

        // Check that the difference betwwen the old and new free bonds is equal to
        // the bond amount
        expect(oldArchaeologistFreeBondAfter.sub(oldArchaeologistFreeBondBefore)).to.equal(
          bondAmount.toString()
        );
      });

      it("should curse the new archaeologists bond", async () => {
        const {
          newArchaeologistCursedBondBefore,
          newArchaeologistCursedBondAfter,
          newArchaeologistFreeBondBefore,
          newArchaeologistFreeBondAfter,
          bondAmount,
        } = await finalizeTransferFixture();

        // Check that the difference betwwen the old and new cursed bonds is equal to
        // the bond amount
        expect(newArchaeologistCursedBondAfter.sub(newArchaeologistCursedBondBefore)).to.equal(
          bondAmount.toString()
        );

        // Check that the difference betwwen the new and new free bonds is equal to
        // the bond amount
        expect(newArchaeologistFreeBondBefore.sub(newArchaeologistFreeBondAfter)).to.equal(
          bondAmount.toString()
        );
      });

      it("should emit FinalizeTransfer()", async () => {
        const { tx, archaeologistFacet, oldArchaeologist, newArchaeologist, sarcoId, arweaveTxId } =
          await finalizeTransferFixture();

        await expect(tx)
          .emit(archaeologistFacet, "FinalizeTransfer")
          .withArgs(sarcoId, arweaveTxId, oldArchaeologist.address, newArchaeologist.archAddress);
      });
    });

    context("Failed transfer", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { archaeologists, archaeologistFacet, arweaveTxId } = await createSarcoFixture(
          { shares, threshold },
          "Test Sarco"
        );

        const falseIdentifier = ethers.utils.solidityKeccak256(["string"], ["falseIdentifier"]);

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(falseIdentifier, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SarcophagusDoesNotExist");
      });

      it("should revert if the sarcophagus has not been finalized", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold, skipFinalize: true }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SarcophagusNotFinalized");
      });

      it("should revert if the resurrection time has passed", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;
        const oldArchaeologistSignature = await sign(oldArchaeologist, arweaveTxId, "string");

        await time.increase(time.duration.weeks(2));

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("ResurrectionTimeInPast");
      });

      it("should revert if the provided signature is not from an archaeologist on the sarcophagus", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologistSignature = await sign(unnamedSigners[10], arweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SignerNotArchaeologistOnSarcophagus");
      });

      it("should revert if the provided signature is not a signature of the arweave transaction id", async () => {
        const { archaeologists, archaeologistFacet, sarcoId, arweaveTxId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const unnamedSigners = await ethers.getUnnamedSigners();
        const newArchaeologist = unnamedSigners[unnamedSigners.length - archaeologists.length - 1];

        const oldArchaeologist = archaeologists[1].signer;

        const fakeArweaveTxId =
          "somethingelsethatisnotthearweavetxidliksomerandomstringlikethisoneitcouldbedogbreedsorcarnameslikeschnauzerorporsche";

        const oldArchaeologistSignature = await sign(oldArchaeologist, fakeArweaveTxId, "string");

        const tx = archaeologistFacet
          .connect(newArchaeologist)
          .finalizeTransfer(sarcoId, arweaveTxId, oldArchaeologistSignature);

        await expect(tx).to.be.revertedWith("SignerNotArchaeologistOnSarcophagus");
      });
    });
  });
});
