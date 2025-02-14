import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { hexlify } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { archeologistsFixture } from "../fixtures/archaeologists-fixture";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";
import { registerArchaeologist, updateArchaeologist } from "../utils/helpers";
import time from "../utils/time";

describe("Contract: ArchaeologistFacet", () => {
  describe("registerArchaeologist", () => {
    it("registers an archaeologist", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.exists).to.be.true;
    });

    it("fails to register an archaeologist when it is already registered", async () => {
      const { archaeologists, archaeologistFacet } = await archeologistsFixture(
        1
      );

      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      await expect(
        registerArchaeologist(archaeologist, archaeologistFacet)
      ).to.be.revertedWithCustomError(
        archaeologistFacet,
        "ArchaeologistProfileExistsShouldBe"
      );
    });

    it("initializes the cursedBond to 0", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.cursedBond).to.equal(BigNumber.from("0"));
    });

    it("initializes the profile config values correctly", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";
      const peerId = "myNewPeerId";

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond,
        peerId
      );

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.minimumDiggingFee).to.equal(
        BigNumber.from(minDiggingFee)
      );
      expect(registeredArch.maximumRewrapInterval).to.equal(
        BigNumber.from(maxRewrapInterval)
      );
      expect(registeredArch.freeBond).to.equal(BigNumber.from(freeBond));
      expect(registeredArch.peerId).to.equal(peerId);
    });

    it("adds the archaeologist address to the archaeologistProfileAddresses array", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const registeredArchAddress =
        await viewStateFacet.getArchaeologistProfileAddressAtIndex(0);
      expect(registeredArchAddress).to.equal(archaeologist.archAddress);
    });

    it("deposits free bond to the sarcophagus contract when registering with a positive free bond value", async () => {
      const { archaeologists, archaeologistFacet, sarcoToken } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";

      // hopefully someday chai will support to.be.changed.by matchers for contracts/bignums
      const sarcoContractBalanceBefore = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceAfter = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      expect(
        sarcoContractBalanceAfter.sub(sarcoContractBalanceBefore)
      ).to.equal(BigNumber.from(freeBond));
    });
  });

  describe("updateArchaeologist", () => {
    it("updates an archaeologist values successfully", async () => {
      const { archaeologists, archaeologistFacet, viewStateFacet } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      await registerArchaeologist(archaeologist, archaeologistFacet);

      const minDiggingFee = "150";
      const maxRewrapInterval = "150";
      const freeBond = "150";
      const peerId = "12D3KooWNFXTC6pWrZpLaeVpF4r3siBk8RPV5fDcMm9kdFUsxRo5";

      const archFreeBondBeforeUpdate = await viewStateFacet.getFreeBond(
        archaeologist.archAddress
      );

      await updateArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond,
        peerId
      );

      const registeredArch = await viewStateFacet.getArchaeologistProfile(
        archaeologist.archAddress
      );
      expect(registeredArch.minimumDiggingFee).to.equal(
        BigNumber.from(minDiggingFee)
      );
      expect(registeredArch.maximumRewrapInterval).to.equal(
        BigNumber.from(maxRewrapInterval)
      );
      expect(registeredArch.freeBond.sub(archFreeBondBeforeUpdate)).to.equal(
        BigNumber.from(freeBond)
      );
      expect(registeredArch.peerId).to.equal(peerId);
    });

    it("deposits free bond to the sarcophagus contract when updating with a positive free bond value", async () => {
      const { archaeologists, archaeologistFacet, sarcoToken } =
        await archeologistsFixture(1);
      const archaeologist = archaeologists[0];

      const minDiggingFee = "40";
      const maxRewrapInterval = "50";
      const freeBond = "90";

      await registerArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceBefore = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      await updateArchaeologist(
        archaeologist,
        archaeologistFacet,
        minDiggingFee,
        maxRewrapInterval,
        freeBond
      );

      const sarcoContractBalanceAfter = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );

      expect(
        sarcoContractBalanceAfter.sub(sarcoContractBalanceBefore)
      ).to.equal(BigNumber.from(freeBond));
    });

    it("reverts when an archaeologist is not registered", async () => {
      const { archaeologists, archaeologistFacet } = await archeologistsFixture(
        1
      );
      const archaeologist = archaeologists[0];

      await expect(
        updateArchaeologist(
          archaeologist,
          archaeologistFacet,
          "150",
          "150",
          "150"
        )
      ).to.be.revertedWithCustomError(
        archaeologistFacet,
        "ArchaeologistProfileExistsShouldBe"
      );
    });
  });

  describe("depositFreeBond()", () => {
    context("with an unregistered archaeologist", () => {
      it("reverts when depositing free bond", async () => {
        const { archaeologists, archaeologistFacet } =
          await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await expect(
          archaeologistFacet
            .connect(archaeologist.signer)
            .depositFreeBond(BigNumber.from(100))
        ).to.be.revertedWithCustomError(
          archaeologistFacet,
          "ArchaeologistProfileExistsShouldBe"
        );
      });
    });

    context("with a registered archaeologist", () => {
      it("deposits free bond to the contract", async () => {
        // Setup archaeologist + register
        const {
          archaeologists,
          archaeologistFacet,
          viewStateFacet,
          sarcoToken,
        } = await archeologistsFixture(1);

        const archaeologist = archaeologists[0];
        await registerArchaeologist(archaeologist, archaeologistFacet);

        const amountToDeposit = "100";
        const archaeologistSarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        await archaeologistFacet
          .connect(archaeologist.signer)
          .depositFreeBond(BigNumber.from(amountToDeposit));

        const freeBond = await viewStateFacet.getFreeBond(
          archaeologist.archAddress
        );
        expect(freeBond.toString()).to.equal(amountToDeposit);

        const archaeologistSarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologist.archAddress
        );

        expect(
          archaeologistSarcoBalanceAfter
            .add(BigNumber.from(amountToDeposit))
            .toString()
        ).to.equal(archaeologistSarcoBalanceBefore.toString());

        const contractSarcBalance = await sarcoToken.balanceOf(
          archaeologistFacet.address
        );
        expect(contractSarcBalance.toString()).to.equal(amountToDeposit);
      });

      it("emits event DepositFreeBond()", async () => {
        const { archaeologists, archaeologistFacet } =
          await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await registerArchaeologist(archaeologist, archaeologistFacet);

        const tx = archaeologistFacet
          .connect(archaeologist.signer)
          .depositFreeBond(BigNumber.from(100));

        await expect(tx)
          .emit(archaeologistFacet, "DepositFreeBond")
          .withArgs(archaeologist.archAddress, 100);
      });
    });
  });

  describe("withdrawFreeBond()", () => {
    context("with an unregistered archaeologist", () => {
      it("reverts when withdrawing free bond", async () => {
        const { archaeologists, archaeologistFacet } =
          await archeologistsFixture(1);
        const archaeologist = archaeologists[0];

        await expect(
          archaeologistFacet
            .connect(archaeologist.signer)
            .withdrawFreeBond(BigNumber.from(100))
        ).to.be.reverted;
      });
    });

    context(
      "with a registered archaeologist with positive free bond deposit",
      () => {
        context("Successful withdrawals", () => {
          it("withdraws free bond from the contract", async () => {
            const {
              archaeologists,
              archaeologistFacet,
              viewStateFacet,
              sarcoToken,
            } = await archeologistsFixture(1);
            const contextArchaeologist = archaeologists[0];
            await registerArchaeologist(
              contextArchaeologist,
              archaeologistFacet
            );

            const archBalanceBefore = await sarcoToken.balanceOf(
              contextArchaeologist.archAddress
            );

            // Put some free bond on the contract so we can withdraw it
            await archaeologistFacet
              .connect(contextArchaeologist.signer)
              .depositFreeBond(BigNumber.from(100));

            // Withdraw free bond
            await archaeologistFacet
              .connect(contextArchaeologist.signer)
              .withdrawFreeBond(BigNumber.from(100));

            const freeBond = await viewStateFacet.getFreeBond(
              contextArchaeologist.archAddress
            );
            expect(freeBond.toString()).to.equal("0");

            const archBalanceAfter = await sarcoToken.balanceOf(
              contextArchaeologist.archAddress
            );

            expect(archBalanceAfter.toString()).to.equal(
              archBalanceBefore.toString()
            );

            const contractSarcBalance = await sarcoToken.balanceOf(
              archaeologistFacet.address
            );
            expect(contractSarcBalance.toString()).to.equal("0");
          });

          it("should emit an event when the free bond is withdrawn", async () => {
            const { archaeologists, archaeologistFacet } =
              await archeologistsFixture(1);
            const contextArchaeologist = archaeologists[0];
            await registerArchaeologist(
              contextArchaeologist,
              archaeologistFacet
            );

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
            const { archaeologists, archaeologistFacet, sarcoToken } =
              await archeologistsFixture(1);
            const contextArchaeologist = archaeologists[0];
            await registerArchaeologist(
              contextArchaeologist,
              archaeologistFacet
            );

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
          it("reverts on attempt to withdraw more than free bond", async () => {
            const { archaeologists, archaeologistFacet } =
              await archeologistsFixture(1);
            const contextArchaeologist = archaeologists[0];
            await registerArchaeologist(
              contextArchaeologist,
              archaeologistFacet
            );

            // Put some free bond on the contract so we can withdraw it
            await archaeologistFacet
              .connect(contextArchaeologist.signer)
              .depositFreeBond(BigNumber.from(100));

            // Try to withdraw with a non-archaeologist address
            await expect(
              archaeologistFacet
                .connect(contextArchaeologist.signer)
                .withdrawFreeBond(BigNumber.from(101))
            ).to.be.revertedWithCustomError(
              archaeologistFacet,
              "NotEnoughFreeBond"
            );
          });
        });
      }
    );
  });

  describe("withdrawReward()", () => {
    it("withdraws all the archaeologists rewards", async () => {
      const shares = 5;
      const threshold = 2;

      const archDiggingFee = BigNumber.from("1000000000000");

      // Setup arch + unwrap so rewards are received
      const {
        archaeologists,
        archaeologistFacet,
        sarcoId,
        sarcoToken,
        viewStateFacet,
        resurrectionTime,
      } = await createSarcoFixture(
        { shares, threshold, archMinDiggingFee: archDiggingFee },
        "Test Sarco"
      );

      const contextArchaeologist = archaeologists[0];

      await time.increaseTo(resurrectionTime);

      await archaeologistFacet
        .connect(contextArchaeologist.signer)
        .publishKeyShare(sarcoId, contextArchaeologist.rawKeyShare);

      // expect rewards to be increased after unwrap (this should probably be in a separate test)
      const currentRewards = await viewStateFacet.getRewards(
        contextArchaeologist.archAddress
      );
      expect(currentRewards).to.equal(archDiggingFee);

      const archSarcoBalanceBefore = await sarcoToken.balanceOf(
        contextArchaeologist.archAddress
      );

      await archaeologistFacet
        .connect(contextArchaeologist.signer)
        .withdrawReward();

      // expect rewards to be depleted after claiming
      const rewardsAfterWithdrawal = await viewStateFacet.getRewards(
        contextArchaeologist.archAddress
      );
      expect(rewardsAfterWithdrawal).to.equal(0);

      // expect archs sarco token balance to increase by rewards amount
      expect(
        await sarcoToken.balanceOf(contextArchaeologist.archAddress)
      ).to.equal(archSarcoBalanceBefore.add(archDiggingFee));
    });
  });

  describe("publishKeyShare()", () => {
    const shares = 5;
    const threshold = 2;

    context("Successful unwrap", () => {
      it("should store the unencrypted shard on the contract", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Set the evm timestamp of the next block to be 1 week and 1 second in
        // the future
        await time.increaseTo(resurrectionTime);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        // Check that the unencrypted shard is stored on the contract
        const archaeologist = await viewStateFacet.getSarcophagusArchaeologist(
          sarcoId,
          archaeologists[0].archAddress
        );

        expect(archaeologist.rawKeyShare).to.equal(
          hexlify(archaeologists[0].rawKeyShare)
        );
      });

      it("should free up the archaeologist's cursed bond", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Get the cursed bond amount of the first archaeologist before initialize
        const cursedBondAmountBefore = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        await time.increaseTo(resurrectionTime);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        // Get the cursed bond amount of the first archaeologist after unwrapping
        const cursedBondAmountAfter = await viewStateFacet.getCursedBond(
          archaeologists[0].archAddress
        );

        // Check that the cursed bond amount has been freed up.
        expect(cursedBondAmountBefore).to.equal(archaeologists[0].diggingFee);
        expect(cursedBondAmountAfter).to.equal(0);
      });

      it("should add this sarcophagus to the archaeologist's successful sarcophagi", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        await time.increaseTo(resurrectionTime);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        const isSuccessfulSarcophagus =
          await viewStateFacet.getArchaeologistSuccessOnSarcophagus(
            archaeologists[0].archAddress,
            sarcoId
          );

        expect(isSuccessfulSarcophagus).to.be.true;
      });

      it("should transfer the digging fee to the archaeologist's reward pool without transferring tokens", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          sarcoToken,
          viewStateFacet,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Calculate the digging fee for the first archaeologist
        const totalFees = archaeologists[0].diggingFee;

        // Get the sarco balance of the first archaeologist before unwrap
        const sarcoBalanceBefore = await sarcoToken.balanceOf(
          archaeologists[0].archAddress
        );
        const archRewardsBefore = await viewStateFacet.getRewards(
          archaeologists[0].archAddress
        );

        await time.increaseTo(resurrectionTime);

        // Have archaeologist unwrap
        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        // Get the sarco balance of the first archaeologist after unwrap
        const sarcoBalanceAfter = await sarcoToken.balanceOf(
          archaeologists[0].archAddress
        );
        const archRewardsAfter = await viewStateFacet.getRewards(
          archaeologists[0].archAddress
        );

        // Check that the difference between the before and after rewards is
        // equal to the total fees, and actual token balance is unchanged
        expect(sarcoBalanceAfter.toString()).to.equal(
          sarcoBalanceBefore.toString()
        );
        expect(archRewardsAfter.toString()).to.equal(
          archRewardsBefore.add(totalFees).toString()
        );
      });

      it("should emit PublishKeyShare", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        await time.increaseTo(resurrectionTime);

        // Have archaeologist unwrap
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        // Check that the list of events includes an event that has an address
        // matching the embalmerFacet address
        await expect(tx).emit(archaeologistFacet, "PublishKeyShare");
      });
    });

    context("Failed publish", () => {
      it("should revert if the sarcophagus does not exist", async () => {
        const { archaeologists, archaeologistFacet, resurrectionTime } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        const falseIdentifier = ethers.utils.solidityKeccak256(
          ["string"],
          ["falseIdentifier"]
        );

        await time.increaseTo(resurrectionTime);

        // Have archaeologist publish
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(falseIdentifier, archaeologists[0].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "SarcophagusDoesNotExist"
        );
      });

      it("should revert if the sender is not an archaeologist on this sarcophagus", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          recipient,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        await time.increaseTo(resurrectionTime);

        // Have archaeologist publish
        const tx = archaeologistFacet
          .connect(recipient)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "ArchaeologistNotOnSarcophagus"
        );
      });

      it("should revert if publishKeyShare is called before the resurrection time has passed", async () => {
        const { archaeologists, archaeologistFacet, sarcoId } =
          await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // Have archaeologist publish
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "TooEarlyToUnwrap"
        );
      });

      it("should revert if publishKeyShare is called after the grace period has elapsed", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          resurrectionTime,
          viewStateFacet,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        // increase time beyond resurrection time + grace period to expire sarcophagus
        const gracePeriod = await viewStateFacet.getGracePeriod();
        await time.increaseTo(resurrectionTime + +gracePeriod + 1);

        // Have archaeologist publishKeyShare
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "TooLateToUnwrap"
        );
      });

      it("should revert if this archaeologist has already published their key share on this sarcophagus", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        await time.increaseTo(resurrectionTime);

        await archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[0].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "ArchaeologistAlreadyUnwrapped"
        );
      });

      it("should revert if the hash of the unencrypted shard does not match the hashed shard stored on the sarcophagus", async () => {
        const {
          archaeologists,
          archaeologistFacet,
          sarcoId,
          resurrectionTime,
        } = await createSarcoFixture({ shares, threshold }, "Test Sarco");

        await time.increaseTo(resurrectionTime);

        // Have archaeologist publish
        const tx = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, Buffer.from("somethingElse"));
        const tx2 = archaeologistFacet
          .connect(archaeologists[0].signer)
          .publishKeyShare(sarcoId, archaeologists[1].rawKeyShare);

        await expect(tx).to.be.revertedWithCustomError(
          archaeologistFacet,
          "UnencryptedShardHashMismatch"
        );
        await expect(tx2).to.be.revertedWithCustomError(
          archaeologistFacet,
          "UnencryptedShardHashMismatch"
        );
      });
    });
  });
});
