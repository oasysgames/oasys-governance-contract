require('dotenv').config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

import "./tasks/gen-deploycode";
import "./tasks/bulk-create";

// samples
import "./tasks/samples/counter";
import "./tasks/samples/bank";
import "./tasks/samples/counter-upgradable";
// import "./tasks/samples/mock-proxy";

const DEPLOYER_KEY: string = process.env.DEPLOYER_KEY || "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000
      }
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      gasPrice: 0,
    },
    oasystestnet: {
      url: "https://rpc.testnet.oasys.games",
      accounts: [DEPLOYER_KEY]
    },
    oasysmainnet: {
      url: "https://rpc.mainnet.oasys.games",
      accounts: [DEPLOYER_KEY]
    },
  },
  namedAccounts: {
		deployer: 0,
	},
  etherscan: {
    apiKey: {
      oasysmainnet: "abc"
    },
    customChains: [
      {
        network: "oasysmainnet",
        chainId: 248,
        urls: {
          apiURL: "https://explorer.oasys.games/api",
          browserURL: "https://explorer.oasys.games/"
        }
      }
    ]
  },
  mocha: {
    timeout: 1000 * 60 * 3, // 3 minutes
  },
};

export default config;
