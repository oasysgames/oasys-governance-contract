import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
// import "@nomicfoundation/hardhat-ethers";

import "./tasks/gen-deploycode";

// samples
import "./tasks/samples/counter";
import "./tasks/samples/bank";
import "./tasks/samples/counter-upgradable";

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
    oasysmainnet: {
      url: "https://rpc.mainnet.oasys.games",
    },
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
