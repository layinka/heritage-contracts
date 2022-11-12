import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import { generateHistory } from "./tasks/generate-history";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "@nomiclabs/hardhat-solhint";
import "hardhat-contract-sizer";

dotenv.config();

// Defining this manually since ethers cannot be access from within the hardhat config
const hashZero = "0x0000000000000000000000000000000000000000000000000000000000000000";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  // const walletPrivateKey = new hre.ethers.Wallet('0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e');
  // console.log('Pub key for ', walletPrivateKey.address, ' is ', walletPrivateKey.publicKey);
});

/**
 * Generates fake historical data on the app for testing.
 *
 * Config for this task can be found in tasks/generate-history/config.ts
 *
 * IMPORTANT: If you are running a node on localhost using `npx hardhat node` then you must run this
 * task with `--network localhost`.
 * ```
 * npx hardhat generate-history --network localhost
 * ```
 *
 * The purpose of generating this data is so that we can have some metrics on the signatories on
 * chain. This task is expensive and modifies the block timestamps and therefore cannot be run
 * anywhere other than localhost.
 *
 * Note that since this task modifies the block timestamps it will only work once, since subsequent
 * attempts to create a vault will cause the contract to think a vault is being created in
 * the past. To run this command again, simply restart the node.
 *
 * Also note that the signatories being registered here will NOT appear on the list of
 * signatories in the web app. This is because each signatory must have an signatory
 * service running in order to appear on the list. The web app may be modified temporarily to show
 * offline signatories for testing purposes, in which case these signatories will appear on
 * the list.
 */
task("generate-history", "Generates fake historical data for testing")
  .addOptionalParam(
    "signatoryCount",
    "The number of signatories to register. Defaults to 20."
  )
  .addOptionalParam(
    "vaultCount",
    "The number of vaults to create. This uses a random number of signatories that have been registered. Defaults to 10."
  )
  .addOptionalParam(
    "accusedVaultCount",
    "The number of vaults to accuse. All signatories on each vault will be accused. Defaults to 2 vaults."
  )
  .addOptionalParam(
    "signatoryUnwrapChance",
    "The probability that an signatory will unwrap the vaults they are associated with. Defaults to 0.85."
  )
  .setAction(generateHistory);

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
       {
         version: "0.5.16",
         settings: {
         
          optimizer: {
            enabled: true,
            runs: 200,
            
          }
        }
       },
       {
         version: "0.6.6",
         settings: {
         
          optimizer: {
            enabled: true,
            runs: 200,
            
          }
        }
       },
       {
         version: "0.8.17",
          settings: {
            viaIR : true,
            optimizer: {
              enabled: true,
              runs: 200,
              details: {
                // yul: true
              }
            }
          }
        }
    ],
    
  },
  namedAccounts: {
    deployer: {
      default: 0,
      mainnet: `privatekey://${process.env.MAINNET_DEPLOYER_PRIVATE_KEY}`,
      goerli: `privatekey://${process.env.GOERLI_DEPLOYER_PRIVATE_KEY}`,
    },
    signatory: {
      default: 1,
      mainnet: `privatekey://${process.env.MAINNET_SIGNATORY_PRIVATE_KEY}`,
      goerli: `privatekey://${process.env.GOERLI_SIGNATORY_PRIVATE_KEY}`,
    },
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      chainId: 5,
      url: process.env.GOERLI_PROVIDER || "",
      accounts: [process.env.GOERLI_DEPLOYER_PRIVATE_KEY || hashZero],
    },
    rinkeby: {
      chainId: 4,
      url: process.env.RINKEBY_PROVIDER || "",
      accounts: [process.env.RINKEBY_DEPLOYER_PRIVATE_KEY || hashZero],
    },
    hardhat: {
      accounts: {
        count: 300,
      },
    },
    bttc_testnet: {
      url: "https://pre-rpc.bt.io",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_2] : [],
      chainId: 1029,
      gas: 10000000,
      timeout: 200000
    },
   bttc: {
      url: "https://rpc.bt.io",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_2] : [],
      chainId: 199,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COIN_MARKET_CAP_API_KEY,

    // Uncomment to override gas price
    gasPrice: 20,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
