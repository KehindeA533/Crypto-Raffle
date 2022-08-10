const { ethers } = require('hardhat')

const networkConfig = {
  // 4: {
  //   name: 'rinkeby',
  //   VRFCoordinatorV2: '0x6168499c0cffcacd319c818142124b7a15e857ab',
  //   entranceFee: ethers.utils.parseEther('0.01'),
  //   gasLane:
  //     '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
  //   subscriptionId: '10015',
  //   callbackGasLimit: '500000', // 500,000
  //   interval: '30', //30 seconds
  // },
  31337: {
    name: 'hardhat',
    entranceFee: ethers.utils.parseEther('0.01'),
    gasLane:
      '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
    callbackGasLimit: '500000',
    interval: '30',
  },
  4: {
    name: 'rinkeby',
    subscriptionId: '10015',
    gasLane:
      '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc', // 30 gwei
    interval: '30',
    entranceFee: ethers.utils.parseEther('0.01'), // 0.1 ETH
    callbackGasLimit: '500000', // 500,000 gas
    vrfCoordinatorV2: '0x6168499c0cFfCaCD319c818142124B7A15E857ab',
  },
}

const developmentChains = ['hardhat', 'localhost']
module.exports = { networkConfig, developmentChains }
