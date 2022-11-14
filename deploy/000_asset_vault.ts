import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

module.exports = async ({ getNamedAccounts, deployments }) => {
  let heritageTokenAddress: string;

  const { deploy, diamond } = hre.deployments;
  const { deployer, signatory } = await hre.getNamedAccounts();

  

  // Get the address of the HeritageToken contract
  if (
    hre.hardhatArguments.network === "develop" ||
    hre.hardhatArguments.network === "localhost" ||
    !hre.hardhatArguments.network
  ) {
    const heritageTokenMock = await deploy("HeritageTokenMock", {
      from: deployer,
      log: true,
    });
    heritageTokenAddress = heritageTokenMock.address;
  } else if (["goerli", "goerli-fork"].includes(hre.hardhatArguments.network)) {
    heritageTokenAddress = process.env.HERITAGE_TOKEN_ADDRESS_GOERLI || "";
  } else if (["mainnet", "mainnet-fork"].includes(hre.hardhatArguments.network)) {
    heritageTokenAddress = process.env.HERITAGE_TOKEN_ADDRESS_MAINNET || "";
  }
  else if (["bttc_testnet", "bttc_testnet-fork"].includes(hre.hardhatArguments.network)) {
    heritageTokenAddress = process.env.HERITAGE_TOKEN_ADDRESS_BTTC_TESTNET || "0x6400809865E8aff1EfE04DFDD948DFb0619331c2";
  }
  // 0x6400809865E8aff1EfE04DFDD948DFb0619331c2
  else {
    throw Error(`Heritage is not set up for this network: ${hre.hardhatArguments.network}`);
  }

  // Deploy the facets. Note that running diamond.deploy again will not redeploy
  // the diamond. It will reuse the diamond contracts that have already been
  // deployed.
  // The only reason for doing diamond.deploy again is to execute
  // AppStorageInit. This is pretty much just a convenience.
  // Protocol fee defaults to 1% (100bps)
  const protocolFeeBasePercentage = process.env.PROTOCOL_FEE_BASE_PERCENTAGE || "1";
  const gracePeriod = process.env.GRACE_PERIOD_SECONDS || "3600";
  const expirationThreshold = process.env.EXPIRATION_THRESHOLD_SECONDS || "3600";

  await deploy("AssetVaultList", { // 0x6DE7F3029b448af40c1F5071eEC3CD69f0804830
    from: deployer,
    args: [ heritageTokenAddress ],
    
    log: true,
  });
  console.log('Gotten here 0')
  const ethers = hre.ethers;
  // console.log('ethers:', ethers==undefined)
  // console.log('signatory:', signatory)
  const assetVaultList = await ethers.getContract("AssetVaultList");
  const heritageToken = await ethers.getContractAt("HeritageTokenMock", heritageTokenAddress);//   const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamondC.address);
  
  // console.log('Gotten here 1:', assetVaultList.address)

  // console.log('Balance here 1: ', ethers.utils.formatEther( await heritageToken.balanceOf(deployer) ))

  let txT = await heritageToken.connect(await ethers.getSigner(deployer)).transfer(signatory, ethers.utils.parseEther("10000"), {
    gasLimit : '1800000'
  });
  //console.log('TXT: ')
  await txT.wait();
  // console.log('diamondAddress:', diamondC.address, ', heritageToken: ', heritageToken.address)
  console.log('Gotten here 2')
  const signatorySigner = await ethers.getSigner(signatory)
  let tx1 = await heritageToken.connect(signatorySigner).approve(assetVaultList.address, ethers.constants.MaxUint256);
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
};

module.exports.tags = ["AssetVaultList" /*, "Greeter", "Storage", "SupportToken"*/ ];
