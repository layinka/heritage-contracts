import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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
  } else {
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

  await diamond.deploy("Diamond", {
    from: deployer,
    owner: deployer,
    facets: [
      "VaultOwnerFacet",
      "VaultOwnerAssetFacet",
      "SignatoryFacet",
      "ThirdPartyFacet",
      "ViewStateFacet",
      "AdminFacet",
    ],
    execute: {
      contract: "AppStorageInit",
      methodName: "init",
      args: [
        heritageTokenAddress,
        protocolFeeBasePercentage,
        gracePeriod,
        expirationThreshold
      ],
    },
    log: true,
  });

  const ethers = hre.ethers;
  // console.log('ethers:', ethers==undefined)
  // console.log('signatory:', signatory)
  const diamondC = await ethers.getContract("Diamond_DiamondProxy");
  const heritageToken = await ethers.getContract("HeritageTokenMock");
  
  const signatoryFacet = await ethers.getContractAt("SignatoryFacet", diamondC.address);
  const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamondC.address);

  await heritageToken.transfer(signatory, ethers.utils.parseEther("10000"));
  // console.log('diamondAddress:', diamondC.address, ', heritageToken: ', heritageToken.address)

  const signatorySigner = await ethers.getSigner(signatory)
  await heritageToken.connect(signatorySigner).approve(diamondC.address, ethers.constants.MaxUint256);
  

  const signatoryMinDiggingFee = ethers.utils.parseEther("10");
  const maxRewrapInterval = 30;
  await signatoryFacet
      .connect(signatorySigner)
      .registerSignatory(
        "myFakePeerId",
        signatoryMinDiggingFee,
        maxRewrapInterval,
        ethers.utils.parseEther("5000")
      );
};

export default func;
