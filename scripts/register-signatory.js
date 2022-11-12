// Transfer 10,000 heritage tokens to an address
// transferAddress defaults to the first unnamed hardhat local node account
const amountToTransfer = "10000000000000000000000";
const mockTokenAddress = process.env.TRANSFER_ADDRESS || "0x6400809865E8aff1EfE04DFDD948DFb0619331c2";
const assetVaultListAddress = "0x31b89cF4bb3E2660382e6A63973b6e504e1965f0";

const hre = require("hardhat");

// Add supported networks to this list on a need basis
const allowedNetworks = ["localhost", "bttc_testnet"];

(async () => {
  if (!allowedNetworks.includes(hre.hardhatArguments.network)) {
    throw new Error(
      `Transfer script is meant to be used on these networks only:\n${allowedNetworks}\n`
    );
  }

  const heritageToken = await hre.ethers.getContractAt("HeritageTokenMock", mockTokenAddress);
  const assetVaultList = await hre.ethers.getContractAt("AssetVaultList", assetVaultListAddress);
  const unsignedAccounts = await hre.getUnnamedAccounts();
  const { deployer, signatory } = await hre.getNamedAccounts();

  

  await heritageToken.transfer(signatory, hre.ethers.BigNumber.from(amountToTransfer));

  const signatorySigner = await ethers.getSigner(signatory)
  let tx1 = await heritageToken.connect(signatorySigner).approve(assetVaultListAddress, ethers.constants.MaxUint256);
  await tx1.wait();
  console.log('Gotten here 3')

  const signatoryMinDiggingFee = ethers.utils.parseEther("10");
  const maxRewrapInterval = 30;
  await assetVaultList
      .connect(signatorySigner)
      .registerSignatory(
        "myFakePeerId",
        signatoryMinDiggingFee,
        maxRewrapInterval,
        ethers.utils.parseEther("5000")
      );


  console.log("Done");
})();
