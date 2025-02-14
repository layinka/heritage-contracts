import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import {
  accuseArchaeologistsOnSarcophagus,
  compromiseSarcophagus,
} from "../helpers/accuse";
import { getFreshAccount } from "../helpers/accounts";
import time from "../../utils/time";
import { ArchaeologistData } from "../helpers/archaeologistSignature";
import {
  getArchaeologistFreeBondSarquitos,
  getArchaeologistLockedBondSarquitos,
} from "../helpers/bond";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.burySarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(
          ethers.utils.solidityKeccak256(["string"], ["nonexistent"])
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusDoesNotExist`
      );
    });
    it("the sarcophagus has been compromised", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusCompromised`
      );
    });
    it("the sarcophagus has been buried", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusInactive`
      );
    });
    it("the sender is not the embalmer", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(await getFreshAccount())
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SenderNotEmbalmer`
      );
    });
    it("the resurrection time has passed", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `ResurrectionTimeInPast`
      );
    });
  });

  describe("Successfully buries a sarcophagus with no accusals", function () {
    it("Should pay digging fees to each of the cursed archaeologists", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistRewards = await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData) =>
            await viewStateFacet.getRewards(archaeologist.archAddress)
        )
      );

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      // check post rewrap rewards on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostRewrapRewards =
              await viewStateFacet.getRewards(archaeologist.archAddress);

            expect(archaeologistPostRewrapRewards).to.equal(
              startingArchaeologistRewards[index].add(
                archaeologist.diggingFeeSarquitos
              )
            );
          }
        )
      );
    });
    it("Should unlock the bonds of each of the cursed archaeologists", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistBonds = await Promise.all(
        archaeologists.map(async (archaeologist: ArchaeologistData) => ({
          freeBond: await getArchaeologistFreeBondSarquitos(
            archaeologist.archAddress
          ),
          lockedBond: await getArchaeologistLockedBondSarquitos(
            archaeologist.archAddress
          ),
        }))
      );

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      // check post curse bond on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostCurseFreeBond =
              await getArchaeologistFreeBondSarquitos(
                archaeologist.archAddress
              );
            const archaeologistPostCurseLockedBond =
              await getArchaeologistLockedBondSarquitos(
                archaeologist.archAddress
              );

            expect(archaeologistPostCurseFreeBond).to.equal(
              startingArchaeologistBonds[index].freeBond.add(
                archaeologist.diggingFeeSarquitos
              )
            );

            expect(archaeologistPostCurseLockedBond).to.equal(
              startingArchaeologistBonds[index].lockedBond.sub(
                archaeologist.diggingFeeSarquitos
              )
            );
          }
        )
      );
    });
    it("Should update the resurrectionTime and emit BurySarcophagus", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);
      const result = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      expect(result.resurrectionTime).to.equal(ethers.constants.MaxUint256);
      await expect(tx).to.emit(embalmerFacet, "BurySarcophagus");
    });
  });
  describe("Successfully buries a sarcophagus with fewer than k accusals", function () {
    it("Should not pay digging fees to the accused cursed archaeologists", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      // save starting free and locked bonds for all archaeologists
      const startingArchaeologistRewards = await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData) =>
            await viewStateFacet.getRewards(archaeologist.archAddress)
        )
      );
      const { accusedArchaeologists } = await accuseArchaeologistsOnSarcophagus(
        sarcophagusData.threshold - 1,
        sarcophagusData.sarcoId,
        archaeologists
      );
      const accusedArchaeologistAddresses = accusedArchaeologists.map(
        (accusedArchaeologist: ArchaeologistData) =>
          accusedArchaeologist.archAddress
      );
      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      // check post rewrap rewards on all archaeologists
      await Promise.all(
        archaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostRewrapRewards =
              await viewStateFacet.getRewards(archaeologist.archAddress);
            // verify accused archaeologists have not received rewards
            if (
              accusedArchaeologistAddresses.includes(archaeologist.archAddress)
            ) {
              expect(archaeologistPostRewrapRewards).to.equal(
                startingArchaeologistRewards[index]
              );
            } else {
              expect(archaeologistPostRewrapRewards).to.equal(
                startingArchaeologistRewards[index].add(
                  archaeologist.diggingFeeSarquitos
                )
              );
            }
          }
        )
      );
    });
    it("Should not increase the free bonds of the accused archaeologists", async function () {
      const { embalmerFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      const { accusedArchaeologists } = await accuseArchaeologistsOnSarcophagus(
        sarcophagusData.threshold - 1,
        sarcophagusData.sarcoId,
        archaeologists
      );
      const innocentArchaeologists = archaeologists.slice(
        sarcophagusData.threshold - 1,
        archaeologists.length
      );

      // save starting free and locked bonds for all accused archaeologists
      const startingAccusedArchaeologistBonds = await Promise.all(
        accusedArchaeologists.map(async (archaeologist: ArchaeologistData) => ({
          freeBond: await getArchaeologistFreeBondSarquitos(
            archaeologist.archAddress
          ),
          lockedBond: await getArchaeologistLockedBondSarquitos(
            archaeologist.archAddress
          ),
        }))
      );

      // save starting free and locked bonds for all innocent archaeologists
      const startingInnocentArchaeologistBonds = await Promise.all(
        innocentArchaeologists.map(
          async (archaeologist: ArchaeologistData) => ({
            freeBond: await getArchaeologistFreeBondSarquitos(
              archaeologist.archAddress
            ),
            lockedBond: await getArchaeologistLockedBondSarquitos(
              archaeologist.archAddress
            ),
          })
        )
      );

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      // check post bury bond on all accused archaeologists has not changed
      await Promise.all(
        accusedArchaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostBuryFreeBond =
              await getArchaeologistFreeBondSarquitos(
                archaeologist.archAddress
              );
            const archaeologistPostBuryLockedBond =
              await getArchaeologistLockedBondSarquitos(
                archaeologist.archAddress
              );

            expect(archaeologistPostBuryFreeBond).to.equal(
              startingAccusedArchaeologistBonds[index].freeBond
            );

            expect(archaeologistPostBuryLockedBond).to.equal(
              startingAccusedArchaeologistBonds[index].lockedBond
            );
          }
        )
      );
      // check post bury bond on innocent archaeologists has been unlocked
      await Promise.all(
        innocentArchaeologists.map(
          async (archaeologist: ArchaeologistData, index: number) => {
            const archaeologistPostBuryFreeBond =
              await getArchaeologistFreeBondSarquitos(
                archaeologist.archAddress
              );
            const archaeologistPostBuryLockedBond =
              await getArchaeologistLockedBondSarquitos(
                archaeologist.archAddress
              );

            expect(archaeologistPostBuryFreeBond).to.equal(
              startingInnocentArchaeologistBonds[index].freeBond.add(
                archaeologist.diggingFeeSarquitos
              )
            );

            expect(archaeologistPostBuryLockedBond).to.equal(
              startingInnocentArchaeologistBonds[index].lockedBond.sub(
                archaeologist.diggingFeeSarquitos
              )
            );
          }
        )
      );
    });
  });
});
