import { task } from 'hardhat/config'

const expectedAddress = '0x180539819EfEf57625Eb5c3903a1805b2c7aEB8A'
const initalCount = 132
// counter contract address
const implementation = '0x330B679183aBeFB38592dA23E96836C8AEdf8CD5'

task('sample-counter-upgradable', 'Generate deployment bytecode for CounterUpgradable').setAction(async (_, hre) => {
  const { ethers } = hre

  const factory = await ethers.getContractFactory('CounterUpgradable')
  const deplyTx = await factory.getDeployTransaction()

  console.log(`
deplyment bytecode:

${deplyTx.data}
`)

  const upgradable = await ethers.getContractAt('CounterUpgradable', expectedAddress)
  const callUpgrade = await upgradable.getFunction('upgradeToAndCall').populateTransaction(implementation)
  console.log(`
  upgradeToAndCall calldata:

${callUpgrade.data}
`)

  const counter = await ethers.getContractAt('Counter', implementation)
  const call = await counter.getFunction('inialize').populateTransaction(initalCount)

  console.log(`
  inialize calldata:

${call.data}
`)
})
