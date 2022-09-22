const { assert, expect } = require('chai')
const { getNamedAccounts, deployments, ethers, network } = require('hardhat')
const {
  developmentChains,
  networkConfig,
} = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('Raffle Unit Tests', () => {
      let raffle, deployer, vrfCoordinatorV2Mock, entranceFee, interval
      const chainId = network.config.chainId

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(['all'])
        raffle = await ethers.getContract('Raffle', deployer)
        vrfCoordinatorV2Mock = await ethers.getContract(
          'VRFCoordinatorV2Mock',
          deployer
        )
        entranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
      })
      //Test constructor
      describe('Constructor', async () => {
        it('Intializes the entranceFee correctly', async () => {
          const entranceFee = await raffle.getEntranceFee()
          assert.equal(entranceFee.toString(), entranceFee)
        })
        it('Intializes the gasLane correctly', async () => {
          const gasLane = await raffle.getGasLane()
          const expectedGasLane = networkConfig[chainId]['gasLane']
          assert.equal(gasLane.toString(), expectedGasLane)
        })
        it('Intializes the raffleState correctly', async () => {
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), '0')
        })
        it('Intializes the lastTimeStamp correctly', async () => {
          const blockNumBefore = await ethers.provider.getBlockNumber()
          const blockBefore = await ethers.provider.getBlock(blockNumBefore)
          const timestampBefore = blockBefore.timestamp
          const expectedTimeStamp = await raffle.getLastTimeStamp()
          assert.equal(timestampBefore, expectedTimeStamp)
        })
        it('Intializes the interval correctly', async () => {
          const expectedInterval = networkConfig[chainId]['interval']
          assert.equal(interval, expectedInterval)
        })
      })
      //Test enterRaffle
      describe('enteRaffle', async () => {
        it("Fails if you don't send enough ETH for the entrance fee", async () => {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
            raffle,
            'enterRaffle_NotEnoughETHEntered'
          )
        })
        it('raffle state is open', async () => {
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), '0')
        })
        it('Fails if raffle state is not open', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          //Increase the time by the interval(30s)
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          //Mine a new block
          await network.provider.send('evm_mine', [])
          //call performUpkeep with empty call data ([]) or ("0x")
          await raffle.performUpkeep([])
          await expect(
            raffle.enterRaffle({ value: entranceFee })
          ).to.be.revertedWithCustomError(raffle, 'enterRaffle_RaffleNotOpen')
        })
        it('player is added to the players array', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          const expected = await raffle.getPlayer(0)
          assert.equal(deployer, expected)
        })
        it('emits event on enter', async () => {
          await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
            raffle,
            'RaffleEnter'
          )
        })
      })
      //Test checkUpkeep
      describe('checkUpkeep', async () => {
        it('Fails if raffle state is not open', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), '1')
          assert.equal(upkeepNeeded, false)
        })
        it('Fails if not enough time has passed', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it("Fails if player hasn't sent enough ETH & no player has joined", async () => {
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it('returns true if enough time has passed, has players, eth, and is open', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded)
        })
      })
      //Test performUpkeep
      describe('performUpkeep', () => {
        it('it can only run if checkupkeep is true', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          const tx = await raffle.performUpkeep([])
          assert(tx)
        })
        it('Fails if checkUpkeep is false', async () => {
          await expect(raffle.performUpkeep([])).to.be.revertedWithCustomError(
            raffle,
            'performUpkeep__UpkeepNotNeeded'
          )
        })
        it('raffle state is calculating', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), '1')
        })
        it('emits event on performUpkeep', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          await expect(raffle.performUpkeep([])).to.emit(
            raffle,
            'RequestedRaffleWinner'
          )
        })
        it('calls the vrf coordinator', async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
          const txResponse = await raffle.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const requestId = txReceipt.events[1].args.requestId
          assert(requestId.toNumber() > 0)
        })
      })
      //Test fulfillRandomWords
      describe('fulfillRandomWords', () => {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ])
          await network.provider.send('evm_mine', [])
        })
        it('it can only be called after performUpkeep', async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith('nonexistent request')
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith('nonexistent request')
        })
        it('picks a winner', async () => {
          //Connect 3 additional Player accounts to contract
          const additionalPlayers = 3
          const startingAccountIndex = 1 
          const accounts = await ethers.getSigners()
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalPlayers;
            i++
          ) {
            const accountCountedRaffle = raffle.connect(accounts[i])
            await accountCountedRaffle.enterRaffle({ value: entranceFee })
          }
          //performUpkeep (mock being Chainlink Keepers)
          //fulfillRandomWords (mock being the chainlink VRF)
          //We will have to wait for the fulfillRandomWords to be called by throwing a promise
          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('Winner Picked!')
              try {
                const recentWinner = await raffle.getRecentWinner()
                //Seeing which account is the winner
                // console.log(recentWinner);
                // console.log(account[0]);
                // console.log(account[1]);
                // console.log(account[2]);
                // console.log(account[3]);
                assert.equal(recentWinner.toString(), accounts[1].address)
                resolve() 
              } catch (e) {
                reject(e)
              }
            })
            const tx = await raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            )
          })
        })
        it('sends money to winner', async () => 
          const additionalPlayers = 3
          const startingAccountIndex = 1 // deployer = 0
          const accounts = await ethers.getSigners()
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalPlayers;
            i++
          ) {
            const accountCountedRaffle = raffle.connect(accounts[i])
            await accountCountedRaffle.enterRaffle({ value: entranceFee })
          }
          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('Winner Picked!')
              try {
                const winnerBalance = await accounts[1].getBalance()
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (entranceFee * additionalPlayers) + entranceFee )
                    .add(entranceFee.mul(additionalPlayers).add(entranceFee))
                    .toString()
                )
                resolve()
              } catch (e) {
                reject(e) 
              }
            })
            const tx = await raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            const startingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            )
          })
        })
        it('resets the lottery', async () => {
          const additionalPlayers = 3
          const startingAccountIndex = 1
          const accounts = await ethers.getSigners()
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalPlayers;
            i++
          ) {
            const accountCountedRaffle = raffle.connect(accounts[i])
            await accountCountedRaffle.enterRaffle({ value: entranceFee })
          }
          const startingTimeStamp = await raffle.getLastTimeStamp()
          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('Winner Picked!')
              try {
                const raffleState = await raffle.getRaffleState()
                const endingTimeStamp = await raffle.getLastTimeStamp()
                const numPlayers = await raffle.getNumberOfPlayers()
                assert.equal(numPlayers.toString(), '0')
                assert.equal(raffleState.toString(), '0')
                assert(endingTimeStamp > startingTimeStamp)
                resolve()
              } catch (e) {
                reject(e)
              }
            })
            const tx = await raffle.performUpkeep([])
            const txReceipt = await tx.wait(1)
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            )
          })
        })
        it('emits event when the winner is picked', async () => {
          const additionalPlayers = 3
          const startingAccountIndex = 1
          const accounts = await ethers.getSigners()
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalPlayers;
            i++
          ) {
            const accountCountedRaffle = raffle.connect(accounts[i])
            await accountCountedRaffle.enterRaffle({ value: entranceFee })
          }

          const tx = await raffle.performUpkeep([])
          const txReceipt = await tx.wait(1)
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            )
          ).to.emit(raffle, 'WinnerPicked')
        })
      })
    })
