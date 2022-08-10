require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()
require('hardhat-gas-reporter')
require('solidity-coverage')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-deploy')

const RINKEBY_RPC_URL = process.env.RINKEBY_RPC_URL
const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const COINMARKET_API_KEY = process.env.COINMARKET_API_KEY

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    rinkeby: {
      url: RINKEBY_RPC_URL,
      accounts: [RINKEBY_PRIVATE_KEY], //ethers.getSigners()
      chainId: 4,
      blockConfirmation: 6,
    },
    hardhat: {
      blockConfirmation: 1,
      chainId: 31337,
    },
  },
  solidity: '0.8.8',
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enable: false,
    outputFile: 'gas-report.txt',
    noColors: true,
    currency: 'USD',
    coinmarketcap: COINMARKET_API_KEY,
    // token: 'MATIC',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    user: {
      default: 1,
    },
  },
  mocha: {
    timeout: 300000,
  },
}
