const { network, ethers } = require('hardhat')

const BASE_FEE = ethers.utils.parseEther('0.25') // 0.25 is the premium
const GAS_PRICE_LINK = 1e9 //link per gas

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  const args = [BASE_FEE, GAS_PRICE_LINK]

  if (chainId == 31337) {
    log('local network detected! Deploying mocks...')
    await deploy('VRFCoordinatorV2Mock', {
      contract: 'VRFCoordinatorV2Mock',
      from: deployer,
      log: true,
      args: args,
    })
    log('Mocks deployed!')
    log('--------------------------------------------')
  }
}

module.exports.tags = ['all', 'mocks']
